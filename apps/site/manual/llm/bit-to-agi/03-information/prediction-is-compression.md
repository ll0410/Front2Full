---
title: "预测即压缩"
description: "从 Bit 到 AGI · 第三章：信息（Information） · 预测即压缩"
source: "https://daiw.org/manual/bit-to-agi/03-information/prediction-is-compression"
---

# 预测即压缩

> 从 Bit 到 AGI · 第三章：信息（Information） · 预测即压缩

香农、所罗门诺夫、后来的 Hutter Prize 参赛者都在说同一件事：**好的预测器就是好的压缩器**。GPT 在训练时最小化交叉熵，等价于学着用更短的码长描述语料；反过来，任何无损压缩器内部都隐含着对下一个符号的预测。本篇把这条定理链讲透，并给出可运行的数字。

## 直觉：猜得越准，码字越短

算术编码的工作方式：

1. 预测器给出下一个符号的概率 $q(x_{t+1} \mid x_{\le t})$
2. 编码器把当前区间按这些概率切分，选中实际符号对应的子区间
3. 区间越窄（高概率符号）→ 需要的比特越少

**预测越准 → 概率越尖 → 区间缩得越快 → 文件越小。**

GPT 若作为预测器接入算术编码，理论上对文本的压缩率会远超 gzip——代价是模型本身几百 GB，不实用，但**原理成立**。

```mermaid
flowchart LR
    M["模型 q(x_t|context)"] --> A[算术编码]
    A --> B[更短比特流]
    B --> D[解码 + 同一模型]
    D --> R[还原文本]
```

## 定义：香农源编码定理

设平稳随机源熵率为 $h$ bit/符号。则：

1. **存在**无损编码，使平均码长 $\to h$（当块长 $\to \infty$）
2. **任何**无损编码平均码长 $\ge h$

构造性证明的核心：**用模型概率做算术编码**。因此：

$$
\underbrace{\text{压缩性能}}_{\text{码长}} \longleftrightarrow \underbrace{\text{预测性能}}_{\text{交叉熵 } H(p,q)}
$$

平均码长（bit/符号）≈ $H(p, q)$；当 $q = p$ 时达到熵墙 $H(p) = h$。

**所罗门诺夫–柯尔莫哥洛夫视角**：若存在短程序 $M$ 能预测数据，则 $M$ 加上算术编码输出就是短描述——**预测模型 = 压缩程序**。

## 例子一：用 bigram 模型压文本

1,000 字符英文片段，二元模型预测下一字符：

| 方案 | 平均码长 | 压缩后大小（估） |
| ---- | -------- | ---------------- |
| 原始 ASCII | 8 bit/字符 | 1,000 字节 |
| 理想算术编码 + 真实 bigram $p$ | ≈ 2.5 bit/字符 | ≈ 312 字节 |
| 理想算术编码 + 估计 bigram $\hat{p}$ | ≈ 2.8 bit/字符 | ≈ 350 字节 |
| gzip | ≈ 3 bit/字符 | ≈ 375 字节 |

估计模型 $\hat{p}$ 比真实 $p$ 差一点 → 码长增加 ≈ $D_{\mathrm{KL}}(p \| \hat{p})$ bit——又是 KL。

## 例子二：神经网络压缩比赛

Hutter Prize 挑战：压缩 100 MB 维基百科文本（`enwik8`）。冠军方案本质是**混合模型 + 算术编码**：

| 年份 | 方法 | 压缩后大小 | 隐含 PPL 量级 |
| ---- | ---- | ---------- | ------------- |
| 基线 gzip | LZ | ~35 MB | — |
| 2016 神经网络 | LSTM 预测 + 算术码 | ~25 MB | ~50 |
| 前沿混合模型 | 复杂混合 / Transformer | ~14–15 MB | ~20 |

GPT-3 若只论预测质量（PPL ≈ 15），**理论码长**约 $\log_2 15 \approx 3.9$ bit/Token（码长 = $\log_2 \text{PPL}$，与本篇下方表格的每 Token 交叉熵 3–4 bit 一致）——但模型权重 350 GB，**总描述长度**（模型 + 压缩流）极不划算。预训练的价值在于：权重摊销到无限生成任务，而非单次 zip。

::: info

DeepMind《Learning to Compress》（2016）训练 LSTM 最小化 BPTT 交叉熵，直接优化压缩目标；与 GPT 预训练**同一数学**，差别在模型架构与规模。

:::

## 量化：码长、交叉熵、GPT 训练

对长度 $T$ 的序列，算术编码总码长约：

$$
L \approx \sum_{t=1}^{T} -\log_2 q(x_t \mid x_{<t}) = T \cdot H(p, q)
$$

GPT 训练最小化 $\frac{1}{T}\sum -\log q$ → 直接最小化**期望码长**。

| 指标 | 公式 | GPT-3 级（估） |
| ---- | ---- | -------------- |
| 每 Token 交叉熵 | $H(p,q)$ | 3–4 bit |
| 困惑度 | $2^{H(p,q)}$ | 8–16 |
| 相对熵墙 | $D_{\mathrm{KL}}(p\|q)$ | 1–2 bit |
| 语料 300B Token 总 NLL | $T \times H(p,q)$ | ≈ **1.2 Tbit** |

「1.2 Tbit」是模型在训练集上解释的**总信息量**——参数通过压缩（预测）义务把这么多不确定性消化掉。

## 动手试一试：预测器 → 码长估计

无法在无依赖环境实现完整算术编码，但可用**交叉熵之和**估计压缩下界：

```python
import math
from collections import Counter, defaultdict

text = "to be or not to be that is the question " * 30
tokens = text.split()

bigram = defaultdict(Counter)
for a, b in zip(tokens, tokens[1:]):
    bigram[a][b] += 1

def code_length_bits(sequence: list[str]) -> float:
    """用 bigram 模型估计算术码总 bit 数（下界估计）。"""
    total = 0.0
    for a, b in zip(sequence, sequence[1:]):
        ctx = bigram[a]
        total_count = sum(ctx.values())
        p = ctx[b] / total_count
        total += -math.log2(p)
    return total

bits = code_length_bits(tokens)
n = len(tokens) - 1
print(f"序列共 {n} 个 bigram 步")
print(f"估计码长: {bits:.1f} bit")
print(f"平均: {bits/n:.2f} bit/Token")
print(f"ASCII 原长: {n * 8} bit（若每 Token 平均 4 字符则仅 token 字母）")
print(f"压缩比（相对 8bit/步）: {1 - (bits/n)/8:.1%}")
```

把 bigram 换成 GPT，同一公式给出**更短码长**——预测即压缩在代码里就是 `sum(-log2 prob)`。

**算术编码一步示意**（非实现）：区间 $[0,1)$ 初始全长。若三符号 A/B/C 概率 0.5/0.25/0.25，第一步选 A 则缩到 $[0, 0.5)$，选 B 缩到 $[0.5, 0.75)$……多步后区间宽度 $\approx 2^{-\text{总码长}}$。编码输出该区间的二进制小数。**总码长 = 各步 $-\log_2 q(x_t)$ 之和**，与 GPT loss 逐项相同。

所罗门诺夫泛化：若宇宙是某短程序的输出，该程序即「理想极限压缩器」。我们找不到最短程序，但可用神经网络**逼近**——参数越多，$D_{\mathrm{KL}}(p\|q)$ 越小，压缩越接近熵墙。AGI 争论里「压缩即智能」源于此：通用预测 = 通用压缩（Hutter 等人立场）。

**工程权衡表**：

| 方案 | 模型大小 | 压缩率（文本） | 适用 |
| ---- | -------- | -------------- | ---- |
| gzip | 0（固定算法） | 中 | 通用文件 |
| 7z + 大字典 | 0 | 较高 | 归档 |
| 小型 LSTM | ~10 MB | 较高 | 研究 |
| GPT-3 | ~350 GB | 极高 | 生成，非归档 |

生产选 gzip 不选 GPT，因为**摊销**：压缩一次付模型价不划算；对话生成则无数次采样，摊销后合理。

## 常见误区

| 误区 | 纠正 |
| ---- | ---- |
| 「GPT 能压缩任何文件」 | 只对**其训练分布内**的文本高效；随机二进制几乎不可压 |
| 「压缩率 100% 可能」 | 熵墙 $H(p) > 0$ 则必有残余码长；无损不能突破 |
| 「模型越大压缩越小」 | 更大 $q$ 降 KL，但**模型自身也要编码**；总描述长度含权重 |

## 小结

- 香农定理：最优无损码长 → 熵；构造靠**预测概率 + 算术编码**。
- 平均码长 = 交叉熵 $H(p,q)$；$q$ 越准，压缩越好。
- GPT 预训练 = 在极大语料上学 $q$，最小化可压缩描述长度。
- 实用 gzip 用简单模型；GPT 用巨型神经网络——**同一原理，不同工程权衡**。

本章收束于[第三章总结](/manual/llm/bit-to-agi/03-information/chapter-summary)。
