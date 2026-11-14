---
title: "为什么 AI 喜欢矩阵"
description: "线性变换、批量并行与 Attention——神经网络即大规模矩阵乘。"
source: "https://daiw.org/manual/bit-to-agi/01-bits/why-ai-likes-matrices"
---

# 为什么 AI 喜欢矩阵

> 线性变换、批量并行与 Attention——神经网络即大规模矩阵乘。

深度学习被戏称为「** glorified matrix multiplication**」——夸张但不离谱。一层全连接、一次卷积、一段 Self-Attention，核心运算都可归结为（或近似为）**矩阵乘**与逐元素非线性。硬件为 GEMM 优化了几十年，AI 正好撞在这枪口上。

## 直觉：表格算批量规则

1000 个学生（batch）每人 512 维特征（向量）→ 排成 $1000 \times 512$ **矩阵** $X$。规则「512 维变 2048 维」= 权重 $W$ 为 $512 \times 2048$。一次 $X W$ 就算完全班——比 for 循环 1000 次更符合 GPU/SIMD。

## 定义：核心运算

| 模块 | 矩阵形式（简化） | 形状示例 |
| ---- | ---------------- | -------- |
| 全连接 | $Y = X W + b$ | $X$：B×D，$W$：D×H |
| 卷积 | im2col 后 GEMM | patch×C 与 kernel |
| Attention | $\mathrm{softmax}(QK^\top/\sqrt{d})V$ | $Q,K,V$：B×H×T×d |
| LayerNorm | 归约 + 逐元素 | 沿特征维 |

**参数量**：全连接 $D \times H$；Transformer 主要在 Attention 的 $W_Q,W_K,W_V$ 与 FFN 的 $D \times 4D$ 两层。

Llama 3 8B：**80 亿**参数 ≈ 80 亿个 float 存成各种形状的矩阵。

## 例子一：一次 FFN 的 FLOPs

隐藏维 $D=4096$，FFN 中间 $4D=16384$，batch token 数 $T=2048$（一次 forward 的 token 总量）：

$$ \text{FLOPs} \approx 2 \times T \times D \times 4D \times 2 \text{（两层）} \approx 2 \times 2048 \times 4096 \times 16384 \times 2 \approx 5.5 \times 10^{11}$$

单层已 **~275 GFLOPs**；32 层 stack 乘上去——**算力需求来自矩阵规模平方/立方级增长**。

## 例子二：Embedding 是查表，也是矩阵

token ID $t_i$ → 第 $t_i$ 行 of $E \in \mathbb{R}^{V \times D}$。实现上 `E[t]` 索引；数学上等价于 **one-hot × E**（稀疏矩阵乘）。词表 $V=128256$，$D=4096$ → 仅 $E$ 就占 **~1 GB** FP16（加输出层 untied 则 ~2 GB）。

## 为什么不是别的结构？

- **可微**：矩阵运算平滑，适合梯度下降。
- **并行**：每个输出元素独立（GEMM 内核成熟：cuBLAS、rocBLAS、oneDNN）。
- **压缩**：低秩分解（LoRA）、量化（INT4/INT8）直接作用在 weight matrix 上。
- **表达力**：多层非线性矩阵叠代 ≈ 通用函数逼近（Universal Approximation，MLP 章详述）。

图网络、状态空间模型（Mamba）试图降低 $O(T^2)$ Attention 的矩阵成本，但主流 LLM 2024–2026 仍是 **Transformer + 大矩阵**。

## 量化：规模对照

| 模型 | 参数量 | FP16 权重 | 主要矩阵块 |
| ---- | ------ | --------- | ---------- |
| GPT-2 small | 124M | ~248 MB | 12 层 × 768 维 |
| Llama 3 8B | 8B | ~16 GB | 32 层 × 4096 维 |
| GPT-4 / DeepSeek-V3 级 | 671B–1.8T | 不可单卡 | MoE 稀疏专家 + 多矩阵 |

训练 8B 一次 forward+backward 粗算 **~2× forward FLOPs**；3T token 预训练总 FLOPs $\approx 6 \times N \times \text{tokens}$（Kaplan scaling 量级 **~10²³–10²⁴** FLOPs）。

## MoE：稀疏矩阵乘

Mixture of Experts 每层只激活 **2/8 或 2/64** 专家——参数总量大但 **每 token FLOPs** 按激活专家算。路由是 **softmax gating**（小矩阵），专家 FFN 是 **conditional GEMM**——硬件仍 love 矩阵，只是 sparsity pattern 不规则，**utilization** 可能低于 dense 7B。

DeepSeek-V3 等用 **MLA**（Multi-head Latent Attention）压缩 KV——矩阵维变小，仍是 GEMM，换的是 **形状** 不是范式。

## 历史：从 Perceptron 到 Transformer

1957 Perceptron：单层权重向量。**1986** 反向传播 + 多层。**2012** AlexNet：GPU 卷积 GEMM。**2017** Transformer：Attention 全是矩阵。每一步都是 **把问题改写成硬件擅长的 bulk linear algebra**——「AI 喜欢矩阵」是 **六十年 co-evolution** 的结果，非偶然。

## Kernel Fusion：少写内存的矩阵链

理想：`Y = gelu(X @ W1) @ W2` 中间 **不写回 HBM**，在 SRAM 流式算——**Fusion 减 bit 搬运**。`torch.nn.Sequential`  naive 实现每 layer 写全量激活；`torch.compile`、TensorRT、**CUDA Graph** 捕获固定 shape 减少 launch overhead。

**CUDA Graph**：capture 一串 kernel，replay 时 **一次 launch**——LLM 固定 decode shape 时 latency **降 10–30%**；dynamic batch 需 careful。

## 场景实战：Attention 算子 FLOPs 账

单头 Attention：$Q,K,V \in \mathbb{R}^{T \times d}$，$QK^\top$ 为 **$2 T^2 d$** FLOPs（乘加各算一次），softmax 忽略低阶，乘 $V$ 再 **$2 T^2 d$**。$T=4096,d=128$ → **~8.6 GFLOPs/头**；32 头 **~275 GFLOPs/层**；32 层 **~8.8 TFLOPs/forward**（仅 Attention，不含 FFN）。FFN 两层 **$8 T d^2$** 量级，$d=4096$ → **~275 GFLOPs/层**——**FFN 与 Attention 同阶**，都 matrix-bound。

**长 context 贵**在 $T^2$——FlashAttention、稀疏 Attention、线性 Attention 都在 **改矩阵形状或不算满 $T×T$**。

## 常见误区

1. **「Attention 不是矩阵乘」**——$QK^\top$ 与 $\mathrm{softmax}(\cdot)\,V$ 都是 GEMM/batched GEMM；softmax 是逐行非线性。
2. **「稀疏就能随便加速」**—— unstructured sparsity GPU 难吃满；2:4 structured 才接近 peak。
3. **「矩阵越大越智能」**——参数量与能力相关但有 diminishing returns；数据与算法同等重要。

## 动手试一试

用 PyTorch 看一层线性层的形状与参数量：

```python
import torch
D, H, B, T = 4096, 4096, 1, 128
linear = torch.nn.Linear(D, H, bias=False)
x = torch.randn(B, T, D)
y = linear(x)  # (B,T,D) @ (D,H) -> (B,T,H)
params = sum(p.numel() for p in linear.parameters())
print("W shape", linear.weight.shape, "params", params, "≈ MB FP16", params*2/1e6)
```

## 延伸思考

**Scaling laws** 说 loss $\propto N^{-\alpha} D^{-\beta}$——$N$ 参数 **bit 数**、$D$ token **bit 流长度**；算力 **FLOPs** 与 **$6ND$** 同阶。矩阵是 **把 $N$ 塞进二维 grid** 的存储习惯；Transformer 是 **把序列长度 $T$ 变成矩阵行** 的计算习惯。**MoE** 把矩阵块 **稀疏激活**，参数 bit 多但 **每 token 乘的 bit 少**——**总量与瞬时吞吐 decouple**。

## 补充：batched GEMM 形状

推理 **continuous batching** 把多用户 prompt **拼成 `[total_tokens, dim]`** 或 **padding 到 `[batch, max_seq, dim]`**——前者省 **padding 浪费的 FLOPs bit**，实现复杂。**vLLM PagedAttention** 用 **非连续 KV block** 仍保持 **GEMM-friendly Q** layout——**内存灵活 vs 算子效率** 的 engineering 折中。

## 温故：矩阵思维看任何新架构

新论文出 **Mamba、RWKV、Hyena**——第一问：**核心算子能否写成 GEMM 或 batched matmul？** 第二问：**复杂度对 T 是线性还是平方？** 第三问：**权重 bit 与 KV bit 各多少？** 用本章语言读论文，不会被 marketing 词带偏。

## 读完带走

**GEMM** 占 transformer FLOPs 主体；Attention 是 **batched matmul + softmax**。**硬件十年优化 GEMM**；AI 十年把问题改写成 GEMM。读新架构先问：**主算子是不是矩阵乘？**

## 小结

AI 喜欢矩阵，因为**批量线性变换**既是表达工具，又是硬件最熟的运算。权重、激活、Attention 全是 GEMM 变体；比特层上是 float 数组，数学层上是矩阵，工程层上是 cuBLAS。第二章会在 **线性代数语言** 里重述同一事实——这里先记住 **shape 与 bytes**。下一章矩阵运算的 **FLOPs 与内存** 公式会严格推导。**Attention $O(T^2)$** 是长 context 贵的根因之一。

动手作业：打开 `nvidia-smi` 或活动监视器，对照本章公式估算当前进程的 **权重与 KV 占用**，误差在一个数量级内即合格。

**LoRA** 低秩分解仍是 **小矩阵乘加** 堆叠在原权重旁路。

**Kernel fusion** 把 matmul+ bias+ activation 合成一步，减 HBM 读写 bit。

**batched matmul** 是 vLLM continuous batching 的算子基础。

**MoE routing** 本质是 **小矩阵 gating + 条件 FFN GEMM**；参数多但 **每 token 激活参数少**，是矩阵稀疏化的商业路线之一。

## 第一章衔接

本章用 **bit 语言** 描述 AI 底座；第二章 **[数学](/manual/llm/bit-to-agi/02-math)** 用 **向量与矩阵** 重述同一物理过程。两章对照读：**bytes 是存储，FLOPs 是计算，带宽是瓶颈**——三个量构成工程三角。

下一篇：[位、字节与寻址](/manual/llm/bit-to-agi/01-bits/bits-and-bytes)——地址、指针与 64 位空间。读论文时把 **Table 1 的 Params / FLOPs / Memory** 三列抄下来心算一遍——**多数「新架构」只是在三列之间搬数字**。
