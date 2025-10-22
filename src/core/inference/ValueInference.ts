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


import { ArkAssignStmt, Stmt } from '../base/Stmt';
import { Value } from '../base/Value';
import { Inference, InferenceFlow, InferenceManager } from './Inference';
import { ArkArrayRef, ArkInstanceFieldRef, ArkParameterRef, ArkStaticFieldRef, ClosureFieldRef } from '../base/Ref';
import {
    AliasType,
    AnnotationNamespaceType,
    AnyType,
    ArrayType,
    BooleanType,
    ClassType,
    FunctionType,
    GenericType,
    LexicalEnvType,
    NullType,
    NumberType,
    StringType,
    Type,
    UndefinedType,
    UnionType
} from '../base/Type';
import { TypeInference } from '../common/TypeInference';
import { IRInference } from '../common/IRInference';
import { ArkMethod } from '../model/ArkMethod';
import { EMPTY_STRING, ValueUtil } from '../common/ValueUtil';
import { ANONYMOUS_CLASS_PREFIX, INSTANCE_INIT_METHOD_NAME, NAME_PREFIX, UNKNOWN_CLASS_NAME } from '../common/Const';
import { CONSTRUCTOR_NAME, IMPORT, SUPER_NAME, THIS_NAME } from '../common/TSConst';
import {
    AbstractInvokeExpr,
    AliasTypeExpr,
    ArkCastExpr,
    ArkConditionExpr,
    ArkInstanceInvokeExpr,
    ArkInstanceOfExpr,
    ArkNewArrayExpr,
    ArkNewExpr,
    ArkNormalBinopExpr,
    ArkPtrInvokeExpr,
    ArkStaticInvokeExpr,
    RelationalBinaryOperator
} from '../base/Expr';
import { ModelUtils } from '../common/ModelUtils';
import { Local } from '../base/Local';
import { Bind, InferLanguage } from './InferenceBuilder';
import { Builtin } from '../common/Builtin';
import { ArkClass } from '../model/ArkClass';
import { Constant } from '../base/Constant';
import Logger, { LOG_MODULE_TYPE } from '../../utils/logger';
import { ClassSignature } from '../model/ArkSignature';
import { FileInference } from './ModelInference';
import { ImportInfo } from '../model/ArkImport';
import { ArkField } from '../model/ArkField';

const logger = Logger.getLogger(LOG_MODULE_TYPE.ARKANALYZER, 'ValueInference');

/**
 * Abstract base class for value-specific inference operations
 * @template T - Type parameter that must extend the Value base class
 */
export abstract class ValueInference<T extends Value> implements Inference, InferenceFlow {
    /**
     * Returns the name of the value being inferred
     * @returns Name identifier for the value
     */
    public abstract getValueName(): string;

    /**
     * Prepares for inference operation
     * @param value - The value to prepare for inference
     * @param stmt - The statement where the value is located
     * @returns True if inference should proceed, false otherwise
     */
    public abstract preInfer(value: T, stmt?: Stmt): boolean;

    /**
     * Performs the actual inference operation
     * @param value - The value to perform inference on
     * @param stmt - The statement where the value is located
     * @returns New inferred value or undefined if no changes
     */
    public abstract infer(value: T, stmt?: Stmt): Value | undefined;

    /**
     * Main inference workflow implementation
     * Orchestrates the preInfer → infer → postInfer sequence
     * @param value - The value to perform inference on
     * @param stmt - The statement where the value is located
     */
    public doInfer(value: T, stmt?: Stmt): void {
        try {
            // Only proceed if pre-inference checks pass
            if (this.preInfer(value, stmt)) {
                // Perform the core inference operation
                const newValue = this.infer(value, stmt);
                // Handle post-inference updates
                this.postInfer(value, newValue, stmt);
            }
        } catch (error) {
            logger.warn('infer value failed:' + (error as Error).message + ' from' + stmt?.toString());
        }
    }

    /**
     * Handles updates after inference completes
     * Replaces values in statements if new values are inferred
     * @param value - The original value that was inferred
     * @param newValue - The new inferred value
     * @param stmt - The statement where the value is located
     */
    public postInfer(value: T, newValue?: Value, stmt?: Stmt): void {
        if (newValue && stmt) {
            if (stmt.getDef() === value) {
                stmt.replaceDef(value, newValue);
            } else {
                stmt.replaceUse(value, newValue);
            }
        }
    }
}

@Bind()
export class ParameterRefInference extends ValueInference<ArkParameterRef> {
    public getValueName(): string {
        return 'ArkParameterRef';
    }

    public preInfer(value: ArkParameterRef): boolean {
        const type = value.getType();
        return type instanceof LexicalEnvType || TypeInference.isUnclearType(type);
    }

    public infer(value: ArkParameterRef, stmt: Stmt): Value | undefined {
        IRInference.inferParameterRef(value, stmt.getCfg().getDeclaringMethod());
        return undefined;
    }
}

@Bind()
export class ClosureFieldRefInference extends ValueInference<ClosureFieldRef> {
    public getValueName(): string {
        return 'ClosureFieldRef';
    }

    public preInfer(value: ClosureFieldRef): boolean {
        const type = value.getType();
        return TypeInference.isUnclearType(type);
    }

    public infer(value: ClosureFieldRef): Value | undefined {
        const type = value.getBase().getType();
        if (type instanceof LexicalEnvType) {
            let newType = type.getClosures().find(c => c.getName() === value.getFieldName())?.getType();
            if (newType && !TypeInference.isUnclearType(newType)) {
                value.setType(newType);
            }
        }
        return undefined;
    }
}

@Bind()
export class FieldRefInference extends ValueInference<ArkInstanceFieldRef> {
    public getValueName(): string {
        return 'ArkInstanceFieldRef';
    }

    public preInfer(value: ArkInstanceFieldRef, stmt?: Stmt): boolean {
        return IRInference.needInfer(value.getFieldSignature().getDeclaringSignature().getDeclaringFileSignature()) ||
            TypeInference.isUnclearType(value.getType()) || value.getFieldSignature().isStatic();
    }

    public infer(value: ArkInstanceFieldRef, stmt: Stmt): Value | undefined {
        const baseType = TypeInference.replaceAliasType(value.getBase().getType());
        const arkMethod = stmt.getCfg().getDeclaringMethod();
        if (baseType instanceof ArrayType && value.isDynamic()) {
            const index = TypeInference.getLocalFromMethodBody(value.getFieldName(), arkMethod);
            if (index) {
                return new ArkArrayRef(value.getBase(), index);
            } else {
                return new ArkArrayRef(value.getBase(), ValueUtil.createConst(value.getFieldName()));
            }
        }
        const newFieldSignature = IRInference.generateNewFieldSignature(value, arkMethod.getDeclaringArkClass(), baseType);
        if (newFieldSignature) {
            value.setFieldSignature(newFieldSignature);
            if (newFieldSignature.isStatic()) {
                return new ArkStaticFieldRef(newFieldSignature);
            }
        }
    }
}

@Bind()
export class StaticFieldRefInference extends ValueInference<ArkStaticFieldRef> {
    public getValueName(): string {
        return 'ArkStaticFieldRef';
    }

    public preInfer(value: ArkStaticFieldRef, stmt?: Stmt): boolean {
        return IRInference.needInfer(value.getFieldSignature().getDeclaringSignature().getDeclaringFileSignature()) ||
            TypeInference.isUnclearType(value.getType());
    }

    public infer(value: ArkStaticFieldRef, stmt: Stmt): Value | undefined {
        const baseSignature = value.getFieldSignature().getDeclaringSignature();
        const baseName = baseSignature instanceof ClassSignature ? baseSignature.getClassName() : baseSignature.getNamespaceName();
        const arkClass = stmt.getCfg().getDeclaringMethod().getDeclaringArkClass();
        const baseType = TypeInference.inferBaseType(baseName, arkClass);
        if (!baseType) {
            return undefined;
        }
        const newFieldSignature = IRInference.generateNewFieldSignature(value, arkClass, baseType);
        if (newFieldSignature) {
            value.setFieldSignature(newFieldSignature);
            if (newFieldSignature.isStatic()) {
                return new ArkStaticFieldRef(newFieldSignature);
            }
        }
    }
}


@Bind()
export class InstanceInvokeExprInference extends ValueInference<ArkInstanceInvokeExpr> {

    public getValueName(): string {
        return 'ArkInstanceInvokeExpr';
    }

    public preInfer(value: ArkInstanceInvokeExpr, stmt: Stmt | undefined): boolean {
        return IRInference.needInfer(value.getMethodSignature().getDeclaringClassSignature().getDeclaringFileSignature()) ||
            TypeInference.isUnclearType(value.getType());
    }

    public infer(value: ArkInstanceInvokeExpr, stmt: Stmt): Value | undefined {
        const arkMethod = stmt.getCfg().getDeclaringMethod();
        const result = this.inferInvokeExpr(value.getBase().getType(), value, arkMethod);
        return this.process(result, value, stmt);
    }

    public process(result: AbstractInvokeExpr | null, value: AbstractInvokeExpr, stmt: Stmt): AbstractInvokeExpr | undefined {
        const arkMethod = stmt.getCfg().getDeclaringMethod();
        if (result) {
            IRInference.inferArgs(value, arkMethod);
            for (const arg of value.getArgs()) {
                const argType = arg.getType();
                if (!(argType instanceof FunctionType)) {
                    continue;
                }
                const callBack = arkMethod.getDeclaringArkFile().getScene().getMethod(argType.getMethodSignature());
                if (callBack && callBack.getBody()) {
                    this.invokeCallBack(callBack, new Set([arkMethod]));
                }
            }
        }
        if (result instanceof ArkInstanceInvokeExpr && result.getBase().getName() === SUPER_NAME) {
            const thisLocal = arkMethod.getBody()?.getLocals().get(THIS_NAME);
            if (thisLocal) {
                result.setBase(thisLocal);
                thisLocal.addUsedStmt(stmt);
            }
        }
        return !result || result === value ? undefined : result;
    }

    private invokeCallBack(callback: ArkMethod, visited: Set<ArkMethod>): void {
        const paramLength = callback.getImplementationSignature()?.getParamLength();
        if (!paramLength || paramLength === 0) {
            return;
        }
        if (visited.has(callback)) {
            return;
        } else {
            visited.add(callback);
        }
        const inference = InferenceManager.getInstance().getInference(callback.getDeclaringArkFile().getLanguage());
        if (inference instanceof FileInference) {
            const methodInference = inference.getClassInference().getMethodInference();
            methodInference.doInfer(callback);
        }
    }

    public getMethodName(expr: AbstractInvokeExpr, arkMethod: ArkMethod): string {
        let methodName = expr.getMethodSignature().getMethodSubSignature().getMethodName();
        if (methodName.startsWith(NAME_PREFIX)) {
            const declaringStmt = arkMethod.getBody()?.getLocals().get(methodName)?.getDeclaringStmt();
            if (declaringStmt instanceof ArkAssignStmt && declaringStmt.getRightOp() instanceof ArkInstanceFieldRef) {
                const rightOp = declaringStmt.getRightOp() as ArkInstanceFieldRef;
                methodName = rightOp.getBase().getName() + '.' + rightOp.getFieldName();
            }
        }
        return methodName;
    }

    public inferInvokeExpr(baseType: Type, expr: AbstractInvokeExpr, arkMethod: ArkMethod): AbstractInvokeExpr | null {
        if (baseType instanceof AliasType) {
            baseType = TypeInference.replaceAliasType(baseType);
        } else if (baseType instanceof UnionType) {
            for (let type of baseType.flatType()) {
                if (type instanceof UndefinedType || type instanceof NullType) {
                    continue;
                }
                let result = this.inferInvokeExpr(type, expr, arkMethod);
                if (result) {
                    return result;
                }
            }
        } else if (baseType instanceof ArrayType) {
            const arrayClass = arkMethod.getDeclaringArkFile().getScene().getSdkGlobal(Builtin.ARRAY);
            if (arrayClass instanceof ArkClass) {
                baseType = new ClassType(arrayClass.getSignature(), [baseType.getBaseType()]);
            }
        } else if (baseType instanceof StringType || baseType instanceof NumberType || baseType instanceof BooleanType) {
            const name = baseType.getName();
            const className = name.charAt(0).toUpperCase() + name.slice(1);
            const arrayClass = arkMethod.getDeclaringArkFile().getScene().getSdkGlobal(className);
            if (arrayClass instanceof ArkClass) {
                baseType = new ClassType(arrayClass.getSignature());
            }
        }
        let methodName = this.getMethodName(expr, arkMethod);
        const scene = arkMethod.getDeclaringArkFile().getScene();
        if (baseType instanceof ClassType) {
            return IRInference.inferInvokeExprWithDeclaredClass(expr, baseType, methodName, scene);
        } else if (baseType instanceof AnnotationNamespaceType) {
            const namespace = scene.getNamespace(baseType.getNamespaceSignature());
            if (namespace) {
                const foundMethod = ModelUtils.findPropertyInNamespace(methodName, namespace);
                if (foundMethod instanceof ArkMethod) {
                    let signature = foundMethod.matchMethodSignature(expr.getArgs());
                    TypeInference.inferSignatureReturnType(signature, foundMethod);
                    expr.setMethodSignature(signature);
                    return expr instanceof ArkInstanceInvokeExpr ? new ArkStaticInvokeExpr(signature, expr.getArgs(), expr.getRealGenericTypes()) : expr;
                }
            }
        } else if (baseType instanceof FunctionType) {
            return IRInference.inferInvokeExprWithFunction(methodName, expr, baseType, scene);
        } else if (baseType instanceof ArrayType) {
            return IRInference.inferInvokeExprWithArray(methodName, expr, baseType, scene);
        }
        return null;
    }
}

@Bind()
export class StaticInvokeExprInference extends InstanceInvokeExprInference {

    public getValueName(): string {
        return 'ArkStaticInvokeExpr';
    }

    public getMethodName(expr: AbstractInvokeExpr, arkMethod: ArkMethod): string {
        return expr.getMethodSignature().getMethodSubSignature().getMethodName();
    }

    public preInfer(value: ArkStaticInvokeExpr, stmt: Stmt | undefined): boolean {
        return IRInference.needInfer(value.getMethodSignature().getDeclaringClassSignature().getDeclaringFileSignature());
    }

    public infer(expr: ArkStaticInvokeExpr, stmt: Stmt): Value | undefined {
        const arkMethod = stmt.getCfg().getDeclaringMethod();
        const methodName = this.getMethodName(expr, arkMethod);
        // special case process
        if (methodName === IMPORT) {
            const arg = expr.getArg(0);
            let type;
            if (arg instanceof Constant) {
                type = TypeInference.inferDynamicImportType(arg.getValue(), arkMethod.getDeclaringArkClass());
            }
            if (type) {
                expr.getMethodSignature().getMethodSubSignature().setReturnType(type);
            }
            return undefined;
        } else if (methodName === SUPER_NAME) {
            const superCtor = arkMethod.getDeclaringArkClass().getSuperClass()?.getMethodWithName(CONSTRUCTOR_NAME);
            if (superCtor) {
                expr.setMethodSignature(superCtor.getSignature());
            }
            return undefined;
        }
        const baseType = this.getBaseType(expr, arkMethod);
        const result = baseType ? super.inferInvokeExpr(baseType, expr, arkMethod) :
            IRInference.inferStaticInvokeExprByMethodName(methodName, arkMethod, expr);
        return super.process(result, expr, stmt);
    }

    private getBaseType(expr: ArkStaticInvokeExpr, arkMethod: ArkMethod): Type | null {
        const className = expr.getMethodSignature().getDeclaringClassSignature().getClassName();
        if (className && className !== UNKNOWN_CLASS_NAME) {
            return TypeInference.inferBaseType(className, arkMethod.getDeclaringArkClass());
        }
        return null;
    }
}

@Bind()
export class ArkPtrInvokeExprInference extends StaticInvokeExprInference {
    public getValueName(): string {
        return 'ArkPtrInvokeExpr';
    }

    public infer(expr: ArkPtrInvokeExpr, stmt: Stmt): Value | undefined {
        const ptrType = expr.getFuncPtrLocal().getType();
        if (ptrType instanceof FunctionType) {
            expr.setMethodSignature(ptrType.getMethodSignature());
        }
        super.infer(expr, stmt);
        return undefined;
    }
}


@Bind()
export class ArkNewExprInference extends ValueInference<ArkNewExpr> {
    public getValueName(): string {
        return 'ArkNewExpr';
    }

    public preInfer(value: ArkNewExpr): boolean {
        return IRInference.needInfer(value.getClassType().getClassSignature().getDeclaringFileSignature());
    }

    public infer(value: ArkNewExpr, stmt: Stmt): Value | undefined {
        const className = value.getClassType().getClassSignature().getClassName();
        const arkMethod = stmt.getCfg().getDeclaringMethod();
        let type: Type | undefined | null = ModelUtils.findDeclaredLocal(new Local(className), arkMethod, 1)?.getType();
        if (TypeInference.isUnclearType(type)) {
            type = TypeInference.inferUnclearRefName(className, arkMethod.getDeclaringArkClass());
        }
        if (type instanceof AliasType) {
            const originType = TypeInference.replaceAliasType(type);
            if (originType instanceof FunctionType) {
                type = originType.getMethodSignature().getMethodSubSignature().getReturnType();
            } else {
                type = originType;
            }
        }
        if (type && type instanceof ClassType) {
            value.getClassType().setClassSignature(type.getClassSignature());
            TypeInference.inferRealGenericTypes(value.getClassType().getRealGenericTypes(), arkMethod.getDeclaringArkClass());
        }
        return undefined;
    }
}

@Bind()
export class ArkNewArrayExprInference extends ValueInference<ArkNewArrayExpr> {
    public getValueName(): string {
        return 'ArkNewArrayExpr';
    }

    public preInfer(value: ArkNewArrayExpr): boolean {
        return TypeInference.isUnclearType(value.getBaseType());
    }

    public infer(value: ArkNewArrayExpr, stmt: Stmt): Value | undefined {
        const type = TypeInference.inferUnclearedType(value.getBaseType(), stmt.getCfg().getDeclaringMethod().getDeclaringArkClass());
        if (type) {
            value.setBaseType(type);
        }
        return undefined;
    }
}


@Bind()
export class ArkNormalBinOpExprInference extends ValueInference<ArkNormalBinopExpr> {
    public getValueName(): string {
        return 'ArkNormalBinopExpr';
    }

    public preInfer(value: ArkNormalBinopExpr): boolean {
        return TypeInference.isUnclearType(value.getType());
    }

    public infer(value: ArkNormalBinopExpr): Value | undefined {
        value.setType();
        return undefined;
    }
}

@Bind()
export class ArkConditionExprInference extends ArkNormalBinOpExprInference {
    public getValueName(): string {
        return 'ArkConditionExpr';
    }

    public preInfer(value: ArkConditionExpr): boolean {
        return true;
    }

    public infer(value: ArkConditionExpr): Value | undefined {
        if (value.getOperator() === RelationalBinaryOperator.InEquality && value.getOp2() === ValueUtil.getOrCreateNumberConst(0)) {
            const op1Type = value.getOp1().getType();
            if (op1Type instanceof StringType) {
                value.setOp2(ValueUtil.createStringConst(EMPTY_STRING));
            } else if (op1Type instanceof BooleanType) {
                value.setOp2(ValueUtil.getBooleanConstant(false));
            } else if (op1Type instanceof ClassType) {
                value.setOp2(ValueUtil.getUndefinedConst());
            }
        }
        value.fillType();
        return undefined;
    }
}


@Bind()
export class ArkInstanceOfExprInference extends ValueInference<ArkInstanceOfExpr> {
    public getValueName(): string {
        return 'ArkInstanceOfExpr';
    }

    public preInfer(value: ArkInstanceOfExpr): boolean {
        return TypeInference.isUnclearType(value.getCheckType());
    }

    public infer(value: ArkInstanceOfExpr, stmt: Stmt): Value | undefined {
        const type = TypeInference.inferUnclearedType(value.getCheckType(), stmt.getCfg().getDeclaringMethod().getDeclaringArkClass());
        if (type) {
            value.setCheckType(type);
        }
        return undefined;
    }
}

@Bind()
export class ArkCastExprInference extends ValueInference<ArkCastExpr> {
    public getValueName(): string {
        return 'ArkCastExpr';
    }

    public preInfer(value: ArkCastExpr): boolean {
        return TypeInference.isUnclearType(value.getType());
    }

    public infer(value: ArkCastExpr, stmt: Stmt): Value | undefined {
        const arkClass = stmt.getCfg().getDeclaringMethod().getDeclaringArkClass();
        const type = TypeInference.inferUnclearedType(value.getType(), arkClass);
        if (type && !TypeInference.isUnclearType(type)) {
            IRInference.inferRightWithSdkType(type, value.getOp().getType(), arkClass);
            value.setType(type);
        } else if (!TypeInference.isUnclearType(value.getOp().getType())) {
            value.setType(value.getOp().getType());
        }
        return undefined;
    }
}


@Bind()
export class LocalInference extends ValueInference<Local> {
    public getValueName(): string {
        return 'Local';
    }

    public preInfer(value: Local): boolean {
        return TypeInference.isUnclearType(value.getType());
    }

    public infer(value: Local, stmt: Stmt): Value | undefined {
        // IRInference.inferAliasTypeExpr(value, stmt.getCfg().getDeclaringMethod());
        const name = value.getName();
        const arkClass = stmt.getCfg().getDeclaringMethod().getDeclaringArkClass();
        if (name === THIS_NAME) {
            value.setType(new ClassType(arkClass.getSignature(), arkClass.getRealTypes()));
            return undefined;
        }
        let newType;
        if (!name.startsWith(NAME_PREFIX)) {
            newType = ModelUtils.findDeclaredLocal(value, stmt.getCfg().getDeclaringMethod(), 1)?.getType() ??
                TypeInference.inferBaseType(name, arkClass);
        }
        if (newType) {
            value.setType(newType);
        }
        return undefined;
    }
}


@Bind(InferLanguage.ARK_TS1_1)
export class ArkTSFieldRefInference extends FieldRefInference {
    public preInfer(value: ArkInstanceFieldRef, stmt: Stmt): boolean {
        if (stmt.getDef() === value && this.isAnonClassThisRef(value, stmt.getCfg().getDeclaringMethod())) {
            return false;
        }
        return super.preInfer(value);
    }

    private isAnonClassThisRef(stmtDef: Value, arkMethod: ArkMethod): boolean {
        return (arkMethod.getName() === INSTANCE_INIT_METHOD_NAME || arkMethod.getName() === CONSTRUCTOR_NAME) &&
            stmtDef instanceof ArkInstanceFieldRef &&
            stmtDef.getBase().getName() === THIS_NAME &&
            arkMethod.getDeclaringArkClass().isAnonymousClass() &&
            stmtDef.getFieldName().indexOf('.') === -1
    }
}


@Bind(InferLanguage.ARK_TS1_1)
export class ArkTsInstanceInvokeExprInference extends InstanceInvokeExprInference {
    public infer(value: ArkInstanceInvokeExpr, stmt: Stmt): Value | undefined {
        const arkMethod = stmt.getCfg().getDeclaringMethod();
        TypeInference.inferRealGenericTypes(value.getRealGenericTypes(), arkMethod.getDeclaringArkClass());
        const result = super.inferInvokeExpr(value.getBase().getType(), value, arkMethod) ??
            IRInference.processExtendFunc(value, arkMethod, super.getMethodName(value, arkMethod));
        return super.process(result, value, stmt);
    }
}


@Bind(InferLanguage.ARK_TS1_1)
export class AliasTypeExprInference extends ValueInference<AliasTypeExpr> {
    public getValueName(): string {
        return 'AliasTypeExpr';
    }

    public preInfer(value: AliasTypeExpr): boolean {
        return value.getOriginalType() === undefined;
    }

    public infer(value: AliasTypeExpr, stmt: Stmt): Value | undefined {
        let originalObject = value.getOriginalObject();
        const arkMethod = stmt.getCfg().getDeclaringMethod();

        let type;
        let originalLocal;
        if (originalObject instanceof Local) {
            originalLocal = ModelUtils.findArkModelByRefName(originalObject.getName(), arkMethod.getDeclaringArkClass());
            if (AliasTypeExpr.isAliasTypeOriginalModel(originalLocal)) {
                originalObject = originalLocal;
            }
        }
        if (originalObject instanceof ImportInfo) {
            const arkExport = originalObject.getLazyExportInfo()?.getArkExport();
            const importClauseName = originalObject.getImportClauseName();
            if (importClauseName.includes('.') && arkExport instanceof ArkClass) {
                type = TypeInference.inferUnclearRefName(importClauseName, arkExport);
            } else if (arkExport) {
                type = TypeInference.parseArkExport2Type(arkExport);
            }
        } else if (originalObject instanceof Type) {
            type = TypeInference.inferUnclearedType(originalObject, arkMethod.getDeclaringArkClass());
        } else if (originalObject instanceof ArkField) {
            type = originalObject.getType();
        } else {
            type = TypeInference.parseArkExport2Type(originalObject);
        }
        if (type) {
            const realGenericTypes = value.getRealGenericTypes();
            if (TypeInference.checkType(type, t => t instanceof GenericType || t instanceof AnyType) && realGenericTypes && realGenericTypes.length > 0) {
                TypeInference.inferRealGenericTypes(realGenericTypes, arkMethod.getDeclaringArkClass());
                type = TypeInference.replaceTypeWithReal(type, realGenericTypes);
            }
            value.setOriginalType(type);
            if (AliasTypeExpr.isAliasTypeOriginalModel(originalLocal)) {
                value.setOriginalObject(originalLocal);
            }
        }
        return undefined;
    }
}


@Bind(InferLanguage.ARK_TS1_1)
export class ArkTSLocalInference extends LocalInference {
    public getValueName(): string {
        return 'Local';
    }

    public preInfer(value: Local): boolean {
        const type = value.getType();
        if (value.getName() === THIS_NAME && type instanceof ClassType &&
            type.getClassSignature().getClassName().startsWith(ANONYMOUS_CLASS_PREFIX)) {
            return true;
        } else if (type instanceof FunctionType) {
            return true;
        }
        return super.preInfer(value);
    }

    public infer(value: Local, stmt: Stmt): Value | undefined {
        const name = value.getName();
        const type = value.getType();
        const arkMethod = stmt.getCfg().getDeclaringMethod();
        let newType;
        if (name === THIS_NAME) {
            newType = IRInference.inferThisLocal(arkMethod)?.getType();
            if (newType) {
                value.setType(newType);
            }
            return undefined;
        } else if (type instanceof FunctionType) {
            const methodSignature = type.getMethodSignature();
            methodSignature.getMethodSubSignature().getParameters().forEach(p => TypeInference.inferParameterType(p, arkMethod));
            TypeInference.inferSignatureReturnType(methodSignature, arkMethod);
            return undefined;
        } else {
            newType = TypeInference.inferUnclearedType(type, arkMethod.getDeclaringArkClass());
        }
        if (newType) {
            value.setType(newType);
            return undefined;
        }
        return super.infer(value, stmt);
    }
}