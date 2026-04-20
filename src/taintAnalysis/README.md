# TaintAnalysis 污点分析器

基于 IFDS（Interprocedural Finite Distributive Subset）框架的污点分析器，支持通用 TypeScript/ArkTS 代码以及鸿蒙（OpenHarmony）应用的数据流污点分析。

## 目录结构

```
src/taintAnalysis/
├── TaintAnalysis.ts          # 入口类，编排全流程
├── index.ts                  # 对外导出
├── config/
│   ├── TaintAnalysisConfig.ts # 分析配置（项目类型、Source/Sink 文件、IFDS 配置等）
│   └── IFDSConfig.ts          # IFDS 算法配置（别名策略、静态字段追踪模式）
├── ifds/
│   ├── AccessPath.ts         # 访问路径建模
│   ├── TaintFact.ts          # 污点事实
│   ├── FactAtSink.ts         # Sink 处的污点泄漏, 用于结果建模
│   ├── IFDSManager.ts        # IFDS 框架管理器
│   ├── Postdominator.ts      # 用于后续隐式流分析
│   ├── problem/
│   │   ├── AbstractTaintProblem.ts
│   │   ├── AliasProblem.ts
│   │   └── TaintProblem.ts
│   ├── solver/
│   │   ├── AbstractTaintSolver.ts
│   │   ├── TaintSolver.ts    # 正向污点求解器
│   │   ├── AliasSolver.ts    # 反向别名求解器
│   │   └── SolverPeerGroup.ts # 求解器共享组（共享 incoming 表）
│   ├── aliasing/
│   │   ├── Aliasing.ts           # 别名管理
│   │   ├── IAliasingStrategy.ts  # 别名策略接口
│   │   ├── FlowSensitiveAliasStrategy.ts # 流敏感别名策略
│   │   └── NullAliasStrategy.ts  # 无别名策略
│   └── rules/
│       ├── Rule.ts              # 规则接口 & AbstractRule
│       ├── RuleManager.ts       # 规则管理器，初始化并添加各个 Rule 实例
│       ├── SourceRule.ts        # Source 识别规则
│       ├── SinkRule.ts          # Sink 识别规则
│       ├── LHSOverwrittenRule.ts # 左值覆写规则
│       ├── SpecialMethodRule.ts # 特殊方法规则（如 toString）
│       ├── StaticPropagationRule.ts # 静态字段传播规则
│       └── AnonymousRule.ts    # 匿名方法/类/闭包等规则
├── mainMethodCreaters/
│   ├── MainMethodCreater.ts            # 基类，提供 CFG 构建工具方法
│   ├── HarmonyMainMethodCreater.ts     # 鸿蒙应用 DummyMain 构建器
│   ├── UIAbilityMainMethodCreater.ts   # UIAbility 生命周期建模
│   ├── ComponentMainMethodCreater.ts   # 组件生命周期建模
│   └── extensionAbilities/
│       ├── BackupExtensionAbilityMainMethodCreater.ts
│       └── FormExtensionAbilityMainMethodCreater.ts
├── sourcesAndSinks/
│   ├── SourceSinkDefinition.ts        # Source/Sink 定义模型
│   ├── SourceSinkDefinitionFactory.ts # Source/Sink 定义工厂, 解析 json 定义文件
│   ├── SourceSinkManager.ts          # Source/Sink 管理接口, 数据流分析通过它来判断 source/sink
│   ├── JsonSourceSinkManager.ts      # JSON 格式 Source/Sink 加载器
│   └── matchers/
│       ├── MethodMatcher.ts          # 方法型 source/sink 匹配器
│       └── FieldMatcher.ts           # 字段型 source/sink 匹配器, 用于未来拓展
├── results/
│   └── TaintAnalysisResult.ts  # 分析结果（SourceToSinkInfo）, 包括污点路径, source/sink 定义
├── CallbackCollector.ts        # 回调收集器
├── ComponentCollector.ts       # 组件/路由收集器
└── util.ts                     # 工具函数
```

## 使用方法

### 1. 分析通用 TypeScript 项目（Directory 模式）

对指定方法进行污点分析，无需鸿蒙 SDK：

```typescript
import { Scene, SceneConfig } from '../../src/Scene';
import { TaintAnalysis } from '../../src/taintAnalysis';
import { TaintAnalysisConfig, TaintAnalysisProjectType, SourceAndSinkFileType } from '../../src/taintAnalysis/config/TaintAnalysisConfig';
import { AliasingStrategy } from '../../src/taintAnalysis/config/IFDSConfig';

// 1. 构建 Scene
const config = new SceneConfig();
config.buildFromProjectDir('/path/to/project');
const scene = new Scene();
scene.buildSceneFromProjectDir(config);
scene.inferTypes();

// 2. 配置污点分析
const taintConfig = new TaintAnalysisConfig();
taintConfig.projectType = TaintAnalysisProjectType.Directory;
taintConfig.methodToBeAnalyzed = scene.getMethods().find(m => m.getName() === 'myMethod');
taintConfig.sourceAndSinkConfig = {
    definitionFilePath: '/path/to/SourceSinkDefinition.json',
    definitionFileType: SourceAndSinkFileType.JSON,
};
taintConfig.ifdsConfig.aliasingStrategy = AliasingStrategy.FlowSensitive;

// 3. 运行分析
const analyzer = new TaintAnalysis(scene, taintConfig);
analyzer.analyze();

// 4. 获取结果
analyzer.getTaintAnalysisResult().forEach(res => {
    console.log(res.toString());
});
```

### 2. 分析鸿蒙应用（OpenHarmony 模式）

对鸿蒙 HAP 项目进行全流程污点分析，需要指定 SDK 路径：

```typescript
import { Scene, SceneConfig, Sdk } from '../../src/Config';
import { TaintAnalysis } from '../../src/taintAnalysis';
import { TaintAnalysisConfig, TaintAnalysisProjectType, SourceAndSinkFileType } from '../../src/taintAnalysis/config/TaintAnalysisConfig';
import { AliasingStrategy } from '../../src/taintAnalysis/config/IFDSConfig';
import path from 'path';

// 1. 配置 SDK
const sdk: Sdk = {
    name: 'etsSdk',
    path: '/path/to/openharmony/ets',
    moduleName: '',
};

// 2. 构建 Scene
const sceneConfig = new SceneConfig();
sceneConfig.buildConfig('MyApp', '/path/to/hap/project', [sdk]);
const scene = new Scene();
scene.buildSceneFromProjectDir(sceneConfig);
scene.inferTypes();

// 3. 配置污点分析
const taintConfig = new TaintAnalysisConfig();
taintConfig.projectType = TaintAnalysisProjectType.OpenHarmony;
taintConfig.sourceAndSinkConfig = {
    definitionFilePath: '/path/to/SourceSinkDefinition.json',
    definitionFileType: SourceAndSinkFileType.JSON,
};
taintConfig.ifdsConfig.aliasingStrategy = AliasingStrategy.FlowSensitive;

// 4. 运行分析（自动完成：parseApp → collectComponents → collectCallbacks → createMainMethod → runDataflowAnalysis）
const analyzer = new TaintAnalysis(scene, taintConfig);
analyzer.analyze();

// 5. 获取结果
analyzer.getTaintAnalysisResult().forEach(res => {
    console.log(res.toString());
});
```

### 核心配置说明

| 配置项 | 说明 | 可选值 |
|--------|------|--------|
| `projectType` | 项目类型 | `Directory` / `OpenHarmony` |
| `methodToBeAnalyzed` | 入口方法（Directory 模式必填） | `ArkMethod` 实例 |
| `sourceAndSinkConfig.definitionFilePath` | Source/Sink 定义文件路径 | JSON 文件路径 |
| `sourceAndSinkConfig.definitionFileType` | 定义文件类型 | `JSON` |
| `ifdsConfig.aliasingStrategy` | 别名分析策略 | `FlowSensitive` / `None` |
| `ifdsConfig.staticFieldTrackingMode` | 静态字段追踪模式 | `ContextFlowSensitive` / `None` |


## 如何拓展

### 1. 拓展 ExtensionAbility 建模

在 `src/taintAnalysis/mainMethodCreaters/extensionAbilities/` 下新建文件，继承 `BaseMainMethodCreater`，实现 `addStmtsToCfg()` 方法。

参考 `BackupExtensionAbilityMainMethodCreater.ts`：

基类 `BaseMainMethodCreater` 提供的工具方法：
- `getOrCreateClassLocal(cls)` — 获取或创建类的 Local 变量（含 new + 构造函数调用）
- `addLifecycleCalls(cls, local, methodNames)` — 添加生命周期方法调用
- `addCallbackInvoke(callback)` — 添加回调方法调用
- `createParamLocals(method)` — 为方法参数创建 Local 变量
- `wrapWithIfBranch(body)` — 在 CFG 中创建条件分支
- `wrapWithDoWhileLoop(body)` — 在 CFG 中创建 do-while 循环

### 2. 拓展数据流分析规则

在 `src/taintAnalysis/ifds/rules/` 下新建规则类，继承 `AbstractRule`，按需实现四个边类型的方法，然后注册到 `RuleManager`。

## 运行测试

测试框架为 [vitest](https://vitest.dev/)，位于 `tests/unit/taintAnalysis/`。

```bash
# 运行全部 HapBench 测试
node ./node_modules/vitest/vitest.mjs run tests/unit/taintAnalysis/hapBench/HapBench.test.ts

# 运行 Heap 测试，并用 testNamePattern 过滤特定用例
npx vitest --run tests/unit/taintAnalysis/transFromFlowDroid/Heap.test.ts --testNamePattern 'simpleTest -'
```

## 测试通过情况

| 测试文件 | 通过 / 总计 | 说明 |
|----------|------------|------|
| Basic.test.ts | **9/9** | 全部通过 |
| Heap.test.ts | **80/84** | 4 个未通过，涉及数组长度污染、反向别名分析等 |
| HapBench.test.ts | **59/67** | 8 个未通过，详见下方 |

### HapBench 未通过用例

| 用例 | 原因 |
|------|------|
| `Anonymous Constructs/AnonymousMethod8` | 暂未识别鸿蒙的注册型回调 |
| `Array-Like Structures/ArrayIndexNoLeak` | 误报，未实现数组下标精度 |
| `General Language Features/Exceptions2` | ArkAnalyzer 为保证异常传播复制 finally 块，导致多报一条泄漏 |
| `General Language Features/Exceptions4` | 未映射 throwValue → caughtValue |
| `General Language Features/StaticFieldInit` | 静态字段初始化场景未完全支持 |
| `OpenHarmony Specific APIs/CallbackInSource` | 暂未识别鸿蒙的注册型回调 |
| `OpenHarmony Specific APIs/DirectLeak-want` | 未将 Want 参数视作 Source |
| `OpenHarmony Specific APIs/FileReadWrite` | 待补充 SourceSinkDefinition |

## 目前功能缺陷

### 数据流分析

- **数组长度污染**：没有处理数组长度被污染的情况（如 `arr.length`），`Heap.test.ts` 中的 `arrayLengthAliasTest1/2` 会因此误报
- **AccessPath 深度无限制**：遇到递归型字段（如 Tree 结构、链表结构），可能会陷入无限循环生成 AccessPath
- **语句级指针分析缺失**：未实现语句级的指针分析（must-alias / partial-alias），部分用例（特别是反向别名分析）可能会误报
- **异常处理映射缺失**：未处理 try-catch 中 `throwValue → caughtValue` 的映射
- **隐式流未处理**：未处理基于控制流的隐式信息流

### 鸿蒙建模

- **生命周期回调不完整**：待加入更详细的生命周期回调建模
- **注册型回调未处理**：如 `geoLocationManager.off('locationChange', callBack)` 等注册型回调尚未识别
- **Want 参数未处理**：未将 Want 参数视作 Source，也未处理组件间、Ability 间数据流分析
- **Source/Sink 定义不足**：更多鸿蒙 API 的 Source/Sink 定义待补充

## 调试方法

由于 vitest 不方便实时查看控制台输出（`console.log` 被缓冲），可参考 `tests/samples/TaintAnalysisTest.ts` 进行调试：

可直接用 `npx ts-node` 运行：

```bash
npx ts-node tests/samples/TaintAnalysisTest.ts
```