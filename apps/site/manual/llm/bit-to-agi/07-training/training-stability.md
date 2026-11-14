---
title: "训练稳定性"
description: "从 Bit 到 AGI · 第七章：训练 · Loss spike、梯度爆炸与 NaN 的排查与预防"
source: "https://daiw.org/manual/bit-to-agi/07-training/training-stability"
---

# 训练稳定性

> 从 Bit 到 AGI · 第七章：训练 · Loss spike、梯度爆炸与 NaN 的排查与预防

训练稳定性（Training Stability）指 loss 曲线**平滑下降**、无数值崩溃（NaN/Inf）、无突发 spike。预训练 1T token 长跑中，一次未处理的 spike 可能浪费 **数十亿 token 的 GPU·小时**；对齐阶段 RM hacking 也会导致 loss **假降、质量真崩**。

## 直觉：高速公路上突然急刹

稳定训练像**匀速巡航**；spike 像急刹——有时能恢复，有时后车追尾（梯度爆炸 → 权重 corrupt → 全程 NaN）。

LLM 训练栈有多层「安全带」：梯度裁剪、warmup、[混合精度](/manual/llm/bit-to-agi/07-training/mixed-precision-training) 选择、数据去重、MoE 负载均衡。

## 定义

常见异常信号：

| 信号 | 阈值（经验） | 含义 |
| --- | --- | --- |
| loss spike | 单 step > 2× 滑动平均 | 坏 batch / LR 过高 |
| grad norm | > 1.0（clip 前） | 即将爆炸 |
| NaN/Inf | 任意 | 立即停止、回滚 checkpoint |
| PPL 突升 | val +20% | 过拟合或数据污染 |
| MoE aux loss | > 0.1 | 路由崩溃 |

**恢复策略**：回滚到最近 stable [checkpoint](/manual/llm/bit-to-agi/07-training/checkpoint)，降 LR 10–50%，跳过可疑 data shard，继续训。

## 例子 1：预训练 spike 的真实成本

7B，512 GPU，全局 4M token/step，在 step 120,000 发生 spike 未处理：

| 项 | 数值 |
| --- | --- |
| spike 后仍跑到 step 125,000 | 5k step × 4M = **20B token** |
| 20B token GPU·小时 | 20B / 1T × 40,400 ≈ **808 GPU·小时** |
| 若 weights 已 corrupt | **808 GPU·小时作废** + 回滚重跑 |

若每 2000 step 存 checkpoint + **自动 NaN 检测停训**：最多损失 2000 step = **8B token ≈ 323 GPU·小时**。

## 例子 2：SFT 不稳定对比

7B LoRA，peak LR **2e-4** vs **1e-3**：

| 配置 | step 50 loss | step 200 | 结果 |
| --- | --- | --- | --- |
| 2e-4 + warmup 50 | 1.8 | 1.35 | 正常 |
| 1e-3 无 warmup | 3.2→NaN | — | **~6 GPU·小时浪费** |
| 2e-4 + 无 grad clip | 1.9 | spike@180 | 可恢复 |

LoRA 总预算仅 **~6 GPU·小时**，一次 NaN 占 **100% 重跑**——小项目更要保守 LR。

## 量化：稳定化技术清单

| 技术 | 预训练 | SFT/LoRA | 效果 |
| --- | --- | --- | --- |
| Grad clip (max_norm=1.0) | ✓ | ✓ | 防爆炸 |
| Warmup | ✓ | ✓ | 起步稳 |
| BF16 vs FP16 | BF16 | BF16 | 减 overflow |
| Weight decay 0.1 | ✓ | 0.01 | 正则 |
| Dedup 数据 | ✓✓ | ✓ | 减重复 spike |
| z-loss (logit L2) | 部分模型 | — | 压 logits 极端值 |

全局范数裁剪：$g \leftarrow g \cdot \min(1,\ \tau/\|g\|_2)$，典型 $\tau=1.0$。

## 深入：监控栈与自动熔断

生产训练应 **每 step 记录**：loss、grad_norm、LR、tokens/sec、MFU（Model FLOPs Utilization）。MFU **低于 25%** 说明 IO/通信瓶颈，同样 1T token 墙钟拉长 **2–4×**，等价多烧 **29k–58k GPU·小时（7B）**。

自动熔断规则：

| 条件 | 动作 |
| --- | --- |
| loss NaN | 立即停止，回滚上一 stable ckpt |
| grad_norm > 10 连续 3 step | 降 LR ×0.5，跳过当前 shard |
| tokens/sec 跌 >30% | 检查 checkpoint 写入 / 网络 |
| val PPL 单点 +15% | 暂停，查 data shard 污染 |

[GRPO](/manual/llm/bit-to-agi/07-training/what-is-grpo) 长 RL 会出现 **语言崩溃**：entropy 突然 **低于 1.0** 而 reward 仍升——应 **早停 + 降 KL β**，而非继续烧 **100M+ 生成 token / 100+ GPU·小时**。

## 动手试一试：梯度裁剪

```python
import torch
import torch.nn as nn

model = nn.Sequential(nn.Linear(128, 128), nn.ReLU(), nn.Linear(128, 10))
opt = torch.optim.AdamW(model.parameters(), lr=1e-3)
x, y = torch.randn(32, 128), torch.randint(0, 10, (32,))

for step in range(100):
    loss = nn.functional.cross_entropy(model(x), y)
    opt.zero_grad()
    loss.backward()
    total_norm = torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    opt.step()
    if step % 25 == 0:
        print(f"step {step} loss={loss.item():.3f} grad_norm={float(total_norm):.3f}")
```

## 常见误区

1. **「spike 后会自己好」** — 大模型常**不会**；可能进入高 loss 盆地。
2. **「只监控 train loss」** — 并行跑 **小 val PPL**；train 降 val 升 = 过拟合或 hack。
3. **「稳定性只在大预训练重要」** — GRPO 长 RL 同样会语言崩溃。

## 小结

训练稳定性靠 **clip + warmup + BF16 + 好数据 + 频繁 checkpoint**；7B 预训练一次 blind spike 可浪费 **~800 GPU·小时**（20B token）。监控 grad norm 与 val PPL，NaN 即停、回滚。

本章完结，阅读 [本章总结](/manual/llm/bit-to-agi/07-training/chapter-summary)。

## 延伸：确定性、种子与复现

`torch.use_deterministic_algorithms(True)` 可提升复现性，但 **tokens/s 降 10–30%**——大预训练常只要求 **loss 曲线同形**，非 bit-exact。LoRA **6 GPU·小时** 实验应 **固定 seed、记录 data order、保存 tokenizer 版本**；「第二次 loss 不同」常是 **flash attention 非确定** 或 shuffle。NaN 时 dump **问题 batch 的 input_ids**（脱敏）到 json，**100 条**足够定位 bad token。预训练 spike 后 **不要** 仅从当前 step 续训——**回滚 1–3k step** 的 checkpoint 再降 LR，否则 corrupt 权重 **浪费后续全部 token**（20B token ≈ **808 GPU·小时**）。
