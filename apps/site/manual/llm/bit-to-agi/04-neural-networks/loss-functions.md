---
title: "损失函数家族"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · 损失函数家族"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/loss-functions"
---

# 损失函数家族

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · 损失函数家族

损失函数 $L(\hat{y}, y)$ 量化「预测有多错」，是优化的目标。分类用交叉熵，回归用 MSE，语言模型用下一个 token 的 CE——选对损失，梯度才指向正确方向。本章汇总神经网络最常见的几个成员。

## 直觉

GPS 导航需要「离目的地多远」的标量：走错路要罚分，罚分规则决定司机会怎么改道。损失就是 ML 的罚分规则；不同任务用不同尺子（平方误差 vs 对数概率）。

## 定义

**均方误差（MSE）**：

$$
L_{\text{MSE}} = \frac{1}{n}\sum_{i=1}^{n}( \hat{y}_i - y_i )^2, \quad
\frac{\partial L}{\partial \hat{y}_i} = \frac{2}{n}(\hat{y}_i - y_i)
$$

**二元交叉熵（BCE）**，$\hat{y}=\sigma(z)$：

$$
L_{\text{BCE}} = -\big[y\log\hat{y} + (1-y)\log(1-\hat{y})\big]
$$

**交叉熵（多类）**，$\hat{\mathbf{p}}=\mathrm{softmax}(\mathbf{z})$：

$$
L_{\text{CE}} = -\sum_{c=1}^{C} y_c \log \hat{p}_c
$$

one-hot 真类 $t$ 时：$L_{\text{CE}} = -\log \hat{p}_t$。

**Hinge（SVM 风格）**：$L = \max(0, 1 - y \cdot f(x))$，$y \in \{-1,+1\}$。

## 例子

**例 1：MSE 手算**

$\hat{y}=1.1, y=3$：$L = (1.1-3)^2 = 3.61$，$\partial L/\partial \hat{y} = 2(1.1-3) = -3.8$。

**例 2：CE 与错误置信度**

三类 logits $\mathbf{z}=[2,1,0]$，真类 0：

```python
import numpy as np

def softmax(z):
    e = np.exp(z - z.max())
    return e / e.sum()

z = np.array([2.0, 1.0, 0.0])
p = softmax(z)
loss = -np.log(p[0])
print(f"p={p.round(3)}, CE={loss:.3f}")  # p≈[0.665,...], CE≈0.408

z_wrong = np.array([0.0, 1.0, 2.0])  # 模型偏类 2
p2 = softmax(z_wrong)
print(f"wrong class CE={-np.log(p2[0]):.3f}")  # 更大惩罚
```

**例 3：BCE 数值稳定**

用 `log_sigmoid` 合并：`loss = max(z,0) - z*y + log(1+exp(-|z|))`（PyTorch `binary_cross_entropy_with_logits`）。

**例 4：LLM 损失**

序列 $w_1,\ldots,w_T$：

$$
L = -\frac{1}{T-1}\sum_{t=1}^{T-1} \log P(w_{t+1} \mid w_{\le t})
$$

GPT-3 175B 在 300B token 上最小化此项；单 token CE ≈ **2.0～3.0 nats**（视数据）。

| 任务 | 常用损失 | 输出层 |
| ---- | -------- | ------ |
| 回归 | MSE / MAE | 线性 |
| 二分类 | BCE | sigmoid |
| 多分类 | CE | softmax |
| LM | token CE | softmax over vocab |

## 量化

- **CE 下界**：随机猜 $C$ 类 → $L \geq \log C$；ImageNet 1000 类 → $\log 1000 \approx 6.9$
- **Perplexity**：$ \mathrm{PPL} = e^{L}$；CE=3 → PPL≈**20**（平均「等价于 20 选一」）
- **Focal Loss**：$(1-p_t)^\gamma \cdot \text{CE}$，难样本加权；目标检测常用
- **Label smoothing**：真类目标 $1-\epsilon$，其余 $\epsilon/C$；防 overconfident，Imagenet +0.2～0.5% acc

::: info

MSE 假设高斯噪声；分类用 CE 等价于最大似然（Bernoulli/Categorical）。损失选择 = 概率假设 + 方便梯度。

:::

## 常见误区

1. **「CE 和 MSE 可互换」**——分类 + MSE 梯度饱和、效率差；别混用。
2. **「loss 越低模型越好」**——需验证集；train CE 可 memorization。
3. **「softmax 再算 CE 要分开」**——`cross_entropy` 融合数值更稳。

## 动手试一试

```python
import numpy as np

def ce_grad_logits(z, target):
    p = softmax(z)
    grad = p.copy()
    grad[target] -= 1
    return grad, -np.log(p[target])

z = np.array([1.0, 2.0, 3.0])
g, loss = ce_grad_logits(z, target=2)
print(f"loss={loss:.3f}, grad={g.round(3)}")  # grad 对类2 为 p-1
```

## 多任务与对比损失（拓展）

**Multi-task loss**：$L = \lambda_1 L_{\text{cls}} + \lambda_2 L_{\text{reg}}$，权重需调。

**Contrastive / Triplet loss**：拉近正样本 embedding、推远负样本——CLIP、人脸验证常用，形式不同于 CE 但仍是「可微目标」。

**RLHF** 中的 loss 更复杂（policy gradient + KL penalty），第七章专讲；底层仍是对 logits 或 reward 的可微/半可微优化。

## 从 CE 到 Bits（与第三章衔接）

平均 CE（nats）= 模型对每 token 的**平均 surprise**。压缩 $N$ 个 token、词表 $V$：

$$
\text{总 bits} \approx N \cdot L_{\text{CE}} / \ln 2
$$

CE = 3.0 nats → 每 token 约 **4.3 bits**；1000 token 生成 ≈ **4300 bits** 信息量（在模型分布意义下）。

## 分类损失梯度详解

多类 CE 对 logit $z_c$ 的梯度：$\partial L / \partial z_c = \hat{p}_c - y_c$。one-hot 真类 $t$ 时，真类梯度 $\hat{p}_t - 1$（恒负，除非 $\hat{p}_t=1$），其余类梯度 $\hat{p}_c$（恒正）——**softmax + CE 组合** 自动把概率 mass 推向真类。

```python
import numpy as np

def softmax(z):
    e = np.exp(z - z.max())
    return e / e.sum()

z = np.array([2.0, 1.0, 0.1])
p = softmax(z)
target = 0
grad = p.copy()
grad[target] -= 1
print(f"p={p.round(3)}, grad={grad.round(3)}")
# 真类 grad≈p-1<0 → 增大 z_0 可降 loss
```

**MAE vs MSE**：MAE 梯度恒为 $\pm 1$，对离群点鲁棒；MSE 梯度 $\propto$ 误差，大误差主导更新。金融预测、鲁棒回归有时用 Huber（二者折中）。

## 不平衡分类与 Focal Loss

类别极度不平衡（欺诈检测 0.1% 正样本）时，CE 被多数类主导。**Class weight** $w_c \propto 1/n_c$ 加权 CE；**Focal Loss** $(1-p_t)^\gamma \log p_t$ 降易样本权重，$\gamma=2$ 常用。

**回归 robust loss**：Huber $\delta$ 内 MSE、外 MAE；分位数损失学 median 而非 mean——对长尾误差更稳。

语言模型 **label smoothing** $\epsilon=0.1$：目标分布 $(1-\epsilon)\delta_t + \epsilon/V$，防 logits 无限放大、改善 calibration；GPT 类训练常开。

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

多任务学习时各损失的 $\lambda$ 权重比选哪个损失函数本身更难，常靠验证集网格搜索。

本章各篇互有引用，建议开侧边栏按顺序阅读，形成完整知识链。

Huber 与 Smooth L1 是同一族，在目标检测 bbox 回归里常用。

分类任务默认从交叉熵与 softmax 配对开始，不要对 logits 直接做 MSE。

回归多输出时对每个维度独立算 MSE 再求平均即可。

## 小结

损失函数把任务目标变成可微标量：回归 MSE、分类 CE/BCE、LM 序列 CE。理解形式与梯度，才能选对输出层、解释训练曲线与 perplexity。

→ 下一篇：[优化器：SGD 与 Adam](/manual/llm/bit-to-agi/04-neural-networks/optimizer-sgd-adam)
