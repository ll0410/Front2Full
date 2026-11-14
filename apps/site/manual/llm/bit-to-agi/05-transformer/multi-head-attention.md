---
title: "Multi Head Attention"
description: "从 Bit 到 AGI · 第五章：Transformer · 12 个头如何并行看 12 种关系"
source: "https://daiw.org/manual/bit-to-agi/05-transformer/multi-head-attention"
---

# Multi Head Attention

> 从 Bit 到 AGI · 第五章：Transformer · 12 个头如何并行看 12 种关系

单头 Attention 只有一组 Q/K/V，一次只能学一种「相关模式」。Multi-Head Attention（MHA）把 $d_{\text{model}}=768$ 拆成 $h=12$ 个子空间，每头 $d_k = 768/12 = 64$，**12 个头并行**做 attention，最后拼接再投影——同时捕捉语法、指代、搭配等不同关系。

## 直觉：12 副不同颜色的滤镜

同一句话，语法分析师看主谓一致，指代分析师看「它」指向谁，搭配分析师看动宾组合。每头是一副滤镜（64 维子空间），各算一份 $128 \times 128$ 的 attention 图，最后把 12 份 64 维结果拼回 768 维。

## 定义

$$
\text{head}_i = \text{Attention}(\mathbf{X}\mathbf{W}_i^Q, \mathbf{X}\mathbf{W}_i^K, \mathbf{X}\mathbf{W}_i^V)
$$

$$
\text{MHA}(\mathbf{X}) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h)\,\mathbf{W}^O
$$

约束：$h \cdot d_k = d_{\text{model}}$，即 $12 \times 64 = 768$。

$\mathbf{W}_i^Q, \mathbf{W}_i^K, \mathbf{W}_i^V \in \mathbb{R}^{d_{\text{model}} \times d_k}$；$\mathbf{W}^O \in \mathbb{R}^{d_{\text{model}} \times d_{\text{model}}}$。

## 例子

**例 1：形状（$n=128$，BERT-base）**

| 步骤 | 形状 |
|---|---|
| 输入 $\mathbf{X}$ | $(128, 768)$ |
| 单头 $\mathbf{Q}_h, \mathbf{K}_h, \mathbf{V}_h$ | $(128, 64)$ |
| 单头 scores | $(128, 128)$ |
| 12 头 concat | $(128, 768)$ |
| $\mathbf{W}^O$ 输出 | $(128, 768)$ |

**例 2：参数量**

合并 QKV 矩阵：$\mathbf{W}^{QKV} \in \mathbb{R}^{768 \times 2304}$（$768 \times 3 \times 768$）+ $\mathbf{W}^O$：$768^2$

合计 $\approx 2.36\text{M}$/层，与[ Q、K、V 是什么](/manual/llm/bit-to-agi/05-transformer/qkv)一致。

**例 3：头数与 $d_k$ 对照**

| 模型 | $d_{\text{model}}$ | $h$ | $d_k$ |
|---|---|---|---|
| BERT-base | 768 | 12 | 64 |
| GPT-2 medium | 1024 | 16 | 64 |
| LLaMA-7B | 4096 | 32 | 128 |

常见规律：$d_k$ 取 64 或 128，$h = d_{\text{model}} / d_k$。

```python
import torch
import torch.nn as nn

class MultiHeadAttention(nn.Module):
    def __init__(self, d_model=768, n_heads=12):
        super().__init__()
        assert d_model % n_heads == 0
        self.d_k = d_model // n_heads
        self.n_heads = n_heads
        self.qkv = nn.Linear(d_model, 3 * d_model)
        self.out = nn.Linear(d_model, d_model)

    def forward(self, x):
        n, d = x.shape
        qkv = self.qkv(x).view(n, 3, self.n_heads, self.d_k)
        q, k, v = qkv.unbind(dim=1)  # each (n, 12, 64)
        q, k, v = [t.transpose(0, 1) for t in (q, k, v)]  # (12, n, 64)
        scores = (q @ k.transpose(-2, -1)) / (self.d_k ** 0.5)
        attn = scores.softmax(dim=-1)
        out = (attn @ v).transpose(0, 1).reshape(n, d)
        return self.out(out)
```

## 量化

- **计算**：12 个小 attention 可并行；总 FLOPs 与单头全维相当，但 GPU 上更多小矩阵乘，有时略亏效率
- **内存**：存 12 组 $\mathbf{A}_h$，每层 $h \cdot n^2$  floats；$n=512, h=12$ 时 $12 \times 512^2 \times 4 \approx 12.6$ MB/层（仅权重矩阵，不含梯度）
- **Grouped Query Attention（GQA）**：LLaMA-2 等减少 K/V 头数，Q 仍 32 头，K/V 8 头，repeat 广播——省 KV cache 显存

## 常见误区

1. **头越多越好**：$h$ 增大则 $d_k$ 减小，单头容量降；需在头数与子空间维度间平衡。
2. **每头语义可人工命名**：可视化有时显示「语法头」「位置头」，但并非训练目标，不可依赖。
3. **MHA 与多个独立 Attention 层相同**：MHA 共享输入、一次投影、concat 后单 $\mathbf{W}^O$，与堆 12 层单头不同。

## 小结

Multi-Head Attention 将 768 维拆为 12×64，并行 12 份 scaled dot-product attention，concat 后经 $\mathbf{W}^O$ 融合。这是 BERT-base 每一层的第一子层。下一篇转向架构：Decoder 如何自回归生成。

下一篇：[Decoder 是什么](/manual/llm/bit-to-agi/05-transformer/decoder)
