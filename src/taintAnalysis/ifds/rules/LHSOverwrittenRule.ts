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

        if (!fact.isActive()) {
            if (this.hasFactTaintedByStmt(srcStmt, fact)) {
                return;
            }

            // 处理未激活污点
            const taintedAP = fact.getAccessPath();

            // 未严格验证的思想: 
            // 如果未激活污点变量就是 lhs 或是 lhs 的别名, 污点可能还会被激活, 保留污点, 参考 testFieldAlias6, testFieldAlias14
            // 如果未激活污点变量是 lhs 的字段, 即使到达激活语句, 污点也不会被有效激活, 杀死污点, 参考 testFieldAlias13, testFieldAlias15

            // 目前仅考虑实例字段型污点
            if (taintedAP.isInstanceFieldRef()) {
                if (Aliasing.baseMatchesStrict(lhs, fact) || lhs === fact.getTaintedVar()) {
                    // lhs 就是受污变量, 不杀死 fact
                    return;
                } else if (Aliasing.baseMatches(lhs, fact)) {
                    // 受污变量是 lhs 的字段, 杀死 fact
                    factKillingStatus.killAllFacts = true;
                } else if (lhs instanceof ArkInstanceFieldRef) {
                    let aliasFact = this.findAliasOfValueFromInactiveFactChain(lhs.getBase(), fact);
                    if (aliasFact && this.accessPathIsFieldOfValue(lhs, aliasFact.getAccessPath())) {
                        factKillingStatus.killAllFacts = true;
                        return;
                    }
                }
            }
        } else {
            // 不杀刚激活的污点
            if (fact.getActivationStmt() === srcStmt) {
                return;
            }

            if (fact.getAccessPath().isInstanceFieldRef()) {
                if (lhs instanceof ArkInstanceFieldRef) {
                    if (fact.getAccessPath().isContainedByValue(lhs)) {
                        // 若 fact 是 lhs 或 lhs 的字段, 杀死
                        factKillingStatus.killAllFacts = true;
                    } else {
                        // 若 fact 别名 lhs.base, 杀死
                        const vars: Value[] = [fact.getAccessPath().getBase()!];
                        const taintedVar = fact.getTaintedVar();
                        vars.push(taintedVar);
                        if (taintedVar instanceof ArkInstanceFieldRef) {
                            vars.push(taintedVar.getBase());
                        }
                        const isAlias = vars.some((v) => {
                            return this.ifdsManager.getAliasing()?.mustAlias(v, lhs.getBase()) ?? false;
                        });
                        if (isAlias) {
                            factKillingStatus.killAllFacts = true;
                        }
                    }
                } else if (lhs instanceof Local) {
                    // 同样要检查别名污点 (aliases)
                    // if (this.ifdsManager.getAliasing()?.mustAlias(lhs, fact.getAccessPath().getBase()!)) {
                    //     factKillingStatus.killAllFacts = true;
                    // }
                    if (lhs === fact.getAccessPath().getBase()) {
                        factKillingStatus.killAllFacts = true;
                    }
                }
            } else if (fact.getAccessPath().isStaticFieldRef()) {
                // fact = X.f(.g), lhs = X.f, 不能再产生新污点
                if (AccessPath.staticFieldRefContainsAccessPath(lhs, fact.getAccessPath())) {
                    factKillingStatus.killAllFacts = true;
                }
            } else if (fact.getAccessPath().isLocal()) {
                // 若 fact === lhs, 杀死当前污点
                if (fact.getAccessPath().getBase() === lhs) {
                    factKillingStatus.killCurrFact = true;
                    // 若 rhs 有 fact, 可能产生新污点, 不能 killAll, 否则可以
                    if (getBaseValues(srcStmt.getRightOp()).every(use => use !== fact.getAccessPath().getBase())) {
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

    /**
     * 检查在 fact 的 pre-taint fact 链中 (包括 fact), 是否存在 fact 是被 stmt 污染的
     */
    private hasFactTaintedByStmt(stmt: Stmt, fact?: TaintFact): boolean {
        if (!fact) {
            return false;
        }

        if (fact.getTaintingStmt() === stmt) {
            return true;
        }

        return this.hasFactTaintedByStmt(stmt, fact.getPreTaintFact());
    }

    /**
     * 在未激活的污点链中寻找 value 的别名
     */
    private findAliasOfValueFromInactiveFactChain(value: Value, fact?: TaintFact): TaintFact | undefined {
        if (!fact || fact.isActive()) {
            return undefined;
        }

        const taintedVar = fact.getTaintedVar();
        if (this.ifdsManager.getAliasing()?.mustAlias(value, taintedVar)) {
            return fact;
        } else if (taintedVar instanceof ArkInstanceFieldRef &&
            this.ifdsManager.getAliasing()?.mustAlias(value, taintedVar.getBase())
        ) {
            return fact;
        }

        return this.findAliasOfValueFromInactiveFactChain(value, fact.getPreTaintFact());
    }

    private accessPathIsFieldOfValue(value: Value, accessPath: AccessPath): boolean {
        if (!(value instanceof ArkInstanceFieldRef)) {
            return false;
        }

        if (!accessPath.isInstanceFieldRef()) {
            return false;
        }

        const valueField = value.getFieldSignature();
        const index = accessPath.getFields()!.findIndex((fieldSig: FieldSignature) => {
            return fieldSig.getType() === valueField.getType() && fieldSig.getFieldName() === valueField.getFieldName();
        })

        return index !== -1 && index !== accessPath.getFields()!.length - 1;
    }
}
