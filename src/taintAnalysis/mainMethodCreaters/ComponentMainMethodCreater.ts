import { ArkClass } from "../../core/model/ArkClass";
import { ArkMethod } from "../../core/model/ArkMethod";
import { Callback } from "../CallbackCollector";
import { BaseMainMethodCreater, CFGContext } from "./MainMethodCreater";

export class ComponentMainMethodCreater extends BaseMainMethodCreater {
    constructor(
        private component: ArkClass,
        private componentToCallbacksMap: Map<ArkClass, Set<Callback>>,
        cfgContext: CFGContext | null,
    ) {
        super();
        this.cfgContext = cfgContext;
    }

    public createMainMethod(): ArkMethod | null {
        return null;
    }

    /**
     * 向 CFG 中添加 Component 相关语句
     * 结构：
     *   1. Component 实例化 + 构造函数
     *   2. Component 前序生命周期（aboutToAppear）
     *   3. 遍历 Callbacks，添加调用
     *   4. Component 后序生命周期（aboutToDisappear）
     */
    public addStmtsToCfg(): void {
        // 1. 创建 Component 实例
        const componentLocal = this.getOrCreateClassLocal(this.component);

        // 2. Component 前序生命周期（示例：aboutToAppear）
        this.addLifecycleCalls(this.component, componentLocal, ['aboutToAppear']);
        this.addLifecycleCalls(this.component, componentLocal, ['onDidBuild']);

        this.wrapWithIfBranch(() => {
            this.wrapWithDoWhileLoop(() => {
                this.addLifecycleCalls(this.component, componentLocal, ['aboutToRecycle']);
                this.addLifecycleCalls(this.component, componentLocal, ['aboutToReuse']);
            })
        });

        this.wrapWithDoWhileLoop(() => {
            this.addLifecycleCalls(this.component, componentLocal, ['onPageShow']);

            // 3. 遍历该 Component 的 Callbacks
            const callbacks = this.componentToCallbacksMap.get(this.component) ?? new Set();
            this.wrapWithDoWhileLoop(() => {
                for (const callback of callbacks) {
                    this.wrapWithIfBranch(() => this.addCallbackInvoke(callback));
                }
            });

            this.wrapWithIfBranch(() => {
                this.addLifecycleCalls(this.component, componentLocal, ['onBackPress']);
            })

            this.addLifecycleCalls(this.component, componentLocal, ['onPageHide']);


            this.wrapWithIfBranch(() => {
                this.addLifecycleCalls(this.component, componentLocal, ['onNewWant']);
            })
        });

        // 4. Component 后序生命周期（示例：aboutToDisappear）
        this.addLifecycleCalls(this.component, componentLocal, ['aboutToDisappear']);
    }
}

export class BuilderMainMethodCreater extends BaseMainMethodCreater {
    constructor(
        private builder: ArkMethod,
        private builderToCallbacksMap: Map<ArkMethod, Set<Callback>>,
        cfgContext: CFGContext | null,
    ) {
        super();
        this.cfgContext = cfgContext;
    }

    /**
     * 向 CFG 中添加 Builder 相关语句
     * 结构：
     *   遍历 Callbacks，添加调用
     */
    public addStmtsToCfg(): void {
        const callbacks = this.builderToCallbacksMap.get(this.builder) ?? new Set();
        this.wrapWithDoWhileLoop(() => {
            for (const callback of callbacks) {
                this.wrapWithIfBranch(() => this.addCallbackInvoke(callback));
            }
        });
    }
}
