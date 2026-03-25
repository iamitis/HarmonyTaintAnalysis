import { Logger } from "../..";
import { ArkConditionExpr, RelationalBinaryOperator, ArkNewExpr, ArkInstanceInvokeExpr, ArkStaticInvokeExpr } from "../../core/base/Expr";
import { Local } from "../../core/base/Local";
import { ArkIfStmt, ArkAssignStmt, ArkInvokeStmt } from "../../core/base/Stmt";
import { ClassType, Type } from "../../core/base/Type";
import { CONSTRUCTOR_NAME } from "../../core/common/TSConst";
import { ValueUtil } from "../../core/common/ValueUtil";
import { BasicBlock } from "../../core/graph/BasicBlock";
import { Cfg } from "../../core/graph/Cfg";
import { ArkClass } from "../../core/model/ArkClass";
import { ArkMethod } from "../../core/model/ArkMethod";
import { LOG_MODULE_TYPE } from "../../utils/logger";
import { Callback } from "../CallbackCollector";

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'MainMethodCreater');

/**
 * CFG 构建上下文，用于在各个 mainMethodCreater 之间共享状态
 */
export interface CFGContext {
    cfg: Cfg;
    currentBlock: BasicBlock;
    tempLocalIndex: number;
    nextBlockId: number;
}

export interface MainMethodCreater {
    createMainMethod(): ArkMethod | null;
    addStmtsToCfg(): void;
}

export abstract class BaseMainMethodCreater implements MainMethodCreater {
    protected cfgContext: CFGContext | null = null;
    protected classToLocalMap: Map<ArkClass, Local> = new Map();

    // TODO: 是否像 FlowDroid 一样单独创建 method，然后再 invoke
    public createMainMethod(): ArkMethod | null {
        return null;
    }

    public addStmtsToCfg(): void { }

    /**
     * 在 CFG 中创建条件分支结构
     * 
     * 结构：
     * currentBlock:
     *   ...之前的语句...
     *   if (0 != 0) goto trueBlock else goto falseBlock
     * 
     * trueBlock:
     *   trueBody()
     *   goto continueBlock
     * 
     * falseBlock:
     *   ...后续语句...
     * 
     * @param trueBody true 分支的回调函数
     */
    protected wrapWithIfBranch(trueBody: () => void): void {
        if (!this.cfgContext) {
            logger.warn('CFGContext is null');
            return;
        }

        // TODO: 修改 condition
        const zero = ValueUtil.getOrCreateNumberConst(0);
        const condition = new ArkConditionExpr(zero, zero, RelationalBinaryOperator.InEquality);
        const ifStmt = new ArkIfStmt(condition);
        this.cfgContext.currentBlock.addStmt(ifStmt);

        const trueBlock = new BasicBlock();
        trueBlock.setId(this.cfgContext.nextBlockId++);
        const falseBlock = new BasicBlock();
        falseBlock.setId(this.cfgContext.nextBlockId++);
        this.cfgContext.cfg.addBlock(trueBlock);
        this.cfgContext.cfg.addBlock(falseBlock);

        this.cfgContext.currentBlock.addSuccessorBlock(trueBlock);
        this.cfgContext.currentBlock.addSuccessorBlock(falseBlock);
        trueBlock.addPredecessorBlock(this.cfgContext.currentBlock);
        falseBlock.addPredecessorBlock(this.cfgContext.currentBlock);

        this.cfgContext.currentBlock = trueBlock;

        trueBody();


        this.cfgContext.currentBlock.addSuccessorBlock(falseBlock);
        falseBlock.addPredecessorBlock(this.cfgContext.currentBlock);

        this.cfgContext.currentBlock = falseBlock;
    }

    /**
     * 获取或创建类的 Local 变量，并添加实例化 + 构造函数调用
     */
    protected getOrCreateClassLocal(cls: ArkClass): Local {
        if (!this.cfgContext) {
            throw new Error('CFGContext is null');
        }

        if (this.classToLocalMap.has(cls)) {
            return this.classToLocalMap.get(cls)!;
        }

        const clsType = new ClassType(cls.getSignature());
        const local = new Local('%' + this.cfgContext.tempLocalIndex++, clsType);
        this.classToLocalMap.set(cls, local);

        // 添加实例化语句
        const assStmt = new ArkAssignStmt(local, new ArkNewExpr(clsType));
        this.cfgContext.currentBlock.addStmt(assStmt);
        local.setDeclaringStmt(assStmt);

        // 添加构造函数调用
        const consMtd = cls.getMethodWithName(CONSTRUCTOR_NAME);
        if (consMtd) {
            const ivkExpr = new ArkInstanceInvokeExpr(local, consMtd.getSignature(), []);
            const ivkStmt = new ArkInvokeStmt(ivkExpr);
            this.cfgContext.currentBlock.addStmt(ivkStmt);
        }

        return local;
    }

    /**
     * 添加生命周期方法调用
     */
    protected addLifecycleCalls(cls: ArkClass, local: Local, lifecycleNames: string[]): void {
        if (!this.cfgContext) {
            throw new Error('CFGContext is null');
        }

        for (const methodName of lifecycleNames) {
            const method = cls.getMethodWithName(methodName);
            if (method) {
                const paramLocals = this.createParamLocals(method);
                const ivkExpr = new ArkInstanceInvokeExpr(local, method.getSignature(), paramLocals);
                const ivkStmt = new ArkInvokeStmt(ivkExpr);
                this.cfgContext.currentBlock.addStmt(ivkStmt);
            }
        }
    }

    /**
     * 为方法参数创建 Local 变量
     */
    protected createParamLocals(method: ArkMethod): Local[] {
        if (!this.cfgContext) {
            throw new Error('CFGContext is null');
        }

        const paramLocals: Local[] = [];
        for (const param of method.getParameters()) {
            let paramType: Type | undefined = param.getType();
            const paramLocal = new Local('%' + this.cfgContext.tempLocalIndex++, paramType);
            paramLocals.push(paramLocal);

            if (paramType instanceof ClassType) {
                const assStmt = new ArkAssignStmt(paramLocal, new ArkNewExpr(paramType));
                paramLocal.setDeclaringStmt(assStmt);
                this.cfgContext.currentBlock.addStmt(assStmt);
            }
        }
        return paramLocals;
    }

    /**
     * 添加回调方法调用
     */
    protected addCallbackInvoke(callback: Callback): void {
        if (!this.cfgContext) {
            throw new Error('CFGContext is null');
        }

        const method = callback.function;
        const declaringClass = method.getDeclaringArkClass();
        const paramLocals = this.createParamLocals(method);

        if (declaringClass.isDefaultArkClass() || method.isStatic()) {
            const ivkExpr = new ArkStaticInvokeExpr(method.getSignature(), paramLocals);
            const ivkStmt = new ArkInvokeStmt(ivkExpr);
            this.cfgContext.currentBlock.addStmt(ivkStmt);
        } else {
            const local = this.getOrCreateClassLocal(declaringClass);
            const ivkExpr = new ArkInstanceInvokeExpr(local, method.getSignature(), paramLocals);
            const ivkStmt = new ArkInvokeStmt(ivkExpr);
            this.cfgContext.currentBlock.addStmt(ivkStmt);
        }
    }
}
