---
title: "为什么 Token 越来越多"
description: "从 Bit 到 AGI · 第六章：Token · 为什么 Token 越来越多"
source: "https://daiw.org/manual/bit-to-agi/06-tokenizer/why-tokens-grow"
---

# 为什么 Token 越来越多

> 从 Bit 到 AGI · 第六章：Token · 为什么 Token 越来越多

这里「Token 越来越多」有两层含义：**(1) 词表里的 Token 种类（$V$）在变大**；**(2) 同样一段文本，在新模型里有时被切成更多或更少的 Token**。两层都跟成本、速度与上下文有关——本篇分开讲清。

## 直觉

词表变大像 **乐高套装从 500 片升级到 2000 片**：专用大块（「窗户」「轮子」）多了，搭同样房子用的块数可能变少，但 **盒子本身（Embedding 矩阵）变重**。上下文窗口从 4K 扩到 128K，则是 **工作台面变宽**——能摆更多块，但每多一块，注意力计算仍按 $N^2$ 涨。

## 定义

**词表规模 $V$**：Tokenizer 中 distinct Token 的数量，含特殊 Token（`endoftext` 等）。

**上下文长度 $L_{\max}$**：模型一次前向最多处理的 Token 数（如 4096、128K）。

**Token 密度**：单位 UTF-8 字节对应的 Token 数 $\rho = N / B$（Token/byte）。$V$ 增大时，$\rho$ 通常**下降**（同样文本 Token 更少）——但不保证单调，还取决于训练语料。

## 例子

**例子 1：词表 $V$ 的历史演进（公开模型量级）**

| 年代 | 模型 | 词表 $V$ | 备注 |
| --- | --- | ---: | --- |
| 2019 | GPT-2 | 50,257 | 字节 BPE |
| 2020 | GPT-3 | 50,257 | 同 GPT-2 词表 |
| 2023 | GPT-4 | 100,256 | `cl100k_base` |
| 2023 | Llama 2 | 32,000 | SentencePiece |
| 2024 | Llama 3 | 128,256 | 词表大幅扩容（`tiktoken` BPE） |
| 2024 | GPT-4o (`o200k_base`) | 200,019 | 多语种压缩率显著提升 |
| 2024–2026 | Qwen2.5 / Qwen3、DeepSeek-V3 | 129K–152K | 中英与代码兼顾 |
| 2024 | Gemma 2 | 256,000 | 更大词表 |

趋势：**$V$ 从 ~50K 走向 100K–256K**，用更大 Embedding 换更少 Token/字符。

**例子 2：同一句话在不同词表下的 Token 数（示意）**

假设仅词表变化、语料配比不变：

| 文本 | $V$=32K | $V$=128K |
| --- | ---: | ---: |
| 英文 100 词段落 | ~135 Token | ~120 Token |
| 中文 100 字段落 | ~180 Token | ~150 Token |

$V$ 增大约 **10–20%** 降低 Token 数——边际收益递减，因为高频 n-gram 早已合并殆尽。

## 量化

**Embedding 成本随 $V$ 线性涨**：

$$
\text{params}_{\text{embed}} = V \times d
$$

Llama 2（$V=32K, d=4096$）→ 131M；Llama 3（$V=128K, d=4096$）→ 525M。**词表翻 4 倍，Embedding 翻 4 倍**。

**注意力成本随序列 Token 数 $N$ 平方涨**：

$$
\text{FLOPs}_{\text{attn}} \propto N^2 \cdot d
$$

上下文从 4K → 128K，若灌满，注意力 FLOPs 理论涨 $(128/4)^2 = 1024$ 倍——故长上下文靠 **稀疏注意力、FlashAttention、KV Cache 分页** 等工程手段，不能单靠「多买 Token」。

**API 侧「Token 越来越多」**：用户把更多文档塞进 prompt（RAG、Agent 工具返回），**单次请求 Token 数**从几百涨到几万——这是使用方式变化，不是 Tokenizer 变了。

| 场景 | 早期（2022）典型 prompt | 现代（2025–2026）典型 prompt |
| --- | ---: | ---: |
| 简单问答 | 200–500 Token | 500–2K |
| RAG 问答 | — | 4K–32K |
| 代码 Agent | — | 8K–100K+ |

## 为什么厂商仍增大 $V$

1. **降低推理 Token 数**：同样 API 输出，Token 少 → 生成阶段 bill 少（输入侧 Embedding 一次性）。
2. **减少切分噪音**：罕见词组整段一个 Token，语义更完整。
3. **多语言与代码**：256K 词表可塞进更多多字节字符组合与 API 名。

代价：训练内存、checkpoint 体积、Embedding 层梯度更新都变重。

## 常见误区

- **「上下文 128K = 能输入 128K 汉字」**：128K 是 **Token** 上限；中文可能只能装 **4–6 万汉字**量级。
- **「新模型 Token 一定更省」**：词表变大通常更省，但 **定价也可能变**；要以实际 `encode` 为准。
- **「Token 数只跟 Tokenizer 有关」**：Chat 模板会插入 `<|im_start|>user` 等特殊 Token，**比裸文本多 10–50 Token/轮**。

## 动手试一试

统计同一段长文在不同 encoding 下的 Token 数：

```python
import tiktoken

text = open("long_article.txt", encoding="utf-8").read()[:5000]  # 前 5000 字符

for name in ["gpt2", "cl100k_base"]:
    enc = tiktoken.get_encoding(name)
    n = len(enc.encode(text))
    b = len(text.encode("utf-8"))
    print(f"{name:15s}  chars={len(text)}  bytes={b}  tokens={n}  bytes/token={b/n:.2f}")
```

对比 `gpt2`（50K）与 `cl100k_base`（100K）的 `bytes/token`。

## 上下文窗口与 Token 的「二次含义」

厂商宣传的 **128K、200K、1M 上下文**，单位全是 Token 而非字节或汉字。换算到中文用户可承载的正文时，建议 **保守除以 2–3** 再留出生成余量：

$$
\text{可输入汉字} \approx \frac{L_{\max} \times \eta_{\zh}}{1 + \text{生成预留比例}}
$$

例如 $L_{\max}=128{,}000$、$\eta_{\zh} \approx 0.6$ 字/Token、预留 20% 给输出，约 **6.1 万汉字**——仍是一部长篇著作的量级，但远小于 128「K 字」的直觉。

**长上下文定价**：部分 API 对超过 128K 的输入 **阶梯加价**（如 2× 单价）。Token 「越来越多」在账单上可能是 **分段函数**，而不只是线性 $N \cdot p$。

**KV Cache 显存**（第八章预告）：推理时缓存过去 Token 的 Key/Value，显存 $\propto N \times \text{层数} \times d$。用户会话历史越长，**单并发占用的 VRAM 越大**——Serving 集群的「Token 越来越多」还体现在 **内存与并发度** 上，不只是 FLOPs。

**MoE 与 Token 路由**（拓展）：Mixture-of-Experts 模型按 **每个 Token** 选专家；$N$ 增大不仅涨注意力成本，还增加 **路由计算与通信**。Tokenizer 让 $N$ 略降 10%，在 MoE 集群里可能等效 **多开 10% 并发**——大词表的经济账要在全栈算。

**微调数据打包**：SFT 样本常 pad 到 batch 内最大 $N$；若未按 Token 长度排序，短问答与长文档混 batch 会 **浪费算力在 pad 上**。`length bucketing` 是 DataLoader 常规优化，依赖 **预先 encode 得到 Token 长度**。

**用户行为驱动的 Token 通胀**：Agent 框架默认把 **完整工具 stdout、网页 HTML、堆栈 trace** 塞回 context；不是 Tokenizer 变了，是 **灌入的 UTF-8 原文变长**。治理应 **截断、摘要、结构化提取**，而非责怪模型「记忆力差」。

**蒸馏与裁剪**：模型压缩（蒸馏到小模型）时，小模型往往 **更小 $V$**；若 teacher 的 merge 规则不能迁移，同一 prompt 在小模型上 $N$ 更大、更慢——压缩收益被 Token 通胀部分抵消，需在 **Tokenizer 对齐** 后再比 latency。评测「小模型是否够用」时，应用 **同一套 eval encode** 报告 tokens/sec，而非只看参数量。长上下文产品还应监控 **p95 prompt tokens**，防止尾部请求拖垮 SLA。FinOps 仪表盘建议分 **语言 × 模型 × 路由** 三维统计 Token，而不是全站一个均值。Prompt 模板变更应触发 **自动 token diff CI**，防止运营改一句 copy 就超预算。

## 小结

「Token 越来越多」既指 **词表 $V$ 膨胀**（32K→256K），也指 **应用侧 prompt 变长**。大词表用参数换 Token 效率；长上下文用算力换信息量——二者独立，都直接影响账单与延迟。

下一篇：[为什么中文 Token 更贵](/manual/llm/bit-to-agi/06-tokenizer/why-chinese-tokens-cost-more)
