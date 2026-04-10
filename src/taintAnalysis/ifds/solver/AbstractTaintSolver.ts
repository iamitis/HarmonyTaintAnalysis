import { ArkInvokeStmt, ArkMethod, ArkReturnVoidStmt, Scene, Stmt } from "../../..";
import { DataflowSolver } from "../../../core/dataflow/DataflowSolver";
import { PathEdge, PathEdgePoint } from "../../../core/dataflow/Edge";
import { getRecallMethodInParam } from "../../../core/dataflow/Util";
import { AbstractTaintProblem, TaintFlowFunction } from "../problem/AbstractTaintProblem";
import { TaintFact } from "../TaintFact";
import { SolverPeerGroup } from "./SolverPeerGroup";

/**
 * 给正向/反向 solver 继承, 提取共用逻辑.
 * @extends DataflowSolver 改动并抽象出 "获取方法 start point、exit point" 等逻辑
 */
export abstract class AbstractTaintSolver extends DataflowSolver<TaintFact> {

    /**
     * solver 对等组, 持有前向/后向 solver 共享的 incoming 表.
     * key 为 (calleeMethod, calleeContextFact), 绕开正向/后向 solver 的 calleeContextStmt 不一致问题.
     */
    protected peerGroup: SolverPeerGroup;

    protected problem: AbstractTaintProblem;

    /**
     * (callee, calleeCtxFact) -> Set<PathEdgePoint<TaintFact>>
     */
    protected taintSolverEndSummary: Map<ArkMethod, Map<TaintFact, Set<PathEdgePoint<TaintFact>>>> = new Map();

    constructor(problem: AbstractTaintProblem, scene: Scene, peerGroup?: SolverPeerGroup) {
        super(problem, scene);
        this.problem = problem;
        this.peerGroup = peerGroup ?? new SolverPeerGroup();
    }

    /**
     * @override
     */
    protected processNormalNode(edge: PathEdge<TaintFact>): void {
        const ctxPoint = edge.edgeStart;
        const currPoint = edge.edgeEnd;

        const targetStmts: Stmt[] = [...this.getChildren(currPoint.node)].reverse();

        for (const target of targetStmts) {
            const flowFunction: TaintFlowFunction = this.problem.getNormalFlowFunction(currPoint.node, target);
            const newFacts = flowFunction.getDataFactsWithCtxNode?.(ctxPoint, currPoint.fact) ??
                flowFunction.getDataFacts(currPoint.fact);

            for (const fact of newFacts) {
                const newEdge = new PathEdge(
                    ctxPoint,
                    new PathEdgePoint(target, fact)
                );
                this.propagate(newEdge);
                this.laterEdges.add(newEdge);
            }
        }
    }

    /**
     * @override
     */
    protected processCallNode(callSiteEdge: PathEdge<TaintFact>): void {
        const ctxPoint: PathEdgePoint<TaintFact> = callSiteEdge.edgeStart;
        const callEdgePoint: PathEdgePoint<TaintFact> = callSiteEdge.edgeEnd;

        // 查找 callee
        const invokeStmt = callEdgePoint.node as ArkInvokeStmt;
        let callees: Set<ArkMethod>;
        if (this.scene.getFile(invokeStmt.getInvokeExpr().getMethodSignature().getDeclaringClassSignature().getDeclaringFileSignature())) {
            callees = this.getAllCalleeMethods(callEdgePoint.node as ArkInvokeStmt);
        } else {
            callees = new Set([getRecallMethodInParam(invokeStmt)!]);
        }

        // caller 的 return site, 即 call site 的下一条语句
        const returnSites: Stmt[] = this.findMultiReturnSitesOfCall(callEdgePoint.node);

        for (const returnSite of returnSites) {
            // 应用 caller call site point -> callee start point 的流函数
            for (const callee of callees) {
                let callFlowFunc: TaintFlowFunction = this.problem.getCallFlowFunction(invokeStmt, callee);
                if (!callee.getCfg()) {
                    continue;
                }

                const firstStmts: readonly Stmt[] = this.findStartStmtsOfMethod
                    (callee);
                const callFlowFacts: Set<TaintFact> = callFlowFunc.getDataFactsWithCallerEdge?.(callSiteEdge, callEdgePoint.fact) ??
                    callFlowFunc.getDataFacts(callEdgePoint.fact);

                for (const firstStmt of firstStmts) {
                    for (const fact of callFlowFacts) {
                        // propagate edge(sp, sp)
                        const calleeStartPoint: PathEdgePoint<TaintFact> = new PathEdgePoint(firstStmt, fact);
                        this.propagate(new PathEdge<TaintFact>(calleeStartPoint, calleeStartPoint));

                        // update incoming
                        const hasSameCallSiteEdge = this.peerGroup.addIncoming(callee, fact, callSiteEdge);

                        if (!hasSameCallSiteEdge) {
                            this.peerGroup.allSolversApplySummary(callee, calleeStartPoint.fact, callSiteEdge);
                        } else {
                            this.applySummary(calleeStartPoint, callSiteEdge);
                        }

                    }
                }
            }

            // 应用 caller call site point -> caller return site point 的流函数
            const callToReturnflowFunc: TaintFlowFunction = this.problem.getCallToReturnFlowFunction(callSiteEdge.edgeEnd.node, returnSite);
            const callToRetFacts: Set<TaintFact> = callToReturnflowFunc.getDataFactsWithCallees?.(callees, callEdgePoint.fact) ??
                callToReturnflowFunc.getDataFacts(callEdgePoint.fact);
            for (const fact of callToRetFacts) {
                this.propagate(new PathEdge<TaintFact>(ctxPoint, new PathEdgePoint<TaintFact>(returnSite, fact)));
            }

            // apply callSite -> returnSite summary
            for (const cacheEdge of this.summaryEdge) {
                if (cacheEdge.edgeStart === callSiteEdge.edgeEnd && cacheEdge.edgeEnd.node === returnSite) {
                    this.propagate(new PathEdge<TaintFact>(ctxPoint, cacheEdge.edgeEnd));
                }
            }
        }
    }

    /**
     * @override
     */
    protected processExitNode(edge: PathEdge<TaintFact>): void {
        const ctxPoint = edge.edgeStart;
        const exitPoint = edge.edgeEnd;

        // 更新 map: callee start point -> callee exit point
        const method = exitPoint.node.getCfg().getDeclaringMethod();
        let factToExitPointsMap = this.taintSolverEndSummary.get(method);
        if (!factToExitPointsMap) {
            factToExitPointsMap = new Map<TaintFact, Set<PathEdgePoint<TaintFact>>>();
            this.taintSolverEndSummary.set(method, factToExitPointsMap);
        }
        let exitPoints = factToExitPointsMap.get(ctxPoint.fact);
        if (!exitPoints) {
            exitPoints = new Set<PathEdgePoint<TaintFact>>();
            factToExitPointsMap.set(ctxPoint.fact, exitPoints);
        }
        exitPoints.add(exitPoint);

        // 通过 peerGroup 共享 incoming 表查找调用点
        const callSiteEdges = this.findInComingEdges(ctxPoint);
        if (callSiteEdges === undefined) {
            if (ctxPoint.node.getCfg()!.getDeclaringMethod() === this.problem.getEntryMethod()) {
                return;
            }
            throw new Error('incoming does not have ' + ctxPoint.node.getCfg()?.getDeclaringMethod().toString());
        }

        // 应用 callee exit point -> caller return site point 的流函数
        for (const callEdge of callSiteEdges) {
            const returnSites = this.findMultiReturnSitesOfCall(callEdge.edgeEnd.node);
            for (const rs of returnSites) {
                const returnFlowFunc = this.problem.getExitToReturnFlowFunction(exitPoint.node, rs, callEdge.edgeEnd.node);
                this.handleReturnFlowFunc(returnFlowFunc, rs, ctxPoint, exitPoint, callEdge);
            }
        }
    }

    /**
     * 获取 call site 的下一条语句.
     * 由于 AliasSolver 是反向的, call site 的下一条语句就是 call site 的前驱语句.
     * 前驱语句可能有多条, 而 super.getReturnSiteOfCall 仅返回一条.
     */
    protected findMultiReturnSitesOfCall(call: Stmt): Stmt[] {
        return this.getChildren(call);
    }

    /**
     * 获取 method 的起始语句.
     * 在正向求解器中, 起始语句是参数定义后的第一条语句;
     * 在反向求解器中, 起始语句是方法体的 return 语句.
     */
    public abstract findStartStmtsOfMethod(method: ArkMethod): readonly Stmt[];

    /**
     * 获取 method 的结束语句.
     * 在正向求解器中, 结束语句是方法体的 return 语句;
     * 在反向求解器中, 结束语句是最后一条 paramLocal 定义语句.
     */
    public abstract findExitStmtsOfMethod(method: ArkMethod): readonly Stmt[];

    public applySummary(calleeCtxPoint: PathEdgePoint<TaintFact>, callEdge: PathEdge<TaintFact>): void {
        const endSummaries = this.findEndSummaries(calleeCtxPoint.fact, calleeCtxPoint.node);

        endSummaries?.forEach(exitPoint => {
            const returnSites = this.findMultiReturnSitesOfCall(callEdge.edgeEnd.node);
            for (const rs of returnSites) {
                const returnFlowFunc = this.problem.getExitToReturnFlowFunction(exitPoint.node, rs, callEdge.edgeEnd.node);
                this.handleReturnFlowFunc(returnFlowFunc, rs, calleeCtxPoint, exitPoint, callEdge);
            }
        });
    }

    protected findEndSummaries(calleeCtxFact: TaintFact, calleeCtxNode: Stmt): Set<PathEdgePoint<TaintFact>> {
        const res = new Set<PathEdgePoint<TaintFact>>();
        const factToExitPointsMap = this.taintSolverEndSummary.get(calleeCtxNode.getCfg().getDeclaringMethod());
        factToExitPointsMap?.forEach((exitPoints, ctxFact) => {
            if (ctxFact.equals(calleeCtxFact)) {
                exitPoints.forEach(exitPoint => {
                    res.add(exitPoint);
                });
            }
        })
        return res;
    }

    /**
     * @override
     */
    // protected callNodeFactPropagate(callSiteEdge: PathEdge<TaintFact>, firstStmt: Stmt, fact: TaintFact, returnSite: Stmt): void {
    //     // propagate edge(sp, sp)
    //     let calleeStartPoint: PathEdgePoint<TaintFact> = new PathEdgePoint(firstStmt, fact);
    //     this.propagate(new PathEdge<TaintFact>(calleeStartPoint, calleeStartPoint));

    //     // 通过 peerGroup 注册 incoming: (calleeMethod, contextFact) -> callSiteEdge

    //     // 从 endSummray 中找到 callee exit point, 应用 callee exit point -> caller return site point 的流函数, 并更新 summaryEdge
    //     let exitPoints: Set<PathEdgePoint<TaintFact>> = new Set();
    //     for (const end of Array.from(this.endSummary.keys())) {
    //         if (end.fact === fact && end.node === firstStmt) {
    //             exitPoints = this.endSummary.get(end)!;
    //         }
    //     }
    //     for (let exitEdgePoint of exitPoints) {
    //         let returnFlowFunc = this.problem.getExitToReturnFlowFunction(exitEdgePoint.node, returnSite, callSiteEdge.edgeEnd.node);
    //         for (let returnFact of returnFlowFunc.getDataFacts(exitEdgePoint.fact)) {
    //             this.summaryEdge.add(new PathEdge<TaintFact>(callSiteEdge.edgeEnd, new PathEdgePoint<TaintFact>(returnSite, returnFact)));
    //         }
    //     }
    // }

    /**
     * 找 callee context (method, fact) 对应的 call site edges (incoming).
     * 委托给 peerGroup, 以 (calleeMethod, contextFact) 为 key 查找,
     * 实现前向/后向 solver 共享 incoming 表.
     */
    protected findInComingEdges(startEdgePoint: PathEdgePoint<TaintFact>): Set<PathEdge<TaintFact>> | undefined {
        const method = startEdgePoint.node.getCfg()!.getDeclaringMethod();
        return this.peerGroup.findIncoming(method, startEdgePoint.fact);
    }

    /**
     * apply return flow function and propagate edge(callerCtxPoint, returnSitePoint)
     */
    protected handleReturnFlowFunc(returnFlowFunc: TaintFlowFunction, returnSite: Stmt, calleeCtxPoint: PathEdgePoint<TaintFact>, exitPoint: PathEdgePoint<TaintFact>, callEdge: PathEdge<TaintFact>): void {
        const facts = returnFlowFunc.getDataFactsWithCallerEdge?.(callEdge, exitPoint.fact) ??
            returnFlowFunc.getDataFactsWithCtxNode?.(calleeCtxPoint, exitPoint.fact) ??
            returnFlowFunc.getDataFacts(exitPoint.fact);

        for (const fact of facts) {
            // 对 edge(callSitePoint, returnSitePoint) 查重
            const returnSitePoint: PathEdgePoint<TaintFact> = new PathEdgePoint<TaintFact>(returnSite, fact);
            const cacheEdge: PathEdge<TaintFact> = new PathEdge<TaintFact>(callEdge.edgeEnd, returnSitePoint);
            let summaryEdgeHasCacheEdge = false;
            for (const sEdge of this.summaryEdge) {
                if (sEdge.edgeStart === callEdge.edgeEnd && sEdge.edgeEnd.node === returnSite && sEdge.edgeEnd.fact === fact) {
                    summaryEdgeHasCacheEdge = true;
                    break;
                }
            }
            if (summaryEdgeHasCacheEdge) {
                continue;
            }

            // 更新 summaryEdge
            this.summaryEdge.add(cacheEdge);

            // propagate edge(callerCtxPoint, returnSitePoint)
            let startStmtsOfCaller: readonly Stmt[] = this.findStartStmtsOfMethod(callEdge.edgeEnd.node.getCfg().getDeclaringMethod());
            for (const start of startStmtsOfCaller) {
                // for (const pathEdge of this.pathEdgeSet) {
                //     if (pathEdge.edgeStart.fact === callEdge.edgeStart.fact && pathEdge.edgeEnd === callEdge.edgeEnd) {
                //         this.propagate(new PathEdge<TaintFact>(pathEdge.edgeStart, returnSitePoint));
                //     }
                // }
                const ctxPoint: PathEdgePoint<TaintFact> = new PathEdgePoint<TaintFact>(start, callEdge.edgeStart.fact);
                this.propagate(new PathEdge<TaintFact>(ctxPoint, returnSitePoint));
            }
        }
    }

    /**
     * 寻找方法的 return 语句
     */
    protected findReturnStmts(method: ArkMethod): readonly Stmt[] {
        return this.problem.findReturnStmts(method);
    }

    protected edgeEquals(edge1: PathEdge<TaintFact>, edge2: PathEdge<TaintFact>) {
        return this.edgePointEquals(edge1.edgeStart, edge2.edgeStart) && this.edgePointEquals(edge1.edgeEnd, edge2.edgeEnd);
    }

    protected edgePointEquals(point1: PathEdgePoint<TaintFact>, point2: PathEdgePoint<TaintFact>) {
        return point1.node === point2.node && point1.fact.equals(point2.fact);
    }
}
