---
title: "04 · 工具系统的抽象设计：一个工业级工具的解剖"
description: "前三篇里的 executeTool(name, input) 是个玩具。真实工具要自带参数校验、动态描述、权限检查、并发/只读/危险性标记、以及“给模型看”和“给人看”两套结果渲染。本篇解剖一个工业级 Tool 接口，并讲透两个决定性设计：元数据驱动编排，与安全默认(fail-closed)。"
source: "https://daiw.org/manual/llm-to-agent/tool-abstraction"
---

# 04 · 工具系统的抽象设计：一个工业级工具的解剖

> 前三篇里的 executeTool(name, input) 是个玩具。真实工具要自带参数校验、动态描述、权限检查、并发/只读/危险性标记、以及“给模型看”和“给人看”两套结果渲染。本篇解剖一个工业级 Tool 接口，并讲透两个决定性设计：元数据驱动编排，与安全默认(fail-closed)。

## 04 · 工具系统的抽象设计：一个工业级工具的解剖

[上一篇](/manual/agent/llm-to-agent/agent-loop)的循环里，反复出现一个含糊的 `executeTool(name, input)`。它能演示原理，但真要撑起一个 Coding Agent，一个工具远不止“一个执行函数”。这一篇，我们把 `Tool` 彻底拆开。

## 一、背景：玩具 `executeTool` 撑不起真实系统

回想一下，一个真实的工具(比如“编辑文件”)在被调用时，系统需要知道的远不止“怎么执行”：

- 模型传来的参数**合法吗**？(路径存在吗？字段齐吗？)
- 这个操作**要不要用户批准**？(改文件危险，读文件不危险)
- 它能**和别的工具并行**跑吗？(读可以并行，写不能乱序)
- 执行完，**给模型看什么**？(结构化、省 token 的文本)
- 又**给用户看什么**？(带高亮的漂亮 diff)
- 结果**太大**了怎么办？(几万行输出不能直接塞进上下文)

一个 `(name, input) => string` 的函数签名，承载不了这些。我们需要把工具设计成一个**富接口**：执行只是它的一个方法，围绕执行，还有一整圈元数据和钩子。

## 二、解剖：一个工业级 Tool 接口

下面是把生产级工具接口**提炼**出来的样子(用 TS 表达，去掉了 UI 框架细节)。别被长度吓到，我们分组来看：

```ts [一个工业级工具的核心契约]
interface Tool<Input, Output> {
  // ── 身份 ──
  name: string
  // 描述是异步、动态的:可以根据当前上下文(权限模式、可用工具)变化
  description(input: Input, ctx: Context): Promise<string>
  inputSchema: ZodSchema<Input>          // 用 zod 定义,再自动转成 JSON Schema 给模型

  // ── 执行 ──
  call(input: Input, ctx: Context): AsyncGenerator<Progress, Output>

  // ── 闸门:执行前的两道关 ──
  validateInput(input: Input, ctx: Context): Promise<ValidationResult>
  checkPermissions(input: Input, ctx: Context): Promise<PermissionResult>

  // ── 元数据:描述这个工具"是什么性质" ──
  isReadOnly(input: Input): boolean          // 只读?还是会改动世界?
  isConcurrencySafe(input: Input): boolean   // 能和别的工具并行跑吗?
  isDestructive(input: Input): boolean       // 不可逆操作?(删除、覆盖、发送)
  maxResultSizeChars: number                 // 结果超过多大就外置存盘?

  // ── 两个受众:同一次执行,两套渲染 ──
  mapResultToModelContent(out: Output): ToolResultBlock  // 给模型看的
  renderResultForUI(out: Output): UINode                 // 给人看的
}
```

这个接口里藏着两个**决定性**的设计思想，值得各花一节讲透。

## 三、决定性设计之一：元数据驱动编排

注意 `isReadOnly` / `isConcurrencySafe` / `isDestructive` 这几个方法——它们**不执行任何操作**，只是**声明这个工具的“性质”**。为什么要把这些性质做成一等公民？

因为**循环和编排器要靠它们来做决策**：

```ts [上层逻辑读取工具的元数据来决策]
// 编排器:能并行的工具一起跑,不能的排队
const [parallel, sequential] = partition(toolUses, tu =>
  findTool(tu.name).isConcurrencySafe(tu.input),
)
await Promise.all(parallel.map(runTool))   // 并发安全的,一起上
for (const tu of sequential) await runTool(tu)  // 其余的,老实排队

// 权限层:只读操作可以免批,写操作要过闸
if (!tool.isReadOnly(input)) {
  await requestPermission(tool, input)
}

// UI 层:危险操作,渲染成醒目的警告
if (tool.isDestructive(input)) renderWithWarning()
```

::: info

**工具自己“申报”性质，上层据此统一决策。** 这是一个漂亮的关注点分离：工具不需要知道“并发编排怎么做”“权限怎么弹窗”，它只需**诚实申报**“我是只读的”“我能并行”“我不可逆”；而[并发编排](/manual/agent/llm-to-agent/streaming-tool-execution)、[权限](/manual/agent/llm-to-agent/permissions)、UI 这些横切系统，各自读取这些申报去干自己的活。加一个新工具，你只管填对这几个 flag，整个系统就自动正确地对待它。

:::

## 四、决定性设计之二：一次执行，两个受众

看 `mapResultToModelContent` 和 `renderResultForUI` 这对方法——**同一次工具执行的结果，要渲染成两个截然不同的版本**：

| | 给**模型**看(`mapResultToModelContent`) | 给**人**看(`renderResultForUI`) |
| --- | --- | --- |
| 目标 | 让模型准确理解、省 token | 让人一眼看懂、美观 |
| 形式 | 纯文本 / 结构化数据 | 带颜色、diff、折叠的 UI 组件 |
| 例子(编辑文件) | `"已编辑 foo.ts,替换 3 处"` | 一块带绿/红高亮的 diff 视图 |
| 例子(跑测试) | 完整的失败堆栈(模型要靠它调试) | 折叠的“3 passed, 1 failed”，点开才看细节 |

这个分裂无处不在，而且**极其重要**：

::: warning

**给模型的和给人的，是两种根本不同的信息需求，绝不能混为一谈。** 模型需要**完整、结构化、省 token** 的信息去推理(它要看完整堆栈才能修 bug)；人需要**摘要、可视化、可折叠** 的信息去监督(人不想被一屏堆栈淹没)。很多 Agent 体验差，就差在把“给模型的原始输出”直接甩给用户看，或者反过来，把“给人的精简摘要”喂给模型，导致模型缺信息。**想清楚每一份数据的受众，是 Agent 工程的一条隐形主线**——它还会在[上下文管理](/manual/agent/llm-to-agent/context-compaction)里再次浮现。

:::

## 五、实现细节：两个不能省的关节

### ① Schema 就是模型的 API 契约，校验是安全底线

- `inputSchema` 用 zod 之类的库定义，然后**自动转成 JSON Schema** 发给模型——模型就是照着这份 Schema“填参数”的。但[上一篇](/manual/agent/llm-to-agent/tool-use)说过，模型填的东西**不可全信**。所以执行前必须过 `validateInput`：

```ts [Schema 双重身份:既是给模型的说明书,又是给宿主的校验器]
const EditInput = z.object({
  path: z.string().describe('要编辑的文件路径'),
  oldText: z.string().describe('要被替换的原文'),
  newText: z.string().describe('替换成的新文'),
})
// → 转成 JSON Schema 发给模型(告诉它怎么调)
// → 同一份 Schema 在执行前校验模型的输出(挡住非法输入)
```

一份 Schema，两个方向：对模型是“说明书”，对宿主是“门卫”。

### ② 安全默认：fail-closed

工具那么多方法，每个工具都全部实现太累。所以通常有一个 `buildTool()` 工厂**填充默认值**。而这些默认值的选择，体现了一条铁律——**往安全的方向兜底(fail-closed)**：

```ts [默认值一律往"更安全"的方向兜]
const TOOL_DEFAULTS = {
  isReadOnly: () => false,          // 默认假设它"会写"(更需要谨慎)
  isConcurrencySafe: () => false,   // 默认假设它"不能并行"(更保守)
  isDestructive: () => false,       // (这个默认 false,但危险工具必须显式声明 true)
  checkPermissions: () => allow,    // 默认交给通用权限系统兜底
}
```

::: info

**拿不准时，选更安全的那个默认值。** 一个工具如果忘了声明 `isConcurrencySafe`，系统就当它“不能并行”——顶多慢一点，但绝不会因为乱序并发把数据搞坏。忘了声明 `isReadOnly`，就当它“会写”——顶多多问一次权限，但绝不会让一个危险操作蒙混过关。**默认值错在“过度谨慎”这边，代价是性能；错在“过度放任”那边，代价是灾难。** 这个不对称，决定了默认必须 fail-closed。

:::

## 六、小结：工具是 Agent 的“设备驱动”

再用序章的比方：如果说 Agent Loop 是机器的时钟，工具就是这台机器的**外设驱动**——每个驱动都以统一的接口接入系统(`call`)，同时向系统申报自己的能力和约束(`isReadOnly`、`isConcurrencySafe`……)，让上层的调度、权限、渲染子系统能统一地、安全地驱动它。

到这里，**第二阶段“让模型能做事”就完整了**。我们有了：能决策的模型、能执行的工具、驱动它们协作的循环、以及一套让工具可扩展又安全的抽象。一个能自主干活的 Agent 内核，已经成型。

但它现在还很“慢”、很“笨”：工具一个一个串行跑，模型输出要全部生成完才处理。下一阶段，我们让它**快起来、并行起来**。下一篇进入[第三阶段](/manual/agent/llm-to-agent/streaming)：流式处理——如何边生成边消费，以及那个让工具能“抢跑”执行的关键机制。
