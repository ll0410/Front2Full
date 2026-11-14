---
title: "06 · 边流边执行 + 并发编排：把等待时间榨干"
description: "工具块一流完就立刻派发，让工具执行和模型继续生成在时间上重叠；同一批工具里，并发安全的并行跑、其余保序串行。讲清 isConcurrencySafe 如何驱动编排，以及“读可以乱序、写必须有序”这条铁律。"
source: "https://daiw.org/manual/llm-to-agent/streaming-tool-execution"
---

# 06 · 边流边执行 + 并发编排：把等待时间榨干

> 工具块一流完就立刻派发，让工具执行和模型继续生成在时间上重叠；同一批工具里，并发安全的并行跑、其余保序串行。讲清 isConcurrencySafe 如何驱动编排，以及“读可以乱序、写必须有序”这条铁律。

[上一篇](/manual/agent/llm-to-agent/streaming)结尾埋了个引子：工具块一 `content_block_stop`，参数就齐了，不必等整条消息结束就能派发。这一篇把这个优化，连同“一批工具怎么并行”一起做掉。目标只有一个：**把 Agent 花在等待上的时间榨干。**

## 一、背景：两处被浪费的时间

一个朴素的循环(哪怕是流式的)，在工具这块有两处明显的时间浪费：

**浪费一：工具干等整条消息结束。** 模型这一轮先说了一大段分析，然后才给出工具调用。就算第一个工具调用在第 2 秒就流完了参数，朴素实现也要等到第 8 秒整条消息 `message_stop` 后才开始执行它。**中间 6 秒，工具在干等。**

**浪费二：一批工具串行跑。** 模型一口气要求“读 A、读 B、读 C”三个文件。串行读：0.3s + 0.3s + 0.3s = 0.9s。可这三个读**互不相干**，本该同时进行，总共 0.3s 就够。

两处浪费，对应两个优化：**边流边执行** 和 **并发编排**。

## 二、优化一：边流边执行(dispatch-on-complete)

思路直接：**别等 `message_stop`，盯住每个 `content_block_stop`。** 一个 `tool_use` 块结束的那一刻，它的参数已完整，立刻把它派发出去执行——让工具跑在“模型还在生成后面内容”的同时。

```ts [工具块一结束就抢跑]
for await (const event of stream) {
  // ...累积文本、累积工具参数(见上一篇)...
  if (event.type === 'content_block_stop' && isToolBlock(event.index)) {
    const toolUse = assembleToolUse(event.index)   // 参数此刻已完整
    executor.dispatch(toolUse)                       // ← 立刻开跑,不等消息结束
  }
}
```

::: info

这个优化的收益，取决于模型“说话”和“调工具”的穿插方式。当模型习惯**先调工具、边调边解释**时，工具执行几乎完全被“生成后续文本”的时间盖住了——等模型话说完，工具结果也差不多回来了。**你把两段本来串行的时间，叠成了并行。**

:::

## 三、优化二：并发编排，但“写”必须守规矩

同一批多个工具，能不能一起跑？**要看它们是不是“并发安全”。** 还记得[04 篇](/manual/agent/llm-to-agent/tool-abstraction)里工具自报的那个 `isConcurrencySafe` 吗？它就是为这一刻准备的：

```ts [按 isConcurrencySafe 分流:能并行的并行,其余保序串行]
const parallel: number[] = []   // 并发安全(读文件、搜索……)
const serial: number[] = []     // 不安全(写文件、跑命令……)
toolUses.forEach((tu, i) =>
  (findTool(tu.name)?.isConcurrencySafe ? parallel : serial).push(i),
)

await Promise.all(parallel.map(runOne))   // 一起上
for (const i of serial) await runOne(i)   // 老实排队,一个接一个
```

这正是配套 Agent 里已经在跑的逻辑。为什么“写”必须串行？

::: warning

**读可以乱序，写必须有序。** 三个“读文件”并行没问题——它们不改变任何状态，谁先谁后结果都一样。但两个“编辑同一个文件”如果并行，就会**互相覆盖**、产生竞态，结果取决于谁后写完，不可预测。更微妙的是：模型常常**依赖顺序**——它可能打算“先创建文件，再往里写内容”，这俩要是并行，第二步可能在第一步之前跑，直接失败。所以**凡是会改动世界的操作，默认串行、保持模型给出的顺序**，是一条不能破的铁律。这也是为什么 `isConcurrencySafe` 的[默认值是 `false`](/manual/agent/llm-to-agent/tool-abstraction)——宁可慢，不可错。

:::

## 四、实现细节：一个流式工具执行器

把两个优化合起来，就是一个 **StreamingToolExecutor**：在流式过程中接收陆续完成的工具块，并发安全的立即开跑，不安全的排进串行队列；最后统一收集结果、按 `tool_use_id` 配对。它要处理几件麻烦事：

- **保序收集**：虽然并行执行，但回填给模型的 `tool_result` 要能和每个 `tool_use` 一一对上(靠 `tool_use_id`，和顺序无关)。
- **串行队列的依赖**：不安全的工具即使早早流完，也得等前面的串行任务做完才轮到它。
- **中断兜底**：执行到一半用户按了 Ctrl+C 怎么办？——已派发的、排队中的工具，每一个都**必须**产出一个 `tool_result`(哪怕是“已取消”)，否则[历史就非法了](/manual/agent/llm-to-agent/tool-use)。这个善后逻辑，是[中断那一篇](/manual/agent/llm-to-agent/interrupt)的主题，这里先埋下钩子。

```ts [StreamingToolExecutor 的骨架(见配套仓库 src/streamingTools.ts)]
class StreamingToolExecutor {
  private inflight: Promise<Outcome>[] = []
  private serialQueue: Promise<void> = Promise.resolve()

  dispatch(tu: ToolUseBlock) {
    const tool = findTool(tu.name)
    if (tool?.isConcurrencySafe) {
      this.inflight.push(this.exec(tu))              // 安全:立刻并行开跑
    } else {
      // 不安全:链在串行队列尾部,保证前一个写完才轮到它
      this.serialQueue = this.serialQueue.then(async () => {
        this.results.set(tu.id, await this.exec(tu))
      })
    }
  }

  async drain(): Promise<Outcome[]> {
    await Promise.all(this.inflight)                 // 等并行的
    await this.serialQueue                            // 等串行的
    return this.collectInToolUseOrder()              // 按 tool_use 顺序归位
  }
}
```

::: info

一个务实的提醒：这些优化是**锦上添花**，不是**雪中送炭**。[03 篇](/manual/agent/llm-to-agent/agent-loop)那个朴素循环功能上完全正确，只是慢一点。**先把正确的循环跑通，再来叠这些性能优化**——顺序别反了。过早引入流式并发执行，会让你在还没理清基本控制流时，就陷进竞态和保序的泥潭。

:::

## 五、第三阶段小结

到这里，我们的 Agent 不仅能跑，还跑得**快**了：

| 篇章 | 榨掉了什么等待 |
| --- | --- |
| [05 流式](/manual/agent/llm-to-agent/streaming) | 用户不再干等模型憋完整段 |
| **06 边流边执行 + 并发** | 工具执行盖进生成时间；能并行的读一起跑 |

但“快”是有代价的——我们让它自动执行的东西越来越多、越来越猛。一个能自主 `bash` 任意命令、并行改文件的 Agent，已经足够危险了。是时候给它**装上闸门**了。下一篇进入[第四阶段](/manual/agent/llm-to-agent/permissions)：权限系统——如何在“放手让它干”和“别让它闯祸”之间划清界线。

---

**本篇对应代码**：配套仓库加入 `src/streamingTools.ts`(流式工具执行器)，并发编排逻辑在 `src/agent.ts`。`git checkout article-06`。
