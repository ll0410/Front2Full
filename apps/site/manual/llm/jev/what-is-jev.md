---
title: "Jev 是什么：一个不说话的模型"
description: "TypeSafe AI 的 Jev 不写一个字，只回答“选哪个、打几分、是不是、框在哪”。本篇讲公司与团队、发布与迭代时间线、名字由来，以及它想解决的问题。"
source: "https://daiw.org/manual/jev/what-is-jev"
---

# Jev 是什么：一个不说话的模型

> TypeSafe AI 的 Jev 不写一个字，只回答“选哪个、打几分、是不是、框在哪”。本篇讲公司与团队、发布与迭代时间线、名字由来，以及它想解决的问题。

想象你在写一个客服系统。每来一封邮件，程序都要做几个判断：这是不是退款请求？该转给哪个部门？客户有多生气？把邮件丢给聊天模型，它会回你一段彬彬有礼的文字——可你的代码要的不是一段话，而是一个 `true`、一个部门名、一个分数。于是你还得再写代码去“读”模型的回答，提防它多说一句、换个格式，或者编出一个根本不存在的部门。

2026 年 9 月 15 日，旧金山的创业公司 TypeSafe AI 发布了 Jev，想从根上换一种做法：**Jev 不生成文字**。你给它一段材料和几道“选择题”，它直接交回每道题的答案，外加每个选项的概率。官方的说法是，把 Jev 当成一次“前沿智能的函数调用”：进去的是非结构化的状态，出来的是带类型、带概率的决定 [1]。

这就是标题里“不说话的模型”的意思。本篇先交代背景：它长什么样、谁做的、什么时候发布、为什么叫这个名字、想解决什么问题。原理留给后面三篇。

## 先看一眼：输入和输出

公司名里的“TypeSafe”来自编程里的“类型安全”（type safety）：程序只接收预期类型的数据，避免“拿整数去除以一个字符串”这类错误 [2]。Jev 把这个理念用在了 AI 的输出上。

TypeSafe 把能问 Jev 的问题分成四种原语（primitive，即最基本的积木；前三种随 9 月首发推出，第四种 `Box` 于 10 月 14 日随 `jev-1.14.0` 推出）[3][26]：

| 问题类型 | 问的是 | 返回什么 |
| --- | --- | --- |
| Choice（选择） | 从你列出的选项里挑一个 | 选中项、每个选项的概率、置信度 |
| Score（打分） | 落在你描述的哪一档 | 分数、每一档的概率、置信度 |
| Noul（是非） | 这个说法成立吗 | 成立的概率，0 到 1 |
| Box（边界框） | 目标在图像里的什么位置（需 `jev-1.14.0`） | 归一化坐标（`top`、`bottom`、`left`、`right`，0 到 1）与置信度 |

官方文档里有个例子 [4]：状态（state，即要判断的材料）是一句客诉“跑鞋到货尺码不对，能换成 10 码吗？”，问题是“该由哪个团队处理”，选项是退换货（returns）、物流（shipping）、账单（billing）。Jev 的回答是：

```json
{
  "model": "jev-latest",
  "answers": {
    "department": {
      "type": "choice",
      "choice": "returns",
      "confidence": 1.0,
      "probabilities": {
        "shipping": 0.0,
        "returns": 1.0,
        "billing": 0.0
      }
    }
  },
  "usage": {
    "input_tokens": 330,
    "output_tokens": 34
  }
}
```

没有寒暄，也没有需要解析的自由文本。选项是你事先定义的，所以 Jev 不可能回一个“售后部”之类清单外的部门——这是官方“不会幻觉”说法的来源，它的含义与边界放在[第 3 篇](/manual/llm/jev/parallel-sampler)细讲；怎么调用、怎么计价见[第 5 篇](/manual/llm/jev/using-jev)。

## 谁做的：TypeSafe AI 与三位创始人

TypeSafe AI 于 2024 年成立，总部在旧金山 [5]。2026 年 9 月 15 日，公司宣布结束“隐身”（stealth，指创业公司正式亮相前不对外公开），同时披露了 4000 万美元种子轮融资，由风险投资机构 DCVC 领投 [5]。官网团队页说，成员来自 OpenAI、Google Brain、Meta/FAIR、Stripe 等公司，每周五天在旧金山的办公室上班 [6]。

三位联合创始人（履历均据官网团队页 [6]）：

- **Diogo Almeida，CEO**：官网称他“共同发明了 RLHF 和 InstructGPT”，此前在 Google Brain 工作。
- **Erik Gafni，CTO**：连续创业者，做过面向 DNA 测序的多模态 AI 公司 Ravel，也是 Invitae、Freenome 两家独角兽公司的早期员工。
- **Sasha Sheng，COO**：前 Meta/FAIR 研究工程师，在 NeurIPS、ECCV 上发表过论文。

Almeida 在发布博客里的自述是：他在 OpenAI 帮助打造了让语言模型学会听指令、学会和人对话的方法，这些工作后来成了 ChatGPT 背后的研究 [1]。

::: info

**RLHF 共同发明人这个说法怎么读**：RLHF（Reinforcement Learning from Human Feedback，基于人类反馈的强化学习）是让模型按人类偏好调整行为的训练方法，站内有[入门介绍](https://daiw.org/manual/bit-to-agi/07-training/what-is-rlhf)。按论文作者列表核对：

- 常被视为 RLHF 奠基之作的 Christiano 等人 2017 年论文《Deep reinforcement learning from human preferences》共 6 位作者，其中没有 Almeida [7]。
- 把 RLHF 用到 GPT-3 上、让模型学会听指令的 InstructGPT 论文（Ouyang 等，2022）共 20 位作者，Almeida 排第 4 [8]。
- OpenAI 在 2022 年 11 月 30 日发布 ChatGPT 的博文里写明，ChatGPT 用的是与 InstructGPT 相同的 RLHF 方法，但文末的贡献者名单里没有他 [9]；GPT-4 技术报告的作者名单里有他 [10]。

所以能核实的是：他是 InstructGPT 论文的作者之一。“RLHF 共同发明人”“ChatGPT 共同创造者”是公司和媒体的概括 [2][6][11]。

:::

## 时间线

| 日期 | 事件 | 来源 |
| --- | --- | --- |
| 2024 年 | TypeSafe AI 成立；据 TechCrunch，Almeida 约两年前离开 OpenAI 创业；发布博客称此前“隐身”了两年 | [1][5][11] |
| 2026-06-19 | 官方博客发布视频《AI: too good to be true, too bad to be useful》，主题是 RLHF 训练的模型擅长取悦人、却不擅长做可靠的自主决策 | [12][13] |
| 2026-09-10 | 官方博客《The Bitterest Lesson》：做对任务，比数据、算力、算法都重要 | [14] |
| 2026-09-11 | JavaScript SDK 首个公开版本 v0.5.7 | [15] |
| 2026-09-14 | Python SDK 首个公开版本 v0.5.7 | [15] |
| 2026-09-15 | 发布博客《Introducing System One Models & Jev》与融资新闻稿；Jev（`jev-1.13.0`）开放早期访问 | [1][5] |
| 2026-09-16 | The Register 报道，配图是 Jev 在玩《毁灭战士》（Doom） | [2] |
| 2026-09-18 | TechCrunch 报道；Python SDK 升到 v0.7.0 | [11][15] |
| 2026-10-14 | 发布 `Jev 1.14`（`jev-1.14.0`）：支持 PNG/JPEG 图像输入（“Dreamer-ready”）、新增 `Box` 边界框原语、开放 262k 长上下文请求头并提升多语言准确率；Python SDK 更新至 v0.7.5 | [15][16][26] |

## 现状：从首发版到 Jev 1.14

截至 2026 年 11 月初复核，能从官方渠道确认的情况如下：

- **访问方式**：发布当天开放 early access，从候补名单（waitlist）里分批放开发者进来 [1][5]。
- **版本**：当前正式版本是 2026 年 10 月 14 日发布的 `jev-1.14.0`，别名 `jev-latest` 与预览别名 `jev-preview` 均指向它；首发版本 `jev-1.13.0` 仍可显式指定调用 [16][26]。部分早期 cookbook 示例曾用更早的 `jev-1.12` [17]。
- **输入与上下文限制**：除文本（字符串、JSON 对象或文本数组）外，自 10 月 14 日起 `jev-1.14.0` 与 `jev-1.13.0` 均支持传入 PNG 与 JPEG 图像（通过 multipart `assets` 或附带请求头 `TypeSafe-Danger-Zone-Images: true` 的 base64 字符串），仍不收音频和视频；默认单次请求最多 64k token、单道题（`state` 加最长的一道题）不超过 32k token，附带请求头 `TypeSafe-Danger-Zone-Long-Context: true` 时两者均可扩至 **262k token**；英语是主要训练语言，`jev-1.14.0` 改善了非英语语言（包括中日韩文字）的准确率，但官方仍提示非英语准确率低于英语 [16][26]。
- **不做定制**：不用客户数据微调，所有账户共用同一套权重；也不拿客户的请求和回答来训练 [16]。
- **价格**：只按输入 token 收费，每十亿 token 42 美元（合每百万 0.042 美元），输出 token 免费，`jev-1.14.0` 与 `jev-1.13.0` 同价 [16]。官网 FAQ 说按现价供应 Jev 是盈利的 [13]；发布博客则坦言，他们无法证明这个价格没有补贴，需要时间来证明 [1]。
- **需求与速率**：文档给出的默认速率上限是每秒 25 万 token、每分钟 1200 次请求，并说明上限会随算力与需求动态调整 [16]；TechCrunch 报道，首发当周公司曾因需求太大一度无法通过 API 服务用户 [11]。
- **渠道**：除了官方 API 与 Python、JavaScript SDK，Vercel 的 AI Gateway 也已上架，模型名是 `typesafe-ai/jev` [18]。

## 名字的由来：一位 19 世纪的煤炭经济学家

“System One”这半个名字来自心理学家卡尼曼，留到下一篇。“Jev”取自英国经济学家威廉·斯坦利·杰文斯（William Stanley Jevons，1835—1882）[1][19]。他生于利物浦，是 1871 年前后各自提出边际效用理论的三位经济学家之一，另两位是瓦尔拉斯和门格尔 [19]。

让他和 AI 扯上关系的，是他 1865 年出版的《煤炭问题》（The Coal Question）[20]。当时英国担心煤会用尽，流行一种乐观看法：机器越来越省煤，用煤总量自然会降下来。杰文斯在第七章《论燃料的节约》里反驳：以为节约用燃料就等于减少消耗，完全是概念混淆，事实恰恰相反 [20]。他用炼铁高炉举例：每座高炉用煤少了，炼铁更赚钱，吸引新资本进场，铁价下跌、需求上升，最后新增的高炉数量足以抵消每座高炉省下的煤 [20]。后人把这种“效率提高反而让总消耗上升”的现象称为杰文斯悖论（Jevons paradox）。

TypeSafe 的押注就是把这个故事搬到智能上。发布博客的 FAQ 说，他们预计机器智能会走煤炭的老路：智能的成本每降一个数量级，就会解锁多出几个数量级的用例 [1]。文档也写明，公司的目标是把“智能相对于速度与成本”的比值做到 100 倍以上，背后的赌注是更便宜的智能会创造多得多的需求 [21]。

两条冷静的提醒：

- 杰文斯悖论本身在经济学界仍有争议。Sorrell 2009 年的综述认为，这一命题极难实证检验，支持它的证据远非定论，不过证据确实显示，整个经济范围内的“回弹效应”比常规假设更大 [22]。
- The Register 指出，这个赌注假设 token 的市场能像能源市场一样宽广，而这一点并未确定——不少能用上 AI 工具的人其实用不到它，或者出于道德顾虑刻意回避 [2]。

## 它想解决什么问题

Almeida 在发布博客开头抛出一个问题：模型在聊天上超越人类已经好几年了，自动化在哪里？他说这是自己过去四年一直在追问的问题 [1]。官方的诊断大致有三层。

**第一，瓶颈不在“够不够聪明”，而在“能不能搭东西”上**。公司宣言（Manifesto）认为，今天的模型早已跨过创造巨大经济价值所需的智能门槛，可大多数软件依然谈不上智能，因为这种智能很难被当成积木来用 [23]。宣言拿“无马马车”作比：早期汽车只是把马换成发动机，连高座椅、马车弹簧，甚至插马鞭的座子都保留着；今天的 AI 也被训练成一位礼貌健谈的助手，默认对面坐着一个人 [23]。

**第二，训练目标决定了模型的形状**。RLHF 直接优化人类偏好，推理模型又用 RLVR（Reinforcement Learning with Verifiable Rewards，用可验证奖励做强化学习）去优化能被程序判分的任务 [23]。官网首页认为，RLHF 会带来模式丢失、过度自信、不够可靠等固有问题，所以 LLM 离不开人在环路里（human-in-the-loop）盯着 [13]。

**第三，字符串不是软件的好接口**。LLM 输出字符串，代码得先解析、再校验，还要提防模型“跑偏”；官方举例说，智能体里出现一次“幻觉出来的工具调用”只是麻烦，但如果它埋在有延迟要求的系统里、或者依赖链的好几层之下，就是致命问题 [1]。

TypeSafe 给出的方向，是把智能做成像数据库查询一样可靠、可调用的底层能力：代码负责精确计算和流程控制，模型只负责语义判断，也就是官方戏称的“聪明的 if 语句”（smart if-statements）[23]。官方 AI 入门文档还给了一个判断：大规模自动化里约 99% 会是机器与机器的交互，人机交互只占 1% [24]。宣言还给“AI 带来的经济革命”挑了一个他们最喜欢的定义：全球全要素生产率（TFP）增速在五年内达到 3%，并维持十年 [23]。

## 官方数字一览

发布材料里有几组“更快、更便宜、零幻觉”的数字。它们都是**官方口径，待独立验证**，前提条件也各不相同：

| 官方说法 | 出处 | 前提（多数是官方自己交代的） |
| --- | --- | --- |
| 端到端 70–500 毫秒，比前沿 LLM 快 40–200 倍 | 发布博客 [1] | 只针对“System One 形状”的查询，且在同等智能水平下比较 |
| 快 193.6 倍、便宜 444.6 倍 | 官网首页 [13] | 来自官方公布的 4 个工作流评测；发布博客说这属于真实收益的偏高端 [1] |
| 延迟不到 100 毫秒，最多快 100 倍、便宜 100 倍 | 融资新闻稿 [5] | 新闻稿未说明测法 |
| 输入单价比 Claude Fable 5.1 低 238 倍 | 官网首页 [13] | 只比输入单价；Jev 的输出免费 |
| 零幻觉、零类型错误 | 官网首页、发布博客 [1][13] | 答案只能落在你预先定义的选项里；不保证选对 |

速度数字怎么读、“零幻觉”的边界在哪，见[第 3 篇](/manual/llm/jev/parallel-sampler)；这些概率可不可信，见[第 4 篇](/manual/llm/jev/rlcd)。

::: warning

**Jev 公开的技术细节很少，而且大多来自公司自己**。

- **没有论文，也没有公开基准成绩**：官方明确表示刻意不公布公开基准上的表现，只发布自己设计的工作流评测 [1]。
- **架构、参数量、训练数据细节都没有公开**：TechCrunch 说 Almeida 对架构守口如瓶 [11]；发布博客 FAQ 对训练数据的回答是“数据全是我们自己做的”，想了解更多“得先被我们雇用”[1]。
- **二手报道有不少错误**：例如有文章把创始人的名字 Diogo 写成了 Diego [25]。本专栏以官网、官方博客和文档为准，媒体报道一律注明出处。

:::

下一篇从名字的另一半说起：什么是 System One，它和我们熟悉的 LLM 怎么分工。👉 [System One：快思考模型](/manual/llm/jev/system-one)

## 参考文献

- [1] Diogo Almeida（TypeSafe AI）. “Introducing System One Models & Jev.” 2026-09-15. [typesafe.ai/blog](https://typesafe.ai/blog/introducing-system-one-models-and-jev) —— 发布说明、Almeida 自述、“隐身两年”、官方对比表与速度成本口径、FAQ（名字由来、训练数据、刻意不做公开基准）。
- [2] Thomas Claburn. “TypeSafe AI debuts model for machines that plays Doom.” The Register, 2026-09-16. [theregister.com](https://www.theregister.com/ai-and-ml/2026/09/16/typesafe-ai-debuts-model-for-machines-that-plays-doom/5296711) —— 二手来源：“类型安全”的解释、Doom 配图、对杰文斯赌注的质疑、“RLHF 与 ChatGPT 共同发明人”的媒体说法。
- [3] TypeSafe AI. “Introduction.” 官方文档. [docs.typesafe.ai/introduction](https://docs.typesafe.ai/introduction) —— Choice、Score、Noul、Box 四种原语。
- [4] TypeSafe AI. “Choice.” 官方文档. [docs.typesafe.ai/primitives/choice](https://docs.typesafe.ai/primitives/choice) —— 跑鞋工单的请求与响应示例（原样引用）。
- [5] TypeSafe AI. “TypeSafe AI Emerges From Stealth With \$40M in Funding With New Model for Composable AI.” 新闻稿（Business Wire），2026-09-15. [Yahoo Finance 转载](https://finance.yahoo.com/technology/ai/articles/typesafe-ai-emerges-stealth-40m-190000776.html) —— 成立年份与总部、4000 万美元种子轮及 DCVC 领投、三位创始人、早期访问、新闻稿里的延迟与倍数说法。
- [6] TypeSafe AI. “Team.” 官网. [typesafe.ai/team](https://typesafe.ai/team) —— 三位创始人的职位与履历、团队背景与办公安排。
- [7] Paul Christiano 等. “Deep reinforcement learning from human preferences.” 2017-06. [arXiv:1706.03741](https://arxiv.org/abs/1706.03741) —— 作者列表（6 人）。
- [8] Long Ouyang 等. “Training language models to follow instructions with human feedback.” 2022-03. [arXiv:2203.02155](https://arxiv.org/abs/2203.02155) —— InstructGPT；作者列表（20 人，Diogo Almeida 排第 4）。
- [9] OpenAI. “ChatGPT: Optimizing Language Models for Dialogue.” 2022-11-30. [Wayback Machine 存档](https://web.archive.org/web/20221201044257/https://openai.com/blog/chatgpt/) —— ChatGPT 与 InstructGPT 使用相同的 RLHF 方法；文末贡献者名单。
- [10] OpenAI. “GPT-4 Technical Report.” 2023-03. [arXiv:2303.08774](https://arxiv.org/abs/2303.08774) —— 作者名单中有 Diogo Almeida。
- [11] Tim Fernholz. “A new kind of AI model from a ChatGPT inventor is thrilling developers.” TechCrunch, 2026-09-18. [techcrunch.com](https://techcrunch.com/2026/09/18/a-new-kind-of-ai-model-from-a-chatgpt-inventor-is-thrilling-developers/) —— 二手来源：约两年前离开 OpenAI 创业、API 曾因需求过大无法服务、对架构守口如瓶。
- [12] TypeSafe AI. “AI: too good to be true, too bad to be useful.” 官方博客，2026-06-19. [typesafe.ai/blog](https://typesafe.ai/blog/ai-too-good-to-be-true-too-bad-to-be-useful-typesafe-ai) —— 视频的发布日期。
- [13] TypeSafe AI. 官网首页（含 FAQ）. [typesafe.ai](https://typesafe.ai/) —— 193.6 倍与 444.6 倍、每十亿输入 token 42 美元、比 Claude Fable 5.1 低 238 倍、对 RLHF 的批评、博客卡片摘要、FAQ 中“按现价供应是盈利的”。
- [14] TypeSafe AI. “The Bitterest Lesson.” 官方博客，2026-09-10. [typesafe.ai/blog](https://typesafe.ai/blog/bitterest-lesson) —— 发布日期与主旨。
- [15] TypeSafe AI. Python SDK 与 JavaScript SDK 更新日志. 官方文档. [Python](https://docs.typesafe.ai/sdk/python/changelog)、[JavaScript](https://docs.typesafe.ai/sdk/javascript/changelog) —— 各版本日期（含 2026-10-14 Python SDK v0.7.5）。
- [16] TypeSafe AI. “Models.” 官方文档. [docs.typesafe.ai/models](https://docs.typesafe.ai/models) —— `jev-1.14.0` 与 `jev-1.13.0` 版本与别名、上下文长度与 262k 长上下文请求头、文本与图像输入、语言支持、定价、速率限制、不做定制与不用客户数据训练。
- [17] TypeSafe AI. “Parallel questions.” 官方文档 cookbook. [docs.typesafe.ai](https://docs.typesafe.ai/cookbooks/parallel_questions) —— 示例使用的模型版本 `jev-1.12`。
- [18] Vercel. “Jev.” AI Gateway 模型页. [vercel.com](https://vercel.com/ai-gateway/models/jev) —— 上架信息与模型名。
- [19] Online Library of Liberty. “William Stanley Jevons.” [oll.libertyfund.org](https://oll.libertyfund.org/people/william-stanley-jevons) —— 生卒年、出生地、边际效用理论。
- [20] William Stanley Jevons. The Coal Question（初版 1865；此处为 1866 年第 2 版修订本）. [Online Library of Liberty](https://oll.libertyfund.org/titles/jevons-the-coal-question) —— 第七章“论燃料的节约”的论证与高炉例子。
- [21] TypeSafe AI. “How to build with TypeSafe.” 官方文档. [docs.typesafe.ai](https://docs.typesafe.ai/concepts/how-to-build-with-system-one) —— 100 倍目标与“更便宜的智能创造更多需求”的赌注。
- [22] Steve Sorrell. “Jevons' Paradox revisited: The evidence for backfire from improved energy efficiency.” Energy Policy 37(4), 2009. [EconPapers](https://econpapers.repec.org/RePEc:eee:enepol:v:37:y:2009:i:4:p:1456-1469) —— 对杰文斯悖论证据的评估。
- [23] TypeSafe AI. “Composable AI: Build Prod, Not God.” 宣言（Manifesto）. [typesafe.ai/manifesto](https://typesafe.ai/manifesto) —— 瓶颈诊断、无马马车比喻、对 RLHF 与 RLVR 的说明、“聪明的 if 语句”、TFP 定义。
- [24] TypeSafe AI. “AI primer.” 官方文档. [docs.typesafe.ai](https://docs.typesafe.ai/introduction/machine-learning-primer) —— 99% 机器对机器交互的判断。
- [25] Luis Chavez-Mattos（编辑）. “Jev Explained: Typesafe AI's Non-Autoregressive System-1 Model.” MindStudio, 2026-09-18. [mindstudio.ai](https://www.mindstudio.ai/blog/jev-system-one-model-launch) —— 二手来源的反例：把 Diogo 写成 Diego。
- [26] TypeSafe AI. “Changelog”“Box”“Images.” 官方文档，2026-10-14. [changelog](https://docs.typesafe.ai/changelog)、[box](https://docs.typesafe.ai/primitives/box)、[images](https://docs.typesafe.ai/images) —— `Jev 1.14`（`jev-1.14.0`）发布、图像输入与 `Box` 原语、262k 长上下文模式。
