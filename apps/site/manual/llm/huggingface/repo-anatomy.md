---
title: "一个模型仓库里有什么"
description: "逐个文件说明它是干什么的、哪些必须下、哪些可以跳过。"
source: "https://daiw.org/manual/huggingface/repo-anatomy"
---

# 一个模型仓库里有什么

> 逐个文件说明它是干什么的、哪些必须下、哪些可以跳过。

打开一个模型的 Files 页，通常有十几到几十个文件。**知道哪些必须下、哪些是重复的，能省掉大量流量和等待时间**——很多仓库同时放了三四套等价的权重。

## 一个典型的 LLM 仓库

```text
Qwen3-8B/
├── config.json                      模型结构定义          ← 必须
├── generation_config.json           默认生成参数          ← 建议
├── model-00001-of-00004.safetensors 权重分片 1            ← 必须
├── model-00002-of-00004.safetensors 权重分片 2            ← 必须
├── model-00003-of-00004.safetensors                      ← 必须
├── model-00004-of-00004.safetensors                      ← 必须
├── model.safetensors.index.json     分片索引              ← 必须
├── tokenizer.json                   分词器（快速版）       ← 必须
├── tokenizer_config.json            分词器配置 + 对话模板  ← 必须
├── chat_template.jinja              独立对话模板（新仓库常见）← 建议
├── vocab.json / merges.txt          分词器（旧格式）       ← 通常可跳过
├── special_tokens_map.json          特殊 token 映射        ← 建议
├── README.md                        Model card            ← 可跳过
├── LICENSE                                                ← 该读，不必下
└── .gitattributes                                         ← 可跳过
```

## 逐个说明

### config.json —— 模型的图纸

```json
{
  "architectures": ["Qwen3ForCausalLM"],
  "hidden_size": 4096,
  "num_hidden_layers": 36,
  "num_attention_heads": 32,
  "num_key_value_heads": 8,
  "vocab_size": 151936,
  "max_position_embeddings": 32768,
  "torch_dtype": "bfloat16"
}
```

`transformers` 靠 `architectures` 决定用哪个类来加载。**没有它，一堆权重就是一堆数字。**

几个能直接读出信息的字段：

| 字段 | 告诉你 |
| --- | --- |
| `num_hidden_layers` × `hidden_size` | 大致的参数规模 |
| `num_key_value_heads` < `num_attention_heads` | 用了 GQA，KV cache 更省显存 |
| `max_position_embeddings` | 原生上下文长度 |
| `torch_dtype` | 权重的原始精度 |

::: warning

**`architectures` 是新架构的第一道坎。** 如果模型用了你本地 `transformers` 版本还不认识的架构，加载时会报：

```text
KeyError: 'xxxForCausalLM'
```

两种解法：升级 `transformers`（首选），或者模型仓库带了自定义代码时加 `trust_remote_code=True`。

后者要谨慎——**它会执行仓库里的 Python 代码**。只对你信任的组织开。

:::

### 权重文件

同一份权重经常有多种格式并存：

| 文件名 | 格式 | 要不要下 |
| --- | --- | --- |
| `*.safetensors` | safetensors | ✅ **首选** |
| `pytorch_model*.bin` | PyTorch pickle | ❌ 有 safetensors 就跳过 |
| `*.gguf` | GGUF（llama.cpp） | 走 [GGUF 路线](/manual/llm/huggingface/gguf-llamacpp-ollama)时才要 |
| `*.onnx` | ONNX | 用 ONNX Runtime 时才要 |
| `tf_model.h5` / `flax_model.msgpack` | TensorFlow / Flax | 基本可以无视 |

**一个仓库同时有 `.safetensors` 和 `.bin` 是常态**——它们内容等价，下一套就够。全下等于白白多花一倍流量。怎么只下需要的，见[下载](/manual/llm/huggingface/downloading)。

格式之间的差异见[下一篇](/manual/llm/huggingface/weight-formats)。

### 分片与索引

模型大了会切片：

```text
model-00001-of-00004.safetensors
model.safetensors.index.json      ← 记录哪个张量在哪个分片
```

**索引文件必须下**，否则 `transformers` 不知道去哪找参数。它很小（几十 KB），但漏了就加载失败：

```text
OSError: Error no file named model.safetensors found
```

### tokenizer 相关

```text
tokenizer.json            ← 必须。快速分词器，一个文件搞定
tokenizer_config.json     ← 必须。含配置与内嵌 chat_template
chat_template.jinja       ← 建议。许多 2025–2026 新仓库将对话模板拆为独立 .jinja 文件
special_tokens_map.json   ← 建议
vocab.json + merges.txt   ← 旧格式，有 tokenizer.json 就不需要
```

::: info

**`tokenizer_config.json`（或独立的 `chat_template.jinja`）里的 `chat_template` 是对话模型的关键。**

它是一段 Jinja 模板，规定“怎么把多轮对话拼成模型见过的格式”：

```python
messages = [{"role": "user", "content": "你好"}]
text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
```

**不用它、自己拼字符串，是聊天模型效果差的头号原因**——模型训练时见的是特定格式，你拼错了它就答得不对劲。过滤下载时记得把 `*.jinja` 也放进白名单。

:::

### generation_config.json

```json
{
  "temperature": 0.7,
  "top_p": 0.8,
  "top_k": 20,
  "repetition_penalty": 1.05,
  "eos_token_id": [151645, 151643]
}
```

模型作者推荐的采样参数。**值得下**——尤其 `eos_token_id`，配错了模型会停不下来，一直生成到 `max_new_tokens` 为止。

## 怎么估算下载量

Files 页面会显示每个文件的大小。快速心算规则：

```text
参数量 × 每参数字节数 = 权重大小

fp32   4 字节/参数    7B → 28 GB
fp16   2 字节/参数    7B → 14 GB   ← 最常见
int8   1 字节/参数    7B →  7 GB
int4   0.5 字节/参数  7B →  3.5 GB
```

**看到一个 7B 模型的仓库有 28 GB，多半是同时放了 fp16 的 safetensors 和 bin 两套**（14 + 14），而不是它真有那么大。

## 其他常见文件

| 文件 | 说明 |
| --- | --- |
| `adapter_config.json` + `adapter_model.safetensors` | **这是 LoRA 适配器**，不是完整模型——必须配合基座模型用（见[微调](/manual/llm/huggingface/finetune-lora)） |
| `preprocessor_config.json` | 图像 / 音频模型的预处理参数 |
| `model.safetensors.index.json` | 分片索引 |
| `quantization_config` (在 config.json 里) | 该权重已量化，加载需对应库（bitsandbytes / AWQ / GPTQ） |
| `*.gguf` | llama.cpp 格式，通常在单独的 `-GGUF` 仓库里 |

::: warning

**看到只有 `adapter_model.safetensors`（几十 MB）就以为“这模型好小”，是常见误会。**

那是 **LoRA 适配器**——只有微调出来的增量参数，必须和基座模型一起用：

```python
from peft import PeftModel
base = AutoModelForCausalLM.from_pretrained("Qwen/Qwen3-8B")
model = PeftModel.from_pretrained(base, "someone/my-lora")
```

基座是哪个？看 `adapter_config.json` 的 `base_model_name_or_path`。

:::

## 快速判断一个仓库

打开 Files 页，按这个顺序看：

1. **有没有 `config.json`** —— 没有多半不是标准 transformers 模型。
2. **权重是什么格式** —— safetensors 优先；只有 `.gguf` 说明是量化版，走 llama.cpp。
3. **总大小** —— 对照上面的换算，判断自己下不下得动、跑不跑得动。
4. **有没有 `adapter_config.json`** —— 有的话这是 LoRA，还得下基座。
5. **`config.json` 里有没有 `quantization_config`** —— 有的话加载需要额外的库。

## 小结

- `config.json` 是图纸，**`architectures` 决定能不能加载**；新架构要升 `transformers`。
- 权重优先 **safetensors**，同仓库的 `.bin` 是等价重复，别都下。
- **分片索引 `*.index.json` 必须下**，漏了会报“找不到文件”。
- `tokenizer_config.json` 或 `chat_template.jinja` 里的 **`chat_template` 决定对话效果**，别自己拼字符串。
- `generation_config.json` 里的 **`eos_token_id`** 配错会让模型停不下来。
- **只有 adapter 文件 = LoRA 适配器**，得配基座模型。

下一篇：[权重格式](/manual/llm/huggingface/weight-formats)。
