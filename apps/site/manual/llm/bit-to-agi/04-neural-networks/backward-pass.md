---
title: "反向传播是什么"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · 反向传播是什么"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/backward-pass"
---

# 反向传播是什么

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · 反向传播是什么

反向传播（Backpropagation）用链式法则从损失 $L$ 往回算每个参数的梯度 $\frac{\partial L}{\partial w}$，再用优化器更新权重。它不是独立算法，而是**高效实现链式法则**的记账顺序——先 forward 存中间值，再 backward 从输出层倒推。

## 直觉

爬山时想知道「往哪走最陡下坡」：每个旋钮（权重）转一点点，看损失变化多快。参数百万个，暴力有限差分要百万次前向——反向传播一次 backward 等价于一次前向量级的计算，因为**共享子表达式**（链式法则复用）。

第二章学过链式法则与偏导；这里把它接到网络上。

## 定义

对单层 $\mathbf{h} = f(\mathbf{z}), \mathbf{z} = \mathbf{W}\mathbf{h}_{\text{prev}} + \mathbf{b}$：

$$
\frac{\partial L}{\partial \mathbf{z}} = \frac{\partial L}{\partial \mathbf{h}} \odot f'(\mathbf{z}) \quad \text{（Hadamard 积）}
$$

$$
\frac{\partial L}{\partial \mathbf{W}} = \frac{\partial L}{\partial \mathbf{z}} \mathbf{h}_{\text{prev}}^\top, \quad
\frac{\partial L}{\partial \mathbf{b}} = \frac{\partial L}{\partial \mathbf{z}}, \quad
\frac{\partial L}{\partial \mathbf{h}_{\text{prev}}} = \mathbf{W}^\top \frac{\partial L}{\partial \mathbf{z}}
$$

$\frac{\partial L}{\partial \mathbf{h}_{\text{prev}}}$ 继续传给更浅层——**误差反向流动**。

## 例子

**例 1：单神经元 + MSE**

$f(z)=z$，$y = w x + b$，$L = \frac{1}{2}(y - t)^2$，$x=2, w=0.5, b=0.1, t=3$：

前向：$y = 0.5 \times 2 + 0.1 = 1.1$，$L = \frac{1}{2}(1.1-3)^2 = 1.805$

$$
\frac{\partial L}{\partial y} = y - t = -1.9
$$

$$
\frac{\partial L}{\partial w} = \frac{\partial L}{\partial y} \cdot x = -1.9 \times 2 = -3.8
$$

$$
\frac{\partial L}{\partial b} = -1.9
$$

SGD 更新 $w \leftarrow w - \eta \frac{\partial L}{\partial w}$，$\eta=0.1$ → $w' = 0.5 + 0.38 = 0.88$（损失下降方向）。

**例 2：ReLU 层**

$z = [-1, 2]$，$h = [0, 2]$，上游 $\frac{\partial L}{\partial h} = [0.5, 1.0]$：

$$
\frac{\partial L}{\partial z} = [0.5 \times 0,\ 1.0 \times 1] = [0, 1]
$$

负半轴梯度截断为 0。

**例 3：两层 NumPy 反向（简化）**

```python
import numpy as np

x = np.array([1.0, 2.0])
W1 = np.array([[1.0, 0.0], [0.0, 1.0]])
W2 = np.array([[1.0, 1.0]])
t = np.array([3.0])

# forward
z1 = W1 @ x
h1 = np.maximum(0, z1)
y = W2 @ h1
loss = 0.5 * (y - t) ** 2

# backward
dL_dy = y - t
dL_dW2 = dL_dy * h1
dL_dh1 = W2.T @ dL_dy
dL_dz1 = dL_dh1 * (z1 > 0)
dL_dW1 = np.outer(dL_dz1, x)

print(f"dL/dW2={dL_dW2}, dL/dW1=\n{dL_dW1}")
```

## 量化

- **计算量**：一次 backward ≈ **2×** forward FLOPs（经验法则，随实现波动）
- **GPT-3 训练一步**：forward + backward ≈ **700+ GFLOPs/token**（全模型）
- **自动微分**：PyTorch `loss.backward()` 在计算图上按拓扑序应用上述规则；**autograd** 不改变数学
- **检查点（gradient checkpointing）**：少存激活、backward 时重算 forward → 省内存、增计算

| 方法 | 梯度精确度 | 相对成本 |
| ---- | ---------- | -------- |
| 反向传播 | 精确（浮点误差内） | 1× |
| 数值微分 | 近似 | ~参数量 × forward |
| 前向模式 AD | 精确 | 适合 $n_{\text{out}}$ 小 |

::: warning

反向传播需要 $f$ 可微（或定义次梯度）。`argmax`、硬阈值不可微——部署时的离散决策与训练时的 soft 版本常分离。

:::

## 常见误区

1. **「反向传播 = 深度学习」**——线性回归、逻辑回归也用；只是网络深时才有「传播」形象。
2. **「梯度大 = 学得好」**——过大需 clip；过小需检查初始化与激活。
3. **「手动推公式 obsolete」**——理解单层规则有助于 debug NaN、写自定义层。

## 动手试一试

验证数值梯度 vs 解析梯度：

```python
import numpy as np

def loss_fn(w, x, t):
    y = w * x
    return 0.5 * (y - t) ** 2

w, x, t = 0.5, 2.0, 3.0
eps = 1e-5
numerical = (loss_fn(w + eps, x, t) - loss_fn(w - eps, x, t)) / (2 * eps)
analytic = (w * x - t) * x
print(f"numerical={numerical:.4f}, analytic={analytic:.4f}")
```

## 计算图上的链式法则

复合 $L = f(g(h(x)))$：

$$
\frac{\partial L}{\partial x} = \frac{\partial L}{\partial f}\cdot\frac{\partial f}{\partial g}\cdot\frac{\partial g}{\partial h}\cdot\frac{\partial h}{\partial x}
$$

网络是 $L$ 对数百万 $w_{ij}$ 各自求偏导；反向传播**共享**中间结果 $\partial L/\partial h^{(l)}$，避免重复计算——时间复杂度与前向同阶，远优于逐参数数值微分。

## 消失/爆炸在反向中的体现

RNN 的 $\prod \partial h_t/\partial h_{t-1}$ 是连乘；ReLU 的 $\mathrm{diag}(z>0)$ 会截断部分路径为 0。BatchNorm、残差、LSTM 门控都是从**前向结构**改善**反向梯度流**——训练技巧与架构不可分。

## 调试梯度

```python
# 训练异常时检查
for name, p in model.named_parameters():
    if p.grad is not None and (p.grad.abs().max() > 1e3 or p.grad.abs().max() == 0):
        print(name, p.grad.abs().max())
```

梯度全 0 → 死 ReLU / 错误冻结层；梯度爆炸 → 降 lr 或 clip。

## 反向传播在框架中的位置

现代框架（PyTorch、JAX）实现 **reverse-mode autodiff**：一次 backward 可算所有参数的梯度，复杂度与前向同阶。`torch.autograd.grad` 可求高阶导；`retain_graph=True` 允许多次 backward（如 GAN）。自定义层需实现 `forward` 并注册 `backward` 或 `@custom_function`。

**混合精度训练**（第七章）：前向用 float16/bfloat16，loss scale 防梯度下溢，权重主副本 float32——backward 在放大后的 loss 上进行，再 unscale 更新。理解 backward 是读懂 NaN 与 loss scaling 的前提。

**Checkpointing**：不存全部激活，backward 时重算部分 forward——以 **~33% 额外计算** 换 **~50% 激活显存**，大模型训练常用。

## 动手与阅读建议

建议对照 PyTorch 文档 `torch.nn` 模块，把本篇公式与 `Linear`、`ReLU`、`LSTM`、`MultiheadAttention` 的 `forward` 签名一一对应。读论文时先圈出 **张量 shape**（如 $(B, T, d)$）再读公式，比死记符号快得多。

若训练 loss 不降：先画 **train loss 曲线**（逐步、非 epoch 平均），看是震荡、plateau 还是 NaN。NaN 从 **lr 减半** 与 **gradient clip** 开始试；plateau 查 **wd 是否过大** 或 **数据是否标错**。验证集只用于 **选超参**，勿反复调 test。

本章内容在第五章 **Transformer** 会全部复现：QKV 是 Attention，FFN 是 MLP，Pre-LN 是 LayerNorm。掌握本章 = 读 GPT 论文的最低门槛。完成 MNIST 或 XOR 小实验（CPU 即可）再进入下一章，手感差异很大。

## 术语对照（中英）

Neuron/Unit 神经元；Activation 激活函数；Hidden layer 隐藏层；Logit 预激活 $z$；Embedding 把离散 id 映射为连续向量；Epoch 全数据扫一遍；Iteration/Step 一个 batch 更新一次；Learning rate 学习率 $\eta$；Weight decay 权重衰减（L2 或 AdamW）；Fine-tune 微调预训练权重。读英文文档时这些词与中文教材一一对应，避免混用「单元/神经元/节点」造成概念漂移。

## 算力与显存（复习）

参数量 $P$ 个 float32 权重约占 **$4P$ 字节**。训练显存粗估：**权重 + 梯度 + 优化器状态**（Adam 约 **$3\times$** 权重）+ **激活**（与 batch、序列长度、层数成正比）。推理 mainly **权重 + KV cache**（生成式 LLM）。先会估算 $P$ 和一次 forward 的 FLOPs，再读第九章 GPU 与第七章分布式，数字才能对齐。

下一篇链接在文末 **小结** 中；建议按 `meta.json` 顺序阅读，跳读易漏掉「RNN 消失 → LSTM → Attention」这条叙事链。遇到公式卡住，回第二章查 [链式法则](/manual/llm/bit-to-agi/02-math/chain-rule) 与 [softmax](/manual/llm/bit-to-agi/02-math/softmax-and-logits)。

**量化自检**：本篇至少包含两个带数字的例子（参数量、FLOPs、梯度量级或准确率）。复现时请用自己的随机种子跑代码，核对数量级一致即可，不必逐位相同——浮点顺序会导致末位差异。

## 小结

反向传播 = 链式法则 + 自输出向输入的梯度记账；给出 $\nabla_W L$ 供优化器使用。Forward 缓存、backward 复用——与[前向传播](/manual/llm/bit-to-agi/04-neural-networks/forward-pass)成对，是训练闭环的一半。

→ 下一篇：[权重初始化](/manual/llm/bit-to-agi/04-neural-networks/weight-initialization)
