---
title: "BERT 与 GPT 的区别"
description: "从 Bit 到 AGI · 第五章：Transformer · 理解模型与生成模型如何分野又殊途同归"
source: "https://daiw.org/manual/bit-to-agi/05-transformer/bert-vs-gpt"
---

# BERT 与 GPT 的区别

> 从 Bit 到 AGI · 第五章：Transformer · 理解模型与生成模型如何分野又殊途同归

BERT 和 GPT 是 Transformer 的两种「搭法」：前者**只堆 Encoder**，双向看全句，做理解；后者**只堆 Decoder**，因果看左侧，做生成。它们曾代表 NLP 两条路线；ChatGPT 之后生成式 Decoder 占上风，但 BERT 系仍在检索、排序、Embedding 里广泛使用。

## 直觉：闭卷填空 vs 接龙造句

- **BERT**：句子挖几个空，根据**左右全文**填回去——理解语境。
- **GPT**：只给上文，猜**下一个字**——造句接龙。

同一套 768 维、12 层、12 头的积木；差在 attention mask、训练目标、以及下游用法。

## 定义

| 维度 | BERT | GPT |
|---|---|---|
| 栈 | Encoder × $N$ | Decoder × $N$ |
| Self-Attention | 双向 | 因果（单向） |
| 预训练目标 | MLM + NSP（base） | 因果 LM（CLM） |
| 典型输入 | `[CLS] 句子 [SEP]` | 纯文本序列 |
| 句向量 | `[CLS]` pooling | 末 token 或 mean |
| Norm | Post-Norm | Pre-Norm（GPT-2+） |

**BERT-base**：$N=12, d=768, h=12, L=512$，110M 参数。

**GPT-2 small**：$N=12, d=768, h=12, L=1024$，124M 参数——几乎同规模，架构对称。

## 例子

**例 1：同一任务不同做法**

任务：「这句话情感正负？」

- BERT：编码全句 → 取 `[CLS]` 768 维 → 线性分类器 → 2 logits
- GPT：构造 prompt「情感：这句话是【 positive / negative 】」→ 看 positive/negative token 的 logits 谁大（生成式分类）

**例 2：Attention 可见范围（$n=5$）**

BERT 位置 2 可见：$\{0,1,2,3,4\}$

GPT 位置 2 可见：$\{0,1,2\}$

```
BERT mask:  全 1 矩阵（除 pad）
GPT mask:   下三角为 1
```

**例 3：参数量细比（约）**

| 组件 | BERT-base | GPT-2 small |
|---|---|---|
| Embedding | 23M + 0.4M pos | 39M（含 pos，更大词表） |
| 12 层 trunk | 85M | 85M |
| 任务头 | MLM 0.9M | lm_head（ tying 则 0 增量） |

```python
# 因果 vs 双向 mask
import torch

n = 5
bidirectional = torch.ones(n, n)
causal = torch.tril(torch.ones(n, n))
print(bidirectional.int())
print(causal.int())
```

## 量化

| 能力 | BERT | GPT |
|---|---|---|
| 双向语境 | 强 | 无（除非看全 prompt） |
| 零样本生成 | 弱 | 强 |
| 微调范式 | 分类头 | Prompt / SFT / RLHF |
| 推理成本（理解） | 一次前向 | 通常更重 |
| 工业现状 | 检索、Embedding、重排 | 对话、代码、推理、Agent |

**Scaling**：GPT-3 沿 Decoder 路线扩到 175B；BERT 最大实用约 340M（RoBERTa-large 355M），再大可理解但生成仍靠 GPT 系。

## 常见误区

1. **BERT 不能生成任何文本**：可以用 MLM 填词，但不是流畅长文生成；需要自回归头或改用 GPT。
2. **GPT 不能做理解任务**：能，通过 prompting 或微调；只是预训练目标偏生成。
3. **两者 embedding 空间可互换**：词表、训练数据不同，向量不可直接混用。

## 小结

BERT = 双向 Encoder + MLM，擅理解；GPT = 因果 Decoder + CLM，擅生成。同规模下约 12 层 768 维 12 头，差在 mask 与 Norm 位置。下一篇：把模型做大时 loss 如何按幂律下降——Scaling Laws。

下一篇：[缩放定律入门](/manual/llm/bit-to-agi/05-transformer/scaling-laws-intro)
