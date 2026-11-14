---
title: "蒸馏是什么"
description: "从 Bit 到 AGI · 第七章：训练 · 知识蒸馏：Teacher 的软标签教 Student 以小博大"
source: "https://daiw.org/manual/bit-to-agi/07-training/distillation"
---

# 蒸馏是什么

> 从 Bit 到 AGI · 第七章：训练 · 知识蒸馏：Teacher 的软标签教 Student 以小博大

蒸馏（Knowledge Distillation，知识蒸馏）让**小模型（Student）**模仿**大模型（Teacher）**的输出分布，而不只看硬标签（正确 token）。在 LLM 时代，蒸馏常用于：把 GPT-4 级能力压进 7B、把 MoE 教师压进稠密学生、或把多步推理链压进单步模型。

## 直觉：学霸的解题思路，而不只是最终答案

硬标签只说「答案是 C」。

Teacher 的 logits 说：「A 5%、B 10%、**C 60%**、D 25%」——暗含**排除法、近似正确**的信息。Student 学这套概率分布，比只学 one-hot 标签学得**更平滑、泛化更好**。

Hinton 2015 经典公式在 LLM 里变成：最小化 Student 与 Teacher 在词表上的 KL 散度（加温度 $T$）。

## 定义

$$
\mathcal{L}_{\text{KD}} = \alpha \mathcal{L}_{\text{CE}}(y, p_S) + (1-\alpha) \cdot T^2 \cdot D_{\text{KL}}\big(\text{softmax}(z_T/T) \,\|\, \text{softmax}(z_S/T)\big)
$$

| 符号 | 含义 |
| --- | --- |
| $z_T, z_S$ | Teacher / Student 的 logits |
| $T$ | 温度，$T>1$ 软化分布 |
| $\alpha$ | 硬标签 vs 软标签权重 |

**LLM 序列蒸馏**：对每 token 位置算 KL，常只对 Teacher 生成的 token 序列做（on-policy）或对固定语料做（off-policy）。

## 例子 1：Alpaca 式 Response 蒸馏

**场景**：Teacher = 70B，Student = 7B，ShareGPT 200k 对话；Teacher 先**生成**回答作为 silver data，Student SFT 这 200k 条。

| 阶段 | token 数 | GPU·小时（8×A100） |
| --- | --- | --- |
| Teacher 生成 200k×512 token | ~100M 生成 | **~500–800**（70B 自回归贵） |
| Student SFT 100M token | 100M | **~25–40** |
| **合计** | | **~550–840** |

若改用 **logit 蒸馏**（同一 batch forward Teacher+Student）：省去生成，但每 step 要跑 70B Teacher forward——**~2× 单步成本**，适合短序列、小 batch。

## 例子 2：Gemini / 闭源 → 开源

常见 pipeline（如 Stanford Alpaca、DistilBERT 传统）：

1. Teacher API 生成 **50k–1M** 指令对（~500M–2B token）
2. Student 7B 全参或 LoRA SFT：**30–80 GPU·小时**
3. 评测：Student 达 Teacher **85–95%**（依任务）

**成本对比**：直接 RL 对齐 70B 需 **数千 GPU·小时**；蒸馏到 7B 后部署推理成本降 **~10×**（参数 + 吞吐）。

## 量化：蒸馏类型

| 类型 | 数据 | 典型 GPU·小时 (7B student) |
| --- | --- | --- |
| Response 蒸馏 | Teacher 生成文本 | 低（仅 SFT student） |
| Logit 蒸馏 | 语料 + Teacher logits | 中（每 token 双 forward） |
| 特征蒸馏 | 中间层 hidden states | 高（对齐维度） |
| 自蒸馏 | 大 checkpoint → 小模型同架构 | 中（DeepSeek-R1 distill） |

DeepSeek-R1-Distill：671B Teacher 的推理链 → Qwen/Llama 7B–70B Student，**~800k 样本**量级，Student 训练 **~100–500 GPU·小时**（依规模）。

## 深入：何时蒸馏、何时继续预训练

决策树很简单：**Student 容量够、Teacher 行为可采样** → 蒸馏；**Student 缺领域预训练** → 先 domain pretrain 再蒸馏。7B Student 吸收代码能力：若基座 HumanEval 仅 28%，Teacher 生成 500k 代码 SFT 样本（~300M token）蒸馏后 **~35–40%**；若仍不够，应提高 [预训练 code mix](/manual/llm/bit-to-agi/07-training/data-mixing) 而非无限堆 silver data。

Logit 蒸馏每 step 要跑 Teacher forward：70B Teacher + 7B Student 同 batch，8×A100 上 **~3× 纯 Student SFT 时间**——100M token 从 **25 GPU·小时** 涨到 **~75**。仅当 Teacher **不能开源权重、只能 API** 时，才优先 response 蒸馏。闭源 Teacher 生成 100M token，按 API 价粗算 **~\$3,000**——往往仍比自训 70B Teacher 便宜。Student 7B 推理 **~50 token/s**（单 A100），Teacher 70B **~5 token/s**——蒸馏省 **10× 推理成本**。

## 动手试一试：token 级 KL 蒸馏

```python
import torch
import torch.nn.functional as F

def distillation_loss(student_logits, teacher_logits, labels, T=2.0, alpha=0.5):
    # 硬标签 CE
    ce = F.cross_entropy(student_logits, labels)
    # 软标签 KL（teacher 无梯度）
    p_t = F.softmax(teacher_logits / T, dim=-1)
    log_p_s = F.log_softmax(student_logits / T, dim=-1)
    kl = F.kl_div(log_p_s, p_t, reduction="batchmean") * (T * T)
    return alpha * ce + (1 - alpha) * kl

vocab = 1000
s_logits = torch.randn(8, 128, vocab, requires_grad=True)
t_logits = torch.randn(8, 128, vocab)
labels = torch.randint(0, vocab, (8, 128))
loss = distillation_loss(s_logits, t_logits, labels)
loss.backward()
print(f"distill loss: {loss.item():.4f}")
```

## 常见误区

1. **「蒸馏可以跳过预训练」** — Student 仍需足够容量与预训练基座；蒸馏是**对齐/能力迁移**，不是从零造语言。
2. **「Teacher 越大越好」** — 容量 gap 过大（405B→1B）会导致**模仿失败**；中间尺寸或课程蒸馏更好。
3. **「蒸馏不侵权」** — 用 API 输出训模型涉及 ToS；商用需读条款。

## 小结

蒸馏把 Teacher 的**软概率**或**生成回答**传给学生；7B Student 吸收 70B Teacher 的 100M token  silver data 约 **25–40 GPU·小时**（不含 Teacher 生成）。部署性价比的核心手段。

下一篇：[Checkpoint 是什么](/manual/llm/bit-to-agi/07-training/checkpoint)——训练中断不白干。

## 延伸：Self-distillation 与 speculative

**Self-distillation**：同一模型大 checkpoint 教小 checkpoint 或浅层 student——DeepSeek 等用 **long CoT checkpoint** 生成数据训 **short CoT student**，省人工 Teacher API。**Speculative decoding**（第八章）与蒸馏不同：小 draft 模型 + 大 verify 模型 **推理加速**，不更新权重。别混淆「蒸馏训小模型」与「speculative 用大模型验 draft」。Silver data 800k 条 × 1k token = **800M token**，7B Student SFT **~50 GPU·小时**；若 Teacher 是 405B API，生成费 **\$10k–50k** 可能超过 Student 训练算力——预算表要两行：**生成美元 + 训练 GPU·小时**。
