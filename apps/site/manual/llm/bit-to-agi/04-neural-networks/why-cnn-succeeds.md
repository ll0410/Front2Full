---
title: "CNN 为什么成功"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · CNN 为什么成功"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/why-cnn-succeeds"
---

# CNN 为什么成功

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · CNN 为什么成功

把 224×224 彩色图展平成 150,528 维向量再喂给 MLP，第一层权重矩阵就要 150528×H——参数量与计算量都不可接受。CNN 用**局部连接**和**权重共享**，把「平移不变性」写进结构，在 ImageNet 上统治了 2012–2020 年代。

## 直觉

认猫不需要逐像素独立学：左耳尖的「弧边」模式在图里任何位置都可能出现，且用的是**同一套**检测模板。卷积核就像滑动的小窗口滤镜：扫过全图，同一组权重在不同位置复用——看见一次「弧边」模板，处处都能用。

MLP 对每个像素单独连权重；CNN 假设：**局部相关 + 平移不变**。

## 定义

**2D 卷积**（单通道、单核）：

$$
(\mathbf{I} * \mathbf{K})_{i,j} = \sum_{m}\sum_{n} \mathbf{I}_{i+m,\,j+n} \cdot \mathbf{K}_{m,n}
$$

- $\mathbf{I}$：输入特征图，$H \times W$
- $\mathbf{K}$：卷积核，$k \times k$（常见 3×3）
- **步幅 stride** $s$、**填充 padding** $p$ 决定输出尺寸

输出高宽（无 dilation）：

$$
H_{\text{out}} = \left\lfloor \frac{H + 2p - k}{s} \right\rfloor + 1
$$

**通道**：$C_{\text{in}}$ 个输入通道，$C_{\text{out}}$ 个核 → 参数量 $C_{\text{out}} \times C_{\text{in}} \times k \times k + C_{\text{out}}$（含 bias）。

## 例子

**例 1：3×3 卷积参数量 vs 全连接**

输入 $32 \times 32 \times 3$，输出 64 通道，核 3×3：

- **卷积**：$64 \times 3 \times 3 \times 3 + 64 = \mathbf{1,792}$ 参数
- **等价全连接**（每个输出像素独立）：$64 \times (32 \times 32 \times 3) \approx \mathbf{196,608}$ 仅一个输出位置；全图更爆炸

**例 2：输出尺寸**

$H=W=32$, $k=3$, $p=1$, $s=1$：

$$
H_{\text{out}} = \lfloor (32 + 2 - 3) / 1 \rfloor + 1 = 32
$$

「same」填充保持尺寸；$s=2$ 则 $H_{\text{out}}=16$（下采样）。

**例 3：边缘检测核**

```python
import numpy as np

image = np.array([[0, 0, 0, 100, 100],
                  [0, 0, 0, 100, 100],
                  [0, 0, 0, 100, 100]], dtype=float)

sobel_x = np.array([[-1, 0, 1],
                    [-2, 0, 2],
                    [-1, 0, 1]])

def conv2d_valid(I, K):
    kh, kw = K.shape
    out = np.zeros((I.shape[0]-kh+1, I.shape[1]-kw+1))
    for i in range(out.shape[0]):
        for j in range(out.shape[1]):
            out[i, j] = (I[i:i+kh, j:j+kw] * K).sum()
    return out

print(conv2d_valid(image, sobel_x)[0, 0])  # 竖边处响应大
```

**例 4：AlexNet 量级**

227×227×3 输入，首个 11×11 卷积 96 通道：参数 $96 \times 3 \times 11 \times 11 \approx 34\text{K}$；若 FC 直连像素则千万级起步。

## 量化

| 架构（示意） | 参数量 | Top-1（ImageNet） |
| ------------ | ------ | ----------------- |
| AlexNet      | ~61M   | ~57%（2012 突破） |
| ResNet-50    | ~25M   | ~76%              |
| ViT-Base     | ~86M   | ~81%（结构换 Attention） |

- 单层 3×3 conv，$C_{\text{in}}=256, C_{\text{out}}=256, H=W=56$：MAC ≈ $256 \times 256 \times 9 \times 56^2 \approx 1.9 \times 10^9$ /层
- **感受野**：堆 $L$ 层 3×3，有效视野 $\approx 1 + 2L$（same pad）；深网可看全局

::: info

2020 年后 ViT 把图像切成 patch 用 Transformer，但 patch embedding 仍可看作「大步幅卷积」。CNN 的局部先验在数据少时仍更样本高效。

:::

## 常见误区

1. **「卷积核在学习图像块」**——学的是**响应模式**（边、纹理、部件），不是存 patch 副本。
2. **「池化必不可少」**——stride conv 可替代 max pooling；ResNet 后期少用 pooling。
3. **「CNN 只能做图像」**——1D CNN 用于文本/音频；2D 用于频谱图。

## 动手试一试

统计两层 3×3 stack 的感受野：

```python
def receptive_field(layers_kernel_sizes, strides):
    rf = 1
    jump = 1
    for k, s in zip(layers_kernel_sizes, strides):
        rf += (k - 1) * jump
        jump *= s
    return rf

# 三个 3×3, stride 1
print(receptive_field([3, 3, 3], [1, 1, 1]))  # 7
```

## 1×1 卷积与深度可分离卷积

**1×1 conv** 不改变空间尺寸，只在通道维混合——等价于对每个像素做小型 MLP，用于降维/升维（ResNet bottleneck 的「压缩-卷积-扩展」）。

**Depthwise Separable Conv**（MobileNet）：先逐通道 3×3，再 1×1 点卷积。参数量从 $C_{\text{out}} C_{\text{in}} k^2$ 降到 $C_{\text{in}} k^2 + C_{\text{out}} C_{\text{in}}$。MobileNetV1 在 ImageNet 上参数量 **4.2M** vs 同精度更大 CNN **~20M+**。

## ViT 与 CNN 的折中

Vision Transformer 把图像切成 $16 \times 16$ patch（224 图 → 196 token），patch embedding 可写成 **stride=16 的 conv**。Hybrid 模型前几层用 CNN 提局部特征，后面接 Transformer——说明 CNN 的局部先验在**数据中等规模**时仍省样本。

## 池化与下采样

**Max Pooling** 2×2 stride 2：空间减半、通道不变，提供 **局部平移不变性** 的硬编码。**Global Average Pooling** 在最后把 $H \times W \times C$ 压成 $C$ 维——减少 FC 参数，ResNet 标配。

**感受野计算**：堆 $L$ 层 3×3 same conv，感受野 $1+2L$；若中间有 pool stride 2，跳跃倍增——设计网络时要算 **最深语义层能看多大原图区域**。

**数据增强** 与 CNN 共生：随机 crop/flip 扩增有效样本，ImageNet 训练标配——与 [过拟合](/manual/llm/bit-to-agi/04-neural-networks/overfitting-and-regularization) 章节联动。

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

CNN 成功因为：**参数共享**降参数量、**局部连接**匹配图像统计、**层次结构**从边到语义。它是结构归纳偏置的教科书案例；LLM 时代 CNN 让位给 Attention，但视觉与小数据场景仍不可替代。

→ 下一篇：[RNN 为什么消失](/manual/llm/bit-to-agi/04-neural-networks/why-rnn-vanishes)
