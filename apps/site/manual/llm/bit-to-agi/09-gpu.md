---
title: "第九章：GPU"
description: "从 Bit 到 AGI 专栏 · 硬件与算力 · 共 10 篇"
source: "https://daiw.org/manual/bit-to-agi/09-gpu"
---

# 第九章：GPU

> 从 Bit 到 AGI 专栏 · 硬件与算力 · 共 10 篇

训练一个 70B 参数的模型，需要把数百 GB 的权重塞进显存，再用每秒数千 TFLOPS 的算力做矩阵乘法——这一切发生在 GPU 上。本章从程序员视角拆解 NVIDIA GPU 的关键概念：CUDA 编程模型、HBM 带宽、NVLink 与 PCIe 互联、Warp 与 SM 执行单元、Tensor Core 算力，以及为什么显存容量决定你能跑多大的模型。

## 本章目录

1. [CUDA 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-cuda) — 用 C 写并行程序的平台
2. [HBM 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-hbm) — 显存带宽为何以 TB/s 计
3. [NVLink 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-nvlink) — GPU 之间的高速通道
4. [PCIe 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-pcie) — GPU 与 CPU/主机之间的瓶颈
5. [Warp 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-warp) — 32 线程同步执行的基本单位
6. [SM 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-sm) — GPU 上的「多核处理器」
7. [Tensor Core 与 TFLOPS](/manual/llm/bit-to-agi/09-gpu/tensor-core) — 矩阵乘法的专用硬件
8. [为什么 GPU 这么快](/manual/llm/bit-to-agi/09-gpu/why-gpu-so-fast) — 并行度、带宽与专用电路
9. [为什么显存这么重要](/manual/llm/bit-to-agi/09-gpu/why-vram-matters) — 7B / 70B 模型要占多少 GB
10. [本章总结](/manual/llm/bit-to-agi/09-gpu/chapter-summary)

## 阅读建议

建议按目录顺序阅读：先理解 CUDA 如何把「成千上万个线程」映射到硬件，再理解 HBM / NVLink / PCIe 三条数据通路，然后深入 Warp、SM、Tensor Core 的执行细节，最后用「为什么 GPU 这么快」和「为什么显存这么重要」把概念串起来。读完本章后，[第八章推理](/manual/llm/bit-to-agi/08-inference) 里的 KV Cache、张量并行等话题会更容易理解——它们本质上都是在 GPU 硬件约束下做取舍。

从本章开始阅读 → [CUDA 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-cuda)
