---
title: "datasets 库基础"
description: "load_dataset、流式读取、map 处理、缓存机制，以及大数据集怎么不撑爆硬盘。"
source: "https://daiw.org/manual/huggingface/datasets-basics"
---

# datasets 库基础

> load_dataset、流式读取、map 处理、缓存机制，以及大数据集怎么不撑爆硬盘。

Hub 上不只有模型。`datasets` 库让你用一行代码拿到几十 GB 的数据集，并且**不必全部放进内存**。

## 一行加载

```bash
pip install datasets
```

```python
from datasets import load_dataset

ds = load_dataset("squad")
print(ds)
```

```text
DatasetDict({
    train: Dataset({ features: ['id','title','context','question','answers'], num_rows: 87599 })
    validation: Dataset({ features: [...], num_rows: 10570 })
})
```

访问方式像字典 + 列表：

```python
ds["train"][0]                # 第一条
ds["train"][:5]               # 前五条（返回列式 dict）
ds["train"]["question"][:3]   # 某一列
ds["train"].features          # schema
```

::: info

**注意 `ds[0]` 返回的是“一行”，`ds[:5]` 返回的是“列的字典”**，不是行的列表：

```python
ds["train"][:2]
# {'id': ['1','2'], 'question': ['...','...'], ...}   ← 列式
```

这是 Arrow 列式存储的直接体现。要按行遍历就用 `for row in ds["train"]`。

:::

## 底层是 Arrow + 内存映射

```text
磁盘上的 .arrow 文件  ──mmap──►  按需读取，不占内存
```

**这是 `datasets` 最重要的一个特性**：加载一个 100 GB 的数据集，内存占用可能只有几百 MB。数据在磁盘上，用到哪读哪。

代价是**第一次加载要下载并转换成 Arrow 格式**，会花时间和硬盘。

## 流式模式：连硬盘都不占

```python
ds = load_dataset("HuggingFaceFW/fineweb", split="train", streaming=True)

for i, row in enumerate(ds):
    print(row["text"][:100])
    if i >= 2:
        break
```

`streaming=True` 时**边下边用，不落盘**。适用场景：

- 数据集有几 TB（比如 FineWeb），根本存不下
- 只想看几条样本
- 训练时数据量远大于本地硬盘

限制：

| 能 | 不能 |
| --- | --- |
| `map` / `filter` / `shuffle`（缓冲区内） | `len()`（不知道总数） |
| 顺序遍历 | 随机索引 `ds[42]` |
| `take` / `skip` | 精确的多轮 shuffle |

```python
ds.take(100)         # 前 100 条
ds.skip(50).take(10) # 跳过 50 取 10
ds.shuffle(buffer_size=10_000, seed=42)   # 缓冲区内打乱
```

::: warning

**流式的 shuffle 是“缓冲区内打乱”，不是全局打乱。** `buffer_size=10000` 意味着只在滑动的一万条窗口内随机。

如果原数据集有强顺序性（比如按来源排序），缓冲区太小会导致每个 batch 内样本高度同质，影响训练。**buffer 尽量开大**（内存允许的话十万级）。

:::

## 只加载一部分

```python
# 只要训练集
ds = load_dataset("squad", split="train")

# 切片语法
ds = load_dataset("squad", split="train[:1000]")     # 前 1000 条
ds = load_dataset("squad", split="train[:10%]")      # 前 10%
ds = load_dataset("squad", split="train[:80%]+validation")   # 组合
```

**调试时永远先用小切片**——`train[:100]` 能让你在几秒内跑通整条流程，而不是等半小时下载完才发现代码有 bug。

## map：批量处理

```python
def tokenize(batch):
    return tok(batch["text"], truncation=True, max_length=512)

ds = ds.map(tokenize, batched=True, batch_size=1000, num_proc=4)
```

| 参数 | 作用 |
| --- | --- |
| `batched=True` | **一次处理一批，快得多**（tokenizer 支持批量） |
| `num_proc` | 多进程并行 |
| `remove_columns` | 删掉原始列，省空间 |
| `load_from_cache_file=False` | 强制重算（调试时用） |

::: warning

**`batched=True` 时函数收到的是“列的字典”，不是单条记录。**

```python
# ✗ batched=True 下这么写会炸
def f(row):
  return {"len": len(row["text"])}        # row["text"] 是一个 list

# ✓
def f(batch):
  return {"len": [len(t) for t in batch["text"]]}
```

这是 `map` 最常见的错误。不确定就先 `print(type(batch["text"]))` 看一眼。

:::

**`map` 的结果会被缓存**——同样的函数和参数第二次运行是秒回。改了函数逻辑但缓存没失效时（比如函数体变了但签名没变），用 `load_from_cache_file=False` 强制重算。

## filter 与其他常用操作

```python
ds = ds.filter(lambda x: len(x["text"]) > 100)
ds = ds.shuffle(seed=42)
ds = ds.select(range(1000))                    # 取前 1000
ds = ds.train_test_split(test_size=0.1, seed=42)
ds = ds.rename_column("old", "new")
ds = ds.remove_columns(["unused"])
ds = ds.cast_column("image", Image())
```

`train_test_split` 返回一个 `DatasetDict`，含 `train` 和 `test`。

## 本地文件

不必上传到 Hub 也能用：

```python
ds = load_dataset("json", data_files="data.jsonl")
ds = load_dataset("csv", data_files={"train": "tr.csv", "test": "te.csv"})
ds = load_dataset("parquet", data_files="data/*.parquet")

# 一个目录里的图片，按子目录名当标签
ds = load_dataset("imagefolder", data_dir="./photos")
```

从内存中的对象构造：

```python
from datasets import Dataset

ds = Dataset.from_list([{"text": "你好", "label": 1}, {"text": "再见", "label": 0}])
ds = Dataset.from_pandas(df)
ds = Dataset.from_dict({"text": [...], "label": [...]})
```

## 缓存在哪

```text
~/.cache/huggingface/datasets/
```

受 `HF_HOME` 控制（[前面](/manual/llm/huggingface/cli-and-auth)设过的话就在那）。

```python
ds = load_dataset("squad", cache_dir="/data/hf-datasets")
```

::: info

**`datasets` 的缓存可能比模型还大。** 它同时存原始下载文件和转换后的 Arrow 文件，还有每次 `map` 的中间结果。

清理：

```python
ds.cleanup_cache_files()          # 删该数据集的 map 中间产物
```

或者直接删目录。硬盘告急时先看这里，往往能腾出几十 GB。

:::

## 转成训练需要的格式

```python
ds.set_format("torch", columns=["input_ids", "attention_mask", "labels"])
```

之后取出来直接是 tensor，可以喂给 `DataLoader` 或 `Trainer`。

```python
from torch.utils.data import DataLoader
dl = DataLoader(ds["train"], batch_size=8, shuffle=True)
```

## 找数据集

Hub 上按任务和语言筛：[huggingface.co/datasets](https://huggingface.co/datasets)

几个常用的：

| 数据集 | 用途 |
| --- | --- |
| `HuggingFaceFW/fineweb` | 大规模英文网页语料（预训练） |
| `HuggingFaceFW/fineweb-2` | 多语言版本 |
| `BAAI/IndustryInstruction` | 中文指令数据 |
| `tatsu-lab/alpaca` | 经典指令微调数据 |
| `HuggingFaceH4/ultrachat_200k` | 多轮对话 |
| `openai/gsm8k` | 数学推理评测 |
| `cais/mmlu` | 通用知识评测 |

::: warning

**数据集也有许可。** 很多爬取类数据集标注为“仅研究用途”，或包含未授权内容。

用来训练要商用的模型之前，**读一遍数据集卡片的 license 和来源说明**。这块的合规风险比模型许可更容易被忽略。

:::

## 小结

- 底层是 **Arrow + 内存映射**——100 GB 数据集也不占多少内存。
- **`streaming=True` 边下边用不落盘**，代价是不能随机索引、不能 `len()`。
- 流式 shuffle 是**缓冲区内打乱**，buffer 要开大。
- **调试永远先用 `split="train[:100]"`**。
- `map(batched=True)` 时函数收到的是**列的字典**，不是单条——最常见的错误。
- `map` 结果会缓存，改了逻辑没生效就 `load_from_cache_file=False`。
- **datasets 缓存可能比模型还大**，硬盘告急先看这里。
- 商用前查**数据集许可**，这块风险常被忽略。

下一篇：[做自己的数据集](/manual/llm/huggingface/build-your-dataset)。
