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

import { Stmt } from '../../../core/base/Stmt';
import { Value } from '../../../core/base/Value';
import { ArkMethod } from '../../../core/model/ArkMethod';
import { TaintFact } from '../TaintFact';
import { AccessPath } from '../AccessPath';
import { IFDSManager } from '../IFDSManager';
import { AliasSolver } from '../AliasSolver';
import { PathEdge, PathEdgePoint } from '../../../core/dataflow/Edge';
import { IAliasingStrategy } from './IAliasingStrategy';
import { Aliasing } from '../Aliasing';

/**
 * 流敏感别名分析策略
 * 参考 FlowDroid 的 FlowSensitiveAliasStrategy 实现
 * 
 * 核心机制：
 * 1. 当发现新污点时，创建非活跃抽象并启动后向求解器
 * 2. 后向求解器寻找所有可能指向同一堆对象的变量
 * 3. 找到别名时，注入到前向求解器
 * 4. 当经过激活单元时，非活跃抽象变为活跃
 */
export class FlowSensitiveAliasStrategy implements IAliasingStrategy {

    private manager: IFDSManager;
    private backwardSolver: AliasSolver | null = null;

    constructor(manager: IFDSManager) {
        this.manager = manager;
    }

    /**
     * 设置后向求解器
     */
    public setBackwardSolver(solver: AliasSolver): void {
        this.backwardSolver = solver;
    }

    /**
     * 寻找污点的别名
     * 当发现新污点时，启动后向分析寻找别名
     */
    public computeAliasTaints(
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

        // 检查后向求解器是否可用
        if (!this.backwardSolver) {
            const bwSolver = this.manager.getBackwardSolver();
            if (bwSolver && bwSolver instanceof AliasSolver) {
                this.backwardSolver = bwSolver;
            } else {
                // 后向求解器不可用，无法进行别名分析
                return;
            }
        }

        // 创建非活跃抽象, activationUnit 设置为 taintingStmt，表示只有经过 taintingStmt 时才会激活
        const inActiveFact = newFact.deriveInactiveFact(taintingStmt);

        // 反向沿着 ICFG 寻找别名
        for (const predUnit of this.backwardSolver.getPredecessorsOf(taintingStmt)) {
            const edge = new PathEdge<TaintFact>(
                new PathEdgePoint<TaintFact>(predUnit, ctxFact),
                new PathEdgePoint<TaintFact>(predUnit, inActiveFact)
            );
            this.backwardSolver.processEdge(edge);
        }

        this.backwardSolver.solve();
    }

    /**
     * 注入调用上下文
     * 连接前向和后向分析的调用上下文
     */
    public injectCallingContext(
        d3: TaintFact,
        forwardSolver: unknown,
        callee: ArkMethod,
        callSite: Stmt,
        source: TaintFact,
        d1: TaintFact
    ): void {
        // 将上下文信息传递给前向求解器
        const solver = forwardSolver as { processEdge: (edge: PathEdge<TaintFact>) => void };
        if (solver && typeof solver.processEdge === 'function') {
            // 创建从调用点到 callee 入口的边
            // 这样前向求解器可以继续传播别名污点
            const cfg = callee.getCfg();
            if (cfg) {
                const startingStmt = cfg.getStartingStmt();
                if (startingStmt) {
                    const edge = new PathEdge<TaintFact>(
                        new PathEdgePoint<TaintFact>(callSite, d1),
                        new PathEdgePoint<TaintFact>(startingStmt, d3)
                    );
                    solver.processEdge(edge);
                }
            }
        }
    }

    /**
     * 是否是流敏感的别名分析
     */
    public isFlowSensitive(): boolean {
        return true;
    }

    /**
     * 判断两个访问路径是否可能别名
     * 简化实现：如果两个访问路径相同，则可能别名
     */
    public mayAlias(ap1: AccessPath, ap2: AccessPath): boolean {
        // 如果两个访问路径完全相同，则可能别名
        if (ap1 === ap2) {
            return true;
        }

        // 如果 base 相同且都是实例字段引用，可能别名
        const base1 = ap1.getBase();
        const base2 = ap2.getBase();

        if (base1 && base2 && base1 === base2) {
            const fields1 = ap1.getFields();
            const fields2 = ap2.getFields();

            // 如果都没有字段（都是 Local），则可能别名
            if ((!fields1 || fields1.length === 0) && (!fields2 || fields2.length === 0)) {
                return true;
            }

            // 如果都有字段且第一个字段相同，可能别名
            if (fields1 && fields1.length > 0 && fields2 && fields2.length > 0) {
                return fields1[0] === fields2[0] ||
                    fields1[0]?.toString() === fields2[0]?.toString();
            }
        }

        // 静态字段：如果字段签名相同，则可能别名
        if (ap1.isStaticFieldRef() && ap2.isStaticFieldRef()) {
            const fields1 = ap1.getFields();
            const fields2 = ap2.getFields();
            if (fields1 && fields1.length > 0 && fields2 && fields2.length > 0) {
                return fields1[0] === fields2[0] ||
                    fields1[0]?.toString() === fields2[0]?.toString();
            }
        }

        return false;
    }

    /**
     * 是否是交互式别名算法
     */
    public isInteractive(): boolean {
        return true;  // 流敏感别名分析是交互式的
    }
}
