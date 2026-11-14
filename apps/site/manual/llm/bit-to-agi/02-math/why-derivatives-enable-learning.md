---
title: "导数为什么可以学习"
description: "从 Bit 到 AGI · 第二章：数学（Math） · 导数为什么可以学习"
source: "https://daiw.org/manual/bit-to-agi/02-math/why-derivatives-enable-learning"
---

# 导数为什么可以学习

> 从 Bit 到 AGI · 第二章：数学（Math） · 导数为什么可以学习

梯度告诉我们「往哪改」，但凭什么改一点 $w$，loss 就会按预期变化？答案是**导数**（变化率）把局部线性近似建立起来。本篇从一元导数出发，说明为什么「可微 ≈ 可学习」，以及不可导点（ReLU 零点）在实践中如何处理。

## 直觉：用切线近似函数

函数 $f(w)$ 在 $w_0$ 附近，可以用切线近似：

$$
f(w) \approx f(w_0) + f'(w_0) \cdot (w - w_0)
$$

导数 $f'(w_0)$ 回答：**$w$ 增加一个无穷小量，$f$ 增加多少？** 训练时我们据此判断：增大 $w$ 会让 loss 升还是降。

没有导数，就像蒙眼下山——只能随机试；有导数，每一步有方向。

## 定义

**导数**（一元）：函数 $f: \mathbb{R} \to \mathbb{R}$ 在 $x$ 处的导数：

$$
f'(x) = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}
$$

几何意义：曲线在 $(x, f(x))$ 处切线的斜率。

**可微**（differentiable）：导数存在且有限。神经网络要求 loss 对参数**几乎处处可微**，才能用梯度下降。

**关键性质**（用于学习）：

| 性质 | 公式 | 学习中的意义 |
| ---- | ---- | ------------ |
| 单调性 | $f' > 0$ → $f$ 递增 | 梯度符号决定增/减参数 |
| 极值 | $f'=0$ 可能是极值点 | 训练「收敛」时梯度 → 0 |
| 线性近似 | $\Delta f \approx f' \cdot \Delta w$ | 小步更新有效 |

## 例子

**例 1：MSE loss 对权重的导数**

$\mathcal{L}(w) = \frac{1}{2}(y - wx)^2$

$$
\frac{d\mathcal{L}}{dw} = -(y - wx) \cdot x
$$

- 若预测 $wx < y$（欠拟合），$y - wx > 0$，导数为负 → 增大 $w$ 减小 loss。✓
- 若 $wx > y$（过拟合），导数为正 → 减小 $w$。✓

**例 2：Sigmoid 与梯度消失**

$\sigma(z) = \frac{1}{1+e^{-z}}$，导数 $\sigma'(z) = \sigma(z)(1-\sigma(z)) \leq 0.25$。

10 层连乘：最大梯度 $\leq 0.25^{10} \approx 10^{-6}$——这就是**梯度消失**，深层几乎学不动。ReLU 缓解此问题（导数 0 或 1）。

```python
import math

def sigmoid(z):
    return 1 / (1 + math.exp(-z))

def sigmoid_grad(z):
    s = sigmoid(z)
    return s * (1 - s)

# 10 层连乘的最大梯度上界
bound = 0.25 ** 10
print(f"10-layer sigmoid grad bound: {bound:.2e}")  # ~9.54e-07
```

## 量化

| 激活函数 | 导数范围 | 深层训练 |
| -------- | -------- | -------- |
| Sigmoid | $(0, 0.25]$ | 易梯度消失 |
| Tanh | $(0, 1]$ | 略好于 Sigmoid |
| ReLU | $\{0, 1\}$ | 主流；$z=0$ 不可导，取次梯度 0 |
| GELU / SwiGLU | 平滑、有界 | LLM 常用 |

**有限差分验证导数**（调试 autograd）：

$$
f'(x) \approx \frac{f(x + \epsilon) - f(x - \epsilon)}{2\epsilon}, \quad \epsilon = 10^{-5}
$$

与 PyTorch `backward()` 对比，误差应 $< 10^{-4}$。

一次参数更新：$\Delta w = -\eta f'(w)$。$\eta = 0.01$、$f'(w) = -6$ 时，$\Delta w = 0.06$。

## 工程视角：不可微与次梯度

现代框架的 autograd 覆盖绝大多数 op，但仍有**不可微**或**未实现梯度**的操作：`argmax`、硬阈值、`torch.round`（ STE 除外）。LLM 解码用 argmax 或 sampling，**推理阶段不需要对离散选择求导**——训练时对连续 logits 求导即可。

ReLU 在 $z=0$ 数学上不可导，PyTorch 定义 `grad=0`。测度为零，不影响 SGD 几乎处处路径。Leaky ReLU、GELU 则处处可导——LLM 选 GELU/SwiGLU partly 为平滑梯度。

**Straight-Through Estimator**（STE）：量化训练里 forward 用 round，backward 假装 identity，硬塞导数——工程 trick，非严格数学。

损失 landscape 可视化（二维切片）常见：大量鞍点、宽平坦谷。导数给出**局部**最陡方向；SGD 噪声 + 大 batch 平均帮助「滚过」鞍点。完全凸优化那套全局最优保证，深度学习享受不到，但**局部下降 + 足够容量**在实践中足够。

**学习率与 Lipschitz**：若每层梯度 Lipschitz 常数 $L_i$，复合后指数增长/衰减。Pre-Norm 把 LayerNorm 放在子层前，约束激活尺度，等价于控制有效 Lipschitz——架构选择与导数行为一体。

## 常见误区

1. **「神经网络是非线性的，导数没用」**：非线性堆叠整体仍可能可微；导数描述的是**局部**行为，足够指导小步迭代。
2. **ReLU 不可微就不能训练**：$z=0$ 测度为零；实践取次梯度（subgradient）0 或 1，不影响 SGD。
3. **导数为零就停**：批量训练、Adam 动量、噪声都能帮逃离鞍点；且深度网络极少严格到 $\nabla \mathcal{L} = 0$。

## 动手试一试

```python
import torch

def numerical_grad(f, x, eps=1e-5):
    return (f(x + eps) - f(x - eps)) / (2 * eps)

w = torch.tensor(1.0, requires_grad=True)
loss = 0.5 * (5.0 - w * 2.0) ** 2
loss.backward()
analytic = w.grad.item()
numeric = numerical_grad(lambda t: 0.5 * (5.0 - t * 2.0) ** 2, 1.0)
print(f"analytic={analytic:.6f}, numeric={numeric:.6f}")
```

## 深入一层：从符号到计算图

手算 $\frac{d}{dx}x^n = nx^{n-1}$；$\frac{d}{dx}e^x = e^x$；$\frac{d}{dx}\ln x = 1/x$。复合函数用链式法则——autograd 表就是把这些规则编译成 op 级实现。

**Sigmoid 导数上界 0.25** 的定量后果：10 层连乘 $< 10^{-6}$；100 层基本为 0。ResNet 2015 用残差 partly 解决 CV 深层训练；Transformer 2017 用 Pre-LN + 残差。历史是：**导数行为驱动架构**。

**GELU** $\text{GELU}(x) = x \Phi(x)$（$\Phi$ 标准正态 CDF）平滑、非单调；导数在负半轴非零，信息可回流。LLaMA、GPT 系 FFN 用 SwiGLU（门控 × SiLU），仍处处可微。

**数值梯度检验**（单元测试 mindset）：新写 custom autograd Function 时，用 $\epsilon=10^{-5}$ 有限差分对比 analytic grad，相对误差 $<10^{-4}$ 才 merge。工业框架 op 已测；**你写的 loss 组合**才需自检。

导数把「离散实验」（试 $w\pm0.01$）变成「连续优化」（解析方向）——这是深度学习 vs 网格搜索的根本算力优势：一次 backward 给 $10^9$ 维方向。

## 激活函数导数速查

| 函数 | 导数 |
| ---- | ---- |
| ReLU | $1$ if $z>0$ else $0$ |
| GELU | 平滑，无简单闭式表 |
| Sigmoid | $\sigma(1-\sigma)$ |
| Tanh | $1-\tanh^2$ |

选激活 = 选梯度传递特性。LLM FFN 用 SwiGLU：门控 × SiLU，表达力强且可微。输出层前不需 Sigmoid——softmax 已归一化。

## 读者备忘

**可微 = 可自动求导 = 可梯度下降。** 激活函数选型（ReLU/GELU vs 硬阈值）直接决定梯度能否传回输入层。新写 loss 或 custom op 时，用有限差分 $\epsilon=10^{-5}$ 验证实现正确。不可微点测度为零时，次梯度仍使 SGD 在实践中有良好表现。

::: info

本章内容面向程序员：公式可手推，数字可心算，代码可运行。遇到符号不熟时，先查本篇定义表，再查总结篇速查表，不必一次背熟全部细节。

:::

## 小结

导数 $f'(x)$ 是局部变化率，使 $\Delta f \approx f' \Delta x$ 成立；梯度下降靠它决定每个参数的增减。可微性是自动微分的前提；激活函数选型直接影响梯度能否传回深层。下一篇把导数推广到多变量：**偏导数**——每个权重一个 sensitivity。

→ 下一篇：[偏导数是什么](/manual/llm/bit-to-agi/02-math/what-is-partial-derivative)
