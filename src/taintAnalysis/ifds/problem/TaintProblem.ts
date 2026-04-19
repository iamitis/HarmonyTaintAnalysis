import { ArkAssignStmt, ArkReturnStmt, ArkReturnVoidStmt, Stmt } from '../../../core/base/Stmt';
import { ArkMethod } from '../../../core/model/ArkMethod';
import { TaintFact } from '../TaintFact';
import { Value } from '../../../core/base/Value';
import { Local } from '../../../core/base/Local';
import { ArkInstanceInvokeExpr } from '../../../core/base/Expr';
import { ArkArrayRef, ArkInstanceFieldRef, ArkStaticFieldRef } from '../../../core/base/Ref';
import { AccessPath } from '../AccessPath';
import { RuleManager } from '../rules/RuleManager';
import { IFDSManager } from '../IFDSManager';
import { StaticFieldTrackingMode } from '../../config/IFDSConfig';
import { THIS_NAME } from '../../../core/common/TSConst';
import { LOG_MODULE_TYPE, Logger, PathEdge, PathEdgePoint, PrimitiveType } from '../../..';
import { FactKillingStatus } from '../rules/Rule';
import { findBaseValues, getColorText } from '../../util';
import { AbstractTaintProblem, TaintFlowFunction } from './AbstractTaintProblem';
import { CONSTRUCTORFUCNNAME, INSTANCE_INIT_METHOD_NAME } from '../../../core/common/Const';
import { ClassCategory } from '../../../core/model/ArkClass';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'TaintProblem');

/**
 * 污点分析问题定义
 * 继承自 DataflowProblem，实现 IFDS 所需的流函数
 */
export class TaintProblem extends AbstractTaintProblem {
    ;

    /* 持有并应用各种规则 */
    private ruleManager: RuleManager;

    constructor(entryMethod: ArkMethod, ifdsManager: IFDSManager) {
        super(ifdsManager, entryMethod);
        this.entryMethod = entryMethod;
        this.ruleManager = new RuleManager(ifdsManager);
        this.entryPoint = this.getStartOfMethod(entryMethod);
    }

    /**
     * 获取方法的第一条语句, 即 paramLocal 定义语句后的第一条语句
     */
    private getStartOfMethod(method: ArkMethod): Stmt {
        const cfg = method.getCfg();
        if (!cfg) {
            throw new Error('Method has no CFG: ' + method.getName());
        }

        const startIdx = method.getParameters().length + 1;
        if (cfg.getStmts().length > startIdx) {
            return cfg.getStmts()[startIdx];
        } else {
            throw new Error('Fail to get starting statement of Method: ' + method.getName());
        }
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

            getDataFactsWithCtxNode: (ctxNode: PathEdgePoint<TaintFact>, currFact: TaintFact): Set<TaintFact> => {
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

                // 零值始终传播
                if (fact.isZeroFact()) {
                    result.add(fact);
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
                    const factsOfAssignStmt: Set<TaintFact> = self.handleAssignStmt(srcStmt, fact, ctxNode);
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
    getCallFlowFunction(srcStmt: Stmt, method: ArkMethod): TaintFlowFunction {
        const self = this;

        return {
            getDataFacts: (currFact: TaintFact): Set<TaintFact> => {
                logger.debug(getColorText(`debugg CallFlow`, 'blue'),
                    srcStmt.toString(),
                    getColorText(`${currFact.toString()}`, 'blue'));

                const result = new Set<TaintFact>();

                // 排除不进入的方法，如库方法
                if (self.isExcludedMethod(srcStmt, method)) {
                    return result;
                }

                const factKillingStatus: FactKillingStatus = {
                    killAllFacts: false,
                    killCurrFact: false
                };
                const factsOfRules = this.ruleManager.applyCallRules(srcStmt, method, currFact, factKillingStatus);

                if (factKillingStatus.killAllFacts) {
                    return new Set<TaintFact>();
                }

                factsOfRules.forEach(fact => {
                    result.add(fact);
                });

                if (currFact.isZeroFact()) {
                    result.add(currFact);
                    return result;
                }


                // 污点路径转化：实参 -> 形参、this 指针转化
                const factsFromCallerToCallee: Set<TaintFact> = self.transFactsFromCallerToCallee(srcStmt, method, currFact);
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
    getExitToReturnFlowFunction(srcStmt: Stmt, tgtStmt: Stmt, callStmt: Stmt): TaintFlowFunction {
        const self = this;
        return {
            getDataFacts: (fact: TaintFact): Set<TaintFact> => new Set<TaintFact>(),

            getDataFactsWithCallerEdge: (callerEdge: PathEdge<TaintFact>, currFact: TaintFact): Set<TaintFact> => {
                logger.debug(getColorText(`debugg ExitToReturnFlow`, 'blue'),
                    srcStmt.toString(),
                    getColorText(`${currFact.toString()}`, 'blue'));

                const result = new Set<TaintFact>();

                // srcStmt 必须是 return 类语句
                if (!(srcStmt instanceof ArkReturnStmt) && !(srcStmt instanceof ArkReturnVoidStmt)) {
                    logger.warn(`srcStmt is not a return stmt: ${srcStmt.toString()}`);
                    return result;
                }

                if (!callStmt.getInvokeExpr()) {
                    logger.warn(`callStmt has no invokeExpr: ${callStmt.toString()}`);
                    return result;
                }

                // 零值不传播回调用点
                if (currFact.isZeroFact()) {
                    return result;
                }

                // Activate taint if necessary
                if (!currFact.isActive() && callStmt === currFact.getActivationStmt()) {
                    currFact = currFact.getActiveCopy();
                }

                const factKillingStatus: FactKillingStatus = {
                    killAllFacts: false,
                    killCurrFact: false
                };
                const factsfOfRules = this.ruleManager.applyReturnRules(srcStmt, tgtStmt, callStmt, currFact, factKillingStatus);

                if (factKillingStatus.killAllFacts) {
                    return new Set<TaintFact>();
                }

                factsfOfRules.forEach(fact => {
                    result.add(fact);
                });

                // 静态字段 fact 放到 rule 中处理
                if (currFact.getAccessPath().isStaticFieldRef()) {
                    return result;
                }

                // 污点路径转化：返回值 -> lhs, 形参 -> 实参, this 指针转化
                const factsFromCalleeToCaller: Set<TaintFact> = self.transFactsFromCalleeToCaller(srcStmt, callStmt, currFact, callerEdge);
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
    getCallToReturnFlowFunction(callStmt: Stmt, returnSite: Stmt): TaintFlowFunction {
        const self = this;
        return {
            getDataFacts: () => new Set(),

            getDataFactsWithCallees: (callees, fact: TaintFact): Set<TaintFact> => {
                logger.debug(getColorText(`debugg CallToReturnFlow`, 'blue'),
                    callStmt.toString(),
                    getColorText(`${fact.toString()}`, 'blue'));

                const result = new Set<TaintFact>();

                if (!callStmt.getInvokeExpr()) {
                    logger.warn(`getCallToReturnFlowFunction: srcStmt has no invokeExpr`);
                    return result;
                }

                // TODO: 按需激活未激活的 fact
                if (!fact.isActive() && callStmt === fact.getActivationStmt()) {
                    fact = fact.getActiveCopy();
                }

                const factKillingStatus: FactKillingStatus = {
                    killAllFacts: false,
                    killCurrFact: false
                };
                const factsfOfRules = this.ruleManager.applyCallToReturnRules(callStmt, returnSite, fact, factKillingStatus);

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

                // 静态字段 fact 在 ContextFlowSensitive 模式下不走 call-to-return 边，
                // 强制走 call -> return 边以保证上下文敏感性。
                // 除非所有 callee 都是被排除的方法、没有 callee、或 callee 无 CFG 可进入。
                // 若 callee 无 CFG，则 CallFlow 无法将污点传入 callee，污点只能走 CallToReturn 边存活。
                if (fact.getAccessPath().isStaticFieldRef()) {
                    const anyCalleeExcluded = Array.from(callees).some(callee => self.isExcludedMethod(callStmt, callee));
                    const noCallees = callees.size === 0;
                    const anyCalleeWithoutCfg = Array.from(callees).some(callee => !callee.getCfg());
                    if (anyCalleeExcluded || noCallees || anyCalleeWithoutCfg) {
                        result.add(fact);
                    }
                    // 否则静态字段 fact 由 StaticPropagationRule 走 call/return 边处理
                    return result;
                }

                // 判断 fact 是否是基本类型, 若是则需在方法外传播
                const isPrimitive = fact.getAccessPath().getBaseType() instanceof PrimitiveType;

                // 任何一个 callee 是被排除的方法, 就需要在方法外传播
                const calleeIsExcluded = Array.from(callees).some(callee => self.isExcludedMethod(callStmt, callee));

                // 任何一个 callee 没有使用 fact, 就需要在方法外传播
                const invokeExpr = callStmt.getInvokeExpr()!;
                const args = invokeExpr.getArgs();
                const hasCalleeNotUsingFact = args.every(arg => arg !== fact.getAccessPath().getBase()) &&
                    (invokeExpr instanceof ArkInstanceInvokeExpr && invokeExpr.getBase() !== fact.getAccessPath().getBase())

                if (fact.getAccessPath().isLocal() ||
                    isPrimitive ||
                    calleeIsExcluded ||
                    hasCalleeNotUsingFact
                ) {
                    result.add(fact);
                }

                return result;
            }
        };
    }

    private handleAssignStmt(stmt: ArkAssignStmt, currFact: TaintFact, ctxNode: PathEdgePoint<TaintFact>): Set<TaintFact> {
        const lhs = stmt.getLeftOp();
        const rhs = stmt.getRightOp();

        // 处理 fact 为隐式污点的情况
        if (currFact.getTopPostdominator()?.getStmt() || currFact.getAccessPath().isEmpty()) {
            const inMethodOfTaintedCondition = ctxNode.fact.getAccessPath().isEmpty();
            if (inMethodOfTaintedCondition && lhs instanceof Local) {
                // 如果在方法内部, 且是局部变量, 则无需传播受污染的 lhs
                return new Set([currFact]);
            }

            if (currFact.getAccessPath().isEmpty()) {
                const newFact = this.taintLhs(stmt, currFact, ctxNode);
                if (newFact) {
                    return new Set([newFact]);
                } else {
                    return new Set();
                }
            }
        }

        if (!currFact.isActive()) {
            const ap = currFact.getAccessPath();
            if (!ap.isInstanceFieldRef() && !ap.isArrayTaintedByElement()) {
                return new Set([currFact]);
            }
        }

        // 提取出 rhs 的所有操作数. 如 y = a + b 中的 [a, b]
        const rightValues = findBaseValues(rhs);
        const result: Set<TaintFact> = new Set();

        for (const rv of rightValues) {
            if (rv instanceof ArkInstanceFieldRef) {
                // rv 为实例字段型, 如 x.y

                // 判断 currFact 是否为 rv 或者 rv 的字段
                // 如 currFact = x.y, rv = x.y
                // 如 currFact = x.y.z, rv = x.y
                const mappedAP = currFact.getAccessPath().isContainedByValue(rv);

                if (mappedAP) {
                    // 若 currFact = x.y, rv = x.y, 则 newAP 为 lhs
                    // 若 currFact = x.y.z, rv = x.y, 则 newAP 为 lhs.z
                    // 需要砍掉第一个字段 f
                    // TODO: 处理递归型字段的情况, 如 Node {next: Node; data: string}, rv = x.next, 此时可能不砍字段
                    const lhsFact = this.taintLhs(stmt, currFact, ctxNode, { cutFirstField: true });
                    lhsFact && result.add(lhsFact);
                } else if (true) {
                    // 此时 currFact 不是 rv 的字段
                    // 判断 rv 是否是 currFact 的字段
                    // 如 currFact = x, rv = x.y
                    if (
                        (
                            !currFact.getAccessPath().getFields() || currFact.getAccessPath().getFields()?.length === 0
                        )
                        && currFact.getAccessPath().getBase() === rv.getBase()
                    ) {
                        // newAP 为 lhs
                        const lhsFact = this.taintLhs(stmt, currFact, ctxNode);
                        lhsFact && result.add(lhsFact);
                    }
                }
            } else if (rv instanceof ArkStaticFieldRef) {
                // rv 为静态字段型, 如 X.y
                // 判断 currFact 是否为该静态字段或该静态字段的子字段
                const mappedAP = AccessPath.staticFieldRefContainsAccessPath(rv, currFact.getAccessPath());
                if (mappedAP) {
                    // currFact = X.y(.z), rv = X.y, 则 newAP = lhs(.z)
                    const lhsFact = this.taintLhs(stmt, currFact, ctxNode, { cutFirstField: true });
                    lhsFact && result.add(lhsFact);
                }
            } else if (rv instanceof Local && currFact.getAccessPath().isInstanceFieldRef()) {
                // rv 为 Local, currFact 为实例字段型

                // 判断 currFact 是否为 rv 的字段
                // 如 currFact = x.y, rv = x
                if (currFact.getAccessPath().getBase() === rv) {
                    // newAP 为 lhs.y
                    const lhsFact = this.taintLhs(stmt, currFact, ctxNode);
                    lhsFact && result.add(lhsFact);
                }
            } else {
                // rv 为 Local, currFact 为 Local
                if (currFact.getAccessPath().isLocal() && currFact.getAccessPath().getBase() === rv) {
                    const lhsFact = this.taintLhs(stmt, currFact, ctxNode);
                    lhsFact && result.add(lhsFact);
                }
            }
        }

        return result;
    }

    private taintLhs(stmt: ArkAssignStmt, fact: TaintFact, ctxNode: PathEdgePoint<TaintFact>, options?: any): TaintFact | undefined {
        const lhs = stmt.getLeftOp();
        const rhs = stmt.getRightOp();

        // Do not taint static fields unless the option is enabled
        if (lhs instanceof ArkStaticFieldRef && this.ifdsManager.getConfig().staticFieldTrackingMode === StaticFieldTrackingMode.None) {
            return;
        }

        let newFact: TaintFact | undefined = undefined;

        if (fact.getAccessPath().isEmpty()) {
            if (lhs instanceof ArkArrayRef) {
                // TODO: 按情况升维污点类型 - targetType(待添加参数)
            }
            // TODO: 处理其他特殊类型 rhs 情况下的 targetType 
        }

        if (!newFact) {
            if (fact.getAccessPath().isEmpty()) {
                // TODO: 生成隐式污点
            } else {
                if (lhs instanceof ArkArrayRef) {
                    // 形如 a[i] = taintedVar
                    const newAP = AccessPath.createElementTaintedArrayAccessPath(lhs.getBase());
                    newAP && (newFact = fact.deriveWithNewAccessPath(newAP, lhs, stmt));
                } else {
                    let fields = fact.getAccessPath().getFields();
                    let newFields = undefined;
                    if (fields) {
                        newFields = [...fields];
                        options?.cutFirstField && newFields.shift();
                    }
                    const newAP = AccessPath.createAccessPath(lhs, newFields);
                    newAP && (newFact = fact.deriveWithNewAccessPath(newAP, lhs, stmt));
                }
            }
        }

        if (newFact) {
            if (lhs instanceof ArkStaticFieldRef && this.ifdsManager.getConfig().staticFieldTrackingMode === StaticFieldTrackingMode.ContextFlowSensitive) {
                // ContextFlowSensitive 模式: 静态字段写入也需触发别名分析
                const aliasing = this.ifdsManager.getAliasing();
                if (aliasing) {
                    const taintSet = new Set<TaintFact>();
                    taintSet.add(newFact);
                    const method = stmt.getCfg().getDeclaringMethod();
                    aliasing.computeAliases(ctxNode, stmt, lhs, taintSet, method, newFact);
                }
            } else {
                // ★ 追踪别名：触发别名分析
                const aliasing = this.ifdsManager.getAliasing();
                if (aliasing) {
                    const taintSet = new Set<TaintFact>();
                    taintSet.add(newFact);
                    const method = stmt.getCfg().getDeclaringMethod();
                    aliasing.computeAliases(ctxNode, stmt, lhs, taintSet, method, newFact);
                }
            }
        }

        return newFact;
    }

    /**
     * 将 fact 从 caller 上下文传播到 callee 上下文
     */
    private transFactsFromCallerToCallee(srcStmt: Stmt, method: ArkMethod, fact: TaintFact): Set<TaintFact> {
        const accessPathToValueMap = new Map<AccessPath, Value>();
        const res: Set<TaintFact> = new Set();

        if (fact.getAccessPath().isEmpty() || !srcStmt.getInvokeExpr() || !method.getBody()) {
            return res;
        }

        if (fact.getAccessPath().isStaticFieldRef()) {
            // 静态字段 fact 由 StaticPropagationRule 在 applyCallRule 中处理
            return res;
        }

        const aliasing = this.ifdsManager.getAliasing();
        if (!aliasing) {
            return res;
        }

        const invokeExpr = srcStmt.getInvokeExpr()!;
        const factBase = fact.getAccessPath().getBase();
        const factFields = [...(fact.getAccessPath().getFields() ?? [])];

        // 若是实例方法调用, 如 obj.method(), 且 fact 的 base 为 obj, 将 fact 的 base 改为 method 的 thisLocal
        if (invokeExpr instanceof ArkInstanceInvokeExpr) {
            if (factBase === invokeExpr.getBase()) {
                // 获取 method 的 thisLocal
                const calleeThisLocal = method.getBody()!.getLocals().get(THIS_NAME);
                if (calleeThisLocal) {
                    // AP{base=obj} -> AP{base=this}
                    const newAccessPath = AccessPath.createAccessPath(calleeThisLocal, factFields);
                    newAccessPath && accessPathToValueMap.set(newAccessPath, calleeThisLocal);
                }
            }
        }

        // 若某个实参 与 fact 的 base 相同, 则创建 AP{base=paramLocal, fields=factFields}
        invokeExpr.getArgs().forEach((arg, i) => {
            if (arg === factBase) {
                const paramLocal = this.findParamLocal(method, i);
                if (paramLocal) {
                    const newAccessPath = AccessPath.createAccessPath(paramLocal, factFields);
                    newAccessPath && accessPathToValueMap.set(newAccessPath, paramLocal);
                }
            }
        });

        accessPathToValueMap.forEach((value, ap) => {
            const newFact = fact.deriveWithNewAccessPath(ap, value, srcStmt);
            newFact && res.add(newFact);
            // TODO: 处理情况 - If the variable is never read in the callee, there is no need to propagate it through
        });

        return res;
    }

    /**
     * 将 fact 从 caller 上下文传播到 callee 上下文
     */
    private transFactsFromCalleeToCaller(srcStmt: Stmt, callStmt: Stmt, fact: TaintFact, callerEdge: PathEdge<TaintFact>): Set<TaintFact> {
        const result: Set<TaintFact> = new Set();

        const factBase = fact.getAccessPath().getBase();
        const factFields = [...(fact.getAccessPath().getFields() ?? [])];
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
                let leftOpStr: string;
                leftOp instanceof Local && (leftOpStr = leftOp.getName());
                let newFact: TaintFact | undefined = undefined;
                const newAP = AccessPath.createAccessPath(leftOp, factFields);
                newAP && (newFact = fact.deriveWithNewAccessPath(newAP, leftOp, srcStmt));
                if (newFact) {
                    result.add(newFact);
                    if (aliasing) {
                        const taintSet = new Set<TaintFact>();
                        taintSet.add(newFact);
                        aliasing.computeAliases(
                            callerEdge.edgeStart,
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

            const ap = fact.getAccessPath();
            if (!ap.isInstanceFieldRef() && !ap.isArrayTaintedByElement()) {
                return;
            }

            const paramLocal = this.findParamLocal(callee, i);
            if (!paramLocal || factBase !== paramLocal) {
                return;
            }

            // 如果 callee 内部覆写了参数, 则不传回 caller
            // body 的 {param.length + 1} 条语句是 param Local 和 this Local 的定义语句, 不算在内
            const idxOfNormalStmtStart: number = callee.getParameters().length + 1;
            const stmts = callee.getBody()!.getCfg().getStmts();
            for (let i = idxOfNormalStmtStart; i < stmts.length; ++i) {
                const s = stmts[i];
                if (s instanceof ArkAssignStmt && s.getLeftOp() === paramLocal) {
                    return;
                }
            }

            let newFact: TaintFact | undefined = undefined;
            const newAP = AccessPath.createAccessPath(arg, factFields);
            newAP && (newFact = fact.deriveWithNewAccessPath(newAP, arg, srcStmt));
            if (newFact) {
                result.add(newFact);
                if (aliasing) {
                    const taintSet = new Set<TaintFact>();
                    taintSet.add(newFact);
                    aliasing.computeAliases(
                        callerEdge.edgeStart,
                        callStmt,
                        arg,
                        taintSet,
                        callee,
                        newFact
                    );
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
                let newFact: TaintFact | undefined = undefined;
                const newAP = AccessPath.createAccessPath(callerBase, factFields);
                newAP && (newFact = fact.deriveWithNewAccessPath(newAP, callerBase, srcStmt));
                if (newFact) {
                    result.add(newFact);
                    if (aliasing) {
                        const taintSet = new Set<TaintFact>();
                        taintSet.add(newFact);
                        aliasing.computeAliases(
                            callerEdge.edgeStart,
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
}
