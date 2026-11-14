---
title: "RNN 为什么消失"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · RNN 为什么消失"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/why-rnn-vanishes"
---

# RNN 为什么消失

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · RNN 为什么消失

RNN 按时间步展开，用隐藏状态 $h_t$ 记住过去——理论上能处理任意长序列。实践里，误差从第 $T$ 步反向传到第 1 步时要连乘 $T$ 个 Jacobian，梯度要么指数衰减（**消失**），要么指数爆炸（**爆炸**）。这是 LSTM 与 Attention 出现的直接动机。

## 直觉

传话游戏：100 个人排成一列，每人只能把改过的悄悄话传给下一位。规则若总是「把声音缩小一点」，传到队首只剩耳语；若总是「放大一点」，队尾就尖叫。RNN 的权重矩阵在每一步重复使用——谱半径决定缩小还是放大。

「长期依赖」= 队首的人需要听到队尾的原话；梯度消失 = 原话传不到。

## 定义

 vanilla RNN：

$$
h_t = \tanh(W_{hh} h_{t-1} + W_{xh} x_t + b), \quad
y_t = W_{hy} h_t
$$

BPTT（按时间反向传播）中，$\frac{\partial h_T}{\partial h_k}$ 含连乘：

$$
\prod_{t=k+1}^{T} \frac{\partial h_t}{\partial h_{t-1}} \approx \prod_{t=k+1}^{T} \mathrm{diag}(\tanh'(\cdot)) \cdot W_{hh}
$$

- 若 $\|W_{hh}\|$ 的最大奇异值 $< 1$：梯度 **消失**
- 若 $> 1$：梯度 **爆炸**

## 例子

**例 1：标量简化模型**

设 $h_t = 0.5 \cdot h_{t-1}$（无输入、无 tanh），$h_T = 0.5^T h_0$：

| $T$ | $h_T/h_0$ |
| --- | --------- |
| 10  | 0.001     |
| 20  | $10^{-6}$ |
| 50  | $10^{-15}$ |

50 步后信号 practically 归零。

**例 2：tanh 进一步压制**

$\tanh'(z) \leq 1$，通常 $< 1$。连乘 $\tanh' \cdot W_{hh}$：

```python
import numpy as np

Whh = np.random.randn(100, 100) * 0.1  # 小随机矩阵
v = np.random.randn(100)
v = v / np.linalg.norm(v)

for T in [1, 5, 10, 20]:
    prod_norm = 1.0
    for _ in range(T):
        # 简化：用 ||Whh|| 近似谱半径上界
        prod_norm *= np.linalg.norm(Whh, 2) * 0.5  # tanh' 平均 <1
    print(f"T={T:2d}, gradient scale ~ {prod_norm:.2e}")
```

**例 3：加法任务失败**

序列：`[a, b, ..., 0, 0, ..., 0, ?, ?]`，前若干位随机数 $a,b$，中间大量 0，末尾输出 $a+b$。RNN 需在长 0 段后仍记住 $a,b$——梯度消失时测试误差接近随机。

## 量化

- 有效记忆长度（经验）：vanilla RNN 约 **10～20** 步（任务相关）
- 梯度裁剪（clip by norm=5）可缓解**爆炸**，不解决**消失**
- 参数量：隐藏维 $d$，单层 RNN $W_{hh}, W_{xh}, W_{hy}$ ≈ $d^2 + d \cdot d_x + d \cdot d_y$
- $d=1024, d_x=d_y=512$：≈ **1.57M** 参数/层

::: warning

「RNN 消失」常双关：**梯度消失**（训不动）与 **长程信息消失**（$h_t$ 容量有限）。LSTM 主要解决后者；门控也改善前者。

:::

## 常见误区

1. **「加更多层 RNN 就能记更长」**——深 RNN 梯度路径更长，问题更严重；应用 **双向** 或 **深层 + skip** 需小心设计。
2. **「爆炸比消失好」**——爆炸导致 NaN，训练直接崩；需 gradient clipping。
3. **「RNN 已死」**——小序列、流式、极低延迟场景仍有 GRU/LSTM；LLM 主战场已是 Transformer。

## 动手试一试

模拟 BPTT 梯度连乘：

```python
import numpy as np

def rnn_grad_scale(W, T, tanh_factor=0.5):
    scale = 1.0
    for _ in range(T):
        scale *= tanh_factor * np.linalg.norm(W, 2)
    return scale

W = np.eye(10) * 0.9  # 略小于 1 的对角
for T in [5, 10, 50, 100]:
    print(f"T={T:3d}  scale={rnn_grad_scale(W, T):.2e}")
```

$W=0.9I$ 时，100 步 scale $\approx 0.9^{100} \approx 2.7 \times 10^{-5}$。

## 梯度爆炸与裁剪

当 $\|W_{hh}\| > 1$ 时，梯度指数放大，权重更新一步跳到 NaN。**Gradient clipping** 限制全局范数：

```python
# 伪代码
total_norm = sqrt(sum(p.grad.norm()**2 for p in params))
if total_norm > max_norm:
    scale = max_norm / total_norm
    for p in params:
        p.grad *= scale
```

典型 `max_norm=1.0`（RNN）或 `5.0`（Transformer）。裁剪**不修复消失**，只防止爆炸。

## 双向 RNN 与深度 RNN

**Bi-RNN** 正反向各跑一遍，输出拼接——每个位置能看全句，但推理 latency **2×**（生成任务常用单向）。

**Stacked RNN** 多层：低层学局部模式，高层学抽象；梯度需穿过「时间 × 层数」更长路径，训练难度上升。2014 前 seq2seq 常用 2～4 层 LSTM。

## Teacher forcing 与 exposure bias

Seq2seq 训练用 **teacher forcing**：解码器输入用 **真** 前一 token，而非 **预测** token——训练快但 train/test 不一致（exposure bias）。Scheduled sampling 逐渐改用模型自己的预测作输入。

**Truncated BPTT**：长序列只反向最后 $K$ 步（如 35），更早时刻截断——省显存，牺牲部分长程梯度；语言模型预 Transformer 时代常用。

**Statefulness**：batch 内样本独立重置 $h_0=0$；流式推理则 $h_t$ 跨步传递——同一 RNN 两种用法，实现细节不同。

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

写笔记时用一句话概括本篇核心定理或结论，便于复习。

## 小结

RNN 的循环权重在 BPTT 中被**连乘** → 梯度消失/爆炸 → 难学长依赖。这是 LSTM/GRU（门控）与 Attention（直接连任意位置）的历史背景。

→ 下一篇：[LSTM 解决了什么](/manual/llm/bit-to-agi/04-neural-networks/what-lstm-solves)
