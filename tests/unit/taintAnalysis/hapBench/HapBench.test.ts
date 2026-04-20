import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { Scene } from '../../../../src/Scene';
import { SceneConfig, Sdk } from '../../../../src/Config';
import { TaintAnalysis } from '../../../../src/taintAnalysis/TaintAnalysis';
import { TaintAnalysisConfig, TaintAnalysisProjectType, SourceAndSinkFileType } from '../../../../src/taintAnalysis/config/TaintAnalysisConfig';
import { AliasingStrategy } from '../../../../src/taintAnalysis/config/IFDSConfig';
import ConsoleLogger, { LOG_LEVEL } from '../../../../src/utils/logger';
import { SourceToSinkInfo } from '../../../../src/taintAnalysis/results/TaintAnalysisResult';
import { ArkMethod } from '../../../../src';
import { ArkIRMethodPrinter } from '../../../../src/save/arkir/ArkIRMethodPrinter';

// node ./node_modules/vitest/vitest.mjs run tests/unit/taintAnalysis/hapBench/HapBench.test.ts

describe('HapBench Test', () => {
    let scene: Scene;
    let taintAnalysis: TaintAnalysis;
    let testResourceDir: string;
    const SOURCE_SINK_CONFIG: string = path.join(__dirname, '../../../resources/taintAnalysis/hapBench/SourceSinkDefinition.json');
    const HAP_BENCH_DIR: string = path.join(__dirname, '../../../resources/taintAnalysis/hapBench');
    const sdk: Sdk = {
        name: "etsSdk",
        path: "/home/wzy/code/hapflow/sdk/default/openharmony/ets",
        moduleName: ""
    }
    beforeAll(() => {
        ConsoleLogger.configure('', LOG_LEVEL.ERROR, LOG_LEVEL.DEBUG, false);
    });

    afterAll(() => {
        scene && scene.dispose();
    });

    function printCFG(method: ArkMethod) {
        console.log('------------------ ' + method.getName() + ' IR ------------------');
        const irPrinter = new ArkIRMethodPrinter(method);
        console.log(irPrinter.dump());
        console.log('--------------------------------------------------');

        // 如果想看 CFG Dot 格式：
        // const dotPrinter = new DotMethodPrinter(dummyMain);
        // console.log(dotPrinter.dump());
    }

    /**
     * Helper function to run taint analysis
     */
    function runTaintAnalysis(projectDir: string, projectName: string): Set<SourceToSinkInfo> {
        // Build scene from test resources
        const sceneConfig = new SceneConfig();
        sceneConfig.buildConfig(projectName, path.join(HAP_BENCH_DIR, projectDir), [sdk]);
        scene = new Scene();
        scene.buildSceneFromProjectDir(sceneConfig);
        scene.inferTypes();

        // setup taint analysis
        const taintAnalysisConfig = new TaintAnalysisConfig();
        taintAnalysisConfig.projectType = TaintAnalysisProjectType.OpenHarmony;
        taintAnalysisConfig.sourceAndSinkConfig = {
            definitionFilePath: SOURCE_SINK_CONFIG,
            definitionFileType: SourceAndSinkFileType.JSON,
        };
        taintAnalysisConfig.ifdsConfig.aliasingStrategy = AliasingStrategy.FlowSensitive;

        taintAnalysis = new TaintAnalysis(scene, taintAnalysisConfig);
        taintAnalysis.analyze();
        printCFG(taintAnalysis.getDummyMain()!);

        return taintAnalysis.getTaintAnalysisResult();
    }

    it('Aliasing/After', () => {
        const res = runTaintAnalysis('Aliasing/After', 'AliasingAfter');
        expect(res.size).toBe(1);
    })

    it('Aliasing/Before', () => {
        const res = runTaintAnalysis('Aliasing/Before', 'AliasingBefore');
        expect(res.size).toBe(1);
    })

    it('Aliasing/InstanceAlias', () => {
        const res = runTaintAnalysis('Aliasing/InstanceAlias', 'AliasingInstanceAlias');
        expect(res.size).toBe(1);
    })

    it('Aliasing/Inter', () => {
        const res = runTaintAnalysis('Aliasing/Inter', 'AliasingInter');
        expect(res.size).toBe(0);
    })

    it('Aliasing/Merge', () => {
        const res = runTaintAnalysis('Aliasing/Merge', 'AliasingMerge');
        expect(res.size).toBe(1);
    })

    it('Aliasing/ParamAlias', () => {
        const res = runTaintAnalysis('Aliasing/ParamAlias', 'AliasingParamAlias');
        expect(res.size).toBe(1);
    })

    it('Anonymous Constructs/AnonymousClass1', () => {
        const res = runTaintAnalysis('Anonymous Constructs/AnonymousClass1', 'AnonymousClass1');
        expect(res.size).toBe(1);
    })

    it('Anonymous Constructs/AnonymousClass2', () => {
        const res = runTaintAnalysis('Anonymous Constructs/AnonymousClass2', 'AnonymousClass2');
        expect(res.size).toBe(0);
    })

    it('Anonymous Constructs/AnonymousMethod1', () => {
        const res = runTaintAnalysis('Anonymous Constructs/AnonymousMethod1', 'AnonymousMethod1');
        expect(res.size).toBe(1);
    })

    it('Anonymous Constructs/AnonymousMethod2', () => {
        const res = runTaintAnalysis('Anonymous Constructs/AnonymousMethod2', 'AnonymousMethod2');
        expect(res.size).toBe(1);
    })

    it('Anonymous Constructs/AnonymousMethod3', () => {
        const res = runTaintAnalysis('Anonymous Constructs/AnonymousMethod3', 'AnonymousMethod3');
        expect(res.size).toBe(1);
    })

    it('Anonymous Constructs/AnonymousMethod4', () => {
        const res = runTaintAnalysis('Anonymous Constructs/AnonymousMethod4', 'AnonymousMethod4');
        expect(res.size).toBe(0);
    })

    it('Anonymous Constructs/AnonymousMethod5', () => {
        const res = runTaintAnalysis('Anonymous Constructs/AnonymousMethod5', 'AnonymousMethod5');
        expect(res.size).toBe(0);
    })

    it('Anonymous Constructs/AnonymousMethod6', () => {
        const res = runTaintAnalysis('Anonymous Constructs/AnonymousMethod6', 'AnonymousMethod6');
        expect(res.size).toBe(1);
    })

    it('Anonymous Constructs/AnonymousMethod7', () => {
        const res = runTaintAnalysis('Anonymous Constructs/AnonymousMethod7', 'AnonymousMethod7');
        expect(res.size).toBe(1);
    })

    // 未通过, 暂未识别鸿蒙的一些特殊注册型回调
    it('Anonymous Constructs/AnonymousMethod8', () => {
        const res = runTaintAnalysis('Anonymous Constructs/AnonymousMethod8', 'AnonymousMethod8');
        expect(res.size).toBe(1);
    })

    it('Array-Like Structures/ArrayAccess', () => {
        const res = runTaintAnalysis('Array-Like Structures/ArrayAccess', 'ArrayAccess');
        expect(res.size).toBe(1);
    })

    it('Array-Like Structures/ArrayCopy', () => {
        const res = runTaintAnalysis('Array-Like Structures/ArrayCopy', 'ArrayCopy');
        expect(res.size).toBe(1);
    })

    // 误报, 没有实现数组下标精度
    it('Array-Like Structures/ArrayIndexNoLeak', () => {
        const res = runTaintAnalysis('Array-Like Structures/ArrayIndexNoLeak', 'ArrayIndexNoLeak');
        expect(res.size).toBe(0);
    })

    it('Array-Like Structures/Map', () => {
        const res = runTaintAnalysis('Array-Like Structures/Map', 'Map');
        expect(res.size).toBe(1);
    })

    it('Array-Like Structures/MultidimentionalArray', () => {
        const res = runTaintAnalysis('Array-Like Structures/MultidimentionalArray', 'MultidimentionalArray');
        expect(res.size).toBe(1);
    })

    it('Field And Object Sensitivity/FieldSensitivity1', () => {
        const res = runTaintAnalysis('Field And Object Sensitivity/FieldSensitivity1', 'FieldSensitivity1');
        expect(res.size).toBe(0);
    })

    it('Field And Object Sensitivity/FieldSensitivity2', () => {
        const res = runTaintAnalysis('Field And Object Sensitivity/FieldSensitivity2', 'FieldSensitivity2');
        expect(res.size).toBe(0);
    })

    it('Field And Object Sensitivity/FieldSensitivity3', () => {
        const res = runTaintAnalysis('Field And Object Sensitivity/FieldSensitivity3', 'FieldSensitivity3');
        expect(res.size).toBe(1);
    })

    it('Field And Object Sensitivity/FieldSensitivity4', () => {
        const res = runTaintAnalysis('Field And Object Sensitivity/FieldSensitivity4', 'FieldSensitivity4');
        expect(res.size).toBe(0);
    })

    it('Field And Object Sensitivity/InheritedObjects', () => {
        const res = runTaintAnalysis('Field And Object Sensitivity/InheritedObjects', 'InheritedObjects');
        expect(res.size).toBe(1);
    })

    it('Field And Object Sensitivity/ObjectSensitivity1', () => {
        const res = runTaintAnalysis('Field And Object Sensitivity/ObjectSensitivity1', 'ObjectSensitivity1');
        expect(res.size).toBe(0);
    })

    it('General Language Features/Clone1', () => {
        const res = runTaintAnalysis('General Language Features/Clone1', 'Clone1');
        expect(res.size).toBe(1);
    })

    it('General Language Features/Clone2', () => {
        const res = runTaintAnalysis('General Language Features/Clone2', 'Clone2');
        expect(res.size).toBe(1);
    })

    it('General Language Features/Closure1', () => {
        const res = runTaintAnalysis('General Language Features/Closure1', 'Closure1');
        expect(res.size).toBe(1);
    })

    it('General Language Features/Closure2', () => {
        const res = runTaintAnalysis('General Language Features/Closure2', 'Closure2');
        expect(res.size).toBe(1);
    })

    it('General Language Features/Condition', () => {
        const res = runTaintAnalysis('General Language Features/Condition', 'Condition');
        expect(res.size).toBe(1);
    })

    it('General Language Features/Exceptions1', () => {
        const res = runTaintAnalysis('General Language Features/Exceptions1', 'Exceptions1');
        expect(res.size).toBe(1);
    })

    // 预期发现一条泄漏, 但由于 ArkAnalyzer 会为了保证异常在 finally 后能继续传播而多复制一份 finally 块, 这个测试会多一条泄漏
    it('General Language Features/Exceptions2', () => {
        const res = runTaintAnalysis('General Language Features/Exceptions2', 'Exceptions2');
        expect(res.size).toBe(1);
    })

    it('General Language Features/Exceptions3', () => {
        const res = runTaintAnalysis('General Language Features/Exceptions3', 'Exceptions3');
        expect(res.size).toBe(1);
    })

    // 未通过, 暂未映射 throwValue -> caughtValue
    it('General Language Features/Exceptions4', () => {
        const res = runTaintAnalysis('General Language Features/Exceptions4', 'Exceptions4');
        expect(res.size).toBe(1);
    })

    it('General Language Features/LocalFunction', () => {
        const res = runTaintAnalysis('General Language Features/LocalFunction', 'LocalFunction');
        expect(res.size).toBe(1);
    })

    it('General Language Features/Loop1', () => {
        const res = runTaintAnalysis('General Language Features/Loop1', 'Loop1');
        expect(res.size).toBe(1);
    })

    it('General Language Features/MulFields', () => {
        const res = runTaintAnalysis('General Language Features/MulFields', 'MulFields');
        expect(res.size).toBe(1);
    })

    it('General Language Features/Param1', () => {
        const res = runTaintAnalysis('General Language Features/Param1', 'Param1');
        expect(res.size).toBe(1);
    })

    it('General Language Features/Param2', () => {
        const res = runTaintAnalysis('General Language Features/Param2', 'Param2');
        expect(res.size).toBe(0);
    })

    it('General Language Features/PrivateDataLeak', () => {
        const res = runTaintAnalysis('General Language Features/PrivateDataLeak', 'PrivateDataLeak');
        expect(res.size).toBe(1);
    })

    it('General Language Features/PublicAPILeak1', () => {
        const res = runTaintAnalysis('General Language Features/PublicAPILeak1', 'PublicAPILeak1');
        expect(res.size).toBe(1);
    })

    // 未通过
    it('General Language Features/StaticFieldInit', () => {
        const res = runTaintAnalysis('General Language Features/StaticFieldInit', 'StaticFieldInit');
        expect(res.size).toBe(1);
    })

    it('General Language Features/StringPatternMatching', () => {
        const res = runTaintAnalysis('General Language Features/StringPatternMatching', 'StringPatternMatching');
        expect(res.size).toBe(1);
    })

    it('General Language Features/UnreachableMethod', () => {
        const res = runTaintAnalysis('General Language Features/UnreachableMethod', 'UnreachableMethod');
        expect(res.size).toBe(0);
    })

    it('General Language Features/VirtualDispatch1', () => {
        const res = runTaintAnalysis('General Language Features/VirtualDispatch1', 'VirtualDispatch1');
        expect(res.size).toBe(2);
    })

    it('General Language Features/VirtualDispatch2', () => {
        const res = runTaintAnalysis('General Language Features/VirtualDispatch2', 'VirtualDispatch2');
        expect(res.size).toBe(1);
    })

    it('General Language Features/VirtualDispatch3', () => {
        const res = runTaintAnalysis('General Language Features/VirtualDispatch3', 'VirtualDispatch3');
        expect(res.size).toBe(1);
    })

    it('Lifecycle Modeling/ActivityLifecycle1', () => {
        const res = runTaintAnalysis('Lifecycle Modeling/ActivityLifecycle1', 'ActivityLifecycle1');
        expect(res.size).toBe(1);
    })

    it('Lifecycle Modeling/ActivityLifecycle2', () => {
        const res = runTaintAnalysis('Lifecycle Modeling/ActivityLifecycle2', 'ActivityLifecycle2');
        expect(res.size).toBe(1);
    })

    it('Lifecycle Modeling/ActivityLifecycle3', () => {
        const res = runTaintAnalysis('Lifecycle Modeling/ActivityLifecycle3', 'ActivityLifecycle3');
        expect(res.size).toBe(1);
    })

    it('Lifecycle Modeling/ActivityLifecycle4', () => {
        const res = runTaintAnalysis('Lifecycle Modeling/ActivityLifecycle4', 'ActivityLifecycle4');
        expect(res.size).toBe(1);
    })

    it('Lifecycle Modeling/BackupExtensionAbility', () => {
        const res = runTaintAnalysis('Lifecycle Modeling/BackupExtensionAbility', 'BackupExtensionAbility');
        expect(res.size).toBe(1);
    })

    it('Lifecycle Modeling/Button1', () => {
        const res = runTaintAnalysis('Lifecycle Modeling/Button1', 'Button1');
        expect(res.size).toBe(1);
    })

    it('Lifecycle Modeling/Button2', () => {
        const res = runTaintAnalysis('Lifecycle Modeling/Button2', 'Button2');
        expect(res.size).toBe(1);
    })

    it('Lifecycle Modeling/Button3', () => {
        const res = runTaintAnalysis('Lifecycle Modeling/Button3', 'Button3');
        expect(res.size).toBe(1);
    })

    it('Lifecycle Modeling/ComponentLifecycle1', () => {
        const res = runTaintAnalysis('Lifecycle Modeling/ComponentLifecycle1', 'ComponentLifecycle1');
        expect(res.size).toBe(1);
    })

    it('Lifecycle Modeling/ComponentLifecycle2', () => {
        const res = runTaintAnalysis('Lifecycle Modeling/ComponentLifecycle2', 'ComponentLifecycle2');
        expect(res.size).toBe(1);
    })

    it('Lifecycle Modeling/ComponentLifecycle3', () => {
        const res = runTaintAnalysis('Lifecycle Modeling/ComponentLifecycle3', 'ComponentLifecycle3');
        expect(res.size).toBe(1);
    })

    it('Lifecycle Modeling/EventOdering', () => {
        const res = runTaintAnalysis('Lifecycle Modeling/EventOdering', 'EventOdering');
        expect(res.size).toBe(1);
    })

    it('Lifecycle Modeling/UnreachableFlow', () => {
        const res = runTaintAnalysis('Lifecycle Modeling/UnreachableFlow', 'UnreachableFlow');
        expect(res.size).toBe(0);
    })

    // 未通过, 暂未识别鸿蒙的一些特殊注册型回调
    it('OpenHarmony Specific APIs/CallbackInSource', () => {
        const res = runTaintAnalysis('OpenHarmony Specific APIs/CallbackInSource', 'CallbackInSource');
        expect(res.size).toBe(1);
    })

    it('OpenHarmony Specific APIs/DirectLeak', () => {
        const res = runTaintAnalysis('OpenHarmony Specific APIs/DirectLeak', 'DirectLeak');
        expect(res.size).toBe(1);
    })

    // 未通过, 暂未将 Want 参数视作 source
    it('OpenHarmony Specific APIs/DirectLeak-want', () => {
        const res = runTaintAnalysis('OpenHarmony Specific APIs/DirectLeak-want', 'DirectLeak-want');
        expect(res.size).toBe(1);
    })

    // 未通过, 待补充 SourceSinkDefinition.json
    it('OpenHarmony Specific APIs/FileReadWrite', () => {
        const res = runTaintAnalysis('OpenHarmony Specific APIs/FileReadWrite', 'FileReadWrite');
        expect(res.size).toBe(1);
    })

    it('OpenHarmony Specific APIs/NoLeak', () => {
        const res = runTaintAnalysis('OpenHarmony Specific APIs/NoLeak', 'NoLeak');
        expect(res.size).toBe(0);
    })
});
