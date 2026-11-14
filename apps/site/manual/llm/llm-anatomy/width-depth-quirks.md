---
title: "宽还是深，以及那些小执念"
description: "收尾前的一撮“小差异”——同样的参数预算，做宽还是做深（GPT-OSS 与 DeepSeek V4.1-Flash 选宽矮、Qwen3/Qwen3.8 与 Kimi K3 选深）；注意力里那个被丢弃又被捡回的 bias；attention sink 与门控注意力；以及词表大小背后的多语言/成本权衡。个个不大，凑起来就是各家的指纹。"
source: "https://daiw.org/manual/llm-anatomy/width-depth-quirks"
---

# 宽还是深，以及那些小执念

> 收尾前的一撮“小差异”——同样的参数预算，做宽还是做深（GPT-OSS 与 DeepSeek V4.1-Flash 选宽矮、Qwen3/Qwen3.8 与 Kimi K3 选深）；注意力里那个被丢弃又被捡回的 bias；attention sink 与门控注意力；以及词表大小背后的多语言/成本权衡。个个不大，凑起来就是各家的指纹。

两条主线（注意力、MoE）是骨干，归一化、位置编码、训练侧是重要配角。最后这一章，收拢一撮**更小、更零碎的差异**。它们单个都不足以定生死，但凑在一起，就成了辨认一个模型的**指纹**——而且往往**暴露它为谁而生**。

## 宽还是深：同样的预算，两种花法

给定一个参数预算，你可以把它花在**宽**（更大的 `n_embd` 或单层专家数，每层更胖）或**深**（更多的层）上。各家做了截然相反的选择：

- **GPT-OSS（2025）与 [DeepSeek V4.1-Flash](https://daiw.org/manual/deepseek-v4-flash/spec-sheet)（2026）选“宽而矮”**：DeepSeek V4.1-Flash 主干总共只有 **40 层**（且自回归解码时只跑后 **20 层**解码器），隐藏维度为 6,144，把单步串行依赖压到极短，专门讨好低延迟高吞吐推理。
- **Qwen3 / [Qwen3.8-Max](https://daiw.org/manual/qwen3-8-max/spec-sheet) 与 [Kimi K3](https://daiw.org/manual/kimi-k3/spec-sheet) 选“深”**：Qwen3.8-Max 叠了 **92 层**（隐藏维度 6,144），Kimi K3 叠了 **93 层**（隐藏维度 7,168），靠近百层的深度换取多步抽象能力（Kimi K3 再用 AttnRes 跨层注意力残差缓解 93 层过深带来的稀释问题）。

各有各的道理：

| | 更宽（更矮） | 更深 |
| --- | --- | --- |
| 计算特点 | 每层内部矩阵大，**并行度高**、串行步数少 | 层层依赖，**串行步数多** |
| 速度 | 单步解码延迟低，整体推理常更快 | 层多，单步解码延迟偏高 |
| 能力倾向 | 适合 Flash / 高吞吐在线服务 | 更多层 = 更多次“抽象”，表达更深 |

**Gemma 2 的消融**发现：在相近预算下，**宽比深略占优**。但这不是铁律——Qwen 与 Kimi 的超大旗舰依然选深，赌的是“更多层带来的抽象深度”。这类选择没有标准答案，更多是**在自家的延迟目标、能力偏好和硬件上，选一个舒服的点**。

## 那个被丢弃又被捡回的 bias

回忆 nanoGPT：GPT-2 的 `Linear` 和 `LayerNorm` 都带 **bias（偏置项）**。而现代模型[大多把 bias 去掉了](https://daiw.org/manual/nanogpt/model-overview)——省参数、略快、还略稳。

但**总有例外**，而且很有意思：

- **Qwen2 偏偏给注意力的 Q、K、V 投影加回了 bias**。Qwen 团队认为这有助于**长度外推**（在比训练更长的上下文上表现更稳）。到了 Qwen3 与 Qwen3.8-Max，配合 QK-Norm 和注意力门控后，又把 `attention_bias` 设回了 `false`。
- **GLM、GPT-OSS 也保留了一些 GPT-2 时代的注意力 bias**——尽管近年有论文指出这些 bias 大多是冗余的。

一个“早就该丢掉”的老零件，曾被 Qwen 出于外推、被 GLM 出于传承各自留下来——**这类“逆共识的小坚持”，往往比随大流更能暴露一个团队的判断和口味。**

## Attention Sink：给注意力一个“泄洪口”

这是个特别有意思的观察。**StreamingLLM（Xiao et al.，2023）** 发现：训练好的模型，会把**大量注意力莫名其妙地倒给序列的第一个 token**。

为什么？因为 softmax 逼着注意力权重**必须加起来等于 1**——可有时候当前 token **谁都不特别想看**，这多出来的“注意力预算”总得有个地方倒。于是模型学会了拿**第一个 token 当“泄洪口 / 垃圾桶”**（称为 attention sink），把用不掉的注意力都堆那儿。这个 sink 看着没用，却至关重要：**流式推理时如果把开头几个 token 丢了，模型会突然崩坏**——因为泄洪口没了。

针对这个现象，业界演化出了两种解法：
- **GPT-OSS 给每个注意力头学一个专门的 sink 偏置项**，等于在 softmax 分母里**显式造一个虚拟泄洪口**；
- **2026 年的 [Qwen3.8-Max](https://daiw.org/manual/qwen3-8-max/architecture) 与 [Kimi K3](https://daiw.org/manual/kimi-k3/hybrid-stack) 则用“注意力输出 Sigmoid 门控”**：即使 softmax 被迫把权重分配给了某个 token，只要这一头没看到有用信息，输出前的 Sigmoid 门控直接置零，就不必再往第一个 token 上倒垃圾了。

## 词表大小：一个不起眼却真实的分歧

最后一个“小”差异，其实一点都不小：**词表（vocab）有多大**。

| 模型 | 词表大小（量级） |
| --- | --- |
| GPT-2 / nanoGPT | ~50K |
| Llama 3 | ~128K |
| DeepSeek-V3 / V4.1-Flash | ~129K |
| Kimi K2 / K3 | ~164K |
| **Qwen2.5 / Qwen3** | **~152K** |
| **Qwen3.8-Max** | **~248K**（`vocab_size = 248,320`） |

词表越大：

- **好处**：同一段文本被切成**更少的 token**（编码压缩率更高），对**多语言、代码、罕见字符**的覆盖更好——Qwen 从 152K 一路扩到 Qwen3.8-Max 的 **24.8 万词表**，和它覆盖全球多语言及提升长文本 token 密度的目标直接相关；
- **代价**：[输出层和词嵌入更宽](https://daiw.org/manual/nanogpt/model-overview)（参数、显存都涨）。

**词表大小，是“编码效率 / 多语言”和“词嵌入参数成本”之间一个朴素的权衡。** 它不酷，但它把“这个模型主要服务谁”写在了脸上。

## 小结：指纹凑齐了

宽深、bias、attention sink、词表——这些“小执念”个个不改大局，但每一个都在说一句话：**这个模型的团队，在这个不起眼的地方，做了个和别人不一样的选择，通常是为了它自己的目标（多语言？低延迟？流式长文本？）。** 把它们和前面的主线维度拼起来，你就有了辨认每个模型的**完整指纹**。

维度全部拆完了。接下来两章收尾：先给 DeepSeek、Llama、Qwen、GLM（以及 Kimi）各画一张“脸谱”，把它们散落在各维度的选择**收拢成一个整体**；再用一张大表 + 几条趋势，给整个专栏画上句号。👉 [四张脸谱：DeepSeek / Llama / Qwen / GLM 的组合拳](/manual/llm/llm-anatomy/model-profiles)

## 参考文献

- [1] Xiao et al. “Efficient Streaming Language Models with Attention Sinks.” ICLR 2024. arXiv:2309.17453. —— attention sink 的发现与利用。
- [2] Qwen Team. “Qwen2 Technical Report.” 2024. arXiv:2407.10671. —— QKV 加回 bias 以助外推。
- [3] Gemma Team, Google DeepMind. “Gemma 2.” 2024. arXiv:2408.00118. —— 宽/深权衡的消融。
- [4] Sennrich et al. “Neural Machine Translation of Rare Words with Subword Units (BPE).” ACL 2016. arXiv:1508.07909. —— 子词分词与词表。
- [5] Raschka, S. “The Big LLM Architecture Comparison.” 2025. https://magazine.sebastianraschka.com/p/the-big-llm-architecture-comparison —— 宽深、bias、sink 等横向对比。
