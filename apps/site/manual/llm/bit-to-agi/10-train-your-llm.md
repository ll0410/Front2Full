---
title: "第十章：自己训练一个模型"
description: "从 Bit 到 AGI 专栏 · 端到端实战 · 共 20 篇"
source: "https://daiw.org/manual/bit-to-agi/10-train-your-llm"
---

# 第十章：自己训练一个模型

> 从 Bit 到 AGI 专栏 · 端到端实战 · 共 20 篇

前面九章你已经理解了比特、数学、信息论、神经网络、Transformer、Tokenizer、训练原理、推理与 GPU。本章把这些知识**串成一条可执行的流水线**：从下载原始文本，到清洗、训练 Tokenizer、预训练一个小型 GPT、验证与保存 Checkpoint、本地推理、部署上线、对接 OpenAI 兼容 API 与 MCP，再到微调、Benchmark、监控、故障恢复、硬件规划与成本估算。

## 项目目录结构

完成全章后 `mini-gpt-lab/` 应类似：

```
mini-gpt-lab/
├── raw/                 # 原始语料
├── processed/           # 清洗后 train.txt
├── data/litgpt/         # train.bin / val.bin
├── tokenizer/           # tokenizer.json
├── checkpoints/         # 各阶段权重
├── deploy/              # Dockerfile, compose
├── mcp_server/          # MCP 脚本
├── scripts/             # 清洗、SFT、评估
└── results/             # Benchmark JSON
```

## 时间预算（首次完整跑通）

| 阶段 | 耗时 |
| ---- | ---- |
| 环境 + 下载数据 | 2–4 h |
| 清洗 + Tokenizer | 1 h |
| 预训练 500M tokens | 6–12 h |
| 验证 + 部署 | 2 h |
| SFT + Benchmark | 2 h |
| **合计** | **约 2 天** |

熟练后可压缩到 **1 个周末**。

## 前置章节依赖

| 章节 | 本章用到的概念 |
| ---- | -------------- |
| 第六章 Token | BPE、词表、bytes/token |
| 第七章 Training | 预训练 loss、LoRA、Checkpoint |
| 第八章 Inference | 采样、KV cache |
| 第九章 GPU | 显存、带宽估算 |

## 本章目录

- [收集数据](/manual/llm/bit-to-agi/10-train-your-llm/collect-data)
- [清洗数据](/manual/llm/bit-to-agi/10-train-your-llm/clean-data)
- [训练 Tokenizer](/manual/llm/bit-to-agi/10-train-your-llm/build-tokenizer)
- [预训练模型](/manual/llm/bit-to-agi/10-train-your-llm/pretrain-model)
- [验证模型](/manual/llm/bit-to-agi/10-train-your-llm/validate-model)
- [保存 Checkpoint](/manual/llm/bit-to-agi/10-train-your-llm/save-checkpoint)
- [跑推理](/manual/llm/bit-to-agi/10-train-your-llm/run-inference)
- [部署模型](/manual/llm/bit-to-agi/10-train-your-llm/deploy-model)
- [OpenAI API 兼容](/manual/llm/bit-to-agi/10-train-your-llm/openai-api-compat)
- [MCP 集成](/manual/llm/bit-to-agi/10-train-your-llm/mcp-integration)
- [选择基座模型](/manual/llm/bit-to-agi/10-train-your-llm/pick-base-model)
- [微调 SFT](/manual/llm/bit-to-agi/10-train-your-llm/fine-tune-sft)
- [跑 Benchmark](/manual/llm/bit-to-agi/10-train-your-llm/evaluate-benchmarks)
- [监控训练](/manual/llm/bit-to-agi/10-train-your-llm/monitor-training)
- [从失败中恢复](/manual/llm/bit-to-agi/10-train-your-llm/recover-from-failure)
- [数据集格式](/manual/llm/bit-to-agi/10-train-your-llm/dataset-format)
- [硬件规划](/manual/llm/bit-to-agi/10-train-your-llm/hardware-planning)
- [成本估算](/manual/llm/bit-to-agi/10-train-your-llm/cost-estimation)
- [发布你的模型](/manual/llm/bit-to-agi/10-train-your-llm/publish-your-model)

---

**建议阅读顺序**：按目录自上而下；若你已有清洗好的 JSONL，可跳过前两篇直接读[训练 Tokenizer](/manual/llm/bit-to-agi/10-train-your-llm/build-tokenizer)。全部读完后请参阅[本章总结](/manual/llm/bit-to-agi/10-train-your-llm/chapter-summary)。

下一篇：[收集数据](/manual/llm/bit-to-agi/10-train-your-llm/collect-data)
