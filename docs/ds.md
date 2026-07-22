# ArkAnalyzer 源码目录结构

以下是 `src/` 下除 `src/taintAnalysis` 之外的所有一级/二级目录的功能说明。

---

## 架构总览

```
src/
├── index.ts              # Barrel export，汇总所有公共 API
├── Config.ts             # SceneConfig：项目配置（路径、SDK、选项）
├── Scene.ts              # Scene/ModuleScene：每个项目的中心模型
├── core/                 # IR + 分析基础设施（6 个二级目录）
├── callgraph/            # 调用图构建与指针分析（4 个二级目录）
├── pass/                 # 可扩展分析 Pass 框架
├── save/                 # IR 输出：源码、JSON、DOT 图、原始 IR（4 个二级目录）
├── transformer/          # IR 到 IR 的变换（如 SSA）
├── utils/                # 横切工具
└── VFG/                  # 值流图
```

---

## `src/core/` — IR 与分析基础设施

### `src/core/base/` — 核心 IR 类型

框架最底层的词汇表，所有上层模块都构建于此。

| 类/接口 | 作用 |
|---|---|
| `Value` | 值体系的根接口，定义 `getUses()` 和 `getType()` |
| `Local` | 具名变量或临时变量，主要的变量表示 |
| `AbstractExpr` → `ArkInstanceInvokeExpr`, `ArkStaticInvokeExpr`, `ArkNewExpr`, `ArkBinopExpr`, `ArkCastExpr`, `ArkPhiExpr` 等 | 所有表达式类型（三地址码格式） |
| `Stmt` → `ArkAssignStmt`, `ArkIfStmt`, `ArkReturnStmt`, `ArkThrowStmt` 等 | 所有语句类型 |
| `AbstractRef` → `ArkArrayRef`, `ArkInstanceFieldRef`, `ArkStaticFieldRef`, `ArkThisRef`, `ClosureFieldRef` 等 | 引用类型（左值） |
| `Type` → `PrimitiveType`, `ClassType`, `ArrayType`, `UnionType`, `IntersectionType`, `FunctionType`, `GenericType`, `AliasType` 等 | 完整类型系统（20+ 变体） |
| `Constant` → `NumberConstant`, `StringConstant`, `BooleanConstant` 等 | 字面常量 |
| `DefUseChain` | (值, 定值语句, 使用语句) 三元组 |
| `Trap` | try-catch 结构，将 try 块映射到 catch 块 |
| `Position` / `FullPosition` | 源码位置（行/列，紧凑数字编码） |
| `Decorator` | 装饰器表示（kind + content + param） |

### `src/core/common/` — IR 构造与推理辅助

"胶水"层。将 TypeScript AST 转换为 IR，并提供类型推断辅助工具。

| 类/文件 | 作用 |
|---|---|
| `ArkIRTransformer` | 将 TypeScript AST 节点转换为三地址码 IR |
| `TypeInference` | 类型解析静态方法：推断值类型、解析 `UnclearReferenceType`、泛型替换、类型关系检查 |
| `IRInference` | 直接在 IR 节点上进行类型推断（调用表达式、字段引用等） |
| `ValueUtil` | `Constant` 值工厂，带缓存 |
| `ModelUtils` | 导航辅助：按签名查找类/方法/字段/导出 |
| `Builtin` | 内置 JS/TS 类型（Object, Array, Set, Map, RegExp）及其方法签名 |
| `SdkUtils` | 加载 SDK `.d.ts` 类型声明文件 |
| `Const.ts` | 命名约定：`%` 前缀、`$` 分隔符、初始化方法名（`%instInit`）、临时变量命名 |
| `TSConst.ts` / `EtsConst.ts` | TypeScript/ArkTS 关键字和标识符常量 |
| `ArkError.ts` | 错误码/类型 |
| `ExprUseReplacer.ts` / `RefUseReplacer.ts` / `StmtDefReplacer.ts` | 访问者模式的替换器，用于 IR 变换 |
| `DummyMainCreater.ts` | 为无入口的程序创建合成 `main()` |
| `IRUtils.ts` | 通用 IR 辅助函数 |

### `src/core/graph/` — 控制流图与依赖图

过程内分析的结构主干，几乎每个下游分析都需要读取 CFG。

| 类 | 作用 |
|---|---|
| `Cfg` | 每个方法的控制流图。包含 `BasicBlock` 集合、`stmtToBlock` 映射、def-use 链 |
| `BasicBlock` | 基本块：顺序语句列表 + 前驱/后继边 |
| `DominanceFinder` | 计算立即支配者和支配边界（迭代算法） |
| `DominanceTree` | 基于 `DominanceFinder` 结果的支配树 |
| `DependsGraph` | 通用依赖图（节点 + 带属性的边） |
| `BaseExplicitGraph` / `BaseImplicitGraph` | 抽象图基类（显式存储边 vs 隐式推导边） |
| `GraphTraits` | 对不同图实现抽象的 Trait 接口 |
| `Scc` | 强连通分量（Tarjan 算法） |
| `ViewTree` | ArkUI 声明式 UI 组件树 |

### `src/core/graph/builder/` — CFG 构造

| 类 | 作用 |
|---|---|
| `CfgBuilder` | 主 CFG 构造器，遍历语句，构建块和边 |
| `ConditionBuilder` | if-else CFG 子图 |
| `LoopBuilder` | `for`/`while`/`do-while` CFG 子图 |
| `SwitchBuilder` | `switch` 语句 CFG 子图 |
| `TrapBuilder` | try-catch-finally CFG 子图 |
| `ViewTreeBuilder` | 从声明式标记构建 ArkUI 组件树 |

### `src/core/dataflow/` — 数据流分析引擎

提供通用数据流分析框架和具体分析。

| 类 | 作用 |
|---|---|
| `DataflowProblem<D>` | 抽象泛型数据流问题接口（`FlowFunction<D>`、零值、入口点） |
| `DataflowSolver<D>` | 完整 IFDS 求解器（过程间、有限、分配、子集）。路径边、摘要边、工作列表迭代 |
| `DataflowResult` | 存储每条语句的 `inFacts`/`outFacts` 和全局 facts |
| `Fact` | Fact 数据结构（`Value` 集合 + def-stmt 映射） |
| `Edge` | `PathEdge` / `PathEdgePoint` 类型 |
| `ReachingDef` | 具体的到达定义分析，使用 `SparseBitVector` 作为 fact 表示 |
| `UndefinedVariable` | 基于 IFDS 的潜在未定义变量使用检测 |
| `GenericDataFlow.ts` | 更简单的 `WorkListSolver`，适用于单过程问题 |

### `src/core/model/` — 高层程序模型

整个程序的语义表示：文件、类、方法及其互连关系。

| 类 | 作用 |
|---|---|
| `ArkFile` | 单个源文件：类、命名空间、导入、导出、默认类 |
| `ArkClass` | 类/结构体/接口/枚举：继承关系、方法（支持重载）、字段、泛型、视图树 |
| `ArkMethod` | 方法/函数/构造器：签名、体（CFG）、局部变量、泛型 |
| `ArkBody` | 方法体：局部变量映射、CFG、别名类型、traps（try-catch） |
| `ArkField` | 字段/属性：类别、签名、初始化器、修饰符 |
| `ArkSignature` 层级 | `FileSignature`, `ClassSignature`, `MethodSignature`, `MethodSubSignature`, `FieldSignature`, `LocalSignature`, `AliasTypeSignature` |
| `ArkImport` / `ArkExport` | 导入/导出声明 |
| `ArkNamespace` | TypeScript 命名空间（模块） |
| `ArkBaseModel` | 抽象基类：修饰符位掩码（public, private, static, readonly 等） |
| `ArkMetadata` | 将任意元数据（注释等）附加到语句和模型元素上 |

### `src/core/model/builder/` — 从 AST 构建模型

| 类/文件 | 作用 |
|---|---|
| `ArkFileBuilder.ts` | 从 TS AST 源文件构建 `ArkFile` |
| `ArkClassBuilder.ts` | 从类声明 AST 构建 `ArkClass` |
| `ArkMethodBuilder.ts` | 从函数/方法 AST 构建 `ArkMethod` |
| `ArkFieldBuilder.ts` | 从属性/枚举 AST 构建 `ArkField` |
| `ArkImportBuilder.ts` / `ArkExportBuilder.ts` | 导入/导出构造 |
| `ArkNamespaceBuilder.ts` | 命名空间构造 |
| `ArkSignatureBuilder.ts` | 签名构造 |
| `BodyBuilder.ts` | 方法体构造（局部变量 + CFG + traps） |

### `src/core/inference/` — 多阶段类型推断流水线

模型构建完成后，推断解析所有不明确的引用并补全类型。

| 类/文件 | 作用 |
|---|---|
| `Inference.ts` | 核心接口：`Inference`, `InferenceFlow` (preInfer → infer → postInfer), `InferenceManager` |
| `InferenceBuilder.ts` | 推断流水线的抽象工厂（按语言区分） |
| `ModelInference.ts` | 具体推断类：`FileInference`, `ClassInference`, `MethodInference`, `StmtInference`, `ImportInfoInference` |
| `ValueInference.ts` | 语言特定的值推断（`InferLanguage` 枚举：`ARK_TS1_1`, `ARK_TS1_2`, `JS`, `ABC`） |

### `src/core/inference/arkts/` — ArkTS/TS 推断

为不同的 TypeScript 和 JavaScript 变体实现推断。

### `src/core/inference/abc/` — ABC（Ark Byte Code）推断

为 Ark Byte Code 输入（编译后的 `.abc` 文件而非源码）实现推断。

---

## `src/callgraph/` — 调用图与指针分析

### `src/callgraph/model/` — 调用图数据结构

| 类 | 作用 |
|---|---|
| `CallGraph` | 中心调用图。节点（`CallGraphNode`：方法 + 类别），边（`CallGraphEdge`：调用点集合），`CallSiteManager` |
| `CallSite` / `DynCallSite` | 一个调用点。`DynCallSite` 存储尚未解析的调用点，等待指针分析解析 |
| `CallSiteManager` | 所有调用点的全局注册表 |
| `CallGraphBuilder`（位于 `model/builder/`） | 构建初始调用图：直接静态调用、CHA、RTA。设置入口方法 |

### `src/callgraph/algorithm/` — 调用图算法

| 类 | 作用 |
|---|---|
| `AbstractAnalysis` | 抽象基类：工作列表、`processMethod()`、`resolveCall()`、CHA 层次结构辅助 |
| `ClassHierarchyAnalysis` | CHA：遍历整个类层次结构来解析虚调用。保守（过近似） |
| `RapidTypeAnalysis` | RTA：通过跟踪哪些类确实被 `new` 实例化来修剪 CHA。更精确 |

### `src/callgraph/pointerAnalysis/` — Andersen 风格指针分析

最精确的调用图构造。构建指针赋值图（PAG），求解约束，在运行中动态精化调用边。

| 类 | 作用 |
|---|---|
| `PointerAnalysis` | 主驱动。继承 `AbstractAnalysis`。迭代：PAG 求解 → 动态调用解析 → PAG 重建 |
| `Pag` | 指针赋值图。二分图：指针节点 + 对象节点。边种类：Address、Copy、Load、Write、This |
| `PagBuilder` | 从 ArkIR 赋值构造 PAG。处理调用参数/返回值边、过程间边 |
| `PointerAnalysisConfig` | 配置：上下文敏感深度（k-limit）、上下文类型、分析规模、调试标志 |
| `PtsDS` | 指向集数据结构（`PtsSet`、稀疏 `PtsBV`、支持差分的 `DiffPTData`） |
| `PTAUtils` | 识别内置 API（Array.push, Map.get/set, Function.bind/call/apply, forEach） |
| `DummyCallCreator` | 为 ArkUI 组件生命周期回调创建合成调用边 |

### `src/callgraph/pointerAnalysis/context/` — 上下文敏感

| 类 | 作用 |
|---|---|
| `Context` | 抽象不可变上下文链。三种变体：`CallSiteContext`、`ObjContext`、`FuncContext` |
| `ContextSelector` | 从调用者上下文选择被调用者上下文。三种变体对应以上三种上下文类型 |
| `ContextItem` | 上下文元素：`CallSiteContextItem`、`ObjectContextItem`、`FuncContextItem` |

### `src/callgraph/pointerAnalysis/plugins/` — API 特定的指针流插件

| 插件 | 作用 |
|---|---|
| `IPagPlugin` | 插件接口：`canHandle()` + `processCallSite()` |
| `PluginManager` | 注册表：对每个调用点按顺序尝试各插件 |
| `SdkPlugin` | 处理 SDK 方法调用（在 SDK 边界创建虚拟 PAG 节点） |
| `FunctionPlugin` | `Function.call/apply/bind`：调整 `this` 绑定和参数列表 |
| `ContainerPlugin` | `Array.push`, `Set.add`, `Map.get/set`, `forEach` 指针流 |
| `StoragePlugin` | ArkUI 状态：`AppStorage`, `LocalStorage`, `SubscribedAbstractProperty` |
| `TaskPoolPlugin` | `@ohos.taskpool` 多线程 |
| `WorkerPlugin` | `@ohos.worker` 多线程 |

### `src/callgraph/common/` — 统计

| 类 | 作用 |
|---|---|
| `PTAStat`, `PAGStat`, `CGStat` | 指针分析、PAG、调用图构造的性能/精度指标 |

---

## `src/pass/` — 分析 Pass 框架

| 类/文件 | 作用 |
|---|---|
| `Pass.ts` | 抽象 Pass 接口：`FilePass`、`ClassPass`、`MethodPass` + 类型化上下文链 |
| `Context.ts` | 泛型层次化上下文（`Context<U, T>`），用于跨 Pass 层级共享数据 |
| `Dispatcher.ts` | 分发表：通过 `instanceof` 将具体的 stmt/value 类型匹配到处理函数 |
| `ScenePassMgr.ts` | 编排器：遍历文件/类/方法，实例化并调用 Pass，分发语句 |

### `src/pass/validators/` — 结构验证器（基于 Pass 框架构建）

| 类 | 作用 |
|---|---|
| `Validator.ts` | 抽象验证器（`StmtValidator`、`ValueValidator`、`FileValidator` 等）+ `ArkValidatorRegistry` |
| `SceneValidator.ts` | 顶层：通过 `ScenePassMgr` 连接验证器 |
| `Models.ts` | `ArkFileValidator`, `ArkClassValidator`, `ArkMethodValidator` |
| `Stmts.ts` | `AssignStmtValidator`：检查赋值左操作数是 `Local` 或 `AbstractFieldRef` |
| `Exprs.ts` | `AbsInvokeValidator`：检查调用参数是 `Local` 或 `Constant` |
| `Values.ts` | `LocalValidator`：检查具名 local 有声明语句 |

---

## `src/save/` — IR 输出 / 序列化

### 顶级文件

| 文件 | 作用 |
|---|---|
| `Printer.ts` | 抽象基类：包装 `ArkCodeBuffer`，提供 `dump(): string` |
| `ArkStream.ts` | `ArkCodeBuffer`：带缩进管理的字符串构建器。`ArkStream`：写入文件系统 |
| `PrinterBuilder.ts` | 入口点：`dumpToTs()`, `dumpToDot()`, `dumpToJson()`, `dumpToIR()` |
| `ScenePrinter`（位于 `PrinterBuilder.ts`） | 按项目批量输出 |
| `DotPrinter.ts` | CFG DOT 输出：`DotMethodPrinter` → `DotClassPrinter` → `DotFilePrinter` |
| `GraphPrinter.ts` | 通用 DOT 打印器，适用于任何 `GraphTraits` 实现 |
| `ViewTreePrinter.ts` | ArkUI 视图树 → DOT 输出 |

### `src/save/base/` — 共享打印基础设施

| 类/文件 | 作用 |
|---|---|
| `BasePrinter` | 源码打印器基类。打印装饰器、修饰符、注释 |
| `ImportPrinter` / `ExportPrinter` | 导入/导出语句 → TypeScript 源码 |
| `PrinterUtils` | 检测匿名类/方法、ArkUI 组件调用、临时变量等 |

### `src/save/source/` — IR → 源码反编译器

最复杂的打印器。将 SSA 形式的三地址码转换回惯用的 TypeScript。

| 类 | 作用 |
|---|---|
| `SourceFilePrinter` | 顶层：imports → namespaces → classes → exports，按行号排序 |
| `SourceTransformer` | 核心引擎：对所有 IR 值/类型种类的 `valueToString()`、`typeToString()` |
| `SourceClass` | `ArkClass` → `class Foo { ... }` |
| `SourceMethod` | `ArkMethod` → `function foo() { ... }` |
| `SourceBody` | 从 CFG 重建控制流结构（if/while/for/try），遍历基本块关系 |
| `SourceStmt` 子类 | `SourceAssignStmt`, `SourceInvokeStmt`, `SourceIfStmt`, `SourceWhileStmt`, `SourceForStmt`, `SourceReturnStmt`, `SourceThrowStmt`, `SourceTryStmt` 等 |
| `SourceField` / `SourceNamespace` | 字段声明、命名空间声明 |

### `src/save/arkir/` — 原始 IR 文本输出

直接输出 SSA 形式 IR（带标签、跳转、临时变量），不反编译为惯用的 TS。用于调试。

### `src/save/json/` — 完整模型 → JSON 序列化

通过带 tagged union 的 DTO 将所有模型/IR 类型完整序列化为 JSON。用于外部工具集成。

---

## `src/transformer/` — IR 变换

| 文件 | 作用 |
|---|---|
| `Transformer.ts` | 抽象基类 |
| `SceneTransformer.ts` | 项目级变换骨架（尚未实现） |
| `FunctionTransformer.ts` | 函数级变换骨架（尚未实现） |
| `StaticSingleAssignmentFormer.ts` | **唯一的具象变换**：将 `ArkBody` 转换为 SSA 形式。每块收集定义 → 计算支配边界 → 插入 `ArkPhiExpr` → 重命名变量 |

---

## `src/utils/` — 横切工具

| 文件 | 作用 |
|---|---|
| `FileUtils.ts` | 文件发现、语言检测、模块路径解析 |
| `logger.ts` | 基于 log4js 的日志系统（ERROR/WARN/INFO/DEBUG/TRACE），按模块区分 |
| `getAllFiles.ts` | 递归文件遍历，支持忽略模式 |
| `pathTransfer.ts` | Windows→Unix 路径规范化 |
| `json5parser.ts` | JSON5 解析器（通过 ohos-typescript 解析器） |
| `callGraphUtils.ts` | `MethodSignatureManager`、`SceneManager`（SDK 回退、类层次遍历） |
| `entryMethodUtils.ts` | HarmonyOS/ArkUI 生命周期方法名和回调辅助函数 |
| `AstTreeUtils.ts` | AST 创建/缓存，使用 SHA-256 键 |
| `SparseBitVector.ts` | LLVM 风格稀疏位向量，用于内存高效的集合操作 |
| `ValueAsserts.ts` | 调试断言辅助 |
| `crypto_utils.ts` | SHA-256 哈希，Java 风格的 `hashcode()` |

---

## `src/VFG/` — 值流图

| 类/文件 | 作用 |
|---|---|
| `DVFG`（位于 `DVFG.ts`） | Direct Value Flow Graph（直接值流图）。节点 = 语句，边 = 直接 def-use 关系。节点种类：assign, copy, write, load, addr, if, actualParm, formalParm 等 |
| `DVFGBuilder.ts` | 通过对每个方法的 CFG 运行到达定义分析，然后将 def-stmt 连接到 use-stmt 来构建 DVFG |

---
