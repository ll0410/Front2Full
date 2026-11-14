---
title: "位置编码与长上下文 · RoPE、YaRN，与 NoPE 的挑衅"
description: "RoPE 早已一统位置编码——它不加位置向量，而是“旋转”Q、K。可要把上下文从 4K 拉到几十万乃至百万，RoPE 得动手脚：位置插值、NTK、YaRN、Partial RoPE。而 NoPE 更激进：干脆不要位置编码，靠因果掩码或线性注意力的衰减门也能外推。"
source: "https://daiw.org/manual/llm-anatomy/positional-encoding"
---

# 位置编码与长上下文 · RoPE、YaRN，与 NoPE 的挑衅

> RoPE 早已一统位置编码——它不加位置向量，而是“旋转”Q、K。可要把上下文从 4K 拉到几十万乃至百万，RoPE 得动手脚：位置插值、NTK、YaRN、Partial RoPE。而 NoPE 更激进：干脆不要位置编码，靠因果掩码或线性注意力的衰减门也能外推。

注意力有个“天生缺陷”：它**分不清顺序**。“猫追狗”和“狗追猫”，在纯注意力眼里是一样的一堆词。所以必须额外告诉模型“谁在第几位”——这就是**位置编码**。这一维，RoPE 早已一统江湖；真正还在较劲的，是**怎么把上下文撑到几十万乃至上百万**。

## 从“查位置表”到“旋转”

nanoGPT 用的是**学习式绝对位置嵌入**（`wpe`）：建一张“第 0 位、第 1 位……”的向量表，加到词向量上。简单，但有硬伤：**表是定长的**（`block_size`），**超出训练长度就抓瞎**——第 2000 位长什么样，一个只见过 1024 位的表根本不知道。

**RoPE（旋转位置编码，Su et al.，2021）** 换了个思路：不“加”位置向量，而是**按位置“旋转”Q 和 K**。把 Q、K 的维度两两配对，每一对看成平面上的一个向量，**按“位置 × 频率”的角度转一下**——在位置 $m$ 处，第 $i$ 对维度就旋转 $m\theta_i$ 这么大的角度。

不同的维度对，用不同的频率 $\theta_i$——像钟表上的秒针、分针、时针，转速各异。这样设计有两个漂亮性质：

1. **它是“相对”的**：位置 $m$ 的 Q 和位置 $n$ 的 K 做点积，结果**只取决于相对距离 $m-n$**，不管它俩的绝对位置在哪。而“相对距离”恰恰是语言里真正重要的东西。
2. **它天然可外推（有限度地）**：旋转是连续的，第 2000 位不过是“多转了些圈”，不像查表那样“表里没有就完蛋”。

凭这两点，RoPE 成了现代大模型**清一色**的选择：Llama、Qwen、DeepSeek、GLM、Gemma、Mistral……无一例外。

## 长上下文的坎：RoPE 也不能白嫖

但“可外推”是有限度的。RoPE 在某个长度（比如 4K）上训练，高频那几对维度在 4K 内就转了很多整圈；一旦超出训练长度太多，**这些高频维度进入了模型从没见过的“相位区域”，注意力就乱套**。所以直接拿 4K 训的模型去跑 100K，多半胡言乱语。

于是有了一串“给 RoPE 动手脚”的长上下文扩展法：

- **位置插值（Position Interpolation，Chen et al.，2023）**：与其让位置索引冲出训练范围，不如**把长序列的位置“压缩”回训练范围内**（线性缩放位置索引）。相当于“把尺子刻度捏密”。简单有效，配一点微调就能把 4K 撑到 32K+。
- **NTK-aware 缩放**：不均匀地改旋转基频，让**高频维度少受拉伸、低频维度多担扩展**，尽量不破坏局部精度。常被用作免微调的快速扩展。
- **YaRN（Peng et al.，2023）**：把插值和“按频率分别缩放”结合起来，再加一点注意力温度校正。**用很少的微调，就能高效地把上下文拉长**，而且长短上下文性能都保得住。Qwen、DeepSeek、Kimi 等模型的长上下文扩展都以它为主力。
- **部分旋转位置编码（Partial RoPE）**：只对注意力头的一部分维度（例如 25% 或 50%）施加 RoPE，其余维度完全不加位置旋转（例如 [Qwen3.8-Max](https://daiw.org/manual/qwen3-8-max/architecture) 的 `partial_rotary_factor = 0.25`，256 维头里只有 64 维做旋转；DeepSeek 的解耦 RoPE 也是 64 维携带位置、512 维走无位置潜向量）。这样语义匹配和位置衰减各走各的通道，拉长到 256K–1M 上下文时更加稳健。

::: info

记住这条线的逻辑：**RoPE 负责“表达位置”，而 YaRN + Partial RoPE 负责“把训练时的短上下文，安全地外推到推理时的百万上下文”。** 后者是这两年长上下文竞赛（256K、1M token）背后的关键工程，各家拼的很大程度是这里。

:::

## NoPE 的挑衅：干脆不要位置编码？

正当大家在 RoPE 上精雕细琢，有人抛出一个反直觉的问题：**decoder-only 模型，真的需要显式的位置编码吗？**

**Kazemnejad et al.（2023）** 的研究给了个惊人的答案：**不加任何位置编码（NoPE，No Positional Encoding）的 decoder-only 模型，照样能学会位置，而且在“外推到更长长度”上，常常比某些显式方案还好。**

怎么可能？秘密在你早就学过的那道**因果掩码**（[nanoGPT 注意力](https://daiw.org/manual/nanogpt/attention)）。因果掩码规定“只能看左边”，这本身就**打破了对称性**——第 3 个 token 能看到 3 个位置、第 10 个能看到 10 个，模型能从“我能看到几个”间接数出自己在第几位。位置信息，**被因果结构悄悄泄露了出来**，不必显式编码。

这不是纯理论玩具。一些新模型（如 SmolLM3）已经在**一部分层用 NoPE、其余层用 RoPE** 的混搭，试图兼得 NoPE 的外推性和 RoPE 的精度。而到了 2026 年的 [Kimi K3](https://daiw.org/manual/kimi-k3/kda)，更是在占总数 3/4 的 69 层 KDA 线性注意力层里**完全去掉了显式 RoPE（NoPE）**，把相对顺序交给通道级遗忘门的数据依赖指数衰减来隐式编码，只在 24 层全局注意力层保留解耦 RoPE + YaRN。NoPE 的意义，正是**对“每层都必须加显式位置编码”这个默认假设的一记挑衅**。

## 一张表

| 模型 | 位置编码 | 长上下文扩展 |
| --- | --- | --- |
| GPT-2 / nanoGPT | 学习式绝对位置 | 不能（定长表） |
| Llama / DeepSeek / GLM | RoPE（DeepSeek 用解耦 RoPE） | 位置插值 / YaRN（DeepSeek V4.1-Flash 支持 1M） |
| Qwen3 / Qwen3.8-Max | RoPE（Qwen3.8 用 25% Partial RoPE） | YaRN（262K 原生，可扩展至 1M） |
| SmolLM3 | **RoPE + NoPE 混搭** | 靠 NoPE 层改善外推 |
| **Kimi K3 / K3.1 Pro** | **69 层 KDA 用 NoPE + 24 层全局注意力用解耦 RoPE** | YaRN（256K，可扩展至 1M） |

## 下一维：训练侧那些看不见的花样

架构维度讲得差不多了。但两个模型即便架构图一模一样，**训练的方式**也能拉开差距。下一章看训练侧的三个花样：DeepSeek 的**多 token 预测（MTP）与 DSpark**、**FP8 / FP4 低精度训练**，以及 Kimi 大规模押注的 **Muon 优化器**——它们不改推理时的主干样子，却实实在在影响“训得多快、多省、多好”。👉 [训练侧的花样：MTP、FP8、Muon](/manual/llm/llm-anatomy/training-tricks)

## 参考文献

- [1] Su et al. “RoFormer: Enhanced Transformer with Rotary Position Embedding.” 2021. arXiv:2104.09864. —— RoPE。
- [2] Chen et al. “Extending Context Window of Large Language Models via Positional Interpolation.” 2023. arXiv:2306.15595. —— 位置插值。
- [3] Peng et al. “YaRN: Efficient Context Window Extension of Large Language Models.” 2023. arXiv:2309.00071. —— YaRN。
- [4] Kazemnejad et al. “The Impact of Positional Encoding on Length Generalization in Transformers.” NeurIPS 2023. arXiv:2305.19466. —— NoPE 与外推。
