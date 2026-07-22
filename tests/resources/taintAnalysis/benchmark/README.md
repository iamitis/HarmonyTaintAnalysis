# Benchmark

Evaluates the live-variable pruning optimization in the IFDS taint analysis solver. Runs analysis on real-world OpenHarmony projects with and without optimization, comparing processed edge counts and execution time.

## Files

- `example.json` — schema reference
- `optimize.json` — results with pruning **enabled**
- `normal.json` — results with pruning **disabled**
- `diff.json` — comparison: per-project metrics with reduction rates, and average reduction rates across projects
- `archive/` — archived snapshots of the above three files

## Usage

```bash
# Single run (optimize ON, single measurement)
npx ts-node tests/samples/TaintAnalysisBenchmark.ts --optimize --all --runs 1

# Single run (optimize OFF, 3 runs for statistics)
npx ts-node tests/samples/TaintAnalysisBenchmark.ts --no-optimize --project ArkTS-wphui1.0 --runs 3

# Diff mode (runs both, writes all three files, 3 runs each)
npx ts-node tests/samples/TaintAnalysisBenchmark.ts --diff --all --runs 3

# Multi-project
npx ts-node tests/samples/TaintAnalysisBenchmark.ts --diff --projects ArkTS-wphui1.0,ohbili,ohos-weather --runs 5
```

## Archive

Archive existing benchmark results (normal/optimize/diff) into a timestamped snapshot:

```bash
npx ts-node tests/resources/taintAnalysis/benchmark/archive.ts my-experiment
npx ts-node tests/resources/taintAnalysis/benchmark/archive.ts              # uses timestamp as name
```

Output: `archive/<name>.json` combining whichever result files exist.

## Metrics

### Core metrics

| Metric | Description |
|--------|-------------|
| `processedEdgeNum` | Total IFDS edges processed (taint + alias solver, combined) |
| `solveTime` | Mean pure doSolve() time across N runs (ms) |
| `dataflowAnalysisTime` | runDataflowAnalysis wall-clock time (ms) |
| `taintAnalysisTime` | Entire analyzeHarmonyApp/analyzeDirectory wall-clock time (ms) |
| `solveTimeRuns` | Raw solveTime for each run |
| `solveTimeStdDev` | Standard deviation of solveTime across runs |
| `leakPathNum` | Taint leak paths found (should be equal with/without pruning) |

### Solver-specific edge counts

| Metric | Description |
|--------|-------------|
| `taintSolverEdgeCnt` | Edges processed by TaintSolver (forward, after pruning) |
| `aliasSolverEdgeCnt` | Edges processed by AliasSolver (backward, no pruning) |
| `taintSolverNormalEdgeCnt` | Normal-flow edges (TaintSolver) |
| `taintSolverCallEdgeCnt` | Call-flow edges (TaintSolver) |
| `taintSolverReturnEdgeCnt` | Return-flow edges (TaintSolver) |
| `taintSolverPrunedEdgeCnt` | Edges skipped by liveness pruning (TaintSolver) |

### Optimization overhead

| Metric | Description |
|--------|-------------|
| `livenessTime` | Time spent in liveness analysis (ms) |

### Project characterization (per-project, identical across modes)

| Metric | Description |
|--------|-------------|
| `sourceDefNum` | Number of source definitions loaded |
| `sinkDefNum` | Number of sink definitions loaded |
| `loc` | Lines of code in .ets/.ts files |
| `classCnt` | Number of ArkTS classes |
| `methodCnt` | Number of ArkTS methods |
| `abilityCnt` | Number of UIAbility/ExtensionAbility classes |
| `componentCnt` | Number of @Component-decorated classes |
| `callbackCnt` | Number of callbacks from ViewTree |

### Multi-run

| Metric | Description |
|--------|-------------|
| `runs` | Number of runs per project |
| `runsPerProject` | (BenchmarkResult level) Runs per project |

To add a new metric: add a field to `ProjectMetrics`, collect it in `runBenchmark`, and update `computeDiff` if it needs comparison.
