import { Scene, ArkFile, Logger, LOG_MODULE_TYPE, Local, NumberType, ValueUtil } from "../..";
import { ArkStaticInvokeExpr } from "../../core/base/Expr";
import { ArkReturnVoidStmt, ArkInvokeStmt, ArkAssignStmt } from "../../core/base/Stmt";
import { BasicBlock } from "../../core/graph/BasicBlock";
import { Cfg } from "../../core/graph/Cfg";
import { ArkBody } from "../../core/model/ArkBody";
import { ArkClass } from "../../core/model/ArkClass";
import { Language } from "../../core/model/ArkFile";
import { ArkMethod } from "../../core/model/ArkMethod";
import { FileSignature, ClassSignature, MethodSignature } from "../../core/model/ArkSignature";
import { checkAndUpdateMethod } from "../../core/model/builder/ArkMethodBuilder";
import { ArkSignatureBuilder } from "../../core/model/builder/ArkSignatureBuilder";
import { addCfg2Stmt } from "../../utils/entryMethodUtils";
import { Callback } from "../CallbackCollector";
import { BackupExtensionAbilityMainMethodCreater } from "./extensionAbilities/BackupExtensionAbilityMainMethodCreater";
import { FormExtensionAbilityMainMethodCreater } from "./extensionAbilities/FormExtensionAbilityMainMethodCreater";
import { BaseMainMethodCreater, MainMethodCreater, CFGContext } from "./MainMethodCreater";
import { UIAbilityMainMethodCreater } from "./UIAbilityMainMethodCreater";

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'HarmonyMainMethodCreater');

/**
 * 创建 Harmony 应用的虚拟主方法
 * 
 * 结构：
 * ForEach Ability {
 *   Ability 前序生命周期
 * 
 *   ForEach Component of Ability {
 *     Component 前序生命周期
 *     ForEach Callback { Callback 调用 }
 *     Component 后序生命周期
 *   }
 * 
 *   ForEach Builder of Ability {
 *     Builder 前序生命周期
 *     ForEach Callback { Callback 调用 }
 *     Builder 后序生命周期
 *   }
 * 
 *   Ability 后序生命周期
 * }
 */
export class HarmonyMainMethodCreater extends BaseMainMethodCreater {
    private dummyMain: ArkMethod = new ArkMethod();

    constructor(
        private scene: Scene,
        private abilities: ArkClass[] = [],
        private abilityToComponentsMap: Map<ArkClass, Set<ArkClass>> = new Map<ArkClass, Set<ArkClass>>(),
        private abilityToBuildersMap: Map<ArkClass, Set<ArkMethod>> = new Map<ArkClass, Set<ArkMethod>>(),
        private componentToCallbacksMap: Map<ArkClass, Set<Callback>> = new Map<ArkClass, Set<Callback>>(),
        private builderToCallbacksMap: Map<ArkMethod, Set<Callback>> = new Map<ArkMethod, Set<Callback>>()
    ) {
        super();
    }

    public createMainMethod(): ArkMethod | null {
        if (this.abilities.length === 0) {
            return null;
        }

        // 1. 创建虚拟的 ArkFile 和 ArkClass
        const dummyMainFile = new ArkFile(Language.JAVASCRIPT);
        dummyMainFile.setScene(this.scene);
        const dummyMainFileSignature = new FileSignature(this.scene.getProjectName(), '@harmonyDummyFile');
        dummyMainFile.setFileSignature(dummyMainFileSignature);
        this.scene.setFile(dummyMainFile);

        const dummyMainClass = new ArkClass();
        dummyMainClass.setDeclaringArkFile(dummyMainFile);
        const dummyMainClassSignature = new ClassSignature(
            '@harmonyDummyClass',
            dummyMainClass.getDeclaringArkFile().getFileSignature(),
            dummyMainClass.getDeclaringArkNamespace()?.getSignature() ?? null
        );
        dummyMainClass.setSignature(dummyMainClassSignature);
        dummyMainFile.addArkClass(dummyMainClass);
        dummyMainFile.setDefaultClass(dummyMainClass);

        // 2. 创建虚拟的 ArkMethod
        this.dummyMain = new ArkMethod();
        this.dummyMain.setDeclaringArkClass(dummyMainClass);
        const methodSubSignature = ArkSignatureBuilder.buildMethodSubSignatureFromMethodName('@harmonyDummyMain');
        const methodSignature = new MethodSignature(this.dummyMain.getDeclaringArkClass().getSignature(), methodSubSignature);
        this.dummyMain.setImplementationSignature(methodSignature);
        this.dummyMain.setLineCol(0);
        checkAndUpdateMethod(this.dummyMain, dummyMainClass);
        dummyMainClass.addMethod(this.dummyMain);

        // 3. 创建 CFG 和构建上下文
        const cfg = new Cfg();
        cfg.setDeclaringMethod(this.dummyMain);

        const firstBlock = new BasicBlock();
        firstBlock.setId(0);
        cfg.addBlock(firstBlock);

        // 设置计数变量用于创建条件表达式，并设置 Cfg.startingStmt!
        const countLocal = new Local('harmonyDummyMainCount', NumberType.getInstance());
        const zero = ValueUtil.getOrCreateNumberConst(0);
        const countAssignStmt = new ArkAssignStmt(countLocal, zero);
        firstBlock.addStmt(countAssignStmt);
        cfg.setStartingStmt(countAssignStmt);

        this.cfgContext = {
            cfg,
            currentBlock: firstBlock,
            tempLocalIndex: 0,
            nextBlockId: 1
        };

        // 4. 添加静态初始化（按需触发原则：此处仅添加全局静态初始化）
        this.addStaticInit(this.cfgContext);

        // 5. 遍历每个 Ability，调用 AbilityMainMethodCreater
        // TODO: 找起始 Ability，找 startAbility 调用
        this.wrapWithDoWhileLoop(() => {
            for (const ability of this.abilities) {
                let abilityMainMethodCreater: MainMethodCreater | undefined;

                if (this.isUIAbility(ability)) {
                    abilityMainMethodCreater = new UIAbilityMainMethodCreater(
                        ability,
                        this.abilityToComponentsMap,
                        this.abilityToBuildersMap,
                        this.componentToCallbacksMap,
                        this.builderToCallbacksMap,
                        this.cfgContext,
                        this.classToLocalMap
                    );
                } else if (this.isExtensionAbility(ability)) {
                    const extensionAbilityType = this.getExtensionAbilityType(ability);
                    switch (extensionAbilityType) {
                        case 'FormExtensionAbility':
                            abilityMainMethodCreater = new FormExtensionAbilityMainMethodCreater();
                            break;
                        case 'BackupExtensionAbility':
                            abilityMainMethodCreater = new BackupExtensionAbilityMainMethodCreater(ability, this.cfgContext);
                            break;
                        default:
                            logger.error(`Unsupported extension ability type: ${extensionAbilityType}`);
                            break;
                    }
                } else {
                    logger.error(`Unsupported ability: ${ability.getSignature()}. It is not a UIAbility or ExtensionAbility`);
                }

                if (abilityMainMethodCreater) {
                    this.wrapWithIfBranch(() => abilityMainMethodCreater.addStmtsToCfg());
                }
            }
        });

        // 6. 添加 return 语句
        const returnStmt = new ArkReturnVoidStmt();
        this.cfgContext.currentBlock.addStmt(returnStmt);

        // 7. 清理 CFG 中的空 BasicBlock，避免 DataflowSolver 遇到 null 节点
        this.removeEmptyBlocks(cfg);

        // 8. 设置 starting stmt
        const startingStmt = firstBlock.getHead();
        if (startingStmt) {
            cfg.setStartingStmt(startingStmt);
        }

        // 9. 组装 ArkBody
        const localSet = new Set(Array.from(this.classToLocalMap.values()));
        const dummyBody = new ArkBody(localSet, cfg);
        this.dummyMain.setBody(dummyBody);
        addCfg2Stmt(this.dummyMain);
        this.scene.addToMethodsMap(this.dummyMain);

        return this.dummyMain;
    }

    /**
     * 添加静态初始化调用
     */
    private addStaticInit(context: CFGContext): void {
        for (const method of this.scene.getStaticInitMethods()) {
            const staticInvokeExpr = new ArkStaticInvokeExpr(method.getSignature(), []);
            const invokeStmt = new ArkInvokeStmt(staticInvokeExpr);
            context.currentBlock.addStmt(invokeStmt);
        }
    }

    /**
     * 清理 CFG 中的空 BasicBlock。
     */
    private removeEmptyBlocks(cfg: Cfg): void {
        let changed = true;
        while (changed) {
            changed = false;
            for (const block of cfg.getBlocks()) {
                if (block.getStmts().length > 0) {
                    continue;
                }
                const predecessors = [...block.getPredecessors()];
                const successors = [...block.getSuccessors()];

                for (const pred of predecessors) {
                    pred.removeSuccessorBlock(block);
                    for (const succ of successors) {
                        if (!pred.getSuccessors().includes(succ)) {
                            pred.addSuccessorBlock(succ);
                        }
                    }
                }

                for (const succ of successors) {
                    succ.removePredecessorBlock(block);
                    for (const pred of predecessors) {
                        if (!succ.getPredecessors().includes(pred)) {
                            succ.addPredecessorBlock(pred);
                        }
                    }
                }

                cfg.getBlocks().delete(block);
                changed = true;
                break; // 重新遍历，因为 Set 在迭代中被修改
            }
        }
    }

    private isUIAbility(cls: ArkClass): boolean {
        const heritageClasses = cls.getAllHeritageClasses();

        if (heritageClasses.some(cls => cls.getName() === 'UIAbility')) {
            return true;
        }

        return heritageClasses.some((cls) => this.isUIAbility(cls));
    }

    private isExtensionAbility(cls: ArkClass): boolean {
        const heritageClasses = cls.getAllHeritageClasses();

        if (heritageClasses.some(cls => cls.getName() === 'ExtensionAbility' || cls.getName() === 'BackupExtensionAbility')) {
            return true;
        }

        return heritageClasses.some((cls) => this.isExtensionAbility(cls));
    }

    private getExtensionAbilityType(cls: ArkClass): string {
        // TODO
        const heritageClasses = cls.getAllHeritageClasses();
        if (heritageClasses.some(cls => cls.getName() === 'FormExtensionAbility')) {
            return 'FormExtensionAbility';
        } else if (heritageClasses.some(cls => cls.getName() === 'BackupExtensionAbility')) {
            return 'BackupExtensionAbility';
        } else {
            return 'UnsupportedExtensionAbility';
        }
    }
}
