import { Local } from "../../../core/base/Local";
import { ArkArrayRef, ArkInstanceFieldRef } from "../../../core/base/Ref";
import { ArkAssignStmt, Stmt } from "../../../core/base/Stmt";
import { getBaseValues } from "../../util";
import { AccessPath } from "../AccessPath";
import { TaintFact } from "../TaintFact";
import { AbstractRule, FactKillingStatus } from "./Rule";

/**
 * 若赋值语句中 lhs 与 fact 有关, 判断是否杀死 fact
 */
export class LHSOverwrittenRule extends AbstractRule {
    /**
     * 处理赋值语句且 lhs 与 fact 有关的情况 
     */
    applyNormalRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        if (!(srcStmt instanceof ArkAssignStmt)) {
            return;
        }

        const lhs = srcStmt.getLeftOp();

        // 若 lhs 为数组引用, 如 a[i], 不杀死 fact, 因为不做 array sensitive
        if (lhs instanceof ArkArrayRef) {
            return;
        }

        // 不杀刚创建的未激活污点? 为什么不是: 不杀所有未激活的污点
        // if (!fact.isActive() && fact.getTaintingStmt() === srcStmt) {
        //     return;
        // }

        if (!fact.isActive()) {
            return;
        }

        // 不杀刚激活的污点
        if (fact.isActive() && fact.getActivationStmt() === srcStmt) {
            return;
        }

        if (fact.getVariable().isInstanceFieldRef()) {
            if (lhs instanceof ArkInstanceFieldRef) {
                // 不但要检查 fact 与 lhs 同名的情况 (如上一种情况), 还需检查别名污点 (aliases)
                if (fact.getVariable().isContainedByValue(lhs) ||
                    this.ifdsManager.getAliasing()?.mustAlias(lhs.getBase(), fact.getVariable().getBase()!)
                ) {
                    factKillingStatus.killAllFacts = true;
                }
            } else if (lhs instanceof Local) {
                // 同样要别名污点 (aliases)
                if (this.ifdsManager.getAliasing()?.mustAlias(lhs, fact.getVariable().getBase()!)) {
                    factKillingStatus.killAllFacts = true;
                }
            }
        } else if (fact.getVariable().isStaticFieldRef()) {
            // fact = X.f(.g), lhs = X.f, 不能再产生新污点
            if (AccessPath.staticFieldRefContainsAccessPath(lhs, fact.getVariable())) {
                factKillingStatus.killAllFacts = true;
            }
        } else if (fact.getVariable().isLocal()) {
            // 若 fact === lhs, 杀死当前污点
            if (fact.getVariable().getBase() === lhs) {
                factKillingStatus.killCurrFact = true;
                // 若 rhs 有 fact, 可能产生新污点, 不能 killAll, 否则可以
                if (getBaseValues(srcStmt.getRightOp()).every(use => use !== fact.getVariable().getBase())) {
                    factKillingStatus.killAllFacts = true;
                }
            }
        }
    }

    /**
     * 如果遇到赋值语句, 且 lhs 是 fact.base 
     */
    applyCallToReturnRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        if (srcStmt instanceof ArkAssignStmt && srcStmt.getLeftOp() === fact.getVariable().getBase()) {
            factKillingStatus.killCurrFact = true;
        }
    }
}
