---
title: "03 · Agent Loop：所谓智能体，内核是一个 while 循环"
description: "把“工具调用”从一次性问答变成自主推进，只差一个循环。本篇给出最小可用的 Agent Loop(约 30 行)，再逐层剖开一个生产级循环真正要处理的：终止条件、失控保护、流式产出、跨轮状态，以及它为什么必须是一个 async generator。"
source: "https://daiw.org/manual/llm-to-agent/agent-loop"
---

# 03 · Agent Loop：所谓智能体，内核是一个 while 循环

> 把“工具调用”从一次性问答变成自主推进，只差一个循环。本篇给出最小可用的 Agent Loop(约 30 行)，再逐层剖开一个生产级循环真正要处理的：终止条件、失控保护、流式产出、跨轮状态，以及它为什么必须是一个 async generator。

## 03 · Agent Loop：所谓智能体，内核是一个 while 循环

这是整个专栏最关键的一篇。[上一篇](/manual/agent/llm-to-agent/tool-use)我们手动走完了一轮工具调用。现在我们把“手动”变成“自动”——而这一步质变，就是“Agent”这个词的全部含义。

## 一、背景：一轮不够，远远不够

回想真人修一个 bug 的过程：

> 读一眼报错 → 打开相关文件看看 → 搜一下这个函数在哪调用 → 改一处 → 跑测试 → 又报另一个错 → 再改 → 再跑 → 绿了，收工。

这是**十几轮**“观察→行动→再观察”。而[上一篇](/manual/agent/llm-to-agent/tool-use)的手动流程只走了**一轮**就停了。你总不能让用户在每一轮之间都手动点一下“继续”。

我们需要的是：**让模型自主地一轮一轮推进，直到它认为任务完成为止。** 中间不需要人插手。

## 二、解决方案：一个循环

思路简单到近乎失望：**把“调用模型 → 执行工具 → 回填结果”这套，套进一个 `while` 循环，直到模型不再要求调用工具。**

判定“任务完成”的信号，恰恰是[上一篇](/manual/agent/llm-to-agent/tool-use)埋下的那个：**模型的回复里如果还有 `tool_use` 块，说明它还想干活，继续；如果一个 `tool_use` 都没有(纯 `text`)，说明它话说完了，退出。**

```ts [最小可用的 Agent Loop —— 真的就这么点]
async function runAgent(userInput: string, tools: Tool[]) {
  const messages: Message[] = [{ role: 'user', content: userInput }]

  while (true) {
    // 1) 带着完整历史和工具,问模型
    const res = await client.messages.create({
      model: 'some-llm', max_tokens: 4096, tools, messages,
    })
    messages.push({ role: 'assistant', content: res.content })

    // 2) 挑出这一轮所有的工具调用请求
    const toolUses = res.content.filter(b => b.type === 'tool_use')

    // 3) 没有工具调用 → 模型说完了 → 退出循环
    if (toolUses.length === 0) {
      return res   // 任务完成
    }

    // 4) 执行每个工具,把结果作为一条 user 消息塞回去
    const toolResults = await Promise.all(
      toolUses.map(async (tu) => ({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: await executeTool(tu.name, tu.input),
      })),
    )
    messages.push({ role: 'user', content: toolResults })

    // 5) 回到循环开头,模型带着工具结果继续推进
  }
}
```

**就这些。** 一个能自主读文件、跑命令、改代码、看结果、再决定下一步的 Agent，内核就是这段循环。你把它跑起来，输入“修复登录页的报错”，它就会自己读文件、搜代码、改、跑测试、看报错、再改……一轮一轮，直到它认为好了才停。

::: info

**这就是“Agent”的定义式：`Agent = LLM + Tools + Loop`。** 模型提供每一步的“决策”，工具提供“行动能力”，而这个循环提供**“自主性”**——让离散的一步步，连成一条不需要人插手的轨迹。市面上所有 Coding Agent，内核都是这个循环；剩下的一切(后面十几篇讲的)，都是围绕它做的加固和优化。

:::

## 三、从“玩具循环”到“生产循环”

上面那 30 行能跑，但离生产级还差得远。一个真实的 Agent Loop，要在这具骨架上处理一大堆现实。我们逐个看——**这几乎就是本专栏后续所有篇章的索引**。

### ① 失控保护：它可能永远停不下来

模型可能陷入“改→测→改→测”的死循环，或者被一个搞不定的错误反复折磨。裸 `while (true)` 会让它无限烧钱。生产循环必须有**闸门**：

```ts [给循环装上刹车]
let turns = 0
while (true) {
  if (turns++ >= maxTurns) return { reason: 'max_turns' }        // 回合数上限
  if (tokenSpent > tokenBudget) return { reason: 'budget' }      // token 预算上限
  // ...原来的循环体...
}
```

回合数、token 预算、墙上时钟……任意一个触顶都要能干净地终止。**“让它自主”和“别让它跑飞”是一对必须同时满足的矛盾**，[Token 预算那一篇](/manual/agent/llm-to-agent/token-budget)会展开。

### ② 循环必须“边跑边产出”，而不是跑完才返回

上面的 `runAgent` 要等**整个任务结束**才 `return`。但用户想**实时看到**每一步：模型说的每句话、每次工具调用、每个结果，都该立刻显示在终端里，而不是干等两分钟看一坨最终结果。

所以真实的 Agent Loop 几乎总是一个 **async generator**——它一边推进，一边 `yield` 出中间产物：

```ts [生产循环是一个 async generator]
async function* runAgent(userInput: string, tools: Tool[]): AsyncGenerator<Event> {
  const messages: Message[] = [{ role: 'user', content: userInput }]

  while (true) {
    // 流式调用,模型每吐一块就 yield 出去给 UI
    let toolUses: ToolUse[] = []
    for await (const chunk of streamModel(messages, tools)) {
      yield chunk                                  // ← UI 立刻渲染
      if (chunk.type === 'assistant') {
        messages.push(chunk)
        toolUses.push(...chunk.content.filter(b => b.type === 'tool_use'))
      }
    }

    if (toolUses.length === 0) return { reason: 'completed' }

    for await (const result of runToolsStreaming(toolUses)) {
      yield result                                 // ← 工具结果也实时 yield
      messages.push(toResultMessage(result))
    }
  }
}
```

调用方 `for await (const ev of runAgent(...))` 就能实时消费。这个“生成器 + yield”的结构，是把[流式](/manual/agent/llm-to-agent/streaming)、[中断](/manual/agent/llm-to-agent/interrupt)、UI 渲染全都串起来的骨架。

### ③ 跨轮状态：循环不是无记忆的

玩具循环里只有一个 `messages` 数组在变。生产循环在每轮之间要携带一大堆状态：

- 当前用的是哪个模型(可能中途[降级回退](/manual/agent/llm-to-agent/error-recovery))。
- 上下文是否已经[压缩](/manual/agent/llm-to-agent/auto-compaction)过、压缩的边界在哪。
- 各种恢复计数器(输出被截断重试了几次、压缩失败了几次)。
- 本轮 token 花销、预算续期次数。

这些状态在迭代之间流转，决定下一轮的行为。**一个成熟的循环，本质是一个手写的状态机**——每一轮根据“上一轮为什么继续”来决定这一轮怎么走。

### ④ 每一轮开始前，先“整理上下文”

注意一个关键时机：在**每次调用模型之前**，生产循环会先对 `messages` 做一轮加工——检查要不要[压缩](/manual/agent/llm-to-agent/auto-compaction)、要不要给巨型工具结果[瘦身](/manual/agent/llm-to-agent/context-compaction)、系统提示和各种上下文怎么[拼接](/manual/agent/llm-to-agent/context-injection)。也就是说：

> **循环体的第一件事不是“调用模型”，而是“把这一轮要喂给模型的上下文准备好”。**

这个“准备上下文”的环节，复杂度往往**超过**循环本身。它就是[第五阶段“上下文工程”](/manual/agent/llm-to-agent/token-budget)的主战场。

### ⑤ 出错是常态，不是意外

真实世界里，`streamModel` 那一行会以各种方式失败：限流、超时、上下文超长(413)、输出被 `max_tokens` 截断、模型过载需要降级……生产循环把**一大半代码**花在这些恢复路径上：捕获错误 → 判断能不能恢复 → 能就调整状态后 `continue` 重来，不能就干净退出。[健壮性那一篇](/manual/agent/llm-to-agent/error-recovery)会专门解剖这些恢复逻辑。

::: warning

一个反直觉但极其重要的事实：**在成熟 Agent 的循环里，处理“正常路径”的代码可能只占两三成，剩下七八成全是在处理压缩、恢复、中断、预算、降级这些“边缘情况”。** 让 Agent“能跑”是那 30 行的事；让它**在真实世界里稳定地跑**，才是真正的工程量所在。这也是为什么本专栏后面还有那么多篇——它们全是在给这个循环“上保险”。

:::

## 四、小结：一台机器的引擎

回到序章那个比方：如果 LLM 是 CPU，那么 **Agent Loop 就是让 CPU 开始自主取指、执行、循环的那个时钟信号**。没有它，你只有一块能算但不会自己动的芯片；有了它，机器才真正“跑”起来。

把三篇连起来，我们已经拼出了 Agent 最小的可用内核：

| 篇章 | 贡献了什么 |
| --- | --- |
| [01 裸 API](/manual/agent/llm-to-agent/raw-llm-api) | 一个会决策的大脑(但不能动、不记事) |
| [02 工具调用](/manual/agent/llm-to-agent/tool-use) | 一双能操作世界的手 |
| **03 Agent Loop** | **让大脑和手不停协作的引擎** |

内核有了。但你可能注意到，前面反复出现一个模糊的 `Tool` 类型和 `executeTool` 函数——真实系统里，一个工具远不止“名字 + 一个执行函数”这么简单。它要自带**参数校验、权限检查、并发标记、结果渲染**……下一篇，[工具系统的抽象设计](/manual/agent/llm-to-agent/tool-abstraction)，我们就来把这个 `Tool` 拆开，看一个工业级的工具到底该长什么样。
