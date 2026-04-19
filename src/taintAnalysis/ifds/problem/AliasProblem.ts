import { Stmt } from '../../../core/base/Stmt';
import { Value } from '../../../core/base/Value';
import { Local } from '../../../core/base/Local';
import { ArkMethod } from '../../../core/model/ArkMethod';
import { TaintFact } from '../TaintFact';
import { AccessPath } from '../AccessPath';
import { IFDSManager } from '../IFDSManager';
import { PathEdge, PathEdgePoint } from '../../../core/dataflow/Edge';
import { ArkAssignStmt, ArkReturnStmt } from '../../../core/base/Stmt';
import { ArkInstanceInvokeExpr } from '../../../core/base/Expr';
import { ArkInstanceFieldRef, ArkStaticFieldRef, ArkArrayRef } from '../../../core/base/Ref';
import Logger from '../../../utils/logger';
import { LOG_MODULE_TYPE } from '../../../utils/logger';
import { Aliasing } from '../aliasing/Aliasing';
import { getColorText } from '../../util';
import { AbstractTaintProblem, TaintFlowFunction } from './AbstractTaintProblem';
import { THIS_NAME } from '../../../core/common/TSConst';
import { StaticFieldTrackingMode } from '../../config/IFDSConfig';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'AliasProblem');

/**
 * 别名分析问题定义
 * 参考 FlowDroid AliasProblem.java 实现
 * 
 * 这是一个后向数据流问题，用于寻找污点变量的所有别名
 */
export class AliasProblem extends AbstractTaintProblem {

    constructor(ifdsManager: IFDSManager, entryMethod: ArkMethod) {
        super(ifdsManager, entryMethod);
        this.ifdsManager = ifdsManager;
    }

    getNormalFlowFunction(srcStmt: Stmt, tgtStmt: Stmt): TaintFlowFunction {
        const self = this;

        // 只处理赋值语句
        if (!(srcStmt instanceof ArkAssignStmt)) {
            return {
                getDataFacts: (fact: TaintFact) => new Set(),
                getDataFactsWithCtxNode: (ctxNode: PathEdgePoint<TaintFact>, currFact: TaintFact) => new Set([currFact]),
            };
        }

        // 需要有前向求解器
        if (!this.ifdsManager.getForwardSolver()) {
            logger.warn('Forward solver is not set');
            return {
                getDataFacts: (fact: TaintFact) => new Set(),
                getDataFactsWithCtxNode: (ctxNode: PathEdgePoint<TaintFact>, currFact: TaintFact) => new Set([currFact]),
            };
        }

        return {
            getDataFacts: (fact: TaintFact) => new Set(),
            getDataFactsWithCtxNode: (ctxNode: PathEdgePoint<TaintFact>, currFact: TaintFact): Set<TaintFact> => {
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

                return self.computeAliases(srcStmt, currFact, ctxNode);
            }
        };
    }

    /**
     * 判断 assignStmt 中是否包含污点的别名
     */
    private computeAliases(assignStmt: ArkAssignStmt, fact: TaintFact, ctxNode: PathEdgePoint<TaintFact>): Set<TaintFact> {
        const res = new Set<TaintFact>();

        const lhs = assignStmt.getLeftOp();
        const rhs = assignStmt.getRightOp();
        const taintedVar = fact.getAccessPath();

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
                const newFact = this.createNewFactAndAddToForwardSolver(assignStmt, fact, ctxNode, rhs, { cutFirstField: true });
                // 新的污点加入结果集中, 继续后向传播
                newFact && res.add(newFact);
            } else if (lhs instanceof ArkStaticFieldRef &&
                taintedVar.isStaticFieldRef() &&
                taintedVar.firstFieldMatches(lhs.getFieldSignature()) &&
                taintedVar.getFields()!.length > 1 // 污点变量需要是 lhs 的字段, 才能产生别名
            ) {
                // lhs = X.f, taintedVar = X.f.g.*
                const newFact = this.createNewFactAndAddToForwardSolver(assignStmt, fact, ctxNode, rhs, { cutFirstField: true });
                newFact && res.add(newFact);
            } else if (lhs instanceof Local && taintedVar.isInstanceFieldRef()) {
                // lhs = x, taintedVar = x.y.*
                const newFact = this.createNewFactAndAddToForwardSolver(assignStmt, fact, ctxNode, rhs);
                // 新的污点加入结果集中, 继续后向传播
                newFact && res.add(newFact);
            } else if (lhs instanceof Local && taintedVar.isArrayTaintedByElement()) {
                // lhs = a, a is tainted by a[i]
                const newFact = this.createNewFactAndAddToForwardSolver(assignStmt, fact, ctxNode, rhs, { isArrayTaintedByElement: true });
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
                    const newFact = this.createNewFactAndAddToForwardSolver(assignStmt, fact, ctxNode, lhs, { cutFirstField: true });
                    // 新的污点加入结果集中, 继续后向传播
                    newFact && lhs instanceof ArkInstanceFieldRef && res.add(newFact);
                } else if (this.ifdsManager.getConfig().staticFieldTrackingMode === StaticFieldTrackingMode.ContextFlowSensitive
                    && rhs instanceof ArkStaticFieldRef
                    && taintedVar.isStaticFieldRef()
                    && taintedVar.firstFieldMatches(rhs.getFieldSignature())
                ) {
                    // rhs = X.f, taintedVar = X.f(.g.*)
                    const newFact = this.createNewFactAndAddToForwardSolver(assignStmt, fact, ctxNode, lhs, { cutFirstField: true });
                    newFact && res.add(newFact);
                } else if (rhs instanceof Local && taintedVar.isInstanceFieldRef()) {
                    // rhs = x, taintedVar = x.y.*
                    const newFact = this.createNewFactAndAddToForwardSolver(assignStmt, fact, ctxNode, lhs);
                    newFact && lhs instanceof ArkInstanceFieldRef && res.add(newFact);
                } else if (rhs instanceof Local && taintedVar.isArrayTaintedByElement()) {
                    // rhs = a, a is tainted by a[i]
                    const newFact = this.createNewFactAndAddToForwardSolver(assignStmt, fact, ctxNode, lhs, { isArrayTaintedByElement: true });
                    newFact && lhs instanceof ArkArrayRef && res.add(newFact);
                }
            }
        }


        return res;
    }

    private createNewFactAndAddToForwardSolver(
        assignStmt: ArkAssignStmt,
        fact: TaintFact,
        ctxNode: PathEdgePoint<TaintFact>,
        newValue: Value,
        options?: any
    ): TaintFact | undefined {
        if (!this.ifdsManager.getForwardSolver()) {
            logger.warn('Forward solver is not set');
            return;
        }

        let newFact: TaintFact | undefined = undefined;

        if (newValue instanceof Local || newValue instanceof ArkInstanceFieldRef || newValue instanceof ArkStaticFieldRef || newValue instanceof ArkArrayRef) {
            // stmt: a = b, taintedVar = a.f.* => newFact = b.f.*
            // === OR ===
            // stmt: a = b.bf, taintedVar = a.f.* => newFact = b.bf.f.*
            // === OR ===
            // stmt: a = B.bf, taintedVar = a.f.* => newFact = B.bf.f.*
            let newAP: AccessPath | undefined;
            if (!options?.isArrayTaintedByElement) {
                newAP = fact.getAccessPath().deriveWithNewBase(newValue, options);
            } else {
                // === OR ===
                // stmt: a = b, a is tainted by a[i] => newFact = b
                if (newValue instanceof ArkArrayRef) {
                    // 处理多维数组
                    newValue = newValue.getBase();
                }
                newAP = AccessPath.createElementTaintedArrayAccessPath(newValue as Local);
            }

            newAP && (newFact = fact.deriveWithNewAccessPath(newAP, newValue, assignStmt));

            if (newFact) {
                // 注入边到前向求解器
                const forwardSolver = this.ifdsManager.getForwardSolver()!;
                const succs = forwardSolver.findSuccessorsOf(assignStmt);

                for (const succ of succs) {
                    const ctxStmts = forwardSolver.findStartStmtsOfMethod(succ.getCfg().getDeclaringMethod());

                    for (const ctxStmt of ctxStmts) {
                        const newEdge: PathEdge<TaintFact> = new PathEdge(
                            new PathEdgePoint(ctxStmt, ctxNode.fact),
                            new PathEdgePoint(succ, newFact!)
                        );
                        forwardSolver.processEdge(newEdge);
                    }
                }
            }
        }

        return newFact;
    }

    getCallFlowFunction(srcStmt: Stmt, method: ArkMethod): TaintFlowFunction {
        const self = this;

        return {
            getDataFacts: (currFact: TaintFact): Set<TaintFact> => {
                logger.debug(getColorText('debugg CallFlow ', 'yellow'),
                    srcStmt.toString(),
                    getColorText(`${currFact.toString()}`, 'yellow'));

                const result = new Set<TaintFact>();

                if (self.isExcludedMethod(srcStmt, method)) {
                    return result;
                }

                if (currFact.isZeroFact()) {
                    result.add(currFact);
                    return result;
                }

                // 污点路径转化：实参 -> 形参、this 指针、返回值转化
                const factsFromCallerToCallee: Set<TaintFact> = self.transFactsFromCallerToCallee(srcStmt, method, currFact);
                factsFromCallerToCallee.forEach(fact => {
                    result.add(fact);
                });

                return result;
            }
        };
    }

    getExitToReturnFlowFunction(srcStmt: Stmt, tgtStmt: Stmt, callStmt: Stmt): TaintFlowFunction {
        const self = this;
        const exitStmt = srcStmt;
        const callee = exitStmt.getCfg()?.getDeclaringMethod();

        return {
            getDataFacts: () => new Set(),

            getDataFactsWithCtxNode: (ctxNode: PathEdgePoint<TaintFact>, currFact: TaintFact): Set<TaintFact> => {
                logger.debug(getColorText('debugg ExitToReturnFlow ', 'yellow'),
                    srcStmt.toString(),
                    getColorText(`${currFact.toString()}`, 'yellow'));

                const result = new Set<TaintFact>();

                if (!callStmt.getInvokeExpr()) {
                    logger.warn(`Call statement has no invoke expression: ${callStmt.toString()}`);
                }

                if (currFact.isZeroFact()) {
                    return result;
                }

                // 静态字段 fact 在 ContextFlowSensitive 模式下需要传回 caller
                if (currFact.getAccessPath().isStaticFieldRef()) {
                    if (self.ifdsManager.getConfig().staticFieldTrackingMode === StaticFieldTrackingMode.ContextFlowSensitive) {
                        result.add(currFact);
                    }
                    return result;
                }

                // 污点路径转化：形参 -> 实参, this 指针转化
                const factsFromCalleeToCaller: Set<TaintFact> = self.transFactsFromCalleeToCaller(srcStmt, callStmt, currFact, ctxNode);

                // 正向 solver 已在 exit flow 中触发别名查找, alias solver 暂无需继续查找
                // factsFromCalleeToCaller.forEach(fact => {
                //     result.add(fact);
                // });

                return new Set();
            }
        };
    }

    getCallToReturnFlowFunction(callStmt: Stmt, returnSite: Stmt): TaintFlowFunction {
        const self = this;
        const invokeExpr = callStmt.getInvokeExpr();

        return {
            getDataFacts: () => new Set(),

            getDataFactsWithCallees: (callees: Set<ArkMethod>, currFact: TaintFact): Set<TaintFact> => {
                logger.debug(getColorText('debugg CallToReturnFlow ', 'yellow'),
                    callStmt.toString(),
                    getColorText(`${currFact.toString()}`, 'yellow'));

                if (currFact.isZeroFact()) {
                    return new Set([currFact]);
                }

                if (currFact.getAccessPath().isStaticFieldRef()) {
                    if (self.ifdsManager.getConfig().staticFieldTrackingMode === StaticFieldTrackingMode.ContextFlowSensitive &&
                        Array.from(callees).every(callee => self.ifdsManager.isStaticFieldRead(callee, currFact.getAccessPath().getFields()![0])) &&
                        !self.isExcludedMethod(callStmt)
                    ) {
                        // 如果 callee 使用了该静态字段，不让它直通
                        return new Set();
                    }
                }

                // 如果 lhs 被覆盖，不传播
                if (callStmt instanceof ArkAssignStmt) {
                    if (callStmt.getLeftOp() === currFact.getAccessPath().getBase()) {
                        return new Set();
                    }
                }

                // 如果 base 被污染，不传播
                if (invokeExpr instanceof ArkInstanceInvokeExpr) {
                    if (invokeExpr.getBase() === currFact.getAccessPath().getBase()) {
                        return new Set();
                    }
                }

                // 如果参数被污染，不传播
                if (invokeExpr) {
                    for (const arg of invokeExpr.getArgs()) {
                        if (arg === currFact.getAccessPath().getBase()) {
                            return new Set();
                        }
                    }
                }

                // 其他情况传播
                return new Set([currFact]);
            }
        };
    }

    private transFactsFromCallerToCallee(srcStmt: Stmt, method: ArkMethod, fact: TaintFact): Set<TaintFact> {
        const res = new Set<TaintFact>();

        if (fact.getAccessPath().isEmpty() || !srcStmt.getInvokeExpr() || !method.getBody()) {
            return res;
        }

        if (fact.getAccessPath().isStaticFieldRef()) {
            // 静态字段 fact 在 ContextFlowSensitive 模式下直接传入 callee
            if (this.ifdsManager.getConfig().staticFieldTrackingMode === StaticFieldTrackingMode.ContextFlowSensitive) {
                // 只传入读取该静态字段的 callee
                const firstField = fact.getAccessPath().getFields()?.[0];
                if (firstField && this.ifdsManager.isStaticFieldRead(method, firstField)) {
                    res.add(fact);
                }
            }
            return res;
        }

        // 处理返回值
        // 如果 lhs 被污染, 污染返回值
        if (srcStmt instanceof ArkAssignStmt && srcStmt.getLeftOp() === fact.getAccessPath().getBase()) {
            const returnStmts = this.findReturnStmts(method);
            for (const rs of returnStmts) {
                if (rs instanceof ArkReturnStmt) {
                    const returnOp = rs.getOp();
                    const newAP = fact.getAccessPath().deriveWithNewBase(returnOp);
                    if (newAP) {
                        const newFact = fact.deriveWithNewAccessPath(newAP, returnOp, srcStmt);
                        newFact && res.add(newFact);
                    }
                }
            }
        }

        const invokeExpr = srcStmt.getInvokeExpr()!;
        const factBase = fact.getAccessPath().getBase();
        const factFields = [...(fact.getAccessPath().getFields() ?? [])];

        // 若是实例方法调用, 如 obj.method(), 且 fact 的 base 为 obj, 将 fact 的 base 改为 method 的 thisLocal
        if (invokeExpr instanceof ArkInstanceInvokeExpr) {
            if (factBase === invokeExpr.getBase()) {
                // 获取 method 的 thisLocal
                const calleeThisLocal = method.getBody()!.getLocals().get(THIS_NAME);
                if (calleeThisLocal) {
                    // AP{base=obj} -> AP{base=this}
                    const newAP = AccessPath.createAccessPath(calleeThisLocal, factFields);
                    if (newAP) {
                        const newFact = fact.deriveWithNewAccessPath(newAP, calleeThisLocal, srcStmt);
                        newFact && res.add(newFact);
                    }
                }
            }
        }

        // 若某个实参 与 fact 的 base 相同, 则创建 AP{base=paramLocal, fields=factFields}
        invokeExpr.getArgs().forEach((arg, i) => {
            if (arg === factBase) {
                const paramLocal = this.findParamLocal(method, i);
                if (paramLocal) {
                    // 如果 callee 内部覆写了参数, 则不传进 callee
                    if (this.isParamLocalOverwritten(method, paramLocal)) {
                        return;
                    }

                    const newAccessPath = AccessPath.createAccessPath(paramLocal, factFields);
                    if (newAccessPath) {
                        const newFact = fact.deriveWithNewAccessPath(newAccessPath, paramLocal, srcStmt);
                        newFact && res.add(newFact);
                    }
                }
            }
        });

        return res;
    }

    private transFactsFromCalleeToCaller(srcStmt: Stmt, callStmt: Stmt, fact: TaintFact, ctxNode: PathEdgePoint<TaintFact>): Set<TaintFact> {
        const res = new Set<TaintFact>();

        const factBase = fact.getAccessPath().getBase();
        const factFields = [...(fact.getAccessPath().getFields() ?? [])];
        const callee = srcStmt.getCfg().getDeclaringMethod();
        if (!callee.getBody()) {
            return res;
        }

        const invokeExpr = callStmt.getInvokeExpr()!;

        // 处理参数映射: callee.param[i] → caller.args[i]
        invokeExpr.getArgs().forEach((arg: Value, i) => {
            if (!AccessPath.canContainValue(arg)) {
                return;
            }

            const ap = fact.getAccessPath();
            if (!ap.isInstanceFieldRef() && !ap.isArrayTaintedByElement()) {
                return;
            }

            const paramLocal = this.findParamLocal(callee, i);
            if (!paramLocal || factBase !== paramLocal) {
                return;
            }

            let newFact: TaintFact | undefined = undefined;
            const newAP = AccessPath.createAccessPath(arg, factFields);
            newAP && (newFact = fact.deriveWithNewAccessPath(newAP, arg, srcStmt));
            if (newFact) {
                res.add(newFact);

                // 处理 func(o, o) 多个参数相同的情况, 需要污染别名的参数并注入正向 solver, 参考 HeapTest.testAliases
                invokeExpr.getArgs().forEach((anotherArg, j) => {
                    if (j !== i && anotherArg === arg) {
                        const anotherParamLocal = this.findParamLocal(callee, j);
                        let anotherAP: AccessPath | undefined = undefined;
                        let anotherFact: TaintFact | undefined = undefined;
                        anotherParamLocal && (anotherAP = fact.getAccessPath().deriveWithNewBase(anotherParamLocal));
                        anotherParamLocal && anotherAP && (anotherFact = fact.deriveWithNewAccessPath(anotherAP, anotherParamLocal, srcStmt));
                        const forwardSolver = this.ifdsManager.getForwardSolver();
                        if (anotherFact && forwardSolver) {
                            const ctxStmts = forwardSolver.findStartStmtsOfMethod(callee);
                            const ctxFact = ctxNode.fact;
                            ctxStmts.forEach(s => {
                                const newCtxPoint = new PathEdgePoint<TaintFact>(s, ctxFact);
                                const anotherPoint = new PathEdgePoint<TaintFact>(s, anotherFact);
                                forwardSolver.processEdge(new PathEdge<TaintFact>(newCtxPoint, anotherPoint));
                            })
                        }
                    }
                });

                // 处理 func(a) {return a} 的请况, 参考 HeapTest.testDoubleAliasTest
                this.findReturnStmts(callee).forEach(rs => {
                    if (rs instanceof ArkReturnStmt && rs.getOp() === paramLocal) {
                        const forwardSolver = this.ifdsManager.getForwardSolver();
                        if (forwardSolver) {
                            const ctxStmts = forwardSolver.findStartStmtsOfMethod(callee);
                            const ctxFact = ctxNode.fact;
                            for (const s of ctxStmts) {
                                const newCtxPoint = new PathEdgePoint<TaintFact>(s, ctxFact);
                                const newPoint = new PathEdgePoint<TaintFact>(srcStmt, fact);
                                forwardSolver.processEdge(new PathEdge<TaintFact>(newCtxPoint, newPoint));
                                return; // this.findReturnStmts(callee).forEach
                            }
                        }
                    }
                });

            }
        });

        // 处理 this 映射: callee.this → caller.base
        if (invokeExpr instanceof ArkInstanceInvokeExpr) {
            // 排除 lhs 也是 caller.base 的情况, 如 a = a.f()
            // const callerBaseOverwritten = callStmt instanceof ArkAssignStmt && invokeExpr.getBase() === callStmt.getLeftOp();

            const calleeThisLocal = callee.getBody()!.getLocals().get(THIS_NAME);
            if (factBase === calleeThisLocal) {
                const callerBase = invokeExpr.getBase();
                let newFact: TaintFact | undefined = undefined;
                const newAP = AccessPath.createAccessPath(callerBase, factFields);
                newAP && (newFact = fact.deriveWithNewAccessPath(newAP, callerBase, srcStmt));
                if (newFact) {
                    res.add(newFact);
                }
            }
        }

        return res;
    }
}
