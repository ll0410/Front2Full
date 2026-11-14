---
title: "验证模型"
description: "从 Bit 到 AGI · 第十章：自己训练一个模型 · 验证模型"
source: "https://daiw.org/manual/bit-to-agi/10-train-your-llm/validate-model"
---

# 验证模型

> 从 Bit 到 AGI · 第十章：自己训练一个模型 · 验证模型

训练 loss 下降不代表模型「有用」。本篇教你用**困惑度（Perplexity）**、**生成样例**和**held-out 验证集**三件套，判断 Checkpoint 是否该继续训、该进入部署还是该回炉加数据。

## 直觉：模考 + 口试

预训练 loss 是「课堂练习正确率」；验证是**没见过的卷子**。Perplexity 衡量模型对下一张 token 有多「困惑」——相当于平均在多少个候选里犹豫。PPL 从 100 降到 20，说明统计规律学进去了；再降到 15 以下，生成文本才开始可读。

## 定义

**困惑度**（Perplexity, PPL）：

$$
\text{PPL} = \exp\left(-\frac{1}{N}\sum_{i=1}^{N} \log p(x_i \mid x_{<i})\right)
$$

| PPL 范围 | 125M 模型典型含义 |
| -------- | ----------------- |
| > 100 | 几乎随机（$\log V \approx 10.4$ for $V=32768$） |
| 50–100 | 学到 n-gram 级规律 |
| 20–50 | 短语连贯 |
| 10–20 | 句子级可读（视语料） |
| < 10 | 可能过拟合小验证集 |

## 例子

**例 1：切分验证集**

```bash
cd ~/mini-gpt-lab && source .venv/bin/activate

python << 'EOF'
from pathlib import Path
from tokenizers import Tokenizer
import numpy as np

tok = Tokenizer.from_file("tokenizer/tokenizer.json")
eot = tok.token_to_id("<|endoftext|>")
ids = []
with open("processed/train.txt", encoding="utf-8") as f:
    for para in f:
        para = para.strip()
        if para:
            ids.extend(tok.encode(para).ids)
            ids.append(eot)

arr = np.array(ids, dtype=np.uint16)
split = int(len(arr) * 0.99)  # 1% 验证
arr[:split].tofile("data/litgpt/train.bin")
arr[split:].tofile("data/litgpt/val.bin")
print(f"train={split:,} val={len(arr)-split:,} tokens")
EOF
```

**例 2：计算验证 PPL**

```bash
cat > scripts/eval_ppl.py << 'EOF'
import math, torch
import numpy as np
from pathlib import Path

# 简化版：用 litgpt 或 transformers 加载 checkpoint
CKPT = Path("checkpoints/pretrain/final/lit_model.pth")
VAL = Path("data/litgpt/val.bin")
SEQ = 2048

def eval_ppl(model, val_ids, device="cuda"):
    model.eval()
    total_loss, total_tokens = 0.0, 0
    with torch.no_grad():
        for start in range(0, len(val_ids) - SEQ, SEQ):
            chunk = torch.tensor(val_ids[start:start+SEQ+1], device=device)
            logits = model(chunk[:-1])
            loss = torch.nn.functional.cross_entropy(
                logits.view(-1, logits.size(-1)),
                chunk[1:].view(-1),
                reduction="sum",
            )
            total_loss += loss.item()
            total_tokens += SEQ
    return math.exp(total_loss / total_tokens)

if __name__ == "__main__":
    val = np.fromfile(VAL, dtype=np.uint16)
    print(f"val tokens={len(val):,}")
    # 加载模型：litgpt load_checkpoint ...
    # ppl = eval_ppl(model, val)
    # print(f"PPL={ppl:.2f}")
    print("Replace with litgpt evaluate CLI for full run")
EOF
```

LitGPT 内置评估：

```bash
litgpt evaluate checkpoints/pretrain/final \
  --val_data_path data/litgpt/val.bin \
  --tokenizer_dir tokenizer \
  --max_seq_length 2048
```

**例 3：人工抽检生成**

```bash
litgpt generate checkpoints/pretrain/final \
  --tokenizer_dir tokenizer \
  --prompt "比特是" \
  --max_new_tokens 128 \
  --temperature 0.8 \
  --top_k 50
```

## 量化

验证集 1% of 1.7B tokens ≈ **17M tokens**；PPL 评估一遍约 **5–10 分钟**（125M 模型，单卡）。

| 检查项 | 通过标准（实验级） |
| ------ | ------------------ |
| val PPL < train PPL × 1.1 | 无严重过拟合 |
| 生成无无限重复 | repetition penalty 可调 |
| 中文/英文与语料比例一致 | 否则检查语言过滤 |

::: warning

不要用验证集调超参后再报同一个 PPL——那是测试集泄露。应用**第三份 hold-out test** 做最终数字，或把调参交给训练集子集。

:::

## 动手试一试

对比 step-1000 与 final Checkpoint：

```bash
for ckpt in checkpoints/pretrain/step-001000 checkpoints/pretrain/final; do
  echo "=== $ckpt ==="
  litgpt evaluate "$ckpt" \
    --val_data_path data/litgpt/val.bin \
    --tokenizer_dir tokenizer
done
```

记录 PPL 随 step 变化，画简单表格。

## 生成质量 Rubric

除 PPL 外，人工按 1–5 分评 20 条生成：

| 维度 | 1 分 | 5 分 |
| ---- | ---- | ---- |
| 连贯性 | 乱码 | 句子通顺 |
| 重复 | 循环同一短语 | 无重复 |
| 事实 | 明显胡说 | 与语料一致 |
| 语言 | 中英乱混 | 与 prompt 一致 |

平均分 低于3 应继续训或加数据；>4 可进部署测试。

## Early Stopping 策略

```python
# 伪逻辑
best_ppl = float("inf")
patience = 3
bad_evals = 0
for step in training:
    if step % 2000 == 0:
        ppl = evaluate(val)
        if ppl < best_ppl:
            best_ppl = ppl
            save("best")
            bad_evals = 0
        else:
            bad_evals += 1
        if bad_evals >= patience:
            break  # 早停
```

125M 实验通常 **val PPL 连升 3 次 eval** 即可停。

## 常见误区

1. **只看 train loss**：train 继续降、val 升 → 过拟合，该停或加数据。
2. **PPL 跨 Tokenizer 不可比**：换词表后 PPL 数值会变。
3. **生成 temperature=0 评判预训练模型**：预训练模型未做 SFT，应用 sampling 并降低期望。
4. **验证集太小**：1% of 小语料可能 低于100k tokens，PPL 方差大。
5. **用测试集调参**：测试集只评一次最终模型。

## 端到端实践要点

验证回答「这个 Checkpoint 能不能用」，而不是「loss 好不好看」。Train loss 持续下降但 val PPL 上升是典型的过拟合信号：语料太小或训太久。125M 模型在 500M tokens 上训 50k step 可能已过；用 early stopping 取 val 最优 step 是常规操作。

PPL 是 exp(cross_entropy)，与第七章交叉熵直接对应。随机猜 32k 词表的理论 PPL 约 32768；初始 loss ~10 意味着 PPL ~22000，接近随机。PPL 到 30 表示模型对下一个 token 的平均「有效候选数」约 30 个，已经有较强预测力。不同 Tokenizer 的 PPL **不可横向比较**，只能同一词表、同一验证集上比不同 step。

生成评估要用 sampling（temperature 0.7–0.9）并看重复、乱码、语言混杂。建一个简单的 Rubric 表格，二十条 prompt 人工打分，比单一 PPL 更接近「用户感受」。验证通过后，把 best checkpoint 写入 `checkpoints/best/` 并记录 meta.json，部署与发布只认这一份，避免「用 last 上线发现效果差」的返工。

## 命令流水线复盘

`python` 切分脚本写 `data/litgpt/val.bin`；`litgpt evaluate checkpoints/pretrain/step-* --val_data_path data/litgpt/val.bin`；记录各 step PPL 表格；`litgpt generate` 对十条 prompt 采样；填 Rubric 均分；选 val 最低 step 复制到 `checkpoints/best/` 并写 `meta.json`。若 PPL 仍 >100，回[预训练模型](/manual/llm/bit-to-agi/10-train-your-llm/pretrain-model)加长训练或查数据。通过后进入[保存 Checkpoint](/manual/llm/bit-to-agi/10-train-your-llm/save-checkpoint)。

## 排错速查

val.bin 空：切分脚本 train 比例 100%。PPL inf：val 含 OOV 或空 chunk。generate 与 PPL 矛盾：采样随机性，多试几条。eval OOM：减 seq_len。step 不可比：不同 run 的 val 集须相同。

## 验收标准

本篇完成后，你应能在终端用一条命令或脚本验证关键产出存在且非空：`test -s` 查文件、`curl` 查 HTTP、`python -c` 查 import 与 shape。把验收命令写进项目 `Makefile` 或 `scripts/verify.sh`，每次改数据或权重后跑一遍，避免带着 silent failure 进入下一篇。全章二十篇都通过验收，即表示你已具备从零训小模型到部署 API 的完整能力。

## 与前后章衔接

本章每篇都假设你已读完第一至九章：比特与文件格式（第一章）解释 `train.bin` 为何是字节流；信息论（第三章）解释为何 PPL 衡量压缩效率；Transformer（第五章）解释预训练在优化什么；Tokenizer（第六章）与本章 BPE 训练一一对应；Training（第七章）给出 loss、LoRA、Checkpoint 理论；Inference（第八章）对应推理与部署；GPU（第九章）对应硬件与显存估算。若某命令报错，先查依赖版本（Python 3.11+、CUDA 驱动、PyTorch 与 vLLM 匹配），再查路径是否与 `mini-gpt-lab` 目录约定一致。整条流水线可在单卡 4090 上于一个周末跑通；失败时回到[从失败中恢复](/manual/llm/bit-to-agi/10-train-your-llm/recover-from-failure)对照症状表，不要跳过日志与 checkpoint 排查。

完成本篇后建议把关键命令与输出路径记录到 `docs/run-log.md`，便于复现与团队协作。

## 练习扩展

若时间充裕，尝试修改一个超参或配置项，观察下游指标变化并记录到 `docs/run-log.md`：例如清洗 threshold、词表大小、学习率、save 间隔或 vLLM 的 `max-model-len`。单次只改一处，才能归因。对比实验最好开 W&B 同名 project 下不同 run，用 Notes 字段标注「baseline / variant B」。这些习惯与工业界 ML 实验管理一致，比单纯跑通命令更有长期价值。

## 小结

- 切 1% token 做 `val.bin`；用 PPL + 生成样例验证。
- 125M 实验模型 val PPL 目标 **20–40**（视语料）。
- Checkpoint 对比选最佳 step，而非盲目用 last。

→ 下一篇：[保存 Checkpoint](/manual/llm/bit-to-agi/10-train-your-llm/save-checkpoint)
