import { ArkMethod } from '../../../core/model/ArkMethod';
import { PathEdge, PathEdgePoint } from '../../../core/dataflow/Edge';
import { TaintFact } from '../TaintFact';
import { AbstractTaintSolver } from './AbstractTaintSolver';

/**
 * Solver 对等组, 用于在前向/后向 solver 之间共享 incoming 表.
 * 参考 FlowDroid 的 SolverPeerGroup 机制.
 *
 * 核心: calleeCtxFactToCallSiteEdgeMap
 * - key: (calleeMethod, calleeContextFact)
 * - value: 调用该 callee 的 call site edges
 *
 * 使用 (method, fact) 而非 (stmt, fact) 作为 key,
 * 解决了前向/后向 solver 的 calleeContextStmt 不一致的问题:
 * - 前向 solver 的 calleeContextStmt = 方法的第一条真实语句
 * - 后向 solver 的 calleeContextStmt = 方法的 return 语句
 * 两者通过共享同一 contextFact 引用匹配.
 */
export class SolverPeerGroup {

    private solvers: Set<AbstractTaintSolver> = new Set();

    /**
     * 共享 incoming 表
     * 外层 key: calleeMethod (ArkMethod 引用相等)
     * 内层 key: calleeContextFact (TaintFact 引用相等)
     * value: 调用该 (method, fact) 的 call site edges
     */
    private calleeCtxFactToCallSiteEdgeMap: Map<ArkMethod, Map<TaintFact, Set<PathEdge<TaintFact>>>> = new Map();

    public addSolver(solver: AbstractTaintSolver) {
        this.solvers.add(solver);
    }

    /**
     * 注册 incoming: 记录 "callee 在给定 contextFact 下, 被哪些 call site edge 调用"
     */
    public addIncoming(calleeMethod: ArkMethod, calleeCtxFact: TaintFact, callSiteEdge: PathEdge<TaintFact>): boolean {
        let factMap = this.calleeCtxFactToCallSiteEdgeMap.get(calleeMethod);
        if (!factMap) {
            factMap = new Map();
            this.calleeCtxFactToCallSiteEdgeMap.set(calleeMethod, factMap);
        }

        let edgeSet = factMap.get(calleeCtxFact);
        if (!edgeSet) {
            edgeSet = new Set();
            factMap.set(calleeCtxFact, edgeSet);
        }

        const hasSameCallSiteEdge = edgeSet.has(callSiteEdge);
        edgeSet.add(callSiteEdge);
        return hasSameCallSiteEdge;
    }

    /**
     * 查找 incoming: 查找 callee 在给定 contextFact 下的所有 call site edges.
     * fact 使用引用相等 (===) 匹配, 这是正确的:
     * 同一条分析链上的 contextFact 始终是同一个对象引用.
     */
    public findIncoming(calleeMethod: ArkMethod, ctxFact: TaintFact): Set<PathEdge<TaintFact>> | undefined {
        const res = new Set<PathEdge<TaintFact>>();

        const fact2CallSites = this.calleeCtxFactToCallSiteEdgeMap.get(calleeMethod);
        fact2CallSites?.forEach((cs, fact) => {
            if (fact.equals(ctxFact)) {
                cs.forEach(edge => res.add(edge));
            }
        });

        return res;
    }

    public allSolversApplySummary(callee: ArkMethod, calleeCtxFact: TaintFact, callEdge: PathEdge<TaintFact>) {
        this.solvers.forEach(solver => {
            const calleeCtxNodes = solver.findStartStmtsOfMethod(callee);
            calleeCtxNodes.forEach(calleeCtxNode => {
                const calleeCtxPoint = new PathEdgePoint(calleeCtxNode, calleeCtxFact);
                solver.applySummary(calleeCtxPoint, callEdge);
            });
        });
    }
}
