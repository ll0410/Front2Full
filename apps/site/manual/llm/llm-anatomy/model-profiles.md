---
title: "四张脸谱 · DeepSeek / Llama / Qwen / GLM 的组合拳"
description: "把散落在各维度的选择收拢成整体——DeepSeek 的“效率最大化”、Llama 的“务实标准派”、Qwen 的“多语言 + 实用主义”、GLM 的“借力 DeepSeek、稳字当头”，以及 2026 年三大旗舰（DeepSeek V4.1-Flash、Qwen3.8-Max、Kimi K3）的架构进化。"
source: "https://daiw.org/manual/llm-anatomy/model-profiles"
---

# 四张脸谱 · DeepSeek / Llama / Qwen / GLM 的组合拳

> 把散落在各维度的选择收拢成整体——DeepSeek 的“效率最大化”、Llama 的“务实标准派”、Qwen 的“多语言 + 实用主义”、GLM 的“借力 DeepSeek、稳字当头”，以及 2026 年三大旗舰（DeepSeek V4.1-Flash、Qwen3.8-Max、Kimi K3）的架构进化。

前面我们一直“横切”——一维一维地对比。这一章反过来“竖看”：把每个模型散落在各维度的选择**收拢成一个整体**，看它作为一个“人”的性格。你会发现，**每个模型的风格，不是某一个绝招，而是一连串取舍叠出来的组合拳。**

## DeepSeek（V3 → V4.1-Flash）：效率最大化的偏执狂

**一句话性格：每一个选择，都在问“怎么用更少，办更多”。**

把 DeepSeek-V3 的选择连起来看，主题惊人地一致：

- **MLA**：把 KV 缓存压到比 GQA 还小，质量还反超 MHA；
- **细粒度 MoE**（256 专家 / 激活 8+1、含共享专家）：极致专精，671B 只激活 37B；
- **无辅助损失均衡**：不牺牲质量地解决 MoE 负载；
- **前 3 层稠密**：稳住训练地基；
- **FP8 训练 + MTP**：把训练成本和样本效率再榨一道。

到了 2026 年的 **[DeepSeek V4.1-Flash](https://daiw.org/manual/deepseek-v4-flash)**，这种“抠门到极致”的效率哲学更是武装到了牙齿：把 40 层切成 **20 层编码器 + 20 层解码器（CED）**，解码算力直接减半；用 **CSA2** 跨层共享 FP4 KV 缓存，把每 token 缓存从 70.3 KB 砍到 **890 字节**；把死记硬背的知识剥离给可卸载到内存的 99B **Engram** 查表记忆；再用 4.3B 的并行草稿头 **DSpark** 替代串行 MTP。

::: info

**签名动作：MLA / CSA2 + 极致软硬协同。** DeepSeek 证明了“顶尖大模型”和“训得起、跑得起”不矛盾——靠的不是某一招，而是**省 KV 缓存、省激活、省精度、省串行步数**这一整套叠满 buff 的组合。它是这份名单里旗帜鲜明的“效率派”。

:::

## Llama（3 → 4）：务实的标准制定者

**一句话性格：不追新奇，把成熟方案做扎实，顺手定义“默认”。**

- **Llama 3**：一个**教科书级的稠密 GQA 模型**——RoPE、RMSNorm、Pre-Norm、SwiGLU、无 bias，干净、标准、开放。它某种程度上就是本专栏[“共同骨架”](/manual/llm/llm-anatomy/common-skeleton)那张表的活标本，也是无数模型的对标基线。
- **Llama 4**：转向 **MoE**，但走的是**保守路线**——8 个大专家、激活 2 个、无共享专家、MoE 与稠密层交替。相比 DeepSeek 的“多而小”，Llama 4 是“少而大”的经典派。

::: info

**签名动作：定义默认。** Llama 的价值常不在“最先”，而在“最稳、最开放、最好复现”。它是那种“你不确定该怎么选时，照它抄准没错”的标准件。

:::

## Qwen（2.5 → 3 → 3.8-Max）：多语言底色，务实应变

**一句话性格：为多语言（尤其中文）而生，一切服从当前规模下的实测收益。**

- **大词表（152K → 248K）**：覆盖中文/多语言/代码更好——这是它“服务谁”写在脸上的印记；
- **Qwen2 给 QKV 加回 bias**：为长度外推；
- **QK-Norm、偏深的结构**：求稳、求抽象深度；
- **共享专家的取舍**：Qwen3（128 专家）觉得共享专家收益不明，主动砍掉图简单；到了 2026 年的 **[Qwen3.8-Max](https://daiw.org/manual/qwen3-8-max)**（2.4T 总参数、512 路由专家选 10），在超细粒度稀疏下**果断把 1 个共享专家请了回来**，并换上 **3:1 Gated DeltaNet + Gated Attention** 混合栈。

::: info

**签名动作：不教条的实用主义。** 在 128 专家时它敢砍共享专家，在 512 专家时它又敢加回来——Qwen 的判断从不拘泥于口号，一切服从“在我这一代配方和规模下，到底值不值”。

:::

## GLM（4.5）：借力打力，稳字当头

**一句话性格：把别人验证过的好东西拿来，拼一套稳的。**

- **MoE + 共享专家**、**前几层稠密**：这两招**明说借鉴自 DeepSeek**——“大 MoE 里，稠密的头几层能改善收敛稳定性”；
- **GQA + QK-Norm**：主流稳妥组合；
- **保留了 GPT-2 时代的注意力 bias**：一点传承的执念。

::: info

**签名动作：站在巨人肩上求稳。** GLM-4.5 不追求哪一维“最激进”，而是把 DeepSeek 等验证过的稳定性设计**组装**起来，做一个可靠的大 MoE。它代表了一种健康的工程心态：**创新不必事事原创，把对的东西拼对，也是本事。**

:::

## 2026 进阶加映：Kimi（K2 → K3 / K3.1 Pro）的算法破局派

如果看完上面四家，再看 Moonshot 的 **[Kimi K3 / K3.1 Pro](https://daiw.org/manual/kimi-k3)**（2.8T 总参数、104B 激活），你会看到第五种鲜明的性格：**用优化器与线性代数重写扩展律**。

- **3:1 KDA + Gated MLA / Gated DSA**：69 层通道级遗忘门线性注意力 + 24 层全局/动态稀疏注意力；
- **LatentMoE**：把 token 先压到 3,584 维潜空间再走 896 选 16 路由，跨卡 All-to-All 通信砍半；
- **AttnRes**：用跨层 softmax 注意力残差取代用了十年的固定加法残差；
- **Muon + 原生 MXFP4**：把二阶正交化优化器和 4-bit 微缩放浮点推上 2.8T 规模。

## 五张脸谱，一张对照

| 模型家族 | 注意力代表方案 | 前馈代表方案 | 签名性格 | 深度专题 |
| --- | --- | --- | --- | --- |
| **DeepSeek（V3 → V4.1-Flash）** | **MLA → CSA2（跨层共享 FP4）** | 细粒度 MoE（256/8+1 → 384/6+1）+ Engram | 效率最大化 | [《DeepSeek V4.1 Flash 深度解析》](https://daiw.org/manual/deepseek-v4-flash) |
| **Llama（3 → 4）** | GQA | 3 稠密 → 4 转 MoE（8/2，大，无共享） | 务实标准派 | — |
| **Qwen（2.5 → 3 → 3.8-Max）** | GQA → **3:1 Gated DeltaNet + Gated Attn** | 128/8（无共享）→ **512/10+1（请回共享）**，大词表 | 多语言 + 实用主义 | [《Qwen3.8-Max 深度解析》](https://daiw.org/manual/qwen3-8-max) |
| **GLM（4.5）** | GQA + QK-Norm | MoE（共享 + 前几层稠密，借鉴 DeepSeek） | 借力求稳 | — |
| **Kimi（K2 → K3 / K3.1 Pro）** | MLA → **3:1 KDA + Gated MLA / DSA** | **LatentMoE（896/16+2，潜空间路由）** | 优化器与算法破局派 | [《Kimi K3 深度解析》](https://daiw.org/manual/kimi-k3) |

看到了吗？**同样的六个维度，五种填法，五种性格。** 这正是本专栏想让你获得的能力：拿到任何一个新模型的技术报告，你都能顺着这几个维度快速定位它“像谁、在哪儿下了不一样的注、为什么”。

最后一章，我们把所有维度汇成一张总表，并收束贯穿全篇的两条主线与几个大趋势，给这趟“解构之旅”画个句号。👉 [一张大表 + 趋势](/manual/llm/llm-anatomy/recap-and-trends)

## 参考文献

- [1] DeepSeek-AI. “DeepSeek-V3 Technical Report.” 2024. arXiv:2412.19437.
- [2] Grattafiori et al. (Meta). “The Llama 3 Herd of Models.” 2024. arXiv:2407.21783.
- [3] Qwen Team. “Qwen2.5 Technical Report.” 2024. arXiv:2412.15115.
- [4] Team GLM, Zhipu AI. “ChatGLM: A Family of Large Language Models from GLM-130B to GLM-4 All Tools.” 2024. arXiv:2406.12793.
- [5] Raschka, S. “The Big LLM Architecture Comparison.” 2025. https://magazine.sebastianraschka.com/p/the-big-llm-architecture-comparison
