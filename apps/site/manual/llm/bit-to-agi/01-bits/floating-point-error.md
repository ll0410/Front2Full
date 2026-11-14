---
title: "浮点数为什么会有误差"
description: "IEEE 754、0.1+0.2≠0.3 与 FP16/BF16——神经网络为何仍能用「近似数」。"
source: "https://daiw.org/manual/bit-to-agi/01-bits/floating-point-error"
---

# 浮点数为什么会有误差

> IEEE 754、0.1+0.2≠0.3 与 FP16/BF16——神经网络为何仍能用「近似数」。

`0.1 + 0.2 == 0.3` 在 Python 里是 **False**。这不是 Python 的 bug，而是**浮点数**用有限 bit（通常 32 或 64）近似无限精度的实数，必然有舍入误差。神经网络权重、激活值几乎全是浮点——理解误差从哪来，才能理解混合精度训练、loss 抖动和数值稳定性。

## 直觉：用科学计数法存「有效数字 + 指数」

十进制里 $123.45 = 1.2345 \times 10^2$。浮点把有效数字（尾数 mantissa）和指数（exponent）存进 bit 域：**精度有限，范围很大**。像用只有 4 位有效数字的计算器算天文距离——远距够用，累加小钱会差几分。

## 定义：IEEE 754 单精度（float32）

| 部分 | bit 数 | 作用 |
| ---- | ------ | ---- |
| 符号 | 1 | 正负 |
| 指数 | 8 | 偏置 127，范围约 $10^{\pm 38}$ |
| 尾数 | 23 | 隐含 leading 1，约 **7 位十进制**有效数字 |

float64：指数 11 bit、尾数 52 bit，约 **15–16 位**十进制有效数字。

**FP16**（半精度）：1 + 5 + 10，动态范围窄，易 underflow/overflow。**BF16**（bfloat16）：1 + 8 + 7，指数同 float32、尾数更短——训练时常用，牺牲精度换范围和与 FP32 指数兼容。

## 例子一：0.1 无法精确表示

```python
>>> 0.1 + 0.2
0.30000000000000004
>>> format(0.1, '.17g')
'0.10000000000000001'
```

0.1 的二进制小数是无限循环 `0.0001100110011…`，float64 截断后存近似值，相加误差显现。

### 自己拆一下

「尾数更短、误差更大」是抽象的话——直到你看着同一个数在不同精度下，尾数那一块的 bit 被砍掉一半、误差跳一个量级：

<FloatBits />

默认输入 `0.1`：FP32 存进去的其实是 `0.10000000149…`，误差 `1.5e-9`。切到 **BF16**，尾数从 23 位砍到 7 位，同一个 0.1 误差跳到 `1e-4`——但它的指数位和 FP32 一样多，所以范围不缩。再输入 `70000` 切到 **FP16**，直接变 `Inf`：FP16 范围太窄，装不下——这就是 FP16 训练要配 loss scaling、而 BF16 不用的根本原因。

## 例子二：大数吃小数

```python
>>> 1e16 + 1.0 - 1e16
0.0  # 1.0 在加法中被「吞没」
>>> 1e16 + 1.0
1e16
```

float32 只有 ~7 位有效数字，$10^{16}$ 加 1 无法表示——在梯度累加、softmax 实现里要用 **Kahan 求和**或分块计算。

## 量化：AI 里的精度选择

| 格式 | 字节/数 | 相对 FP32 体积 | 典型用途 |
| ---- | ------- | -------------- | -------- |
| FP32 | 4 | 1× | 主训练、loss、master weights |
| FP16 | 2 | 0.5× | 训练 forward/backward（混合精度） |
| BF16 | 2 | 0.5× | A100/H100/B200 训练默认之一 |
| FP8 / FP4 | 1 / 0.5 | 0.25× / 0.125× | H100/H200 (FP8) 与 B200 (FP8/FP4) 推理/训练 |
| — | — | — | （见上行 FP8/FP4） |

7B 模型 FP32 权重 ≈ **28 GB**；FP16 ≈ **14 GB**；INT8 量化 ≈ **7 GB**。误差体现在 perplexity 可能上升 0.1–几不等，需 benchmark。

**混合精度**：权重主副本 FP32，计算用 FP16/BF16，梯度累加回 FP32——在速度与稳定间折中。

## 特殊值

- **NaN**：`0/0`、`sqrt(-1)`（实数域），比较永远 False。
- **Inf**：溢出，如 `exp(1000)` 在 float32。
- **Subnormal**：极小数，精度更差。

Loss 变成 NaN 是训练崩溃常见信号——学习率过大、梯度爆炸、log(0) 等。

## 混合精度训练的数值路径

Forward 用 FP16/BF16 算激活以省显存、提 Tensor Core 吞吐；**master weights** 保持 FP32 副本，optimizer 在 FP32 上更新后再 cast 回低精度——避免小梯度 underflow 成 0。Loss scaling 把 loss 乘 $2^{16}$ 再 backward，梯度放大后再除回，对抗 FP16 指数范围窄。

BF16 指数 8 bit 与 FP32 相同，**不易 overflow**；尾数 7 bit 精度差于 FP16，但对权重更新往往够用。NVIDIA H100/H200 支持 **FP8**（E4M3/E5M2 两种格式），Blackwell B200 更进一步原生支持 **FP4（MXFP4/NVFP4）**，大幅节省带宽，需配块级或张量级 scale factor。

## 与 AI 输出质量的关系

量化 INT8 后 perplexity 上升 **0.05–0.5** 很常见（视模型与校准）；INT4 GPTQ 可能 **1–3** 更大，但 human eval 差距更小——说明 **浮点误差与「听起来对不对」非线性相关**。Embedding  cosine 差 0.001 可能不改变 top token；差 0.1 可能换词。

生成图像时，latent 空间 FP16 与 FP32 肉眼难辨；累积 50 步 diffusion 后误差叠加，极端 case 出现色带——仍属浮点 pipeline 工程问题，非「AI 有灵魂」。

## 稳定 softmax 与 log-sum-exp

Attention softmax 对 logits $x_i$ 做 $e^{x_i}/\sum e^{x_j}$。直接算 $e^{1000}$ overflow； trick：减最大值 $m$，$e^{x_i-m}/\sum e^{x_j-m}$——**纯代数等价，浮点稳定**。FlashAttention 融合此步于 SRAM，避免写回大 $N\times N$ 矩阵到 HBM。

Loss 里 `log(softmax)` 用 **log-sum-exp** 一体算，避免 underflow 成 0 再 log 得 $-\infty$。训练 NaN 排查第一步：打印 loss scale、grad norm、是否 FP16 overflow。

## 场景实战：训练日志里的 loss

`loss=2.384` 是 float32 标量；`grad_norm=1.02` 同理。若 loss 突然 **nan**，往往是 softmax 输入 **inf** 或 learning rate 过大导致 weight **inf**。排查时 `torch.isfinite(model.parameters())` 扫描权重 bit 模式是否已 corrupt——**数值健康 = 比特模式在 float 合法域内**。

对比实验「FP32 vs BF16 训练」：最终 weight **L2 差** 可在 **1e-3~1e-2** 相对范数，下游 benchmark 差 **低于 0.5%** 常见——说明 AI 训练是 **统计收敛**，非 bit-exact 数学解。

## 常见误区

1. **「用 decimal 库就适合训练」**——Decimal 太慢，GPU 不支持；训练必须浮点 + 数值技巧。
2. **「double 就没有误差」**——有，只是更小；$10^{308}$ 量级仍会溢出。
3. **「同一模型 FP16 和 FP32 输出 bitwise 相同」**——不可能；但 top-1 token 往往一致。

## 动手试一试

比较累加顺序对 float32 的影响：

```python
import numpy as np
n = 10_000_000
small = np.float32(1e-8)
big = np.float32(1.0)

# 先加大量小数再加 1
s = np.float32(0.0)
for _ in range(n):
    s += small
s += big
print(s)  # 可能仍是 1.0

# 用 float64 累加再转回
s64 = np.float64(0)
for _ in range(n):
    s64 += np.float64(small)
print(np.float32(s64 + big))  # 更接近 1.0001
```

## 延伸思考

数值分析课教的 **精确算术** 与工程里的 **float 近似** 之间的鸿沟，在 AI 里被 **规模** 放大：十亿参数每个差 $10^{-7}$，累加后输出 token 可能不变；但 loss 若从 $10^{-3}$ 漂到 **NaN**，训练 **一夜作废**。因此 **master weight FP32 + compute FP16 + loss scale** 不是过度设计，是 **在 bit 预算内买稳定性**。做量化时 **calibration** 用 512–2048 条代表样本估 scale，是在 **最小化重构误差 $\|W - dequant(quant(W))\|$**——仍是在 bit 域里找最优近似。

## 温故：浮点误差与工程取舍

**不必**追求 FP64 全网；**必须**知道 loss/grad 何时该 FP32 累加、权重 master copy 为何存在、量化 calibration 在做什么——都是在 **bit 精度与体积/速度** 间滑动。生产部署 sign-off 应包含：**同 prompt 在 FP16 vs INT4 的输出 diff 抽检**，而不是假设「量化无损」。

## 小结

浮点 = 有限 bit 的科学计数法，**近似**实数。误差来自表示、运算顺序和范围限制。AI 全栈建立在「足够好」的近似上；选 FP16/BF16/INT8 是在体积、速度与张量误差间的工程权衡。上线前务必用 **固定 seed 对比 FP16/INT4 输出**，记录 acceptable diff 阈值，而不是假设量化无损。**BF16 训练** 在 A100+ 上常是默认 sweet spot，兼顾范围与 Tensor Core 吞吐。

下一篇：[图片为什么可以压缩](/manual/llm/bit-to-agi/01-bits/why-images-compress)——从像素冗余到 JPEG。混合精度训练时 **GradScaler** 在 loss 上乘 $2^{k}$ 再 backward，**是在 float bit 层面把梯度抬出 underflow 区**——工具链已封装，原理仍是 IEEE 754 范围问题。
