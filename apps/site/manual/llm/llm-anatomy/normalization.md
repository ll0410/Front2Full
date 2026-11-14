---
title: "归一化 · RMSNorm、Pre / Post / 三明治、QK-Norm"
description: "一个“把归一化放哪儿”的小选择，如何实实在在左右训练稳定性。RMSNorm 早已统一；真正还在分歧的是放置：多数 Pre-Norm，OLMo 2 偏要回到 Post-Norm，Gemma 用前后都放的三明治，而 QK-Norm 与注意力输出门控正在成为新标配。"
source: "https://daiw.org/manual/llm-anatomy/normalization"
---

# 归一化 · RMSNorm、Pre / Post / 三明治、QK-Norm

> 一个“把归一化放哪儿”的小选择，如何实实在在左右训练稳定性。RMSNorm 早已统一；真正还在分歧的是放置：多数 Pre-Norm，OLMo 2 偏要回到 Post-Norm，Gemma 用前后都放的三明治，而 QK-Norm 与注意力输出门控正在成为新标配。

归一化（Normalization）是个容易被当作“例行公事”的零件——不就是把数值缩一缩、稳住训练嘛。但恰恰在“**放哪儿**”这个细节上，各家藏着不同心思，而且直接关系到**几百层的大模型能不能训得稳、不崩**。

## 先说已经统一的：RMSNorm

nanoGPT 里用的是 **LayerNorm**：先减均值、再除标准差，把每个向量拉回“零均值、单位方差”。

现代模型几乎全换成了 **RMSNorm**（Zhang & Sennrich，2019）：**省掉“减均值”那一步，只除以均方根（RMS）**。少算一个统计量，更快；实践证明**效果不掉**。所以和 RoPE、SwiGLU 一样，RMSNorm 是“2024 出厂设置”，不是谁的创新。

真正还有分歧、值得对比的，是下面这个——**归一化到底放在子层的前面、后面，还是前后都放。**

## 分歧点：Norm 放前（Pre）还是放后（Post）

回忆一个 Transformer 子层的三件套：**归一化、子层运算（注意力 / 前馈）、残差相加**。这三者的**顺序**，有讲究：

- **Post-Norm（原始 Transformer，2017）**：先算子层、和残差相加，**最后**再归一化。`x = Norm(x + Sublayer(x))`。这是 Vaswani 那篇原版的做法。它的毛病是**深了难训**——梯度容易爆或消，当年得靠学习率 warmup 小心伺候。
- **Pre-Norm（GPT-2 起的标配）**：**先**归一化，再进子层，输出直接加回残差。`x = x + Sublayer(Norm(x))`。你在 [nanoGPT 的 Block](https://daiw.org/manual/nanogpt/model-overview) 里读到的正是它。好处是**残差是一条干净的“高速公路”**，梯度直通到底，深网络也稳，不太需要小心翼翼。

**Pre-Norm 赢麻了，成了默认。** 但它并非完美：Pre-Norm 下，**残差流的数值会随深度越滚越大**，极深的模型这也会带来隐患。于是，在“Pre 已成共识”的大背景下，偏偏有人回头去动这个开关——

## 两个“不随大流”的：OLMo 2 与 Gemma

**OLMo 2（Ai2，2024）偏要用回 Post-Norm。** 但它做了改良：归一化放在子层**之后**、却仍在**残差内部**（论文称之为“reordered norm”）。团队发现：**Post-Norm 配合 QK-Norm（下面讲），能显著改善训练时梯度范数的增长曲线和尖峰**，让训练更稳。这是个基于实测、逆共识的选择——很能说明“Pre-Norm 是默认，但不是铁律”。

**Gemma 2 / 3 则是“我全都要”——三明治归一化（sandwich）**：在每个子层的**前面和后面各放一个 RMSNorm**。等于 Pre 和 Post 的稳定性一起吃，代价是多算一遍归一化。这是 Google DeepMind 求稳的“双保险”。

## 新标配：QK-Norm 与注意力输出门控

除了“放哪儿”，近两年还冒出两个越来越流行的加法：**QK-Norm** 与**注意力输出门控（Gated Attention）**。

**QK-Norm** 的做法是：在算注意力之前，**额外对 Query 和 Key 各做一次归一化**（通常在 RoPE 之前）。动机是**稳住注意力的打分**——回忆 [nanoGPT 注意力](https://daiw.org/manual/nanogpt/attention)里那个 $QK^\top$，如果 Q、K 的数值失控，点积会爆、softmax 会走极端、训练会抖。先把 Q、K 归一化，注意力打分就温顺得多，大规模训练更稳。QK-Norm 最早在视觉 Transformer（如 ViT-22B）上被验证有效，如今 **Qwen3、OLMo 2、Gemma、GLM-4.5、GPT-OSS 都用上了**，俨然成了新的“出厂设置”。

到了 2026 年的万亿级模型（[Qwen3.8-Max](https://daiw.org/manual/qwen3-8-max/architecture) 与 [Kimi K3 / K3.1 Pro](https://daiw.org/manual/kimi-k3/hybrid-stack)），又多了一个护栏：**注意力输出门控（Gated Attention / Gated MLA）**——在注意力输出投影回残差流之前，乘上一个由输入算出的 Sigmoid 门控。它既给注意力子层加了非线性表达力，又给每個注意力头装了一个“静音开关”，能把不需要匹配的头直接关掉，从根上消除了注意力汇聚点（attention sink）和长序列激活值爆炸，让超大规模 FP4/FP8 训练更稳。

## 一张表看放置之争

| 模型 | 归一化 | 放置 | QK-Norm / 输出门控 |
| --- | --- | --- | --- |
| 原始 Transformer | LayerNorm | Post | 无 |
| GPT-2 / nanoGPT | LayerNorm | Pre | 无 |
| Llama / Qwen（主流） | RMSNorm | Pre | Qwen3 起有 QK-Norm |
| **OLMo 2** | RMSNorm | **Post（改良）** | **有 QK-Norm** |
| **Gemma 2 / 3** | RMSNorm | **Pre + Post（三明治）** | 有 QK-Norm |
| GLM-4.5 / GPT-OSS | RMSNorm | Pre | 有 QK-Norm |
| **Qwen3.8-Max / Kimi K3** | RMSNorm（Kimi K3 配合 AttnRes） | Pre | **有 QK-Norm + 注意力输出 Sigmoid 门控** |

::: info

这一章的启示很“工程”：**归一化不改变模型“能表达什么”，只影响“能不能稳稳地训出来”。** 它是那种“选对了没人夸、选错了训到一半崩”的零件。也正因为如此，当一个团队敢逆着“Pre-Norm”的共识去用 Post（OLMo 2）或三明治（Gemma），或者在 90 多层的万亿模型里加上注意力输出门控和跨层注意力残差（Kimi K3），背后都是**扎实的稳定性实测**在撑腰——这类选择，比随大流更值得你留意。

:::

## 下一维：位置编码怎么撑起几十万上下文

归一化管“训得稳”，下一个维度管“看得远”。RoPE 早已一统位置编码，但把上下文从 4K 拉到 128K、乃至上百万，RoPE 得动点手脚（YaRN 等）；甚至有人提出**干脆不要位置编码（NoPE）**也能外推。这是下一章。👉 [位置编码与长上下文：RoPE、YaRN，与 NoPE 的挑衅](/manual/llm/llm-anatomy/positional-encoding)

## 参考文献

- [1] Vaswani et al. “Attention Is All You Need.” NeurIPS 2017. arXiv:1706.03762. —— 原始 Post-Norm。
- [2] Zhang & Sennrich. “Root Mean Square Layer Normalization.” NeurIPS 2019. arXiv:1910.07467. —— RMSNorm。
- [3] Xiong et al. “On Layer Normalization in the Transformer Architecture.” ICML 2020. arXiv:2002.04745. —— Pre-Norm 的稳定性分析。
- [4] OLMo Team, Ai2. “2 OLMo 2 Furious.” 2024. arXiv:2501.00656. —— 改良 Post-Norm + QK-Norm 的稳定性论证。
- [5] Dehghani et al. “Scaling Vision Transformers to 22 Billion Parameters.” 2023. arXiv:2302.05442. —— QK-Norm 在超大模型上的应用。
- [6] Henry et al. “Query-Key Normalization for Transformers.” EMNLP Findings 2020. arXiv:2010.04245. —— QK-Norm 的早期提出。
