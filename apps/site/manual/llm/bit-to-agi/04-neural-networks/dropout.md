---
title: "Dropout 是什么"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · Dropout 是什么"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/dropout"
---

# Dropout 是什么

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · Dropout 是什么

Dropout（2012）在训练时以概率 $p$ 随机把神经元输出置零，迫使网络不依赖少数「明星神经元」，等价于训练指数级规模的子网络集成。推理时关闭 Dropout（或乘以保留概率 $1-p$），用完整网络做预测。

## 直觉

团队项目随机缺席一半同事——你必须学会多人协作、不能指望某一个人扛全部。每次训练 step 换一批「缺席名单」，最终全员上场时，能力更均衡、泛化更好。

## 定义

训练时，对层输出 $\mathbf{h}$：

$$
\mathbf{m} \sim \mathrm{Bernoulli}(1-p), \quad \mathbf{h}' = \mathbf{m} \odot \mathbf{h} \ / \ (1-p) \quad \text{（inverted dropout）}
$$

除以 $(1-p)$ 保持期望不变：$\mathbb{E}[\mathbf{h}'] = \mathbf{h}$。

推理：$\mathbf{h}' = \mathbf{h}$（mask 全 1）。

常见 $p = 0.5$（隐藏层），输入层 $p = 0.2$，输出层通常 **不用** Dropout。

## 例子

**例 1：单神经元期望**

$h = 4$，$p = 0.5$：训练时 50% 为 0、50% 为 $4/(1-0.5)=8$？不对——inverted：mask 0 则 0，mask 1 则 $4/0.5=8$… 标准实现：$h' = m \cdot h / (1-p)$，$\mathbb{E}[m]=1-p$ → $\mathbb{E}[h'] = h$。

```python
import numpy as np

h = np.array([4.0, 4.0, 4.0, 4.0])
p = 0.5
outs = []
for _ in range(10000):
    m = (np.random.rand(4) > p).astype(float)
    outs.append((m * h / (1 - p)).mean())
print(f"E[mean(h')]={np.mean(outs):.2f}")  # ≈ 4.0
```

**例 2：AlexNet 配置**

两个 FC 隐藏层各 **p=0.5** Dropout；配合 ReLU + BN 前时代数据增强，ImageNet top-5 显著提升。

**例 3：与 L2 正则对比**

| 方法 | 机制 | 主要作用 |
| ---- | ---- | -------- |
| Dropout | 随机结构噪声 | 防共适应 |
| L2 | 惩罚大权重 | 权值 shrink |
| 数据增强 | 输入扰动 | 扩增分布 |

## 量化

- **训练 FLOPs**：mask 几乎免费；有效宽度 $(1-p)d$，如 $p=0.5, d=4096$ → 期望 active **2048** 维
- **大模型预训练**：Dropout 常 **0～0.1** 或不用（数据够大）；微调小数据集可加大
- **Transformer**：attention dropout、residual dropout 典型 **0.1**；GPT-3 论文 $p=0.1$
- **推理**：无 Dropout → 确定性；与 MC Dropout（不确定性估计）不同

::: warning

训练和推理行为不一致是设计如此。部署务必 `model.eval()`（PyTorch）关闭 Dropout/BN 训练模式。

:::

## 常见误区

1. **「Dropout 越高越好」**——$p$ 过大欠拟合；0.5 非 universal。
2. **「推理时要乘 (1-p)」**——inverted dropout 训练已缩放；推理直接过网络。
3. **「Dropout 取代大数据」**——正则补充，不替代数据量。

## 动手试一试

```python
import numpy as np

def dropout(h, p=0.5, training=True):
    if not training:
        return h
    mask = (np.random.rand(*h.shape) > p).astype(h.dtype)
    return h * mask / (1 - p)

h = np.ones((1000, 512))
train_out = dropout(h, p=0.5, training=True)
eval_out = dropout(h, p=0.5, training=False)
print(train_out.mean(), eval_out.mean())  # train ≈1（期望）, eval=1
print((train_out == 0).mean())            # ≈0.5
```

## DropConnect 与 Dropout 区别

**DropConnect** 随机置零**权重**而非激活；**Dropout** 置零**神经元输出**。Dropout 更常用；DropConnect 在某些 CNN 上有类似正则效果。

## 与 BatchNorm 的交互

早期建议 Dropout 放在 BN **之后**；现代架构（ResNet、Transformer）常 **BN/LN → 激活 → Dropout** 或只在 attention/FFN 子层末 Dropout。两者都带噪声，同时高 rate 可能欠拟合。

## MC Dropout 不确定性

推理时**保持 Dropout 开启**、多次采样取平均或方差，可估 **epistemic uncertainty**——医疗、自动驾驶等需「模型有多确定」的场景。与标准推理 `eval()` 关闭 Dropout 是不同模式。

## 历史：Hinton 的「集成」解释

Hinton 2012 原始论文将 Dropout 解释为 **指数级子网络的 bagging**：每次 mask 对应不同子架构，推理时用完整网络近似所有子网络的几何平均。虽不完全严格，但解释了为何 Dropout 提升泛化而非仅加噪声。

ImageNet 上 AlexNet 全连接层 Dropout 0.5 配合 ReLU，是深度学习第一次大规模公开 triumph 的配方之一——与 [ReLU](/manual/llm/bit-to-agi/04-neural-networks/why-relu-wins)、[数据增强](/manual/llm/bit-to-agi/04-neural-networks/overfitting-and-regularization) 并列。

## Dropout rate 怎么选

经验起点：全连接隐藏层 **0.5**；输入层 **0.2**；卷积层有时 **0.1** 或不用（空间相关性强，drop 整 feature map 用 DropBlock）。Transformer **0.1** 是常见默认；过大导致 underfit。

**Spatial Dropout**：整 channel 置零，适合 CNN。 **DropPath**（Stochastic Depth）：整残差分支随机跳过，ResNet/ ViT 训练深层时用——与 Dropout 同族「随机结构正则」。

微调小数据集时可在分类头上加大 Dropout；预训练大模型继续预训练时 often 降低或关闭 Dropout，靠数据量正则。

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

Dropout = 训练时随机失活 + 期望保持；推理关闭。防过拟合的经典手段，与 BN、权重衰减并用。LLM 时代 rate 降低，但思想（随机深度、Stochastic Depth）仍在。

→ 下一篇：[过拟合与正则化](/manual/llm/bit-to-agi/04-neural-networks/overfitting-and-regularization)
