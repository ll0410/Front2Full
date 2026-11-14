---
title: "02 · 工具调用：让模型的“意图”变成真实的“动作”"
description: "模型只会输出文本，怎么让它读文件、跑命令？答案是工具调用：你用 JSON Schema 声明工具，模型输出一个结构化的“调用请求”，你来执行、再把结果喂回去。讲清 tool_use / tool_result 的完整闭环，以及“模型永远不碰你的机器”这个安全内核。"
source: "https://daiw.org/manual/llm-to-agent/tool-use"
---

# 02 · 工具调用：让模型的“意图”变成真实的“动作”

> 模型只会输出文本，怎么让它读文件、跑命令？答案是工具调用：你用 JSON Schema 声明工具，模型输出一个结构化的“调用请求”，你来执行、再把结果喂回去。讲清 tool_use / tool_result 的完整闭环，以及“模型永远不碰你的机器”这个安全内核。

## 02 · 工具调用：让模型的“意图”变成真实的“动作”

[上一篇](/manual/agent/llm-to-agent/raw-llm-api)我们确认了一个残酷的事实：模型只会输出文本，碰不到真实世界。这一篇，我们捅穿这道墙。

## 一、背景：模型和世界之间的那道墙

你问模型“`src/` 目录下有哪些文件”，它有三种反应，没有一种是有用的：

1. 老实承认：“我无法访问你的文件系统。”(诚实但没用)
2. 一本正经地胡编：“有 `index.ts`、`utils.ts`……”(自信地瞎猜，更糟)
3. 输出一句 `ls src/`，但那只是**一串字符**，不会有任何命令真的执行。

问题的根子在于：模型的输出是**文本**，而“列目录”是一个**动作**。文本和动作之间，隔着一道模型无法逾越的墙。

我们需要一种机制，让模型能表达“我想执行某个动作、参数是这些”，然后由**我们**(宿主程序)去真正执行，再把结果告诉它。这个机制，就是**工具调用**(tool use / function calling)。

## 二、解决方案：把“能力”声明给模型

思路分三步，构成一个闭环：

1. **声明**：在请求里告诉模型“你有哪些工具可用”，每个工具用**名字 + 描述 + 参数的 JSON Schema** 来定义。
2. **请求**：模型不再(只)输出文本，而是输出一个结构化的**工具调用请求**——“我要调用 `read_file`，参数 `{path: 'src/index.ts'}`”。
3. **回填**：**你**执行这个调用，把结果作为一条特殊消息塞回对话历史，模型接着往下推理。

关键的认知在这里：

::: warning

**模型永远不会执行任何东西。** 它做的全部，只是**输出一个 JSON**，表达“我想这样调用”。真正的执行——读文件、跑命令、发请求——**100% 发生在你的代码里**。这道边界是整个 Agent **安全模型的基石**：模型再怎么“想”删你的库，它也只能“请求”，而按不按下执行键，权力始终在宿主手里。[权限系统](/manual/agent/llm-to-agent/permissions)整篇文章，就是在这道边界上做文章。

:::

## 三、实现细节：一个完整的工具调用闭环

我们来手动走完一整轮。用 TypeScript，定义一个“读文件”工具。

### 第 1 步：声明工具

工具的核心是一份**给模型看的说明书**：名字、描述、参数 Schema。

```ts [声明一个 read_file 工具]
const readFileTool = {
  name: 'read_file',
  // 描述是写给模型看的 prompt!模型靠它决定"什么时候、怎么用"这个工具。
  description: '读取指定路径的文件内容。当你需要查看某个文件时使用。',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '要读取的文件路径,相对于项目根目录' },
    },
    required: ['path'],
  },
} as const
```

::: info

**`description` 不是注释，是 prompt。** 它和参数 Schema 会被拼进发给模型的请求里，直接决定模型**能不能正确地选中并调用**这个工具。工具描述写得烂，模型就用得烂——这是 Agent 工程里一个极其现实、又极其容易被低估的细节。[工具抽象那一篇](/manual/agent/llm-to-agent/tool-abstraction)会专门讲怎么设计好一个工具。

:::

### 第 2 步：模型发出调用请求

把工具随请求一起发出去：

```ts [带着工具发起请求]
const res = await client.messages.create({
  model: 'some-llm',
  max_tokens: 1024,
  tools: [readFileTool],                          // ← 告诉模型它有这个工具
  messages: [
    { role: 'user', content: 'src/index.ts 里导出了什么?' },
  ],
})
```

这一次，模型的响应变了——注意 `stop_reason` 和 `content` 里的新块：

```ts [模型的响应:它要调用工具了]
{
  role: 'assistant',
  content: [
    { type: 'text', text: '我来看一下这个文件。' },   // 可能先说一句
    {
      type: 'tool_use',                               // ← 全新的块类型!
      id: 'toolu_abc123',                             // ← 这次调用的唯一 ID,关键
      name: 'read_file',
      input: { path: 'src/index.ts' },                // ← 模型填好的参数
    },
  ],
  stop_reason: 'tool_use',                            // ← 不是 end_turn,是"我要用工具"
}
```

还记得[上一篇](/manual/agent/llm-to-agent/raw-llm-api)说的“`content` 是块数组”这堵承重墙吗？现在你看到它的价值了：模型能在**同一条回复里**，既说一句人话(`text` 块)，又发起一个动作(`tool_use` 块)。

### 第 3 步：你执行，并把结果喂回去

模型只是“请求”，执行是你的活。你按 `name` 找到对应实现，拿 `input` 当参数跑它：

```ts [宿主程序执行工具]
async function executeTool(name: string, input: any): Promise<string> {
  if (name === 'read_file') {
    return await fs.readFile(input.path, 'utf-8')   // ← 真正的动作发生在这里
  }
  throw new Error(`未知工具: ${name}`)
}
```

执行完，把结果包成一个 **`tool_result` 块**，作为一条 **`user` 角色**的消息追加进历史。**最关键的一步：用 `tool_use_id` 把结果和刚才那次请求对上号。**

```ts [把工具结果回填进对话]
const toolUse = res.content.find(b => b.type === 'tool_use')
const result = await executeTool(toolUse.name, toolUse.input)

const messages = [
  { role: 'user', content: 'src/index.ts 里导出了什么?' },
  { role: 'assistant', content: res.content },         // 模型那条(含 tool_use)原样放回
  {
    role: 'user',                                       // 工具结果的角色是 user
    content: [
      {
        type: 'tool_result',
        tool_use_id: toolUse.id,                        // ← 必须回指那个 id,一一配对
        content: result,                                // 文件内容
      },
    ],
  },
]
```

### 第 4 步：模型带着结果继续

把这份**加长了的**历史再发一次，模型这回“看得见”文件内容了，于是给出真正的回答：

```ts [再发一次,模型基于工具结果作答]
const finalRes = await client.messages.create({
  model: 'some-llm', max_tokens: 1024, tools: [readFileTool], messages,
})
// => "src/index.ts 导出了 3 个函数:createServer、handleRequest 和 shutdown。"
```

闭环完成。**模型第一次真正地“知道”了一件它本来无从得知的事**——因为你替它去看了。

## 四、几条不能踩的硬规则

工具调用的协议有几条铁律，违反了 API 直接报错：

- **每个 `tool_use` 必须有一个配对的 `tool_result`。** 模型发起了 3 个调用，你就欠它 3 个结果，靠 `tool_use_id` 一一对上。缺一个，下次请求就会被拒。**这条约束会在后面反复咬你**——比如流式中途被用户打断时，已经发出的 `tool_use` 还没来得及执行，你也**必须**给它补一个(内容为“已中断”的)`tool_result`，否则历史就是非法的。[中断那一篇](/manual/agent/llm-to-agent/interrupt)专门讲这个。
- **可以并行调用。** 一条响应里可以同时冒出多个 `tool_use` 块(比如“同时读三个文件”)。这为[并发执行](/manual/agent/llm-to-agent/streaming-tool-execution)埋下了伏笔。
- **`tool_result` 可以标记为错误。** 工具跑失败了，就在结果里带上 `is_error: true`，模型会看到失败并尝试换个方式——这是 Agent 能“自我纠错”的前提。
- **`input` 是模型生成的，不可全信。** 它是模型按你的 Schema“填”出来的 JSON，可能缺字段、类型不对、路径越界。**执行前必须校验**。永远把模型的输出当作不可信输入对待。

## 五、我们刚刚跨过了一道分水岭

退一步看看刚才发生了什么：模型通过一个纯文本的 API，**间接地操作了真实世界**——它让一个文件被读取了。这就是“Agent”能成立的第一原理：

> **模型负责“决策”(该调哪个工具、传什么参数)，宿主负责“执行”(真的去干)，结果再回流给模型形成闭环。**

但你也注意到了：上面这一整套，我们是**手动**走完一轮的——手动检查 `stop_reason`、手动执行、手动回填、手动再发一次。如果模型读完 `index.ts` 发现还得再看 `utils.ts` 呢？再手动来一轮？那要是它需要连着调用 20 次工具才能修好一个 bug 呢？

你肯定想到了：**把这套“检查→执行→回填→再问”用一个循环自动跑起来不就行了。**

没错。那个循环，就是让“工具调用”质变成“Agent”的东西。下一篇，[Agent Loop](/manual/agent/llm-to-agent/agent-loop)：我们会看到，所谓智能体的内核，其实就是一个 `while` 循环。
