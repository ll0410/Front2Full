---
title: "DPO 是什么"
description: "从 Bit 到 AGI · 第七章：训练 · 直接偏好优化：跳过 RL，用对比损失对齐模型"
source: "https://daiw.org/manual/bit-to-agi/07-training/what-is-dpo"
---

# DPO 是什么

> 从 Bit 到 AGI · 第七章：训练 · 直接偏好优化：跳过 RL，用对比损失对齐模型

DPO（Direct Preference Optimization，直接偏好优化）用**一个损失函数**直接在偏好对上更新策略模型，**不需要**单独训练奖励模型、也不需要 PPO 采样循环。2023 年 Rafailov 等人提出后，成为开源社区对齐的默认方案之一（Alpaca、Zephyr、Many HF 模型）。

## 直觉：不用「裁判打分」，直接学「哪个更好」

RLHF 像请裁判（RM）给运动员（策略）打分，再用复杂规则练动作（PPO）。

DPO 像直接给运动员看比赛录像：「这场 A 赢、这场 B 赢」——从胜负关系**反推**该怎么打，省掉裁判和额外训练环节。

数学上，DPO 证明：在最优 RLHF 解下，奖励函数 $r(x,y)$ 与策略 $\pi_\theta(y|x)$ 存在闭式关系，可以把 RM 消掉。

## 定义

给定偏好对 $(x, y_w, y_l)$，DPO 损失：

$$
\mathcal{L}_{\text{DPO}} = -\log \sigma\left(\beta \log \frac{\pi_\theta(y_w|x)}{\pi_{\text{ref}}(y_w|x)} - \beta \log \frac{\pi_\theta(y_l|x)}{\pi_{\text{ref}}(y_l|x)}\right)
$$

| 符号 | 含义 |
| --- | --- |
| $\pi_\theta$ | 正在训练的策略（通常从 SFT 初始化） |
| $\pi_{\text{ref}}$ | 冻结的参考模型（SFT 副本） |
| $\beta$ | 温度，控制偏离 ref 的惩罚强度 |
| $\sigma$ | sigmoid |

**关键**：只需算两个序列的 **log 概率**（与 SFT 同款 forward），无需 RM、无需 rollout 生成。

## 例子 1：数据与 token

**场景**：7B 模型 DPO，UltraFeedback 子集 **60k 偏好对**，平均每条 1024 token（prompt + chosen + rejected 参与 loss 的部分）。

| 项 | 数值 |
| --- | --- |
| 有效训练 token / epoch | ~60M |
| 训练 3 epoch | ~180M token |
| 全局 batch（pairs） | 64–128 |

## 例子 2：GPU·小时 vs RLHF

同样 7B、180M token 偏好训练：

| 方法 | 8×A100 墙钟 | GPU·小时 | 备注 |
| --- | --- | --- | --- |
| DPO | ~3–6 小时 | **~30–50** | 2× forward（policy+ref） |
| PPO (RLHF) | ~2–4 天 | **~400–750** | 含在线生成 |
| SFT（同 token） | ~2 小时 | ~15 | 无 ref 模型 |

DPO 约为 PPO 的 **1/10 算力**；显存需同时加载 **policy + ref**（7B×2 ≈ 28GB FP16 + 优化器开销，单卡 80GB 可 LoRA）。

## 量化：β 的影响

| β | 效果 |
| --- | --- |
| 0.1 | 弱约束，易过拟合偏好、遗忘 SFT |
| **0.1–0.5** | 常用（Llama 系多 0.1–0.3） |
| 1.0+ | 强贴 ref，对齐幅度小 |

实验经验：β 过大 → MT-Bench 升、MMLU 几乎不动；β 过小 → 偏好升但**复读/冗长**增加。

## 深入：ref 模型与 logprob 怎么算

DPO 实现细节决定显存与速度：**reference model 全程冻结**，forward 时不建计算图；policy 需要 backward。每条偏好对要算四个序列 log 概率：$\log\pi_\theta(y_w|x)$、$\log\pi_\theta(y_l|x)$ 以及 ref 侧两个。实现上常把 chosen/rejected **拼成同一 batch** 做两次 forward（policy 一次、ref 一次），比四条独立 forward 省 kernel launch。

Logprob 累加方式：对回答 token **求和** vs **求平均** 影响 β 的有效尺度。HF TRL 默认对 completion token **求和**；若改用均值，等价于把 β 除以平均长度——换数据域（短拒答 vs 长推理链）时要重新调 β。180M token DPO 在 8×A100 上 **3–6 小时** 完成时，建议在 **20M token** 处做一次 MT-Bench 子集 eval：若分数已接近最终值的 90%，可 early stop 省 **~15 GPU·小时**。

与 [RLHF PPO](/manual/llm/bit-to-agi/07-training/what-is-rlhf) 相比，DPO **不能**在训练过程中动态采样新回答——偏好对是离线的。若 Teacher 模型升级或产品策略变化，需 **重新生成偏好数据** 再跑 DPO；数据成本（API 或人工）往往超过 **40 GPU·小时** 的算力本身，规划对齐预算时勿忽略。

## 动手试一试：DPO loss 核心

```python
import torch
import torch.nn.functional as F

def dpo_loss(logp_chosen, logp_rejected, logp_ref_chosen, logp_ref_rejected, beta=0.1):
    """logp_* 为整段回答的 log prob 之和（或均值）"""
    pi_logratios = logp_chosen - logp_rejected
    ref_logratios = logp_ref_chosen - logp_ref_rejected
    logits = beta * (pi_logratios - ref_logratios)
    return -F.logsigmoid(logits).mean()

# 模拟 4 条偏好对
logp_w = torch.tensor([-120.0, -95.0, -200.0, -88.0])
logp_l = torch.tensor([-130.0, -110.0, -180.0, -102.0])
logp_ref_w = logp_w.detach() + 0.5
logp_ref_l = logp_l.detach() + 0.5
loss = dpo_loss(logp_w, logp_l, logp_ref_w, logp_ref_l, beta=0.2)
print(f"DPO loss: {loss.item():.4f}")
```

TRL 库 `DPOTrainer` 封装了 token 级 logprob 累加与 label mask。

## 常见误区

1. **「DPO 完全替代 RLHF」** — 复杂多轮、工具调用等场景，在线 RL（或 [GRPO](/manual/llm/bit-to-agi/07-training/what-is-grpo)）仍有优势。
2. **「不需要 SFT」** — DPO 的 ref 通常就是 SFT 模型；跳过 SFT 效果差。
3. **「chosen/rejected 越长越好」** — 长序列梯度噪声大；常截断到 512–2048 token。

## 小结

DPO 把偏好对齐变成**监督式对比学习**，7B 模型 **180M token** 约 **30–50 GPU·小时**，比 PPO 省一个数量级。开源栈：`SFT → DPO` 是极具性价比的对齐路径。

下一篇：[GRPO 是什么](/manual/llm/bit-to-agi/07-training/what-is-grpo)——DeepSeek 带火的组相对策略优化。

## 延伸：IPO、KTO 与 DPO 家族

DPO 之后出现 **IPO**（Identity Preference Optimization）、**KTO**（Kahneman-Tversky Optimization）等变体，处理 **非成对偏好**（单条 thumbs up/down）或 **不平衡正负样本**。数据若是「10 万条 good、500 条 bad」而非 strict pairs，KTO 更自然。实现上仍多在 TRL 里 **~30–60 GPU·小时（7B）** 量级。选 DPO vs IPO vs KTO 时，先看 **标注格式** 再看论文 SOTA——多数团队 **UltraFeedback 成对数据 + DPO** 已够用。无论哪种，**SFT ref** 与 **β** 仍核心；跳过 SFT 的 DPO 在 180M token 上烧 **40 GPU·小时** 常得「会拒答但不会答」的半成品。
