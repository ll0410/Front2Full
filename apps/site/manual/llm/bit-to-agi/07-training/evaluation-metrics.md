---
title: "评估指标"
description: "从 Bit 到 AGI · 第七章：训练 · Perplexity、Benchmark 与训练 loss 的关系"
source: "https://daiw.org/manual/bit-to-agi/07-training/evaluation-metrics"
---

# 评估指标

> 从 Bit 到 AGI · 第七章：训练 · Perplexity、Benchmark 与训练 loss 的关系

训练时 loss 下降不代表模型「更好用」。评估指标（Evaluation Metrics）分三层：**优化目标**（train/val loss、perplexity）、**能力基准**（MMLU、HumanEval）、**人类偏好**（MT-Bench、Arena Elo）。改 [数据配比](/manual/llm/bit-to-agi/07-training/data-mixing) 或 [对齐](/manual/llm/bit-to-agi/07-training/alignment-overview) 后，必须跑对应指标，否则不知道 **GPU·小时花对了没有**。

## 直觉：学生不只看得分，还看会做什么题

Loss 像「作业平均分」——可刷但可能偏科。

Benchmark 像**标准化考试**：MMLU（57 科选择题）、HumanEval（Python 函数）、GSM8K（小学数学）。对齐后还要**口试**（MT-Bench 多轮对话评分）。

## 定义

**Perplexity（困惑度）**——语言建模核心：

$$
\text{PPL} = \exp\left(-\frac{1}{N}\sum_{i=1}^{N} \log P(x_i \mid x_{<i})\right)
$$

| PPL | 含义 |
| --- | --- |
| 1 | 完美预测（不可达） |
| ~7–10 | 强 7B 基座 val |
| ~20+ | 弱模型 / 域外 |
| 100+ | 接近随机 |

**Downstream**：在固定 prompt 上测 accuracy / pass@k，与训练 loss **相关性有限**（Chinchilla：PPL 降 0.1 可能 MMLU +0.5 也可能不变）。

## 例子 1：预训练中途 eval 计划

7B 训 1T token，每 **10B token**（~2500 step）eval 一次：

| checkpoint token | val PPL | MMLU 5-shot | 备注 |
| --- | --- | --- | --- |
| 50B | 12.8 | 28.1 | 欠训 |
| 200B | 9.2 | 42.5 | 上升期 |
| 800B | 7.1 | 58.3 | 接近饱和 |
| 1.2T | 6.9 | 59.1 | +200B token，MMLU +0.8 |

**决策**：800B→1.2T 花 **~6k GPU·小时**（512 卡 ~12 小时）只换 0.8 MMLU——是否继续取决于产品目标；聊天产品可能更看 SFT 后 MT-Bench。

单次 MMLU 7B eval：**~0.5 GPU·小时**（14k 题，batch 推理）。

## 例子 2：SFT / DPO 后指标

同一 7B 基座，100M token SFT + 180M token DPO：

| 阶段 | train loss | MT-Bench | MMLU | HumanEval |
| --- | --- | --- | --- | --- |
| 基座 | — | 4.2 | 58.3 | 28.0 |
| SFT | 0.85 | 6.8 | 57.1 | 29.5 |
| +DPO | 0.92* | **7.4** | 56.8 | 28.5 |

*DPO loss 与 CE 不可比

**解读**：DPO **+0.6 MT-Bench**，MMLU/HumanEval 略降 **低于 1 pt**——典型对齐 trade-off。若 HumanEval 掉 >3 pt，说明 DPO 数据 code 占比过低或 β 过大。

DPO 全流程 eval（MMLU+HumanEval+MT-Bench）：**~2 GPU·小时**；相对训练 **30–50 GPU·小时** 可忽略，**应每 checkpoint 跑**。

## 量化：常用 benchmark 规模

| Benchmark | 题量/ token | 测什么 | eval GPU·hour (7B) |
| --- | --- | --- | --- |
| MMLU | 14k MCQ | 知识 | ~0.5 |
| HumanEval | 164 题 | 代码 pass@1 | ~0.1 |
| GSM8K | 1.3k | 数学 | ~0.2 |
| MT-Bench | 80 多轮 | 对话（GPT-4 判） | ~1 + API 费 |
| IFEval | 500+ | 指令遵循 | ~0.3 |

**Pass@k**（代码）：采样 k 个解，任一通过即算过。HumanEval 报告 pass@1（k=1）与 pass@10。

## 深入：eval 频率与 human eval 成本

预训练 **每 10B token eval** 一次 MMLU（~0.5 GPU·小时）在 1T run 里合计 **~50 GPU·小时**——占 **29k 的 0.17%**，极值得。若改为每 100B eval，可能 **错过最佳 checkpoint**（800B 最优却训到 1.2T），浪费 **6k GPU·小时** 续训无效 token。

SFT/DPO 后 **MT-Bench** 用 GPT-4 判分：80 题 × 多轮 ≈ **\$5–15/次** API；人工 side-by-side **\$2–5/对 × 100 对 = \$200–500**。算力 **2 GPU·小时** 的 benchmark 往往比 **数千美元人工** 便宜，但不能替代——MT-Bench 与真实用户满意度相关系数 **~0.7–0.85**。

**Contamination**（测试集泄露进训练）会让 MMLU **虚高 5–15 pt**。发布前用 n-gram 重叠检测训练语料与 benchmark；开源社区常报告 **「去污染后」** 分数。对比模型时确认 **同一 eval harness**（lm-eval-harness 版本、few-shot 模板）——差 1–2 pt 可能只是 prompt 格式不同，不是能力差距。

## 动手试一试：本地 PPL

```python
import torch
import torch.nn.functional as F
from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "meta-llama/Llama-3.2-1B"  # 小模型 demo
tok = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(model_name, dtype=torch.bfloat16, device_map="auto")

text = "The capital of France is Paris."
ids = tok(text, return_tensors="pt").input_ids.to(model.device)
with torch.no_grad():
    logits = model(ids).logits[:, :-1]
    labels = ids[:, 1:]
    nll = F.cross_entropy(logits.reshape(-1, logits.size(-1)), labels.reshape(-1))
ppl = torch.exp(nll)
print(f"tokens={labels.numel()}  PPL={ppl.item():.2f}")
```

## 常见误区

1. **「train loss 最低 = 最好 checkpoint」** — 过拟合 SFT 时 train↓ val↑；对齐任务看 **MT-Bench / 人工**。
2. **「MMLU 代表一切」** — 编程看 HumanEval，数学看 GSM8K/MATH，中文看 C-Eval。
3. **「eval 可训练时实时跑」** — 大 benchmark 占 **整卡**；用**小 val set** 在线监控，大 eval **离线异步**。

## 小结

评估分 **PPL / Benchmark / 人类偏好** 三层；7B 训 1T 每 10B token eval 一次指导是否续训；SFT+DPO 后 **MT-Bench + 能力集** 防偏科。单次全套 eval **~2 GPU·小时**，相对训练成本值得每版都跑。

下一篇：[对齐概览](/manual/llm/bit-to-agi/07-training/alignment-overview)——安全与 helpful 如何一起管。

## 延伸：AlpacaEval、Arena 与开源榜

**AlpacaEval 2.0** 用强模型作 judge 测 win rate；**Chatbot Arena** Elo 来自真人 pairwise，与 MT-Bench 相关但不等价。开源模型刷 AlpacaEval 有时靠 **过长回答**——要看 **length-controlled** 指标。Eval **gaming** 与 RM hacking 同源：优化单一榜会偏科。健康流程：**MMLU + HumanEval + MT-Bench + 100 条人工** 每版对齐。全套 **~2 GPU·小时 + \$20 API**；相对 DPO **40 GPU·小时** 可忽略。记录 **eval harness git hash**（lm-eval-harness）以便复现——差 1.5 pt 可能只是 **few-shot 模板** 变了。
