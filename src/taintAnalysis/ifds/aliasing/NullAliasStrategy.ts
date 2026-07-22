import { Stmt } from '../../../core/base/Stmt';
import { Value } from '../../../core/base/Value';
import { ArkMethod } from '../../../core/model/ArkMethod';
import { TaintFact } from '../TaintFact';
import { IAliasingStrategy } from './IAliasingStrategy';
import { PathEdgePoint } from '../../../core/dataflow/Edge';

/**
 * 空别名分析策略
 * 不进行任何别名分析，用于不需要别名分析的场景
 */
export class NullAliasStrategy implements IAliasingStrategy {
    
    /**
     * 计算别名污点 - 空实现
     */
    public computeAliasTaints(
        ctxNode: PathEdgePoint<TaintFact>, 
        taintingStmt: Stmt, 
        taintedValue: Value, 
        taintSet: Set<TaintFact>, 
        method: ArkMethod, 
        newFact: TaintFact
    ): void {
        // 不进行别名分析，什么都不做
    }
}
