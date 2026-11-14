---
title: "第六章总结"
description: "从 Bit 到 AGI · 第六章：Token · 第六章总结"
source: "https://daiw.org/manual/bit-to-agi/06-tokenizer/chapter-summary"
---

# 第六章总结

> 从 Bit 到 AGI · 第六章：Token · 第六章总结

本章把 **Tokenizer** 从「预处理细节」拉到与 **Embedding 参数量、注意力 FLOPs、API 账单** 同级的核心设计。以下回顾关键概念与数量级，供日后选型、估费和 debug 时快速查阅。

## 核心概念

| 概念 | 一句话 |
| --- | --- |
| Token | 词表中的整数 ID；模型读写的是 ID 序列，不是 UTF-8 原文 |
| BPE | 反复合并最高频字节/字符对，GPT/tiktoken 主流路线 |
| SentencePiece | 无预分词的 UTF-8 子词框架；Llama 2/Gemma/T5 常用 |
| 词表 $V$ | Embedding 行数；$V$ 越大，同文本 Token 通常越少，但参数越多 |
| bytes/token | 衡量 Token 效率；英文 ~4，中文常 ~2–3 |

## 为什么不字级、不词级

- **字级**：CJK Unicode 9 万+ 码位，OOV 与 Embedding 膨胀不可接受。
- **词级**：英文形态变化、代码、URL 导致 OOV；Zipf 长尾浪费 Embedding 行。
- **子词**：有限 $V$ 覆盖任意 UTF-8；Rare 文本拆成高频片段，参数复用。

## 量化备忘

**Embedding 参数**：

$$
V \times d \quad (\text{例：} 128{,}256 \times 4{,}096 \approx 525\text{M})
$$

**注意力 FLOPs**（随序列 Token 数 $N$）：

$$
O(N^2 \cdot d)
$$

**API 费用**：

$$
\text{cost} = N_{\text{in}} \cdot p_{\text{in}} + N_{\text{out}} \cdot p_{\text{out}}
$$

**中文 vs 英文 Token 比**（同语义，经验范围）：

$$
R = N_{\zh} / N_{\en} \approx 1.5\text{–}2.5
$$

8 万字中文 RAG 输入可能比同等英文 **贵 ~70%**——估预算时必须分语言 `encode`。

## 工程要点

1. **Tokenizer 与权重绑定**：换 merge 规则 = 换模型；微调不得擅自改 $V$。
2. **计数用官方编码器**：`tiktoken` / `sentencepiece` / HF `apply_chat_template`。
3. **中文产品预留 Token 余量**：相对英文 +30% 常见。
4. **JSON 紧凑、Unicode NFC、审计零宽符**——见 [Tokenization 的坑](/manual/llm/bit-to-agi/06-tokenizer/tokenization-pitfalls)。
5. **自训 Tokenizer**（第十章）：在 32K/64K/128K 扫 bytes/token 拐点，见 [训练 Tokenizer](/manual/llm/bit-to-agi/10-train-your-llm/build-tokenizer)。

## 本章目录回顾

1. [Token 是什么](/manual/llm/bit-to-agi/06-tokenizer/what-is-token)
2. [为什么不用汉字](/manual/llm/bit-to-agi/06-tokenizer/why-not-chinese-char)
3. [为什么不用单词](/manual/llm/bit-to-agi/06-tokenizer/why-not-english-word)
4. [BPE 是什么](/manual/llm/bit-to-agi/06-tokenizer/what-is-bpe)
5. [SentencePiece 是什么](/manual/llm/bit-to-agi/06-tokenizer/what-is-sentencepiece)
6. [为什么 Token 越来越多](/manual/llm/bit-to-agi/06-tokenizer/why-tokens-grow)
7. [为什么中文 Token 更贵](/manual/llm/bit-to-agi/06-tokenizer/why-chinese-tokens-cost-more)
8. [词表大小如何选](/manual/llm/bit-to-agi/06-tokenizer/vocabulary-size)
9. [Tokenization 的坑](/manual/llm/bit-to-agi/06-tokenizer/tokenization-pitfalls)

## 下一章

Token 进入 Embedding 之后，便是 **Transformer** 的矩阵运算。继续阅读 [第七章：训练（Training）](/manual/llm/bit-to-agi/07-training)——从「预测下一个 Token」到「如何用梯度更新权重」。

若需动手训练 Tokenizer 与小型 LM，也可跳至 [第十章：自己训练一个模型](/manual/llm/bit-to-agi/10-train-your-llm)。
