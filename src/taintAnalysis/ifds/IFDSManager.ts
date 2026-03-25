import { Aliasing } from "./Aliasing";
import { AliasingStrategy, IFDSConfig } from "../config/IFDSConfig";
import { SourceSinkManager } from "../sourcesAndSinks/SourceSinkManager";
import { DataflowSolver } from "../../core/dataflow/DataflowSolver";
import { TaintFact } from "./TaintFact";
import { FlowSensitiveAliasStrategy } from "./aliasing/FlowSensitiveAliasStrategy";
import { FactAtSink } from "./FactAtSink";
import { AliasSolver } from "./AliasSolver";
import { AliasProblem } from "./AliasProblem";
import { TaintSolver } from "./TaintSolver";

export interface IFDSResult {
    toString(): string;
}

/**
 * IFDS 管理器, 持有 IFDS 相关的配置, solver, 别名分析器 aliasing 等
 */
export class IFDSManager {
    private config: IFDSConfig;

    private aliasing?: Aliasing;

    private sourceSinkManager?: SourceSinkManager;

    /** 前向求解器（TaintSolver） */
    private forwardSolver?: TaintSolver;

    /** 后向求解器（AliasSolver） */
    private backwardSolver?: AliasSolver;

    private factAtSinks: Map<string, FactAtSink> = new Map();

    constructor(config: IFDSConfig) {
        this.config = config;
    }

    public getConfig(): IFDSConfig {
        return this.config;
    }

    public setAliasing(aliasing: Aliasing): void {
        this.aliasing = aliasing;
    }

    public getAliasing(): Aliasing | undefined {
        return this.aliasing;
    }

    public setSourceSinkManager(sourceSinkManager: SourceSinkManager): void {
        this.sourceSinkManager = sourceSinkManager;
    }

    public getSourceSinkManager(): SourceSinkManager | undefined {
        return this.sourceSinkManager;
    }

    /** 设置前向求解器 */
    public setForwardSolver(solver: TaintSolver): void {
        this.forwardSolver = solver;
    }

    /** 获取前向求解器 */
    public getForwardSolver(): TaintSolver | undefined {
        return this.forwardSolver;
    }

    /** 设置后向求解器 */
    public setBackwardSolver(solver: AliasSolver): void {
        this.backwardSolver = solver;
    }

    /** 获取后向求解器 */
    public getBackwardSolver(): AliasSolver | undefined {
        return this.backwardSolver;
    }

    public getResults(): Map<string, FactAtSink> {
        return this.factAtSinks;
    }
}
