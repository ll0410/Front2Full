---
title: "范数与距离"
description: "从 Bit 到 AGI · 第二章：数学（Math） · 范数与距离"
source: "https://daiw.org/manual/bit-to-agi/02-math/norms-and-distance"
---

# 范数与距离

> 从 Bit 到 AGI · 第二章：数学（Math） · 范数与距离

点积衡量「对齐」，**范数**衡量「有多长」，**距离**衡量「有多远」。梯度裁剪看 L2 范数；embedding 检索用余弦距离；扩散模型在 latent 空间测距离。本篇定义 L1/L2 范数、欧氏距离、余弦距离，并给出训练中的量化阈值——与点积篇配合，构成向量几何的完整工具箱。

## 直觉：向量的「长度」与「差距」

地图上两点：直线距离（欧氏）。高维 embedding 里，我们 often 只关心**方向**（余弦），忽略模长——因为模长可能只反映词频。

梯度裁剪：若 $\|\mathbf{g}\|_2 > 1.0$，整体缩放梯度，防止一步更新过大——这里的 $\|\cdot\|_2$ 就是 L2 范数。

## 定义

**L2 范数**（欧几里得范数）：

$$
\|\mathbf{x}\|_2 = \sqrt{\sum_{i=1}^{n} x_i^2} = \sqrt{\mathbf{x}^\top \mathbf{x}}
$$

**L1 范数**：

$$
\|\mathbf{x}\|_1 = \sum_{i=1}^{n} |x_i|
$$

**L∞ 范数**：$\|\mathbf{x}\|_\infty = \max_i |x_i|$

**欧氏距离**：

$$
d(\mathbf{a}, \mathbf{b}) = \|\mathbf{a} - \mathbf{b}\|_2 = \sqrt{\sum_i (a_i - b_i)^2}
$$

**余弦距离**（常用 $1 - \cos$）：

$$
\cos(\mathbf{a}, \mathbf{b}) = \frac{\mathbf{a}^\top \mathbf{b}}{\|\mathbf{a}\|_2 \|\mathbf{b}\|_2}, \quad d_{\cos} = 1 - \cos(\mathbf{a}, \mathbf{b})
$$

**Lp 范数**：$\|\mathbf{x}\|_p = (\sum |x_i|^p)^{1/p}$；L2 正则 = $\lambda \|\mathbf{w}\|_2^2$。

## 例子

**例 1：手算**

$\mathbf{a} = [3, 4]$，$\|\mathbf{a}\|_2 = \sqrt{9+16} = 5$，$\|\mathbf{a}\|_1 = 7$。

$\mathbf{b} = [0, 0]$，欧氏距离 $d(\mathbf{a}, \mathbf{b}) = 5$。

**例 2：梯度裁剪**

全局梯度 $\mathbf{g}$，$\|\mathbf{g}\|_2 = 15$，阈值 `max_norm=1.0`：

$$
\mathbf{g} \leftarrow \mathbf{g} \times \frac{1.0}{15} \approx 0.067 \mathbf{g}
$$

LLM 训练常用 `max_norm=1.0`；大模型有时放宽到 5.0。

**例 3：向量检索**

库中 100 万条 embedding，query $\mathbf{q}$，找 $\arg\min_i d(\mathbf{q}, \mathbf{e}_i)$。

| 距离 | 是否归一化模长 | 典型场景 |
| ---- | -------------- | -------- |
| L2 | 否 | 聚类、VAE latent |
| 余弦 | 是（仅方向） | 语义搜索、RAG |
| 内积 | 否 | 最大内积搜索（MIPS），需归一化或特殊索引 |

```python
import numpy as np

def clip_grad_norm(g: np.ndarray, max_norm: float) -> np.ndarray:
    norm = np.linalg.norm(g)  # L2
    if norm > max_norm:
        return g * (max_norm / norm)
    return g

g = np.array([3.0, 4.0])  # norm=5
print(clip_grad_norm(g, 1.0))  # [0.6, 0.8]
```

## 量化

| 应用 | 典型数值 |
| ---- | -------- |
| 梯度 clip norm | 1.0（GPT 类） |
| embedding 维度 $d$ | 768–4096 |
| 单位向量 L2 范数 | 1.0 |
| L2 正则 $\lambda$ | $10^{-2}$–$10^{-1}$ |
| ANN 检索（100万×768 fp32） | ≈ 3 GiB 向量库 |

**不等式**（高维几何）：$\|\mathbf{x}\|_2 \leq \|\mathbf{x}\|_1 \leq \sqrt{n}\|\mathbf{x}\|_2$。稀疏向量 L1 小、L2 不一定小——L1 正则促稀疏。

**距离 vs 点积**（单位向量）：$\|\mathbf{a}-\mathbf{b}\|_2^2 = 2 - 2\mathbf{a}^\top\mathbf{b}$，故单位向量下 L2 与点积单调相关。

## 工程视角：训练中的范数监控

分布式训练常 log **global grad norm** $\|\mathbf{g}\|_2$：健康范围 0.1–10；突然跳到 100+ 预示 instability。`clip_grad_norm_` 在 all-reduce 之后、optimizer.step 之前执行。

**Weight norm 分解**：$\mathbf{w} = g \cdot \mathbf{v}/\|\mathbf{v}\|$，学习方向 $\mathbf{v}$ 与幅度 $g$ 分离——某些 GAN、语音模型用过；LLM 主流仍是 flat 参数 + weight decay。

**Spectral norm**（$\sigma_{\max}$）约束 Lipschitz：$\|\mathbf{W}\mathbf{x}\| \leq \sigma_{\max}\|\mathbf{x}\|$。谱归一化 GAN 判别器防 mode collapse；LLM 不逐层做（太贵），靠 LayerNorm 间接控尺度。

向量 DB 选型：

| 引擎 | 距离 | 规模 |
| ---- | ---- | ---- |
| FAISS | L2 / 内积 | 十亿级 |
| Milvus | 多种 | 生产部署 |
| pgvector | L2 / 余弦 | Postgres 内 |

**归一化 embedding**：检索前 `e /= ||e||`，内积 = 余弦相似度，L2 距离与内积单调——统一度量避免混用。

Mixture-of-Experts 路由：token embedding 与 router 权重点积/相似度决定进哪个 expert——又是范数与内积驱动离散选择（训练时可微近似）。

## 常见误区

1. **L2 距离大 ≠ 语义不相关**：未归一化 embedding 模长差异会 dominate L2。
2. **范数 $\|\mathbf{x}\|_2^2$ 与 $\|\mathbf{x}\|_2$**：weight decay 通常惩罚 $\|\mathbf{w}\|_2^2$（平方），梯度 $\propto \mathbf{w}$。
3. **高维 L2 距离趋于相等**（距离集中现象）：$d$ 很大时所有点距近似，余弦/内积更 discriminative。

## 动手试一试

```python
import numpy as np

def l2_vs_cosine(a, b):
    l2 = np.linalg.norm(a - b)
    cos = (a @ b) / (np.linalg.norm(a) * np.linalg.norm(b))
    return l2, cos

a = np.array([100.0, 1.0])
b = np.array([100.0, 2.0])
c = np.array([1.0, 100.0])
print("a vs b:", l2_vs_cosine(a, b))   # L2 小，cos 高
print("a vs c:", l2_vs_cosine(a, c))   # L2 大，cos 低
```

## 深入一层：Lp 与 Minkowski

**Minkowski 距离**：$d_p(\mathbf{a},\mathbf{b}) = \|\mathbf{a}-\mathbf{b}\|_p$。$p=2$ 欧氏；$p=1$ 曼哈顿（网格路径）；$p\to\infty$ Chebyshev（最大坐标差）。不同 $p$ 对 outlier 敏感度不同——$p=1$ 更 robust。

**三角不等式**：$\|\mathbf{a}+\mathbf{b}\| \leq \|\mathbf{a}\|+\|\mathbf{b}\|$。度量空间公理；余弦距离不满足三角不等式（非度量），但实践仍好用。

**BatchNorm / LayerNorm**：减均值除标准差，把激活拉到 $\approx$ 单位方差——隐式控制 $\|\mathbf{h}\|$，使后续 GEMM 输入尺度稳定。Norm 不是范数本身，但用 $\ell_2$ 统计量。

**Adversarial perturbation**：$\mathbf{x}'=\mathbf{x}+\boldsymbol{\delta}$，$\|\boldsymbol{\delta}\|_\infty\leq\epsilon$，最大化 loss——$\ell_\infty$ 球内最坏扰动。Robustness 研究用范数球定义 threat model。

**Weight norm clipping**：训练后 $\|\mathbf{w}\|_2 > C$ 则投影回球面——约束 capacity，与 weight decay 互补。

距离与范数是 geometry of loss landscape 的语言：sharp minimum = 某方向 $\|\Delta\theta\|$ 小但 loss 升得快；flat = 多方向 $\|\Delta\theta\|$ 大 loss 仍低。

## 在正则与检索中的统一

Weight decay $\lambda\|\mathbf{w}\|_2^2$：惩罚大权重，等价 MAP 高斯先验。L1 $\lambda\|\mathbf{w}\|_1$：促稀疏，部分特征选择场景仍用。

RAG 流水线：chunk → embed → 存向量库；query embed → top-k 余弦近邻 → 拼 prompt。**同一套范数语言**贯穿训练（clip）与部署（检索）。混用 L2 距离与未归一化内积会导致召回质量漂移——上线前固定一种并写进文档。

## 读者备忘

**L2 范数 = 向量长度；欧氏距离 = 差的 L2 范数。** 梯度 clip 看 $\|\mathbf{g}\|_2$。检索优先余弦或归一化内积。weight decay 惩罚 $\|\mathbf{w}\|_2^2$。高维时 L2 距离趋于相等，方向比长度重要。LayerNorm 用 RMS 缩放，与 L2 范数控制同族。

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

L2 范数 $\|\mathbf{x}\|_2 = \sqrt{\sum x_i^2}$ 是向量长度；欧氏距离是差的 L2 范数；余弦只看方向。梯度裁剪、正则化、向量检索都依赖范数与距离。下一篇：**特征值**——矩阵「固有尺度」的直觉，解释初始化与深层稳定性。

→ 下一篇：[特征值的直觉](/manual/llm/bit-to-agi/02-math/eigenvalues-intuition)
