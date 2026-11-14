---
title: "一张大表 + 趋势"
description: "把 2024–2026 年代表性开源模型的所有维度收进一张对比表，再收束贯穿全篇的两条主线与几个大趋势——MLA 与 3:1 线性混合注意力上位、超细粒度 MoE 统治、共享专家的回归、QK-Norm 与输出门控成标配。读完你手里就有了一把“拆任何新模型”的尺子。"
source: "https://daiw.org/manual/llm-anatomy/recap-and-trends"
---

# 一张大表 + 趋势

> 把 2024–2026 年代表性开源模型的所有维度收进一张对比表，再收束贯穿全篇的两条主线与几个大趋势——MLA 与 3:1 线性混合注意力上位、超细粒度 MoE 统治、共享专家的回归、QK-Norm 与输出门控成标配。读完你手里就有了一把“拆任何新模型”的尺子。

走到终点。这一章不引入新东西，只做两件事：把散落各章的对比**汇成一张总表**，再把贯穿全篇的**主线与趋势**收个尾。

## 总表：一眼看全各家的下注

::: info

具体数字会随版本变；下表记的是**架构层面的选择倾向**。看的时候，盯着列（维度）竖着比，差异最扎眼。

:::

| 模型 | 注意力 | 位置 | 归一化与残差 | 前馈 | 签名 |
| --- | --- | --- | --- | --- | --- |
| **DeepSeek-V3**（2024） | **MLA** | 解耦 RoPE | RMSNorm · Pre | MoE 256/8**+1 共享** | MLA + FP8 + MTP，低成本 |
| **Llama 3**（2024） | GQA | RoPE | RMSNorm · Pre | 稠密 SwiGLU | 标准基线 |
| **Llama 4**（2025） | GQA | RoPE | RMSNorm · Pre | MoE 8/2 大 · 无共享 · 交替 | 少而大 |
| **Qwen3（稠密）**（2025） | GQA + QK-Norm | RoPE | RMSNorm · Pre | 稠密 SwiGLU · 152K 词表 | 偏深、多语言 |
| **Qwen3（MoE）**（2025） | GQA + QK-Norm | RoPE | RMSNorm · Pre | MoE 128/8 · **无共享** | 敢做减法 |
| **GLM-4.5**（2025） | GQA + QK-Norm | RoPE | RMSNorm · Pre | MoE · 共享 · **前几层稠密** | 借力 DeepSeek |
| **Gemma 3**（2025） | GQA + **滑窗 5:1** | RoPE | RMSNorm · **三明治** | 稠密 SwiGLU | 局部注意力省显存 |
| **Mistral Small 3.1**（2025） | GQA（**弃滑窗**） | RoPE | RMSNorm · Pre | 稠密 SwiGLU | 低延迟优先 |
| **OLMo 2**（2024） | **MHA** + QK-Norm | RoPE | RMSNorm · **Post** | 稠密 SwiGLU | 逆共识、全透明 |
| **GPT-OSS**（2025） | GQA + 滑窗 + **sink** | RoPE | RMSNorm · Pre | MoE · 无共享 | **宽** > 深 |
| **Kimi K2**（2025） | **MLA** | 解耦 RoPE | RMSNorm · Pre | MoE 384/8+1 共享 | 1T，**Muon** 优化器 |
| **[DeepSeek V4.1-Flash](https://daiw.org/manual/deepseek-v4-flash)**（2026） | **CSA2（跨层共享 FP4 KV + 稀疏）** | 解耦 RoPE + YaRN | RMSNorm · **Single-Pass mHC** | **CED 20+20** · MoE 384/6+1 · **Engram** | 890 B/tok KV + **DSpark** |
| **[Qwen3.8-Max](https://daiw.org/manual/qwen3-8-max)**（2026） | **3:1 Gated DeltaNet + Gated Attn** | 25% Partial RoPE + YaRN | RMSNorm + QK-Norm + 输出门控 | MoE 512/10**+1 共享（回归）** · 248K 词表 | 2.4T-A95B，线性混合栈 |
| **[Kimi K3 / K3.1 Pro](https://daiw.org/manual/kimi-k3)**（2026） | **3:1 KDA + Gated MLA / Gated DSA** | KDA NoPE + 解耦 RoPE | RMSNorm + **AttnRes** + 输出门控 | **LatentMoE 896/16+2**（潜空间） | 2.8T-A104B，Muon + **MXFP4** |

把这张表和第二章[“共同骨架”](/manual/llm/llm-anatomy/common-skeleton)那张“六维地图”对着看：**RoPE、RMSNorm、SwiGLU 在基础层面上高度统一，而真正的创新火力，几乎全部集中在“注意力怎么省 KV 缓存”和“前馈怎么把 MoE 做得更细、通信更省”这两列上。**

## 五个趋势

从这张跨越 2024–2026 年的大表里，能读出几条清晰的演进脉络：

1. **注意力：从 GQA 到 MLA，再到“3:1 线性混合”与“跨层共享 FP4 + 动态稀疏”。** GQA 仍是中小模型的默认，但在百万上下文旗舰上，单靠 GQA 已经不够看：要么像 DeepSeek V4.1-Flash 那样用 **CSA2** 把跨层 KV 共享、FP4 量化与动态稀疏结合起来，要么像 Qwen3.8-Max 和 Kimi K3 那样把 3/4 的层直接换成 $O(1)$ 状态的**线性注意力（Gated DeltaNet / KDA）**，只留 1/4 的全注意力或动态稀疏注意力（Gated DSA）负责全局精确定位。

2. **前馈：超细粒度 MoE 统治了前沿，总参数跨入 2T+ 时代。** 几乎所有大杯都转向 MoE，而且路由专家越切越细（256 → 384 → 512 → 896），激活比例压到 3.7%–5.7%。为了解决细粒度 MoE 的跨卡通信瓶颈，Kimi K3 提出了在低维潜空间里路由计算的 **LatentMoE**，DeepSeek V4.1-Flash 则用 **Engram** 把 99B 静态记忆从 MoE 矩阵乘里剥离出去。

3. **共享专家：在超细粒度下形成共识。** Qwen3 在 128 专家时曾主动砍掉共享专家，但到了 Qwen3.8-Max（512 专家选 10），又重新加回了 1 个常驻共享专家——说明当专家切得极碎时，常驻共享专家配细粒度路由专家是更稳健的组合。

4. **归一化与残差：QK-Norm 与注意力输出门控成标配，单车道残差被打破。** QK-Norm 与注意力输出 Sigmoid 门控成了万亿模型防爆梯度的标配；而 DeepSeek 的 **Single-Pass mHC** 与 Kimi K3 的 **AttnRes** 则证明，连沿用了十年的 `x + Sublayer(x)` 残差连接本身，也可以升级成多流或跨层注意力聚合。

5. **训练与推理精度：从 BF16 → FP8 → 原生 FP4 / MXFP4。** DeepSeek-V3 跑通了大规模 FP8 训练，而到了 2026 年，原生 FP4 KV 缓存与 MXFP4 专家权重（配合 QAT 和 Muon 优化器）已经成为让两万亿参数模型落地的标配。

## 两条主线，一句收束

如果整个专栏只让你带走一句话，就是这句：

> **2024–2026 年的开源大模型，是在同一副 Transformer 骨架上，围绕“省 KV 缓存”和“稀疏化 MoE”这两条主线不断突破极限的结果。** 前者决定它长上下文推理时多省，后者决定它参数能堆多高而算力不爆。其余维度（归一化、残差、位置、训练精度、小执念）围绕这两条主线做精密配平。

## 你带走的，是一把尺子

回到[序言](/manual/llm/llm-anatomy/)立的 flag：这个专栏不想让你“记住一堆模型名字”，而想给你**一把尺子**。现在你有了。下次任何一个新模型的技术报告拍到你面前，你可以顺着这几刀切下去：

- 注意力：MHA / GQA / MLA / CSA2 / Gated DSA？有没有滑窗或 3:1 线性注意力混合？
- 前馈：稠密还是 MoE？MoE 的话——专家多而小还是少而大？激活几个？有没有共享专家？有没有潜空间压缩或外部查表记忆？怎么均衡？
- 归一化与残差：Pre / Post / 三明治？有没有 QK-Norm 和输出门控？残差是普通加法还是跨层路由？
- 位置与长上下文：RoPE / Partial RoPE / NoPE？怎么外推到百万上下文？
- 训练侧与小执念：有没有 MTP / DSpark / FP8 / MXFP4 / Muon？宽还是深？词表多大？

**十分钟，你就能给任何一个新模型“验明正身”——它像谁、在哪儿与众不同、为什么。** 这，就是“解构”的意义：大模型不再是玄学的黑箱，而是一张你能逐项追问、逐项打分的**选择清单**。

如果你想马上拿这把尺子去检验 2026 年的三款代表性旗舰，可以直接接着读：
- [《DeepSeek V4.1 Flash 深度解析》](https://daiw.org/manual/deepseek-v4-flash)
- [《Qwen3.8-Max 深度解析》](https://daiw.org/manual/qwen3-8-max)
- [《Kimi K3 深度解析》](https://daiw.org/manual/kimi-k3)

至此，《AI 大模型解构》全篇完。

## 参考文献

本章为全篇汇总，主要参考：

- Raschka, S. “The Big LLM Architecture Comparison.” 2025. https://magazine.sebastianraschka.com/p/the-big-llm-architecture-comparison —— 横向对比框架与多处架构事实。
- 各模型技术报告与仓库：DeepSeek-V3（arXiv:2412.19437）、DeepSeek V4.1-Flash（`deepseek-ai/DeepSeek-V4.1-Flash`）、Llama 3（arXiv:2407.21783）、Qwen2.5（arXiv:2412.15115）、Qwen3（arXiv:2505.09388）、Qwen3.8-Max（`Qwen/Qwen3.8-2.4T-A95B`）、GLM（arXiv:2406.12793）、Gemma 2（arXiv:2408.00118）、OLMo 2（arXiv:2501.00656）、Mistral 7B（arXiv:2310.06825）、Kimi K3 / K3.1 Pro（`moonshotai/Kimi-K3`、`moonshotai/Kimi-K3.1-Pro`）。
- 各技术专文：MLA/DeepSeek-V2（arXiv:2405.04434）、GQA（arXiv:2305.13245）、MQA（arXiv:1911.02150）、DeepSeekMoE（arXiv:2401.06066）、无辅助损失均衡（arXiv:2408.15664）、RoPE（arXiv:2104.09864）、YaRN（arXiv:2309.00071）、NoPE（arXiv:2305.19466）、RMSNorm（arXiv:1910.07467）、SwiGLU（arXiv:2002.05202）、MTP（arXiv:2404.19737）、attention sink（arXiv:2309.17453）、Muon（arXiv:2502.16982）、AttnRes（arXiv:2603.15031）、Engram（arXiv:2601.07372）、mHC（arXiv:2512.24880）。

（各章文末另附有该章直接引用的文献。）
