---
title: "训练实操"
description: "训练时怎么看 loss、OOM 的排查顺序、过拟合的信号，以及训完怎么判断到底有没有变好。"
source: "https://daiw.org/manual/huggingface/training-practice"
---

# 训练实操

> 训练时怎么看 loss、OOM 的排查顺序、过拟合的信号，以及训完怎么判断到底有没有变好。

脚本跑起来只是开始。这一篇讲**跑起来之后怎么判断它对不对**——看什么指标、出问题怎么查、训完怎么验收。

## 先跑通再跑对

**第一次运行永远用小样本**：

```python
ds = load_dataset("json", data_files="train.jsonl", split="train[:50]")
```

```python
cfg = SFTConfig(
    max_steps=10,          # 只跑 10 步
    logging_steps=1,
    save_strategy="no",
)
```

十步跑通说明：数据格式对、显存够、能反向传播。**这一步能省掉“等了两小时才发现第 3000 步崩了”。**

跑通后再放开全量。

## 看 loss

```text
step 10  loss 2.841
step 20  loss 2.103
step 30  loss 1.755
step 40  loss 1.612
step 50  loss 1.540
```

| 现象 | 含义 |
| --- | --- |
| **平稳下降后趋缓** | 正常，这是想要的 |
| 完全不降 | 学习率太低；或数据 / 标签有问题 |
| 剧烈震荡 | 学习率太高；或 batch 太小 |
| 降到 0 附近 | **多半是数据泄漏或过拟合** |
| 变成 `nan` | 学习率太高；或 fp16 溢出 → 换 bf16 |

::: warning

**loss 降到接近 0 不是好消息。** 语言模型的 loss 有天然下限（语言本身有不确定性），正常 SFT 收敛到 0.5~1.5 之间是常见范围。

掉到 0.1 以下通常意味着：

- 数据里有大量重复，模型背下来了
- 训练轮数太多，严重过拟合
- 验证集和训练集有重叠（数据泄漏）

这时候模型在你的数据上完美，**在真实输入上会很糟**。

:::

### 一定要有验证集

```python
eval_strategy="steps",
eval_steps=50,
```

```text
step 100  loss 1.20  eval_loss 1.35
step 150  loss 1.05  eval_loss 1.31
step 200  loss 0.88  eval_loss 1.34   ← eval 开始回升
step 250  loss 0.71  eval_loss 1.42   ← 过拟合了
```

**train loss 继续降、eval loss 开始升 = 过拟合的经典信号。** 那个拐点就是该停的地方。

```python
load_best_model_at_end=True,
metric_for_best_model="eval_loss",
greater_is_better=False,
```

加上这三行，训完自动回到 eval_loss 最低的那个 checkpoint。

::: info

**小数据集（< 2000 条）建议 1~2 个 epoch 就够。**

常见错误是照抄“3 epochs”这个默认值——在 500 条数据上跑 3 轮，模型会把每条都背下来。数据越少，轮数应该越少。

| 数据量 | epoch |
| --- | --- |
| < 500 | 1~2 |
| 1000~5000 | 2~3 |
| 10000+ | 3~5 |

:::

## OOM 的排查顺序

```text
CUDA out of memory. Tried to allocate 2.00 GiB
```

按这个顺序试，从代价最小的开始：

**① 确认没有别的进程占着显存**

```bash
nvidia-smi
```

上一次训练的 Python 进程没退干净，是很常见的原因。

**② 开梯度检查点**

```python
gradient_checkpointing=True
```

省很多显存，慢 20~30%。**几乎总该开。**

**③ 减小 batch，加大累积**

```python
per_device_train_batch_size=1,
gradient_accumulation_steps=16,
```

等效 batch 不变，显存显著下降。

**④ 缩短 max_length** —— 见[上一篇](/manual/llm/huggingface/finetune-lora)的 95 分位算法。**这一步通常最有效。**

**⑤ 换 8bit 优化器**

```python
optim="paged_adamw_8bit"
```

**⑥ 上 QLoRA**（如果还在用 bf16 基座）

**⑦ 最后才降 `r`**

::: warning

**训到一半才 OOM，往往是某几条超长样本。**

前几百步好好的，突然崩——因为遇到了一条特别长的数据。检查长度分布：

```python
import numpy as np
lens = [len(tok.apply_chat_template(x["messages"])) for x in ds]
print(np.percentile(lens, [50, 95, 99, 100]))
```

看到 `[420, 1800, 4200, 31000]` 这种分布，就该把超长的过滤掉或截断——**为了 1% 的样本把 `max_length` 设到 32768，代价太大**。

另一个缓解手段是 `group_by_length=True`，让长度相近的样本聚在一起，减少 padding 浪费。

:::

## 训练速度

```text
{'loss': 1.23, 'grad_norm': 0.8, 'learning_rate': 1.8e-4,
 'epoch': 0.5, 'train_samples_per_second': 2.1}
```

粗略预期（8B QLoRA，序列 2048）：

| 硬件 | samples/s |
| --- | --- |
| RTX 3090 / 4090 | 1.5~3 |
| A100 40G | 5~8 |
| RTX 4060 Ti 16G | 0.8~1.5 |

**5000 条数据、3 epoch、2 samples/s ≈ 2 小时。** 心里有个数，超出太多就该查是不是有层掉到 CPU 上了。

提速开关：

```python
bf16=True,                                  # 别用 fp16，bf16 更稳
attn_implementation="flash_attention_2",    # 装了 flash-attn 的话
group_by_length=True,                       # 减少 padding
dataloader_num_workers=4,                   # 数据加载别成为瓶颈
```

## 怎么判断训完变好了没

**光看 loss 不够**——loss 低不等于好用。

### ① 眼看（最重要）

准备 20 条**训练集里没有的**真实输入，训练前后各跑一遍，人工对比。

```python
from peft import PeftModel

base = AutoModelForCausalLM.from_pretrained(MODEL, dtype="auto", device_map="auto")
tuned = PeftModel.from_pretrained(base, "./out/final")

for q in test_questions:
    msgs = [{"role": "user", "content": q}]
    text = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
    ids = tok(text, return_tensors="pt").to(tuned.device)
    out = tuned.generate(**ids, max_new_tokens=256, do_sample=False)
    print("Q:", q)
    print("A:", tok.decode(out[0][ids.input_ids.shape[1]:], skip_special_tokens=True))
    print("-" * 60)
```

::: info

**对比测试用 `do_sample=False`。** 采样会引入随机性，让你分不清是“变好了”还是“这次运气好”。确定性解码才能公平对比。

:::

### ② 格式遵循率

如果微调目标是“输出固定格式”，直接量化：

```python
import json

ok = 0
for q in test_set:
    try:
        json.loads(generate(q))
        ok += 1
    except json.JSONDecodeError:
        pass
print(f"格式正确率：{ok}/{len(test_set)}")
```

**这类指标最能反映 LoRA 的价值**——它本来就擅长定型格式。

### ③ 检查有没有“训傻”

微调最常见的副作用是**通用能力退化**：模型学会了你的格式，但别的都不会了。

```python
general = ["1+1 等于几", "介绍一下光合作用", "把 hello 翻译成中文"]
```

::: warning

**灾难性遗忘是真实存在的。** 在客服数据上狠训一通，模型可能连普通问题都答不好了，或者不管问什么都往退货流程上扯。

缓解手段，按有效性排：

- **降低学习率、减少轮数**（最有效）
- 训练数据里**掺 10~20% 的通用对话数据**
- 降低 `r`，减少对原模型的扰动

每次训完用几条无关问题测一下，是很便宜的保险。

:::

## 保存与恢复

```python
save_strategy="steps",
save_steps=100,
save_total_limit=2,        # 只留最近 2 个，省硬盘
```

中断后恢复：

```python
trainer.train(resume_from_checkpoint=True)     # 自动找最新的
```

**长时间训练一定要设 `save_steps`**——服务器重启、显存被抢、断电，什么都可能发生。

## 记录实验

```python
report_to="tensorboard"     # 或 "wandb"
```

```bash
tensorboard --logdir ./out/runs
```

::: info

**调参一定要记录。** 试到第五组超参时，你不会记得第二组用的是什么学习率、效果如何。

最低限度：每次训练把配置和几条样例输出写进一个 markdown 文件。比事后回忆可靠得多。

:::

## 小结

- **先用 50 条 + 10 步跑通**，再放开全量。
- **loss 降到接近 0 是坏消息**，正常 SFT 收敛在 0.5~1.5。
- **必须有验证集**；train 降、eval 升 = 过拟合，配 `load_best_model_at_end`。
- **小数据集别跑 3 个 epoch**——500 条数据 1~2 轮足够。
- OOM 按序查：**别的进程 → 梯度检查点 → batch+累积 → `max_length` → 8bit 优化器 → r**。
- **训到一半 OOM 多半是超长样本**，看长度分布并过滤。
- 验收**以人工对比为主**，用 `do_sample=False` 保证可比。
- **每次都测几条无关问题**，防灾难性遗忘。
- 长训练必设 `save_steps`；调参必记录。

下一篇：[推回 Hub](/manual/llm/huggingface/push-to-hub)。
