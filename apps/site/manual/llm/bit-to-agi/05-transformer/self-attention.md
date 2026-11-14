---
title: "Self Attention"
description: "从 Bit 到 AGI · 第五章：Transformer · 序列每个位置如何「看见」全句"
source: "https://daiw.org/manual/bit-to-agi/05-transformer/self-attention"
---

# Self Attention

> 从 Bit 到 AGI · 第五章：Transformer · 序列每个位置如何「看见」全句

RNN 把信息沿时间步压缩传递，远距离依赖容易衰减。Self-Attention 换了一条路：**每个 token 直接和所有 token 算相关度**，用加权平均汇聚上下文。一句话里「它」指代谁，由 attention 权重当场决定——这是 Transformer 的核心算子。

## 直觉：开会时的眼神交流

想象 128 人围坐（序列长度 $n=128$），每人手里有一份 768 维的「观点摘要」。每个人会问：「谁跟我的话题最相关？」给每人打一个注意力分数，分数高的发言权重更大，最后把自己的摘要更新为全场的加权混合。全场同时进行，一步完成，不依赖从左到右的接力。

## 定义

给定输入 $\mathbf{X} \in \mathbb{R}^{n \times d_{\text{model}}}$（$n$ 个 token，$d_{\text{model}}=768$），Scaled Dot-Product Attention：

$$
\text{Attention}(\mathbf{Q}, \mathbf{K}, \mathbf{V}) = \text{softmax}\left(\frac{\mathbf{Q}\mathbf{K}^\top}{\sqrt{d_k}}\right)\mathbf{V}
$$

Self-Attention 中 $\mathbf{Q}, \mathbf{K}, \mathbf{V}$ 都来自同一 $\mathbf{X}$（经不同线性变换，见[ Q、K、V 是什么](/manual/llm/bit-to-agi/05-transformer/qkv)）。

- $\mathbf{Q}\mathbf{K}^\top \in \mathbb{R}^{n \times n}$：每对 token 的相似度
- $\sqrt{d_k}$：缩放因子，$d_k = d_{\text{model}} / h = 768/12 = 64$（12 头时）
- softmax 按行归一化，得到 attention 权重矩阵 $\mathbf{A} \in \mathbb{R}^{n \times n}$

输出 $\mathbf{Z} \in \mathbb{R}^{n \times d_v}$，通常 $d_v = d_k$。

## 例子

**例 1：形状追踪（BERT-base，$n=128$）**

| 张量 | 形状 | 元素个数 |
|---|---|---|
| $\mathbf{X}$ | $(128, 768)$ | 98 304 |
| $\mathbf{Q}, \mathbf{K}, \mathbf{V}$ | 各 $(128, 768)$ | — |
| $\mathbf{Q}\mathbf{K}^\top$ | $(128, 128)$ | 16 384 |
| $\mathbf{A}$（权重） | $(128, 128)$ | 16 384 |
| 输出 $\mathbf{Z}$ | $(128, 768)$ | 98 304 |

**例 2：因果 mask（GPT 解码器）**

GPT 在 Self-Attention 中对未来位置 mask 为 $-\infty$，softmax 后权重为 0。位置 $i$ 只能看见 $0..i$。BERT 双向，无此 mask。

### 自己点一下

开篇那句「一句话里『它』指代谁，由 attention 权重当场决定」，到现在还是一句话——因为你没见过一行权重。下面就是：点左侧任一个词当 query，看它这一行的权重分给谁。

<AttentionLab />

默认选中的是**「它」**。看它把 **0.59** 的权重压在「小猫」上——指代不再是一句断言，是一个能读出来的数。三个开关分别对应本例和后文的三件事：**因果 mask**（GPT 只能看左边，「它」右边的「好动」被打成 0）、**÷√dₖ 缩放**（关掉它，同一行会塌成近乎 one-hot——这就是那个缩放因子存在的理由）。

```python
import torch
import torch.nn.functional as F

def self_attention(X, mask=None):
    # X: (n, d_model), 简化版：Q=K=V=X
    n, d = X.shape
    d_k = 64
    Q = X @ W_q  # 实际应线性投影到 d_k
    K = X @ W_k
    V = X @ W_v
    scores = (Q @ K.T) / (d_k ** 0.5)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float("-inf"))
    A = F.softmax(scores, dim=-1)
    return A @ V
```

## 量化

**单层 Self-Attention FLOPs（粗算，$n=512$，$d=768$，12 头）**

- QKV 投影：$3 \times 2 n d^2 \approx 1.8 \times 10^9$
- $\mathbf{Q}\mathbf{K}^\top$：$2 h n^2 d_k = 2 \times 12 \times 512^2 \times 64 \approx 4.0 \times 10^8$
- $\mathbf{A}\mathbf{V}$：同量级
- **瓶颈随 $n$ 二次增长**——详见[ Attention 的复杂度](/manual/llm/bit-to-agi/05-transformer/attention-complexity)

**内存**：存 $\mathbf{A}$ 需 $n^2 \times 4$ B；$n=512$ 时约 1 MB/层/头 batch，训练时 batch 与层数倍增。

## 常见误区

1. **Attention 不是「搜索」**：权重是 soft 的凸组合，不是 hard 检索；所有位置都参与，只是权重不同。
2. **Self 的含义**：Q、K、V 同源（同一序列）；Cross-Attention 里 Q 来自 decoder、K/V 来自 encoder。
3. **一层就够吗**：单层 attention 等价于一步全局加权；深层堆叠才能组合高阶特征（如主谓宾、指代链）。

## 小结

Self-Attention 用 $n \times n$ 的权重矩阵，让每个位置一步聚合全序列信息。核心是 scaled dot-product 与 softmax。BERT-base 在 $d_{\text{model}}=768$、12 头、$d_k=64$ 下运行。下一篇拆解 Q、K、V 三个矩阵的角色。

下一篇：[Q、K、V 是什么](/manual/llm/bit-to-agi/05-transformer/qkv)
