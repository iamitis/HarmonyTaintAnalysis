import { Scene } from '../../../Scene';
import { TaintProblem } from '../problem/TaintProblem';
import { TaintFact } from '../TaintFact';
import { ArkReturnStmt, Stmt } from '../../../core/base/Stmt';
import Logger from '../../../utils/logger';
import { LOG_MODULE_TYPE } from '../../../utils/logger';
import { PathEdge } from '../../../core/dataflow/Edge';
import { IFDSManager } from '../IFDSManager';
import { ArkMethod } from '../../../core/model/ArkMethod';
import { AbstractTaintSolver } from './AbstractTaintSolver';
import { SolverPeerGroup } from './SolverPeerGroup';
import { LexicalEnvType } from '../../../core/base/Type';
import { LocalLivenessAnalysis } from './LocalLivenessAnalysis';
import { Local } from '../../../core/base/Local';
import { THIS_NAME } from '../../../core/common/TSConst';
import { Cfg } from '../../../core/graph/Cfg';
import { CONSTRUCTORFUCNNAME, INSTANCE_INIT_METHOD_NAME } from '../../../core/common/Const';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'TaintSolver');

/**
 * 污点分析求解器
 * 继承自 DataflowSolver，在 DummyMain 上执行 IFDS 算法
 */
export class TaintSolver extends AbstractTaintSolver {
    protected ifdsManager: IFDSManager;

    protected problem: TaintProblem;

    /** 局部变量活跃性分析，用于剪枝不再使用的 Local 类型 TaintFact */
    protected livenessAnalysis: LocalLivenessAnalysis = new LocalLivenessAnalysis();

    /* 保存 cfg 内部是否有匿名类创建 */
    protected cfgToHasAnonymousClassMap: Map<Cfg, boolean> = new Map();

    constructor(problem: TaintProblem, scene: Scene, ifdsManager: IFDSManager, peerGroup?: SolverPeerGroup) {
        super(problem, scene, peerGroup);
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
     * @override
     */
    protected doSolve(): void {
        const t0 = Date.now();
        while (this.workList.length > 0) {
            let pathEdge: PathEdge<TaintFact> = this.workList.shift()!;
            if (this.laterEdges.has(pathEdge)) {
                this.laterEdges.delete(pathEdge);
            }

            if (this.ifdsManager.getConfig().optimize &&
                this.shouldSkipByLiveness(pathEdge)
            ) {
                ++this.metrics.prunedEdgeCnt;
                continue;
            }

            let targetStmt: Stmt = pathEdge.edgeEnd.node;
            if (this.isCallStatement(targetStmt)) {
                this.processCallNode(pathEdge);
                ++this.metrics.callEdgeCnt;
            } else if (this.isExitStatement(targetStmt)) {
                this.processExitNode(pathEdge);
                ++this.metrics.returnEdgeCnt;
            } else {
                this.processNormalNode(pathEdge);
                ++this.metrics.normalEdgeCnt;
            }

            ++this.metrics.processEdgeCnt;
        }
        this.metrics.solveTime += Date.now() - t0;
    }

    /**
     * 若 fact 对应的变量不再活跃, 跳过该 edge
     * 仅考虑 Local 型和 InstanceFieldRef 型 TaintFact
     * Zero fact 和 static 类型 fact 不受影响
     *
     * @param edge 待判断的路径边
     * @returns true 表示应跳过该 edge
     */
    protected shouldSkipByLiveness(edge: PathEdge<TaintFact>): boolean {
        const fact = edge.edgeEnd.fact;

        // Zero fact 始终传播
        if (fact.isZeroFact()) {
            return false;
        }

        // 若该上下文有匿名类的创建,
        // 由于匿名类可能会捕获外部变量, 因此不进行剪枝
        if (this.hasAnonymousClassCreation(edge.edgeEnd.node) ||
            this.isInAnonymousClassCreation(edge.edgeEnd.node)
        ) {
            return false;
        }

        const stmt = edge.edgeEnd.node;
        const method = stmt.getCfg().getDeclaringMethod();

        let v: Local | undefined = undefined;
        if (fact.getAccessPath().isLocal()) {
            // Local 类型
            v = fact.getAccessPath().getBase()!;
        } else if (fact.getAccessPath().isInstanceFieldRef()) {
            // InstanceFieldRef 类型, 考虑其 base (base 也是 local)
            v = fact.getAccessPath().getBase()!;
            // 若是参数/this/返回值, 则不跳过
            if (this.isParameterOrThisOrReturnLocal(v, method)) {
                return false;
            }
        } else {
            return false;
        }

        // 如果 v 与某个闭包同名, 不跳过
        if (method.getParameters().length > 0 && method.getParameters()[0].getType() instanceof LexicalEnvType) {
            const closures = (method.getParameters()[0].getType() as LexicalEnvType).getClosures();
            for (const clo of closures) {
                if (clo.getName() === v.getName()) {
                    return false;
                }
            }
        }

        // 查询活跃性：local 是否在 useSet(stmt) 或 liveOut(stmt) 中
        return !this.livenessAnalysis.isLocalLiveAtStmt(method, v, stmt, this.stmtNexts);
    }

    private hasAnonymousClassCreation(stmt: Stmt): boolean {
        if (!this.cfgToHasAnonymousClassMap.has(stmt.getCfg())) {
            const hasAnonymousClassCreation = stmt.getCfg().getStmts().some(s => {
                if (s.getInvokeExpr() !== undefined) {
                    const methodSig = s.getInvokeExpr()!.getMethodSignature();
                    const classSig = methodSig.getDeclaringClassSignature();
                    return classSig.getClassName().lastIndexOf('%') > 0 && (
                        methodSig.getMethodSubSignature().getMethodName() === CONSTRUCTORFUCNNAME ||
                        methodSig.getMethodSubSignature().getMethodName() === INSTANCE_INIT_METHOD_NAME
                    );
                }
            });
            this.cfgToHasAnonymousClassMap.set(stmt.getCfg(), hasAnonymousClassCreation);
        }
        return this.cfgToHasAnonymousClassMap.get(stmt.getCfg())!;
    }

    private isInAnonymousClassCreation(stmt: Stmt): boolean {
        const m = stmt.getCfg().getDeclaringMethod();
        const c = m.getDeclaringArkClass();
        return c.isAnonymousClass() && (
            m.getSubSignature().getMethodName() === CONSTRUCTORFUCNNAME ||
            m.getSubSignature().getMethodName() === INSTANCE_INIT_METHOD_NAME
        );
    }

    private isParameterOrThisOrReturnLocal(local: Local, method: ArkMethod): boolean {
        if (local.getName() === THIS_NAME) {
            return true;
        }

        for (const param of method.getParameters()) {
            // 排除一般参数
            if (param.getName() === local.getName()) {
                return true;
            }
            // 排除闭包
            const pType = param.getType();
            if (pType instanceof LexicalEnvType &&
                pType.getClosures().some(closure => closure.getName() === local.getName())
            ) {
                return true;
            }
        }

        if (this.problem.findReturnStmts(method).some(retStmt => {
            return retStmt instanceof ArkReturnStmt &&
                retStmt.getUses().some(use => use === local);
        })) {
            return true;
        }

        return false;
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
    public findStartStmtsOfMethod(method: ArkMethod): readonly Stmt[] {
        const cfg = method.getCfg();
        if (!cfg) {
            logger.warn('Method ' + method.getName() + ' has no cfg');
            return [];
        }

        let startIdx = method.getParameters().length + 1;

        // 若有闭包, 还需加上闭包数量
        if (method.isAnonymousMethod() &&
            method.getParameters()[0] &&
            method.getParameters()[0].getType() instanceof LexicalEnvType
        ) {
            const lexicalEnv = method.getParameters()[0].getType() as LexicalEnvType;
            startIdx += lexicalEnv.getClosures().length;
        }

        if (cfg.getStmts().length > startIdx) {
            return [cfg.getStmts()[startIdx]];
        } else {
            logger.warn('Method ' + method.getName() + ' has less than parameters.length (' + startIdx + ') stmts');
            return [];
        }
    }

    /**
     * @override
     */
    public findExitStmtsOfMethod(method: ArkMethod): readonly Stmt[] {
        return this.findReturnStmts(method);
    }

    /**
     * 用于外部获取节点的后继节点
     */
    public findSuccessorsOf(node: Stmt): Stmt[] {
        return this.getChildren(node);
    }

    public getLivenessTime(): number {
        return this.livenessAnalysis.getTotalAnalysisTime();
    }

    public getNormalEdgeCnt(): number { return this.metrics.normalEdgeCnt; }
    public getCallEdgeCnt(): number { return this.metrics.callEdgeCnt; }
    public getReturnEdgeCnt(): number { return this.metrics.returnEdgeCnt; }
    public getPrunedEdgeCnt(): number { return this.metrics.prunedEdgeCnt; }
}
