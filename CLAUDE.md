# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

ArkAnalyzer is a static program analysis framework for ArkTS (OpenHarmony/HarmonyOS) applications. My work on this codebase is my **undergraduate graduation project** — I'm implementing static taint analysis for OpenHarmony apps using the IFDS framework, building on top of ArkAnalyzer's existing IR and analysis infrastructure.

My implementation lives in `src/taintAnalysis/`. Read `src/taintAnalysis/README.md` for detailed architecture, usage, test status, known limitations, and debugging tips.

## Critical boundary rule

- **Read** code in `src/` outside `src/taintAnalysis` when needed to understand the framework (Scene, call graph, CFG, IR model, dataflow interfaces, etc.)
- **NEVER modify** any code outside `src/taintAnalysis/`, `tests/unit/taintAnalysis/`, `tests/resources/taintAnalysis/`, `tests/samples/TaintAnalysisTest.ts`, and `paper/`/`undergraduate/`. The rest of `src/` is the upstream ArkAnalyzer framework — treat it as read-only.

### Taint analysis specific tests

```bash
# Run all HapBench tests (59/67 pass)
npx vitest --run tests/unit/taintAnalysis/hapBench/HapBench.test.ts # 最好不要进行这个测试, 因为它非常耗时. 除非用户明确要求

# Run Bulk (Heap) tests, filter by name (80/84 pass)
npx vitest --run tests/unit/taintAnalysis/transFromFlowDroid/Heap.test.ts --testNamePattern 'simpleTest -'

# Run Basic tests (9/9 pass)
npx vitest --run tests/unit/taintAnalysis/transFromFlowDroid/Basic.test.ts

# Debug with full console output (vitest buffers console.log)
npx ts-node tests/samples/TaintAnalysisTest.ts
```

## Taint analysis architecture

See `src/taintAnalysis/README.md` for the full directory tree and component descriptions. Key layers:

- **Entry**: `TaintAnalysis.ts` — orchestrates the full analysis pipeline (parse app → collect components/callbacks → build dummy main → run IFDS)
- **IFDS solver**: `ifds/solver/TaintSolver.ts` (forward taint propagation), `ifds/solver/AliasSolver.ts` (backward alias search), `ifds/solver/SolverPeerGroup.ts` (shared incoming table between solvers)
- **Rules**: `ifds/rules/` — `SourceRule`, `SinkRule`, `StaticPropagationRule`, `LHSOverwrittenRule`, `SpecialMethodRule`, `AnonymousRule` define flow functions for IFDS edges
- **Lifecycle modeling**: `mainMethodCreaters/` — `HarmonyMainMethodCreater`, `UIAbilityMainMethodCreater`, `ComponentMainMethodCreater`, extension abilities; generates the "dummy main method" that models OpenHarmony app lifecycle
- **Source/Sink definitions**: `sourcesAndSinks/` — JSON-based source/sink specification, loaded by `JsonSourceSinkManager`
- **Config**: `config/TaintAnalysisConfig.ts` (project type, source/sink files), `config/IFDSConfig.ts` (alias strategy, static field tracking)
- **Results**: `results/TaintAnalysisResult.ts` — stores `SourceToSinkInfo` with taint paths

### Current test status summary (from README)

| Test file | Pass/Total | Notes |
|-----------|-----------|------|
| Basic.test.ts | 9/9 | All pass |
| Heap.test.ts | 80/84 | 4 failures: array length, reverse alias |
| HapBench.test.ts | 59/67 | 8 failures: callback registration, array index, exceptions, static fields, Want, FileReadWrite |

### Known limitations (from README)

- No array length taint tracking
- AccessPath depth unbounded (may loop on recursive data structures)
- No statement-level must-alias/partial-alias pointer analysis
- Exception handling: throwValue → caughtValue not mapped
- Implicit flows not handled
- OpenHarmony: registration-style callbacks (e.g., `geoLocationManager.off`) not recognized
- OpenHarmony: Want parameter not treated as Source
- OpenHarmony: Source/Sink definitions incomplete for more APIs

可能在论文的“当前局限”中说明

## Graduation project resources

### Thesis

Thesis writing follows the outline in `undergraduate/Outline.md`. The current draft is `undergraduate/Draft.tex` (copied from `njuthesis-sample.tex`). After editing, compile with:

```bash
cd undergraduate && latexmk -xelatex Draft
```

If compilation fails, fix the LaTeX errors. The bibliography is in `njuthesis-sample.bib`.

Each time you edit Draft.tex, re-compile to catch LaTeX errors early.

njuthesis 模板使用方法参考 `undergraduate/README.md` 和 `undergraduate/Intro4Njuthesis.pdf` (可用 pdf skill 阅读)。

### Proposal & interim report

- `undergraduate/Proposal.md` — Research proposal: background, related work (IFDS, FlowDroid, ArkAnalyzer), methodology, timeline
- `undergraduate/Interim.md` — Completed work summary: component/routing analysis, lifecycle modeling, IFDS taint analysis with alias analysis, HapBench/Basic/Heap test porting, live variable analysis pruning (30% time reduction, 20-50% edge reduction)

### Related work (PDFs)

- `paper/arkAnalyzer.pdf` — Chen et al. (2025), the ArkAnalyzer framework paper
- `paper/flowdroid2666356.2594299.pdf` — Arzt et al. (2014), FlowDroid paper
- `paper/ifds.pdf` — Reps, Horwitz, Sagiv (1995), the IFDS algorithm paper

## Key interfaces to ArkAnalyzer framework (read-only)

When working on taint analysis, you may need to read these framework parts:

- `src/Scene.ts` — Central IR. `Scene.buildSceneFromProjectDir()`, `buildScene4HarmonyProject()`, `inferTypes()`, `makeCallGraphVPA()`, `getFiles()`, `getClasses()`, `getMethods()`
- `src/Config.ts` — `SceneConfig` for setting up analysis targets and SDKs
- `src/core/model/ArkMethod.ts` — Methods have `getBody().getCfg()` for CFG access
- `src/core/model/ArkClass.ts` — Classes with methods, fields, inheritance
- `src/core/base/Stmt.ts`, `src/core/base/Expr.ts`, `src/core/base/Ref.ts` — IR statement/expression/reference types
- `src/core/graph/Cfg.ts` — Control flow graph (BasicBlocks, Stmts)
- `src/core/dataflow/DataflowProblem.ts` — `FlowFunction` interface, `DataflowProblem` abstract class
- `src/core/common/TypeInference.ts` — Type inference
- `src/callgraph/model/CallGraph.ts` — Call graph data structure
- `src/callgraph/pointerAnalysis/PointerAnalysis.ts` — Andersen-style pointer analysis (由于它的局限, taint analysis 暂时停止使用它)
- `src/index.ts` — Barrel file showing all public exports

若需快速理解，可参考 `.qoder/repowiki/zh/content/` 下的文档
