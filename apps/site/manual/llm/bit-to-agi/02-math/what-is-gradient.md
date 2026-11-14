---
title: "梯度是什么"
description: "从 Bit 到 AGI · 第二章：数学（Math） · 梯度是什么"
source: "https://daiw.org/manual/bit-to-agi/02-math/what-is-gradient"
---

# 梯度是什么

> 从 Bit 到 AGI · 第二章：数学（Math） · 梯度是什么

矩阵乘法告诉我们**前向**怎么算：输入乘权重得到输出。但 70 亿个权重怎么**学会**正确值？答案是沿着**梯度**方向调整。本篇定义梯度——多元函数对各变量偏导数组成的向量——并量化一次反向传播里梯度张量的规模。

## 直觉：多维空间里的「最陡上坡方向」

你在山上，海拔是 $f(x, y)$。想知道往哪走上升最快——看**梯度** $\nabla f$，它指向最陡的上坡方向；**负梯度** $-\nabla f$ 指向最陡的下坡。

神经网络里，损失函数 $\mathcal{L}(\theta)$ 的变量是**所有权重** $\theta$（可能 70 亿维）。梯度 $\nabla_\theta \mathcal{L}$ 告诉你：每个权重该增大还是减小、幅度多大，才能让损失下降最快。

## 定义

设 $f: \mathbb{R}^n \to \mathbb{R}$，即 $n$ 个输入、一个标量输出（典型如 loss）。**梯度**是：

$$
\nabla f = \begin{bmatrix} \frac{\partial f}{\partial x_1} \\ \frac{\partial f}{\partial x_2} \\ \vdots \\ \frac{\partial f}{\partial x_n} \end{bmatrix} \in \mathbb{R}^n
$$

- 每个分量是**偏导数**（下一篇详讲）。
- 梯度是**向量**，与输入 $\mathbf{x}$ 同维。
- 方向：$f$ 增长最快的方向；模长 $\|\nabla f\|$ 表示该方向上的变化率。

对神经网络：$\theta$ 是所有参数拼成的向量，$\nabla_\theta \mathcal{L}$ 与 $\theta$ **同 shape 的梯度张量**（PyTorch 里 `param.grad`）。

## 例子

**例 1：二元函数**

$f(x, y) = x^2 + y^2$。偏导：$\frac{\partial f}{\partial x} = 2x$，$\frac{\partial f}{\partial y} = 2y$。

在点 $(3, 4)$：$\nabla f = [6, 8]$，模长 $\|\nabla f\| = \sqrt{36+64} = 10$。

沿 $-\nabla f$ 方向（即 $(-6, -8)$ 归一化后）走，$f$ 下降最快。

**例 2：单层线性 + MSE loss**

$\mathcal{L} = \frac{1}{2}(y - wx)^2$，$w$ 是标量权重。

$$
\frac{\partial \mathcal{L}}{\partial w} = -(y - wx) \cdot x
$$

若 $x=2$、$y=5$、$w=1$，则 $\mathcal{L}=4.5$，梯度 $= -(5-2)\times 2 = -6$。更新 $w \leftarrow w - \eta \cdot (-6) = w + 6\eta$（$\eta$ 为学习率），$w$ 增大以减小 loss。

```python
import torch

x, y, w = torch.tensor(2.0), torch.tensor(5.0), torch.tensor(1.0, requires_grad=True)
loss = 0.5 * (y - w * x) ** 2
loss.backward()
print(w.grad.item())  # -6.0
```

## 量化

| 场景 | 梯度规模 |
| ---- | -------- |
| 标量参数 $w$ | 1 个数 |
| 向量参数 $\mathbf{w} \in \mathbb{R}^d$ | $d$ 个数，与 $\mathbf{w}$ 同 shape |
| 矩阵权重 $\mathbf{W} \in \mathbb{R}^{m \times n}$ | $(m, n)$ 张量 |
| LLaMA-7B 全部参数 | ≈ 7B 个梯度值，与参数量相同 |
| 反向传播显存 | 常需存激活 + 梯度，约为前向 activations 的 1–2 倍 |

**梯度下降一步**（SGD）：

$$
\theta_{t+1} = \theta_t - \eta \nabla_\theta \mathcal{L}(\theta_t)
$$

学习率 $\eta$ 典型值：$10^{-4}$ 到 $10^{-2}$（预训练）；太大发散，太小收敛慢。

FLOPs：反向传播约为前向的 **2 倍**（链式法则，后面讲）。

## 工程视角：autograd 里的梯度

PyTorch 中 `requires_grad=True` 的张量参与运算时，框架构建**动态计算图**。`loss.backward()` 从 loss 节点反向遍历，每个 op 的 `backward` 把上游梯度乘以本地雅可比（链式法则），写入 `.grad` 字段。

**梯度累积**：`loss = loss / accumulation_steps` 多次 backward 再 `optimizer.step()`，等效更大 batch——显存不够时常见。`.grad` 在 step 前需 `zero_grad()`，否则梯度累加。

**梯度检查点**（activation checkpointing）：不存全部中间激活，反向时重算前向——用 FLOPs 换显存，大模型训练标配。

Adam 更新不是直接用 $\nabla \mathcal{L}$，而是维护一阶矩 $\mathbf{m}$、二阶矩 $\mathbf{v}$：

$$
\theta_{t+1} = \theta_t - \eta \frac{\hat{\mathbf{m}}}{\sqrt{\hat{\mathbf{v}}} + \epsilon}
$$

每个参数仍有「等效梯度方向」，只是自适应缩放。LLM 预训练 $\beta_2=0.95$（而非默认 0.999）是经验调参，让二阶矩更快适应非平稳 loss landscape。

| 优化器 | 每参数额外状态 | 7B 训练显存增量（粗估） |
| ------ | -------------- | ----------------------- |
| SGD | 0 | 0 |
| AdamW | $2 \times$ 参数量 fp32 | +≈56 GiB（m + v） |

## 常见误区

1. **梯度 ≠ 参数**：梯度是「该往哪改」的方向；参数是实际存储的权重值。
2. **梯度为零 ≠ 最优**：可能是鞍点或局部 plateau；也可能只是 ReLU 死区导致。
3. **「梯度很大 = 学得快」**：大梯度常需梯度裁剪（clip norm 1.0）；Adam 等自适应优化器会缩放各维梯度。

## 动手试一试

```python
def sgd_step(w: float, grad: float, lr: float = 0.01) -> float:
    return w - lr * grad

w, grad = 1.0, -6.0
for t in range(5):
    w = sgd_step(w, grad, lr=0.1)
    grad = -(5 - w * 2) * 2  # 重新算梯度
    print(f"t={t}, w={w:.3f}, grad={grad:.3f}")
```

## 深入一层：方向与步长

梯度方向是**最陡上升**；负梯度是**最陡下降**——仅当度量是欧氏时成立。Adam 用自适应对角缩放，等价于在逐元素加权度量下走下降方向，不再严格是 $\mathcal{L}$ 的负梯度方向，但实践更好。

**随机性**：mini-batch 梯度 $\hat{\mathbf{g}}$ 有方差，$\text{Var}(\hat{\mathbf{g}}) \propto 1/B$。大 batch 梯度准但易陷 sharp minima；小 batch 噪声大但泛化有时更好——LLM 预训练倾向大 batch + 大数据，另一套经验。

**Nesterov momentum**：「先动一步再看梯度」，收敛率在某些凸问题优于 vanilla GD。SGD + momentum 0.9 曾是 CV 标配；LLM 几乎全用 AdamW，但 momentum 思想仍在 $\beta_1$ 里。

**二阶曲率**（直觉）：$\mathcal{L}(\theta+\Delta\theta) \approx \mathcal{L} + \nabla^\top \Delta\theta + \frac{1}{2}\Delta\theta^\top H \Delta\theta$。$H$ 正定且 $\Delta\theta = -H^{-1}\nabla$ 是一牛顿步——LLM 算不起 $H$，但 **Adam 对角 $1/\sqrt{v}$** 可看作对角 Hessian 的 crude 近似。

监控训练时同时看 **loss** 与 **grad norm**：loss 降、grad norm 升可能是 sharp 区域；两者都 explode 则立刻介入 clip / 降 lr。

## 分布式训练中的梯度

DDP：`loss.backward()` 后 all-reduce 各卡 `.grad` 求平均，等价大 batch 梯度。梯度范数在 reduce 前后可能差 $\sqrt{world\_size}$ 因子——clip 通常在 reduce **之后**做。

ZeRO-1/2/3 分片 optimizer state，不改变梯度数学，只改存储。混合精度：loss scaling 防 fp16 grad underflow；bf16 常不需 scale。

## 读者备忘

**梯度 = 与参数同 shape 的「改正方向表」。** `loss.backward()` 填 `.grad`；`optimizer.step()` 用负梯度更新。7B 模型 = 7B 个梯度值；Adam 再存 2× fp32 状态。clip norm 1.0 是 LLM 训练常见默认值。若 `grad is None`，检查 `requires_grad` 与 detach。

::: info

本章内容面向程序员：公式可手推，数字可心算，代码可运行。遇到符号不熟时，先查本篇定义表，再查总结篇速查表，不必一次背熟全部细节。

:::

::: info

复习建议：先通读直觉与定义，再跑代码块验证数字，最后看读者备忘与小结。与第一章的 float 数组、SIMD、GPU 并行对照阅读，印象更深。后续章节会在 Transformer、训练、推理中反复调用本章符号，值得在笔记里自建一张 shape/FLOPs 速查表。

:::

## 小结

梯度 $\nabla f$ 是各偏导数组成的向量，指向函数增长最快方向；训练时用**负梯度**更新参数以最小化 loss。PyTorch `loss.backward()` 自动算全网络梯度。参数量 = 梯度元素个数；反向 FLOPs ≈ 2× 前向。下一篇解释**导数为何足以驱动学习**——从一元切线近似到激活函数选型。

→ 下一篇：[导数为什么可以学习](/manual/llm/bit-to-agi/02-math/why-derivatives-enable-learning)
