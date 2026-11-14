---
title: "05 · 流式处理：边生成边消费，以及工具参数的“逐字到达”"
description: "非流式调用让用户干等，还让你没法对半成品输出做任何事。本篇拆开流式协议的事件序列，重点讲一个反直觉的细节——工具调用的参数是作为“部分 JSON”一片片流进来的，这直接决定了工具能多早被派发。"
source: "https://daiw.org/manual/llm-to-agent/streaming"
---

# 05 · 流式处理：边生成边消费，以及工具参数的“逐字到达”

> 非流式调用让用户干等，还让你没法对半成品输出做任何事。本篇拆开流式协议的事件序列，重点讲一个反直觉的细节——工具调用的参数是作为“部分 JSON”一片片流进来的，这直接决定了工具能多早被派发。

第二阶段我们把 Agent 内核搭起来了，但它有个体验硬伤：每一轮都要**等模型把整条回复生成完**才有反应。模型吐一大段要好几秒，用户对着空屏幕干等。这一篇，我们让它边生成边显示——顺便解锁一个后面至关重要的能力。

## 一、背景：非流式的两宗罪

[03 篇](/manual/agent/llm-to-agent/agent-loop)的循环用的是“一次性”调用：`await create(...)`，等模型全部生成完，一次性拿到完整消息。这在交互式 Agent 里有两个问题：

1. **用户体验**：模型生成一段几百字的分析要 5-10 秒，这期间用户什么都看不到，只能干等。真人助手会一边想一边说，而它却是憋一大段一次性砸出来。
2. **更要命的：你没法对“半成品”做任何事。** 假设模型这一轮要调用 3 个工具。非流式模式下，你必须等**整条消息**(可能还带一大段前置文字)全部生成完，才能看到这些工具调用、才能开始执行。但其实第一个工具调用可能在第 1 秒就已经“说清楚”了——你却要等到第 8 秒消息结束才动手。**这 7 秒本可以用来干活。**

流式(streaming)同时解决这两件事。

## 二、解决方案：把一次响应拆成一串事件

流式调用不再返回“一个完整消息”，而是返回**一串事件流**。你订阅这串事件，一边到达一边处理。事件的序列大致是这样(不同 API 命名略有差异，但结构一致)：

```text [一次流式响应的事件序列]
message_start                     ← 消息开始,带上初始元数据
  content_block_start (index 0)   ← 第 0 个内容块开始(比如一个 text 块)
    content_block_delta           ← 文本增量:"我"
    content_block_delta           ← 文本增量:"来看"
    content_block_delta           ← 文本增量:"一下"
  content_block_stop  (index 0)   ← 第 0 块结束
  content_block_start (index 1)   ← 第 1 个内容块开始(一个 tool_use 块!)
    content_block_delta           ← 参数 JSON 增量:'{"pa'
    content_block_delta           ← 参数 JSON 增量:'th":"sr'
    content_block_delta           ← 参数 JSON 增量:'c/x.ts"}'
  content_block_stop  (index 1)   ← 第 1 块结束,此时参数才完整
message_delta                     ← 收尾:带上 stop_reason 和最终 usage
message_stop                      ← 整条消息结束
```

把这些 `delta` 按 `index` 归位、拼接起来，你就**实时地重建出**了那条完整消息。文本块的增量拼起来是完整文本，工具块的增量拼起来是完整参数。

## 三、实现细节：文本增量，人人会写；工具参数，暗藏玄机

### 文本：拼起来就完事

文本块最简单，来一片显示一片：

```ts [消费文本增量]
for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    process.stdout.write(event.delta.text)   // 来一片,打一片
  }
}
```

我们配套的 Agent Loop 从“一次性”升级到“流式”，核心就是把 `await create()` 换成迭代事件流，并把文本增量 `yield` 出去：

```ts [src/agent.ts —— 循环体从一次性升级为流式]
const stream = client.messages.stream({
  model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT, messages, tools: apiTools,
})

// 边到达边把文本增量 yield 给 UI —— 用户立刻看到模型在"说话"
for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    yield { type: 'assistant_text_delta', text: event.delta.text }
  }
}

// 事件流走完后,拿到重建好的完整消息,后续逻辑(挑 tool_use)不变
const res = await stream.finalMessage()
messages.push({ role: 'assistant', content: res.content })
```

::: info

注意这个漂亮之处：**升级到流式，`03 篇`那个循环的骨架一行没动。** 我们只是把“等一整条”换成了“迭代增量 + 最后取完整消息”。`for await ... finalMessage()` 这个模式，让流式的复杂性被封装在“获取模型响应”这一步内部，循环的其余部分(挑工具、执行、回填)浑然不觉。好的抽象就该这样。

:::

### 工具参数：它是**部分 JSON**，一片片来的

现在讲那个暗藏玄机、也是最多人栽跟头的细节。看上面事件序列里 `tool_use` 块的增量：

```text
'{"pa'  →  'th":"sr'  →  'c/x.ts"}'
```

**工具调用的参数，不是一次性给你一个 JSON 对象，而是把 JSON 序列化后的字符串，一小片一小片地流给你**(这类增量通常叫 `input_json_delta`)。你必须把这些片段**攒起来**，直到该块 `content_block_stop`，才拼成完整的 `{"path":"src/x.ts"}`，才能 `JSON.parse`。

```ts [累积部分 JSON,块结束时才解析]
const partialJson = new Map<number, string>()   // index → 累积的 JSON 片段

for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'input_json_delta') {
    // 参数还在流,先攒着,别急着解析——现在它是残缺的 '{"pa'
    partialJson.set(event.index, (partialJson.get(event.index) ?? '') + event.delta.partial_json)
  }
  if (event.type === 'content_block_stop') {
    const raw = partialJson.get(event.index)
    if (raw !== undefined) {
      const input = JSON.parse(raw)   // ← 到这一刻,参数才完整、才能解析
      // 现在这个工具调用"齐活"了,可以派发执行了!
    }
  }
}
```

::: warning

**千万别在参数流到一半时就去 `JSON.parse`。** `'{"pa'` 不是合法 JSON，解析必炸。参数的完整性，只有在该内容块 `content_block_stop` 的那一刻才得到保证。这个“逐字到达 + 延迟解析”的模型，是流式处理里最容易被忽略、又最容易埋 bug 的地方。**很多“工具偶尔调用失败”的诡异问题，根子就在于过早解析了残缺参数。**

:::

## 四、这一篇真正解锁了什么

流式的 UX 价值很直观，但它更深远的意义在最后那句注释里：

> **一旦某个 `tool_use` 块 `content_block_stop`，这个工具调用的参数就齐全了——哪怕整条消息还没结束，你已经可以立刻派发它去执行了。**

回到开头那个“第 1 秒就说清了第一个工具调用，却要等到第 8 秒”的浪费：有了流式，你**不必再等**。工具块一结束就抢跑，让工具执行和“模型继续生成后面内容”在时间上**重叠**起来。

这个“边流边执行”的优化，以及“多个工具怎么安全地并行跑”，就是[下一篇](/manual/agent/llm-to-agent/streaming-tool-execution)的主题。我们会看到，把这块做好，能实实在在地砍掉 Agent 的等待时间。

---

**本篇对应代码**：配套仓库把 Agent Loop 升级为流式版本(`src/agent.ts`)，CLI 实时打印模型输出。`git checkout article-05` 查看这一阶段。
