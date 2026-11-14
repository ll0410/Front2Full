---
title: "LayerNorm"
description: "从 Bit 到 AGI · 第五章：Transformer · 层归一化如何稳定 768 维激活"
source: "https://daiw.org/manual/bit-to-agi/05-transformer/layer-norm"
---

# LayerNorm

> 从 Bit 到 AGI · 第五章：Transformer · 层归一化如何稳定 768 维激活

深层网络中，各层激活的均值和方差会漂移，下一层就要不断适应输入尺度——训练变慢、甚至发散。Layer Normalization（层归一化）在**每个 token 的 $d_{\text{model}}$ 维特征**上做标准化，再乘可学习的缩放 $\gamma$、平移 $\beta$，把激活拉回稳定区间。Transformer 选 LayerNorm 而非 BatchNorm，因为 NLP 的 batch 小、序列长，且要兼容变长句子。

## 直觉：每行单独标准化成绩

把每个 token 的 768 维向量看作一名学生的 768 科成绩。LayerNorm 对**这一行**算均值、方差，变成均值为 0、方差为 1，再按科目重要性（$\gamma$）微调。不同 token（不同行）互不影响；与 BatchNorm「按列、跨 batch 统计」相反。

## 定义

对单个 token 向量 $\mathbf{x} \in \mathbb{R}^{d_{\text{model}}}$：

$$
\mu = \frac{1}{d_{\text{model}}}\sum_{j=1}^{d_{\text{model}}} x_j, \quad
\sigma^2 = \frac{1}{d_{\text{model}}}\sum_{j=1}^{d_{\text{model}}} (x_j - \mu)^2
$$

$$
\text{LayerNorm}(\mathbf{x}) = \gamma \odot \frac{\mathbf{x} - \mu}{\sqrt{\sigma^2 + \epsilon}} + \beta
$$

$\gamma, \beta \in \mathbb{R}^{d_{\text{model}}}$ 可学习；$\epsilon \approx 10^{-12}$ 防除零。对 batch 输入 $\mathbf{X} \in \mathbb{R}^{n \times d_{\text{model}}}$，在最后一维（768）上独立做 $n$ 次。

## 例子

**例 1：BERT-base 参数量**

每层 2 个 LayerNorm（Attention 后、FFN 后）：

$$
2 \times 2 \times d_{\text{model}} = 4 \times 768 = 3{,}072 \text{ 参数/层}
$$

12 层共 $36{,}864$ 参数——相对 attention 的百万级可忽略，但对训练稳定性至关重要。

**例 2：数值前后**

某 token 768 维，均值 $\mu=12.3$，标准差 $\sigma=4.1$。LayerNorm 后近似 $\mu'=0$，$\sigma'=1$（再经 $\gamma, \beta$ 仿射）。

| 统计量 | Norm 前 | Norm 后（$\gamma=1, \beta=0$） |
|---|---|---|
| 均值 | 12.3 | $\approx 0$ |
| 标准差 | 4.1 | $\approx 1$ |

## 量化

- **FLOPs / token / 层**：约 $5 d_{\text{model}}$（均值、方差、减、除、乘加）；$d=768$ 时 $\approx 3.8 \times 10^3$，整句 $n=512$ 约 $2 \times 10^6$ FLOPs
- **与 BatchNorm 对比**：

| | LayerNorm | BatchNorm |
|---|---|---|
| 统计轴 | 特征维 $d$ | batch × 序列 |
| batch=1 推理 | 正常 | 需 running stats |
| NLP 变长序列 | 自然 | 需 padding 对齐 |

::: warning

**RMSNorm**（LLaMA 等）去掉减均值，只做 RMS 缩放：$\mathbf{x} / \text{RMS}(\mathbf{x}) \cdot \gamma$，略省计算，效果相当。本章以经典 LayerNorm 为准。

:::

## 常见误区

1. **LayerNorm 在 batch 维归一化**：错；在最后一维（hidden）归一化。
2. **$\gamma$ 必须初始化为 1**：惯例如此，配合 Pre-Norm 深度初始化策略。
3. **Norm 放在残差前还是后**：Post-Norm（原论文）与 Pre-Norm（现代 LLM）行为不同，见专篇。

## 动手试一试

```python
import torch
import torch.nn as nn

n, d_model = 128, 768
x = torch.randn(n, d_model) * 5 + 10  # 故意偏移尺度

ln = nn.LayerNorm(d_model)
y = ln(x)

print(y.mean(dim=-1).abs().max())   # ≈ 0
print(y.std(dim=-1).mean())         # ≈ 1
print(sum(p.numel() for p in ln.parameters()))  # 1536 = 768*2
```

## 小结

LayerNorm 对每个 token 的 768 维特征标准化，稳定 12 层堆叠的训练。Transformer 每层两次，参数量 $2 \times 768 \times 2$。下一篇讲另一个子层——FFN（前馈网络）。

下一篇：[Feed Forward 层](/manual/llm/bit-to-agi/05-transformer/feed-forward)
