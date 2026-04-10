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

import { MethodSignature, ClassSignature, FieldSignature, FileSignature, NamespaceSignature, MethodSubSignature } from '../../core/model/ArkSignature';
import { MethodParameter } from '../../core/model/builder/ArkMethodBuilder';
import { TypeInference } from '../../core/common/TypeInference';
import { Type, ArrayType, UnclearReferenceType, ClassType } from '../../core/base/Type';
import { SourceDefinition, SinkDefinition, SourceSinkType } from './SourceSinkDefinition';
import { MethodSourceDefinition, MethodSinkDefinition } from './matchers/MethodMatcher';
import { FieldSourceDefinition, FieldSinkDefinition, FieldAccessType } from './matchers/FieldMatcher';
import Logger, { LOG_MODULE_TYPE } from '../../utils/logger';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'SourceSinkDefinitionFactory');

/**
 * JSON 定义文件中 FileSignature 的格式
 */
export interface FileSignatureJson {
    projectName: string;
    fileName: string;
}

/**
 * JSON 定义文件中 NamespaceSignature 的格式
 */
export interface NamespaceSignatureJson {
    namespaceName: string;
    fileSignature: FileSignatureJson;
    declaringNamespace?: NamespaceSignatureJson | null;
}

/**
 * JSON 定义文件中 ClassSignature 的格式
 * 支持对象形式或字符串形式（如 "@projectName/fileName:ClassName" 或 "@projectName/fileName:Namespace.ClassName"）
 */
export type ClassSignatureJson = {
    className: string;
    fileSignature: FileSignatureJson;
    namespace?: NamespaceSignatureJson | null;
} | string;

/**
 * JSON 定义文件中方法签名的通用格式
 */
export interface MethodDefinitionJson {
    type?: 'METHOD';
    declaringClass: ClassSignatureJson;
    methodName: string;
    parameterTypes: string[];
    returnType: string;
    isStatic: boolean;
}

/**
 * JSON 定义文件中字段签名的格式
 */
export interface FieldDefinitionJson {
    type: 'FIELD';
    declaringClass: ClassSignatureJson;
    fieldName: string;
    fieldType?: string;
    isStatic?: boolean;
    accessType?: FieldAccessType;
}

/**
 * JSON 定义文件中 Source 的格式（支持 Method 和 Field）
 */
export type SourceDefinitionJson = (MethodDefinitionJson & { paramIndex: number; type?: 'METHOD' }) |
    (FieldDefinitionJson & { type: 'FIELD' });

/**
 * JSON 定义文件中 Sink 的格式（支持 Method 和 Field）
 */
export type SinkDefinitionJson = (MethodDefinitionJson & { paramIndices: number[]; type?: 'METHOD' }) |
    (FieldDefinitionJson & { type: 'FIELD' });

/**
 * JSON 定义文件的整体格式
 */
export interface TaintDefinitionsJson {
    sources?: SourceDefinitionJson[];
    sinks?: SinkDefinitionJson[];
}

/**
 * Source/Sink 定义工厂类
 * 负责将 JSON 配置转换为统一的 SourceDefinition 和 SinkDefinition 接口
 */
export class SourceSinkDefinitionFactory {
    /**
     * 从 JSON 格式创建 SourceDefinition
     * @param json Source 配置的 JSON 对象
     * @returns SourceDefinition 实例
     */
    public static createSourceFromJson(json: SourceDefinitionJson): SourceDefinition | null {
        try {
            const type = (json as any).type || 'METHOD';

            if (type === 'FIELD') {
                return this.createFieldSourceFromJson(json as FieldDefinitionJson);
            }

            return this.createMethodSourceFromJson(json as MethodDefinitionJson);
        } catch (error) {
            logger.error(`Failed to create SourceDefinition from JSON: ${error}`);
            return null;
        }
    }

    /**
     * 从 JSON 格式创建 SinkDefinition
     * @param json Sink 配置的 JSON 对象
     * @returns SinkDefinition 实例
     */
    public static createSinkFromJson(json: SinkDefinitionJson): SinkDefinition | null {
        try {
            const type = (json as any).type || 'METHOD';

            if (type === 'FIELD') {
                return this.createFieldSinkFromJson(json as FieldDefinitionJson);
            }

            return this.createMethodSinkFromJson(json as MethodDefinitionJson);
        } catch (error) {
            logger.error(`Failed to create SinkDefinition from JSON: ${error}`);
            return null;
        }
    }

    /**
     * 从 JSON 格式创建 MethodSourceDefinition
     */
    private static createMethodSourceFromJson(json: MethodDefinitionJson): MethodSourceDefinition {
        const methodSignature = this.buildMethodSignatureFromJson(json);
        const paramIndex = (json as any).paramIndex ?? -1;
        return new MethodSourceDefinition(methodSignature, paramIndex);
    }

    /**
     * 从 JSON 格式创建 MethodSinkDefinition
     */
    private static createMethodSinkFromJson(json: MethodDefinitionJson): MethodSinkDefinition {
        const methodSignature = this.buildMethodSignatureFromJson(json);
        const paramIndices = (json as any).paramIndices ?? [];
        return new MethodSinkDefinition(methodSignature, paramIndices);
    }

    /**
     * 从 JSON 格式创建 FieldSourceDefinition
     */
    private static createFieldSourceFromJson(json: FieldDefinitionJson): FieldSourceDefinition {
        const fieldSignature = this.buildFieldSignatureFromJson(json);
        const accessType = json.accessType || 'BOTH';
        return new FieldSourceDefinition(fieldSignature, accessType);
    }

    /**
     * 从 JSON 格式创建 FieldSinkDefinition
     */
    private static createFieldSinkFromJson(json: FieldDefinitionJson): FieldSinkDefinition {
        const fieldSignature = this.buildFieldSignatureFromJson(json);
        const accessType = json.accessType || 'BOTH';
        return new FieldSinkDefinition(fieldSignature, accessType);
    }

    /**
     * 从 JSON 格式构建 MethodSignature
     */
    public static buildMethodSignatureFromJson(json: MethodDefinitionJson): MethodSignature {
        const classSignature = this.buildClassSignatureFromJson(json.declaringClass);
        const parameters = this.buildParametersFromJson(json.parameterTypes);
        const returnType = this.buildEnhancedTypeFromStr(json.returnType);
        const methodSubSignature = new MethodSubSignature(
            json.methodName,
            parameters,
            returnType,
            json.isStatic ?? false
        );
        return new MethodSignature(classSignature, methodSubSignature);
    }

    /**
     * 从 JSON 格式构建 ClassSignature
     * 支持对象形式或字符串形式（如 "@projectName/fileName:ClassName" 或 "@projectName/fileName:Namespace.ClassName"）
     * 当 declaringClass 为空对象或缺少必要字段时，返回 ClassSignature.DEFAULT 作为通配符
     */
    private static buildClassSignatureFromJson(json: ClassSignatureJson): ClassSignature {
        // 处理字符串形式: "@projectName/fileName:ClassName" 或 "@projectName/fileName:Namespace.ClassName"
        if (typeof json === 'string') {
            return this.parseClassSignatureString(json);
        }

        // 处理对象形式
        if (!json || !json.className || !json.fileSignature) {
            return ClassSignature.DEFAULT;
        }
        const fileSignature = new FileSignature(
            json.fileSignature.projectName,
            json.fileSignature.fileName
        );
        const namespaceSignature = json.namespace
            ? this.buildNamespaceSignatureFromJson(json.namespace, fileSignature)
            : null;
        return new ClassSignature(json.className, fileSignature, namespaceSignature);
    }

    /**
     * 解析类签名字符串
     * 格式: "@projectName/fileName:ClassName" 或 "@projectName/fileName:Namespace.ClassName"
     * @param classSigStr 类签名字符串
     * @returns ClassSignature 实例
     */
    private static parseClassSignatureString(classSigStr: string): ClassSignature {
        // 格式: @projectName/fileName:ClassName 或 @projectName/fileName:Namespace.ClassName
        const match = classSigStr.match(/^@([^/]+)\/([^:]+):(.+)$/);
        if (!match) {
            logger.error(`Invalid class signature format: ${classSigStr}`);
            return ClassSignature.DEFAULT;
        }

        const [, projectName, fileName, fullClassName] = match;
        const fileSignature = new FileSignature(projectName, fileName);

        // 处理命名空间: Namespace.ClassName
        const classParts = fullClassName.split('.');
        const className = classParts.pop()!; // 最后一部分是类名

        if (classParts.length > 0) {
            // 有命名空间，构建命名空间链
            const namespaceSignature = this.buildNamespaceChain(classParts, fileSignature);
            return new ClassSignature(className, fileSignature, namespaceSignature);
        }

        // 无命名空间
        return new ClassSignature(className, fileSignature, null);
    }

    /**
     * 构建命名空间链
     * @param namespaceParts 命名空间部分数组
     * @param fileSignature 文件签名
     * @returns 最内层的 NamespaceSignature
     */
    private static buildNamespaceChain(namespaceParts: string[], fileSignature: FileSignature): NamespaceSignature {
        // 从外到内构建命名空间链
        let parentNs: NamespaceSignature | null = null;
        for (const nsName of namespaceParts) {
            parentNs = new NamespaceSignature(nsName, fileSignature, parentNs);
        }
        return parentNs!;
    }

    /**
     * 从 JSON 格式构建 NamespaceSignature
     */
    private static buildNamespaceSignatureFromJson(
        json: NamespaceSignatureJson,
        fileSignature: FileSignature
    ): NamespaceSignature {
        const parentNs = json.declaringNamespace
            ? this.buildNamespaceSignatureFromJson(json.declaringNamespace, fileSignature)
            : null;
        return new NamespaceSignature(
            json.namespaceName,
            fileSignature,
            parentNs
        );
    }

    /**
     * 从 JSON 格式构建 FieldSignature
     */
    public static buildFieldSignatureFromJson(json: FieldDefinitionJson): FieldSignature {
        const classSignature = this.buildClassSignatureFromJson(json.declaringClass);
        const fieldType = json.fieldType ? this.buildEnhancedTypeFromStr(json.fieldType) :
            require('../../core/base/Type').UnknownType.getInstance();
        return new FieldSignature(json.fieldName, classSignature, fieldType, json.isStatic ?? false);
    }

    /**
     * 从类型字符串数组构建 MethodParameter 数组
     */
    private static buildParametersFromJson(parameterTypes: string[]): MethodParameter[] {
        return parameterTypes.map((typeStr, index) => {
            const param = new MethodParameter();
            param.setName(`p${index}`);
            param.setType(this.buildEnhancedTypeFromStr(typeStr));
            return param;
        });
    }

    /**
     * 增强型类型字符串解析，包装 TypeInference.buildTypeFromStr
     * 在调用原方法前先处理类签名、数组类型、泛型 Array 语法和通用泛型语法
     * @param typeStr 类型字符串
     * @returns 解析后的 Type 实例
     */
    private static buildEnhancedTypeFromStr(typeStr: string): Type {
        const trimmed = typeStr.trim();

        // 1. 类签名字符串：@projectName/fileName:ClassName 或 @projectName/fileName:Namespace.ClassName
        if (trimmed.startsWith('@')) {
            const classSignature = this.parseClassSignatureString(trimmed);
            if (classSignature !== ClassSignature.DEFAULT) {
                return new ClassType(classSignature);
            }
            // 解析失败，回退到原始方法
            return TypeInference.buildTypeFromStr(trimmed);
        }

        // 2. 数组后缀语法：T[], T[][], ...
        if (trimmed.endsWith('[]')) {
            let dimension = 0;
            let base = trimmed;
            while (base.endsWith('[]')) {
                dimension++;
                base = base.slice(0, -2);
            }
            const baseType = this.buildEnhancedTypeFromStr(base);
            return new ArrayType(baseType, dimension);
        }

        // 3. 泛型 Array 语法：Array<T>
        if (trimmed.startsWith('Array<') && trimmed.endsWith('>')) {
            const inner = trimmed.slice(6, -1).trim();
            const elementType = this.buildEnhancedTypeFromStr(inner);
            return new ArrayType(elementType, 1);
        }

        // 4. 通用泛型语法：TypeName<T1, T2, ...>
        const angleBracketIdx = trimmed.indexOf('<');
        if (angleBracketIdx > 0 && trimmed.endsWith('>')) {
            const typeName = trimmed.slice(0, angleBracketIdx).trim();
            const genericContent = trimmed.slice(angleBracketIdx + 1, -1).trim();
            const genericArgs = this.splitGenericArgs(genericContent);
            const parsedGenericTypes = genericArgs.map(arg => this.buildEnhancedTypeFromStr(arg));
            return new UnclearReferenceType(typeName, parsedGenericTypes);
        }

        // 5. 回退：调用原始方法
        return TypeInference.buildTypeFromStr(trimmed);
    }

    /**
     * 按顶层逗号拆分泛型参数列表，正确处理嵌套尖括号
     * 例如 "string, Map<string, number>" -> ["string", "Map<string, number>"]
     */
    private static splitGenericArgs(content: string): string[] {
        const args: string[] = [];
        let depth = 0;
        let start = 0;
        for (let i = 0; i < content.length; i++) {
            const ch = content[i];
            if (ch === '<') {
                depth++;
            } else if (ch === '>') {
                depth--;
            } else if (ch === ',' && depth === 0) {
                args.push(content.slice(start, i).trim());
                start = i + 1;
            }
        }
        args.push(content.slice(start).trim());
        return args.filter(a => a.length > 0);
    }
}

