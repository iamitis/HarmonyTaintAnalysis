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
import { Stmt } from '../../core/base/Stmt';
import { ArkMethod } from '../../core/model/ArkMethod';
import { DataflowSolver } from '../../core/dataflow/DataflowSolver';
import { DataflowProblem, FlowFunction } from '../../core/dataflow/DataflowProblem';
import { PathEdge, PathEdgePoint } from '../../core/dataflow/Edge';
import { TaintFact } from './TaintFact';
import { IFDSManager } from './IFDSManager';
import { BasicBlock } from '../../core/graph/BasicBlock';
import { AliasProblem, CallGraph, CallGraphBuilder, ClassHierarchyAnalysis } from '../..';
import { TaintFlowFunction } from './TaintProblem';

/**
 * 别名分析后向求解器
 * 参考 FlowDroid 的 BackwardSolver 设计
 * 
 * 核心差异：
 * 1. 从语句的前驱开始传播（而非后继）
 * 2. 提供 processEdge() 公开方法，允许外部注入边
 * 3. 提供 injectContext() 方法，连接前向和后向分析
 */
export class AliasSolver extends DataflowSolver<TaintFact> {

    /** 语句的前驱映射（反向传播用） */
    protected stmtPredecessors: Map<Stmt, Set<Stmt>>;

    /** IFDS 管理器 */
    private manager: IFDSManager;

    protected problem: AliasProblem;

    private isInitialized: boolean = false;

    constructor(problem: AliasProblem, scene: Scene, manager: IFDSManager) {
        super(problem, scene);
        this.manager = manager;
        this.stmtPredecessors = new Map();
        this.problem = problem;
    }

    /**
     * ★ 核心方法：允许外部注入边
     * 供 FlowSensitiveAliasStrategy 和 AliasProblem 使用
     */
    public processEdge(edge: PathEdge<TaintFact>): void {
        this.propagate(edge);
    }

    /**
     * ★ 核心方法：注入上下文到前向求解器
     * 连接前向和后向分析的调用上下文
     */
    public injectContext(
        forwardSolver: unknown,  // TaintSolver
        callee: ArkMethod,
        d3: TaintFact,
        callSite: Stmt,
        source: TaintFact,
        d1: TaintFact
    ): void {
        // 在后向求解器中，我们需要将上下文信息传递给前向求解器
        // 这样前向求解器在处理相同调用点时可以正确传播别名污点
        // 具体实现在 TaintSolver 中
        const solver = forwardSolver as { processEdge: (edge: PathEdge<TaintFact>) => void };
        if (solver && typeof solver.processEdge === 'function') {
            // 创建从调用点到 callee 入口的边
            // 这样前向求解器可以继续传播别名污点
        }
    }

    /**
     * 重写初始化：构建前驱映射
     */
    protected init(): void {
        // build CHA
        let cg = new CallGraph(this.scene);
        this.CHA = new ClassHierarchyAnalysis(this.scene, cg, new CallGraphBuilder(cg, this.scene));
        this.buildStmtMapInClass();
        this.setCfg4AllStmt();
        return;
    }

    /**
     * @override
     */
    protected buildStmtMapInBlock(block: BasicBlock): void {
        // 构建前驱映射
        block.getStmts().forEach((stmt, index) => {
            if (index === 0) {
                const preStmts: Set<Stmt> = new Set();
                block.getPredecessors().forEach(predecessor => {
                    preStmts.add(predecessor.getTail()!);
                });
                this.stmtPredecessors.set(stmt, preStmts);
            } else if (index === block.getStmts().length - 1) {

            } else {
                this.stmtPredecessors.set(stmt, new Set([block.getStmts()[index - 1]]));
            }
        });

        // 构建后继映射
        block.getStmts().forEach((stmt, index) => {
            if (index === block.getStmts().length - 1) {
                const succStmts: Set<Stmt> = new Set();
                block.getSuccessors().forEach(successor => {
                    succStmts.add(successor.getHead()!);
                });
                this.stmtNexts.set(stmt, succStmts);
            } else {
                this.stmtNexts.set(stmt, new Set([block.getStmts()[index + 1]]));
            }
        });
    }

    /**
     * @override
     */
    public solve(): void {
        if (!this.isInitialized) {
            this.init();
            this.isInitialized = true;
        }
        this.doSolve();
    }

    /**
     * @override
     */
    protected processNormalNode(edge: PathEdge<TaintFact>): void {
        const start = edge.edgeStart;
        const end = edge.edgeEnd;

        const preds = this.getChildren(end.node);

        for (const pred of preds) {
            const flowFunction: TaintFlowFunction = this.problem.getNormalFlowFunction(end.node, pred);
            const facts = flowFunction.getDataFactsWithCtxFact(start.fact, end.fact);

            for (const fact of facts) {
                const edgePoint = new PathEdgePoint<TaintFact>(pred, fact);
                const newEdge = new PathEdge<TaintFact>(start, edgePoint);
                this.propagate(newEdge);
            }
        }
    }

    /**
     * @override
     */
    protected processExitNode(edge: PathEdge<TaintFact>): void {
        const preds = this.getChildren(edge.edgeEnd.node);

        for (const pred of preds) {
            const edgePoint = new PathEdgePoint<TaintFact>(pred, edge.edgeEnd.fact);
            const newEdge = new PathEdge<TaintFact>(edge.edgeStart, edgePoint);
            this.propagate(newEdge);
        }
    }

    /**
     * @override
     */
    protected processCallNode(edge: PathEdge<TaintFact>): void {
        const preds = this.getChildren(edge.edgeEnd.node);

        for (const pred of preds) {
            const edgePoint = new PathEdgePoint<TaintFact>(pred, edge.edgeEnd.fact);
            const newEdge = new PathEdge<TaintFact>(edge.edgeStart, edgePoint);
            this.propagate(newEdge);
        }
    }

    /**
     * 获取语句的前驱（反向传播）
     * @override
     */
    protected getChildren(stmt: Stmt): Stmt[] {
        return Array.from(this.stmtPredecessors.get(stmt) ?? []);
    }

    /**
     * 获取语句的前驱语句
     */
    public getPredecessorsOf(stmt: Stmt): Set<Stmt> {
        if (!this.isInitialized) {
            this.init();
            this.isInitialized = true;
        }
        return this.stmtPredecessors.get(stmt) ?? new Set();
    }

    /**
     * 获取语句的后继语句
     */
    public getSuccessorsOf(stmt: Stmt): Set<Stmt> {
        return this.stmtNexts.get(stmt) ?? new Set();
    }

    /**
     * 获取 IFDS 管理器
     */
    public getManager(): IFDSManager {
        return this.manager;
    }
}
