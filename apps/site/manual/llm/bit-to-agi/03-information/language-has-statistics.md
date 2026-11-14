---
title: "为什么语言具有统计规律"
description: "从 Bit 到 AGI · 第三章：信息（Information） · 为什么语言具有统计规律"
source: "https://daiw.org/manual/bit-to-agi/03-information/language-has-statistics"
---

# 为什么语言具有统计规律

> 从 Bit 到 AGI · 第三章：信息（Information） · 为什么语言具有统计规律

压缩器和 GPT 都能把英文压到远低于 8 bit/字符——因为它们利用了同一个事实：**语言不是随机字母串，而是高度有规律的随机过程**。人类说话时遵循语法、搭配习惯、世界常识；这些规律体现在**可测量的概率分布**里，这就是统计自然语言处理（以及现代 LLM）的全部赌注。

## 直觉：手机输入法的「猜词」

中文输入法打 `ni` 会优先出「你」而不是「腻」；打 `shang` 后接 `dian` 大概率组成「商店」。它没有理解语义，只是记住了**语料里哪些字一起出现得多**。

GPT 把这个逻辑做到了极端：不是记一张静态频率表，而是用数十亿参数拟合**任意长度上下文**下的条件概率 $P(x_t \mid x_1, \ldots, x_{t-1})$。

## 定义：语言作为随机过程

把文本看成随机变量序列 $X_1, X_2, \ldots, X_T$（字符或 Token）。**语言模型**估计：

$$
P(x_1, x_2, \ldots, x_T) = \prod_{t=1}^{T} P(x_t \mid x_{<t})
$$

「统计规律」= 这个乘积里每个条件概率**不是均匀的**，而是严重偏向少数高概率续写。

关键统计量：

| 名称 | 含义 | 典型发现 |
| ---- | ---- | -------- |
| 一元频率 | 单字/词出现概率 | 英文 `the` 约占 7% 词频 |
| N-gram | 连续 $n$ 个符号的联合频率 | `ing` 前面常是辅音字母 |
| 条件熵 | $H(X_t \mid X_{<t})$ | 随上下文长度增加而下降 |
| 互信息 | 远距离符号的相关性 | 主语与谓语动词有人称一致 |

## 例子一：Zipf 定律（词频）

将语料中所有词按频率排序，第 $r$ 名的词频 $f_r$ 近似满足：

$$
f_r \propto \frac{1}{r^s}, \quad s \approx 1
$$

即排名第 1 的词出现次数约为排名第 10 的 10 倍。中文、英文、编程语言关键字都服从类似分布——**少数词占据大多数 token**。

Brown 语料（约 100 万词）中：

| 排名 | 英文词 | 约占比例 |
| ---- | ------ | -------- |
| 1 | the | ~7% |
| 2 | of | ~3.5% |
| 10 | I | ~0.9% |
| 100 | made | ~0.05% |

前 100 个词覆盖约 **50%** 的文本——这就是为什么小词表 + 高频词也能撑起可用模型。

## 例子二：N-gram 条件概率

只看 bigram（相邻两词），就能大幅降低不确定性。例句开头 `I want to`：

| 下一个词 | 粗估 $P(\text{词} \mid \text{context})$ |
| -------- | --------------------------------------- |
| go | ~0.15 |
| be | ~0.12 |
| know | ~0.08 |
| eat | ~0.05 |
| … | … |
| 随机词表词 | $< 10^{-5}$ |

上下文把候选从 50,000 个词**收窄到几十个**——条件熵从 $\log_2 50000 \approx 16$ bit 降到约 **4–5 bit**。更长上下文（整句、段落）继续下降，但收益递减：人类语言有**有限记忆**，太远的前文关联变弱。

```mermaid
flowchart LR
    C[上下文长度] --> H["条件熵 H(X_t|context)"]
    H --> D[下降后趋于平稳]
```

## 量化：熵率与 perplexity

**熵率**（每 Token 平均不确定性）：

$$
h = \lim_{T \to \infty} \frac{H(X_1, \ldots, X_T)}{T}
$$

英文书面语 $h \approx 1.0$–$1.5$ bit/字符（字符级）或约 **2–4 bit/Token**（BPE 词表级）。

**困惑度**（perplexity，语言模型常用指标）：

$$
\text{PPL} = 2^{H(P, Q)} = 2^{-\frac{1}{T}\sum_t \log_2 q(x_t \mid x_{<t})}
$$

| 模型 | 英文 PPL（越低越好） | 含义 |
| ---- | -------------------- | ---- |
| 均匀随机猜 | ≈ 50,000 | 完全没学到规律 |
| 3-gram 平滑 | ~200–300 | 只记局部搭配 |
| GPT-2（117M） | ~30 | 学到句法与常识片段 |
| GPT-3（175B） | ~15–20 | 长程依赖更好 |

PPL = 20 意味着模型平均在 **20 个等可能候选**里做等价猜测——比词表随机好 2500 倍。

## 动手试一试：从语料估计 bigram 熵

```python
import math
import re
from collections import Counter, defaultdict

def entropy(probs: list[int]) -> float:
    t = sum(probs)
    return -sum((p / t) * math.log2(p / t) for p in probs if p > 0)

text = """
To be or not to be that is the question.
Whether tis nobler in the mind to suffer the slings and arrows.
""" * 20  # 重复以增加样本

tokens = re.findall(r"[a-z]+", text.lower())
unigram = Counter(tokens)
bigram = Counter(zip(tokens, tokens[1:]))

def conditional_entropy_bigram() -> float:
    h = 0.0
    by_context = defaultdict(list)
    for (a, b), c in bigram.items():
        by_context[a].append((b, c))
    total = len(tokens) - 1
    for a, followers in by_context.items():
        ctx_total = sum(c for _, c in followers)
        p_ctx = ctx_total / total
        h_ctx = 0.0
        for b, c in followers:
            p = c / ctx_total
            h_ctx -= p * math.log2(p)
        h += p_ctx * h_ctx
    return h

print(f"一元熵: {entropy(list(unigram.values())):.2f} bit")
print(f"二元条件熵: {conditional_entropy_bigram():.2f} bit/Token")
print(f"Perplexity ≈ {2**conditional_entropy_bigram():.1f}")
```

你会看到 bigram 条件熵**低于**一元熵——上下文提供了信息。

## 量化：齐夫定律的数值与中文

齐夫指数 $s$ 随语料略变。英文书面 $s \approx 0.9$–$1.1$；中文词频亦近似 $1/r$ 衰减，但分词标准影响排名。粗略说：**前 1000 个中文词覆盖约 80% 日常文本**，与英文同量级——BPE 词表 32k–50k 对中英文都够用，不是英文专属。

**熵率估计实验**（字符级，英文）：

| 模型阶数 | 条件熵（bit/字符，经验值） |
| -------- | -------------------------- |
| 0-gram（均匀） | $\log_2 26 \approx 4.7$ |
| 1-gram（字母频率） | ≈ 4.0 |
| 2-gram | ≈ 3.2 |
| 5-gram | ≈ 2.0 |
| 人类上界（估） | ≈ 1.0–1.5 |
| GPT（Token 级换算） | ≈ 1.5–2.0 bit/字符等效 |

阶数升高，熵下降，但**数据稀疏**：5-gram 在 10 亿词语料里仍有大量未见组合，需要平滑（回退到低阶）。神经网络用分布式表示缓解稀疏——用连续向量代替离散计数表，这是它比经典 N-gram **统计建模**更强的原因，不是魔法。

### 自己拖一下

上面这张表是数字。但让人真正相信「语言远非随机」的，是把阶数从 0 拖到 5 时，乱码**肉眼可见地变成英语**——这正是香农 1948 年那篇奠基论文里的演示：

<ShannonNgram />

编程语言源码同样服从统计规律：`import` 后常跟标识符，`(` 后少跟 `}`。Code LLM 与文本 LLM 同一套 CLM，只是 $p$ 的分布换成 AST/语法偏置的源码。

## 常见误区

| 误区 | 纠正 |
| ---- | ---- |
| 「语言规律 = 语法规则」 | 语法是规律的一种**显式写法**；统计模型直接从数据学**隐式分布** |
| 「中文没有空格所以无统计」 | 字级、词级 n-gram 同样成立；BPE 在字节级也能发现规律 |
| 「互联网语料有噪声，规律不存在」 | 噪声降低**可预测性上限**，但不消除结构；PPL 仍可从 50000 降到 20 |
| 「模型记住了训练集」 | 记频率是统计规律的一部分；泛化来自**共享模式**（语法、事实模板） |

## 小结

- 语言是**有强条件依赖**的符号序列，不是均匀随机。
- Zipf 词频、N-gram 搭配、随上下文下降的条件熵，均可量化。
- 英文 GPT 级模型 PPL ≈ 15–20，对应每 Token 约 4 bit 不确定性。
- 正因为有这些规律，[GPT 才能预测下一个 Token](/manual/llm/bit-to-agi/03-information/why-gpt-predicts-next-token)。

下一篇直接进入：**预测下一个 Token** 的训练目标到底在做什么？
