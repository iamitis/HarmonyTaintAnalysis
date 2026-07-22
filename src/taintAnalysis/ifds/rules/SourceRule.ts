import { ArkAssignStmt, Stmt } from "../../../core/base/Stmt";
import { Value } from "../../../core/base/Value";
import { ArkMethod } from "../../../core/model/ArkMethod";
import { AccessPath } from "../AccessPath";
import { TaintFact } from "../TaintFact";
import { AbstractRule, FactKillingStatus } from "./Rule";

/**
 * 处理遇到 source() 的情况
 */
export class SourceRule extends AbstractRule {
    // 测试用, 记录每个项目遇到的 source 方法数
    public static project2MetSourceNum: Map<string, number> = new Map();
    public static currProject: string = '';

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
        if (fact.isZeroFact()) {
            const sourceDefinition = this.getIfdsManager().getSourceSinkManager()?.getSourceIfIs(srcStmt);

            if (sourceDefinition) {
                const indices = sourceDefinition.getParamIndices?.() ?? [-1];
                indices.forEach((idx) => {
                    let taintedVar: Value | undefined = undefined;
                    if (idx === -1 && srcStmt instanceof ArkAssignStmt) {
                        taintedVar = srcStmt.getLeftOp();
                    } else {
                        taintedVar = srcStmt.getInvokeExpr()!.getArgs()[idx];
                        if (!taintedVar) {
                            return;
                        }
                    }

                    const newAP = AccessPath.createAccessPath(taintedVar);
                    if (newAP) {
                        const newFact = TaintFact.createSourceFact(newAP, taintedVar, sourceDefinition, srcStmt);
                        result.add(newFact);
                    }
                });

                SourceRule.project2MetSourceNum.set(SourceRule.currProject, (SourceRule.project2MetSourceNum.get(SourceRule.currProject) ?? 0) + 1);
            }
        }
    }

}
