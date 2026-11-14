---
title: "为什么 Transformer 统一世界"
description: "从 Bit 到 AGI · 第五章：Transformer · 从 NLP 到视觉与多模态的同一骨架"
source: "https://daiw.org/manual/bit-to-agi/05-transformer/why-transformer-unifies"
---

# 为什么 Transformer 统一世界

> 从 Bit 到 AGI · 第五章：Transformer · 从 NLP 到视觉与多模态的同一骨架

2017 年之后，NLP、视觉、语音、蛋白质、甚至机器人策略，越来越多领域把数据切成 token 序列，堆 Transformer 层。不是偶然——**Self-Attention 是通用「可微分检索」**，**FFN 是通用 per-token 计算**，**残差+Norm 让深度可训**。本章用 BERT/GPT 讲清的积木，换个 embedding 就能用在别处。

## 直觉：乐高标准件

Transformer Block 像 768×12 的标准乐高块：文本用字词 embedding，图像用 patch embedding，音频用帧 embedding；后面都是 Attention 混合 + FFN 变换。厂商（OpenAI、Google、Meta）搭不同高度（层数、宽度），但接口兼容——这降低了研究与工程迁移成本。

## 定义：统一性的三个支柱

1. **序列化**：任意对象 → token 序列 $\mathbf{x}_1 \ldots \mathbf{x}_n$
2. **同一 Block**：MHA + FFN + Residual + Norm，隐藏维 $d_{\text{model}}$，头数 $h$
3. **同一训练范式**：大规模自监督（LM、MLM、对比学习）+ 微调

参数量尺度：

$$
\text{Params} \approx 12 N d^2 \quad \text{（主项，忽略 embedding）}
$$

$N=12, d=768$ → $\approx 85$M 量级（与 BERT-base 吻合）。

## 例子

**例 1：架构变体一览**

| 模型 | 栈 | 代表任务 | $d$ / $N$ / $h$ |
|---|---|---|---|
| BERT | Encoder | 理解、检索 | 768 / 12 / 12 |
| GPT-3 | Decoder | 生成 | 12288 / 96 / 96 |
| T5 | Enc-Dec | 翻译、摘要 | 768 / 12 / 12 |
| ViT | Encoder | 图像分类 | 768 / 12 / 12 |
| Whisper | Enc-Dec | 语音转写 | 1280 / 32 / — |

ViT 把 $16 \times 16$ 图像块当 token；Whisper 把 30 秒音频编码成序列——**Block 不变**。

**例 2：为何 RNN/CNN 让位**

| 维度 | RNN | CNN（局部） | Transformer |
|---|---|---|---|
| 长程依赖 | 逐步传递，易衰减 | 受卷积核限制 | $O(1)$ 路径长度（一层全连接） |
| 并行训练 | 序列维串行 | 并行 | 序列维并行（训练） |
| 可扩展性 | 难加深 | 感受野技巧 | 堆层 + 加宽，配合 Scaling Laws |

**例 3：统一后的工程生态**

同一套 kernel（FlashAttention、融合 GEMM）、同一套框架（PyTorch `nn.Transformer`、Megatron、vLLM），从 110M 到 405B 复用优化——**统一架构 → 统一工具链 → 更快迭代**。

## 量化

- **市场集中度**：当前主流 LLM 几乎全是 Decoder-only Transformer（或混合线性注意力/SSM）与少量 Enc-Dec；传统 RNN 在大模型 SOTA 榜单已难觅踪影
- **算力需求**：统一架构使**缩放定律**（下一篇）可预测——加参数、加数据、加算力，loss 按幂律下降
- **迁移**：BERT 768 维表示可直接作下游特征；GPT embedding 空间支持 in-context learning

::: info

**例外与补充**：State Space Model（Mamba）、线性 Attention 等挑战 $O(n^2)$，但在超大规模预训练上 Transformer 仍占主导；统一的是「Attention+FFN 深度栈」，非「只有 vanilla attention 一种实现」。

:::

## 常见误区

1. **Transformer 只能处理文本**：Patch、音频帧、SMILES 字符串均可 token 化。
2. **统一 = 所有任务同一个 checkpoint**：架构统一，权重仍任务/领域专用；多任务需预训练混合或微调。
3. **越大越好无上限**：Scaling Laws 有收益递减；数据、架构、推理成本约束实际上限。

## 小结

Transformer 用同一 Block（MHA+FFN+残差+Norm）统一序列建模，支撑 BERT、GPT、T5、ViT 等。可并行、易加深、工具链成熟，是「统一世界」的工程原因。下一篇量化其软肋：$O(n^2)$ 复杂度。

下一篇：[Attention 的复杂度](/manual/llm/bit-to-agi/05-transformer/attention-complexity)
