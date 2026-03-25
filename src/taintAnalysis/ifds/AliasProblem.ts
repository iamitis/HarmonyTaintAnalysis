/*
 * Copyright (c) 2024-2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Stmt } from '../../core/base/Stmt';
import { Value } from '../../core/base/Value';
import { Local } from '../../core/base/Local';
import { ArkMethod } from '../../core/model/ArkMethod';
import { DataflowProblem, FlowFunction } from '../../core/dataflow/DataflowProblem';
import { TaintFact } from './TaintFact';
import { AccessPath } from './AccessPath';
import { IFDSManager } from './IFDSManager';
import { PathEdge, PathEdgePoint } from '../../core/dataflow/Edge';
import { AliasSolver } from './AliasSolver';
import { ArkAssignStmt, ArkInvokeStmt, ArkReturnStmt } from '../../core/base/Stmt';
import { AbstractBinopExpr, AbstractInvokeExpr, ArkInstanceInvokeExpr, ArkUnopExpr } from '../../core/base/Expr';
import { AbstractFieldRef, ArkInstanceFieldRef, ArkStaticFieldRef, ArkArrayRef } from '../../core/base/Ref';
import { Type, PrimitiveType, ClassType } from '../../core/base/Type';
import Logger from '../../utils/logger';
import { LOG_MODULE_TYPE } from '../../utils/logger';
import { Aliasing } from './Aliasing';
import { Constant } from '../../core/base/Constant';
import { TaintFlowFunction } from './TaintProblem';
import { getColorText } from '../util';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'AliasProblem');

/**
 * 别名分析问题定义
 * 参考 FlowDroid AliasProblem.java 实现
 * 
 * 这是一个后向数据流问题，用于寻找污点变量的所有别名
 */
export class AliasProblem extends DataflowProblem<TaintFact> {

    private manager: IFDSManager;
    private entryMethod: ArkMethod;
    private entryPoint: Stmt;

    /** 激活单元到调用点的映射 */
    private activationUnitsToCallSites: Map<Stmt, Set<Stmt>>;

    constructor(manager: IFDSManager, entryMethod: ArkMethod) {
        super();
        this.manager = manager;
        this.entryMethod = entryMethod;
        this.activationUnitsToCallSites = new Map();
        this.entryPoint = this.getFirstStmt(entryMethod);
    }

    /**
     * 获取方法的第一条语句
     */
    private getFirstStmt(method: ArkMethod): Stmt {
        const startingStmt = method.getCfg()?.getStartingStmt();
        if (startingStmt) {
            return startingStmt;
        }
        throw new Error('Cannot find entry point for method: ' + method.getName());
    }

    // ==================== Normal Flow Function ====================

    getNormalFlowFunction(srcStmt: Stmt, tgtStmt: Stmt): TaintFlowFunction {
        const self = this;

        // 只处理赋值语句
        if (!(srcStmt instanceof ArkAssignStmt)) {
            return {
                getDataFacts: (fact: TaintFact) => new Set(),
                getDataFactsWithCtxFact: (fact: TaintFact) => new Set([fact]),
            };
        }

        // 需要有前向求解器
        if (!this.manager.getForwardSolver()) {
            logger.warn('Forward solver is not set');
            return {
                getDataFacts: (fact: TaintFact) => new Set(),
                getDataFactsWithCtxFact: (fact: TaintFact) => new Set([fact]),
            };
        }

        return {
            getDataFacts: (fact: TaintFact) => new Set(),
            getDataFactsWithCtxFact: (ctxFact: TaintFact, currFact: TaintFact): Set<TaintFact> => {
                logger.debug(getColorText('debugg NormalFlow ', 'yellow'),
                    srcStmt.toString(),
                    getColorText(`${currFact.toString()}`, 'yellow'));

                if (currFact.isActive()) {
                    logger.warn(`Fact "${currFact.toString()}" is active at stmt "${srcStmt.toString()}", skipping`);
                    return new Set();
                }

                // 零值不传播
                if (currFact.isZeroFact()) {
                    return new Set();
                }

                return self.computeAliases(srcStmt, currFact, ctxFact);
            }
        };
    }

    /**
     * 判断 assignStmt 中是否包含污点的别名
     */
    private computeAliases(assignStmt: ArkAssignStmt, fact: TaintFact, ctxFact: TaintFact): Set<TaintFact> {
        const res = new Set<TaintFact>();

        const lhs = assignStmt.getLeftOp();
        const rhs = assignStmt.getRightOp();
        const taintedVar = fact.getVariable();

        // 检查污点是否是 lhs 或 lhs 的字段
        if (Aliasing.baseMatches(lhs, fact)) {
            if (Aliasing.baseMatchesStrict(lhs, fact)) {
                res.add(fact);
            } else {
                // 此时污点变量是 lhs 的字段, lhs 被覆写说明污点变量不会再有别名, fact 无需继续后向传播
            }

            if (lhs instanceof ArkInstanceFieldRef &&
                taintedVar.isInstanceFieldRef() &&
                lhs.getFieldSignature() === taintedVar.getFields()![0] &&
                taintedVar.getFields()!.length > 1 // 污点变量需要是 lhs 的字段, 才能产生别名
            ) {
                // lhs = x.y, taintedVar = x.y.z.*
                const newFact = this.createNewFactAndAddToForwardSolver(assignStmt, fact, ctxFact, rhs, { cutFirstField: true });
                // 新的污点加入结果集中, 继续后向传播
                newFact && res.add(newFact);
            } else if (lhs instanceof Local && taintedVar.isInstanceFieldRef()) {
                // lhs = x, taintedVar = x.y.*
                const newFact = this.createNewFactAndAddToForwardSolver(assignStmt, fact, ctxFact, rhs);
                // 新的污点加入结果集中, 继续后向传播
                newFact && res.add(newFact);
            } else if (lhs instanceof Local && taintedVar.isArrayTaintedByElement()) {
                // lhs = a, a is tainted by a[i]
                const newFact = this.createNewFactAndAddToForwardSolver(assignStmt, fact, ctxFact, rhs, { isArrayTaintedByElement: true });
                newFact && res.add(newFact);
            }
        } else {
            // 当前污点没有被覆写, 继续向后传播
            res.add(fact);

            // 检查 rhs
            if (Aliasing.baseMatches(rhs, fact)) {
                if (rhs instanceof ArkInstanceFieldRef &&
                    taintedVar.isInstanceFieldRef() &&
                    rhs.getFieldSignature() === taintedVar.getFields()![0] &&
                    taintedVar.getFields()!.length > 1 // 污点变量需要是 rhs 的字段, 才能产生别名
                ) {
                    // rhs = x.y, taintedVar = x.y.z.*
                    const newFact = this.createNewFactAndAddToForwardSolver(assignStmt, fact, ctxFact, lhs, { cutFirstField: true });
                    // 新的污点加入结果集中, 继续后向传播
                    newFact && res.add(newFact);
                } else if (rhs instanceof Local && taintedVar.isInstanceFieldRef()) {
                    // rhs = x, taintedVar = x.y.*
                    const newFact = this.createNewFactAndAddToForwardSolver(assignStmt, fact, ctxFact, lhs);
                    // 新的污点加入结果集中, 继续后向传播
                    newFact && res.add(newFact);
                } else if (rhs instanceof Local && taintedVar.isArrayTaintedByElement()) {
                    // rhs = a, a is tainted by a[i]
                    const newFact = this.createNewFactAndAddToForwardSolver(assignStmt, fact, ctxFact, lhs, { isArrayTaintedByElement: true });
                    newFact && res.add(newFact);
                }
            }
        }


        return res;
    }

    private createNewFactAndAddToForwardSolver(
        assignStmt: ArkAssignStmt,
        fact: TaintFact,
        ctxFact: TaintFact,
        newValue: Value,
        options?: any
    ): TaintFact | undefined {
        if (!this.manager.getForwardSolver()) {
            logger.warn('Forward solver is not set');
            return;
        }

        let newFact: TaintFact | undefined = undefined;

        if (newValue instanceof Local || newValue instanceof ArkInstanceFieldRef) {
            // stmt: a = b, taintedVar = a.f.* => newFact = b.f.*
            // === OR ===
            // stmt: a = b.f, taintedVar = a.f.g.* => newFact = b.f.g.*
            let newAP: AccessPath | undefined;
            if (!options?.isArrayTaintedByElement) {
                newAP = fact.getVariable().deriveWithNewBase(newValue, options);
            } else {
                // === OR ===
                // stmt: a = b, a is tainted by a[i] => newFact = b
                newAP = AccessPath.createElementTaintedArrayAccessPath(newValue as Local);
            }

            newAP && (newFact = fact.deriveWithNewAccessPath(newAP, assignStmt));

            if (newFact) {
                // 注入边到前向求解器
                const forwardSolver = this.manager.getForwardSolver()!;
                forwardSolver.getSuccessorsOf(assignStmt).forEach((successor) => {
                    const newEdge: PathEdge<TaintFact> = new PathEdge(
                        new PathEdgePoint(assignStmt, ctxFact),
                        new PathEdgePoint(successor, newFact!)
                    );
                    forwardSolver.processEdge(newEdge);
                });
            }
        }

        return newFact;
    }


    /**
     * 创建左侧别名：当右侧匹配污点时，污染左侧
     */
    private createLeftSideAlias(
        defStmt: ArkAssignStmt,
        leftValue: Value,
        rightBase: Value,
        source: TaintFact
    ): TaintFact | null {
        const sourceAP = source.getVariable();

        // 情况1：右侧是实例字段 x.f，source 是 x.f 或 x.f.*
        if (rightBase instanceof ArkInstanceFieldRef) {
            const ref = rightBase;
            if (sourceAP.isInstanceFieldRef() &&
                ref.getBase() === sourceAP.getBase() &&
                this.firstFieldMatches(sourceAP, ref.getFieldSignature())) {
                const newAP = this.copyWithNewValue(sourceAP, leftValue, true);
                if (newAP) {
                    return this.checkAbstraction(source.deriveNewAbstraction(newAP, defStmt));
                }
            }
        }
        // 情况2：右侧是静态字段 X.f
        else if (rightBase instanceof ArkStaticFieldRef) {
            if (sourceAP.isStaticFieldRef() &&
                this.firstFieldMatches(sourceAP, rightBase.getFieldSignature())) {
                const newAP = this.copyWithNewValue(sourceAP, leftValue, true);
                if (newAP) {
                    return this.checkAbstraction(source.deriveNewAbstraction(newAP, defStmt));
                }
            }
        }
        // 情况3：右侧是 Local，直接匹配
        else if (rightBase instanceof Local && sourceAP.getBase() === rightBase) {
            const newAP = this.copyWithNewValue(sourceAP, leftValue, false);
            if (newAP) {
                return this.checkAbstraction(source.deriveNewAbstraction(newAP, defStmt));
            }
        }

        return null;
    }

    /**
     * 创建右侧别名：当左侧匹配污点时，污染右侧
     */
    private createRightSideAlias(
        defStmt: ArkAssignStmt,
        leftValue: Value,
        rightBase: Value,
        source: TaintFact
    ): TaintFact | null {
        const sourceAP = source.getVariable();
        let addRightValue = false;
        let cutFirstField = false;

        // 情况1：左侧是实例字段 x.f
        if (leftValue instanceof ArkInstanceFieldRef) {
            const leftRef = leftValue;
            if (sourceAP.isInstanceFieldRef() &&
                leftRef.getBase() === sourceAP.getBase() &&
                this.firstFieldMatches(sourceAP, leftRef.getFieldSignature())) {
                addRightValue = true;
                cutFirstField = true;
            }
        }
        // 情况2：左侧是 Local，source 是实例字段
        else if (leftValue instanceof Local && sourceAP.isInstanceFieldRef()) {
            if (leftValue === sourceAP.getBase()) {
                addRightValue = true;
            }
        }
        // 情况3：左侧是数组引用 a[i]
        else if (leftValue instanceof ArkArrayRef) {
            const ar = leftValue;
            if (ar.getBase() === sourceAP.getBase()) {
                addRightValue = true;
            }
        }
        // 情况4：左侧是 Local，直接匹配
        else if (leftValue instanceof Local && leftValue === sourceAP.getBase()) {
            addRightValue = true;
        }

        if (!addRightValue) {
            return null;
        }

        // 创建新的 AccessPath
        const newAP = this.copyWithNewValue(sourceAP, rightBase, cutFirstField);
        if (!newAP) {
            return null;
        }

        const newAbs = this.checkAbstraction(source.deriveNewAbstraction(newAP, defStmt));

        if (newAbs && !this.accessPathEquals(newAbs.getVariable(), sourceAP)) {
            return newAbs;
        }
        return null;
    }

    // ==================== Call Flow Function ====================

    getCallFlowFunction(srcStmt: Stmt, method: ArkMethod): FlowFunction<TaintFact> {
        const self = this;
        const invokeExpr = srcStmt.getInvokeExpr();

        return {
            getDataFacts: (source: TaintFact): Set<TaintFact> => {
                if (source.isZeroFact()) {
                    return new Set();
                }

                const res = new Set<TaintFact>();

                // 步骤1：处理返回值污点
                if (srcStmt instanceof ArkAssignStmt) {
                    const leftOp = srcStmt.getLeftOp();
                    if (leftOp === source.getVariable().getBase()) {
                        // 在 callee 中寻找 return 语句
                        const cfg = method.getCfg();
                        if (cfg) {
                            for (const block of cfg.getBlocks()) {
                                for (const stmt of block.getStmts()) {
                                    if (stmt instanceof ArkReturnStmt) {
                                        const retOp = stmt.getOp();
                                        if (retOp instanceof Local || retOp instanceof AbstractFieldRef) {
                                            const newAP = self.copyWithNewValue(source.getVariable(), retOp, false);
                                            if (newAP) {
                                                const abs = self.checkAbstraction(source.deriveNewAbstraction(newAP, srcStmt));
                                                if (abs) {
                                                    res.add(abs);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // 步骤2：处理静态字段
                if (source.getVariable().isStaticFieldRef()) {
                    const abs = self.checkAbstraction(source.deriveNewAbstraction(source.getVariable(), srcStmt));
                    if (abs) {
                        res.add(abs);
                    }
                }

                // 步骤3：处理 this 引用
                if (!source.getVariable().isStaticFieldRef() && !method.isStatic() && invokeExpr instanceof ArkInstanceInvokeExpr) {
                    const sourceBase = source.getVariable().getBase();
                    const callBase = invokeExpr.getBase();

                    if (callBase === sourceBase) {
                        // 检查是否是参数
                        let isParam = false;
                        for (let i = 0; i < invokeExpr.getArgs().length; i++) {
                            if (invokeExpr.getArg(i) === sourceBase) {
                                isParam = true;
                                break;
                            }
                        }

                        if (!isParam) {
                            const thisLocal = method.getThisInstance();
                            if (thisLocal instanceof Local) {
                                const newAP = self.copyWithNewValue(source.getVariable(), thisLocal, false);
                                if (newAP) {
                                    const abs = self.checkAbstraction(source.deriveNewAbstraction(newAP, srcStmt));
                                    if (abs) {
                                        res.add(abs);
                                    }
                                }
                            }
                        }
                    }
                }

                // 步骤4：处理参数映射
                if (invokeExpr) {
                    for (let i = 0; i < invokeExpr.getArgs().length; i++) {
                        const arg = invokeExpr.getArg(i);
                        if (arg === source.getVariable().getBase()) {
                            const paramInstances = method.getParameterInstances();
                            if (i < paramInstances.length) {
                                const paramLocal = paramInstances[i];
                                if (paramLocal instanceof Local) {
                                    const newAP = self.copyWithNewValue(source.getVariable(), paramLocal, false);
                                    if (newAP) {
                                        const abs = self.checkAbstraction(source.deriveNewAbstraction(newAP, srcStmt));
                                        if (abs) {
                                            res.add(abs);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                return res;
            }
        };
    }

    // ==================== Return Flow Function ====================

    getExitToReturnFlowFunction(srcStmt: Stmt, tgtStmt: Stmt, callStmt: Stmt): FlowFunction<TaintFact> {
        const self = this;
        const exitStmt = srcStmt;
        const callee = exitStmt.getCfg()?.getDeclaringMethod();

        return {
            getDataFacts: (source: TaintFact): Set<TaintFact> => {
                if (source.isZeroFact()) {
                    return new Set();
                }

                const res = new Set<TaintFact>();
                const sourceBase = source.getVariable().getBase();

                // 步骤1：处理静态字段
                if (source.getVariable().isStaticFieldRef()) {
                    self.registerActivationCallSite(callStmt, callee!, source);
                    res.add(source);
                    return res;
                }

                const invokeExpr = callStmt.getInvokeExpr();

                // 步骤2：处理参数别名
                if (callee && invokeExpr) {
                    for (let i = 0; i < callee.getParameters().length; i++) {
                        const paramInstances = callee.getParameterInstances();
                        if (i < paramInstances.length) {
                            const paramLocal = paramInstances[i];
                            if (paramLocal instanceof Local && paramLocal === sourceBase) {
                                const originalCallArg = invokeExpr.getArg(i);

                                // 基本类型不能有别名
                                if (self.isPrimitiveTypeValue(source.getVariable())) {
                                    continue;
                                }

                                // 如果参数在 callee 中被写入，假设被覆盖
                                if (self.methodWritesValue(callee, paramLocal)) {
                                    continue;
                                }

                                const newAP = self.copyWithNewValue(source.getVariable(), originalCallArg, false);
                                if (newAP) {
                                    const abs = self.checkAbstraction(source.deriveNewAbstraction(newAP, exitStmt));
                                    if (abs) {
                                        res.add(abs);
                                        self.registerActivationCallSite(callStmt, callee, abs);
                                    }
                                }
                            }
                        }
                    }

                    // 步骤3：处理 this 引用
                    if (!callee.isStatic() && invokeExpr instanceof ArkInstanceInvokeExpr) {
                        const thisLocal = callee.getThisInstance();
                        if (thisLocal instanceof Local && thisLocal === sourceBase) {
                            const callerBase = invokeExpr.getBase();
                            const newAP = self.copyWithNewValue(source.getVariable(), callerBase, false);
                            if (newAP) {
                                const abs = self.checkAbstraction(source.deriveNewAbstraction(newAP, exitStmt));
                                if (abs) {
                                    res.add(abs);
                                    self.registerActivationCallSite(callStmt, callee, abs);
                                }
                            }
                        }
                    }
                }

                return res;
            }
        };
    }

    // ==================== CallToReturn Flow Function ====================

    getCallToReturnFlowFunction(srcStmt: Stmt, tgtStmt: Stmt): FlowFunction<TaintFact> {
        const self = this;
        const invokeExpr = srcStmt.getInvokeExpr();

        return {
            getDataFacts: (source: TaintFact): Set<TaintFact> => {
                if (source.isZeroFact()) {
                    return new Set();
                }

                // 如果 lhs 被覆盖，不传播
                if (srcStmt instanceof ArkAssignStmt) {
                    if (srcStmt.getLeftOp() === source.getVariable().getBase()) {
                        return new Set();
                    }
                }

                // 如果 base 被污染，不传播
                if (invokeExpr instanceof ArkInstanceInvokeExpr) {
                    if (invokeExpr.getBase() === source.getVariable().getBase()) {
                        return new Set();
                    }
                }

                // 如果参数被污染，不传播
                if (invokeExpr) {
                    for (const arg of invokeExpr.getArgs()) {
                        if (arg === source.getVariable().getBase()) {
                            return new Set();
                        }
                    }
                }

                // 其他情况传播
                return new Set([source]);
            }
        };
    }

    // ==================== 辅助方法 ====================

    /**
     * 检查抽象是否有效（排除基本类型）
     */
    private checkAbstraction(abs: TaintFact | null): TaintFact | null {
        if (!abs) return null;

        // 基本类型不能有别名
        const ap = abs.getVariable();
        if (!ap.isStaticFieldRef()) {
            if (this.isPrimitiveTypeValue(ap)) {
                return null;
            }
        }
        return abs;
    }

    /**
     * 注册激活调用点
     */
    private registerActivationCallSite(callSite: Stmt, callee: ArkMethod, abs: TaintFact): boolean {
        const activationUnit = abs.getActivationStmt();
        if (!activationUnit) return false;

        let callSites = this.activationUnitsToCallSites.get(activationUnit);
        if (!callSites) {
            callSites = new Set();
            this.activationUnitsToCallSites.set(activationUnit, callSites);
        }
        callSites.add(callSite);
        return true;
    }

    /**
     * 检查调用点是否激活污点
     */
    public isCallSiteActivatingTaint(callSite: Stmt, activationUnit: Stmt | null): boolean {
        if (!activationUnit) return false;
        const callSites = this.activationUnitsToCallSites.get(activationUnit);
        return callSites?.has(callSite) ?? false;
    }

    /**
     * 检查方法是否写入某个值
     */
    private methodWritesValue(method: ArkMethod, value: Local): boolean {
        const cfg = method.getCfg();
        if (!cfg) return false;

        for (const block of cfg.getBlocks()) {
            for (const stmt of block.getStmts()) {
                if (stmt instanceof ArkAssignStmt) {
                    const lhs = stmt.getLeftOp();
                    if (lhs === value ||
                        (lhs instanceof ArkInstanceFieldRef && lhs.getBase() === value)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * 检查第一个字段是否匹配
     */
    private firstFieldMatches(ap: AccessPath, field: any): boolean {
        const fields = ap.getFields();
        if (!fields || fields.length === 0) {
            return false;
        }
        return fields[0] === field || fields[0]?.toString() === field?.toString();
    }

    /**
     * 复制 AccessPath 并替换 base
     */
    private copyWithNewValue(ap: AccessPath, newBase: Value, cutFirstField: boolean): AccessPath | undefined {
        const origFields = ap.getFields();
        const fields = origFields ? [...origFields] : undefined;
        if (cutFirstField && fields && fields.length > 0) {
            fields.shift();
        }
        return AccessPath.createAccessPath(newBase, fields);
    }

    /**
     * 检查两个 AccessPath 是否相等
     */
    private accessPathEquals(ap1: AccessPath, ap2: AccessPath): boolean {
        return ap1 === ap2 || ap1.toString() === ap2.toString();
    }

    /**
     * 检查 AccessPath 的 base 是否是基本类型
     */
    private isPrimitiveTypeValue(ap: AccessPath): boolean {
        // 简化实现
        return false;
    }

    // ==================== 必须实现的抽象方法 ====================

    createZeroValue(): TaintFact {
        return TaintFact.createZeroFact();
    }

    getEntryPoint(): Stmt {
        return this.entryPoint;
    }

    getEntryMethod(): ArkMethod {
        return this.entryMethod;
    }

    factEqual(d1: TaintFact, d2: TaintFact): boolean {
        return d1.equals(d2);
    }
}
