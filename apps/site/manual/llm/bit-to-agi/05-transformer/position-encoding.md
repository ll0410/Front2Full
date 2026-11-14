---
title: "Position Encoding"
description: "从 Bit 到 AGI · 第五章：Transformer · 如何让模型感知 token 的顺序"
source: "https://daiw.org/manual/bit-to-agi/05-transformer/position-encoding"
---

# Position Encoding

> 从 Bit 到 AGI · 第五章：Transformer · 如何让模型感知 token 的顺序

Self-Attention 对输入集合做加权求和，本身**置换等变**——打乱 token 顺序，若不额外处理，输出只是相应打乱。自然语言里「狗咬人」和「人咬狗」含义完全不同，因此必须注入**位置信息**。Position Encoding（位置编码）就是干这件事的。

## 直觉：给每个座位发号码牌

Embedding 告诉模型「这个词是什么」；位置编码告诉模型「它坐在第几个位置」。原论文用不同频率的正弦/余弦函数给每个维度一个随位置变化的「刻度」，像钟表的时针、分针、秒针以不同速度转动，组合起来唯一标识位置。

## 定义：正弦位置编码（Original Transformer）

对位置 $pos \in \{0, 1, \ldots, n-1\}$，维度 $i \in \{0, 1, \ldots, d_{\text{model}}-1\}$：

$$
\begin{aligned}
PE_{(pos, 2i)} &= \sin\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right) \\
PE_{(pos, 2i+1)} &= \cos\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right)
\end{aligned}
$$

最终输入为：

$$
\mathbf{x}_i' = \mathbf{x}_i + PE(pos)
$$

其中 $\mathbf{x}_i$ 是 embedding 向量。$d_{\text{model}}=768$ 时，$PE(pos)$ 也是 768 维。

## 例子

**例 1：BERT-base 的实际做法**

BERT 不用正弦编码，而用**可学习的绝对位置 embedding**：矩阵 $P \in \mathbb{R}^{L_{\max} \times 768}$，$L_{\max}=512$。参数量 $512 \times 768 = 393{,}216 \approx 0.39\text{M}$。

```python
import torch
import torch.nn as nn

d_model, max_len = 768, 512
pos_embed = nn.Embedding(max_len, d_model)

seq_len = 128
positions = torch.arange(seq_len)  # 0..127
# token_embed: (batch, 128, 768)
hidden = token_embed + pos_embed(positions)
```

**例 2：正弦编码的数值感受**

设 $d_{\text{model}}=768$，$pos=0$ 与 $pos=1$ 在前 4 维（示意）：

| 维度 | $pos=0$ | $pos=1$ |
|---|---|---|
| 0 ($\sin$) | 0.000 | 0.841 |
| 1 ($\cos$) | 1.000 | 0.540 |
| 2 ($\sin$) | 0.000 | 0.010 |
| 3 ($\cos$) | 1.000 | 1.000 |

低频维度变化慢，高频维度变化快；不同 $pos$ 形成唯一指纹。

### 自己拖一下

上面只是 2 个位置 × 4 维共 8 个数字，「低频慢、高频快」这句话在表格里根本看不出来。下面把 100 个位置 × 128 个维度一次铺成热力图：

<PositionalEncoding />

看那些**条纹**：左边维度频率高（相邻位置就变色，像秒针），右边频率低（几十个位置才变一次，像时针）。拖动 `pos` 看每一行的「指纹」——每个位置的配色组合都各不相同，这就是模型区分「第 3 个」和「第 30 个」token 的依据。不同频率的维度像不同速度的钟表指针，组合起来既标识绝对位置、又让相对距离有稳定表示——正是后来 RoPE 发扬光大的性质。

## 量化

| 方案 | 参数量 | 外推长度 |
|---|---|---|
| 正弦（固定） | 0 | 训练时可超过 $L_{\max}$（质量不保证） |
| 可学习绝对（BERT） | $L_{\max} \cdot d$ | 超过 512 需插值或扩展 |
| RoPE（见后文） | 0 | LLaMA 等主流 |

- 加法融合：一次向量加，$O(n \cdot d)$，可忽略
- 相对位置信息也可由 attention 偏置或 RoPE 在 Q/K 中实现，不必显式加在输入上

## 常见误区

1. **「Transformer 不理解顺序」**：错在没有位置编码时成立；加上 PE 或 RoPE 后，顺序信息充分参与 attention。
2. **位置从 1 开始还是从 0 开始**：实现细节，训练与推理一致即可；BERT 用 0..511。
3. **padding 位置也要编码**：通常 pad token 仍加位置向量，但 attention mask 会屏蔽 pad，使其不影响有效 token。

## 动手试一试

```python
import math
import torch

def sinusoidal_pe(max_len: int, d_model: int) -> torch.Tensor:
    pe = torch.zeros(max_len, d_model)
    position = torch.arange(max_len).unsqueeze(1).float()
    div_term = torch.exp(
        torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
    )
    pe[:, 0::2] = torch.sin(position * div_term)
    pe[:, 1::2] = torch.cos(position * div_term)
    return pe

pe = sinusoidal_pe(512, 768)
print(pe.shape)  # torch.Size([512, 768])
```

## 小结

位置编码解决「集合 → 序列」的缺口。原版用正弦函数；BERT 用可学习向量；现代 LLM 多用 RoPE（见[位置编码的变体](/manual/llm/bit-to-agi/05-transformer/positional-encoding-variants)）。与 embedding 相加后，才进入 Self-Attention。

下一篇：[Self Attention](/manual/llm/bit-to-agi/05-transformer/self-attention)
