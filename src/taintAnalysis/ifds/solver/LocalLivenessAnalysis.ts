import { Local } from '../../../core/base/Local';
import { ArkStaticFieldRef } from '../../../core/base/Ref';
import { Stmt } from '../../../core/base/Stmt';
import { Value } from '../../../core/base/Value';
import { ArkMethod } from '../../../core/model/ArkMethod';
import Logger, { LOG_MODULE_TYPE } from '../../../utils/logger';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'LocalLivenessAnalysis');

/**
 * 局部变量活跃性分析
 *
 * 为每个方法预计算活跃变量信息，提供 isLocalLiveAtStmt() 查询接口。
 * 用于 IFDS 污点分析的性能优化：当 TaintFact 对应的 Local 变量
 * 在当前语句的后续语句中不再被使用时，停止传播该 fact。
 *
 * 算法：标准逆向数据流活跃变量分析
 * - liveOut(stmt) = ∪ liveIn(succ)  对所有后继 succ
 * - liveIn(stmt)  = useSet(stmt) ∪ (liveOut(stmt) - defSet(stmt))
 * - 迭代至收敛
 */
export class LocalLivenessAnalysis {

    /** method -> (stmt -> 该 stmt 中使用的 Local 集合) */
    private stmtToUsesMap: Map<ArkMethod, Map<Stmt, Set<Local>>> = new Map();

    /** method -> (stmt -> 该 stmt 的 live-out 集合) */
    private stmtToLiveOutMap: Map<ArkMethod, Map<Stmt, Set<Local>>> = new Map();

    /** 已完成分析的方法集合 */
    private analyzedMethods: Set<ArkMethod> = new Set();

    /**
     * 为指定方法预计算活跃变量信息。
     * 使用 solver 已构建的 stmtNexts（含正常边和异常边）获取后继。
     *
     * @param method 目标方法
     * @param stmtNexts solver 的语句后继映射
     */
    public analyzeMethod(method: ArkMethod, stmtNexts: Map<Stmt, Set<Stmt>>): void {
        if (this.analyzedMethods.has(method)) {
            return;
        }

        const cfg = method.getCfg();
        if (!cfg) {
            return;
        }

        const stmts = cfg.getStmts();
        if (stmts.length === 0) {
            this.analyzedMethods.add(method);
            return;
        }

        // 1. 计算 useSet 和 defSet
        const useSetMap = new Map<Stmt, Set<Local>>();
        const defSetMap = new Map<Stmt, Set<Local>>();

        for (const stmt of stmts) {
            useSetMap.set(stmt, this.extractUseLocals(stmt));
            defSetMap.set(stmt, this.extractDefLocals(stmt));
        }

        // 2. 迭代求解 liveOut / liveIn
        const liveOutMap = new Map<Stmt, Set<Local>>();
        const liveInMap = new Map<Stmt, Set<Local>>();

        // 初始化
        for (const stmt of stmts) {
            liveOutMap.set(stmt, new Set<Local>());
            liveInMap.set(stmt, new Set<Local>(useSetMap.get(stmt)!));
        }

        // 迭代至收敛
        let changed = true;
        let iteration = 0;
        const MAX_ITERATIONS = 100;

        while (changed && iteration < MAX_ITERATIONS) {
            changed = false;
            iteration++;

            // 逆序遍历加速收敛
            for (let i = stmts.length - 1; i >= 0; i--) {
                const stmt = stmts[i];
                const useSet = useSetMap.get(stmt)!;
                const defSet = defSetMap.get(stmt)!;

                // 计算 liveOut: 所有后继的 liveIn 的并集
                const newLiveOut = new Set<Local>();
                const succs = stmtNexts.get(stmt);
                succs?.forEach(succ => {
                    liveInMap.get(succ)?.forEach(local => {
                        newLiveOut.add(local);
                    });
                });

                // 计算 liveIn: useSet ∪ (liveOut - defSet)
                const newLiveIn = new Set<Local>(useSet);
                newLiveOut.forEach(local => {
                    !defSet.has(local) && newLiveIn.add(local);
                });

                // 检查是否有变化
                const oldLiveOut = liveOutMap.get(stmt)!;
                const oldLiveIn = liveInMap.get(stmt)!;

                if (!this.setEquals(oldLiveOut, newLiveOut) || !this.setEquals(oldLiveIn, newLiveIn)) {
                    changed = true;
                    liveOutMap.set(stmt, newLiveOut);
                    liveInMap.set(stmt, newLiveIn);
                }
            }
        }

        if (iteration >= MAX_ITERATIONS) {
            logger.warn(`LocalLivenessAnalysis: method ${method.getName()} did not converge after ${MAX_ITERATIONS} iterations`);
        }

        // 3. 缓存结果
        this.stmtToUsesMap.set(method, useSetMap);
        this.stmtToLiveOutMap.set(method, liveOutMap);
        this.analyzedMethods.add(method);
    }

    /**
     * 查询 local 在指定方法的 stmt 处是否活跃。
     * 活跃条件：local 在 useSet(stmt) 或 liveOut(stmt) 中。
     *
     * @param method 目标方法
     * @param local  待查询的局部变量
     * @param stmt   待查询的语句
     * @returns true 表示 local 在 stmt 处活跃（当前或后续仍被使用）
     */
    public isLocalLiveAtStmt(method: ArkMethod, local: Local, stmt: Stmt, stmtNexts: Map<Stmt, Set<Stmt>>): boolean {
        const stmt2Uses = this.stmtToUsesMap.get(method);
        const stmt2LiveOut = this.stmtToLiveOutMap.get(method);

        if (method.getCfg() && !stmt2Uses && !stmt2LiveOut) {
            this.analyzeMethod(method, stmtNexts);
        }

        const uses = this.stmtToUsesMap.get(method)?.get(stmt);
        const liveOuts = this.stmtToLiveOutMap.get(method)?.get(stmt);

        return !!uses?.has(local) || !!liveOuts?.has(local);
    }

    /**
     * 从 stmt.getUses() 中递归提取所有 Local。
     * stmt.getUses() 已递归包含字段引用的 base（如 ArkInstanceFieldRef.base、
     * ArkInstanceInvokeExpr.base、ArkArrayRef.base），因此直接过滤 Local 即可。
     */
    private extractUseLocals(stmt: Stmt): Set<Local> {
        const locals = new Set<Local>();
        for (const value of stmt.getUses()) {
            if (value instanceof Local) {
                locals.add(value);
            }
        }
        return locals;
    }

    /**
     * 从 stmt.getDef() 中提取 Local。
     * def 通常是赋值语句的左值，可能是 Local、ArkInstanceFieldRef、ArkArrayRef 等。
     * 仅提取 Local 类型（如 a = ... 的 a），不提取字段型 def（如 a.f = ... 的 a.f），
     * 因为字段型 def 不会 kill 整个 local 的活跃性。
     */
    private extractDefLocals(stmt: Stmt): Set<Local> {
        const locals = new Set<Local>();
        const def = stmt.getDef();
        if (def instanceof Local) {
            locals.add(def);
        }
        return locals;
    }

    /**
     * 比较两个 Set<Local> 是否相等（引用相等）
     */
    private setEquals(a: Set<Local>, b: Set<Local>): boolean {
        if (a.size !== b.size) {
            return false;
        }

        for (const local of a) {
            if (!b.has(local)) {
                return false;
            }
        }
        return true;
    }
}
