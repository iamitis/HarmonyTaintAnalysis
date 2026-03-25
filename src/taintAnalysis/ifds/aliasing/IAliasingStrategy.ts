/*
 * Copyright (c) 2024-2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Stmt } from '../../../core/base/Stmt';
import { Value } from '../../../core/base/Value';
import { ArkMethod } from '../../../core/model/ArkMethod';
import { TaintFact } from '../TaintFact';
import { AccessPath } from '../AccessPath';

/**
 * 别名分析策略接口
 * 参考 FlowDroid 的策略模式设计，支持多种别名分析策略
 */
export interface IAliasingStrategy {
    
    /**
     * 寻找污点的别名
     * 
     * @param ctxFact 方法入口点的抽象
     * @param taintingStmt 当前语句（别名分析的起点）
     * @param taintedValue 目标值（被污染的变量）
     * @param taintSet 污点集合（用于收集结果）
     * @param method 当前方法
     * @param newFact 新创建的污点抽象
     */
    computeAliasTaints(
        ctxFact: TaintFact, 
        taintingStmt: Stmt, 
        taintedValue: Value, 
        taintSet: Set<TaintFact>, 
        method: ArkMethod, 
        newFact: TaintFact
    ): void;
    
    /**
     * 注入调用上下文
     * 连接前向和后向分析的调用上下文
     * 
     * @param d3 被调用方法入口点的抽象
     * @param forwardSolver 前向求解器
     * @param callee 被调用方法
     * @param callSite 调用点语句
     * @param source 源抽象
     * @param d1 调用方法入口点的抽象
     */
    injectCallingContext(
        d3: TaintFact, 
        forwardSolver: unknown,  // TaintSolver，使用 unknown 避免循环依赖
        callee: ArkMethod,
        callSite: Stmt, 
        source: TaintFact, 
        d1: TaintFact
    ): void;
    
    /**
     * 是否是流敏感的别名分析
     */
    isFlowSensitive(): boolean;
    
    /**
     * 判断两个访问路径是否可能别名
     * 
     * @param ap1 第一个访问路径
     * @param ap2 第二个访问路径
     * @return 是否可能别名
     */
    mayAlias(ap1: AccessPath, ap2: AccessPath): boolean;
    
    /**
     * 是否是交互式别名算法
     * 交互式算法可以在分析过程中响应别名查询
     */
    isInteractive(): boolean;
}
