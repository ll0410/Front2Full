---
title: "权重格式"
description: "safetensors 与 pickle 的安全差异、GGUF 是什么、以及各种量化格式怎么选。"
source: "https://daiw.org/manual/huggingface/weight-formats"
---

# 权重格式

> safetensors 与 pickle 的安全差异、GGUF 是什么、以及各种量化格式怎么选。

同一个模型在 Hub 上常有四五种格式。选错了要么下白工，要么跑不起来。这一篇把它们的关系理清。

## 两个正交的维度

```text
          序列化格式                   数值精度
   ┌──────────────────────┐   ×   ┌────────────────────┐
   │ safetensors / .bin   │       │ fp32 / bf16 / fp16 │
   │ GGUF / ONNX          │       │ fp8 / int8 / int4  │
   └──────────────────────┘       └────────────────────┘
        “文件怎么存”                “数字有多精细”
```

**这两件事经常被混为一谈**。“GGUF”是格式，“Q4_K_M”是量化方案，一个 GGUF 文件里可以是 fp16 也可以是 int4。

## 序列化格式

### safetensors —— 默认选它

```text
[8 字节 header 长度][JSON header][紧密排列的张量数据]
```

设计目标只有两个：**安全**与**快**。

| 特性 | 说明 |
| --- | --- |
| **不执行代码** | 纯数据格式，加载时不可能运行任何东西 |
| **零拷贝加载** | 可以 mmap，大模型加载明显更快 |
| **可部分读取** | 能只读某几个张量而不加载整个文件 |

### pytorch_model.bin —— 能避就避

它是 Python `pickle`。**pickle 在反序列化时会执行代码**——这不是 bug，是设计。

```python
# 一个恶意的 .bin 文件可以在你 load 的瞬间做任何事
torch.load("innocent_looking.bin")     # 可能已经中招
```

::: warning

**这不是理论风险。** Hub 上出现过投毒的 pickle 权重，HuggingFace 因此专门做了扫描（模型页会显示 pickle 安全扫描结果）。

实践纪律：

1. **有 safetensors 就绝不下 `.bin`。**
2. 万不得已要加载 `.bin`，用 `torch.load(..., weights_only=True)`（PyTorch 2.6+ 已默认如此）。
3. 来源不明的仓库，**别碰 pickle 权重**。

这也是 safetensors 被造出来的全部原因。

:::

### GGUF —— llama.cpp 生态

单文件、自包含（权重 + tokenizer + 元数据全在一个文件里），为 **CPU / Apple Silicon 推理**优化。

```text
Qwen3-8B-Q4_K_M.gguf     ← 一个文件，拷走就能跑
```

特点：

- **一个文件搞定**，不用管分片索引和 tokenizer 配置。
- **CPU 上快**，支持部分层卸载到 GPU（`-ngl`）。
- 通常由社区转换，常见发布者：`unsloth`、`bartowski`、`Qwen` 官方等。
- **训练用不了**——它是纯推理格式。

用法见 [GGUF 路线](/manual/llm/huggingface/gguf-llamacpp-ollama)。

### 其他

| 格式 | 用途 |
| --- | --- |
| **ONNX** | 跨框架部署、ONNX Runtime、移动端 |
| **MLX** | Apple Silicon 专用（`mlx-community/` 下有很多） |
| **TensorRT-LLM engine** | NVIDIA 极致推理性能，需自己编译 |

## 数值精度

### 未量化

| dtype | 字节/参数 | 说明 |
| --- | --- | --- |
| `float32` | 4 | 训练主权重精度，推理很少用 |
| `float16` | 2 | 老卡（Turing 之前）用它 |
| **`bfloat16`** | 2 | **现在的事实标准**，动态范围大，不易溢出 |

**fp16 与 bf16 都是 2 字节，但 bf16 更稳**——它牺牲精度换指数范围，训练时不容易出 NaN。Ampere（RTX 30 系）及以后的卡都支持。

```python
# transformers v5 推荐用 dtype="auto"（旧名 torch_dtype="auto" 仍兼容）
model = AutoModelForCausalLM.from_pretrained("org/model", dtype="auto")
```

`"auto"` 会读 `config.json` 里的原始精度配置，**这是最省心的写法**——比自己写死 `torch.float16` 好。

### 量化

把权重压到更少的位数，用精度换显存。

| 方案 | 位数 | 特点 |
| --- | --- | --- |
| **bitsandbytes NF4** | 4 | `transformers` 里加两行就能用，**微调（QLoRA）必备** |
| **GPTQ** | 4 / 8 | 需要校准数据，推理快 |
| **AWQ** | 4 | 激活感知，同位数下质量常优于 GPTQ |
| **FP8 / MXFP4（原生量化）** | 8 / 4 | 2025–2026 大模型常用，需 Ada/Hopper（FP8）或 Blackwell（FP4/MXFP4）硬件配合 vLLM/SGLang |
| **GGUF Q4_K_M 等** | 混合 | llama.cpp 生态，**CPU 友好** |

::: info

**GGUF 的量化命名怎么读：**

```text
Q4_K_M
│ │ └── 尺寸档：S（小）/ M（中）/ L（大）
│ └──── K-quant 方法（比老的 Q4_0 质量好）
└────── 4 bit
```

**不知道选哪个就选 `Q4_K_M`**——它是体积与质量平衡得极好的一档，社区默认推荐。

显存充裕想要更好质量：`Q5_K_M` 或 `Q6_K`。极度受限：`Q3_K_M` 或带重要性矩阵校准的 `IQ4_XS`，但更低位数质量下降开始明显。**`Q2` 系一般不值得**——省下的显存不多，质量损失很大。

:::

### 量化损失有多大

粗略经验：

```text
bf16  →  Q8 / FP8  几乎无损
      →  Q6_K      损失很小
      →  Q5_K_M    轻微
      →  Q4_K_M    可察觉但通常可接受   ← 甜点
      →  Q3_K      明显
      →  Q2_K      严重
```

**模型越大，量化越抗损。** 70B 的 Q4 常常比 8B 的 bf16 更好用——**同样的显存下，优先选“更大的模型 + 更狠的量化”**，这是社区反复验证过的经验。

## 怎么选

```text
你的目标是？
├── 在 GPU 上跑推理
│   ├── 显存够 → safetensors + bf16（或 Hopper/Blackwell 上用 FP8）
│   └── 显存紧 → safetensors + AWQ/GPTQ 4bit，或 GGUF
├── 在 CPU / Mac 上跑 → GGUF（Q4_K_M 起步） or MLX（Mac）
├── 要微调 → safetensors + bf16（QLoRA 时配 bitsandbytes 4bit）
└── 要部署成服务、追吞吐 → safetensors + AWQ/FP8，配 vLLM
```

::: warning

**GGUF 不能用来训练。** 想微调就必须下原始的 safetensors 权重——见到有人下了 GGUF 再问“怎么微调”，答案是重新下。

反过来，微调完想在 CPU 上跑，需要**合并 LoRA 后转换成 GGUF**（llama.cpp 仓库里有 `convert_hf_to_gguf.py`）。

:::

## 一个实际的例子

同一个 8B 模型，四种选择的对比：

| 选择 | 体积 | 能跑的硬件 | 质量 |
| --- | --- | --- | --- |
| safetensors bf16 | ~16 GB | 24 G 显卡 | 基准 |
| AWQ 4bit | ~5.5 GB | 8 G 显卡 | 轻微下降 |
| GGUF Q4_K_M | ~5 GB | **纯 CPU 也行**（慢） | 轻微下降 |
| GGUF Q8_0 | ~8.5 GB | CPU / 小显卡 | 几乎无损 |

**8 G 显卡跑 8B 模型，靠的就是量化。** 具体选型见[按显存选模型](/manual/llm/huggingface/choose-by-vram)。

## 小结

- **格式与精度是两个维度**，别混为一谈。
- **safetensors 优先**——pickle（`.bin`）加载时会执行代码，是真实风险。
- **GGUF 是单文件推理格式**，CPU/Mac 首选，**不能训练**。
- dtype 写 **`dtype="auto"`**（或兼容写法 `torch_dtype="auto"`）最省心；bf16 是现在的标准。
- 量化不知道选什么就 **`Q4_K_M`**。
- **同等显存下，大模型 + 重量化 通常优于 小模型 + 轻量化**。

下一篇：[命令行与登录](/manual/llm/huggingface/cli-and-auth)。
