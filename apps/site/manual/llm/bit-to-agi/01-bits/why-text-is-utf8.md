---
title: "文字为什么最后都是 UTF-8"
description: "Unicode 码点、UTF-8 变长编码与 tokenizer——中文为何占 3 字节。"
source: "https://daiw.org/manual/bit-to-agi/01-bits/why-text-is-utf8"
---

# 文字为什么最后都是 UTF-8

> Unicode 码点、UTF-8 变长编码与 tokenizer——中文为何占 3 字节。

你在编辑器里打「模型」，在 Python 里 `len("模型")` 是 2，但 `len("模型".encode("utf-8"))` 是 **6**——每个汉字通常 **3 字节**。互联网、Git、JSON、LLM 训练语料，**默认编码几乎都是 UTF-8**。不搞清字节与字符的区别，读不懂 token 计数和 API 计费。

## 直觉：全球字符一本大字典 + 紧凑打包

**Unicode** 给每个字符分配码点（Code Point），如 `U+6A21`（模）、`U+578B`（型）。**UTF-8** 是把码点编成 1–4 字节的规则：英文 ASCII 仍 1 字节，中文多数 3 字节，emoji 可能 4 字节——**英文网页零迁移成本**，同时覆盖全球文字。

## 定义

| 概念 | 说明 |
| ---- | ---- |
| 码点 | `U+XXXX`，理论空间 >100 万，常用 BMP ~6 万 |
| UTF-8 | 变长：0xxxxxxx（1B）、110xxxxx 10xxxxxx（2B）… |
| UTF-16 | 固定 2 或 4 字节；Windows API、Java 内部常见 |
| UTF-32 | 固定 4 字节；占空间，少用于存储 |

ASCII（0–127）与 UTF-8 单字节部分**完全兼容**。

## 例子一：「AI」与「模型」的字节

```python
for s in ["AI", "模型", "🤖"]:
    b = s.encode("utf-8")
    print(repr(s), "chars", len(s), "bytes", len(b), b.hex())
# AI: 2 chars, 2 bytes
# 模型: 2 chars, 6 bytes  (e6 a8 a1 e5 9e 8b)
# 🤖: 1 char, 4 bytes       (f0 9f a4 96)
```

LLM **tokenizer** 在 UTF-8 字节或 Unicode 字符上做 BPE：中文常被拆成 2–3 token/字，英文约 4 字符/token——**同样语义，中文更费 token**（后文 tokenizer 章详述）。

## 例子二：错误解码的乱码

把 UTF-8 当 Latin-1 读 → `mojibake`。把 JSON 里未转义的 raw 二进制塞进 string → 解析失败。HTTP 头 `Content-Type: text/plain; charset=utf-8` 声明的就是这套规则。

```python
# 合法 JSON 必须是 UTF-8（RFC 8259）
import json
json.dumps({"msg": "模型"})  # \u6a21\u578b 或直出 UTF-8
```

## 量化：语料与存储

- 1 纯英文 MB（~1M 字符）≈ **1 MB** UTF-8。
- 1 纯中文 MB（~1M 汉字）≈ **3 MB** UTF-8。
- 1B token 预训练语料：若中英混合平均 **~1.5–2 byte/token** 粗算，磁盘 **数百 GB–TB**。

GitHub 2015 年起默认 UTF-8；Linux `$LANG` 常用 `en_US.UTF-8`。Windows 10+ 也逐步 UTF-8 化。

## BOM 与规范化

- **UTF-8 BOM**（EF BB BF）：Windows 记事本历史问题；Unix 工具可能认成字符，一般 **UTF-8 无 BOM**。
- **NFC vs NFD**：「é」可以是单码点或 e+组合符；搜索、哈希前应 **normalize**（`unicodedata.normalize`）。

## UTF-8 编码规则（表驱动）

| 码点范围 | UTF-8 字节模式 | 长度 |
| -------- | -------------- | ---- |
| U+0000–U+007F | `0xxxxxxx` | 1 |
| U+0080–U+07FF | `110xxxxx 10xxxxxx` | 2 |
| U+0800–U+FFFF | `1110xxxx 10xxxxxx 10xxxxxx` | 3 |
| U+10000–U+10FFFF | `11110xxx ...` | 4 |

「模」U+6A21 → UTF-8 `E6 A8 A1`（3 字节）。验证非法序列（如 lone surrogate、`C0 80` overlong）是安全 parser 必做——**注入攻击常利用错误解码**。

## 与 LLM 计费的直接关系

GPT-4 API 按 **input/output token** 计费。同一篇 2000 汉字文章约 **6000 UTF-8 字节**、可能 **3500–4500 token**（视 BPE）；英文 2000 word 可能 **2500–3000 token**。**中文同样信息量常更贵**——根因 partly 在 UTF-8 字节数与 BPE 切分，不是 Unicode 本身「歧视中文」。

训练语料按 **token 数** 配比语言（如 50% English / 30% Chinese）；UTF-8 磁盘体积与 token 数不成正比，**预算应用 token 估算**。

## emoji、组合字符与 grapheme

用户看到的「字」≠ Unicode 码点：👨‍👩‍👧 是 **多个码点 + ZWJ 连接**；é 可 NFC 单码点或 NFD `e + ◌́`。Tokenizer 按 UTF-8 **字节 BPE** 时，组合字符可能被拆成多个 token——**字符串长度、码点数、字节数、token 数四者不同**。

`len("👨‍👩‍👧")` Python 可能是 1（grapheme 簇）或 5（码点）视版本；`encode utf-8` 字节 **20+**。计费与截断应用 **token 数**，不是 `len(str)`。

## 场景实战：JSONL 微调集一行是什么

```jsonl
{"messages":[{"role":"user","content":"解释比特"},{"role":"assistant","content":"..."}]}
```

一行 UTF-8 文本，磁盘 **几 KB 到几十 KB**；训练时读入 → tokenize → **int32 序列** → embedding。整个 SFT 数据集 **1 GB JSONL** 可能只有 **~5 亿 token** 量级——**文本 bit 远小于同 token 数的 embedding 激活显存**（一次 forward 临时 tensor 更大）。

Git 存 JSONL diff 友好；存 tokenized binary 省 space 但不可读——**工程在 human-readable bit 与 machine-efficient bit 间权衡**。

## 常见误区

1. **「一个 char 永远是一个汉字」**——Java/C# `char` 是 UTF-16 单元； surrogate pair 要两个 char 表示一个 emoji。
2. **「UTF-8 比 GBK 浪费中文空间」**——GBK 中文 2 字节，UTF-8 3 字节；但 GBK 不能表示 emoji 和全球语言，互联网互操作性为零。
3. **「LLM 理解 Unicode」**——模型只见 token ID 序列；UTF-8 是文件与 API 层的序列化格式。

## 动手试一试

统计一本书 UTF-8 字节与 token 粗估（需 tiktoken 可选）：

```python
text = open("sample.txt", encoding="utf-8").read()
print("字符数", len(text), "UTF-8 字节", len(text.encode("utf-8")))
try:
    import tiktoken
    enc = tiktoken.get_encoding("cl100k_base")
    toks = enc.encode(text)
    print("token 数", len(toks), "bytes/token", len(text.encode())/len(toks))
except ImportError:
    pass
```

## 延伸思考

**Byte-level BPE**（GPT-2）在 UTF-8 **字节**上 merge，对多语言 **公平** 但中文 **token 碎**。**Character + Byte fallback** 混合词表减 OOV。**Normalization Form KC** 在入库前统一，避免 **同形异码** 导致 duplicate embedding 训练信号。**Context window** 限 **token 数** 非 **字符数**——**2000 汉字可能 4000 token**，plan API 成本要用 **tiktoken 预数** 而非 `len(text)`。

## 温故：文本 bit 与合规

日志、训练数据 **PII** 以 UTF-8 存盘；GDPR 删除用户 = 删含其 email 的 **record 字节**。Tokenizer 不可逆：**删原文仍可能从 embedding 反推风险**（membership inference）——**文本 bit 治理** 是 AI 合规底座，与模型结构无关。

## 补充：ASCII vs UTF-8 混排

代码注释、log 常 **英文 ASCII 1B + 中文 3B 混排**；grep 按 **byte offset** 与按 **字符 index** 结果不同。**LSP/IDE** 用 Unicode code point index——**调试「第 100 字符截断」要声明是 byte 还是 code point 还是 token**。

## 读完带走

**UTF-8** 是 web 与 LLM 文件层事实标准；**token** 是模型层。**中文 3B/字** vs 英文 **~1B/char** 导致 **同语义不同 token 费**。计费、截断、context 规划 **必须用 tokenizer 数**。

## 小结

文字在磁盘与网络上 = **UTF-8 字节流**。字符是 Unicode 抽象码点；Python `str` 是码点序列，不是字节。LLM 的 prompt 限额、训练语料体积，都绕不开 UTF-8。**API 限额按 token** 时，用官方 tokenizer 预数中文 prompt，别用「字数 × 2」拍脑袋。**tiktoken** 与 **SentencePiece** 对同一字符串可能给出 **不同 token 数**。**计费差异** 可达 **20–40%**，写 budget 要用同一 tokenizer。

动手作业：打开 `nvidia-smi` 或活动监视器，对照本章公式估算当前进程的 **权重与 KV 占用**，误差在一个数量级内即合格。

入库前 **NFC 规范化** 可避免重复训练样本。

**Streaming JSON** 解析仍按 UTF-8 字节流；chunk 边界可能在 multibyte 中间，需 stateful decoder。

## 第一章衔接

本章用 **bit 语言** 描述 AI 底座；第二章 **[数学](/manual/llm/bit-to-agi/02-math)** 用 **向量与矩阵** 重述同一物理过程。两章对照读：**bytes 是存储，FLOPs 是计算，带宽是瓶颈**——三个量构成工程三角。

下一篇：[文件是什么](/manual/llm/bit-to-agi/01-bits/what-is-a-file)——字节流如何被命名和组织。**BOM** 不应出现在供 API 消费的 UTF-8 文件开头；若 Excel 导出 CSV 带 BOM，parser 可能把首列名读成 **`\ufeffid`**——**多一个 invisible 字符，整列 join 失败**。
