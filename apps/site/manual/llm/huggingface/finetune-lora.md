---
title: "LoRA 与 QLoRA 微调"
description: "为什么 LoRA 让单卡微调成为可能、关键超参怎么设、以及一份可直接跑的完整脚本。"
source: "https://daiw.org/manual/huggingface/finetune-lora"
---

# LoRA 与 QLoRA 微调

> 为什么 LoRA 让单卡微调成为可能、关键超参怎么设、以及一份可直接跑的完整脚本。

**这是普通人很现实的训练路径**：一张 16 G 的消费级显卡就能微调 8B 模型。这一篇讲原理够用的部分、参数怎么设，以及一份能直接跑的脚本。

## 为什么全量微调不现实

```text
全量微调 8B 模型需要的显存：
  权重      16 GB  (bf16)
  梯度      16 GB
  Adam 状态 32 GB  (m 和 v 各一份 fp32)
  激活      几 GB
  ─────────────────
  合计      70 GB+     → 要 A100 80G 起步
```

**LoRA 的思路**：冻住原始权重，只训练一组小得多的“增量”矩阵。

```text
原始： W (4096×4096 = 1600 万参数)
LoRA： W + B·A      A: 4096×16   B: 16×4096   = 13 万参数

可训练参数量降到不到 1%
```

于是梯度和优化器状态都只针对那 1%：

```text
LoRA 微调 8B：
  权重（冻结）  16 GB   ← 只读，不需要梯度
  LoRA 参数      0.1 GB
  梯度 + 优化器  0.3 GB
  激活           几 GB
  ─────────────────
  合计         约 20 GB   → 24 G 卡能跑
```

**QLoRA 更进一步**：把冻结的基座权重也量化成 4bit。

```text
QLoRA 微调 8B：
  权重（4bit 冻结）  5 GB
  LoRA + 梯度 + 优化器  0.4 GB
  激活                 几 GB
  ─────────────────
  合计               约 10 GB   → 12~16 G 卡能跑
```

::: info

**LoRA 学的是“风格与格式”，不是“新知识”。**

这个认知很重要，它决定了 LoRA 适合什么：

| 适合 | 不适合 |
| --- | --- |
| 固定输出格式（JSON、特定结构） | 灌输大量新事实 |
| 特定语气 / 人设 | 教会全新的语言 |
| 领域术语与表达习惯 | 提升通用推理能力 |
| 遵循特定的任务范式 | 更新知识（用 RAG） |

**想让模型“知道”公司文档的内容，RAG 比微调有效得多也便宜得多。** 微调是让它“用你希望的方式说话”。

:::

## 装环境

```bash
pip install -U transformers peft trl datasets accelerate bitsandbytes
```

## 一份完整的 QLoRA 脚本

```python
import torch
from datasets import load_dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer, SFTConfig

MODEL = "Qwen/Qwen3-8B"

# ── 1. 4bit 加载基座 ──────────────────────────────
bnb = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

tok = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForCausalLM.from_pretrained(
    MODEL,
    quantization_config=bnb,
    dtype=torch.bfloat16,     # transformers v5 推荐用 dtype（旧名 torch_dtype 仍兼容）
    device_map="auto",
    attn_implementation="sdpa",
)
model = prepare_model_for_kbit_training(model)
model.config.use_cache = False        # 训练时必须关，否则和梯度检查点冲突

# ── 2. 挂 LoRA ───────────────────────────────────
lora = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
)
model = get_peft_model(model, lora)
model.print_trainable_parameters()
# trainable params: 43,646,976 || all params: 8,234,...  || trainable%: 0.53

# ── 3. 数据 ──────────────────────────────────────
ds = load_dataset("json", data_files="train.jsonl", split="train")
ds = ds.train_test_split(test_size=0.05, seed=42)

# ── 4. 训练 ──────────────────────────────────────
cfg = SFTConfig(
    output_dir="./out",
    num_train_epochs=3,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=8,          # 等效 batch = 2×8 = 16
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.03,
    logging_steps=10,
    eval_strategy="steps",
    eval_steps=50,
    save_strategy="steps",
    save_steps=100,
    save_total_limit=2,
    bf16=True,
    gradient_checkpointing=True,
    max_length=2048,
    report_to="none",
)

trainer = SFTTrainer(
    model=model,
    args=cfg,
    train_dataset=ds["train"],
    eval_dataset=ds["test"],
    processing_class=tok,
)

trainer.train()
trainer.save_model("./out/final")
```

数据格式见[做自己的数据集](/manual/llm/huggingface/build-your-dataset)——`SFTTrainer` 认 `{"messages": [...]}`，会自动套 chat template。

## 关键超参

### r 与 lora_alpha

```python
r=16, lora_alpha=32       # alpha = 2r，最常用
```

| `r` | 可训练参数 | 适合 |
| --- | --- | --- |
| 4~8 | 极少 | 数据 < 1000 条，只改风格 |
| **16** | 少 | **默认起点，覆盖多数场景** |
| 32~64 | 中 | 数据多、任务复杂 |
| 128+ | 多 | 接近全量微调，很少需要 |

**`lora_alpha` 通常设为 `2×r`**。它和 `r` 的比值决定 LoRA 的“影响强度”（缩放因子是 `alpha/r`），所以按比例设就好。

::: warning

**别一上来就把 `r` 调大。** 常见误区是“效果不好 → 加大 r”，但多数情况下效果不好是**数据问题**，加大 r 只会更快过拟合。

正确顺序：**先查数据 → 再调学习率与轮数 → 最后才动 r。**

:::

### target_modules

```python
# 全部线性层（推荐）
target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"]

# 只注意力（更省，效果略弱）
target_modules=["q_proj","k_proj","v_proj","o_proj"]

# 让 peft 自己找
target_modules="all-linear"
```

**`"all-linear"` 是很省事的写法**，尤其换模型架构时不用改名字。研究普遍显示挂满所有线性层比只挂注意力效果好。

### learning_rate

```python
learning_rate=2e-4     # LoRA 的典型值
```

**LoRA 的学习率比全量微调高一到两个数量级**（全量通常 1e-5~5e-5）。因为可训练参数少、初始化为零，需要更大的步子。

| 情况 | 建议 |
| --- | --- |
| 默认 | `2e-4` |
| 数据少（< 1000） | `1e-4`，防过拟合 |
| loss 不降 | 调到 `3e-4`~`5e-4` |
| loss 震荡 / 变 NaN | 降到 `5e-5` |

### batch size 与梯度累积

```python
per_device_train_batch_size=2,
gradient_accumulation_steps=8,     # 等效 batch = 16
```

**显存放不下大 batch 就用梯度累积**——效果接近，只是慢一些。等效 batch 建议 16~32。

## 显存不够时的开关

按牺牲程度从小到大：

```python
gradient_checkpointing=True,       # ① 省很多，慢约 20~30%
per_device_train_batch_size=1,     # ② 配大 gradient_accumulation_steps
max_length=1024,                   # ③ 缩短序列，省得极多
optim="paged_adamw_8bit",          # ④ 8bit 优化器，再省一点
r=8,                               # ⑤ 最后才动这个
```

::: info

**`max_length` 是很有效的显存旋钮。** 激活显存与序列长度大致成正比，从 2048 降到 1024 能省近一半。

但要确认你的数据实际有多长——如果 95% 的样本都在 800 token 以内，设 2048 纯属浪费：

```python
lens = [len(tok.apply_chat_template(x["messages"])) for x in ds.select(range(500))]
print(sorted(lens)[int(len(lens)*0.95)])     # 95 分位
```

**按 95 分位设 `max_length`**，剩下 5% 截断掉影响不大。

:::

## 用训练好的 LoRA

### 直接加载适配器

```python
from peft import PeftModel

base = AutoModelForCausalLM.from_pretrained(MODEL, dtype="auto", device_map="auto")
model = PeftModel.from_pretrained(base, "./out/final")
model.eval()
```

**适配器只有几十到几百 MB**，可以随便分发。用户自己下基座。

### 合并进基座

要部署到 [vLLM](/manual/llm/huggingface/vllm-serving) 或转 GGUF，得先合并：

```python
merged = model.merge_and_unload()
merged.save_pretrained("./merged", safe_serialization=True)
tok.save_pretrained("./merged")
```

::: warning

**合并必须用未量化的基座。** 从 4bit 模型合并出来的权重质量会有损失。

正确流程：**用 4bit 训练（QLoRA） → 加载 bf16 基座 → 挂上适配器 → 合并**。

```python
base = AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.bfloat16)  # 不量化
m = PeftModel.from_pretrained(base, "./out/final")
merged = m.merge_and_unload()
```

这一步需要能装下完整 bf16 权重的内存——显存不够可以 `device_map="cpu"` 在内存里做。

:::

vLLM 也支持直接挂载 LoRA，不合并：

```bash
vllm serve Qwen/Qwen3-8B --enable-lora --lora-modules my-lora=./out/final
```

## 小结

- **LoRA 学风格与格式，不学新知识**——要“知道”内容用 RAG。
- QLoRA（4bit 基座 + LoRA）让 **12~16 G 卡能微调 8B**。
- 起手参数：**`r=16`、`alpha=32`、`lr=2e-4`、`target_modules="all-linear"`**。
- **`use_cache=False`** 训练时必须关。
- 效果不好的排查顺序：**数据 → 学习率与轮数 → 最后才动 r**。
- 显存不够按序开：**梯度检查点 → 减 batch + 累积 → 缩 `max_length` → 8bit 优化器**。
- **`max_length` 按数据的 95 分位设**，别照抄 2048。
- **合并要用未量化的 bf16 基座**，否则质量受损。

下一篇：[训练实操](/manual/llm/huggingface/training-practice)。
