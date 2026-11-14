---
title: "Attention 为什么出现"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · Attention 为什么出现"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/why-attention-emerged"
---

# Attention 为什么出现

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · Attention 为什么出现

LSTM 把信息压缩进固定长度向量 $h$，解码长句时像「把整个句子塞进一个手提箱」——容量瓶颈。Attention 允许解码第 $t$ 步**直接查看**编码器所有位置，用可学习的权重加权求和。路径长度从 $O(n)$ 降到 $O(1)$，这是 Transformer 与 modern LLM 的核心动机。

## 直觉

开卷考试 vs 闭卷：RNN 编码器闭卷，只带摘要 $h$；Attention 开卷，每写一个字都可以翻回原文任意句。对齐「它」指代哪个人，不必靠 $h$  magically 记住——算一遍相似度即可。

## 定义

**加性 Attention（Bahdanau, 2015）**：

$$
e_{ti} = v^\top \tanh(W_s s_{t-1} + W_h h_i), \quad
\alpha_{ti} = \frac{\exp(e_{ti})}{\sum_j \exp(e_{tj})}, \quad
c_t = \sum_i \alpha_{ti} h_i
$$

**缩放点积 Attention（Transformer 基础）**：

$$
\mathrm{Attention}(Q,K,V) = \mathrm{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V
$$

- $Q$：查询（我想找什么）
- $K$：键（各位置的标签）
- $V$：值（各位置的内容）
- $\alpha_{ti}$：注意力权重，$\sum_i \alpha_{ti}=1$

## 例子

**例 1：手算 3 位置注意力**

$d_k=2$，一个 query，三个 key/value：

```python
import numpy as np

def softmax(x):
    e = np.exp(x - x.max())
    return e / e.sum()

Q = np.array([[1.0, 0.0]])
K = np.array([[1.0, 0.0],
              [0.0, 1.0],
              [1.0, 1.0]])
V = np.array([[10.0, 0.0],
              [0.0, 20.0],
              [5.0, 5.0]])

scores = Q @ K.T / np.sqrt(2)   # [0.707, 0, 0.707]
alpha = softmax(scores)         # [0.401, 0.198, 0.401]
context = alpha @ V
print(f"α={alpha.round(3)}, context={context.round(2)}")
```

Query 与位置 0、2 的 key 更相似 → 输出偏向 10 与 (5,5) 的混合。

**例 2：路径长度对比**

| 机制 | 位置 $i$ 到 $j$ 的信息路径 | 最长路径 |
| ---- | -------------------------- | -------- |
| RNN  | 需经 $\|i-j\|$ 步传播     | $O(n)$   |
| Attention | 一步 $\alpha_{ij}$ 连边 | $O(1)$   |

序列长 $n=512$：RNN 有效梯度路径 512 步；Self-Attention 一步可达任意对。

**例 3：机器翻译对齐**

「我 / love / you」→「我 / 爱 / 你」：生成「爱」时 $\alpha$ 峰值常在 「love」——可视化注意力矩阵呈对角线。

## 量化

- Self-Attention 一层（单头）：$Q,K,V \in \mathbb{R}^{n \times d}$，$QK^\top$ 为 **$n^2 d$** MAC；$n=2048, d=64$ → $\approx 268$M MAC/头/层
- 内存：注意力矩阵 $n \times n$，$n=4096$ float32 → **64 MB/头**（训练存多份）
- **Multi-Head**：$h$ 头并行，$d_{\text{model}} = h \cdot d_k$；GPT-3 96 层 × 96 头量级
- 2017 Transformer 英德 WMT：BLEU **28.4**，训练成本低于 LSTM seq2seq 大集群

::: info

第五章会展开 QKV、Multi-Head 与 Transformer 块。本章只需记住：Attention = **软寻址** + **内容寻址** 的加权读。

:::

## 常见误区

1. **「Attention = 人类注意力」**——是可微的加权平均，无 consciousness。
2. **「Attention 权重 = 解释性」**——相关不等于因果；解释需额外方法。
3. **「Attention 取代 RNN 因 RNN 慢」**——$O(n^2)$ 的 Attention 在长序列上也可更慢；胜在**并行**与**长程**。

## 动手试一试

实现缩放点积 attention：

```python
import numpy as np

def scaled_dot_product_attention(Q, K, V):
    d_k = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(d_k)
    weights = softmax(scores)
    return weights @ V, weights

Q = np.random.randn(4, 8)   # 4 个 token, d=8
K = np.random.randn(4, 8)
V = np.random.randn(4, 8)
out, w = scaled_dot_product_attention(Q, K, V)
print(out.shape, w.shape)    # (4,8), (4,4)
print(w.sum(axis=1))         # 每行和为 1
```

## Self-Attention vs Cross-Attention

- **Self-Attention**：$Q,K,V$ 来自**同一序列**——每个 token 看全句其他 token（GPT 解码器 masked 版本只看左侧）。
- **Cross-Attention**：$Q$ 来自 decoder，$K,V$ 来自 encoder——翻译时 decoder 查源句。

两者数学形式相同，只是 $Q,K,V$ 的来源不同。Transformer 编码器只用 self-attention；原始 seq2seq Transformer 解码器两种都有。

## 并行性与 $O(n^2)$ 代价

RNN 第 $t$ 步依赖 $h_{t-1}$，**无法并行**时间维。Self-Attention 一次矩阵乘 $QK^\top$ 算齐所有位置对——训练可完全并行，GPU 利用率高。代价是 **$O(n^2)$** 内存与计算；$n=8192$ 时 attention 矩阵 67M 元素/头，促生 FlashAttention、稀疏 Attention、线性 Attention 等优化（第八章推理专题）。

## Luong vs Bahdanau Attention

**Bahdanau（additive）**：$e_{ti}=v^\top\tanh(W_s s_t + W_h h_i)$——MLP 打分。**Luong（dot/multiplicative）**：$e_{ti}=s_t^\top h_i$ 或 $s_t^\top W h_i$——更省算力。Transformer 用 **scaled dot-product** 是 Luong 系扩展。

**Attention 可视化**：热力图 $\alpha_{ti}$ 常呈 **近似对角**（对齐翻译）；但 **注意力 ≠ 解释**——权重可转移，因果解释需 caution。

**Sparse Attention**（Longformer、BigBird）：只算局部 + 全局 token 子集，把 $O(n^2)$ 降到近线性——长文档 LLM 工程必知（第八章）。

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

2017 年「Attention Is All You Need」标题即宣言：递归可完全移除，Attention 足以担纲序列建模。

本章各篇互有引用，建议开侧边栏按顺序阅读，形成完整知识链。

Cross-attention 在 Stable Diffusion 里连接文本与图像 latent，是同一机制的跨模态实例。

阅读第五章时请对照本篇的 scaled dot-product 公式与 QKV 符号。

## 小结

Attention 出现因为：**固定瓶颈 $h$ 不够**、**长程路径要短**、**训练要并行**。它从 seq2seq 对齐机制长成 Self-Attention，统一了 NLP 与 CV 的主干——通向 Transformer 与 GPT。

→ 下一篇：[前向传播是什么](/manual/llm/bit-to-agi/04-neural-networks/forward-pass)
