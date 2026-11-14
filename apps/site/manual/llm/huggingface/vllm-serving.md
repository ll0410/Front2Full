---
title: "vLLM 服务化"
description: "连续批处理与 PagedAttention 为什么快、关键启动参数、以及什么时候不该用它。"
source: "https://daiw.org/manual/huggingface/vllm-serving"
---

# vLLM 服务化

> 连续批处理与 PagedAttention 为什么快、关键启动参数、以及什么时候不该用它。

有显卡、要对外提供服务、有并发——这时候该上 vLLM。它相对 [transformers](/manual/llm/huggingface/transformers-serving) 的吞吐提升通常在一个数量级。

## 快在哪

两个核心机制：

### 连续批处理（continuous batching）

```text
朴素批处理：等一批凑齐 → 一起跑 → 全部跑完才收下一批
              ██████░░░░░░   短请求跑完了，GPU 空转等长的

连续批处理：谁跑完谁走，空位立刻补新请求
              ██████████████  GPU 始终满载
```

生成任务的长度差异极大（有的 10 个 token，有的 2000 个）。**朴素批处理会被最长的那个拖死**，连续批处理不会。

### PagedAttention

把 KV cache 按“页”管理，像操作系统的虚拟内存。

传统做法要为每个请求**预留最大长度**的连续显存——实际只用了 10%，剩下 90% 白占着。PagedAttention 按需分页分配，**显存利用率能提升数倍**，同样的卡能扛更多并发。

## 起一个服务

```bash
pip install vllm
```

```bash
vllm serve Qwen/Qwen3-8B
```

默认监听 `http://localhost:8000`，提供 **OpenAI 兼容接口**：

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="EMPTY")
r = client.chat.completions.create(
    model="Qwen/Qwen3-8B",
    messages=[{"role": "user", "content": "你好"}],
)
print(r.choices[0].message.content)
```

`api_key` 随便填——除非你启动时设了 `--api-key`。

## 关键参数

```bash
vllm serve Qwen/Qwen3-8B \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90 \
  --tensor-parallel-size 1 \
  --dtype auto
```

| 参数 | 作用 | 建议 |
| --- | --- | --- |
| `--max-model-len` | 最大上下文 | **按实际需要设，别用模型上限** |
| `--gpu-memory-utilization` | 允许占用显存的比例 | 默认 0.9；独占卡可到 0.95 |
| `--tensor-parallel-size` | 用几张卡切分模型 | 单卡装不下时设为卡数 |
| `--quantization` | `awq` / `gptq` / `fp8` | 加载量化模型 |
| `--max-num-seqs` | 最大并发序列数 | 显存紧时调小 |
| `--enable-prefix-caching` | 复用相同前缀的 KV | **系统提示固定时收益很大** |

::: warning

**`--max-model-len` 是最容易搞出 OOM 的参数。**

vLLM 启动时会按这个值**预分配 KV cache 池**。模型标称支持 128K，你不设就按 128K 分配——一张 24 G 卡装完 8B 权重后根本剩不下那么多，直接启动失败：

```text
ValueError: The model's max seq len (131072) is larger than the maximum number of
tokens that can be stored in KV cache (23120).
```

**按你真正需要的长度设**。绝大多数场景 8192 足够，能省出大量显存给并发。

:::

## prefix caching 值得单独说

```bash
vllm serve Qwen/Qwen3-8B --enable-prefix-caching
```

如果你的请求都带着同一段长系统提示（RAG 的检索结果、固定的 few-shot 示例），**这段前缀的 KV 只算一次，之后所有请求复用**。

::: info

**收益与前缀占比成正比。** 系统提示 2000 token、用户问题 50 token 的场景，开启后首 token 延迟能降一大截。

纯短对话场景收益不大，但**开着也没坏处**——它只在命中时才省，不命中就是正常流程。

:::

## 离线批量推理

不起服务，直接在 Python 里批处理：

```python
from vllm import LLM, SamplingParams

llm = LLM(model="Qwen/Qwen3-8B", max_model_len=4096)
params = SamplingParams(temperature=0.7, top_p=0.8, max_tokens=512)

prompts = ["解释一下 GQA", "解释一下 MoE", "解释一下 RoPE"]
outputs = llm.generate(prompts, params)

for o in outputs:
    print(o.outputs[0].text)
```

**这是跑评测、批量标数据的最佳方式**——一次性喂几千条，vLLM 自己排队调度，比循环调 API 快得多。

用对话模板：

```python
messages = [[{"role": "user", "content": p}] for p in prompts]
outputs = llm.chat(messages, params)
```

## 多卡

```bash
# 单机 4 卡，模型切成 4 份
vllm serve Qwen/Qwen3-72B --tensor-parallel-size 4
```

**`--tensor-parallel-size` 必须能整除注意力头数**，否则报错。常见值 1/2/4/8。

单卡装得下时**不要开多卡**——张量并行有通信开销，反而更慢。它是为了“装不下”而不是“跑更快”。

## 什么时候不该用 vLLM

| 场景 | 用什么 |
| --- | --- |
| 没有 NVIDIA 显卡 | [llama.cpp / Ollama](/manual/llm/huggingface/gguf-llamacpp-ollama) |
| 单人本地用，无并发 | Ollama（省事得多） |
| 要微调 | [transformers + peft](/manual/llm/huggingface/finetune-lora) |
| 冷门 / 极新架构 | transformers（vLLM 支持有滞后） |
| 显存很小（< 8 G） | GGUF 路线 |

::: warning

**vLLM 的启动很慢**（要加载权重 + 预分配 KV cache + 编译 CUDA graph），一次几十秒到几分钟。

它是为**长期运行的服务**设计的。如果你的场景是“跑一次脚本就退出”，启动开销可能比推理本身还长——那种情况用 transformers 或 Ollama 更合适。

:::

## 与 transformers 的取舍

| | transformers | vLLM |
| --- | --- | --- |
| 并发吞吐 | 串行，低 | **高一个数量级** |
| 启动速度 | 快 | 慢 |
| 显存效率 | 一般 | **PagedAttention，高** |
| 架构覆盖 | **最全** | 主流架构 |
| 能训练 | ✅ | ❌ |
| 上手 | 简单 | 中等 |

**判据：要不要同时服务多个请求？** 要 → vLLM；不要 → transformers 或 Ollama。

## 生产部署要点

```bash
vllm serve Qwen/Qwen3-8B \
  --host 0.0.0.0 --port 8000 \
  --api-key "$VLLM_API_KEY" \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.92 \
  --enable-prefix-caching \
  --served-model-name my-model
```

- **`--api-key`** 一定要设，否则任何人都能调你的 GPU。
- **`--served-model-name`** 让客户端用简短名字，换底层模型时不用改客户端代码。
- 监控端点：`/metrics`（Prometheus 格式），能看吞吐、排队长度、KV cache 使用率。

## 小结

- vLLM 快在**连续批处理**（不被最长请求拖死）与 **PagedAttention**（显存按需分页）。
- **`--max-model-len` 别用模型上限**——它决定 KV cache 预分配量，是 OOM 头号原因。
- 系统提示长而固定时，**`--enable-prefix-caching` 收益显著**。
- 离线批量推理用 `LLM.generate` / `LLM.chat`，比循环调 API 快得多。
- 单卡装得下就**别开张量并行**。
- **启动慢**，适合长期服务，不适合跑完就退出的脚本。
- 生产环境**必须设 `--api-key`**。

下一篇：[经典模型清单](/manual/llm/huggingface/classic-models)。
