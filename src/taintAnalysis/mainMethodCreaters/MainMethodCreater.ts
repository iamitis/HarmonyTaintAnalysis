import { Logger } from "../..";
import { ArkConditionExpr, RelationalBinaryOperator, ArkNewExpr, ArkInstanceInvokeExpr, ArkStaticInvokeExpr } from "../../core/base/Expr";
import { Local } from "../../core/base/Local";
import { ArkIfStmt, ArkAssignStmt, ArkInvokeStmt } from "../../core/base/Stmt";
import { AliasType, ClassType, Type } from "../../core/base/Type";
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
    classToLocalMap: Map<ArkClass, Local>;
}

export interface MainMethodCreater {
    createMainMethod(): ArkMethod | null;
    addStmtsToCfg(): void;
}

export abstract class BaseMainMethodCreater implements MainMethodCreater {
    protected cfgContext: CFGContext | null = null;

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
     * 在 CFG 中创建 do-while 循环结构
     * 
     * 结构：
     * currentBlock:
     *   ...之前的语句...
     *   → loopBlock
     * 
     * loopBlock:                         ← 循环入口
     *   <body() 添加的语句>
     *   if (0 != 0) goto loopBlock        ← true: 回边
     *              else goto loopExitBlock ← false: 退出
     * 
     * loopExitBlock:
     *   ...后续语句...
     * 
     * @param body 循环体的回调函数
     */
    protected wrapWithDoWhileLoop(body: () => void): void {
        if (!this.cfgContext) {
            logger.warn('CFGContext is null');
            return;
        }

        // 创建循环体 block 和循环出口 block
        const loopBlock = new BasicBlock();
        loopBlock.setId(this.cfgContext.nextBlockId++);
        const loopExitBlock = new BasicBlock();
        loopExitBlock.setId(this.cfgContext.nextBlockId++);
        this.cfgContext.cfg.addBlock(loopBlock);
        this.cfgContext.cfg.addBlock(loopExitBlock);

        // currentBlock → loopBlock（进入循环）
        this.cfgContext.currentBlock.addSuccessorBlock(loopBlock);
        loopBlock.addPredecessorBlock(this.cfgContext.currentBlock);

        // 保存 loopBlock 引用，供回边使用
        const loopEntry = loopBlock;

        // 切换到 loopBlock，执行 body
        this.cfgContext.currentBlock = loopBlock;
        body();

        // body 执行后 currentBlock 可能已改变（如 body 内部嵌套了 wrapWithIfBranch）
        const lastBodyBlock = this.cfgContext.currentBlock;

        // 在 body 最后停留的 block 末尾添加 if 语句
        // TODO: 修改 condition
        const zero = ValueUtil.getOrCreateNumberConst(0);
        const condition = new ArkConditionExpr(zero, zero, RelationalBinaryOperator.InEquality);
        const ifStmt = new ArkIfStmt(condition);
        lastBodyBlock.addStmt(ifStmt);

        // true 分支：回边到 loopBlock
        lastBodyBlock.addSuccessorBlock(loopEntry);
        loopEntry.addPredecessorBlock(lastBodyBlock);

        // false 分支：退出到 loopExitBlock
        lastBodyBlock.addSuccessorBlock(loopExitBlock);
        loopExitBlock.addPredecessorBlock(lastBodyBlock);

        // 后续语句添加到 loopExitBlock
        this.cfgContext.currentBlock = loopExitBlock;
    }

    /**
     * 获取或创建类的 Local 变量，并添加实例化 + 构造函数调用
     */
    protected getOrCreateClassLocal(cls: ArkClass): Local {
        if (!this.cfgContext) {
            throw new Error('CFGContext is null');
        }

        if (this.cfgContext.classToLocalMap.has(cls)) {
            return this.cfgContext.classToLocalMap.get(cls)!;
        }

        const clsType = new ClassType(cls.getSignature());
        const local = new Local('%' + cls.getName() + this.cfgContext.tempLocalIndex++, clsType);
        this.cfgContext.classToLocalMap.set(cls, local);

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
     * 
     * 对于 ClassType 参数，创建 new 表达式赋值；
     * 对于非 ClassType 参数，尝试从父类同名方法获取正确的 ClassType，
     * 并递归展开 AliasType 获取其 originalType 中的 ClassType。
     */
    protected createParamLocals(method: ArkMethod): Local[] {
        if (!this.cfgContext) {
            throw new Error('CFGContext is null');
        }

        const paramLocals: Local[] = [];
        const params = method.getParameters();

        for (let i = 0; i < params.length; i++) {
            let paramType: Type = params[i].getType();

            // 若参数类型不是 ClassType，尝试从父类同名方法获取（SDK 方法通常有正确的 ClassType）
            if (!(paramType instanceof ClassType)) {
                paramType = this.resolveParamType(method, i, paramType);
            }

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
     * 尝试将参数类型解析为 ClassType
     * 策略：
     * 1. 从父类同名方法获取参数类型（SDK 中的方法通常有正确的 ClassType）
     * 2. 递归展开 AliasType 获取 originalType
     */
    private resolveParamType(method: ArkMethod, paramIndex: number, paramType: Type): Type {
        // 1. 尝试从父类同名方法获取参数类型
        const superCls = method.getDeclaringArkClass().getSuperClass();
        const methodInSuperCls = superCls?.getMethodWithName(method.getName());
        if (methodInSuperCls) {
            const superParamType = methodInSuperCls.getParameters()[paramIndex]?.getType();
            if (superParamType instanceof ClassType) {
                return superParamType;
            }
            // 父类方法的参数类型也不是 ClassType 时，用父类类型继续尝试解析
            if (superParamType && !(superParamType instanceof ClassType)) {
                paramType = superParamType;
            }
        }

        // 2. 递归展开 AliasType，获取其 originalType 中的 ClassType
        if (paramType instanceof AliasType) {
            const resolved = this.resolveAliasType(paramType);
            if (resolved instanceof ClassType) {
                return resolved;
            }
        }

        return paramType;
    }

    /**
     * 递归展开 AliasType，返回其 originalType 链中的 ClassType
     */
    private resolveAliasType(type: AliasType): Type {
        const originalType = type.getOriginalType();
        if (originalType instanceof ClassType) {
            return originalType;
        }
        if (originalType instanceof AliasType) {
            return this.resolveAliasType(originalType);
        }
        return type;
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
