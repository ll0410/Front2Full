---
title: "Attention 的复杂度"
description: "从 Bit 到 AGI · 第五章：Transformer · 为什么序列变长时 Attention 成为瓶颈"
source: "https://daiw.org/manual/bit-to-agi/05-transformer/attention-complexity"
---

# Attention 的复杂度

> 从 Bit 到 AGI · 第五章：Transformer · 为什么序列变长时 Attention 成为瓶颈

Self-Attention 的核心是 $n \times n$ 的权重矩阵——序列长度 $n$ 每翻一倍，attention 的内存与计算大约**翻四倍**。这就是 $O(n^2)$ 复杂度。BERT 上限 512、GPT-3 2048、现代 LLM 推 128K 上下文，背后全是算法与工程在跟这个平方律搏斗。

## 直觉：全班两两握手的次数

$n$ 个人，每人要和其他 $n$ 人配对寒暄，大约 $n^2$ 次握手。128 个 token 要算 $128^2 = 16{,}384$ 对相似度；1024 个 token 要 $1{,}048{,}576$ 对——**长度线性增，配对次数平方增**。

## 定义

对单头 attention，设序列长 $n$，$d_k = d_{\text{model}}/h$。

**时间复杂度**（乘加各计 1 FLOP）：

| 步骤 | 复杂度 |
|---|---|
| QKV 投影 | $O(n d_{\text{model}}^2)$ |
| $\mathbf{Q}\mathbf{K}^\top$ | $O(n^2 d_k)$ |
| $\mathbf{A}\mathbf{V}$ | $O(n^2 d_k)$ |
| 输出投影 | $O(n d_{\text{model}}^2)$ |

$h$ 头合计，$h \cdot d_k = d_{\text{model}}$，故 attention 矩阵部分为 **$O(n^2 d_{\text{model}})$**。

**空间复杂度**（存 attention 权重）：$O(n^2)$ 每头；$h$ 头则 $O(h n^2)$。

相对 FFN 的 $O(n d_{\text{model}} d_{\text{ff}})$，当 $n$ 很大时 $n^2$ 项主导。

## 例子

**例 1：BERT-base，$d=768, h=12, d_k=64$**

| $n$ | $\mathbf{Q}\mathbf{K}^\top$ FLOPs ($2 h n^2 d_k$) | 相对 $n=128$ |
|---|---|---|
| 128 | $2.5 \times 10^7$ | 1× |
| 512 | $4.0 \times 10^8$ | 16× |
| 2048 | $6.4 \times 10^9$ | 256× |

**例 2：内存（fp32，单层单 batch，12 头）**

$$
\text{Bytes} = h \cdot n^2 \cdot 4 = 12 \cdot n^2 \cdot 4
$$

| $n$ | Attention 矩阵 |
|---|---|
| 512 | 12.6 MB |
| 4096 | 805 MB |
| 32768 | 51.5 GB |

训练时还需存梯度与 optimizer state，显存压力更大。

**例 3：与线性层对比（$n=512$）**

- QKV+FFN：$\approx O(n d^2) \sim 10^9$ FLOPs
- Attention 矩阵：$\approx O(n^2 d) \sim 10^9$ FLOPs

$n=512, d=768$ 时二者同量级；$n=8192$ 时 $n^2$ 项碾压 $nd^2$。

### 自己拖一下

三张表分别列了 FLOPs、内存、对比，但「谁在什么时候压倒谁」是一条连续曲线，拼不出来。拖 $n$，看紫色那两段（$n^2$ 项）怎么从一条缝长到吞掉整条：

<AttentionCost />

**这里有个反直觉的点值得记住**：交叉点在 $n = 2d$。LLaMA-7B（$d=4096$）要到 **$n=8192$** 才轮到 attention 项超过投影/FFN——也就是说，**8K 以下的上下文，大头一直是那些稠密矩阵乘，不是 attention**。「attention 是平方所以最贵」这句流行的话，只在长上下文下才对。真正一直可怕的是那块 $O(n^2)$ 的**显存**（拖到 128K 看那个数字），这才是 FlashAttention 要解决的。

```python
# 粗算 BERT-base 单层 attention FLOPs
def attention_flops(n, d_model=768, n_heads=12):
    d_k = d_model // n_heads
    qkv = 6 * n * d_model ** 2
    scores = 2 * n_heads * n ** 2 * d_k
    av = 2 * n_heads * n ** 2 * d_k
    out_proj = 2 * n * d_model ** 2
    return qkv + scores + av + out_proj

for n in [128, 512, 2048, 8192]:
    print(n, attention_flops(n) / 1e9, "GFLOPs")
```

## 量化：缓解 $O(n^2)$ 的方向

| 方法 | 思路 | 代表 |
|---|---|---|
| FlashAttention | IO 感知分块，不存满 $n \times n$ | 训练/推理标配 |
| 稀疏 Attention | 只算局部/跨步连接 | Longformer, BigBird |
| 线性 Attention | 核技巧近似 softmax | Performer |
| KV Cache + GQA | 推理不重复算 K/V | LLaMA-2, vLLM |
| 上下文缩短 | 截断、摘要、RAG | 产品层 |

::: warning

FlashAttention **不改变渐近 FLOPs**，但降低 HBM 读写，实际快数倍；长上下文主要瓶颈仍是 $n^2$ 量级计算。

:::

## 常见误区

1. **$O(n^2)$ 只指 Self-Attention**：Cross-Attention 是 $O(n_t n_s)$，源句长 $n_s$、目标句长 $n_t$。
2. **Decoder 推理仍是 $O(n^2)$ 每步**：无 cache 时生成第 $t$ token 要算 $t \times t$；有 KV cache 后每步约 $O(t)$，总生成 $O(n^2)$。
3. **加头数不影响 $n^2$ 项**：$h$ 与 $d_k$ 成反比，$h n^2 d_k = n^2 d_{\text{model}}$。

## 小结

Attention 对序列长度 $n$ 是 **$O(n^2)$** 时间与空间（权重矩阵）。BERT-base 在 $n=512$ 尚可；128K 上下文必须靠 FlashAttention、稀疏、GQA 等组合优化。下一篇看位置编码如何随长度扩展而演进。

下一篇：[位置编码的变体](/manual/llm/bit-to-agi/05-transformer/positional-encoding-variants)
