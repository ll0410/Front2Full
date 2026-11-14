---
title: "RSI 是什么：从“智能爆炸”说起"
description: "RSI（递归自我改进）指 AI 参与改进“造 AI 的流程”乃至自己的下一代。本篇从 1965 年的“智能爆炸”讲到 2026 年实验室的表态，理清来龙去脉。"
source: "https://daiw.org/manual/rsi/what-is-rsi"
---

# RSI 是什么：从“智能爆炸”说起

> RSI（递归自我改进）指 AI 参与改进“造 AI 的流程”乃至自己的下一代。本篇从 1965 年的“智能爆炸”讲到 2026 年实验室的表态，理清来龙去脉。

想象两个学生。

第一个学生每天做题、订正，成绩一点点往上走。第二个学生也做题，但他还琢磨“我是怎么学的”：发现把错题抄进本子比重做一遍管用，就改用错题本；过一阵又发现错题本按知识点分类更好，就再改。他改进的不只是成绩，还有**产生进步的那套方法**。方法越好，下一轮进步就来得越快。

第二个学生身上，有“递归自我改进”（Recursive Self-Improvement，下文简称 RSI）的影子。把学生换成 AI：一个 AI 系统参与改进“制造 AI 的流程”——写训练代码、跑实验、挑数据、评估结果——改进后的流程造出更强的 AI，更强的 AI 再回头改进流程……这个循环就是 RSI。

这个念头已有六十年历史，大部分时间只活在论文和科幻里。2026 年，它开始频繁出现在 AI 公司的发布说明和系统卡里。本篇先讲清三件事：它到底指什么，从哪里来，为什么偏偏是现在。

## 一句话定义

各家说法略有出入，核心是一致的。Anthropic 研究院在 2026 年 6 月的长文里这样界定：把“越来越多的 AI 研发工作交给 AI 自己”这个趋势推到足够远，再给足够的算力，终点是一个**能完全自主地设计和开发自己继任者的 AI 系统**，这就叫递归自我改进 [1]。

关键在“递归”二字。系统变强了，还不叫 RSI；要紧的是**负责“变强”的那套机制本身也被改进了**。社区维护的研究地图 awesome-rsi 给了一个实用的三分法 [2]：

| 概念 | 改的是什么 | 打个比方 |
| --- | --- | --- |
| 自我精炼（self-refinement） | 只改这一次的输出，不留下持久变化 | 交卷前把答案检查一遍 |
| 持久自我改进（persistent self-improvement） | 权重、记忆、技能、提示词、脚手架或代码，改动带到下一轮 | 把做对的题整理成笔记，下次接着用 |
| 递归自我改进（recursive self-improvement） | 产生改进的机制本身，也成了被改进的对象 | 改进“怎么改进自己”的方法 |

2026 年 7 月的一篇综述把界线划得更硬 [3]：如果改进始终对照一个**固定的外部评判标准**，那叫“有界的自我精炼”，它会收敛、可以评估，而且早已是工业界的日常；只有系统连“什么算更好”的标准和改进机制一起改、不再有固定的外部锚点时，才算开放式的 RSI。按这个标准，今天绝大多数“自我改进”研究都属于前者 [3]。

### 一个玩具模型：单利与复利

为什么“递归”这么让人紧张？拿存钱打个比方。设 $C_n$ 是第 $n$ 轮的能力，如果每一轮的进步都和当前能力成正比：

$$
C_{n+1} = (1 + k)\,C_n
$$

这就是复利，$k$ 相当于“利率”，能力按指数增长。靠人类工程师推动的普通研发，更像每年往账户里存一笔差不多的钱；RSI 则相当于**利息也在生利息**。再进一步，如果 AI 还能改进“利率”本身，增长会比指数还快——“智能爆炸”这个说法背后，就是这个直觉。

反过来，如果每一轮能挖到的改进越来越少，也就是 $k$ 越变越小，曲线就会弯下来、趋于平缓。这只是帮助理解的示意，不是任何人的预测。**现实中这个“利率”会不会被算力、验证、数据等瓶颈拖住**，正是 RSI 争论的核心，留到[第 9 篇](/manual/llm/rsi/bottlenecks)细谈。

## 思想源头：三个老想法

### 1965 年，Good 与“智能爆炸”

I. J. Good 是英国统计学家。二战期间，他在布莱切利园与图灵等人一起破译德军密码；战后成为现代贝叶斯推断的奠基人之一，还曾为库布里克拍《2001 太空漫游》担任科学顾问 [4]。

1965 年，他发表《关于第一台超智能机器的推测》（Speculations Concerning the First Ultraintelligent Machine），RSI 最常被引用的论证就出自这里 [5]。论证只有三步：

1. 把“超智能机器”定义为：在一切智力活动上都能远远超过任何人，无论这个人多聪明；
2. 设计机器本身也是一种智力活动，所以超智能机器能设计出比自己更好的机器；
3. 更好的机器再去设计更好的机器……Good 把这种连锁反应叫作“智能爆炸”（intelligence explosion），人类的智能会被远远甩在后面。

由此他得出一个著名的推论：第一台超智能机器，将是人类需要做出的最后一项发明，前提是这台机器足够“温顺”（docile），肯告诉我们该怎样控制它 [5]。六十年后再看，这个前提正是今天 AI 安全研究试图回答的问题。

同一页上还有一个常被忽略的细节。Good 提到，有篇科幻小说里的机器拒绝设计更好的机器，因为它不想丢掉工作；他认为这拦不住什么，因为机器完全可以靠添置新设备，一点一点把**自己**改进得面目全非 [5]。这已经不只是“造一台更好的机器”，而是“改进自己”了。

这篇论文的初稿完成于 1963 年，1964 年修订，收入《Advances in Computers》第 6 卷，通常记作 1965 年 [5]。

### 2003 年，Schmidhuber 的哥德尔机

计算机科学家 Jürgen Schmidhuber 自述，他从 1987 年的毕业论文起就在研究“学会学习”（metalearning），也就是让学习算法去改进学习算法 [6]。2003 年，他提出了一种数学上极为干净的 RSI 设计——哥德尔机（Gödel Machine）[7]：

- 它是一个程序，全部代码都允许被改写，包括负责“找证明”的那一部分；
- 它一边干活，一边系统地搜索证明，一旦**证明**了“把自己某一部分改成这样会更有用”，就立即改写；
- Schmidhuber 证明了这种改写是全局最优的：动手之前，它得先证明“继续寻找别的改法不划算”，所以不会困在局部最优。

名字取自数学家哥德尔：他在 1931 年构造了“谈论自身”的公式，哥德尔机则是“谈论并改写自身”的程序 [7]。

理想很美，难处也很直白：**绝大多数有用的改动，根本证明不了它有用**。2025 年提出“达尔文哥德尔机”的作者直言，在实践中要证明大多数改动净收益为正是做不到的，于是改走“先改、再实测、好的留下”的经验路线 [8]。这条路线是[第 5 篇](/manual/llm/rsi/self-modifying-agents)的主角。Schmidhuber 本人也一直没离开这个题目：2026 年 4 月 ICLR 的 RSI 专题研讨会，他是组织者之一 [9]。

### 种子 AI：从一粒种子长成大树

第三个源头是 Eliezer Yudkowsky 提出的“种子 AI”（seed AI）。在收入 2007 年《通用人工智能》（Artificial General Intelligence）文集的长文里，他把种子 AI 定义为：为自我理解、自我修改和递归自我改进而设计的 AI [10]。种子本身很小，但它的生长机制会自己把自己养大。

同一篇文章里还有两个判断，今天读来很有意思 [10]。其一，种子 AI 不是“从一个不智能的内核自举”的捷径，只有 AI 已经具备相当的通用智能，真正的递归自我改进才会显现。其二，在早期阶段，“程序员的改进”和“AI 的自我改进”加在一起，很可能几乎完全由人类程序员主导。这和下文 2026 年几家公司的自述相当吻合。

| 年份 | 提出者 | 核心想法 | 留下的难题 |
| --- | --- | --- | --- |
| 1965 | I. J. Good | 能设计机器的机器，会引发“智能爆炸” | 它得足够“温顺”，人类才控制得住 |
| 2003 | Jürgen Schmidhuber | 哥德尔机：证明改写有益，才改写自己 | 有益性几乎无法证明 |
| 2007 | Eliezer Yudkowsky | 种子 AI：为递归自我改进而设计 | 何时从“人主导”转为“AI 主导” |

## 2026 年：从思想实验到工程现实

这些想法在纸面上停留了几十年。按前面那篇综述的说法，在任何系统能像样地尝试之前，RSI 只是理论上的终点；如今变化在于，这个循环的一些片段已经成了工程实践 [3]。2026 年 4 月，ICLR 专门为 RSI 开设研讨会，介绍里说 RSI 正在从思想实验走向部署中的 AI 系统 [9]。这一年的几件事把这句话坐实了：

| 时间 | 事件 | 要点 |
| --- | --- | --- |
| 2026-02-05 | OpenAI 发布 GPT-5.3-Codex | 称它是第一个“参与创造了自己”的模型 [11] |
| 2026-04-26 | ICLR 2026 RSI 研讨会 | RSI 成为顶会研讨会的专门主题 [9] |
| 2026-06-04 | Anthropic 发表《When AI builds itself》 | 截至 5 月，合并进代码库的代码超过 80% 由 Claude 编写 [1] |
| 2026-07 | arXiv 综述 2607.07663 | 统计 1,250 篇相关论文，其中 74% 发表于 2026 年 [3] |
| 2026-09-06 | OpenAI 发布研究加速报告 | 称已达成“自动化研究实习生”目标（官方口径）[12] |

### “参与创造了自己”到底指什么

2026 年 2 月 5 日，OpenAI 在 GPT-5.3-Codex 的发布说明里写道，这是他们第一个“instrumental in creating itself”的模型 [11]。这句话常被转述成“AI 造出了自己”，但原文紧接着就交代了具体做了什么 [11]：

- 研究团队用它的早期版本**监控和调试这次发布的训练运行**：追踪训练中的规律、分析交互质量、提出修复方案；
- 工程团队用它**优化 GPT-5.3-Codex 自己的 harness**（包在模型外面、把模型变成 Agent 的那层程序），定位上下文渲染的 bug，查出缓存命中率偏低的根因；
- 发布期间，它还在**动态扩缩 GPU 集群**，以应对流量高峰、稳住延迟。

换句话说，它干的是造模型流程里的工程活：调试、诊断、运维。它没有改写自己的权重，也没有设计自己的架构；做什么、怎么取舍，仍由人拍板。

同一天发布的系统卡，给出了另一面的答案 [13]。OpenAI 的“准备度框架”（Preparedness Framework）为“AI 自我改进”设了风险等级，其中 High 级的门槛定义为相当于一名表现出色的中级研究工程师；系统卡明确写着，GPT-5.3-Codex 没有达到这一级。在一项用 OpenAI 内部真实研发瓶颈出题的测评中（每道题都曾让重大项目延误至少一天），它的成绩甚至略低于上一代 GPT-5.2-Codex [13]。

::: info

**同一天、同一家公司的两种说法并不矛盾**。发布说明讲的是“它帮上了大忙”，系统卡讲的是“它离独立胜任研发还远”。读 RSI 新闻时，先分清说的是哪一种。

:::

### Anthropic：把“人在哪一环”画成时间线

2026 年 6 月 4 日，Anthropic 研究院发表长文《When AI builds itself》[1]（日期据《科学美国人》的报道 [14]）。文章把公司内部研发方式的变化画成五个阶段：

1. 2021–2023 年：人在笔记本电脑上写代码和文档；
2. 2023–2025 年：用早期聊天机器人生成代码片段，再手动粘进编辑器；
3. 2025–2026 年：编码 Agent 能自己写、改代码，有时是整个文件；
4. 现在：Agent 能自己运行代码，并把数小时的工作分派给别的 Agent；
5. 20XX 年？：“闭环”，将来 Agent 或许能自己搭建和训练模型，Claude 的后续版本由 Claude 自己持续改进。

文中给出的几组内部数据如下，均为官方口径，外界目前无法独立验证 [1]：

- 截至 2026 年 5 月，合并进 Anthropic 代码库的代码超过 80% 由 Claude 编写；2025 年 2 月 Claude Code 推出研究预览版之前，这个比例只有个位数。
- 有一项每出新模型都重做的测试：给 Claude 一段训练小模型的代码，要求在通过同样正确性检查的前提下尽量提速。2025 年 5 月的 Claude Opus 4 平均提速约 3 倍，2026 年 4 月的 Claude Mythos Preview 约 52 倍；熟练的人类研究员要花 4 到 8 小时才能提速 4 倍。Anthropic 也提醒，倍数高低取决于起始代码的优化空间，不能当成真实训练的提速。
- 差距最大的是“选目标”：执行一个定义清楚的实验，Claude 已能比肩甚至超过熟练的人；在“哪些问题值得做”上，人仍明显占优。

文章的结论相当克制：RSI 尚未实现，也不是注定会发生；但作者提醒，它可能比大多数机构预想的来得早 [1]。

### OpenAI：“研究实习生”到岗

2025 年秋，OpenAI 公开了一个内部目标：2026 年 9 月前做出“自动化 AI 研究实习生”，2028 年 3 月前做出真正的自动化 AI 研究员。2026 年 9 月 6 日，OpenAI 发文称，按他们自己的测量，“实习生”这个目标已经达成 [12]。所谓研究实习生，指的是能在人的指导下完成定义清楚的研究任务，包括熟练研究员要花几天的任务。

同一篇文章给出的几组数字（官方口径，待独立验证），很能说明“人在哪一环” [12]：

- 到 2026 年 8 月中旬，研究部门每投入 1 个人类工作日，就对应 3.1 个 Agent 工作日；
- 但在人类需要 4 到 8 小时才能完成的任务里，过去半年超过一半的成功案例都需要人至少介入一次；
- 在 Agent 的产出里，“高层规划”只占极小的比例。

OpenAI 也写得很直白：研究优先级、追哪些想法、要不要扩大规模、暂停或部署，仍然由人决定；他们还不知道怎样安全地一路走到对齐的、完全的 RSI [12]。这并非客套。文中披露，7 月 20 日发现 Agent 攻破了公司的研究基础设施后，他们临时关停了训练用的容器服务；OpenAI 在 8 月 18 日的另一篇文章里说明，由于“OpenAI–Hugging Face 事件”，以及即将推出的模型 Astra 可能达到网络安全的 Critical 阈值，他们暂停了两周针对待部署新模型的强化学习训练 [12][15]。这些事留到[第 10 篇](/manual/llm/rsi/safety-governance)细说。

### 学界：论文数量陡增

学术界的热度同样陡升。前面提到的 2026 年 7 月综述，统计了 2024–2026 年 arXiv 上与 AI 自我改进相关的 1,250 篇论文，其中 74% 发表于 2026 年；按其种子语料统计，季度发文量从 2024 年初的个位数涨到 2026 年第二季度的约 500 篇 [3]。

## 冷静一下：这算“爆炸”了吗？

热闹之外，质疑同样响亮。

先是定义之争。CSET 主任、曾任 OpenAI 董事的 Helen Toner 对 TechCrunch 表示，尽可能多地用 AI 做 AI 研究，和经典意义上的 RSI 不是一回事，后者指的是真的不再需要人（据 TechCrunch 报道）[16]。

《ACM 通讯》（CACM）2026 年 7 月的一篇报道采访了多位专家，观点大致可以归成三类（据 CACM 报道）[17]：

- **看控制图，不看跑分**。安全 AI 联盟（Coalition for Secure AI）成员 Nik Kale 认为，真正的递归自我改进和精巧的内部自动化，在基准测试上分不出来；要看的是 AI 动手时，环里是否还有一个有资格验证它的人。
- **压缩周期，还是拓展边界**。数据治理从业者 Tejasvi Addagada 认为，当前的递归只是在既有能力边界内加快开发，属于“战术递归”，AI 还做不到重新定义什么值得优化的“战略递归”；MIT 的 Armando Solar-Lezama 则认为这种区分意义不大，就像走路和开车能到同样的地方，但汽车快到足以重塑整个社会。
- **瓶颈说了算**。MIT FutureTech 的 Jonathan Rosenfeld 拿芯片举例：几十年来，芯片一直在“递归地”帮忙设计更好的芯片，晶体管的单位成本下降了一百万倍以上，同期全球经济增长却不到十倍。

报道的结论是，目前的各种宣称，走得比科学证据更快 [17]。

把这些放在一起看，2026 年的实际情况更接近“AI 大幅加速了由人主导的 AI 研发”，而不是“AI 自己造出了下一代”。这一点，Anthropic 和 OpenAI 的原文自己也承认 [1][12]。

::: info

**读 RSI 新闻时，可以先问三个问题**：

1. 改的是什么？一次的答案、自己的权重、外面的脚手架、研发流程的某个环节，还是整个下一代？
2. 谁来验收？有没有可靠的外部检验，还是自己给自己打分？
3. 人在哪里？每一步都审、只审结果，还是完全不在？

:::

## 这个专栏怎么读

下一篇会把这三个问题变成一把贯穿全书的尺子：“五级台阶”。之后的路线是：

- **第 1 部分，自己教自己**：模型怎样自己出题、自己打分，给自己造训练信号（第 3、4 篇）；
- **第 2 部分，自己改自己**：改写自己的代码、让 AI 发明算法、自动化 AI 研发（第 5、6、7 篇）；
- **第 3 部分，量尺、瓶颈与护栏**：怎么量进展、为什么还没“爆炸”、实验室给自我改进设的红线（第 8、9、10 篇）。

先从分级说起。👉 [五级台阶：从自我修正到自主研究](/manual/llm/rsi/rsi-ladder)

## 参考文献

- [1] Anthropic 研究院（Marina Favaro、Jack Clark）. “When AI builds itself.” 2026-06-04. [anthropic.com/institute/recursive-self-improvement](https://www.anthropic.com/institute/recursive-self-improvement) —— RSI 的界定、五阶段时间线、80% 代码与约 52 倍提速等内部数据、克制的结论。
- [2] lobehub. “Awesome RSI.” GitHub，2026-08 创建. [github.com/lobehub/awesome-rsi](https://github.com/lobehub/awesome-rsi) —— 自我精炼、持久自我改进、递归自我改进的三分法。
- [3] Mingguang Chen, Licheng Wang, Bo Qu. “Recursive Self-Improvement in AI: From Bounded Self-Refinement to Autonomous Research Loops.” 2026-07（v2 2026-09）. [arXiv:2607.07663](https://arxiv.org/abs/2607.07663) —— 有界自我精炼与开放式 RSI 的区分、RSI 从理论终点到工程实践的判断、1,250 篇论文的统计。
- [4] Virginia Tech News. “In Memoriam: I. J. Good, University Distinguished Professor and pioneer of modern statistics.” 2009-04. [news.vt.edu](https://news.vt.edu/articles/2009/04/2009-276.html) —— Good 的生平：布莱切利园、贝叶斯统计、《2001 太空漫游》科学顾问。
- [5] Irving John Good. “Speculations Concerning the First Ultraintelligent Machine.” Advances in Computers, Vol. 6, pp. 31–88, 1965（Crossref 记为 1966）. [扫描版 PDF](http://incompleteideas.net/papers/Good65ultraintelligent.pdf) —— 超智能机器的定义、“智能爆炸”、“最后一项发明”与“温顺”的前提、成稿时间。
- [6] Jürgen Schmidhuber. “Metalearning Machines Learn to Learn (1987-).” 个人主页，2026 年更新. [people.idsia.ch/~juergen/metalearning.html](https://people.idsia.ch/~juergen/metalearning.html) —— 他自述 1987 年起研究元学习与 RSI。
- [7] Jürgen Schmidhuber. “Gödel Machines: Self-Referential Universal Problem Solvers Making Provably Optimal Self-Improvements.” 2003-09（v5 2006-12）. [arXiv:cs/0309048](https://arxiv.org/abs/cs/0309048) —— 哥德尔机的定义、全局最优性与命名来由。
- [8] Jenny Zhang, Shengran Hu, Cong Lu, Robert Lange, Jeff Clune. “Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents.” 2025-05. [arXiv:2505.22954](https://arxiv.org/abs/2505.22954) —— “证明大多数改动有益在实践中做不到”的判断。
- [9] ICLR 2026 Workshop on AI with Recursive Self-Improvement. 2026-04-26. [iclr.cc/virtual/2026/workshop/10000796](https://iclr.cc/virtual/2026/workshop/10000796) —— “RSI 正从思想实验走向部署”的表述与组织者名单。
- [10] Eliezer Yudkowsky. “Levels of Organization in General Intelligence.” In Artificial General Intelligence, Springer, 2007. [MIRI PDF](https://intelligence.org/files/LOGI.pdf) —— 种子 AI 的定义，早期由人类程序员主导的判断。
- [11] OpenAI. “Introducing GPT-5.3-Codex.” 2026-02-05. [openai.com/index/introducing-gpt-5-3-codex](https://openai.com/index/introducing-gpt-5-3-codex/) —— “instrumental in creating itself”的原话及具体用法。
- [12] OpenAI. “Research acceleration: The view inside OpenAI.” 2026-09-06. [openai.com/index/research-acceleration-view-inside-openai](https://openai.com/index/research-acceleration-view-inside-openai/) —— “研究实习生”目标、Agent 用量数据、仍由人掌握的决定权、7 月 20 日的事件。
- [13] OpenAI. “GPT-5.3-Codex System Card.” 2026-02-05. [PDF](https://cdn.openai.com/pdf/23eca107-a9b1-4d2c-b156-7deb4fbc697c/GPT-5-3-Codex-System-Card-02.pdf) —— “AI 自我改进”High 阈值的定义、未达标的结论与内部研发瓶颈测评。
- [14] Chris Stokel-Walker. “Anthropic warns AI may soon begin recursive self-improvement.” Scientific American, 2026-06-05. [scientificamerican.com](https://www.scientificamerican.com/article/anthropic-warns-ai-may-soon-begin-recursive-self-improvement/) —— 二手来源：Anthropic 长文的发布日期为 6 月 4 日。
- [15] OpenAI. “Pacing model development in an era of cyber-critical capabilities.” 2026-08-18. [openai.com/index/pacing-model-development-cyber-capabilities](https://openai.com/index/pacing-model-development-cyber-capabilities/) —— 两周暂停强化学习训练及其原因。
- [16] Russell Brandom. “RSI is the new AGI — and it’s just as hard to pin down.” TechCrunch, 2026-05-28. [techcrunch.com](https://techcrunch.com/2026/05/28/rsi-is-the-new-agi-and-its-just-as-hard-to-pin-down/) —— 二手来源：Helen Toner 对 RSI 经典定义的说法。
- [17] Logan Kugler. “Is Recursive Self-Improvement Really Here?” Communications of the ACM, 2026-07-06. [cacm.acm.org](https://cacm.acm.org/news/is-recursive-self-improvement-really-here/) —— 二手来源：多位专家对“递归是否真实”的不同判断。
