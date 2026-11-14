---
title: "做自己的数据集"
description: "微调数据该长什么样、从零整理的流程、质量比数量重要，以及怎么传上 Hub。"
source: "https://daiw.org/manual/huggingface/build-your-dataset"
---

# 做自己的数据集

> 微调数据该长什么样、从零整理的流程、质量比数量重要，以及怎么传上 Hub。

要微调，先有数据。这一篇讲**微调数据的标准格式**、怎么从手上的原始材料整理出来、以及一条最该记住的经验：**质量远比数量重要**。

## 微调数据的两种格式

### ① 对话格式（推荐）

```json
{"messages": [
  {"role": "system", "content": "你是一个简洁的客服助手。"},
  {"role": "user", "content": "怎么退货？"},
  {"role": "assistant", "content": "在订单页点「申请退货」，填写原因后系统会生成退货单号。"}
]}
```

一行一条，存成 `.jsonl`。**这是当前的事实标准**——`trl` 的 `SFTTrainer` 直接支持，会自动套用模型的 [chat template](/manual/llm/huggingface/repo-anatomy)。

多轮对话就是多几组 user/assistant：

```json
{"messages": [
  {"role": "user", "content": "怎么退货？"},
  {"role": "assistant", "content": "在订单页点「申请退货」。"},
  {"role": "user", "content": "退款多久到账？"},
  {"role": "assistant", "content": "审核通过后 3~5 个工作日原路退回。"}
]}
```

### ② 指令格式（Alpaca 风格）

```json
{"instruction": "把下面这句话改写得更正式", "input": "这事儿挺急的", "output": "此事较为紧急。"}
```

老一些，但仍常见。**新项目建议直接用对话格式**——它能表达多轮，也和推理时的实际形态一致。

::: warning

**训练格式必须和推理时一致。** 用单轮指令格式训出来的模型，拿去做多轮对话时表现会明显下滑——它没见过“上文里有好几轮”这种输入。

同理，训练时带 system prompt、推理时不带（或反过来），效果也会打折。**先想清楚上线时怎么用，再按那个样子准备数据。**

:::

## 从原始材料到数据集

假设你有一堆公司文档，想微调一个问答助手。

### 第一步：抽取成结构化

```python
import json, pathlib

rows = []
for p in pathlib.Path("docs").glob("**/*.md"):
    text = p.read_text(encoding="utf-8")
    rows.append({"source": str(p), "text": text})

with open("raw.jsonl", "w", encoding="utf-8") as f:
    for r in rows:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
```

**`ensure_ascii=False` 别忘了**，否则中文会变成 `\uXXXX` 转义，文件体积翻几倍且不可读。

### 第二步：生成问答对

手写几千条不现实，常见做法是**用一个强模型批量生成**，人工抽检：

```python
from vllm import LLM, SamplingParams

llm = LLM(model="Qwen/Qwen3-32B", max_model_len=8192)

PROMPT = """根据下面的文档片段，生成 3 个用户可能问的问题及对应答案。
答案必须完全来自文档，不要编造。输出 JSON 数组，每项含 question 与 answer。

文档：
{doc}"""

prompts = [[{"role": "user", "content": PROMPT.format(doc=r["text"][:3000])}] for r in rows]
outs = llm.chat(prompts, SamplingParams(temperature=0.3, max_tokens=1024))
```

用 [vLLM 的离线批量推理](/manual/llm/huggingface/vllm-serving)，几千条几分钟就跑完。

::: warning

**合成数据必须人工抽检。** 模型会编造文档里没有的内容（尤其在文档片段信息不足时），这些幻觉会被原样学进去，而且训完很难发现。

最低限度：**随机抽 100 条逐个核对**。错误率超过 5% 就要改提示词或换更强的模型重来。

另外注意生成模型的**许可**——有些商业模型的服务条款禁止用其输出训练竞品模型。用开源模型生成没这个问题。

:::

### 第三步：清洗

```python
from datasets import load_dataset

ds = load_dataset("json", data_files="qa.jsonl", split="train")

ds = ds.filter(lambda x: 10 < len(x["answer"]) < 2000)       # 去掉太短太长
ds = ds.filter(lambda x: "抱歉" not in x["answer"][:10])      # 去掉拒答
ds = ds.filter(lambda x: x["question"].strip().endswith(("?", "？")))
```

去重（简单精确去重）：

```python
seen = set()
def dedup(x):
    key = x["question"].strip()
    if key in seen:
        return False
    seen.add(key)
    return True

ds = ds.filter(dedup)
```

::: info

**去重的收益常被低估。** 合成数据里重复问法极多（“怎么退货”“如何退货”“退货流程是什么”），重复样本会让模型在这些点上过拟合。

精确去重是底线。更进一步可以用[向量模型](/manual/llm/huggingface/classic-models)做语义去重：相似度 > 0.95 的只留一条。

:::

### 第四步：转成对话格式

```python
def to_messages(x):
    return {"messages": [
        {"role": "user", "content": x["question"]},
        {"role": "assistant", "content": x["answer"]},
    ]}

ds = ds.map(to_messages, remove_columns=ds.column_names)
ds = ds.train_test_split(test_size=0.05, seed=42)
ds["train"].to_json("train.jsonl", force_ascii=False)
```

**留 5% 做验证集**——训练时用来看有没有过拟合，见[训练实操](/manual/llm/huggingface/training-practice)。

## 质量比数量重要

这是整篇最该记住的一句。

::: info

**1000 条精挑细选的数据，通常胜过 10 万条粗糙数据。**

这不是玄学：LoRA 微调调整的参数量本来就少，它学的是“风格与格式”而非“新知识”。少量高质量样本足以定型；大量含噪样本反而把噪声一起学了。

实践路径：
1. 先做 **500~1000 条**，训一版看效果。
2. 效果不好，**先看数据**（抽查 50 条），而不是加量。
3. 确认数据没问题再加量，每次翻倍。

**一上来就堆 10 万条，出了问题根本查不出是哪批数据的锅。**

:::

判断数据质量的几个信号：

| 检查 | 怎么看 |
| --- | --- |
| 答案是否真的回答了问题 | 抽查 50 条 |
| 长度分布是否合理 | `plt.hist([len(a) for a in answers])` |
| 有没有大量重复 | 去重前后条数比 |
| 格式是否统一 | 有没有的答案带 Markdown、有的不带 |
| 有没有敏感信息 | **手机号、邮箱、身份证、内部密钥** |

::: warning

**上传前必须过一遍敏感信息。** 从内部文档生成的数据集里混进真实姓名、电话、密钥，传到公开仓库就收不回来了（Git 有历史）。

```python
import re
PATTERNS = [r"\d{11}", r"[\w.]+@[\w.]+", r"sk-[A-Za-z0-9]{20,}"]

def has_pii(x):
  t = json.dumps(x, ensure_ascii=False)
  return any(re.search(p, t) for p in PATTERNS)

suspects = ds.filter(has_pii)
print(f"可疑条数：{len(suspects)}")
```

正则只是初筛，**发现可疑就人工看**。

:::

## 传到 Hub

```python
from datasets import load_dataset

ds = load_dataset("json", data_files={"train": "train.jsonl", "test": "test.jsonl"})
ds.push_to_hub("your-name/my-qa-dataset", private=True)
```

**先传 `private=True`**，确认没问题再改公开。

命令行方式：

```bash
hf upload --repo-type dataset your-name/my-qa-dataset ./data
```

### 写数据集卡片

仓库根目录的 `README.md`，带 YAML 头：

```markdown
---
license: cc-by-4.0
language: [zh]
task_categories: [question-answering]
size_categories: [1K<n<10K]
---

# 客服问答数据集

## 来源
基于公司公开文档，用 Qwen3-32B 生成问答对，人工抽检 200 条（准确率 96%）。

## 格式
对话格式 JSONL，每条含单轮 user/assistant。

## 已知局限
- 覆盖范围限于退换货与物流，不含支付相关问题。
- 合成数据，可能残留少量事实性错误。
```

::: info

**“已知局限”这一节最有价值，也最常被省略。** 半年后你自己回来看，或者别人要用，最需要知道的就是“这份数据不适合干什么”。

写清楚来源与生成方式，也是学术与合规上的基本要求。

:::

## 小结

- 微调数据用**对话格式 JSONL**（`{"messages": [...]}`），是当前标准。
- **训练格式必须和推理时一致**——单轮训出来的模型做多轮会明显变差。
- 用强模型批量生成 + **人工抽检 100 条**，错误率超 5% 就重来。
- **去重收益很大**，重复问法会导致局部过拟合。
- **1000 条精数据胜过 10 万条粗数据**；效果不好先看数据，别急着加量。
- 写文件记得 **`ensure_ascii=False`**。
- **上传前扫一遍 PII**，公开仓库的历史收不回来。
- 数据集卡片里**写清来源与已知局限**。

下一篇：[LoRA 微调](/manual/llm/huggingface/finetune-lora)。
