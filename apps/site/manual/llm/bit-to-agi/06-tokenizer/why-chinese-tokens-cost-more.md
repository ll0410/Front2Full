---
title: "为什么中文 Token 更贵"
description: "从 Bit 到 AGI · 第六章：Token · 为什么中文 Token 更贵"
source: "https://daiw.org/manual/bit-to-agi/06-tokenizer/why-chinese-tokens-cost-more"
---

# 为什么中文 Token 更贵

> 从 Bit 到 AGI · 第六章：Token · 为什么中文 Token 更贵

同样一段意思，中文 prompt 往往比英文 **消耗更多 Token**，API 按 Token 计价时就是 **同样任务更贵**。这不是「歧视中文」，而是 UTF-8 字节结构、BPE 训练语料配比与词表设计共同造成的 **可量化差异**。本篇用字节数、Token 数和真实账单公式算给你看。

## 直觉

API 计费像 **按集装箱个数收费**，不是按货物重量。中文每个字在 UTF-8 里占 **3 字节**，但 BPE 词表多在英文语料上长大，常见汉字常被切成 **1–2 个 Token**；英文一个 Token 却能吞下 **3–4 个字母**。同样的信息量，中文往往要更多「集装箱」。

## 定义

**Token 效率（中文）**：

$$
\eta_{\zh} = \frac{\text{汉字数}}{N_{\text{tokens}}} \quad (\text{字/Token})
$$

**Token 效率（英文）**：

$$
\eta_{\en} = \frac{\text{单词数}}{N_{\text{tokens}}} \quad (\text{词/Token})
$$

**等价比率**：表达同一语义时，中文 Token 数与英文 Token 数之比 $R = N_{\zh} / N_{\en}$。经验上 $R \approx 1.5\text{–}2.5$（视模型与文体而定）。

**API 费用**（线性计价）：

$$
\text{cost} = \frac{N_{\text{in}}}{10^6} \cdot p_{\text{in}} + \frac{N_{\text{out}}}{10^6} \cdot p_{\text{out}}
$$

其中 $p_{\text{in}}, p_{\text{out}}$ 为每百万 Token 的输入/输出单价（USD 或 CNY）。

## 例子

**例子 1：平行句的字节数 vs Token 数**

以下用 `cl100k_base` 量级（请本地 `tiktoken` 验证精确值）：

| 文本 | UTF-8 字节 | Token 数 | 字节/Token |
| --- | ---: | ---: | ---: |
| `Artificial intelligence is transforming software.` | 49 | 7 | 7.0 |
| `人工智能正在改变软件行业。` | 39 | 11 | 3.5 |
| `Please summarize the following document.` | 40 | 6 | 6.7 |
| `请总结以下文档。` | 24 | 7 | 3.4 |

中文 **字节更少**，但 **Token 更多**——计费看 Token，不看字节。

**例子 2：一篇 2000 字中文博客 vs 英文译文**

| 指标 | 中文原文 | 英文译文 |
| --- | ---: | ---: |
| 字符数 | 2,000 汉字 | ~12,000 字母（含空格） |
| UTF-8 字节 | ~6,000 | ~12,000 |
| Token 数（估算） | ~2,800–3,500 | ~2,000–2,500 |
| 输入单价 \$3/1M Token | \$0.0084–0.0105 | \$0.006–0.0075 |

中文 **字节只有英文一半**，Token 却可能 **多 30–50%**，费用相应上浮。

## 量化：账单演算

以 **主流商用 API 量级定价**（公开价，仅作算术示例）：

- 输入：\$2.50 / 1M tokens
- 输出：\$10.00 / 1M tokens

**场景 A：客服机器人，单次用户消息 100 字中文**

```
UTF-8 字节 ≈ 100 × 3 = 300
Token 数 ≈ 140–180（取 160）
系统 prompt 固定 800 Token（中文说明更长，假设 950 Token 总计输入）

输入费 = 950 / 1e6 × 2.50 = $0.002375
输出 200 Token = 200 / 1e6 × 10.00 = $0.002000
单次合计 ≈ $0.0044
```

**同场景英文用户消息 100 词**：

```
Token 数 ≈ 100–130（取 115）
总输入 800 + 115 = 915 Token

输入费 = 915 / 1e6 × 2.50 = $0.00229
输出 200 Token = $0.002000
单次合计 ≈ $0.0043
```

差别看似 **5%**；但用户消息变长、文档 RAG 变厚时，差距 **线性放大**。

**场景 B：RAG，灌入 8 万字中文技术文档**

```
汉字 80,000 → UTF-8 ≈ 240,000 字节
Token ≈ 110,000–130,000（取 120,000）

仅输入 = 120,000 / 1e6 × 2.50 = $0.30 / 次查询
若英文同等文档 50,000 词 → Token ≈ 65,000–75,000

输入 = 70,000 / 1e6 × 2.50 = $0.175 / 次
```

中文 RAG 输入成本约为英文 **1.7 倍**——每天 1 万次查询差 **\$1,250/天** 量级。

**场景 C：国内 API（人民币计价示意）**

某平台 输入 ¥0.012 / 1K tokens（即 ¥12 / 1M）：

| 内容 | Token | 单次输入费 |
| --- | ---: | ---: |
| 5000 字中文报告 | ~7,500 | ¥0.09 |
| 同等英文报告 | ~4,500 | ¥0.054 |

## 为什么 BPE 对中文「不友好」

1. **训练语料**：GPT-4/cl100k 以英文为主，高频 merge 捕获英文 n-gram；汉字作为 UTF-8 三字节序列，合并优先级低。
2. **无空格边界**：英文预分词有 regex 辅助；中文连续汉字需更多 merge 才形成长 Token。
3. **词表条目有限**：100K 词表对英文覆盖极厚，对 CJK 专用 merge 仍不足；Llama 3 增大 $V$ 并提高多语语料，中文 $\eta_{\zh}$ 有改善但仍低于英文。

### 自己拖一下

上面第 1 条是全篇的根：merge 预算被英文吃光。但正文从头到尾没给过一条 merge 规则，你只能选择相信。这里现场跑一个字节级 BPE，拖训练语料的中文占比，看中文片段**什么时候才挤进 merge 表**：

<ChineseTokens />

把中文占比拖到 0，你会看到几十条 merge 规则里**没有一条含中文字节**——汉字只能一个字节一个字节地编码，一个汉字 3 字节起步。把占比拖上去，中文才开始拿到 merge，测试句的中文 token 数随之下降。**这就是中文更贵的根源，也是它可以被改善的原因**：不是「歧视中文」，是训练语料的配比决定了谁能拿到 merge 预算。

::: info

专门的中文或多语模型（DeepSeek、Qwen 等）在 **中文 Token 效率** 上通常优于纯英文-centric 词表——选模型时除了单价，还要 **`encode` 后 Token 数** 一起算总成本。

:::

## 常见误区

- **「按字符计费就不亏」**：国内部分产品宣传「千字价」；底层仍常是 Token 或内部换算，比较时统一到 Token。
- **「翻译成英文再调用更省」**：翻译本身消耗 Token；仅当 **后续多轮复用同一段英文 context** 时可能划算。
- **「UTF-8 字节短就省流量」**：网络传输看字节；**GPU 算力与 API 账单看 Token**。

## 动手试一试

批量估算中英平行的 Token 比：

```python
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")

pairs = [
    ("机器学习是人工智能的一个分支。", "Machine learning is a branch of artificial intelligence."),
    ("今天天气很好。", "The weather is nice today."),
    ("请用 Python 写一个快速排序。", "Write quicksort in Python."),
]

for zh, en in pairs:
    tz = len(enc.encode(zh))
    te = len(enc.encode(en))
    bz = len(zh.encode("utf-8"))
    be = len(en.encode("utf-8"))
    print(f"ratio tokens zh/en={tz/te:.2f}  bytes zh/en={bz/be:.2f}")
    print(f"  zh: {tz} tok / {bz} B | en: {te} tok / {be} B")
```

若 `ratio tokens zh/en` 持续 > 1.3，你的应用在中文用户上就要预留 **30%+ 的 Token 预算**。

## 降本策略（不改变模型权重）

1. **System prompt 英文化**：指令用英文写、用户内容仍中文——有时系统段 Token 更少，且模型遵循能力不减（视模型多语能力而定）。
2. **摘要后再灌 RAG**：8 万字全文 → 先用廉价模型压成 8 千字摘要，再进主模型；Token 近似 **÷10**，信息损失需评测。
3. **选用中文友好词表**：Qwen、DeepSeek 等在中英混合计价时，对纯中文 prompt 的 $N$ 常低于 GPT-4 系 **15–40%**（务必用同款 API 实测）。
4. **Prefix caching**：OpenAI/Google 等对 **重复 system+工具定义** 的前缀缓存计费折扣；长固定前缀摊销到多轮对话。
5. **输出语言约束**：要求模型「用英文回答」不会减少 **输入** Token，但可缩短 **输出** Token——若 $p_{\text{out}} > p_{\text{in}}$，收益在生成侧。

**不应做的**：手动删标点、把中文转成拼音或 GBK 误解码——切分更乱，模型理解下降，省不了多少 Token。

**混合计费场景**：同一产品既有 **按 Token 的 LLM**，又有 **按字符的 TTS/ASR**；财务汇总时需 **分线路换算**，不可把 ASR 的「时长 × 采样率」与 LLM Token 混在同一仪表盘——单位不同，比较无意义。

## 小结

中文更贵，根因是 **Token 数/语义单位** 高于英文，而非 UTF-8 字节更多。评估成本时用公式 $\text{cost} \propto N_{\text{tokens}}$，对中英样本分别 `encode`；RAG 与长 prompt 场景下，差额可达 **数十个百分点到 1.7 倍**。

下一篇：[词表大小如何选](/manual/llm/bit-to-agi/06-tokenizer/vocabulary-size)
