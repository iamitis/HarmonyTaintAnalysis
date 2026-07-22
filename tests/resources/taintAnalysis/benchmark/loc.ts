import { SceneConfig, Scene, ArkMethod, Logger, LOG_LEVEL, LOG_MODULE_TYPE } from '../../../../src';
import path from 'path';
import fs from 'fs';

Logger.configure('', LOG_LEVEL.ERROR, LOG_LEVEL.ERROR, false);
const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'LocAnalysis');

const OHOS_PROJECT_CONFIGS_DIR = './tests/resources/taintAnalysis/ohosProjectConfigs';
const OUTPUT_FILE = './tests/resources/taintAnalysis/benchmark/loc.txt';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjectLocResult {
    projectName: string;
    status: 'success' | 'failed';
    methodCount: number;
    // source lines of code
    totalSrcLoc: number;
    avgSrcLoc: number;
    minSrcLoc: number;
    maxSrcLoc: number;
    // IR statement count
    totalIrCount: number;
    avgIrCount: number;
    minIrCount: number;
    maxIrCount: number;
    error?: string;
}

// ─── Scene builder ───────────────────────────────────────────────────────────

function buildHarmonyScene(configPath: string): Scene {
    const config = new SceneConfig();
    config.buildFromJson(configPath);
    const projectScene = new Scene();
    projectScene.buildBasicInfo(config);
    projectScene.buildScene4HarmonyProject();
    projectScene.inferTypes();
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

// ─── Method LOC ──────────────────────────────────────────────────────────────

function computeMethodLoc(method: ArkMethod): number | null {
    if (method.getBody() === undefined) {
        return null;
    }

    const cfg = method.getCfg();
    if (cfg === undefined) {
        return null;
    }

    const stmts = cfg.getStmts();
    if (stmts.length === 0) {
        return null;
    }

    const validLines: number[] = [];
    for (const stmt of stmts) {
        const lineNo = stmt.getOriginPositionInfo().getLineNo();
        if (lineNo > 0) {
            validLines.push(lineNo);
        }
    }

    if (validLines.length === 0) {
        return null;
    }

    const minLine = Math.min(...validLines);
    const maxLine = Math.max(...validLines);
    return maxLine - minLine + 1;
}

function computeMethodIrCount(method: ArkMethod): number | null {
    if (method.getBody() === undefined) {
        return null;
    }

    const cfg = method.getCfg();
    if (cfg === undefined) {
        return null;
    }

    const stmts = cfg.getStmts();
    if (stmts.length === 0) {
        return null;
    }

    return stmts.length;
}

// ─── Project analysis ────────────────────────────────────────────────────────

function analyzeProject(projectName: string): ProjectLocResult {
    const projectConfigPath = path.join(OHOS_PROJECT_CONFIGS_DIR, projectName, 'Project.json');
    if (!fs.existsSync(projectConfigPath)) {
        return {
            projectName, status: 'failed',
            methodCount: 0,
            totalSrcLoc: 0, avgSrcLoc: 0, minSrcLoc: 0, maxSrcLoc: 0,
            totalIrCount: 0, avgIrCount: 0, minIrCount: 0, maxIrCount: 0,
            error: `Config not found: ${projectConfigPath}`
        };
    }

    let scene: Scene;
    try {
        scene = buildHarmonyScene(projectConfigPath);
    } catch (e: any) {
        return {
            projectName, status: 'failed',
            methodCount: 0,
            totalSrcLoc: 0, avgSrcLoc: 0, minSrcLoc: 0, maxSrcLoc: 0,
            totalIrCount: 0, avgIrCount: 0, minIrCount: 0, maxIrCount: 0,
            error: `Scene build failed: ${e?.message ?? String(e)}`
        };
    }

    const methods = scene.getMethods();
    const srcLocValues: number[] = [];
    const irCountValues: number[] = [];

    for (const method of methods) {
        if (method.getName() === 'build' || method.hasBuilderDecorator()) {
            continue;
        }
        // Skip framework-generated methods (prefixed with %)
        if (method.getName().startsWith('%')) {
            continue;
        }
        const declaringClass = method.getDeclaringArkClass();
        if (declaringClass !== null && declaringClass.getName().startsWith('%')) {
            continue;
        }
        const srcLoc = computeMethodLoc(method);
        const irCount = computeMethodIrCount(method);
        if (srcLoc !== null && irCount !== null) {
            srcLocValues.push(srcLoc);
            irCountValues.push(irCount);
        }
    }

    const methodCount = srcLocValues.length;
    const totalSrcLoc = srcLocValues.reduce((a, b) => a + b, 0);
    const avgSrcLoc = methodCount > 0 ? Math.round((totalSrcLoc / methodCount) * 10) / 10 : 0;
    const minSrcLoc = methodCount > 0 ? Math.min(...srcLocValues) : 0;
    const maxSrcLoc = methodCount > 0 ? Math.max(...srcLocValues) : 0;

    const totalIrCount = irCountValues.reduce((a, b) => a + b, 0);
    const avgIrCount = methodCount > 0 ? Math.round((totalIrCount / methodCount) * 10) / 10 : 0;
    const minIrCount = methodCount > 0 ? Math.min(...irCountValues) : 0;
    const maxIrCount = methodCount > 0 ? Math.max(...irCountValues) : 0;

    return {
        projectName, status: 'success',
        methodCount,
        totalSrcLoc, avgSrcLoc, minSrcLoc, maxSrcLoc,
        totalIrCount, avgIrCount, minIrCount, maxIrCount
    };
}

// ─── Output ──────────────────────────────────────────────────────────────────

function writeResults(results: ProjectLocResult[]): void {
    const lines: string[] = [];

    lines.push('╔══════════════════════════════════════════════════════════════════════╗');
    lines.push('║     Lines of Code (LOC) Analysis Report — per Method                 ║');
    lines.push('╚══════════════════════════════════════════════════════════════════════╝');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    // Per-project details
    for (const r of results) {
        lines.push('──────────────────────────────────────────────────────────────────────');
        lines.push(`Project: ${r.projectName}`);
        lines.push('──────────────────────────────────────────────────────────────────────');
        if (r.status === 'failed') {
            lines.push(`  FAILED: ${r.error}`);
        } else {
            lines.push(`  Methods:                ${r.methodCount}`);
            lines.push(`  Source LOC / method:    ${r.avgSrcLoc}  (total: ${r.totalSrcLoc}, min: ${r.minSrcLoc}, max: ${r.maxSrcLoc})`);
            lines.push(`  IR stmts / method:      ${r.avgIrCount}  (total: ${r.totalIrCount}, min: ${r.minIrCount}, max: ${r.maxIrCount})`);
        }
        lines.push('');
    }

    // Summary table
    const succeeded = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');

    lines.push('╔══════════════════════════════════════════════════════════════════════╗');
    lines.push('║     Summary (order matching tab:time in thesis)                     ║');
    lines.push('╚══════════════════════════════════════════════════════════════════════╝');
    lines.push('');

    if (succeeded.length > 0) {
        // Order matching tab:time in thesis
        const order = [
            'ohos-weather', 'ohbili', 'my-store-ohos', 'IbestKnowTeach',
            'ArkTS-wphui1.0', 'HarmoneyOpenEye', 'harmony-netease', 'Harmonic',
            'open_neteasy_cloud', 'Rental'
        ];
        const sorted = [...succeeded].sort((a, b) => order.indexOf(a.projectName) - order.indexOf(b.projectName));

        const nameW = Math.max(...sorted.map(s => s.projectName.length), 7);
        const methodsW = 8;
        const srcLocTotalW = 10;
        const srcLocAvgW = 7;
        const irTotalW = 8;
        const irAvgW = 8;

        const header =
            'Project'.padEnd(nameW) + '  ' +
            'Methods'.padStart(methodsW) + '  ' +
            'Src LOC'.padStart(srcLocTotalW) + '  ' +
            'SrcAvg'.padStart(srcLocAvgW) + '  ' +
            'IR Stmts'.padStart(irTotalW) + '  ' +
            'IR Avg'.padStart(irAvgW);
        lines.push(header);
        lines.push('─'.repeat(header.length));

        for (const s of sorted) {
            const row =
                s.projectName.padEnd(nameW) + '  ' +
                String(s.methodCount).padStart(methodsW) + '  ' +
                String(s.totalSrcLoc).padStart(srcLocTotalW) + '  ' +
                String(s.avgSrcLoc).padStart(srcLocAvgW) + '  ' +
                String(s.totalIrCount).padStart(irTotalW) + '  ' +
                String(s.avgIrCount).padStart(irAvgW);
            lines.push(row);
        }

        // Totals row
        const totalMethods = succeeded.reduce((a, s) => a + s.methodCount, 0);
        const totalSrcLoc = succeeded.reduce((a, s) => a + s.totalSrcLoc, 0);
        const overallSrcAvg = totalMethods > 0 ? Math.round((totalSrcLoc / totalMethods) * 10) / 10 : 0;
        const totalIrCount = succeeded.reduce((a, s) => a + s.totalIrCount, 0);
        const overallIrAvg = totalMethods > 0 ? Math.round((totalIrCount / totalMethods) * 10) / 10 : 0;

        lines.push('─'.repeat(header.length));
        const totalRow =
            'TOTAL'.padEnd(nameW) + '  ' +
            String(totalMethods).padStart(methodsW) + '  ' +
            String(totalSrcLoc).padStart(srcLocTotalW) + '  ' +
            String(overallSrcAvg).padStart(srcLocAvgW) + '  ' +
            String(totalIrCount).padStart(irTotalW) + '  ' +
            String(overallIrAvg).padStart(irAvgW);
        lines.push(totalRow);
    }

    if (failed.length > 0) {
        lines.push('');
        lines.push(`Failed projects (${failed.length}):`);
        for (const f of failed) {
            lines.push(`  - ${f.projectName}: ${f.error}`);
        }
    }

    lines.push('');

    const output = lines.join('\n');
    fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');
    console.log(`\nWrote ${OUTPUT_FILE}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
    const projectNames = getProjectList();
    if (projectNames.length === 0) {
        console.log('No projects found in ' + OHOS_PROJECT_CONFIGS_DIR);
        return;
    }

    console.log(`Found ${projectNames.length} project(s). Processing...\n`);

    const results: ProjectLocResult[] = [];
    for (const name of projectNames) {
        console.log(`Processing ${name}...`);
        const t0 = Date.now();
        const result = analyzeProject(name);
        const elapsed = Date.now() - t0;
        if (result.status === 'success') {
            console.log(`  ${result.totalSrcLoc} src LOC / ${result.totalIrCount} IR stmts across ${result.methodCount} methods (${elapsed}ms)`);
        } else {
            console.log(`  FAILED: ${result.error} (${elapsed}ms)`);
        }
        results.push(result);
    }

    writeResults(results);
}

main();
