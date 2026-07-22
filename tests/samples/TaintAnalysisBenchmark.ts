import {
    SceneConfig,
    TaintAnalysis,
    Scene,
    Logger,
    LOG_LEVEL,
    LOG_MODULE_TYPE,
    TaintFact
} from '../../src';
import { SourceAndSinkFileType, TaintAnalysisConfig, TaintAnalysisProjectType } from '../../src/taintAnalysis/config/TaintAnalysisConfig';
import { AliasingStrategy } from '../../src/taintAnalysis/config/IFDSConfig';
import path from 'path';
import fs from 'fs';
import { SourceRule } from '../../src/taintAnalysis/ifds/rules/SourceRule';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'TaintAnalysisBenchmark');
Logger.configure('', LOG_LEVEL.ERROR, LOG_LEVEL.ERROR, false);

const OHOS_PROJECT_CONFIGS_DIR = './tests/resources/taintAnalysis/ohosProjectConfigs';
const BASE_SOURCE_SINK = path.join(OHOS_PROJECT_CONFIGS_DIR, 'BaseSourceSink.json');
const BENCHMARK_DIR = './tests/resources/taintAnalysis/benchmark';

const EXCLUDE_DIRS = new Set(['node_modules', 'oh_modules', 'build', '.git', '.ark', '.claude', '.qoder']);

function countLoc(projectDir: string): number {
    let total = 0;
    const stack = [projectDir];
    while (stack.length > 0) {
        const dir = stack.pop()!;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!EXCLUDE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
                    stack.push(fullPath);
                }
            } else if (entry.isFile() && (entry.name.endsWith('.ets') || entry.name.endsWith('.ts'))) {
                try {
                    total += fs.readFileSync(fullPath, 'utf-8').split('\n').length;
                } catch {
                    // skip unreadable files
                }
            }
        }
    }
    return total;
}

function computeStats(values: number[]): { mean: number; stdDev: number } {
    const n = values.length;
    if (n === 0) return { mean: 0, stdDev: 0 };
    const mean = values.reduce((a, b) => a + b, 0) / n;
    if (n === 1) return { mean, stdDev: 0 };
    const variance = values.reduce((sq, v) => sq + (v - mean) ** 2, 0) / (n - 1);
    return { mean, stdDev: Math.sqrt(variance) };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjectMetrics {
    projectName: string;
    status: 'success' | 'failed';
    sourceDefNum: number;
    sinkDefNum: number;
    processedEdgeNum: number;
    solveTime: number;
    dataflowAnalysisTime: number;
    taintAnalysisTime: number;
    lifecycleModelingTime: number;
    endToEndTime: number;
    leakPathNum: number;
    error: string | null;
    livenessTime: number;
    // TaintSolver edge breakdown
    taintSolverEdgeCnt: number;
    aliasSolverEdgeCnt: number;
    taintSolverNormalEdgeCnt: number;
    taintSolverCallEdgeCnt: number;
    taintSolverReturnEdgeCnt: number;
    taintSolverPrunedEdgeCnt: number;
    // project characterization
    loc: number;
    classCnt: number;
    methodCnt: number;
    abilityCnt: number;
    componentCnt: number;
    callbackCnt: number;
    // multi-run stats
    runs: number;
    solveTimeRuns: number[];
    solveTimeStdDev: number;
    taintFactNum: number;
    metSourceNum: number;
}

interface BenchmarkResult {
    optimize: boolean;
    timestamp: string;
    runsPerProject: number;
    projectsInfo: {
        total: number;
        succeeded: number;
        failed: number;
        names: string[];
    };
    results: {
        perProject: ProjectMetrics[];
    };
}

interface MetricComparison {
    normal: number;
    optimize: number;
    reduction: number;
    reductionRate: string;
}

interface ProjectComparison {
    projectName: string;
    status: 'both_succeeded' | 'both_failed' | 'normal_only' | 'optimize_only';
    processedEdgeNum: MetricComparison;
    solveTime: MetricComparison;
    dataflowAnalysisTime: MetricComparison;
    taintAnalysisTime: MetricComparison;
    lifecycleModelingTime: MetricComparison;
    endToEndTime: MetricComparison;
    leakPathNum: MetricComparison;
    livenessTime: MetricComparison;
    taintSolverEdgeCnt: MetricComparison;
    aliasSolverEdgeCnt: MetricComparison;
    taintSolverNormalEdgeCnt: MetricComparison;
    taintSolverCallEdgeCnt: MetricComparison;
    taintSolverReturnEdgeCnt: MetricComparison;
    taintSolverPrunedEdgeCnt: MetricComparison;
}

interface DiffResult {
    timestamp: string;
    projectsInfo: {
        total: number;
        succeeded: number;
        failed: number;
    };
    comparison: {
        averageReduction: {
            processedEdgeNum: string;
            solveTime: string;
            dataflowAnalysisTime: string;
            taintAnalysisTime: string;
            lifecycleModelingTime: string;
            endToEndTime: string;
            leakPathNum: string;
            livenessTime: string;
            taintSolverEdgeCnt: string;
            aliasSolverEdgeCnt: string;
            taintSolverNormalEdgeCnt: string;
            taintSolverCallEdgeCnt: string;
            taintSolverReturnEdgeCnt: string;
        };
        perProject: ProjectComparison[];
    };
}

// ─── Scene builder (reused from TaintAnalysisTest) ───────────────────────────

function buildHarmonyScene(configPath: string): Scene {
    const config = new SceneConfig();
    config.buildFromJson(configPath);
    const projectScene = new Scene();
    projectScene.buildBasicInfo(config);
    projectScene.buildScene4HarmonyProject();
    projectScene.inferTypes();
    logger.info('buildHarmonyScene exit.');
    return projectScene;
}

// ─── Project listing ─────────────────────────────────────────────────────────

function getProjectList(): string[] {
    if (!fs.existsSync(OHOS_PROJECT_CONFIGS_DIR)) {
        return [];
    }
    return fs.readdirSync(OHOS_PROJECT_CONFIGS_DIR, { withFileTypes: true })
        .filter(dirent => {
            if (!dirent.isDirectory()) return false;
            return fs.existsSync(path.join(OHOS_PROJECT_CONFIGS_DIR, dirent.name, 'Project.json'));
        })
        .map(dirent => dirent.name);
}

// ─── Source/Sink counting ────────────────────────────────────────────────────

function countSourceSinkDefs(projectName: string): { sourceDefNum: number; sinkDefNum: number } {
    let sourceDefNum = 0;
    let sinkDefNum = 0;

    const jsonPaths = [BASE_SOURCE_SINK];
    const projectSourceSinkPath = path.join(OHOS_PROJECT_CONFIGS_DIR, projectName, 'SourceSink.json');
    if (fs.existsSync(projectSourceSinkPath)) {
        jsonPaths.push(projectSourceSinkPath);
    }

    for (const jsonPath of jsonPaths) {
        try {
            const content = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            if (Array.isArray(content.sources)) {
                sourceDefNum += content.sources.length;
            }
            if (Array.isArray(content.sinks)) {
                sinkDefNum += content.sinks.length;
            }
        } catch {
            logger.warn(`Failed to parse source/sink definitions from ${jsonPath}`);
        }
    }

    return { sourceDefNum, sinkDefNum };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTaintAnalysisConfig(projectName: string): TaintAnalysisConfig {
    const taintAnalysisConfig = new TaintAnalysisConfig();
    taintAnalysisConfig.projectType = TaintAnalysisProjectType.OpenHarmony;
    taintAnalysisConfig.sourceAndSinkConfigs = [
        {
            definitionFilePath: BASE_SOURCE_SINK,
            definitionFileType: SourceAndSinkFileType.JSON
        }
    ];
    const projectSourceSinkPath = path.join(OHOS_PROJECT_CONFIGS_DIR, projectName, 'SourceSink.json');
    if (fs.existsSync(projectSourceSinkPath)) {
        taintAnalysisConfig.sourceAndSinkConfigs.push({
            definitionFilePath: projectSourceSinkPath,
            definitionFileType: SourceAndSinkFileType.JSON
        });
    }
    taintAnalysisConfig.ifdsConfig.aliasingStrategy = AliasingStrategy.FlowSensitive;
    return taintAnalysisConfig;
}

function emptyMetrics(projectName: string, error: string): ProjectMetrics {
    return {
        projectName, status: 'failed',
        sourceDefNum: 0, sinkDefNum: 0,
        processedEdgeNum: 0, solveTime: 0,
        dataflowAnalysisTime: 0, taintAnalysisTime: 0,
        lifecycleModelingTime: 0,
        endToEndTime: 0,
        leakPathNum: 0, error,
        livenessTime: 0,
        taintSolverEdgeCnt: 0, aliasSolverEdgeCnt: 0,
        taintSolverNormalEdgeCnt: 0, taintSolverCallEdgeCnt: 0,
        taintSolverReturnEdgeCnt: 0, taintSolverPrunedEdgeCnt: 0,
        loc: 0, classCnt: 0, methodCnt: 0,
        abilityCnt: 0, componentCnt: 0, callbackCnt: 0,
        runs: 0, solveTimeRuns: [], solveTimeStdDev: 0,
        taintFactNum: 0,
        metSourceNum: 0
    };
}

// ─── Benchmark runner ────────────────────────────────────────────────────────

function runBenchmark(projectNames: string[], optimize: boolean, runs: number): BenchmarkResult {
    console.log(`\nRunning benchmark with optimize=${optimize}, runs=${runs} for ${projectNames.length} project(s)...\n`);

    const perProject: ProjectMetrics[] = [];
    for (const name of projectNames) {
        const t0 = Date.now();
        const projectConfigPath = path.join(OHOS_PROJECT_CONFIGS_DIR, name, 'Project.json');
        if (!fs.existsSync(projectConfigPath)) {
            perProject.push(emptyMetrics(name, `Project config not found: ${projectConfigPath}`));
            console.log(`${name} FAILED: config not found\n`);
            continue;
        }

        process.env.OPTIMIZE = optimize ? 'true' : 'false';

        // Build Scene once (creates dummy main, mutates Scene — but overwrites by hardcoded signature)
        console.log(`${name} (building scene)...`);
        let scene: Scene;
        try {
            scene = buildHarmonyScene(projectConfigPath);
        } catch (e: any) {
            perProject.push(emptyMetrics(name, `Scene build failed: ${e?.message ?? String(e)}`));
            console.log(`${name} FAILED: scene build error\n`);
            continue;
        }

        const sceneBuildingTime = Date.now() - t0;
        const loc = countLoc(scene.getRealProjectDir());
        const classCnt = scene.getClasses().length;
        const methodCnt = scene.getMethods().length;
        const { sourceDefNum, sinkDefNum } = countSourceSinkDefs(name);

        // Warm-up run (not counted)
        // try {
        //     const warmupConfig = makeTaintAnalysisConfig(name);
        //     const warmup = new TaintAnalysis(scene, warmupConfig);
        //     warmup.analyzeHarmonyApp();
        // } catch {
        //     // warmup failure is non-fatal
        // }

        // Measured runs
        const solveTimeSamples: number[] = [];
        const dataflowTimeSamples: number[] = [];
        const taintTimeSamples: number[] = [];
        const lifecycleTimeSamples: number[] = [];
        const endToEndTimeSamples: number[] = [];
        let firstMetrics: ProjectMetrics | null = null;
        let allSucceeded = true;

        TaintFact.currProject = name;
        SourceRule.currProject = name;

        for (let i = 0; i < runs; i++) {
            try {
                const config = makeTaintAnalysisConfig(name);
                const analyzer = new TaintAnalysis(scene, config);
                analyzer.analyzeHarmonyApp();
                solveTimeSamples.push(analyzer.getSolveTime());
                dataflowTimeSamples.push(analyzer.getDataflowAnalysisTime());
                taintTimeSamples.push(analyzer.getTaintAnalysisTime());
                lifecycleTimeSamples.push(analyzer.getLifecycleModelingTime());
                endToEndTimeSamples.push(sceneBuildingTime + analyzer.getTaintAnalysisTime());

                if (i === 0) {
                    firstMetrics = {
                        projectName: name, status: 'success',
                        sourceDefNum, sinkDefNum,
                        processedEdgeNum: analyzer.getIfdsProcessEdgeCnt(),
                        solveTime: 0, // filled below
                        dataflowAnalysisTime: 0, // filled below
                        taintAnalysisTime: 0, // filled below
                        lifecycleModelingTime: 0, // filled below
                        endToEndTime: 0, // filled below
                        leakPathNum: analyzer.getTaintAnalysisResult().size,
                        error: null,
                        livenessTime: analyzer.getLivenessTime(),
                        taintSolverEdgeCnt: analyzer.getTaintSolverEdgeCnt(),
                        aliasSolverEdgeCnt: analyzer.getAliasSolverEdgeCnt(),
                        taintSolverNormalEdgeCnt: analyzer.getTaintSolverNormalEdgeCnt(),
                        taintSolverCallEdgeCnt: analyzer.getTaintSolverCallEdgeCnt(),
                        taintSolverReturnEdgeCnt: analyzer.getTaintSolverReturnEdgeCnt(),
                        taintSolverPrunedEdgeCnt: analyzer.getTaintSolverPrunedEdgeCnt(),
                        loc, classCnt, methodCnt,
                        abilityCnt: analyzer.getAbilityCnt(),
                        componentCnt: analyzer.getComponentCnt(),
                        callbackCnt: analyzer.getCallbackCnt(),
                        runs, solveTimeRuns: [], solveTimeStdDev: 0,
                        taintFactNum: TaintFact.project2TaintFactMap.get(name) ?? 0,
                        metSourceNum: SourceRule.project2MetSourceNum.get(name) ?? 0,
                    };
                }
            } catch (e: any) {
                console.log(`  Run ${i + 1}/${runs} FAILED: ${e?.message ?? String(e)}`);
                allSucceeded = false;
            }
        }

        if (!firstMetrics || !allSucceeded) {
            perProject.push(emptyMetrics(name, 'One or more runs failed'));
            console.log(`${name} FAILED\n`);
            continue;
        }

        const solveStats = computeStats(solveTimeSamples);
        firstMetrics.solveTime = Math.round(solveStats.mean);
        firstMetrics.solveTimeRuns = solveTimeSamples;
        firstMetrics.solveTimeStdDev = Math.round(solveStats.stdDev * 100) / 100;

        firstMetrics.dataflowAnalysisTime = Math.round(dataflowTimeSamples.reduce((a, b) => a + b, 0) / dataflowTimeSamples.length);
        firstMetrics.taintAnalysisTime = Math.round(taintTimeSamples.reduce((a, b) => a + b, 0) / taintTimeSamples.length);
        firstMetrics.lifecycleModelingTime = Math.round(lifecycleTimeSamples.reduce((a, b) => a + b, 0) / lifecycleTimeSamples.length);
        firstMetrics.endToEndTime = Math.round(endToEndTimeSamples.reduce((a, b) => a + b, 0) / endToEndTimeSamples.length);

        perProject.push(firstMetrics);
        const tsInfo = runs > 1
            ? `${firstMetrics.solveTime}ms ±${firstMetrics.solveTimeStdDev.toFixed(1)} (n=${runs})`
            : `${firstMetrics.solveTime}ms`;
        console.log(`${name} OK (${firstMetrics.processedEdgeNum} edges, ${tsInfo})\n`);
    }

    const succeeded = perProject.filter(p => p.status === 'success');
    const failed = perProject.filter(p => p.status === 'failed');

    return {
        optimize,
        timestamp: new Date().toISOString(),
        runsPerProject: runs,
        projectsInfo: {
            total: projectNames.length,
            succeeded: succeeded.length,
            failed: failed.length,
            names: projectNames
        },
        results: {
            perProject
        }
    };
}

// ─── Diff computation ────────────────────────────────────────────────────────

function computeDiff(normal: BenchmarkResult, optimize: BenchmarkResult): DiffResult {
    const normalMap = new Map(normal.results.perProject.map(p => [p.projectName, p]));
    const optimizeMap = new Map(optimize.results.perProject.map(p => [p.projectName, p]));
    const allNames = [...new Set([...normalMap.keys(), ...optimizeMap.keys()])];

    const perProject: ProjectComparison[] = allNames.map(name => {
        const n = normalMap.get(name);
        const o = optimizeMap.get(name);

        let status: ProjectComparison['status'];
        if (n?.status === 'success' && o?.status === 'success') {
            status = 'both_succeeded';
        } else if (n?.status === 'success' && o?.status !== 'success') {
            status = 'normal_only';
        } else if (n?.status !== 'success' && o?.status === 'success') {
            status = 'optimize_only';
        } else {
            status = 'both_failed';
        }

        const c = (key: keyof ProjectMetrics) =>
            compareMetric((n as any)?.[key] ?? 0, (o as any)?.[key] ?? 0);

        return {
            projectName: name,
            status,
            processedEdgeNum: c('processedEdgeNum'),
            solveTime: c('solveTime'),
            dataflowAnalysisTime: c('dataflowAnalysisTime'),
            taintAnalysisTime: c('taintAnalysisTime'),
            lifecycleModelingTime: c('lifecycleModelingTime'),
            endToEndTime: c('endToEndTime'),
            leakPathNum: c('leakPathNum'),
            livenessTime: c('livenessTime'),
            taintSolverEdgeCnt: c('taintSolverEdgeCnt'),
            aliasSolverEdgeCnt: c('aliasSolverEdgeCnt'),
            taintSolverNormalEdgeCnt: c('taintSolverNormalEdgeCnt'),
            taintSolverCallEdgeCnt: c('taintSolverCallEdgeCnt'),
            taintSolverReturnEdgeCnt: c('taintSolverReturnEdgeCnt'),
            taintSolverPrunedEdgeCnt: c('taintSolverPrunedEdgeCnt'),
        };
    });

    const bothSucceeded = perProject.filter(p => p.status === 'both_succeeded');

    type ComparableKey = 'processedEdgeNum' | 'solveTime' | 'dataflowAnalysisTime' | 'taintAnalysisTime' | 'lifecycleModelingTime' | 'endToEndTime'
        | 'leakPathNum' | 'livenessTime'
        | 'taintSolverEdgeCnt' | 'aliasSolverEdgeCnt'
        | 'taintSolverNormalEdgeCnt' | 'taintSolverCallEdgeCnt'
        | 'taintSolverReturnEdgeCnt';

    const avgReduction = (metric: ComparableKey) => {
        if (bothSucceeded.length === 0) return '0.00%';
        const sum = bothSucceeded.reduce((s, p) => s + parseFloat(p[metric].reductionRate), 0);
        return (sum / bothSucceeded.length).toFixed(2) + '%';
    };

    const total = Math.max(normal.projectsInfo.total, optimize.projectsInfo.total);
    const succeeded = Math.max(normal.projectsInfo.succeeded, optimize.projectsInfo.succeeded);
    const failed = Math.max(normal.projectsInfo.failed, optimize.projectsInfo.failed);

    return {
        timestamp: new Date().toISOString(),
        projectsInfo: { total, succeeded, failed },
        comparison: {
            averageReduction: {
                processedEdgeNum: avgReduction('processedEdgeNum'),
                solveTime: avgReduction('solveTime'),
                dataflowAnalysisTime: avgReduction('dataflowAnalysisTime'),
                taintAnalysisTime: avgReduction('taintAnalysisTime'),
                lifecycleModelingTime: avgReduction('lifecycleModelingTime'),
                endToEndTime: avgReduction('endToEndTime'),
                leakPathNum: avgReduction('leakPathNum'),
                livenessTime: avgReduction('livenessTime'),
                taintSolverEdgeCnt: avgReduction('taintSolverEdgeCnt'),
                aliasSolverEdgeCnt: avgReduction('aliasSolverEdgeCnt'),
                taintSolverNormalEdgeCnt: avgReduction('taintSolverNormalEdgeCnt'),
                taintSolverCallEdgeCnt: avgReduction('taintSolverCallEdgeCnt'),
                taintSolverReturnEdgeCnt: avgReduction('taintSolverReturnEdgeCnt'),
            },
            perProject
        }
    };
}

function compareMetric(normal: number, optimize: number): MetricComparison {
    const reduction = normal - optimize;
    const reductionRate = normal > 0 ? ((reduction / normal) * 100).toFixed(2) + '%' : '0.00%';
    return { normal, optimize, reduction, reductionRate };
}

// ─── JSON output ─────────────────────────────────────────────────────────────

function saveResult(data: unknown, filename: string): void {
    if (!fs.existsSync(BENCHMARK_DIR)) {
        fs.mkdirSync(BENCHMARK_DIR, { recursive: true });
    }
    const filePath = path.join(BENCHMARK_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Wrote ${filePath}`);
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function printUsage(): void {
    console.log('Usage:');
    console.log('  npx ts-node tests/samples/TaintAnalysisBenchmark.ts --optimize [--all | --project <name> | --projects <n1,n2,...>] [--runs N]');
    console.log('  npx ts-node tests/samples/TaintAnalysisBenchmark.ts --no-optimize [--all | --project <name> | --projects <n1,n2,...>] [--runs N]');
    console.log('  npx ts-node tests/samples/TaintAnalysisBenchmark.ts --diff [--all | --project <name> | --projects <n1,n2,...>] [--runs N]');
    console.log('');
    console.log('Options:');
    console.log('  --optimize      Run with liveness pruning enabled');
    console.log('  --no-optimize   Run with liveness pruning disabled');
    console.log('  --diff          Run both modes, write optimize.json, normal.json, and diff.json');
    console.log('  --all           Run all projects under ohosProjectConfigs/');
    console.log('  --project       Run a single project');
    console.log('  --projects      Run comma-separated list of projects');
    console.log('  --runs N        Number of runs per project for statistical stability (default: 3)');
    console.log('');
    console.log('Available projects:');
    getProjectList().forEach(name => console.log(`  - ${name}`));
}

function resolveProjects(args: string[]): string[] {
    const allIdx = args.indexOf('--all');
    if (allIdx !== -1) {
        return getProjectList();
    }

    const projectIdx = args.indexOf('--project');
    if (projectIdx !== -1 && args[projectIdx + 1]) {
        return [args[projectIdx + 1]];
    }

    const projectsIdx = args.indexOf('--projects');
    if (projectsIdx !== -1 && args[projectsIdx + 1]) {
        return args[projectsIdx + 1].split(',').map(s => s.trim()).filter(Boolean);
    }

    return [];
}

function main(): void {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        printUsage();
        return;
    }

    const projectNames = resolveProjects(args);
    if (projectNames.length === 0) {
        console.log('Error: No projects specified. Use --all, --project <name>, or --projects <n1,n2,...>');
        printUsage();
        return;
    }

    const runsIdx = args.indexOf('--runs');
    const runs = (runsIdx !== -1 && args[runsIdx + 1]) ? Math.max(1, parseInt(args[runsIdx + 1], 10) || 3) : 3;

    const isDiff = args.includes('--diff');
    const isOptimize = args.includes('--optimize');
    const isNoOptimize = args.includes('--no-optimize');

    if (isDiff) {
        const normalResult = runBenchmark(projectNames, false, runs);
        saveResult(normalResult, 'normal.json');

        const optimizeResult = runBenchmark(projectNames, true, runs);
        saveResult(optimizeResult, 'optimize.json');

        const diffResult = computeDiff(normalResult, optimizeResult);
        saveResult(diffResult, 'diff.json');

        const avg = diffResult.comparison.averageReduction;
        console.log('\n--- Summary ---');
        console.log(`Projects: ${diffResult.projectsInfo.total} total, ${diffResult.projectsInfo.succeeded} succeeded, ${diffResult.projectsInfo.failed} failed`);
        console.log(`Avg combined edge reduction: ${avg.processedEdgeNum}`);
        console.log(`Avg TaintSolver edge reduction: ${avg.taintSolverEdgeCnt}`);
        console.log(`Avg solveTime reduction: ${avg.solveTime}`);
        console.log(`Avg leak path change: ${avg.leakPathNum} (should be ~0%)`);
    } else if (isOptimize) {
        const result = runBenchmark(projectNames, true, runs);
        saveResult(result, 'optimize.json');
    } else if (isNoOptimize) {
        const result = runBenchmark(projectNames, false, runs);
        saveResult(result, 'normal.json');
    } else {
        console.log('Error: Must specify one of --optimize, --no-optimize, or --diff');
        printUsage();
    }
}

main();
