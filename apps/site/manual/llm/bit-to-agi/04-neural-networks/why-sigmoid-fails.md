---
title: "Sigmoid 为什么失败"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · Sigmoid 为什么失败"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/why-sigmoid-fails"
---

# Sigmoid 为什么失败

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · Sigmoid 为什么失败

Sigmoid 把任意实数压到 $(0,1)$，看起来像概率，曾是神经网络标配。但在深层网络里，它同时带来**梯度消失**、**输出非零中心**和**计算昂贵**三重问题——不是「完全不能用」，而是被 ReLU 等替代成为隐藏层默认。

## 直觉

把声音通过一条极其灵敏的压缩器：轻声听不清，大声全削顶，中间一小段才听得清。Sigmoid 在 $|z|>2$ 时输出已接近 0 或 1，再大的输入变化也几乎不改变输出——反向传播时「听不见」上游该怎么调。

早期单层感知机用 sigmoid 做二分类很自然；堆到 10 层以上，误差信号像传话游戏，传到第一层时已面目全非。

## 定义

$$
\sigma(z) = \frac{1}{1 + e^{-z}}
$$

导数有简洁形式：

$$
\sigma'(z) = \sigma(z)\,(1 - \sigma(z))
$$

**关键事实**：$\sigma'(z)$ 在 $z=0$ 处最大为 **0.25**；当 $|z|$ 较大时 $\sigma'(z) \to 0$。

| $z$   | $\sigma(z)$ | $\sigma'(z)$ |
| ----- | ----------- | ------------ |
| 0     | 0.500       | **0.250**    |
| 2     | 0.881       | 0.105        |
| 4     | 0.982       | 0.018        |
| −4    | 0.018       | 0.018        |

## 例子

**例 1：10 层 sigmoid 的梯度乘积**

若每层导数平均取 0.25：

$$
\prod_{l=1}^{10} 0.25 \approx 9.5 \times 10^{-7}
$$

若平均 0.1（饱和区常见）：

$$
0.1^{10} = 10^{-10}
$$

第一层权重几乎收不到有效更新——**梯度消失**。

### 自己拖一下

上面两个数（$0.25^{10}$、$0.1^{10}$）是两个**挑好的点**，而真正该有的手感是**点与点之间**。把 γ 拖到 0.99 附近再左右微调——你会撞上一道刀锋：

<PowerChain />

**这一件东西在这个专栏里出现了四次**：这里的 $\sigma'^L$、[第 2 章的谱半径 $\rho(A)^t$](/manual/llm/bit-to-agi/02-math/eigenvalues-intuition)、[链式法则的雅可比连乘](/manual/llm/bit-to-agi/02-math/chain-rule)、[梯度下降的收敛因子 $|1-\eta\lambda|^t$](/manual/llm/bit-to-agi/02-math/why-loss-can-descend)。四个符号，一个数学：**把一个数乘 L 次**。看懂这一个，那四处就都通了。

**例 2：非零中心拖慢收敛**

Sigmoid 输出恒正 $(0,1)$。下一层输入全为正时，权重梯度 $\frac{\partial L}{\partial w_i} = \frac{\partial L}{\partial z} \cdot x_i$ 的符号只由 $\frac{\partial L}{\partial z}$ 决定，更新方向受限（zig-zag）。Tanh 输出 $(-1,1)$ 零中心更好；ReLU 正半轴仍非零中心，但梯度简单。

**例 3：数值代码**

```python
import numpy as np

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

def sigmoid_grad(z):
    s = sigmoid(z)
    return s * (1 - s)

z = np.linspace(-6, 6, 13)
for zi in z:
    print(f"z={zi:5.1f}  σ={sigmoid(zi):.4f}  σ'={sigmoid_grad(zi):.4f}")
```

**例 4：Sigmoid 仍适用之处**

- **二分类输出层**：单个 logit 过 sigmoid 得 $P(y=1)$
- **门控机制**：LSTM 的 forget/input/output gate（0～1 开关）
- **浅层逻辑**：2～3 层小网络、教学演示

## 量化

- 单次 sigmoid：1 次 exp、1 次除法 ≈ **~10 FLOPs**（实现相关）；ReLU ≈ **1 FLOP**
- 隐藏层 $d=4096, B=32$：约 131K 次 sigmoid/层/步 → 相对 ReLU 多 **~1M FLOPs/层**
- 梯度上界 0.25 → $L$ 层网络梯度上界 **$0.25^L$**（极悲观界，说明饱和危害）

::: warning

「失败」指**作深层隐藏层激活**失败。把 sigmoid 当输出层或门控，仍是标准做法——别一刀切抛弃。

:::

## 常见误区

1. **「Sigmoid 输出是概率所以更正确」**——只是形状像概率；校准需额外处理（temperature scaling 等）。
2. **「用 sigmoid 就不会溢出」**——$e^{-z}$ 在 $z$ 极大时仍可能上溢/下溢；实现用 `np.clip` 或 stable sigmoid。
3. **「换成 ReLU 就万事大吉」**——还有初始化、归一化、学习率；ReLU 解决的是 sigmoid 最大痛点之一。

## 动手试一试

Stable sigmoid 与梯度饱和可视化：

```python
import numpy as np

def stable_sigmoid(z):
    pos = np.exp(-np.clip(z, None, 0))
    neg = np.exp(np.clip(z, 0, None))
    return np.where(z >= 0, 1 / (1 + neg), pos / (1 + pos))

z = np.array([-10.0, -2.0, 0.0, 2.0, 10.0])
s = stable_sigmoid(z)
g = s * (1 - s)
print(list(zip(z, s.round(4), g.round(4))))
# z=±10 时 σ≈0 或 1，σ'≈0
```

## 与 Tanh 的对比

Tanh 输出 $(-1,1)$、零中心，梯度在 $z=0$ 处最大为 **1.0**（优于 sigmoid 的 0.25）。LSTM 的细胞状态与 RNN 隐藏态常用 tanh。但 tanh 两端仍饱和，深层堆叠同样会衰减；且 exp 计算不便宜。

| 激活 | $f'(0)$ | 零中心 | 深层隐藏层 |
| ---- | ------- | ------ | ---------- |
| Sigmoid | 0.25 | 否 | 不推荐 |
| Tanh | 1.0 | 是 | 浅 RNN 可用 |
| ReLU | 1.0（$z>0$） | 否 | 推荐 |

## 数值稳定实现

生产代码从不裸写 `1/(1+exp(-z))`：

```python
def stable_sigmoid(z):
    return np.where(z >= 0,
                    1 / (1 + np.exp(-z)),
                    np.exp(z) / (1 + np.exp(z)))
```

对 $|z|>20$，$\sigma(z)$ 已 float32 下溢为 0 或上溢为 1，梯度为 0——**float32 与饱和叠加** 是训练 NaN 的常见来源之一。

## BCEWithLogitsLoss 实践

PyTorch 推荐 **不要** 先 sigmoid 再 BCE，而用 `binary_cross_entropy_with_logits`——内部 stable 组合，避免 $\log(0)$。多类同理 `cross_entropy` 融合 softmax。

**类不平衡 BCE**：`pos_weight` 放大正类梯度；欺诈检测 pos_weight 可达 **100+**。

Sigmoid **饱和区样本** 梯度 $\approx 0$——hard example mining、Focal Loss 等试图让训练关注 **仍被判错** 的样本，而非已 confidently correct 的易样本。

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

Sigmoid 在深层隐藏层的「失败」= **梯度饱和（max 0.25）+ 非零中心 + 慢**。输出层与门控仍常用；隐藏层请用 ReLU/GELU。理解 sigmoid 的缺陷，才能明白 2012 年后架构为何集体换代。

→ 下一篇：[MLP 是什么](/manual/llm/bit-to-agi/04-neural-networks/what-is-mlp)
