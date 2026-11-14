---
title: "跑 Benchmark"
description: "从 Bit 到 AGI · 第十章：自己训练一个模型 · 跑 Benchmark"
source: "https://daiw.org/manual/bit-to-agi/10-train-your-llm/evaluate-benchmarks"
---

# 跑 Benchmark

> 从 Bit 到 AGI · 第十章：自己训练一个模型 · 跑 Benchmark

PPL 与主观生成不够客观。Benchmark 用**标准化题库**（MMLU、GSM8K、HumanEval）给模型打分，便于与 Qwen/Llama 对比和回归测试。本篇用 `lm-evaluation-harness` 评估你的 Checkpoint。

## 直觉：高考模考

同一套卷子考所有模型，分数才可比。Benchmark 是**公开模考**；分数高不代表一切，但分数暴跌说明训练或合并出了 bug。

## 定义

常用基准（英文为主）：

| Benchmark | 测什么 | 7B SOTA 约 |
| --------- | ------ | ---------- |
| MMLU | 57 科选择题 | ~75% |
| GSM8K | 小学数学 | ~90% |
| HumanEval | Python 代码 | ~70% pass@1 |
| HellaSwag | 常识续写 | ~85% |

125M 自训 Base 模型 MMLU 可能 **~25–30%**（接近随机 25%）；SFT 7B 才值得认真跑全套。

## 例子

**例 1：安装 lm-eval**

```bash
cd ~/mini-gpt-lab && source .venv/bin/activate
pip install lm-eval

# 或最新版
pip install git+https://github.com/EleutherAI/lm-evaluation-harness.git
```

**例 2：评估 HuggingFace Checkpoint**

```bash
lm_eval --model hf \
  --model_args pretrained=checkpoints/best-hf,dtype=bfloat16 \
  --tasks hellaswag,piqa,winogrande \
  --device cuda:0 \
  --batch_size 8 \
  --output_path results/bench_base.json
```

**例 3：评估 SFT + LoRA**

```bash
lm_eval --model hf \
  --model_args "pretrained=checkpoints/base/qwen2.5-7b-instruct,peft=checkpoints/sft-lora,dtype=bfloat16" \
  --tasks mmlu,gsm8k \
  --device cuda:0 \
  --batch_size 4 \
  --num_fewshot 5 \
  --output_path results/bench_sft.json
```

**例 4：查看结果**

```bash
python << 'EOF'
import json
from pathlib import Path
for p in Path("results").glob("*.json"):
    data = json.loads(p.read_text())
    print(f"=== {p.name} ===")
    for task, scores in data.get("results", {}).items():
        acc = scores.get("acc,none") or scores.get("acc_norm,none")
        if acc is not None:
            print(f"  {task}: {acc*100:.1f}%")
EOF
```

## 量化

| 模型 | 任务 | 时间（单卡 4090） |
| ---- | ---- | ----------------- |
| 125M | hellaswag | ~5 min |
| 7B | mmlu | ~45 min |
| 7B | gsm8k 8-shot | ~20 min |

MMLU 14042 题 × 7B forward ≈ **14042 × 4 choices × ~50ms** → 量级小时。

::: info

中文场景加 `ceval`、`cmmlu`（若 harness 版本支持）。评估前确认 **chat template** 与 few-shot 格式正确。

:::

## 动手试一试

训练前后对比（回归测试）：

```bash
for ckpt in checkpoints/best-hf checkpoints/sft-lora; do
  lm_eval --model hf \
    --model_args pretrained=$ckpt,dtype=bfloat16 \
    --tasks piqa \
    --device cuda:0 \
    --batch_size 16 \
    --output_path results/piqa_$(basename $ckpt).json
done
```

## 中文 Benchmark 补充

英文 MMLU 对中文模型不公平。国内常用：

| Benchmark | 说明 | 命令示例 |
| --------- | ---- | -------- |
| C-Eval | 中文多学科选择题 | `--tasks ceval-valid` |
| CMMLU | 中文大规模多任务 | `--tasks cmmlu` |
| GAOKAO | 高考题 | 部分 harness 版本支持 |

```bash
lm_eval --model hf \
  --model_args pretrained=checkpoints/sft-lora,dtype=bfloat16 \
  --tasks ceval-valid \
  --device cuda:0 \
  --batch_size 4 \
  --output_path results/ceval.json
```

## 结果如何解读

Benchmark 分数不是「智商」。它衡量的是：**在特定题库的 loglikelihood 或 exact match**。125M 模型 HellaSwag ~35% 仍可能有流畅生成；7B SFT MMLU 60% 仍可能幻觉。工程上把 Benchmark 当**回归测试**：SFT 后 MMLU 掉 5 点，说明训练数据或 template 有问题。

建议维护 `results/history.csv`：

```bash
echo "date,checkpoint,piqa,mmlu,notes" > results/history.csv
echo "2026-07-09,best-hf,0.62,," >> results/history.csv
```

## 常见误区

1. **Base 模型跑 MMLU chat 格式**：选择题需 loglikelihood，不是生成。
2. **batch_size 过大 OOM**：7B MMLU 用 batch 4–8。
3. **只看单一 benchmark**：数学涨、常识跌可能是过拟合 GSM8K。
4. **few-shot 数量不一致**：论文用 5-shot，你跑 0-shot，分数不可比。
5. **未固定 random seed**：multiple choice 顺序扰动影响极小，但生成类任务需 `seed=42`。

## 端到端实践要点

Benchmark 是**回归测试**，不是高考排名。125M Base 在 MMLU 接近随机正常；SFT 7B 才值得跑全套。`lm_eval` 统一了任务格式：选择题用 loglikelihood，生成题用 generate until。结果 JSON 进 Git 或 W&B，每次改数据/超参后对比 piqa、ceval 是否掉点。

中文任务务必加 C-Eval/CMMLU，英文 MMLU 对中文模型不公平。few-shot 数量与论文一致（通常 5-shot）才可比较。不要把 benchmark 分数当用户体验唯一指标：60% MMLU 仍可能幻觉，需人工 eval 与线上 A/B。

CI 可 nightly 跑轻量 piqa（5 分钟）guard 合并；发版前跑完整套。记录 `checkpoint, date, scores` 表格，三个月后你知道哪次 SFT 把数学能力训没了。Benchmark 集本身也可能泄露进训练数据——公开集重复率高，分数 inflate，要清醒解读。

## 命令流水线复盘

`pip install lm-eval`；`lm_eval --model hf --model_args pretrained=checkpoints/best-hf --tasks hellaswag,piqa --device cuda:0 --output_path results/base.json`；SFT 后同样命令改路径；`python` 解析 JSON 打印 acc。中文加 `--tasks ceval-valid`。结果 commit 到 `results/` 或 W&B artifact。下一篇[监控训练](/manual/llm/bit-to-agi/10-train-your-llm/monitor-training)若长跑尚未开 W&B 可补配。

## 排错速查

lm_eval 找不到 task：升级 harness 或查任务名拼写。OOM：减 batch_size。分数全随机：Base 模型跑生成任务而非 loglikelihood。Peft 路径错：model_args 字符串引号嵌套。极慢：先跑 piqa 子集验证环境。

## 验收标准

本篇完成后，你应能在终端用一条命令或脚本验证关键产出存在且非空：`test -s` 查文件、`curl` 查 HTTP、`python -c` 查 import 与 shape。把验收命令写进项目 `Makefile` 或 `scripts/verify.sh`，每次改数据或权重后跑一遍，避免带着 silent failure 进入下一篇。全章二十篇都通过验收，即表示你已具备从零训小模型到部署 API 的完整能力。

## 与前后章衔接

本章每篇都假设你已读完第一至九章：比特与文件格式（第一章）解释 `train.bin` 为何是字节流；信息论（第三章）解释为何 PPL 衡量压缩效率；Transformer（第五章）解释预训练在优化什么；Tokenizer（第六章）与本章 BPE 训练一一对应；Training（第七章）给出 loss、LoRA、Checkpoint 理论；Inference（第八章）对应推理与部署；GPU（第九章）对应硬件与显存估算。若某命令报错，先查依赖版本（Python 3.11+、CUDA 驱动、PyTorch 与 vLLM 匹配），再查路径是否与 `mini-gpt-lab` 目录约定一致。整条流水线可在单卡 4090 上于一个周末跑通；失败时回到[从失败中恢复](/manual/llm/bit-to-agi/10-train-your-llm/recover-from-failure)对照症状表，不要跳过日志与 checkpoint 排查。

完成本篇后建议把关键命令与输出路径记录到 `docs/run-log.md`，便于复现与团队协作。

## 练习扩展

若时间充裕，尝试修改一个超参或配置项，观察下游指标变化并记录到 `docs/run-log.md`：例如清洗 threshold、词表大小、学习率、save 间隔或 vLLM 的 `max-model-len`。单次只改一处，才能归因。对比实验最好开 W&B 同名 project 下不同 run，用 Notes 字段标注「baseline / variant B」。这些习惯与工业界 ML 实验管理一致，比单纯跑通命令更有长期价值。

建议每篇末尾自检：关键产出文件存在、体积合理、随机抽检内容可读，再点下一篇链接。

遇到问题先查日志与磁盘空间，再查本章排错速查表。

保持 `mini-gpt-lab` 目录结构与命名一致，可显著减少路径类错误。

全章命令均在 bash + Python venv 下验证；Windows 用户请用 WSL2 或调整路径分隔符。

## 小结

- `lm_eval` + `--tasks` 标准化评估。
- 125M 跑轻量任务；7B SFT 跑 MMLU/GSM8K。
- 结果 JSON 存档做 CI 回归。

→ 下一篇：[监控训练](/manual/llm/bit-to-agi/10-train-your-llm/monitor-training)
