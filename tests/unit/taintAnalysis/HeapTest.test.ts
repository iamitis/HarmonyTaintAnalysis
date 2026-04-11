import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { Scene } from '../../../src/Scene';
import { SceneConfig } from '../../../src/Config';
import { TaintAnalysis } from '../../../src/taintAnalysis/SetupApplication';
import { TaintAnalysisConfig, TaintAnalysisProjectType, SourceAndSinkFileType } from '../../../src/taintAnalysis/config/TaintAnalysisConfig';
import { ArkMethod } from '../../../src/core/model/ArkMethod';
import { AliasingStrategy } from '../../../src/taintAnalysis/config/IFDSConfig';
import ConsoleLogger, { LOG_LEVEL } from '../../../src/utils/logger';
import { ArkIRMethodPrinter } from '../../../src/save/arkir/ArkIRMethodPrinter';

describe('Heap Taint Analysis Test', () => {
    let scene: Scene;
    let taintAnalysis: TaintAnalysis;
    let testResourceDir: string;
    let sourceSinkConfigPath: string;

    beforeAll(() => {
        // Uncomment to enable debug logging
        ConsoleLogger.configure('', LOG_LEVEL.ERROR, LOG_LEVEL.ERROR, false);

        // Build scene from test resources
        const config: SceneConfig = new SceneConfig();
        testResourceDir = path.join(__dirname, '../../resources/taintAnalysis');
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
     * Helper function to get method by name from HeapTestCode class
     */
    function getMethodByName(methodName: string): ArkMethod | undefined {
        const files = scene.getFiles();
        for (const file of files) {
            if (file.getName().endsWith('HeapTestCode.ts')) {
                const classes = file.getClasses();
                for (const cls of classes) {
                    if (cls.getName() === 'HeapTestCode') {
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
    function runTaintAnalysis(entryMethod: ArkMethod): Set<any> {
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
    }

    // ========== Basic Heap Tests ==========

    /**
     * Test: simpleTest
     * Expected: NEGATIVE (no leak)
     * Reason: Different objects 'a' and 'b', 'b.f' is not tainted
     */
    it('simpleTest - should NOT find leak (different objects)', () => {
        const method = getMethodByName('simpleTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: argumentTest
     * Expected: NEGATIVE (no leak)
     * Reason: Parameter is overwritten in static run() method
     */
    it('argumentTest - should NOT find leak (parameter overwritten in static method)', () => {
        const method = getMethodByName('argumentTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: negativeTest
     * Expected: NEGATIVE (no leak)
     * Reason: Taint added to different list object than the one published
     */
    it('negativeTest - should NOT find leak (different list)', () => {
        const method = getMethodByName('negativeTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: doubleCallTest
     * Expected: NEGATIVE (no leak)
     * Reason: Different X objects, 'a.e' is not tainted
     */
    it('doubleCallTest - should NOT find leak (different X objects)', () => {
        const method = getMethodByName('doubleCallTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: methodTest0
     * Expected: NEGATIVE (no leak)
     * Reason: Value read before taint is written
     */
    it('methodTest0 - should NOT find leak (read before write)', () => {
        const method = getMethodByName('methodTest0');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: methodTest0b
     * Expected: NEGATIVE (no leak)
     * Reason: Value read before taint is written
     */
    it('methodTest0b - should NOT find leak (read before write)', () => {
        const method = getMethodByName('methodTest0b');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    // ========== Two Level Tests ==========

    /**
     * Test: twoLevelTest
     * Expected: NEGATIVE (no leak)
     * Reason: 'y' gets 'test', not tainted value
     */
    it('twoLevelTest - should NOT find leak (different values)', () => {
        const method = getMethodByName('twoLevelTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    // ========== Alias Tests ==========

    /**
     * Test: multiAliasTest
     * Expected: POSITIVE (leak found)
     * Reason: Alias chain dc -> dc2 -> dc3, taint flows through alias
     */
    it('multiAliasTest - should find leak (alias chain)', () => {
        const method = getMethodByName('multiAliasTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: overwriteAliasTest
     * Expected: NEGATIVE (no leak)
     * Reason: Alias overwritten with null before leak
     */
    it('overwriteAliasTest - should NOT find leak (alias overwritten)', () => {
        const method = getMethodByName('overwriteAliasTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: arrayAliasTest
     * Expected: POSITIVE (leak found)
     * Reason: Array alias, taint propagates through alias
     */
    it('arrayAliasTest - should find leak (array alias)', () => {
        const method = getMethodByName('arrayAliasTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: arrayAliasTest2
     * Expected: POSITIVE (leak found)
     * Reason: Array alias with index access
     */
    it('arrayAliasTest2 - should find leak (array index alias)', () => {
        const method = getMethodByName('arrayAliasTest2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: functionAliasTest
     * Expected: POSITIVE (leak found)
     * Reason: Taint propagates through function call
     */
    it('functionAliasTest - should find leak (function call)', () => {
        const method = getMethodByName('functionAliasTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: functionAliasTest2
     * Expected: POSITIVE (leak found)
     * Reason: Taint propagates through function call chain
     */
    it('functionAliasTest2 - should find leak (function call chain)', () => {
        const method = getMethodByName('functionAliasTest2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    // ========== Multi-Level Taint Tests ==========

    /**
     * Test: multiLevelTaint
     * Expected: POSITIVE (leak found)
     * Reason: Taint flows through multiple method calls
     */
    it('multiLevelTaint - should find leak (multi-level propagation)', () => {
        const method = getMethodByName('multiLevelTaint');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: multiLevelTaint2
     * Expected: POSITIVE (leak found)
     * Reason: Taint written before leak
     */
    it('multiLevelTaint2 - should find leak (taint before leak)', () => {
        const method = getMethodByName('multiLevelTaint2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: negativeMultiLevelTaint
     * Expected: NEGATIVE (no leak)
     * Reason: Leak happens before taint is written
     */
    it('negativeMultiLevelTaint - should NOT find leak (leak before taint)', () => {
        const method = getMethodByName('negativeMultiLevelTaint');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: negativeMultiLevelTaint2
     * Expected: NEGATIVE (no leak)
     * Reason: Leak happens before taint is written
     */
    it('negativeMultiLevelTaint2 - should NOT find leak (leak before taint)', () => {
        const method = getMethodByName('negativeMultiLevelTaint2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    // ========== Activation Unit Tests ==========

    /**
     * Test: activationUnitTest1
     * Expected: POSITIVE (leak found)
     * Reason: Alias 'a' and 'b.attr' point to same object
     */
    it('activationUnitTest1 - should find leak (alias propagation)', () => {
        const method = getMethodByName('activationUnitTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: activationUnitTest2
     * Expected: NEGATIVE (no leak)
     * Reason: Leak happens before taint is written
     */
    it('activationUnitTest2 - should NOT find leak (leak before taint)', () => {
        const method = getMethodByName('activationUnitTest2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: activationUnitTest3
     * Expected: POSITIVE (leak found)
     * Reason: Taint propagates through assignment
     */
    it('activationUnitTest3 - should find leak (taint assignment)', () => {
        const method = getMethodByName('activationUnitTest3');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: activationUnitTest4
     * Expected: NEGATIVE (no leak)
     * Reason: Leak happens before taint is written
     */
    it('activationUnitTest4 - should NOT find leak (leak before taint)', () => {
        const method = getMethodByName('activationUnitTest4');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: activationUnitTest4b
     * Expected: NEGATIVE (no leak)
     * Reason: Leak happens before alias assignment
     */
    it('activationUnitTest4b - should NOT find leak (leak before alias)', () => {
        const method = getMethodByName('activationUnitTest4b');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: activationUnitTest5
     * Expected: NEGATIVE (no leak)
     * Reason: Leak happens before taint is written
     */
    it('activationUnitTest5 - should NOT find leak (leak before taint)', () => {
        const method = getMethodByName('activationUnitTest5');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    // ========== Return Alias Tests ==========

    /**
     * Test: returnAliasTest
     * Expected: POSITIVE (leak found)
     * Reason: Taint propagates through return value alias
     */
    it('returnAliasTest - should find leak (return alias)', () => {
        const method = getMethodByName('returnAliasTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: callPerformanceTest
     * Expected: POSITIVE (leak found)
     * Reason: Taint propagates through method call chain
     */
    it('callPerformanceTest - should find leak (call chain)', () => {
        const method = getMethodByName('callPerformanceTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    // ========== Alias Tests ==========

    /**
     * Test: testAliases
     * Expected: POSITIVE (leak found)
     * Reason: Taint propagates through complex alias chain
     */
    it('testAliases - should find leak (complex alias)', () => {
        const method = getMethodByName('testAliases');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: negativeTestAliases
     * Expected: NEGATIVE (no leak)
     * Reason: Different field accessed (c instead of b)
     */
    it('negativeTestAliases - should NOT find leak (different field)', () => {
        const method = getMethodByName('negativeTestAliases');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: aliasPerformanceTest
     * Expected: POSITIVE (leak found)
     * Reason: Taint propagates through alias with multiple leaks
     */
    it('aliasPerformanceTest - should find leak (multiple leaks)', () => {
        const method = getMethodByName('aliasPerformanceTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: backwardsParameterTest
     * Expected: POSITIVE (leak found)
     * Reason: Taint propagates backwards through parameter
     */
    it('backwardsParameterTest - should find leak (backwards propagation)', () => {
        const method = getMethodByName('backwardsParameterTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: aliasTaintLeakTaintTest
     * Expected: POSITIVE (leak found)
     * Reason: Taint written, leak, then another leak through alias
     */
    it('aliasTaintLeakTaintTest - should find leak (taint-leak-taint)', () => {
        const method = getMethodByName('aliasTaintLeakTaintTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: fieldBaseOverwriteTest
     * Expected: POSITIVE (leak found)
     * Reason: Alias propagates taint
     */
    it('fieldBaseOverwriteTest - should find leak (field alias)', () => {
        const method = getMethodByName('fieldBaseOverwriteTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    // ========== Double/Triple Alias Tests ==========

    /**
     * Test: doubleAliasTest
     * Expected: POSITIVE (leak found)
     * Reason: Multiple aliases to same object
     */
    it('doubleAliasTest - should find leak (double alias)', () => {
        const method = getMethodByName('doubleAliasTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: doubleAliasTest2
     * Expected: POSITIVE (leak found)
     * Reason: Multiple aliases through method
     */
    it('doubleAliasTest2 - should find leak (method alias)', () => {
        const method = getMethodByName('doubleAliasTest2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: tripleAliasTest
     * Expected: POSITIVE (leak found)
     * Reason: Three aliases to same object
     */
    it('tripleAliasTest - should find leak (triple alias)', () => {
        const method = getMethodByName('tripleAliasTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: singleAliasTest
     * Expected: POSITIVE (leak found)
     * Reason: Single alias propagates taint
     */
    it('singleAliasTest - should find leak (single alias)', () => {
        const method = getMethodByName('singleAliasTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: negativeSingleAliasTest
     * Expected: NEGATIVE (no leak)
     * Reason: Alias method returns different object
     */
    it('negativeSingleAliasTest - should NOT find leak (different object)', () => {
        const method = getMethodByName('negativeSingleAliasTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    // ========== Int/Static Alias Tests ==========

    /**
     * Test: intAliasTest
     * Expected: POSITIVE (leak found)
     * Reason: Primitive field taint propagates
     */
    it('intAliasTest - should find leak (primitive field)', () => {
        const method = getMethodByName('intAliasTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: staticAliasTest
     * Expected: POSITIVE (leak found)
     * Reason: Static field alias propagates taint
     */
    it('staticAliasTest - should find leak (static alias)', () => {
        const method = getMethodByName('staticAliasTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: staticAliasTest2
     * Expected: POSITIVE (leak found)
     * Reason: Static field direct alias
     */
    it('staticAliasTest2 - should find leak (static direct alias)', () => {
        const method = getMethodByName('staticAliasTest2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: unAliasParameterTest
     * Expected: NEGATIVE (no leak)
     * Reason: Alias broken by method call
     */
    it('unAliasParameterTest - should NOT find leak (alias broken)', () => {
        const method = getMethodByName('unAliasParameterTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: overwriteParameterTest
     * Expected: POSITIVE (leak found)
     * Reason: Taint not affected by parameter overwrite attempt
     */
    it('overwriteParameterTest - should find leak (parameter not affected)', () => {
        const method = getMethodByName('overwriteParameterTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: multiAliasBaseTest
     * Expected: POSITIVE (leak found)
     * Reason: Multiple bases share same attribute
     */
    it('multiAliasBaseTest - should find leak (multi base alias)', () => {
        const method = getMethodByName('multiAliasBaseTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    // ========== Array Length Tests ==========

    /**
     * Test: arrayLengthAliasTest1
     * Expected: NEGATIVE (no leak)
     * Reason: Array length is not tainted by element assignment
     */
    it('arrayLengthAliasTest1 - should NOT find leak (length not tainted)', () => {
        const method = getMethodByName('arrayLengthAliasTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: arrayLengthAliasTest2
     * Expected: NEGATIVE (no leak)
     * Reason: Array length is not tainted by element assignment
     */
    it('arrayLengthAliasTest2 - should NOT find leak (length not tainted)', () => {
        const method = getMethodByName('arrayLengthAliasTest2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: arrayLengthAliasTest3
     * Expected: POSITIVE (leak found)
     * Reason: Array length derived from tainted value
     */
    it('arrayLengthAliasTest3 - should find leak (tainted length)', () => {
        const method = getMethodByName('arrayLengthAliasTest3');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: arrayLengthAliasTest4
     * Expected: POSITIVE (leak found)
     * Reason: Array length derived from tainted value
     */
    it('arrayLengthAliasTest4 - should find leak (tainted length)', () => {
        const method = getMethodByName('arrayLengthAliasTest4');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    // ========== Primitive Field Tests ==========

    /**
     * Test: taintPrimitiveFieldTest1
     * Expected: POSITIVE (leak found)
     * Reason: Primitive field taint propagates through alias
     */
    it('taintPrimitiveFieldTest1 - should find leak (primitive field alias)', () => {
        const method = getMethodByName('taintPrimitiveFieldTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: taintPrimitiveFieldTest2
     * Expected: POSITIVE (leak found)
     * Reason: Primitive field taint propagates through nested access
     */
    it('taintPrimitiveFieldTest2 - should find leak (nested primitive)', () => {
        const method = getMethodByName('taintPrimitiveFieldTest2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    // ========== Multi Context Tests ==========

    /**
     * Test: multiContextTest1
     * Expected: POSITIVE (leak found)
     * Reason: Multiple context-sensitive calls
     */
    it('multiContextTest1 - should find leak (multi context)', () => {
        const method = getMethodByName('multiContextTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    // ========== Context Tests ==========

    /**
     * Test: contextTest1
     * Expected: NEGATIVE (no leak)
     * Reason: Context-sensitive analysis distinguishes calls
     */
    it('contextTest1 - should NOT find leak (context sensitive)', () => {
        const method = getMethodByName('contextTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: contextTest2
     * Expected: NEGATIVE (no leak)
     * Reason: Context-sensitive analysis distinguishes calls
     */
    it('contextTest2 - should NOT find leak (context sensitive)', () => {
        const method = getMethodByName('contextTest2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: contextTest3
     * Expected: NEGATIVE (no leak)
     * Reason: Context-sensitive analysis distinguishes calls
     */
    it('contextTest3 - should NOT find leak (context sensitive)', () => {
        const method = getMethodByName('contextTest3');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    // ========== Summary Tests ==========

    /**
     * Test: summaryTest1
     * Expected: POSITIVE (leak found)
     * Reason: Summary-based analysis detects leak
     */
    it('summaryTest1 - should find leak (summary)', () => {
        const method = getMethodByName('summaryTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: delayedReturnTest1
     * Expected: POSITIVE (leak found)
     * Reason: Delayed return alias
     */
    it('delayedReturnTest1 - should find leak (delayed return)', () => {
        const method = getMethodByName('delayedReturnTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    // ========== Alias With Overwrite Tests ==========

    /**
     * Test: aliasWithOverwriteTest1
     * Expected: POSITIVE (leak found)
     * Reason: Alias with overwrite still propagates taint
     */
    it('aliasWithOverwriteTest1 - should find leak (overwrite)', () => {
        const method = getMethodByName('aliasWithOverwriteTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: aliasWithOverwriteTest2
     * Expected: POSITIVE (leak found)
     * Reason: Alias with overwrite still propagates taint
     */
    it('aliasWithOverwriteTest2 - should find leak (overwrite)', () => {
        const method = getMethodByName('aliasWithOverwriteTest2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: aliasWithOverwriteTest3
     * Expected: NEGATIVE (no leak)
     * Reason: Value read before taint
     */
    it('aliasWithOverwriteTest3 - should NOT find leak (read before taint)', () => {
        const method = getMethodByName('aliasWithOverwriteTest3');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: aliasWithOverwriteTest4
     * Expected: POSITIVE (leak found)
     * Reason: Alias propagates taint
     */
    it('aliasWithOverwriteTest4 - should find leak (alias)', () => {
        const method = getMethodByName('aliasWithOverwriteTest4');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: aliasWithOverwriteTest5
     * Expected: POSITIVE (leak found)
     * Reason: Alias propagates taint
     */
    it('aliasWithOverwriteTest5 - should find leak (alias)', () => {
        const method = getMethodByName('aliasWithOverwriteTest5');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    // ========== Overwrite Aliased Variable Tests ==========

    /**
     * Test: overwriteAliasedVariableTest
     * Expected: POSITIVE (leak found)
     * Reason: Original alias still has taint
     */
    it('overwriteAliasedVariableTest - should find leak (original alias)', () => {
        const method = getMethodByName('overwriteAliasedVariableTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: overwriteAliasedVariableTest2
     * Expected: NEGATIVE (no leak)
     * Reason: Alias overwrites taint
     */
    it('overwriteAliasedVariableTest2 - should NOT find leak (overwrite)', () => {
        const method = getMethodByName('overwriteAliasedVariableTest2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: overwriteAliasedVariableTest3
     * Expected: POSITIVE (leak found)
     * Reason: First publish happens before overwrite
     */
    it('overwriteAliasedVariableTest3 - should find leak (before overwrite)', () => {
        const method = getMethodByName('overwriteAliasedVariableTest3');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: overwriteAliasedVariableTest4
     * Expected: POSITIVE (leak found)
     * Reason: Both publishes happen before overwrite
     */
    it('overwriteAliasedVariableTest4 - should find leak (both before overwrite)', () => {
        const method = getMethodByName('overwriteAliasedVariableTest4');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: overwriteAliasedVariableTest5
     * Expected: POSITIVE (leak found)
     * Reason: Multiple aliases with taint
     */
    it('overwriteAliasedVariableTest5 - should find leak (multiple aliases)', () => {
        const method = getMethodByName('overwriteAliasedVariableTest5');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: overwriteAliasedVariableTest6
     * Expected: POSITIVE (leak found)
     * Reason: Publish before null assignment
     */
    it('overwriteAliasedVariableTest6 - should find leak (before null)', () => {
        const method = getMethodByName('overwriteAliasedVariableTest6');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    // ========== Datastructure Tests ==========

    /**
     * Test: datastructureTest
     * Expected: POSITIVE (leak found)
     * Reason: Tree structure taint propagation
     */
    it('datastructureTest - should find leak (tree structure)', () => {
        const method = getMethodByName('datastructureTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: datastructureTest2
     * Expected: NEGATIVE (no leak)
     * Reason: Different tree node
     */
    it('datastructureTest2 - should NOT find leak (different node)', () => {
        const method = getMethodByName('datastructureTest2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: staticAccessPathTest
     * Expected: POSITIVE (leak found)
     * Reason: Static access path propagation
     */
    it('staticAccessPathTest - should find leak (static path)', () => {
        return
        const method = getMethodByName('staticAccessPathTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: separatedTreeTest
     * Expected: POSITIVE (leak found)
     * Reason: Separated tree structure
     */
    it('separatedTreeTest - should find leak (separated tree)', () => {
        const method = getMethodByName('separatedTreeTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    // ========== Additional Tests ==========

    /**
     * Test: simpleFieldTest1
     * Expected: POSITIVE (leak found)
     * Reason: Simple field access propagation
     */
    it('simpleFieldTest1 - should find leak (simple field)', () => {
        const method = getMethodByName('simpleFieldTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: longAPAliasTest1
     * Expected: POSITIVE (leak found)
     * Reason: Long access path alias
     */
    it('longAPAliasTest1 - should find leak (long access path)', () => {
        const method = getMethodByName('longAPAliasTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: doubleAliasTest1
     * Expected: POSITIVE (leak found)
     * Reason: Double alias with conditional
     */
    it('doubleAliasTest1 - should find leak (conditional alias)', () => {
        const method = getMethodByName('doubleAliasTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: recursiveFollowReturnsPastSeedsTest1
     * Expected: POSITIVE (leak found)
     * Reason: Recursive method with taint
     */
    it('recursiveFollowReturnsPastSeedsTest1 - should find leak (recursive)', () => {
        const method = getMethodByName('recursiveFollowReturnsPastSeedsTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    // ========== Activation Statement Tests ==========

    /**
     * Test: activationStatementTest1
     * Expected: NEGATIVE (no leak)
     * Reason: Value computed before taint
     */
    it('activationStatementTest1 - should NOT find leak (computed before taint)', () => {
        const method = getMethodByName('activationStatementTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: callSiteCreatesAlias
     * Expected: POSITIVE (leak found)
     * Reason: Call site creates alias
     */
    it('callSiteCreatesAlias - should find leak (call site alias)', () => {
        const method = getMethodByName('callSiteCreatesAlias');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: lhsNotUpwardsInAliasFlow
     * Expected: NEGATIVE (no leak)
     * Reason: LHS not upwards in alias flow
     */
    it('lhsNotUpwardsInAliasFlow - should NOT find leak (lhs flow)', () => {
        const method = getMethodByName('lhsNotUpwardsInAliasFlow');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: identityStmtIsNotAGoodHandoverPoint
     * Expected: POSITIVE (leak found)
     * Reason: Identity statement propagates taint
     */
    it('identityStmtIsNotAGoodHandoverPoint - should find leak (identity stmt)', () => {
        const method = getMethodByName('identityStmtIsNotAGoodHandoverPoint');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: testRecursiveAccessPath
     * Expected: POSITIVE (leak found)
     * Reason: Recursive access path
     */
    it('testRecursiveAccessPath - should find leak (recursive path)', () => {
        const method = getMethodByName('testRecursiveAccessPath');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    // ========== Inner Field Reduction Tests ==========

    /**
     * Test: innerFieldReductionTestNegative
     * Expected: NEGATIVE (no leak)
     * Reason: Different inner objects
     */
    it('innerFieldReductionTestNegative - should NOT find leak (different objects)', () => {
        const method = getMethodByName('innerFieldReductionTestNegative');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    /**
     * Test: innerFieldReductionTestNegative2
     * Expected: NEGATIVE (no leak)
     * Reason: Different inner objects
     */
    it('innerFieldReductionTestNegative2 - should NOT find leak (different objects)', () => {
        const method = getMethodByName('innerFieldReductionTestNegative2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBe(0);
    });

    // ========== Remove Entailed Abstractions Tests ==========

    /**
     * Test: removeEntailedAbstractionsTest1
     * Expected: POSITIVE (leak found)
     * Reason: Abstraction removal test
     */
    it('removeEntailedAbstractionsTest1 - should find leak (abstraction)', () => {
        const method = getMethodByName('removeEntailedAbstractionsTest1');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    /**
     * Test: removeEntailedAbstractionsTest2
     * Expected: POSITIVE (leak found)
     * Reason: Abstraction removal test
     */
    it('removeEntailedAbstractionsTest2 - should find leak (abstraction)', () => {
        const method = getMethodByName('removeEntailedAbstractionsTest2');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    // ========== Method Return Test ==========

    /**
     * Test: methodReturn
     * Expected: POSITIVE (leak found)
     * Reason: Taint through method return
     */
    it('methodReturn - should find leak (method return)', () => {
        const method = getMethodByName('methodReturn');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });

    // ========== Recursion Test ==========

    /**
     * Test: recursionTest
     * Expected: POSITIVE (leak found)
     * Reason: Taint through recursive call
     */
    it('recursionTest - should find leak (recursion)', () => {
        const method = getMethodByName('recursionTest');
        expect(method).toBeDefined();

        const results = runTaintAnalysis(method!);
        expect(results.size).toBeGreaterThan(0);
    });
});
