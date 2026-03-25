import { ArkInstanceInvokeExpr } from "../../../core/base/Expr";
import { ArkAssignStmt, Stmt } from "../../../core/base/Stmt";
import { ArkMethod } from "../../../core/model/ArkMethod";
import { AccessPath } from "../AccessPath";
import { TaintFact } from "../TaintFact";
import { AbstractRule, FactKillingStatus } from "./Rule";

/**
 * 处理 x = taintedVar.invokeMethod() 的情况
 * 这里简单地将 x 设为污点
 * 要扩展更多策略, 参考 FlowDroid 的 TaintWrapper 和 WrapperPropagationRule
 */
export class TaintedInstanceInvokeRule extends AbstractRule{
    /**
     * @override
     */
    applyCallRule(srcStmt: Stmt, method: ArkMethod, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        const invokeExpr = srcStmt.getInvokeExpr();

        if (invokeExpr && invokeExpr instanceof ArkInstanceInvokeExpr) {
            // 若 base 是污点, 不进入 callee
            if (fact.getVariable().getBase() === invokeExpr.getBase()) {
                factKillingStatus.killAllFacts = true;
            }
        }
    }

    /**
     * @override
     */
    applyCallToReturnRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        if (!(srcStmt instanceof ArkAssignStmt)) {
            return;
        }

        const invokeExpr = srcStmt.getInvokeExpr();

        if (invokeExpr && invokeExpr instanceof ArkInstanceInvokeExpr) {
            // 若 base 是污点, 将 lhs 设为污点
            if (fact.getVariable().getBase() === invokeExpr.getBase()) {
                const lhs = srcStmt.getLeftOp();
                const newAP = AccessPath.createAccessPath(lhs);
                if (newAP) {
                    const newFact = fact.deriveWithNewAccessPath(newAP, srcStmt);
                    newFact && result.add(newFact);
                }
            }
        }
    }
}
