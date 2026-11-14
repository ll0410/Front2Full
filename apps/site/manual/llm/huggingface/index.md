---
title: "HuggingFace 模型下载与部署"
description: "从 Hub 上把模型拉下来、在自己的机器上跑起来，再用它的数据集与算力训出自己的模型——一份偏实操的 HuggingFace 生态指南。"
source: "https://daiw.org/manual/huggingface"
---

# HuggingFace 模型下载与部署

> 内容来源：[daiw.org](https://daiw.org/manual/huggingface) · 作者 David（道雾轩） · 原文更新于 2026-11-06

> 从 Hub 上把模型拉下来、在自己的机器上跑起来，再用它的数据集与算力训出自己的模型——一份偏实操的 HuggingFace 生态指南。

## 序 · 把“别人的模型”变成“你机器上跑着的东西”

HuggingFace 上有上百万个模型。但从“看到一个模型页”到“它在我的机器上真的跑起来了”，中间隔着一串具体问题：

- 这个仓库里十几个文件，我该下哪些？下错了白等半小时。
- 我的显卡 8 GB，到底能跑多大的模型？跑不动的话有别的办法吗？
- 国内下载动辄断流，怎么才能稳定拉下来？
- 想微调一个自己的模型，数据从哪来、要多少显存、单卡够不够？
- 每月 9 美元的 PRO 到底买到了什么？什么时候值得掏这个钱？

这个专栏就是逐个回答这些问题。**它不讲 Transformer 原理**（那是[《AI 大模型解构》](https://daiw.org/manual/llm-anatomy)与[《从 Bit 到 AGI》](https://daiw.org/manual/bit-to-agi)的事），只讲**手上的操作**：怎么下、怎么跑、怎么训、怎么省钱。

## 这个专栏假设你

- 会用命令行，装过 Python 包。
- 有一台能跑起来的机器——**哪怕只有 CPU 也行**，第 3 部分有纯 CPU 的路线。
- 想动手，而不只是想了解。

不需要你懂深度学习理论。需要显存的地方我会给出具体数字，跑不动的地方会给替代方案。

## 六个部分

**第 1 部分 · 认识 Hub** —— 先看清你面对的是什么。

HuggingFace 是三样东西叠在一起：一个托管平台（Hub）、一堆 Python 库（transformers / datasets / peft…）、一组付费服务。一个模型仓库里的每个文件是干什么的、`safetensors` 和 `.bin` 差在哪、GGUF 又是什么——搞清这些，后面才不会盲下。

**第 2 部分 · 下载** —— 稳、快、只下需要的。

`hf` 命令行、token 权限、缓存目录在哪、断点续传、怎么只下一个量化版本而不是整个仓库。以及**国内访问**这个绕不开的话题——镜像站怎么配、离线环境怎么办。

**第 3 部分 · 单机部署** —— 让它真的跑起来。

先按**显存档位**给一张对照表（4 G 到 48 G 各能跑什么），再讲四条部署路线：`transformers` 直接跑、GGUF + llama.cpp / Ollama（**CPU 也能跑**）、vLLM（要吞吐时）。最后是一份**经典模型清单**，每个都给可以直接粘贴运行的命令。

**第 4 部分 · 数据集** —— Hub 上不只有模型。

`datasets` 库怎么用、几十 GB 的数据集怎么流式读而不撑爆硬盘、怎么把自己的数据整理成标准格式传上去。

**第 5 部分 · 自己训模型** —— 单卡也能做的事。

**LoRA / QLoRA 微调**是普通人最现实的路径：一张 16 G 的卡就能微调 7B 模型。这部分讲怎么配、怎么算显存、OOM 了怎么办、训完怎么评估、怎么推回 Hub。

**第 6 部分 · 算力与收费** —— 钱花在刀刃上。

本地、Colab、Spaces、Inference Endpoints 各自的成本与适用场景；PRO 订阅、ZeroGPU、按小时计费的 Space GPU 分别买到了什么；以及几条实测有效的省钱策略。

::: info

**关于价格与 API 的时效性**：HuggingFace 的定价与 CLI 命名变过几次（`huggingface-cli` 现在叫 `hf`）。本专栏写作时以当前版本为准，凡涉及具体价格的地方我都会标明“以官网为准”——**掏钱之前请去 [huggingface.co/pricing](https://huggingface.co/pricing) 核一遍**。

技术操作部分（下载、部署、微调）的稳定性要高得多，基本不会因为版本小改而失效。

:::

## 一条最短路径

如果你现在就想试点什么，不必按顺序读。三条常见目标各自的最短路线：

| 你想 | 直接读 |
| --- | --- |
| 在自己电脑上跑个大模型聊天 | [按显存选模型](/manual/llm/huggingface/choose-by-vram) → [GGUF 路线](/manual/llm/huggingface/gguf-llamacpp-ollama) |
| 把某个模型接进自己的程序 | [下载](/manual/llm/huggingface/downloading) → [transformers 部署](/manual/llm/huggingface/transformers-serving) |
| 微调一个属于自己的模型 | [数据集基础](/manual/llm/huggingface/datasets-basics) → [LoRA 微调](/manual/llm/huggingface/finetune-lora) |

国内读者建议无论如何先看一眼[国内访问](/manual/llm/huggingface/china-access)——它能省掉后面大量“下载卡住”的困惑。

准备好了，从[HuggingFace 到底是什么](/manual/llm/huggingface/what-is-huggingface)开始。
