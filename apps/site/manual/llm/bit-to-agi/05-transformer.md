---
title: "第五章：Transformer"
description: "从 Bit 到 AGI 专栏 · 统一世界的架构 · 共 20 篇"
source: "https://daiw.org/manual/bit-to-agi/05-transformer"
---

# 第五章：Transformer

> 从 Bit 到 AGI 专栏 · 统一世界的架构 · 共 20 篇

2017 年 Google 论文 *Attention Is All You Need* 提出的 Transformer，用「全连接的自注意力」替代 RNN 的逐步递推，成为今天几乎所有大语言模型的骨架。本章从 Embedding 到 Scaling Laws，用 BERT-base 的常用尺寸（$d_{\text{model}}=768$，12 层，12 头）贯穿每一篇，让你能对着公式读出参数量与 FLOPs。

读完本章，你将能拆解任意 Transformer 块的内部结构，并理解为什么 GPT、BERT、T5 只是同一套积木的不同搭法。

## 本章目录

- [Embedding 是什么](/manual/llm/bit-to-agi/05-transformer/what-is-embedding)
- [Position Encoding](/manual/llm/bit-to-agi/05-transformer/position-encoding)
- [Self Attention](/manual/llm/bit-to-agi/05-transformer/self-attention)
- [Q、K、V 是什么](/manual/llm/bit-to-agi/05-transformer/qkv)
- [Residual 连接](/manual/llm/bit-to-agi/05-transformer/residual-connection)
- [LayerNorm](/manual/llm/bit-to-agi/05-transformer/layer-norm)
- [Feed Forward 层](/manual/llm/bit-to-agi/05-transformer/feed-forward)
- [Multi Head Attention](/manual/llm/bit-to-agi/05-transformer/multi-head-attention)
- [Decoder 是什么](/manual/llm/bit-to-agi/05-transformer/decoder)
- [Encoder 是什么](/manual/llm/bit-to-agi/05-transformer/encoder)
- [Encoder-Decoder 架构](/manual/llm/bit-to-agi/05-transformer/encoder-decoder)
- [为什么 Transformer 统一世界](/manual/llm/bit-to-agi/05-transformer/why-transformer-unifies)
- [Attention 的复杂度](/manual/llm/bit-to-agi/05-transformer/attention-complexity)
- [位置编码的变体](/manual/llm/bit-to-agi/05-transformer/positional-encoding-variants)
- [Pre-Norm 与 Post-Norm](/manual/llm/bit-to-agi/05-transformer/pre-norm-vs-post-norm)
- [BERT 与 GPT 的区别](/manual/llm/bit-to-agi/05-transformer/bert-vs-gpt)
- [缩放定律入门](/manual/llm/bit-to-agi/05-transformer/scaling-laws-intro)
- [从 RNN 到 Transformer](/manual/llm/bit-to-agi/05-transformer/from-rnn-to-transformer)
- [Transformer 块的解剖](/manual/llm/bit-to-agi/05-transformer/transformer-block-anatomy)

---

**建议阅读顺序**：按目录自上而下；若你已熟悉 RNN 瓶颈，可先读[从 RNN 到 Transformer](/manual/llm/bit-to-agi/05-transformer/from-rnn-to-transformer)再回头补 Embedding。

下一篇：[Embedding 是什么](/manual/llm/bit-to-agi/05-transformer/what-is-embedding)
