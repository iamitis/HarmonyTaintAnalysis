import { ArkInstanceInvokeExpr } from "../../../core/base/Expr";
import { Local } from "../../../core/base/Local";
import { ArkAssignStmt, Stmt } from "../../../core/base/Stmt";
import { ArkMethod } from "../../../core/model/ArkMethod";
import { MethodSignature } from "../../../core/model/ArkSignature";
import { AccessPath } from "../AccessPath";
import { TaintFact } from "../TaintFact";
import { AbstractRule, FactKillingStatus } from "./Rule";

/**
 * 处理特殊方法调用的规则, 如 Set.add, tainted.toString 等
 * 要扩展更多策略, 参考 FlowDroid 的 TaintWrapper 和 WrapperPropagationRule
 */
export class SpecialMethodRule extends AbstractRule {

    /**
     * @override
     */
    applyCallRule(srcStmt: Stmt, method: ArkMethod, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        const invokeExpr = srcStmt.getInvokeExpr();
        if (!invokeExpr) {
            return;
        }

        if (invokeExpr && invokeExpr instanceof ArkInstanceInvokeExpr) {
            // 若 base 是污点, 不进入 callee
            if (fact.getAccessPath().isLocal() && fact.getAccessPath().getBase() === invokeExpr.getBase()) {
                factKillingStatus.killAllFacts = true;
            }
        }
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
}
