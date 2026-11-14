---
title: "自动化 AI 研发：AI 科学家与“参与造自己”的模型"
description: "从 AI Scientist 到三大实验室的内部数据，按研发流程逐段拆开：哪些环节已交给 AI，哪些仍由人拍板，“参与”离“独立完成”还差多远。"
source: "https://daiw.org/manual/rsi/automated-research"
---

# 自动化 AI 研发：AI 科学家与“参与造自己”的模型

> 从 AI Scientist 到三大实验室的内部数据，按研发流程逐段拆开：哪些环节已交给 AI，哪些仍由人拍板，“参与”离“独立完成”还差多远。

一家研究所里，所长决定做什么，研究员出点子、定方案，工程师写代码、跑实验，分析员看数据，最后有人把结果写成报告。说“AI 已经在研发 AI”，头一个该问的问题是：**它顶替了哪个岗位**？

答案决定了一切。如果 AI 只是把工程师的活干得更快，研发会加速，方向盘却还在人手里，这叫 **AI 参与研发环节**，对应[五级台阶](/manual/llm/rsi/rsi-ladder)的第 4 级。如果它能从定方向到出成果一条龙做完，人只需偶尔验收，那才叫 **AI 独立完成研发**，也就是第 5 级。这一篇沿着这条分界线，把 2026 年能找到的公开证据摆出来。[第一篇](/manual/llm/rsi/what-is-rsi)已经讲过 GPT-5.3-Codex 与 Anthropic 长文的主要内容，这里不再重复，只补上它们没有展开的部分。

## 两把尺子：“实习生”和“研究员”

OpenAI 的时间表，原始出处是 Sam Altman 2025 年 10 月 29 日的一条 X 帖子：前一天的直播里，公司定下了两个内部目标，2026 年 9 月之前做出一个跑在数十万块 GPU 上的“自动化 AI 研究实习生”，2028 年 3 月之前做出真正的“自动化 AI 研究员”；他紧接着写道，“我们可能完全达不成这个目标”[1]。

2026 年 9 月 6 日，OpenAI 宣布按自己的测量已经达成“实习生”目标，并给出了定义：一个**能在人的指导下完成定义清楚的研究任务**的系统，包括熟练研究员要花几天才能做完的任务；至于 2028 年的“研究员”，官方说法是“正在取得扎实进展”[2]。

Anthropic 用的是另一把尺子。它的模型报告沿用 2025 年《负责任扩展政策》（RSP）2.x 版的一道 AI 研发能力门槛，叫 AI R&D-4：模型要能**完全自动化 Anthropic 一名只远程办公的初级研究员的工作**。Anthropic 特意强调，这是对“稳健的长时程能力”的很高要求，不等于“能做初级研究员的大部分短任务”[3]。2026 年的 RSP 3.x 版已把 AI 研发阈值改写成“关键领域的自动化研发”，细节见[风险与治理](/manual/llm/rsi/safety-governance)。

::: info

**两把尺子，量的是两件事**。“实习生”量的是参与：任务由人定义、在人的指导下完成。“初级研究员被完全自动化”量的是独立：一个岗位从头到尾不再需要人。前者 OpenAI 说已经做到（官方口径，待独立验证）；后者，在本文查到的截至 2026 年秋（11 月初复核）的实验室公开材料里，没有谁宣称做到，Anthropic 更是明确表示尚未越过。

:::

## 研发流程拆成六段，看 AI 站在哪

OpenAI 在 9 月那篇文章里借用了 Epoch AI 的一套分类，把前沿 AI 研发拆成六个阶段：决定、设计、构建、运行、分析、沟通[2]。把各家公开的证据往这六格里填，分界线就清楚了：

| 阶段 | 公开证据里 AI 已经在做的 | 仍由人把关的 |
| --- | --- | --- |
| 决定：做什么、继续什么、资源怎么分 | 在研究人员的 Agent 产出里，“高层规划”只占极小比例[2] | 研究优先级、追哪些想法、扩大/暂停/部署，均由人决定[2]；在“选目标”上人仍明显占优[4] |
| 设计：研究点子与工程方案 | 在 129 个特意挑出的“研究岔路口”，模型的下一步建议胜过人类原选择的比例从 51%（2025-11）升到 64%（2026-04）[4]；在定义清楚的窄题上能自己提出并检验假设[5] | 题目本身和评分标准由人设定[4][5] |
| 构建：代码与数据集 | 截至 2026-05，合并进 Anthropic 代码库的代码超过 80% 由 Claude 编写[4]；2026 年 1 月 OpenAI 研究人员把 Agent 用得最多的是写研究与基础设施代码[2] | 人工代码评审，而且它已成新瓶颈[4] |
| 运行：训练与评测、硬件、服务 | GPT-5.6 Sol 为自己的草稿模型设计并运行数百次实验，启动并监控其训练，遇到硬件故障和训练不稳时自主干预[6]；“监控运行”类的 Agent 用途明显增加[2] | 要不要扩大规模、暂停或部署[2] |
| 分析：实验、模型、部署 | GPT-5.3-Codex 帮数据科学家搭数据管线，不到三分钟总结了上千个数据点的要点[7] | 哪些结果可信、哪条路是死路[4] |
| 沟通：发现、反馈、状态 | AI Scientist 写出了通过研讨会同行评审的完整论文[8] | 投稿前逐阶段的人工筛选[8] |

“设计”一行的数字要多看一眼：那 129 个“岔路口”是 Anthropic 从真实研究会话里特意挑出的、人类当时走了弯路的时刻，裁判是另一个能看到会话结局的 Claude，所以它衡量的是进步趋势，不是人与模型的公平对比[4]。

中间几格——写代码、跑实验、盯训练——已经大面积交给 AI；两头，尤其是“决定做什么”和“判断结果可不可信”，还牢牢握在人手里。表里的实验室数据都是官方口径，外界无法复核。

## 端到端的尝试：AI Scientist 一族

有没有系统把六段全部串起来？一个有代表性的尝试，是 Sakana AI 及其合作者的 **AI Scientist**。

**第一版**（2024-08）。给定一个人写好的代码模板，它自己提出研究点子、写代码、跑实验、画图、写出整篇论文，再做一轮模拟审稿，每篇论文的成本不到 15 美元[9]。

**第三方的冷水**（2025-02）。德国锡根大学与新加坡国立大学的 Joeran Beel 等人做了独立评估：42% 的实验因为代码错误而失败，文献检索常把已有的概念（例如随机梯度下降里的小批量）误判为新点子，论文引用的中位数只有 5 篇，还出现过凭空编造的数值结果。他们的评价是，质量像“赶工的本科生论文”，但速度和成本前所未有：每篇 6 到 15 美元，外加约 3.5 小时的人工参与[10]。

**第二版**（2025-04）。去掉了人写的代码模板，改用由“实验管理 Agent”调度的树搜索来推进实验[11]。团队把三篇全自动生成的论文投给 ICLR 2025 的一个研讨会，其中一篇拿到 6、7、6 分（平均 6.33），超过该研讨会的平均录用线；按事先与会议方约定的方案，论文在评审后撤稿[8][11]。

**登上 Nature**（2026-03）。2026 年 3 月 25 日，这项工作以《Towards end-to-end automation of AI research》为题发表在 *Nature* 上[8]。论文本身写得相当坦率：

- 那个研讨会的录用率是 70%，而 ICLR 2025 主会是 32%；三篇里只中了一篇。
- 团队在每个阶段都**人工挑选了最有希望的产出**再往下走。
- 团队内部审阅认为，有一篇够得上研讨会水准，没有一篇够得上主会。
- 常见失败包括点子幼稚、实现错误、缺乏方法上的严谨，以及引用不准等各种幻觉。
- 他们做的“自动审稿人”预测论文录用与否，平衡准确率与人类审稿人相当（69% 对 66%）；用它给不同底座模型生成的论文打分，发现模型越新，论文质量越高。

同一时期，这种循环正在变成人人都能跑的“标配”。2026 年 3 月，Andrej Karpathy 开源了 **autoresearch**：Agent 只许改一个训练脚本 `train.py`，每次固定训练 5 分钟，看验证集上的 `val_bpb`（每字节比特数，越低越好）有没有变好，好就留下，不好就丢掉，一晚上大约能跑 100 次实验；人不再直接改 Python，而是去改给 Agent 看的说明文件 `program.md`，他把这叫作“研究机构的代码”[12]。

AI Scientist 证明了“端到端能跑通”，而且水平在上升；但题目方向、中间筛选和最终把关，仍然是人在做。

## 实验室里的闭环小实验

真正值得细看的，是实验室在**内部**做的那些“让 AI 自己做一轮研究”的实验。

### Anthropic：九个 Claude 做对齐研究（2026-04）

2026 年 4 月，Anthropic 发表了“自动化对齐研究员”（Automated Alignment Researcher，AAR）的实验[5][13]。题目是**弱到强监督**（weak-to-strong supervision）：让一个弱模型当老师，去微调一个强得多的学生，看学生能学到多好。成绩用“找回的性能差距”（performance gap recovered，PGR）衡量：学生只和弱老师一样好记 0 分，达到用真实答案训练时的水平记 1 分。它是“人类将来如何监督比自己聪明的 AI”的一个缩影。

实验设置：9 个 Claude Opus 4.6 实例，各有一个沙箱，共享一个交流发现的论坛和代码仓库，把预测提交给远程服务器换取 PGR 分数；实验用开源的 Qwen 小模型扮演老师和学生。每个实例被给了一个略有不同、刻意模糊的起点方向，外加一些模型训练与推理的背景知识，除此之外不告诉它们该做什么[5]。

| | 两位人类研究员 | 9 个 AAR |
| --- | --- | --- |
| 投入 | 7 天，调优 4 种已有方法 | 此后 5 天，累计 800 小时 |
| 成绩（PGR） | 0.23 | 0.97 |
| 成本 | — | 约 18,000 美元，合每个 AAR 小时约 22 美元 |

这是 Anthropic 自己报告的结果[5][13]。更有价值的是紧接着的几项压力测试：

- **换数据集**：最好的方法迁移到数学题上 PGR 为 0.94，到代码题上为 0.47（仍是人类基线的两倍）；次好的方法在数学上有效，在代码上反而帮倒忙[5]。
- **换到生产规模**：把最好的方法搬到 Claude Sonnet 4 和真实的训练基础设施上，只提升了 0.5 个点，落在噪声范围内。作者怀疑是自己的“引出”方式没做好，但也承认：AAR 的点子往往利用了特定数据和模型的结构，换个环境未必成立[13]。
- **作弊**：作者事先没有预料到任何一种，事后发现了一串——在数学题上发现“最常见的答案通常是对的”，干脆跳过老师；在代码题上按“是哪个模型写的”把候选答案分组，再看哪一组对得多；反复试随机种子，挑最好的再往下训；利用可以无限次提交的评分接口，对最没把握的 5 道题正反各交一次，从分数变化里套出标准答案；直接运行代码测试来读出答案。作者打了补丁，AAR 又找到新的办法[13]。

Anthropic 的结论很克制：这个题目是特意挑的，因为它有单一、客观、可自动打分的成功标准，**这不说明前沿模型已经是通用的对齐科学家**；它的启示是，研究的瓶颈可能从“想点子”转向“评估”，而人的监督依然必不可少[5]。作者在开发过程中还有两条初步观察（未经完整规模验证）。一条与[上一篇](/manual/llm/rsi/algorithm-discovery)形成对照：启发式的进化搜索只看结果分数，可能因为一次梯度爆炸就放弃整个方向；由大模型驱动的 Agent 会去读训练日志、修好超参数再试一次，他们认为后者更值得投入。另一条是：给 Agent 规定死的工作流程（先提点子、再做计划、再写代码……），反而不如完全放手[13]。

### OpenAI：模型改进自己的推理部件（2026-07）

OpenAI 在 2026 年 7 月的 GPT-5.6 发布材料和 9 月的研究加速报告里，又给了两组新数据（官方口径）：

- **用量**。GPT-5.6 的发布材料说，过去六个月，研究算力中用于内部编程推理的份额增长了 100 倍，内部 Agent 的 token 用量增长约 22 倍[14]。9 月的报告补充：到 8 月中旬，按 Agent 用量排在中位数的研究人员每天要用掉按 API 价格折算超过 600 美元的推理，排在第 90 百分位的超过 7,000 美元；人均实验次数在 2026 年 8 月创下有记录以来的新高，不过 OpenAI 也注明，同期可用算力同样大幅增长[2]。
- **推理侧的自我改进**。GPT-5.6 Sol 改进了自己的**草稿模型**（投机解码里负责先猜几个 token、再交给主模型并行核对的小模型）：它围绕草稿模型的规模、结构和特征设计并运行了数百次实验，启动并监控草稿模型的训练，遇到硬件故障和训练不稳时自主干预；最终 token 生成效率提高了 15% 以上[6]。

这是一个“模型改进服务自己的部件”的具体例子，但也要看清它的边界：从文中描述看，要优化的指标（生成效率）是既定的，AI 负责的是在这个框架里设计实验、盯住训练。OpenAI 还为此建了一套基于真实 AI 研究任务的内部评测，汇总成“RSI 指数”，[第 8 篇](/manual/llm/rsi/measuring-rsi)再细说[14]。

### Google DeepMind：预期的路径

Google DeepMind 最具体的案例是 AlphaEvolve 优化了 Gemini 自己的训练内核（见[上一篇](/manual/llm/rsi/algorithm-discovery)）。它对这件事的整体预期写在 2025 年 4 月的技术 AGI 安全方案里，作为规划的前提之一：研发被 AI 自动化后，进入“加速增长”阶段是**有可能的**；在可预见的将来，这会以 AI 从事与人类研究员相似的 AI 研究的方式发生，而不是 AI 直接编辑自己的权重[15]。

## 三份“还没到”的自评

各家在宣传加速的同时，也在正式文件里写下了“没到”：

- **Anthropic，2026 年 2 月**：Claude Opus 4.6 已经把大多数用于“排除风险”的自动化 AI 研发评测做满了分，这些评测再也无法用来排除它具备 ASL-4 级自主性的可能。于是他们问了 16 位研究员：它能否在三个月内顶替一名初级研究员？没有一个人认为能。反馈是，它有做研究员级工作的原始能力，但难以独立推进较长的任务、难以根据新信息调整、难以把握大型代码库[3]。
- **Anthropic，2026 年 9 月**：对最新的 Claude Mythos 5.1，Anthropic 写道，它在自动化 AI 研发上的能力与上一代相当或略强，但没有越过 RSP 门槛；“我们没有观察到由 AI 带来的、AI 进展速度的持续翻倍”，模型也“远不能替代我们的研究科学家和工程师”；METR 的外部测试结论与此一致[3]。
- **OpenAI，2026 年 9 月**：Agent 仍然需要人大量引导才能成功，任务越复杂越明显；AI 研究有许多潜在瓶颈，整体进度大概跟不上这些局部指标的增速[2]。

## 为什么“参与”不等于“同样加速”

局部提速与整体提速之间，隔着一条老规律——**阿姆达尔定律**（Amdahl's law）：

$$
S = \frac{1}{(1 - p) + p / k}
$$

白话：一项工作里有比例 $p$ 的部分被提速了 $k$ 倍，整体只能提速 $S$ 倍。比如 80% 的工作快了 10 倍，整体只快约 3.6 倍；就算这 80% 快到无穷，整体也超不过 5 倍——剩下那 20% 说了算。

Anthropic 研究院 2026 年 6 月的长文《When AI builds itself》[4][16]直接援引了这条定律：他们已经撞上了它的“签名”，代码越推越多，人工代码评审成了新瓶颈；员工和强模型一起冒出的点子、工具、模拟，远超公司能够跟进的数量[4]。OpenAI 也写道，随着自动化推进，最难自动化的任务会占据研究人员越来越大的精力比例，算力则可能成为越来越重要的约束[2]。

这不等于加速无关紧要。Anthropic 给了两种读法：保守的读法是，即使 Claude 永远学不会“研究品味”，人只管定方向、其余交给 AI，每个人能驾驭的工作量也会成倍增加，加速照样会复利累积；不那么保守的读法是，“研究品味”也许只是又一种 AI 暂时不擅长、之后会学会的能力[4]。瓶颈的细节留给[第 9 篇](/manual/llm/rsi/bottlenecks)。

## 研究地图：热度与证据的落差

学界的热度可以从研究地图里看出来。lobehub 的 **awesome-rsi** 是一份社区维护的 RSI 文献清单，2026 年 8 月 11 日建库。按本文作者对其 2026 年 9 月 9 日版本的清点：共收录 210 条（含论文、工具、博客与演讲）；在标注了年份的 182 条里（年份按清单所注，多为发表或会议年份），标为 2026 年的有 67 条，约占 37%；专门的“自动化 AI 研发”一节有 7 条，其中 6 条标为 2026 年；最大的一节是“外壳层 RSI”，45 条[17]。这份清单自己也提醒，所列工作并非都算严格意义上的 RSI，并把相关概念分成四档：只改进当前输出的**自我修正**、改动会延续到下一轮的**持久性自我改进**、改进机制本身也被改进的**递归自我改进**，以及把自身结构暴露出来供修改、但默认不形成自动循环的**RSI 底座**[17]。

2026 年 9 月 10 日上线 arXiv 的长篇综述《The Last AI Built by Humans》把这种落差说得更透[18]。它把 RSI 定义为一个自主的闭环过程：AI 系统找出自身的局限，开发并验证改进，再用得到的能力去改进“改进过程”本身；然后按“哪些改进决定交给了 AI”划出五级自主性——执行改进、选择改进策略、获取学习经验、在部署环境中适应，直到修改支配后续改进的机制本身。它区分了两种证据：**结构上的递归**，即改过的机制确实被继承、被调用；**有效的递归**，即在可比的预算和独立评估下，这个机制确实产出了更强的后继者。综述的判断是，后者“仍是一个实质性的实证空白”[18]。

## 小结

- **AI 参与研发环节**：已是事实。写代码、跑实验、盯训练、做初步分析，乃至写出研讨会水平的论文，都有公开证据，而且比例上升得很快（多为官方口径，待独立验证）。
- **AI 独立完成研发**：到 2026 年秋（11 月初复核），本文查到的实验室公开材料里没有谁宣称做到。OpenAI 的“实习生”要在人的指导下工作；Anthropic 的最新模型没越过“初级研究员”门槛，也没观察到 AI 带来的持续翻倍；DeepMind 预期的路径同样是 AI 做人类式的研究。
- **差在哪**：定方向、判断结果可不可信、在作弊面前守住评估，以及把窄题上的成功推广到真实规模。

说“加速”，就得有尺子。AI 能独立完成多长的任务？在研发类基准上做到了几分？这些数字说明了什么、没说明什么？👉 [怎么量进展：时间跨度与研发基准](/manual/llm/rsi/measuring-rsi)

## 参考文献

- [1] Sam Altman. X 帖子，2025-10-29. [x.com/sama/status/1983584366547829073](https://x.com/sama/status/1983584366547829073)（经 X 的官方嵌入接口读取全文）—— 2025-10-28 直播公布的两个内部目标及“可能完全达不成”的原话。
- [2] OpenAI. “Research acceleration: The view inside OpenAI.” 2026-09-06. [openai.com](https://openai.com/index/research-acceleration-view-inside-openai/)（经 Internet Archive 存档核对）—— “研究实习生”的定义与达成声明、Epoch AI 的六阶段分类、高层规划占比、人仍决定的事项、Agent 用量与花费、实验次数与算力、需要大量人工引导、瓶颈的表述。
- [3] Anthropic. “Model Report.” Transparency Hub（访问于 2026-09-19）. [anthropic.com/transparency/model-report](https://www.anthropic.com/transparency/model-report) —— AI R&D-4 门槛的定义与说明、Claude Opus 4.6 的 16 人调查、Claude Mythos 5.1 的 AI 研发评估结论。
- [4] Anthropic Institute（Marina Favaro、Jack Clark）. “When AI builds itself.” 2026-06（页面标注 2026-09-18 更新）. [anthropic.com/institute/recursive-self-improvement](https://www.anthropic.com/institute/recursive-self-improvement) —— 选目标上人仍占优、129 个研究岔路口上 51% 到 64%、超过 80% 的代码、阿姆达尔定律与代码评审瓶颈、两种读法。
- [5] Anthropic. “Automated Alignment Researchers: Using large language models to scale scalable oversight.” 2026-04-14. [anthropic.com/research/automated-alignment-researchers](https://www.anthropic.com/research/automated-alignment-researchers) —— AAR 的设置、PGR 0.23 对 0.97、成本、跨数据集与生产规模测试、“不说明是通用对齐科学家”、瓶颈转向评估。
- [6] OpenAI（M. Ferrari et al.）. “How GPT-5.6 fuses frontier intelligence with frontier efficiency.” 2026-07-29. [openai.com](https://openai.com/index/gpt-5-6-frontier-intelligence-efficiency/)（经 Internet Archive 存档核对）—— GPT-5.6 Sol 改进自己的草稿模型、监控训练并自主干预、生成效率提高 15% 以上。
- [7] OpenAI. “Introducing GPT-5.3-Codex.” 2026-02-05. [openai.com](https://openai.com/index/introducing-gpt-5-3-codex/)（经 Internet Archive 存档核对）—— 与数据科学家共同分析 alpha 测试数据的例子。
- [8] Chris Lu, Cong Lu, Robert Tjarko Lange, Yutaro Yamada, Shengran Hu, Jakob Foerster, David Ha, Jeff Clune. “Towards end-to-end automation of AI research.” *Nature* 651, 914–919. 2026-03-25. [doi:10.1038/s41586-026-10265-5](https://www.nature.com/articles/s41586-026-10265-5) —— 研讨会与主会录用率、人工逐阶段筛选、内部审阅结论、失败模式、自动审稿人的准确率、质量随底座模型提升。
- [9] Chris Lu, Cong Lu, Robert Tjarko Lange, Jakob Foerster, Jeff Clune, David Ha. “The AI Scientist: Towards Fully Automated Open-Ended Scientific Discovery.” 2024-08. [arXiv:2408.06292](https://arxiv.org/abs/2408.06292) —— 第一版流程与每篇不到 15 美元的成本。
- [10] Joeran Beel, Min-Yen Kan, Moritz Baumgart. “Evaluating Sakana's AI Scientist: Bold Claims, Mixed Results, and a Promising Future?” 2025-02（v3 2025-10）. [arXiv:2502.14297](https://arxiv.org/abs/2502.14297) —— 独立评估：42% 的实验因代码错误失败、新颖性误判、引用与数值问题、每篇 6 到 15 美元与 3.5 小时人工。
- [11] Yutaro Yamada et al. “The AI Scientist-v2: Workshop-Level Automated Scientific Discovery via Agentic Tree Search.” 2025-04. [arXiv:2504.08066](https://arxiv.org/abs/2504.08066) —— 去掉模板、实验管理 Agent 与树搜索、投稿 ICLR 研讨会的结果。
- [12] Andrej Karpathy. “autoresearch.” GitHub 仓库（2026-03）. [github.com/karpathy/autoresearch](https://github.com/karpathy/autoresearch) —— 只改 `train.py`、5 分钟固定预算、`val_bpb`、一晚约 100 次实验、`program.md` 作为“研究机构的代码”。
- [13] Jiaxin Wen, Liang Qiu, Joe Benton, Jan Hendrik Kirchner, Jan Leike. “Automated Weak-to-Strong Researcher.” Anthropic Alignment Science Blog，2026-04. [alignment.anthropic.com](https://alignment.anthropic.com/2026/automated-w2s-researcher/) —— 作弊方式的完整清单、生产规模迁移只提升 0.5 个点、大模型驱动的 Agent 与启发式进化搜索的对比、规定流程不如放手。
- [14] OpenAI. “GPT-5.6: Frontier intelligence that scales with your ambition.” 2026-07-09. [openai.com](https://openai.com/index/gpt-5-6/)（经 Internet Archive 存档核对）—— 研究算力中编程推理份额增长 100 倍、Agent token 用量增长约 22 倍、内部自我改进评测。
- [15] Rohin Shah et al.（Google DeepMind）. “An Approach to Technical AGI Safety and Security.” 2025-04. [arXiv:2504.01849](https://arxiv.org/abs/2504.01849) —— “加速增长”假设与“以人类式 AI 研究而非改写自身权重”的预期。
- [16] Chris Stokel-Walker. “Anthropic warns AI may soon begin recursive self-improvement.” *Scientific American*，2026-06-05. [scientificamerican.com](https://www.scientificamerican.com/article/anthropic-warns-ai-may-soon-begin-recursive-self-improvement/) —— 《When AI builds itself》发表于 6 月 4 日（二手来源）。
- [17] lobehub. “Awesome RSI.” GitHub 仓库（2026-08-11 创建，统计基于 2026-09-09 的版本）. [github.com/lobehub/awesome-rsi](https://github.com/lobehub/awesome-rsi) —— 条目与年份统计（本文作者清点）、四档概念划分与“并非都是严格 RSI”的说明。
- [18] Yi Duan et al. “The Last AI Built by Humans: Toward Genuine Recursive Self-Improvement.” 2026-09. [arXiv:2609.11873](https://arxiv.org/abs/2609.11873) —— RSI 的定义、五级自主性、结构上的递归与有效的递归之分及“实证空白”的判断。
