---
title: "微调 SFT"
description: "从 Bit 到 AGI · 第十章：自己训练一个模型 · 微调 SFT"
source: "https://daiw.org/manual/bit-to-agi/10-train-your-llm/fine-tune-sft"
---

# 微调 SFT

> 从 Bit 到 AGI · 第十章：自己训练一个模型 · 微调 SFT

预训练模型只会续写；**监督微调（SFT）** 教它按「用户问 → 助手答」格式响应。本篇用 LoRA 在 7B Instruct 基座（或本章 125M）上跑 Alpaca 风格数据，并导出带 chat template 的 Checkpoint（关于 HuggingFace 生态工具链的完整指南，另见[《HuggingFace 全家桶》](https://daiw.org/manual/huggingface)）。

## 直觉：入职培训

预训练像通识教育；SFT 是**岗位培训**——固定话术模板、安全边界、工具调用格式。LoRA 只训低秩适配器（几百万参数），基座权重冻结，24 GB 卡可训 7B。

## 定义

SFT 损失（只对 assistant token 算 loss）：

$$
\mathcal{L}_{\text{SFT}} = -\sum_{t \in \text{assistant}} \log p(x_t \mid x_{<t})
$$

LoRA 参数量：

$$
\text{LoRA params} \approx 2 \times r \times d \times L_{\text{target}}
$$

$r=16$、$d=4096$，7 层 Q/V → 约 **4M 可训参数**（原模型 7B 的 0.06%）。

## 例子

**例 1：准备 SFT 数据（Alpaca JSON）**

```bash
cd ~/mini-gpt-lab && source .venv/bin/activate
pip install datasets peft trl transformers accelerate bitsandbytes

python << 'EOF'
from datasets import load_dataset
import json

ds = load_dataset("yahma/alpaca-cleaned", split="train[:5000]")
rows = []
for row in ds:
    rows.append({
        "instruction": row["instruction"],
        "input": row.get("input") or "",
        "output": row["output"],
    })
with open("data/sft/alpaca_5k.json", "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)
print("wrote", len(rows), "samples")
EOF
```

**例 2：TRL SFTTrainer + LoRA**

```bash
cat > scripts/sft_lora.py << 'EOF'
import json
from datasets import Dataset
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer
from trl import SFTConfig, SFTTrainer

BASE = "checkpoints/base/qwen2.5-7b-instruct"  # 或 mini-GPT HF 路径
OUT = "checkpoints/sft-lora"

with open("data/sft/alpaca_5k.json", encoding="utf-8") as f:
    data = json.load(f)

def format_row(r):
    if r["input"]:
        user = f"{r['instruction']}\n\nInput: {r['input']}"
    else:
        user = r["instruction"]
    return {"text": f"<|im_start|>user\n{user}\n<|im_start|>assistant\n{r['output']}"}

ds = Dataset.from_list([format_row(r) for r in data])

tok = AutoTokenizer.from_pretrained(BASE, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    BASE, dtype="auto", device_map="auto", trust_remote_code=True
)

peft_config = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    task_type="CAUSAL_LM",
)

args = SFTConfig(
    output_dir=OUT,
    num_train_epochs=1,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=8,
    learning_rate=2e-4,
    bf16=True,
    logging_steps=10,
    save_steps=500,
    max_length=2048,  # 旧版 trl 为 max_seq_length
)

trainer = SFTTrainer(
    model=model,
    args=args,
    train_dataset=ds,
    peft_config=peft_config,
    processing_class=tok,
)
trainer.train()
trainer.save_model(OUT)
tok.save_pretrained(OUT)
print("Saved to", OUT)
EOF

python scripts/sft_lora.py
```

**例 3：合并 LoRA 并测试 chat**

```bash
python << 'EOF'
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

base = "checkpoints/base/qwen2.5-7b-instruct"
adapter = "checkpoints/sft-lora"
tok = AutoTokenizer.from_pretrained(base)
model = AutoModelForCausalLM.from_pretrained(base, dtype=torch.bfloat16, device_map="auto")
model = PeftModel.from_pretrained(model, adapter)

messages = [{"role": "user", "content": "什么是比特？"}]
text = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tok(text, return_tensors="pt").to(model.device)
out = model.generate(**inputs, max_new_tokens=128)
print(tok.decode(out[0], skip_special_tokens=True))
EOF
```

## 量化

| 配置 | 显存 | 5k 样本 1 epoch |
| ---- | ---- | --------------- |
| 7B LoRA r=16 | ~18 GB | ~45 min |
| 125M full FT | ~4 GB | ~10 min |
| 7B full FT | OOM@24GB | 需多卡 |

SFT 数据量：**1k–100k 条** 高质量对话；超过 100k 收益递减，优先提升单条质量。

::: warning

公开 Alpaca 是英文演示数据。中文产品应换中文 instruction 集，并人工抽检 100 条杜绝幻觉模板。

:::

## 动手试一试

125M 自训模型 SFT（full fine-tune 可承受）：

```bash
# 将 BASE 改为 checkpoints/best-hf，batch_size=4，去掉 peft 或 r=8
# 观察 loss 能否在 1 epoch 内降到 <1.0
```

## Chat Template 详解

Qwen / Llama 3 等在 `tokenizer_config.json` 里内置 Jinja2 template。训练与推理必须用**同一模板**，否则 special token 错位：

```bash
python << 'EOF'
from transformers import AutoTokenizer
tok = AutoTokenizer.from_pretrained("checkpoints/base/qwen2.5-7b-instruct")
messages = [{"role": "user", "content": "你好"}]
print(tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True))
EOF
```

输出应含 `<|im_start|>user` 等标记——SFT 数据里的 `text` 字段必须与之一致。

## 数据质量检查清单

在 `scripts/sft_lora.py` 跑之前，人工抽检 50 条：

- assistant 回答是否**真的回答问题**（非复制 instruction）
- 是否含有毒/隐私内容
- 代码块是否可运行
- 平均 token 长度：过长 (>2048) 需截断或拆分

```bash
python << 'EOF'
import json
lengths = []
with open("data/sft/alpaca_5k.jsonl", encoding="utf-8") as f:
    for line in f:
        msgs = json.loads(line)["messages"]
        total = sum(len(m["content"]) for m in msgs)
        lengths.append(total)
print(f"samples={len(lengths)} avg_chars={sum(lengths)/len(lengths):.0f} max={max(lengths)}")
EOF
```

## 全参微调 vs LoRA 选型

| 方法 | 可训参数 | 7B 显存 | 何时用 |
| ---- | -------- | ------- | ------ |
| LoRA r=16 | ~4M | ~18 GB | 常见首选 |
| LoRA r=64 | ~16M | ~22 GB | 领域术语多 |
| Full FT | 7B | >80 GB | 研究/多卡 |

125M 自训模型参数少，**full fine-tune 4 GB 显存**即可，是练习 SFT 的好对象。

## 常见误区

1. **对 user token 也算 loss**：模型学会复述问题而非回答。
2. **LoRA rank 过大**：r=256 接近 full FT，显存涨。
3. **未对齐 chat template**：推理时格式与训练不一致，效果崩盘。
4. **epoch 过多**：5k 样本训 5 epoch 可能过拟合 Alpaca 口吻。
5. **忘记 merge LoRA**：部署 vLLM 前 `merge_and_unload()` 或加载 adapter 路径。

## 端到端实践要点

SFT 教模型**输出格式与行为**，不是灌输世界知识——知识主要来自预训练。Alpaca 五 k 条是演示；中文产品应用中文 QA、且人工抽检质量。Loss 只对 assistant token 计算，user/system 部分 mask 掉，否则模型学会复读问题。

LoRA 是第七章参数高效微调的默认选择：7B 全参微调 24 GB 不够，LoRA r=16 约 18 GB。125M 可 full FT 练手。Chat template 必须与基座一致：Qwen 用 `<|im_start|>`，Llama 3 用 `<|begin_of_text|>` 等，训练字符串与 `apply_chat_template` 输出必须字节级一致。

训完 merge LoRA 或部署时加载 adapter；vLLM 支持 `--enable-lora`。epoch 不宜过多：5k 样本 3 epoch 可能过拟合 Alpaca 口吻。发布 SFT 版本时在 Model Card 写清 base model id 与 SFT 数据集，便于复现与 license 追溯。

## 命令流水线复盘

`pip install peft trl transformers`；准备 `data/sft/alpaca_5k.jsonl`；运行 `scripts/sft_lora.py`；W&B 或 log 看 loss 降；`PeftModel.from_pretrained` 试生成；`lm_eval` 对比 SFT 前后 piqa。Merge 后 `convert_to_hf` 供 vLLM。若只做 125M full FT，将 BASE 改为 `checkpoints/best-hf` 并去掉 peft。下一篇[跑 Benchmark](/manual/llm/bit-to-agi/10-train-your-llm/evaluate-benchmarks)量化提升幅度。

## 排错速查

loss 不变：检查是否 mask 了全部 token。OOM：减 batch 或 r=8。生成复读 instruction：template 与训练不一致。trl 版本 API 变：查当前 SFTTrainer 参数名。Alpaca 英文主导：换中文集再训。

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

## 小结

- SFT = instruction 数据 + 只对 assistant 算 loss。
- 7B 用 LoRA；125M 可 full FT。
- 导出 adapter 或 merge；chat template 与训练一致。

→ 下一篇：[跑 Benchmark](/manual/llm/bit-to-agi/10-train-your-llm/evaluate-benchmarks)
