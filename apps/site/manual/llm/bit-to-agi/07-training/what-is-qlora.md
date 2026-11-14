---
title: "QLoRA 是什么"
description: "从 Bit 到 AGI · 第七章：训练 · 4-bit 量化基座 + LoRA，单卡微调 65B"
source: "https://daiw.org/manual/bit-to-agi/07-training/what-is-qlora"
---

# QLoRA 是什么

> 从 Bit 到 AGI · 第七章：训练 · 4-bit 量化基座 + LoRA，单卡微调 65B

QLoRA（Quantized LoRA）把**冻结的基座权重**以 4-bit NF4 格式存显存，训练时反量化到 BF16 做 matmul，**只更新 LoRA 适配器**。2023 年 Dettmers 等人用 **单张 48GB GPU** 微调 **65B** 模型，把大模型微调门槛拉低到消费级硬件。

## 直觉：精模缩小放进冰箱，做菜时再解冻一层

全精度 65B 权重 ≈ **130 GB**（FP16），单卡放不下。

QLoRA 像把模型**压缩冷冻**（4-bit，~35 GB），真正算梯度时只解冻当前层的一小片到 BF16；要改的部分（LoRA 便签）始终全精度训练。冰箱（4-bit 存储）省空间，便签（LoRA）保质量。

## 定义

QLoRA 三件套：

1. **4-bit NormalFloat（NF4）**：针对服从正态分布的权重设计的、信息论意义下近似最优的 4-bit 量化码本
2. **Double Quantization**：再量化量化常数，省 ~0.5 bit/参数
3. **Paged Optimizers**：显存不足时把 optimizer 状态 swap 到 CPU RAM

显存估算（7B，QLoRA r=64）：

| 组件 | 显存 |
| --- | --- |
| 4-bit 基座 7B | ~4 GB |
| LoRA 适配器 + 梯度 | ~0.5 GB |
| 激活（seq=2048, batch=1） | ~8–12 GB |
| AdamW 状态（仅 LoRA） | ~0.1 GB |
| **合计** | **~14–18 GB** → 24GB 卡可跑 |

对比：BF16 全量 7B 仅权重就 **14 GB**，加 optimizer **>60 GB**。

## 例子 1：65B 在单卡 48GB

论文设置：Llama 65B，GuacaNoco 数据集 **~650M token**，seq=2048，micro-batch=1，gradient accumulation=16。

| 项 | 数值 |
| --- | --- |
| 有效 batch token | 32k / step |
| 训练步数 | ~20k steps |
| 单 A100 48GB 墙钟 | **~36 小时** |
| GPU·小时 | **~36**（单卡） |

同等数据全参数 BF16 65B：**不可能单卡**；8×80GB 也需 **~800+ GPU·小时**。

## 例子 2：7B QLoRA 常见账单

Alpaca 52k，3 epoch，~40M token，RTX 4090 24GB：

| 配置 | 墙钟 | GPU·小时 |
| --- | --- | --- |
| QLoRA r=16, 4-bit | ~4–6 小时 | **4–6** |
| LoRA bf16 7B | ~3–5 小时 | 3–5（需 24GB+） |
| 全参 7B | 需多卡 | 80+ |

QLoRA 比 BF16 LoRA **略慢 10–30%**（反量化开销），但 **显存减半**，允许更大 batch 或更长序列。

## 量化：bits 与 perplexity

| 基座精度 | 7B MMLU（冻结，无 LoRA） | LoRA 后恢复 |
| --- | --- | --- |
| BF16 | 基准 100% | — |
| 8-bit | ~99.5% | ~99% |
| **4-bit NF4** | ~98–99% | **~97–99%** |
| 3-bit | ~95% | 明显下降 |

4-bit 是**质量/显存** sweet spot；再低则 SFT 掉点明显。

## 动手试一试：bitsandbytes 加载

```python
from transformers import AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model
import torch

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=bnb_config,
    device_map="auto",
)

lora_config = LoraConfig(r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"])
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# trainable params: ~4M (<0.1%)
```

## 深入：Paged Optimizer 与 70B 单卡

QLoRA 论文的另一贡献是 **Paged Optimizers**：当 GPU 显存峰值超过阈值时，把 optimizer 状态临时换出到 **CPU RAM**（类似 OS 虚拟内存分页）。训 65B 时，LoRA 可训练参数虽只有 ~100M 级，Adam 状态仍可能 **~800 MB**；加上 65B 的 4-bit 权重 ~35 GB、激活与临时 buffer，48GB 卡处于临界。分页让峰值从 OOM 变成 **10–15% 速度损失**——对长达 **36 GPU·小时** 的单卡任务，多花 ~4 小时换「能跑起来」通常值得。

选 rank 时，QLoRA 与标准 LoRA 规律类似：**r=16–64** 是 sweet spot。r=4 在 650M token 上 HumanEval 可能比 r=16 **低 3–5 pt**；r=64 相比 r=16 只升 **0.5–1 pt** 但 optimizer 内存 **×4**。若数据只有 Alpaca 52k（~40M token），r=16 足够；若 domain 数据 **500M+ token**（法律、医疗），可试 r=64 并监控 val loss。

反量化路径：4-bit 权重存储为 NF4 codebook + block scale；forward 时 **dequant → BF16 matmul → 结果累加 LoRA 分支**。因此 QLoRA 比同配置 BF16 LoRA **慢 10–30%**，但允许 **batch 翻倍** 时总 wall-clock 仍可能更短。70B QLoRA 在 2×48GB 上需 `device_map="auto"` 做 **模型并行**；8B 以下 24GB 单卡是主战场——这也是个人开发者 **~4–6 GPU·小时** 完成可用助手的经济路径。

## 常见误区

1. **「QLoRA 能训基座权重」** — 基座 4-bit **冻结**；要更新基座用全精度或 8-bit 部分解冻。
2. **「4-bit 和 4-bit 推理一样」** — 训练时有反量化 + LoRA 双路径；推理可用 GPTQ/AWQ 进一步压。
3. **「单卡 70B 任意 seq 都行」** — seq=8192 时激活爆显存；需 gradient checkpoint + 短 seq。

## 小结

QLoRA = **NF4 基座 + LoRA**；65B + 650M token 单卡 **~36 GPU·小时**；7B 消费级卡 **~4–6 GPU·小时**。显存不够时的第一选择。

下一篇：[蒸馏是什么](/manual/llm/bit-to-agi/07-training/distillation)——用大模型教小模型。

## 延伸：GPTQ 训练后量化 vs QLoRA

QLoRA 是 **训练时** 4-bit 基座 + 全精度 LoRA；**GPTQ/AWQ** 是 **训练后** 把 merged 权重量化到 4-bit 推理——二者互补：QLoRA 训完 → merge → GPTQ → 7B **~4 GB** 部署。量化推理 loss 通常 **低于 1 pt** MMLU。注意 QLoRA checkpoint **不应** 直接当 GPTQ 输入（除非已 merge）；adapter-only 文件 **17 MB** 不能单独 GPTQ。完整 pipeline：QLoRA SFT **6 GPU·h** → merge **5 min CPU** → GPTQ **~1 GPU·h** → 生产 vLLM。总 **低于 8 GPU·小时** 从基座到 4-bit 服务，是个人开发者黄金路径。
