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
import { ClassType, FunctionType, GenericType, Type, VoidType } from '../base/Type';
import { TypeInference } from '../common/TypeInference';
import { AbstractFieldRef, ArkParameterRef, ArkStaticFieldRef, GlobalRef } from '../base/Ref';
import { CONSTRUCTOR_NAME, GLOBAL_THIS_NAME, PROMISE } from '../common/TSConst';
import { SdkUtils } from '../common/SdkUtils';
import { IRInference } from '../common/IRInference';
import { Local } from '../base/Local';
import { LEXICAL_ENV_NAME_PREFIX, NAME_PREFIX } from '../common/Const';
import { ArkClass } from '../model/ArkClass';
import { ValueInference } from './ValueInference';
import { AbstractTypeExpr } from '../base/TypeExpr';
import { AbstractInvokeExpr } from '../base/Expr';

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
        return;
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
        arkClass.getMethods(true).forEach(method => {
            this.methodInference.doInfer(method);
        });
    }
}

interface InferStmtResult {
    oldStmt: Stmt;
    replacedStmts?: Stmt[];
    impactedStmts?: Stmt[];
}

export class MethodInference extends ArkModelInference {
    private stmtInference: StmtInference;
    private visited: Set<ArkMethod> | undefined;

    constructor(stmtInference: StmtInference) {
        super();
        this.stmtInference = stmtInference;
    }

    public setVisitBegin(method: ArkMethod): void {
        this.visited = new Set<ArkMethod>();
        this.visited.add(method);
    }

    public cleanVisited(): void {
        this.visited = undefined;
    }

    public infer(method: ArkMethod): InferStmtResult[] {
        const modifiedStmts: InferStmtResult[] = [];
        if (this.visited) {
            if (this.visited.has(method)) {
                return modifiedStmts;
            } else {
                this.visited.add(method);
            }
        }
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
        const globals = stmt.getCfg().getDeclaringMethod().getBody()?.getUsedGlobals();
        stmt.getDefAndUses().forEach(value => {
            this.inferValue(value, stmt);
            if (globals && value instanceof Local) {
                this.addGlobalUsedStmts(globals, value);
            }
        });
        return defType;
    }

    public postInfer(stmt: Stmt, defType: Type | undefined): InferStmtResult | undefined {
        const method = stmt.getCfg().getDeclaringMethod();
        const impactedStmts = this.typeSpread(stmt, method);
        const finalDef = stmt.getDef();
        if (defType !== finalDef?.getType() && finalDef instanceof Local &&
            (method.getBody()?.getUsedGlobals()?.get(finalDef.getName()) || !finalDef.getName().startsWith(NAME_PREFIX))) {
            finalDef.getUsedStmts().forEach(e => impactedStmts.add(e));
        }
        return impactedStmts.size > 0 ? { oldStmt: stmt, impactedStmts: Array.from(impactedStmts) } : undefined;
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

    private addGlobalUsedStmts(globals: Map<string, Value>, value: Local): void {
        const globalRef = globals.get(value.getName());
        if (globalRef instanceof GlobalRef) {
            const ref = globalRef.getRef();
            if (ref instanceof Local) {
                const set = new Set(ref.getUsedStmts());
                value.getUsedStmts().filter(f => !set.has(f)).forEach(stmt => ref.addUsedStmt(stmt));
            }
        }
    }

    public typeSpread(stmt: Stmt, method: ArkMethod): Set<Stmt> {
        let impactedStmts: Set<Stmt>;
        const invokeExpr = stmt.getInvokeExpr();
        if (invokeExpr) {
            impactedStmts = this.paramSpread(invokeExpr, method);
        } else {
            impactedStmts = new Set<Stmt>();
        }
        if (stmt instanceof ArkAssignStmt) {
            this.transferTypeBidirectional(stmt, method, impactedStmts);
        } else if (stmt instanceof ArkReturnStmt) {
            let returnType = method.getSignature().getType();
            if (method.containsModifier(ModifierType.ASYNC) && returnType instanceof ClassType
                && returnType.getClassSignature().getClassName() === PROMISE) {
                const realGenericType = returnType.getRealGenericTypes()?.[0];
                if (realGenericType) {
                    returnType = realGenericType;
                }
            }
            IRInference.inferRightWithSdkType(returnType, stmt.getOp().getType(), method.getDeclaringArkClass());
        }

        return impactedStmts;
    }

    private transferTypeBidirectional(stmt: ArkAssignStmt, method: ArkMethod, impactedStmts: Set<Stmt>) {
        const rightType = stmt.getRightOp().getType();
        const leftOp = stmt.getLeftOp();
        let leftType = leftOp.getType();
        //transfer type from left to right
        this.transferLeft2Right(stmt.getRightOp(), leftType, method)?.forEach(a => impactedStmts.add(a));
        //transfer type from right to left
        this.transferRight2Left(leftOp, rightType, method)?.forEach(a => impactedStmts.add(a));
        // collect global this
        if (leftOp instanceof ArkStaticFieldRef) {
            const declaringSignature = leftOp.getFieldSignature().getDeclaringSignature();
            if (declaringSignature instanceof NamespaceSignature && declaringSignature.getNamespaceName() === GLOBAL_THIS_NAME) {
                SdkUtils.computeGlobalThis(leftOp, method);
            }
        }
    }

    public transferLeft2Right(rightOp: Value, leftType: Type, method: ArkMethod): Stmt[] | undefined {
        const projectName = method.getDeclaringArkFile().getProjectName();
        if (TypeInference.isUnclearType(leftType) || TypeInference.isAnonType(leftType, projectName)) {
            return undefined;
        }
        const rightType = rightOp.getType();
        IRInference.inferRightWithSdkType(leftType, rightType, method.getDeclaringArkClass());
        if (TypeInference.isUnclearType(rightType)) {
            return this.updateValueType(rightOp, leftType, method);
        }
        return undefined;
    }

    public transferRight2Left(leftOp: Value, rightType: Type, method: ArkMethod): Stmt[] | undefined {
        const projectName = method.getDeclaringArkFile().getProjectName();
        if (TypeInference.isUnclearType(rightType) || TypeInference.isAnonType(rightType, projectName)) {
            return undefined;
        }
        const leftType = leftOp.getType();
        if (TypeInference.isUnclearType(leftType) || TypeInference.isAnonType(leftType, projectName)) {
            return this.updateValueType(leftOp, rightType, method);
        }
        return undefined;
    }

    public updateValueType(target: Value, srcType: Type, method: ArkMethod): Stmt[] | undefined {
        if (target instanceof Local) {
            target.setType(srcType);
            return target.getUsedStmts();
        } else if (target instanceof AbstractFieldRef) {
            target.getFieldSignature().setType(srcType);
        } else if (target instanceof ArkParameterRef) {
            target.setType(srcType);
        }
    }

    private paramSpread(invokeExpr: AbstractInvokeExpr, method: ArkMethod): Set<Stmt> {
        // init realTypes from base
        const realTypes: Type[] = [];
        // if (invokeExpr instanceof ArkInstanceInvokeExpr) {
        //     const baseType = invokeExpr.getBase().getType();
        //     if (baseType instanceof ClassType || baseType instanceof AliasType) {
        //         baseType.getRealGenericTypes()?.forEach(t => realTypes.push(t));
        //     } else if (baseType instanceof ArrayType) {
        //         realTypes.push(baseType.getBaseType());
        //     }
        // }
        // infer arg with param, collect into realTypes
        const result: Set<Stmt> = new Set();
        const len = invokeExpr.getArgs().length;
        const parameters = invokeExpr.getMethodSignature().getMethodSubSignature().getParameters()
            .filter(p => !p.getName().startsWith(LEXICAL_ENV_NAME_PREFIX));
        for (let index = 0; index < len; index++) {
            const arg = invokeExpr.getArg(index);
            if (index >= parameters.length) {
                break;
            }
            const paramType = parameters[index].getType();
            this.mapArgWithParam(arg, paramType, invokeExpr, method, realTypes)?.forEach(a => result.add(a));
        }
        //setRealGenericTypes
        if (realTypes.length > 0 && !invokeExpr.getRealGenericTypes()) {
            invokeExpr.setRealGenericTypes(realTypes);
        }
        return result;
    }

    private mapArgWithParam(arg: Value, paramType: Type, invokeExpr: AbstractInvokeExpr, method: ArkMethod, realTypes: Type[]): Stmt[] | undefined {
        const argType = arg.getType();
        const scene = method.getDeclaringArkFile().getScene();
        //infer arg with param
        IRInference.inferArg(invokeExpr, argType, paramType, scene, realTypes);
        // infer callback function
        if (argType instanceof FunctionType) {
            const callback = scene.getMethod(argType.getMethodSignature());
            const paramLength = callback?.getImplementationSignature()?.getParamLength();
            if (callback && paramLength && paramLength > 0) {
                const inference = InferenceManager.getInstance().getInference(callback.getDeclaringArkFile().getLanguage());
                if (inference instanceof FileInference) {
                    const methodInference = inference.getClassInference().getMethodInference();
                    methodInference.setVisitBegin(method);
                    methodInference.doInfer(callback);
                    methodInference.cleanVisited();
                }
            }
            // infer map function return type
            const returnType = argType.getMethodSignature().getMethodSubSignature().getReturnType();
            if (!TypeInference.isUnclearType(returnType) && !(returnType instanceof VoidType) && paramType instanceof FunctionType) {
                const declareReturnType = paramType.getMethodSignature().getMethodSubSignature().getReturnType();
                const realGenericTypes = invokeExpr.getRealGenericTypes();
                if (declareReturnType instanceof GenericType && realGenericTypes && !realGenericTypes[declareReturnType.getIndex()]) {
                    realGenericTypes[declareReturnType.getIndex()] = returnType;
                }
            }
        }
        // if arg type updated, collect used stmts
        if (!TypeInference.isUnclearType(paramType) && arg instanceof Local) {
            if (TypeInference.isUnclearType(argType)) {
                arg.setType(paramType);
                return arg.getUsedStmts();
            } else if (TypeInference.isAnonType(argType, scene.getProjectName())) {
                return arg.getUsedStmts();
            }
        }
    }


}