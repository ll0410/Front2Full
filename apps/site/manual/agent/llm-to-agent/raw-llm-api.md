---
title: "01 · 一次 LLM API 调用，到底给了你什么"
description: "在搭 Agent 之前，先把地基看清：一次 LLM API 调用的请求与响应长什么样、stop_reason 和 usage 意味着什么，以及三个决定性的“它不给你”——无状态、无记忆、不能行动。这三个“没有”，正是后面每一篇要填的坑。"
source: "https://daiw.org/manual/llm-to-agent/raw-llm-api"
---

# 01 · 一次 LLM API 调用，到底给了你什么

> 在搭 Agent 之前，先把地基看清：一次 LLM API 调用的请求与响应长什么样、stop_reason 和 usage 意味着什么，以及三个决定性的“它不给你”——无状态、无记忆、不能行动。这三个“没有”，正是后面每一篇要填的坑。

要理解 Agent 在 LLM 之上加了什么，得先精确地知道 LLM 本身给了什么。这一篇不聊 Agent，只把“裸 API”这块地基看到底——**你会发现它朴素得惊人**。

## 一、最朴素的一次调用

抛开所有花哨的封装，一次 LLM API 调用的本质就是一个 HTTP 请求。你发一段对话，它回一段文本：

```ts [一次最朴素的调用]
const response = await client.messages.create({
  model: 'some-llm',
  max_tokens: 1024,
  system: '你是一个乐于助人的助手。',        // 系统提示:定调色、立规矩
  messages: [
    { role: 'user', content: '用一句话解释什么是尾递归。' },
  ],
})

console.log(response.content[0].text)
// => "尾递归是指函数的最后一步操作就是调用自身,从而可被编译器优化为循环、不增长调用栈。"
```

就这么点东西。请求里有三样关键的：

- **`system`**：系统提示。它不属于对话，而是给整场对话“定调”的元指令——角色、风格、规则都写在这。
- **`messages`**：对话历史，一个 `{ role, content }` 数组，`role` 在 `user` / `assistant` 之间交替。
- **`max_tokens`**：这次最多让它生成多少 token。

## 二、响应里藏着的三个关键信号

响应不只有文本。真正搭 Agent 时，你盯的往往是另外几个字段：

```ts [响应的完整形状(简化)]
{
  role: 'assistant',
  content: [
    { type: 'text', text: '尾递归是指……' }   // 内容是一个"块数组",不只是字符串
  ],
  stop_reason: 'end_turn',                      // ← 它为什么停下来
  usage: {
    input_tokens: 24,                            // ← 这次读进去多少
    output_tokens: 38,                           // ← 这次吐出来多少
  },
}
```

三个信号必须刻进脑子，后面每一篇都要用到：

1. **`content` 是“块数组”，不是字符串。** 一条回复可以由多个“内容块”组成。现在只有一个 `text` 块；等到[下一篇](/manual/agent/llm-to-agent/tool-use)讲工具调用，你会看到 `tool_use` 块和它并肩出现。**这个“多块”结构，是整个 Agent 大厦的承重墙。**

2. **`stop_reason` 告诉你它为什么停。** 常见取值：
   - `end_turn`：它自然说完了。
   - `max_tokens`：撞到你设的 `max_tokens` 上限被硬截断(话没说完！)。
   - `stop_sequence`：命中了你指定的停止串。
   - `tool_use`：它想调用工具了(下一篇的主角)。

   Agent 循环的走向，很大程度就是被 `stop_reason` 驱动的——它是“该继续还是该收手”的路标。

3. **`usage` 是你的账单和油表。** 每次调用花了多少 token，直接换算成**钱**和**离上下文窗口爆满还有多远**。[成本追踪](/manual/agent/llm-to-agent/cost-tracking)和[上下文管理](/manual/agent/llm-to-agent/context-compaction)这两大主题，全建立在死死盯住 `usage` 之上。

## 三、流式：别让用户干等

上面那种“等它全部生成完再返回”的方式，在交互式场景里是灾难——模型吐一大段要好几秒，用户对着空屏幕干等。所以真实 Agent 几乎总是**流式**调用：

```ts [流式:token 一边生成一边到达]
const stream = await client.messages.create({
  model: 'some-llm',
  max_tokens: 1024,
  messages: [{ role: 'user', content: '写一首关于递归的短诗。' }],
  stream: true,                                  // ← 开关在这
})

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    process.stdout.write(event.delta.text)       // 每来一小片就打印一小片
  }
}
```

流式把“一次响应”拆成一串**事件**：块开始、块内容增量(delta)、块结束、消息结束……你把这些增量拼起来，就还原出完整回复。这里先埋个伏笔：流式不仅是为了 UX——它还让 Agent 能**在工具参数刚流完的一瞬间就抢跑执行**，这个我们放到[流式那一篇](/manual/agent/llm-to-agent/streaming)细讲。

## 四、决定性的三个“它不给你”

好，以上就是 LLM API 给你的**全部**。现在看它**不给**你什么——这三个“没有”，定义了后面整个专栏的工作量。

### 没有 ①：无状态

API 是**纯函数**。同样的 `messages` 进去，(在贪婪解码下)同样的东西出来。它**不记得**任何事——服务器端不给你存对话。

那我们平时用的 AI 对话，那种“它记得我上一句”的连续感是哪来的？**是客户端假装出来的。** 每一轮，你都得把**到目前为止的全部对话历史**重新塞进 `messages` 再发一次：

```ts [所谓"对话",是你每轮重发全部历史攒出来的]
const history: Message[] = []

async function chat(userText: string) {
  history.push({ role: 'user', content: userText })       // 追加用户这句
  const res = await client.messages.create({
    model: 'some-llm',
    max_tokens: 1024,
    messages: history,                                     // ← 每次都发"全部"历史
  })
  history.push({ role: 'assistant', content: res.content }) // 把回复也追加进去
  return res
}
```

::: info

**“对话”是一种客户端维护的幻觉。** 模型这一侧永远只是“读一坨历史 → 续写下一条”。这个事实的直接后果是：历史越滚越长，每次请求就越贵、越慢，直到撞上上下文窗口的天花板。**这就是为什么[上下文工程](/manual/agent/llm-to-agent/token-budget)会是整个 Agent 里格外硬核的一章**——你得亲手管理这坨不断膨胀的历史。

:::

### 没有 ②：不能行动

模型只会**输出文本**。你问它“当前目录有哪些文件”，它不能真的去 `ls`——它只能**猜**，或者老实说“我看不到你的文件系统”。

你甚至可以让它输出一句 `ls -la`，但那也只是**一串字符**，不会有任何命令被执行。模型和真实世界之间，隔着一道它无法逾越的墙。**捅穿这道墙，让模型的“意图”变成真实世界里的“动作”，就是[工具调用](/manual/agent/llm-to-agent/tool-use)要解决的事**，也是“Agent”能成立的第一块基石。

### 没有 ③：不会自己推进

给模型一段话，它生成一段回复，然后**停下**。它不会自己接着“那我下一步该干嘛”。它没有“循环”，没有“目标驱动”，没有“不达目的不罢休”。

而一个 Agent 修 bug 时，是“改一处→跑测试→看报错→再改”这样**一轮一轮自主推进**的。这个“自主推进”从哪来？不在模型里。**它是外面那个 [Agent Loop](/manual/agent/llm-to-agent/agent-loop) 手动驱动出来的**——那一篇会告诉你，所谓 Agent，内核其实就是一个 `while` 循环。

## 小结：地基与蓝图

把这一篇钉死成一句话：

> **裸 LLM API = 一个无状态的、只会输出文本的、问一句答一句的纯函数。**

而一个 Coding Agent，就是围绕这个纯函数，亲手补上它缺的三样东西：

| 它没有 | 我们要加的东西 | 对应篇章 |
| --- | --- | --- |
| 不能行动 | 工具调用 | [02 工具调用](/manual/agent/llm-to-agent/tool-use) |
| 不会自己推进 | Agent Loop | [03 Agent Loop](/manual/agent/llm-to-agent/agent-loop) |
| 无状态、会撑爆 | 上下文工程 | 第五阶段 |

地基看完了。下一篇，我们捅穿那道“模型不能行动”的墙——让它第一次真正地**做一件事**。
