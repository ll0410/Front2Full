---
title: "上手：类型、调用与计价"
description: "照着官方文档走一遍 Jev 的调用：一次请求由材料和一组带类型的问题组成，返回每个选项的概率与置信度；涵盖 10 月新增的图像输入、Box 边界框原语与 262k 长上下文模式，再算清按输入 token 计费、输出免费的账与延迟。"
source: "https://daiw.org/manual/jev/using-jev"
---

# 上手：类型、调用与计价

> 照着官方文档走一遍 Jev 的调用：一次请求由材料和一组带类型的问题组成，返回每个选项的概率与置信度；涵盖 10 月新增的图像输入、Box 边界框原语与 262k 长上下文模式，再算清按输入 token 计费、输出免费的账与延迟。

调用聊天模型，像给同事发一封邮件：你写一段话，他回一段话，你再从回信里把要的信息“抠”出来。调用 Jev 更像递过去一张印好的问卷：材料附在后面，每道题的选项由你事先印好，他一个字也不写，只在每个选项旁边填上“有几成把握”。

前几篇讲了 Jev 为什么能这样工作（[System One](/manual/llm/jev/system-one)、[并行采样](/manual/llm/jev/parallel-sampler)、[RLCD](/manual/llm/jev/rlcd)）。这一篇只管动手：问卷怎么印、答卷怎么读、一张问卷多少钱。

::: warning

本篇的接口、价格与限额依据 2026-09-19 首发文档与 2026-10-14 `Jev 1.14` 更新日志整理。Jev 迭代较快，动手前请以[官方文档](https://docs.typesafe.ai/)的最新版为准。

:::

## 从哪里调用

TypeSafe 在 2026 年 9 月 15 日发布 Jev 时开放了早期访问，从候补名单（waitlist）里分批放行开发者 [1][2]。拿到资格后，在控制台 console.typesafe.ai 生成 API 密钥；网页版试验场 Playground 需要登录。文档站 docs.typesafe.ai 不需要登录，本篇引用的都是这部分公开内容 [3]。

另一条路是第三方网关。Vercel 在 9 月 16 日宣布 Jev 上线其 AI Gateway，模型 ID 写作 `typesafe-ai/jev`，通过 AI SDK 7 的实验性接口 `experimental_evaluate` 调用（7.0.105 起支持），其中是非题的类型名叫 `boolean` [4]。Vercel 模型页在首发期曾提供截至 9 月 25 日的限时免费促销，此后恢复按网关标准计费 [5]。

## 一次请求：材料加问题

所有 Jev 模型共用一个端点 `POST https://api.typesafe.ai/v1/systemone`，在 `Authorization` 头里以 `Bearer` 方式带上 API 密钥 [3][6]。JSON 请求体只有三个顶层字段 [6][7]：

- `state`：要判断的材料，可以是一段字符串，也可以是 JSON 对象或数组，比如把工单、订单和退款政策放进同一个对象。首发时只接受文本；自 2026 年 10 月 14 日起，`state`、`instructions` 和 `criteria` 中均可通过 `multipart/form-data` 的 `assets` 字段或 base64 数据（需配合请求头 `TypeSafe-Danger-Zone-Images: true`）嵌入 PNG 与 JPEG 图像（官方建议尺寸在 280 至 1568 像素之间），音频与视频仍需先在代码里转成文字 [7][24]。
- `model`：用哪个模型，文档示例一律写别名 `jev-latest`（自 10 月 14 日起指向 `jev-1.14.0`）。
- `questions`：一张问题表，键名由你起，答案按同样的键名返回。键名只给你的代码看，不会发给模型，所以问题的完整意思要写进 `instructions` [8]。

下面是官方快速上手（Quick start）页里的请求体，原样摘录 [3]：

```json
{
  "state": "Hi, I've been trying to connect my Stripe account for 3 days and it keeps failing. I'm losing sales. Please help ASAP.",
  "model": "jev-latest",
  "questions": {
    "department": {
      "type": "choice",
      "instructions": "Which team should handle this",
      "criteria": {
        "billing": "Payment or subscription issues",
        "technical": "Bugs or integration problems",
        "sales": "Pricing or account questions"
      }
    },
    "frustration": {
      "type": "score",
      "instructions": "How frustrated the customer appears",
      "criteria": [
        "Calm, just stating facts",
        "Frustrated but civil",
        "Very angry, strong language"
      ]
    },
    "is_urgent": {
      "type": "noul",
      "instructions": "The message conveys urgency or time-sensitivity"
    }
  }
}
```

上面三个问题展示了 Jev 首发时的三种基础题型；2026 年 10 月 14 日发布的 `jev-1.14.0` 又新增了专门针对图像的第四种题型 `Box`，共同构成它的“类型系统”[8][9][10][24]：

| 题型 | 适合回答 | `criteria` 的写法 | 答案字段 |
| --- | --- | --- | --- |
| Choice（选择题） | 从一组没有先后的选项里挑一个，如分给哪个部门 | 选项名到选项说明的映射，说明可以是 `null`；最多 255 个选项 | `choice`、`probabilities`、`confidence` |
| Score（打分题） | 在一条有序刻度上定位，如严重程度、情绪强度 | 从低到高逐级描述的数组，2 到 10 级 | `score`、`legend`、`probabilities`、`confidence` |
| Noul（是非题） | 一个是或否的判断，如是否紧急 | 可选，分别说明 `true` 和 `false` 指什么 | `noul`，即“是”的概率 |
| Box（边界框题，`jev-1.14.0`） | 在图像里定位某个目标的位置（如按钮、缺陷区域） | 不需要 `criteria`，在 `instructions` 中描述要框出的目标（需开启图像请求头） | `box`（含 0 到 1 归一化的 `top`、`bottom`、`left`、`right`）与 `confidence` |

文档给的几条出题建议 [8][11]：

- 一题只问一件事，问“懂行的人拿到材料、几秒钟就能拿主意”的问题；要权衡多个因素的判断，拆成几题，再在代码里加权合成。
- 选项可能覆盖不全时，加一个 `other` 或“以上都不是”。
- 题目和选项说明也可以写成 JSON 对象，比如分别写“包括什么”“不包括什么”和几个例子，用来划清相邻选项的边界。
- 想让某题只看材料的一部分，就在题目里用路径点名，如 `ticket.messages[0].text`，路径两侧的反引号也要写进题目。

## 返回：概率、分数与置信度

同一个例子的响应，原样摘录 [3]：

```json
{
  "model": "jev-latest",
  "answers": {
    "department": {
      "type": "choice",
      "choice": "billing",
      "probabilities": {
        "billing": 0.84,
        "technical": 0.159,
        "sales": 0.001
      },
      "confidence": 0.596
    },
    "frustration": {
      "type": "score",
      "score": 1.035,
      "legend": {
        "0": "Calm, just stating facts",
        "1": "Frustrated but civil",
        "2": "Very angry, strong language"
      },
      "confidence": 0.842
    },
    "is_urgent": {
      "type": "noul",
      "noul": 0.999
    }
  },
  "usage": {
    "input_tokens": 312,
    "output_tokens": 48
  }
}
```

逐个看：

- Choice 的 `probabilities` 是全部选项上的概率分布，加起来为 1，`choice` 就是其中最大的那个。这张工单既像付款问题、又像集成故障，所以 `billing` 拿到 0.84，`technical` 也有 0.159。
- Noul 只有一个数：“是”的概率。0.5 的意思是“是”与“否”各半，而不是“程度中等”；Noul 也不单独给置信度 [10]。
- `usage` 报告本次的 token 数。响应里也有 `output_tokens`，但按文档只有输入 token 计费（见下文）。

Score 的 `score` 是刻度上的一个位置，可以落在两级之间，算法是各级编号按概率加权平均 [9]：

$$
s = \sum_{k} k \cdot p_k
$$

$k$ 是级别编号（从 0 起），$p_k$ 是落在第 $k$ 级的概率。Score 页的例子里三级概率分别是 0、0.7、0.3，于是 $s = 1 \times 0.7 + 2 \times 0.3 = 1.3$。上面的 1.035 则基本落在“沮丧但还算客气”这一级。不同的分布可能算出同一个分数：全押在 1 级，和 0 级、2 级各占一半，得分都是 1.0，所以要连同 `probabilities` 一起看。快速上手示例里的 Score 答案省略了 `probabilities`，API 参考和 Score 页的示例里都带着 [6][9]。

### confidence 从哪来

`confidence` 出现在 Choice、Score 和 Box 的答案里，是从概率分布的形状算出的一个 0 到 1 之间的统计量：分布越集中越高，越平越低 [12][24]。上例里它是 0.596，并不等于最大的那个概率 0.84，因为它衡量的是整个分布，而不只是第一名。

v1 的具体算法文档没有公开，只说你随时可以用返回的 `probabilities` 自己算别的指标 [12]。迁移指南倒是给出了预览版的公式，即 1 减去归一化的香农熵 [13]：

$$
c = 1 - \frac{H(p)}{\ln n}, \qquad H(p) = -\sum_{i=1}^{n} p_i \ln p_i
$$

白话：$n$ 个选项平分概率时熵最大，$c = 0$；全部押在一个选项上时熵为 0，$c = 1$。v1 换了算法，指南特意提醒：依赖旧 confidence 的逻辑要重新评估。

还要记住文档反复强调的一点：confidence 为 1.0 只说明模型把概率全押在一个选项上，**不保证答案正确** [9]。“校准”说的是一大批预测放在一起时，标七成把握的大约七成对，而不是对某一条答案的担保，详见 [RLCD 那一篇](/manual/llm/jev/rlcd)。

## 用 SDK 调用

官方有 Python 和 JavaScript/TypeScript 两个 SDK [14][15]：

- Python：`pip install typesafe-sdk`（或带 HTTP/2 支持的 `pip install "typesafe-sdk[http2]"`），要求 Python 3.10 及以上。客户端默认从环境变量 `TYPESAFE_API_KEY` 读密钥，默认模型 `jev-latest`，单次 HTTP 操作默认超时 10 秒；遇到限流（429）或过载（529），SDK 按默认策略退避重试 [6][14]。
- JavaScript：`npm install @typesafe-ai/sdk`，要求 Node.js 20 及以上；方法名是 `client.systemOne(...)`，答案的类型会从你写的问题里自动推断 [15]。

Python SDK 参考页里的同步客户端示例，原样摘录 [14]：

```python
from typesafe_sdk import Choice, Noul, TypeSafeClient

with TypeSafeClient() as client:
    result = client.system_one(
        state="I was charged twice. Please help.",
        questions={
            "billing": Noul(instructions="Is this about billing?"),
            "tone": Choice(
                instructions="What is the tone?",
                criteria={"calm": None, "angry": None},
            ),
        },
    )
    assert 0 <= result.nouls["billing"].noul <= 1
    assert result.choices["tone"].choice in {"calm", "angry"}
```

`result.nouls`、`result.choices`、`result.scores`、`result.boxes` 是按题型分好组的视图，也可以统一用 `result.answers[...]` 取；0.7.0 起还能用 `response_model` 参数传入自己的 pydantic 模型来描述响应。两个 SDK 迭代很快：Python 版 9 月 14 日首发，9 月 15 日的 0.6.0 把 Score 的 `criteria` 从“整数键的字典”改成有序列表，9 月 18 日的 0.7.0 把序列化库从 msgspec 换成 pydantic，10 月 14 日的 0.7.5 新增了 `Image` 资产、`Box` 题型、请求体默认 `zstd` 压缩与 `attach_assets` 辅助函数 [14]；JavaScript 版 9 月 11 日首发，后续同步支持了新特性 [15]。

另有两个入口：TypeSafe 给编程 Agent 准备了技能包，在 Claude Code 里用 `claude plugin marketplace add typesafe-ai/skills` 和 `claude plugin install typesafe@typesafe-ai` 两条命令安装（插件机制见本站 [Claude Code · Plugins](https://daiw.org/manual/claude-code/plugins)）[16]；LangChain 发布了 `langchain-typesafe` 集成，[下一篇](/manual/llm/jev/applications)会讲到 [17]。

::: info

抄示例前先对照官方文档。已有二手教程的代码用了 v1 里没有的写法，例如 DataCamp 一文用 `options` 列表定义 Choice、用 `min` 和 `max` 定义 Score [18]；按 v1 文档，两者都该写 `criteria`，其中 Score 的 `criteria` 是逐级描述的数组。

:::

## 计价与限额

价格写在文档的 Models 页和发布博客里。自 2026 年 10 月 14 日起，Models 页提供 `jev-1.14.0`（当前默认）与 `jev-1.13.0` 两个版本，定价相同 [19][24]：

| 项目 | `Jev 1.14`（`jev-1.14.0`） / `Jev 1.13`（`jev-1.13.0`） |
| --- | --- |
| 价格 | 每十亿输入 token 42 美元，即每百万 0.042 美元；输出 token 免费 |
| 速率上限 | 每秒 25 万 token、每分钟 1,200 次请求；官方注明正随需求动态调整，可能不经通知变化 |
| 上下文 | 默认每次请求 64k token、单题（`state` 加最长的一道题）32k token；加请求头 `TypeSafe-Danger-Zone-Long-Context: true` 可双双扩至 **262k token** |
| 输入 | 文本（字符串、JSON 对象或数组）及 PNG / JPEG 图像（`Box` 题型仅 `jev-1.14.0` 支持） |
| 语言 | 英语是主要训练语言；`jev-1.14.0` 提升了非英语语言准确率，但官方仍提示低于英语 |

按标价算一笔账（本文计算）：一次请求 500 个输入 token，费用是 500 × 0.042 ÷ 1,000,000 = 0.000021 美元；一百万次这样的请求约 21 美元。

这种计价方式有个直接推论：**材料占大头，问题几乎不花钱**。官方的“并行提问”示例拿约 5.4 万字符的 GDPR 维基百科条目问 13 个问题：一次请求问完，平均 0.000497 美元、0.27 秒；拆成 13 次单独请求，条目要重复发送 13 遍，共 0.006090 美元，依次调用共 2.71 秒，贵 12.2 倍、慢 10 倍，而答案没有变化（官方口径，示例用的是早期版 `jev-1.12`）[20]。所以文档建议，同一份材料能问的问题一次问完，连“可能用不上”的也一起问。

两点提醒：

- 有独立测试者报告，同一段英文 Jev 计的输入 token 约为 GPT-5.6 Terra 的两倍（340 对 162）[21]。比较成本时要算每次调用实际花多少，别只比单价。
- 更高的限额需要找销售谈定制或企业方案，企业客户还可申请零数据保留（ZDR）。Jev 不在客户请求上训练，也不会用客户数据做微调或 LoRA 适配，所有账户共用一套权重，定制只能靠 `state`、题目和选项说明 [19]。

## 延迟：几个官方数字

官方在不同地方给的数字并不一致：发布博客说端到端 70–500 毫秒，在 System One 形状的问题上、同等智能水平下比前沿 LLM 快 40–200 倍 [1]；文档说大多数请求约 100 毫秒 [22]；用例页写“实时速度（150ms）”[23]；新闻稿说低于 100 毫秒 [2]。博客也交代了测量条件：公开评测大多是在美国西海岸的笔记本上跑的，服务目前也部署在那里 [1]。从中国大陆调用，还要加上跨太平洋的网络往返。社区几份独立实测的结果放在[局限与展望](/manual/llm/jev/limits-outlook)里。

还有一点和使用 LLM 的直觉相反：同一请求里的题目是并行、彼此独立地判断的，**加题几乎不增加响应时间**，题目之间也不会互相干扰 [11]。

## 版本、别名与那次改版

- `jev-latest` 指向最新的正式版，是 SDK 的默认值；`jev-preview` 指向最新版（不论是否正式）。自 2026 年 10 月 14 日起，两者都指向 `jev-1.14.0`（此前指向 `jev-1.13.0`）[19][24]。
- 别名会随新版本移动，同样的请求可能得到不同答案。文档说响应的 `model` 字段会报告实际作答的版本；如果按某个版本调好了置信度阈值，应当显式锁定版本号（如 `"jev-1.14.0"` 或 `"jev-1.13.0"`），按自己的节奏迁移 [19]。
- 发布前后接口改过一次：预览版端点 `/preview/evaluation` 换成了 `/v1/systemone`，`document` 和 `prompts` 数组改成了 `state` 和 `questions` 表，答案字段 `probability`、`chosen`、`expectation` 分别改名为 `noul`、`choice`、`score`，置信度的算法也换了 [13]。网上较早的示例若还是旧写法，原因就在这里。

会发请求、会读答卷之后，下一篇看大家实际拿它做了什么。👉 [应用：从分类路由到玩 Doom](/manual/llm/jev/applications)

## 参考文献

- [1] TypeSafe AI（Diogo Almeida）. “Introducing System One Models & Jev.” 2026-09-15. [typesafe.ai/blog](https://typesafe.ai/blog/introducing-system-one-models-and-jev) —— 早期访问与候补名单、70–500 毫秒延迟及测量条件、价格对照表。
- [2] TypeSafe AI 新闻稿（Business Wire，经 Yahoo Finance 转载）. “TypeSafe AI Emerges From Stealth With \$40M in Funding With New Model for Composable AI.” 2026-09-15. [finance.yahoo.com](https://finance.yahoo.com/technology/ai/articles/typesafe-ai-emerges-stealth-40m-190000776.html) —— 早期访问需排队、“低于 100 毫秒”的说法。
- [3] TypeSafe 文档. “Quick start.” [docs.typesafe.ai](https://docs.typesafe.ai/introduction/quickstart) —— 端点、Playground 与 API 密钥入口、请求体与响应示例（原样摘录）。
- [4] Vercel（Rohan Taneja 等）. “TypeSafe AI's Jev now available on AI Gateway.” 2026-09-16. [vercel.com/changelog](https://vercel.com/changelog/typesafe-ai-jev-now-available-on-ai-gateway) —— 模型 ID、AI SDK 7 的 `experimental_evaluate` 接口与版本要求。
- [5] Vercel AI Gateway. “Jev” 模型页. [vercel.com/ai-gateway/models/jev](https://vercel.com/ai-gateway/models/jev) —— 首周免费促销（9 月 25 日截止）与网关模型信息。
- [6] TypeSafe 文档. “API reference.” [docs.typesafe.ai/api](https://docs.typesafe.ai/api) —— 请求与响应字段、Score 答案的 `probabilities`、错误码与退避重试。
- [7] TypeSafe 文档. “State.” [docs.typesafe.ai/concepts/state](https://docs.typesafe.ai/concepts/state) —— `state` 的组织形式与资产引用。
- [8] TypeSafe 文档. “Primitives (Questions).” [docs.typesafe.ai/primitives](https://docs.typesafe.ai/primitives) —— 四种题型、键名不发给模型、出题建议、路径引用写法。
- [9] TypeSafe 文档. “Choice”“Score.” [docs.typesafe.ai/primitives/choice](https://docs.typesafe.ai/primitives/choice)、[docs.typesafe.ai/primitives/score](https://docs.typesafe.ai/primitives/score) —— 255 个选项与 2 到 10 级的上限、加权平均算法与 1.3 的例子、置信度 1.0 不保证正确。
- [10] TypeSafe 文档. “Noul.” [docs.typesafe.ai/primitives/noul](https://docs.typesafe.ai/primitives/noul) —— 是非题的含义、0.5 的解读、不单独给置信度。
- [11] TypeSafe 文档. “Introduction”“Advanced: structure.” [docs.typesafe.ai/introduction](https://docs.typesafe.ai/introduction)、[docs.typesafe.ai/primitives/advanced](https://docs.typesafe.ai/primitives/advanced) —— “几秒钟的判断”、拆题加权、用 JSON 对象写题目与选项说明；题目并行、独立判断，加题几乎不增加响应时间。
- [12] TypeSafe 文档. “Confidence.” [docs.typesafe.ai/confidence](https://docs.typesafe.ai/confidence) —— confidence 由概率分布算出、可自行替换指标。
- [13] TypeSafe 文档. “Migrating to the v1 API.” [docs.typesafe.ai/migrating-to-v1](https://docs.typesafe.ai/migrating-to-v1) —— 预览版到 v1 的全部字段变化、预览版置信度公式。
- [14] TypeSafe 文档. Python SDK（快速上手、Sync client、Constants、Changelog 各页）. [docs.typesafe.ai/sdk/python](https://docs.typesafe.ai/sdk/python) —— 安装与默认值、同步客户端示例（原样摘录）、0.5.7 至 0.7.5 版本变更记录。
- [15] TypeSafe 文档. JavaScript SDK 及其 Changelog. [docs.typesafe.ai/sdk/javascript](https://docs.typesafe.ai/sdk/javascript) —— 安装要求、`systemOne` 方法、类型推断、版本记录。
- [16] TypeSafe 文档. “Agent skill.” [docs.typesafe.ai/agent-skill](https://docs.typesafe.ai/agent-skill) —— Claude Code 插件安装命令。
- [17] Sydney Runkle, Hunter Lovell（LangChain）. “Building a Harness with Jev.” 2026-09-17. [langchain.com/blog](https://www.langchain.com/blog/building-a-harness-with-jev) —— `langchain-typesafe` 集成。
- [18] Matt Crabtree（DataCamp）. “Jev: TypeSafe's System One Model That Never Hallucinates.” 2026-09-16. [datacamp.com/blog](https://www.datacamp.com/blog/system-one-models-jev) —— 二手教程，其示例代码与官方 v1 文档不符。
- [19] TypeSafe 文档. “Models.” [docs.typesafe.ai/models](https://docs.typesafe.ai/models) —— `jev-1.14.0` 与 `jev-1.13.0` 的价格、速率上限、上下文、语言支持、别名与版本锁定、数据与定制政策。
- [20] TypeSafe 文档. “Parallel questions”（cookbook）. [docs.typesafe.ai/cookbooks/parallel_questions](https://docs.typesafe.ai/cookbooks/parallel_questions) —— 13 题合并与拆分的成本、耗时对比（官方口径）。
- [21] 4esv. “jev-eval” 仓库 README. 2026-09-17. [github.com/4esv/jev-eval](https://github.com/4esv/jev-eval) —— 作者报告：同一段文字的输入 token 计数约为 Terra 的两倍。
- [22] TypeSafe 文档. “How to build with TypeSafe.” [docs.typesafe.ai/concepts/how-to-build-with-system-one](https://docs.typesafe.ai/concepts/how-to-build-with-system-one) —— “大多数请求约 100 毫秒”。
- [23] TypeSafe 文档. “Example use cases.” [docs.typesafe.ai/concepts/use-case-map](https://docs.typesafe.ai/concepts/use-case-map) —— “实时速度（150ms）”。
- [24] TypeSafe 文档. “Changelog”“Box”“Images.” 2026-10-14. [changelog](https://docs.typesafe.ai/changelog)、[box](https://docs.typesafe.ai/primitives/box)、[images](https://docs.typesafe.ai/images) —— `Jev 1.14`、`Box` 原语、PNG/JPEG 图像支持与 262k 长上下文请求头。
