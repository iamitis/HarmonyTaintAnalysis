import { ArkClass } from "../../../core/model/ArkClass";
import { BaseMainMethodCreater, CFGContext } from "../MainMethodCreater";

export class BackupExtensionAbilityMainMethodCreater extends BaseMainMethodCreater {
    private ability: ArkClass;
    constructor(ability: ArkClass, cfgContext: CFGContext | null) {
        super();
        this.ability = ability;
        this.cfgContext = cfgContext;
    }

    /**
     * 向 CFG 中添加 Ability 相关语句
     */
    public addStmtsToCfg(): void {
        // 创建 Ability 实例
        const abilityLocal = this.getOrCreateClassLocal(this.ability);

        this.wrapWithDoWhileLoop(() => {
            // 备份
            this.wrapWithIfBranch(() => {
                this.addLifecycleCalls(this.ability, abilityLocal, ['onBackup', 'onProcess', 'onRelease']);
            });
            this.wrapWithIfBranch(() => {
                this.addLifecycleCalls(this.ability, abilityLocal, ['onBackupEx', 'onProcess', 'onRelease']);
            });
            // 恢复
            this.wrapWithIfBranch(() => {
                this.addLifecycleCalls(this.ability, abilityLocal, ['onRestore', 'onProcess', 'onRelease']);
            });
            this.wrapWithIfBranch(() => {
                this.addLifecycleCalls(this.ability, abilityLocal, ['onRestoreEx', 'onProcess', 'onRelease']);
            });
        });
    }
}