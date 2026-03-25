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

import { Scene } from '../../Scene';
import { DataflowSolver } from '../../core/dataflow/DataflowSolver';
import { TaintFlowFunction, TaintProblem } from './TaintProblem';
import { TaintFact } from './TaintFact';
import { Stmt } from '../../core/base/Stmt';
import Logger from '../../utils/logger';
import { LOG_MODULE_TYPE } from '../../utils/logger';
import { PathEdge, PathEdgePoint } from '../../core/dataflow/Edge';
import { IFDSManager, IFDSResult } from './IFDSManager';
import { FlowFunction } from '../../core/dataflow/DataflowProblem';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'TaintSolver');

/**
 * 污点分析求解器
 * 继承自 DataflowSolver，在 DummyMain 上执行 IFDS 算法
 */
export class TaintSolver extends DataflowSolver<TaintFact> {
    private ifdsManager: IFDSManager;

    protected problem: TaintProblem;

    constructor(problem: TaintProblem, scene: Scene, ifdsManager: IFDSManager) {
        super(problem, scene);
        this.ifdsManager = ifdsManager;
        this.problem = problem;
    }

    /**
     * 执行污点分析
     */
    public analyze(): void {
        // 执行 IFDS 求解
        this.solve();
    }

    /**
     * 允许外部向 solver 添加新边
     */
    public processEdge(edge: PathEdge<TaintFact>): void {
        this.propagate(edge);
    }

    /**
     * @override
     */
    protected processNormalNode(edge: PathEdge<TaintFact>): void {
        let start: PathEdgePoint<TaintFact> = edge.edgeStart;
        let end: PathEdgePoint<TaintFact> = edge.edgeEnd;
        let stmts: Stmt[] = [...this.getChildren(end.node)].reverse();
        for (let stmt of stmts) {
            let flowFunction: TaintFlowFunction = this.problem.getNormalFlowFunction(end.node, stmt);
            let set: Set<TaintFact> = flowFunction.getDataFactsWithCtxFact(start.fact, end.fact);
            for (let fact of set) {
                let edgePoint: PathEdgePoint<TaintFact> = new PathEdgePoint<TaintFact>(stmt, fact);
                const edge = new PathEdge<TaintFact>(start, edgePoint);
                this.propagate(edge);
                this.laterEdges.add(edge);
            }
        }
    }

    public getSuccessorsOf(node: Stmt): Stmt[] {
        return this.getChildren(node);
    }
}
