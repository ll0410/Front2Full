---
title: "推理量化"
description: "从 Bit 到 AGI · 第八章：推理（Inference） · INT4/FP8 权重与 KV 量化"
source: "https://daiw.org/manual/bit-to-agi/08-inference/quantization-inference"
---

# 推理量化

> 从 Bit 到 AGI · 第八章：推理（Inference） · INT4/FP8 权重与 KV 量化

FP16 的 70B 权重约 140 GiB，单卡无缘。推理量化把权重（有时含 KV Cache）压到 **INT8、INT4、FP8**，用 **略降的精度** 换 **2～4× 显存** 与更高 **内存带宽有效吞吐**——是在线服务降本的核心杠杆之一。

## 直觉

地图可以用 **1:100 万** 精度的矢量图（FP16），导航时 **1:10 万** 栅格（INT8）往往够用。量化像 **降低地图分辨率**：主干道还在，小巷可能糊——对 LLM，「主干道」是 **高频权重模式**，outlier 需特殊处理（AWQ、GPTQ）。

## 定义

**量化**把浮点 $w \in \mathbb{R}$ 映射到离散 $q \in \mathbb{Z}$，配合 scale/zero-point：

$$
w \approx s \cdot (q - z), \quad q \in [0, 2^b - 1]
$$

| 格式 | 每权重字节 | 8B 模型权重 | 70B 模型权重 |
| ---- | ---------- | ----------- | ------------ |
| FP32 | 4 | 32 GiB | 280 GiB |
| FP16/BF16 | 2 | 16 GiB | 140 GiB |
| INT8 | 1 | 8 GiB | 70 GiB |
| INT4 (group) | 0.5 | 4 GiB | 35 GiB |
| FP8 (E4M3) | 1 | 8 GiB | 70 GiB |
| FP4 (MXFP4/NVFP4) | 0.5 | 4 GiB | 35 GiB |

**推理路径**：

- **Weight-only**：激活 FP16，权重 INT4/8（GPTQ、AWQ、llama.cpp GGUF）
- **W8A8 / FP8**：权重与激活皆低精度（TensorRT-LLM、H100 FP8）
- **KV Cache FP8/INT8**：[KV Cache 篇](/manual/llm/bit-to-agi/08-inference/what-is-kv-cache) 体积 **÷2**

## 例子

**例 1：8B 单卡 24 GiB 账本**

| 项 | FP16 | INT4 权重 + FP16 KV |
| -- | ---- | ------------------- |
| 权重 | 16 GiB | **4 GiB** |
| KV（8K ctx, batch=4） | ~4 GiB | ~4 GiB |
| workspace | 2 GiB | 2 GiB |
| **合计** | **22 GiB**（紧） | **10 GiB**（宽裕） |

INT4 后 **batch 或 ctx 可翻倍**。

**例 2：延迟与吞吐（8B，A100-80G，粗测级）**

| 配置 | 单用户 ITL | 最大 tok/s（高并发） |
| ---- | ---------- | -------------------- |
| FP16 | 22～30 ms/tok | ~1200 |
| INT8 weight-only | 20～28 ms/tok | ~1400 |
| INT4 AWQ | 18～25 ms/tok | ~1600～2000 |

INT4 **带宽减半** → memory-bound decode **往往快 10～30%**；质量损失在 MMLU 等 **1～3 点**（视校准数据）。

**例 3：KV FP8**

128 KiB/token FP16 KV → FP8 **64 KiB/token**。128K ctx 单序列 KV：**16 GiB → 8 GiB**。需 **per-tensor or per-channel scale**；与 FlashAttention 内核需 **版本匹配**。

```python
def model_weight_gib(params_b: float, bits: int) -> float:
    return params_b * 1e9 * (bits / 8) / (1024**3)

for bits in [16, 8, 4]:
    print(f"70B @ {bits}-bit: {model_weight_gib(70, bits):.1f} GiB")
# 70B @ 16-bit: 130.4 GiB
# 70B @ 8-bit: 65.2 GiB
# 70B @ 4-bit: 32.6 GiB
```

## 量化

- **校准（PTQ）**：用 128～512 条代表样本跑 forward，统计 min/max 或 Hessian（GPTQ）→ **离线一次**。
- **QAT**：训练时 fake quant，推理更准，**成本高**，大模型少见。
- **Marlin / CUTLASS**：INT4 GEMM 需 **特定 kernel**；随便 `tensor.to(int4)` 不会快。
- **精度–延迟–显存三角**：INT4 省显存最多；FP8 在 H100 上 **算力+带宽** 双赢；FP16 质量 baseline。

::: warning

量化模型与 **Prefix Caching、LoRA、Speculative draft** 组合时要确认栈支持同一 checkpoint 格式；混用框架易 silent 降级到 FP16。

:::

## 工程现场：格式选型与质量 A/B

**常见部署格式**：

| 格式 | 工具链 | 典型场景 |
| ---- | ------ | -------- |
| GGUF Q4_K_M | llama.cpp | 本地 CPU/GPU 混合 |
| AWQ INT4 | vLLM, TGI | 云端 8B～70B |
| GPTQ INT4 | ExLlama, HF | 消费级单卡 |
| FP8 / FP4 | TensorRT-LLM, vLLM, SGLang（H100/H200/B200） | 企业低延迟与高吞吐 |

**质量–速度权衡（8B，MMLU 5-shot 粗量级）**：

| 精度 | MMLU | 相对 FP16 tok/s |
| ---- | ---- | --------------- |
| FP16 | 基准 ~68 | 1.0× |
| INT8 | −0.5～1 点 | 1.05～1.15× |
| INT4 AWQ | −1～3 点 | 1.2～1.4× |

主观聊天 **INT4 可接受** 的用户比例常 **> 80%**（内部 A/B 经验级，非 universal）；**数学证明题** 建议 FP16 或 **INT8 + 高 temperature 禁**。

**Group size**：INT4 常 **group=128** 共用一个 scale；group 越小 **越准越慢**。Outlier channel（AWQ 识别）保留 FP16 **混合精度**——**3% 权重 FP16 + 97% INT4** 可挽回 **~1 点** MMLU。

**KV FP8 部署检查清单**：

1. FlashAttention 版本是否支持 FP8 KV
2. 长 ctx（>32K）**PPL 漂移**是否可接受
3. Prefix cache 块是否 **同精度** 共享

**成本账**：70B FP16 需 **8×A100**；INT4 可 **2×A100 80G**（TP=2）——在非关键路径上，**卡费 ÷4** 往往比 **略降质量** 更划算。

**GPTQ vs AWQ 简述**：GPTQ 用 Hessian 近似 **逐层权重量化**，离线慢、压缩好；AWQ 识别 **salient weight channel** 保留高精度，**4-bit 下 MMLU 常高 1～2 点**。部署时看框架 **kernel 支持**——vLLM 对 AWQ/GPTQ 均有路径，**Marlin** 等 INT4 GEMM 决定 **实际 tok/s**。

**CPU 推理**：llama.cpp GGUF Q4 在 **M 系列 CPU** 上 **30～80 tok/s**（7B 量级）——无 GPU 时的 baseline；与 A100 **1500 tok/s** 差 **20×+**，但 **\$/token** 在边缘场景可能更低。

**校准集选择**：用 **与线上 prompt 同分布** 的 512 条做 PTQ；用 Wikipedia 校准而线上全是 **代码**，INT4 **语法错误率** 会升——**分布错配** 比 **bit 宽** 更伤质量。

## 部署案例

**Case A**：24G 卡跑 8B FP16 + 8K ctx batch=4 → KV **~4 GiB**，总占用 **~22 GiB**，**无余量**。改 INT4 权重 **4 GiB** → 余 **6 GiB** 可 **batch=8 或 ctx=16K**。

**Case B**：70B 需 **140 GiB FP16** → **8×A100 TP=8** 或 **4×80G INT4 TP=4**。INT4 **MMLU -2 点** 换 **卡数减半** 是 **常见 FinOps 决策**。

## 常见误区

1. **「量化只省显存不加速」**——decode 常 memory-bound，**小权重 = 少读 HBM = 更快**。
2. **「INT4 一定不可读」**——校准得当的 AWQ/GPTQ 聊天 **主观可接受**；数学/代码需 A/B。
3. **「KV 量化无损」**——长 ctx 累积误差可能 **略增 perplexity**；极端需 FP16 KV。

## 动手试一试

用 `model_weight_gib` 算：24 GiB 卡 INT4 8B 剩多少给 KV；设 128 KiB/token，max batch 多少（8K ctx）？

## 回顾与衔接

第七章 [混合精度训练](/manual/llm/bit-to-agi/07-training/mixed-precision-training) 用 FP16/BF16 **训**；推理量化是 **部署时 PTQ**——不再更新权重，只 **压缩存储与带宽**。[KV Cache](/manual/llm/bit-to-agi/08-inference/what-is-kv-cache) FP8/INT8 与权重 INT4 **独立**：可 **W4A16 + KV fp16** 或 **W4 + KV fp8** 组合，按 **OOM 瓶颈** 选配。

Decode **memory-bound** 时，读权重字节 **直接映射** 到 ms/tok——INT4 相对 FP16 **理论带宽减半** → **ITL 往往降 10～25%**（kernel 效率折扣后）。Prefill **compute-bound** 更多时，量化收益 **小于 decode**。

读 [延迟与吞吐](/manual/llm/bit-to-agi/08-inference/latency-vs-throughput) 表格时，INT4 行要同时看到 **单用户 ITL↓** 与 **同卡 max batch↑**——**\$/token** 往往 **双降**。

## 读者问答

**问：INT4 适合所有模型吗？**
**7B～70B _dense_ 聊天** 常见；**数学/代码/多模态** 需 **任务 A/B**。MoE、小模型 **不一定有成熟 INT4 kernel**。

**问：量化后要重新训练吗？**
**PTQ 不需要**；QAT 要 **再训** 但少见。**校准集** 选错 **比 bit 宽更伤**。

## 速查卡

| 格式 | 8B 权重 | 70B 权重 |
| ---- | ------- | -------- |
| FP16 | ~16 GiB | ~140 GiB |
| INT8 | ~8 GiB | ~70 GiB |
| INT4 | ~4 GiB | ~35 GiB |

**Decode**：memory-bound 时 **INT4 常 10～25% ITL↓**；**MMLU** 常 **-1～3 点**——**A/B 再上线**。

**上线清单**：INT4 模型 **必须用框架支持的 checkpoint 格式**（AWQ/GPTQ/GGUF）；**裸 .safetensors 转 int4** 不会 **自动加速**。

AWQ / GPTQ 原论文 **Table 1** 对比 **不同 bit 与 perplexity**；上线前 **至少跑 your-domain 100 条** 人工 spot check。**混合精度 outlier channel** 是 **AWQ 精度的关键**。

量化不是 **银弹**：INT4 在 **计数、小数、长链推理** 上更容易 **出错**；上线后应 **监控格式错误率、计算题准确率** 等业务指标，而不是只看 **平均 chat 满意度**。当 INT4 **不达标** 时，**INT8/FP8 权重 + FP16 KV** 往往是 **稳妥折中**，而不是 **退回全 FP16 70B**。

**本章衔接**：量化与 [KV Cache](/manual/llm/bit-to-agi/08-inference/what-is-kv-cache) 字节公式 **联立**，才能回答 **「这张卡能跑多少并发、多长 ctx」**。**先权重量化，再 KV 量化** 是 **常见 rollout 顺序**。上线务必 **保留 FP16 回滚路径**。**INT8/FP8 常作第一条量化线，INT4 需业务 A/B 通过后再全量**。量化上线 **务必保留 FP16 checkpoint 以便一键回滚**。**监控业务指标优于只看 perplexity**。**量化是推理降本的核心杠杆之一**。**部署前请做 domain A/B 对比**。**本章量化与延迟篇联读效果更佳**。**务必实测后再上线**。

## 小结

推理量化压缩权重与 KV 存储，INT4/FP8 在 8B～70B 部署中显著降显存并常提速 decode。下一篇用 **ms/tok** 把 **延迟与吞吐** 放到一张表里读。

→ 下一篇：[延迟与吞吐](/manual/llm/bit-to-agi/08-inference/latency-vs-throughput)
