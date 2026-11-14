---
title: "过拟合与正则化"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · 过拟合与正则化"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/overfitting-and-regularization"
---

# 过拟合与正则化

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · 过拟合与正则化

过拟合（Overfitting）是模型把训练集噪声也学进去了：训练损失很低，验证损失却升高。正则化（Regularization）是一族约束，让模型「更简单」或「更平滑」，从而在新数据上更好。深度网络参数远多于样本时，过拟合是默认风险——必须主动治理。

## 直觉

学生背下 100 道原题答案，大考换数字就不会——**记忆 ≠ 理解**。正则化像开卷范围限制、答题字数上限、或老师要求「用通用公式」：牺牲一点训练集分数，换验证集稳定。

## 定义

目标从纯损失变为：

$$
\mathcal{J}(\theta) = L(\theta) + \lambda \cdot \Omega(\theta)
$$

常见 $\Omega$：

- **L2（权重衰减）**：$\Omega = \|\theta\|_2^2$，更新时 $\theta \leftarrow \theta - \eta(\nabla L + 2\lambda\theta)$
- **L1**：$\Omega = \|\theta\|_1$，促稀疏
- **Dropout**：隐式集成（见[Dropout](/manual/llm/bit-to-agi/04-neural-networks/dropout)）
- **Early stopping**：验证 loss 不再降就停

**偏差-方差权衡**：模型太简单 → 欠拟合（高偏差）；太复杂 → 过拟合（高方差）。

## 例子

**例 1：多项式拟合 5 个点**

真函数近似线性，却用 9 次多项式：训练 MSE ≈ 0，测试 MSE 巨大。换 1 次多项式 + L2：训练 MSE 略升，测试 MSE 降。

**例 2：L2 数值**

```python
import numpy as np

W = np.array([3.0, -4.0, 0.5])
lambda_l2 = 0.01
L2_penalty = lambda_l2 * (W ** 2).sum()
print(f"L2 penalty = {L2_penalty:.4f}")  # 0.2525

# 梯度项 2*lambda*W 加到 dL/dW
grad_reg = 2 * lambda_l2 * W
print(f"reg grad = {grad_reg}")
```

**例 3：训练/验证曲线识别**

| 现象 | 训练 loss | 验证 loss | 诊断 |
| ---- | --------- | --------- | ---- |
| 健康 | ↓ | ↓ | 正常学习 |
| 过拟合 | ↓↓ | ↑ 或持平 | 加正则/数据 |
| 欠拟合 | 高 | 高 | 加大模型/lr |

**例 4：MNIST 小样本实验**

只用 1000 张训练：无正则 CNN 验证 **~85%**；+ Dropout0.5 + L2(1e-4) → **~92%**（示意量级）。

## 量化

- **参数量 / 样本量之比**：GPT 级模型参数 $10^{11}$，高质量 token $10^{12+}$ — 预训练靠**海量数据**作正则
- **典型 L2**：$\lambda = 10^{-4} \sim 10^{-2}$（AdamW 把 decay 与梯度解耦）
- **Early stopping patience**：5～20 epoch 无改善即停，省 **20～50%** 训练算力
- **数据增强**：图像翻转/裁剪 ≈ **10×** 有效样本（免费正则）

::: info

**双重 descent**：宽网络训练 late phase 验证误差可能再降——经典 U 形曲线不是全部真相；但 early stopping 仍实用。

:::

## 常见误区

1. **「训练 accuracy 100% 就好」**——先看验证集；memorization 无泛化价值。
2. **「正则越大越好」**——过大欠拟合；$\lambda$ 要调。
3. **「大模型不会过拟合」**——会；微调小任务时尤其明显（见 LoRA、小 lr）。

## 动手试一试

```python
import numpy as np

np.random.seed(0)
X = np.linspace(0, 1, 8)
y = 2 * X + 1 + np.random.randn(8) * 0.1

# 高阶多项式系数（正规方程 + L2 简化演示）
degree = 7
V = np.vander(X, degree + 1)
lambda_l2 = 0.1
I = np.eye(V.shape[1])
I[0, 0] = 0  # 通常不正则化偏置
W = np.linalg.solve(V.T @ V + lambda_l2 * I, V.T @ y)
train_mse = ((V @ W - y) ** 2).mean()
X_test = np.linspace(0, 1, 50)
V_test = np.vander(X_test, degree + 1)
y_true = 2 * X_test + 1
test_mse = ((V_test @ W - y_true) ** 2).mean()
print(f"train MSE={train_mse:.4f}, test MSE={test_mse:.4f}")
```

## 验证集与超参搜索

**Train / Val / Test** 三分：调 hyperparameter 只看 val；test **只用一次** 报最终数字。K-fold 交叉验证在小表格数据上常用；大模型训练太贵，通常固定 val split（如 1% token）。

常用正则组合拳：

```text
weight_decay=0.1 (AdamW) + dropout=0.1 + label_smoothing=0.1 + early_stop
```

## 容量与数据量经验

Ng 的粗略规则：若 train/val gap 大 → **过拟合** → 加数据或正则；若 train 也高 → **欠拟合** → 加大模型或训更久。LLM 预训练 train loss 持续降、下游 task 升——**scaling** 部分替代经典正则。

## 噪声标签与鲁棒损失

标签有错时，CE 会强行 memorization。**Label smoothing**、**GCE**（Generalized CE）降低对噪声的敏感度；数据清洗（第十章）往往比换损失更有效。

## 偏差-方差与模型容量

**偏差**高：模型太简单，train/val 都差——加层、加宽、训更久。**方差**高：train 好 val 差——Dropout、数据增强、小模型、早停。

**双重 descent**：宽网络参数越过「插值阈值」后 val 可能再降——经典 U 形不是全部真相，但 **早停** 仍是廉价有效正则。

**数据 > 正则**（大模型语境）：GPT-3 不靠 heavy Dropout，靠 **300B token**；小任务微调 1k 样本则必须 **wd + early stop + 小 lr** 防 memorization。

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

过拟合 = 训练好、验证差；正则化通过惩罚复杂度、随机失活、早停、增数据来换泛化。训练 LLM 时数据规模是第一正则；微调时 L2/Dropout/早停仍关键。

→ 下一篇：[损失函数家族](/manual/llm/bit-to-agi/04-neural-networks/loss-functions)
