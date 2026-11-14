---
title: "16 · 成本与用量追踪：把 token 换算成钱，并实时盯住"
description: "每次调用都在花钱，而且四种 token(输入/输出/缓存写/缓存读)价格天差地别。讲清如何用分价目表把 usage 换算成美元、为什么必须分开统计这四类、子 Agent 与压缩调用也要计入，以及预算硬闸怎么接回主循环。"
source: "https://daiw.org/manual/llm-to-agent/cost-tracking"
---

# 16 · 成本与用量追踪：把 token 换算成钱，并实时盯住

> 每次调用都在花钱，而且四种 token(输入/输出/缓存写/缓存读)价格天差地别。讲清如何用分价目表把 usage 换算成美元、为什么必须分开统计这四类、子 Agent 与压缩调用也要计入，以及预算硬闸怎么接回主循环。

## 16 · 成本与用量追踪：把 token 换算成钱

[上一篇](/manual/agent/llm-to-agent/error-recovery)让 Agent 扛住了故障，但每一次调用、每一次重试、每一次压缩，都在**烧钱**。一个自主循环几十轮、还会派生[子 Agent](/manual/agent/llm-to-agent/subagents) 的系统，成本能悄悄失控。这一篇，我们把 token 换算成真金白银，并实时盯住。

## 一、背景：四种 token，四种价格

很多人以为成本就是“token 数 × 单价”。**大错。** 一次调用的 `usage` 里其实有**四类**性质完全不同的 token，单价天差地别：

| token 类型 | 相对价格(示意) | 说明 |
| --- | --- | --- |
| **输入**(input) | 1× | 正常读进去的 token |
| **输出**(output) | ~5× | 生成的 token，最贵 |
| **缓存写**(cache write) | ~1.25× | 首次建立[缓存](/manual/agent/llm-to-agent/prompt-caching)的一点溢价 |
| **缓存读**(cache read) | ~0.1× | 命中缓存，便宜十倍 |

::: warning

**如果你把这四类混作一坨、按同一个单价算，你的成本估算会离谱地错。** 一个开了[Prompt 缓存](/manual/agent/llm-to-agent/prompt-caching)的长会话，绝大部分“输入”其实是走 cache-read 的(便宜十倍)，真实成本可能只有“按输入全价估算”的零头。反过来，输出 token 比输入贵好几倍，一个话痨 Agent 的成本大头可能在输出侧。**不分开统计这四类，你既不知道钱花哪了，也没法优化。**

:::

这也解释了[缓存那一篇](/manual/agent/llm-to-agent/prompt-caching)为什么是“省钱最立竿见影的一招”——它把最大宗的输入 token 从 1× 打到 0.1×。

## 二、解决方案：分价目表累加

思路很直接：**一张按模型、按 token 类型的价目表，每次响应后把四类 token 各自乘以各自的单价，累加进会话总额。**

```ts [按四类 token 分别计价]
const PRICES = {
  // 单位:美元 / 每百万 token
  'some-model': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30 },
}

function costOf(model: string, usage: Usage): number {
  const p = PRICES[model]
  return (
    (usage.input_tokens          * p.input) +
    (usage.output_tokens         * p.output) +
    (usage.cache_creation_tokens * p.cacheWrite) +
    (usage.cache_read_tokens     * p.cacheRead)
  ) / 1_000_000
}
```

每一轮响应回来，`addUsage(res.usage)` 累加一笔，会话总成本就实时可见了。

## 三、实现细节：三个别漏的当口

### ① 别漏掉“隐形”的调用

会花钱的不只是主循环那次调用。**所有走了模型的地方都要计入**，包括几个容易被忽略的：

- **压缩调用**([第 13 篇](/manual/agent/llm-to-agent/auto-compaction))：压缩历史本身是一次模型调用，也花钱。
- **子 Agent**([下阶段](/manual/agent/llm-to-agent/subagents))：派生出去的子 Agent 从**同一个预算池**花钱。
- **各种“元”调用**：生成标题、分类意图、辅助判断的小调用。

::: info

**成本追踪要覆盖“所有出口”，而不只是主循环。** 一个常见的错觉是“我盯着主循环的 usage 呢，成本没问题”——结果子 Agent 和压缩在背后花掉了大头，你的账单和你的估算对不上。正确的做法是把成本累加器做成**会话级、贯穿所有调用路径**的，主线程、子 Agent、压缩、元调用，谁调模型谁就往同一个累加器记一笔。

:::

### ② 预算硬闸接回主循环

有了实时成本，就能设**预算上限**。这直接接回[03 篇](/manual/agent/llm-to-agent/agent-loop)那个“循环要有闸门”的设计——成本超预算，是终止循环的合法理由之一：

```ts [成本预算作为循环的一道闸]
while (true) {
  if (tracker.totalUsd() >= maxBudgetUsd) {
    return { reason: 'budget_exceeded' }   // 花超了,干净地停
  }
  // ...正常循环体...
}
```

回合数、token 预算、**美元预算**……这些闸门共同构成了[03 篇](/manual/agent/llm-to-agent/agent-loop)说的“失控保护”。让 Agent 自主，和给它设一个花钱的天花板，从来不矛盾。

### ③ 实时可见，而非事后算账

成本要**实时**呈现给用户(跑着就能看到“这次会话已花 \$0.42”)，而不是等会话结束才总算一笔。原因很实际：一个失控的 Agent(比如陷入某种循环)，用户能**在花掉几十美元之前**看到成本异常飙升，及时叫停([中断](/manual/agent/llm-to-agent/interrupt)那一篇的能力在这里派上用场)。**成本的可见性，本身就是一道安全阀。**

## 四、小结

成本追踪不难，但有几个“想当然”会让你算错：

1. **四类 token 分开计价**——混作一坨必然离谱，尤其在开了缓存之后。
2. **覆盖所有出口**——压缩、子 Agent、元调用都花钱，别只盯主循环。
3. **预算硬闸接回循环**，美元上限也是失控保护的一环。
4. **实时可见**，让成本异常能被及时发现和叫停。

到这里，健壮性阶段还剩最后一块拼图。现代模型有一种特殊的能力——**扩展思考**(extended thinking)，它能显著提升 Agent 解决难题的能力，但也带来一组独特的、能让你调试一整天的坑。下一篇[思考的处理](/manual/agent/llm-to-agent/thinking)，我们收尾第六阶段。

---

**本篇对应代码**：配套仓库加入 `src/cost.ts`(四类 token 分价目表 + 会话累加器)，在 usage 事件里带出实时成本。`git checkout article-16`。
