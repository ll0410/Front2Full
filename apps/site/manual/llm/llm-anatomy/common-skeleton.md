---
title: "共同骨架 · 先看它们有多像"
description: "对比之前，先把不变的部分讲清：现代开源大模型共享同一套 decoder-only 骨架（RoPE + RMSNorm + Pre-Norm + SwiGLU），它们相对 GPT-2 的升级早已“达成共识”。真正还在分歧的，只有六个维度——本章给出总览地图。"
source: "https://daiw.org/manual/llm-anatomy/common-skeleton"
---

# 共同骨架 · 先看它们有多像

> 对比之前，先把不变的部分讲清：现代开源大模型共享同一套 decoder-only 骨架（RoPE + RMSNorm + Pre-Norm + SwiGLU），它们相对 GPT-2 的升级早已“达成共识”。真正还在分歧的，只有六个维度——本章给出总览地图。

要看清差异，得先看清**共性**。不然你会把“大家都这么做”的东西，误当成某家的独门绝技。

这一章不讲任何一家的“绝活”，只做一件事：**把 Qwen、Llama、DeepSeek、GLM 们共享的那副骨架摆出来**。看完你会有个踏实的底：它们八成的结构，你在 nanoGPT 里已经读过了。

## 一句话：全是 decoder-only 的“续写机”

不管参数是 7B 还是 671B，今天主流的开源大模型，**架构范式高度统一**：

- **decoder-only**：没有编码器，就是一摞 Transformer Block 从头叠到尾（和 nanoGPT 的 `GPT` 一模一样）。
- **自回归 + 因果掩码**：预测下一个 token，只能看左边——就是你在[注意力那章](https://daiw.org/manual/nanogpt/attention)里啃过的那道下三角掩码。
- **一个 Block = 注意力 + 前馈**，两个子层各带一个归一化、各套一条残差。

换句话说，**nanoGPT 那张数据流图，拿去描述 DeepSeek-V3 的一个 Block，大体还是对的**。区别不在“有没有这些零件”，而在“这些零件各自换成了什么型号”。

::: info

**2026 年的演进补记：连这副“共同骨架”也开始松动了**。到了 2026 年的前沿旗舰，连“从头到尾一模一样的 decoder-only 堆叠”和“单车道残差流”这两条铁律都出现了突破：
- **编码-解码分工（CED）与条件记忆**：[DeepSeek V4.1-Flash](https://daiw.org/manual/deepseek-v4-flash/ced) 把 40 层主干拆成 **20 层编码器 + 20 层解码器**，预填充跑满 40 层、自回归生成只跑后 20 层解码器，还在第 2、14 层挂上了 99B 的 **Engram** 哈希查表记忆；
- **跨层残差路由**：[DeepSeek V4.1-Flash 的 Single-Pass mHC](https://daiw.org/manual/deepseek-v4-flash/mhc) 把残差流扩成 4 条并行流，[Kimi K3 的 AttnRes](https://daiw.org/manual/kimi-k3/attn-res) 则让深层通过深度方向的 softmax 注意力直接回看浅层块表征。

:::

## 相对 GPT-2，有四处“已经达成共识”的升级

nanoGPT 复刻的是 2019 年的 GPT-2。从那时到现在，有四个地方，**几乎所有现代模型都做了同样的升级**——这些是“已经有标准答案”的问题，不再是分歧点：

| 零件 | GPT-2 / nanoGPT 的老做法 | 现代标配 | 为什么换 |
| --- | --- | --- | --- |
| **位置编码** | 学习式绝对位置嵌入（`wpe` 查表） | **RoPE**（旋转位置编码） | 相对位置、能外推到更长上下文 |
| **归一化** | LayerNorm（减均值、除方差） | **RMSNorm**（只除均方根） | 少算一个均值，更快，效果不掉 |
| **前馈激活** | GELU 的普通 MLP | **SwiGLU**（门控 + SiLU） | 同算力下效果更好，已成默认 |
| **偏置项 bias** | Linear / LayerNorm 都带 bias | 大多**去掉 bias** | 省参数、略快、还略稳（nanoGPT 也提到了） |

::: info

这张表值得记牢：**当你读到某个新模型“用了 RoPE + RMSNorm + Pre-Norm + SwiGLU”，不必激动——那是 2024 年起的“出厂设置”，不是创新。** 真正的创新，藏在下面那六个还没有标准答案的维度里。

:::

顺带一提，Pre-Norm（把归一化放在子层**前面**）也基本成了默认——它比 GPT 原版的 Post-Norm 训练更稳。但注意，**“归一化到底放哪儿”其实还没完全盖棺定论**，这正是我们后面要单独对比的一维（OLMo 2 就偏要放回后面）。

## 于是，真正的“战场”只剩六个维度

把上面这些共性摁住，各家大模型真正分道扬镳的地方，收拢起来其实**就六个**。这也是本专栏后面每一章的锚点：

| # | 维度 | 核心问题 | 谁在这儿下了不同的注 |
| --- | --- | --- | --- |
| 1 | **注意力 / KV 缓存** | 推理时怎么省下键值缓存的显存？ | Llama/Qwen 用 GQA，DeepSeek 用 **MLA / CSA2**，Gemma/GPT-OSS 加**滑动窗口**，Qwen3.8/Kimi K3 上 **3:1 线性混合注意力** |
| 2 | **前馈：稠密 vs MoE** | 要不要把前馈拆成一堆“专家”稀疏激活？ | DeepSeek/Llama4/GLM/Kimi 上 **MoE**，中小模型多留**稠密** |
| 3 | **MoE 的配方** | 专家多而小还是少而大？要不要共享专家？ | DeepSeek“多而小 + 共享”，Llama4“少而大”，Qwen3“砍掉共享”（Qwen3.8 又加回），Kimi K3“潜空间 LatentMoE” |
| 4 | **归一化的位置** | Norm 放子层前、后，还是前后都放？ | 多数 **Pre**，OLMo 2 用 **Post**，Gemma 用**三明治**；QK-Norm 与注意力输出门控渐成标配 |
| 5 | **长上下文** | RoPE 怎么外推到几十万乃至百万 token？ | YaRN + Partial RoPE 为主，也有 **NoPE** 的激进实验 |
| 6 | **训练侧与小执念** | 训练目标、精度、宽深、bias… | DeepSeek 的 **MTP / DSpark / FP8 / FP4**；Kimi K2/K3 的 **Muon + MXFP4**；GPT-OSS 的**宽**与 **attention sink** |

::: warning

别被这张表吓到——它不是要你现在就记住每一格。它是一张**地图**：接下来每一章，我们会走进其中一格，把那一列的对比讲透。读完整个专栏再回看这张表，你会发现每一格都变成了你脑子里清晰的一段故事。

:::

## 一个提醒：这些维度不是孤立的

六个维度里，**前两条（注意力、MoE）是绝对的主角**——它们直接决定“这个模型推理时要烧多少显存、多少算力”，也是各家技术报告里着墨最多的地方。后面几条更像“配平”的细节，重要，但不改变大局。

所以本专栏的顺序也照此安排：**先啃两条主线（省 KV 缓存、稀疏化），再收拾其余维度，最后给每个模型画张脸谱、汇一张总表。**

骨架看清了，共识划走了，战场也圈定了。下一章，我们踏进第一个、也是最重要的战场——**注意力**。你会看到 MHA、MQA、GQA、MLA 这一串缩写，其实是同一个问题（“KV 缓存太占显存”）的一串越来越聪明的答案。👉 [注意力：从 MHA 到 MQA、GQA、MLA](/manual/llm/llm-anatomy/attention-mha-gqa-mla)

## 参考文献

- [1] Su et al. “RoFormer: Enhanced Transformer with Rotary Position Embedding.” 2021. arXiv:2104.09864. —— RoPE。
- [2] Zhang & Sennrich. “Root Mean Square Layer Normalization.” NeurIPS 2019. arXiv:1910.07467. —— RMSNorm。
- [3] Shazeer. “GLU Variants Improve Transformer.” 2020. arXiv:2002.05202. —— SwiGLU。
- [4] Xiong et al. “On Layer Normalization in the Transformer Architecture.” ICML 2020. arXiv:2002.04745. —— Pre-Norm 相对 Post-Norm 的训练稳定性。
- [5] Radford et al. “Language Models are Unsupervised Multitask Learners.” 2019. —— GPT-2，本专栏的“老做法”基准。
- [6] Raschka, S. “The Big LLM Architecture Comparison.” 2025. https://magazine.sebastianraschka.com/p/the-big-llm-architecture-comparison —— 本专栏的对比框架与多处架构事实的主要参考。
