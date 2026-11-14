---
title: "为什么显存这么重要"
description: "7B 与 70B 模型在不同精度下占多少 GB，以及 KV Cache 如何吃掉剩余显存"
source: "https://daiw.org/manual/bit-to-agi/09-gpu/why-vram-matters"
---

# 为什么显存这么重要

> 7B 与 70B 模型在不同精度下占多少 GB，以及 KV Cache 如何吃掉剩余显存

「这张卡 24 GB 显存，能跑 7B 吗？」——这是入门 LLM 最常问的问题。显存（VRAM，即 GPU 上的 HBM）同时存放 **模型权重**、**优化器状态**（训练）、**激活**（训练）和 **KV Cache**（推理）。容量不够，要么量化压缩，要么多卡切分，要么直接 OOM。本章用 7B / 70B 两张表把数字算清楚。

OOM（Out Of Memory）报错是 LLM 实践中常见的硬件错误。PyTorch 的报错栈往往指向最后一层 `linear`，但真正原因是 **前面已分配的权重 + KV 之和超过 HBM**。学会 **先算表再跑模型**，比反复 `empty_cache()` 有效得多。

## 直觉

显存像 GPU 工位上的 **桌面**：桌面越大，能同时摊开的文件（权重）和草稿纸（中间结果、KV Cache）越多。桌面满了，你不能把书放在走廊（CPU 内存）上慢慢翻——PCIe 太慢，推理会卡到不可用。70B 模型的 FP16 仅权重就要 **140 GB**，已经超过单张 80 GB H100——所以 **大模型必然涉及多卡或量化**。

## 定义

**参数量 → 权重大小**（仅权重，不含 KV Cache）：

$$
\text{权重 (bytes)} = P \times \text{bytes\_per\_param}
$$

| 精度 | bytes/param | 说明 |
|------|-------------|------|
| FP32 | 4 | 全精度 |
| FP16 / BF16 | 2 | 训练/推理常用 |
| INT8 | 1 | 权重量化 |
| INT4 | 0.5 | GPTQ/AWQ 等 |

**训练额外占用**（同一 GPU 上，粗算）：

- **优化器（Adam）**：FP32 动量 + 方差 ≈ **8× 参数量** bytes（仅 optimizer states，不含 master weights 变体）。
- **梯度**：常与参数同精度，约 **2×** bytes（FP16 训练）。
- **激活**：与 batch、sequence length、层数相关，可用 gradient checkpointing 换时间。

**推理额外占用**：

- **[KV Cache](/manual/llm/bit-to-agi/08-inference/what-is-kv-cache)**：每层、每个 token 存 Key 和 Value。

$$
\text{KV (bytes)} \approx 2 \times L \times H_{\text{kv}} \times D \times T \times \text{bytes}
$$

其中 $L$ = 层数，$H_{\text{kv}}$ = KV 头数，$D$ = head dim，$T$ = 序列长度，系数 2 为 K 与 V。

## 例子：7B 与 70B 权重大小表

假设 **纯权重**，Llama 类 7B / 70B 参数量取整。

### 表 1 — 7B 模型权重大小

| 精度 | 计算 | 权重大小 |
|------|------|---------|
| FP32 | $7 \times 10^9 \times 4$ B | **28 GB** |
| FP16 / BF16 | $7 \times 10^9 \times 2$ B | **14 GB** |
| INT8 | $7 \times 10^9 \times 1$ B | **7 GB** |
| INT4 | $7 \times 10^9 \times 0.5$ B | **3.5 GB** |

### 表 2 — 70B 模型权重大小

| 精度 | 计算 | 权重大小 |
|------|------|---------|
| FP32 | $70 \times 10^9 \times 4$ B | **280 GB** |
| FP16 / BF16 | $70 \times 10^9 \times 2$ B | **140 GB** |
| INT8 | $70 \times 10^9 \times 1$ B | **70 GB** |
| INT4 | $70 \times 10^9 \times 0.5$ B | **35 GB** |

### 表 3 — 能否放进常见单卡显存？（仅权重）

| GPU 显存 | 7B FP16 (14 GB) | 7B INT4 (3.5 GB) | 70B FP16 (140 GB) | 70B INT4 (35 GB) |
|---------|-----------------|------------------|-------------------|------------------|
| 12 GB (3060) | ❌ 紧/需量化 | ✅ 有余量 | ❌ | ❌ |
| 24–32 GB (4090/5090) | ✅ | ✅ | ❌ | ✅ 权重可装，KV 另算 |
| 48 GB (L40S 等) | ✅ | ✅ | ❌ | ✅ |
| 80 GB (A100/H100；H200/B200 为 141/192 GB) | ✅ | ✅ | ❌ 80 GB 需 2 卡+（H200/B200 单卡可装） | ✅ 权重可装 |

**70B FP16 需要至少 2× 80 GB 卡** 做张量并行（或 140 GB 单卡不存在于消费级），且几乎无 KV Cache 余量。

### 表 4 — KV Cache 示例（Llama-2 7B 结构：$L=32$, $H_{\text{kv}}=32$, $D=128$, FP16）

单条序列，$T = 4096$ tokens：

$$
2 \times 32 \times 32 \times 128 \times 4096 \times 2 \approx 2.1 \text{ GB}
$$

$T = 8192$ → 约 **4.2 GB**。batch=8 并发 → **×8**。推理 serving 显存常 **权重 + KV 占满**，故 [PagedAttention](/manual/llm/bit-to-agi/08-inference/paged-attention) 做碎片整理。

## 量化

- **训练 7B FP16 + Adam（单卡粗算）**：权重 14 GB + optimizer ~56 GB + 梯度 14 GB + 激活（视 batch）→ **远超 24 GB**，故 7B 全参微调通常要 **多卡或 LoRA**（见[第七章](/manual/llm/bit-to-agi/07-training/what-is-lora)）。
- **推理 7B FP16 on 24 GB**：14 GB 权重 + 2–4 GB KV + 1–2 GB 运行时 ≈ **17–20 GB** → 4090 可跑，但 context 长或 batch 大仍 OOM。
- **推理 70B INT4 on 48 GB**：35 GB 权重 + KV → **紧张**；80 GB 卡更从容。

### 表 5 — 训练时 Adam 优化器状态（单参数粗算）

| 组件 | bytes/param（Adam FP32 states） |
|------|--------------------------------|
| 权重 FP16 | 2 |
| Master weight FP32（可选） | 4 |
| 一阶矩 m | 4 |
| 二阶矩 v | 4 |
| **合计（常见混合精度）** | **~10–12+** |

7B 全参 Adam 训练：**远超单卡 80 GB**，必须 **ZeRO 分片、FSDP、或 LoRA**——显存规划不能只看权重的 14 GB。

### 表 6 — 不同 context 下 7B KV Cache（FP16，batch=1）

| Sequence $T$ | KV Cache（约） |
|-------------|---------------|
| 2048 | ~1.0 GB |
| 4096 | ~2.1 GB |
| 8192 | ~4.2 GB |
| 32768 | ~17 GB |

长 context 服务时，KV 可 **超过权重**——[PagedAttention](/manual/llm/bit-to-agi/08-inference/paged-attention) 与 [Prefix Caching](/manual/llm/bit-to-agi/08-inference/prefix-caching) 直接针对显存碎片与复用。

## 量化部署决策树

1. 参数量 $P$ → 查表得 FP16 / INT4 权重大小
2. 加 KV：$T$、batch、层数 → 用上节公式
3. 加 runtime overhead ~10–20%
4. 若 sum > 单卡 HBM → 量化 / 多卡 / 减 $T$ / 减 batch

**例**：70B INT4 35 GB + 8k context KV（单请求数 GB 级）+ overhead → **48 GB 卡紧张，80 GB 推荐**。

## 常见误区

::: warning

**误区：「7B 模型 = 7 GB 显存」** — 7B 是 **参数个数**，不是 GB；FP16 约 **14 GB** 仅权重。

:::

::: warning

**误区：「量化到 INT4 无损」** — 显存减半有余，但精度下降；任务敏感场景需评测 perplexity / 下游指标。

:::

**误区：「显存空着就浪费」** — 预留 KV 与 CUDA workspace；`nvidia-smi` 显示 100% 使用可能是 cache，也可能是 OOM 前兆。

## 动手试一试

```python
# 估算权重大小（不含 KV）
def weight_gb(params_b: float, bytes_per_param: float) -> float:
    return params_b * 1e9 * bytes_per_param / 1e9

for name, p in [("7B", 7), ("70B", 70)]:
    print(f"{name} FP16: {weight_gb(p, 2):.1f} GB")
    print(f"{name} INT4: {weight_gb(p, 0.5):.1f} GB")
```

```python
# 估算 KV Cache（FP16）
def kv_cache_gb(layers, kv_heads, head_dim, seq_len, batch=1, bytes_per=2):
    return 2 * layers * kv_heads * head_dim * seq_len * batch * bytes_per / 1e9

print("7B @ 4096 ctx:", kv_cache_gb(32, 32, 128, 4096), "GB")
print("7B @ 8192 ctx:", kv_cache_gb(32, 32, 128, 8192), "GB")
```

加载模型时用 `nvidia-smi` 观察显存台阶：`from_pretrained` 后跳变 ≈ 权重大小。

## MoE 与显存：专家并行的额外维度

[Mixture of Experts（MoE）](/manual/llm/bit-to-agi/07-training/what-is-moe) 模型总参数量大，但 **每 token 只激活部分专家**。显存需存放 **全部专家权重**（或 offload 未用专家），激活计算量小于 dense 同参数量——**「参数量」与「激活参数量」要分开看**。例如 Mixtral 8×7B 总参数 ~47B，激活约 13B/ token，但 INT4 权重仍接近 **~24 GB 级**，加 KV 后 24 GB 消费卡依然紧张。

部署 MoE 前：查 **总权重**（决定 HBM）、查 **激活宽度**（决定算力），两者都不等于 marketing 里的「7B」单数字。

## 回顾与自测

**Q：24 GB 卡跑 7B FP16，还能开 8k context 吗？**
A：权重 14 GB + KV ~4 GB + overhead → 紧张但可能；更长 context 或更大 batch 需量化或换 48 GB 卡。

**Q：QLoRA 训练为何省显存？**
A：基座 4-bit 量化 + 仅训练 LoRA 适配器 + 优化器只跟 adapter 参数——详见 [LoRA 篇](/manual/llm/bit-to-agi/07-training/what-is-lora)。

**Q：`torch.cuda.max_memory_allocated()` 代表什么？**
A：PyTorch 分配器峰值；`nvidia-smi` 还含 CUDA context 与碎片，二者可能差几 GB。

**Q：两张 24 GB 卡能跑 70B INT4 吗？**
A：权重 35 GB 可切到两卡，但需张量并行框架支持且无 NVLink 时延迟高；80 GB 单卡更省心。

## 工程师备忘录

- 7B FP16 权重 **14 GB**；70B FP16 **140 GB**；INT4 约 **÷4**。
- 训练 Adam：optimizer states 常 **>> 权重** → 多卡 / LoRA / ZeRO。
- KV Cache 随 **层数 × 头数 × head_dim × seq × batch** 线性涨。
- OOM 前先 **算表**：权重 + KV + 20% 余量。

显存规划是 **上线前 checklist** 第一项：比选模型、调 prompt 都应更早完成。团队内建议维护一张「模型 × 精度 × 卡型 × 最大 context」对照表，避免每次部署临时试错 OOM。

量化（INT4/INT8）是 **用精度换容量与带宽** 的杠杆；多卡并行是 **用互联换容量** 的杠杆。二者组合使用时有精度与延迟 trade-off，没有免费午餐——但表 1–6 至少能告诉你 lunch 标价在哪。

## 小结

显存决定 **能跑多大的模型、多长 context、多大 batch**。7B FP16 权重 **14 GB**，70B FP16 **140 GB**；INT4 约减半再减半。训练还要 optimizer 与梯度；推理还要 KV Cache。买卡或租集群前，先用表格算一遍 **权重 + KV + 余量**，比背「几 B 用几 G 卡」更可靠。

下一篇：[本章总结](/manual/llm/bit-to-agi/09-gpu/chapter-summary)
