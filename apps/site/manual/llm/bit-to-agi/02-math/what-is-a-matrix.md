---
title: "矩阵是什么"
description: "从 Bit 到 AGI · 第二章：数学（Math） · 矩阵是什么"
source: "https://daiw.org/manual/bit-to-agi/02-math/what-is-a-matrix"
---

# 矩阵是什么

> 从 Bit 到 AGI · 第二章：数学（Math） · 矩阵是什么

上一篇说：一个样本是一个向量。实际训练时，我们同时处理 32、256 甚至 4096 个样本——这就需要把向量**按行或按列排成表格**。这个表格就是**矩阵**。本篇讲清矩阵的定义、在内存里的布局，以及它与神经网络权重的一一对应关系。学会用 $(m,n)$ 两个整数描述一层线性变换，是读任何 `modeling_*.py` 的基本功。后续矩阵乘、注意力、FFN 的 shape 推导，全部建立在「矩阵 = 二维浮点表」这一共识上。

## 直觉：向量组成的 spreadsheet

Excel 里一张表：每行是一个用户，每列是一个特征。机器学习里的矩阵完全一样——**行 = 样本（或 token），列 = 特征（或神经元）**。

神经网络的**权重**本质上就是矩阵：全连接层 $\mathbf{W} \in \mathbb{R}^{m \times n}$ 把 $n$ 维输入变成 $m$ 维输出。Transformer 的 Q/K/V 投影、FFN 的两层线性变换，全是矩阵乘法。

## 定义

**矩阵**是 $m \times n$ 个实数排成的矩形数组：

$$
\mathbf{A} = \begin{bmatrix}
a_{11} & a_{12} & \cdots & a_{1n} \\
a_{21} & a_{22} & \cdots & a_{2n} \\
\vdots & \vdots & \ddots & \vdots \\
a_{m1} & a_{m2} & \cdots & a_{mn}
\end{bmatrix} \in \mathbb{R}^{m \times n}
$$

- $a_{ij}$：第 $i$ 行、第 $j$ 列的元素。
- **行向量**：$\mathbf{A}$ 的第 $i$ 行，$1 \times n$。
- **列向量**：$\mathbf{A}$ 的第 $j$ 列，$m \times 1$。

转置 $\mathbf{A}^\top$ 交换行列：$(m \times n) \to (n \times m)$。

## 例子

**例 1：batch 输入矩阵**

$X \in \mathbb{R}^{B \times d}$：$B$ 个样本，每个 $d$ 维。

```python
import numpy as np

B, d = 32, 768
X = np.random.randn(B, d)   # shape (32, 768)
print(X.shape)              # 32 行 = 32 个向量
print(X[0])                   # 第 0 个样本，768 维向量
```

**例 2：线性层权重**

PyTorch 中 `nn.Linear(in_features=768, out_features=3072)` 的权重 `weight.shape == (3072, 768)`——即 $\mathbf{W} \in \mathbb{R}^{3072 \times 768}$。前向计算：$\mathbf{Y} = \mathbf{X}\mathbf{W}^\top$，输出 $\mathbf{Y} \in \mathbb{R}^{B \times 3072}$。

| 对象 | 形状 | 含义 |
| ---- | ---- | ---- |
| $\mathbf{X}$ | $(B, d_{in})$ | batch 输入 |
| $\mathbf{W}$ | $(d_{out}, d_{in})$ | 可学习权重 |
| $\mathbf{Y}$ | $(B, d_{out})$ | batch 输出 |

## 量化：内存与参数量

矩阵 $\mathbf{A} \in \mathbb{R}^{m \times n}$ 的存储（float32）：

$$
\text{bytes} = m \times n \times 4
$$

| 矩阵 | 形状 | float32 参数量 | 显存 |
| ---- | ---- | -------------- | ---- |
| 小线性层 | $768 \times 768$ | 589,824 | ≈ 2.25 MiB |
| FFN 第一层 | $4096 \times 11008$ | 45,088,768 | ≈ 172 MiB |
| LLaMA-7B 全部权重 | — | ≈ 7B | ≈ 14 GiB (fp16) |

矩阵-向量乘 $\mathbf{y} = \mathbf{A}\mathbf{x}$（$\mathbf{A} \in \mathbb{R}^{m \times n}$）的 FLOPs：$2mn$（每个输出元素 $n$ 次乘加）。

::: warning

NumPy 默认 **row-major**（C 序）：同一行元素在内存中连续。第一章讲过 contiguous 数组对 GPU 很重要——非连续矩阵乘会触发隐式拷贝，拖慢训练。

:::

## 工程视角：权重即矩阵

打开 `model.state_dict()`，你会看到成百上千个 key，每个 value 几乎都是二维或更高维张量。`layers.0.self_attn.q_proj.weight` 形状 `(4096, 4096)`——这就是一个方阵，4096×4096 = 16,777,216 个参数，bf16 下约 32 MiB **单层单投影**。

7B 模型 ≈ 32 层 Transformer，每层含 Q/K/V/O 四个 $d \times d$ 投影、FFN 两个 $d \times 4d$ 矩阵——参数量主要来自这些**重复堆叠的矩阵**。读 config.json 时：`hidden_size`、`num_hidden_layers`、`intermediate_size` 三个数乘乘除除，就能粗算总参数。

**稀疏矩阵**在经典 ML 里常见（词袋 TF-IDF）；深度 LLM 权重是**稠密**的，每个元素都可训练。量化（INT8/INT4）不改变「逻辑上是矩阵」，只是把每个 $w_{ij}$ 用更少 bit 存储——第四章以后推理章节会详讲。

矩阵转置在 API 设计里处处可见：NumPy `A.T`、PyTorch `W.t()`。Attention 里 $\mathbf{QK}^\top$ 故意把 key 转置，使 $(i,j)$ 元素变成 query $i$ 与 key $j$ 的点积——shape 对不上时，90% 是转置写错。

```python
# 检查 Linear 层参数量
import torch.nn as nn
layer = nn.Linear(768, 3072)
params = layer.weight.numel() + layer.bias.numel()
print(f"params={params:,}, mem_bf16={params*2/1024**2:.2f} MiB")
```

## 常见误区

1. **$(m,n)$ 与 $(n,m)$ 不是一回事**：转置改变形状；矩阵乘法 $\mathbf{AB}$ 要求 $\mathbf{A}$ 的列数 = $\mathbf{B}$ 的行数。
2. **PyTorch Linear 的 weight 是 $(d_{out}, d_{in})$**，不是 $(d_{in}, d_{out})$。读 `shape` 时别凭直觉。
3. **「大矩阵 = 大模型」**：7B 参数 ≈ 70 亿个 float，主要是大量 $d \times d$ 和 $d \times 4d$ 的权重矩阵堆叠。

## 动手试一试

```python
def matrix_stats(m: int, n: int, bytes_per_elem: int = 2) -> dict:
    params = m * n
    mem_mib = params * bytes_per_elem / (1024 ** 2)
    flops_mv = 2 * m * n  # matrix-vector multiply
    return {"params": params, "mem_MiB": mem_mib, "flops_mv": flops_mv}

# Transformer FFN: 4096 -> 11008 -> 4096
w1 = matrix_stats(11008, 4096)
w2 = matrix_stats(4096, 11008)
print(f"FFN 两层权重合计 ≈ {(w1['mem_MiB'] + w2['mem_MiB']):.0f} MiB (bf16)")
```

## 深入一层：分块与视图

大矩阵不必一次载入 GPU：按**行块**（数据并行）或**列块**（模型并行）切分。Megatron **tensor parallel** 把 $\mathbf{W}$ 列切到 8 卡，每卡算局部 GEMM 再 all-reduce——逻辑仍是一个矩阵乘，物理是分块。

**视图**（view）不拷贝：`X.view(B, -1)` 把图片 batch 展平为 $(B, 150528)$。`transpose` 可能不连续，`.contiguous()` 才保证 row-major——第一章与本章衔接。

**单位矩阵** $I$：对角 1、其余 0，$\mathbf{I}\mathbf{x}=\mathbf{x}$。残差连接 $\mathbf{y}=\mathbf{x}+\mathbf{F}(\mathbf{x})$ 在 Jacobian 层面加 $I$，特征值谱整体右移——训练更稳。

**低秩分解**：$\mathbf{W} \approx \mathbf{U}\mathbf{V}$，$\mathbf{U}\in\mathbb{R}^{m\times r}$，$\mathbf{V}\in\mathbb{R}^{r\times n}$，$r \ll \min(m,n)$。LoRA 即此思路；全秩 $\mathbf{W}$ 是工业默认，微调时用低秩增量省显存。

**条件数**（下节特征值详讲）：$\mathbf{A}$ 求逆时，$\kappa(\mathbf{A})=\|\mathbf{A}\|\|\mathbf{A}^{-1}\|$ 大 → 数值解敏感。线性方程 $\mathbf{A}\mathbf{x}=\mathbf{b}$ 的 solver 与神经网络无关，但**Hessian 条件数**影响优化——同一套矩阵分析语言。

## 与第一章的衔接

第一章：float 数组在内存 row-major 连续存放。矩阵即「$m$ 行向量首尾相接」——`reshape(m, n)` 不改变底层 bytes，只改解释。GPU kernel 要求 leading dimension 连续；`transpose` 后 GEMM 前常 `.contiguous()`，否则隐式拷贝拖慢数倍。

Batch 维 $B$ 是「第三维」：逻辑上 $B$ 个矩阵，物理上常 `(B, m, n)` 一块分配——与 SIMD、CUDA grid 的 batch 并行一致。

## 读者备忘

**矩阵 = 二维权重表 = $\mathbb{R}^{m \times n}$。** PyTorch `Linear` 的 `weight.shape` 是 `(out_features, in_features)`。参数量 = 行 × 列；一次前向该层 GEMM FLOPs ≈ $2 \times B \times m \times n$。读 checkpoint 时 `state_dict` 里二维 tensor 几乎都是权重矩阵；一维是 bias 或 norm 的 $\gamma,\beta$。

::: info

本章内容面向程序员：公式可手推，数字可心算，代码可运行。遇到符号不熟时，先查本篇定义表，再查总结篇速查表，不必一次背熟全部细节。

:::

::: info

复习建议：先通读直觉与定义，再跑代码块验证数字，最后看读者备忘与小结。与第一章的 float 数组、SIMD、GPU 并行对照阅读，印象更深。后续章节会在 Transformer、训练、推理中反复调用本章符号，值得在笔记里自建一张 shape/FLOPs 速查表。

:::

## 小结

矩阵是向量的二维排列，$\mathbf{A} \in \mathbb{R}^{m \times n}$ 有 $mn$ 个元素。在 AI 里：batch 输入、权重、注意力得分表都是矩阵。参数量 = 元素个数；显存 ≈ 参数量 × 每元素字节数。下一篇讲为什么**矩阵乘法**是神经网络和 GPU 的核心运算——矩阵定义了「存什么」，GEMM 定义了「怎么算」。

→ 下一篇：[为什么矩阵乘法这么重要](/manual/llm/bit-to-agi/02-math/why-matrix-multiply-matters)
