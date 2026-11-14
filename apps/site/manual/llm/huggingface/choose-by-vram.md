---
title: "按显存选模型"
description: "显存怎么算、各档位能跑什么、以及显存不够时的四种办法。"
source: "https://daiw.org/manual/huggingface/choose-by-vram"
---

# 按显存选模型

> 显存怎么算、各档位能跑什么、以及显存不够时的四种办法。

“我的卡能跑多大的模型”是最高频的问题。这一篇给一个能自己算的公式和一张对照表。

## 显存都花在哪

```text
总显存 ≈ 权重 + KV cache + 激活 + 框架开销
          ↑ 主要        ↑ 随上下文长度增长
```

### 权重

```text
权重显存 ≈ 参数量 × 每参数字节数

           fp16/bf16   2 字节
           int8        1 字节
           int4        0.5 字节
```

| 模型 | bf16 | int8 | int4 |
| --- | --- | --- | --- |
| 0.6B | 1.2 G | 0.6 G | 0.3 G |
| 1.7B | 3.4 G | 1.7 G | 0.9 G |
| 4B | 8 G | 4 G | 2 G |
| 7~8B | **16 G** | 8 G | **4~5 G** |
| 14B | 28 G | 14 G | 7~8 G |
| 32B | 64 G | 32 G | **18~20 G** |
| 70B | 140 G | 70 G | **38~40 G** |

### KV cache —— 容易被忽略的一块

```text
KV cache ≈ 2 × 层数 × KV头数 × head_dim × 上下文长度 × 2 字节
```

具体数字看模型，但有个实用规律：

::: warning

**长上下文时 KV cache 可能比权重还大。**

一个 8B 模型跑 32K 上下文，KV cache 能到好几 GB；跑 128K 时可能超过权重本身。

“模型明明装得下，一聊长了就 OOM”几乎总是这个原因。对策：
- 限制 `max_model_len` / `n_ctx`
- 选用 **GQA**（`config.json` 里 `num_key_value_heads` < `num_attention_heads`）、**MLA** 或**线性注意力混合架构**的模型，KV cache 能小好几倍甚至一个量级（原理详见[《AI 大模型解构》](https://daiw.org/manual/llm-anatomy)）
- vLLM 用 PagedAttention，同样显存能塞更多并发

:::

### 经验系数

实际占用比理论值高，留出余量：

```text
推理：权重 × 1.2 + KV cache
微调（LoRA）：权重 × 1.2 + 激活（约等于权重的 0.3~1 倍，看 batch 与序列长度）
全量微调：权重 × 4（权重 + 梯度 + Adam 两个状态），基本别想
```

## 对照表

按显卡显存给可行方案。**“跑得动”指能出结果，不代表快。**

### 4 GB（GTX 1650 / MX 系列）

| 能跑 | 方式 |
| --- | --- |
| 0.6B~1.7B bf16 | transformers |
| 4B int4 | GGUF Q4_K_M |
| 向量模型 / 小型分类模型 | 全都没问题 |

**这个档位建议直接走 [GGUF + llama.cpp](/manual/llm/huggingface/gguf-llamacpp-ollama)**，部分层放 GPU、其余在 CPU，比硬挤显存实际。

### 8 GB（RTX 3060 Laptop / 4060）

| 能跑 | 方式 |
| --- | --- |
| **7~8B int4** | GGUF Q4_K_M 或 AWQ ← **主力场景** |
| 4B bf16 | transformers |
| 14B int4 | 勉强，上下文要短 |

**8 G 是“能舒服跑 8B 模型”的入门线**，也是消费级最常见的配置。

### 12 GB（RTX 3060 12G / 4070）

| 能跑 | 方式 |
| --- | --- |
| 8B int8 / bf16（短上下文） | transformers |
| 14B int4 | 舒服 |
| **8B QLoRA 微调** | peft + bitsandbytes ← 微调入门线 |

### 16 GB（RTX 4060 Ti 16G / A4000 / Mac M 系 16G 统一内存）

| 能跑 | 方式 |
| --- | --- |
| **8B bf16** | transformers，上下文别太长 |
| 14B int8 | |
| 32B int4 | 勉强 |
| **8B QLoRA 微调**（舒服） | 见[微调](/manual/llm/huggingface/finetune-lora) |

### 24 GB（RTX 3090 / 4090 / A5000）

| 能跑 | 方式 |
| --- | --- |
| **14B bf16** | |
| **32B int4** | 舒服，质量不错 |
| 8B bf16 + 长上下文 | |
| **14B QLoRA 微调** | |
| vLLM 服务化 8B | 见 [vLLM](/manual/llm/huggingface/vllm-serving) |

**24 G 是个甜点**——消费级能买到，且能跑质量相当不错的 32B int4。

### 48 GB+（A6000 / 双 4090 / H100）

| 能跑 |
| --- |
| 32B bf16 |
| **70B int4** |
| 多卡切分跑更大的 |
| 中等规模的生产服务 |

### 纯 CPU

**别放弃——CPU 完全能跑，只是慢。**

| 内存 | 能跑 |
| --- | --- |
| 8 G | 1.7B~4B Q4 |
| 16 G | **8B Q4_K_M**（约 5~10 token/s） |
| 32 G | 14B Q4，或 8B Q8 |
| 64 G | 32B Q4 |

Apple Silicon（M 系列）由于统一内存 + 高带宽，**实际体验比同等内存的 x86 好很多**——M2/M3/M4 上跑 8B 相当流畅。

## 显存不够的四条路

按推荐顺序：

### ① 量化（首选）

最直接。int4 相比 bf16 省 4 倍显存，质量损失通常可接受。见[权重格式](/manual/llm/huggingface/weight-formats)。

::: info

**同等显存下，优先“更大的模型 + 更狠的量化”。**

24 G 显存有两个选择：14B bf16 或 32B int4。**多数任务上 32B int4 表现更好**——参数量带来的能力提升，通常大于量化造成的损失。

这个经验在 8B vs 32B 这种跨档比较时尤其明显。

:::

### ② CPU 卸载

把部分层放到内存：

```python
model = AutoModelForCausalLM.from_pretrained(
    "org/model",
    device_map="auto",              # 自动分配，装不下的放 CPU
    max_memory={0: "7GiB", "cpu": "24GiB"},
)
```

llama.cpp 里对应 `-ngl N`（GPU 上放几层）：

```bash
llama-cli -m model.gguf -ngl 20
```

**代价是明显变慢**——数据要在 PCIe 上来回搬。但“慢”总比“跑不了”好。

### ③ 缩短上下文

```python
# vLLM
LLM(model="...", max_model_len=4096)
```

```bash
# llama.cpp
llama-server -m model.gguf -c 4096
```

KV cache 与上下文长度成正比。**从 32K 降到 4K，能省下好几 GB。**

### ④ 换更小的模型

不丢人——**很多任务上 4B 模型完全够用**。分类、抽取、格式转换这类结构化任务，8B 和 32B 的差距远小于你的预期。

先用小模型验证流程跑通，不够好再换大的。

## 怎么实测

理论算完，实测一下：

```python
import torch
print(f"{torch.cuda.get_device_properties(0).total_memory/1e9:.1f} GB 总显存")

# 加载模型后
print(f"{torch.cuda.memory_allocated()/1e9:.2f} GB 已分配")
print(f"{torch.cuda.max_memory_allocated()/1e9:.2f} GB 峰值")
```

```bash
watch -n1 nvidia-smi
```

::: warning

**`nvidia-smi` 显示的占用通常高于 `memory_allocated()`**——PyTorch 有缓存分配器，释放的显存不会立刻还给驱动。

判断“还能不能塞更多”看 `nvidia-smi`；判断“我的张量占了多少”看 `memory_allocated()`。

想强制归还：`torch.cuda.empty_cache()`（但通常没必要，反而可能拖慢）。

:::

## 小结

- **权重显存 = 参数量 × 每参数字节数**，再乘 1.2 的经验系数。
- **KV cache 在长上下文时可能超过权重**——“一聊长了就 OOM”就是它。
- 8 G 跑 8B int4、24 G 跑 32B int4，是两个最实用的甜点。
- **纯 CPU 完全可行**，16 G 内存能跑 8B Q4；Apple Silicon 体验尤其好。
- 显存不够按顺序试：**量化 → CPU 卸载 → 缩短上下文 → 换小模型**。
- **同显存下优先“大模型 + 重量化”。**
- 别忘了很多任务 **4B 就够**。

下一篇：[用 transformers 跑起来](/manual/llm/huggingface/transformers-serving)。
