---
title: "第十一章：工程化（Serving）"
description: "从 Bit 到 AGI 专栏 · 生产级 LLM 部署 · 共 15 篇"
source: "https://daiw.org/manual/bit-to-agi/11-engineering"
---

# 第十一章：工程化（Serving）

> 从 Bit 到 AGI 专栏 · 生产级 LLM 部署 · 共 15 篇

第十章你在单卡上训出了模型；本章把它变成**生产服务**——吞吐从 **~200 tok/s** 拉到 **~3 000+ tok/s**，TTFT 压在 **亚秒级**，并接上 Gateway、可观测性、扩缩容与成本治理。读完本章，你会用 QPS、P95 延迟和 \$/1M tokens 这些尺子评估任意 LLM 部署方案。

## 本章目录

- [vLLM](/manual/llm/bit-to-agi/11-engineering/vllm) — PagedAttention 与连续批处理，开源 serving 默认栈
- [SGLang](/manual/llm/bit-to-agi/11-engineering/sglang) — RadixAttention 前缀缓存与结构化生成
- [TensorRT-LLM](/manual/llm/bit-to-agi/11-engineering/tensorrt-llm) — NVIDIA 编译级推理与 FP8/INT4
- [DeepSpeed](/manual/llm/bit-to-agi/11-engineering/deepspeed) — ZeRO 训练与 MII/FastGen 推理
- [Megatron](/manual/llm/bit-to-agi/11-engineering/megatron) — 千卡预训练的 TP/PP/EP 并行
- [Ray](/manual/llm/bit-to-agi/11-engineering/ray) — 分布式 replica 与异构 pipeline
- [Kubernetes](/manual/llm/bit-to-agi/11-engineering/kubernetes) — GPU Pod、HPA 与滚动发布
- [LiteLLM](/manual/llm/bit-to-agi/11-engineering/litellm) — 统一百种 API 的路由与预算
- [Gateway](/manual/llm/bit-to-agi/11-engineering/gateway) — 鉴权、限流与 Canary 路由
- [可观测性](/manual/llm/bit-to-agi/11-engineering/observability) — TTFT/TPOT、Prometheus 与 OTel
- [自动扩缩容](/manual/llm/bit-to-agi/11-engineering/autoscaling) — KEDA 与 GPU 弹性
- [模型注册表](/manual/llm/bit-to-agi/11-engineering/model-registry) — 版本、stage 与 lineage
- [A/B 测试](/manual/llm/bit-to-agi/11-engineering/ab-testing) — 在线实验与 shadow 流量
- [成本治理](/manual/llm/bit-to-agi/11-engineering/cost-governance) — Token 预算与 FinOps

建议按顺序阅读：先推理引擎（vLLM → SGLang → TensorRT-LLM），再训练并行栈（DeepSpeed → Megatron），然后编排（Ray → K8s），最后平台层（LiteLLM → Gateway → 可观测性 → 扩缩容 → 注册表 → A/B → 成本）。全部读完后请参阅[第十一章总结](/manual/llm/bit-to-agi/11-engineering/chapter-summary)。
