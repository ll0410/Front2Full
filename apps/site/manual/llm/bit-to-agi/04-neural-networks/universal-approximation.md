---
title: "万能近似定理的直觉"
description: "从 Bit 到 AGI · 第四章 · 为什么足够宽的网络理论上能拟合任意连续函数"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/universal-approximation"
---

# 万能近似定理的直觉

> 从 Bit 到 AGI · 第四章 · 为什么足够宽的网络理论上能拟合任意连续函数

「一个隐藏层、足够多神经元，就能近似任意连续函数」——**万能近似定理**（Universal Approximation Theorem）常被误读成「一层就够赢」。本篇讲清定理**到底保证什么**、**不保证什么**，以及和今天「深度」实践的关系。

## 定理在说什么（Cybenko 1989 / Hornik）

设 $f: [0,1]^n \to \mathbb{R}$ 连续。对任意 $\varepsilon > 0$，存在：

- 隐藏层宽度 $N$
- 权重 $w_i \in \mathbb{R}^n$，标量 $b_i, v_i \in \mathbb{R}$
- 激活 $\sigma$ 非常数、有界、单调（如 Sigmoid）

使得对所有 $x$：

$$
\left| f(x) - \sum_{i=1}^{N} v_i\, \sigma(w_i^\top x + b_i) \right| < \varepsilon
$$

**人话**：单隐藏层 [MLP](/manual/llm/bit-to-agi/04-neural-networks/what-is-mlp) 在宽度足够时，可以 **$\varepsilon$-逼近** 紧集上的连续函数。

## 不保证什么（必读）

| 保证 | 不保证 |
| --- | --- |
| 存在这样的网络 | 能用梯度下降**找到**权重 |
| 有限宽度存在（理论 $N$ 可很大） | $N$ 不会指数爆炸 |
| 连续函数 | 不直接覆盖不连续决策边界 |
| 函数逼近 | **泛化**、样本效率、推理速度 |

::: warning

定理是**存在性**，不是**可学习性**。训练集 1 万张图，你仍需要 [正则化](/manual/llm/bit-to-agi/04-neural-networks/overfitting-and-regularization) 与合适 [优化器](/manual/llm/bit-to-agi/04-neural-networks/optimizer-sgd-adam) 才能泛化。

:::

## 量化直觉：宽度要多大？

对某些构造性证明，所需隐藏单元数 $N$ 对输入维度 $n$ 和精度 $\varepsilon$ 可能 **指数级**——即「理论上可以，实际上要天文宽度」。这就是为什么实践用 **深度** 把宽度负担拆成多层：每层学「更简单」的特征组合。

例子：学习 $n$ 维布尔函数「奇偶校验」——浅层网络需要 **指数级** 隐藏单元；深层网络可用 $O(n)$ 层结构表达。

## 深度 vs 宽度

| 策略 | 优点 | 缺点 |
| --- | --- | --- |
| 宽而浅 | 近似定理直接适用 | 参数冗余、难优化 |
| 窄而深 | 参数效率高、层次特征 | 梯度消失/爆炸需技巧 |

现代 LLM：**既深又宽**（$L=80+$，$d=4096+$），靠 [残差](/manual/llm/bit-to-agi/05-transformer/residual-connection)、[LayerNorm](/manual/llm/bit-to-agi/05-transformer/layer-norm)、海量数据与算力。

## 例子：用 ReLU 网络画正弦

```python
import numpy as np
# 单隐藏层 64 单元可拟合 sin(x) on [-pi, pi] 到 ~1e-3 MSE（需训练）
# 宽度 8 往往不够；宽度 256 过剩——说明「存在 N」≠「小 N 够用」
x = np.linspace(-np.pi, np.pi, 200)
y = np.sin(x)
# 训练省略：SGD on MSE，观察 N=8 vs N=64 的拟合曲线
```

实验上：**宽度**决定「能拟合多弯」；**深度**决定「用更少总参数拼复杂函数」。

## 与 AGI 叙事的关系

万能近似说：**表征能力**不是瓶颈（连续函数类）。真正瓶颈在：

1. **数据**（覆盖真实分布）
2. **优化**（找到低损失解）
3. **计算**（[GPU](/manual/llm/bit-to-agi/09-gpu/why-gpu-so-fast)、[推理](/manual/llm/bit-to-agi/08-inference/latency-vs-throughput)）
4. **对齐**（[HHH](/manual/llm/bit-to-agi/07-training/alignment-overview)）

## 构造性证明的代价

经典证明中隐藏单元数 $N$ 对精度 $\varepsilon$ 可能 **$O(\varepsilon^{-n})$** 量级（$n$ 输入维）——**维数灾难**。深度网络用 **层次分解**：低层学边/纹理，高层学部件/对象，每层在低维流形上操作——参数效率更高，虽无同样简洁的 universal 定理。

**Kolmogorov-Arnold 表示**：多元连续函数可表为单变量函数有限叠加——与神经网络形式不同，但共同说明 **非线性组合** 的表达力。

读论文时看到「NN universal」：先问 **width？depth？activation？compact domain？**——四个条件缺一，结论可能不适用于你的 setting。

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

定理给你「神经网络不是表达能力笑话」的数学底气；工程上仍要靠深度、正则、数据和算力。下一篇收束全章：[第四章总结](/manual/llm/bit-to-agi/04-neural-networks/chapter-summary)。
