---
title: "训练侧的花样 · MTP、FP8、Muon"
description: "两个模型架构图一模一样，训练方式也能拉开差距。看不改推理样子、却决定“训得多快多省多好”的三个花样：DeepSeek 的多 token 预测（MTP）与 DSpark、FP8/FP4 低精度训练，以及 Kimi 大规模押注的 Muon 优化器。"
source: "https://daiw.org/manual/llm-anatomy/training-tricks"
---

# 训练侧的花样 · MTP、FP8、Muon

> 两个模型架构图一模一样，训练方式也能拉开差距。看不改推理样子、却决定“训得多快多省多好”的三个花样：DeepSeek 的多 token 预测（MTP）与 DSpark、FP8/FP4 低精度训练，以及 Kimi 大规模押注的 Muon 优化器。

前面几章拆的都是“模型长什么样”。但有一类差异，**在架构图上根本看不见**——它藏在**怎么训练**里。两个结构一模一样的模型，训练方式不同，成本和质量能差出一大截。这一章挑三个有代表性的花样。它们有个共同点：**不改变模型主干推理时的样子，只影响“训得多快、多省、多好”。**

## MTP（与 DSpark）：一次预测好几个 token

回忆 [nanoGPT 的训练](https://daiw.org/manual/nanogpt/model-overview)：每个位置，模型只预测**下一个** token，和真实答案比、算 loss。这是几十年的标准做法。

**多 token 预测（Multi-Token Prediction，MTP）** 问：为什么一次只预测一个？**让每个位置同时预测未来好几个 token 呢？** 加几个额外的预测头，一个管“下一个”、一个管“下下个”……

**Gloeckle et al.（Meta，2024）** 证明这么做有两重好处：

1. **样本效率更高**：逼模型“往前多想几步”，学到的表示更有规划性，同样的数据能学得更好；
2. **推理还能白捡个加速**：那些“预测未来”的头，天然适合做**投机解码（speculative decoding）**——先让它一口气猜几个，再让主模型验证，验证通过就一次吐好几个，生成变快。

**DeepSeek-V3 把 MTP 用作训练目标**（预测未来 2 个 token），既提升了主模型质量，又为推理留了投机解码的抓手；[Qwen3.8-Max](https://daiw.org/manual/qwen3-8-max/architecture) 也继承了单步 MTP 头。而到了 2026 年的 [DeepSeek V4.1-Flash](https://daiw.org/manual/deepseek-v4-flash/engram-dspark)，团队干脆把链式串行的 MTP 替换成了参数量仅 **4.3B** 的单层全稠密并行草稿头 **DSpark**——它直接复用目标解码器最后一层的隐藏状态和 KV 缓存，一次前向并行吐出最多 16 个候选 token，单批次解码吞吐提升可达 3.93 倍（官方报告）。

## FP8（与原生 FP4）：用低精度把训练和推理成本砍半

模型训练要在**数值精度**和**成本**之间权衡。大多数早期模型用 **bf16 / fp16**（16 位浮点）训练。DeepSeek-V3 更进一步：**大部分计算用 FP8（8 位浮点）**。

这是什么概念？**位数减半，显存和带宽的压力就大致减半**——对一个 671B、烧几百万美元电费的训练来说，这是实打实的省钱。但 FP8 极难驾驭：**8 位能表示的数值范围窄得可怜**，稍不留神就“精度不够、数值溢出/归零”，训练直接崩。

DeepSeek-V3 的贡献，是把 FP8 训练**在 671B 这个规模上真正跑通了**：靠**细粒度的分块缩放**（不同区块各自选合适的数值范围）等一整套精细手艺，把精度损失压到可接受。

到了 2026 年，伴随着 NVIDIA Blackwell（B200/GB200）硬件普及，各家进一步把战线推到了 **4 位浮点（FP4 / MXFP4）**：
- [DeepSeek V4.1-Flash](https://daiw.org/manual/deepseek-v4-flash/fp8-fp4) 原生支持 **FP4 KV 缓存**与 **NVFP4 权重量化**；
- [Qwen3.8-Max](https://daiw.org/manual/qwen3-8-max/open-weights) 发布即提供官方原生 **FP8** 权重（`Qwen3.8-2.4T-A95B-FP8`）；
- [Kimi K3 / K3.1 Pro](https://daiw.org/manual/kimi-k3/deploy) 则在预训练末段引入量化感知训练（QAT），把占全模型参数绝大部分的 896 个路由专家直接发布为原生 **MXFP4**（4-bit 微缩放浮点），让 2.8T 参数的巨无霸能装进单台 8×B200 节点。

::: info

把 DeepSeek 的省钱账拼起来看，特别能说明“差异是叠出来的”：**MLA / CSA2**（省 KV 缓存）+ **细粒度 MoE**（省激活算力）+ **无辅助损失均衡**（不牺牲质量地均衡）+ **FP8 / FP4**（省训练与推理精度成本）+ **MTP / DSpark**（提样本效率与解码吞吐）。没有哪一招是“银弹”，是这一串选择**共同**造就了“又强又便宜”。读架构，读的就是这种组合拳。

:::

## Muon：换个优化器，赌“更聪明的每一步”

几乎所有 LLM 都用 **AdamW** 优化器（nanoGPT 也是，那个专栏会逐行讲它）。它久经考验，是默认中的默认。

**Muon（Keller Jordan et al.，2024）** 是个新优化器，思路是**对参数更新做“正交化”**（用 Newton-Schulz 迭代把动量矩阵近似正交化），让每一步更新的“方向”更有效、信息利用更充分——**同样的步数，走得更远、更准**。

它的分水岭时刻是 **Kimi K2（Moonshot，2025）**：**第一次在 1T 参数这种超大规模、生产级训练里押注 Muon**（此前 Muon 只在 ~16B 级别验证过）。到了 2026 年的 **[Kimi K3](https://daiw.org/manual/kimi-k3/pretrain-scaling)**，Moonshot 进一步用 Muon 配合 QK-Clip 和 Token 预算迁移定律，把模型规模一举推上了 **2.8T 总参数**。这是一个很干脆的赌注：**与其堆更多重复 token，不如用更聪明的二阶正交化优化器，把每一步的样本效率榨干。**

Muon 能不能像 AdamW 那样成为全行业默认，还得时间检验。但它代表了一个常被忽视的差异轴：**优化器**——模型架构之外，“怎么走下山”这件事本身，也是各家可以下注的地方。

## 小结：看不见，但很关键

这三个花样——MTP / DSpark、FP8 / FP4、Muon——都不改变主干推理的计算图，却分别动了**训练目标与投机头、数值精度、优化器**。它们提醒我们：

> **“模型架构”只是故事的一半。同一副骨架，用不同的目标、精度、优化器去训，得到的成本和质量可以天差地别。**

架构维度和训练维度都铺开了。还剩最后一撮“小执念”——宽还是深、注意力里那个古老的 bias、attention sink、词表大小——它们各自不大，但凑起来也是各家的指纹。这是收尾前的最后一块拼图。👉 [宽还是深，以及那些小执念](/manual/llm/llm-anatomy/width-depth-quirks)

## 参考文献

- [1] Gloeckle et al. (Meta). “Better & Faster Large Language Models via Multi-token Prediction.” 2024. arXiv:2404.19737. —— MTP。
- [2] DeepSeek-AI. “DeepSeek-V3 Technical Report.” 2024. arXiv:2412.19437. —— MTP 训练目标 + FP8 大规模训练。
- [3] Micikevicius et al. “Mixed Precision Training.” ICLR 2018. arXiv:1710.03740. —— 混合精度训练的基础。
- [4] Liu et al. (Moonshot AI). “Muon is Scalable for LLM Training.” 2025. arXiv:2502.16982. —— Muon 的大规模可扩展性（Kimi K2/K3 背景）。
- [5] Loshchilov & Hutter. “Decoupled Weight Decay Regularization (AdamW).” ICLR 2019. arXiv:1711.05101. —— 作为对照的主流优化器。
