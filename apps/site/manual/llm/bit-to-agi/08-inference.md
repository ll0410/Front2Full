---
title: "第八章：推理（Inference）"
description: "从 Bit 到 AGI 专栏 · 让训练好的模型真正跑起来 · 共 15 篇"
source: "https://daiw.org/manual/bit-to-agi/08-inference"
---

# 第八章：推理（Inference）

> 从 Bit 到 AGI 专栏 · 让训练好的模型真正跑起来 · 共 15 篇

训练把权重写进显存；**推理**才是用户感受到的速度、成本与质量。本章从 KV Cache 的显存账开始，讲清 Paged/Flash Attention、Continuous Batching、张量/流水线并行、投机解码与采样策略，最后用毫秒/token 的数字把延迟与吞吐拆开。

## 本章目录

- [KV Cache 是什么](/manual/llm/bit-to-agi/08-inference/what-is-kv-cache)
- [Paged Attention](/manual/llm/bit-to-agi/08-inference/paged-attention)
- [Flash Attention](/manual/llm/bit-to-agi/08-inference/flash-attention)
- [Continuous Batching](/manual/llm/bit-to-agi/08-inference/continuous-batching)
- [Tensor Parallel](/manual/llm/bit-to-agi/08-inference/tensor-parallel)
- [Pipeline Parallel](/manual/llm/bit-to-agi/08-inference/pipeline-parallel)
- [Speculative Decoding](/manual/llm/bit-to-agi/08-inference/speculative-decoding)
- [Sampling 是什么](/manual/llm/bit-to-agi/08-inference/sampling)
- [Temperature](/manual/llm/bit-to-agi/08-inference/temperature)
- [TopK](/manual/llm/bit-to-agi/08-inference/top-k)
- [TopP](/manual/llm/bit-to-agi/08-inference/top-p)
- [Prefix Caching](/manual/llm/bit-to-agi/08-inference/prefix-caching)
- [推理量化](/manual/llm/bit-to-agi/08-inference/quantization-inference)
- [延迟与吞吐](/manual/llm/bit-to-agi/08-inference/latency-vs-throughput)

建议按顺序阅读。每篇末尾会链到下一篇；全部读完后请参阅[本章总结](/manual/llm/bit-to-agi/08-inference/chapter-summary)。
