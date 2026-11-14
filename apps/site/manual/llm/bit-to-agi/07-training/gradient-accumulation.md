---
title: "梯度累积"
description: "从 Bit 到 AGI · 第七章：训练 · 用小 batch 多次 forward 模拟大 batch 更新"
source: "https://daiw.org/manual/bit-to-agi/07-training/gradient-accumulation"
---

# 梯度累积

> 从 Bit 到 AGI · 第七章：训练 · 用小 batch 多次 forward 模拟大 batch 更新

梯度累积（Gradient Accumulation）让你在**显存只够 micro-batch=1** 时，仍实现 **effective batch = 64** 的训练效果：连续做 64 次 forward/backward，**累加梯度**后一次 `optimizer.step()`。LLM 训练里，全局 batch 常按 **token 数**（如 4M token/step）而非 sample 数定义。

## 直觉：分 64 次搬砖，一次结算工钱

大 batch 像一次雇 64 人搬完一卡车砖（并行、稳）。

显存不够时，**一个人搬 64 趟**（累积 64 micro-batch 的梯度），最后一起更新权重——数学上等价于大 batch（忽略 BatchNorm 等，Transformer 用 LayerNorm 无此问题）。

## 定义

设 micro-batch 大小 $b$，累积步数 $k$，则：

$$
\text{effective batch} = b \times k \times \text{num\_GPUs}
$$

优化器每 $k$ 个 micro-step 更新一次；**学习率通常按 effective batch 缩放**（linear scaling）。

| 场景 | micro-batch/GPU | accum steps | 8 GPU effective |
| --- | --- | --- | --- |
| 7B LoRA 24GB | 1 seq×2048 | 16 | 128 seq |
| 7B 全参 80GB | 2×4096 | 8 | 128 seq |
| 70B ZeRO-3 | 1×2048 | 32 | 256 seq |

**Token 视角**（更常用）：effective tokens/step = micro_tokens × accum × GPUs。

## 例子 1：单卡 QLoRA 训 7B

目标 effective batch = **128 × 2048 = 262k token/step**（Alpaca 级常见）。

| 项 | 数值 |
| --- | --- |
| RTX 4090 24GB micro-batch | 1 × 2048 token |
| gradient_accumulation_steps | **128** |
| 每 optimizer step 的 forward 次数 | 128 |
| 墙钟 / optimizer step | ~128 × 80ms ≈ **10 秒** |
| 总 780 steps | ~2.2 小时 ≈ **2.2 GPU·小时** |

无累积、micro=1 直接 step：梯度噪声极大，loss 震荡，需 **3× epoch** 才收敛 → **~6 GPU·小时** 且效果仍差。

## 例子 2：预训练 4M token/step

512× H100，每卡 micro **8192 token**，求 accum：

$$
8192 \times 512 \times k = 4{,}000{,}000 \implies k \approx 1
$$

大集群 **accum=1**；小团队 8 卡复现：

$$
2048 \times 8 \times k = 4{,}000{,}000 \implies k \approx 244
$$

每 step **244 次** micro-forward → 单 step 墙钟 **分钟级**；但 **250k step × 4M token = 1T** 的数学不变，总 GPU·小时 ~**29k**（7B）不变——**换时间换显存**。

## 量化：accum 的代价

| 因素 | 影响 |
| --- | --- |
| 墙钟时间 | 线性 × accum（串行 micro-batch） |
| 显存 | 仅一份激活图（可 + gradient checkpoint） |
| 梯度精度 | 累加用 FP32 防 underflow |
| 通信 | 多卡时 optimizer step 前需 **gradient all-reduce** |

**Gradient checkpointing** + accum：7B 可在 **24GB** 跑 seq=4096，代价 forward **+30% 时间**。

## 深入：global batch 与有效 batch 的换算

论文里写「batch size = 4M tokens」指的是 **optimizer step 级别**，不是 micro-batch。换算链：

$$
\text{tokens/step} = \text{micro\_tokens} \times \text{accum} \times \text{GPUs}
$$

8 卡 QLoRA 想达到 **262k tokens/step**（接近论文小 scale）：micro=2048、accum=16 → 2048×16×8 = **262k**，正确。若忘记乘 GPU 数，实际只有 **32k/step**，相当于 LR 有效缩小 8×，**780 step 的 SFT 需 6000+ step** 才等价——**6 GPU·小时 → 48 GPU·小时**。

Gradient accumulation **不减少总 FLOPs**：总 token 固定则总 backward 次数固定；accum 只是把 optimizer step 变少、每 step 梯度更准。预训练 1T token 的总 GPU·小时 **~29k（7B）** 与 accum 无关，只与 **总 token × 参数量** 有关；accum 只影响 **能否在有限显存下达到目标 batch** 从而 **正确缩放 LR**。

与 [混合精度](/manual/llm/bit-to-agi/07-training/mixed-precision-training) 联用时，accum 中间梯度建议在 **FP32 累加**（PyTorch 默认），避免 BF16  thousands 次 micro 累加后失真——长 accum（128+）时这 **0.5% 额外内存** 值得开。

## 动手试一试

```python
import torch
import torch.nn as nn

model = nn.Linear(128, 128)
opt = torch.optim.SGD(model.parameters(), lr=0.1)
accum_steps = 4
opt.zero_grad()

for micro in range(accum_steps):
    x = torch.randn(8, 128)
    loss = model(x).pow(2).mean() / accum_steps  # 缩放 loss
    loss.backward()
    print(f"micro {micro} loss={loss.item()*accum_steps:.4f}")

opt.step()  # 等价于一次 batch=8*4 的更新
print("weights updated once after 4 micro-batches")
```

Hugging Face `TrainingArguments(gradient_accumulation_steps=128)` 自动处理 loss 缩放。

## 常见误区

1. **「accum 可以代替多卡」** — 数学等价 batch，但**墙钟更慢**；多卡还并行数据。
2. **「忘记除 loss」** — 不除 accum_steps 等于 LR 放大 accum 倍 → 易 NaN。
3. **「accum 中间可以 step optimizer」** — 破坏大 batch 语义；只在第 k 步 step。

## 小结

梯度累积用 **k 次小 forward** 模拟大 batch；单卡 7B QLoRA 常用 **accum=128**，~**2 GPU·小时** 完成 Alpaca SFT。预训练 4M token/step 在大集群 accum≈1，小集群 accum 可达 **200+**。

下一篇：[混合精度训练](/manual/llm/bit-to-agi/07-training/mixed-precision-training)——BF16/FP16 省显存、提速。

## 延伸：有效 batch 与收敛理论

大 batch（按 token）梯度估计方差小，收敛更稳但可能 **泛化略差**（sharp minima  folklore）；LLM 实践仍倾向 **大 batch + 高 LR** 因吞吐优先。7B 预训练 **4M token/step** 是常见甜点；降到 **512k/step** 需 **更多 total step** 达同样 loss，总 FLOPs 不变但 **通信次数 ×8**，wall-clock 可能 **+15%**。Accum 让你在小显存机器上 **模拟 4M/step 的 LR scaling**，而不必真有 512 卡——这是个人开发者对齐 **论文 hyperparam** 的关键技巧。记住：accum 改变的是 **optimizer 更新频率**，不改变 **总训练 token 与总 FLOPs**。

## 延伸：micro-batch 与 tokens/sec

`tokens/sec` = micro_tokens × accum × GPUs / step_time。7B LoRA 单 4090 **~2000 tokens/s** 时，40M token 需 **40M/2000 ≈ 5.5h ≈ 5.5 GPU·小时**——与上文 **6 GPU·小时** 一致。若忘记 accum、micro 过小，tokens/s 不变但 **有效 batch 小** → 需 **更多 step** 才收敛，总 token 可能 **×2** 到 80M → **11 GPU·小时**。监控 tokens/s 同时看 **loss/step** 与 **loss/token**（总 loss 累加 normalize）。DeepSpeed **gradient accumulation dtype** 设 FP32 是默认正确选择；手动改 BF16 accum 在长 run 可能 **late-training 不稳定**，浪费 **最后 10% token（预训练 100B token ≈ 2900 GPU·小时）**。
