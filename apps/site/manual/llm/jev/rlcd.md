---
title: "原理二：RLCD 与概率校准"
description: "什么叫“校准”，可靠性图、ECE、Brier 分数与恰当评分规则怎么读；RLCD 官方说了什么、没说什么，和 RLHF、RLVR 及公开研究有何异同。"
source: "https://daiw.org/manual/jev/rlcd"
---

# 原理二：RLCD 与概率校准

> 什么叫“校准”，可靠性图、ECE、Brier 分数与恰当评分规则怎么读；RLCD 官方说了什么、没说什么，和 RLHF、RLVR 及公开研究有何异同。

假设有两位天气预报员。一位天天都说“明天降雨概率 70%”；另一位有时说 10%，有时说 90%。一年后翻记录：第一位说 70% 的那些天，确实有七成下了雨；第二位说 90% 的那些天，只有一半下了雨。谁更靠谱？

按“说到做到”的标准，第一位更好：他报的概率和实际发生的频率对得上，这叫校准（calibration）。第二位的毛病叫过度自信（overconfidence）：嘴上的把握比实际大。可第一位也有问题：天天报 70%，等于什么都没说。好的预报员要两样都占：说得准，也说得有区分度。

Jev 的概率不是装饰品。官方建议在代码里按置信度分流：高就自动执行，中就请用户确认或先查一查，低就不要行动、转人工 [1]。发布博客也说，一个模型如果 95% 的时候能做对，却说不出哪些情况属于那 5%，这个任务就没法自动化 [2]。所以关键问题是：它说 0.95 的时候，是不是真有九成五的把握？这一篇讲三件事：校准是什么、怎么量；公开研究里怎样用强化学习训练“说准概率”；以及 TypeSafe 的训练方法 RLCD 公开了什么、没公开什么。

## 什么叫“校准”

Guo 等人 2017 年的论文给过一个直白的定义 [3]：模型报出置信度 $p$ 的那些预测里，答对的比例应当恰好是 $p$。写成式子：

$$
P\left(\hat{Y}=Y \mid \hat{P}=p\right)=p,\qquad p\in[0,1]
$$

$\hat{Y}$ 是模型给的答案，$\hat{P}$ 是它报出的置信度，$Y$ 是真实答案。论文的例子是：100 个置信度都是 0.8 的预测，应该有 80 个是对的 [3]。TypeSafe 的 AI 入门文档说法一致：校准良好的模型，被赋予 0.2 概率的结果大约 20% 会发生，0.8 的大约 80% 会发生；并且强调这说的是一批预测，不是对任何单个答案的保证 [4]。

有两点容易混淆：

- **校准不等于准确**。如果 30% 的邮件是退款请求，一个模型对每封邮件都报 0.3，按上面的定义可以推出它是完美校准的，但毫无用处。统计学家 Gneiting 和 Raftery 把目标概括为：在保持校准的前提下，让预测尽量“尖锐”（sharpness，即概率尽量集中在某个结果上）[5]。
- **越自信越准，不等于校准**。发布博客对 Jev 的描述是：置信度越高，准确率越高 [2]。这只保证了排序（单调），不等于“说 0.8 就有八成对”；后者才是 AI 入门文档给出的校准定义 [4]。

## 怎么量：可靠性图与 ECE

**可靠性图**（reliability diagram）：把预测按置信度分桶（比如 0 到 0.1、0.1 到 0.2……），在每个桶里算实际准确率，画出“置信度—准确率”的曲线。完美校准是一条对角线；曲线落在对角线下方，说明过度自信 [3]。

**ECE**（Expected Calibration Error，期望校准误差）把这张图压成一个数，最早由 Naeini 等人在 2015 年提出 [3]：

$$
\mathrm{ECE}=\sum_{m=1}^{M}\frac{\lvert B_m\rvert}{n}\,\Bigl\lvert \operatorname{acc}(B_m)-\operatorname{conf}(B_m)\Bigr\rvert
$$

$B_m$ 是第 $m$ 个桶里的样本，$\operatorname{acc}$ 是桶内的实际准确率，$\operatorname{conf}$ 是桶内的平均置信度，$n$ 是样本总数。白话：每个桶里“嘴上说的把握”和“实际命中率”差多少，再按样本量加权平均，越接近 0 越好。要注意，ECE 是靠等宽分桶近似出来的，而可靠性图本身并不显示每个桶里有多少样本 [3]。

两个经典例子：

- **越强的网络越自负**。Guo 等人在 CIFAR-100 图像分类上对比了 1998 年的 5 层 LeNet 和 2016 年的 110 层 ResNet：ResNet 的错误率更低（30.6% 对 44.9%），但平均置信度明显高于准确率，LeNet 反而校准得很好 [3]。他们还发现，只加一个参数的“温度缩放”（temperature scaling），在多数数据集上就能有效地做事后校准 [3]。
- **后训练会损害校准**。GPT-4 技术报告显示，预训练模型在 MMLU 子集上的 ECE 只有 0.007，经过后训练（图中标注为 PPO）之后升到 0.074，报告的原话是后训练“显著损害了校准”[6]。其他研究也发现，足够大的预训练模型在格式合适的选择题、判断题上本来就相当校准 [7]；而经过 RLHF 的模型，其内部的条件概率常被认为校准很差，让它用文字报出置信度反而更准一些 [8]。

## 评分规则：给“概率”打分的尺子

校准是一批预测的统计性质，训练却需要逐条样本的奖励或损失。统计学里专门给概率预测打分的工具叫评分规则（scoring rule）[5]。

**Brier 分数**（二分类形式）：

$$
\mathrm{BS}=\frac{1}{N}\sum_{i=1}^{N}\left(p_i-o_i\right)^2
$$

$p_i$ 是报出的“发生”的概率，$o_i$ 是结果（发生记 1，没发生记 0）。白话：概率和真实结果之间的平方差，越小越好；多分类时对每个类别都算一遍再相加。它由 Brier 在 1950 年发表于《每月天气评论》（Monthly Weather Review），最早用来检验概率形式的天气预报 [5]。

**对数分数**：取真实结果被赋予的那个概率的对数，$\log p_{y}$（$y$ 是实际发生的结果），越大越好，可以追溯到 Good 1952 年的工作 [5]。它对“把真实结果的概率报成 0”的惩罚是负无穷，因此常被批评为无界 [5]。机器学习里常用的交叉熵损失，就是它取负号再求平均（站内见[交叉熵是什么](https://daiw.org/manual/bit-to-agi/03-information/cross-entropy)）。

**什么叫恰当**：如果你心里认为某件事发生的概率是 $q$，那么照实报 $q$ 能让你的期望得分最高——这样的评分规则叫恰当评分规则（proper scoring rule）；如果最高点唯一，就叫严格恰当（strictly proper）[5]。Brier 分数和对数分数都是严格恰当的 [5]。用 Brier 分数验算一下：真实概率是 0.7，你报 $r$，期望的平方误差是

$$
0.7\,(1-r)^2+0.3\,r^2
$$

对 $r$ 求导并令其为零，得 $r=0.7$：照实报最划算，报高、报低都吃亏。

反面例子是“准确率”（0/1 计分：概率最高的那个选项对了就得 1 分）。Gneiting 和 Raftery 指出，它是恰当的，但不是严格恰当的 [5]——报 0.51 还是 0.99，只要最高的那个选项对了，得分一模一样。拿它当目标，模型没有动力把概率说准。

这正好接上 Kalai 等人 2025 年的论文《Why Language Models Hallucinate》：他们认为，语言模型之所以会“幻觉”，重要原因之一是训练和评测都在奖励“猜”，而不是奖励“承认不确定”——多数评测按对错二元计分，不确定时蒙一个反而更划算 [9]。

## 奖励从哪来：RLHF、RLVR 与校准奖励

强化学习（Reinforcement Learning，RL）可以理解为“做得好就给奖励”，模型不断调整自己去拿更多奖励。关键在于奖励从哪来。

**RLHF**：Christiano 等人 2017 年让非专家在两段行为片段之间挑自己更喜欢的，用这些偏好学出奖励函数，再用 RL 训练智能体 [10]。InstructGPT（2022）把这套方法用到 GPT-3 上：先用人工示范做监督微调，再收集人对模型输出的排序、训练奖励模型，最后做强化学习；13 亿参数的 InstructGPT 比 1750 亿参数的 GPT-3 更受评估者青睐 [11]。站内见 [RLHF 是什么](https://daiw.org/manual/bit-to-agi/07-training/what-is-rlhf)和[奖励模型](https://daiw.org/manual/bit-to-agi/07-training/reward-model)。RLHF 优化的是“人更喜欢什么”，公开研究记录过它的几种副作用：倾向迎合用户观点，即谄媚（sycophancy）[12]；输出多样性明显下降 [13]；以及上文 GPT-4 报告里的校准变差 [6]。

**RLVR**：Tülu 3（2024）把“用可验证的奖励做强化学习”命名为 RLVR（Reinforcement Learning with Verifiable Rewards）：答案能被程序自动判对错（数学题能验算、代码能跑测试），就拿对错当奖励 [14]。但 Damani 等人 2025 年指出，这种二元奖励不惩罚瞎猜和低把握的输出，常见的副作用是校准变差，在其他领域更容易“幻觉”[15]。

**把评分规则当奖励**：同一篇论文提出了 RLCR（Reinforcement Learning with Calibration Rewards）：模型推理后既给答案，也给一个数值置信度，奖励等于二元的对错分加上 Brier 分数。他们证明，用任何有界的恰当评分规则构造的这类奖励，都会让模型的预测既准确又校准；实验里校准明显改善，准确率没有下降 [15]。另一项工作 Rewarding Doubt 用对数评分规则当奖励，同时惩罚过度自信和信心不足，按其设计，最优策略就是完美校准 [16]。

::: info

RLCR 和 TypeSafe 的 RLCD 名字只差一个字母，但它们是两回事：RLCR 是公开的学术工作，训练的是会写推理过程、再用文字报出置信度的语言模型。没有资料表明两者有关联。

:::

## RLCD：官方说了什么、没说什么

TypeSafe 把自己的训练方法叫 RLCD（Reinforcement Learning for Calibrated Decisions，面向校准决策的强化学习）。能在官方材料里找到的说法如下：

- **优化目标**：发布博客的对比表写道，RLHF 优化人类偏好，RLVR 优化可被程序验证的输出，RLCD 优化“校准的决策”，即在 System One 任务上给出“认知上诚实”（epistemically honest）的概率 [2]。
- **输出约定**：模型不生成文本，只返回决策和概率；概率越高，答对的可能越大 [4]。
- **怎么优化**：概率是对照真实结果（outcomes）来优化的，用来反映不确定性 [17]；目标是用校准的概率表达不确定性，而不是倾向于过度自信 [18]。
- **为什么要新算法**：FAQ 说，各家实验室在 RLHF 阶段都在优化同一件事——产出人类评分员更喜欢的文本，这对聊天产品是对的，对自动化是错的；RLVR 适合能被程序简单验证的任务，而现实中多数判断任务不是这种形状，容易练出“尖刺式”、不稳健的智能 [2]。官方还专门写了《The Bitterest Lesson》，主张做对任务比数据、算力、算法都重要 [19]。
- **数据**：FAQ 说 TypeSafe 首先是一家数据研究实验室，所有数据都自己造 [2]；文档说 Jev 不用客户的请求和回答训练 [20]。据 TechCrunch，Almeida 说 Jev 完全用合成数据训练，还说公司有一半是专门研究“统计上被充分理解的合成数据”的实验室 [21]。

官方没说的：

- 奖励函数的具体形式：用不用 Brier、对数分数或别的评分规则，没有公开。
- “结果”从哪来：合成数据怎么生成、真值怎么标定，没有公开；FAQ 的原话是，想知道更多就得先被他们雇用 [2]。
- 用什么 RL 算法、在什么基座上训练、训练了多少步：没有公开。
- 校准的量化证据：截至 2026 年 9 月 19 日，我在官网、发布博客、文档和官方评测站上都没有找到可靠性图，也没有 ECE、Brier 之类的数字。

::: warning

下面是**一般原理的推演，不是 Jev 已公开的事实**：如果目标是“把概率说准”，最自然的奖励就是恰当评分规则，因为它在数学上保证照实报概率得分最高；而要计算评分规则，必须知道每道题的真实结果——合成数据恰好能做到这一点，因为题目是自己出的。两者在原理上是契合的，但 TypeSafe 是否真这么做，官方尚未公开。

:::

| 对比项 | RLHF | RLVR | RLCD（官方口径） | RLCR（学术，2025） |
| --- | --- | --- | --- | --- |
| 奖励来自 | 人类偏好训练出的奖励模型 | 程序判对错 | 未公开；官方称对照真实结果优化概率 | 对错分加 Brier 分数 |
| 优化的是 | 人更喜欢的回答 | 在可验证任务上答对 | 决策概率的校准 | 答对且置信度校准 |
| 模型输出 | 文本 | 文本（常含推理过程） | 预定义选项上的概率 | 文本加数值置信度 |
| 对校准的影响 | GPT-4 报告显示后训练使校准变差 [6] | 二元奖励常使校准变差 [15] | 官方称已校准，未见量化证据 | 论文报告明显改善 [15] |

## 怎么检验这个卖点

**先分清看哪个数**。Choice 和 Score 的回答里有两样东西：`probabilities` 是各选项的概率分布；`confidence` 是从这个分布的形状算出来、方便设阈值的统计量，分布越平坦，confidence 越低 [1]。两者不是一回事：官方示例里三个选项的概率是 0.60、0.38、0.02 时，confidence 是 0.39 [22]。官方的校准定义说的是“被赋予的概率”与频率相符 [4]，所以检验校准，看的是 `probabilities`。

**官方自己划的边界**。校准只对一批预测成立 [17]；阈值该设多少取决于你的领域和模型在你任务上的表现，官方建议从保守的阈值开始，用自己的数据测试后再调 [1]。已知短板文档还坦白：Score 的档位在数值上的校准较弱，别拿期望分数在两档之间插值去算精确数值；不同题目之间的概率也不保证自洽 [23]。

**社区的一次小规模试测**。9 月 17 日，GitHub 用户 AbdelStark 发布了一份预先登记方案的试测：用 `jev-1.13.0` 和一个本地运行的零样本分类模型 GLiNER2.5，在三个公开数据集上各测 100 条样本，Jev 用 Choice 题作答；表里的 ECE 按每条样本概率最高的那个选项计算 [24]。Jev 的结果：

| 数据集 | 类别数 | 准确率 | Brier ↓ | ECE ↓ |
| --- | --- | --- | --- | --- |
| AG News（新闻主题） | 4 | 0.910 | 0.146 | 0.064 |
| Banking77（银行客服意图） | 72 | 0.870 | 0.179 | 0.054 |
| DAIR Emotion（情绪） | 6 | 0.480 | 0.846 | 0.351 |

前两个数据集上，Jev 的准确率和 Brier 分数都明显好于对照模型。情绪数据集上两者准确率在统计上分不出高下，但 Jev 的校准差得多：16% 的样本里，它给真实类别的概率恰好是 0；它最高那个选项的平均概率是 0.819，实际准确率却只有 0.48，典型的过度自信 [24]。测试者自己列出了局限：每个数据集只有 100 条；公开数据集可能出现在任一模型的训练数据里；返回的概率有舍入，个别概率向量加起来只有 0.99 [24]。这只是一个人的试测，没有经过同行评审，不能当作结论，但它提醒我们：**校准要按任务逐个检验**。

**为什么必须在自己的数据上测**。Ovadia 等人 2019 年的大规模实验发现，数据分布一旦偏离训练分布，模型的准确率和校准都会变差，传统的事后校准方法也不够用 [25]。按官方和 TechCrunch 的说法，Jev 的训练数据全是自己造的 [2][21]，你的业务数据和它有多像，没人能替你回答。实际做法很朴素：攒几百条带标签的真实样本，按置信度分桶画可靠性图，算 ECE 和 Brier 分数，再据此定阈值；模型换版本后重测一遍——官方也建议，调过阈值的用户应当固定具体版本号，而不是跟着别名 `jev-latest` 走 [20]。

原理讲完了。下一篇回到手上：怎么定义类型、怎么调用、返回的概率长什么样、怎么计价。👉 [上手：类型、调用与计价](/manual/llm/jev/using-jev)

## 参考文献

- [1] TypeSafe AI. “Confidence.” 官方文档. [docs.typesafe.ai](https://docs.typesafe.ai/confidence) —— 按置信度高、中、低分流；confidence 由概率分布算出；阈值从保守开始、用自己的数据调。
- [2] Diogo Almeida（TypeSafe AI）. “Introducing System One Models & Jev.” 2026-09-15. [typesafe.ai/blog](https://typesafe.ai/blog/introducing-system-one-models-and-jev) —— “95% 能做对却说不出那 5%”、对比表中 RLHF / RLVR / RLCD 的优化目标、“越自信越准”的描述、FAQ（为什么需要新算法、数据自己造）。
- [3] Chuan Guo, Geoff Pleiss, Yu Sun, Kilian Q. Weinberger. “On Calibration of Modern Neural Networks.” ICML 2017. [arXiv:1706.04599](https://arxiv.org/abs/1706.04599) —— 校准的定义、可靠性图、ECE 公式及其出处、LeNet 与 ResNet 的对比、温度缩放。
- [4] TypeSafe AI. “AI primer.” 官方文档. [docs.typesafe.ai](https://docs.typesafe.ai/introduction/machine-learning-primer) —— RLCD 的输出约定与校准的定义（0.2 对 20%、0.8 对 80%）。
- [5] Tilmann Gneiting, Adrian E. Raftery. “Strictly Proper Scoring Rules, Prediction, and Estimation.” Journal of the American Statistical Association 102(477), 2007. [作者主页 PDF](https://sites.stat.washington.edu/raftery/Research/PDF/Gneiting2007jasa.pdf) —— “在校准前提下追求尖锐”、恰当与严格恰当的定义、Brier 分数（Brier 1950）与对数分数（Good 1952）、0/1 计分只是恰当而非严格恰当。
- [6] OpenAI. “GPT-4 Technical Report.” 2023-03. [arXiv:2303.08774](https://arxiv.org/abs/2303.08774) —— 图 8：预训练模型 ECE 0.007，后训练后 0.074。
- [7] Saurav Kadavath 等. “Language Models (Mostly) Know What They Know.” 2022-07. [arXiv:2207.05221](https://arxiv.org/abs/2207.05221) —— 较大的模型在格式合适的选择题、判断题上校准良好。
- [8] Katherine Tian 等. “Just Ask for Calibration.” 2023-05. [arXiv:2305.14975](https://arxiv.org/abs/2305.14975) —— RLHF 模型的条件概率校准差，用文字报出的置信度更好。
- [9] Adam Tauman Kalai, Ofir Nachum, Santosh S. Vempala, Edwin Zhang. “Why Language Models Hallucinate.” 2025-09. [arXiv:2509.04664](https://arxiv.org/abs/2509.04664) —— 二元计分奖励猜测、惩罚承认不确定。
- [10] Paul Christiano 等. “Deep reinforcement learning from human preferences.” 2017-06. [arXiv:1706.03741](https://arxiv.org/abs/1706.03741) —— 从人类对行为片段的偏好中学习奖励函数。
- [11] Long Ouyang 等. “Training language models to follow instructions with human feedback.” 2022-03. [arXiv:2203.02155](https://arxiv.org/abs/2203.02155) —— InstructGPT 的训练流程，13 亿参数模型胜过 1750 亿参数的 GPT-3。
- [12] Mrinank Sharma 等. “Towards Understanding Sycophancy in Language Models.” 2023-10. [arXiv:2310.13548](https://arxiv.org/abs/2310.13548) —— 人类反馈可能助长谄媚。
- [13] Robert Kirk 等. “Understanding the Effects of RLHF on LLM Generalisation and Diversity.” 2023-10. [arXiv:2310.06452](https://arxiv.org/abs/2310.06452) —— RLHF 明显降低输出多样性。
- [14] Nathan Lambert 等. “Tulu 3: Pushing Frontiers in Open Language Model Post-Training.” 2024-11. [arXiv:2411.15124](https://arxiv.org/abs/2411.15124) —— 提出 RLVR 这一名称与方法。
- [15] Mehul Damani 等. “Beyond Binary Rewards: Training LMs to Reason About Their Uncertainty.” 2025-07. [arXiv:2507.16806](https://arxiv.org/abs/2507.16806) —— 二元奖励损害校准；RLCR 用对错分加 Brier 分数作奖励及其理论保证与实验结果。
- [16] David Bani-Harouni 等. “Rewarding Doubt: A Reinforcement Learning Approach to Calibrated Confidence Expression of Large Language Models.” 2025-03. [arXiv:2503.02623](https://arxiv.org/abs/2503.02623) —— 以对数评分规则为奖励，最优策略是完美校准。
- [17] TypeSafe AI. “System One.” 官方文档. [docs.typesafe.ai](https://docs.typesafe.ai/concepts/system-one) —— 概率对照真实结果优化；校准只对一批预测成立。
- [18] TypeSafe AI. “How to build with TypeSafe.” 官方文档. [docs.typesafe.ai](https://docs.typesafe.ai/concepts/how-to-build-with-system-one) —— RLCD 用校准的概率表达不确定性，而不是倾向于过度自信。
- [19] TypeSafe AI. “The Bitterest Lesson.” 官方博客，2026-09-10. [typesafe.ai/blog](https://typesafe.ai/blog/bitterest-lesson) —— 做对任务比数据、算力、算法更重要。
- [20] TypeSafe AI. “Models.” 官方文档. [docs.typesafe.ai](https://docs.typesafe.ai/models) —— 不用客户数据训练；调过阈值的用户应固定版本号。
- [21] Tim Fernholz. “A new kind of AI model from a ChatGPT inventor is thrilling developers.” TechCrunch, 2026-09-18. [techcrunch.com](https://techcrunch.com/2026/09/18/a-new-kind-of-ai-model-from-a-chatgpt-inventor-is-thrilling-developers/) —— 二手来源：Almeida 称完全用合成数据训练。
- [22] TypeSafe AI. “Choice.” 官方文档. [docs.typesafe.ai](https://docs.typesafe.ai/primitives/choice) —— 概率 0.60、0.38、0.02 对应 confidence 0.39 的示例。
- [23] TypeSafe AI. “Jev 1.13 jaggedness.” 官方文档，2026-09-17 复核. [docs.typesafe.ai](https://docs.typesafe.ai/model-jaggedness/jev-1.13) —— Score 档位数值校准较弱、跨题目概率不保证自洽。
- [24] AbdelStark. “jev-benchmarks”（BTZSC pilot v1 报告）. GitHub，2026-09-17. [github.com](https://github.com/AbdelStark/jev-benchmarks) —— 社区试测：三个数据集上的准确率、Brier、ECE 与局限说明。
- [25] Yaniv Ovadia 等. “Can You Trust Your Model's Uncertainty? Evaluating Predictive Uncertainty Under Dataset Shift.” NeurIPS 2019. [arXiv:1906.02530](https://arxiv.org/abs/1906.02530) —— 数据分布偏移下准确率与校准一起变差。
