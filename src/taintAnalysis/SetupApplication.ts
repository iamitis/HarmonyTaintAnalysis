import { Aliasing, AliasProblem, AliasSolver, FlowSensitiveAliasStrategy, JsonSourceSinkManager, Logger, PointerAnalysis, Scene } from "..";
import { ModelUtils } from "../core/common/ModelUtils";
import { ArkClass } from "../core/model/ArkClass";
import { ArkMethod } from "../core/model/ArkMethod";
import { FileSignature } from "../core/model/ArkSignature";
import { ModuleScene } from "../Scene";
import { fetchDependenciesFromFile } from "../utils/json5parser";
import { LOG_MODULE_TYPE } from "../utils/logger";
import { Callback, CallbackCollector } from "./CallbackCollector";
import { ComponentCollector, RouterMap } from "./ComponentCollector";
import { TaintProblem } from "./ifds/TaintProblem";
import { TaintSolver } from "./ifds/TaintSolver";
import { HarmonyMainMethodCreater } from "./mainMethodCreaters/HarmonyMainMethodCreater";
import path from 'path';
import fs from 'fs';
import { SourceSinkManager } from "./sourcesAndSinks/SourceSinkManager";
import { AliasingStrategy, IFDSConfig } from "./config/IFDSConfig";
import { IFDSManager } from "./ifds/IFDSManager";
import { SourceAndSinkFileType, TaintAnalysisConfig, TaintAnalysisProjectType } from "./config/TaintAnalysisConfig";
import { SourceToSinkInfo } from "./results/TaintAnalysisResult";

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'SetupApplication');

// TODO: 详细整理
const ABILITY_BASE_CLASSES = ['UIExtensionAbility', 'Ability', 'FormExtensionAbility', 'UIAbility', 'BackupExtensionAbility'];

export class TaintAnalysis {
    private scene: Scene;

    private taintAnalysisConfig: TaintAnalysisConfig;

    private abilities: ArkClass[] = [];
    private routerMaps: Map<string, RouterMap[]> = new Map();
    private abilityToComponentsMap: Map<ArkClass, Set<ArkClass>> = new Map<ArkClass, Set<ArkClass>>();
    private abilityToBuildersMap: Map<ArkClass, Set<ArkMethod>> = new Map<ArkClass, Set<ArkMethod>>();
    private componentToCallbacksMap: Map<ArkClass, Set<Callback>> = new Map<ArkClass, Set<Callback>>();
    private builderToCallbacksMap: Map<ArkMethod, Set<Callback>> = new Map<ArkMethod, Set<Callback>>();

    private dummyMain: ArkMethod | null = null;

    private sourceSinkManager?: SourceSinkManager;

    private taintAnalysisResult: Set<SourceToSinkInfo> = new Set();

    constructor(scene: Scene, taintAnalysisConfig: TaintAnalysisConfig = new TaintAnalysisConfig()) {
        this.scene = scene;
        this.taintAnalysisConfig = taintAnalysisConfig;
        this.initWithConfig();
    }

    /**
     * 根据配置初始化
     */
    private initWithConfig(): void {
        // 初始化 sourceSinkManager
        const sourceAndSinkConfig = this.taintAnalysisConfig.sourceAndSinkConfig;
        switch (sourceAndSinkConfig.definitionFileType) {
            case SourceAndSinkFileType.JSON:
                const sourceSinkManager = new JsonSourceSinkManager();
                sourceSinkManager.loadFromFile(sourceAndSinkConfig.definitionFilePath);
                this.sourceSinkManager = sourceSinkManager;
                break;
            default:
                break;
        }

        // 初始化 dummyMain
        if (this.taintAnalysisConfig.projectType === TaintAnalysisProjectType.Directory) {
            if (this.taintAnalysisConfig.methodToBeAnalyzed) {
                this.dummyMain = this.taintAnalysisConfig.methodToBeAnalyzed;
            } else {
                logger.warn('We are in directory mode, but there is no specified method in the config, try to find default method like index or main');
                const main = this.findDefaultMethod();
                if (!main) {
                    logger.warn('Failed to find default method like index or main');
                } else {
                    logger.info(`Use default method: ${main.getSignature().toString()}`);
                    this.dummyMain = main;
                }
            }
        }

        // TODO: 初始化其他组件
    }

    /**
     * 查找目录下默认的 index 或 main 方法
     */
    private findDefaultMethod(): ArkMethod | undefined {
        // TODO: 查找目录下默认的 index 或 main 方法
        return undefined;
    }

    public analyze(): void {
        switch (this.taintAnalysisConfig.projectType) {
            case TaintAnalysisProjectType.OpenHarmony:
                this.analyzeHarmonyApp();
                break;
            case TaintAnalysisProjectType.Directory:
                this.analyzeDirectory();
                break;
            default:
                break;
        }
    }

    /**
     * 分析 app 主流程
     */
    public analyzeHarmonyApp(): void {
        this.parseApp();

        this.collectComponents();

        this.collectCallbacks();

        this.createMainMethod();

        this.runDataflowAnalysis();
    }

    public analyzeDirectory(): void {
        this.runDataflowAnalysis();
    }

    /**
     * 解析应用配置文件等，获取 ability 信息
     */
    public parseApp(): void {
        this.findAbilities();
        this.findRouterMap();
    }

    /**
     * 解析各模块的 routerMap
     * 读取各模块的 module.json5，提取 module.routerMap 字段
     */
    public findRouterMap(): void {
        const moduleSceneMap = this.scene.getModuleSceneMap();

        moduleSceneMap.forEach((moduleScene, moduleName) => {
            const modulePath = moduleScene.getModulePath();
            // module.json5 通常位于模块的 src/main/module.json5
            const moduleJsonPath = path.join(modulePath, 'src', 'main', 'module.json5');

            if (!fs.existsSync(moduleJsonPath)) {
                logger.warn(`module.json5 not found for module ${moduleName} at ${moduleJsonPath}`);
                return;
            }

            const moduleJson = fetchDependenciesFromFile(moduleJsonPath);
            const moduleConfig = moduleJson.module as { [k: string]: unknown } | undefined;

            if (!moduleConfig?.routerMap) {
                logger.warn(`module.json5 not found for module ${moduleName} at ${moduleJsonPath}`);
                return;
            }

            let routerMap: RouterMap[] = [];

            if (typeof moduleConfig.routerMap === 'string' && moduleConfig.routerMap.startsWith('$')) {
                // routerMap 是文件路径，需要解析对应文件
                let routerMapFilePath = '';
                try {
                    routerMapFilePath = this.findResourcePath(moduleConfig.routerMap, moduleScene, 'json');
                } catch (e) {
                    logger.warn(`Failed to find routerMap path: ${moduleConfig.routerMap}`);
                    return;
                }

                if (fs.existsSync(routerMapFilePath)) {
                    const routerMapJson = fetchDependenciesFromFile(routerMapFilePath);
                    if (routerMapJson.routerMap && Array.isArray(routerMapJson.routerMap)) {
                        routerMapJson.routerMap.forEach((item) => {
                            this.isValidRouterMapItem(item) && routerMap.push(item);
                        })
                    } else {
                        logger.warn(`Failed to parse routerMap: ${routerMapFilePath}`);
                        return;
                    }
                } else {
                    logger.warn(`RouterMap file not found: ${routerMapFilePath}`);
                    return;
                }
            } else if (Array.isArray(moduleConfig.routerMap)) {
                // routerMap 直接是 RouterMap 数组
                moduleConfig.routerMap.forEach((item) => {
                    this.isValidRouterMapItem(item) && routerMap.push(item);
                })
            }

            routerMap.forEach((item) => this.findBuilder(item, moduleScene));

            if (routerMap.length > 0) {
                this.routerMaps.set(modulePath, routerMap);
            }
        });
    }

    /**
     * 查找形如 $profile:main_pages 的资源路径
     * TODO: 暂且找不到官方的详细规则
     */
    private findResourcePath(resourcePath: string, moduleScene: ModuleScene, ext: string): string {
        if (!resourcePath.startsWith('$') || ext !== 'json' || resourcePath.split(':').length !== 2) {
            throw new Error('暂未支持解析此类型');
        }

        const modulePath = moduleScene.getModulePath();
        const resourceType = resourcePath.split(':')[0].substring(1);
        const resourceFilePath = path.join(modulePath, 'src', 'main', 'resources', 'base', resourceType, resourcePath.split(':')[1] + '.' + ext);
        return resourceFilePath;
    }

    private isValidRouterMapItem(item: any): item is RouterMap {
        return typeof item?.name === 'string'
            && typeof item?.pageSourceFile === 'string'
            && typeof item?.buildFunction === 'string';
    }

    private findBuilder(routerMapItem: RouterMap, moduleScene: ModuleScene): void {
        const modulePath = moduleScene.getModulePath();
        const srcPath = path.join(modulePath, routerMapItem.pageSourceFile);

        // 计算相对于 projectDir 的路径
        const projectDir = this.scene.getRealProjectDir();
        const relativePath = path.relative(projectDir, srcPath);

        // 创建 FileSignature 并获取 ArkFile
        const fileSignature = new FileSignature(this.scene.getProjectName(), relativePath);
        const arkFile = this.scene.getFile(fileSignature);

        if (!arkFile) {
            logger.warn(`ArkFile not found for path: ${srcPath}`);
            return;
        }

        // 获取文件中所有方法，找到带 @Builder 装饰器且方法名匹配 buildFunction 的方法
        const allMethods = ModelUtils.getAllMethodsInFile(arkFile);
        const builderMethod = allMethods.find(
            (method) => method.getName() === routerMapItem.buildFunction && ModelUtils.isArkUIBuilderMethod(method)
        );

        if (builderMethod) {
            routerMapItem.builder = builderMethod;
        } else {
            logger.warn(`Builder method '${routerMapItem.buildFunction}' with @Builder decorator not found in file: ${srcPath}`);
        }
    }

    /**
     * 获取解析后的 routerMaps
     */
    public getRouterMaps(): Map<string, RouterMap[]> {
        return this.routerMaps;
    }

    /**
     * 获取应用的 abilities
     */
    public findAbilities(): void {
        this.scene.getClasses().forEach((cls) => {
            this.isAbility(cls) && this.abilities.push(cls);
        })
    }

    /**
     * 判断一个类是否是（继承自） Ability
     */
    private isAbility(arkClass: ArkClass): boolean {
        if (ABILITY_BASE_CLASSES.includes(arkClass.getSuperClassName())) {
            return true;
        }
        let superClass = arkClass.getSuperClass();
        while (superClass) {
            if (ABILITY_BASE_CLASSES.includes(superClass.getSuperClassName())) {
                return true;
            }
            superClass = superClass.getSuperClass();
        }
        return false;
    }

    /**
     * Find the Components used by each Ability.
     */
    public collectComponents(): void {
        this.abilities.forEach((ability) => {
            const collector = new ComponentCollector(this.scene, this.routerMaps, ability);
            collector.collect();
            this.abilityToComponentsMap.set(ability, collector.getComponents());
            this.abilityToBuildersMap.set(ability, collector.getBuilders());
        });
    }

    /**
     * 收集回调
     */
    public collectCallbacks(): void {
        const callbackAnalyzer = new CallbackCollector(
            this.scene,
            this.abilityToComponentsMap,
            this.abilityToBuildersMap
        );
        callbackAnalyzer.collectCallbacks();
        this.componentToCallbacksMap = callbackAnalyzer.getComponentToCallbacksMap();
        this.builderToCallbacksMap = callbackAnalyzer.getBuilderToCallbacksMap();
    }

    /**
     * 创建虚拟主方法
     */
    public createMainMethod(): void {
        const entryPointCreator = new HarmonyMainMethodCreater(
            this.scene,
            this.abilities,
            this.abilityToComponentsMap,
            this.abilityToBuildersMap,
            this.componentToCallbacksMap,
            this.builderToCallbacksMap
        );
        this.dummyMain = entryPointCreator.createMainMethod();
    }

    /**
     * 进行数据流分析
     * 基于 IFDS 算法在 dummyMain 上执行污点分析
     */
    public runDataflowAnalysis(): void {
        if (!this.dummyMain) {
            logger.warn('DummyMain method not created, skipping dataflow analysis');
            return;
        }

        if (!this.sourceSinkManager) {
            logger.warn('SourceSinkManager not initialized, skipping dataflow analysis');
            return;
        }

        try {
            const ifdsManager = new IFDSManager(this.taintAnalysisConfig.ifdsConfig);
            ifdsManager.setSourceSinkManager(this.sourceSinkManager);
            // 正向分析
            const taintProblem = new TaintProblem(this.dummyMain, ifdsManager);
            const taintSolver = new TaintSolver(taintProblem, this.scene, ifdsManager);
            ifdsManager.setForwardSolver(taintSolver);
            // 别名分析
            const aliasProblem = new AliasProblem(ifdsManager, this.dummyMain);
            const aliasSolver = new AliasSolver(aliasProblem, this.scene, ifdsManager);
            ifdsManager.setBackwardSolver(aliasSolver);
            switch (this.taintAnalysisConfig.ifdsConfig.aliasingStrategy) {
                case AliasingStrategy.FlowSensitive:
                    const flowSensitiveAliasStrategy = new FlowSensitiveAliasStrategy(ifdsManager);
                    const pta = PointerAnalysis.pointerAnalysisForMethod(this.scene, this.dummyMain);
                    const aliasing = new Aliasing(ifdsManager, flowSensitiveAliasStrategy, pta);
                    ifdsManager.setAliasing(aliasing);
                    break;
                case AliasingStrategy.None:
                    const noAliasing = new Aliasing(ifdsManager, undefined);
                    ifdsManager.setAliasing(noAliasing);
                    break;
                default:
                    break;
            }

            taintSolver.analyze();
            ifdsManager.getResults().forEach((factAtSink) => {
                const result = SourceToSinkInfo.from(factAtSink);
                result && this.taintAnalysisResult.add(result);
            });
        } catch (error) {
            logger.error(`Taint analysis failed: ${error}`);
            throw error;
        }
    }

    /**
     * 获取污点分析结果
     */
    public getTaintAnalysisResult(): Set<SourceToSinkInfo> {
        return this.taintAnalysisResult;
    }

    public getDummyMain(): ArkMethod | null {
        return this.dummyMain;
    }

    /**
     * 设置污点配置
     */
    public setSourceSinkManager(config: SourceSinkManager): void {
        this.sourceSinkManager = config;
    }
}
