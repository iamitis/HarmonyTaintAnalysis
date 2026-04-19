import { ArkClass, ClassCategory } from "../core/model/ArkClass";
import { ArkFile } from "../core/model/ArkFile";
import { StringConstant } from "../core/base/Constant";
import { Scene } from "../Scene";
import Logger, { LOG_MODULE_TYPE } from '../utils/logger';
import path from "path";
import { ArkMethod } from "..";
import { Local } from "../core/base/Local";
import { ClassType } from "../core/base/Type";
import { ArkAssignStmt } from "../core/base/Stmt";
import { ArkInstanceFieldRef, ArkArrayRef } from "../core/base/Ref";
import { Value } from "../core/base/Value";
import { TEMP_LOCAL_PREFIX } from "../core/common/Const";
import { ClassSignature, MethodSignature } from "../core/model/ArkSignature";
import { ViewTreeNode } from "../core/graph/ViewTree";

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'ComponentCollector');

const ROUTER_METHOD = ['pushUrl', 'replaceUrl'];
const NAVIGATION_ROUTE_METHOD = ['pushPath', 'pushDestination', 'replacePath', 'replaceDestination'];
const NAVIGATION_ROUTE_METHOD_BYNAME = ['pushPathByName', 'pushDestinationByName', 'replacePathByName', 'replaceDestinationByName'];

export interface RouterMap {
    name: string;
    pageSourceFile: string;
    buildFunction: string;
    builder?: ArkMethod;
    data?: string;
    customData?: string;
}

/**
 * Collector for finding all components and builders related to an Ability.
 * Includes:
 * - Initial pages loaded by loadContent
 * - Router pages navigated via pushUrl/replaceUrl
 * - Navigation destinations via pushPath/pushPathByName etc.
 * - Child components of all above (framework only, not implemented)
 */
export class ComponentCollector {
    private scene: Scene;
    private routerMaps: Map<string, RouterMap[]>;
    private ability: ArkClass;

    /**
     * Set of all components found for this ability.
     */
    private components: Set<ArkClass> = new Set();

    /**
     * Set of all builders found for this ability.
     */
    private builders: Set<ArkMethod> = new Set();

    /**
     * Map from path to its corresponding component.
     */
    private pathToComponentMap: Map<string, ArkClass | null> = new Map();

    /**
     * Map from navigation name to its corresponding builder.
     */
    private nameToBuilderMap: Map<string, ArkMethod | null> = new Map();

    public constructor(scene: Scene, routerMaps: Map<string, RouterMap[]>, ability: ArkClass) {
        this.scene = scene;
        this.routerMaps = routerMaps;
        this.ability = ability;
    }

    /**
     * Collect all components and builders related to the ability.
     * Returns the set of all found components.
     */
    public collect(): Set<ArkClass> {
        // 1. 找初始页
        this.findInitialPages();

        // 2. BFS 遍历：同时处理路由调用、导航调用、子组件
        this.collectAllRelatedComponentsAndBuilders();

        return this.components;
    }

    /**
     * Get the map from navigation name to builder method.
     */
    public getNameToBuilderMap(): Map<string, ArkMethod | null> {
        return this.nameToBuilderMap;
    }

    // ==================== Initial Page Collection ====================

    /**
     * Find the initial pages loaded by the Ability via loadContent calls.
     */
    private findInitialPages(): void {
        for (const method of this.ability.getMethods()) {
            const stmts = method.getCfg()?.getStmts() ?? [];

            for (const stmt of stmts) {
                const invokeExpr = stmt.getInvokeExpr();
                if (!invokeExpr) {
                    continue;
                }

                const calledMethodName = invokeExpr.getMethodSignature().getMethodSubSignature().getMethodName();
                if (calledMethodName !== 'loadContent') {
                    continue;
                }

                const firstArg = invokeExpr.getArgs()[0];
                if (firstArg instanceof StringConstant) {
                    const pagePath = firstArg.getValue();
                    if (pagePath && !this.pathToComponentMap.has(pagePath)) {
                        this.findComponentFromPath(pagePath);
                        const component = this.pathToComponentMap.get(pagePath);
                        component && this.components.add(component);
                    }
                }
            }
        }
    }

    // ==================== BFS Collection ====================

    /**
     * 收集所有相关的 Component 和 Builder
     * TODO: 处理 Router 的 pushNamedRoute 和 Navigation 的动态 import
     */
    private collectAllRelatedComponentsAndBuilders(): void {
        // Queue contains both components and builders to process
        const componentQueue: ArkClass[] = Array.from(this.components);
        const builderQueue: ArkMethod[] = [];

        while (componentQueue.length > 0 || builderQueue.length > 0) {
            // Process components
            while (componentQueue.length > 0) {
                const component = componentQueue.shift()!;
                this.processComponent(component, componentQueue, builderQueue);
            }

            // Process builders
            while (builderQueue.length > 0) {
                const builder = builderQueue.shift()!;
                this.processBuilder(builder, componentQueue, builderQueue);
            }
        }
    }

    /**
     * Find its routes, navigations, and child components.
     */
    private processComponent(component: ArkClass, componentQueue: ArkClass[], builderQueue: ArkMethod[]): void {
        // 1. Find router paths (pushUrl, replaceUrl)
        const routes = this.findRoutePathsUsedByComponent(component);
        for (const route of routes) {
            this.addRouteComponent(route, componentQueue);
        }

        // 2. Find navigation names and their builders
        const navigationNames = this.findNavigationNamesUsedByComponent(component);
        for (const name of navigationNames) {
            this.addNavigationBuilder(name, builderQueue);
        }

        // 3. Find child components via ViewTree
        this.findChildComponentsFromViewTree(component.getViewTree()?.getRoot() ?? null, componentQueue, builderQueue);
    }

    /**
     * Process a single builder: only find child components/builders.
     * Builders are UI construction logic and don't contain route calls.
     */
    private processBuilder(
        builder: ArkMethod,
        componentQueue: ArkClass[],
        builderQueue: ArkMethod[]
    ): void {
        // Find child components via ViewTree
        this.findChildComponentsFromViewTree(builder.getViewTree()?.getRoot() ?? null, componentQueue, builderQueue);
    }

    /**
     * Add a route component to the queue if not already processed.
     */
    private addRouteComponent(route: string, componentQueue: ArkClass[]): void {
        if (!this.pathToComponentMap.has(route)) {
            this.findComponentFromPath(route);
        }

        const routeComponent = this.pathToComponentMap.get(route);
        if (routeComponent && !this.components.has(routeComponent)) {
            this.components.add(routeComponent);
            componentQueue.push(routeComponent);
        }
    }

    /**
     * Add a navigation builder to the queue if not already processed.
     */
    private addNavigationBuilder(name: string, builderQueue: ArkMethod[]): void {
        if (!this.nameToBuilderMap.has(name)) {
            this.findBuilderFromRouterMap(name);
        }

        const builder = this.nameToBuilderMap.get(name);
        if (builder && !this.builders.has(builder)) {
            this.builders.add(builder);
            builderQueue.push(builder);
        }
    }

    /**
     * Find child components and builders from a ViewTree node.
     */
    private findChildComponentsFromViewTree(
        root: ViewTreeNode | null,
        componentQueue: ArkClass[],
        builderQueue: ArkMethod[]
    ): void {
        if (!root) {
            return;
        }

        root.walk((node) => {
            // Handle custom components
            if (node.isCustomComponent() && node.signature instanceof ClassSignature) {
                const childClass = this.scene.getClass(node.signature);
                if (childClass && !this.components.has(childClass)) {
                    this.components.add(childClass);
                    componentQueue.push(childClass);
                }
            }

            // Handle builders
            if (node.isBuilder() && node.signature instanceof MethodSignature) {
                const builderMethod = this.scene.getMethod(node.signature);
                if (builderMethod && !this.builders.has(builderMethod)) {
                    this.builders.add(builderMethod);
                    builderQueue.push(builderMethod);
                }
            }

            return false; // Continue traversal
        });
    }

    // ==================== Route & Navigation Extraction ====================

    /**
     * Find all pushUrl/replaceUrl calls in a component and extract their url parameters.
     */
    private findRoutePathsUsedByComponent(component: ArkClass): string[] {
        const routes: string[] = [];
        for (const method of component.getMethods()) {
            routes.push(...this.findRoutePathsUsedByMethod(method));
        }
        return routes;
    }

    /**
     * Find all pushUrl/replaceUrl calls in a single method.
     */
    private findRoutePathsUsedByMethod(method: ArkMethod): string[] {
        const routes: string[] = [];
        const stmts = method.getCfg()?.getStmts() ?? [];

        for (const stmt of stmts) {
            const invokeExpr = stmt.getInvokeExpr();
            if (!invokeExpr) {
                continue;
            }

            const calledMethodName = invokeExpr.getMethodSignature().getMethodSubSignature().getMethodName();
            if (!ROUTER_METHOD.includes(calledMethodName)) {
                continue;
            }

            const firstArg = invokeExpr.getArgs()[0];
            if (!firstArg) {
                continue;
            }

            const url = this.extractUrlFromRouterOptions(firstArg);
            url && routes.push(url);
        }

        return routes;
    }

    /**
     * Find all Navigation route method calls in a component and extract their name parameters.
     */
    private findNavigationNamesUsedByComponent(component: ArkClass): string[] {
        const names: string[] = [];
        for (const method of component.getMethods()) {
            names.push(...this.findNavigationNamesUsedByMethod(method));
        }
        return names;
    }

    /**
     * Find all Navigation route method calls in a single method.
     */
    private findNavigationNamesUsedByMethod(method: ArkMethod): string[] {
        const names: string[] = [];
        const stmts = method.getCfg()?.getStmts() ?? [];

        for (const stmt of stmts) {
            const invokeExpr = stmt.getInvokeExpr();
            if (!invokeExpr) {
                continue;
            }

            const calledMethodName = invokeExpr.getMethodSignature().getMethodSubSignature().getMethodName();

            if (NAVIGATION_ROUTE_METHOD.includes(calledMethodName)) {
                const firstArg = invokeExpr.getArgs()[0];
                if (firstArg) {
                    const name = this.extractNameFromNavPathInfo(firstArg);
                    name && names.push(name);
                }
            }

            if (NAVIGATION_ROUTE_METHOD_BYNAME.includes(calledMethodName)) {
                const firstArg = invokeExpr.getArgs()[0];
                if (firstArg) {
                    const name = this.extractStringValue(firstArg);
                    name && names.push(name);
                }
            }
        }

        return names;
    }

    /**
     * Find builder method from routerMap by name.
     */
    private findBuilderFromRouterMap(name: string): void {
        const abilityModuleScene = this.ability.getDeclaringArkFile().getModuleScene();
        const modulePath = abilityModuleScene?.getModulePath() || '';

        // First try to find in the same module
        const moduleRouterMap = this.routerMaps.get(modulePath);
        if (moduleRouterMap) {
            const routerMapItem = moduleRouterMap.find((item) => item.name === name);
            if (routerMapItem?.builder) {
                this.nameToBuilderMap.set(name, routerMapItem.builder);
                return;
            }
        }

        // If not found, search in all modules
        for (const [, routerMapItems] of this.routerMaps) {
            const routerMapItem = routerMapItems.find((item) => item.name === name);
            if (routerMapItem?.builder) {
                this.nameToBuilderMap.set(name, routerMapItem.builder);
                return;
            }
        }

        logger.warn(`Builder not found for navigation name '${name}' in ability ${this.ability.getName()}`);
        this.nameToBuilderMap.set(name, null);
    }

    // ==================== Path to Component Resolution ====================

    /**
     * Get the Component class from the path.
     * For example, path='pages/index' should match the file at 'src/main/ets/pages/index.ets'
     */
    private findComponentFromPath(pagePath: string): void {
        const pageFileSuffix = `${pagePath}.ets`;

        // 1. First, try to find the component near the ability's directory
        //    Go up one level from the ability's directory (e.g., from entryAbility/ to ets/)
        //    and look for pagePath.ets
        const abilityFilePath = this.ability.getDeclaringArkFile().getFilePath();
        const abilityDir = path.dirname(abilityFilePath);
        const parentDir = path.dirname(abilityDir);
        const expectedPath = path.join(parentDir, pageFileSuffix);

        const abilityModuleScene = this.ability.getDeclaringArkFile().getModuleScene();
        if (abilityModuleScene) {
            for (const arkFile of abilityModuleScene.getModuleFilesMap().values()) {
                if (arkFile.getFilePath() === expectedPath) {
                    const arkClass = this.findStructInArkFile(arkFile);
                    if (arkClass) {
                        this.pathToComponentMap.set(pagePath, arkClass);
                        return;
                    }
                    logger.warn(`No struct found in ${expectedPath}`);
                    break;
                }
            }
        }

        // 2. If not found near ability, search all scene files ending with pageFileSuffix
        for (const arkFile of this.scene.getFiles()) {
            if (arkFile.getFilePath().endsWith(pageFileSuffix)) {
                const arkClass = this.findStructInArkFile(arkFile);
                if (arkClass) {
                    this.pathToComponentMap.set(pagePath, arkClass);
                    return;
                }
                logger.warn(`No struct found in ${arkFile.getFilePath()}`);
            }
        }

        logger.warn(`Component not found for page path ${pagePath} in ability ${this.ability.getName()}`);
        this.pathToComponentMap.set(pagePath, null);
    }

    /**
     * Find a struct class (non-default ArkClass with STRUCT category) in the given ArkFile.
     */
    private findStructInArkFile(arkFile: ArkFile): ArkClass | null {
        const classes = arkFile.getClasses();
        for (const arkClass of classes) {
            if (!arkClass.isDefaultArkClass() && arkClass.getCategory() === ClassCategory.STRUCT) {
                return arkClass;
            }
        }
        return null;
    }

    // ==================== Value Extraction Helpers ====================

    /**
     * Extract url field value from RouterOptions argument.
     */
    private extractUrlFromRouterOptions(arg: Value): string | null {
        if (!(arg instanceof Local)) {
            return null;
        }

        const type = arg.getType();
        if (!(type instanceof ClassType)) {
            return null;
        }

        const cls = this.scene.getClass(type.getClassSignature());
        if (!cls) {
            return null;
        }

        const urlField = cls.getFieldWithName('url');
        if (!urlField) {
            return null;
        }

        const stmts = urlField.getInitializer();
        if (stmts.length === 0) {
            return null;
        }

        const assignStmt = stmts[stmts.length - 1];
        if (!(assignStmt instanceof ArkAssignStmt)) {
            return null;
        }

        let value = assignStmt.getRightOp();
        if (value instanceof Local) {
            value = this.backtraceLocalInitValue(value);
        }

        if (value instanceof StringConstant) {
            return value.getValue();
        }

        return null;
    }

    /**
     * Extract name field value from NavPathInfo argument.
     */
    private extractNameFromNavPathInfo(arg: Value): string | null {
        if (!(arg instanceof Local)) {
            return null;
        }

        const type = arg.getType();
        if (!(type instanceof ClassType)) {
            return null;
        }

        const cls = this.scene.getClass(type.getClassSignature());
        if (!cls) {
            return null;
        }

        const nameField = cls.getFieldWithName('name');
        if (!nameField) {
            return null;
        }

        const stmts = nameField.getInitializer();
        if (stmts.length === 0) {
            return null;
        }

        const assignStmt = stmts[stmts.length - 1];
        if (!(assignStmt instanceof ArkAssignStmt)) {
            return null;
        }

        let value = assignStmt.getRightOp();
        if (value instanceof Local) {
            value = this.backtraceLocalInitValue(value);
        }

        if (value instanceof StringConstant) {
            return value.getValue();
        }

        return null;
    }

    /**
     * Extract string value from an argument (for ByName methods).
     */
    private extractStringValue(arg: Value): string | null {
        if (arg instanceof StringConstant) {
            return arg.getValue();
        }

        if (arg instanceof Local) {
            const value = this.backtraceLocalInitValue(arg);
            if (value instanceof StringConstant) {
                return value.getValue();
            }
        }

        return null;
    }

    /**
     * Backtrace a Local variable to find its initial value.
     */
    private backtraceLocalInitValue(value: Local): Local | Value {
        const stmt = value.getDeclaringStmt();
        if (stmt instanceof ArkAssignStmt) {
            const rightOp = stmt.getRightOp();
            if (rightOp instanceof Local) {
                return this.backtraceLocalInitValue(rightOp);
            } else if (rightOp instanceof ArkInstanceFieldRef && rightOp.getBase().getName().startsWith(TEMP_LOCAL_PREFIX)) {
                return this.backtraceLocalInitValue(rightOp.getBase());
            } else if (rightOp instanceof ArkArrayRef) {
                return this.backtraceLocalInitValue(rightOp.getBase());
            }
            return rightOp;
        }
        return value;
    }

    public getComponents(): Set<ArkClass> {
        return this.components;
    }

    public getBuilders(): Set<ArkMethod> {
        return this.builders;
    }
}
