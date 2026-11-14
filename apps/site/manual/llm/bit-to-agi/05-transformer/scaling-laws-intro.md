---
title: "缩放定律入门"
description: "从 Bit 到 AGI · 第五章：Transformer · 参数量、数据与算力如何预测 loss"
source: "https://daiw.org/manual/bit-to-agi/05-transformer/scaling-laws-intro"
---

# 缩放定律入门

> 从 Bit 到 AGI · 第五章：Transformer · 参数量、数据与算力如何预测 loss

把 BERT-base（110M）做到 GPT-3（175B），不是简单「把 768 改成 12288」——中间涉及参数量、训练 token 数、算力预算的协调。**Scaling Laws**（缩放定律）说：在一定范围内，语言模型 loss 随这些量**平滑地幂律下降**，可用来规划「花多少钱能训多大模型」。

## 直觉：搅拌咖啡的边际效应

糖（参数）、水温（算力）、搅拌时间（数据）共同决定甜度（loss）。加同样多的糖，杯越大边际越薄；定律告诉你三者的**最佳配比**，避免「模型 70B 却只训了 1B token」这种浪费。

## 定义（Kaplan et al., 2020 简化）

验证 loss $L$ 与模型参数 $N_{\text{params}}$、训练 token 数 $D$ 近似：

$$
L(N, D) \approx \left(\frac{N_c}{N}\right)^{\alpha_N} + \left(\frac{D_c}{D}\right)^{\alpha_D} + L_\infty
$$

$\alpha_N, \alpha_D \approx 0.05 \sim 0.1$ 量级（具体拟合值随实验变）；$L_\infty$ 为不可约误差。

**Chinchilla 定律**（Hoffmann et al., 2022）：给定算力预算 $C \propto N \cdot D$（粗算），最优应**同时**增大 $N$ 与 $D$，且约

$$
D_{\text{opt}} \approx 20 \times N_{\text{params}}
$$

（token 数约为参数量的 ~20 倍，而非 GPT-3 时代偏小的数据量）。

## 例子

**例 1：参数量与 FLOPs 粗算**

训练一次前向+反向约 $6 N D$ FLOPs（$N$ 非 embedding 参数，$D$ 总 token）。

| 模型 | $N$ | $D$ | 训练 FLOPs（约） |
|---|---|---|---|
| BERT-base | $1.1 \times 10^8$ | $3.3 \times 10^9$ wiki+book | $2.2 \times 10^{18}$ |
| GPT-3 175B | $1.75 \times 10^{11}$ | $3 \times 10^{11}$ | $3.1 \times 10^{23}$ |
| LLaMA-7B（Chinchilla 风格） | $7 \times 10^9$ | $1 \times 10^{12}$ | $4.2 \times 10^{22}$ |

**例 2：宽度与深度**

固定 $N \approx 12 L d^2$（$L$ 层，$d = d_{\text{model}}$）。BERT-base：$L=12, d=768$ → $N \sim 85$M（trunk）。若只把 $d$ 翻倍到 1536、$L$ 不变，$N$ 约 ×4；FLOPs/token 也约 ×4。

**例 3：loss 随参数（示意幂律）**

若 $L \propto N^{-0.076}$，参数 ×10，loss 约降 $(10)^{0.076} \approx 1.19$ 倍——**收益递减但可预测**。

### 自己拖一下

「收益递减」和「$D_{\text{opt}} \approx 20N$」在正文里是两个孤立的数字，其实它们是同一条曲线上的斜率和极小点。固定一笔算力预算，拖分配比 $D/N$，看 loss 曲线的谷底：

<ChinchillaBudget />

**谷底就在 $D/N \approx 20$**——这就是 Chinchilla 定律。GPT-3 时代把预算过度砸在参数上（$D/N \approx 2$），留在了谷底左边；Chinchilla 用同样的算力、更小的模型、更多的数据，反而更好。而 LLaMA 故意偏到谷底右边（$D/N \approx 140$）：训练时略亏，但换来一个推理便宜的小模型——**最优不总是训练最优，要看你为谁优化**。

```python
import math

def chinchilla_tokens(params: int, ratio: int = 20) -> int:
    """推荐训练 token 数 ≈ ratio × 参数量"""
    return ratio * params

print(chinchilla_tokens(110_000_000))      # 2.2B tokens for BERT-scale
print(chinchilla_tokens(7_000_000_000))    # 140B tokens for 7B model
```

## 量化

Transformer 参数主项（忽略 embedding）：

$$
N \approx 2 d_{\text{model}}^2 L + 2 d_{\text{model}} d_{\text{ff}} L
= 2 L d_{\text{model}} (d_{\text{model}} + d_{\text{ff}})
$$

BERT-base：$2 \times 12 \times 768 \times (768 + 3072) \approx 71$M（与实测 trunk 同量级）。

| 预算决策 | Scaling Laws 作用 |
|---|---|
| 买多少 GPU·天 | 估算 $C = 6ND$ |
| 选 7B 还是 13B | 比较同算力下 $L(N,D)$ |
| 数据是否够 | Chinchilla 检查 $D/N$ 比 |

::: warning

定律在**分布内**有效；架构改动（MoE、新激活）、数据质量突变、过拟合小数据会偏离幂律。它是规划工具，不是物理常数。

:::

## 常见误区

1. **参数越多越好**：需匹配 $D$；小数据大模型会过拟合，验证 loss 反升。
2. **Scaling Laws 只适用于 GPT**：原理对 Transformer LM 普遍；BERT 预训练也呈类似趋势，但任务 metric 非单一 loss。
3. **FLOPs = 实际 wall-clock**：内存带宽、通信、实现效率使常数项巨大；定律管趋势，不管绝对秒数。

## 小结

Scaling Laws：loss 随参数量 $N$、数据量 $D$ 幂律下降；Chinchilla 建议 $D \approx 20N$。BERT-base 110M 是小端；GPT-3 175B 是大端，同一 Transformer 骨架。下一篇：从 RNN 瓶颈回顾 Transformer 为何取代序列递推。

下一篇：[从 RNN 到 Transformer](/manual/llm/bit-to-agi/05-transformer/from-rnn-to-transformer)
