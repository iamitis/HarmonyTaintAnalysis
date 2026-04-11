import { ArkAssignStmt, ArkReturnStmt, ArkIfStmt, Stmt } from "../../../core/base/Stmt";
import { ArkMethod } from "../../../core/model/ArkMethod";
import { ArkInstanceInvokeExpr } from "../../../core/base/Expr";
import { TaintFact } from "../TaintFact";
import { AbstractRule, FactKillingStatus } from "./Rule";
import { FactAtSink } from "../FactAtSink";
import { Aliasing } from "../aliasing/Aliasing";

/**
 * Sink 规则：检测污点是否到达 sink 点
 * 参照 FlowDroid 的 SinkPropagationRule 实现
 */
export class SinkRule extends AbstractRule {
    /**
     * 是否处于 kill 状态（已找到到达同一 sink 的污点）
     */
    private killState: boolean = false;

    /**
     * 检查 ReturnStmt、IfStmt、AssignStmt 是否触发 sink
     * @override
     */
    applyNormalRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        // 只处理激活的 fact（非零值且非别名查询）
        if (!fact.isActive() || fact.isZeroFact()) {
            return;
        }

        // 检查是否是静态字段引用
        if (fact.getAccessPath().isStaticFieldRef()) {
            return;
        }

        // 检查各种语句类型是否触发 sink
        if (srcStmt instanceof ArkReturnStmt) {
            this.checkForSink(srcStmt, srcStmt.getOp(), fact, factKillingStatus);
        } else if (srcStmt instanceof ArkIfStmt) {
            this.checkForSink(srcStmt, srcStmt.getConditionExpr(), fact, factKillingStatus);
        } else if (srcStmt instanceof ArkAssignStmt) {
            this.checkForSink(srcStmt, srcStmt.getRightOp(), fact, factKillingStatus);
        }
    }

    /**
     * 如果处于 kill 状态，则停止分析
     * @override
     */
    applyCallRule(srcStmt: Stmt, method: ArkMethod, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        if (factKillingStatus) {
            factKillingStatus.killAllFacts ||= this.killState;
        }
    }

    /**
     * 检查调用语句本身是否是 sink
     * @override
     */
    applyCallToReturnRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        // 只处理激活的 fact
        if (!fact.isActive() || fact.isZeroFact()) {
            return;
        }

        // 检查调用点是否是 sink
        const sourceSinkManager = this.getIfdsManager().getSourceSinkManager();
        if (!sourceSinkManager) {
            return;
        }

        // 检查污点在被调用方法中是否可见
        if (!srcStmt.getInvokeExpr() || this.isTaintVisibleInCallee(srcStmt, fact)) {
            // 获取 sink 描述
            const sinkDef = sourceSinkManager.getSinkIfIs(srcStmt);
            if (sinkDef) {
                const sinkKey = this.getSinkKey(srcStmt, fact);
                const taintResults = this.getIfdsManager().getResults();
                const newResult = new FactAtSink(fact, sinkDef, srcStmt);
                if (!taintResults.has(sinkKey)) {
                    taintResults.set(sinkKey, newResult);
                } else {
                    // 如果已存在相同 sink，设置 killState 停止进一步传播
                    this.killState = true;
                    factKillingStatus.killAllFacts = true;
                }
            }
        }
    }

    /**
     * @override
     * 处理返回流
     * 检查返回值是否是 sink
     */
    applyReturnRule(srcStmt: Stmt, tgtStmt: Stmt, callStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        // 检查返回值是否被当作 sink 处理
        if (srcStmt instanceof ArkReturnStmt) {
            const returnStmt = srcStmt;
            const sourceSinkManager = this.getIfdsManager().getSourceSinkManager();

            if (!sourceSinkManager) {
                return;
            }

            // 检查是否匹配：本地变量或字段污染
            const matches = fact.getAccessPath().isLocal() || this.factHasTaintSubFields(fact);

            if (matches && fact.isActive()) {
                const sinkDef = sourceSinkManager.getSinkIfIs(returnStmt);
                if (sinkDef) {
                    const sinkKey = this.getSinkKey(returnStmt, fact);
                    const taintResults = this.getIfdsManager().getResults();
                    const newResult = new FactAtSink(fact, sinkDef, returnStmt);
                    if (!taintResults.has(sinkKey)) {
                        taintResults.set(sinkKey, newResult);
                    } else {
                        this.killState = true;
                        factKillingStatus.killAllFacts = true;
                    }
                }
            }
        }

        // 如果处于 kill 状态，设置 killAll
        if (factKillingStatus) {
            factKillingStatus.killAllFacts ||= this.killState;
        }
    }

    /**
     * 检查给定语句和值是否触发 sink
     * @param stmt 语句
     * @param value 要检查的值
     * @param fact 当前 fact
     * @param factKillingStatus fact 杀死状态
     */
    private checkForSink(stmt: Stmt, value: any, fact: TaintFact, factKillingStatus: FactKillingStatus): void {}

    /**
     * 检查污点在被调用方法中是否可见
     * @param stmt 调用语句
     * @param fact 污点 fact
     * @return 如果被调用方法可以访问污点值返回 true，否则返回 false
     */
    private isTaintVisibleInCallee(stmt: Stmt, fact: TaintFact): boolean {
        const aliasing = this.getIfdsManager().getAliasing();
        if (!aliasing) {
            return false;
        }

        const invokeExpr = stmt.getInvokeExpr();
        if (!invokeExpr) {
            return false;
        }


            // 检查参数是否被污染
            for (const arg of invokeExpr.getArgs()) {
                if (Aliasing.baseMatches(arg, fact)) {
                    // TODO: 非 Local 判断 taintSubFields
                    return true;
                }
            }

            // 检查基对象是否被污染（仅对实例调用有效）
            if (invokeExpr instanceof ArkInstanceInvokeExpr) {
                const base = invokeExpr.getBase();
                if (Aliasing.baseMatches(base, fact)) {
                    return true;
                }
            }

        return false;
    }

    /**
     * 简化的别名检查
     * @param value1 值1
     * @param value2 值2
     * @return 如果可能别名返回 true
     */
    private mayAlias(value1: any, value2: any): boolean {
        // TODO: 使用完整的别名分析
        // 简化实现：只检查是否是同一个本地变量
        if (!value1 || !value2) {
            return false;
        }

        // 获取 base 值进行比较
        const base1 = value1.getBase ? value1.getBase() : value1;
        const base2 = value2.getBase ? value2.getBase() : value2;

        return base1 === base2;
    }

    /**
     * 检查 fact 是否有污染子字段
     */
    private factHasTaintSubFields(fact: TaintFact): boolean {
        // TODO: 实现更完整的检查
        return fact.getAccessPath().isInstanceFieldRef();
    }

    /**
     * 生成 sink 的唯一键
     */
    private getSinkKey(stmt: Stmt, fact: TaintFact): string {
        const lineNo = stmt.getOriginPositionInfo().getLineNo();
        const colNo = stmt.getOriginPositionInfo().getColNo();
        const variable = fact.getAccessPath().toString();
        return `${lineNo}_${colNo}_${variable}`
    }

    /**
     * 重置 kill 状态
     */
    public resetKillState(): void {
        this.killState = false;
    }

    /**
     * 重置所有状态
     */
    public reset(): void {
        this.killState = false;
    }
}