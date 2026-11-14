---
title: "Tool"
description: "从 Bit 到 AGI · 第十二章 · 函数调用与 API 封装——让 LLM 触碰外部世界的接口层"
source: "https://daiw.org/manual/bit-to-agi/12-future/tool-use"
---

# Tool

> 从 Bit 到 AGI · 第十二章 · 函数调用与 API 封装——让 LLM 触碰外部世界的接口层

纯文本 LLM 无法查实时股价、无法改数据库、无法发邮件。**Tool Use**（函数调用）给模型一组带 schema 的 API：模型输出结构化 JSON，编排器执行并把结果塞回上下文。这是 Agent 的「手」——但手会抖：选错工具、填错参数、忽略错误码，都是 2026 年的常态。

## 直觉

REST API 文档写给程序员看：路径、方法、参数类型。Tool Use 把同一份契约**改写成模型能选的菜单**：

```
工具名: get_weather
参数: { "city": string, "date": "YYYY-MM-DD" }
```

模型不直接跑 HTTP；它只**生成调用意图**，你的 Python 代码真正执行——就像 SQL 里「预编译语句」：模型写绑定参数，驱动层执行，防注入（若实现正确）。

## 定义

**Function Calling / Tool Use** 流程：

1. 开发者注册工具列表（名称、description、JSON Schema 参数）
2. 模型在推理时可选输出 `tool_calls: [{name, arguments}]`
3. 宿主执行工具，返回字符串或 JSON
4. 模型基于 observation 继续生成或链式再调

OpenAI、Anthropic、Google 等格式略有差异，但语义一致。工具描述 token 占用**上下文预算**：

$$
\text{tools overhead} \approx \sum_{j=1}^{M} \text{tokens}(\text{schema}_j + \text{description}_j)
$$

$M = 50$ 个复杂 API 时，光 schema 就可能 **5K–20K token**，挤占用户内容。

## 例子

**例 1：OpenAI 风格工具定义**

```python
tools = [{
    "type": "function",
    "function": {
        "name": "run_sql",
        "description": "Run read-only SQL on analytics DB. Max 100 rows.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "SELECT only"}
            },
            "required": ["query"]
        }
    }
}]
```

**例 2：失败模式统计（工程经验量级）**

| 错误类型 | 相对频率 | 缓解 |
| -------- | -------- | ---- |
| 工具选择错误 | ~15–30%（工具数 >20） | 缩小可见集、路由子 Agent |
| 参数类型/名错误 | ~10–20% | JSON Schema 校验 + 重试 |
| 忽略「无结果」 | ~10% | 强制模板：必须引用 observation |
| 重复调用同一写操作 | ~5% | 幂等键、人工确认门 |

**例 3：与 MCP 的关系**

Tool Use 是**模型侧协议**；[MCP](/manual/llm/bit-to-agi/12-future/mcp-future) 是**工具宿主与数据源**的标准化布线。可以「MCP 服务 → 转成 OpenAI tools → LLM」。

## 量化

- **工具数量 vs 准确率**：Berkeley Function Calling Leaderboard 显示，单任务 1–5 工具时强模型准确率可达 **90%+**；**100+ 工具** 无检索路由时可能 **低于 60%**。
- **延迟**：工具执行时间 $t_{\text{tool}}$（API 100 ms–30 s）+ 模型二次推理 $t_{\text{llm}}$；串行 $n$ 次工具 → 至少 $\sum t_{\text{tool}} + n \cdot t_{\text{llm}}$。
- **安全边界**：`run_sql` 若未 sandbox，模型一次 `DROP` 幻觉即事故——**权限最小化**与**只读副本**是硬要求，不能指望对齐消除风险。
- **并行工具**：部分 API 支持单轮多个 `tool_calls`；独立只读请求可并行，写操作通常需串行与锁。

::: info

第七章 [RLHF](/manual/llm/bit-to-agi/07-training/what-is-rlhf) 教模型「何时该用工具、何时直接答」；SFT 数据里常含 synthetic tool trajectories。未训练过的工具形态，零样本表现会明显下降。

:::

## 常见误区

1. **「描述写长一点模型就懂」**——过长 description 浪费 token 且互相干扰；应用示例 + 边界条件各 1–2 句即可。
2. **「模型会自己处理 HTTP 错误」**——4xx/5xx 必须以 observation 明文返回；否则模型会编造成功结果。
3. **「Tool = 插件生态已成熟」**——互操作、版本、鉴权、审计在各厂商仍碎片化；MCP 试图统一，但未全覆盖。

## 动手试一试

实现带校验的重试 wrapper：

```python
import json

def call_tool(name, args: dict, registry, max_retries=2):
    fn = registry[name]
    schema = registry.schemas[name]
    for attempt in range(max_retries + 1):
        try:
            jsonschema.validate(args, schema)
            return fn(**args)
        except (jsonschema.ValidationError, TypeError) as e:
            if attempt == max_retries:
                raise
            # 把错误喂回模型，让它改 args（此处简化为 print）
            print(f"retry {attempt}: {e}")
```

用故意错误的 `city: 123` 测 weather 工具，观察重试是否收敛。

## 深入：工具路由（Tool Routing）

当注册表有 **50+** 工具时，全量注入 prompt 不经济。**Tool Router** 先用小模型或 embedding 对 user query 分类，只暴露 Top-5 候选：

```python
def select_tools(query: str, all_tools: list, k=5):
    scores = [embed_sim(query, t.description) for t in all_tools]
    idx = sorted(range(len(scores)), key=lambda i: -scores[i])[:k]
    return [all_tools[i] for i in idx]
```

路由错误 = 正确工具从未出现在菜单里 → **不可修复**。因此 router recall 应 **>95%** 才上线；宁可多暴露 2–3 个 tool 也不要漏关键 API。

## 流式工具与并行读

**Streaming**：模型边生成边输出 tool call delta，宿主可 prefetch——对慢 API（30 s 报告生成）减少 wall-clock。**Parallel read**：同一轮多个只读 `tool_calls`（查天气 + 查汇率）可 asyncio 并发；写操作必须串行或加锁。OpenAI 部分 API 已支持 parallel function calling；实际收益取决于最慢那个 tool 的 tail latency。

## 审计与回放

生产 Agent 应对每次 tool call 记录：`timestamp, name, args_hash, result_hash, user_id, trace_id`。 GDPR / 合规场景下 args 可能含 PII，日志需脱敏。Replay 调试时把 recorded observation 喂回模型，可复现 **80%+** 的轨迹偏差（模型 sampling 仍引入随机性）。

## 结构化输出 vs 自由文本

强类型 workflow 要求 tool args 严格 JSON；模型仍可能输出 trailing comma、NaN、或 string 代替 number。**Structured output** 模式（JSON mode、grammar sampling、constrained decoding）将语法错误率从 **~5%** 压到 **低于 0.5%**，代价是略降生成多样性。金融、医疗写操作应强制 structured path，不允许 regex 从 markdown 抠 JSON。

Tool 文档里的 **example args** 极影响模型表现：缺示例时 args 错误率可升 **2×**；示例过多又占 token。经验：每个 tool **1 个** canonical example + **1 个** edge case（空结果、分页）即可。与 API 文档写给人类工程师同理——good defaults 就是对齐的一种。

Idempotency key 对 Agent 尤为重要：模型可能 **重复** 调用 `charge_customer`——API 设计应像 Stripe 一样支持 `Idempotency-Key` header，把 LLM 的 stochastic 性隔离在业务层之外。

Tool 返回值建议 **结构化且带 status 字段**（`ok / empty / error`），比纯自然语言更利于模型在 [Agent 循环](/manual/llm/bit-to-agi/12-future/what-is-agent) 里做分支决策——又一项工程细节，不对齐训练集。

Timeout 与 partial result 必须写进 tool contract：API 30 s 无响应时返回 `{"status":"timeout"}` 而非 hang 住 Agent——否则整链卡在一步，用户只看到 spinner。

Rate limit 也应在 observation 里显式返回（`retry_after_ms`），让模型 **退避** 而非疯狂重试——否则 429 风暴会同时打爆 API 与 token 预算。

把 tool 设计当成 **面向 LLM 的 API**：人类开发者体验次要，**模型可读性**（清晰 enum、短 description、稳定字段名）才是核心优先级。

## 小结

Tool Use 让 LLM 通过**结构化调用**触达外部系统；schema、校验、权限与 observation 闭环是工程核心。工具越多、链越长，可靠性越差——需要路由与 MCP 等标准化层。

→ 下一篇：[MCP](/manual/llm/bit-to-agi/12-future/mcp-future)
