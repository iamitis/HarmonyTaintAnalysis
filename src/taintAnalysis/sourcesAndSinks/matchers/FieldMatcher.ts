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

import { FieldSignature } from '../../../core/model/ArkSignature';
import { Stmt } from '../../../core/base/Stmt';
import { ArkAssignStmt } from '../../../core/base/Stmt';
import { AbstractFieldRef } from '../../../core/base/Ref';
import { SourceDefinition, SinkDefinition, SourceSinkType } from '../SourceSinkDefinition';

export type FieldAccessType = 'READ' | 'WRITE' | 'BOTH';

/**
 * Field 形式的 Source 定义
 * 匹配字段访问语句（读取操作），通过 fieldSignature 进行匹配
 */
export class FieldSourceDefinition implements SourceDefinition {
    readonly type = SourceSinkType.FIELD;

    constructor(
        public readonly fieldSignature: FieldSignature,
        // 访问类型：READ（读取作为 source）、WRITE（写入作为 source）、BOTH（两者都是）
        public readonly accessType: FieldAccessType = 'BOTH'
    ) {}

    /**
     * @override
     */
    matches(stmt: Stmt): boolean {
        // 检查是否是读取操作
        if (this.accessType === 'WRITE' || this.accessType === 'BOTH') {
            // 赋值语句的右侧是读取操作
            if (stmt instanceof ArkAssignStmt) {
                const rightOp = stmt.getRightOp();
                if (this.containsFieldRef(rightOp)) {
                    return true;
                }
            }
            // 语句中使用的值包含字段引用
            for (const use of stmt.getUses()) {
                if (use instanceof AbstractFieldRef) {
                    const useFieldSignature = this.extractFieldSignature(use);
                    if (useFieldSignature && this.fieldSignatureIsMatch(useFieldSignature)) {
                        return true;
                    }
                }
            }
        }

        // 检查是否是写入操作
        if (this.accessType === 'READ' || this.accessType === 'BOTH') {
            // 赋值语句的左侧是写入操作
            if (stmt instanceof ArkAssignStmt) {
                const leftOp = stmt.getLeftOp();
                if (this.containsFieldRef(leftOp)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 检查值是否包含字段引用
     */
    private containsFieldRef(value: any): boolean {
        if (value instanceof AbstractFieldRef) {
            const fieldSignature = this.extractFieldSignature(value);
            return fieldSignature !== null && this.fieldSignatureIsMatch(fieldSignature);
        }
        return false;
    }

    /**
     * 从字段引用中提取 FieldSignature
     */
    private extractFieldSignature(fieldRef: AbstractFieldRef): FieldSignature | null {
        // ArkInstanceFieldRef 和 ArkStaticFieldRef 都有 getFieldSignature 方法
        if (typeof (fieldRef as any).getFieldSignature === 'function') {
            return (fieldRef as any).getFieldSignature();
        }
        return null;
    }

    /**
     * 比较两个 FieldSignature 是否匹配
     */
    private fieldSignatureIsMatch(stmtFieldSignature: FieldSignature): boolean {
        return this.fieldSignature.toString() === stmtFieldSignature.toString();
    }
}

/**
 * Field 形式的 Sink 定义
 * 匹配字段访问语句（写入操作），通过 fieldSignature 进行匹配
 */
export class FieldSinkDefinition implements SinkDefinition {
    readonly type = SourceSinkType.FIELD;

    constructor(
        public readonly fieldSignature: FieldSignature,
        // 访问类型：READ（读取作为 sink）、WRITE（写入作为 sink）、BOTH（两者都是）
        public readonly accessType: FieldAccessType = 'BOTH'
    ) {}

    /**
     * @override
     */
    matches(stmt: Stmt): boolean {
        // 对于 Sink，我们通常关心的是数据被写入到敏感位置
        // 所以主要检查 WRITE 操作

        // 检查是否是写入操作
        if (this.accessType === 'READ' || this.accessType === 'BOTH') {
            // 赋值语句的右侧是读取操作
            if (stmt instanceof ArkAssignStmt) {
                const rightOp = stmt.getRightOp();
                if (this.containsFieldRef(rightOp)) {
                    return true;
                }
            }
            // 语句中使用的值包含字段引用
            for (const use of stmt.getUses()) {
                if (use instanceof AbstractFieldRef) {
                    const useFieldSignature = this.extractFieldSignature(use);
                    if (useFieldSignature && this.fieldSignatureIsMatch(useFieldSignature)) {
                        return true;
                    }
                }
            }
        }

        // 检查是否是写入操作
        if (this.accessType === 'WRITE' || this.accessType === 'BOTH') {
            // 赋值语句的左侧是写入操作
            if (stmt instanceof ArkAssignStmt) {
                const leftOp = stmt.getLeftOp();
                if (this.containsFieldRef(leftOp)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 检查值是否包含字段引用
     */
    private containsFieldRef(value: any): boolean {
        if (value instanceof AbstractFieldRef) {
            const fieldSignature = this.extractFieldSignature(value);
            return fieldSignature !== null && this.fieldSignatureIsMatch(fieldSignature);
        }
        return false;
    }

    /**
     * 从字段引用中提取 FieldSignature
     */
    private extractFieldSignature(fieldRef: AbstractFieldRef): FieldSignature | null {
        if (typeof (fieldRef as any).getFieldSignature === 'function') {
            return (fieldRef as any).getFieldSignature();
        }
        return null;
    }

    /**
     * 比较两个 FieldSignature 是否匹配
     */
    private fieldSignatureIsMatch(stmtFieldSignature: FieldSignature): boolean {
        return this.fieldSignature.toString() === stmtFieldSignature.toString();
    }

    /**
     * @override
     * 对于字段类型的 Sink，不涉及方法参数，返回空数组
     */
    getParamIndices(): number[] {
        return [];
    }
}
