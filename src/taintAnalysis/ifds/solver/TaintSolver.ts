import { Scene } from '../../../Scene';
import { TaintProblem } from '../problem/TaintProblem';
import { TaintFact } from '../TaintFact';
import { Stmt } from '../../../core/base/Stmt';
import Logger from '../../../utils/logger';
import { LOG_MODULE_TYPE } from '../../../utils/logger';
import { PathEdge } from '../../../core/dataflow/Edge';
import { IFDSManager } from '../IFDSManager';
import { ArkMethod } from '../../../core/model/ArkMethod';
import { AbstractTaintSolver } from './AbstractTaintSolver';
import { SolverPeerGroup } from './SolverPeerGroup';
import { LexicalEnvType } from '../../../core/base/Type';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'TaintSolver');

/**
 * 污点分析求解器
 * 继承自 DataflowSolver，在 DummyMain 上执行 IFDS 算法
 */
export class TaintSolver extends AbstractTaintSolver {
    protected ifdsManager: IFDSManager;

    protected problem: TaintProblem;

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
