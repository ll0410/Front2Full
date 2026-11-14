---
title: "为什么不用单词"
description: "从 Bit 到 AGI · 第六章：Token · 为什么不用单词"
source: "https://daiw.org/manual/bit-to-agi/06-tokenizer/why-not-english-word"
---

# 为什么不用单词

> 从 Bit 到 AGI · 第六章：Token · 为什么不用单词

英文 NLP 早期常用「空格分词 + 词表」：每个单词一个 ID。这对 Word2Vec 时代可行，但对大词表、多语言、代码和形态变化丰富的语言，**词级 Tokenization 很快失效**。本篇说明子词方案如何取代「一个单词一个 Token」。

## 直觉

单词 Tokenization 像 **给世界上每一本书单独编一个 SKU**：「run」「runs」「running」「ran」是四个 SKU；「ChatGPT」「chatgpt」「Chat GPT」又是三个。词表爆炸，且永远追不上新造词。子词 Tokenization 则像 **用标准零件拼装**：`run` + `ning`，`Chat` + `GPT`——零件数有限，组合无限。

## 定义

**词级 Tokenization**：以空格/标点预切分后的「词」为原子；词表 $V$ 是训练语料中出现过的词集合（加 `<UNK>` 处理未登录词）。

**未登录词（OOV）率**：语料中不在词表内的词占比。词表 50K 时，维基百科英文 OOV 仍可达 **3–8%**（数字、专有名词、拼写变体）。

**子词 Tokenization**：词表元素长度可变，常见 1–16 字节；任意词可表示为子词序列 $w \rightarrow (s_1, s_2, \ldots, s_k)$。

## 例子

**例子 1：形态变化拆散词表**

| 单词 | 词级 Token 数 | BPE 子词（示意） | 子词 Token 数 |
| --- | ---: | --- | ---: |
| `unhappiness` | 1（若在词表）或 OOV | `un` + `happiness` | 2 |
| `tokenization` | 1 或 OOV | `token` + `ization` | 2 |
| `ChatGPT-4o` | OOV | `Chat` + `GPT` + `-` + `4` + `o` | 5 |

词级方案要么词表无限膨胀，要么大量 `<UNK>`；子词用 **2–5 个 Token** 稳定表示罕见组合。

**例子 2：代码与 URL 没有「词」**

```python
url = "https://api.openai.com/v1/chat/completions"
# 词级：整段可能 1 个 OOV
# BPE：拆成 https、://、api、.、openai、... 等子词
```

程序员每天写的代码、JSON、正则表达式，**没有自然空格分词**。子词从字节/字符出发，才能统一处理 prose 与 code。

## 量化

设英文语料唯一词数为 $W$（类型数，types），语料总词频为 $T$（tokens）。

| 指标 | 词级（50K 词表） | BPE（32K 子词） |
| --- | --- | --- |
| 词表大小 $V$ | 50,000 | 32,000 |
| 典型 OOV | 3–8% | ≈ 0%（UTF-8 可表示） |
| 平均每词 Token 数 | 1.0 | 1.2–1.5 |
| Embedding 参数（$d$=4096） | 205M | 131M |

词级 **每词 1 Token 看似更省**，但 OOV 处理与更大词表抵消优势；且 rare 词各占一行 Embedding，**数据稀疏**——出现 5 次的词与出现 50 亿次的词占同样一行参数。

Zipf 定律：排名第 $r$ 的词频 $\propto 1/r$。词表前 10K 词覆盖约 95% 语料，剩余长尾词种类占 **50%+ 类型**却极少出现。词级 Embedding 把参数浪费在长尾上；BPE 把长尾拆成高频子词，**参数复用率**更高。

## 常见误区

- **「英文按空格分词就够了」**：`don't`、`state-of-the-art`、`3.14` 都会折磨简单分词器。
- **「子词会把单词意思拆碎」**：模型在上下文中学习子词组合语义；`un` + `happy` 的向量会通过注意力合成，与 Word2Vec 一词一向量不同但有效。
- **「GPT 的 Token 就是单词」**：打开 tiktoken 可见 `hello` 常 1 Token，但 `Hello` 与 `hello` 可能是不同 Token；大小写敏感。

## 动手试一试

对比词级估算与子词真实计数：

```python
import tiktoken
import re

enc = tiktoken.get_encoding("cl100k_base")

text = "Unbelievably, tokenizers aren't simple word-splitters for state-of-the-art models."
word_count = len(re.findall(r"\b\w+\b", text))  # 粗略「单词数」
token_count = len(enc.encode(text))

print(f"单词数（regex）: {word_count}")
print(f"Token 数（BPE）: {token_count}")
print(f"Token/词 比: {token_count/word_count:.2f}")
```

通常 `Token/词` 在 1.2–1.8 之间，而非 1.0。

## 词级时代的遗产

2013–2018 年的 word2vec、GloVe、早期 RNN 语言模型普遍 **一词一向量**。词表 30K–100K，`<UNK>` 用单一向量糊弄所有未登录词——「Google」与「Googleplex」在 OOV 时共享同一 embedding，语义分辨率极差。

**SentencePiece 与 BPE 普及后**，Rare 词被拆成常见子词，每个子词的向量在预训练中充分更新；整词语义由 **多层 Transformer 动态组合**，不再要求一词一静态向量。这是从「查词典」到「拼乐高」的范式转移。

**分词器耦合问题**：英文 word-level pipeline 常链 **Stemmer → POS → Parser**，语言特定逻辑厚重。现代 LLM 尽量 **端到端 UTF-8 in → Token ID out**，把语言学先验交给数据与模型容量，Tokenizer 只保留统计合并规则——部署更简单，中英混排无需切换分词器。

**词级在检索侧仍有影子**：BM25、Elasticsearch 默认按 **词** 建倒排索引；RAG 系统里「Chunk 按 Token 切、索引按词切」的不一致，有时会导致召回片段与模型上下文边界错位——工程上应用同一套 Tokenizer 做 **对齐切分**（见 pitfalls 篇）。

**复合词与命名实体**：`New York`、`OpenAI` 在词级词表中若未同时出现，会被拆成两个 OOV 或两个独立词；BPE 在足够语料下常合并为 **1–2 个 Token**，实体边界更稳定。NER 任务因此间接受益于子词——尽管模型并未显式标注实体 span。

**大小写与词级**：`Apple`（公司）与 `apple`（水果）在词级共用一个 lowercase 词表条目时 **语义混淆**；现代 BPE 常 **保留大小写** 为不同 Token，代价是词表略增，但代码与专名场景更准。

**标点附着**：英文 word-level 需决定 `don't` 算一词还是两词；子词把 `'` 当作普通 UTF-8 字节参与 merge，**无需 linguist 手写规则**——这是统计方法对规则方法的胜利，维护成本接近零。

**跨语言统一**：多语 LLM 若英文用词级、中文用字级，**Embedding 空间无法对齐**，同一 batch 内两种切分逻辑并存会彻底搞乱训练 pipeline。子词 + UTF-8 是 **单轨方案**，工程上别无选择。这也是 OpenAI、Meta、Mistral 等 **全系子词** 的共同理由，而非偶然共识。

## 小结

词级 Tokenization 无法应对 **OOV、形态变化、代码与多语言混排**，且 Embedding 参数随词种膨胀。BPE 等子词方法用更小词表、略多的 Token 数，换取 **零 OOV 与更高参数效率**——这是 GPT 家族放弃「单词 = Token」的根本原因。

下一篇：[BPE 是什么](/manual/llm/bit-to-agi/06-tokenizer/what-is-bpe)
