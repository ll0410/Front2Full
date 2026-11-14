---
title: "19 · MCP 与工具懒加载：接入开放生态，并解决“几百个工具”的规模问题"
description: "内置工具写死了，真实用户想接入数据库、浏览器、公司 API，还可能有几百个。讲清 MCP 作为外部工具的标准协议如何让工具生态开放化、任何外部工具如何复用同一个 Tool 抽象，以及“几百个工具塞爆 prompt”怎么用延迟加载 + 工具搜索来解。"
source: "https://daiw.org/manual/llm-to-agent/mcp"
---

# 19 · MCP 与工具懒加载：接入开放生态，并解决“几百个工具”的规模问题

> 内置工具写死了，真实用户想接入数据库、浏览器、公司 API，还可能有几百个。讲清 MCP 作为外部工具的标准协议如何让工具生态开放化、任何外部工具如何复用同一个 Tool 抽象，以及“几百个工具塞爆 prompt”怎么用延迟加载 + 工具搜索来解。

到目前为止，我们 Agent 的工具都是**内置写死**的。但真实世界里，用户想接入的工具五花八门——查公司数据库、控浏览器、调内部 API、连第三方 SaaS——而且可能有**几百个**。这一篇解决两个问题：**如何开放地接入外部工具**，以及**几百个工具怎么不把 prompt 撑爆**。

## 一、背景：内置工具的两道墙

### 墙一：封闭

内置工具意味着，想加一个新工具，就得改 Agent 的源码、重新发布。用户没法接入**你没预见到的**工具。一个只能用内置工具的 Agent，能力边界被开发者一次性钉死了。

### 墙二：规模

就算能动态加工具，还有个规模问题：[每一轮请求都要把所有工具的 schema 发给模型](/manual/agent/llm-to-agent/prompt-caching)。十几个工具还好，可要是有**几百个**呢？

- **token 爆炸**：几百个工具的完整 schema，可能就是几万 token，每轮重发，又贵又占[窗口](/manual/agent/llm-to-agent/token-budget)。
- **模型犯晕**：面对几百个工具，模型的选择准确率会下降——太多相似的选项反而让它挑花眼、选错。

## 二、解决方案一：MCP —— 外部工具的标准协议

**MCP(Model Context Protocol)** 是给“外部工具”定的一套**标准协议**。它的核心思想：

> **把“工具的提供方”和“Agent”解耦。** 任何人都可以起一个 **MCP 服务器**，用标准协议暴露一组工具/资源；任何 Agent 都可以作为 **MCP 客户端**去连接它、动态发现它有哪些工具、并调用它们——双方事先互不需要了解。

```text [MCP:Agent 作为客户端,连接外部工具服务器]
┌─ Agent(MCP 客户端)─┐        ┌─ MCP 服务器(数据库)─┐
│  内置工具            │◀─协议─▶│  query_db, list_tables │
│  + 发现来的外部工具  │        └────────────────────────┘
│                     │        ┌─ MCP 服务器(浏览器)─┐
│                     │◀─协议─▶│  navigate, click, read │
└─────────────────────┘        └────────────────────────┘
```

Agent 启动时连上用户配置的若干 MCP 服务器（本地子进程走 `stdio` 传输，远端服务走标准化的 **Streamable HTTP** 传输与 OAuth 2.1 授权），**动态发现**它们的工具，把这些工具和内置工具一起，呈现给模型。用户想加能力，只需再连一个 MCP 服务器，**完全不用改 Agent**。

::: info

**MCP 能这么顺畅地融入，全靠[第 04 篇](/manual/agent/llm-to-agent/tool-abstraction)那个 `Tool` 抽象。** 一个 MCP 工具，和一个内置工具，在 Agent 眼里**长得一模一样**——都是“名字 + 描述 + JSON Schema + 一个 `call` 方法”。区别只在于：内置工具的 `call` 是本地函数，MCP 工具的 `call` 是“把参数按协议发给远端服务器、等结果回来”。**只要把外部工具包装成同一个 `Tool` 接口，[Agent Loop](/manual/agent/llm-to-agent/agent-loop)、[权限](/manual/agent/llm-to-agent/permissions)、[并发编排](/manual/agent/llm-to-agent/streaming-tool-execution)全都不用改，自动就能驱动它。** 这就是当初把工具设计成一个统一抽象的巨大回报——它让“接入任意外部工具”变成了“实现一个适配器”。

:::

用代码看，接入一个外部工具，就是把它的描述符适配成我们的 `Tool`：

```ts [任何外部工具 → 同一个 Tool 接口]
function externalToolToTool(spec: ExternalToolSpec, callRemote: CallFn): Tool {
  return {
    name: spec.name,
    description: spec.description,
    schema: jsonSchemaToZod(spec.inputSchema),
    isReadOnly: false, isConcurrencySafe: false, isDestructive: false, // 外部工具默认保守(fail-closed)
    run: async (input, ctx) => {
      const result = await callRemote(spec.name, input)   // ← 唯一的区别:call 走远端
      return { modelText: result.text }
    },
  }
}
```

包装完，它进入[工具注册表](/manual/agent/llm-to-agent/tool-abstraction)，和内置工具平起平坐。**MCP 本质上就是这个适配过程的标准化、协议化版本。**

## 三、解决方案二：延迟加载 + 工具搜索

解决了“接入”，再解决“几百个工具塞爆 prompt”。关键洞察是：

> **模型在某一轮里，通常只需要几百个工具中的几个。没必要把全部 schema 每轮都塞给它。**

于是有了**延迟加载(deferred tools)+ 工具搜索**的机制：

1. **初始只发工具的“名字 + 一句话简介”**，不发完整 schema。这一下就把几万 token 压到几千。
2. 提供一个**元工具** `search_tools`——模型需要某类能力时，用它按关键词搜索，系统才把**匹配到的那几个工具的完整 schema** 加载进上下文。
3. 模型拿到完整 schema 后，才真正调用它们。

```text [延迟加载:按需把工具 schema"取"进上下文]
初始 prompt:  [完整内置工具] + [几百个外部工具:仅名字+简介] + [search_tools 元工具]
模型:        search_tools("数据库 查询")
系统:        → 加载 query_db、list_tables 的完整 schema 进上下文
模型:        query_db({ sql: "..." })   ← 现在才有它的完整定义可用
```

::: info

这本质上是把[上下文当缓存、外部当内存的“按需换入”思想](/manual/agent/llm-to-agent/context-compaction)用到了**工具**上：工具定义不全量常驻上下文，而是**用到才加载**。它同时解决了 token 爆炸(只加载用到的)和模型犯晕(初始只看到简介、需要时才聚焦到具体几个)两个问题。代价是多一次“搜索”的往返，但换来的是“几百个工具”这个规模下的可用性。

:::

## 四、小结

这一篇让 Agent 的能力从“开发者钉死的内置集合”变成了“用户可无限扩展的开放生态”：

1. **MCP** 用标准协议解耦工具提供方与 Agent，让接入外部工具无需改 Agent。
2. 一切的基础，是[第 04 篇那个统一的 `Tool` 抽象](/manual/agent/llm-to-agent/tool-abstraction)——外部工具只是 `call` 走远端的普通工具。
3. **延迟加载 + 工具搜索**解决“几百个工具”的规模问题：按需把工具 schema 换入上下文。

我们的 Agent 现在几乎无所不能了。但它还缺最后一块，一块让它能“活得久”的东西：**持久化**。到目前为止，一切都在内存里——进程一关，整个会话灰飞烟灭。下一篇，也是本专栏的收官篇，[会话历史与持久化](/manual/agent/llm-to-agent/session-history)：如何把这一切落盘，支持关掉再回来接着干。

---

**本篇对应代码**：配套仓库加入 `src/tools/external.ts`，演示把一个外部工具描述符适配成统一的 `Tool` 并动态注册。`git checkout article-19`。
