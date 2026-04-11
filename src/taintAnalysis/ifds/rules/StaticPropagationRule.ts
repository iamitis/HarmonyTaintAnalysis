import { Stmt } from "../../../core/base/Stmt";
import { ArkMethod } from "../../../core/model/ArkMethod";
import { StaticFieldTrackingMode } from "../../config/IFDSConfig";
import { TaintFact } from "../TaintFact";
import { AbstractRule, FactKillingStatus } from "./Rule";

/**
 * 静态字段传播规则
 * 参考 FlowDroid StaticPropagationRule.java
 * 
 * 处理静态字段在 call/return/callToReturn 边上的传播逻辑：
 * - Call flow: 静态字段 fact 传入 callee（ContextFlowSensitive 模式下）
 * - Return flow: 静态字段 fact 从 callee 传回 caller
 * - CallToReturn flow: 若 mode == None 则杀死静态字段 fact
 */
export class StaticPropagationRule extends AbstractRule {

    /**
     * Normal flow 无需处理
     */
    applyNormalRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        // nothing to do here
    }

    /**
     * Call flow: 将静态字段 fact 传入 callee
     * 
     * 在 ContextFlowSensitive 模式下，静态字段 fact 需要通过 call edge 进入 callee，
     * 以保证上下文敏感性。若 callee 中不读取该静态字段，可以跳过传播（优化）。
     */
    applyCallRule(srcStmt: Stmt, method: ArkMethod, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        const staticFieldMode = this.ifdsManager.getConfig().staticFieldTrackingMode;

        // 若静态字段追踪被禁用，杀死静态字段 fact
        if (staticFieldMode === StaticFieldTrackingMode.None) {
            if (fact.getAccessPath().isStaticFieldRef()) {
                factKillingStatus.killAllFacts = true;
                return;
            }
        }

        const ap = fact.getAccessPath();
        if (ap.isStaticFieldRef()) {
            // 检查 callee 是否读取了该静态字段
            const firstField = ap.getFields()?.[0];
            if (firstField && this.ifdsManager.isStaticFieldRead(method, firstField)) {
                result.add(fact);
            }
        }
    }

    /**
     * Return flow: 将静态字段 fact 从 callee 传回 caller
     * 
     * 静态字段不绑定到任何 Local，因此 return 边需要直接传回。
     */
    applyReturnRule(srcStmt: Stmt, tgtStmt: Stmt, callStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        if (!fact.getAccessPath().isStaticFieldRef()) {
            return;
        }

        const staticFieldMode = this.ifdsManager.getConfig().staticFieldTrackingMode;

        // 若静态字段追踪被禁用，杀死
        if (staticFieldMode === StaticFieldTrackingMode.None) {
            factKillingStatus.killAllFacts = true;
            return;
        }

        // 直接将静态字段 fact 传回 caller
        result.add(fact);
    }

    /**
     * CallToReturn flow: 处理静态字段 fact 在 call-to-return 边上的行为
     * 
     * 在 ContextFlowSensitive 模式下，静态字段 fact 不能走 call-to-return 边直通，
     * 必须走 call -> return 边以保证上下文敏感性。
     * 若 mode == None，则杀死静态字段 fact。
     */
    applyCallToReturnRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        if (this.ifdsManager.getConfig().staticFieldTrackingMode === StaticFieldTrackingMode.None
            && fact.getAccessPath().isStaticFieldRef()) {
            factKillingStatus.killAllFacts = true;
        }
    }
}
