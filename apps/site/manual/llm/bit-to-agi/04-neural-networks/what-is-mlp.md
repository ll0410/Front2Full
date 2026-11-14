---
title: "MLP 是什么"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · MLP 是什么"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/what-is-mlp"
---

# MLP 是什么

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · MLP 是什么

MLP（Multi-Layer Perceptron，多层感知机）是最朴素的深度网络：输入层 → 若干全连接隐藏层（每层 ReLU）→ 输出层。Transformer 里的 FFN 本质上就是两个宽 MLP；搞懂 MLP，就搞懂了「深度」的基本形态。

## 直觉

把问题想成流水线：第一车间提取粗特征（边缘、组合），第二车间组合成部件，第三车间做决策。MLP 每层每个神经元都看**全部**上一层的输出——没有局部窗口，没有记忆状态，只有矩阵乘法和激活。

适合表格数据、固定长度向量；不适合长序列（用 RNN/Transformer）或大图像（用 CNN，否则参数量爆炸）。

## 定义

$L$ 层 MLP（含输入层共 $L+1$ 组神经元）：

$$
\mathbf{h}^{(0)} = \mathbf{x}, \quad
\mathbf{h}^{(l)} = f\!\left(\mathbf{W}^{(l)} \mathbf{h}^{(l-1)} + \mathbf{b}^{(l)}\right), \quad
\mathbf{y} = \mathbf{W}^{(L)} \mathbf{h}^{(L-1)} + \mathbf{b}^{(L)}
$$

- $\mathbf{W}^{(l)} \in \mathbb{R}^{d_l \times d_{l-1}}$：第 $l$ 层权重
- $f$：通常 ReLU（隐藏层）；输出层 softmax（分类）或恒等（回归）

**全连接（FC）**：$d_{l-1}$ 个输入与 $d_l$ 个输出两两相连，参数量 $d_l \times d_{l-1} + d_l$。

## 例子

**例 1：MNIST 式小 MLP 参数量**

结构：784 → 128 → 64 → 10

| 层      | 权重形状   | 参数量        |
| ------- | ---------- | ------------- |
| FC1     | 128×784    | 100,352 + 128 |
| FC2     | 64×128     | 8,192 + 64    |
| FC3     | 10×64      | 640 + 10      |
| **合计** |            | **109,386**   |

float32 存储 ≈ **437 KB**；一次前向（仅 MAC）≈ **109K × 2 FLOPs** 量级。

**例 2：手算两层**

```python
import numpy as np

def relu(z):
    return np.maximum(0, z)

# x ∈ R^3, h ∈ R^2, y ∈ R^1
x = np.array([1.0, 2.0, -1.0])
W1 = np.array([[0.5, -0.5, 1.0],
               [1.0,  0.0, 0.5]])
b1 = np.array([0.1, -0.2])
W2 = np.array([[1.0, -1.0]])
b2 = np.array([0.0])

h = relu(W1 @ x + b1)
y = W2 @ h + b2
print(f"h={h}, y={y}")  # h=[0. 0.3], y=-0.3
```

**例 3：PyTorch 风格**

```python
# 逻辑等价（伪代码）
# model = Sequential(
#     Linear(784, 128), ReLU(),
#     Linear(128, 64),  ReLU(),
#     Linear(64, 10)
# )
```

## 量化

- **宽度 $d$、深度 $L$ 的方阵 MLP**（每层 $d \times d$）：参数量 $\approx L \cdot d^2$
- $d=4096, L=2$（类似 Transformer FFN 一侧）：单层 $4096^2 \approx 16.8$M 参数；两层 ≈ **33.6M**
- **GPT-3 175B** 中 FFN 占参数大头：每层约 $4 d^2$（up + down 投影），深度 × 层数极大
- 复杂度：前向 $O(\sum_l d_l d_{l-1})$；无结构假设，数据需自己学局部性

::: info

Transformer 块 = Attention + **MLP**。Attention 做「看谁」，MLP 做「怎么想」——MLP 并未过时，而是换了个名字（FFN）住在每个块里。

:::

## 常见误区

1. **「MLP = 深度学习全部」**——CNN/RNN/Attention 是结构归纳偏置；MLP 是通用但样本效率低。
2. **「层越多越好」**——深度需配合残差、归一化；裸深 MLP 难训（见[从感知机到深度网络](/manual/llm/bit-to-agi/04-neural-networks/from-perceptron-to-deep)）。
3. **「784→10 一层就够 MNIST」**——单层线性可分版本有限；两层非线性可达 **99%+** 准确率。

## 动手试一试

用 NumPy 实现三层 MLP 前向：

```python
import numpy as np

def mlp_forward(x, weights, biases, activation=relu):
    h = x
    for W, b in zip(weights[:-1], biases[:-1]):
        h = activation(W @ h + b)
    return weights[-1] @ h + biases[-1]

Ws = [np.random.randn(4, 3) * 0.1,
      np.random.randn(2, 4) * 0.1,
      np.random.randn(1, 2) * 0.1]
bs = [np.zeros(4), np.zeros(2), np.zeros(1)]
x = np.random.randn(3)
print(mlp_forward(x, Ws, bs).shape)  # (1,)
```

## Transformer 里的 FFN 就是 MLP

每个 Transformer 块含两个子层：Attention + **FFN（Feed-Forward Network）**。FFN 典型结构：

$$
\mathrm{FFN}(x) = W_2 \cdot \mathrm{GELU}(W_1 x + b_1) + b_2
$$

其中 $W_1 \in \mathbb{R}^{4d \times d}$，$W_2 \in \mathbb{R}^{d \times 4d}$——**先扩 4 倍再压回**，中间 GELU 非线性。Llama 用 SwiGLU 三门控，参数更多，但仍是「宽 MLP」家族。

$d=4096$ 的单层 FFN 参数：$4096 \times 16384 + 16384 \times 4096 \approx 134$M；96 层 GPT-3 里 FFN 参数量 **超过 Attention 的 QKV 投影总和**——所以说「LLM 主要是大 MLP 堆叠」并不夸张。

## 何时仍用纯 MLP

- **表格数据**（用户特征、风控）：树模型仍强，但 Embedding + MLP 是推荐深度学习基线
- **推荐系统** recall/ranking 最后一层
- **小型分类头**：CNN/Transformer  backbone 后接 1～2 层 FC

样本量小、特征有明确结构时，MLP 不如带归纳偏置的模型（CNN、GNN）样本效率高；**数据大、结构未知** 时 MLP/Transformer 占优。

## 宽度与深度的参数量权衡

同参数量 $P$：深窄网络层数多、每层矩阵小；浅宽网络层数少、单层 GEMM 大——GPU 对 **大矩阵乘** 更友好，极深窄 MLP 有时 **GPU 利用率低**。

**参数共享无**：MLP 每层独立 $W$——与 CNN 共享核、RNN 共享 $W_{hh}$ 不同；表达灵活但 sample complexity 高。

**Tabular DL**：2021 后 **TabTransformer**、**FT-Transformer** 把类别特征 embed 后过 Transformer 层——本质仍是 **结构化 MLP/Attention 混合**，表格数据深度学习 SOTA 方向之一。

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

MLP = 堆叠的全连接层 + 非线性激活；参数量由层宽决定，是「万能但费参数」的基线。图像用 CNN、序列用 RNN/Attention，但 FFN 仍是现代 LLM 的核心组件。

→ 下一篇：[CNN 为什么成功](/manual/llm/bit-to-agi/04-neural-networks/why-cnn-succeeds)
