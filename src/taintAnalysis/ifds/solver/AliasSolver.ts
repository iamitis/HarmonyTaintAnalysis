import { Scene } from '../../../Scene';
import { Stmt } from '../../../core/base/Stmt';
import { PathEdge } from '../../../core/dataflow/Edge';
import { TaintFact } from '../TaintFact';
import { IFDSManager } from '../IFDSManager';
import { BasicBlock } from '../../../core/graph/BasicBlock';
import { AliasProblem, ArkMethod, CallGraphBuilder, ClassHierarchyAnalysis, LexicalEnvType, LOG_MODULE_TYPE, Logger } from '../../..';
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
     * 构建前驱/后继映射，包含异常边
     */
    protected buildStmtMapInBlock(block: BasicBlock): void {
        const stmts = block.getStmts();

        // 构建前驱映射
        stmts.forEach((stmt, index) => {
            if (index === 0) {
                const preStmts: Set<Stmt> = new Set();
                block.getPredecessors().forEach(predecessor => {
                    preStmts.add(predecessor.getTail()!);
                });
                // 添加异常前驱
                const exceptionalPreds = block.getExceptionalPredecessorBlocks();
                if (exceptionalPreds) {
                    for (const excPred of exceptionalPreds) {
                        const tail = excPred.getTail();
                        if (tail) {
                            preStmts.add(tail);
                        }
                    }
                }
                this.stmtPredecessors.set(stmt, preStmts);
            } else {
                this.stmtPredecessors.set(stmt, new Set([stmts[index - 1]]));
            }
        });

        // 构建后继映射
        stmts.forEach((stmt, index) => {
            if (index === stmts.length - 1) {
                const succStmts: Set<Stmt> = new Set();
                block.getSuccessors().forEach(successor => {
                    succStmts.add(successor.getHead()!);
                });
                // 添加异常后继
                const exceptionalSuccs = block.getExceptionalSuccessorBlocks();
                if (exceptionalSuccs) {
                    for (const excSucc of exceptionalSuccs) {
                        const head = excSucc.getHead();
                        if (head) {
                            succStmts.add(head);
                        }
                    }
                }
                this.stmtNexts.set(stmt, succStmts);
            } else {
                this.stmtNexts.set(stmt, new Set([stmts[index + 1]]));
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
        let closureCount = 0;
        if (method.isAnonymousMethod() &&
            method.getParameters()[0] &&
            method.getParameters()[0].getType() instanceof LexicalEnvType
        ) {
            const lexicalEnv = method.getParameters()[0].getType() as LexicalEnvType;
            closureCount = lexicalEnv.getClosures().length;
        }

        return [cfg.getStmts()[paramCount + closureCount]];
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
     * @override
     * 在父类补充 stmtNexts 的基础上，同步补充 stmtPredecessors 的异常边
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

                // 补充 stmtNexts: tryTail -> catchHead
                const existingNexts = this.stmtNexts.get(tryTail);
                if (existingNexts && !existingNexts.has(catchHead)) {
                    existingNexts.add(catchHead);
                }

                // 补充 stmtPredecessors: catchHead <- tryTail
                const existingPreds = this.stmtPredecessors.get(catchHead);
                if (existingPreds && !existingPreds.has(tryTail)) {
                    existingPreds.add(tryTail);
                }
            }
        }
    }

    /**
     * 获取 IFDS 管理器
     */
    public getManager(): IFDSManager {
        return this.manager;
    }
}
