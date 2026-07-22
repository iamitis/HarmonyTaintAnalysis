import { AbstractInvokeExpr, ArkInstanceInvokeExpr } from "../../../core/base/Expr";
import { Local } from "../../../core/base/Local";
import { ArkAssignStmt, Stmt } from "../../../core/base/Stmt";
import { FunctionType, LexicalEnvType } from "../../../core/base/Type";
import { ArkMethod } from "../../../core/model/ArkMethod";
import { MethodSignature } from "../../../core/model/ArkSignature";
import { MethodSourceDefinition } from "../../sourcesAndSinks/matchers/MethodMatcher";
import { AccessPath } from "../AccessPath";
import { TaintFact } from "../TaintFact";
import { AbstractRule, FactKillingStatus } from "./Rule";

/**
 * 处理特殊方法调用的规则, 如 Set.add, tainted.toString 等
 * 要扩展更多策略, 参考 FlowDroid 的 TaintWrapper 和 WrapperPropagationRule
 */
export class SpecialMethodRule extends AbstractRule {
    // TODO: 上下文敏感
    cbName2SourceDefMap: Map<string, MethodSignature> = new Map();

    /**
     * @override
     */
    applyCallRule(srcStmt: Stmt, method: ArkMethod, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        const invokeExpr = srcStmt.getInvokeExpr();
        if (!invokeExpr) {
            return;
        }

        if (invokeExpr instanceof ArkInstanceInvokeExpr && this.isLhsTaintedByBase(method.getSignature())) {
            if (fact.getAccessPath().isLocal() && fact.getAccessPath().getBase() === invokeExpr.getBase()) {
                factKillingStatus.killAllFacts = true;
            }
        }

        // 若是 sourceCallbackMethod.on((taintData) => {})
        // 注册 cbName -> call site
        const cbIndices = this.getIfIsCallbackTainted(invokeExpr, fact);
        cbIndices?.forEach(cbIdx => {
            const args = invokeExpr.getArgs();
            if (cbIdx >= args.length) {
                return;
            }
            const argType = invokeExpr.getArgs()[cbIdx]!.getType();
            if (argType instanceof FunctionType) {
                const cbName = argType.getMethodSignature().toString();
                this.cbName2SourceDefMap.set(cbName, invokeExpr.getMethodSignature());
            }
        });

        // 若是 map 中的 callback, 污染参数
        if (fact.isZeroFact() && this.cbName2SourceDefMap.has(method.getSignature().toString())) {
            method.getParameters().forEach(param => {
                if (param.getType() instanceof LexicalEnvType) {
                    // TODO: 处理闭包
                    return;
                }

                const paramLocal = method.getBody()?.getLocals().get(param.getName());
                if (paramLocal) {
                    const newAP = AccessPath.createAccessPath(paramLocal);
                    if (newAP) {
                        const newFact = new TaintFact(newAP, paramLocal, srcStmt);
                        const SourceDef = new MethodSourceDefinition(method.getSignature().toString(), [-1]);
                        newFact.setSourceDefinition(SourceDef);
                        newFact && result.add(newFact);
                    }
                }
            });
        }

        // 处理 taint.then((taintData) => {})
        // if (invokeExpr instanceof ArkInstanceInvokeExpr &&
        //     invokeExpr.getBase() === fact.getAccessPath().getBase() &&
        //     method.getSignature().getDeclaringClassSignature().getClassName() === 'Promise' &&
        //     method.getSubSignature().getMethodName() === 'then'
        // ) {
        //     const paramLocals: Local[] = [];
        //     method.getParameters().forEach(p => {
        //         method.getBody()?.getLocals()?.forEach(local => {
        //             local.getName() === p.getName() && paramLocals.push(local);
        //         });
        //     });
        //     paramLocals.forEach(pl => {
        //         const fields = [...fact.getAccessPath().getFields() ?? []];
        //         const newAP = AccessPath.createAccessPath(pl, fields);
        //         if (newAP) {
        //             const newFact = fact.deriveWithNewAccessPath(newAP, pl, srcStmt);
        //             newFact && result.add(newFact);
        //         }
        //     });
        // }
    }

    /**
     * @override
     */
    applyCallToReturnRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        const invokeExpr = srcStmt.getInvokeExpr();
        if (!invokeExpr) {
            return;
        }

        const methodSig = invokeExpr.getMethodSignature();

        // 参数污染 invoke.base
        if (invokeExpr instanceof ArkInstanceInvokeExpr && this.isBaseTaintedByArg(methodSig)) {
            const invokeBase = invokeExpr.getBase();
            invokeExpr.getArgs().forEach((arg) => {
                if (arg instanceof Local && arg === fact.getAccessPath().getBase()) {
                    const newAP = AccessPath.createAccessPath(invokeBase);
                    if (newAP) {
                        const newFact = fact.deriveWithNewAccessPath(newAP, invokeBase, srcStmt);
                        newFact && result.add(newFact);
                    }
                }
            });
        }

        // invoke.base 污染 lhs
        if (invokeExpr instanceof ArkInstanceInvokeExpr &&
            srcStmt instanceof ArkAssignStmt &&
            this.isLhsTaintedByBase(methodSig) &&
            invokeExpr.getBase() === fact.getAccessPath().getBase()
        ) {
            const lhs = srcStmt.getLeftOp();
            const newAP = AccessPath.createAccessPath(lhs);
            if (newAP) {
                const newFact = fact.deriveWithNewAccessPath(newAP, lhs, srcStmt);
                newFact && result.add(newFact);
            }
        }

        // 参数污染 lhs
        if (srcStmt instanceof ArkAssignStmt && this.isLhsTaintedByArg(methodSig)) {
            const lhs = srcStmt.getLeftOp();
            invokeExpr.getArgs().forEach((arg) => {
                if (arg instanceof Local && arg === fact.getAccessPath().getBase()) {
                    const newAP = AccessPath.createAccessPath(lhs);
                    if (newAP) {
                        const newFact = fact.deriveWithNewAccessPath(newAP, lhs, srcStmt);
                        newFact && result.add(newFact);
                    }
                }
            });
        }
    }

    // TODO: 将以下各个情况的 method 补充完整

    /**
     * 检查该 method 的 invokeBase 是否会被参数污染, 如 Map.set, Set.add
     */
    isBaseTaintedByArg(methodSig: MethodSignature): boolean {
        const methodName = methodSig.getMethodSubSignature().getMethodName();
        const className = methodSig.getDeclaringClassSignature().getClassName();
        const simpleSig = className + '.' + methodName;
        return [
            'Map.set',
            'Set.add',
        ].includes(simpleSig);
    }

    /**
     * 检查该 method 的 lhs 是否会被 base 污染, 如 Map.get, Map.has, toString
     */
    isLhsTaintedByBase(methodSig: MethodSignature): boolean {
        const methodName = methodSig.getMethodSubSignature().getMethodName();
        const className = methodSig.getDeclaringClassSignature().getClassName();
        const simpleSig = className + '.' + methodName;
        return (
            [
                'Map.get',
                'Map.has',
                'Set.has',
                'Iterator.next'
            ].includes(simpleSig) ||
            [
                'toString',
                'substring',
                'value'
            ].includes(methodName) ||
            methodName.includes('iterator')
        );
    }

    /**
     * 检查该 method 的 lhs 是否会被参数污染, 如 JSON.stringify, JSON.parse
     */
    isLhsTaintedByArg(methodSig: MethodSignature): boolean {
        const methodName = methodSig.getMethodSubSignature().getMethodName();
        const className = methodSig.getDeclaringClassSignature().getClassName();
        const simpleSig = className + '.' + methodName;
        return [
            'JSON.stringify',
            'JSON.parse',
        ].includes(simpleSig) ||
            className.includes('RegExp');
    }

    /**
     * 检查该 method 是否会污染回调参数, 如 connection.NetConnection.on('netAvailable', (taintData) => {})
     * 需要记录 cbName -> {paramIdx}
     */
    getIfIsCallbackTainted(invokeExpr: AbstractInvokeExpr, fact: TaintFact): number[] | undefined {
        const callbackInfo = CALLBACK_TAINTED_METHODS.get(invokeExpr.getMethodSignature().toString());
        if (callbackInfo) {
            if (callbackInfo.needBaseTainted &&
                (!(invokeExpr instanceof ArkInstanceInvokeExpr) || invokeExpr.getBase() !== fact.getAccessPath().getBase())
            ) {
                return undefined;
            } else {
                return callbackInfo.cbIndices;
            }
        }
        return undefined;
    }
}

/**
 * name -> callback 在参数中的位置
 */
const CALLBACK_TAINTED_METHODS = new Map<string, { needBaseTainted: boolean, cbIndices: number[] }>([
    [
        "@etsSdk/api/@ohos.net.connection.d.ts: connection.NetConnection.on('netAvailable', @etsSdk/api/@ohos.base.d.ts: Callback<@etsSdk/api/@ohos.net.connection.d.ts: connection.NetHandle>)",
        { needBaseTainted: false, cbIndices: [1] }
    ], [
        "@etsSdk/api/@ohos.net.connection.d.ts: connection.NetConnection.on('netUnavailable', @etsSdk/api/@ohos.base.d.ts: Callback<void>)",
        { needBaseTainted: false, cbIndices: [1] }
    ], [
        "@built-in/lib.es5.d.ts: Promise.then(@built-in/lib.es5.d.ts: Promise.%AM0(T)|undefined|null, @built-in/lib.es5.d.ts: Promise.%AM1(any)|undefined|null)",
        { needBaseTainted: true, cbIndices: [0, 1] }
    ], [
        "@etsSdk/api/@ohos.telephony.sim.d.ts: sim.%dflt.getSimAccountInfo(number, @etsSdk/api/@ohos.base.d.ts: AsyncCallback<@etsSdk/api/@ohos.telephony.sim.d.ts: sim.IccAccountInfo,void>)",
        { needBaseTainted: false, cbIndices: [1] }
    ], [
        "@etsSdk/api/@ohos.geoLocationManager.d.ts: geoLocationManager.%dflt.off('locationChange', @etsSdk/api/@ohos.base.d.ts: Callback<@etsSdk/api/@ohos.geoLocationManager.d.ts: geoLocationManager.Location>)",
        { needBaseTainted: false, cbIndices: [1] }
    ], [
        "@etsSdk/api/@ohos.net.http.d.ts: http.HttpRequest.request(string, @etsSdk/api/@ohos.net.http.d.ts: http.HttpRequestOptions, @etsSdk/api/@ohos.base.d.ts: AsyncCallback<@etsSdk/api/@ohos.net.http.d.ts: http.HttpResponse,void>)",
        { needBaseTainted: false, cbIndices: [2] }
    ], [
        "@ohos-axios/@ohos/axios/index.d.ts: AxiosInterceptorManager.use(@ohos-axios/@ohos/axios/index.d.ts: AxiosInterceptorManager.%AM0(V)|null, @ohos-axios/@ohos/axios/index.d.ts: AxiosInterceptorManager.%AM1(any)|null, @ohos-axios/@ohos/axios/index.d.ts: AxiosInterceptorOptions)",
        { needBaseTainted: false, cbIndices: [0, 1] }
    ], [
        "@etsSdk/api/@ohos.geoLocationManager.d.ts: geoLocationManager.%dflt.getAddressesFromLocation(@etsSdk/api/@ohos.geoLocationManager.d.ts: geoLocationManager.ReverseGeoCodeRequest, @etsSdk/api/@ohos.base.d.ts: AsyncCallback<@etsSdk/api/@ohos.geoLocationManager.d.ts: geoLocationManager.GeoAddress[],void>)",
        { needBaseTainted: false, cbIndices: [1] }
    ]
]);
