import { Stmt } from "../../../core/base/Stmt";
import { ArkMethod } from "../../../core/model/ArkMethod";
import { IFDSManager } from "../IFDSManager";
import { TaintFact } from "../TaintFact";
import { FactKillingStatus, Rule } from "./Rule";
import { SinkRule } from "./SinkRule";
import { SourceRule } from "./SourceRule";
import { LHSOverwrittenRule } from "./LHSOverwrittenRule";

export class RuleManager {
    private rules: Set<Rule> = new Set();

    private ifdsManager: IFDSManager;

    constructor(ifdsManager: IFDSManager) {
        this.ifdsManager = ifdsManager;
        this.initRules();
    }
    
    // 根据 config 添加 rules
    private initRules() {
        const config = this.ifdsManager.getConfig();
        this.addRule(new SourceRule(this.ifdsManager));
        this.addRule(new SinkRule(this.ifdsManager));
        this.addRule(new LHSOverwrittenRule(this.ifdsManager));
    }

    public addRule(rule: Rule) {
        this.rules.add(rule);
    }

    public applyNormalRules(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, factKillingStatus: FactKillingStatus): Set<TaintFact> {
        const result: Set<TaintFact> = new Set();
        for (const rule of this.rules) {
            rule.applyNormalRule(srcStmt, tgtStmt, fact, result, factKillingStatus);
        }
        return result;
    }

    public applyCallRules(srcStmt: Stmt, method: ArkMethod, fact: TaintFact, factKillingStatus: FactKillingStatus): Set<TaintFact> {
        const result: Set<TaintFact> = new Set();
        for (const rule of this.rules) {
            rule.applyCallRule(srcStmt, method, fact, result, factKillingStatus);
        }
        return result;
    }

    public applyReturnRules(srcStmt: Stmt, tgtStmt: Stmt, callStmt: Stmt, fact: TaintFact, factKillingStatus: FactKillingStatus): Set<TaintFact> {
        const result: Set<TaintFact> = new Set();
        for (const rule of this.rules) {
            rule.applyReturnRule(srcStmt, tgtStmt, callStmt, fact, result, factKillingStatus);
        }
        return result;
    }

    public applyCallToReturnRules(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, factKillingStatus: FactKillingStatus): Set<TaintFact> {
        const result: Set<TaintFact> = new Set();
        for (const rule of this.rules) {
            rule.applyCallToReturnRule(srcStmt, tgtStmt, fact, result, factKillingStatus);
        }
        return result;
    }
}