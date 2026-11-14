---
title: "GGUF 路线：llama.cpp 与 Ollama"
description: "纯 CPU 也能跑大模型的路子——GGUF 下载、llama.cpp 参数调优、Ollama 导入自定义模型。"
source: "https://daiw.org/manual/huggingface/gguf-llamacpp-ollama"
---

# GGUF 路线：llama.cpp 与 Ollama

> 纯 CPU 也能跑大模型的路子——GGUF 下载、llama.cpp 参数调优、Ollama 导入自定义模型。

这是**没有显卡也能跑大模型**的路线，也是 Mac 用户的首选。核心是 [GGUF 格式](/manual/llm/huggingface/weight-formats)：单文件、自包含、CPU 优化。

## 两个工具的关系

```text
llama.cpp   底层推理引擎（C++），参数全、性能出色、上手稍麻烦
    │
    └── Ollama   在它之上包了一层：模型管理 + REST API + 开箱即用
```

**新手从 Ollama 起步，要精细控制再下到 llama.cpp。**

## Ollama：三条命令跑起来

```bash
# 安装（macOS / Linux）
curl -fsSL https://ollama.com/install.sh | sh
```

```bash
ollama run qwen3:8b
```

首次运行自动下载，之后直接进对话。**就这么简单。**

```bash
ollama list          # 已下载的模型
ollama ps            # 正在跑的
ollama rm qwen3:8b   # 删除
```

### 用 Hub 上的 GGUF

Ollama 官方库里没有的模型，可以直接拉 Hub 上的 GGUF：

```bash
ollama run hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M
```

格式是 `hf.co/<用户>/<仓库>:<量化档>`。**这条命令覆盖了 Hub 上绝大多数 GGUF 仓库**，不用手动下载再导入。

### 手动导入本地 GGUF

已经用 [`hf download`](/manual/llm/huggingface/downloading) 下好了文件：

```bash
hf download unsloth/Qwen3-8B-GGUF \
  --include "*Q4_K_M*" --local-dir ./models
```

```text
# Modelfile
FROM ./models/Qwen3-8B-Q4_K_M.gguf

PARAMETER temperature 0.7
PARAMETER top_p 0.8
PARAMETER num_ctx 8192

SYSTEM """你是一个简洁的技术助手。"""
```

```bash
ollama create my-qwen -f Modelfile
ollama run my-qwen
```

### OpenAI 兼容接口

```bash
curl http://localhost:11434/v1/chat/completions -H "Content-Type: application/json" -d '{
  "model": "qwen3:8b",
  "messages": [{"role": "user", "content": "你好"}]
}'
```

**这是 Ollama 最实用的一点**——现有的 OpenAI SDK 代码改一个 base_url 就能用：

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
r = client.chat.completions.create(model="qwen3:8b", messages=[{"role": "user", "content": "你好"}])
print(r.choices[0].message.content)
```

::: warning

**Ollama 默认上下文只有 4096（部分版本 2048）**，比模型本身支持的短很多。喂长文档会被**静默截断**——不报错，只是模型看不到前面的内容。

```bash
# Modelfile 里设
PARAMETER num_ctx 32768
```

或者环境变量 `OLLAMA_CONTEXT_LENGTH=32768`。

“模型好像忘了我前面说的”——先查这个。

:::

## llama.cpp：要控制就用它

```bash
# macOS
brew install llama.cpp

# 或从源码编译（能开各种加速后端）
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp && cmake -B build && cmake --build build -j
```

### 直接跑 Hub 上的模型

```bash
llama-cli -hf unsloth/Qwen3-8B-GGUF:Q4_K_M -p "你好"
```

`-hf` 会自动从 Hub 下载并缓存。

### 起一个服务

```bash
llama-server -hf unsloth/Qwen3-8B-GGUF:Q4_K_M \
  --host 0.0.0.0 --port 8080 \
  -c 8192 \
  -ngl 99
```

同样提供 OpenAI 兼容接口（`http://localhost:8080/v1`），还自带一个网页聊天界面。

### 关键参数

| 参数 | 作用 | 怎么设 |
| --- | --- | --- |
| `-ngl N` | **放多少层到 GPU** | 显存够就 `99`（全放）；不够就调小 |
| `-c N` | 上下文长度 | 按需，越大越吃内存 |
| `-t N` | CPU 线程数 | 通常设为**物理核心数**，不是逻辑核心数 |
| `-b N` | 批大小 | 默认够用 |
| `--mlock` | 锁定内存不被交换 | 内存充裕时开，防止卡顿 |
| `-fa` | FlashAttention | 支持就开，省内存 |

::: info

**`-ngl` 是这条路线上最重要的一个旋钮。**

它决定多少层跑在 GPU 上。哪怕只有 4 G 显存，把 15 层放上去也能显著提速——**不是“有没有显卡”的二元选择，而是连续的**。

怎么定 N：从 `-ngl 99` 开始试，OOM 就往下调（99 → 40 → 30 → 20）。llama.cpp 启动时会打印每层的显存占用，据此估算。

Apple Silicon 上直接 `-ngl 99`——统一内存，全放“GPU”没有拷贝开销。

:::

### 线程数的坑

```bash
-t 8      # 8 物理核就写 8
```

**别写逻辑核心数**（超线程后的数字）。llama.cpp 是计算密集型，超线程带来的收益接近于零，反而增加调度开销。写成物理核心数通常最快。

## 性能预期

一个 8B Q4_K_M 模型的大致生成速度（token/s）：

| 硬件 | 速度 |
| --- | --- |
| 纯 CPU（现代 8 核桌面） | 5~12 |
| Apple M2/M3（统一内存） | 20~40 |
| RTX 3060 12G（全放 GPU） | 50~80 |
| RTX 4090 | 100+ |

::: info

**纯 CPU 的 5~10 token/s 是什么概念？** 大约是正常人阅读速度的一半到持平。**做交互式问答完全可用**，做批量处理就太慢了。

内存带宽是 CPU 推理的瓶颈——**双通道比单通道能快接近一倍**。笔记本插满两条内存条，收益可能比换 CPU 还大。

:::

## 什么时候选这条路

| 选它 | 不选它 |
| --- | --- |
| 没有独显 / 显存很小 | 有大显存且追求吞吐 → [vLLM](/manual/llm/huggingface/vllm-serving) |
| Mac（尤其 Apple Silicon） | 需要微调 → GGUF **不能训练** |
| 要便携（拷一个文件走） | 需要非文本模型（多数视觉模型不支持） |
| 本地隐私场景 | 需要最新架构（GGUF 转换有滞后） |

## 从 safetensors 转 GGUF

微调完想在 CPU 上跑，需要自己转：

```bash
cd llama.cpp
python convert_hf_to_gguf.py /path/to/merged-model --outfile model-f16.gguf --outtype f16
```

```bash
# 再量化
./build/bin/llama-quantize model-f16.gguf model-Q4_K_M.gguf Q4_K_M
```

**注意先合并 LoRA**——适配器不能单独转，要先 `merge_and_unload()`（见[微调](/manual/llm/huggingface/finetune-lora)）。

## 常见问题

| 现象 | 原因 |
| --- | --- |
| 下了一堆文件，几十 G | GGUF 仓库没加 `--include` 过滤量化档 |
| 模型“忘了”前面的对话 | 上下文太短（Ollama 默认 4096） |
| 加载报 `unknown model architecture` | llama.cpp 版本旧，不认识新架构 → 升级 |
| GPU 没被用上 | 编译时没开对应后端（CUDA/Metal）；或 `-ngl` 没设 |
| 速度突然变很慢 | 内存不够开始换页 → 减小 `-c` 或换更小量化 |

## 小结

- **Ollama 起步，llama.cpp 精调。**
- `ollama run hf.co/<用户>/<仓库>:<量化档>` 能直接跑 Hub 上的 GGUF。
- **Ollama 默认上下文只有 4096**，长文档会被静默截断——记得设 `num_ctx`。
- **`-ngl` 是连续旋钮**，小显存也能放几层上去提速。
- `-t` 设**物理核心数**，不是逻辑核心数。
- 纯 CPU 8B Q4 约 **5~10 token/s**，交互式够用；内存带宽是瓶颈。
- **GGUF 不能训练**；微调完要转回来得先合并 LoRA。

下一篇：[vLLM 服务化](/manual/llm/huggingface/vllm-serving)。
