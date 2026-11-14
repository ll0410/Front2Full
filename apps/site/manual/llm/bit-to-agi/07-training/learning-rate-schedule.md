---
title: "学习率调度"
description: "从 Bit 到 AGI · 第七章：训练 · Warmup、Cosine 与 LR 如何影响收敛"
source: "https://daiw.org/manual/bit-to-agi/07-training/learning-rate-schedule"
---

# 学习率调度

> 从 Bit 到 AGI · 第七章：训练 · Warmup、Cosine 与 LR 如何影响收敛

学习率（Learning Rate, LR）调度决定**每一步参数更新迈多大**。太大则 loss 爆炸（NaN）；太小则训到 1T token 仍欠拟合。现代 LLM 预训练几乎都用 **warmup + cosine decay**；SFT/LoRA 常用更小的 peak LR 和更短 schedule。

## 直觉：烧水先小火，再大火，最后转小火

冷锅直接猛火会糊底（梯度爆炸）。先**小火预热**（warmup），再维持高火（peak LR），接近终点时**转小火**（decay）精修——cosine 曲线平滑降 LR，避免突然刹车震荡。

## 定义

**Warmup + Cosine**（Llama / GPT 系常见）：

$$
\eta_t = \begin{cases}
\eta_{\max} \cdot \dfrac{t}{T_{\text{warmup}}} & t \le T_{\text{warmup}} \\[6pt]
\eta_{\min} + \dfrac{1}{2}(\eta_{\max} - \eta_{\min})\left(1 + \cos\left(\dfrac{t - T_{\text{warmup}}}{T - T_{\text{warmup}}} \pi\right)\right) & t > T_{\text{warmup}}
\end{cases}
$$

| 超参 | 7B 预训练典型 | 7B LoRA SFT 典型 |
| --- | --- | --- |
| $\eta_{\max}$ | 3e-4 – 3e-3 | 1e-4 – 3e-4 |
| $\eta_{\min}$ | 0.1 × peak 或 0 | 0 |
| warmup steps | 2000–10000 | 50–200 |
| 总 steps | 250k+ | 1k–10k |

**Chinchilla 补充**：最优 peak LR 与 batch size 相关；batch 越大，LR 可略大（线性 scaling rule：batch ×2 → LR ×2，至上限）。

### 自己拖一下

上面那个分段公式一眼看不出形状，而学习率调度的核心全是形状之争。拖出来：

<LRSchedule />

先看默认的 **warmup + cosine**：橙色那段是线性爬升的 warmup（冷锅先小火），然后 cosine 平滑衰减。切「无 warmup」预设——曲线开局就顶在 peak，真实训练里这常在几百步内 loss NaN。调 min LR 看预训练（0.1×peak，留余温）和 SFT（归 0）的区别。切 **WSD**：它不像 cosine 全程缓降，而是 stable 段一直保持 peak、最后 15% 才快速退火——好处是能在任意点切一段当 checkpoint，不用预先定死总步数。

## 例子 1：1T token 预训练 schedule

7B，全局 batch = **4M token/step**（512 卡 × 8k token/GPU micro），总 token 1T：

| 项 | 数值 |
| --- | --- |
| 总 steps | 1T / 4M = **250,000** |
| warmup | **2000 steps**（0.8%）≈ **8B token** |
| peak LR | **3e-4**（AdamW，β=(0.9, 0.95)） |
| min LR | **3e-5**（0.1 × peak） |
| cosine 结束 | step 250k，LR→3e-5 |

**错配代价**：peak 3e-3（10× 过高）→ 通常在 **低于 500 step** loss NaN，浪费已跑 **2B token × 512 GPU** ≈ **数百 GPU·小时** 无效算力。

## 例子 2：LoRA SFT schedule

52k Alpaca，3 epoch，batch=128 seq=2048 → **~780 steps**；peak **2e-4**，warmup **50 steps**。

| schedule | 最终 val loss | 备注 |
| --- | --- | --- |
| constant 2e-4 | 1.42 | 尚可 |
| cosine 2e-4 → 0 | **1.38** | 略优 |
| constant 2e-3 | NaN / 1.8+ | 过高 |
| no warmup | 前 20 step 震荡 | 不稳 |

780 step 单 A100 LoRA：**~6 GPU·小时**；LR 调错重跑 ×3 = **18 GPU·小时**——小项目也贵。

## 量化：WSD（Warmup-Stable-Decay）新趋势

近年来许多大规模预训练采用 **WSD**：warmup → **长时间恒定 LR（stable）** → 短 cosine **anneal** 收尾。

| 阶段 | token 占比 | 作用 |
| --- | --- | --- |
| Stable | 80–90% | 主学习 |
| Anneal | 10–20% | 压 loss、提 downstream |

MiniCPM、部分 DeepSeek 报告：最后 **10% token anneal** 可换 **明显 benchmark 提升**，等价于多训 stable 阶段 30% token 的 ROI 更高。

## 深入：batch size 与 LR 联动

**Linear scaling rule**：全局 batch token 翻倍 → peak LR 可 ×2（直到不稳定）。7B 预训练从 2M→4M token/step，peak LR 从 **1.5e-4 → 3e-4** 是常见跳变；若 batch 翻倍但 LR 不变，等效 **欠采样**，同样 1T token 需要 **更多 step** 才收敛——不是省算力，是 **拖 wall-clock**。

LoRA SFT 的 LR **比预训练高一个数量级** 是因为 **可训练参数少、梯度子空间低维**；但 7B LoRA 用 3e-3 仍易 NaN。经验网格：`{1e-4, 2e-4, 5e-4}` × warmup `{0, 50, 100}`，每组 **~2 GPU·小时**，三轮扫描 **~12 GPU·小时** 换稳定收敛，比盲训 3 次 full run（18 GPU·小时）更省。

Cosine 的 **η_min** 设 0 还是 0.1×peak：预训练长 run 常留 **0.1×** 尾段，避免最后 thousands step 完全无更新；短 SFT **780 step** 可直接 decay 到 0。错误 η_min 导致最后 10% step（**~4M token / 40M**）几乎白跑——Alpaca 规模 **~0.6 GPU·小时** 虽小，习惯正确 schedule 在大预训练里值 **数千 GPU·小时**。

## 动手试一试：cosine schedule

```python
import math

def lr_cosine(step, total, warmup, lr_max, lr_min=0.0):
    if step < warmup:
        return lr_max * step / warmup
    progress = (step - warmup) / max(1, total - warmup)
    return lr_min + 0.5 * (lr_max - lr_min) * (1 + math.cos(math.pi * progress))

total, warmup = 1000, 50
for s in [0, 25, 50, 500, 999]:
    print(f"step {s:4d}  lr={lr_cosine(s, total, warmup, 3e-4):.2e}")
```

Transformers `get_cosine_schedule_with_warmup` 即此实现。

## 常见误区

1. **「SFT 用预训练 LR」** — 3e-4 对 LoRA SFT 常过高；**1e-4 – 2e-4** 更安全。
2. **「warmup 越长越好」** — 超过 5% 总 step 浪费高 LR 窗口；通常 **0.1–2%**。
3. **「LR 只调一次」** — 换 batch size、数据量、精度（fp16/bf16）都应重扫 peak LR。

## 小结

学习率调度 = **warmup + cosine（或 WSD）**；7B 预训练 250k step 中 warmup **2000 step / 8B token**；LoRA SFT **780 step / ~6 GPU·小时**，LR 错配代价高。

下一篇：[梯度累积](/manual/llm/bit-to-agi/07-training/gradient-accumulation)——小显存模拟大 batch。

## 延伸：Inv sqrt、linear decay 与 restarts

除 cosine 外，**inverse sqrt decay**（Transformer 原论文）在短 run 仍有人用；**linear decay to zero** 实现简单。 **Cosine restarts**（SGDR）在 CV 流行，LLM 预训练 **少见**——1T token 单次 monotonic decay 更可预测。SFT **780 step** 用 cosine 时，**最后 78 step（10%）** LR 从 **2e-4 → 0**，约 **~6M token / 40M** 精细调整；若 constant LR 这 10% 可能 **过拟合训练集口头禅**。记录 **LR vs step** 曲线与 loss 对齐，可快速发现「LR 已归零但还在训」的配置错误——白烧 **最后 10% GPU·小时**。

## 延伸：One-cycle 与 constant LR

部分短 SFT **constant LR + early stop** 与 cosine **差距 低于0.5 pt** MT-Bench，但 constant 更易在后期 **过拟合**（loss 续降、eval 平）。One-cycle LR（先升后降）在 CV 常见，LLM 短训偶用。**Weight decay** 与 LR schedule 独立：AdamW decay **0.01**（SFT）防参数膨胀；预训练 **0.1** 更强。调 schedule 时 **固定 seed 跑 3 条曲线**（warmup 0/50/100），每条 **~2 GPU·小时** LoRA——比盲跑 full 780 step **6 GPU·小时** 三次更科学。WSD 的 stable 段占 **80% token** 时，anneal **10% token** 约 **100M token / 7B LoRA ~15 GPU·小时** 换 benchmark **+1–2 pt**，ROI 常高于再加 30% stable token。
