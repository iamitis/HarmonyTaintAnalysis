import {
    SceneConfig,
    TaintAnalysis,
    ArkMethod,
    Scene,
    Logger,
    LOG_LEVEL,
    LOG_MODULE_TYPE,
    DotMethodPrinter
} from '../../src';
import { Sdk } from '../../src/Config';
import { ArkIRMethodPrinter } from '../../src/save/arkir/ArkIRMethodPrinter';
import { AliasingStrategy } from '../../src/taintAnalysis/config/IFDSConfig';
import { SourceAndSinkFileType, TaintAnalysisConfig, TaintAnalysisProjectType } from '../../src/taintAnalysis/config/TaintAnalysisConfig';
import path from 'path';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'TaintAnalysisTest');
Logger.configure('', LOG_LEVEL.ERROR, LOG_LEVEL.DEBUG, false);

// 构建 Harmony 项目的 scene
function buildHarmonyScene(configPath: string) {
    const config: SceneConfig = new SceneConfig();
    config.buildFromJson(configPath);
    const projectScene: Scene = new Scene();
    projectScene.buildBasicInfo(config);
    projectScene.buildScene4HarmonyProject();
    projectScene.inferTypes();
    logger.info('buildHarmonyScene exit.');
    return projectScene;
}

// 从普通目录构建 scene
function buildDirectoryScene(dirPath: string) {
    const config: SceneConfig = new SceneConfig();
    config.buildFromProjectDir(dirPath);
    const directoryScene: Scene = new Scene();
    directoryScene.buildSceneFromProjectDir(config);
    directoryScene.inferTypes();
    logger.info('buildDirectoryScene exit.');
    return directoryScene;
}

function printCFG(method: ArkMethod) {
    console.log('------------------ ' + method.getName() + ' IR ------------------');
    const irPrinter = new ArkIRMethodPrinter(method);
    console.log(irPrinter.dump());
    console.log('--------------------------------------------------');

    // 如果想看 CFG Dot 格式：
    // const dotPrinter = new DotMethodPrinter(dummyMain);
    // console.log(dotPrinter.dump());
}

// 从 Harmony 项目跑全流程示例
const HARMONY_CONFIG_PATH = './tests/resources/taintAnalysis/debug/HarmonyProjectConfig.json';
function harmonyTest() {
    const scene = buildHarmonyScene(HARMONY_CONFIG_PATH);

    const analyzer = new TaintAnalysis(scene);
    analyzer.analyzeHarmonyApp();

    // 打印 DummyMain 的 IR
    const dummyMain = analyzer.getDummyMain();
    dummyMain && printCFG(dummyMain);
}

// 测试 IFDS
const DEBUG_DIR = './tests/resources/taintAnalysis/debug';
const DEBUG_DEFINITION_FILE = './tests/resources/taintAnalysis/debug/SourceSinkDefinition.json';
const FLOWDROID_UNIT_DIR = './tests/resources/taintAnalysis/transFromFlowDroid';
const FLOWDROID_DEFINITION_FILE = './tests/resources/taintAnalysis/transFromFlowDroid/SourceSinkDefinition.json';
function ifdsTest() {
    const scene = buildDirectoryScene(FLOWDROID_UNIT_DIR);
    const taintAnalysisConfig = new TaintAnalysisConfig();
    taintAnalysisConfig.projectType = TaintAnalysisProjectType.Directory;
    taintAnalysisConfig.sourceAndSinkConfig = {
        definitionFilePath: FLOWDROID_DEFINITION_FILE,
        definitionFileType: SourceAndSinkFileType.JSON
    }

    // findMethodAndTest('simpleTest1');
    // findMethodAndTest('simpleTest2');
    // findMethodAndTest('simpleTest3');
    // findMethodAndTest('simpleTest4');
    // findMethodAndTest('simpleTest5');
    // findMethodAndTest('simpleTest6');
    // findMethodAndTest('simpleTest7');
    // findMethodAndTest('simpleTest8');
    // findMethodAndTest('simpleTest9');
    // findMethodAndTest('simpleTest10');
    // findMethodAndTest('simpleTest11');
    // findMethodAndTest('testFieldAlias');
    // findMethodAndTest('testFieldAlias2');
    // findMethodAndTest('testFieldAlias3');
    // findMethodAndTest('testFieldAlias4');
    // findMethodAndTest('testFieldAlias5');
    // findMethodAndTest('testFieldAlias6');
    // findMethodAndTest('testFieldAlias7');
    // findMethodAndTest('testFieldAlias8');
    // findMethodAndTest('testFieldAlias9');
    // findMethodAndTest('testFieldAlias10');
    // findMethodAndTest('testFieldAlias11');
    // findMethodAndTest('testFieldAlias12'); // 未通过
    // findMethodAndTest('testFieldAlias13');
    // findMethodAndTest('testFieldAlias14');
    // findMethodAndTest('testFieldAlias15');
    // findMethodAndTest('functionAliasTest');
    // findMethodAndTest('arrayTest1');
    // findMethodAndTest('arrayTest2');
    // findMethodAndTest('arrayTest3');
    // findMethodAndTest('arrayTest4');
    // findMethodAndTest('arrayTest5');
    // findMethodAndTest('arrayAliasTest1');
    // findMethodAndTest('arrayAliasTest2');
    // findMethodAndTest('debugOverwriteBaseObjectTest2');
    // findMethodAndTest('debugMultiLevelTaint');
    findMethodAndTest('debugSimpleTest');
    // findMethodAndTest('debugReturnAliasTest');
    // findMethodAndTest('debugTwoLevelTest');
    // findMethodAndTest('debugTestAliases');
    // findMethodAndTest('debugNegativeTest');
    // findMethodAndTest('debugFunctionAliasTest');
    // findMethodAndTest('debugFieldBaseOverwriteTest');
    // findMethodAndTest('debugDoubleAliasTest');
    // findMethodAndTest('debugUnAliasParameterTest');
    // findMethodAndTest('debugCallSiteCreatesAlias');
    // findMethodAndTest('debugOverwriteInCalleeTest2');
    // findMethodAndTest('debugSummaryTest1');
    // findMethodAndTest('debugOverwriteAliasedVariableTest5');
    // findMethodAndTest('debugLhsNotUpwardsInAliasFlow');
    // findMethodAndTest('debugStaticAliasTest');
    // findMethodAndTest('debugStaticAliasTest2');

    function findMethodAndTest(methodName: string) {
        const method = scene.getMethods().find((method) => method.getName() === methodName);
        if (method) {
            taintAnalysisConfig.methodToBeAnalyzed = method;
            taintAnalysisConfig.ifdsConfig.aliasingStrategy = AliasingStrategy.FlowSensitive;
            const setup = new TaintAnalysis(scene, taintAnalysisConfig);
            setup.analyze();
            console.log(`------------------ ${methodName} Taint Analysis Result ------------------`);
            setup.getTaintAnalysisResult().forEach((res) => {
                console.log(`-----`);
                console.log(res.toString());
            });
            console.log(`------------------ ${methodName} Taint Analysis Result End ------------------`);
            printCFG(method);
            const yClass = scene.getClasses().find((arkClass) => arkClass.getName() === 'Y');
            if (yClass) {
                const set = yClass.getMethods().find((method) => method.getName() === 'set');
                if (set) {
                    printCFG(set);
                }
            }
        }
    }
}

const HAP_BENCH_DIR = './tests/resources/taintAnalysis/hapBench';
const HAP_BENCH_DEFINITION_FILE = './tests/resources/taintAnalysis/hapBench/SourceSinkDefinition.json';
const sdk: Sdk = {
    name: "etsSdk",
    path: "/home/wzy/code/hapflow/sdk/default/openharmony/ets",
    moduleName: ""
}

function hapBenchTest(dir: string, name: string) {
    const sceneConfig = new SceneConfig();
    sceneConfig.buildConfig(name, path.join(HAP_BENCH_DIR, dir), [sdk]);
    const scene = new Scene();
    scene.buildSceneFromProjectDir(sceneConfig);
    scene.inferTypes();

    const taintAnalysisConfig = new TaintAnalysisConfig();
    taintAnalysisConfig.projectType = TaintAnalysisProjectType.OpenHarmony;
    taintAnalysisConfig.sourceAndSinkConfig = {
        definitionFilePath: HAP_BENCH_DEFINITION_FILE,
        definitionFileType: SourceAndSinkFileType.JSON
    }
    taintAnalysisConfig.ifdsConfig.aliasingStrategy = AliasingStrategy.FlowSensitive;

    const setup = new TaintAnalysis(scene, taintAnalysisConfig);
    setup.analyze();

    console.log(`------------------ ${dir} Taint Analysis Result ------------------`);
    setup.getTaintAnalysisResult().forEach((res) => {
        console.log(`-----`);
        console.log(res.toString());
    });
    console.log(`------------------ ${dir} Taint Analysis Result End ------------------`);

    printCFG(setup.getDummyMain()!);
    const ability = scene.getClasses().find((arkClass) => arkClass.getName() === 'EntryAbility');
    if (ability) {
        const onCreate = ability.getMethods().find((method) => method.getName() === 'onCreate');
        onCreate && printCFG(onCreate);
        const onForeground = ability.getMethods().find((method) => method.getName() === 'onForeground');
        onForeground && printCFG(onForeground);
    }
    const build = scene.getMethods().find((method) => method.getName() === 'build');
    build && printCFG(build);
    const cb = scene.getMethods().find((method) => method.getName() === '%AM0$build');
    cb && printCFG(cb);
}

// harmonyTest();

// ifdsTest();

hapBenchTest('Lifecycle Modeling/EventOdering', 'EventOdering');
