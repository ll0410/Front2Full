---
title: "SentencePiece 是什么"
description: "从 Bit 到 AGI · 第六章：Token · SentencePiece 是什么"
source: "https://daiw.org/manual/bit-to-agi/06-tokenizer/what-is-sentencepiece"
---

# SentencePiece 是什么

> 从 Bit 到 AGI · 第六章：Token · SentencePiece 是什么

**SentencePiece** 是 Google 提出的无预分词（language-agnostic）Tokenizer 框架：把整句 UTF-8 当作原始字节流，用 BPE 或 Unigram 算法学子词，再导出 `.model` 供 C++/Python 加载。Llama、Gemma、T5 等模型的 Tokenizer 多出自此库——与 GPT 的 `tiktoken` 路线不同，但解决的仍是同一问题。

## 直觉

普通 BPE  pipeline 像 **先按语言切菜再炒**：英文按空格、中文按字、日文按形态素——每种语言写一个预分词器。SentencePiece 像 **把整盘沙拉直接进破壁机**：不假设空格存在，把 `_`（U+2581，下划线形空格）当作「词首标记」编进子词。一句中文、一段代码、混排文本走**同一条管道**。

## 定义

**SentencePiece 模型**：包含词表、合并规则（BPE）或 log 概率（Unigram）、以及 `user_defined_symbols` 的二进制 `.model` 文件。

**两种算法**：

| 算法 | 训练目标 | 代表模型 |
| --- | --- | --- |
| BPE | 贪心合并最高频对 | Llama 2、Mistral、Gemma |
| Unigram | 从大词表剪枝，最大化语料似然 | T5、mT5、部分多语模型 |

**空格处理**：输入 `Hello world` 在内部变为 `▁Hello▁world`（`▁` 即 U+2581）；解码时还原空格。无需 Lang-specific pre-tokenizer。

**词表大小 $V$**：训练参数 `vocab_size`，典型 32K、64K、128K、256K。

## 例子

**例子 1：同一字符串，GPT vs SentencePiece**

```python
# OpenAI tiktoken（BPE + regex 预分词）
import tiktoken
enc_gpt = tiktoken.get_encoding("cl100k_base")
print(len(enc_gpt.encode("机器学习很有趣")))  # 约 8–10

# SentencePiece（需对应模型的 .model 文件）
import sentencepiece as spm
sp = spm.SentencePieceProcessor(model_file="llama2.model")
print(len(sp.encode("机器学习很有趣", out_type=int)))  # 约 6–9，因词表而异
```

数字不同 **不代表谁更对**——各自服务各自模型的 Embedding 行数。

**例子 2：Unigram 剪枝直觉**

Unigram 从超大初始词表（如 800K 子词候选）出发，逐步删除使似然下降最小的条目，直到剩 $V$ 个。相比 BPE 贪心合并，Unigram 对 **多种合法切分** 赋概率，训练目标更平滑；T5 系列采用此路线。

## 量化

Llama 3 8B 配置（公开资料量级）：

| 项 | 值 |
| --- | ---: |
| 词表 $V$ | 128,256 |
| Embedding $d$ | 4,096 |
| Embedding 参数量 | $128{,}256 \times 4{,}096 \approx 525\text{M}$ |
| 特殊 Token | `<\|begin_of_text\|>`、`<\|end_of_text\|>` 等 256 个 reserved |

525M 参数约占 8B 总参数的 **6.5%**——Tokenizer 词表大小直接「吃掉」数亿参数。

**推理延迟**：SentencePiece C++ 编码速度约 **1–5 MB/s 文本**（CPU 单核，视实现而定）；相对 GPU 前向可忽略，但在 **海量 batch 预处理** 时需并行。

**文件体积**：`.model` 通常 **500 KB–4 MB**（随 $V$ 增长），需与 checkpoint 一起版本管理。

## BPE vs SentencePiece 对比

| 维度 | GPT tiktoken BPE | SentencePiece |
| --- | --- | --- |
| 预分词 | Regex 分词（英文友好） | 无，UTF-8 原样 |
| 中文 | 依赖 byte 合并 | 同样 byte/子词，语料配比决定效率 |
| 导出格式 | `tiktoken` 内置表 | `.model` + `.vocab` |
| 空格 | 保留在 Token 内或独立 | U+2581 词首标记 |
| 典型 $V$ | 100K | 32K–256K |

## 常见误区

- **「SentencePiece 是一种语言」**：它是**库 + 文件格式**，不是第三种自然语言。
- **「Llama 用 SentencePiece 所以比 GPT 更懂中文」**：中文 Token 效率取决于 **预训练语料中文占比** 与 **词表大小**，不只取决于库名。
- **「Unigram 一定优于 BPE」**：Unigram 训练更慢；BPE 实现简单、工业界更常见；效果需在同一语料上 A/B。

## 动手试一试

训练迷你 SentencePiece BPE 模型：

```bash
# 准备 UTF-8 纯文本 corpus.txt（中英混合几 MB 即可）
spm_train \
  --input=corpus.txt \
  --model_prefix=mini_sp \
  --vocab_size=8000 \
  --model_type=bpe \
  --character_coverage=0.9995 \
  --byte_fallback=true
```

```python
import sentencepiece as spm

sp = spm.SentencePieceProcessor(model_file="mini_sp.model")
for text in ["Hello world", "你好世界", "print(f'{x=}')"]:
    ids = sp.encode(text, out_type=int)
    pieces = sp.encode(text, out_type=str)
    print(f"{text!r}: {len(ids)} tokens -> {pieces}")
```

调 `character_coverage`：0.9995 表示 99.95% 字符被词表覆盖，其余走 byte fallback（与 BPE 字节级兜底类似）。

## 生产部署注意事项

**`.model` 文件版本控制**：与 `pytorch_model.bin` 或 `model.safetensors` **同 tag 发布**；CI 里对 `.model` 做 SHA256，防止「权重是新 checkpoint、Tokenizer 是旧 branch」的 silent bug。

**线程安全**：`SentencePieceProcessor` 在 C++ 层可多线程 encode；Python GIL 下高 QPS 服务仍应用 **进程池** 或 Rust/Go 侧编码，避免 Tokenizer 成瓶颈——尤其 RAG 入库时对百万文档批量 `encode`。

**与 HuggingFace `tokenizers` 互转**：`spm_export_vocab` 可导出词表；部分模型同时提供 `tokenizer.json`（Rust `tokenizers` 格式）与 `tokenizer.model`，二者应 **同源**，不要混用不同 commit 的文件。

**训练时 `byte_fallback=true`**：对 emoji、罕见汉字、部分数学符号至关重要；关闭后未覆盖字符可能被映射到 `<unk>` 或训练失败，推理时出现 **不可逆信息丢失**。

**与 tiktoken 的选型**：若团队同时服务 **OpenAI API** 与 **自托管 Llama**，应维护 **两套 encode 函数**，预算系统分别记账——不可假设「中文都是 2 字节/Token」这类跨模型常数。统一抽象层接口建议：`count_tokens(model_id: str, text: str) -> int`。

**训练资源**：在 100 GB 语料上训练 128K SentencePiece，16 核 CPU + 64 GB RAM 约 **1–3 小时**；语料越大、$V$ 越高，merge 统计越吃内存。应用 **sentencepiece 官方二进制** 而非 Python 循环，可缩短一个数量级。

**Unigram 训练直觉补充**：Unigram 初始词表极大，每轮删除「删掉后似然损失最小」的符号；剩余 $V$ 个符号是 **全局优化** 的结果，而非 BPE 的逐步贪心。T5 系列因此切分更 **平滑**，在 morphologically rich 语言（土耳其语、芬兰语）上有时优于纯 BPE——中文差异较小，选型仍以实测为准。

**空格即语义**：SentencePiece 用 `▁` 标记词首，解码时还原空格；法语 `l'école`、德语复合词等 **无空格语言** 同样受益——不必为每种语言 fork 一个 pre-tokenizer，降低多语模型维护成本。C++ 核心实现使 **移动端本地 encode** 也可行，适合端侧小模型在送 GPU 前先截断 prompt。HuggingFace `convert_slow_tokenizer` 可在 `.model` 与 `tokenizer.json` 间互转，便于接入 Rust 推理栈。生产环境应 **pin 住** `.model` 的 git SHA，与权重 checkpoint 同发布。多语产品选型时，优先在 **目标语言子集** 上比较 bytes/token，而非只看英文基准。SentencePiece 已是事实标准，值得单独纳入团队的知识库与 CI。

## 小结

SentencePiece 提供 **语言无关** 的子词训练与编解码，支持 BPE 与 Unigram；Llama、Gemma、T5 等依赖其 `.model` 文件。与 GPT 的 tiktoken 路线并列，是工业界 Tokenizer 的两大主流实现之一。

下一篇：[为什么 Token 越来越多](/manual/llm/bit-to-agi/06-tokenizer/why-tokens-grow)
