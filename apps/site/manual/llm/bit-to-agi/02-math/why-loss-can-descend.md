---
title: "为什么损失函数可以下降"
description: "从 Bit 到 AGI · 第二章：数学（Math） · 为什么损失函数可以下降"
source: "https://daiw.org/manual/bit-to-agi/02-math/why-loss-can-descend"
---

# 为什么损失函数可以下降

> 从 Bit 到 AGI · 第二章：数学（Math） · 为什么损失函数可以下降

链式法则能算梯度，但凭什么反复做 $\theta \leftarrow \theta - \eta \nabla \mathcal{L}$，loss 就会降？本篇从**泰勒一阶近似**和**凸优化直觉**出发，说明下降成立的数学条件；同时诚实讨论非凸深度学习里为何「通常也能 work」，并给出学习率、batch size 的量化建议——调参时心里有数，不靠玄学。

## 直觉：沿最陡下坡走一小步

loss 曲面 $\mathcal{L}(\theta)$ 在 70 亿维空间里极其复杂，但在**当前点**附近，一阶近似成立：

$$
\mathcal{L}(\theta - \eta \nabla \mathcal{L}) \approx \mathcal{L}(\theta) - \eta \|\nabla \mathcal{L}\|^2
$$

只要 $\eta > 0$ 且梯度非零，右边第二项为负——**loss 近似下降**。步长 $\eta$ 太大则近似失效，可能 overshoot 甚至发散。

## 定义

**梯度下降**（Gradient Descent）：

$$
\theta_{t+1} = \theta_t - \eta_t \nabla_\theta \mathcal{L}(\theta_t)
$$

**下降保证**（充分小 $\eta$）：若 $\mathcal{L}$ 在 $\theta_t$ 可微且 $\nabla \mathcal{L} \neq 0$，存在 $\eta > 0$ 使 $\mathcal{L}(\theta_{t+1}) < \mathcal{L}(\theta_t)$。

**L-smooth 条件**（常用理论假设）：$\|\nabla^2 \mathcal{L}\| \leq L$，则取 $\eta < \frac{2}{L}$ 可保证单调下降（凸函数下收敛到全局最优）。

**随机梯度下降**（SGD）：用 mini-batch 估计梯度 $\hat{g}$，$\mathbb{E}[\hat{g}] = \nabla \mathcal{L}$。有噪声但**期望方向**仍指向下降。

## 例子

**例 1：一维二次函数（凸）**

$\mathcal{L}(w) = w^2$，$\nabla \mathcal{L} = 2w$。更新 $w_{t+1} = w_t - \eta \cdot 2w_t = (1-2\eta) w_t$。

- $\eta = 0.1$：$w_t = 0.8^t w_0$，指数收敛到 0。
- $\eta = 1.0$：$w_{t+1} = -w_t$，振荡不收敛。
- $\eta = 1.5$：$|1-2\eta| > 1$，发散。

**例 2：训练 log**

典型预训练曲线（7B 模型，cosine lr）：

| 阶段 | loss（cross-entropy） | 说明 |
| ---- | --------------------- | ---- |
| 0–1B tokens | 3.0 → 2.5 | 快速下降 |
| 1B–100B | 2.5 → 1.8 | 缓慢下降 |
| 过拟合 | 训练 ↓ 验证 ↑ | 需 early stop |

```python
def gd_quadratic(w0: float, eta: float, steps: int) -> list[float]:
    w = w0
    traj = [w ** 2]
    for _ in range(steps):
        w = w - eta * (2 * w)
        traj.append(w ** 2)
    return traj

for eta in [0.1, 0.5, 1.1]:
    final = gd_quadratic(1.0, eta, 20)[-1]
    print(f"eta={eta:.1f} → final loss={final:.4f}")
```

## 量化

| 超参 | 典型范围 | 影响 |
| ---- | -------- | ---- |
| 学习率 $\eta$ | $10^{-5}$–$10^{-2}$ | 太大发散，太小慢 |
| batch size $B$ | 256–4096+ | 大 batch 梯度稳、需更大 $\eta$（linear scaling rule） |
| warmup steps | 1k–10k | 初期防大梯度破坏 |
| cosine decay | 总步数内 $\eta \to 0$ | 后期精细收敛 |
| Adam $\beta_1, \beta_2$ | 0.9, 0.95 | 自适应各维步长 |

**每步下降量**（近似）：$\Delta \mathcal{L} \approx -\eta \|\nabla \mathcal{L}\|^2$。

若 $\|\nabla \mathcal{L}\| = 10$、$\eta = 10^{-4}$，则 $\Delta \mathcal{L} \approx -10^{-2}$。

**非凸现实**：深度网络 loss 曲面有无数局部极小、鞍点。实践发现：宽网络 + SGD 噪声 + 大 batch 预训练，往往能到**足够好的 basin**；完全全局最优不可达也不必追求。

## 工程视角：loss 曲线与调度

W&B / TensorBoard 里 loss 曲线从 3.x 缓降到 1.x 是 healthy pretrain。**loss spike**（突然跳到 NaN）常见原因：lr 过大、bf16 溢出、坏数据 batch、梯度爆炸。recovery：降 lr、clip grad、skip batch、从 checkpoint 重载。

**Linear scaling rule**：batch 从 $B$ 增到 $kB$，lr 从 $\eta$ 增到 $k\eta$（至上限），保持梯度噪声尺度。大模型用 batch 3M+ tokens/step，lr 可达 $3\times10^{-4}$ 量级，配合 warmup。

**Plateau 不是失败**：后期 loss 每降 0.01 可能要多跑数 B tokens——边际收益递减。评估改用 downstream benchmark（MMLU、HumanEval），不只看 train loss。

凸优化理论：强凸 + L-smooth 时 GD 线性收敛，速率 $(1-\mu/L)^t$。深度网络非凸，但宽网络文献有「多数局部极小接近全局」的渐近结果——工程上**不必等理论完美**再训练。

| 现象 | 可能原因 | 对策 |
| ---- | -------- | ---- |
| loss NaN | 溢出、除零 | fp32 loss scale、clip |
| loss 不降 | lr 太小、冻结层 | 查 lr、requires_grad |
| train↓ val↑ | 过拟合 | dropout、早停、更多数据 |

**二阶方法**（牛顿法、L-BFGS）：用 Hessian 曲率信息，每步更准但 $O(n^2)$ 或 $O(n)$ 存储不可用于 7B。Adam 是实用的一阶自适应折中。

## 常见误区

1. **「loss 必须每步都降」**：SGD 有噪声，允许小幅反弹；看 moving average。
2. **「收敛 = loss = 0」**：分类 cross-entropy 理论下界 > 0（标签噪声、模型容量限制）。
3. **学习率越大越好**：warmup 后过大 lr 导致 loss spike，甚至 NaN（bf16 下尤其常见）。

## 动手试一试

```python
import math

def cosine_lr(base: float, step: int, total: int, warmup: int) -> float:
    if step < warmup:
        return base * step / warmup
    progress = (step - warmup) / (total - warmup)
    return base * 0.5 * (1 + math.cos(math.pi * progress))

for step in [0, 500, 2000, 10000, 50000]:
    print(f"step={step:5d} lr={cosine_lr(3e-4, step, 50000, 2000):.2e}")
```

## 深入一层：非凸与宽网络

**Barzilai-Borwein** 步长：$\eta = \frac{(\theta_t-\theta_{t-1})^\top(\nabla_t-\nabla_{t-1})}{\|\nabla_t-\nabla_{t-1}\|^2}$，无超参自适应——研究用，LLM 仍 cosine + warmup。

**Sharp vs flat minima**：小 batch 噪声倾向 flat minima（泛化好）；大 batch 倾向 sharp（需 lr warmup、label smoothing 补救）。loss 曲面几何是 active research。

**Continue pretrain vs finetune**：finetune lr 通常小 10×，因已在 good basin 内，只需小步调整；从头 pretrain 可大 lr + long warmup。

**Zero redundancy optimizer（ZeRO）**：分片 optimizer state，不改变 loss 下降数学，只改**谁能装下 7B 的 Adam 状态**——工程使下降可执行。

下降不是 guarantee 全局最优；是 **empirical contract**：足够数据 + 足够算力 + 合理 hyperparam → loss 曲线向下、下游任务向上。数学给局部理由；规模给全局效果。

## 学习率数量级参考

| 场景 | lr 量级 |
| ---- | ------- |
| 7B 预训练（AdamW） | $10^{-4}$–$3\times10^{-4}$ |
| 全参 SFT | $10^{-5}$–$10^{-4}$ |
| LoRA | $10^{-4}$–$10^{-3}$ |
| 头层分类（小数据） | $10^{-3}$ 可试 |

warmup 通常 1%–5% 总步数。cosine 末段 lr → 0，利于收敛 flat 区域。linear scaling：batch ×2 → lr ×2（有上限）。

## 读者备忘

**小步负梯度 ≈ 局部降 loss。** 关注 lr、warmup、cosine decay、grad clip。loss spike → 先查 lr 与 overflow，再查数据。train loss 单指标不够，配 validation benchmark。非凸曲面无全局保证，但 billion-scale 预训练反复验证「能降就能用」。

::: info

本章内容面向程序员：公式可手推，数字可心算，代码可运行。遇到符号不熟时，先查本篇定义表，再查总结篇速查表，不必一次背熟全部细节。

:::

::: info

复习建议：先通读直觉与定义，再跑代码块验证数字，最后看读者备忘与小结。与第一章的 float 数组、SIMD、GPU 并行对照阅读，印象更深。后续章节会在 Transformer、训练、推理中反复调用本章符号，值得在笔记里自建一张 shape/FLOPs 速查表。

:::

::: info

动手练习：把本篇公式抄进 Jupyter，换三组数字复算；与 PyTorch 张量运算对照 shape 与数值。本章目标是建立可计算的数学直觉，而非完成证明。每篇至少两个数值例子，建议你都亲自算一遍或跑一遍代码。

:::

## 小结

梯度下降靠泰勒一阶近似：小步沿负梯度方向，loss 局部下降。凸函数有收敛保证；深度网络非凸但实践有效。学习率、batch、schedule 决定能否稳定下降。下一篇转向**概率论**——分类、采样、loss 的语言基础。

→ 下一篇：[概率是什么](/manual/llm/bit-to-agi/02-math/what-is-probability)
