---
title: "Softmax 与 Logits"
description: "从 Bit 到 AGI · 第二章：数学（Math） · Softmax 与 Logits"
source: "https://daiw.org/manual/bit-to-agi/02-math/softmax-and-logits"
---

# Softmax 与 Logits

> 从 Bit 到 AGI · 第二章：数学（Math） · Softmax 与 Logits

语言模型最后一层输出 $V$ 维 **logits** $\mathbf{z}$，经 **Softmax** 变成概率分布 $\mathbf{p}$，再算 cross-entropy loss 或采样下一个 token。本篇覆盖训练与推理两条路径上的数值细节，避免 softmax 溢出与「先 softmax 再 CE」的常见踩坑。

## 直觉：实数分数 → 合法概率

考试 4 科原始分：120、95、80、60。不能直接当概率（和不为 1、可负）。Softmax：**指数化放大差距，再归一化**，得到 $\sum p_i = 1$ 且 $p_i > 0$。

Logits 是 softmax **之前**的分数；训练主要对 logits 求导（log-softmax + NLL 数值更稳）。

## 定义

**Softmax**：

$$
\text{softmax}(z_i) = p_i = \frac{e^{z_i}}{\sum_{j=1}^{V} e^{z_j}}
$$

**Log-softmax**（稳定）：

$$
\log p_i = z_i - \log\sum_j e^{z_j} = z_i - \text{logsumexp}(\mathbf{z})
$$

**Temperature** $T$：

$$
p_i = \frac{e^{z_i / T}}{\sum_j e^{z_j / T}}
$$

- $T \to 0$：趋近 argmax（one-hot）
- $T = 1$：标准 softmax
- $T > 1$：分布更平，采样更随机

**与 Cross-Entropy**：标签 one-hot 为 $k$，

$$
\mathcal{L} = -\log p_k = \text{logsumexp}(\mathbf{z}) - z_k
$$

PyTorch：`F.cross_entropy(logits, target)` 内部用 log-softmax，**不要**先 softmax 再 log（丢精度）。

## 例子

**例 1：手算**

$\mathbf{z} = [2, 1, 0]$

$$
e^z = [7.39, 2.72, 1.00],\quad \sum = 11.11
$$

$p \approx [0.665, 0.245, 0.090]$

**例 2：Temperature 效果**

```python
import numpy as np

def softmax(z, T=1.0):
    z = np.array(z) / T
    z = z - z.max()  # 数值稳定
    e = np.exp(z)
    return e / e.sum()

z = [2.0, 1.0, 0.0]
for T in [0.5, 1.0, 2.0]:
    print(f"T={T}: {np.round(softmax(z, T), 3)}")
# T=0.5 → 更尖；T=2.0 → 更平 [0.506, 0.307, 0.186]
```

**例 3：LLM 输出层**

隐藏 $\mathbf{h} \in \mathbb{R}^d$，输出 logits $\mathbf{z} = \mathbf{W}_{out} \mathbf{h} + \mathbf{b}$，$\mathbf{W}_{out} \in \mathbb{R}^{V \times d}$。

LLaMA-7B：$V \approx 32000$，$d = 4096$ → 输出层 alone ≈ $32000 \times 4096 \approx 131$M 参数 ≈ 262 MiB（bf16）。

## 量化

| 量 | 公式 / 数值 |
| -- | ----------- |
| Softmax FLOPs | $\approx 3V$（exp + sum + div） |
| Log-softmax + CE | 融合 kernel，一次遍历 |
| 词表 $V$ | 32k–128k |
| logits 显存（fp32, $V$） | $V \times 4$ B；128k → 512 KiB / token |
| label smoothing $\epsilon$ | 0.1：目标 $\frac{1-\epsilon}{1} + \frac{\epsilon}{V}$ 分布 |
| top-k / top-p 采样 | 只对 top logits 算 softmax，省算力 |

**数值稳定**：减最大值 $m = \max_j z_j$，

$$
\text{softmax}(z_i) = \frac{e^{z_i - m}}{\sum_j e^{z_j - m}}
$$

防止 $e^{z_i}$ 溢出（$z_i > 88$ 时 float32 溢出）。

**Attention 里的 Softmax**：对**每一行**（query 对所有 key）做 softmax，维度 $L$，与输出层 $V$ 维 softmax 不同——都是「归一化指数」，但作用轴不同。

::: warning

训练时 `CrossEntropyLoss` 接收 **logits**，不要手动 `softmax` 再喂进去。推理采样时 `logits / T` 再 softmax 或直接用 `multinomial`。

:::

## 工程视角：输出层与采样

LLM 最后一层 **lm_head** 常与 input embedding **权重 tying**：$\mathbf{W}_{out} = \mathbf{E}^\top$，省 $V \times d$ 参数（约 1B 量级对 7B 模型）。logits $\mathbf{z}=\mathbf{E}\mathbf{h}$，同一套向量空间测相似度。

**Fused CE kernel**：大 $V$ 时 materialize 全 logits 显存爆炸。Sampled softmax、自适应 softmax 只算 subset；Megatron **vocab parallel** 把 $V$ 切到多 GPU，各算局部 logits 再通信——工程分治，数学仍是 softmax。

**Logit bias / suppression**：推理时对某些 token 的 $z_i$ 减一个大数（如 $-\infty$ 软实现为 $-10^{9}$），等价调整 softmax 后概率为 0——禁止 EOS 过早、强制 JSON 格式 token。

Attention softmax 沿 **key 维**（最后一维 $L$）；输出层沿 **vocab 维**（$V$）。二者都指数归一化，但 shape 与语义不同——混淆是 debug 常见错误。

| 技巧 | 作用 |
| ---- | ---- |
| label smoothing $\epsilon=0.1$ | 防 overconfident，改善 calibration |
| z-loss（PaLM） | 惩罚 logsumexp 过大，稳定大模型 |
| temperature $T$ | 控制生成多样性 |

**Bits-per-byte (BPB)**：$\text{CE}/\ln 2$，跨 tokenizer 可比压缩率。中文 BPE 与英文 BPE 的 raw CE 不可比，BPB 可粗比。

推理 ** speculative decoding**：小模型 draft 多个 token，大模型并行验证——softmax 概率用于 accept/reject，数学仍是 logits 比较。

## 常见误区

1. **logits 与 log-prob 混淆**：logits 任意实数；$\log p_i \leq 0$。
2. **Softmax 不改变排序**：$z_i > z_j \iff p_i > p_j$；temperature 改变**相对**差距。
3. **大词表 CE 是训练瓶颈之一**：输出层 GEMM $V \times d$ + softmax over $V$；采样时用 top-k 截断。

## 动手试一试

```python
import torch
import torch.nn.functional as F

V, d = 128000, 4096
h = torch.randn(1, d)
W = torch.randn(V, d)
logits = h @ W.T  # (1, V)

# 稳定 CE
target = torch.tensor([42])
loss = F.cross_entropy(logits, target)
print(f"CE loss = {loss.item():.3f}")

# logsumexp 手验
lse = torch.logsumexp(logits, dim=-1)
print(f"-log p[target] ≈ {(lse - logits[0, 42]).item():.3f}")
```

## 深入一层：logits 的仿射自由度

Softmax 对 **加法不变**：$\text{softmax}(\mathbf{z})=\text{softmax}(\mathbf{z}+c\mathbf{1})$。因此 bias $\mathbf{b}$ 与整体平移不可辨识——只影响 logsumexp 常数，$p$ 不变若所有 logit 同加 $c$。训练会自动吸收到 bias / 前层。

**多类 logistic regression** = 线性 logits + softmax + CE——LLM 最后一层是 $d$ 维 hidden 到 $V$ 类的 gigantic logistic regression。

**Hierarchical softmax / adaptive softmax**：词频高的词在树浅层，低频在深层——减少每步需算的 logits 数，训练加速。推理仍可用全 vocab 或近似。

**Contrastive logits**：CLIP 里 $\mathbf{z}_i = \mathbf{u}_i^\top \mathbf{v}_j / \tau$，batch 内 $N$ 对做 $N\times N$ softmax——「正确配对」是正类，其余负类。与 LM 输出层 softmax 同族，只是 label 结构不同。

**Gumbel-Softmax**：可微近似离散采样，$\log p_i = (z_i + g_i)/T$，$g_i$ Gumbel 噪声——VAE 离散 latent；LLM 离散 token 仍靠 straight-through 或 REINFORCE。

掌握 logits → softmax → CE 管线，就读懂了 **从 hidden state 到 token 概率** 的最后一公里——也是 vocab 并行、采样优化所针对的瓶颈。

## 输出层数值流水线

Forward：$\mathbf{h} \to \mathbf{z}=\mathbf{W}\mathbf{h}+\mathbf{b} \to \mathbf{p}=\text{softmax}(\mathbf{z})$。Backward：CE 对 $\mathbf{z}$ 的梯度有闭式 $\mathbf{p}-\mathbf{y}$（one-hot $\mathbf{y}$）——简洁稳定，框架 fused 实现。

大 $V$ 训练：vocab parallel 每卡只算 $V/G$ 类 logits，CE 需跨卡通信 max 与 sum（logsumexp 分解）。推理：可全 vocab 或 top-k 截断。理解 logits 轴 = vocab 轴，读 Megatron 文档不迷路。

## 读者备忘

**logits → softmax → 概率；CE = logsumexp(z) - z[正确类]。** 减 max 防溢出。temperature 缩放 logits。输出层 $V \times d$ 参数是大头之一。`F.cross_entropy` 吃 logits，推理采样先 `/T` 再 softmax 或 multinomial。Attention 内 softmax 沿序列轴，输出层沿词表轴——勿混 shape。

::: info

本章内容面向程序员：公式可手推，数字可心算，代码可运行。遇到符号不熟时，先查本篇定义表，再查总结篇速查表，不必一次背熟全部细节。

:::

::: info

复习建议：先通读直觉与定义，再跑代码块验证数字，最后看读者备忘与小结。与第一章的 float 数组、SIMD、GPU 并行对照阅读，印象更深。后续章节会在 Transformer、训练、推理中反复调用本章符号，值得在笔记里自建一张 shape/FLOPs 速查表。

:::

::: info

动手练习：把本篇公式抄进 Jupyter，换三组数字复算；与 PyTorch 张量运算对照 shape 与数值。本章目标是建立可计算的数学直觉，而非完成证明。每篇至少两个数值例子，建议你都亲自算一遍或跑一遍代码。

:::

::: info

量化检查清单：写出符号定义、至少一个带具体数字的例子、一个 FLOPs 或字节数估算、一个常见误区。对照写作规范，缺一项就补笔记。链接下一篇前，用一句话复述本篇核心定理或公式。

:::

::: info

下一篇链接见文末箭头；全章顺序见 meta.json 与本章 index。读毕本章可先看总结篇再进第三章。

:::

## 小结

Logits $\mathbf{z}$ 是未归一化分数；Softmax 将其变为概率 $p_i = e^{z_i}/\sum e^{z_j}$。训练用 log-softmax + cross-entropy，数值上要减 max；推理用 temperature 控制随机性。输出层规模随词表 $V$ 线性增长。本章数学工具齐备——请参阅**第二章总结**串联全文，再进入第三章信息论。

→ 下一篇：[第二章总结](/manual/llm/bit-to-agi/02-math/chapter-summary)
