---
title: "Feed Forward 层"
description: "从 Bit 到 AGI · 第五章：Transformer · 每个 token 上的两层 MLP 在算什么"
source: "https://daiw.org/manual/bit-to-agi/05-transformer/feed-forward"
---

# Feed Forward 层

> 从 Bit 到 AGI · 第五章：Transformer · 每个 token 上的两层 MLP 在算什么

Attention 负责** token 之间**交换信息；Feed-Forward Network（FFN，前馈网络）则在**每个 token 内部**做非线性变换。原论文结构：先扩维到 $d_{\text{ff}}$，激活，再压回 $d_{\text{model}}$。BERT-base 里 $768 \to 3072 \to 768$，这一层占了单层参数的大头。

## 直觉：Attention 开完会后的「个人笔记整理」

Attention 像全体对表讨论；FFN 像每个人回到座位，独立把汇总的 768 维笔记扩成 3072 维草稿（中间层），提炼重点，再压缩成 768 维定稿。**同一层里各 token 的 FFN 参数共享**，但输入不同，输出各异。

## 定义

对每个 token 向量 $\mathbf{x} \in \mathbb{R}^{d_{\text{model}}}$：

$$
\text{FFN}(\mathbf{x}) = \mathbf{W}_2 \cdot \sigma(\mathbf{W}_1 \mathbf{x} + \mathbf{b}_1) + \mathbf{b}_2
$$

- $\mathbf{W}_1 \in \mathbb{R}^{d_{\text{ff}} \times d_{\text{model}}}$，$\mathbf{W}_2 \in \mathbb{R}^{d_{\text{model}} \times d_{\text{ff}}}$
- $\sigma$：原论文 ReLU；BERT 用 GELU；LLaMA 用 SwiGLU（门控变体）

BERT-base：$d_{\text{model}}=768$，$d_{\text{ff}}=3072$（即 $4 \times d_{\text{model}}$）。

## 例子

**例 1：参数量**

$$
\underbrace{768 \times 3072}_{\mathbf{W}_1} + \underbrace{3072 \times 768}_{\mathbf{W}_2} + \underbrace{768 + 3072}_{\mathbf{b}_1, \mathbf{b}_2} \approx 4.72 \times 10^6
$$

单层 FFN 约 **4.7M** 参数；同层 Multi-Head Attention 约 2.4M——FFN 是参数大户。

**例 2：FLOPs（$n=512$）**

$$
\text{FFN FLOPs} \approx 2 n (2 \cdot d_{\text{model}} \cdot d_{\text{ff}}) = 4 n d_{\text{model}} d_{\text{ff}}
$$

代入：$4 \times 512 \times 768 \times 3072 \approx 4.8 \times 10^9$ FLOPs/层，与 attention 的 QKV+矩阵乘同量级。

```python
import torch
import torch.nn as nn

d_model, d_ff = 768, 3072

ffn = nn.Sequential(
    nn.Linear(d_model, d_ff),
    nn.GELU(),
    nn.Linear(d_ff, d_model),
)

x = torch.randn(128, d_model)  # (seq, hidden)
y = ffn(x)
assert y.shape == (128, d_model)
```

## 量化

| 模型 | $d_{\text{model}}$ | $d_{\text{ff}}$ | FFN 参数/层 |
|---|---|---|---|
| BERT-base | 768 | 3072 | 4.7M |
| GPT-2 small | 768 | 3072 | 4.7M |
| LLaMA-7B | 4096 | 11008 | $\approx 135$M（SwiGLU 三矩阵） |

- **MoE 变体**：多个 FFN 专家，router 选 top-k，推理只激活部分参数（见第 7 章 MoE）
- **字节数**：4.7M 参数 × 4 B（fp32）≈ 18.9 MB/层；12 层 FFN 权重约 227 MB

## 常见误区

1. **FFN 跨 token 混合信息**：错；形状 $(n, d)$ 时在 seq 维无连接，纯 per-token MLP。
2. **$d_{\text{ff}} = 4 d$ 是铁律**：常见启发式；GPT-3 175B 用 $d_{\text{ff}} = 4d$；LLaMA 用 $\approx 2.7d$（SwiGLU 三矩阵补偿容量）。
3. **去掉 FFN 只留 Attention**：表达能力大降；两者分工不同，缺一不可。

## 动手试一试

对比 ReLU 与 GELU 在中间层的稀疏度：

```python
import torch
import torch.nn.functional as F

x = torch.randn(768)
h_relu = F.relu(x @ W1.T)
h_gelu = F.gelu(x @ W1.T)
print((h_relu == 0).float().mean())  # ReLU 约 50% 置零
print(h_gelu.abs().mean())             # GELU 平滑，无硬零
```

## 小结

FFN 是 $768 \to 3072 \to 768$ 的两层 MLP，per-token、参数共享。BERT-base 每层约 4.7M 参数，与 Attention 并列构成 Transformer Block 的两大子层。下一篇：Attention 如何拆成 12 个头并行工作。

下一篇：[Multi Head Attention](/manual/llm/bit-to-agi/05-transformer/multi-head-attention)
