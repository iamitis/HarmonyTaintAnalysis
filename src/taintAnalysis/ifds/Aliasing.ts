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
import { TaintFact } from './TaintFact';
import { AccessPath } from './AccessPath';
import { IFDSManager } from './IFDSManager';
import { IAliasingStrategy } from './aliasing/IAliasingStrategy';
import { NullAliasStrategy } from './aliasing/NullAliasStrategy';
import { FlowSensitiveAliasStrategy } from './aliasing/FlowSensitiveAliasStrategy';
import { AbstractFieldRef, ArkInstanceFieldRef, ArkStaticFieldRef, ArkArrayRef } from '../../core/base/Ref';
import { PrimitiveType } from '../../core/base/Type';
import { PointerAnalysis } from '../../callgraph/pointerAnalysis/PointerAnalysis';
import { LOG_MODULE_TYPE, Logger, NodeID, PagNode } from '../..';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'Aliasing');

/**
 * 别名分析管理类
 * TODO: 完善注释
 */
export class Aliasing {

    /* ifds 管理器 */
    private manager: IFDSManager;

    /* 别名分析策略, 目前有空策略和流敏感策略 */
    private aliasingStrategy: IAliasingStrategy;

    /* 指针分析器, 此处用于判断两个变量是否指向同一个值 */
    private pta?: PointerAnalysis;

    constructor(manager: IFDSManager, strategy?: IAliasingStrategy, pta?: PointerAnalysis) {
        this.manager = manager;
        // 默认使用空策略（无别名分析）
        this.aliasingStrategy = strategy || new NullAliasStrategy();
        this.pta = pta;
    }

    /**
     * 设置别名分析策略
     */
    public setAliasingStrategy(strategy: IAliasingStrategy): void {
        this.aliasingStrategy = strategy;
    }

    /**
     * 获取别名分析策略
     */
    public getAliasingStrategy(): IAliasingStrategy {
        return this.aliasingStrategy;
    }

    public getPTA(): PointerAnalysis | undefined {
        return this.pta;
    }

    /**
     * 寻找污点的别名
     * 
     * @param ctxFact 方法入口点的抽象
     * @param taintingStmt 当前语句（别名分析的起点）
     * @param taintedValue 目标值（被污染的变量）
     * @param taintSet 污点集合（用于收集结果）
     * @param method 当前方法
     * @param newFact 新创建的污点抽象
     */
    public computeAliases(
        ctxFact: TaintFact,
        taintingStmt: Stmt,
        taintedValue: Value,
        taintSet: Set<TaintFact>,
        method: ArkMethod,
        newFact: TaintFact
    ): void {
        if (!Aliasing.canHaveAliases(taintedValue)) {
            return;
        }

        if (!ctxFact.getVariable().isEmpty()) {
            this.aliasingStrategy.computeAliasTaints(ctxFact, taintingStmt, taintedValue, taintSet, method, newFact);
        } else {
            // TODO: 寻找隐式污点别名
        }
    }

    /**
     * 判断受污变量是否可能有别名
     * 某些类型的值不可能有别名（如基本类型）
     * @param variable 受污变量
     */
    public static canHaveAliases(variable: Value): boolean {
        if (variable instanceof ArkStaticFieldRef) {
            if (variable.getType() instanceof PrimitiveType) {
                return false;
            }
            return true;
        }

        if (variable instanceof ArkInstanceFieldRef || variable instanceof ArkArrayRef) {
            return true;
        }

        return false;
    }

    /**
     * Collect all possible targets of a value using pointer analysis.
     */
    private collectPts(value: Value): Set<NodeID> {
        if (!this.pta) {
            return new Set();
        }
        const pts: Set<NodeID> = new Set();
        const valueNodes = this.pta.getPag().getNodesByValue(value)?.values();
        if (!valueNodes) return pts;

        for (const nodeID of valueNodes) {
            const node = this.pta.getPag().getNode(nodeID) as PagNode;
            for (const pt of node.getPointTo()) {
                pts.add(pt);
            }
        }
        return pts;
    }

    /**
     * 利用 pta 判断两个值是否一定是别名
     */
    public mustAlias(val1: Value, val2: Value): boolean {
        if (!this.pta) {
            logger.warn('Pointer analysis is not set, mustAlias cannot work');
            return false;
        }

        if (val1 === val2) {
            return true;
        }

        const pts1 = this.collectPts(val1);
        const pts2 = this.collectPts(val2);

        // must alias: 双方各只有一个指向目标，且是同一个
        if (pts1.size !== 1 || pts2.size !== 1) return false;

        const leftPt = pts1.values().next().value;
        const rightPt = pts2.values().next().value;
        return leftPt === rightPt;
    }

    /**
     * 判断两个值是否可能别名
     * TODO: 删除或修改这个方法, 方法不完善且方法名有歧义
     */
    public mayAlias(val1: Value, val2: Value): boolean {
        if (!AccessPath.canContainValue(val1) || !AccessPath.canContainValue(val2)) {
            return false;
        }

        if (val1 === val2) {
            return true;
        }

        // 创建 AccessPath 并使用策略判断
        const ap1 = AccessPath.createAccessPath(val1);
        const ap2 = AccessPath.createAccessPath(val2);

        if (ap1 && ap2) {
            return this.aliasingStrategy.mayAlias(ap1, ap2);
        }

        return false;
    }

    /**
     * 判断两个访问路径是否可能别名
     */
    public mayAliasAccessPath(ap1: AccessPath, ap2: AccessPath): boolean {
        return this.aliasingStrategy.mayAlias(ap1, ap2);
    }

    /**
     * 判断 value 和 fact 是否是同一个变量, 或 value 是否包含 fact (如 value=a.f, fact=a.f.g)
     */
    public static baseMatches(value: Value, fact: TaintFact): boolean {
        const ap = fact.getVariable();

        if (value instanceof Local) {
            return value === ap.getBase();
        } else if (value instanceof ArkStaticFieldRef) {
            return value.getType() === ap.getBaseType() && value.getFieldSignature() === ap.getFields()?.[0];
        } else if (value instanceof ArkInstanceFieldRef) {
            return value.getBase() === ap.getBase() && value.getFieldSignature() === ap.getFields()?.[0];
        }

        return false;
    }

    /**
     * 严格判断 value 和 fact 是否指向同一个变量
     */
    public static baseMatchesStrict(value: Value, fact: TaintFact): boolean {
        if (!Aliasing.baseMatches(value, fact)) {
            return false;
        }

        const ap = fact.getVariable();

        if (value instanceof Local) {
            return ap.isLocal();
        }
        if (value instanceof AbstractFieldRef) {
            return ap.getFields()?.length === 1;
        }

        return false;
    }

    /**
     * 检查第一个字段是否匹配
     */
    private static firstFieldMatches(ap: AccessPath, field: any): boolean {
        const fields = ap.getFields();
        if (!fields || fields.length === 0) {
            return false;
        }
        return fields[0] === field || fields[0]?.toString() === field?.toString();
    }

    /**
     * 创建流敏感别名分析策略
     */
    public static createFlowSensitiveStrategy(manager: IFDSManager): FlowSensitiveAliasStrategy {
        return new FlowSensitiveAliasStrategy(manager);
    }

    /**
     * 创建空别名分析策略
     */
    public static createNullStrategy(): NullAliasStrategy {
        return new NullAliasStrategy();
    }
}
