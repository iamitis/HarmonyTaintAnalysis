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

// 主入口
export { TaintAnalysis } from './SetupApplication';

// IFDS 污点分析
export { TaintFact } from './ifds/TaintFact';
export { AccessPath } from './ifds/AccessPath';
export { TaintProblem } from './ifds/TaintProblem';
export { TaintSolver } from './ifds/TaintSolver';
export { IFDSManager } from './ifds/IFDSManager';
export { Aliasing } from './ifds/Aliasing';
export { AliasSolver } from './ifds/AliasSolver';
export { AliasProblem } from './ifds/AliasProblem';
export { Postdominator } from './ifds/Postdominator';

// 别名分析策略
export { IAliasingStrategy } from './ifds/aliasing/IAliasingStrategy';
export { FlowSensitiveAliasStrategy } from './ifds/aliasing/FlowSensitiveAliasStrategy';
export { NullAliasStrategy } from './ifds/aliasing/NullAliasStrategy';

// 配置
export { IFDSConfig, StaticFieldTrackingMode } from './config/IFDSConfig';

// Source/Sink 管理
export { SourceSinkManager } from './sourcesAndSinks/SourceSinkManager';
export { JsonSourceSinkManager } from './sourcesAndSinks/JsonSourceSinkManager';
