import { Stmt } from '../../../core/base/Stmt';
import { Value } from '../../../core/base/Value';
import { ArkMethod } from '../../../core/model/ArkMethod';
import { TaintFact } from '../TaintFact';
import { AccessPath } from '../AccessPath';
import { PathEdgePoint } from '../../../core/dataflow/Edge';

/**
 * 别名分析策略接口
 * 参考 FlowDroid 的策略模式设计，支持多种别名分析策略
 */
export interface IAliasingStrategy {
    
    /**
     * 寻找污点的别名
     * 
     * @param ctxNode 方法入口点的抽象
     * @param taintingStmt 当前语句（别名分析的起点）
     * @param taintedValue 目标值（被污染的变量）
     * @param taintSet 污点集合（用于收集结果）
     * @param method 当前方法
     * @param newFact 新创建的污点抽象
     */
    computeAliasTaints(
        ctxNode: PathEdgePoint<TaintFact>, 
        taintingStmt: Stmt, 
        taintedValue: Value, 
        taintSet: Set<TaintFact>, 
        method: ArkMethod, 
        newFact: TaintFact
    ): void;
}
