import { ArkClass } from "../../core/model/ArkClass";
import { ArkMethod } from "../../core/model/ArkMethod";
import { Callback } from "../CallbackCollector";
import { ComponentMainMethodCreater, BuilderMainMethodCreater } from "./ComponentMainMethodCreater";
import { BaseMainMethodCreater, CFGContext } from "./MainMethodCreater";

// TODO: 添加更多生命周期, 完善生命周期调用顺序

const ABILITY_POST_LIFECYCLE = [
    'onWillBackground',
    'onBackground',
    'onDidBackground',
    'onWindowStageWillDestroy',
    'onWindowStageDestroy',
    'onDestroy'
]

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
    ) {
        super();

        this.ability = ability;
        this.abilityToComponentsMap = abilityToComponentsMap;
        this.abilityToBuildersMap = abilityToBuildersMap;
        this.componentToCallbacksMap = componentToCallbacksMap;
        this.builderToCallbacksMap = builderToCallbacksMap;
        this.cfgContext = cfgContext;
    }

    /**
     * 向 CFG 中添加 Ability 相关语句
     */
    public addStmtsToCfg(): void {

        // 创建 Ability 实例
        const abilityLocal = this.getOrCreateClassLocal(this.ability);

        // Ability 前序生命周期
        this.addLifecycleCalls(this.ability, abilityLocal, ['onCreate']);

        this.wrapWithIfBranch(() => {
            this.addLifecycleCalls(this.ability, abilityLocal, ['onNewWant']);
        })

        this.addLifecycleCalls(this.ability, abilityLocal, [
            'onWindowStageCreate',
            'onWillForeground',
            'onForeground',
            'onDidForeground',
        ]);

        // 添加 Ability 事件生命周期
        this.wrapWithDoWhileLoop(() => {
            this.wrapWithIfBranch(() => {
                this.addLifecycleCalls(this.ability, abilityLocal, ['onShare']);
            })
        });

        // 遍历该 Ability 的 Components
        const components = this.abilityToComponentsMap.get(this.ability) ?? new Set();
        this.wrapWithDoWhileLoop(() => {
            for (const component of components) {
                const componentCreater = new ComponentMainMethodCreater(
                    component,
                    this.componentToCallbacksMap,
                    this.cfgContext,
                );
                this.wrapWithIfBranch(() => componentCreater.addStmtsToCfg());
            }
        });

        // 遍历该 Ability 的 Builders
        const builders = this.abilityToBuildersMap.get(this.ability) ?? new Set();
        for (const builder of builders) {
            const builderCreater = new BuilderMainMethodCreater(
                builder,
                this.builderToCallbacksMap,
                this.cfgContext,
            );
            this.wrapWithIfBranch(() => builderCreater.addStmtsToCfg());
        }

        // Ability 后序生命周期
        this.addLifecycleCalls(this.ability, abilityLocal, ABILITY_POST_LIFECYCLE);
    }
}