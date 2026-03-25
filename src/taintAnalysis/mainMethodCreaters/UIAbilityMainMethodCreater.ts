import { Local } from "../../core/base/Local";
import { ArkClass } from "../../core/model/ArkClass";
import { ArkMethod } from "../../core/model/ArkMethod";
import { Callback } from "../CallbackCollector";
import { ComponentMainMethodCreater, BuilderMainMethodCreater } from "./ComponentMainMethodCreater";
import { BaseMainMethodCreater, CFGContext } from "./MainMethodCreater";

const ABILITY_PRE_LIFECYCLE = ['onCreate'];
const ABILITY_POST_LIFECYCLE = ['onDestroy'];

export class UIAbilityMainMethodCreater extends BaseMainMethodCreater {
    private ability: ArkClass;
    private abilityToComponentsMap: Map<ArkClass, Set<ArkClass>>;
    private abilityToBuildersMap: Map<ArkClass, Set<ArkMethod>>;
    private componentToCallbacksMap: Map<ArkClass, Set<Callback>>;
    private builderToCallbacksMap: Map<ArkMethod, Set<Callback>>;

    constructor(
        ability: ArkClass,
        abilityToComponentsMap: Map<ArkClass, Set<ArkClass>>,
        abilityToBuildersMap: Map<ArkClass, Set<ArkMethod>>,
        componentToCallbacksMap: Map<ArkClass, Set<Callback>>,
        builderToCallbacksMap: Map<ArkMethod, Set<Callback>>,
        cfgContext: CFGContext | null,
        classToLocalMap: Map<ArkClass, Local>
    ) {
        super();

        this.ability = ability;
        this.abilityToComponentsMap = abilityToComponentsMap;
        this.abilityToBuildersMap = abilityToBuildersMap;
        this.componentToCallbacksMap = componentToCallbacksMap;
        this.builderToCallbacksMap = builderToCallbacksMap;
        this.cfgContext = cfgContext;
        this.classToLocalMap = classToLocalMap;
    }

    /**
     * 向 CFG 中添加 Ability 相关语句
     * 结构：
     *   1. Ability 实例化 + 构造函数
     *   2. Ability 前序生命周期（onCreate）
     *   3. 遍历 Components，调用 ComponentMainMethodCreater
     *   4. 遍历 Builders，调用 BuilderMainMethodCreater
     *   5. Ability 后序生命周期（onDestroy）
     */
    public addStmtsToCfg(): void {

        // 1. 创建 Ability 实例
        const abilityLocal = this.getOrCreateClassLocal(this.ability);

        // 2. Ability 前序生命周期（示例：onCreate）
        this.addLifecycleCalls(this.ability, abilityLocal, ABILITY_PRE_LIFECYCLE);

        // 3. 遍历该 Ability 的 Components
        const components = this.abilityToComponentsMap.get(this.ability) ?? new Set();
        for (const component of components) {
            const componentCreater = new ComponentMainMethodCreater(
                component,
                this.componentToCallbacksMap,
                this.cfgContext,
                this.classToLocalMap
            );
            this.wrapWithIfBranch(() => componentCreater.addStmtsToCfg());
        }

        // 4. 遍历该 Ability 的 Builders
        const builders = this.abilityToBuildersMap.get(this.ability) ?? new Set();
        for (const builder of builders) {
            const builderCreater = new BuilderMainMethodCreater(
                builder,
                this.builderToCallbacksMap,
                this.cfgContext,
                this.classToLocalMap
            );
            this.wrapWithIfBranch(() => builderCreater.addStmtsToCfg());
        }

        // 5. Ability 后序生命周期（示例：onDestroy）
        this.addLifecycleCalls(this.ability, abilityLocal, ABILITY_POST_LIFECYCLE);
    }
}