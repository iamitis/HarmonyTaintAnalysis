import { Stmt } from "../../../core/base/Stmt";
import { ArkMethod } from "../../../core/model/ArkMethod";
import { IFDSManager } from "../IFDSManager";
import { TaintFact } from "../TaintFact";

export interface Rule {
    applyNormalRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void;

    applyCallRule(srcStmt: Stmt, method: ArkMethod, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void;

    applyReturnRule(srcStmt: Stmt, tgtStmt: Stmt, callStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void;

    applyCallToReturnRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void;
}

export abstract class AbstractRule implements Rule {
    protected ifdsManager: IFDSManager;

    constructor(ifdsManager: IFDSManager) {
        this.ifdsManager = ifdsManager;
    }

    protected getIfdsManager(): IFDSManager {
        return this.ifdsManager;
    }

    /**
     * @override
     */
    applyNormalRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {}

    /**
     * @override
     */
    applyCallRule(srcStmt: Stmt, method: ArkMethod, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {}

    /**
     * @override
     */
    applyReturnRule(srcStmt: Stmt, tgtStmt: Stmt, callStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {}

    /**
     * @override
     */
    applyCallToReturnRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {}
}

/**
 * 可作为参数传入规则, 让 rules 之间, rule 和 flowFunction 之间能共享状态
 */
export interface FactKillingStatus {
    /* 是否杀死当前 fact */
    killCurrFact: boolean;
    /* 是否杀死当前 fact 且当前 edge 不再产生新的 fact */
    killAllFacts: boolean;
}
