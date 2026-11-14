---
title: "18 · 子 Agent：用上下文隔离，把细节挡在主线程之外"
description: "一个 Agent 读 20 个文件回答一个问题，会把 20 份文件内容全灌进主上下文。子 Agent 让子任务在独立上下文里跑，只把结论带回来。讲清“上下文防火墙”这个核心价值、子 Agent 作为一个工具的实现、以及扇出并行。"
source: "https://daiw.org/manual/llm-to-agent/subagents"
---

# 18 · 子 Agent：用上下文隔离，把细节挡在主线程之外

> 一个 Agent 读 20 个文件回答一个问题，会把 20 份文件内容全灌进主上下文。子 Agent 让子任务在独立上下文里跑，只把结论带回来。讲清“上下文防火墙”这个核心价值、子 Agent 作为一个工具的实现、以及扇出并行。

最后一个阶段，我们把视野从“一个 Agent”放大到“一个系统”。第一步：当一个 Agent 忙不过来、或者会把自己的上下文搞脏时，派一个**子 Agent** 去。

## 一、背景：主上下文正在被细节淹没

设想主 Agent 接到一个任务：“这个项目的鉴权是怎么实现的？” 为了回答，它得读十几二十个文件、搜一堆符号。问题来了——**这二十份文件的完整内容，全都灌进了主 Agent 的[上下文](/manual/agent/llm-to-agent/token-budget)**。等它终于弄明白、给出一句话结论时，主上下文已经被二十份文件的原文塞得满满当当。

而这些原文，**结论出来之后就没用了**。主 Agent 接下来要干的事，只需要那句“鉴权用的是 JWT + 中间件校验”的结论，根本不需要那二十份文件的逐字内容。可它们已经赖在上下文里了，每一轮都在被[重发](/manual/agent/llm-to-agent/raw-llm-api)、都在挤占窗口、都在逼近[压缩](/manual/agent/llm-to-agent/auto-compaction)。

::: info

**这就是子 Agent 要解决的核心问题：大量的“中间探索细节”，不该污染主线程的上下文。** 一个复杂任务的推进过程会产生海量中间信息(读过的文件、试过的命令、走过的弯路)，但其中绝大部分，在子任务完成后就是**噪音**。把这些细节关进一个隔离的上下文里，只让**结论**回到主线程——这是子 Agent 最根本的价值。

:::

## 二、解决方案：子 Agent 就是“带上下文隔离的函数调用”

思路优雅得惊人：**子 Agent 本身就是一个[工具](/manual/agent/llm-to-agent/tool-abstraction)。** 主 Agent 像调用任何工具一样“调用”它，只不过这个工具内部，是**另一个完整的 [Agent Loop](/manual/agent/llm-to-agent/agent-loop)**，跑在自己**全新、隔离的上下文**里。

```text [子 Agent:探索的细节留在子上下文,只有结论回到主线程]
主 Agent 上下文:  [...] → spawn_agent("搞清楚鉴权怎么实现的") → [结论:JWT+中间件] → [...]
                                    │                              ▲
                                    ▼  (全新隔离上下文)            │ 只带回一句结论
子 Agent 上下文:  [读 auth.ts][读 middleware.ts][搜 verify][读 20 个文件...][得出结论]
                  └────────── 这一大坨细节,主线程永远看不到 ──────────┘
```

它和普通函数调用的类比精确得令人愉快：

| 函数调用 | 子 Agent |
| --- | --- |
| 有自己的局部变量作用域 | 有自己隔离的上下文 |
| 内部的中间变量不泄露给调用者 | 探索细节不泄露给主线程 |
| 只返回一个结果 | 只返回一句结论 |
| 可以并行调用多个 | 可以扇出多个并行跑 |

::: info

**子 Agent 是“上下文层面的封装”**——正如函数把实现细节封装起来、只暴露返回值，子 Agent 把探索细节封装在独立上下文里、只暴露结论。理解了这个类比，你就理解了子 Agent 的一切：它不是什么高深的“多智能体协作”，它就是**给 Agent 增加了“函数调用”这一层抽象**，而封装的东西恰好是最宝贵的资源——上下文。

:::

## 三、实现细节：一个工具，内部跑一个 Agent Loop

因为我们的 [Agent Loop](/manual/agent/llm-to-agent/agent-loop) 本来就是一个可复用的 `runAgent` 函数，实现子 Agent 几乎是免费的——写一个工具，它的 `run` 内部**递归调用 `runAgent`**，消费完子 Agent 的所有事件，只把最后的结论作为工具结果返回：

```ts [子 Agent 工具:内部起一个隔离的 Agent Loop]
const spawnAgentTool = defineTool({
  name: 'spawn_agent',
  description: '派一个子 Agent 独立完成一个探索性子任务,只返回它的最终结论。' +
    '当子任务会产生大量中间细节(读很多文件、大范围搜索)时用它,保持主线程上下文干净。',
  schema: z.object({ task: z.string().describe('交给子 Agent 的任务描述') }),
  isConcurrencySafe: true,   // 隔离的,可以扇出多个并行(见文章 06)
  async run({ task }, ctx) {
    let conclusion = ''
    // 关键:子 Agent 用一套不含 spawn_agent 的工具集,避免无限套娃
    for await (const ev of runAgent(task, { cwd: ctx.cwd, signal: ctx.signal, tools: baseTools })) {
      if (ev.type === 'assistant_text_delta') conclusion += ev.text
    }
    return { modelText: conclusion, display: `子 Agent:${task.slice(0, 40)}…` }
  },
})
```

就这么点。**主 Agent 的 `runAgent` 里，工具执行器跑这个工具，而工具内部又是一个 `runAgent`**——一个自然的递归结构。子 Agent 那一大坨探索，全程在自己的 `messages` 数组里，主线程的 `messages` 完全不知情，只收到最后那段 `conclusion`。

### 两个必须处理的点

::: warning

**① 防无限套娃。** 子 Agent 如果也能 `spawn_agent`，就可能无限递归下去。最简单的防法：**给子 Agent 一套不含 `spawn_agent` 的工具集**(上面 `tools: baseTools`)，让递归深度天然只有一层。更灵活的做法是传一个“深度”计数，到达上限就不再提供 spawn 工具。总之，**必须有一个东西终止这个递归**，否则一个坏指令能让它派生出成千上万个子 Agent。

:::

::: info

**② 扇出并行。** 注意 `isConcurrencySafe: true`——因为每个子 Agent 上下文隔离、互不干扰，主 Agent 可以在一轮里同时派出好几个(“同时搞清楚鉴权、路由、数据库三块怎么实现”)，靠[第 06 篇](/manual/agent/llm-to-agent/streaming-tool-execution)的并发执行器**并行跑**，大幅压缩总时长。这是子 Agent 的一个额外红利：它天然适合把可并行的探索**扇出**出去。

:::

## 四、代价与权衡

子 Agent 不是白来的，用之前想清楚：

- **信息损失**：主线程只拿到结论，拿不到细节。如果主 Agent 后面**其实需要**某个中间细节，它就得让子 Agent 重新去查，或者自己去查。所以子 Agent 适合“结论自足”的子任务，不适合“细节还要反复用”的场景。
- **额外成本**：子 Agent 是一整个独立的 Agent Loop，有自己的多轮调用开销，从[同一个预算池](/manual/agent/llm-to-agent/cost-tracking)花钱。派一个子 Agent 去读一个文件是杀鸡用牛刀——它值当的前提是“探索量大到会显著污染主上下文”。
- **可观测性**：子 Agent 的中间过程主线程看不到，调试时你得能单独查看子 Agent 的轨迹(所以真实系统常把子 Agent 的对话记到一个独立的“支线”文件里，既不污染主会话，又可供事后审查——这和[第 20 篇](/manual/agent/llm-to-agent/session-history)的持久化相关)。

::: warning

**判据：当一个子任务会产生“大量、且用完即弃”的中间细节时，派子 Agent；否则主 Agent 自己干。** 别为了“看起来像多智能体”而滥用子 Agent——每一个都是实打实的成本和延迟。它是一把用来**保护主上下文**的手术刀，不是拿来炫技的。

:::

## 五、小结

子 Agent 是把[上下文](/manual/agent/llm-to-agent/token-budget)这个最稀缺资源，用“函数调用式封装”保护起来的机制：

1. 核心价值是**上下文隔离**——探索细节留在子上下文，只有结论回主线程。
2. 实现上，它就是**一个工具，内部递归跑一个 `runAgent`**，几乎免费。
3. 必须**防无限套娃**(限工具集/限深度)，并可**扇出并行**。
4. 代价是信息损失、额外成本、可观测性——**结论自足、探索量大**时才值当。

主 Agent 会用工具、会派子 Agent 了。但到目前为止，它的工具都是我们**内置**写死的。真实世界里，用户想接入五花八门的外部工具(数据库、浏览器、公司内部 API)，而且可能有几百个。下一篇[MCP 与工具懒加载](/manual/agent/llm-to-agent/mcp)，我们看 Agent 如何接入一个开放的外部工具生态，以及“几百个工具”这个规模问题怎么解。

---

**本篇对应代码**：配套仓库加入 `src/tools/spawnAgent.ts`(子 Agent 工具，内部递归 `runAgent`，用不含自身的工具集防套娃)，并给 `runAgent` 加 `tools` 覆盖。`git checkout article-18`。
