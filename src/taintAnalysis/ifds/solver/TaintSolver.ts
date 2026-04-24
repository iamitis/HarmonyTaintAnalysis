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
        while (this.workList.length > 0) {
            let pathEdge: PathEdge<TaintFact> = this.workList.shift()!;
            if (this.laterEdges.has(pathEdge)) {
                this.laterEdges.delete(pathEdge);
            }

            if (this.ifdsManager.getConfig().optimize &&
                this.shouldSkipByLiveness(pathEdge)
            ) {
                continue;
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
     * 判断是否应因活跃性剪枝而跳过该 edge。
     *
     * 条件：仅对 Local 类型 TaintFact 生效，当 fact 对应的 Local 变量
     * 既不在当前 stmt 的 useSet 中，也不在 liveOut 集合中时，跳过。
     * Zero fact 和非 Local 类型 fact 不受影响。
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

        const stmt = edge.edgeEnd.node;
        const method = stmt.getCfg().getDeclaringMethod();

        let v: Local | undefined = undefined;
        if (fact.getAccessPath().isLocal()) {
            v = fact.getAccessPath().getBase()!;
        } else if (fact.getAccessPath().isInstanceFieldRef()) {
            v = fact.getAccessPath().getBase()!;
            // 若是参数/this/返回值, 则不跳过
            if (this.isParameterOrThisOrReturnLocal(v, method)) {
                return false;
            }
        } else {
            return false;
        }

        // 查询活跃性：local 是否在 useSet(stmt) 或 liveOut(stmt) 中
        return !this.livenessAnalysis.isLocalLiveAtStmt(method, v, stmt, this.stmtNexts);
    }

    private isParameterOrThisOrReturnLocal(local: Local, method: ArkMethod): boolean {
        if (local.getName() === THIS_NAME) {
            return true;
        }

        if (method.getParameters().some(param => param.getName() === local.getName())) {
            return true;
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
}
