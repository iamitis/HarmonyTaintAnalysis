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

import { MethodSignature, ClassSignature } from '../../../core/model/ArkSignature';
import { Stmt } from '../../../core/base/Stmt';
import { SourceDefinition, SinkDefinition, SourceSinkType } from '../SourceSinkDefinition';

/**
 * 当定义的 ClassSignature 为通配符时（JSON 中 declaringClass 为空），
 * 仅按方法名匹配；否则按完整签名精确匹配。
 */
function methodSignatureMatches(definitionSig: MethodSignature, stmtSig: MethodSignature): boolean {
    if (definitionSig.getDeclaringClassSignature() === ClassSignature.DEFAULT) {
        return definitionSig.getMethodSubSignature().getMethodName() ===
            stmtSig.getMethodSubSignature().getMethodName();
    }
    return definitionSig.isMatch(stmtSig);
}

/**
 * Method 形式的 Source 定义
 * 匹配方法调用语句，通过 methodSignature 进行匹配
 */
export class MethodSourceDefinition implements SourceDefinition {
    readonly type = SourceSinkType.METHOD;

    constructor(
        public readonly methodSignature: MethodSignature,
        // 返回值作为 source，或参数位置（-1 表示返回值）
        public readonly paramIndex: number
    ) { }

    /**
     * @override
     */
    matches(stmt: Stmt): boolean {
        const invokeExpr = stmt.getInvokeExpr();
        if (!invokeExpr) {
            return false;
        }
        const stmtMethodSignature = invokeExpr.getMethodSignature();
        return stmtMethodSignature !== undefined &&
            methodSignatureMatches(this.methodSignature, stmtMethodSignature);
    }

    /**
     * @override
     */
    toString(): string {
        return `MethodSource{${this.methodSignature.toString()}}`;
    }
}

/**
 * Method 形式的 Sink 定义
 * 匹配方法调用语句，通过 methodSignature 进行匹配
 */
export class MethodSinkDefinition implements SinkDefinition {
    readonly type = SourceSinkType.METHOD;

    constructor(
        public readonly methodSignature: MethodSignature,
        // 哪些参数位置是 sink
        public readonly paramIndices: number[]
    ) { }

    /**
     * @override
     */
    matches(stmt: Stmt): boolean {
        const invokeExpr = stmt.getInvokeExpr();
        if (!invokeExpr) {
            return false;
        }
        const stmtMethodSignature = invokeExpr.getMethodSignature();
        return stmtMethodSignature !== undefined &&
            methodSignatureMatches(this.methodSignature, stmtMethodSignature);
    }

    /**
     * @override
     */
    getParamIndices(): number[] {
        return this.paramIndices;
    }

    /**
     * @override
     */
    toString(): string {
        return `MethodSink{${this.methodSignature.toString()}}`;
    }
}
