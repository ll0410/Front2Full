---
title: "位置编码的变体"
description: "从 Bit 到 AGI · 第五章：Transformer · 从正弦到 RoPE 与 ALiBi 的长上下文演进"
source: "https://daiw.org/manual/bit-to-agi/05-transformer/positional-encoding-variants"
---

# 位置编码的变体

> 从 Bit 到 AGI · 第五章：Transformer · 从正弦到 RoPE 与 ALiBi 的长上下文演进

[Position Encoding](/manual/llm/bit-to-agi/05-transformer/position-encoding) 介绍了正弦与 BERT 可学习绝对位置。当 context 从 512 推到 32K、128K，绝对 embedding 外推差、正弦缺乏相对距离归纳偏置——社区演化出 **RoPE**、**ALiBi**、**相对位置偏置** 等变体。现代 LLM（LLaMA、Qwen、GPT-NeoX）大多采用 RoPE。

## 直觉：把位置编进「查询角度」

绝对位置像给每个座位固定编号；RoPE 像给 Query 和 Key 各转一个与位置有关的角度，两点积只依赖**相对角度差**——天然表达「相距 3 个 token」。ALiBi 则直接在 attention score 上加线性距离惩罚，连位置向量都省掉。

## 定义

### 相对位置偏置（T5 / Shaw et al.）

在 logits 上加可学习偏置 $b_{i-j}$（只依赖相对距离 $i-j$，clamp 到窗口）：

$$
A_{ij} = \frac{\mathbf{q}_i \mathbf{k}_j^\top}{\sqrt{d_k}} + b_{i-j}
$$

### RoPE（Rotary Position Embedding）

对 $d_k$ 维中每对维度应用与位置 $pos$ 相关的旋转：

$$
f(\mathbf{x}, pos) = \mathbf{R}_{pos} \mathbf{x}
$$

$\mathbf{q}_i, \mathbf{k}_j$ 旋转后再点积，等价于编码相对位置 $i-j$。LLaMA-7B：$d_{\text{model}}=4096$，32 头，$d_k=128$，RoPE base frequency 10000。

### ALiBi（Attention with Linear Biases）

$$
A_{ij} = \frac{\mathbf{q}_i \mathbf{k}_j^\top}{\sqrt{d_k}} - m_h \cdot |i - j|
$$

$m_h$ 为第 $h$ 头的斜率，无额外参数；外推时长序列 attention 自然衰减远距离。

## 例子

**例 1：方案对比**

| 方案 | 额外参数 | 相对位置 | 长上下文外推 |
|---|---|---|---|
| 正弦（固定） | 0 | 弱 | 一般 |
| 可学习绝对（BERT） | $L_{\max} \cdot d$ | 否 | 差（需插值） |
| 相对偏置（T5） | $\approx (2L-1) \cdot h$ | 是 | 中等 |
| RoPE（LLaMA） | 0 | 是 | 较好（+NTK/YaRN） |
| ALiBi | 0 | 是 | 较好 |

**例 2：RoPE 与 $d_k=64$（单头）**

旋转作用于成对维度 $(2k, 2k+1)$，频率 $\theta_k = 10000^{-2k/d_k}$。$pos=10$ 与 $pos=13$ 的 Q/K 点积反映距离 3，与绝对起点无关。

**例 3：外推 512 → 8192**

BERT 可学习位置：训练 512，推理 8192 需 **位置插值**（PI）或扩展 embedding。RoPE 可用 **NTK-aware scaling** 调整 base，无需重训 embedding 表。

```python
# ALiBi 斜率示意（每头不同 m）
import torch

n, n_heads = 128, 12
slopes = torch.tensor([2 ** (-8 / n_heads * (i + 1)) for i in range(n_heads)])
dist = (torch.arange(n).unsqueeze(0) - torch.arange(n).unsqueeze(1)).abs()
# alibi[b,h,i,j] = -slopes[h] * dist[i,j]
```

## 量化

- **RoPE 计算**：与 Q/K 投影融合，额外 FLOPs 约 $O(n d)$，可忽略
- **ALiBi**：加 $h n^2$ 次加法，无参数；Bloom 176B 采用
- **存储**：相对偏置表 $(2L-1) \times h$，$L=512, h=12$ 仅约 12K 参数

::: info

**YaRN / LongRoPE**：推理时对 RoPE 频率做插值或分段，128K 模型常用；属于工程外推技巧，原理仍基于相对旋转。

:::

## 常见误区

1. **RoPE 是新增 embedding 表**：否；在 Q/K 上旋转，与 token embedding 相加无关（LLaMA 无绝对位置 embedding）。
2. **ALiBi 与 causal mask 冲突**：ALiBi 常与因果 mask 叠加，远距离额外惩罚。
3. **一种方案通吃**：预训练长度、微调数据、推理长度需一起设计；外推是活跃研究领域。

## 小结

位置编码从绝对 → 相对 → RoPE/ALiBi，服务于更长 context 与更好外推。LLaMA 系用 RoPE（$d_k=128$，32 头）；T5 用相对偏置。下一篇：LayerNorm 放残差前还是后。

下一篇：[Pre-Norm 与 Post-Norm](/manual/llm/bit-to-agi/05-transformer/pre-norm-vs-post-norm)
