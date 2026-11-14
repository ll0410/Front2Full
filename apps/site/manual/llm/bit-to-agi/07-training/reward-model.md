---
title: "奖励模型"
description: "从 Bit 到 AGI · 第七章：训练 · Reward Model：从人类偏好学习标量分数"
source: "https://daiw.org/manual/bit-to-agi/07-training/reward-model"
---

# 奖励模型

> 从 Bit 到 AGI · 第七章：训练 · Reward Model：从人类偏好学习标量分数

奖励模型（Reward Model, RM）是 [RLHF](/manual/llm/bit-to-agi/07-training/what-is-rlhf) 里的**裁判**：输入 prompt + 回答，输出一个标量分数 $r_\phi(x, y)$，分数越高表示人类越偏好该回答。PPO 阶段策略模型朝着**高 RM 分**优化；RM 质量直接决定对齐上限与 **reward hacking** 风险。

## 直觉：培训评委，再让选手讨好评委

SFT 教「标准动作」；RM 教「哪个动作更好看」。人类不直接改选手，而是给两套动作投票，系统训练评委记住人类品味。之后选手（策略）反复表演，评委打分，选手调整——RM 就是那位**可微的评委**。

## 定义

RM 通常是 **SFT 模型 + 标量头**（最后一 token hidden → Linear → 1）或独立 cross-encoder。

Bradley-Terry 偏好损失（与 [DPO](/manual/llm/bit-to-agi/07-training/what-is-dpo) 同构，但这里训 $r_\phi$ 而非 $\pi_\theta$）：

$$
\mathcal{L}_{\text{RM}} = -\mathbb{E}_{(x,y_w,y_l)}\left[\log \sigma\big(r_\phi(x,y_w) - r_\phi(x,y_l)\big)\right]
$$

| 组件 | 典型选择 |
| --- | --- |
| 初始化 | SFT 模型权重 |
| 输入 | prompt + response 拼接 |
| 输出 | 单标量（非词表 logits） |
| 归一化 | 有时对 batch 标准化防漂移 |

## 例子 1：7B RM 训练数据与算力

| 项 | 数值 |
| --- | --- |
| 偏好对 | 100,000 |
| 平均 token / 对（含双回答） | ~1500 |
| 总 token | ~150M |
| epoch | 3 |
| 训练 token | ~450M |
| 8× A100 | **~60–100 GPU·小时** |

Pair accuracy（chosen 得分 > rejected）应 > **65%** 才值得进 PPO；低于60% 说明标注噪声大或模型容量不足。

## 例子 2：RM 规模与 PPO 显存

PPO 阶段常同时加载：

| 模型 | 7B FP16 权重 |
| --- | --- |
| Policy | 14 GB |
| Reference (SFT) | 14 GB |
| RM | 14 GB |
| Critic (7B) | 14 GB |
| **合计** | **~56 GB+**（不含 optimizer） |

需 **多卡 ZeRO** 或 **小 RM（1B–3B）** 蒸馏自大 RM。用 3B RM 替 7B：RM forward 快 **~2×**，PPO 200M token 从 **~500 GPU·小时** 降到 **~350**。

## 量化：RM 失败模式

| 问题 | 症状 | 缓解 |
| --- | --- | --- |
| 长度偏置 | 越长分越高 | 长度归一化、截断 |
| 格式偏置 | 爱 Markdown 列表 | 多样化偏好数据 |
| OOD 泛化差 | 新 domain 乱打分 | 覆盖多域偏好 |
| Reward hacking | PPO 输出 RM 爱但人厌 | KL 约束、定期人工 audit |

InstructGPT 报告 RM 在 held-out 偏好上 **~70%** 准确率；工业界 100k+ 对可达 **75–80%**。

## 深入：RM 数据构造与 PPO 衔接

偏好对构造有三种来源：**(1) 人类并排**——贵、准；**(2) 模型采样 + 人标**——SFT model 对同一 prompt 采 4–8 回答，人 pick best/worst；**(3) AI 判官（RLAIF）**——Claude/GPT 评两回答。100k 对若用 (2)：需 **400k–800k 次生成**，7B 每回答 256 token 平均 → **100M–200M 生成 token**，**~50–100 GPU·小时** 仅生成，还不含 RM 训练 **60–100 GPU·小时**。

RM 训练完 **不要** 立刻上大 PPO：先在 held-out 上算 **pair accuracy 与 calibration**——若 chosen 平均分仅比 rejected 高 **0.05**，PPO 信号太弱，会浪费 **200M token / 400+ GPU·小时**。好的 RM 应 **margin 明显**：mean(r_w - r_l) > **0.5–1.0**（尺度依 head 初始化而定）。

PPO 里 RM 通常 **只 forward 不更新**；RM 过拟合训练偏好分布后，PPO 跑 **>300M token** 会 hack。实践：**每 50M PPO token 冻结 RM 并抽样人工 audit**；或 [DPO](/manual/llm/bit-to-agi/07-training/what-is-dpo) 离线重训一轮，交替进行。3B RM 替 7B 在 PPO 中 **RM forward 快 ~2×**，200M rollout 从 **~500 → ~350 GPU·小时**，适合预算紧的团队。

## 动手试一试：RM 头

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class RewardHead(nn.Module):
    def __init__(self, hidden_size=4096):
        super().__init__()
        self.head = nn.Linear(hidden_size, 1)

    def forward(self, last_hidden):  # [batch, hidden]
        return self.head(last_hidden).squeeze(-1)

def rm_loss(r_chosen, r_rejected):
    return -F.logsigmoid(r_chosen - r_rejected).mean()

hidden = torch.randn(8, 4096)
rm = RewardHead()
r_w = rm(hidden)
r_l = rm(hidden - 0.3)  # 模拟 rejected 略差
print(f"RM loss: {rm_loss(r_w, r_l).item():.4f}")
```

TRL `RewardTrainer` 封装完整 pipeline。

## 常见误区

1. **「DPO 不需要 RM」** — 对；DPO **隐式**含 RM。但若要做 PPO 或 Best-of-N，仍需显式 RM。
2. **「RM 越大越好」** — 7B RM 已够；更大 RM 标注对齐成本高，推理 PPO 更贵。
3. **「RM 分有绝对意义」** — 只有**相对排序**可靠；跨 checkpoint 不可比。

## 小结

RM = **SFT 骨干 + 标量头 + Bradley-Terry 损失**；100k 对 / 450M token 训练约 **60–100 GPU·小时**（7B）。PPO 四模型并行显存 **~56 GB+**；[DPO](/manual/llm/bit-to-agi/07-training/what-is-dpo) 可跳过显式 RM。

下一篇：[训练稳定性](/manual/llm/bit-to-agi/07-training/training-stability)——loss spike 与 NaN 怎么办。

## 延伸：Best-of-N 与 rejection sampling

训好 RM 后，不必立刻 PPO：**Best-of-N** 对每 prompt 采样 N 个回答，RM 选最高，作 **rejection sampling SFT** 数据——无 PPO 也能升 MT-Bench **+0.3–0.8**。N=16、10k prompt、512 token/回答 → **82M 生成 token**，7B **~40 GPU·小时** 生成 + **20 GPU·小时** SFT，合计 **~60 GPU·小时**，介于 DPO 与 PPO 之间。RM 也可做 **在线路由**：小模型 draft、RM 决定是否升大模型——推理优化，但 RM 本身 **~60–100 GPU·小时** 训一次可复用。
