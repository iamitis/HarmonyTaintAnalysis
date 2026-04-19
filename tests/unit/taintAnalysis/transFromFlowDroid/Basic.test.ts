import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { Scene } from '../../../../src/Scene';
import { SceneConfig } from '../../../../src/Config';
import { TaintAnalysis } from '../../../../src/taintAnalysis/SetupApplication';
import { TaintAnalysisConfig, TaintAnalysisProjectType, SourceAndSinkFileType } from '../../../../src/taintAnalysis/config/TaintAnalysisConfig';
import { ArkMethod } from '../../../../src/core/model/ArkMethod';
import { AliasingStrategy } from '../../../../src/taintAnalysis/config/IFDSConfig';
import ConsoleLogger, { LOG_LEVEL } from '../../../../src/utils/logger';
import { ArkIRMethodPrinter } from '../../../../src/save/arkir/ArkIRMethodPrinter';
import { SourceToSinkInfo } from '../../../../src/taintAnalysis/results/TaintAnalysisResult';

describe('Basic Taint Analysis Test', () => {
    let scene: Scene;
    let taintAnalysis: TaintAnalysis;
    let testResourceDir: string;
    let sourceSinkConfigPath: string;

    beforeAll(() => {
        // 初始化 log4js，开启 console 输出，日志级别设为 DEBUG
        ConsoleLogger.configure('', LOG_LEVEL.ERROR, LOG_LEVEL.DEBUG, false);

        // Build scene from test resources
        const config: SceneConfig = new SceneConfig();
        testResourceDir = path.join(__dirname, '../../../resources/taintAnalysis/transFromFlowDroid');
        config.buildFromProjectDir(testResourceDir);

        scene = new Scene();
        scene.buildSceneFromProjectDir(config);
        scene.inferTypes();

        // Load Source/Sink configuration from JSON
        sourceSinkConfigPath = path.join(testResourceDir, 'SourceSinkDefinition.json');
    });

    afterAll(() => {
        scene.dispose();
    });

    /**
     * Helper function to get method by name from BasicTestCode class
     */
    function getMethodByName(methodName: string): ArkMethod | undefined {
        const files = scene.getFiles();
        for (const file of files) {
            if (file.getName().endsWith('BasicTestCode.ts')) {
                const classes = file.getClasses();
                for (const cls of classes) {
                    if (cls.getName() === 'BasicTestCode') {
                        return cls.getMethods().find((m: ArkMethod) => m.getName() === methodName);
                    }
                }
            }
        }
        return undefined;
    }

    /**
     * Helper function to run taint analysis on a specific method
     */
    function runTaintAnalysis(entryMethod: ArkMethod): Set<SourceToSinkInfo> {
        const config = new TaintAnalysisConfig();
        config.projectType = TaintAnalysisProjectType.Directory;
        config.methodToBeAnalyzed = entryMethod;
        config.sourceAndSinkConfig = {
            definitionFilePath: sourceSinkConfigPath,
            definitionFileType: SourceAndSinkFileType.JSON,
        };
        config.ifdsConfig.aliasingStrategy = AliasingStrategy.FlowSensitive;

        taintAnalysis = new TaintAnalysis(scene, config);
        taintAnalysis.analyze();

        return taintAnalysis.getTaintAnalysisResult();
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

    /**
     * Test: overwriteInCalleeTest1
     * Expected: NEGATIVE (no leak)
     * Reason: The parameter 'loc' is overwritten in calleeOverwrite(), so original taint is lost
     */
    it('overwriteInCalleeTest1 - should NOT find leak (parameter overwritten in callee)', () => {
        const method = getMethodByName('overwriteInCalleeTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        printCFG(method!);
        const method2 = getMethodByName('calleeOverwrite');
        printCFG(method2!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: overwriteInCalleeTest2
     * Expected: POSITIVE (leak found)
     * Reason: The parameter 'loc' is overwritten to null, but the original Location was tainted
     */
    it('overwriteInCalleeTest2 - should find leak (parameter overwritten to null)', () => {
        const method = getMethodByName('overwriteInCalleeTest2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: overwriteBaseObjectTest1
     * Expected: NEGATIVE (no leak)
     * Reason: loc.clear() clears the longitude, returning the same object but with cleared field
     */
    it('overwriteBaseObjectTest1 - should NOT find leak (base object cleared)', () => {
        const method = getMethodByName('overwriteBaseObjectTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: overwriteBaseObjectTest2
     * Expected: NEGATIVE (no leak)
     * Reason: loc.clearLongitude() returns a new Location object with cleared longitude
     */
    it('overwriteBaseObjectTest2 - should NOT find leak (new object returned)', () => {
        const method = getMethodByName('overwriteBaseObjectTest2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: simpleArithmeticTest1
     * Expected: POSITIVE (leak found)
     * Reason: Taint should propagate through arithmetic operations
     */
    it('simpleArithmeticTest1 - should find leak (taint through arithmetic)', () => {
        const method = getMethodByName('simpleArithmeticTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: arithmeticLoopTest1
     * Expected: POSITIVE (leak found)
     * Reason: Taint propagates through loop iterations
     */
    it('arithmeticLoopTest1 - should find leak (taint through loop)', () => {
        const method = getMethodByName('arithmeticLoopTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: arithmeticLoopTest2
     * Expected: POSITIVE (leak found)
     * Reason: Even with variable swapping, taint should propagate
     */
    it('arithmeticLoopTest2 - should find leak (taint with variable swap)', () => {
        const method = getMethodByName('arithmeticLoopTest2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: basicAliasTest
     * Expected: POSITIVE (leak found)
     * Reason: Taint propagates through alias 'j' to 'i.value'
     */
    it('basicAliasTest - should find leak (taint through alias)', () => {
        const method = getMethodByName('basicAliasTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: simpleTest
     * Expected: POSITIVE (leak found)
     * Reason: Direct taint propagation from source to sink
     */
    it('simpleTest - should find leak (direct source-to-sink)', () => {
        const method = getMethodByName('simpleTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });
});
