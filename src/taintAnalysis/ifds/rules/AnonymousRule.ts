import { ArkInstanceInvokeExpr } from "../../../core/base/Expr";
import { Local } from "../../../core/base/Local";
import { ArkAssignStmt, Stmt } from "../../../core/base/Stmt";
import { ClosureType, LexicalEnvType } from "../../../core/base/Type";
import { CONSTRUCTORFUCNNAME, INSTANCE_INIT_METHOD_NAME } from "../../../core/common/Const";
import { THIS_NAME } from "../../../core/common/TSConst";
import { ArkMethod } from "../../../core/model/ArkMethod";
import { findBaseValues } from "../../util";
import { AccessPath } from "../AccessPath";
import { FactAtSink } from "../FactAtSink";
import { TaintFact } from "../TaintFact";
import { AbstractRule, FactKillingStatus } from "./Rule";

/**
 * 处理匿名类(对象字面量), 匿名函数(箭头函数), 按需传入外部变量或闭包
 */
export class AnonymousRule extends AbstractRule {
    // 箭头函数中闭包例子:
    // %AM0(%closures0: [outerLocal1, outerLocal2]): void {
    //     %closures0 = parameter0: [outerLocal1, outerLocal2]
    //     outerLocal1 = %closures0.outerLocal1
    //     outerLocal2 = %closures0.outerLocal2
    //     this = this: @...
    //     ...
    // }

    /**
     * %closures0.outerLocal -> outerLocal
     */
    private localToClosureMap: Map<ArkMethod, Map<Local, Local>> = new Map();

    /**
     * 箭头函数中 this -> 定义箭头函数时的 this
     */
    private innerThisToOuterThisMap: Map<ArkMethod, Local[]> = new Map();

    /**
     * 处理匿名类(对象字面量)的构造函数、实例初始化方法中对外部变量的访问
     */
    applyNormalRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        if (!(srcStmt instanceof ArkAssignStmt)) {
            return;
        }

        const method = srcStmt.getCfg().getDeclaringMethod();
        if (!this.isMethodOfAnonymousClass(method) || !this.isConstructorOrInstanceInitMethod(method)) {
            return;
        }

        const lhs = srcStmt.getLeftOp();
        const rightValues = findBaseValues(srcStmt.getRightOp())

        // 处理匿名类初始化方法中的跨方法同名变量等价性
        // 在匿名类的 instanceInitMethod 中，引用外层方法变量时创建了新的 Local 对象（名字相同），
        // 需要通过名字匹配来实现语义等价性判定
        if (fact.getAccessPath().isLocal()) {
            const factBase = fact.getAccessPath().getBase();
            rightValues.forEach(rv => {
                if (rv instanceof Local && factBase!.getName() === rv.getName()) {
                    const newAP = AccessPath.createAccessPath(lhs);
                    let newFact: TaintFact | undefined = undefined;
                    newAP && (newFact = fact.deriveWithNewAccessPath(newAP, lhs, srcStmt));
                    newFact && result.add(newFact);
                }
            });
        }
    }

    applyCallRule(srcStmt: Stmt, method: ArkMethod, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        // 将 fact 传入匿名类(对象字面量)的构造函数和实例初始化方法中
        if (this.isMethodOfAnonymousClass(method) &&
            this.isConstructorOrInstanceInitMethod(method) &&
            fact.getAccessPath().isLocal()
        ) {
            result.add(fact);
        }

        // 处理 call(() => {})
        // 如果 call 的参数有箭头函数, 需要传入 this 和闭包 Locals (if tainted)
        const invokeExpr = srcStmt.getInvokeExpr();
        fact.getAccessPath().isLocal() && invokeExpr?.getArgs().forEach(arg => {
            const argType = arg.getType();
            if (argType instanceof ClosureType) {
                const closureLocals = argType.getLexicalEnv().getClosures();
                closureLocals.forEach(cloLocal => {
                    if (cloLocal === fact.getAccessPath().getBase()) {
                        result.add(fact);
                    }
                });
            }
        });

        // 当参数有闭包时, 需要注册闭包 Local
        if (this.methodHasClosure(method) && method.getCfg()) {
            const cfg = method.getCfg()!;

            let local2CloMap = this.localToClosureMap.get(method);
            if (!local2CloMap) {
                local2CloMap = new Map<Local, Local>();
                this.localToClosureMap.set(method, local2CloMap);
            }
            const cloLocals = this.findClosureLocals(method);
            cloLocals.forEach((clo, idx) => {
                const defStmt = cfg.getStmts()[idx + 1];
                if (defStmt && defStmt instanceof ArkAssignStmt) {
                    const localFromClo = defStmt.getLeftOp();
                    localFromClo instanceof Local && local2CloMap.set(localFromClo, clo);

                    // if clo tainted, then localFromClo tainted
                    if (fact.getAccessPath().isLocal() && fact.getAccessPath().getBase() === clo) {
                        const newAP = AccessPath.createAccessPath(localFromClo);
                        let newFact: TaintFact | undefined = undefined;
                        newAP && (newFact = fact.deriveWithNewAccessPath(newAP, localFromClo, srcStmt));
                        newFact && result.add(newFact);
                    }
                }
            });
        }

        // 将箭头函数的 this 映射到定义时的 this
        if (method.isAnonymousMethod()) {
            const outerThis = method.getOuterMethod()?.getBody()?.getLocals().get(THIS_NAME);
            const innerThis = method.getBody()?.getLocals().get(THIS_NAME);
            if (outerThis && innerThis) {
                let innerToOuter = this.innerThisToOuterThisMap.get(method);
                if (!innerToOuter) {
                    innerToOuter = new Array<Local>(2);
                    this.innerThisToOuterThisMap.set(method, innerToOuter);
                }
                innerToOuter[0] = innerThis;
                innerToOuter[1] = outerThis;
            }
        }
    }

    applyReturnRule(srcStmt: Stmt, tgtStmt: Stmt, callStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
        // 若 fact 来自闭包, 需传回 caller
        const method = srcStmt.getCfg().getDeclaringMethod();
        const clo2LocalMap = this.localToClosureMap.get(method);
        clo2LocalMap?.forEach((cloLocal, localFromClo) => {
            if (localFromClo === fact.getAccessPath().getBase() || cloLocal === fact.getAccessPath().getBase()) {
                const fields = [...fact.getAccessPath().getFields() ?? []];
                const cloAP = AccessPath.createAccessPath(cloLocal, fields);
                let newFact: TaintFact | undefined = undefined;
                cloAP && (newFact = fact.deriveWithNewAccessPath(cloAP, cloLocal, srcStmt));
                newFact && result.add(newFact);
            }
        });

        // 若 fact 来自 this, 需传回 caller
        // TODO: 未解决缺陷: 若箭头函数是某个 m 的参数且 outerThis 不是 m 的 this, 当退出 m 时, 还没有把 outerThis 传回 m 的 caller
        const innerThisToOuter = this.innerThisToOuterThisMap.get(method);
        if (innerThisToOuter) {
            const innerThis = innerThisToOuter[0];
            const outerThis = innerThisToOuter[1];
            if (innerThis === fact.getAccessPath().getBase()) {
                const fields = [...fact.getAccessPath().getFields() ?? []];
                const newAP = AccessPath.createAccessPath(outerThis, fields);
                let newFact: TaintFact | undefined = undefined;
                newAP && (newFact = fact.deriveWithNewAccessPath(newAP, outerThis, srcStmt));
                newFact && result.add(newFact);
            }
        }

        // 处理 call(() => {})
        // 如果 call 的参数有箭头函数, 需要传出闭包 Locals (if tainted)
        const invokeExpr = callStmt.getInvokeExpr();
        fact.getAccessPath().isLocal() && invokeExpr?.getArgs().forEach(arg => {
            const argType = arg.getType();
            if (argType instanceof ClosureType) {
                const closureLocals = argType.getLexicalEnv().getClosures();
                closureLocals.forEach(cloLocal => {
                    if (cloLocal === fact.getAccessPath().getBase()) {
                        result.add(fact);
                    }
                });
            }
        });
    }

    applyCallToReturnRule(srcStmt: Stmt, tgtStmt: Stmt, fact: TaintFact, result: Set<TaintFact>, factKillingStatus: FactKillingStatus): void {
    }

    private isMethodOfAnonymousClass(method: ArkMethod): boolean {
        return method.getDeclaringArkClass().isAnonymousClass();
    }

    private isConstructorOrInstanceInitMethod(method: ArkMethod): boolean {
        return method.getSubSignature().getMethodName() === CONSTRUCTORFUCNNAME ||
            method.getSubSignature().getMethodName() === INSTANCE_INIT_METHOD_NAME;
    }

    private methodHasClosure(method: ArkMethod): boolean {
        return method.getParameters()[0] &&
            method.getParameters()[0].getType() instanceof LexicalEnvType;
    }

    private findClosureLocals(method: ArkMethod): Local[] {
        if (!this.methodHasClosure(method)) {
            return [];
        }

        // 若有闭包, 第一个参数为闭包数组
        const firstParam = method.getParameters()[0];
        const firstParamType = firstParam.getType();
        if (firstParamType instanceof LexicalEnvType) {
            return firstParamType.getClosures();
        }

        return [];
    }
}
