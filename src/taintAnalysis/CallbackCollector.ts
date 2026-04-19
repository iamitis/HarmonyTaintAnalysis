import { Logger, Scene } from "..";
import { ViewTreeNode } from "../core/graph/ViewTree";
import { ArkClass } from "../core/model/ArkClass";
import { ArkMethod } from "../core/model/ArkMethod";
import { MethodSignature } from "../core/model/ArkSignature";
import { CALLBACK_METHOD_NAME, getCallbackMethodFromStmt } from "../utils/entryMethodUtils";
import { LOG_MODULE_TYPE } from "../utils/logger";

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'CallbackAnalyzer');

export interface Callback {
    function: ArkMethod;
    component?: ArkClass;
    builder?: ArkMethod;
}

// TODO: 详细整理
const VIEW_TREE_EVENT = CALLBACK_METHOD_NAME

export class CallbackCollector {
    /**
     * The scene of the project.
     */
    private scene: Scene;

    /**
     * Map from ability to its used components.
     */
    private abilityToComponentsMap: Map<ArkClass, Set<ArkClass>> = new Map();

    /**
     * Map from ability to its builders.
     */
    private abilityToBuildersMap: Map<ArkClass, Set<ArkMethod>> = new Map();

    /**
     * Map from component to its callback.
     */
    private componentToCallbacksMap: Map<ArkClass, Set<Callback>> = new Map();

    /**
     * Map from builder to its callback.
     */
    private builderToCallbacksMap: Map<ArkMethod, Set<Callback>> = new Map();

    constructor(
        scene: Scene,
        abilityToComponentsMap: Map<ArkClass, Set<ArkClass>>,
        abilityToBuildersMap: Map<ArkClass, Set<ArkMethod>>,
    ) {
        this.scene = scene;
        this.abilityToComponentsMap = abilityToComponentsMap;
        this.abilityToBuildersMap = abilityToBuildersMap;
    }

    public collectCallbacks(): void {
        this.abilityToComponentsMap.forEach((components, ability) => {
            this.findCallbackOfComponents(components, ability);
        });

        this.abilityToBuildersMap.forEach((builders, ability) => {
            this.findCallbackOfBuilders(builders, ability);
        });
    }



    private findCallbackOfComponents(components: Set<ArkClass>, ability: ArkClass) {
        components.forEach((component) => {
            // 找组件 UI 树中的回调
            this.findCallbacksInViewTree(component, ability);
            // 找注册型回调
            this.findRegisteredCallbacks(component, ability);
        });
    }

    private findCallbackOfBuilders(builders: Set<ArkMethod>, ability: ArkClass) {
        builders.forEach((builder) => {
            this.findCallbacksInViewTree(builder, ability);
        });
    }

    /**
     * Find callbacks in the view tree.
     * Traverses the ViewTree of a component or builder to find event callbacks
     * like onClick, onTouch, etc., and populates the corresponding callback maps.
     * 
     * Note: Skips nested custom components and builder nodes to avoid duplicate analysis,
     * as they will be analyzed separately in their own findCallbacksInViewTree calls.
     */
    private findCallbacksInViewTree(ui: ArkClass | ArkMethod, ability: ArkClass) {
        const root = ui.getViewTree()?.getRoot();
        if (!root) {
            return;
        }

        const isBuilder = ui instanceof ArkMethod;
        const callbacks: Set<Callback> = new Set();

        this.traverseViewTree(root, root, callbacks, ui);

        // Store callbacks in the appropriate map
        if (callbacks.size > 0) {
            if (isBuilder) {
                this.builderToCallbacksMap.set(ui as ArkMethod, callbacks);
            } else {
                this.componentToCallbacksMap.set(ui as ArkClass, callbacks);
            }
        }
    }

    /**
     * Recursively traverse ViewTree nodes and collect callbacks from attributes
     * 
     * @param node - Current node being traversed
     * @param root - The root node of current Component/Builder
     * @param callbacks - Set to collect found callbacks
     * @param isBuilder - Whether the UI source is a builder method
     * @param ui - Current Component/Builder being traversed
     */
    private traverseViewTree(
        node: ViewTreeNode,
        root: ViewTreeNode,
        callbacks: Set<Callback>,
        ui: ArkClass | ArkMethod
    ): void {
        const isBuilder = ui instanceof ArkMethod;

        // Extract callbacks from current node's attributes
        for (const [attrName, [stmt, values]] of node.attributes) {
            if (!VIEW_TREE_EVENT.includes(attrName)) {
                continue;
            }

            const callbackMethod = getCallbackMethodFromStmt(stmt, this.scene);
            if (callbackMethod) {
                const callback: Callback = {
                    function: callbackMethod,
                };
                if (isBuilder) {
                    callback.builder = ui as ArkMethod;
                } else {
                    callback.component = ui as ArkClass;
                }
                callbacks.add(callback);
                continue;
            }

            for (const value of values) {
                if (value instanceof MethodSignature) {
                    const method = this.scene.getMethod(value);
                    if (method) {
                        const callback: Callback = {
                            function: method,
                        };
                        if (isBuilder) {
                            callback.builder = ui as ArkMethod;
                        } else {
                            callback.component = ui as ArkClass;
                        }
                        callbacks.add(callback);
                    }
                }
            }
        }

        // 不递归子组件
        if (node !== root && (node.isCustomComponent() || node.isBuilder())) {
            return;
        }

        // Recursively traverse children
        for (const child of node.children) {
            this.traverseViewTree(child, root, callbacks, ui);
        }
    }

    private findRegisteredCallbacks(component: ArkClass, ability: ArkClass) {
    }

    public getComponentToCallbacksMap(): Map<ArkClass, Set<Callback>> {
        return this.componentToCallbacksMap;
    }

    public getBuilderToCallbacksMap(): Map<ArkMethod, Set<Callback>> {
        return this.builderToCallbacksMap;
    }
}
