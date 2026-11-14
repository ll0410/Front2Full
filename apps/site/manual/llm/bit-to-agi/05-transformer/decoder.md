---
title: "Decoder 是什么"
description: "从 Bit 到 AGI · 第五章：Transformer · 因果自回归解码器如何逐 token 生成"
source: "https://daiw.org/manual/bit-to-agi/05-transformer/decoder"
---

# Decoder 是什么

> 从 Bit 到 AGI · 第五章：Transformer · 因果自回归解码器如何逐 token 生成

GPT 系列、LLaMA、以及原始 Transformer 的右半部分，核心都是 **Decoder**。与 BERT 的双向 Encoder 不同，Decoder 在 Self-Attention 上加**因果 mask**，保证位置 $i$ 只能看见 $0..i$，从而支持**自回归**：给定前缀，预测下一个 token，再把这个 token 拼回前缀，循环直到结束。

## 直觉：只能看左边已写下的文字

写小说时，第 100 字不能偷看第 101 字。Decoder 训练时把整句喂进去，但算 attention 时对「未来」位置 mask 掉；推理时一次只生成一个新 token，序列逐渐变长。这就是「解码」——从语言模型分布里**解码**出文本。

## 定义

单层 **Decoder Block**（GPT 风格，无 Cross-Attention）：

1. **Masked Multi-Head Self-Attention**（因果）
2. 残差 + LayerNorm
3. **FFN**
4. 残差 + LayerNorm

因果 mask 矩阵 $\mathbf{M} \in \{0, -\infty\}^{n \times n}$，下三角为 0，上三角为 $-\infty$：

$$
A_{ij} = \text{softmax}\left(\frac{\mathbf{q}_i \mathbf{k}_j^\top}{\sqrt{d_k}} + M_{ij}\right), \quad M_{ij} = \begin{cases} 0 & j \le i \\ -\infty & j > i \end{cases}
$$

GPT-2 small 与 BERT-base 同规模：$d_{\text{model}}=768$，12 层，12 头，$d_{\text{ff}}=3072$，context 1024。

## 例子

**例 1：训练 vs 推理**

| 阶段 | 输入长度 | 并行度 |
|---|---|---|
| 训练（teacher forcing） | 整句 $n=512$ | 一次前向算 512 个位置 loss |
| 推理（生成） | 从 1 增长到 $n$ | 每步只算新 token，共 $n$ 次前向 |

推理可用 **KV Cache**（第 8 章）：缓存过去 token 的 K/V，避免重复计算，复杂度从 $O(n^2)$ 每步降为 $O(n)$ 每步。

**例 2：输出头**

最后一层 hidden $\mathbf{h}_i \in \mathbb{R}^{768}$ 经 $\mathbf{W}_{\text{vocab}} \in \mathbb{R}^{768 \times V}$ 得 logits，$V \approx 50257$（GPT-2）：

$$
\mathbf{p}_i = \text{softmax}(\mathbf{h}_i \mathbf{W}_{\text{vocab}}) \in \mathbb{R}^V
$$

取 $\arg\max$ 或采样得下一个 token。

```python
import torch

n, d_model = 5, 768
scores = torch.randn(n, n)
causal_mask = torch.triu(torch.ones(n, n), diagonal=1).bool()
scores.masked_fill_(causal_mask, float("-inf"))
attn = scores.softmax(dim=-1)
# 第 i 行只有前 i+1 列非零
```

## 量化

GPT-2 small（124M）参数分布（约）：

| 组件 | 参数量 |
|---|---|
| Token + 位置 embedding | $\approx 39$M |
| 12 × (Attn + FFN) | $\approx 85$M |
| lm_head（若 tying 则与 embedding 共享） | — |

- **生成延迟**：串行步数 = 输出 token 数；每步一次完整 forward（有 KV cache 时仅最后一层新算）
- **训练吞吐**：整句并行，与 BERT 同量级 FLOPs/token

## 常见误区

1. **Decoder 只能生成文本**：架构是「因果序列模型」；代码、蛋白质序列同理。
2. **因果 mask 在推理时才需要**：训练时也必须有，否则作弊看见未来。
3. **Decoder = 只有 half 的 Transformer**：GPT 是纯 Decoder 栈，无 Encoder；功能上仍是完整 LM。

## 小结

Decoder 用因果 Masked Self-Attention + FFN，支持自回归生成。GPT-2 用 12 层、768 维、12 头，与 BERT-base 规模对齐。下一篇看双向理解的 Encoder。

下一篇：[Encoder 是什么](/manual/llm/bit-to-agi/05-transformer/encoder)
