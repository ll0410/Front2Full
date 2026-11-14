---
title: "ReLU 为什么成功"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · ReLU 为什么成功"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/why-relu-wins"
---

# ReLU 为什么成功

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · ReLU 为什么成功

ReLU（Rectified Linear Unit）用一行 `max(0, z)` 取代 sigmoid，在 2012 年 AlexNet 之后成为默认选择。它的成功不靠玄学，而是梯度、速度与稀疏性三项指标同时占优。

## 直觉

Sigmoid 像一条被压扁的 S 曲线：输入稍大或稍小，输出就贴边、梯度接近 0，信号传不回去。ReLU 像一道单向门：正数原样通过，负数一律挡在 0——简单到硬件都能专门优化。

类比：sigmoid 是「无论多大声说话，音量表最多到 10」；ReLU 是「小声直接静音，正常音量原样播放」——后者对训练中的「该大声大声、该静音静音」更友好。

## 定义

$$
\mathrm{ReLU}(z) = \max(0, z) = \begin{cases} z & z > 0 \\ 0 & z \leq 0 \end{cases}
$$

导数（次梯度）：

$$
\frac{\partial \mathrm{ReLU}}{\partial z} = \begin{cases} 1 & z > 0 \\ 0 & z \leq 0 \end{cases}
$$

变体：**Leaky ReLU** $f(z)=\max(0.01z, z)$ 给负半轴留小斜率；**GELU** 用于 Transformer，平滑版 ReLU。

## 例子

**例 1：梯度对比（$z = 3$ 与 $z = -3$）**

| 激活函数 | $f(3)$ | $f'(3)$ | $f(-3)$ | $f'(-3)$ |
| -------- | ------ | ------- | ------- | -------- |
| ReLU     | 3.0    | **1.0** | 0.0     | 0.0      |
| Sigmoid  | 0.953  | 0.045   | 0.047   | 0.045    |

ReLU 在正区间梯度恒为 1，sigmoid 最大梯度仅 0.25（在 $z=0$ 处）。

**例 2：100 层链式梯度**

假设每层激活处 $|f'(z)|$ 平均为 sigmoid 的 0.25、ReLU 正区间的 1.0：

$$
\text{sigmoid 100 层梯度积} \approx 0.25^{100} \approx 10^{-60} \quad (\text{消失})
$$

$$
\text{ReLU 100 层（全为正）} \approx 1^{100} = 1 \quad (\text{可传})
$$

实际网络不会全正或全负，但 ReLU 允许**部分路径**保持梯度 1，缓解消失。

**例 3：代码与稀疏性**

```python
import numpy as np

z = np.random.randn(10000)  # 标准正态
relu_out = np.maximum(0, z)
sparsity = (relu_out == 0).mean()
print(f"ReLU 输出为 0 的比例: {sparsity:.1%}")  # 约 50%
```

约一半神经元「静默」，计算与存储可跳过（推理优化），也减轻共适应（配合 Dropout 效果更好）。

## 量化

- **FLOPs**：ReLU 每元素 1 次比较；sigmoid 约 1 exp + 2 除法 + 若干加减 ≈ **4～8×** 开销
- **AlexNet（2012）**：ReLU 使训练快约 **6×**（原论文表述为收敛加速，相对 tanh）
- **内存**：与 sigmoid 相同，float32 每激活 4 B；稀疏性带来后续层有效计算量减少
- **死 ReLU**：若 $z \leq 0$ 且不再更新，神经元永久输出 0；Leaky ReLU / 合适初始化可缓解

::: info

ImageNet 上 AlexNet 用 ReLU 将 top-5 错误率从约 26%（类似规模 tanh 网络）拉到 **16.4%**——激活函数换代是深度学习复兴的关键拼图之一。

:::

## 常见误区

1. **「ReLU 不会梯度消失」**——负半轴梯度为 0，仍可能「死神经元」；只是正半轴不饱和。
2. **「所有任务都用 ReLU」**——RNN 内部曾多用 tanh；LLM 用 GELU/SiLU；输出层按任务选 softmax 等。
3. **「ReLU 不可微所以不能用」**——次梯度在 0 处取 0 或 1，实践完全可行。

## 动手试一试

观察学习率对死 ReLU 的影响：

```python
import numpy as np

w = np.array([-5.0])   # 大负权重
x = np.array([1.0])
lr = 0.1

for step in range(5):
    z = w @ x
    y = max(0, z)
    grad = 0 if z <= 0 else 1
    w -= lr * grad * x * (y - 0)  # 假设目标 0
    print(f"step {step}: z={z:.2f}, w={w[0]:.2f}")
# w 已很负，z 恒 ≤ 0，grad=0，w 永不更新 → 死 ReLU
```

换 `w = -0.5`、合适初始化（见[权重初始化](/manual/llm/bit-to-agi/04-neural-networks/weight-initialization)）可避免。

## GELU 与 SiLU：Transformer 时代的演进

ReLU 在 $z=0$ 处不可微、负半轴硬截断。**GELU**（Gaussian Error Linear Unit）平滑过渡：

$$
\mathrm{GELU}(z) \approx z \cdot \Phi(z)
$$

其中 $\Phi$ 是标准正态 CDF。BERT、GPT-2/3、Llama 的 FFN 内层常用 GELU 或 **SiLU**（$z \cdot \sigma(z)$）。它们保留 ReLU 的大梯度区间，又避免硬拐点；代价是每元素多几次 exp/erf 运算——在 $d=4096$ 的 FFN 里仍只占整体算力一小部分。

| 激活 | 主要场景 | 相对 ReLU 计算 |
| ---- | -------- | -------------- |
| ReLU | CNN、经典 MLP | 1× |
| Leaky ReLU | GAN、防死神经元 | ~1× |
| GELU | Transformer FFN | ~3～5× |
| SwiGLU | Llama FFN | 门控 × SiLU，更贵但更宽表达 |

## 硬件视角

NVIDIA Tensor Core 对 `GEMM + Bias + ReLU` 有融合指令；推理框架常把激活与卷积/线性合并为一个 kernel，减少 DRAM 读写。ReLU 的简单比较逻辑在边缘 NPU 上也易实现——**部署友好**是 ReLU  longevity 的隐性原因。

## CIFAR 与 ImageNet 上的经验

CIFAR-10 小图（32×32）上，同结构 **ReLU vs tanh**：ReLU 收敛 epoch 常 **减半**；test acc 相近或 ReLU 略高。ImageNet 规模下差距更大——tanh 网络同深度难训到 competitive acc。

**PRelu / ELU**：可学/固定负半轴斜率，减少 dead ReLU；移动端有时用 **Hard-Swish** 近似 GELU/Swish 省算力。

**推理量化**：ReLU 输出非负，INT8 量化范围易估；GELU 输出有负值，量化稍麻烦——边缘部署仍常见 ReLU backbone（MobileNet 等）。

## 动手与阅读建议

建议对照 PyTorch 文档 `torch.nn` 模块，把本篇公式与 `Linear`、`ReLU`、`LSTM`、`MultiheadAttention` 的 `forward` 签名一一对应。读论文时先圈出 **张量 shape**（如 $(B, T, d)$）再读公式，比死记符号快得多。

若训练 loss 不降：先画 **train loss 曲线**（逐步、非 epoch 平均），看是震荡、plateau 还是 NaN。NaN 从 **lr 减半** 与 **gradient clip** 开始试；plateau 查 **wd 是否过大** 或 **数据是否标错**。验证集只用于 **选超参**，勿反复调 test。

本章内容在第五章 **Transformer** 会全部复现：QKV 是 Attention，FFN 是 MLP，Pre-LN 是 LayerNorm。掌握本章 = 读 GPT 论文的最低门槛。完成 MNIST 或 XOR 小实验（CPU 即可）再进入下一章，手感差异很大。

## 术语对照（中英）

Neuron/Unit 神经元；Activation 激活函数；Hidden layer 隐藏层；Logit 预激活 $z$；Embedding 把离散 id 映射为连续向量；Epoch 全数据扫一遍；Iteration/Step 一个 batch 更新一次；Learning rate 学习率 $\eta$；Weight decay 权重衰减（L2 或 AdamW）；Fine-tune 微调预训练权重。读英文文档时这些词与中文教材一一对应，避免混用「单元/神经元/节点」造成概念漂移。

## 算力与显存（复习）

参数量 $P$ 个 float32 权重约占 **$4P$ 字节**。训练显存粗估：**权重 + 梯度 + 优化器状态**（Adam 约 **$3\times$** 权重）+ **激活**（与 batch、序列长度、层数成正比）。推理 mainly **权重 + KV cache**（生成式 LLM）。先会估算 $P$ 和一次 forward 的 FLOPs，再读第九章 GPU 与第七章分布式，数字才能对齐。

下一篇链接在文末 **小结** 中；建议按 `meta.json` 顺序阅读，跳读易漏掉「RNN 消失 → LSTM → Attention」这条叙事链。遇到公式卡住，回第二章查 [链式法则](/manual/llm/bit-to-agi/02-math/chain-rule) 与 [softmax](/manual/llm/bit-to-agi/02-math/softmax-and-logits)。

## 小结

ReLU 胜在：**正区间梯度为 1**、**计算极简**、**天然稀疏**。它是 2010 年代 CV/NLP 深度化的默认非线性；Transformer 时代 GELU 接棒，但 ReLU 仍是理解现代激活函数的基准。

→ 下一篇：[Sigmoid 为什么失败](/manual/llm/bit-to-agi/04-neural-networks/why-sigmoid-fails)
