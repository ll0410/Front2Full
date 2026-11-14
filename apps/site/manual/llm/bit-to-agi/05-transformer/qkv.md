---
title: "Q、K、V 是什么"
description: "从 Bit 到 AGI · 第五章：Transformer · Query、Key、Value 三投影的几何含义"
source: "https://daiw.org/manual/bit-to-agi/05-transformer/qkv"
---

# Q、K、V 是什么

> 从 Bit 到 AGI · 第五章：Transformer · Query、Key、Value 三投影的几何含义

Self-Attention 公式里出现 $\mathbf{Q}$（Query）、$\mathbf{K}$（Key）、$\mathbf{V}$（Value）。它们不是三套独立数据，而是同一输入 $\mathbf{X}$ 经三个线性层得到的三种「视角」：**问什么、匹配什么、传递什么**。理解这三者，就读懂了 attention 权重的来源。

## 直觉：图书馆检索

- **Query**：你手里的检索词——「我想找关于 attention 的书」
- **Key**：每本书 spine 上的标签——用于与 Query 比对相似度
- **Value**：书里的实际内容——相似度高就多读几本的内容进摘要

每个 token 同时扮演「读者」和「书」：自己的 Query 去匹配所有人的 Key，再按权重取所有人的 Value。

## 定义

$$
\mathbf{Q} = \mathbf{X}\mathbf{W}^Q, \quad \mathbf{K} = \mathbf{X}\mathbf{W}^K, \quad \mathbf{V} = \mathbf{X}\mathbf{W}^V
$$

$\mathbf{W}^Q, \mathbf{W}^K, \mathbf{W}^V \in \mathbb{R}^{d_{\text{model}} \times d_{\text{model}}}$（单头全维写法；多头时投影到 $d_k$）。

Attention 权重：

$$
A_{ij} = \frac{\exp(\mathbf{q}_i \cdot \mathbf{k}_j / \sqrt{d_k})}{\sum_{j'} \exp(\mathbf{q}_i \cdot \mathbf{k}_{j'} / \sqrt{d_k})}
$$

输出第 $i$ 行：$\mathbf{z}_i = \sum_j A_{ij} \mathbf{v}_j$。

## 例子

**例 1：BERT-base 单头维度**

- 输入 $\mathbf{X}$：$(n, 768)$
- $\mathbf{W}^Q$：$(768, 64)$ → $\mathbf{Q}$：$(n, 64)$（单头）
- 12 头时各有独立的 $\mathbf{W}^Q_h$，最后 concat 成 $(n, 768)$

三个投影层参数量（单头）：$3 \times 768 \times 64 = 147{,}456$；12 头合计 $3 \times 768 \times 768 = 1{,}769{,}472 \approx 1.77\text{M}$（含输出投影 $\mathbf{W}^O$ 则再 $768^2$）。

**例 2：数值小例**

$n=3$，$d_k=2$，某头：

$$
\mathbf{q}_1 \cdot \mathbf{k}_1 = 2.0,\; \mathbf{q}_1 \cdot \mathbf{k}_2 = 5.0,\; \mathbf{q}_1 \cdot \mathbf{k}_3 = 1.0
$$

缩放（$\sqrt{2}\approx 1.41$）后 softmax → 权重约 $[0.10, 0.85, 0.05]$。token 1 的输出主要来自 token 2 的 Value。

| token | $A_{1j}$ | 含义 |
|---|---|---|
| 1 | 0.06 | 自环，弱 |
| 2 | 0.87 | 强相关 |
| 3 | 0.07 | 弱 |

## 量化

| 组件 | 参数量（BERT-base MHA） |
|---|---|
| $\mathbf{W}^Q, \mathbf{W}^K, \mathbf{W}^V$ | $3 \times 768^2 = 1.77\text{M}$ |
| 输出 $\mathbf{W}^O$ | $768^2 = 0.59\text{M}$ |
| 合计 | $\approx 2.36\text{M}$ / 层 |

QKV 投影 FLOPs：$6 n d^2$（乘加各算一次）；$n=512$ 时约 $1.5 \times 10^9$ / 层。

::: info

**Cross-Attention**（Encoder-Decoder）：$\mathbf{Q}$ 来自 decoder 隐藏状态，$\mathbf{K}, \mathbf{V}$ 来自 encoder 输出。Query 问「译文中这个词该看源句哪一段？」

:::

## 常见误区

1. **K 和 V 必须相同**：否。K 只参与打分，V 参与加权求和；分工不同。
2. **Q·K 越大越好**：未经 softmax 的 raw score 可任意大；$\sqrt{d_k}$ 缩放是为避免 softmax 饱和、梯度消失。
3. **三个 W 可以合并成一个**：推理优化里常把 QKV 合成一次 GEMM（$768 \to 2304$），数学等价，省 kernel launch。

## 动手试一试

```python
import torch
import torch.nn as nn

n, d_model, n_heads = 128, 768, 12
d_k = d_model // n_heads  # 64

X = torch.randn(n, d_model)
W_q = nn.Linear(d_model, d_model, bias=False)
W_k = nn.Linear(d_model, d_model, bias=False)
W_v = nn.Linear(d_model, d_model, bias=False)

Q = W_q(X).view(n, n_heads, d_k).transpose(0, 1)  # (12, 128, 64)
K = W_k(X).view(n, n_heads, d_k).transpose(0, 1)
V = W_v(X).view(n, n_heads, d_k).transpose(0, 1)

scores = (Q @ K.transpose(-2, -1)) / (d_k ** 0.5)  # (12, 128, 128)
```

## 小结

Q、K、V 是同一隐藏状态的三次线性投影：Query 发起匹配，Key 被匹配，Value 被汇聚。BERT-base 每层约 2.36M 参数花在 Multi-Head Attention 的 QKV+输出上。下一篇看训练稳定性的关键——残差连接。

下一篇：[Residual 连接](/manual/llm/bit-to-agi/05-transformer/residual-connection)
