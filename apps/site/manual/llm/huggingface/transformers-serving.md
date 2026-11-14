---
title: "用 transformers 跑起来"
description: "from_pretrained 的关键参数、device_map、量化加载、流式输出与常见报错。"
source: "https://daiw.org/manual/huggingface/transformers-serving"
---

# 用 transformers 跑起来

> from_pretrained 的关键参数、device_map、量化加载、流式输出与常见报错。

`transformers` 是很通用的一条路：**能跑几乎所有架构、能训练、能接进任意 Python 代码**。代价是推理吞吐不如 [vLLM](/manual/llm/huggingface/vllm-serving)，单文件便携性不如 [GGUF](/manual/llm/huggingface/gguf-llamacpp-ollama)。

## 最小可用

```bash
pip install transformers torch accelerate
```

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL = "Qwen/Qwen3-8B"

tok = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForCausalLM.from_pretrained(
    MODEL,
    dtype="auto",          # transformers v5 推荐写法（旧名 torch_dtype="auto" 仍兼容）
    device_map="auto",
)

messages = [{"role": "user", "content": "用一句话解释什么是 KV cache"}]
text = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tok(text, return_tensors="pt").to(model.device)

out = model.generate(**inputs, max_new_tokens=256)
print(tok.decode(out[0][inputs.input_ids.shape[1]:], skip_special_tokens=True))
```

两处细节值得注意：

::: warning

**① 必须用 `apply_chat_template`。** 对话模型训练时见的是特定格式（含角色标记、特殊 token），自己拼 `f"User: {q}\nAssistant:"` 会让效果明显变差——模型没见过这种格式。

**② 解码时要切掉输入部分。** `model.generate` 返回的是“输入 + 输出”的完整序列，直接 decode 会把你的提问也打印出来。`out[0][inputs.input_ids.shape[1]:]` 就是在切掉输入。

:::

## from_pretrained 的关键参数

### dtype（或 `torch_dtype`）

```python
dtype="auto"          # ✅ 读 config.json 里的原始精度（transformers v5 首选，torch_dtype="auto" 兼容）
dtype=torch.bfloat16  # 显式指定
```

**不指定时在旧版里可能回落到 fp32**——一个 8B 模型会占 32 GB 而不是 16 GB，这是新手常见的 OOM 原因。

**永远写 `dtype="auto"`**（若需兼容 `transformers < 4.56` 的老环境则写 `torch_dtype="auto"`），除非你有明确理由覆盖。

### device_map

```python
device_map="auto"     # 自动分配到可用设备，装不下的放 CPU
device_map="cuda:0"   # 全放 0 号卡
device_map="cpu"      # 全 CPU
```

`"auto"` 需要 `accelerate`。多卡时它会自动切分模型层。

精细控制：

```python
model = AutoModelForCausalLM.from_pretrained(
    MODEL,
    dtype="auto",
    device_map="auto",
    max_memory={0: "10GiB", 1: "20GiB", "cpu": "32GiB"},
)
```

::: info

**`max_memory` 里给单卡留点余量。** 写 `{0: "24GiB"}` 在 24 G 卡上几乎必然 OOM——权重之外还有 KV cache 和激活。

经验值：**按显存的 80% 写**。24 G 卡写 `"19GiB"`。

:::

### attn_implementation

```python
model = AutoModelForCausalLM.from_pretrained(
    MODEL,
    dtype="auto",
    device_map="auto",
    attn_implementation="flash_attention_2",   # 需要 pip install flash-attn
)
```

| 值 | 说明 |
| --- | --- |
| `"eager"` | 朴素实现，兼容性好 |
| `"sdpa"` | PyTorch 内置，**默认，通常够用** |
| `"flash_attention_2"` | 速度快且省显存，但要单独安装且**只支持 Ampere+ 与 fp16/bf16** |

长上下文场景 FlashAttention 收益明显（显存和速度都有），短对话差别不大。

## 量化加载

显存不够时，两行代码开 4bit：

```bash
pip install bitsandbytes
```

```python
from transformers import BitsAndBytesConfig
import torch

bnb = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

model = AutoModelForCausalLM.from_pretrained(MODEL, quantization_config=bnb, device_map="auto")
```

| 参数 | 作用 |
| --- | --- |
| `bnb_4bit_quant_type="nf4"` | NF4 比 fp4 质量好，**默认选它** |
| `bnb_4bit_compute_dtype=bfloat16` | 计算时反量化到 bf16，**不设会用 fp32 拖慢速度** |
| `bnb_4bit_use_double_quant=True` | 对量化常数再量化，**额外省约 0.4 GB** |

::: warning

**bitsandbytes 的 4bit 是“省显存”不是“提速”。** 它在推理时要实时反量化，速度**通常比 bf16 慢**。

它真正的价值在 **QLoRA 微调**——让 16 G 卡能微调 8B 模型（见[微调](/manual/llm/huggingface/finetune-lora)）。

纯推理想要又省又快，用 **AWQ / GPTQ 预量化模型**（Hub 上搜 `-AWQ` 后缀），它们是为推理优化的。

:::

加载预量化模型不需要额外配置：

```python
# 仓库里的 config.json 已含 quantization_config
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen3-8B-AWQ", device_map="auto")
```

## 流式输出

一次性等完再返回，体验很差。用 streamer：

```python
from transformers import TextIteratorStreamer
from threading import Thread

streamer = TextIteratorStreamer(tok, skip_prompt=True, skip_special_tokens=True)

thread = Thread(target=model.generate, kwargs=dict(
    **inputs, max_new_tokens=512, streamer=streamer,
))
thread.start()

for token in streamer:
    print(token, end="", flush=True)
```

**`generate` 必须在另一个线程里跑**——`TextIteratorStreamer` 的迭代会阻塞，同线程会死锁。

`skip_prompt=True` 省掉了手动切输入的步骤。

## 生成参数

```python
out = model.generate(
    **inputs,
    max_new_tokens=512,
    do_sample=True,
    temperature=0.7,
    top_p=0.8,
    repetition_penalty=1.05,
)
```

::: info

**不确定填什么，就什么都别填**——模型仓库的 `generation_config.json` 里有作者推荐值，`generate` 会自动读取。

自己乱设反而更差。要确定性输出（测试、评测）才显式关采样：

```python
out = model.generate(**inputs, do_sample=False, max_new_tokens=512)
```

:::

## 包成一个服务

`transformers` 没有内置高并发服务器，配 FastAPI 二十行搞定：

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Req(BaseModel):
    prompt: str
    max_new_tokens: int = 256

@app.post("/generate")
def generate(r: Req):
    msgs = [{"role": "user", "content": r.prompt}]
    text = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
    inputs = tok(text, return_tensors="pt").to(model.device)
    out = model.generate(**inputs, max_new_tokens=r.max_new_tokens)
    return {"text": tok.decode(out[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)}
```

::: warning

**这个服务只适合自用或低并发。** `transformers` 的 `generate` 是**逐请求串行**的——没有连续批处理，第二个请求要等第一个跑完。

并发一上来就该换 [vLLM](/manual/llm/huggingface/vllm-serving)，它的吞吐能高一个数量级。

:::

## 常见报错

| 报错 | 原因与解法 |
| --- | --- |
| `CUDA out of memory` | 没写 `dtype="auto"` / `torch_dtype="auto"`（回落到 fp32）；或上下文太长；或该量化了 |
| `KeyError: 'xxxForCausalLM'` | `transformers` 版本旧 → 升级；或需 `trust_remote_code=True` |
| 输出重复啰嗦停不下来 | `eos_token_id` 不对 → 确认下了 `generation_config.json` |
| 输出乱码 / 答非所问 | **没用 `apply_chat_template`** |
| 输出里带着你的提问 | 忘了切 `inputs.input_ids.shape[1]:` |
| `ValueError: Tokenizer class ... does not exist` | tokenizer 文件没下全 |
| 极慢（几秒一个 token） | 模型跑在 CPU 上了 → 检查 `model.device` |

**排查第一步永远是：**

```python
print(model.device, model.dtype)
print(f"{torch.cuda.memory_allocated()/1e9:.2f} GB")
```

## 小结

- **`dtype="auto"`（或 `torch_dtype="auto"`）必写**——避免回落到 fp32 导致显存翻倍。
- **`apply_chat_template` 必用**，自己拼字符串效果差。
- **解码要切掉输入部分**。
- `device_map="auto"` + `max_memory` 按显存 **80%** 写。
- bitsandbytes 4bit **省显存但不提速**，推理提速要用 AWQ/GPTQ。
- 流式输出的 **`generate` 要放另一个线程**。
- 生成参数**不确定就别填**，让它读 `generation_config.json`。
- `transformers` 的服务**串行处理请求**，并发场景换 vLLM。

下一篇：[GGUF 路线](/manual/llm/huggingface/gguf-llamacpp-ollama)。
