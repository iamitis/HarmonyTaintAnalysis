import { Aliasing } from "./aliasing/Aliasing";
import { IFDSConfig } from "../config/IFDSConfig";
import { SourceSinkManager } from "../sourcesAndSinks/SourceSinkManager";
import { FactAtSink } from "./FactAtSink";
import { AliasSolver } from "./solver/AliasSolver";
import { TaintSolver } from "./solver/TaintSolver";
import { ArkMethod } from "../../core/model/ArkMethod";
import { FieldSignature } from "../../core/model/ArkSignature";

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

    /**
     * 判断某个方法是否读取了指定的静态字段
     * TODO: 可基于 DefUseChain 实现精确判断，目前保守返回 true
     * @param method 被调用的方法
     * @param field 静态字段签名
     * @returns 是否读取了该静态字段
     */
    public isStaticFieldRead(method: ArkMethod, field: FieldSignature): boolean {
        // 保守实现：假设所有方法都可能读取静态字段
        return true;
    }

    /**
     * 判断某个方法是否使用（读或写）了指定的静态字段
     * TODO: 可基于 DefUseChain 实现精确判断，目前保守返回 true
     * @param method 被调用的方法
     * @param field 静态字段签名
     * @returns 是否使用了该静态字段
     */
    public isStaticFieldUsed(method: ArkMethod, field: FieldSignature): boolean {
        // 保守实现：假设所有方法都可能使用静态字段
        return true;
    }
}
