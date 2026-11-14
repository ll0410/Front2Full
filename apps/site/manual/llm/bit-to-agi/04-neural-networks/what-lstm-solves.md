---
title: "LSTM 解决了什么"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · LSTM 解决了什么"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/what-lstm-solves"
---

# LSTM 解决了什么

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · LSTM 解决了什么

LSTM（Long Short-Term Memory）在 RNN 里加了一条「细胞状态」高速公路和三个 sigmoid 门：决定忘多少、记多少、出多少。它不能魔法般记住无限长序列，但把**有效记忆长度**从约十步推到数百步，并在 2014–2017 的 NLP 里统治机器翻译与语音。

## 直觉

普通 RNN 像一块白板，每步全擦重写。LSTM 像带三个开关的保险柜：**遗忘门**擦掉无关旧账，**输入门**写入新条目，**输出门**决定对外展示什么；**细胞状态 $c_t$** 是保险柜内部，更新多是「加一项」而非「乘以小数」——梯度在高速公路上更接近常数 1。

## 定义

$$
\begin{aligned}
f_t &= \sigma(W_f [h_{t-1}, x_t] + b_f) \quad \text{（遗忘门）} \\
i_t &= \sigma(W_i [h_{t-1}, x_t] + b_i) \quad \text{（输入门）} \\
o_t &= \sigma(W_o [h_{t-1}, x_t] + b_o) \quad \text{（输出门）} \\
\tilde{c}_t &= \tanh(W_c [h_{t-1}, x_t] + b_c) \\
c_t &= f_t \odot c_{t-1} + i_t \odot \tilde{c}_t \\
h_t &= o_t \odot \tanh(c_t)
\end{aligned}
$$

$\odot$ 为逐元素乘；$[h_{t-1}, x_t]$ 为拼接。

**关键**：$c_t$ 对 $c_{t-1}$ 的偏导含 $f_t$（门控），若 $f_t \approx 1$ 则 $\frac{\partial c_t}{\partial c_{t-1}} \approx 1$——**加法路径**缓解连乘衰减。

## 例子

**例 1：遗忘门保持常数**

设 $f_t=1, i_t=0$（只保留、不写入），则 $c_t = c_{t-1}$，100 步后 $c_{100}=c_0$——信息无损（理想情况）。

设 vanilla RNN $h_t = 0.5 h_{t-1}$，100 步后 $h_{100} = 0.5^{100} h_0 \approx 0$。

**例 2：参数量**

隐藏维 $d$，输入维 $d_x$；四个门各用 $[h,x]$ → 权重块 $(d+d_x) \times d$：

$$
\text{参数} \approx 4 \times d \times (d + d_x) + 4d \quad (\text{bias})
$$

$d=512, d_x=512$：≈ **4 × 512 × 1024 ≈ 2.1M**/层，约为 vanilla RNN 的 **4×**。

**例 3：简化 NumPy 一步**

```python
import numpy as np

def sigmoid(z):
    return 1 / (1 + np.exp(-np.clip(z, -500, 500)))

d, dx = 2, 3
h_prev = np.array([0.0, 0.0])
c_prev = np.array([1.0, 0.0])  # 细胞里「存着 1」
x = np.array([0.1, 0.2, 0.3])

# 极简：手工设门值演示
f_t = np.array([1.0, 1.0])   # 全保留
i_t = np.array([0.0, 0.0])   # 不写入
c_t = f_t * c_prev + i_t * np.tanh(np.array([0.0, 0.0]))
print(c_t)  # [1. 0.] — 与 c_prev 相同
```

## 量化

- **加法长程任务**：LSTM 可学 **100+** 步依赖（合成任务）；vanilla RNN 常 **低于 20**
- **WMT 英德（2014–2016）**：LSTM seq2seq + attention 将 BLEU 从统计机器翻译 ~20 提到 **25+**
- **训练**：比 RNN 慢约 **2～4×**（四门）；GRU 用 3 门折中
- **LLM 时代**：2017 Transformer 后，LSTM 在 NLP 主战场退场；仍用于边缘设备、时序预测

| 模型        | 门数 | 相对速度 | 长程（经验） |
| ----------- | ---- | -------- | ------------ |
| Vanilla RNN | 0    | 1×       | 差           |
| GRU         | 3    | ~1.5× RNN | 中上         |
| LSTM        | 4    | ~2× RNN  | 好           |

::: info

LSTM 解决的是「**在一定长度内**可靠传递信息」与「**梯度高速公路**」，不是无限记忆。更长上下文最终靠 Attention 直接连边。

:::

## 常见误区

1. **「LSTM 不会梯度消失」**——改善 ≠ 消除；极长序列仍困难。
2. **「细胞状态 = 显式记忆库」**——仍是分布式向量，不可人类可读地「取出第 37 个词」。
3. **「Bi-LSTM 参数翻倍」**——正反向各一套，参数与计算约 **2×**。

## 动手试一试

对比连乘 vs 门控加法路径：

```python
import numpy as np

T = 50
vanilla = 0.9 ** T
# 假设 f_t 平均 0.95，但每 10 步有一次 f=1 的「高速段」
gates = [0.95] * T
gates[0] = gates[10] = gates[20] = 1.0
lstm_like = 1.0
for g in gates:
    lstm_like *= g
print(f"vanilla 0.9^50 = {vanilla:.2e}")
print(f"门控连乘 50 步   = {lstm_like:.2e}")
```

## GRU：三门变两门

GRU 合并 LSTM 的 forget/input 为 **update gate** $z_t$，无单独细胞状态：

$$
h_t = (1 - z_t) \odot h_{t-1} + z_t \odot \tilde{h}_t
$$

参数约为 LSTM 的 **75%**，许多任务精度相当、训练更快。PyTorch `nn.GRU` 与 `nn.LSTM` API 平行；小数据集 NLP 微调曾常用 Bi-GRU + CRF 做序列标注。

## 编码器-解码器与 Attention 衔接

2014 seq2seq：**Encoder LSTM** 读源句 → 最后时刻 $h$ 作上下文 → **Decoder LSTM** 生成目标句。瓶颈在固定长度 $h$——长句信息丢失。Bahdanau Attention 让 decoder 每步读 encoder **所有** $h_i$，LSTM 仍负责自回归生成，Attention 负责对齐——**LSTM + Attention** 是 Transformer 的直接前身。

## Peephole 与变种

**Peephole LSTM**：门也看 $c_{t-1}$，略增参数。**LayerNorm LSTM**：在 $h$ 上加 LN 稳定训练。

**量化性能**：LSTM 串行依赖 $h_{t-1}$，GPU 并行度低于 Transformer——**推理 latency** 敏感的应用（实时 ASR 流式）曾用 LSTM；现部分被 **Streaming Transformer** 取代。

**细胞状态维度** 通常等于 hidden 维度 $d$；增大 $d$ 线性增参数与计算——$d=1024$ 双层 LSTM encoder 在 WMT 曾是 SOTA 配置（2014–2016）。

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

LSTM 用**门控 + 细胞状态加法更新**，缓解 RNN 的梯度消失与短记忆。它是 Attention 时代之前的 seq2seq 主力；理解 LSTM，就理解「为什么后来要允许任意位置直接相连」。

→ 下一篇：[Attention 为什么出现](/manual/llm/bit-to-agi/04-neural-networks/why-attention-emerged)
