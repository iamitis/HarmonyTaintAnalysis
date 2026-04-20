export { TaintAnalysis } from './TaintAnalysis';

// IFDS 污点分析
export { TaintFact } from './ifds/TaintFact';
export { AccessPath } from './ifds/AccessPath';
export { TaintProblem } from './ifds/problem/TaintProblem';
export { TaintSolver } from './ifds/solver/TaintSolver';
export { IFDSManager } from './ifds/IFDSManager';
export { Aliasing } from './ifds/aliasing/Aliasing';
export { AliasSolver } from './ifds/solver/AliasSolver';
export { SolverPeerGroup } from './ifds/solver/SolverPeerGroup';
export { AliasProblem } from './ifds/problem/AliasProblem';
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
