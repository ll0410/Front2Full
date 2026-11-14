---
title: "混合精度训练"
description: "从 Bit 到 AGI · 第七章：训练 · BF16/FP16 与 FP32 主权重：更快更省显存"
source: "https://daiw.org/manual/bit-to-agi/07-training/mixed-precision-training"
---

# 混合精度训练

> 从 Bit 到 AGI · 第七章：训练 · BF16/FP16 与 FP32 主权重：更快更省显存

混合精度训练（Mixed Precision Training）让**矩阵乘**在 16-bit（BF16 或 FP16）下执行，**权重主副本、loss scaling、梯度累加**保留 FP32 精度。同样 7B 模型，BF16 比纯 FP32 **显存约减半、吞吐约 1.5–2×**——现代 LLM 训练默认开启。

## 直觉：草稿纸用短数字，账本用长数字

FP32 像用 10 位小数算账——准但慢。

混合精度：乘加在 **BF16（草稿）** 上飞快地算，关键步骤（梯度、权重更新）写回 **FP32 账本**，避免误差累积把训练带偏。

## 定义

| 格式 | 指数位 | 尾数位 | 动态范围 | LLM 训练 |
| --- | --- | --- | --- | --- |
| FP32 | 8 | 23 | 大 | 主权重、loss |
| **BF16** | 8 | 7 | 与 FP32 同指数 | **A100/H100/B200 默认** |
| FP16 | 5 | 10 | 较小 | 需 loss scaling |

**AMP 流程**（Automatic Mixed Precision）：

1. Forward/backward 用 BF16/FP16
2. 梯度 **unscale**（FP16 时）后 clip
3. Optimizer 更新 **FP32 master weights**
4. 拷贝回 BF16 用于下一 step

## 例子 1：7B 显存与吞吐

| 精度 | 权重 | 激活 (batch=2, seq=4096) | 单 A100 吞吐 token/s | 训 100M token |
| --- | --- | --- | --- | --- |
| FP32 | 28 GB | ~24 GB | ~8k | **~125 GPU·小时** |
| BF16 | 14 GB | ~12 GB | ~15k | **~67 GPU·小时** |
| BF16 + grad ckpt | 14 GB | ~6 GB | ~10k | ~100 GPU·小时 |

BF16 训 100M token 约 **67 GPU·小时** vs FP32 **125 GPU·小时**——省 **~46%** 算力账单；且 80GB 卡可开更大 batch。

## 例子 2：FP16 loss scaling

老卡（V100）无原生 BF16，用 FP16 + dynamic loss scaling：

```python
scaler = torch.amp.GradScaler("cuda")  # 旧版为 torch.cuda.amp.GradScaler()
with torch.autocast(device_type="cuda", dtype=torch.float16):
    loss = model(batch)
scaler.scale(loss).backward()
scaler.step(optimizer)
scaler.update()
```

若 scale 过大 → inf → scaler 自动降 scale。H100 上 **直接 BF16 无需 scaler**，代码更简单：

```python
with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
    loss = model(batch)
loss.backward()
optimizer.step()
```

## 量化：何时不用混合精度

| 情况 | 建议 |
| --- | --- |
| H100 / A100 / MI300 | BF16 默认 |
| V100 | FP16 + scaler |
| 某些 RL 长链推理 | 生成用 BF16，RM 可 FP32 稳分 |
| 量化训练 QLoRA | 4-bit 存 + BF16 算 |

**FP8 / FP4 训练**（Hopper / Blackwell Transformer Engine）：大集群主流配置（如 DeepSeek-V3 原生 FP8 预训练，Kimi K3 与 DeepSeek V4.1-Flash 进一步引入 MXFP4/FP4），再提速 ~20–40%+，需硬件支持；7B 单机收益有限。

## 动手试一试：BF16 vs FP32 速度

```python
import torch
import time

dim = 8192
a = torch.randn(dim, dim, device="cuda")
b = torch.randn(dim, dim, device="cuda")

for dtype, name in [(torch.float32, "fp32"), (torch.bfloat16, "bf16")]:
    x, y = a.to(dtype), b.to(dtype)
    torch.cuda.synchronize()
    t0 = time.perf_counter()
    for _ in range(100):
        c = x @ y
    torch.cuda.synchronize()
    print(f"{name}: {(time.perf_counter()-t0)*10:.1f} ms/iter")
# 典型：bf16 约为 fp32 的 1.5–2x
```

## 深入：optimizer 状态与显存账

很多人只比较「权重 14 GB vs 28 GB」，忽略 **AdamW 优化器状态**：每个可训练参数需要 **一阶矩 m + 二阶矩 v**，FP32 下各 4 byte，合计 **8 byte/参数**。7B 全参数训练时，仅 optimizer 约 **56 GB**，加上 BF16 权重 14 GB 与 FP32 master 28 GB，单卡根本放不下——必须 [分布式 ZeRO](/manual/llm/bit-to-agi/07-training/distributed-training-overview) 或 [LoRA](/manual/llm/bit-to-agi/07-training/what-is-lora) 只训适配器。

混合精度下，**master weights 保持 FP32** 是为了防止 thousands of update 后 BF16 舍入误差累积成系统性偏移。实验表明：7B 预训练全程 BF16 forward 但 FP32 update，与纯 FP32 相比 MMLU 差距 **低于 0.3 pt**；若 master 也用 BF16，长跑 200B token 后 PPL 可能恶化 **0.05–0.15**，相当于白训 **10B–30B token**（7B 约 **300–900 GPU·小时**）。

FP16 在 V100 时代需要 **dynamic loss scaling**：梯度太小时放大 loss 防 underflow，出现 inf 则缩小 scale。调试 scale 不当会导致训练「假收敛」——loss 曲线好看但下游 eval 差。BF16 与 FP32 共享 8 bit 指数，**几乎不需要 loss scaling**，这也是 A100 之后 LLM 训练默认 BF16 的原因。若你租用的是 **L40S / RTX 4090**（Ada 架构），同样优先 `torch.bfloat16`；仅在老卡或特殊 kernel 不支持时再退 FP16。

## 常见误区

1. **「BF16 比 FP16 精度差」** — BF16 尾数少但**指数与 FP32 同**，LLM 训练更稳；FP16 才常溢出。
2. **「混合精度 = 量化推理」** — 训练仍维护 FP32 master；推理才 4/8-bit 压权重。
3. **「全 BF16 包括 optimizer」** — Adam 矩仍常 FP32；全 BF16 optimizer 在研究中，非默认。

## 小结

混合精度用 **BF16 算 + FP32 更新**；7B 训 100M token **~67 GPU·小时**（BF16）vs **~125**（FP32）。H100 默认 BF16；V100 用 FP16 + GradScaler。

下一篇：[分布式训练概览](/manual/llm/bit-to-agi/07-training/distributed-training-overview)——多卡怎么切模型、切数据。

## 延伸：Tensor Core 与 TF32

NVIDIA **TF32** 默认在 Ampere+ 开启，matmul 用 TF32 累加、比 FP32 快、比 BF16 稳——部分框架 pretrain **仍选 BF16** 因 ecosystem 默认。H100 **FP8** 训练需 Transformer Engine + 特定 layer；7B 单机收益有限，**512+ H100** 长跑才显著（**~20% tokens/s** → 1T token 省 **~6k GPU·小时**）。选型顺序：**BF16 默认** → 不够快再 profiling FP8 → 勿为 FP8 重写整个 pipeline。与 [第九章 Tensor Core](/manual/llm/bit-to-agi/09-gpu/tensor-core) 对照读硬件侧。
