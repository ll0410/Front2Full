---
title: "批归一化是什么"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · 批归一化是什么"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/batch-normalization"
---

# 批归一化是什么

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · 批归一化是什么

Batch Normalization（BN，2015）在每层激活前，对一个 mini-batch 的每个特征维做「减均值、除标准差」，再学缩放 $\gamma$ 和平移 $\beta$。它缓解内部协变量偏移、允许更大学习率，是 ResNet 时代训练深 CNN 的标配；Transformer 则用 LayerNorm。

## 直觉

每批学生成绩先标准化成「班级 Z 分数」，再允许科目自己定难易系数（$\gamma$）和基准线（$\beta$）。不同 batch 的均值方差会抖，但统计上稳定后，深层收到的输入分布不再随下层权重剧烈漂移。

## 定义

对 mini-batch $\mathcal{B}$，特征维 $j$：

$$
\mu_j = \frac{1}{|\mathcal{B}|}\sum_{i \in \mathcal{B}} x_{ij}, \quad
\sigma_j^2 = \frac{1}{|\mathcal{B}|}\sum_{i \in \mathcal{B}} (x_{ij} - \mu_j)^2
$$

$$
\hat{x}_{ij} = \frac{x_{ij} - \mu_j}{\sqrt{\sigma_j^2 + \epsilon}}, \quad
y_{ij} = \gamma_j \hat{x}_{ij} + \beta_j
$$

推理时用训练期累积的 **running mean/var**，不用当前 batch 统计。

## 例子

**例 1：手算 BN（3 样本，2 维）**

```python
import numpy as np

X = np.array([[1.0, 10.0],
              [2.0, 20.0],
              [3.0, 30.0]])
mu = X.mean(axis=0)           # [2, 20]
var = X.var(axis=0)           # [0.667, 66.67]
X_hat = (X - mu) / np.sqrt(var + 1e-5)
print(X_hat.round(3))
# 每列均值≈0，标准差≈1
```

**例 2：$\gamma, \beta$ 恢复表达能力**

若 $\gamma = \sigma, \beta = \mu$，则 $y = x$——BN 不必然限制表达；可学成恒等。

**例 3：训练 vs 推理**

| 阶段 | 均值/方差来源 | batch size 影响 |
| ---- | ------------- | --------------- |
| 训练 | 当前 batch    | 小 batch 噪声大 |
| 推理 | EMA 累积      | 与 batch 无关   |

batch=1 推理时 BN 行为与训练不一致 → 促生 **LayerNorm**（Transformer 逐样本归一化）。

## 量化

- 每层 BN 额外参数：$2d$（$\gamma, \beta$），$d=2048$ → **4K** float32 ≈ 16 KB
- 计算：每特征维 $O(B)$ 统计 + $O(Bd)$ 变换；相对 conv often **低于 5%** 开销
- ResNet-50 + BN：原论文 batch=256 可训；无 BN 同结构常需更小 lr
- **有效 batch 小**（如 8）时 BN 统计噪声大 → GroupNorm、LayerNorm 替代

::: info

**LayerNorm**：在特征维归一化，不依赖 batch 维 —— LLM 标配。**RMSNorm**：去掉减均值，只除 RMS，略快（Llama 等）。

:::

## 常见误区

1. **「BN = 数据归一化」**——BN 归一化**中间激活**，不是输入像素。
2. **「BN 放在 ReLU 后」**——原论文在 conv/linear **之后、激活之前**（也有 post-activation 变体）。
3. **「BN 消除过拟合」**——有轻微正则效应；主要 stabilizes training。

## 动手试一试

模拟 running stats：

```python
import numpy as np

running_mean = np.zeros(2)
running_var = np.ones(2)
momentum = 0.1

for step in range(5):
    batch = np.random.randn(32, 2) * (step + 1)  # 分布随 step 变
    running_mean = (1 - momentum) * running_mean + momentum * batch.mean(0)
    running_var = (1 - momentum) * running_var + momentum * batch.var(0)
    print(f"step {step}: running_mean≈{running_mean.round(2)}")
```

## Internal Covariate Shift 的争议

原论文称 BN 减少「内部协变量偏移」——中间层输入分布随下层更新而漂移。后续研究认为 BN 的主要效果是 **loss landscape 更平滑**、允许更大 lr；无论机制如何，**实践有效** 是共识。

## SyncBN 与分布式训练

多 GPU 时单卡 batch 小，BN 统计噪声大。**Synchronized BN** 跨卡聚合 mean/var，等效更大 batch。Detection 模型常用；LLM 不用 BN 而 LayerNorm，因序列 batch 内归一化不依赖跨样本统计。

## RMSNorm 与 LayerNorm 公式

**LayerNorm**（对特征维 $d$）：

$$
\hat{x}_i = \frac{x_i - \mu}{\sqrt{\sigma^2 + \epsilon}}, \quad y_i = \gamma_i \hat{x}_i + \beta_i
$$

**RMSNorm**（Llama）：不减均值，只除 RMS $=\sqrt{\frac{1}{d}\sum x_i^2}$——少一次 reduce，略快，精度相当。

## 训练与推理模式切换

`model.train()` 与 `model.eval()` 影响 BN 与 Dropout：BN 用 batch 统计 vs running stats；Dropout 随机 vs 关闭。忘记 `eval()` 是部署 bug 经典来源——同一输入每次预测不同。

PyTorch 检查清单：

```python
model.train()   # 训练循环内
# ... forward, backward, step ...
model.eval()    # 验证 / 推理
with torch.no_grad():
    y = model(x)
```

## 与 LayerNorm 的选型指南

| 场景 | 推荐 | 原因 |
| ---- | ---- | ---- |
| CNN 图像分类 | BatchNorm | 大 batch、空间维统计稳 |
| 检测/分割小 batch | GroupNorm / SyncBN | batch 统计噪声 |
| Transformer / LLM | LayerNorm / RMSNorm | 序列长、batch 内归一化 per token |
| 在线学习 batch=1 | LayerNorm | BN 不可用 |

**Post-LN vs Pre-LN**（Transformer）：Pre-LN（先 norm 再子层）训练更稳，现代默认；Post-LN 原始论文用法。第五章 [LayerNorm](/manual/llm/bit-to-agi/05-transformer/layer-norm) 会展开。

BatchNorm 的 $\gamma, \beta$ 让网络可「撤销」归一化——若某层不需要 BN 效果，可学成 $\gamma \approx \sigma, \beta \approx \mu$ 近似恒等。

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

BatchNorm 论文 2015 年与 ResNet 同年，两者叠加让百层网络成为常规操作而非实验室奇迹。

本章各篇互有引用，建议开侧边栏按顺序阅读，形成完整知识链。

## 小结

BatchNorm = batch 内标准化 + 可学仿射；稳定深层训练、允许更大 lr。CNN 时代 BN；序列/LLM 用 LayerNorm/RMSNorm——思想同源：**控制激活尺度**。

→ 下一篇：[Dropout 是什么](/manual/llm/bit-to-agi/04-neural-networks/dropout)
