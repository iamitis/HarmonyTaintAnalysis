import { FieldSignature, LOG_MODULE_TYPE, Logger } from "../..";
import { Local } from "../../core/base/Local";
import { AbstractFieldRef, ArkArrayRef, ArkInstanceFieldRef, ArkStaticFieldRef } from "../../core/base/Ref";
import { NullType, Type } from "../../core/base/Type";
import { Value } from "../../core/base/Value";

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'AccessPath');

export class AccessPath {
    /* base local, e.g. a in a, x in x.y.z */
    private base?: Local;

    /* fields, e.g. [y, z] in x.y.z */
    private fields?: FieldSignature[];

    private arrayTaintedByElement: boolean = false;

    /* access path used in zero value fact */
    private static zeroAccessPath?: AccessPath;

    constructor(base?: Local, fields?: FieldSignature[]) {
        this.base = base;
        this.fields = fields;
    }

    public getBase(): Local | undefined {
        return this.base;
    }

    public getFields(): FieldSignature[] | undefined {
        return this.fields;
    }

    public getBaseType(): Type {
        return this.base?.getType() ?? NullType.getInstance();
    }

    public isLocal(): boolean {
        return this.base !== undefined && (this.fields === undefined || this.fields.length === 0);
    }

    public isInstanceFieldRef(): boolean {
        return this.base !== undefined && this.fields !== undefined && this.fields.length > 0;
    }

    public isStaticFieldRef(): boolean {
        return this.base === undefined && this.fields !== undefined && this.fields.length > 0;
    }

    public isArrayTaintedByElement(): boolean {
        return this.arrayTaintedByElement;
    }

    public isEmpty(): boolean {
        return this.base === undefined && (this.fields === undefined || this.fields.length === 0);
    }

    public static getZeroAccessPath(): AccessPath {
        !AccessPath.zeroAccessPath && (AccessPath.zeroAccessPath = new AccessPath(new Local('zeroForAccessPath', NullType.getInstance())));

        return AccessPath.zeroAccessPath;
    }

    /**
     * 判断 accessPath 所指向的变量是否是 value 或者 value 的字段
     * 如:
     * value: a, accessPath: b.v
     * @returns 若匹配则返回匹配的 accessPath，否则返回 undefined
     */
    public isContainedByValue(value: Value): AccessPath | undefined {
        if (!this.isInstanceFieldRef()) {
            return undefined;
        }

        if (value instanceof Local) {
            if (this.isLocal() && this.getBase() === value) {
                return this;
            }
        } else if (value instanceof ArkInstanceFieldRef) {
            if (this.getBase() === value.getBase() && this.getFields()?.[0] === value.getFieldSignature()) {
                return this;
            }
            // TODO: 处理递归型字段 
        }

        // TODO: 处理其他类型

        return undefined;
    }

    /**
     * 判断 accessPath 所指向的变量是否是 value 或者 value 的字段
     */
    public static staticFieldRefContainsAccessPath(value: Value, accessPath: AccessPath): AccessPath | undefined {
        if (!accessPath.isStaticFieldRef()) {
            return undefined;
        }

        if (value instanceof ArkStaticFieldRef) {
            if (accessPath.firstFieldMatches(value.getFieldSignature())) {
                return accessPath;
            }
        }

        return undefined;
    }

    /**
     * 创建 Local, StaticField 或 InstanceField 型的 AccessPath.
     * @returns [base.base].[base.field].[fields] 
     */
    public static createAccessPath(base?: Value, fields?: FieldSignature[]): AccessPath | undefined {
        // 检查 base 是否可以被包含（如果提供了 base）
        if (base && !AccessPath.canContainValue(base)) {
            logger.error(`AccessPath.createAccessPath: base value: ${typeof base} is not containable`);
            return undefined;
        }

        if (!base && !fields) {
            logger.warn('AccessPath.createAccessPath: no base or fields')
            return undefined;
        }

        let newBase: Local | undefined;
        let newFields: FieldSignature[] | undefined;

        if (base instanceof AbstractFieldRef) {
            if (base instanceof ArkInstanceFieldRef) {
                newBase = base.getBase();
            } else if (base instanceof ArkStaticFieldRef) {
                newBase = undefined;
            }
            // 新 AccessPath 的第一个字段为 base 的字段
            newFields = [base.getFieldSignature()];
            fields && newFields.push(...fields);
        } else if (base instanceof ArkArrayRef) {
            newBase = base.getBase();
            fields && (newFields = [...fields]);
        } else if (base instanceof Local) {
            newBase = base;
            fields && (newFields = [...fields]);
        }

        return new AccessPath(newBase, newFields);
    }

    /**
     * 当数组元素被污染, 进而污染整个数组, 创建数组型 AccessPath
     */
    public static createElementTaintedArrayAccessPath(arrayBase: Local): AccessPath | undefined {
        if (!AccessPath.canContainValue(arrayBase)) {
            logger.error(`AccessPath.createElementTaintedArrayAccessPath: base value: ${typeof arrayBase} is not containable`);
            return undefined;
        }
        
        const accessPath = new AccessPath(arrayBase);
        accessPath.arrayTaintedByElement = true;
        return accessPath;
    }

    public deriveWithNewBase(newBase: Value, options?: any): AccessPath | undefined {
        let fields = this.getFields();
        let newFields = undefined;
        if (fields) {
            newFields = [...fields];
            options?.cutFirstField && newFields.shift();
        }
        return AccessPath.createAccessPath(newBase, newFields);
    }

    /**
     * Checks whether the given value can be the base value value of an access path
     */
    public static canContainValue(value?: Value): boolean {
        return value instanceof Local || value instanceof ArkInstanceFieldRef || value instanceof ArkStaticFieldRef || value instanceof ArkArrayRef;
    }

    /**
     * 获取原始值（与 getBase 相同）
     * 为了兼容 FlowDroid 的命名
     */
    public getPlainValue(): Local | undefined {
        return this.base;
    }

    /**
     * 检查第一个字段是否匹配
     * @param field 要检查的字段签名
     * @return 是否匹配
     */
    public firstFieldMatches(field: FieldSignature): boolean {
        if (!this.fields || this.fields.length === 0) {
            return false;
        }
        return this.fields[0] === field || this.fields[0]?.toString() === field?.toString();
    }

    /**
     * 获取第一个字段的类型
     */
    public getFirstFieldType(): Type | null {
        if (!this.fields || this.fields.length === 0) {
            return null;
        }
        // 简化实现：返回 NullType
        // 实际实现应该从 FieldSignature 获取类型
        return NullType.getInstance();
    }

    /**
     * 复制 AccessPath 并替换 base
     * 参考 FlowDroid AccessPath.copyWithNewValue
     * 
     * @param orig 原始 AccessPath
     * @param newBase 新的 base 值
     * @param newType 新的类型（可选）
     * @param cutFirstField 是否移除第一个字段
     * @return 新的 AccessPath
     */
    public static copyWithNewValue(
        orig: AccessPath,
        newBase: Value,
        newType?: Type,
        cutFirstField: boolean = false
    ): AccessPath | undefined {
        const origFields = orig.getFields();
        let fields: FieldSignature[] | undefined = origFields ? [...origFields] : undefined;

        if (cutFirstField && fields && fields.length > 0) {
            fields.shift();
        }

        return AccessPath.createAccessPath(newBase, fields);
    }

    /**
     * 检查是否等于另一个 AccessPath
     */
    public equals(other: AccessPath): boolean {
        if (this === other) {
            return true;
        }

        // 比较 base
        if (this.base !== other.base) {
            return false;
        }

        // 比较字段
        const thisFields = this.fields;
        const otherFields = other.fields;

        if (!thisFields && !otherFields) {
            return true;
        }

        if (!thisFields || !otherFields) {
            return false;
        }

        if (thisFields.length !== otherFields.length) {
            return false;
        }

        for (let i = 0; i < thisFields.length; i++) {
            if (thisFields[i] !== otherFields[i] &&
                thisFields[i]?.toString() !== otherFields[i]?.toString()) {
                return false;
            }
        }

        return true;
    }

    /**
     * 转换为字符串
     */
    public toString(): string {
        if (this.isEmpty()) {
            return '<empty>';
        }

        const parts: string[] = [];

        if (this.base) {
            parts.push(this.base.getName());
        }

        if (this.fields) {
            for (const field of this.fields) {
                parts.push('.<' + field.toString() + '>');
            }
        }

        return parts.join('');
    }
}