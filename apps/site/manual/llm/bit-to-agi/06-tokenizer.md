---
title: "第六章：Token"
description: "从 Bit 到 AGI 专栏 · Tokenizer · 共 10 篇"
source: "https://daiw.org/manual/bit-to-agi/06-tokenizer"
---

# 第六章：Token

> 从 Bit 到 AGI 专栏 · Tokenizer · 共 10 篇

大语言模型读写的不是汉字，也不是英文单词，而是 **Token**——一串整数 ID。Tokenizer 把 UTF-8 文本切成这些 ID；切法直接决定上下文能装多少字、API 账单多少、训练要多少算力。本章从「Token 是什么」出发，讲清 BPE 与 SentencePiece 的原理，量化中文为何更贵，并列出工程里常见的切分陷阱。

## 本章目录

- [Token 是什么](/manual/llm/bit-to-agi/06-tokenizer/what-is-token)
- [为什么不用汉字](/manual/llm/bit-to-agi/06-tokenizer/why-not-chinese-char)
- [为什么不用单词](/manual/llm/bit-to-agi/06-tokenizer/why-not-english-word)
- [BPE 是什么](/manual/llm/bit-to-agi/06-tokenizer/what-is-bpe)
- [SentencePiece 是什么](/manual/llm/bit-to-agi/06-tokenizer/what-is-sentencepiece)
- [为什么 Token 越来越多](/manual/llm/bit-to-agi/06-tokenizer/why-tokens-grow)
- [为什么中文 Token 更贵](/manual/llm/bit-to-agi/06-tokenizer/why-chinese-tokens-cost-more)
- [词表大小如何选](/manual/llm/bit-to-agi/06-tokenizer/vocabulary-size)
- [Tokenization 的坑](/manual/llm/bit-to-agi/06-tokenizer/tokenization-pitfalls)

建议按顺序阅读。每篇末尾会链到下一篇；全部读完后请参阅[第六章总结](/manual/llm/bit-to-agi/06-tokenizer/chapter-summary)。
