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
import { IAliasingStrategy } from './IAliasingStrategy';

/**
 * 空别名分析策略
 * 不进行任何别名分析，用于不需要别名分析的场景
 */
export class NullAliasStrategy implements IAliasingStrategy {
    
    /**
     * 计算别名污点 - 空实现
     */
    public computeAliasTaints(
        d1: TaintFact, 
        src: Stmt, 
        targetValue: Value, 
        taintSet: Set<TaintFact>, 
        method: ArkMethod, 
        newAbs: TaintFact
    ): void {
        // 不进行别名分析，什么都不做
    }
    
    /**
     * 注入调用上下文 - 空实现
     */
    public injectCallingContext(
        d3: TaintFact, 
        forwardSolver: unknown, 
        callee: ArkMethod,
        callSite: Stmt, 
        source: TaintFact, 
        d1: TaintFact
    ): void {
        // 不进行上下文注入，什么都不做
    }
    
    /**
     * 是否是流敏感的别名分析
     */
    public isFlowSensitive(): boolean {
        return false;
    }
    
    /**
     * 判断两个访问路径是否可能别名
     * 简化实现：只有完全相同才认为可能别名
     */
    public mayAlias(ap1: AccessPath, ap2: AccessPath): boolean {
        return ap1 === ap2;
    }
    
    /**
     * 是否是交互式别名算法
     */
    public isInteractive(): boolean {
        return false;
    }
}
