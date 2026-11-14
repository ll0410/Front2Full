---
title: "点积是什么"
description: "从 Bit 到 AGI · 第二章：数学（Math） · 点积是什么"
source: "https://daiw.org/manual/bit-to-agi/02-math/dot-product"
---

# 点积是什么

> 从 Bit 到 AGI · 第二章：数学（Math） · 点积是什么

矩阵乘法 $\mathbf{C}=\mathbf{AB}$ 的每个元素，都是一行与一列的**点积**。Self-Attention 里 $\mathbf{QK}^\top$ 的每个得分，也是两个向量的点积。本篇定义点积、给出几何意义（投影与夹角），并量化 attention 里 $L^2$ 次点积的开销——读 Transformer 论文公式时，每一行 $\mathbf{QK}^\top$ 都应对应本章定义。

## 直觉：两个列表「有多对齐」

推荐系统：用户向量 $\mathbf{u}$、物品向量 $\mathbf{v}$，点积越大 → 越匹配。

NLP：query 向量与 key 向量点积大 → **语义相关**，attention 权重大。

## 定义

**点积**（dot product，内积）：

$$
\mathbf{a} \cdot \mathbf{b} = \mathbf{a}^\top \mathbf{b} = \sum_{i=1}^{n} a_i b_i
$$

要求 $\mathbf{a}, \mathbf{b} \in \mathbb{R}^n$，同维。

**几何形式**：

$$
\mathbf{a} \cdot \mathbf{b} = \|\mathbf{a}\| \, \|\mathbf{b}\| \, \cos\theta
$$

$\theta$ 为夹角。$\cos\theta = 1$（同向）→ 点积最大；$\cos\theta = 0$（正交）→ 点积 0。

**矩阵乘法连接**：$(\mathbf{AB})_{ij} = \mathbf{A}_{i,:} \cdot \mathbf{B}_{:,j}$

## 例子

**例 1：手算**

$\mathbf{a} = [1, 2, 3]$，$\mathbf{b} = [4, 5, 6]$

$$
\mathbf{a} \cdot \mathbf{b} = 1\times4 + 2\times5 + 3\times6 = 4 + 10 + 18 = 32
$$

**例 2：Attention 得分**

$\mathbf{q}, \mathbf{k} \in \mathbb{R}^{d_k}$，scaled dot-product：

$$
\text{score} = \frac{\mathbf{q} \cdot \mathbf{k}}{\sqrt{d_k}}
$$

缩放因子 $\sqrt{d_k}$：$d_k$ 大时点积方差大，softmax 易饱和。设 $d_k = 64$，$\sqrt{d_k} = 8$。

```python
import numpy as np

q = np.array([1.0, 0.0, 1.0, 0.0])
k = np.array([1.0, 1.0, 1.0, 0.0])
dk = len(q)
score = q @ k / np.sqrt(dk)
print(f"scaled score = {score:.3f}")  # 1.000
```

**例 3：Embedding 相似度**

两个 token embedding 点积 ≈ 共现/语义相似度（未归一化时受模长影响）。实践中常用**余弦相似度** $\frac{\mathbf{a}\cdot\mathbf{b}}{\|\mathbf{a}\|\|\mathbf{b}\|}$，只比方向。

| 度量 | 公式 | 范围 |
| ---- | ---- | ---- |
| 点积 | $\mathbf{a}^\top \mathbf{b}$ | $(-\infty, +\infty)$ |
| 余弦 | $\frac{\mathbf{a}^\top \mathbf{b}}{\|\mathbf{a}\|\|\mathbf{b}\|}$ | $[-1, 1]$ |

## 量化

**单次点积**（维度 $n$）：$n$ 次乘法 + $n-1$ 次加法 ≈ **$2n$ FLOPs**。

**Self-Attention**（序列长 $L$，头维 $d_k$，$h$ 头，batch $B$）：

- QK^T：每个 query 与 $L$ 个 key 做点积 → $B \cdot h \cdot L \cdot L$ 次点积，每次 $2d_k$ FLOPs
- 总计 QK^T：$2 B h L^2 d_k$ FLOPs

| $L$ | $d_k=128$, $h=32$, $B=1$ QK^T FLOPs |
| --- | ----------------------------------- |
| 512 | ≈ 2.1 GFLOPs |
| 4096 | ≈ 137 GFLOPs |
| 8192 | ≈ 549 GFLOPs |

FlashAttention 不改变数学结果，通过 IO 感知的 tiling 减少 HBM 读写，加速实现。

## 工程视角：Attention 里的点积

Scaled dot-product attention 论文（Vaswani et al.）核心：$\text{Attention}(Q,K,V)=\text{softmax}(QK^\top/\sqrt{d_k})V$。每个 $(i,j)$ 得分是 query $i$ 与 key $j$ 的点积——**语义匹配度**的可微 proxy。

**Multi-Query / Grouped-Query Attention**（MQA/GQA）：多个 query 头共享同一组 K/V，减少 KV cache 显存——推理长 context 时 KV cache 是瓶颈。数学仍是点积，只是 K/V 头数 $h_{kv} < h_q$。

**ALiBi / RoPE** 等位置编码不改变点积形式，但修改 $\mathbf{q},\mathbf{k}$ 使得分含相对位置信息——实现「远距离衰减」等 inductive bias。

点积 vs 加性 attention（Bahdanau）：$score = \mathbf{v}^\top \tanh(W_1\mathbf{q}+W_2\mathbf{k})$。Transformer 选点积因**可并行 GEMM**，GPU 友好。

| 变体 | 得分计算 | 复杂度 |
| ---- | -------- | ------ |
| Dot-product | $\mathbf{q}^\top\mathbf{k}/\sqrt{d_k}$ | $O(L^2 d_k)$ |
| Linear attention | kernel trick 近似 | $O(L d_k^2)$ 某些设定 |

**FlashAttention** 数学等价标准 attention，IO 优化：分块算 $QK^\top$，softmax 与 $V$ 乘在同一 SRAM 块完成，减少 HBM 读写 $O(L^2)$ 次。

Embedding 检索（RAG）：query 与文档 chunk embedding 点积排序，top-100 送 LLM——百万库用 FAISS/HNSW 近似 MIPS，不必精确全排序。

## 常见误区

1. **点积大 ≠ 一定相似**：若 $\|\mathbf{a}\|$ 很大，点积 inflate；比相似度用余弦。
2. **$\mathbf{a}\cdot\mathbf{b} = \mathbf{b}\cdot\mathbf{a}$** 但矩阵乘 **不可交换**：$\mathbf{AB} \neq \mathbf{BA}$。
3. **Attention 用点积不用欧氏距离**：点积 + softmax 可微、可并行；距离 $ \|\mathbf{q}-\mathbf{k}\|^2 $ 展开后含 $-\mathbf{q}\cdot\mathbf{k}$ 项，相关但不等价。

## 动手试一试

```python
import numpy as np

def cosine_sim(a, b):
    return (a @ b) / (np.linalg.norm(a) * np.linalg.norm(b))

a = np.array([3.0, 0.0])
b = np.array([1.0, 0.0])
c = np.array([0.0, 5.0])
print(f"a·b={a@b}, cos={cosine_sim(a,b):.2f}")  # 同向 cos=1
print(f"a·c={a@c}, cos={cosine_sim(a,c):.2f}")  # 正交 cos=0
```

## 深入一层：双线性形式

点积是**双线性**的：$(c\mathbf{a})\cdot\mathbf{b}=c(\mathbf{a}\cdot\mathbf{b})$，$(\mathbf{a}+\mathbf{a}')\cdot\mathbf{b}=\mathbf{a}\cdot\mathbf{b}+\mathbf{a}'\cdot\mathbf{b}$。Attention score 对 $\mathbf{q},\mathbf{k}$ 分别线性，整体非线性来自 softmax。

**双线性 pooling**（早期 VQA）：$\mathbf{v}^\top \mathbf{W} \mathbf{q}$，$\mathbf{W}$ 可学习——比纯点积 expressivity 强，但参数 $d^2$。Transformer 用 multi-head 多个点积空间代替单一大 $\mathbf{W}$。

**Kernel trick 视角**：点积 $\mathbf{x}^\top\mathbf{y}$ 是线性 kernel；$\mathbf{x}^\top\mathbf{y}$ 大则内积空间「相似」。RBF kernel $e^{-\|\mathbf{x}-\mathbf{y}\|^2}$ 可 infinite-dim 内积展开——SVM 时代经典；深度网络学 feature $\phi(\mathbf{x})$ 使点积有效。

**Cosine vs dot 选型**：OpenAI embedding API 文档常建议 normalize 后用内积；未 normalize 时内积偏向长文档。工程 checklist：**检索 pipeline 统一度量**。

Self-attention 的 $\mathbf{QK}^\top$ 矩阵 rank $\leq d_k$（$d_k$ 小时低秩）——长序列 $L$ 大时 $L\times L$ 矩阵仍满 rank 最多 $L$，但有效信息常低秩；**LoRA on attention** 利用此结构。

## 在 Attention 公式里的位置

$\text{Attention}(Q,K,V)=\text{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}\right)V$。$QK^\top$ 的 $(i,j)$ 元：第 $i$ 个 query 与第 $j$ 个 key 的点积。mask 把非法 $(i,j)$ 的 score 置 $-\infty$，softmax 后权重为 0——不参与加权和。

Multi-head：$h$ 组独立的 $(Q_h,K_h,V_h)$，每组 $d_k=d/h$。head 数翻倍 → QK^T FLOPs 翻倍（每 head 维度减半，对消一半；总 $\propto h \cdot d_k = d$ 不变），但投影 GEMM 随 $h$ 结构变化——读 config 时 `num_attention_heads` 与 `head_dim` 要一起算。

## 读者备忘

**点积 = 同行列对应相乘再求和 = $\mathbf{a}^\top\mathbf{b}$。** Attention score 是 scaled dot-product。每次 $2d_k$ FLOPs；全长 attention 总 FLOPs $\propto L^2 d$。检索用归一化 embedding + 内积 ≈ 余弦相似度。矩阵乘 $(AB)_{ij}$ 即第 $i$ 行与第 $j$ 列的点积——点积是 GEMM 的原子操作。

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

::: info

下一篇链接见文末箭头；全章顺序见 meta.json 与本章 index。建议按顺序阅读，勿跳过向量与矩阵两篇基础即可继续。

:::

## 小结

点积 $\mathbf{a}^\top\mathbf{b} = \sum a_i b_i$ 衡量向量对齐程度；矩阵乘、attention 得分皆由此构成。Scaled dot-product 除以 $\sqrt{d_k}$ 稳定 softmax。复杂度 $O(n)$ 每次，attention 中 $O(L^2 d_k)$。下一篇：**范数与距离**——模长、余弦、欧氏距离，与点积共同构成向量几何工具箱。

→ 下一篇：[范数与距离](/manual/llm/bit-to-agi/02-math/norms-and-distance)
