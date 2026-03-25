import { ArkAssignStmt, Stmt } from "../../../core/base/Stmt";
import { ArkMethod } from "../../../core/model/ArkMethod";
import { AccessPath } from "../AccessPath";
import { TaintFact } from "../TaintFact";
import { AbstractRule, FactKillingStatus } from "./Rule";

/**
 * 处理遇到 source() 的情况
 */
export class SourceRule extends AbstractRule {
    /**
     * 如果遇到 source()，则杀死所有 fact
     * @override
     */
    applyCallRule(srcStmt: Stmt, method: ArkMethod, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        if (this.getIfdsManager().getSourceSinkManager()?.getSourceIfIs(srcStmt)) {
            factKillingStatus.killAllFacts = true;
        }
    }

    /**
     * 如果遇到赋值语句且 rhs 是 source 方法调用, 污染 lhs
     * @override
     */
    applyCallToReturnRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        if (fact.isZeroFact() && srcStmt instanceof ArkAssignStmt) {
            const sourceDefinition = this.getIfdsManager().getSourceSinkManager()?.getSourceIfIs(srcStmt);

            if (sourceDefinition) {
                const newAP = AccessPath.createAccessPath(srcStmt.getLeftOp());
                if (newAP) {
                    const newFact = TaintFact.createSourceFact(newAP, sourceDefinition, srcStmt);
                    result.add(newFact);
                }
            }
        }
    }

}
