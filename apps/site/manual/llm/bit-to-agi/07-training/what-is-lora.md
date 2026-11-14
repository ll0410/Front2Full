---
title: "LoRA 是什么"
description: "从 Bit 到 AGI · 第七章：训练 · 低秩适配：冻结大模型，只训小矩阵"
source: "https://daiw.org/manual/bit-to-agi/07-training/what-is-lora"
---

# LoRA 是什么

> 从 Bit 到 AGI · 第七章：训练 · 低秩适配：冻结大模型，只训小矩阵

LoRA（Low-Rank Adaptation，低秩适配）在冻结预训练权重 $W_0$ 的同时，只训练低秩增量 $\Delta W = BA$（$B \in \mathbb{R}^{d \times r}$，$A \in \mathbb{R}^{r \times k}$，$r \ll \min(d,k)$）。7B 全参数微调需 **~60GB+** 优化器状态；LoRA 常 **低于 1GB** 可训练参数，单卡 24GB 也能跑。

## 直觉：给厚书贴便签，不改正文

全参数微调像**把整本教科书重印一版**——每个字都能改，成本高。

LoRA 像只在关键章节贴 **窄便签**（秩 $r$ 控制便签宽度）：大部分原文（$W_0$）不动，便签上的补充（$BA$）承载新任务知识。便签很窄（$r=8$–64），但堆在 attention 和 FFN 的多个矩阵上，表达能力足够 SFT。

$$
h = W_0 x + \frac{\alpha}{r} B A x
$$

$\alpha$ 是缩放超参，常用 $\alpha = r$ 或 $\alpha = 2r$。

## 定义

| 超参 | 典型值 | 作用 |
| --- | --- | --- |
| rank $r$ | 8, 16, 32, 64 | 越大越强、越贵 |
| target modules | `q_proj,v_proj,...` | 注入哪些层 |
| $\alpha$ | 16–64 | 有效学习率缩放 |
| dropout | 0.05–0.1 | 防过拟合 |

7B Llama 结构，**r=16** 只训 attention 四矩阵：

| 项 | 数量 |
| --- | --- |
| 可训练参数 | ~4.2M（0.06% of 7B） |
| 适配器文件大小 | ~17 MB（FP16） |
| 全量 7B checkpoint | ~14 GB |

## 例子 1：SFT GPU·小时

**场景**：Llama-3-8B LoRA SFT，Alpaca 52k 条，3 epoch，~40M token；单 A100 80GB，batch=4，seq=2048。

| 配置 | GPU·小时 |
| --- | --- |
| LoRA r=16，bf16 | **~6–10** |
| 全参数 bf16 + Adam | ~80–120（需多卡） |
| LoRA r=64 | ~12–18 |

LoRA 约为全参 **1/10–1/15** 算力；效果在多数指令任务达全参 **90–98%**。

## 例子 2：多适配器切换

LoRA 权重与基座**分离存储**：

```
base/          # 14 GB，加载一次
adapters/
  medical/     # 17 MB
  code/        # 17 MB
  chinese/     # 17 MB
```

推理时 `W = W_0 + B_{\text{task}} A_{\text{task}}` 合并或动态加载——**一个基座服务多业务**，显存只多一份 $\Delta W$。

## 量化：秩 r 怎么选

| r | 可训练参数 (7B) | MMLU Δ（经验） | 适用 |
| --- | --- | --- | --- |
| 4 | ~1M | 略降 | 快速试验 |
| **16** | ~4M | 接近全参 | **默认 sweet spot** |
| 64 | ~16M | 几乎持平 | 难任务 |
| 256 | ~67M | 边际收益小 | 接近全参成本上升 |

## 动手试一试：LoRA 前向

```python
import torch
import torch.nn as nn

class LoRALinear(nn.Module):
    def __init__(self, linear: nn.Linear, r=8, alpha=16):
        super().__init__()
        self.linear = linear
        self.linear.weight.requires_grad = False
        if linear.bias is not None:
            self.linear.bias.requires_grad = False
        d_in, d_out = linear.in_features, linear.out_features
        self.A = nn.Parameter(torch.randn(r, d_in) * 0.01)
        self.B = nn.Parameter(torch.zeros(d_out, r))
        self.scale = alpha / r

    def forward(self, x):
        return self.linear(x) + (x @ self.A.T @ self.B.T) * self.scale

base = nn.Linear(512, 512)
lora = LoRALinear(base, r=8)
x = torch.randn(2, 128, 512)
y = lora(x)
trainable = sum(p.numel() for p in lora.parameters() if p.requires_grad)
print(f"trainable params: {trainable:,}")  # 8192 + 4096 = 12288
```

PEFT 库 `LoraConfig(r=16, target_modules=["q_proj","v_proj"])` 即此逻辑。

## 深入：该注入哪些层、合并还是分离

经验上，**attention 的 q/k/v/o 四类投影** 是 LoRA 主战场；部分任务（代码、长上下文）再加 **FFN 的 up/down/gate** 可再涨 **1–3 pt** benchmark，可训练参数从 4M 涨到 **~20M**，GPU·小时仍个位数。只训 `q_proj,v_proj` 是十分省显存的配置；全层注入接近 r=64 的上限效果，但 **保存多个 adapter 时合并逻辑更复杂**。

推理时有两种策略：**运行时合并** `W' = W_0 + BA` 写回稠密权重——零额外延迟，但每个任务要一份完整 14 GB 副本；**运行时双路**——base 4-bit/8-bit + adapter BF16 双 matmul，延迟 +5–10%，但 **一个 base 挂多个 17 MB adapter** 极省磁盘与加载时间。Serving 10 个业务 LoRA 时，后者是 vLLM / LoRAX 的默认思路。

学习率方面，LoRA 常用 **比全参 SFT 高 2–5×**（2e-4 vs 5e-5），因为可训练参数少、更新幅度需要更大才能在低秩子空间里写入新知识。配合 [cosine + warmup](/manual/llm/bit-to-agi/07-training/learning-rate-schedule)，40M token 训练 **6–10 GPU·小时** 后，应在 held-out 200 条上人工 spot-check，而不只看 loss——LoRA 过拟合时 loss 可降到 0.5 以下但输出开始复读训练集句式。

## 常见误区

1. **「LoRA 不能训新知识」** — 能注入领域事实，但**弱于**全参；海量新知识仍倾向全参或继续预训练。
2. **「rank 越大越好」** — r>64 边际递减；且 optimizer 内存线性涨。
3. **「LoRA 和量化冲突」** — 见 [QLoRA](/manual/llm/bit-to-agi/07-training/what-is-qlora)，4-bit 基座 + LoRA 可共存。

## 小结

LoRA 只训 **0.01%–0.1%** 参数；7B SFT **40M token** 约 **6–10 GPU·小时**（单 A100）。是个人与中小团队微调的事实标准。

下一篇：[QLoRA 是什么](/manual/llm/bit-to-agi/07-training/what-is-qlora)——4-bit 基座 + LoRA，消费级显卡训 70B。

## 延伸：DoRA、RSLoRA 与合并

LoRA 变体 **DoRA**（Weight-Decomposed Low-Rank Adaptation）把 magnitude 与 direction 分开适配，部分 benchmark **+0.5–1 pt** 于 r=16，训练成本与 LoRA 同阶 **~6–10 GPU·小时**。 **RSLoRA** 调整 scaling $\alpha/r$ 为 $\alpha/\sqrt{r}$，长序列 SFT 有时更稳。**合并 adapter** 到基座：`merge_and_unload()` 得单一 14 GB 权重，便于 vLLM 部署；保留分离 adapter 便于多租户。多 LoRA 同时服务时，vLLM **~0.1 ms/token** 额外开销（相对 7B **~15 ms/token**）可忽略——远优于加载多份完整 7B。
