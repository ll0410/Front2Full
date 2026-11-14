---
title: "注意力 · 从 MHA 到 MQA、GQA、MLA"
description: "KV 缓存是推理时的显存杀手。MHA→MQA→GQA→MLA 这一串缩写，其实是同一个问题越来越聪明的答案——共享键值头，还是干脆把键值压缩掉？看 Llama/Qwen 的 GQA 与 DeepSeek 的 MLA 各自的取舍，以及 2026 年 CSA2 与 Gated DSA 的演进。"
source: "https://daiw.org/manual/llm-anatomy/attention-mha-gqa-mla"
---

# 注意力 · 从 MHA 到 MQA、GQA、MLA

> KV 缓存是推理时的显存杀手。MHA→MQA→GQA→MLA 这一串缩写，其实是同一个问题越来越聪明的答案——共享键值头，还是干脆把键值压缩掉？看 Llama/Qwen 的 GQA 与 DeepSeek 的 MLA 各自的取舍，以及 2026 年 CSA2 与 Gated DSA 的演进。

第一个、也是最重要的战场。你大概听过 MHA、MQA、GQA、MLA 这一串缩写，觉得高深。其实它们是**同一个问题的一串答案**，而那个问题特别具体：

> **推理时，注意力的“KV 缓存”太占显存了。怎么把它压下去，又不让模型变笨？**

把这句话嚼透，这一串缩写就全通了。

## 先搞懂：KV 缓存为什么是显存杀手

回忆 [nanoGPT 的注意力](https://daiw.org/manual/nanogpt/attention)：每个位置算出自己的 Query、Key、Value，然后用 Q 和前面所有位置的 K 比对、去汇总它们的 V。

生成文本时是**一个 token 一个 token 吐**的。生成第 100 个 token 时，要用它的 Q 去和前面 99 个的 K、V 做注意力。难道每一步都把前面所有 token 的 K、V 重算一遍？太浪费了。于是有了 **KV 缓存**：算过的 K、V 存下来，后面直接取用。

这个缓存有多大？粗算一下每个 token 要缓存的字节：

$$
\text{cache/token} \approx 2 \times n_{\text{layer}} \times n_{\text{kv-head}} \times d_{\text{head}} \times \text{bytes}
$$

- 那个 `2`，是 K 和 V 各一份；
- 要乘 `n_layer`，因为**每一层都有自己的一份 KV**；
- 关键在 `n_kv-head`：**有多少个“键值头”，缓存就翻多少倍。**

再乘上下文长度和 batch。于是问题来了：上下文一长（几万 token）、batch 一大，**KV 缓存能吃掉比模型权重还多的显存**。它，而不是算力，常常是长上下文推理的第一瓶颈。

**MHA、MQA、GQA、MLA 的全部动机，就是压这个缓存里的 `n_kv-head × d_head` 那一项。** 下面这一路，你会看到它越压越狠。

## MHA：人手一份，最费（基准线）

**Multi-Head Attention** 就是 nanoGPT 里那种标准做法，也是原版 Transformer 的做法：有多少个 Query 头，就有多少个**配套的** Key 头、Value 头。8 个头，就缓存 8 份 K、8 份 V。

- **优点**：每个头都有完整的、专属的 K/V，表达力最足。
- **缺点**：缓存最大。头越多越费。
- **谁还在用**：大多数新模型已经不用了，但 **OLMo 2** 偏要用回 MHA（它更在意“透明、标准、好复现”，不追极致省显存）。

MHA 是**基准线**。接下来三种，都是在“怎么让 Key/Value 头变少或变小”上做文章。

## MQA：全体共用一份，最省也最糙

**Multi-Query Attention** 走了极端：**所有 Query 头，共用同一份 K 和 V。** 8 个 Query 头，却只有 1 份 Key、1 份 Value。

- **缓存立刻小 8 倍**（`n_kv-head` 从 8 变 1）。
- **代价**：所有头被迫“看同一套钥匙”，表达力受限，大模型上质量会掉。

MQA 像是“省过头了”。于是有了折中——

## GQA：分组共享，行业甜点

**Grouped-Query Attention** 是 MHA 和 MQA 之间的**折中**，也是当下**绝大多数模型的默认选择**：把 Query 头**分组**，**每组共享一份 K/V**。

举个具体的：Llama 3 70B 有 **64 个 Query 头**，却只有 **8 个 KV 头**——等于每 8 个 Query 头共享一份 K/V，分成 8 组。

```
MHA (人手一份)      Q1 Q2 Q3 Q4 Q5 Q6 Q7 Q8
                     |  |  |  |  |  |  |  |
                    K1 K2 K3 K4 K5 K6 K7 K8   ← 8 份 KV,最费

GQA (分组共享)      Q1 Q2 Q3 Q4   Q5 Q6 Q7 Q8
                      \ | | /       \ | | /
                       K1(组1)        K2(组2)     ← 2 份 KV,省 4 倍

MQA (全体共用)      Q1 Q2 Q3 Q4 Q5 Q6 Q7 Q8
                      \  \  \ | | /  /  /
                            K1             ← 1 份 KV,最省也最糙
```

- **缓存省了**（上例省 4 倍），质量却**几乎不掉**——这就是它成为甜点的原因。
- **谁在用**：**Llama、Qwen、Mistral、Gemma、GLM、GPT-OSS……** 一大片。可以说，GQA 是这一代的“注意力出厂设置”。

到这儿，故事本该结束了——直到 DeepSeek 说：**共享不是唯一的路，压缩才是。**

## MLA：不共享，而是“压缩”——DeepSeek 的杀手锏

GQA 的思路是“**让 KV 头变少**”。**Multi-head Latent Attention** 换了个思路：**KV 头不减，但把每份 K/V 压成一个低维的“潜向量”再缓存。**

打个比方：

- **GQA** 像是“几个人合看一张地图”——地图数量少了，但每个人能看的还是那张完整地图，只是不再人手一张。
- **MLA** 像是“每个人还是有自己的地图，但地图先**压缩成一个二维码**存起来；真要用时，再把二维码**解压**回完整地图”。缓存里躺着的是小小的二维码，不是大地图。

具体说：MLA 把每个 token 的 K、V 通过一个降维矩阵压成一个**低维潜向量（latent）**，**只缓存这个潜向量**；推理时，再用升维矩阵把它**还原**回各个头要用的 K、V。缓存的大小，从“`n_kv-head × d_head`”变成了“一个小小的 `d_latent`”——**比 GQA 还省**。

最反直觉的是**质量**。DeepSeek-V2 论文里做了消融对比，结论很干脆：

> **在建模质量上：GQA < MHA < MLA。**

也就是说，GQA 是“省显存、但质量比 MHA 略降”的折中；而 MLA 做到了**又省显存、质量还反超 MHA**——鱼和熊掌兼得。这就是 DeepSeek（以及把它放大到 1T 的 Kimi K2）宁可承担 MLA 那份实现复杂度，也要用它的原因。

::: info

**一个绕不开的小麻烦：RoPE 怎么办？** MLA 把 K/V 压成了潜向量，可 RoPE 位置编码是要直接作用在 K 上的，压缩后就没法干净地加了。DeepSeek 的解法是“**解耦 RoPE**”：让 Key 分成两截，一小截专门携带 RoPE 位置信息（不压缩）、其余走压缩通道。细节我们放到位置编码那章再展开，这里你只需记住：**MLA 为了兼容 RoPE，做了一点额外的手术。**

:::

## 2026 年的再进化：跨层共享 FP4 KV 与稀疏注意力

到了 2026 年，围绕 KV 缓存和长序列计算，各家在 GQA 和 MLA 之上又往前迈了一大步：

- **DeepSeek V4.1-Flash 的 CSA2（跨层共享自适应稀疏注意力）**：不仅把单层 KV 压成潜向量，干脆让**相邻两层共享同一份 KV 缓存**，并且原生用 **FP4（E2M1）** 存储，把全模型每 token 的 KV 缓存从 DeepSeek-V3 的 70.3 KB 一口气砍到了 **890 字节**（约缩减 98.7%），同时配合 Top-$k$ 闪电索引器只对最相关的历史块做稀疏注意力，详见[《DeepSeek V4.1 Flash · CSA2》](https://daiw.org/manual/deepseek-v4-flash/csa2)。
- **Kimi K3 / K3.1 Pro 的 Gated MLA 与 Gated DSA**：在 [Kimi K3](https://daiw.org/manual/kimi-k3/hybrid-stack) 中，全模型 92 层 MoE 层只有 24 层保留全局注意力（采用带 Sigmoid 输出门控的 **Gated MLA**），到了 2026 年 11 月的 **Kimi K3.1 Pro**，这 24 层进一步升级为 **Gated DSA（门控动态稀疏注意力）**，通过 32 头、128 维的轻量索引器在每层只挑选 `index_topk = 2048` 个关键 token 参与全注意力计算。

## 一张表看全这一路

| 方案 | KV 头怎么处理 | KV 缓存 | 建模质量 | 代表模型 |
| --- | --- | --- | --- | --- |
| **MHA** | 人手一份 | 最大（基准） | 好 | OLMo 2 |
| **MQA** | 全体共用一份 | 最小 | 明显下降 | 早期一些模型 |
| **GQA** | 分组共享 | 小（省数倍） | 几乎不掉 | Llama、Qwen、Mistral、Gemma、GLM、GPT-OSS |
| **MLA** | 不减头，压成潜向量 | 比 GQA 更小 | **反超 MHA** | DeepSeek-V3、Kimi K2、Kimi K3（Gated MLA） |
| **CSA2 / Gated DSA** | 跨层共享 + FP4 / 动态稀疏 Top-$k$ | 极小（可低至 < 1 KB/token） | 兼顾百万上下文与吞吐 | DeepSeek V4.1-Flash、Kimi K3.1 Pro |

这条线读下来，你会发现一个特别清晰的**取舍谱**：从 MHA 到 MQA 是“用质量换显存，换过头了”；GQA 找回了平衡，成了默认；MLA 则用更高的实现复杂度，换来了“显存和质量双赢”；而 2026 年的 CSA2 和 Gated DSA 更进一步，把跨层 KV 共享、低比特量化和动态稀疏索引拧在了一起。**一个模型在这一格里的选择，基本就暴露了它的性格：是求稳求标准（MHA），是随大流（GQA），还是愿意为极致效率钻研复杂方案（MLA / CSA2）。**

## 还没完：省 KV 缓存的另一条路

MHA→GQA→MLA 这一路，压的是“**每个 token 缓存多大**”。但还有一条正交的路：**干脆别在每一层都缓存全部历史 token**——要么盯着**附近一个滑动窗口**，要么把四分之三的层换成**固定状态大小的线性注意力**。这是下一章的主角。👉 [滑动窗口：Gemma 与 GPT-OSS 的局部注意力](/manual/llm/llm-anatomy/sliding-window)

## 参考文献

- [1] Vaswani et al. “Attention Is All You Need.” NeurIPS 2017. arXiv:1706.03762. —— 原始 Transformer 与标准 MHA。
- [2] Shazeer. “Fast Transformer Decoding: One Write-Head is All You Need.” 2019. arXiv:1911.02150. —— 提出 MQA。
- [3] Ainslie et al. “GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints.” EMNLP 2023. arXiv:2305.13245. —— 提出 GQA。
- [4] DeepSeek-AI. “DeepSeek-V2: A Strong, Economical, and Efficient Mixture-of-Experts Language Model.” 2024. arXiv:2405.04434. —— 提出 MLA，并给出“MLA > MHA > GQA”的建模质量消融。
- [5] DeepSeek-AI. “DeepSeek-V3 Technical Report.” 2024. arXiv:2412.19437. —— MLA 的大规模应用。
- [6] Su et al. “RoFormer: Enhanced Transformer with Rotary Position Embedding.” 2021. arXiv:2104.09864. —— RoPE，与 MLA 解耦 RoPE 相关。
