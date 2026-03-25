import { ArkAssignStmt, ArkInvokeStmt, ArkReturnStmt, ArkReturnVoidStmt, Stmt } from '../../core/base/Stmt';
import { ArkMethod } from '../../core/model/ArkMethod';
import { DataflowProblem, FlowFunction } from '../../core/dataflow/DataflowProblem';
import { TaintFact } from './TaintFact';
import { Value } from '../../core/base/Value';
import { Local } from '../../core/base/Local';
import { ArkInstanceInvokeExpr } from '../../core/base/Expr';
import { AbstractFieldRef, ArkArrayRef, ArkInstanceFieldRef, ArkStaticFieldRef } from '../../core/base/Ref';
import { AccessPath } from './AccessPath';
import { RuleManager } from './rules/RuleManager';
import { IFDSManager } from './IFDSManager';
import { StaticFieldTrackingMode } from '../config/IFDSConfig';
import { THIS_NAME } from '../../core/common/TSConst';
import { LOG_MODULE_TYPE, Logger, PrimitiveType } from '../..';
import { FactKillingStatus } from './rules/Rule';
import { getBaseValues, getColorText } from '../util';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'TaintProblem');

export interface TaintFlowFunction extends FlowFunction<TaintFact> {
    getDataFactsWithCtxFact(ctxFact: TaintFact, currFact: TaintFact): Set<TaintFact>;
}

/**
 * 污点分析问题定义
 * 继承自 DataflowProblem，实现 IFDS 所需的流函数
 */
export class TaintProblem extends DataflowProblem<TaintFact> {
    private ifdsManager: IFDSManager;
    private entryMethod: ArkMethod;
    private entryPoint: Stmt;

    /* 持有并应用各种规则 */
    private ruleManager: RuleManager;

    constructor(entryMethod: ArkMethod, ifdsManager: IFDSManager) {
        super();
        this.entryMethod = entryMethod;
        this.ifdsManager = ifdsManager;
        this.ruleManager = new RuleManager(ifdsManager);
        // TODO: 获取入口点语句
        this.entryPoint = this.getFirstStmt(entryMethod);
    }

    /**
     * 获取方法的第一条语句
     */
    private getFirstStmt(method: ArkMethod): Stmt {
        // TODO: 实现获取第一条语句
        const startingStmt = method.getCfg()?.getStartingStmt();
        if (startingStmt) {
            return startingStmt;
        }
        throw new Error('Cannot find entry point for method: ' + method.getName());
    }

    /**
     * @override
     */
    getNormalFlowFunction(srcStmt: Stmt, tgtStmt: Stmt): TaintFlowFunction {
        const self = this;
        return {
            getDataFacts: (currFact: TaintFact): Set<TaintFact> => {
                return new Set<TaintFact>();
            },

            getDataFactsWithCtxFact: (ctxFact: TaintFact, currFact: TaintFact): Set<TaintFact> => {
                logger.debug(getColorText(`debugg NormalFlow`, 'blue'),
                    srcStmt.toString(),
                    getColorText(`${currFact.toString()}`, 'blue'));

                const result = new Set<TaintFact>();

                // 激活检查：检查当前 fact 是否需要激活
                let fact = currFact;
                if (!currFact.isActive() && srcStmt === currFact.getActivationStmt()) {
                    // 激活污点
                    fact = currFact.getActiveCopy();
                }
                result.add(fact);

                // 零值始终传播
                if (fact.isZeroFact()) {
                    return result;
                }


                // 应用各条规则
                const factKillingStatus: FactKillingStatus = {
                    killAllFacts: false,
                    killCurrFact: false
                };
                const factsOfRules = this.ruleManager.applyNormalRules(srcStmt, tgtStmt, fact, factKillingStatus);

                if (factKillingStatus.killAllFacts) {
                    return new Set<TaintFact>();
                }

                factsOfRules.forEach(fact => {
                    result.add(fact);
                });

                // 处理赋值语句的污点传播
                if (srcStmt instanceof ArkAssignStmt) {
                    const factsOfAssignStmt: Set<TaintFact> = self.handleAssignStmt(srcStmt, fact, ctxFact);
                    factsOfAssignStmt.forEach(fact => {
                        result.add(fact);
                    });
                }

                return result;
            }
        };
    }

    /**
     * 调用边的流函数
     * 处理方法调用时参数的污点传播
     * @override
     */
    getCallFlowFunction(srcStmt: Stmt, method: ArkMethod): FlowFunction<TaintFact> {
        const self = this;
        return {
            getDataFacts: (fact: TaintFact): Set<TaintFact> => {
                logger.debug(getColorText(`debugg CallFlow`, 'blue'),
                    srcStmt.toString(),
                    getColorText(`${fact.toString()}`, 'blue'));

                const result = new Set<TaintFact>();

                // 排除不进入的方法，如库方法
                if (self.isExcludedMethod(srcStmt, method)) {
                    return result;
                }

                if (fact.isZeroFact()) {
                    result.add(fact);
                    return result;
                }

                const factKillingStatus: FactKillingStatus = {
                    killAllFacts: false,
                    killCurrFact: false
                };
                const factsOfRules = this.ruleManager.applyCallRules(srcStmt, method, fact, factKillingStatus);

                if (factKillingStatus.killAllFacts) {
                    return new Set<TaintFact>();
                }

                factsOfRules.forEach(fact => {
                    result.add(fact);
                });

                // 污点路径转化：实参 -> 形参、this 指针转化
                const factsFromCallerToCallee: Set<TaintFact> = self.transFactsFromCallerToCallee(srcStmt, method, fact);
                factsFromCallerToCallee.forEach(fact => {
                    result.add(fact);
                });

                return result;
            }
        };
    }

    /**
     * 返回边的流函数
     * 处理方法返回时的污点传播
     * @override
     */
    getExitToReturnFlowFunction(srcStmt: Stmt, tgtStmt: Stmt, callStmt: Stmt): FlowFunction<TaintFact> {
        const self = this;
        return {
            getDataFacts: (fact: TaintFact): Set<TaintFact> => {
                logger.debug(getColorText(`debugg ExitToReturnFlow`, 'blue'),
                    srcStmt.toString(),
                    getColorText(`${fact.toString()}`, 'blue'));

                const result = new Set<TaintFact>();

                // srcStmt 必须是 return 类语句
                if (!(srcStmt instanceof ArkReturnStmt) && !(srcStmt instanceof ArkReturnVoidStmt)) {
                    logger.warn(`getExitToReturnFlowFunction: srcStmt is not a return stmt`);
                    return result;
                }

                if (!callStmt.getInvokeExpr()) {
                    logger.warn(`getExitToReturnFlowFunction: callStmt has no invokeExpr`);
                    return result;
                }

                // 零值不传播回调用点
                if (fact.isZeroFact()) {
                    return result;
                }

                // TODO: Activate taint if necessary

                const factKillingStatus: FactKillingStatus = {
                    killAllFacts: false,
                    killCurrFact: false
                };
                const factsfOfRules = this.ruleManager.applyReturnRules(srcStmt, tgtStmt, callStmt, fact, factKillingStatus);

                if (factKillingStatus.killAllFacts) {
                    return new Set<TaintFact>();
                }

                factsfOfRules.forEach(fact => {
                    result.add(fact);
                });

                // 静态字段 fact 放到 rule 中处理
                if (fact.getVariable().isStaticFieldRef()) {
                    return result;
                }

                // 污点路径转化：返回值 -> lhs, 形参 -> 实参, this 指针转化
                const factsFromCalleeToCaller: Set<TaintFact> = self.transFactsFromCalleeToCaller(srcStmt, callStmt, fact);
                factsFromCalleeToCaller.forEach(fact => {
                    result.add(fact);
                });

                return result;
            }
        };
    }

    /**
     * 调用到返回边的流函数
     * 处理调用点不进入被调用方法的情况（如：本地变量）
     * @override
     */
    getCallToReturnFlowFunction(srcStmt: Stmt, tgtStmt: Stmt): FlowFunction<TaintFact> {
        const self = this;
        return {
            getDataFacts: (fact: TaintFact): Set<TaintFact> => {
                logger.debug(getColorText(`debugg CallToReturnFlow`, 'blue'),
                    srcStmt.toString(),
                    getColorText(`${fact.toString()}`, 'blue'));

                const result = new Set<TaintFact>();

                if (!srcStmt.getInvokeExpr()) {
                    logger.warn(`getCallToReturnFlowFunction: srcStmt has no invokeExpr`);
                    return result;
                }

                // TODO: 按需激活未激活的 fact
                if (!fact.isActive() && srcStmt === fact.getActivationStmt()) {
                    fact = fact.getActiveCopy();
                }

                const factKillingStatus: FactKillingStatus = {
                    killAllFacts: false,
                    killCurrFact: false
                };
                const factsfOfRules = this.ruleManager.applyCallToReturnRules(srcStmt, tgtStmt, fact, factKillingStatus);

                if (factKillingStatus.killAllFacts) {
                    return new Set<TaintFact>();
                }

                factsfOfRules.forEach(fact => {
                    result.add(fact);
                });

                if (fact.isZeroFact()) {
                    result.add(fact);
                    return result;
                }

                // 判断是否需要直接在调用方法外传播 fact

                // 判断 fact 是否是基本类型, 若是则需在方法外传播
                const isPrimitive = fact.getVariable().getBaseType() instanceof PrimitiveType;
                // TODO: fact 为静态字段, 且 callee 中没有读取 fact, 则需在方法外传播
                const factIsStaticFieldRefAndRead = fact.getVariable().isStaticFieldRef() && ('staticFactIsReadInCallee')
                // TODO: 如果 callee 不可进入（如库方法, source/sink）, 则需在方法外传播
                const calleeIsExcluded = false;
                // TODO: 任何一个 callee 没有使用 fact, 就需要在方法外传播
                const hasCalleeNotUsingFact = false;

                if (isPrimitive || factIsStaticFieldRefAndRead || calleeIsExcluded || hasCalleeNotUsingFact) {
                    result.add(fact);
                }

                return result;
            }
        };
    }

    /**
     * 创建零值（特殊的初始 fact）
     * @override
     */
    getZeroValue(): TaintFact {
        return TaintFact.createZeroFact();
    }

    /**
     * 获取分析入口点
     * @override
     */
    getEntryPoint(): Stmt {
        return this.entryPoint;
    }

    /**
     * 获取入口方法
     * @override
     */
    getEntryMethod(): ArkMethod {
        return this.entryMethod;
    }

    /**
     * 判断两个 fact 是否相等
     * @override
     */
    factEqual(d1: TaintFact, d2: TaintFact): boolean {
        return d1.equals(d2);
    }

    /**
     * 创建零值（特殊的初始 fact）
     * @override
     */
    createZeroValue(): TaintFact {
        return TaintFact.createZeroFact();
    }

    /**
     * 获取方法的第 i 个参数对应的 Local
     */
    private getParamLocal(method: ArkMethod, index: number): Local | undefined {
        const body = method.getBody();
        if (!body) {
            return undefined;
        }
        const params = method.getParameters();
        if (index < params.length) {
            const paramName = params[index].getName();
            return body.getLocals().get(paramName);
        }
        return undefined;
    }

    private handleAssignStmt(stmt: ArkAssignStmt, currFact: TaintFact, ctxFact: TaintFact): Set<TaintFact> {
        const lhs = stmt.getLeftOp();
        const rhs = stmt.getRightOp();

        // 处理 fact 为隐式污点的情况
        if (currFact.getTopPostdominator()?.getStmt() || currFact.getVariable().isEmpty()) {
            const inMethodOfTaintedCondition = ctxFact.getVariable().isEmpty();
            if (inMethodOfTaintedCondition && lhs instanceof Local) {
                // 如果在方法内部, 且是局部变量, 则无需传播受污染的 lhs
                return new Set([currFact]);
            }

            if (currFact.getVariable().isEmpty()) {
                const newFact = this.taintLhs(stmt, currFact, ctxFact);
                if (newFact) {
                    return new Set([newFact]);
                } else {
                    return new Set();
                }
            }
        }

        // ★ 处理 fact 为未激活的情况
        if (!currFact.isActive()) {
            // 未激活的污点继续传播，保持未激活状态
            // 只有在激活单元才会激活
            return new Set([currFact]);
        }

        // 提取出 rhs 的所有操作数. 如 y = a + b 中的 [a, b]
        const rightValues = getBaseValues(rhs);
        const result: Set<TaintFact> = new Set();

        for (const rv of rightValues) {
            if (rv instanceof ArkInstanceFieldRef) {
                // rv 为实例字段型, 如 x.y

                // 判断 currFact 是否为 rv 或者 rv 的字段
                // 如 currFact = x.y, rv = x.y
                // 如 currFact = x.y.z, rv = x.y
                const mappedAP = currFact.getVariable().isContainedByValue(rv);

                if (mappedAP) {
                    // 若 currFact = x.y, rv = x.y, 则 newAP 为 lhs
                    // 若 currFact = x.y.z, rv = x.y, 则 newAP 为 lhs.z
                    // 需要砍掉第一个字段 f
                    // TODO: 处理递归型字段的情况, 如 Node {next: Node; data: string}, rv = x.next, 此时可能不砍字段
                    const lhsFact = this.taintLhs(stmt, currFact, ctxFact, { cutFirstField: true });
                    lhsFact && result.add(lhsFact);
                } else if (true) {
                    // 此时 currFact 不是 rv 的字段
                    // 判断 rv 是否是 currFact 的字段
                    // 如 currFact = x, rv = x.y
                    if (
                        (
                            !currFact.getVariable().getFields() || currFact.getVariable().getFields()?.length === 0
                        )
                        && currFact.getVariable().getBase() === rv.getBase()
                    ) {
                        // newAP 为 lhs
                        const lhsFact = this.taintLhs(stmt, currFact, ctxFact);
                        lhsFact && result.add(lhsFact);
                    }
                }
            } else if (rv instanceof ArkStaticFieldRef) {
                // rv 为静态字段型, 如 X.y

            } else if (rv instanceof Local && currFact.getVariable().isInstanceFieldRef()) {
                // rv 为 Local, currFact 为实例字段型

                // 判断 currFact 是否为 rv 的字段
                // 如 currFact = x.y, rv = x
                if (currFact.getVariable().getBase() === rv) {
                    // newAP 为 lhs.y
                    const lhsFact = this.taintLhs(stmt, currFact, ctxFact);
                    lhsFact && result.add(lhsFact);
                }
            } else {
                // rv 为 Local, currFact 为 Local
                if (currFact.getVariable().isLocal() && currFact.getVariable().getBase() === rv) {
                    const lhsFact = this.taintLhs(stmt, currFact, ctxFact);
                    lhsFact && result.add(lhsFact);
                }
            }
        }

        return result;
    }

    private taintLhs(stmt: ArkAssignStmt, fact: TaintFact, ctxFact: TaintFact, options?: any): TaintFact | undefined {
        const lhs = stmt.getLeftOp();
        const rhs = stmt.getRightOp();

        // Do not taint static fields unless the option is enabled
        if (lhs instanceof ArkStaticFieldRef && this.ifdsManager.getConfig().staticFieldTrackingMode === StaticFieldTrackingMode.None) {
            return;
        }

        let newFact: TaintFact | undefined = undefined;

        if (fact.getVariable().isEmpty()) {
            if (lhs instanceof ArkArrayRef) {
                // TODO: 按情况升维污点类型 - targetType(待添加参数)
            }
            // TODO: 处理其他特殊类型 rhs 情况下的 targetType 
        }

        if (!newFact) {
            if (fact.getVariable().isEmpty()) {
                // TODO: 生成隐式污点
            } else {
                if (lhs instanceof ArkArrayRef) {
                    // 形如 a[i] = taintedVar
                    const newAP = AccessPath.createElementTaintedArrayAccessPath(lhs.getBase());
                    newAP && (newFact = fact.deriveWithNewAccessPath(newAP, stmt));
                } else {
                    let fields = fact.getVariable().getFields();
                    let newFields = undefined;
                    if (fields) {
                        newFields = [...fields];
                        options?.cutFirstField && newFields.shift();
                    }
                    const newAP = AccessPath.createAccessPath(lhs, newFields);
                    newAP && (newFact = fact.deriveWithNewAccessPath(newAP, stmt));
                }
            }
        }

        if (newFact) {
            if (lhs instanceof ArkStaticFieldRef && this.ifdsManager.getConfig().staticFieldTrackingMode === StaticFieldTrackingMode.ContextFlowSensitive) {
                // TODO
            } else {
                // ★ 追踪别名：触发别名分析
                const aliasing = this.ifdsManager.getAliasing();
                if (aliasing) {
                    const taintSet = new Set<TaintFact>();
                    taintSet.add(newFact);
                    const method = stmt.getCfg().getDeclaringMethod();
                    aliasing.computeAliases(ctxFact, stmt, lhs, taintSet, method, newFact);
                }
            }
        }

        return newFact;
    }

    /**
     * 将 fact 从 caller 上下文传播到 callee 上下文
     */
    private transFactsFromCallerToCallee(srcStmt: Stmt, method: ArkMethod, fact: TaintFact): Set<TaintFact> {
        const accessPaths = new Set<AccessPath>();
        const res: Set<TaintFact> = new Set();

        if (fact.getVariable().isEmpty() || !srcStmt.getInvokeExpr() || !method.getBody()) {
            return res;
        }

        if (fact.getVariable().isStaticFieldRef()) {
            // TODO: 处理静态 fact
            return res;
        }

        const aliasing = this.ifdsManager.getAliasing();
        if (!aliasing) {
            return res;
        }

        const invokeExpr = srcStmt.getInvokeExpr()!;
        const factBase = fact.getVariable().getBase();
        const factFields = [...(fact.getVariable().getFields() ?? [])];

        // 若是实例方法调用, 如 obj.method(), 且 fact 的 base 为 obj, 将 fact 的 base 改为 method 的 thisLocal
        if (invokeExpr instanceof ArkInstanceInvokeExpr) {
            if (factBase === invokeExpr.getBase()) {
                // 获取 method 的 thisLocal
                const calleeThisLocal = method.getBody()!.getLocals().get(THIS_NAME);
                // AP{base=obj} -> AP{base=this}
                const newAccessPath = AccessPath.createAccessPath(calleeThisLocal, factFields);
                newAccessPath && accessPaths.add(newAccessPath);
            }
        }

        // 若某个实参的 base 与 fact 的 base 相同, 则创建 AP{base=paramLocal, fields=factFields}
        invokeExpr.getArgs().forEach((arg, i) => {
            if (arg instanceof ArkInstanceFieldRef && arg.getBase() === factBase) {
                const paramLocal = this.getParamLocal(method, i);
                if (paramLocal) {
                    const newAccessPath = AccessPath.createAccessPath(paramLocal, factFields);
                    newAccessPath && accessPaths.add(newAccessPath);
                }
            }
        });

        accessPaths.forEach((ap) => {
            const newFact = new TaintFact(ap, fact.getTaintingStmt());
            newFact && res.add(newFact);
            // TODO: 处理情况 - If the variable is never read in the callee, there is no need to propagate it through
        });

        return res;
    }

    /**
     * 将 fact 从 caller 上下文传播到 callee 上下文
     */
    private transFactsFromCalleeToCaller(srcStmt: Stmt, callStmt: Stmt, fact: TaintFact): Set<TaintFact> {
        const result: Set<TaintFact> = new Set();

        const factBase = fact.getVariable().getBase();
        const factFields = [...(fact.getVariable().getFields() ?? [])];
        const callee = srcStmt.getCfg().getDeclaringMethod();
        if (!callee.getBody()) {
            return result;
        }

        const aliasing = this.ifdsManager.getAliasing();

        // 处理返回值映射: returnValue → callStmt.leftOp
        if (srcStmt instanceof ArkReturnStmt && callStmt instanceof ArkAssignStmt) {
            const returnValue = srcStmt.getOp();
            if (returnValue instanceof Local && factBase === returnValue) {
                const leftOp = callStmt.getLeftOp();
                const newAP = AccessPath.createAccessPath(leftOp, factFields);
                if (newAP) {
                    const newFact = new TaintFact(newAP, fact.getTaintingStmt());
                    result.add(newFact);
                    // ★ 按需计算别名
                    if (aliasing) {
                        const taintSet = new Set<TaintFact>();
                        taintSet.add(newFact);
                        aliasing.computeAliases(
                            TaintFact.createZeroFact(),
                            callStmt,
                            leftOp,
                            taintSet,
                            callee,
                            newFact
                        );
                    }
                }
            }
            // TODO: 处理其他类型的 returnValue
        }

        const invokeExpr = callStmt.getInvokeExpr()!;

        // 处理参数映射: callee.param[i] → caller.args[i]
        invokeExpr.getArgs().forEach((arg: Value, i) => {
            // 排除 lhs 也是参数的情况, 如 a = f(a, b), 已在之前的返回值映射中处理
            if (callStmt instanceof ArkAssignStmt && arg === callStmt.getLeftOp()) {
                return;
            }
            if (!AccessPath.canContainValue(arg)) {
                return;
            }
            const paramLocal = this.getParamLocal(callee, i);
            if (paramLocal && factBase === paramLocal) {
                const newAP = AccessPath.createAccessPath(arg, factFields);
                if (newAP) {
                    const newFact = new TaintFact(newAP, fact.getTaintingStmt());
                    result.add(newFact);
                    // ★ 按需计算别名
                    if (aliasing) {
                        const taintSet = new Set<TaintFact>();
                        taintSet.add(newFact);
                        aliasing.computeAliases(
                            TaintFact.createZeroFact(),
                            callStmt,
                            arg,
                            taintSet,
                            callee,
                            newFact
                        );
                    }
                }
            }
        });

        // 处理 this 映射: callee.this → caller.base
        if (invokeExpr instanceof ArkInstanceInvokeExpr) {
            // 排除 lhs 也是 caller.base 的情况, 如 a = a.f()
            const callerBaseOverwritten = callStmt instanceof ArkAssignStmt && invokeExpr.getBase() === callStmt.getLeftOp();

            const calleeThisLocal = callee.getBody()!.getLocals().get(THIS_NAME);
            if (!callerBaseOverwritten && factBase === calleeThisLocal) {
                const callerBase = invokeExpr.getBase();
                const newAP = AccessPath.createAccessPath(callerBase, factFields);
                if (newAP) {
                    const newFact = new TaintFact(newAP, fact.getTaintingStmt());
                    result.add(newFact);
                    // ★ 按需计算别名
                    if (aliasing) {
                        const taintSet = new Set<TaintFact>();
                        taintSet.add(newFact);
                        aliasing.computeAliases(
                            TaintFact.createZeroFact(),
                            callStmt,
                            callerBase,
                            taintSet,
                            callee,
                            newFact
                        );
                    }
                }
            }
        }

        return result;
    }

    /**
     * 判断是否需要在方法外传播 fact
     * @param srcStmt callSite, 方法调用语句
     */
    private shouldBypassMethodForPropagation(srcStmt: Stmt, fact: TaintFact): boolean {
        return false;
    }

    /**
     * 判断是否是无需进入的方法
     */
    private isExcludedMethod(stmt: Stmt, method: ArkMethod): boolean {
        const isSourceMethod = this.ifdsManager.getSourceSinkManager()?.getSources().some((source) => source.matches(stmt)) ?? false;
        if (isSourceMethod) {
            return true;
        }

        const isSinkMethod = this.ifdsManager.getSourceSinkManager()?.getSinks().some((sink) => sink.matches(stmt)) ?? false;
        if (isSinkMethod) {
            return true;
        }

        return false;
    }
}
