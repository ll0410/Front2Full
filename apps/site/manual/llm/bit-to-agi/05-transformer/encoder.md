---
title: "Encoder 是什么"
description: "从 Bit 到 AGI · 第五章：Transformer · 双向编码器如何读完整句子"
source: "https://daiw.org/manual/bit-to-agi/05-transformer/encoder"
---

# Encoder 是什么

> 从 Bit 到 AGI · 第五章：Transformer · 双向编码器如何读完整句子

BERT、RoBERTa、句子编码器——它们的核心是 **Encoder**：堆叠多层**双向** Self-Attention，每个 token 能看见全句左右上下文。Encoder 不直接逐 token 生成；它输出 contextualized 表示，供分类、填空（MLM）、或作为 Decoder 的 Cross-Attention 输入。

## 直觉：精读一篇文章

读「银行账户」时，「银行」的含义依赖后面是「账户」还是「河岸」。Encoder 允许每个词**同时**看左边和右边，一次前向得到全句深度表示。像精读：先通读全文，再理解每个词在语境中的确切意思。

## 定义

单层 **Encoder Block**：

1. **Multi-Head Self-Attention**（无因果 mask，双向）
2. 残差 + LayerNorm
3. **FFN**
4. 残差 + LayerNorm

与 Decoder Block 相比，少了 Cross-Attention；Self-Attention 无 mask（padding mask 除外，屏蔽 `<pad>`）。

BERT-base：12 层 Encoder，$d_{\text{model}}=768$，12 头，$L_{\max}=512$。

输出 $\mathbf{H}^{(L)} \in \mathbb{R}^{n \times 768}$，第 0 位常对应 `[CLS]`，用于句子级分类。

## 例子

**例 1：MLM（Masked Language Model）**

训练随机 mask 15% token，用双向上下文预测原词。例句「我 [MASK] 北京」——「去」「在」「离开」等候选由左右文共同决定；单向 LM 只能看「我」，信息不足。

**例 2：Encoder 输出用途**

| 任务 | 用法 |
|---|---|
| 情感分类 | 取 `[CLS]` 向量 → 线性层 → 2 类 |
| 命名实体 | 每个 token 768 维 → 线性层 → BIO 标签 |
| 作 T5 的 Encoder | 全序列 $\mathbf{H}$ 供 Decoder Cross-Attention |

```python
# BERT 式 Encoder 一层（示意）
def encoder_layer(x, pad_mask=None):
    # x: (batch, n, 768)
    attn_out = multi_head_attention(x, mask=pad_mask)  # 双向
    x = layer_norm(x + attn_out)
    ffn_out = ffn(x)
    x = layer_norm(x + ffn_out)
    return x
```

## 量化

BERT-base（110M）参数构成：

| 部分 | 约参数量 |
|---|---|
| Embedding + 位置 | 23.8M |
| 12 × Encoder 层 | 85M |
| MLM 头 | 0.9M |

- **前向 FLOPs**（$n=512$）：与 12 层 Decoder 相当，但**无**因果限制，attention 矩阵满 $512 \times 512$
- **推理**：整句一次前向；不适合自回归生成下一个词（需额外 LM 头或改用 Decoder）

## 常见误区

1. **Encoder 只能做分类**：还能做 token 级任务、检索向量、当翻译模型的源侧。
2. **双向 = 训练看答案**：MLM 只 mask 部分词；被 mask 位置不用自身 embedding 作输入，但可用其他位置的上下文。
3. **BERT 有 Decoder**：标准 BERT **只有 Encoder**；名称里的「Encoder」指 Transformer 左半架构，非「编码成二进制」。

## 小结

Encoder 用双向 Multi-Head Attention + FFN，输出 contextualized 的 768 维向量。BERT-base 是 12 层纯 Encoder。下一篇：Encoder 与 Decoder 如何组合成翻译模型。

下一篇：[Encoder-Decoder 架构](/manual/llm/bit-to-agi/05-transformer/encoder-decoder)
