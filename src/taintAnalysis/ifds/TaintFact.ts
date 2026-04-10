import { LOG_MODULE_TYPE, Logger, Value } from '../..';
import { NullConstant } from '../../core/base/Constant';
import { Stmt } from '../../core/base/Stmt';
import { SourceDefinition } from '../sourcesAndSinks/SourceSinkDefinition';
import { AccessPath } from './AccessPath';
import { Postdominator } from './Postdominator';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'TaintFact');

/**
 * 污点 Fact
 * 表示 IFDS 分析中的数据流事实
 */
export class TaintFact {

    /** 流敏感别名分析的全局开关 */
    protected static flowSensitiveAliasing: boolean = true;

    /** 受污变量名 */
    private accessPath: AccessPath;

    /** 受污染的变量 */
    private taintedVar: Value;

    /* 污染变量的语句 */
    private taintingStmt?: Stmt;

    private sourceDefinition?: SourceDefinition;

    /* 前驱污点 */
    private preTaintFact?: TaintFact;

    /* 是否已激活 */
    private active: boolean = true;

    /** 
     * 激活单元 - 用于延迟激活非活跃抽象
     * undefined 表示已激活，非 undefined 表示未激活，需要经过该语句才能激活
     */
    private activationStmt?: Stmt;

    /** 后支配节点栈, 用于隐式流分析, 记录 tainted if 语句的后支配节点 */
    private postdominators?: Postdominator[];

    /** 是否是零值 Fact */
    private isZero: boolean = false;

    /** 是否依赖于被截断的访问路径 */
    private dependsOnCutAPFlag: boolean = false;

    constructor(accessPath: AccessPath, taintedVar: Value, taintingStmt?: Stmt) {
        this.accessPath = accessPath;
        this.taintedVar = taintedVar;
        this.taintingStmt = taintingStmt;
    }

    /**
     * 创建被 source definition 直接污染的 fact
     */
    public static createSourceFact(accessPath: AccessPath, taintedVar: Value, sourceDefinition: SourceDefinition, taintingStmt: Stmt) {
        const sourceFact = new TaintFact(accessPath, taintedVar, taintingStmt);
        sourceFact.sourceDefinition = sourceDefinition;
        return sourceFact;
    }

    /**
     * 创建由旧污点产生的新污点, 如赋值语句传递的污点
     */
    public deriveWithNewAccessPath(accessPath: AccessPath, taintedVar: Value, taintingStmt: Stmt): TaintFact | undefined {
        if (this.isZeroFact()) {
            logger.warn('Creating normal fact from zero fact');
            return undefined;
        }

        const newFact = new TaintFact(accessPath, taintedVar, taintingStmt);
        newFact.sourceDefinition = this.sourceDefinition;
        newFact.preTaintFact = this;
        newFact.active = this.active;
        newFact.activationStmt = this.activationStmt;
        newFact.postdominators = this.postdominators ? [...this.postdominators] : undefined;
        newFact.dependsOnCutAPFlag = this.dependsOnCutAPFlag;

        return newFact;
    }

    /**
     * 派生非活跃抽象
     * 用于别名分析，创建的污点只有经过激活单元才会生效
     * @param activationStmt 激活单元语句
     */
    public deriveInactiveFact(activationStmt: Stmt): TaintFact {
        // 非流敏感模式，直接返回活跃抽象
        if (!TaintFact.flowSensitiveAliasing) {
            logger.warn('Creating inactive fact in non-flow-sensitive aliasing mode')
            return this;
        }

        if (!this.isActive()) {
            logger.warn('Creating inactive fact from inactive fact')
            return this;
        }

        const newFact = new TaintFact(this.accessPath, this.taintedVar, this.taintingStmt);
        newFact.sourceDefinition = this.sourceDefinition;
        newFact.preTaintFact = this.preTaintFact;
        newFact.active = false;
        newFact.activationStmt = activationStmt;
        newFact.postdominators = this.postdominators ? [...this.postdominators] : undefined;
        newFact.dependsOnCutAPFlag = this.dependsOnCutAPFlag;
        return newFact;
    }

    /**
     * 设置流敏感别名分析开关
     */
    public static setFlowSensitiveAliasing(enabled: boolean): void {
        TaintFact.flowSensitiveAliasing = enabled;
    }

    /**
     * 获取流敏感别名分析开关
     */
    public static isFlowSensitiveAliasing(): boolean {
        return TaintFact.flowSensitiveAliasing;
    }

    /**
     * 创建零值 Fact（IFDS 的特殊初始 fact）
     */
    public static createZeroFact(): TaintFact {
        const zeroFact = new TaintFact(AccessPath.getZeroAccessPath(), NullConstant.getInstance(), undefined);
        zeroFact.isZero = true;
        return zeroFact;
    }

    /**
     * 获取活跃副本
     * 清除激活单元，使抽象变为活跃状态
     */
    public getActiveCopy(): TaintFact {
        if (this.isActive()) {
            return this;
        }
        const copy = new TaintFact(this.accessPath, this.taintedVar, this.taintingStmt);
        copy.sourceDefinition = this.sourceDefinition;
        copy.preTaintFact = this.preTaintFact;
        copy.activationStmt = this.activationStmt;
        copy.postdominators = this.postdominators ? [...this.postdominators] : undefined;
        copy.dependsOnCutAPFlag = this.dependsOnCutAPFlag;
        return copy;
    }

    public getTopPostdominator(): Postdominator | undefined {
        return this.postdominators?.[0];
    }

    /**
     * 获取被污染的值（访问路径）
     */
    public getAccessPath(): AccessPath {
        return this.accessPath;
    }

    public getSourceDefinition(): SourceDefinition | undefined {
        return this.sourceDefinition;
    }

    public getPreTaintFact(): TaintFact | undefined {
        return this.preTaintFact;
    }

    /**
     * 获取污染变量的 stmt
     */
    public getTaintingStmt(): Stmt | undefined {
        return this.taintingStmt;
    }

    /**
     * 获取激活单元
     */
    public getActivationStmt(): Stmt | undefined {
        return this.activationStmt;
    }

    public getTaintedVar(): Value {
        return this.taintedVar;
    }

    /**
     * 是否是零值 Fact
     */
    public isZeroFact(): boolean {
        return this.isZero;
    }

    /**
     * 是否是已激活的 Fact
     * activationUnit == undefined 表示活跃
     */
    public isActive(): boolean {
        return this.active;
    }

    /**
     * 是否依赖于被截断的访问路径
     */
    public dependsOnCutAP(): boolean {
        return this.dependsOnCutAPFlag;
    }

    /**
     * 设置截断依赖标志
     */
    public setDependsOnCutAP(value: boolean): void {
        this.dependsOnCutAPFlag = value;
    }

    /**
     * 判断两个 Fact 是否相等
     *
     * 相等性基于 fact 的语义身份，即：
     * 1. accessPath — 标识被污染的变量/字段
     * 2. activationStmt — 区分不同激活条件的非活跃抽象
     * 3. active — 区分同一 activationStmt 下的未激活与已激活状态
     *
     * 溯源信息（taintingStmt、sourceDefinition、preTaintFact）和
     * 辅助分析状态（postdominators、dependsOnCutAPFlag）不参与相等性判断。
     */
    public equals(other: TaintFact): boolean {
        // 引用相等快速路径
        if (this === other) {
            return true;
        }

        if (!other) {
            return false;
        }

        // 零值 fact：所有零值 fact 互相相等
        if (this.isZero && other.isZero) {
            return true;
        }
        if (this.isZero !== other.isZero) {
            return false;
        }

        // 核心身份：访问路径
        if (!this.accessPath.equals(other.accessPath)) {
            return false;
        }

        // 激活状态：activationStmt 区分不同激活条件，active 区分激活前后
        if (this.activationStmt !== other.activationStmt) {
            return false;
        }
        if (this.active !== other.active) {
            return false;
        }

        return true;
    }

    /**
     * 获取哈希值（用于 Set/Map）
     */
    public hashCode(): number {
        if (this.isZero) {
            return 0;
        }
        let hash = 1;
        if (this.accessPath) {
            hash = hash * 31 + this.hashString(this.accessPath.toString());
        }
        if (this.activationStmt) {
            hash = hash * 31 + this.hashString(this.activationStmt.toString());
        }
        return hash;
    }

    /**
     * 简单的字符串哈希函数
     */
    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    public toString(): string {
        if (this.isZero) {
            return 'ZERO';
        }
        const activeStatus = this.isActive() ? '' : `[inactive@${this.activationStmt?.toString() ?? ''}]`;
        return `TaintFact(${this.accessPath?.toString()}${activeStatus})`;
    }
}
