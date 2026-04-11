import { Local } from "../../../core/base/Local";
import { ArkArrayRef, ArkInstanceFieldRef } from "../../../core/base/Ref";
import { ArkAssignStmt, Stmt } from "../../../core/base/Stmt";
import { Value } from "../../../core/base/Value";
import { FieldSignature } from "../../../core/model/ArkSignature";
import { getBaseValues } from "../../util";
import { AccessPath } from "../AccessPath";
import { Aliasing } from "../aliasing/Aliasing";
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

        const taintedAP = fact.getAccessPath();

        if (!fact.isActive()) {
            if (fact.getTaintingStmt() === srcStmt) {
                return;
            }

            // 目前仅考虑实例字段型污点
            if (taintedAP.isInstanceFieldRef() && lhs instanceof ArkInstanceFieldRef) {

                if (lhs.getBase() === taintedAP.getBase() &&
                    lhs.getFieldSignature() === taintedAP.getFields()![0]
                ) {
                    factKillingStatus.killAllFacts = true;
                }
            }
        } else {
            // 已激活污点
            // 不杀刚激活的污点
            if (fact.getActivationStmt() === srcStmt) {
                return;
            }

            const aliasing = this.ifdsManager.getAliasing();

            if (taintedAP.isInstanceFieldRef()) {
                if (lhs instanceof ArkInstanceFieldRef) {
                    if (fact.getAccessPath().isContainedByValue(lhs)) {
                        // 若 fact 是 lhs 或 lhs 的字段, 杀死
                        factKillingStatus.killAllFacts = true;
                    } else {
                        // 若 fact 别名 lhs.base, 杀死
                        // 由于 mustAlias 暂不具备查看特定 stmt 下的别名关系, 暂时无法处理别名的情况 
                        // const vars: Value[] = [fact.getAccessPath().getBase()!];
                        // const taintedVar = fact.getTaintedVar();
                        // vars.push(taintedVar);
                        // if (taintedVar instanceof ArkInstanceFieldRef) {
                        //     vars.push(taintedVar.getBase());
                        // }
                        // const isAlias = vars.some((v) => {
                        //     return this.ifdsManager.getAliasing()?.mustAlias(v, lhs.getBase()) ?? false;
                        // });
                        // if (isAlias) {
                        //     factKillingStatus.killAllFacts = true;
                        // }
                    }
                } else if (lhs instanceof Local) {
                    // 同样要检查别名污点 (aliases)
                    // 由于 mustAlias 暂不具备查看特定 stmt 下的别名关系, 暂时无法处理别名的情况 
                    // if (this.ifdsManager.getAliasing()?.mustAlias(lhs, fact.getAccessPath().getBase()!)) {
                    //     factKillingStatus.killAllFacts = true;
                    // }
                    if (lhs === taintedAP.getBase()) {
                        factKillingStatus.killAllFacts = true;
                    }
                }
            } else if (taintedAP.isStaticFieldRef()) {
                // fact = X.f(.g), lhs = X.f, 不能再产生新污点
                if (lhs instanceof ArkInstanceFieldRef && lhs.getFieldSignature() === taintedAP.getFields()![0]) {
                    factKillingStatus.killAllFacts = true;
                }
            } else if (taintedAP.isLocal()) {
                // 若 fact === lhs, 杀死当前污点
                if (taintedAP.getBase() === lhs) {
                    factKillingStatus.killCurrFact = true;
                    // 若 rhs 有 fact, 可能产生新污点, 不能 killAll, 否则可以
                    if (getBaseValues(srcStmt.getRightOp()).every(use => use !== taintedAP.getBase())) {
                        factKillingStatus.killAllFacts = true;
                    }
                }
            }
        }
    }

    /**
     * 如果遇到赋值语句, 且 lhs 是 fact.base 
     */
    applyCallToReturnRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        if (srcStmt instanceof ArkAssignStmt && srcStmt.getLeftOp() === fact.getAccessPath().getBase()) {
            factKillingStatus.killCurrFact = true;
        }
    }
}
