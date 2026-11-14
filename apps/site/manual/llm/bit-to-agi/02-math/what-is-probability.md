---
title: "概率是什么"
description: "从 Bit 到 AGI · 第二章：数学（Math） · 概率是什么"
source: "https://daiw.org/manual/bit-to-agi/02-math/what-is-probability"
---

# 概率是什么

> 从 Bit 到 AGI · 第二章：数学（Math） · 概率是什么

语言模型输出「下一个 token 的概率分布」；训练最小化 cross-entropy，本质是拟合**概率**。本篇给程序员一份可量化的概率入门：事件、概率公理、条件概率、期望，并连接到 LLM 里 $V$ 维 softmax 输出——第三章信息论将在此基础上引入熵与比特。

## 直觉：不确定性用 0 到 1 的数字

抛硬币：正面概率 0.5。不是说「一半次正面」，而是**大量重复**时正面频率趋近 0.5。

LLM 在 token $t$ 后输出词表 $V$ 个词的概率 $p_1, \ldots, p_V$，满足 $\sum_i p_i = 1$。采样或 argmax 都基于这个分布。

## 定义

**概率空间**：样本空间 $\Omega$（所有可能结果），事件 $A \subseteq \Omega$。

**柯尔莫哥洛夫公理**：

1. $P(A) \geq 0$
2. $P(\Omega) = 1$
3. 互斥事件：$P(A \cup B) = P(A) + P(B)$

**条件概率**：在 $B$ 已发生下 $A$ 的概率

$$
P(A \mid B) = \frac{P(A \cap B)}{P(B)}, \quad P(B) > 0
$$

**期望**（离散）：$E[X] = \sum_x x \cdot P(X=x)$

**期望**（连续）：$E[X] = \int x f(x)\, dx$

**独立**：$P(A \cap B) = P(A) P(B)$

## 例子

**例 1：词表上的分布**

$V = 4$，logits $\mathbf{z} = [2, 1, 0, -1]$，softmax 后：

$$
p_i = \frac{e^{z_i}}{\sum_j e^{z_j}}
$$

```python
import numpy as np

z = np.array([2.0, 1.0, 0.0, -1.0])
p = np.exp(z) / np.exp(z).sum()
print(np.round(p, 4))  # [0.644, 0.237, 0.087, 0.032]
print(p.sum())         # 1.0
```

**例 2：交叉熵 = 负对数似然**

真实 one-hot 标签 $y$（正确类 $k$），预测 $p$：

$$
H(y, p) = -\sum_i y_i \log p_i = -\log p_k
$$

若 $p_k = 0.1$，loss $= -\ln 0.1 \approx 2.30$；$p_k = 0.9$，loss $\approx 0.105$。

| $p_k$ | $-\log p_k$ |
| ----- | ----------- |
| 0.01 | 4.61 |
| 0.1 | 2.30 |
| 0.5 | 0.69 |
| 0.9 | 0.105 |

## 量化

| 场景 | 数量级 |
| ---- | ------ |
| GPT 词表 $V$ | ≈ 128,000 |
| 输出向量 | $V$ 个概率，和为 1 |
| 存储（fp32） | $V \times 4$ ≈ 512 KiB / token / 层头 |
|  perplexity | $\exp(\text{avg cross-entropy})$；PPL=20 表示平均「相当于从 20 个等概词里猜」 |
| 随机采样 | `temperature` 缩放 logits：$p_i \propto e^{z_i/T}$，$T>1$ 更平、更随机 |

**信息论连接**（第三章详讲）：熵 $H = -\sum p \log p$，cross-entropy 衡量用 $p$ 编码真实分布的比特数。

::: info

「模型很 confident」= 正确类 $p_k$ 接近 1，cross-entropy 接近 0。过度 confident（$p_k \to 1$ 但错）→ loss 爆炸，标签平滑（label smoothing）可缓解。

:::

## 工程视角：采样与评估

**Teacher forcing**（训练）：用真实前缀 token 预测下一个；**自回归推理**：用自己生成的 token 作前缀——误差累积，train/infer 分布偏移（exposure bias）。

**Top-k / nucleus (top-p) 采样**：不对全 $V$ 做 softmax，先截断 logits 再归一化——省算力、控多样性。$k=50$、$p=0.9$ 是常见默认。

**Calibration**：模型输出 $p_k=0.9$ 时，是否真的 90% 正确？温度缩放 $T$ 在验证集上 tune，使 predicted prob 与 empirical accuracy 对齐——部署置信度、拒绝回答依赖于此。

多分类推广：标签可以是 soft label（知识蒸馏），$\mathbf{y}=[0.1, 0.7, 0.2]$，CE $= -\sum y_i \log p_i$。Hard label 是 one-hot 特例。

| 评估 | 公式 | 典型值（7B 级） |
| ---- | ---- | --------------- |
| CE (nats) | $-\log p$ | 1.5–2.5 |
| PPL | $e^{\text{CE}}$ | 4–12 |
| BPC | $\text{CE}/\ln 2$ | bits per char |

**极大似然原则**：在模型族足够大时，MLE 收敛到数据生成分布（渐近理论）。LLM 用有限参数逼近自然语言分布——「预测下一个 token」= 逐 token 因子分解 $P(x_1,\ldots,x_T)=\prod P(x_t|x_{<t})$。

## 常见误区

1. **概率 0.5 ≠ 一半次数**：小样本偏差大；概率是极限频率的数学抽象。
2. **「模型输出 logits 就是概率」**：需 softmax；logits 可任意实数，概率必须在 $[0,1]$ 且和为 1。
3. **argmax ≠ 采样**：贪心解码确定性；采样引入随机性，$T=0$ 等价 argmax。

## 动手试一试

```python
import math

def perplexity(avg_ce: float) -> float:
    return math.exp(avg_ce)

for ce in [1.0, 2.0, 3.0, 4.6]:
    print(f"CE={ce:.1f} → PPL={perplexity(ce):.1f}")
# CE=4.6 ≈ -ln(0.01)，相当于随机猜 100 选 1
```

## 深入一层：公理以上

**大数定律**：样本均值 → 期望。SGD 梯度是 mini-batch 上的样本均值，$B\to\infty$ 时趋真梯度——解释为何 batch 越大训练越「稳」。

**中心极限定理**：batch 梯度近似高斯噪声——某些分析用 diffusion 近似 SGD 轨迹。

**联合概率** $P(A,B)$ vs **独立** $P(A)P(B)$：语言模型假设 token 在给定前缀下条件独立生成，$P(w_t|w_{<t})$——自回归因子分解。长程依赖靠 RNN/Transformer 隐状态编码 $w_{<t}$，不是联合建模全序列一次出。

**Monte Carlo**：估计期望 $\mathbb{E}[f(X)] \approx \frac{1}{N}\sum f(x_i)$。Dropout、数据增强、负采样都是 MC 思想。

**Maximum likelihood 与 CE 等价**（one-hot）：最小化 CE = 最大化 $\log P(\text{data}|\theta)$。第三章信息论会证明 CE 也是「用模型分布编码数据所需的期望比特数」——概率、信息、loss 三角关系。

读论文见 $-\log P$ 或 $\mathbb{E}[\log p_\theta(x)]$，都应立刻联想到：**训练目标 = 概率**。

## 从掷硬币到语言模型

公平硬币 $P(H)=0.5$：entropy 1 bit/flip。偏置硬币 $P(H)=0.9$：entropy 更低，更可预测——**不确定性与熵**（第三章）量化此直觉。

语言模型每步预测 $V$ 类：均匀随机 CE $=\ln V$。$V=128000$ 时 $\ln V \approx 11.8$ nats（≈17 bits）。实际 CE 2.0 意味着模型把不确定性从 17 bits 压到约 2.9 bits——**压缩了语言**。

## 读者备忘

**概率 ∈ [0,1]，和为 1；logits 任意实数，softmax 后变概率。** CE = $-\log p_{\text{正确类}}$。PPL = $\exp(\text{CE})$。CE=2.3 ↔ $p\approx0.1$。训练用 logits 喂 `cross_entropy`，勿先 softmax。多标签、soft label 是 one-hot CE 的直接推广。

::: info

本章内容面向程序员：公式可手推，数字可心算，代码可运行。遇到符号不熟时，先查本篇定义表，再查总结篇速查表，不必一次背熟全部细节。

:::

::: info

复习建议：先通读直觉与定义，再跑代码块验证数字，最后看读者备忘与小结。与第一章的 float 数组、SIMD、GPU 并行对照阅读，印象更深。后续章节会在 Transformer、训练、推理中反复调用本章符号，值得在笔记里自建一张 shape/FLOPs 速查表。

:::

::: info

动手练习：把本篇公式抄进 Jupyter，换三组数字复算；与 PyTorch 张量运算对照 shape 与数值。本章目标是建立可计算的数学直觉，而非完成证明。每篇至少两个数值例子，建议你都亲自算一遍或跑一遍代码。

:::

::: info

量化检查清单：写出符号定义、至少一个带具体数字的例子、一个 FLOPs 或字节数估算、一个常见误区。对照写作规范，缺一项就补笔记。链接下一篇前，用一句话复述本篇核心定理或公式。

:::

## 小结

概率 $P(A) \in [0,1]$ 量化不确定性；条件概率与期望是后续基础。LLM 输出词表上的概率分布，训练最小化 cross-entropy = 最大化对数似然。perplexity $\exp(\text{CE})$ 是常用评估指标。下一篇：**贝叶斯**——用数据更新信念，以及 weight decay 的 prior 解释。

→ 下一篇：[贝叶斯是什么](/manual/llm/bit-to-agi/02-math/what-is-bayes)
