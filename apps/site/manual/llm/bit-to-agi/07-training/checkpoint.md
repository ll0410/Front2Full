---
title: "Checkpoint 是什么"
description: "从 Bit 到 AGI · 第七章：训练 · 保存训练快照：权重、优化器与恢复"
source: "https://daiw.org/manual/bit-to-agi/07-training/checkpoint"
---

# Checkpoint 是什么

> 从 Bit 到 AGI · 第七章：训练 · 保存训练快照：权重、优化器与恢复

Checkpoint（检查点）是训练过程中的**完整快照**：模型权重、优化器状态、学习率调度器、随机数种子、当前 step/epoch 等。集群训练跑几天难免遇到节点故障；没有 checkpoint，**最后 12 小时的算力直接作废**。

## 直觉：游戏存档

RPG 每过一章自动存档。Checkpoint 就是 ML 训练的「存档点」——可以从 step 42,000 接着练，而不是从 step 0 重开。

区别：LLM checkpoint **很大**（7B 单份 ~14–50 GB），且往往不只存一份。

## 定义

典型 checkpoint 目录结构（Hugging Face / PyTorch）：

```
checkpoint-10000/
├── model.safetensors      # 权重（推荐 safetensors，防 pickle 漏洞）
├── config.json
├── tokenizer.json
├── optimizer.pt             # Adam 一阶二阶矩（≈2× 权重）
├── scheduler.pt
├── rng_state.pth
└── trainer_state.json       # global_step, epoch, best_metric
```

| 内容 | 7B FP16 | 7B + Adam 全状态 |
| --- | --- | --- |
| 仅 model | ~14 GB | — |
| model + optimizer + fp32 master | — | **~56–84 GB** |
| LoRA only | ~17 MB | ~50 MB |

## 例子 1：预训练 checkpoint 策略

**场景**：7B 预训练 1T token，512× H100，每 **1000 step** 存一次，每 step 约 **4M token**（全局 batch）。

| 项 | 数值 |
| --- | --- |
| 总 step | 1T / 4M ≈ **250,000** |
| 若每 1000 step 存全量 | 250 份 × 56 GB ≈ **14 PB**（不可接受） |
| 实践策略 | 每 2000 step 存 **model only**；每 10000 step 存 **full**；保留最近 3 份 + 最佳 val |

**写入带宽**：56 GB / 100 秒 ≈ **560 MB/s**；NVMe 阵列需预留，否则存 checkpoint 时 **全体 GPU 空等**（stall）。

## 例子 2：SFT LoRA checkpoint

7B LoRA SFT，10k step，每 500 step 存 LoRA adapter：

| 项 | 数值 |
| --- | --- |
| 单份 adapter | ~17 MB |
| 保留 20 份 | ~340 MB |
| 存盘时间 | 低于1 秒 |

LoRA 训练 checkpoint **几乎免费**；可**高频保存**便于选最佳 val loss 步。

## 量化：存什么、何时存

| 策略 | 适用 | 空间/step |
| --- | --- | --- |
| model-only | 预训练、可重启 optimizer | ~14 GB (7B) |
| full state | 微调、精确续训 | ~56 GB+ |
| sharded (ZeRO-3) | 大模型分布式 | 每 rank 1/N |
| async checkpoint | 大规模 | 后台线程写，减 stall |

**async checkpoint**（PyTorch 2.4+ / DeepSpeed）：GPU 继续算下一 step，IO 并行，可省 **5–15%** 总训练时间（长跑显著）。

## 动手试一试：最小 checkpoint

```python
import torch
from pathlib import Path

def save_ckpt(model, optimizer, step, path="ckpt.pt"):
    torch.save({
        "step": step,
        "model": model.state_dict(),
        "optimizer": optimizer.state_dict(),
    }, path)
    print(f"saved {Path(path).stat().st_size / 1e6:.1f} MB")

def load_ckpt(model, optimizer, path="ckpt.pt"):
    ckpt = torch.load(path, map_location="cpu")
    model.load_state_dict(ckpt["model"])
    optimizer.load_state_dict(ckpt["optimizer"])
    return ckpt["step"]

# 玩具模型
model = torch.nn.Linear(1024, 1024)
opt = torch.optim.AdamW(model.parameters())
save_ckpt(model, opt, step=1000)
step = load_ckpt(model, opt)
print(f"resumed at step {step}")
```

生产环境优先 `safetensors` + HF `save_pretrained(save_only_model=True)`。

## 深入：多副本策略与 cloud 成本

预训练 checkpoint 策略直接影响 **对象存储账单**。56 GB × 250 份 = 14 PB 不可接受；实践是 **tiered retention**：

| 层级 | 频率 | 保留 | 7B 空间 |
| --- | --- | --- | --- |
| Hot | 每 500 step | 最近 2 份 model-only | ~28 GB |
| Warm | 每 5000 step | 最近 3 份 full | ~168 GB |
| Cold | 每 50k step | 永久 archive 至 S3 | ~56 GB/份 |

1T token 训练若 archive **5 份** cold checkpoint → **~280 GB** S3，月存储 **低于 \$10**；但若误存 200 份 full → **11 TB** → **~\$250/月** 且写入 stall 严重。

**Resume 训练** 必须匹配：optimizer state 与 **数据 shard 顺序**。Megatron 会在 checkpoint 里存 **iteration + consumed_samples**；换机器续训时 world size 不变、batch 不变，否则 effective LR schedule 错位。LoRA 实验可只存 adapter：**17 MB × 100 个 ablation = 1.7 GB**，适合在 W&B 里挂 artifact 做 **超参扫描**——每次 [学习率](/manual/llm/bit-to-agi/07-training/learning-rate-schedule) 试验 **6 GPU·小时**，100 组才 600 GPU·小时，checkpoint 管理不能成为瓶颈。

## 常见误区

1. **「只存最好的一份就够」** — 对齐任务 val loss 最低 ≠ 人类偏好最好；常保留**多个 late checkpoint** 做 eval 选优。
2. **「checkpoint 含数据」** — 只有状态；续训需**相同数据顺序**（需存 dataloader state 或固定 seed）。
3. **「合并 LoRA 再存」** — Serving 时可合并；训练中间态应存 **adapter 分离**，方便 ablation。

## 小结

Checkpoint = 训练**存档**；7B full state **~56 GB/份**，预训练需 **稀疏 + async** 策略；LoRA **~17 MB** 可随意存。第十章 [save-checkpoint](/manual/llm/bit-to-agi/10-train-your-llm/save-checkpoint) 有动手流程。

下一篇：[数据配比](/manual/llm/bit-to-agi/07-training/data-mixing)——预训练语料怎么混。

## 延伸：FSDP、DeepSpeed 与 HF Trainer

PyTorch **FSDP**（Fully Sharded Data Parallel）与 **DeepSpeed ZeRO** 都 shard optimizer，7B 全参 SFT 可从「必须 8 卡」降到 **4×40GB** 勉强能跑——100M token **~40–80 GPU·小时** 依配置。Hugging Face `Trainer` + `accelerate` 抽象了 DDP/FSDP 切换；复杂 MoE/TP 仍要 Megatron-DeepSpeed。**Checkpoint 格式**：HF `save_pretrained` 跨框架互通；Megatron `.pt` 需脚本转 HF 才能进 vLLM。转格式一次 **~30 min CPU / 7B** 不算训练成本，但上线前必做。存 checkpoint 时同时写 **training_args.json** 记录 accum、LR、token/step——续训与 audit 靠 metadata。
