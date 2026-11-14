---
title: "局限与展望"
description: "Jev 现在能确认什么、不能确认什么：官方评测与首批独立测试怎么读，10 月 Jev 1.14 更新补齐了哪些短板，官方自列的参差之处，与 LLM 级联的实测，以及杰文斯悖论之问。"
source: "https://daiw.org/manual/jev/limits-outlook"
---

# 局限与展望

> Jev 现在能确认什么、不能确认什么：官方评测与首批独立测试怎么读，10 月 Jev 1.14 更新补齐了哪些短板，官方自列的参差之处，与 LLM 级联的实测，以及杰文斯悖论之问。

一家新开的餐馆，门口贴着招牌菜的大照片，写着“比隔壁快 200 倍、便宜 400 倍”。美食评论家还没来过，只有几位早到的食客发了点评，有人说惊艳，有人说一般。你该信多少？

Jev 自 2026 年 9 月中旬发布以来，处境差不多。前面几篇讲了它是什么、怎么用、被拿来做什么；这一篇把能确认的和还不能确认的分开，再讨论两个更远的问题：它该怎样和 LLM 搭配，以及它名字里那个经济学之问。

## 官方评测：自己出题，参考答案来自别的模型

截至 2026 年 11 月初，TypeSafe 仍未发表论文、技术报告或模型卡，也刻意不公布公开基准上的成绩（详见[第一篇](/manual/llm/jev/what-is-jev)）。Almeida 对架构守口如瓶，TechCrunch 写道，外部观察者怀疑它建立在某个开放权重的 LLM 之上 [1]。能拿来比较的，主要是 TypeSafe 自建的“工作流评测”：首页“快 193.6 倍、便宜 444.6 倍”就出自这里，博客承认这两个倍数“大概处在真实收益的高端”[2][3]。

这套评测的设计值得看清楚 [2][3]：

- 四个工作流（安全事件处置、Agent 轨迹复盘、发票处理、客服）都由 TypeSafe 模型能力团队编写。官方说它们不是为了让自家模型好看而挑的，也不在训练分布里，但承认可能有偏差。
- “准确率”是与参考答案的一致率，而参考答案不是人工标注，是 GPT-6 Astra 与 Claude Fable 5.1 在高推理档下答案的平均。博客自己也说，这会让结果偏向 OpenAI 和 Anthropic 的模型。
- 参评的 LLM 统一用各家默认推理设置，并通过 TypeSafe 自己的适配层输出带概率的结构化答案；博客承认，这通常比直接给答案更慢也更贵。
- 公开评测大多在美国西海岸的笔记本上跑。

评测页上四个工作流等权平均的结果如下（官方口径，2026-09-19 查阅；模型名照录页面简称，terra、sol、luna 属 OpenAI，opus 5 属 Anthropic，DS v4 flash 经 Fireworks 调用）[3]：

| 配置 | 与参考答案一致率 | 每例成本 | 每例耗时 |
| --- | --- | --- | --- |
| Jev | 67.8% | 0.0004 美元 | 0.4 秒 |
| terra | 67.9% | 0.0304 美元 | 10.1 秒 |
| luna | 66.8% | 0.0033 美元 | 12.9 秒 |
| DS v4 flash | 64.4% | 0.0059 美元 | 51.9 秒 |
| sol | 74.1% | 0.0836 美元 | 23.3 秒 |
| opus 5 | 73.1% | 0.1761 美元 | 37.8 秒 |

读法：Jev 的一致率与 terra 相当，比 sol、opus 5 低五到六个百分点；每例成本低约 8 到 440 倍，耗时低约 25 到 130 倍（本文按表计算）。分开看，它在客服上（76.0%）与 sol（78.3%）接近，在发票处理上差得最多（61.8% 对 sol 的 79.1%）[3]。官方数据支持的是“在准确率与成本、速度的权衡上处于前沿”，而不是“最准”。

## 第一批独立测试：更快更省是真的，幅度小得多

9 月首发后的头几天里，GitHub 上出现了几份针对 `jev-1.13.0` 的个人独立测试。它们样本小（60 到 300 条），多数只跑一两次，没有同行评审，作者自己也列了不少保留意见，但至少是 TypeSafe 之外的数据（均为作者报告）：

| 测试（日期） | 任务与样本 | 准确率：Jev 对比 LLM | 速度与成本 | 置信度相关发现 |
| --- | --- | --- | --- | --- |
| 4esv/jev-eval（9 月 17 日）[4] | 三个公开数据集各 300 条：77 类意图、5 级情感、正负面 | 对 GPT-5.6 Terra：0.78 对 0.85、0.57 对 0.59、0.97 对 0.97 | 中位延迟约 0.2 秒对 1.05 秒，约快 5 倍；每千次成本低 41–50 倍 | 校准误差（ECE）一项优于 Terra、两项不如；同样的输入有 1.7% 和 3.3% 的条目换了答案 |
| themsquared/jev-benchmark（9 月 17 日）[5] | Agent 工具调用风险四分类，60 条手工标注，含模糊与对抗样本 | 91.7%，其中模糊子集 71.4% | 中位延迟约 422 毫秒 | 5 个错答的置信度都低于 1.0 |
| ickma2311/jev-baselines-eval（9 月 18 日，预注册）[6] | Banking77 208 条、CLINC150 零样本 200 条 | 0.832 与 0.870；GPT-5.6 Terra 为 0.875 与 0.915，gpt-5.4-nano 为 0.793 与 0.795 | 中位调用时长约 0.43 秒，nano 约 0.92 秒 | CLINC150 上有 102 条置信度恰为 1.0，其中 6 条是错的 |

几点读法：

- **快和省确实存在，但幅度远小于宣传**：在这些设置下是快几倍、省几十倍，而不是 193 倍和 444 倍。4esv 还发现，同一段文字 Jev 计的输入 token 约为 Terra 的两倍 [4]。
- **准确率与前沿 LLM 大体相当或略低**：简单任务打平，类别一多就落后几个百分点。ickma2311 还加了一个常被忽略的对照：用 1 万条标注数据训练的小编码器（单次约 9 毫秒、没有调用费）在 Banking77 上拿到 0.933，高于 Jev 和 Terra。有标注数据时，传统分类器仍值得先试 [6]。
- **置信度的表现因数据而异**：themsquared 的样本里错答从不出现在 1.0 上 [5]，ickma2311 的 CLINC150 里却有 6 条 1.0 的错答 [6]；4esv 与 ickma2311 都没能证明，Jev 的置信度比 LLM 自报的置信度更善于“挑出自己的错”，结果互有胜负 [4][6]。
- **都只测了单步分类**：还没有人公开大规模的端到端 Agent 工作流独立评测，ickma2311 把这列为悬而未决的问题 [6]。

## 快速迭代中的变数

- **接口与模型在快速演进**：9 月发布前后接口从预览版换成了不兼容的 v1，请求、响应字段和置信度算法都变了 [7]；Python SDK 在 9 月 15 日、18 日连发两个破坏性更新，又在 10 月 14 日升到 v0.7.5 [8]。10 月 14 日发布的 `jev-1.14.0` 接替 `jev-1.13.0` 成为 `jev-latest` 默认指向的版本，因此如果业务依赖固定置信度阈值，务必显式锁定模型版本号 [10][27]。
- **供给偏紧**：9 月首发后需求过大，API 一度无法对外服务（据 TechCrunch）[1]；文档上的速率上限仍在动态调整 [10]。ickma2311 当时通过 Vercel 网关的免费额度测试时，突发请求之后被限到大约每分钟 1 次，200 条样本跑了约 3.5 小时 [6]。
- **价格待检验**：博客坦言“我们无法证明价格没有补贴”，要靠时间证明可持续，并预计价格只降不升 [2]；首页 FAQ 则说按现价能盈利 [11]。Vercel 网关上的免费促销已于 9 月 25 日结束 [12]。

## 哪些事它做不好

TypeSafe 在文档里专门写了一页“模型参差之处”（Model jaggedness，原名 Jev 1.13 jaggedness，10 月 14 日随 `Jev 1.14` 更新），开头就说它在 System One 类任务上表现最好，但多一层间接就可能吃力，理解偏字面，对数值精度要求高的任务也不擅长 [9]。文档列出的九种失效模式和官方给的绕法：

| 失效模式 | 官方建议 |
| --- | --- |
| 字面理解：只回答写出来的问题，不揣测言外之意 | 把条件写准，边界情况写进选项说明 |
| 数学与数字：数数不可靠，十六进制颜色这类数字表示不如英文名称好用 | 计算放在代码里 |
| 日期与时间比较 | 让模型抽取年月日，比较交给代码 |
| 多层间接：双重否定、“属性的属性” | 减少跳数，直接点名状态里的字段 |
| 材料里无关内容太多 | 先在代码里筛选，只送需要的部分 |
| 对抗性内容：注入的指令可能改变答案 | 选项写明确，上线前充分测试 |
| 指令与选项互相矛盾 | 让两者一致 |
| 选项顺序敏感（Choice option order）与跨题恒等式不成立 | 保持选项顺序固定；每个决定只用一种问法，恒等关系在代码里保证 |
| 生成文字 | 用生成式模型 |

其中第八条有两层意思值得注意：一是 9 月文档举例说明“跨问法的恒等式”不保证成立——对工单“我对尺码不满意，有什么办法？”问“客户是否要求退款”，做成是非题得 0.22，做成“是 / 否”选择题时“是”只有 0.01，不同问法得到的概率不能互相换算；二是 10 月更新文档明确提醒，在边界样本上**调换 Choice 选项的排列顺序可能轻微改变各选项的概率**，因此生产环境里应保持选项顺序固定 [9]。

此外还有几条边界：

- 复杂数学、下棋式规划这类需要长链推理的任务，官方建议交给大型推理模型 [11]。
- 模态边界：9 月首发时只收文本（Bryo 的测试者当时把这列为上生产的最大障碍 [13]）；10 月 14 日更新后已支持 PNG 与 JPEG 图像输入及 `Box` 边界框定位，但仍不支持音频、视频或直接解析原始二进制文档（如未转图片的 PDF）[10][27]。
- 语言支持：英语是主要训练语言；`jev-1.14.0` 提升了非英语语言的准确率，但官方仍注明中日韩等非英语文字准确率低于英语 [10][27]，中文场景务必先用自己的数据测。
- 只给数字、不给理由：System One 模型不写回复，也不解释推理过程 [14]。需要向人说明“为什么这样判”的场合（比如审计），得另想办法。
- “不会幻觉”只保证答案落在你列出的选项里。官方 FAQ 说得明白：它可能选错 [11]；官方技能包的原话更短：带类型的输出保证的是接口，不是真相 [15]。4esv 的测试里，Jev 的 1,800 次回答全部落在选项内，GPT-5.6 Terra 在严格 JSON Schema 约束下的 1,800 次回答也一样 [4]，可见在简单的枚举题上，这项优势相对带约束解码的 LLM 并不明显。Earendil 的 CTO Armin Ronacher 则说，它其实是把幻觉问题“稍微交给了用户”：50% 的概率可能就是抛硬币，95% 才能放心用 [1]。概念上的边界，[原理一](/manual/llm/jev/parallel-sampler)有更完整的讨论。
- 也不是严格确定的：官方说 Jev 追求的是意思相近时判断相近的“一致性”，而不是逐字相同时结果相同的“确定性”[11]。

## 和 LLM 搭配：级联到底省多少

基本分工在 [System One 那一篇](/manual/llm/jev/system-one)已经讲过：代码算能精确算的，Jev 做窄而快的判断，LLM 负责生成和深推理，没把握的交给人或推理模型。LangChain 的一句话概括得好：用 LLM 做开放式的推理和生成，用 Jev 在沿途做快速、结构化的决策 [16]。这里补三件还没展开的事。

第一，级联的收益要实测，而且对置信度的顶端很敏感。ickma2311 的预注册实验把“先用便宜模型、没把握再交给 GPT-5.6 Terra”做成了可比较的指标：在 CLINC150 的 200 条样本上，要达到“比 Terra 低 1 个百分点”的准确率，Jev 打头阵只需把 22% 的请求升级给 Terra，gpt-5.4-nano 打头阵要升级 48.5%。但置信区间很宽，作者判为“不确定”；目标一旦收紧到与 Terra 完全持平，结论就反转了：Jev 有 102 条答案的置信度恰为 1.0，其中 6 条是错的，只要保留任何一个 Jev 的答案就达不到持平，级联退化成“全部交给 Terra”[6]。

第二，也可以反过来让 LLM 帮 Jev。文档建议，没有标注数据时，用一组昂贵推理模型的集成来生成标签，再把 Jev 返回的概率当特征，训练下游的传统模型 [17]。TypeSafe 还开源了一个适配器，让你用同一套题目去问 OpenAI 或 Anthropic 的模型，在自己的数据上把两者放在一起比 [18]。

第三，“快慢结合”在学术上早有先例。SwiftSage（NeurIPS 2023）让一个小的编码器-解码器模型当“快”模块直接出动作，GPT-4 当“慢”模块规划子目标，两者按启发式切换 [19]；RouteLLM（2024）训练路由器在强、弱两个 LLM 之间分流，在部分场景把成本降低一半以上而不损失质量 [20]。Jev 的新意在于把“快”的那一半做成了通用的、带概率、能被代码直接消费的服务。

## 杰文斯悖论：决策越便宜，调用越多吗

名字的来历和 TypeSafe 的押注，[第一篇](/manual/llm/jev/what-is-jev)已经讲过。这里换个角度，问一个可以检验的问题：一次判断的价格降下来，调用量会不会涨得更快？

设一次判断的价格为 $p$、调用量为 $q(p)$，总花费就是 $E = p \cdot q(p)$。价格变动时 $E$ 往哪走，取决于调用量对价格有多敏感，经济学用需求的价格弹性来衡量：

$$
\varepsilon = -\frac{\Delta q / q}{\Delta p / p}
$$

白话：价格降 1%，调用量大约涨 $\varepsilon$ 个百分点。$\varepsilon$ 大于 1 时，新增的用量超过降价省下的部分，总花费不降反升；如果价格大体跟着每次判断的算力成本走，背后消耗的总算力也会上升，这就是杰文斯悖论。小于 1 时，降价就只是省钱 [21]。

眼下已经能看到几处苗头，都来自官方或早期用户的材料：

- **单次请求里的题变多了**：文档直接建议把“可能用不上”的问题也一起问，因为多问一题“几乎免费”[22]。
- **每一步都审一遍**：fx 的 auto 模式会为每个未决动作多发一次审查请求，文档承认这可能让它比 ask 模式（逐条询问用户）还贵 [23]；LangChain 则说，有了便宜好用的分类模型，这个模式可以推广到所有 Agent [16]。
- **实时循环**：Doom 演示每秒调用 10 次，约 7 美元一小时 [2]；按 LLM 的价格和延迟，这种用法不会被考虑。
- **全量处理**：用例页把“便宜 100 倍”直接等同于“可以处理巨大的数据集”[24]。

也有反方向的证据：

- Bryo 的测试者说，按正常的收件量，省下的钱其实很少，他更在意的是那个概率 [13]。对这类场景，价格早已不是瓶颈，弹性未必大于 1。
- 独立测试里，Jev 相对 LLM 的实际价差是几十倍而不是几百倍 [4]，降价的幅度本身就比宣传小。
- 供给有天花板：发布当周服务就一度过载，速率上限还在随算力到位情况调整 [1][10]。
- 调用量放大以后，即使错误率不变，错误的绝对数量也会跟着涨（本文推论）。官方文档强调“阈值随风险而定”，调用量越大，这一条越要紧 [25]。

经济学界对杰文斯悖论本身的争议，以及 The Register 对“token 市场是否像能源市场一样宽广”的质疑，见[第一篇](/manual/llm/jev/what-is-jev)。

## 同路人与下一步

目前 Jev 在这个品类里还是独一份。Ronacher 对 TechCrunch 预计，既然用处已经显现，竞争者会跟上；他还说，大家早该想到这条路，可能是因为 LLM 太便宜、又有补贴，人们还不必动脑筋 [1]。已经能看到的动向：

- **开源复刻接口**：发布后不到十小时，GitHub 上就出现了 OpenJev 项目，后改名 SemIf，并声明与 TypeSafe 无关。它用开源的 Qwen3.5-4B 做一次前向计算，直接读出各选项的 logits 当概率，不生成任何文字。作者报告，在单张 RTX 3090 上判断 21 个是非题，直接读 logits 用 1.023 秒，让同一模型逐 token 生成 JSON 数组要 5.332 秒；在能与 TypeSafe 公开记录对齐的 102 条数据上，一致率为 0.845，TypeSafe 公布的 Jev 为 0.883 [26]。它只复刻接口，不复刻 Jev 的训练与校准。
- **分发渠道**：Vercel AI Gateway 与 LangChain 都在发布后两天内接入，见[上一篇](/manual/llm/jev/applications)。
- **并行生成**：非自回归、扩散式的语言模型是另一条公开的研究线，见[原理一](/manual/llm/jev/parallel-sampler)。
- **TypeSafe 自己**：据 TechCrunch，公司会做更多版本和新的模态 [1]——10 月 14 日发布的 `Jev 1.14` 已经兑现了图像输入、第四种原语 `Box` 和 262k 长上下文支持 [27]；博客承诺为 Doom 演示发布详细教程并组织活动 [2]；首页 FAQ 说可以为有需要的客户做更快的版本 [11]。

接下来值得盯的几件事（本文归纳）：有没有论文或模型卡；有没有独立机构针对 `Jev 1.14`（含图像与 `Box` 原语）的大规模评测，尤其是端到端的 Agent 工作流；早期访问全面放开后的实际价格和限额；中文等非英语场景在 `1.14` 升级后的实测表现。

正文到这里就讲完了，最后一篇把整个专栏串起来。👉 [回顾](/manual/llm/jev/recap)

## 参考文献

- [1] Tim Fernholz（TechCrunch）. “A new kind of AI model from a ChatGPT inventor is thrilling developers.” 2026-09-18. [techcrunch.com](https://techcrunch.com/2026/09/18/a-new-kind-of-ai-model-from-a-chatgpt-inventor-is-thrilling-developers/) —— 二手来源：架构保密与外界猜测、API 一度过载、Ronacher 的评论与对竞争者的预计、新模态计划。
- [2] TypeSafe AI（Diogo Almeida）. “Introducing System One Models & Jev.” 2026-09-15. [typesafe.ai/blog](https://typesafe.ai/blog/introducing-system-one-models-and-jev) —— 工作流评测的说明与偏差自述、193.6 倍与 444.6 倍的出处、价格可持续性、Doom 演示与后续计划。
- [3] TypeSafe. “Workflow evals”（总览及四个工作流页）. [evals.typesafe.ai](https://evals.typesafe.ai/) —— 评测设计、参考答案来源、各配置的一致率、成本与耗时（官方口径）。
- [4] 4esv. “jev-eval” 仓库 README. 2026-09-17. [github.com/4esv/jev-eval](https://github.com/4esv/jev-eval) —— 作者报告：与 GPT-5.6 Terra 的三项对比、校准误差、非确定性、token 计数与选项内作答率。
- [5] themsquared. “jev-benchmark” 仓库 README. 2026-09-17. [github.com/themsquared/jev-benchmark](https://github.com/themsquared/jev-benchmark) —— 作者报告：Agent 工具调用风险分类的准确率、延迟与置信度分布。
- [6] ickma2311. “jev-baselines-eval” 仓库 README. 2026-09-18. [github.com/ickma2311/jev-baselines-eval](https://github.com/ickma2311/jev-baselines-eval) —— 作者报告：预注册实验、与 nano 模型和监督编码器的对比、级联升级率、Vercel 免费额度下的限流。
- [7] TypeSafe 文档. “Migrating to the v1 API.” [docs.typesafe.ai](https://docs.typesafe.ai/migrating-to-v1) —— 预览版到 v1 的不兼容变更。
- [8] TypeSafe 文档. Python SDK “Changelog.” [docs.typesafe.ai](https://docs.typesafe.ai/sdk/python/changelog) —— 0.6.0、0.7.0 与 0.7.5 的变更记录。
- [9] TypeSafe 文档. “Model jaggedness.” [docs.typesafe.ai](https://docs.typesafe.ai/model-jaggedness) —— 九种失效模式、选项顺序敏感与跨题恒等式的例子。
- [10] TypeSafe 文档. “Models.” [docs.typesafe.ai](https://docs.typesafe.ai/models) —— 动态调整的速率上限、文本与图像输入、语言支持与版本锁定。
- [11] TypeSafe AI 官网首页 FAQ. [typesafe.ai](https://typesafe.ai/) —— 擅长与不擅长的任务、“可能选错”、一致性而非确定性、按现价能盈利、可做更快的版本。
- [12] Vercel AI Gateway. “Jev” 模型页. [vercel.com](https://vercel.com/ai-gateway/models/jev) —— 首周免费促销（9 月 25 日截止）。
- [13] Nikhil Mudholkar（@nikhilmudholkar，Bryo AI 联合创始人兼 CTO）. X 帖子串. 2026-09-17. [x.com/nikhilmudholkar](https://x.com/nikhilmudholkar/status/2100604560335139083) —— 客户口径：附件被排除是当时上生产的最大障碍、正常收件量下省钱有限。
- [14] TypeSafe 文档. “System One.” [docs.typesafe.ai](https://docs.typesafe.ai/concepts/system-one) —— System One 模型不写回复、不解释推理过程。
- [15] TypeSafe. “typesafe-ai” 技能 SKILL.md. [github.com/typesafe-ai/skills](https://github.com/typesafe-ai/skills/blob/main/skills/typesafe-ai/SKILL.md) —— “带类型的输出保证的是接口，不是真相”。
- [16] Sydney Runkle, Hunter Lovell（LangChain）. “Building a Harness with Jev.” 2026-09-17. [langchain.com/blog](https://www.langchain.com/blog/building-a-harness-with-jev) —— LLM 与 Jev 的分工、把动作分类推广到所有 Agent。
- [17] TypeSafe 文档. “How to build with TypeSafe.” [docs.typesafe.ai](https://docs.typesafe.ai/concepts/how-to-build-with-system-one) —— 用推理模型集成生成标签、以概率为特征训练下游模型。
- [18] TypeSafe. “system-one-adapter-python” 仓库 README. [github.com/typesafe-ai/system-one-adapter-python](https://github.com/typesafe-ai/system-one-adapter-python) —— 用同一接口调用 LLM、便于对比。
- [19] Bill Yuchen Lin 等. “SwiftSage: A Generative Agent with Fast and Slow Thinking for Complex Interactive Tasks.” 2023-05（NeurIPS 2023）. [arXiv:2305.17390](https://arxiv.org/abs/2305.17390) —— 快、慢两个模块的分工与切换。
- [20] Isaac Ong 等. “RouteLLM: Learning to Route LLMs with Preference Data.” 2024-06. [arXiv:2406.18665](https://arxiv.org/abs/2406.18665) —— 在强、弱 LLM 之间路由，部分场景成本降低一半以上。
- [21] Wikipedia. “Jevons paradox.” [en.wikipedia.org](https://en.wikipedia.org/wiki/Jevons_paradox) —— 杰文斯悖论的定义，以及需求价格弹性足够大时总消耗上升。
- [22] TypeSafe 文档. “Primitives (Questions).” [docs.typesafe.ai](https://docs.typesafe.ai/primitives) —— “多问一题几乎免费”。
- [23] Vercel Labs. fx 文档 “Permissions.” [fx.sh](https://fx.sh/docs/configure-fx/permissions) —— auto 模式下的额外审查请求及其成本。
- [24] TypeSafe 文档. “Example use cases.” [docs.typesafe.ai](https://docs.typesafe.ai/concepts/use-case-map) —— “便宜 100 倍意味着可以处理巨大的数据集”。
- [25] TypeSafe 文档. “Confidence.” [docs.typesafe.ai](https://docs.typesafe.ai/confidence) —— 阈值随风险而定。
- [26] TheoLeeCJ. “SemIf (formerly OpenJev)” 仓库 README. [github.com/TheoLeeCJ/SemIf](https://github.com/TheoLeeCJ/SemIf) —— 作者报告：用开源模型复刻接口模式的方法、速度与一致率。
- [27] TypeSafe 文档. “Changelog.” 2026-10-14. [docs.typesafe.ai/changelog](https://docs.typesafe.ai/changelog) —— `Jev 1.14`（`jev-1.14.0`）发布、图像输入、`Box` 原语、262k 长上下文模式与多语言改进。
