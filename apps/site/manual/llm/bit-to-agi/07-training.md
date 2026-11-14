---
title: "第七章：训练（Training）"
description: "从 Bit 到 AGI 专栏 · 从预训练到对齐 · 共 20 篇"
source: "https://daiw.org/manual/bit-to-agi/07-training"
---

# 第七章：训练（Training）

> 从 Bit 到 AGI 专栏 · 从预训练到对齐 · 共 20 篇

大语言模型不是「写代码写出来的」，而是**用海量数据、大量 GPU 时间算出来的**。本章从预训练讲起，一路走到 SFT、RLHF、DPO、GRPO，再到 LoRA、MoE、蒸馏等工程技巧，最后谈对齐与评估。

读完本章，你会能用** token 数**和 **GPU·小时**估算一次训练要花多少钱、多久。

## 本章目录

- [预训练是什么](/manual/llm/bit-to-agi/07-training/what-is-pretraining)
- [SFT 是什么](/manual/llm/bit-to-agi/07-training/what-is-sft)
- [RLHF 是什么](/manual/llm/bit-to-agi/07-training/what-is-rlhf)
- [DPO 是什么](/manual/llm/bit-to-agi/07-training/what-is-dpo)
- [GRPO 是什么](/manual/llm/bit-to-agi/07-training/what-is-grpo)
- [MoE 是什么](/manual/llm/bit-to-agi/07-training/what-is-moe)
- [LoRA 是什么](/manual/llm/bit-to-agi/07-training/what-is-lora)
- [QLoRA 是什么](/manual/llm/bit-to-agi/07-training/what-is-qlora)
- [蒸馏是什么](/manual/llm/bit-to-agi/07-training/distillation)
- [Checkpoint 是什么](/manual/llm/bit-to-agi/07-training/checkpoint)
- [数据配比](/manual/llm/bit-to-agi/07-training/data-mixing)
- [学习率调度](/manual/llm/bit-to-agi/07-training/learning-rate-schedule)
- [梯度累积](/manual/llm/bit-to-agi/07-training/gradient-accumulation)
- [混合精度训练](/manual/llm/bit-to-agi/07-training/mixed-precision-training)
- [分布式训练概览](/manual/llm/bit-to-agi/07-training/distributed-training-overview)
- [评估指标](/manual/llm/bit-to-agi/07-training/evaluation-metrics)
- [对齐概览](/manual/llm/bit-to-agi/07-training/alignment-overview)
- [奖励模型](/manual/llm/bit-to-agi/07-training/reward-model)
- [训练稳定性](/manual/llm/bit-to-agi/07-training/training-stability)
- [本章总结](/manual/llm/bit-to-agi/07-training/chapter-summary)
