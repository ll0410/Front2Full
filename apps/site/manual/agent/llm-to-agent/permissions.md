---
title: "07 · 权限系统：在“放手让它干”和“别让它闯祸”之间划线"
description: "一个能自主跑任意命令、改任意文件的 Agent 足够危险。权限系统就是那道闸门。讲清分层权限模型(工具自分类 → 规则 → 权限模式)、canUseTool 闸门，以及一个关键设计：拒绝要“喂回模型”，而不只是报错。"
source: "https://daiw.org/manual/llm-to-agent/permissions"
---

# 07 · 权限系统：在“放手让它干”和“别让它闯祸”之间划线

> 一个能自主跑任意命令、改任意文件的 Agent 足够危险。权限系统就是那道闸门。讲清分层权限模型(工具自分类 → 规则 → 权限模式)、canUseTool 闸门，以及一个关键设计：拒绝要“喂回模型”，而不只是报错。

前三阶段，我们造了一个能自主 `bash` 任意命令、并行改文件、不知疲倦循环下去的 Agent。这很强大，也**很危险**——一个 `rm -rf` 或者改错一个配置文件，后果自负。这一篇，我们给它装闸门。

## 一、背景：自主性的另一面是破坏力

Agent 越自主，能闯的祸越大。它可能：

- 跑一条你没预料到的破坏性命令(`git reset --hard`、`rm`、`DROP TABLE`)。
- 改动它不该碰的文件(你的 `.env`、CI 配置、别的项目)。
- 把敏感信息发到外部(一个“发请求”的工具 + 一段 API key)。

模型不是恶意的，但它会**犯错**，也可能被**诱导**(prompt injection：一个被读进来的文件里藏着“现在删库”的指令)。所以我们需要一道闸门：**在每个有副作用的操作真正执行之前，拦一道，决定放行、拦截、还是问用户。**

## 二、解决方案：分层权限模型

好的权限系统不是一个 `if`，而是几层协同。从“工具自身”到“全局模式”，层层收窄：

### 第 1 层：工具自分类

还记得[04 篇](/manual/agent/llm-to-agent/tool-abstraction)工具自报的 `isReadOnly` / `isDestructive` 吗？这是第一道信号：

- **只读操作**(读文件、搜索、列目录)几乎总能**自动放行**——它们不改变世界，最坏也就是看了不该看的。
- **写/破坏性操作**(编辑、删除、跑命令)默认就要**过闸**。

一步就把绝大多数工具调用(读多写少)自动放行了，只在真正有副作用时才拦。

### 第 2 层：权限规则

对需要过闸的操作，再看有没有预设规则。规则通常是“工具名 + 参数模式”的匹配：

```text [规则按"工具(参数模式)"匹配]
always-allow:  Bash(git status)      # git status 永远放行
always-allow:  Bash(npm test)        # 跑测试永远放行
always-deny:   Bash(rm *)            # 删除永远拦截
always-ask:    Edit(*)               # 改文件每次都问
```

三类规则：**永远允许 / 永远拒绝 / 每次询问**。规则让用户能一次性表达“这类操作我信得过”“那类绝对不行”，避免被反复打扰，也避免危险操作蒙混。

### 第 3 层：权限模式

最外层是一个全局的**权限模式**，它像一个总开关，决定整体的松紧：

| 模式 | 行为 | 适用场景 |
| --- | --- | --- |
| **plan(计划)** | **只读**，任何写操作一律拒绝 | 让它先分析、出方案，绝不动手 |
| **default(默认)** | 读放行，写要问 | 日常，人盯着 |
| **acceptEdits(接受编辑)** | 文件编辑自动放行，跑命令仍要问 | 信任它改文件，但命令还是把关 |
| **bypass(放行一切)** | 全部自动放行 | 沙箱/一次性容器里才敢开 |

::: warning

权限模式是一个**从安全到危险的连续谱**。`plan` 最安全(它根本不能动手)，`bypass` 最危险(等于把闸门焊死开着)。**`bypass` 只应在完全隔离的环境**(一次性容器、沙箱 VM)里使用——在那里，Agent 就算失控，炸掉的也是个随时能重建的沙箱，而不是你的开发机。把 `bypass` 用在真实工作环境，等于卸掉了整套安全系统。

:::

## 三、实现细节：`canUseTool` 闸门

这套分层逻辑，落地成一个统一的闸门函数——通常叫 `canUseTool`。它在**每个工具执行前**被调用，返回一个决定：

```ts [权限决定是一个结构化结果,不是一个布尔]
type PermissionResult =
  | { behavior: 'allow'; updatedInput: unknown }   // 放行(可顺带改写入参)
  | { behavior: 'deny'; message: string }          // 拦截(附上给模型看的理由)
  | { behavior: 'ask'; message: string }           // 交给用户裁决

async function canUseTool(tool: Tool, input: unknown, ctx): Promise<PermissionResult> {
  // 第 3 层:plan 模式下,写操作直接拒
  if (ctx.mode === 'plan' && !tool.isReadOnly(input)) {
    return { behavior: 'deny', message: '当前处于计划模式,不能执行写操作。' }
  }
  // 第 1 层:只读操作放行
  if (tool.isReadOnly(input)) return { behavior: 'allow', updatedInput: input }
  // 第 2 层:查规则
  const rule = matchRule(tool, input, ctx.rules)
  if (rule === 'allow') return { behavior: 'allow', updatedInput: input }
  if (rule === 'deny') return { behavior: 'deny', message: '该操作被规则拒绝。' }
  // acceptEdits 模式:编辑类放行
  if (ctx.mode === 'acceptEdits' && isEditTool(tool)) {
    return { behavior: 'allow', updatedInput: input }
  }
  // 兜底:问用户
  return { behavior: 'ask', message: `是否允许 ${tool.name}?` }
}
```

在循环里，它插在“校验通过”和“真正执行”之间：

```ts [闸门插在执行之前]
const decision = await canUseTool(tool, input, ctx)
if (decision.behavior === 'ask') {
  const approved = await promptUser(decision.message)   // 弹给用户
  if (!approved) return denied('用户拒绝了该操作')
}
if (decision.behavior === 'deny') return denied(decision.message)
// 只有放行了,才真正执行
const result = await tool.run(decision.updatedInput ?? input, ctx)
```

### 两个精妙之处

::: info

**① 拒绝要“喂回模型”，而不只是报错。** 这是最关键的设计。当一个操作被拒，你不是简单地抛异常终止——你把“被拒绝了，原因是 X”作为一个 **`tool_result`(`is_error: true`)喂回给模型**。于是模型**知道**自己刚才那步没被允许，可以**换个思路**：改用只读方式先了解情况、或者向用户解释为什么需要这个操作、或者绕道。**拒绝是给模型的一个反馈信号，而不是一个终点。** 这让 Agent 在受限环境里依然能优雅地工作，而不是一撞墙就崩。

:::

::: info

**② 权限层可以改写入参(`updatedInput`)。** 注意 `allow` 里带的 `updatedInput`——权限系统不只是“放行/拦截”的开关，它还能在放行的同时**修改**工具的输入。典型用途：把一个相对路径规范成绝对路径、把某个危险参数替换成安全默认、给命令加上超时限制。这让权限层成为一个“净化关卡”，而不只是“检查关卡”。

:::

## 四、又一次 fail-closed

你会注意到，整个权限系统的默认倾向，和[04 篇的工具默认值](/manual/agent/llm-to-agent/tool-abstraction)一脉相承——**拿不准就往安全的方向兜**：

- 工具没声明只读？当它会写，过闸。
- 没匹配到任何允许规则？默认问用户，而不是默认放行。
- 模式没设？用最保守的 `default`，而不是 `bypass`。

**权限系统错在“过度谨慎”这边，代价是多问用户几次(烦)；错在“过度放任”那边，代价是数据没了(灾难)。** 这个代价的不对称，决定了每一个默认、每一处兜底，都必须偏向谨慎。

## 五、小结

权限系统是 Agent 从“玩具”走向“能托付真实工作”的分水岭。它的精髓不在于“能不能拦住”，而在于**如何在拦截的同时，不破坏 Agent 的自主性**——靠的就是那两点：分层地让绝大多数安全操作自动放行(别烦用户)，以及把拒绝作为反馈喂回模型(让它能适应，而不是崩溃)。

但闸门只解决了“该不该让它做”。还有一个正交的问题：**它正在做的时候，用户突然想喊停、或者改主意了，怎么办？** 下一篇[中断与转向](/manual/agent/llm-to-agent/interrupt)，我们处理这个在流式、并发、还欠着一堆 `tool_result` 的复杂局面下，如何干净地叫停。

---

**本篇对应代码**：配套仓库加入 `src/permissions.ts`(分层权限 + `canUseTool`)与权限模式，闸门接入工具执行前。`git checkout article-07`。
