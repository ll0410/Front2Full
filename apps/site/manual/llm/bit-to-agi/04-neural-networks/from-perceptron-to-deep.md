---
title: "从感知机到深度网络"
description: "从 Bit 到 AGI · 第四章 · 1958 年感知机到今日千亿参数深度网络的演化脉络"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/from-perceptron-to-deep"
---

# 从感知机到深度网络

> 从 Bit 到 AGI · 第四章 · 1958 年感知机到今日千亿参数深度网络的演化脉络

深度网络不是一夜之间出现的。它从 **单层感知机**（只能切直线）出发，经历「AI 寒冬」、反向传播复兴、ImageNet 时刻，再到 GPU 与大数据把层数推到几十、上百。本篇按时间线串起关键节点，并量化每一代的**能力边界**与**算力代价**。

## 时间线（极简）

| 年代 | 里程碑 | 典型规模 | 能学会什么 |
| --- | --- | --- | --- |
| 1958 | 感知机 | 1 层，$d$ 个权重 | 线性可分问题 |
| 1986 | 反向传播 + 多层 | 2–3 层，数千权重 | XOR、简单分类 |
| 2012 | AlexNet | 8 层，6000 万参数 | ImageNet Top-5 错误 15.3%→革命 |
| 2017+ | Transformer | 亿–千亿参数 | 语言、多模态统一 |

## 感知机：第一个「神经元」

Rosenblatt 感知机：$y = \mathrm{sign}(w^\top x + b)$。权重更新（错误驱动）：

$$
w \leftarrow w + \eta (t - y)\, x
$$

**局限（Minsky 1969）**：无法解 XOR——需要**隐藏层 + 非线性**，即 [MLP](/manual/llm/bit-to-agi/04-neural-networks/what-is-mlp)。

## 反向传播：深度成为可能

1986 年 Rumelhart 等让 [链式法则](/manual/llm/bit-to-agi/02-math/chain-rule) 在多层网络上可算。2 层网络（784→128→10）在 MNIST 上可达 **~98%** 准确率，参数量约 $784\times128 + 128\times10 \approx 10^5$——今天一张 GPU 毫秒级。

## AlexNet：深度 + GPU 的化学反应

2012 年 ImageNet：16.4% 错误（第二名 26%）。关键数字：

- **8 层**（5 卷积 + 3 全连接）
- **6000 万**参数
- **2×GTX 580** 训练约 **5–6 天**

[CNN](/manual/llm/bit-to-agi/04-neural-networks/why-cnn-succeeds) 利用局部连接，把参数量从「全连接灾难」里救出来。

## 深度：多深才算「深」？

经验法则（2010s CV）：

- **低于 3 隐藏层**：浅层网络
- **5–20 层**：深度（ResNet-50 有 50 层概念含 shortcut）
- **>100 层**：极深，需 [残差](/manual/llm/bit-to-agi/05-transformer/residual-connection)、[LayerNorm](/manual/llm/bit-to-agi/05-transformer/layer-norm) 等稳定技巧

LLM 的「深度」是 **Transformer 层数 $L$**：GPT-3 $L=96$，Llama 3.1 405B $L=126$，DeepSeek-V3 $L=61$（MoE）。参数量主要来自 **宽**（$d_{\text{model}}$）与 **FFN / MoE 专家**，不只是层数。

## 量化：深度带来的代价

每多一层（简化 Transformer block）约增加：

- **参数**：$\approx 4 d^2$（attention + FFN，见[块解剖](/manual/llm/bit-to-agi/05-transformer/transformer-block-anatomy)）
- **推理 FLOPs/token**：$\approx O(d^2)$ 每层
- **激活显存**（训练）：与 batch、序列长度线性相关

「更深」不总是更好——[过拟合](/manual/llm/bit-to-agi/04-neural-networks/overfitting-and-regularization) 与优化难度上升；[缩放定律](/manual/llm/bit-to-agi/05-transformer/scaling-laws-intro) 说 **数据与算力** 要和参数量匹配。

## 常见误区

- **误区**：「1990 年代就能训 GPT，只是没人做。」——缺 **数据规模**、**算力**、**稳定训练技巧**与 **分布式**；AlexNet 是工程栈成熟的拐点。
- **误区**：「层数越多越好。」——VGG 很深但难训；ResNet 用 shortcut 让 152 层可训，说明**结构**比裸深度重要。

## 从 Perceptron 到 ResNet 的跳跃

2000 年代 deep belief network 预训练 + 微调曾流行；2012 AlexNet **端到端** 终结了「必须先无监督预训练」的迷信。2015 ResNet 用 $y=x+F(x)$ 让 152 层可训，错误率 3.57%（ImageNet 2015 冠军）——**结构创新** 与 **深度** 并重。

2017 Transformer 证明：**无需卷积、无需循环**，纯 Attention + FFN 可在翻译上 SOTA。此后 NLP/CV/语音架构收敛到 Transformer 变体；CNN 仍在移动端、医学小数据、实时视频占有一席。

## 算力里程碑（数量级）

| 时代 | 典型训练算力 | 代表 |
| ---- | ------------ | ---- |
| 1990s | MFLOPS–GFLOPS | LeNet |
| 2012 | 几 TFLOPS×GPU 天 | AlexNet |
| 2020 | 数千 GPU·月 | GPT-3 |
| 2024–2026 | $10^{25}\text{–}10^{26}+$ FLOP 集群 | Llama 3/4、DeepSeek-V3/R1、GPT-5 级 |

「深度网络 1986 就能做」忽略 **算力 × 数据 × 工程栈** 乘积——AlexNet 是 **GPU CUDA + ImageNet + ReLU** 同时就绪的拐点。

**开源框架时间线**：Theano → Caffe → TensorFlow → PyTorch 主导研究——自动求导让 **试错成本** 从「推梯度一周」降到「改代码一小时」。

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

Hinton 2012 在 Coursera 的神经网络课程与 AlexNet 论文，把「深度」从少数实验室推向全球工程师。

本章各篇互有引用，建议开侧边栏按顺序阅读，形成完整知识链。

## 小结

感知机 → 反向传播 MLP → CNN 革命 → RNN/LSTM 序列 → Attention → Transformer 统治。下一篇谈理论边界：[万能近似定理的直觉](/manual/llm/bit-to-agi/04-neural-networks/universal-approximation)。
