import { Scene } from '../../../Scene';
import { Stmt } from '../../../core/base/Stmt';
import { PathEdge, PathEdgePoint } from '../../../core/dataflow/Edge';
import { TaintFact } from '../TaintFact';
import { IFDSManager } from '../IFDSManager';
import { BasicBlock } from '../../../core/graph/BasicBlock';
import { AliasProblem, ArkMethod, CallGraphBuilder, ClassHierarchyAnalysis, LOG_MODULE_TYPE, Logger } from '../../..';
import { CallGraph } from '../../../callgraph/model/CallGraph';
import { AbstractTaintSolver } from './AbstractTaintSolver';
import { SolverPeerGroup } from './SolverPeerGroup';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'AliasSolver');

/**
 * 用于流敏感别名分析的后向求解器
 */
export class AliasSolver extends AbstractTaintSolver {

    /** 语句的前驱映射（反向传播用） */
    private stmtPredecessors: Map<Stmt, Set<Stmt>>;

    /** IFDS 管理器 */
    private manager: IFDSManager;

    protected problem: AliasProblem;

    private isInitialized: boolean = false;

    constructor(problem: AliasProblem, scene: Scene, manager: IFDSManager, peerGroup?: SolverPeerGroup) {
        super(problem, scene, peerGroup);
        this.manager = manager;
        this.stmtPredecessors = new Map();
        this.problem = problem;
    }

    /**
     * 允许外部注入边
     */
    public processEdge(edge: PathEdge<TaintFact>): void {
        this.propagate(edge);
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
    // protected processExitNode(edge: PathEdge<TaintFact>): void {
    //     const ctxPoint = edge.edgeStart;
    //     const exitPoint = edge.edgeEnd;

    //     // 更新 map: callee start point -> callee exit point
    //     const summary = this.endSummary.get(ctxPoint);
    //     if (summary === undefined) {
    //         this.endSummary.set(ctxPoint, new Set([exitPoint]));
    //     } else {
    //         summary.add(exitPoint);
    //     }

    //     // 通过 peerGroup 共享 incoming 表查找调用点
    //     const callSiteEdges = this.findInComingEdges(ctxPoint);
    //     if (callSiteEdges === undefined) {
    //         if (ctxPoint.node.getCfg()!.getDeclaringMethod() === this.problem.getEntryMethod()) {
    //             return;
    //         }
    //         throw new Error('incoming does not have ' + ctxPoint.node.getCfg()?.getDeclaringMethod().toString());
    //     }

    //     // 应用 callee exit point -> caller return site point 的流函数
    //     for (const callEdge of callSiteEdges) {
    //         const returnSites = this.findMultiReturnSitesOfCall(callEdge.edgeEnd.node);
    //         for (const rs of returnSites) {
    //             const returnFlowFunc = this.problem.getExitToReturnFlowFunction(exitPoint.node, rs, callEdge.edgeEnd.node);
    //             const facts = returnFlowFunc.getDataFactsWithCtxNode?.(ctxPoint, exitPoint.fact) ?? returnFlowFunc.getDataFacts(exitPoint.fact);
    //             for (let fact of facts) {
    //                 let returnSitePoint: PathEdgePoint<TaintFact> = new PathEdgePoint<TaintFact>(rs, fact);
    //                 let cacheEdge: PathEdge<TaintFact> = new PathEdge<TaintFact>(callEdge.edgeEnd, returnSitePoint);
    //                 let summaryEdgeHasCacheEdge = false;
    //                 for (const sEdge of this.summaryEdge) {
    //                     if (sEdge.edgeStart === callEdge.edgeEnd && sEdge.edgeEnd.node === rs && sEdge.edgeEnd.fact === fact) {
    //                         summaryEdgeHasCacheEdge = true;
    //                         break;
    //                     }
    //                 }
    //                 if (summaryEdgeHasCacheEdge) {
    //                     continue;
    //                 }
    //                 this.summaryEdge.add(cacheEdge);
    //                 let startStmtsOfCaller: readonly Stmt[] = this.findStartStmtsOfMethod(callEdge.edgeEnd.node.getCfg().getDeclaringMethod());
    //                 for (const start of startStmtsOfCaller) {
    //                     for (const start of startStmtsOfCaller) {
    //                         // for (const pathEdge of this.pathEdgeSet) {
    //                         //     if (pathEdge.edgeStart.fact === callEdge.edgeStart.fact && pathEdge.edgeEnd === callEdge.edgeEnd) {
    //                         //         this.propagate(new PathEdge<TaintFact>(pathEdge.edgeStart, returnSitePoint));
    //                         //     }
    //                         // }
    //                         const ctxPoint: PathEdgePoint<TaintFact> = new PathEdgePoint<TaintFact>(start, callEdge.edgeStart.fact);
    //                         this.propagate(new PathEdge<TaintFact>(ctxPoint, returnSitePoint));
    //                     }
    //                 }
    //             }
    //         }
    //     }
    // }

    /**
     * @override
     */
    public findStartStmtsOfMethod(method: ArkMethod): readonly Stmt[] {
        return this.findReturnStmts(method);
    }

    /**
     * @override
     */
    public findExitStmtsOfMethod(method: ArkMethod): readonly Stmt[] {
        const cfg = method.getCfg();
        if (!cfg) {
            logger.warn('Method ' + method.getName() + ' has no cfg');
            return [];
        }
        
        const paramCount = method.getParameters().length;
        return [cfg.getStmts()[paramCount]];
    }

    /**
     * 获取语句的前驱（反向传播）
     * @override
     */
    protected getChildren(stmt: Stmt): Stmt[] {
        return Array.from(this.stmtPredecessors.get(stmt) ?? []);
    }

    /**
     * @override
     */
    protected isExitStatement(stmt: Stmt): boolean {
        const paramCount = stmt.getCfg().getDeclaringMethod().getParameters().length;
        return stmt.getCfg().getStmts().slice(0, paramCount + 1).some(s => s === stmt);
    }

    /**
     * 获取语句的前驱语句
     */
    public findPredecessorsOf(stmt: Stmt): Set<Stmt> {
        if (!this.isInitialized) {
            this.init();
            this.isInitialized = true;
        }

        return this.stmtPredecessors.get(stmt) ?? new Set();
    }

    /**
     * 获取 IFDS 管理器
     */
    public getManager(): IFDSManager {
        return this.manager;
    }
}
