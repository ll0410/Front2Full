---
title: "第八章总结"
description: "从 Bit 到 AGI · 推理（Inference）· 本章要点回顾"
source: "https://daiw.org/manual/bit-to-agi/08-inference/chapter-summary"
---

# 第八章总结

> 从 Bit 到 AGI · 推理（Inference）· 本章要点回顾

第八章回答：**训练好的权重，如何在 GPU 上高效、可控地变成用户看到的文字**。下面按数据流顺序把 14 篇串成一条线，并给出选型速查。

## 一条 decode 步里发生了什么

1. **Scheduler**（[Continuous Batching](/manual/llm/bit-to-agi/08-inference/continuous-batching)）选出当前活跃序列的最后 token
2. **Forward**：读 **权重** + 读/写 **[KV Cache](/manual/llm/bit-to-agi/08-inference/what-is-kv-cache)**（[Paged](/manual/llm/bit-to-agi/08-inference/paged-attention) 块布局 + [Flash](/manual/llm/bit-to-agi/08-inference/flash-attention) 内核）
3. 大模型 **[TP/PP](/manual/llm/bit-to-agi/08-inference/tensor-parallel)** 多卡协同（若需要）
4. LM head 输出 logits → **[Sampling](/manual/llm/bit-to-agi/08-inference/sampling)**（[T](/manual/llm/bit-to-agi/08-inference/temperature) / [TopK](/manual/llm/bit-to-agi/08-inference/top-k) / [TopP](/manual/llm/bit-to-agi/08-inference/top-p)）
5. 新 token 追加；可选 **[Speculative](/manual/llm/bit-to-agi/08-inference/speculative-decoding)** 一次验证多个

Prefill 阶段额外要点：**Prefix Caching** 跳过重复前缀；**量化** 减权重/KV 体积。

## 核心公式与数字

| 主题 | 要记住的 |
| ---- | -------- |
| KV 体积 | $2 L s h_{kv} d_h b$ 字节；128K ctx 可与 8B 权重同量级 |
| PagedAttention | 块池化，在线利用率 **90%+** |
| FlashAttention | 不 materialize $N×N$；长 Prefill **2～4×** 常见 |
| Continuous Batching | 吞吐 **10～40×**↑，ITL 可能 **2×**↑ |
| TP / PP | 层内 all-reduce vs 层间流水线；decode 喜 TP、PP 怕 bubble |
| Speculative | 接受率 0.5～0.8 时 **1.5～2.5×** 有效 ITL |
| 8B A100 ITL | FP16 **22～30 ms/tok**；INT4 **19～22**；64 并发 **1200+ tok/s** |
| 70B TP=8 ITL | **80～120 ms/tok** |

## 选型速查

| 痛点 | 优先看 |
| ---- | ------ |
| OOM / 并发低 | PagedAttention + Continuous Batching |
| 长 prompt 慢 | Prefix Caching + Flash Prefill |
| 长 ctx KV 爆 | GQA、KV FP8、[量化](/manual/llm/bit-to-agi/08-inference/quantization-inference) |
| 单用户大模型慢 | TP、Speculative Decoding |
| 输出太野 / 太板 | Temperature、TopP |
| 只谈「快」不谈场景 | [延迟与吞吐](/manual/llm/bit-to-agi/08-inference/latency-vs-throughput) |

## 与后续章节

- **第九章 GPU**：NVLink、HBM 带宽、Tensor Core——解释本章 ms/tok 的 **硬件底限**
- **第十一章 Serving**：vLLM、TensorRT-LLM、网关——本章算法的 **产品化封装**

## 学习路径建议

若你时间有限，按 **痛点** 跳读：

1. **OOM / 并发上不去** → KV Cache → PagedAttention → Continuous Batching → 量化
2. **首字慢（RAG）** → Prefix Caching → Flash Attention（Prefill）
3. **单用户大模型慢** → Tensor Parallel → Speculative Decoding
4. **输出太野或太板** → Sampling → Temperature → TopP
5. **要定 SLA / 读 benchmark** → 延迟与吞吐

## 与训练章的关系

第七章把 **权重训出来**；本章 **不重训**，只谈 **固定权重下的系统优化**。量化 PTQ、Speculative 的 draft、Distillation 才重新碰训练——但 **线上默认路径** 是 **训一次、推理栈叠优化**。

## 自测题

1. 8B 模型、FP16、32 层、8 KV 头、128 头维：128K ctx **单序列** KV 约多少 GiB？（答案：约 **16 GiB**）
2. Continuous Batching 提升的是 **延迟** 还是 **吞吐**？（多数情况：**吞吐↑，单用户 ITL 可能↑**）
3. TopP=0.9 截的是 **词表 90%** 还是 **概率质量 90%**？（**概率质量**）

## 全章目录

1. [KV Cache 是什么](/manual/llm/bit-to-agi/08-inference/what-is-kv-cache)
2. [Paged Attention](/manual/llm/bit-to-agi/08-inference/paged-attention)
3. [Flash Attention](/manual/llm/bit-to-agi/08-inference/flash-attention)
4. [Continuous Batching](/manual/llm/bit-to-agi/08-inference/continuous-batching)
5. [Tensor Parallel](/manual/llm/bit-to-agi/08-inference/tensor-parallel)
6. [Pipeline Parallel](/manual/llm/bit-to-agi/08-inference/pipeline-parallel)
7. [Speculative Decoding](/manual/llm/bit-to-agi/08-inference/speculative-decoding)
8. [Sampling 是什么](/manual/llm/bit-to-agi/08-inference/sampling)
9. [Temperature](/manual/llm/bit-to-agi/08-inference/temperature)
10. [TopK](/manual/llm/bit-to-agi/08-inference/top-k)
11. [TopP](/manual/llm/bit-to-agi/08-inference/top-p)
12. [Prefix Caching](/manual/llm/bit-to-agi/08-inference/prefix-caching)
13. [推理量化](/manual/llm/bit-to-agi/08-inference/quantization-inference)
14. [延迟与吞吐](/manual/llm/bit-to-agi/08-inference/latency-vs-throughput)

→ 下一章：[第九章：GPU](/manual/llm/bit-to-agi/09-gpu)
