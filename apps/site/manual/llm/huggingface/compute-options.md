---
title: "算力选项"
description: "本地、Colab、Spaces、Inference Endpoints 各自的成本与适用场景，以及怎么选。"
source: "https://daiw.org/manual/huggingface/compute-options"
---

# 算力选项

> 本地、Colab、Spaces、Inference Endpoints 各自的成本与适用场景，以及怎么选。

跑模型的算力从哪来。这一篇横向比较几种选择——**结论往往是“先用免费的，确认值得再花钱”**。

## 五个选项

| 选项 | 成本 | 适合 |
| --- | --- | --- |
| **本地机器** | 电费 | 长期高频、隐私敏感、能一次性投入硬件 |
| **Google Colab** | 免费 / 约 \$10 起 | 学习、短实验、写教程 |
| **HF Spaces** | 免费 CPU / GPU 按小时 | **做演示、分享给别人用** |
| **HF Inference Providers** | 按 token | 少量调用、试模型、不想部署 |
| **HF Inference Endpoints** | 按小时 | 生产环境的专用推理服务 |
| **云 GPU**（AutoDL / Vast / 各大云） | 按小时 | 大规模训练 |

## 本地

**长期看更省，但前期投入大。**

| 卡 | 大致价位 | 能干什么 |
| --- | --- | --- |
| RTX 4060 Ti 16G | 中低 | 8B 推理、8B QLoRA 微调 |
| RTX 3090 二手 24G | 中 | **性价比经典**：32B int4 推理、14B 微调 |
| RTX 4090 / 5090 | 高 | 同上但快得多（5090 32G 还能跑更大模型） |
| Mac M 系（32G+ 统一内存） | 高 | 推理体验好，**训练弱** |

::: info

**二手 3090 是这个领域公认的高性价比之选。** 24 G 显存、支持 bf16、价格远低于 4090/5090，跑推理和 QLoRA 都够用。缺点是功耗高、二手有风险。

Mac 要注意：**统一内存对推理友好，但训练生态很弱**（多数训练库对 MPS 后端支持不完整）。想微调还是得 NVIDIA。

:::

**算一笔账**：一张 3090 大约等于云上 A10 跑一千多小时的钱。**每天用超过 2 小时，半年就回本。**

## Google Colab

```python
!pip install -q transformers accelerate bitsandbytes peft trl
```

| 档位 | GPU | 说明 |
| --- | --- | --- |
| 免费 | T4 16G（不保证） | 会断连，**长任务不可靠** |
| Pro | T4 / L4，更长时限 | 学习够用 |
| Pro+ | A100 40G/80G（按需） | 能做真训练 |

::: warning

**Colab 免费版突出的问题不是慢，是“随时会断”。**

跑到一半掉线，没存 checkpoint 就全白费。对策：

```python
from google.colab import drive
drive.mount('/content/drive')
```

```python
cfg = SFTConfig(output_dir="/content/drive/MyDrive/out", save_steps=50, ...)
```

**checkpoint 直接存 Google Drive**，断了重连能接着跑（见[训练实操](/manual/llm/huggingface/training-practice)的 `resume_from_checkpoint`）。

:::

## HuggingFace Spaces

Spaces 是**托管的应用**，不是裸算力。一个仓库 + 一个入口文件，push 上去就有公开 URL。

```python
# app.py
import gradio as gr
from transformers import pipeline

pipe = pipeline("text-generation", model="Qwen/Qwen3-0.6B")

def chat(msg, history):
    return pipe(msg, max_new_tokens=256)[0]["generated_text"]

gr.ChatInterface(chat).launch()
```

```text
requirements.txt
transformers
torch
gradio
```

推上去就自动构建部署。

| 硬件档 | 成本 | 说明 |
| --- | --- | --- |
| CPU basic | **免费** | 小模型、向量模型够用 |
| **ZeroGPU** | **PRO 用户免费** | 共享 H200，**性价比极高的一档** |
| 专用 GPU | 按小时计费 | 需要常驻时 |

::: info

**ZeroGPU 是 HuggingFace 非常划算的功能之一。**

它给 PRO 用户提供**按需分配的 H200 时间片**——你的 Space 平时不占 GPU，有请求时动态拿到一块，用完释放。

```python
import spaces

@spaces.GPU(duration=60)
def generate(prompt):
  return pipe(prompt)
```

加个装饰器就行。**做演示 Demo 几乎没有更省心的选择**：不用付常驻 GPU 的钱，用户体验又接近专用卡。

限制：单次调用有时长上限，冷启动有延迟，不适合做生产 API。

:::

**Space 的典型用途**：把你[微调好的模型](/manual/llm/huggingface/push-to-hub)挂一个 Demo，发链接给别人试。这比让对方自己配环境有效得多。

## Inference Providers

不部署，直接按 token 调用：

```python
from huggingface_hub import InferenceClient

client = InferenceClient(api_key="hf_xxx")
out = client.chat_completion(
    model="Qwen/Qwen3-8B",
    messages=[{"role": "user", "content": "你好"}],
)
print(out.choices[0].message.content)
```

HuggingFace 把请求路由到多家推理服务商（Together、Fireworks、Novita、SambaNova 等），**同一套 API 调不同后端**。

| 优点 | 缺点 |
| --- | --- |
| 零部署，几行代码就能用 | 按 token 计费，量大时不划算 |
| 能快速试很多模型 | 数据会经过第三方 |
| 有免费额度 | 冷门模型未必有 |

**很适合的场景：选型阶段。** 想在五个模型里挑一个，用这个逐个试比本地各下一遍快得多。

## Inference Endpoints

专用的托管推理服务，**按小时计费**：

```text
选模型 → 选云与区域 → 选实例规格 → 部署
```

得到一个专属 URL，自动扩缩容、可设成私有。

| 适合 | 不适合 |
| --- | --- |
| 生产环境要 SLA | 个人玩票 |
| 不想自己运维 GPU 机器 | 预算敏感 |
| 需要私有网络 / 合规 | 请求量很低（不如按 token） |

::: warning

**Endpoints 是按小时计费，不是按请求。** 部署完忘了关，一个月能烧掉不少钱——**这是常见的意外账单来源**。

两条纪律：

1. **开启 scale-to-zero**（闲置自动缩到 0），代价是冷启动几十秒。
2. **实验用完立刻删**，别只是暂停。

在账号设置里配个**消费上限告警**，比事后心疼强。

:::

## 云 GPU

大规模训练时的选择。国内 AutoDL、恒源云等按小时租卡，价格比国际云低不少；国际有 Vast.ai、RunPod、Lambda 等。

**要点：**

- **先在本地或 Colab 把脚本调通**再租卡——按小时计费时调 bug 是在烧钱。
- 数据和模型**提前下好**（用[镜像](/manual/llm/huggingface/china-access)），别在计费的机器上等下载。
- 用 `screen` / `tmux` 跑，SSH 断了训练不中断。
- **结束记得关机**，不是只退出 SSH。

## 怎么选

```text
你在干什么？
├── 学习 / 试模型          → Colab 免费版、Inference Providers
├── 做个 Demo 给人看        → HF Spaces（PRO 的 ZeroGPU）
├── 日常开发、长期高频       → 本地（二手 3090 起）
├── 一次性大训练            → 云 GPU 按小时
└── 生产推理服务
    ├── 量小 → Inference Providers（按 token）
    ├── 量中 → Inference Endpoints
    └── 量大 → 自己的机器 + vLLM（见 vLLM 那章）
```

::: info

**一条通用建议：先用免费的把流程跑通，再决定花钱买什么。**

很多人一上来就租 A100，结果发现自己的任务 8B 模型就够、一张 3060 能搞定。**先用 Colab 或小模型验证“这条路走得通”，再投入算力**，能省掉大部分冤枉钱。

:::

## 小结

- **本地长期更便宜**，二手 3090 是性价比经典；Mac 推理好但训练弱。
- Colab 免费版**随时会断**——checkpoint 存 Drive，配 `resume_from_checkpoint`。
- **ZeroGPU 是 PRO 相当划算的部分**，做 Demo 非常省心。
- **Inference Providers 很适合选型阶段**，几行代码试遍多个模型。
- **Endpoints 按小时计费**，务必开 scale-to-zero、用完就删、配消费告警。
- 租云卡前**先在本地调通脚本**，别按小时计费地调 bug。
- **先用免费的验证方向，再花钱。**

下一篇：[收费版怎么用才值](/manual/llm/huggingface/paid-tiers)。
