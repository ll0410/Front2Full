---
title: "Embedding 是什么"
description: "从 Bit 到 AGI · 第五章：Transformer · 词如何把离散符号变成可计算的向量"
source: "https://daiw.org/manual/bit-to-agi/05-transformer/what-is-embedding"
---

# Embedding 是什么

> 从 Bit 到 AGI · 第五章：Transformer · 词如何把离散符号变成可计算的向量

Tokenizer 把句子切成 token ID（整数），但神经网络只能对浮点数做矩阵乘法。Embedding 层就是这座桥：查表，把每个 ID 映射成 $d_{\text{model}}$ 维的稠密向量。没有这一步，Transformer 无从谈起。

## 直觉：字典里的「坐标」

想象词汇表是一本 30 522 页的字典，每一页只写一行 768 个数字——那就是 BERT-base 的 embedding 矩阵。token ID `2054`（「hello」）就是页码；查表得到 768 维向量，表示「hello」在当前模型语义空间里的坐标。

相近含义的词，坐标也相近。训练完成后，「king − man + woman ≈ queen」这类向量算术，正是 embedding 学出来的几何结构。

## 定义

设词汇表大小为 $V$，隐藏维度为 $d_{\text{model}}$。Embedding 是一个可学习矩阵：

$$
E \in \mathbb{R}^{V \times d_{\text{model}}}
$$

对输入序列 $\mathbf{x} = (x_1, x_2, \ldots, x_n)$，其中 $x_i \in \{0, 1, \ldots, V-1\}$：

$$
\mathbf{h}_i = E[x_i] \in \mathbb{R}^{d_{\text{model}}}
$$

堆叠后得到 $\mathbf{H} \in \mathbb{R}^{n \times d_{\text{model}}}$，送入第一层 Transformer。

## 例子

**例 1：BERT-base 尺寸**

| 量 | 值 |
|---|---|
| $V$（vocab） | 30 522 |
| $d_{\text{model}}$ | 768 |
| Embedding 参数量 | $V \times d = 30{,}522 \times 768 \approx 23.4\text{M}$ |
| 单 token 向量字节（fp32） | $768 \times 4 = 3{,}072$ B |

BERT-base 总参数约 110M，embedding  alone 就占约 21%。

**例 2：查表 vs  one-hot 乘矩阵**

One-hot 向量 $\mathbf{e}_i \in \mathbb{R}^V$（第 $i$ 位为 1）乘以 $E^\top$ 与直接取 $E[i]$ 数学等价，但查表只需读一行，内存带宽从 $O(V \cdot d)$ 降到 $O(d)$。

```python
import torch
import torch.nn as nn

V, d_model = 30522, 768
embed = nn.Embedding(V, d_model)

#  batch=2, seq_len=128
token_ids = torch.randint(0, V, (2, 128))
hidden = embed(token_ids)  # shape: (2, 128, 768)
assert hidden.shape == (2, 128, d_model)
```

## 量化

- **输入**：整数 ID，每个 4 B（int32）或 2 B（int16 索引）
- **输出**：$n$ 个 token → $n \times d_{\text{model}} \times 4$ B（fp32）
- **前向 FLOPs**：查表几乎不计；若用 one-hot 形式则为 $2 n V d$（所以没人这么做）
- **与 Tokenizer 的衔接**：第 6 章 BPE 决定 $V$；中文同样走 ID → embedding，只是 ID 分布不同

::: warning

Embedding 与输出层（lm_head）**权重 tying** 时，两者共享同一矩阵，可省约 23M 参数。GPT-2/3 常用此技巧；BERT 的 MLM head 通常独立。

:::

## 常见误区

1. **Embedding 等于 Word2Vec**：Word2Vec 是预训练方法；Transformer 里的 embedding 是端到端随任务一起训练的参数。
2. **维度越高越好**：$d_{\text{model}}$ 增大带来参数与计算量线性增长；768 是 BERT-base 在效果与成本间的折中。
3. **ID 0 一定有特殊含义**：取决于 tokenizer；BERT 的 `[CLS]`、`[PAD]` 各有固定 ID，需查词表而非假设。

## 小结

Embedding 把离散 token 变成 $\mathbb{R}^{d_{\text{model}}}$ 上的向量，是 Transformer 的第一层。BERT-base 用 $768$ 维、约 23M 参数的查表矩阵。下一篇讲：向量本身不含顺序，位置信息从哪来？

下一篇：[Position Encoding](/manual/llm/bit-to-agi/05-transformer/position-encoding)
