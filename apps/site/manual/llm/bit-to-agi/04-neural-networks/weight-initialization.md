---
title: "权重初始化"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · 权重初始化"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/weight-initialization"
---

# 权重初始化

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · 权重初始化

训练从随机权重开始。初始化太大 → 激活与梯度爆炸；太小 → 信号消失、ReLU 大面积死亡。Xavier 与 He 初始化按层宽调整方差，让前向激活与反向梯度的尺度在层间大致稳定——深度网络能训起来的第一步。

## 直觉

十人传话：第一人用正常音量，若规则是「每人音量 ×2」或「×0.1」，队尾要么听不见要么爆音。初始化就是设定「第一嗓门的合理音量」，使每层期望上**既不放大也不缩小**太多。

## 定义

**Xavier / Glorot（2010）**：适用于 tanh、sigmoid，假设线性区：

$$
W \sim \mathcal{U}\!\left[-\sqrt{\frac{6}{n_{\text{in}} + n_{\text{out}}}},\ \sqrt{\frac{6}{n_{\text{in}} + n_{\text{out}}}}\right]
\quad \text{或} \quad
W \sim \mathcal{N}\!\left(0,\ \frac{2}{n_{\text{in}} + n_{\text{out}}}\right)
$$

**He / Kaiming（2015）**：适用于 ReLU（负半轴归零，方差减半）：

$$
W \sim \mathcal{N}\!\left(0,\ \frac{2}{n_{\text{in}}}\right)
$$

偏置通常初始化为 **0**（BatchNorm 的 $\beta$ 除外）。

## 例子

**例 1：错误初始化 — 全零**

```python
import numpy as np

W = np.zeros((512, 512))  # 所有神经元相同 → 对称性永不破
```

反向传播给出相同梯度 → 每行权重永远相同 → **对称性陷阱**。

**例 2：He 初始化数值**

$n_{\text{in}} = 512$：$\mathrm{Var}(W_{ij}) = 2/512 \approx 0.00391$，标准差 $\approx 0.0625$。

```python
import numpy as np

n_in, n_out = 512, 512
W_he = np.random.randn(n_out, n_in) * np.sqrt(2.0 / n_in)
print(f"empirical std: {W_he.std():.4f}, theory: {np.sqrt(2/n_in):.4f}")
```

**例 3：100 层 ReLU MLP 激活方差**

| 初始化 | 每层后 $\mathrm{Var}(h)$ 趋势 |
| ------ | ------------------------------- |
| $\mathcal{N}(0, 1)$ | 指数增长 → 爆炸 |
| $\mathcal{N}(0, 1/n)$ | 大致稳定 |
| He $\mathcal{N}(0, 2/n)$ | ReLU 下更稳 |

### 自己拖一下

这张表只有「指数增长 / 大致稳定 / 更稳」三个词，一个数字都没有。而「分布 × 深度」本身是二维的——下面把每一层激活值的直方图横向铺开，你会直接看见它塌缩、爆炸还是稳定：

<WeightInit />

切「N(0,1)」：std 每层翻十几倍，几层就冲到 10⁹。切「N(0,1/n)」：每层砍半，几层缩成一根针。切「He √(2/n)」：那个 **2** 正好补偿 ReLU 砍掉的负半边，std 稳稳停在 1 附近。再关掉 ReLU 对比——纯线性时反而是 1/n 对、He 偏大：**初始化和激活函数必须配对**，这才是「谱尺度接近 1」那句话的实际含义。

**例 4：Linear 层 PyTorch 默认**

`nn.Linear` 默认 $W \sim \mathcal{U}(-\frac{1}{\sqrt{n_{\text{in}}}}, \frac{1}{\sqrt{n_{\text{in}}}})$ — 接近 Xavier 量级。

## 量化

- **GPT 类大模型**：Embedding 与输出层有时特殊初始化；Transformer 常用 $\mathcal{N}(0, 0.02)$ 或小方差 + LayerNorm
- **深度 $L=100$**：He + ResNet 结构可训；裸 MLP + 差初始化常第一步 loss 就 NaN
- **参数量不变**：初始化只影响起点，不增加 FLOPs；但差初始化 = 多训 **10×+** epoch

::: info

残差连接 $y = x + F(x)$ 让梯度有「+1 直通路径」，初始化压力减轻——ResNet 能训 1000 层与此有关（见[从感知机到深度网络](/manual/llm/bit-to-agi/04-neural-networks/from-perceptron-to-deep)）。

:::

## 常见误区

1. **「He 用于所有层」**——输出层、Embedding 可能单独处理；LSTM 有专用初始化。
2. **「初始化越大越好探索」**——大 = 饱和 = 梯度小。
3. **「预训练权重 = 最好初始化」**——微调时 true；从头训仍要合理 random。

## 动手试一试

比较不同 init 下 10 层 ReLU 的输出范数：

```python
import numpy as np

def forward_norm(n_in, n_layers, scale):
    h = np.random.randn(1, n_in)
    for _ in range(n_layers):
        W = np.random.randn(n_in, n_in) * scale
        h = np.maximum(0, h @ W)
    return np.linalg.norm(h)

n_in, L = 256, 10
for name, scale in [("too large", 1.0), ("1/sqrt(n)", 1/n_in**0.5), ("He", (2/n_in)**0.5)]:
    norms = [forward_norm(n_in, L, scale) for _ in range(100)]
    print(f"{name:12s} avg norm={np.mean(norms):.2e}")
```

## Embedding 与输出层权重 tying

语言模型常把 **token embedding** 矩阵与 **输出 softmax 权重** 绑定（weight tying）：同一矩阵 $E \in \mathbb{R}^{V \times d}$ 既 embed 又 project logits。参数量省 **$V \times d$**（$V=50257, d=768$ → 约 **38M**）。初始化时 $E$ 方差常用 $\mathcal{N}(0, 1/d)$ 或与 Transformer 论文一致的 0.02。

## 大模型里的特殊做法

- **GPT-2**：残差投影、LayerNorm 附近小初始化
- **Megatron-LM**：按层深度缩放某些层 init
- **零初始化最后一层**（部分 RL 价值头）：保证初始策略接近均匀

初始化错误的大模型表现：loss 第一步 **flat 或 NaN**，而非缓慢下降——看 loss 曲线可快速判断。

## 特殊层的初始化

**Bias**：默认 0；**LSTM forget gate bias** 常初始化为 **1**（鼓励早期记住信息）。**BatchNorm $\gamma$** 初始 1、**$\beta$** 初始 0。

**输出层**：分类头有时 **小随机或零** 初始化，使初始 logits 接近 0、softmax 接近均匀——训练初期稳定。

**深度 Transformer**：GPT-2 用 $\mathcal{N}(0, 0.02)$ 初始化部分权重；残差路径上的输出投影有时 **缩小**（如除以 $\sqrt{2L}$）防深层激活爆炸——与 He 精神类似，按 **有效深度** 缩放。

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

初始化是训练曲线的「第一推动力」：同样的架构，He 初始化可能平稳下降，过大随机初始化第一步就 NaN。

## 小结

权重初始化控制**信号与梯度的初始尺度**；ReLU 用 He，tanh/sigmoid 用 Xavier。零初始化破坏对称；过大过小都训不动——与激活函数、归一化配合才是完整配方。

→ 下一篇：[批归一化是什么](/manual/llm/bit-to-agi/04-neural-networks/batch-normalization)
