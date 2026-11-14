---
title: "优化器：SGD 与 Adam"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · 优化器：SGD 与 Adam"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/optimizer-sgd-adam"
---

# 优化器：SGD 与 Adam

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · 优化器：SGD 与 Adam

反向传播给出梯度 $\nabla L$；优化器决定**怎么用梯度改权重**。SGD 及其动量变体是经典默认；Adam 为每个参数自适应学习率，几乎不用调 lr 就能开训——LLM 预训练常用 AdamW，CV 微调有时仍偏爱 SGD+momentum。

## 直觉

下山：SGD 看最陡方向走一步；动量像滚下山的小球，有惯性、能冲过小坑；Adam 像给陡坡和缓坡配不同步长——**每个参数有自己的 lr**，还记住近期梯度方向（一阶矩）和波动大小（二阶矩）。

## 定义

**SGD**：

$$
\theta_{t+1} = \theta_t - \eta \nabla L(\theta_t)
$$

**SGD + Momentum**：

$$
\mathbf{v}_{t+1} = \mu \mathbf{v}_t + \nabla L, \quad \theta_{t+1} = \theta_t - \eta \mathbf{v}_{t+1}
$$

常见 $\mu = 0.9$。

**Adam**（2015）：

$$
\mathbf{m}_t = \beta_1 \mathbf{m}_{t-1} + (1-\beta_1)\mathbf{g}_t, \quad
\mathbf{v}_t = \beta_2 \mathbf{v}_{t-1} + (1-\beta_2)\mathbf{g}_t^2
$$

偏差校正后：

$$
\hat{\mathbf{m}}_t = \frac{\mathbf{m}_t}{1-\beta_1^t}, \quad \hat{\mathbf{v}}_t = \frac{\mathbf{v}_t}{1-\beta_2^t}, \quad
\theta_{t+1} = \theta_t - \eta \frac{\hat{\mathbf{m}}_t}{\sqrt{\hat{\mathbf{v}}_t} + \epsilon}
$$

默认 $\beta_1=0.9, \beta_2=0.999, \epsilon=10^{-8}$。

**AdamW**：权重衰减与梯度更新解耦，$\theta \leftarrow \theta - \eta(\ldots) - \eta\lambda\theta$。

## 例子

**例 1：1D 抛物线 SGD vs Adam**

$L(w) = (w - 3)^2$，最优 $w=3$：

```python
import numpy as np

w_sgd = 0.0
lr = 0.1
for _ in range(20):
    w_sgd -= lr * 2 * (w_sgd - 3)

w_adam = 0.0
m, v = 0.0, 0.0
lr, b1, b2 = 0.5, 0.9, 0.999
for t in range(1, 21):
    g = 2 * (w_adam - 3)
    m = b1 * m + (1 - b1) * g
    v = b2 * v + (1 - b2) * g ** 2
    m_hat = m / (1 - b1 ** t)
    v_hat = v / (1 - b2 ** t)
    w_adam -= lr * m_hat / (np.sqrt(v_hat) + 1e-8)

print(f"SGD w={w_sgd:.4f}, Adam w={w_adam:.4f}")
```

**例 2：不同参数不同 effective lr**

参数 A 梯度恒 0.001，参数 B 梯度恒 1.0：Adam 给 A 更大相对步长（$v_A$ 小），自动平衡尺度。

**例 3：LLM 典型超参**

| 模型 | 优化器 | 峰值 lr | batch（token） |
| ---- | ------ | ------- | -------------- |
| GPT-3 | AdamW | 6e-4（warmup+cosine） | ~3.2M |
| Llama 2 | AdamW | 3e-4 | 4M+ |
| ResNet 微调 | SGD | 0.01～0.1 | 256 |

## 量化

- Adam 状态：每参数存 **$m, v$** → 优化器状态内存 ≈ **2×** 参数量（float32）
- 175B 模型 Adam 状态 ≈ **1.4 TB**（仅状态，不含权重）→ 需 sharding、ZeRO
- **warmup**：前 1～2% step lr 线性增，防早期 Adam 二阶矩不准
- SGD 泛化 folklore：同 test acc 时 SGD 有时略优；Adam 收敛 **2～10×** 更快（任务相关）

::: warning

Adam 不保证全局最优；非凸损失到处是局部极小与鞍点。实践靠大 batch、好初始化、足够数据。

:::

## 常见误区

1. **「Adam 不用调 lr」**——仍要调；只是比 SGD 宽容。
2. **「momentum = Nesterov 一样」**——Nesterov 看「lookahead」梯度，略不同。
3. **「AdamW = Adam + L2 在 loss 里」**——decay 施加方式不同，LLM 应用 AdamW 非 Adam+L2。

## 动手试一试

对比固定 lr SGD 在 ill-conditioned 椭圆损失上的 zig-zag：

```python
import numpy as np

# L = 0.1*w1^2 + 10*w2^2, 最小在 (0,0)
w = np.array([5.0, 5.0])
lr = 0.1
for _ in range(50):
    g = np.array([0.2 * w[0], 20 * w[1]])
    w -= lr * g
print(f"SGD after 50 steps: w={w}")  # w[1] 仍很大
```

Adam 通常更快压小 $w_2$（需自行实现验证）。

### 不用自己实现，拖一下就行

这就是上面那段代码的可视化版——同一个损失面 $L = 0.1w_1^2 + 10w_2^2$，三个优化器随你切：

<OptimizerTrajectory />

**先看 SGD 的之字形**：等高线是拉长的椭圆（$w_2$ 方向陡、$w_1$ 方向平），SGD 在陡方向几乎每步跨过谷底、来回弹，平方向却爬得极慢——这正是代码里「50 步后 $w_2$ 仍很大」的画面。**把 lr 拖过 0.1**，$w_2$ 方向直接发散、轨迹螺旋飞出画布；而这时 $w_1$ 方向明明还能开大 50 倍——**整体学习率被最陡的方向卡死了**。切到 Momentum 看它在平方向攒速度直冲，切到 Adam 看它给两个方向配不同步长把椭圆「拉圆」。

固定 lr 很少最优。常见策略：

| 策略 | 行为 | 典型场景 |
| ---- | ---- | -------- |
| Step decay | 每 N epoch ×0.1 | CV 经典 |
| Cosine | lr 按余弦降至 0 | LLM 预训练 |
| Warmup | 前 1～2% 线性增 | Transformer 必备 |
| OneCycle | 先升后降 | 快速实验 |

GPT-3：warmup 375M token，峰值 lr 6e-4，随后 cosine 衰减至 10%——总 schedule 与 **总训练步数** 绑定。

## 二阶方法与现状

**L-BFGS**、**自然梯度** 用曲率信息，小模型有效；亿级参数 LLM 存 Hessian 不现实。**Adam 是一阶自适应** 的实用折中。研究中的 **Sophia**、**Shampoo** 等尝试更省的二阶近似，尚未完全取代 AdamW。

## ZeRO 与优化器分片

175B 模型 Adam 状态 1.4TB+。**ZeRO-1/2/3** 把 optimizer state、梯度、参数分片到多 GPU，使「能训起来」成为工程问题而非算法问题（第七章分布式）。

## 何时仍选 SGD

ImageNet **ResNet 微调**、**对比学习**（SimCLR）等 recipe 常用 **SGD + momentum 0.9 + cosine lr**，泛化 folklore 略优于 Adam（非绝对）。**大批量**（batch 8192+）时 LARS/LAMB 扩展 SGD 到 giant batch。

**Adam 超参敏感点**：$\beta_2=0.999$ 使 $v_t$ 对早期梯度方差估计偏置——**warmup** 前几 hundred steps 用小 lr 让 $v$ 稳定。$\epsilon$ 过小（1e-8）在 float16 下可能除零；bf16 训练有时用 1e-6。

**Weight decay 解耦**：AdamW 的 decay 直接 shrink 权重，不等价于 L2 正则进 loss——LLM 训练 **wd=0.1** 是常见强正则。

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

Adam 论文 2015 年与 BatchNorm、ResNet 同期，合称深度学习「稳定训练三件套」之一。

本章各篇互有引用，建议开侧边栏按顺序阅读，形成完整知识链。

Lookahead 等 wrapper 在 Adam 外再包一层 slow weights，研究用，工业少见。

微调 LLM 时 AdamW 学习率常比预训练小一个数量级（如 1e-5 对 3e-4）。

SGD  momentum 0.9 意味着当前梯度占一成、历史动量占九成。

## 小结

SGD：简单、可泛化；Adam/AdamW：自适应、收敛快，LLM 默认。训练闭环 = forward + backward + **optimizer.step()** + **zero_grad()**。

→ 下一篇：[从感知机到深度网络](/manual/llm/bit-to-agi/04-neural-networks/from-perceptron-to-deep)
