---
title: "09 · Hooks：给 Agent 开一组可编程的插槽"
description: "用户想在工具执行前后、回合结束时插入自己的逻辑——自动格式化、提交前检查、强制“测试不过不许停”。讲清生命周期钩子的设计：PreToolUse 拦截/改写、PostToolUse 反应、以及最有意思的 Stop 钩子如何“拽住”想收工的 Agent。"
source: "https://daiw.org/manual/llm-to-agent/hooks"
---

# 09 · Hooks：给 Agent 开一组可编程的插槽

> 用户想在工具执行前后、回合结束时插入自己的逻辑——自动格式化、提交前检查、强制“测试不过不许停”。讲清生命周期钩子的设计：PreToolUse 拦截/改写、PostToolUse 反应、以及最有意思的 Stop 钩子如何“拽住”想收工的 Agent。

[权限](/manual/agent/llm-to-agent/permissions)是内置的安全策略，但用户总有自己的、五花八门的诉求：“每次改完文件自动跑一遍格式化”“提交前必须过 lint”“测试没绿之前不许它说完成”。这些没法全塞进 Agent 内核。这一篇，我们给它开一组**可编程的插槽**。

## 一、背景：内核装不下所有人的规矩

不同团队、不同项目，对 Agent 有完全不同的额外要求：

- 前端项目：每次 `edit_file` 后，自动 `prettier --write`。
- 后端项目：任何 `bash` 命令，先记一条审计日志。
- 严格团队：Agent 说“我做完了”之前，**必须**确认测试通过，否则打回去继续干。

这些逻辑**因人而异、因项目而异**，不可能硬编码进 Agent。你需要的是一种机制：**让用户在 Agent 生命周期的固定节点，挂上自己的代码。** 这就是 Hooks。

## 二、解决方案：生命周期钩子

思路是在 Agent 循环的关键时刻，埋下若干**命名的挂载点**，每个点允许用户注册处理器。常见的挂载点：

| 钩子 | 触发时机 | 能干什么 |
| --- | --- | --- |
| **PreToolUse** | 某个工具**执行前** | 拦截、改写入参、或放行 |
| **PostToolUse** | 某个工具**执行后** | 对结果做反应(格式化、通知、追加检查) |
| **Stop** | Agent **准备收工时** | **拽住它**，强制它继续干 |
| **UserPromptSubmit** | 用户提交输入时 | 预处理、注入额外上下文 |

::: info

**Hooks 是“用户态”对 Agent 的扩展，而且是确定性的。** 注意这个关键区别：模型的行为是**概率性**的(你没法保证它每次都记得跑格式化)；而钩子是**确定性**的代码——挂上了，就**每次必然**执行。所以 Hooks 的价值，恰恰在于把那些“必须每次都做、不容模型忘记”的事，从“祈祷模型配合”变成“机制保证”。凡是你不放心交给模型自觉的横切逻辑，都该用钩子钉死。

:::

## 三、实现细节：钩子的契约与三种挂载点

### 钩子的契约：输入结构化事件，输出决定

一个钩子接收**结构化的事件信息**，返回一个**决定**。以 PreToolUse 为例：

```ts [PreToolUse 钩子:执行前的可编程闸门]
type PreToolUseDecision =
  | { decision: 'continue' }                    // 放行
  | { decision: 'block'; message: string }      // 拦截,理由喂回模型
  | { decision: 'modify'; input: unknown }      // 改写入参后放行

type PreToolUseHook = (tool: Tool, input: unknown) => Promise<PreToolUseDecision>
```

它和[权限系统](/manual/agent/llm-to-agent/permissions)的 `canUseTool` 长得很像——**没错，PreToolUse 本质就是一个“用户可编程的权限闸门”**。区别在于：权限是内置策略，钩子是用户挂的任意逻辑。两者叠加(通常钩子先跑，再走内置权限)，构成一道可深度定制的关卡。

::: info

真实系统里，钩子常被实现为**外部命令**而非进程内函数：Agent 把事件序列化成 JSON 从 stdin 喂给一个用户指定的脚本，脚本处理后把决定以 JSON 从 stdout 返回。这样做的好处是**语言无关**——用户拿任何语言(bash、Python、Node)写钩子都行，Agent 完全不关心。代价是每次要起一个子进程。进程内函数快，但把用户锁死在 Agent 的语言里。工程上二者常并存。

:::

### PreToolUse：拦截与改写

接进[08 篇](/manual/agent/llm-to-agent/interrupt)的工具执行入口，排在权限之前：

```ts [工具执行前先跑 PreToolUse 钩子]
for (const hook of hooks.preToolUse ?? []) {
  const d = await hook(tool, input)
  if (d.decision === 'block') return denied(d.message)   // 钩子拦截,理由喂回模型
  if (d.decision === 'modify') input = d.input           // 钩子改写入参
}
// ...再走内置权限、再执行...
```

### Stop：拽住想收工的 Agent(最有意思的一个)

Stop 钩子挂在循环的出口——**当模型不再要求调用工具、Agent 准备结束时**。它有权说：“**不行，你还没完，接着干。**”

```ts [Stop 钩子:在 Agent 想退出时拦一道]
// 循环里,原本"没有工具调用就退出"的地方:
if (toolUses.length === 0) {
  for (const hook of hooks.stop ?? []) {
    const d = await hook(messages)
    if (d.decision === 'block') {
      // 钩子不让停!把它的要求作为一条新消息注入,继续循环
      messages.push({ role: 'user', content: d.message, isMeta: true })
      continue   // ← 回到循环开头,Agent 被"拽"了回来
    }
  }
  return { reason: 'completed' }   // 所有 Stop 钩子都放行,才真正结束
}
```

这个机制威力很大。比如一个“测试守门”钩子：

```ts [一个"测试不过不许停"的 Stop 钩子]
const testGate: StopHook = async () => {
  const passed = await runTests()
  return passed
    ? { decision: 'continue' }
    : { decision: 'block', message: '测试仍未通过,请继续修复,不要停下。' }
}
```

挂上它，Agent 就**没法在测试还红着的时候溜号**——它每次想说“搞定了”，都会被这个钩子打回去继续修，直到测试真的绿了。

::: warning

**Stop 钩子是把双刃剑，小心死循环。** 如果钩子的条件永远满足不了(比如要求“零 lint 警告”，但有个警告 Agent 根本改不动)，它会把 Agent 永远拽在循环里，反复“想停→被打回→再试→又想停”，烧光你的预算。所以 Stop 钩子的注入消息里，通常要给模型**留一条退路**(比如“若确实无法解决，请说明原因后停止”)，并配一个**最大重试次数**做硬闸——这和[03 篇](/manual/agent/llm-to-agent/agent-loop)讲的失控保护是同一个道理：任何能让循环延续的机制，都必须自带刹车。

:::

## 四、Hooks 与权限、Agent Loop 的关系

把这三者摆在一起看，一个清晰的分层浮现出来：

- **Agent Loop**([03](/manual/agent/llm-to-agent/agent-loop))：提供“自主推进”的引擎。
- **权限**([07](/manual/agent/llm-to-agent/permissions))：内置的、面向安全的策略闸门。
- **Hooks**(本篇)：用户态的、可编程的扩展插槽，能在同样的节点上叠加任意确定性逻辑。

它们共享同一批“关键时刻”(工具执行前后、回合结束)，只是各自负责不同层面的关切。**一个成熟 Agent 的可扩展性，很大程度上就体现在这套生命周期钩子的丰富度上**——它决定了用户能把 Agent 定制到多深。

## 五、第四阶段收尾

**第四阶段“安全与控制”到此完整：**

| 篇章 | 装上了什么 |
| --- | --- |
| [07 权限](/manual/agent/llm-to-agent/permissions) | 内置安全闸门：能做什么 |
| [08 中断](/manual/agent/llm-to-agent/interrupt) | 干净叫停：何时停下 |
| **09 Hooks** | 可编程插槽：让用户嵌入自己的规矩 |

我们的 Agent 现在既自主、又快、又可控、还可扩展。看起来很完整了？但有一头我们一直在回避的猛兽，始终没正面处理——**上下文窗口**。随着对话越滚越长、工具结果越堆越多，那个有限的窗口迟早会被撑爆。而这，是整个 Agent 工程里**最难、最见功力**的部分。

下一篇进入[第五阶段：上下文工程](/manual/agent/llm-to-agent/token-budget)。系好安全带。

---

**本篇对应代码**：配套仓库加入 `src/hooks.ts`(PreToolUse / Stop 钩子)，接入工具执行前与循环出口。`git checkout article-09`。
