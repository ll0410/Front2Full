---
title: "偏导数是什么"
description: "从 Bit 到 AGI · 第二章：数学（Math） · 偏导数是什么"
source: "https://daiw.org/manual/bit-to-agi/02-math/what-is-partial-derivative"
---

# 偏导数是什么

> 从 Bit 到 AGI · 第二章：数学（Math） · 偏导数是什么

神经网络有数十亿个参数，loss 是**所有参数**的多元函数 $\mathcal{L}(w_1, w_2, \ldots, w_n)$。对每个 $w_i$ 单独求导——这就是**偏导数**。本篇定义偏导、说明它与全导数、梯度的关系，并给出矩阵权重上的偏导例子；是连接「标量导数」与「70 亿参数梯度张量」的桥梁。

## 直觉：只动一个旋钮，其它固定

实验室里有 100 个旋钮控制输出。偏导数回答：**固定其它 99 个，只微调旋钮 $i$，输出变化多快？**

训练时每个权重独立得到一个偏导数 $\frac{\partial \mathcal{L}}{\partial w_i}$，拼起来就是梯度向量。

## 定义

设 $f: \mathbb{R}^n \to \mathbb{R}$，对第 $i$ 个变量 $x_i$ 的**偏导数**：

$$
\frac{\partial f}{\partial x_i} = \lim_{h \to 0} \frac{f(x_1, \ldots, x_i + h, \ldots, x_n) - f(x_1, \ldots, x_i, \ldots, x_n)}{h}
$$

计算技巧：把其它变量当**常数**，只对 $x_i$ 用一元求导法则。

**梯度**就是所有偏导组成的向量：

$$
\nabla f = \left(\frac{\partial f}{\partial x_1}, \ldots, \frac{\partial f}{\partial x_n}\right)^\top
$$

**雅可比矩阵**（Jacobian）：向量值函数 $\mathbf{f}: \mathbb{R}^n \to \mathbb{R}^m$，$m \times n$ 矩阵，第 $(i,j)$ 元为 $\frac{\partial f_i}{\partial x_j}$。反向传播就是在链式法则下高效计算雅可比与梯度的乘积。

## 例子

**例 1：二元函数**

$f(x, y) = x^2 y + 3y$

- $\frac{\partial f}{\partial x} = 2xy$（把 $y$ 当常数）
- $\frac{\partial f}{\partial y} = x^2 + 3$

在 $(2, 1)$：$\frac{\partial f}{\partial x} = 4$，$\frac{\partial f}{\partial y} = 7$，梯度 $[4, 7]$。

**例 2：线性层 $\mathbf{y} = \mathbf{W}\mathbf{x}$，loss 对 $\mathbf{W}$ 的偏导**

设标量 loss $\mathcal{L}$，$\mathbf{y} = \mathbf{W}\mathbf{x}$，$\mathbf{W} \in \mathbb{R}^{m \times n}$。

$$
\frac{\partial \mathcal{L}}{\partial W_{ij}} = \frac{\partial \mathcal{L}}{\partial y_i} \cdot x_j
$$

矩阵形式：$\frac{\partial \mathcal{L}}{\partial \mathbf{W}} = \frac{\partial \mathcal{L}}{\partial \mathbf{y}} \mathbf{x}^\top$（外积）。

```python
import torch

m, n = 2, 3
W = torch.randn(m, n, requires_grad=True)
x = torch.randn(n)
y = W @ x
loss = y.sum()
loss.backward()
# W.grad[i,j] = d loss / d W[i,j] = 1 * x[j] = x[j]
print(W.grad)
print(torch.outer(torch.ones(m), x))  # 应一致
```

## 量化

| 对象 | 偏导数量 | 说明 |
| ---- | -------- | ---- |
| $n$ 个标量参数 | $n$ | 梯度长度 $n$ |
| $\mathbf{W} \in \mathbb{R}^{m \times n}$ | $mn$ | 每个 $W_{ij}$ 一个偏导 |
| LLaMA-7B | ≈ 7B | 每个参数一个 $\partial \mathcal{L}/\partial \theta_i$ |
| 计算方式 | 1 次 backward | autograd 一次遍历计算全部，非 $O(n)$ 次前向 |

**计算图节点**：若网络有 $L$ 层、每层 $d^2$ 参数，朴素对每个参数做有限差分需 $O(n)$ 次前向；反向传播一次 $O(L d^2)$，与参数个数同阶但**常数因子小一个数量级**。

混合精度训练：前向 bf16，梯度累加 fp32——偏导在 fp32 累加避免下溢。

## 工程视角：Jacobian 与反向模式

反向传播是**反向模式自动微分**（reverse-mode AD）：一次前向 $O(L)$ 层，一次反向 $O(L)$，得到**所有**参数的梯度。若用前向模式对每个参数单独求导，需 $O(n)$ 次 pass，$n=7B$ 不可行。

向量值函数 $\mathbf{y}=f(\mathbf{x})$，$\mathbf{x} \in \mathbb{R}^n$，$\mathbf{y} \in \mathbb{R}^m$：Jacobian $J \in \mathbb{R}^{m \times n}$，$J_{ij}=\partial y_i/\partial x_j$。反向传 $\bar{\mathbf{y}} = \partial \mathcal{L}/\partial \mathbf{y}$ 时：

$$
\bar{\mathbf{x}} = J^\top \bar{\mathbf{y}}
$$

**逐元素 op**（如 $\mathbf{y}=\mathbf{x}^2$）：Jacobian 对角，反向 cheap。**矩阵乘** $\mathbf{y}=\mathbf{W}\mathbf{x}$：Jacobian 稀疏结构，反向 $\bar{\mathbf{W}}=\bar{\mathbf{y}}\mathbf{x}^\top$，又一次 GEMM。

混合精度里偏导在 fp32 **master weight** 上累加：bf16 前向快，fp32 梯度精——避免 $10^{-7}$ 量级更新在 bf16 下变成 0（**underflow**）。

| 参数类型 | `.grad` shape 示例 | 与参数关系 |
| -------- | ------------------ | ---------- |
| `bias` | `(3072,)` | 同 shape |
| `weight` | `(3072, 768)` | 同 shape |
| `LayerNorm.weight` | `(768,)` | 对 $\gamma$ 逐元素 |

`torch.autograd.grad(loss, [w1, w2])` 可只求部分参数梯度——微调冻结 backbone 时常用 `requires_grad=False` 截断。

## 常见误区

1. **偏导 ≠ 全导数**：若 $y = f(x, g(x))$，$\frac{dy}{dx}$ 需链式法则，不是只偏 $x$。
2. **「对每个参数手算偏导」**：7B 参数不可能手算；autograd 用计算图 + 链式法则自动完成。
3. **忽略 shape**：$\frac{\partial \mathcal{L}}{\partial \mathbf{W}}$ 必须与 $\mathbf{W}$ 同 shape，否则 `optimizer.step()` 报错。

## 动手试一试

```python
import torch

def check_linear_grad(m=4, n=5):
    W = torch.randn(m, n, requires_grad=True)
    x = torch.randn(n)
    y = W @ x
    loss = (y ** 2).sum()
    loss.backward()
    # 手推: d loss / d y_i = 2 * y_i
    expected = torch.outer(2 * y, x)
    err = (W.grad - expected).abs().max().item()
    print(f"max error vs hand-derived: {err:.2e}")

check_linear_grad()
```

## 深入一层：多变量链的表格法

三层网络 $\mathcal{L}(w_1,w_2,w_3)$，手算时可列表：

| 阶段 | 中间量 | $\partial \mathcal{L}/\partial \cdot$ |
| ---- | ------ | ------------------------------------- |
| 输出 | $\hat{y}$ | $\hat{y}-y$ |
| 隐藏 | $a=\sigma(z)$ | 乘 $\sigma'(z)$ |
| 输入 | $z=w_1 x$ | 乘 $x$ |

表格从右往左填——即反向传播顺序。复杂网络只是表格更宽（ millions 列），逻辑不变。

**Einstein summation**：`einsum('ij,j->i', W, x)` 即矩阵-向量乘；`'bij,bjk->bik'` 是 batched GEMM。读懂 einsum 字符串 = 读懂偏导下标约定。

**Stop-gradient 场景**：GAN 训练 D 时不更新 G 的梯度（G 的样本对 D 是常数）；对比学习里 momentum encoder；RLHF 里 reference model 冻结算 KL。都是 $\partial/\partial\theta_{frozen}$ 不传播。

**高阶导数**：$\partial^2 \mathcal{L}/\partial w_i \partial w_j$ 组成 Hessian；对角近似用于 SAM（Sharpness-Aware Minimization）等 optimizer。LLM 默认不用，但 **curvature 研究** 是理解 generalization 的前沿。

偏导数是「分工」：每个参数各管各的 sensitivity；autograd 是「总调度」：一次 backward 分工完毕。

## 与优化器的关系

SGD 用梯度；Adam 用梯度的一阶、二阶矩估计。无论哪种，**输入都是 `.grad`**——偏导数的集合。`zero_grad(set_to_none=True)` 省内存；`accumulation` 多步 backward 再 step，等效大 batch 的梯度平均。

冻结参数 `requires_grad=False`：链式法则在该边截断，偏导不写入——微调 LLM 时常见：只训 LoRA 层，base 层不算 grad，省 90%+ 优化器显存。

## 读者备忘

**每个参数一个偏导，梯度 = 偏导向量。** 矩阵权重 $\mathbf{W}$ 的 $\partial \mathcal{L}/\partial \mathbf{W}$ 与 $\mathbf{W}$ 同 shape，公式是外积 $\bar{\mathbf{y}}\mathbf{x}^\top$。手算小网络可验；大模型全靠 `backward()`。`torch.autograd.grad` 可只求子集参数的偏导，用于 meta-learning 或梯度惩罚项。

::: info

本章内容面向程序员：公式可手推，数字可心算，代码可运行。遇到符号不熟时，先查本篇定义表，再查总结篇速查表，不必一次背熟全部细节。

:::

::: info

复习建议：先通读直觉与定义，再跑代码块验证数字，最后看读者备忘与小结。与第一章的 float 数组、SIMD、GPU 并行对照阅读，印象更深。后续章节会在 Transformer、训练、推理中反复调用本章符号，值得在笔记里自建一张 shape/FLOPs 速查表。

:::

::: info

动手练习：把本篇公式抄进 Jupyter，换三组数字复算；与 PyTorch 张量运算对照 shape 与数值。本章目标是建立可计算的数学直觉，而非完成证明。每篇至少两个数值例子，建议你都亲自算一遍或跑一遍代码。

:::

## 小结

偏导数 $\frac{\partial f}{\partial x_i}$ 固定其它变量、只对 $x_i$ 求导；梯度是全部偏导的向量。神经网络每个权重有一个偏导，反向传播一次算齐。矩阵权重的梯度是外积形式。下一篇讲如何把多层偏导**链**起来：**链式法则**——反向传播的实现依据。

→ 下一篇：[链式法则是什么](/manual/llm/bit-to-agi/02-math/chain-rule)
