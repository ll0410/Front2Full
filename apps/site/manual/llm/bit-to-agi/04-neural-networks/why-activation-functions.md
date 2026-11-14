---
title: "为什么要激活函数"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · 为什么要激活函数"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/why-activation-functions"
---

# 为什么要激活函数

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · 为什么要激活函数

如果每层只做矩阵乘法，堆再深也等价于一层线性变换——激活函数是在线性步骤之间插入的「折弯」，让网络能拟合曲线、边界和复杂模式。没有它，深度网络毫无意义。

## 直觉

用直尺只能画直线。你想画折线、曲线、闭合区域，必须在关键位置「拐弯」。激活函数就是每个神经元输出上的拐弯点：输入很大时饱和、输入为负时截断、或者平滑地 S 形过渡。

生活类比： thermostat 不是「温度 × 0.8 = 空调功率」，而是低于 18°C 全开、高于 22°C 全关——**阈值 + 非线性** 才能产生有用的控制策略。

## 定义

激活函数 $f: \mathbb{R} \to \mathbb{R}$（或向量上的逐元素函数）作用于预激活 $z$：

$$
y = f(z), \quad z = \mathbf{w}^\top \mathbf{x} + b
$$

**关键性质**：

- **非线性**：若 $f$ 是线性函数 $f(z)=az+b$（$a \neq 0$），则任意 L 层网络可折叠为 1 层。
- **可微（几乎处处）**：训练需要 $\frac{\partial f}{\partial z}$；ReLU 在 0 处不可微，实践中取 0 或 1 均可。
- **计算便宜**：现代网络每层对百万级 $z$ 值调用 $f$；复杂函数（如 $\sin$）很少用。

## 例子

**例 1：两层线性 = 一层线性**

```python
import numpy as np

W1 = np.array([[1.0, 2.0], [3.0, 4.0]])
W2 = np.array([[0.5, 0.5]])
x = np.array([1.0, 2.0])

# 无激活：y = W2 @ (W1 @ x) = (W2 @ W1) @ x
y_two_layers = W2 @ (W1 @ x)
W_equiv = W2 @ W1
y_one_layer = W_equiv @ x
print(np.allclose(y_two_layers, y_one_layer))  # True
```

**例 2：加入 ReLU 后无法折叠**

```python
def relu(z):
    return np.maximum(0, z)

h = relu(W1 @ x)           # 中间层被「截断」，负值变 0
y = W2 @ h                 # 一般 ≠ 任何单层 W @ x
```

设 $W_1 x = [-1, 2]^\top$，ReLU 后 $h = [0, 2]^\top$——负半轴信息被丢弃，这是线性层做不到的。

**例 3：常见激活函数一览**

| 名称   | 公式                         | 输出范围   | 特点           |
| ------ | ---------------------------- | ---------- | -------------- |
| ReLU   | $\max(0, z)$                 | $[0, +\infty)$ | 快、稀疏、主流 |
| Sigmoid | $1/(1+e^{-z})$             | $(0, 1)$   | 易饱和、慢     |
| Tanh   | $(e^z - e^{-z})/(e^z + e^{-z})$ | $(-1, 1)$ | 零中心         |
| GELU   | $z \cdot \Phi(z)$            | 近似 $(-\infty, +\infty)$ | Transformer 常用 |

## 量化

以 hidden 维度 $d=4096$、batch $B=32$ 的一层为例：

- 预激活 $Z$：形状 $(B, d)$，共 **131,072** 个 $z$ 值
- ReLU：每个 $z$ 一次比较，约 **131K 次** 比较/层/步
- Sigmoid：每个 $z$ 一次 exp + 除法，约 **3×** 于 ReLU 的 FLOPs
- 存储激活值（反向传播用）：131,072 × 4 B ≈ **512 KB**/层

::: warning

激活函数的选择影响梯度流。Sigmoid 在 $|z|>4$ 时梯度 $< 0.02$，深层网络训练困难——详见 [Sigmoid 为什么失败](/manual/llm/bit-to-agi/04-neural-networks/why-sigmoid-fails) 与 [ReLU 为什么成功](/manual/llm/bit-to-agi/04-neural-networks/why-relu-wins)。

:::

## 常见误区

1. **「最后一层也要 ReLU」**——分类常用 softmax（多类）或 sigmoid（二类）；回归常用恒等或 ReLU（非负输出）。
2. **「激活函数越多越好」**——每层一次足够；同一层重复激活无额外表达力。
3. **「非线性 = 任意 weird 函数」**——需平衡表达力、梯度、速度；工程上 ReLU/GELU 久经考验。

## 动手试一试

用 ReLU 拟合「折线」 $y = \max(0, x-1) + \max(0, -x+3)$ 的一个段落：

```python
import numpy as np

# 两个 ReLU 神经元 + 线性输出
# h1 = relu(x - 1), h2 = relu(-x + 3), y = h1 + h2
def piecewise(x):
    return np.maximum(0, x - 1) + np.maximum(0, -x + 3)

for x in [-1, 0, 1, 2, 3, 4]:
    print(f"x={x:2d}  y={piecewise(x):.1f}")
# x=0→3, x=1→2, x=2→2, x=3→2, x=4→3  （平底谷，最小值 2 出现在 1≤x≤3）
```

两个 ReLU 基函数叠加，得到分段线性输出——深层网络不过是更多段、更灵活的折线。

## 从 XOR 看非线性必要性

XOR 是教科书级例子：平面上四个点 $(0,0)\to0,(0,1)\to1,(1,0)\to1,(1,1)\to0$，无法用一条直线分开。单层线性模型 $\mathbf{w}^\top\mathbf{x}+b=0$ 只能画一条分界；**至少一个隐藏层 + 非线性** 才能用两条「半平面」拼出 XOR 边界。

与其相信这句话，不如**自己按一下**——下面这个网络是真的在你浏览器里训练（手写前向/反向 + Adam，2-N-1 结构）：

<XorLab />

默认那档是**无激活**。点「开始训练」，看着 loss 一头撞在 **0.25** 上再也下不去——0.25 正是「四个点全猜 0.5」的 MSE，也就是**什么都没学到**。它不是训练不够久：$W_2(W_1x)$ 恒等于 $(W_2W_1)x$，两层线性折叠成一层线性，**而 XOR 不是线性可分的**。再训一万步也一样。

然后切到 **ReLU**，同样的代码、同样的优化器，只多了一个 $\max(0, \cdot)$——loss 几秒内掉到 0，决策边界折成两条半平面拼出的角。

这直接回应 1969 年 Minsky 对感知机的批评：**不是神经元不够，是非线性层数不够**。

## 输出层激活怎么选

| 任务 | 输出激活 | 损失配对 |
| ---- | -------- | -------- |
| 多类分类 | softmax | 交叉熵 |
| 二分类 logit | sigmoid（或不用，BCEWithLogits） | BCE |
| 回归（任意实数） | 恒等 | MSE |
| 回归（非负） | ReLU / softplus | MSE |
| 语言模型 | softmax over vocab | token CE |

隐藏层与输出层职责不同：隐藏层负责**特征变换**，输出层负责**把 logits 映射到目标空间**。

## 平滑激活与二阶优化

**Swish** $z \cdot \sigma(z)$、**Mish** $z \tanh(\mathrm{softplus}(z))$ 在部分 CV 任务略优于 ReLU，但增益常 **低于 0.5% acc**——工程默认仍 ReLU/GELU。

**Softmax 不是隐藏层激活**：它是 **多类归一化**，把 logits 变概率 simplex；与 sigmoid（二类）对称。Temperature scaling 推理时 $z/T$ 校准 confidence。

**Dead zone**：ReLU 负半轴、sigmoid 两端都是梯度死区——激活选型 = 选 **哪段区间保持有效梯度** 与 **计算预算** 的平衡。

## 动手与阅读建议

建议对照 PyTorch 文档 `torch.nn` 模块，把本篇公式与 `Linear`、`ReLU`、`LSTM`、`MultiheadAttention` 的 `forward` 签名一一对应。读论文时先圈出 **张量 shape**（如 $(B, T, d)$）再读公式，比死记符号快得多。

若训练 loss 不降：先画 **train loss 曲线**（逐步、非 epoch 平均），看是震荡、plateau 还是 NaN。NaN 从 **lr 减半** 与 **gradient clip** 开始试；plateau 查 **wd 是否过大** 或 **数据是否标错**。验证集只用于 **选超参**，勿反复调 test。

本章内容在第五章 **Transformer** 会全部复现：QKV 是 Attention，FFN 是 MLP，Pre-LN 是 LayerNorm。掌握本章 = 读 GPT 论文的最低门槛。完成 MNIST 或 XOR 小实验（CPU 即可）再进入下一章，手感差异很大。

## 术语对照（中英）

Neuron/Unit 神经元；Activation 激活函数；Hidden layer 隐藏层；Logit 预激活 $z$；Embedding 把离散 id 映射为连续向量；Epoch 全数据扫一遍；Iteration/Step 一个 batch 更新一次；Learning rate 学习率 $\eta$；Weight decay 权重衰减（L2 或 AdamW）；Fine-tune 微调预训练权重。读英文文档时这些词与中文教材一一对应，避免混用「单元/神经元/节点」造成概念漂移。

## 算力与显存（复习）

参数量 $P$ 个 float32 权重约占 **$4P$ 字节**。训练显存粗估：**权重 + 梯度 + 优化器状态**（Adam 约 **$3\times$** 权重）+ **激活**（与 batch、序列长度、层数成正比）。推理 mainly **权重 + KV cache**（生成式 LLM）。先会估算 $P$ 和一次 forward 的 FLOPs，再读第九章 GPU 与第七章分布式，数字才能对齐。

## 小结

激活函数赋予网络**非线性表达力**；没有它，深度等于宽度。选型要兼顾梯度、速度与任务；现代默认 ReLU（CNN/MLP）或 GELU（Transformer）。

→ 下一篇：[ReLU 为什么成功](/manual/llm/bit-to-agi/04-neural-networks/why-relu-wins)
