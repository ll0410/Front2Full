---
title: "数据配比"
description: "从 Bit 到 AGI · 第七章：训练 · 预训练与 SFT 语料混合比例如何影响能力"
source: "https://daiw.org/manual/bit-to-agi/07-training/data-mixing"
---

# 数据配比

> 从 Bit 到 AGI · 第七章：训练 · 预训练与 SFT 语料混合比例如何影响能力

数据配比（Data Mixing）决定模型**擅长什么、弱什么**：代码太多可能损文学性，中文太少则中文差，低质网页太多则胡言乱语。预训练阶段要在 **数 T token** 上定比例；SFT 阶段要在 **指令、对话、安全拒答** 之间平衡。没有银弹，只有可量化的 trade-off。

## 直觉：每日食谱的营养比例

只吃蛋白粉练肌肉，缺维生素；只吃沙拉缺能量。LLM 的「营养」= 各域 token 比例。Llama 3 技术报告公开了大致 mix；多数闭源模型 mix 是**核心机密**。

## 定义

预训练 mix 通常表示为各域 token 占比，且 $\sum_i w_i = 1$：

$$
\mathcal{L} = \sum_i w_i \cdot \mathcal{L}_{\mathcal{D}_i}
$$

实现上：每个 batch **按权重采样**来源（web / code / math / multilingual），而非先拼一个大 shuffle 文件。

| 域 | 典型权重（7B 开源参考） | 作用 |
| --- | --- | --- |
| 通用网页 | 50–70% | 广度、事实 |
| 代码 | 5–20% | 编程、逻辑 |
| 数学/STEM | 2–10% | 推理 |
| 书籍/高质量文本 | 2–10% | 语法、长文 |
| 多语言 | 5–30% | 依目标市场 |

## 例子 1：1T token 预训练 mix

**目标**：中英双语 7B，总 **1.2T token**。

| 域 | 比例 | token 数 | 约合纯文本 |
| --- | --- | --- | --- |
| 英文网页（过滤后） | 45% | 540B | ~1.1 TB |
| 中文网页 | 20% | 240B | ~400 GB（汉字更省 token） |
| 代码 | 15% | 180B | ~350 GB |
| 英文书籍/论文 | 10% | 120B | ~250 GB |
| 数学/Wiki | 5% | 60B | ~120 GB |
| 合成/对话 seed | 5% | 60B | — |

**GPU·小时**与总 token 线性相关（见 [预训练](/manual/llm/bit-to-agi/07-training/what-is-pretraining)）：1.2T × 7B ≈ **35k GPU·小时**（512 卡 ~3 天量级，含 overhead 更久）。

调整 **code 15%→25%**：HumanEval 可能 +5–10 pt，MMLU 人文可能 -1–2 pt——需在 **eval 矩阵**上测，不能凭直觉。

## 例子 2：SFT 三源混合

100 万条 SFT，总 **800M token**，三源：

| 来源 | 条数 | 占比 | token |
| --- | --- | --- | --- |
| 通用指令（Alpaca 类） | 520k | 52% | 416M |
| 多轮对话 | 300k | 30% | 240M |
| 安全拒答 / 红队 | 180k | 18% | 144M |

安全占比 **低于 10%** 时 jailbreak 易升；**>30%** 时过度拒答（「无法回答如何煮鸡蛋」）。开源经验：**15–25%** 安全 + 高质量通用。

SFT 800M token，7B LoRA：**~80–120 GPU·小时**（8×A100）。

## 量化：质量过滤对有效 token 的影响

原始 Common Crawl **~100T+ token**；可用经 dedup + 质量分类后 **~5–10%**：

| 阶段 | 输入 token | 输出 token | 算力浪费 |
| --- | --- | --- | --- |
| 无过滤 | 10T 扫一遍 | 300B 高质量等价 | **97% 算在垃圾上** |
| FineWeb / DCLM 管线 | 10T | 1.5T 进训练 | 15% 利用率 |

**数据工程**与 **mix 设计**同等重要：1T 高质量 > 3T 未洗。

## 深入：课程学习与 SFT 安全配比

**课程学习（Curriculum）** 在预训练中越来越常见：前 30% token 以 **web 为主** 学语言广度，后 70% 逐步提高 **code/math/books** 比例，使 loss 曲线更稳。突然（abrupt）把 code 从 5% 拉到 30% 可能导致 **100B token 的 loss spike**，浪费 **~2,900 GPU·小时**（7B×1T 比例的 1/10）。WSD 调度（见 [学习率](/manual/llm/bit-to-agi/07-training/learning-rate-schedule)）常与 curriculum 联用：stable 阶段固定 mix，anneal 阶段加高质量子集。

SFT 安全样本（拒答、 red team）占比是产品敏感旋钮：**15%** 通常平衡 jailbreak 与过度拒答；金融/医疗合规场景可拉到 **25%**，但需配 **正例**（如何合法回答）否则模型「万事皆拒」。20M token 安全 SFT 在 7B LoRA 上 **~5 GPU·小时**——便宜，却决定上线风险；值得单独 A/B [评估指标](/manual/llm/bit-to-agi/07-training/evaluation-metrics) 里的 HarmBench。

多语言 mix 的中文站（daiw.net 读者常见需求）：**纯中文预训练** 弱 code 与英文 STEM；推荐 **中文 20–30% + 英文/code 70–80%**，SFT 阶段再加重中文指令。C-Eval 与 CMMLU 会随中文占比升，但 HumanEval 可能 **-5 pt** 若 code 低于 10%——用表格同时盯 **三条 benchmark**，别单看中文榜。

## 动手试一试：加权采样

```python
import random

domains = ["web", "code", "math", "zh"]
weights = [0.50, 0.15, 0.10, 0.25]

def sample_domain(n=100_000):
    counts = {d: 0 for d in domains}
    for _ in range(n):
        d = random.choices(domains, weights=weights, k=1)[0]
        counts[d] += 1
    return {d: c / n for d, c in counts.items()}

print(sample_domain())  # 接近 weights
# 训练框架：WebDataset / Megatron blendable dataset
```

## 常见误区

1. **「中文模型 = 100% 中文语料」** — 代码、数学英文占比高；纯中文弱推理与 coding。
2. **「SFT mix 与预训练无关」** — 预训练缺 code，SFT 难补编程；**能力天花板在预训练**。
3. **「比例固定全程不变」** — 课程学习（course curriculum）：前期 web，后期加 math/code，更稳。

## 小结

数据配比用 **权重 × token 预算** 分配能力；1.2T 预训练需先定 mix 再算 **~35k GPU·小时**；SFT 800M token 注意 **15–25% 安全样本**。改 mix 后必须用 [评估指标](/manual/llm/bit-to-agi/07-training/evaluation-metrics) 验证。

下一篇：[学习率调度](/manual/llm/bit-to-agi/07-training/learning-rate-schedule)——warmup 与 cosine 衰减。

## 延伸：The Pile、FineWeb 与合规

历史语料 **The Pile**（825 GB）推动了 GPT-Neo 时代；近年来主流转向 **FineWeb、DCLM** 等重洗 Common Crawl 版本，有效 token 密度更高。Mix 设计还涉及 **合规**：书籍/论文子集需 license；代码用 **GitHub 许可过滤**（MIT/Apache vs GPL）；多语言站注意 **PII 去标识**。违规语料可导致 **模型发布撤回**——数据 bill 不仅是存储 **TB 级**，还有法务 review。中文站 ICP 备案（daiw.net）若用用户数据微调，需隐私政策与 opt-out；这与 mix 比例无关，却是训练数据 **来源合法性** 的一部分。
