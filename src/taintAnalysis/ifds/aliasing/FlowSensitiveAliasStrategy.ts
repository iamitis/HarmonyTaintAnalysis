import { Stmt } from '../../../core/base/Stmt';
import { Value } from '../../../core/base/Value';
import { ArkMethod } from '../../../core/model/ArkMethod';
import { TaintFact } from '../TaintFact';
import { IFDSManager } from '../IFDSManager';
import { AliasSolver } from '../solver/AliasSolver';
import { PathEdge, PathEdgePoint } from '../../../core/dataflow/Edge';
import { IAliasingStrategy } from './IAliasingStrategy';
import { Aliasing } from './Aliasing';

/**
 * 流敏感别名分析策略
 * 参考 FlowDroid 的 FlowSensitiveAliasStrategy 实现
 * 
 * 核心机制：
 * 1. 当发现新污点时，创建非活跃抽象并启动后向求解器
 * 2. 后向求解器寻找所有可能指向同一堆对象的变量
 * 3. 找到别名时，注入到前向求解器
 * 4. 当经过激活单元时，非活跃抽象变为活跃
 */
export class FlowSensitiveAliasStrategy implements IAliasingStrategy {

    private manager: IFDSManager;
    private backwardSolver?: AliasSolver;

    constructor(manager: IFDSManager) {
        this.manager = manager;
    }

    /**
     * 设置后向求解器
     */
    public setBackwardSolver(solver: AliasSolver): void {
        this.backwardSolver = solver;
    }

    /**
     * 寻找污点的别名
     * 当发现新污点时，启动后向分析寻找别名
     */
    public computeAliasTaints(
        ctxNode: PathEdgePoint<TaintFact>,
        taintingStmt: Stmt,
        taintedValue: Value,
        taintSet: Set<TaintFact>,
        method: ArkMethod,
        newFact: TaintFact
    ): void {
        if (!Aliasing.canHaveAliases(newFact)) {
            return;
        }

        // 检查后向求解器是否可用
        if (!this.backwardSolver) {
            const bwSolver = this.manager.getBackwardSolver();
            if (bwSolver && bwSolver instanceof AliasSolver) {
                this.backwardSolver = bwSolver;
            } else {
                // 后向求解器不可用，无法进行别名分析
                return;
            }
        }

        // 创建非活跃抽象, activationUnit 设置为 taintingStmt，表示只有经过 taintingStmt 时才会激活
        const inActiveFact = newFact.deriveInactiveFact(taintingStmt);

        // 反向沿着 ICFG 寻找别名
        for (const predUnit of this.backwardSolver.findPredecessorsOf(taintingStmt)) {
            const ctxStmts = this.backwardSolver.findStartStmtsOfMethod(taintingStmt.getCfg().getDeclaringMethod());
            for (const ctxStmt of ctxStmts) {
                const edge = new PathEdge<TaintFact>(
                    new PathEdgePoint<TaintFact>(ctxStmt, ctxNode.fact),
                    new PathEdgePoint<TaintFact>(predUnit, inActiveFact)
                );
                this.backwardSolver.processEdge(edge);
            }
        }

        this.backwardSolver.solve();
    }
}
