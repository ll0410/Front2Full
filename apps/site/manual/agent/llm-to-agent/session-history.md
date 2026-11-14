---
title: "20 · 会话历史与持久化：让 Agent 活过进程的生命周期"
description: "到目前为止一切都在内存里，进程一关就灰飞烟灭。收官篇讲如何用 append-only JSONL 把会话落盘、崩溃安全地重放、大块内容外置、并发写加锁，以及为什么“抄本即真相”。最后回望全专栏——我们如何把裸 LLM 缺的三样东西，一件件补齐。"
source: "https://daiw.org/manual/llm-to-agent/session-history"
---

# 20 · 会话历史与持久化：让 Agent 活过进程的生命周期

> 到目前为止一切都在内存里，进程一关就灰飞烟灭。收官篇讲如何用 append-only JSONL 把会话落盘、崩溃安全地重放、大块内容外置、并发写加锁，以及为什么“抄本即真相”。最后回望全专栏——我们如何把裸 LLM 缺的三样东西，一件件补齐。

## 20 · 会话历史与持久化：让 Agent 活过进程

本专栏的收官篇。我们的 Agent 已经近乎无所不能，但它还缺最后一样东西——**它活不过自己的进程**。关掉终端，整个会话灰飞烟灭：干到一半的任务、积累的上下文、宝贵的探索结果，全没了。这一篇，我们给它落盘。

## 一、背景：内存是易失的

回到[序章](/manual/agent/llm-to-agent/)那个比方，以及[01 篇](/manual/agent/llm-to-agent/raw-llm-api)那三个“裸 LLM 没有”。我们一路补上了“能行动”(工具)和“能自主推进”(循环)，但第三样——**记忆/状态**——我们只在**内存**里补了：那个 `messages` 数组一直在进程内存里滚。

内存是易失的。进程一退，`messages` 就没了。这带来几个真实痛点：

- **不能续接**：昨天让 Agent 重构一个大模块，干了一半，今天想接着干？对不起，重来。
- **不能回看**：上周那次会话它是怎么解决那个 bug 的？没记录。
- **不能撤销**：改错了想退回三步前？内存里没存过去的状态。

要让 Agent“活过进程”，就得把会话**持久化**到磁盘。

## 二、解决方案：append-only JSONL

持久化会话，业界的主力方案朴素而可靠：**把每一条消息，作为一行 JSON，追加写到一个 JSONL 文件里。**

```text [会话 JSONL:一条消息一行,只追加]
{"role":"user","content":"重构 auth 模块"}
{"role":"assistant","content":[{"type":"text","text":"我先看看现状"},{"type":"tool_use",...}]}
{"role":"user","content":[{"type":"tool_result","tool_use_id":"...","content":"..."}]}
{"role":"assistant","content":[...]}
...
```

为什么是“append-only(只追加)”这个形式？它有几个恰到好处的性质：

::: info

**append-only JSONL 几乎是为 Agent 会话量身定做的：**
- **崩溃安全**：每条消息一产生就立刻追加落盘。哪怕进程下一秒崩了，已经写下的部分也都在——你不会丢掉整个会话，最多丢最后没写完的一条。
- **流式友好**：消息是一条条产生的，追加写和这个节奏天然契合，不用每次重写整个文件。
- **可重放**：恢复会话 = 把 JSONL 一行行读回来，重建 `messages` 数组，然后[接着循环](/manual/agent/llm-to-agent/agent-loop)。抄本本身就是完整的、可回放的历史。

:::

```ts [落盘与恢复,对称得令人安心]
// 落盘:每次往历史加一条消息,就追加一行
function append(file: string, message: Message) {
  appendFileSync(file, JSON.stringify(message) + '\n')
}

// 恢复:把每一行读回来,就重建了整个历史
function load(file: string): Message[] {
  return readFileSync(file, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l))
}
```

## 三、四个实现细节

### ① 抄本即真相，压缩只是运行时视图

一个关键的设计决定：**落盘的是[压缩](/manual/agent/llm-to-agent/auto-compaction)前的完整历史，还是压缩后的？** 答案是——**落盘完整的，压缩只作为运行时的一层视图。**

::: info

**JSONL 抄本是“真相”，它记录发生过的一切、逐字、永不折叠。而[压缩](/manual/agent/llm-to-agent/auto-compaction)/[精简](/manual/agent/llm-to-agent/context-compaction)是运行时为了塞进[窗口](/manual/agent/llm-to-agent/token-budget)而做的临时投影。** 这样分工的好处：恢复会话时你能拿回**完整**历史(而不是一个有损摘要)，然后按需重新应用压缩。抄本保真，运行时求存——两者各司其职。如果你把压缩后的有损版本当成真相存下来，那些被摘要掉的细节就**永久**丢失了，再也找不回来。

:::

### ② 大块内容外置

有些消息里嵌着大块内容(用户粘贴的一大段日志、一张图)。把它们**原样塞进 JSONL**会让抄本臃肿、难读。常见做法：**小的内联存，大的按哈希外置**——JSONL 里只留一个引用(`[粘贴内容 #3,+240 行]`)，内容本体存到旁边一个按哈希命名的文件。这和[第 14 篇工具结果外置](/manual/agent/llm-to-agent/context-compaction)是同一个思路：**大 blob 不进主流，只留句柄。**

### ③ 并发写要加锁

别忘了[子 Agent](/manual/agent/llm-to-agent/subagents)和后台任务——它们可能**并发**地往会话相关文件写。两个进程同时追加同一个文件，可能交错损坏。所以真实实现会用**文件锁(lockfile)** 来串行化写入。(子 Agent 的抄本通常还会写到**独立的支线文件**，既不和主会话抢锁，又能单独审查——呼应[第 18 篇](/manual/agent/llm-to-agent/subagents)。)

### ④ 撤销：append-only 之上的巧思

append-only 不能“删”，怎么实现撤销？一个巧妙的做法：**用一个“待落盘缓冲 + 跳过集合”**——最近的、还没刷盘的操作放在内存缓冲里(撤销它们很快)；已经刷盘的，则用一个“跳过集合”标记为“已撤销”，重放时略过。**在一个只追加的底座上，叠加逻辑上的可撤销**，是持久化设计里一个漂亮的小技巧。

## 四、全专栏回望：我们究竟做了什么

会话持久化，恰好补上了[01 篇](/manual/agent/llm-to-agent/raw-llm-api)那三个“裸 LLM 没有”的最后一个。让我们回到起点，看看这一路究竟把那块“裸芯片”，一件件焊成了什么：

| 裸 LLM 缺的 | 我们补的 | 在哪补的 |
| --- | --- | --- |
| 不能行动 | 工具调用 | [第 02、04 篇](/manual/agent/llm-to-agent/tool-use) |
| 不会自主推进 | Agent Loop | [第 03 篇](/manual/agent/llm-to-agent/agent-loop) |
| 无状态、易失 | 上下文管理 + **持久化** | 第五阶段 + **本篇** |

而在这三根主梁之外，我们还焊上了让它真正**能用、能扛、能长大**的一切：

- 让它**快**：[流式](/manual/agent/llm-to-agent/streaming)、[边流边执行与并发](/manual/agent/llm-to-agent/streaming-tool-execution)。
- 让它**安全可控**：[权限](/manual/agent/llm-to-agent/permissions)、[中断](/manual/agent/llm-to-agent/interrupt)、[钩子](/manual/agent/llm-to-agent/hooks)。
- 让它在**有限窗口里精打细算**：[token 预算](/manual/agent/llm-to-agent/token-budget)、[上下文注入](/manual/agent/llm-to-agent/context-injection)、[缓存](/manual/agent/llm-to-agent/prompt-caching)、[压缩](/manual/agent/llm-to-agent/auto-compaction)、[精细管理](/manual/agent/llm-to-agent/context-compaction)。
- 让它**扛得住真实世界**：[错误恢复](/manual/agent/llm-to-agent/error-recovery)、[成本追踪](/manual/agent/llm-to-agent/cost-tracking)、[思考处理](/manual/agent/llm-to-agent/thinking)。
- 让它**能扩展、成规模**：[子 Agent](/manual/agent/llm-to-agent/subagents)、[MCP 与懒加载](/manual/agent/llm-to-agent/mcp)、[持久化](/manual/agent/llm-to-agent/session-history)。

::: info

**回到序章那个核心问题：一个只会“输出文本”的无状态函数，是怎么变成一个能自主完成复杂编程任务的 Agent 的？** 现在你有了完整的答案：**不是靠某一个魔法，而是靠外面这一整圈、几十个环环相扣的工程决策。** 模型提供智能，但把智能变成“能自主、安全、持久、经济地在真实世界里干活的系统”，全在模型**之外**这一圈。这一圈，没有一处是黑魔法，每一处都是扎实的、可以理解、可以复刻的工程。

:::

## 五、结语：芯片与机器

我们从一块“什么都不会”的裸芯片(LLM)出发，一篇一篇，焊上了内存、总线、驱动、操作系统，最后拼出了一台**能自主干活的完整机器**(Agent)。

如果这趟旅程只留下一句话，那就是序章那句的回响：

> **LLM 只是块芯片，Agent 才是整台机器。而这台机器的每一个零件，你现在都亲手拆过、装过一遍了。**

配套的[完整代码仓库](https://github.com/davidapp/coding-agent-from-scratch)里，这台机器从第一篇的几十行，长到了现在的一个麻雀虽小五脏俱全的真实 Agent。`git checkout` 到任意一篇，你都能把那个阶段的它跑起来。**读懂它，然后——去造你自己的那一台。**

感谢一路读到这里。

::: info

**另有一篇实战番外**：[仓库总结的完整流程](/manual/agent/llm-to-agent/repo-summarization)。它不再引入新部件，而是把本专栏焊上的零件全部组装起来，解决一个具体而普遍的问题——**让 Agent 读懂一个几百万 token、根本塞不进窗口的代码仓库**。想看这些零件在真实任务里怎么协同，读它。

**想继续看真实生产级 Coding Agent 的源码？** 站内还有一整组拆读真实开源/生产级 Agent 的姊妹专栏：[《Codex 源码解读》](https://daiw.org/manual/codex-source)、[《Grok Build 源码解读》](https://daiw.org/manual/grok-build)、[《Kimi Code 源码解读》](https://daiw.org/manual/kimi-code)、[《OpenCode 源码解读》](https://daiw.org/manual/opencode)、[《MiMo Code 源码解读》](https://daiw.org/manual/mimo-code)、[《MiniMax Code 源码解读》](https://daiw.org/manual/minimax-code)、[《Z Code 源码解读》](https://daiw.org/manual/zcode)，以及 [《Claude Code 中文手册》](https://daiw.org/manual/claude-code) 与 [《Codex 中文手册》](https://daiw.org/manual/codex)。你会发现它们每一个的内核，都是你刚刚亲手焊出来的这台机器。

:::

---

**本篇对应代码**：配套仓库加入 `src/session.ts`(append-only JSONL 落盘 + 恢复)，CLI 支持关掉再回来接着聊。`git checkout article-20`——这是完整版。
