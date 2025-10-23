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


import { ModifierType } from '../model/ArkBaseModel';
import { ArkFile } from '../model/ArkFile';
import { ArkAssignStmt, ArkReturnStmt, Stmt } from '../base/Stmt';
import { Value } from '../base/Value';
import { ArkModel, Inference, InferenceFlow, InferenceManager } from './Inference';
import Logger, { LOG_MODULE_TYPE } from '../../utils/logger';
import { ExportInfo } from '../model/ArkExport';
import { ImportInfo } from '../model/ArkImport';
import { fileSignatureCompare, NamespaceSignature } from '../model/ArkSignature';
import { findArkExport, findExportInfoInfile, ModelUtils } from '../common/ModelUtils';
import { ArkMethod } from '../model/ArkMethod';
import {
    AliasType,
    AnyType,
    ArrayType,
    ClassType,
    FunctionType,
    GenericType,
    IntersectionType,
    LiteralType,
    NullType,
    StringType,
    TupleType,
    Type,
    UnclearReferenceType,
    UndefinedType,
    UnionType,
    UnknownType
} from '../base/Type';
import { TypeInference } from '../common/TypeInference';
import { ArkStaticFieldRef, GlobalRef } from '../base/Ref';
import { CONSTRUCTOR_NAME, GLOBAL_THIS_NAME, PROMISE } from '../common/TSConst';
import { SdkUtils } from '../common/SdkUtils';
import { IRInference } from '../common/IRInference';
import { Local } from '../base/Local';
import { ANONYMOUS_CLASS_PREFIX, NAME_PREFIX } from '../common/Const';
import { ArkClass } from '../model/ArkClass';
import { ValueInference } from './ValueInference';
import { Builtin } from '../common/Builtin';
import { AbstractTypeExpr, KeyofTypeExpr } from '../base/TypeExpr';

const logger = Logger.getLogger(LOG_MODULE_TYPE.ARKANALYZER, 'ModelInference');


/**
 * Abstract base class for performing inference on ArkModel instances
 * Implements both Inference and InferenceFlow interfaces to provide
 * a complete inference workflow with pre/post processing capabilities
 */
abstract class ArkModelInference implements Inference, InferenceFlow {
    /**
     * Performs the core inference operation on the provided model
     * @abstract
     * @param model - The ArkModel instance to perform inference on
     * @returns Inference result
     */
    public abstract infer(model: ArkModel): any;

    /**
     * Executes the complete inference workflow with error handling
     * @param model - The ArkModel instance to process
     * @returns Inference result or undefined if an error occurs
     */
    public doInfer(model: ArkModel): any {
        try {
            this.preInfer(model);
            const result = this.infer(model);
            return this.postInfer(model, result);
        } catch (error) {
            logger.warn('infer model failed:' + (error as Error).message);
        }
    }

    /**
     * Pre-inference hook method for setup and preparation
     * Can be overridden by subclasses to add custom pre-processing logic
     * @param model - The ArkModel instance being processed
     */
    public preInfer(model: ArkModel): void {
        // Default implementation does nothing
        // Subclasses can override to add pre-inference logic
    }

    /**
     * Post-inference hook method for cleanup and finalization
     * Can be overridden by subclasses to add custom post-processing logic
     * @param model - The ArkModel instance that was processed
     * @param result
     */
    public postInfer(model: ArkModel, result?: any): any {
        // Default implementation does nothing
        // Subclasses can override to add post-inference logic
    }
}

export class ImportInfoInference extends ArkModelInference {
    protected fromFile: ArkFile | null = null;

    /**
     * get arkFile and assign to from file
     * @param fromInfo
     */
    public preInfer(fromInfo: ImportInfo): void {
        throw new Error('Subclasses must override');
    }

    public infer(fromInfo: ImportInfo): ExportInfo | null {
        const file = this.fromFile;
        if (!file) {
            logger.warn(`${fromInfo.getOriginName()} ${fromInfo.getFrom()} file not found: ${fromInfo.getDeclaringArkFile()?.getFileSignature()?.toString()}`);
            return null;
        }
        if (fileSignatureCompare(file.getFileSignature(), fromInfo.getDeclaringArkFile().getFileSignature())) {
            for (let exportInfo of file.getExportInfos()) {
                if (exportInfo.getOriginName() === fromInfo.getOriginName()) {
                    exportInfo.setArkExport(file.getDefaultClass());
                    return exportInfo;
                }
            }
            return null;
        }
        let exportInfo = findExportInfoInfile(fromInfo, file) || null;
        if (exportInfo === null) {
            logger.warn('export info not found, ' + fromInfo.getFrom() + ' in file: ' + fromInfo.getDeclaringArkFile().getFileSignature().toString());
            return null;
        }
        const arkExport = findArkExport(exportInfo);
        exportInfo.setArkExport(arkExport);
        if (arkExport) {
            exportInfo.setExportClauseType(arkExport.getExportType());
        }

        return exportInfo;
    }

    /**
     * cleanup fromFile and exportInfo
     * @param fromInfo
     * @param exportInfo
     */
    public postInfer(fromInfo: ImportInfo, exportInfo: ExportInfo | null): void {
        if (exportInfo) {
            fromInfo.setExportInfo(exportInfo);
        }
        this.fromFile = null;
    }
}

export class FileInference extends ArkModelInference {
    private importInfoInference: ImportInfoInference;
    private classInference: ClassInference;

    constructor(importInfoInference: ImportInfoInference, classInference: ClassInference) {
        super();
        this.importInfoInference = importInfoInference;
        this.classInference = classInference;
    }

    public getClassInference(): ClassInference {
        return this.classInference;
    }

    public preInfer(file: ArkFile): void {
        file.getImportInfos().filter(i => i.getExportInfo() === undefined)
            .forEach(info => this.importInfoInference.doInfer(info));

    }

    public infer(file: ArkFile): void {
        ModelUtils.getAllClassesInFile(file).forEach(arkClass => this.classInference.doInfer(arkClass));
    }
}

export class ClassInference extends ArkModelInference {
    private methodInference: MethodInference;

    constructor(methodInference: MethodInference) {
        super();
        this.methodInference = methodInference;
    }

    public getMethodInference(): MethodInference {
        return this.methodInference;
    }

    public preInfer(arkClass: ArkClass): void {
        arkClass.getAllHeritageClasses();
    }

    public infer(arkClass: ArkClass): void {
        arkClass.getMethods(true).forEach(method => this.methodInference.doInfer(method));
    }
}

interface InferStmtResult {
    oldStmt: Stmt;
    replacedStmts?: Stmt[];
    impactedStmts?: Stmt[];
}

export class MethodInference extends ArkModelInference {
    private stmtInference: StmtInference;

    constructor(stmtInference: StmtInference) {
        super();
        this.stmtInference = stmtInference;
    }

    public infer(method: ArkMethod): InferStmtResult[] {
        const modifiedStmts: InferStmtResult[] = [];
        const body = method.getBody();
        if (!body) {
            return modifiedStmts;
        }
        //useGolbals
        body.getUsedGlobals()?.forEach((value, key) => {
            if (value instanceof GlobalRef && !value.getRef()) {
                const arkExport = ModelUtils.findGlobalRef(key, method);
                if (arkExport instanceof Local) {
                    arkExport.getUsedStmts().push(...value.getUsedStmts());
                    value.setRef(arkExport);
                }
            }
        });

        const workList = body.getCfg().getStmts();
        while (workList.length > 0) {
            const stmt = workList.shift();
            if (!stmt) {
                continue;
            }
            const result = this.stmtInference.doInfer(stmt);
            if (!result) {
                continue;
            }
            const inferResult = result as InferStmtResult;
            if (inferResult.replacedStmts) {
                modifiedStmts.push(inferResult);
            }
            inferResult.impactedStmts?.filter(s => s !== stmt && !workList.includes(s)).forEach(e => workList.push(e));
        }
        return modifiedStmts;
    }

    public postInfer(method: ArkMethod, modifiedStmts: InferStmtResult[]): void {
        const cfg = method.getCfg();
        if (modifiedStmts.length > 0 && cfg) {
            modifiedStmts.forEach(m => {
                cfg.insertAfter(m.replacedStmts!, m.oldStmt);
                cfg.remove(m.oldStmt);
            });
        }
        if (!method.getBody() || method.getName() === CONSTRUCTOR_NAME ||
            !TypeInference.isUnclearType(method.getImplementationSignature()?.getMethodSubSignature().getReturnType())) {
            return;
        }
        const returnType = TypeInference.inferReturnType(method);
        if (returnType) {
            method.getImplementationSignature()?.getMethodSubSignature().setReturnType(returnType);
        }
    }
}


export class StmtInference extends ArkModelInference {
    private valueInferences: Map<string, ValueInference<any>>;

    constructor(valueInferences: ValueInference<any>[]) {
        super();
        this.valueInferences = new Map();
        valueInferences.forEach(v => this.valueInferences.set(v.getValueName(), v));
    }

    public infer(stmt: Stmt): Type | undefined {
        const defType = stmt.getDef()?.getType();
        stmt.getDefAndUses().forEach(value => this.inferValue(value, stmt));
        return defType;
    }

    public postInfer(stmt: Stmt, defType: Type | undefined): InferStmtResult | undefined {
        const method = stmt.getCfg().getDeclaringMethod();
        const impactedStmts = this.typeSpread(stmt, method);
        const finalDef = stmt.getDef();
        if (defType !== finalDef?.getType() && finalDef instanceof Local &&
            (method.getBody()?.getUsedGlobals()?.get(finalDef.getName()) || !finalDef.getName().startsWith(NAME_PREFIX))) {
            finalDef.getUsedStmts().forEach(e => impactedStmts.push(e));
        }
        return impactedStmts.length > 0 ? { oldStmt: stmt, impactedStmts: impactedStmts } : undefined;
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

    private inferValue(value: Value, stmt: Stmt, visited: Set<Value> = new Set()): void {
        if (visited.has(value)) {
            return;
        } else {
            visited.add(value);
        }
        const name = value.constructor.name;
        const valueInference = this.valueInferences.get(name);
        if (!valueInference) {
            logger.debug(name + ' valueInference not found');
            return;
        }
        const type = value.getType();
        if (type instanceof AbstractTypeExpr) {
            type.getUses().forEach(sub => this.inferValue(sub, stmt, visited));
        }
        value.getUses().forEach(sub => this.inferValue(sub, stmt, visited));
        valueInference.doInfer(value, stmt);
    }

    public isTypeCanBeOverride(type: Type): boolean {
        if (type instanceof UnknownType || type instanceof NullType || type instanceof UndefinedType
            || type instanceof UnclearReferenceType || type instanceof GenericType || type instanceof FunctionType) {
            return true;
        } else if (type instanceof ClassType) {
            return !!type.getRealGenericTypes()?.find(r => this.isTypeCanBeOverride(r));
        } else if (type instanceof AliasType) {
            return this.isTypeCanBeOverride(type.getOriginalType()) || !!type.getRealGenericTypes()?.find(r => this.isTypeCanBeOverride(r));
        } else if (type instanceof ArrayType) {
            return TypeInference.checkType(type.getBaseType(), t => t instanceof UnclearReferenceType || t instanceof GenericType);
        }
        return false;
    }

    public union(type1: Type, type2: Type): Type {
        const leftType = TypeInference.replaceAliasType(type1);
        const rightType = TypeInference.replaceAliasType(type2);
        if (this.isSameType(leftType, rightType) || TypeInference.checkType(rightType, t => t instanceof AnyType ||
            (rightType instanceof ClassType && rightType.getClassSignature().getClassName().startsWith(ANONYMOUS_CLASS_PREFIX)))) {
            return type1;
        } else if (leftType instanceof UnionType) {
            const isExist = leftType.getTypes().find(t => this.isSameType(t, rightType));
            if (isExist) {
                return type1;
            }
        } else if (leftType instanceof IntersectionType) {
            const isExist = leftType.getTypes().find(t => !this.isSameType(t, rightType));
            if (!isExist) {
                return type1;
            }
        }
        return new UnionType([type1, type2]);
    }

    private isSameType(type1: Type, type2: Type): boolean {
        if (type1 instanceof ClassType && type2 instanceof ClassType) {
            return type1.getClassSignature() === type2.getClassSignature();
        } else if (type1 instanceof LiteralType) {
            return typeof type1.getLiteralName() === type2.toString();
        } else if (type1 instanceof KeyofTypeExpr) {
            return type2 instanceof KeyofTypeExpr || type2 instanceof StringType;
        } else if (type1 instanceof TupleType) {
            return type2 instanceof TupleType || type2 instanceof ArrayType;
        }
        return type1.constructor === type2.constructor;
    }

    public typeSpread(stmt: Stmt, method: ArkMethod): Stmt[] {
        const impactedStmts: Stmt[] = [];
        const invokeExpr = stmt.getInvokeExpr();
        if (invokeExpr) {
            const scene = method.getDeclaringArkFile().getScene();
            const parameters = invokeExpr.getMethodSignature().getMethodSubSignature().getParameters();
            let realTypes: Type[] = [];
            const len = invokeExpr.getArgs().length;
            for (let index = 0; index < len; index++) {
                const arg = invokeExpr.getArg(index);
                if (index >= parameters.length) {
                    break;
                }
                const argType = arg.getType();
                const paramType = parameters[index].getType();
                IRInference.inferArg(invokeExpr, argType, paramType, scene, realTypes);
                if (argType instanceof FunctionType) {
                    const callBack = scene.getMethod(argType.getMethodSignature());
                    if (callBack && callBack.getBody()) {
                        this.invokeCallBack(callBack, new Set([method]));
                    }
                } else if (argType instanceof ClassType && argType.getClassSignature().getClassName().startsWith(ANONYMOUS_CLASS_PREFIX) &&
                    !TypeInference.isUnclearType(paramType) && arg instanceof Local) {
                    if (scene.getOptions().isScanAbc) {
                        arg.setType(paramType);
                        arg.getUsedStmts().forEach(e => impactedStmts.push(e));
                    }
                }
            }
            if (realTypes.length > 0 && !invokeExpr.getRealGenericTypes()) {
                invokeExpr.setRealGenericTypes(realTypes);
            }
        }
        if (stmt instanceof ArkAssignStmt) {
            const rightType = stmt.getRightOp().getType();
            const leftOp = stmt.getLeftOp();
            let leftType = leftOp.getType();
            if (!TypeInference.isUnclearType(rightType) || (rightType instanceof ClassType &&
                rightType.getClassSignature().getDeclaringFileSignature().getFileName() === Builtin.DUMMY_FILE_NAME &&
                rightType.getRealGenericTypes()?.find(t => !(t instanceof GenericType)))) {
                if (this.isTypeCanBeOverride(leftType)) {
                    leftType = rightType;
                } else {
                    leftType = this.union(leftType, rightType);
                }
                TypeInference.setValueType(leftOp, leftType);
            }
            if (leftOp instanceof ArkStaticFieldRef) {
                const declaringSignature = leftOp.getFieldSignature().getDeclaringSignature();
                if (declaringSignature instanceof NamespaceSignature && declaringSignature.getNamespaceName() === GLOBAL_THIS_NAME) {
                    SdkUtils.computeGlobalThis(leftOp, method);
                }
            }
            if (!TypeInference.isUnclearType(leftType)) {
                IRInference.inferRightWithSdkType(leftType, rightType, method.getDeclaringArkClass());
            }
        } else if (stmt instanceof ArkReturnStmt) {
            let returnType = method.getSignature().getType();
            if (method.containsModifier(ModifierType.ASYNC) && returnType instanceof ClassType && returnType.getClassSignature().getClassName() === PROMISE) {
                const realGenericType = returnType.getRealGenericTypes()?.[0];
                if (realGenericType) {
                    returnType = realGenericType;
                }
            }
            IRInference.inferRightWithSdkType(returnType, stmt.getOp().getType(), method.getDeclaringArkClass());
        }

        return impactedStmts;
    }

}