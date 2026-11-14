---
title: "AI 大模型解构"
description: "拆开 Qwen、Llama、DeepSeek、GLM、Kimi 等主流开源大模型的“发动机盖”。"
source: "https://daiw.org/manual/llm-anatomy"
---

# AI 大模型解构

> 内容来源：[daiw.org](https://daiw.org/manual/llm-anatomy) · 作者 David（道雾轩） · 原文更新于 2026-11-06

> 拆开 Qwen、Llama、DeepSeek、GLM、Kimi 等主流开源大模型的“发动机盖”。

## 序 · 同一副骨架，各自的执念

读完 [nanoGPT 源码解读](https://daiw.org/manual/nanogpt)，你已经握着一件趁手的工具：**一个 GPT 的完整骨架**——词嵌入、一摞 Transformer Block（注意力 + 前馈）、输出层。现在把镜头拉到 2024–2026 年那些真正的开源大模型：Qwen、Llama、DeepSeek、GLM、Kimi……

**惊人之处不是它们多不一样，而是它们多一样。**

把 DeepSeek-V3、Llama 4、Qwen3、GLM-4.5 的架构图并排摆开，你会发现：decoder-only 的堆叠、RoPE 位置编码、RMSNorm、SwiGLU 风格的前馈、Pre-Norm 残差——**大同小异**，和你在 nanoGPT 里读到的几乎是同一套。真正把它们区分开的，是**少数几个位置上的不同下注**。而恰恰是这几处“执念”，决定了一个模型是省显存的、是便宜的、是能塞进你显卡的，还是只能跑在集群上的。

所以这个专栏做的事很明确：

> **做一次“受控对比”：把共同的骨架摁住不动，只把各家分道扬镳的那几个“零件”拎出来，一维一维地并排看——这一处，Llama 怎么选、DeepSeek 怎么选、Qwen 怎么选，以及为什么。**

## 方法：一维一章，把差异逼出来

讲架构最容易犯的错，是“一个模型一章”——讲完 Llama 讲 Qwen，讲完 Qwen 讲 DeepSeek。这样讲，差异是**散**的，你读完只记得一堆名字，记不住谁和谁到底差在哪。

本专栏反过来：**按“架构维度”切章**。每一章锁定一个可对比的轴——比如“注意力怎么省 KV 缓存”“前馈用稠密还是 MoE”“归一化放前面还是后面”——然后把所有模型在这个轴上的选择**拉成一排**，讲清楚每种选择解决什么问题、代价是什么、谁选了它。差异是被**逼出来**的，不是被罗列的。

## 两条主线，串起大半个故事

2024–2026 年的大模型创新，乍看五花八门，其实**大半在押注两件事**：

1. **省 KV 缓存** —— 推理时，注意力的键值缓存（KV cache）是显存杀手。于是有了 MHA → MQA → GQA → **MLA**（DeepSeek 的杀手锏）这一路演进，以及 Gemma、GPT-OSS 的**滑动窗口**；到了 2026 年，又进一步演化出 **3:1 线性注意力混合栈**（Kimi K3 / K3.1 Pro 的 KDA + Gated MLA / Gated DSA、Qwen3.8-Max 的 Gated DeltaNet + Gated Attention）和**跨层共享 FP4 KV 缓存**（DeepSeek V4.1-Flash 的 CSA2）。这条线，回答的是“怎么让模型推理时更省、更便宜”。
2. **稀疏化（MoE）** —— 把一个巨大的前馈层拆成几百个“专家”，每个 token 只激活其中几个。于是 671B 的 DeepSeek-V3 每步只算 37B，而 2026 年的万亿级旗舰（2.4T 的 Qwen3.8-Max、2.8T 的 Kimi K3 / K3.1 Pro）更是把总参数推到两万亿以上，每步仍只激活约 95B–104B。这条线，回答的是“怎么把参数堆到天上，又不让计算跟着爆炸”。

抓住这两条主线，你就抓住了这一代大模型的**主旋律**。其余的（归一化的位置、长上下文外推、训练目标的花样）是重要的配角。

## 路线图（共 13 篇）

**开篇**
- **共同骨架：先看它们有多像** —— 把“不变的部分”一次讲清，后面才好聚焦“变的部分”；并给出六个差异维度的总览地图。

**主线一 · 省 KV 缓存**
- **注意力：从 MHA 到 MQA、GQA、MLA** —— KV 缓存为什么是瓶颈，以及这一路“共享 / 压缩”的演进；DeepSeek 为什么偏偏选了最复杂的 MLA，以及 2026 年跨层 KV 共享与稀疏注意力的新进展。
- **滑动窗口：Gemma 与 GPT-OSS 的局部注意力** —— 用“只看附近”再省一刀，Mistral 为什么又把它去掉了，以及 2026 年滑动窗口有界重算与 3:1 线性注意力混合栈的接棒。

**主线二 · 稀疏化（MoE）**
- **稠密 vs 稀疏：MoE 为什么突然统治了大模型**
- **MoE 的三个旋钮：专家数、激活数、共享专家** —— DeepSeek 的“多而小 + 共享” vs Llama 4 的“少而大” vs Qwen3“砍掉共享专家”（以及 Qwen3.8-Max 为什么又把共享专家请了回来）。
- **让 MoE 训得稳、又均衡** —— 辅助损失 vs DeepSeek 的“无辅助损失均衡”，以及为什么头几层要保持稠密。

**其余关键维度**
- **归一化：RMSNorm、Pre / Post / 三明治、QK-Norm** —— 一个“放哪儿”的小选择，如何左右训练稳定性。
- **位置编码与长上下文：RoPE、YaRN，与 NoPE 的挑衅**
- **训练侧的花样：MTP 多 token 预测、FP8、Muon**
- **宽还是深，以及那些小执念** —— 宽深之争、注意力里的 bias、attention sink、词表大小。

**收尾**
- **四张脸谱：DeepSeek / Llama / Qwen / GLM 各自的组合拳**（附 2026 三大旗舰架构进阶对照）
- **一张大表 + 趋势** —— 把所有维度收进一张对比表，并收束两条主线。

## 说明：以“架构”为准，并与站内 2026 旗舰专栏联动

::: warning

开源模型迭代极快。本专栏聚焦**架构层面的本质选择**，以 2024–2025 年奠定格局的代表性版本为基准锚点（DeepSeek-V3、Llama 3/4、Qwen 2.5/3、GLM-4.5），并在各章末尾衔接 **2026 年三大旗舰的架构演进**。如果你想深入拆解 2026 年最新一代旗舰的完整技术细节，可以配合站内的三个专题专栏一起读：
- [《DeepSeek V4.1 Flash 深度解析》](https://daiw.org/manual/deepseek-v4-flash)（不对称 CED 20+20 架构、CSA2 跨层共享 FP4 KV 缓存、Engram 静态记忆、Single-Pass mHC 残差、DSpark 投机解码）
- [《Qwen3.8-Max 深度解析》](https://daiw.org/manual/qwen3-8-max)（2.4T-A95B、3:1 Gated DeltaNet + Gated Attention 混合栈、512 路由专家 + 1 共享专家）
- [《Kimi K3 深度解析》](https://daiw.org/manual/kimi-k3)（2.8T-A104B、3:1 KDA + Gated MLA / Gated DSA 混合栈、LatentMoE 潜空间专家、AttnRes 注意力残差、原生 MXFP4 + Muon）

:::

## 读之前，你最好有

- **读过 [nanoGPT 源码解读](https://daiw.org/manual/nanogpt)**（至少读到注意力那章）—— 我们默认你已经知道“一个标准 Transformer Block 长什么样”，本专栏只讲**它们在这之上改了什么**。
- 不需要读过任何一篇原论文；关键结论我们会讲清来龙去脉。

准备好了，先把“它们有多像”这件事看透——这样接下来每一处“不一样”才够扎眼：[共同骨架：先看它们有多像](/manual/llm/llm-anatomy/common-skeleton)。
