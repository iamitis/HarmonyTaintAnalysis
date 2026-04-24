import { ArkInvokeStmt, ArkMethod, Scene, Stmt } from "../../..";
import { DataflowSolver } from "../../../core/dataflow/DataflowSolver";
import { PathEdge, PathEdgePoint } from "../../../core/dataflow/Edge";
import { getRecallMethodInParam } from "../../../core/dataflow/Util";
import { AbstractInvokeExpr, ArkPtrInvokeExpr } from "../../../core/base/Expr";
import { FunctionType } from "../../../core/base/Type";
import { BasicBlock } from '../../../core/graph/BasicBlock';
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

    protected processEdgeCnt: number = 0;

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
     * 在正常后继的基础上，补充 BasicBlock 级别的异常后继到 stmtNexts
     */
    protected buildStmtMapInBlock(block: BasicBlock): void {
        const stmts = block.getStmts();

        for (let stmtIndex = 0; stmtIndex < stmts.length; stmtIndex++) {
            const stmt = stmts[stmtIndex];
            if (stmtIndex !== stmts.length - 1) {
                this.stmtNexts.set(stmt, new Set([stmts[stmtIndex + 1]]));
            } else {
                const set: Set<Stmt> = new Set();
                for (const successor of block.getSuccessors()) {
                    if (successor.getHead()) {
                        set.add(successor.getHead()!);
                    } else if (successor.getStmts()[0]) {
                        set.add(successor.getStmts()[0]);
                    }
                }
                this.stmtNexts.set(stmt, set);
            }
        }

        // 补充异常边
        const exceptionalSuccessors = block.getExceptionalSuccessorBlocks();
        if (!exceptionalSuccessors || exceptionalSuccessors.length === 0) {
            return;
        }

        if (stmts.length === 0) {
            return;
        }

        const lastStmt = stmts[stmts.length - 1];
        const existingNexts = this.stmtNexts.get(lastStmt);
        if (!existingNexts) {
            return;
        }

        for (const excSucc of exceptionalSuccessors) {
            const head = excSucc.getHead();
            if (head) {
                existingNexts.add(head);
            }
        }
    }

    /**
     * @override
     * 在构建完所有 block 的正常/异常边后，基于 Trap 信息补充非尾部 try block 到 catch block 的异常边
     */
    protected buildStmtMapInClass(): void {
        super.buildStmtMapInClass();

        const methods = this.scene.getMethods();
        methods.push(this.problem.getEntryMethod());
        for (const method of methods) {
            this.supplementExceptionalEdgesFromTraps(method);
        }
    }

    /**
     * 基于 Trap 信息补充 try block 到 catch block 的异常边.
     *
     * TrapBuilder 仅为 try 区域的尾部 block 添加了 exceptionalSuccessorBlocks,
     * 非尾部 try block（如 try 内含 if-else 产生的多个 block）没有异常边.
     * 此方法遍历所有 Trap, 将每个 tryBlock 的尾语句到 catchBlock 的首语句的边补充到 stmtNexts 中.
     */
    protected supplementExceptionalEdgesFromTraps(method: ArkMethod): void {
        const traps = method.getBody()?.getTraps();
        if (!traps) {
            return;
        }

        for (const trap of traps) {
            const catchBlocks = trap.getCatchBlocks();
            if (catchBlocks.length === 0) {
                continue;
            }
            const catchHead = catchBlocks[0].getHead();
            if (!catchHead) {
                continue;
            }

            for (const tryBlock of trap.getTryBlocks()) {
                const tryTail = tryBlock.getTail();
                if (!tryTail) {
                    continue;
                }

                const existingNexts = this.stmtNexts.get(tryTail);
                if (existingNexts && !existingNexts.has(catchHead)) {
                    existingNexts.add(catchHead);
                }
            }
        }
    }

    /**
     * @override
     */
    protected doSolve(): void {
        while (this.workList.length > 0) {
            let pathEdge: PathEdge<TaintFact> = this.workList.shift()!;
            if (this.laterEdges.has(pathEdge)) {
                this.laterEdges.delete(pathEdge);
            }

            let targetStmt: Stmt = pathEdge.edgeEnd.node;
            if (this.isCallStatement(targetStmt)) {
                this.processCallNode(pathEdge);
            } else if (this.isExitStatement(targetStmt)) {
                this.processExitNode(pathEdge);
            } else {
                this.processNormalNode(pathEdge);
            }

            ++this.processEdgeCnt;
        }
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
        const invokeExpr = invokeStmt.getInvokeExpr();
        let callees: Set<ArkMethod>;
        if (this.scene.getFile(invokeExpr.getMethodSignature().getDeclaringClassSignature().getDeclaringFileSignature())) {
            callees = this.getAllCalleeMethods(callEdgePoint.node as ArkInvokeStmt);
            // 过滤掉作为函数类型参数传入的匿名方法 callee,
            // 这些匿名方法应在进入实际 callee 后, 通过 callee 内部的调用语句(如 ptrinvoke)被正确处理,
            // 而非在当前调用者的上下文中被当作直接 callee.
            // 除非 callee 没有 cfg
            callees = this.filterArgAnonymousCallees(invokeExpr, callees);
        } else {
            callees = new Set([getRecallMethodInParam(invokeStmt)!]);
        }

        // 当 ptrinvoke 的所有 callee 均无 CFG 时, 尝试解析函数指针指向的实际匿名方法实现
        if (invokeExpr instanceof ArkPtrInvokeExpr && ![...callees].some(c => c.getCfg())) {
            const realCallees = this.resolvePtrInvokeRealCallee(invokeExpr);
            for (const rc of realCallees) {
                callees.add(rc);
            }
        }

        // caller 的 return site, 即 call site 的下一条语句
        const returnSites: Stmt[] = this.findMultiReturnSitesOfCall(callEdgePoint.node);

        for (const returnSite of returnSites) {
            // 应用 caller call site point -> callee start point 的流函数
            for (const callee of callees) {
                let callFlowFunc: TaintFlowFunction = this.problem.getCallFlowFunction(invokeStmt, callee);
                if (!callee.getCfg() || this.problem.isExcludedMethod(invokeStmt, callee)) {
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

    /**
     * 从 getAllCalleeMethods 返回的 callee 集合中, 过滤掉作为函数类型参数传入的匿名方法.
     *
     * CHA 的 getParamAnonymousMethod 会将 invokeExpr 的函数类型参数对应的匿名方法
     * 也作为 callee 返回, 但这些匿名方法不是当前调用语句的直接 callee.
     * 例如 staticinvoke callA(%AM0) 中, %AM0 是 callA 的参数, 而非 callA 调用语句的 callee;
     * %AM0 应在进入 callA 后, 通过 callA 内部的 ptrinvoke <callback()>() 被正确处理.
     *
     * @param invokeExpr 调用表达式
     * @param callees CHA 解析出的 callee 集合
     * @returns 过滤后的 callee 集合
     */
    private filterArgAnonymousCallees(invokeExpr: AbstractInvokeExpr, callees: Set<ArkMethod>): Set<ArkMethod> {
        for (const callee of callees) {
            if (!callee.getCfg()) {
                return callees;
            }
        }

        // 收集 invokeExpr 中函数类型参数对应的匿名方法签名
        const methodFromArg: Set<string> = new Set();
        for (const arg of invokeExpr.getArgs()) {
            const argType = arg.getType();
            if (argType instanceof FunctionType) {
                methodFromArg.add(argType.getMethodSignature().toString());
            }
        }

        if (methodFromArg.size === 0) {
            return callees;
        }

        // 过滤掉签名匹配的匿名方法 callee
        const filtered = new Set<ArkMethod>();
        for (const callee of callees) {
            if (!methodFromArg.has(callee.getSignature().toString())) {
                filtered.add(callee);
            }
        }
        return filtered;
    }

    /**
     * 当 ptrinvoke 的 callee 无 CFG 时, 通过函数指针的类型信息搜索场景中
     * 具有相同匿名方法前缀且有 CFG 的方法作为实际 callee.
     *
     * 根因: FunctionType.getMethodSignature() 指向 resolveFunctionTypeNode
     * 创建的合成方法（无 body/CFG），而非 callableNodeToValueAndStmts
     * 创建的实际实现（有 body/CFG）。
     * 命名约定: 合成方法为 %AM{N}, 实际实现为 %AM{N}$<enclosingMethod>
     */
    private resolvePtrInvokeRealCallee(invokeExpr: ArkPtrInvokeExpr): ArkMethod[] {
        const funPtr = invokeExpr.getFuncPtrLocal();
        const ptrType = funPtr.getType();
        if (!(ptrType instanceof FunctionType)) {
            return [];
        }

        const syntheticMethodName = ptrType.getMethodSignature()
            .getMethodSubSignature().getMethodName();

        // 仅处理 %AM{N} 模式的匿名方法合成名
        if (!/^%AM\d+$/.test(syntheticMethodName)) {
            return [];
        }

        // 搜索场景中名称以 "%AM{N}$" 开头且有 CFG 的方法
        const realMethodPrefix = syntheticMethodName + '$';
        const realCallees: ArkMethod[] = [];

        for (const arkClass of this.scene.getClasses()) {
            for (const method of arkClass.getMethods(true)) {
                if (method.getName().startsWith(realMethodPrefix) && method.getCfg()) {
                    realCallees.push(method);
                }
            }
        }

        return realCallees;
    }

    protected edgeEquals(edge1: PathEdge<TaintFact>, edge2: PathEdge<TaintFact>) {
        return this.edgePointEquals(edge1.edgeStart, edge2.edgeStart) && this.edgePointEquals(edge1.edgeEnd, edge2.edgeEnd);
    }

    protected edgePointEquals(point1: PathEdgePoint<TaintFact>, point2: PathEdgePoint<TaintFact>) {
        return point1.node === point2.node && point1.fact.equals(point2.fact);
    }

    public getProblem(): AbstractTaintProblem {
        return this.problem;
    }

    public getProcessEdgeCnt(): number {
        return this.processEdgeCnt;
    }
}
