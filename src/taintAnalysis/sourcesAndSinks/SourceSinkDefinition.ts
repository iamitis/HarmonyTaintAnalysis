import { MethodSignature } from "../../core/model/ArkSignature";
import { Stmt } from "../../core/base/Stmt";

/**
 * Source/Sink 类型枚举
 */
export enum SourceSinkType {
    METHOD = 'METHOD',
    FIELD = 'FIELD',
}

/**
 * Source 定义接口：污点数据的来源
 * 统一的接口，具体的实现类需要实现 matches 方法来匹配语句
 */
export interface SourceDefinition {
    readonly type: SourceSinkType;
    /**
     * 判断给定的语句是否匹配该 Source 定义
     * @param stmt 要检查的语句
     * @returns 如果匹配返回 true，否则返回 false
     */
    matches(stmt: Stmt): boolean;

    toString(): string;
}

/**
 * Sink 定义接口：敏感操作点
 * 统一的接口，具体的实现类需要实现 matches 方法来匹配语句
 */
export interface SinkDefinition {
    readonly type: SourceSinkType;
    /**
     * 判断给定的语句是否匹配该 Sink 定义
     * @param stmt 要检查的语句
     * @returns 如果匹配返回 true，否则返回 false
     */
    matches(stmt: Stmt): boolean;
    /**
     * 获取 Sink 的参数索引列表（仅对 METHOD 类型的 Sink 有效）
     * @returns 参数索引数组
     */
    getParamIndices?(): number[];

    toString(): string;
}
