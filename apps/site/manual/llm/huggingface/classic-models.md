---
title: "经典模型清单"
description: "按任务分类挑出可单机部署的模型，每个给显存需求与可直接运行的命令。"
source: "https://daiw.org/manual/huggingface/classic-models"
---

# 经典模型清单

> 按任务分类挑出可单机部署的模型，每个给显存需求与可直接运行的命令。

这一篇是可直接照抄的清单。**选的标准是“单机能跑、经典或当前主流、许可宽松”**，不追求最新最大。

::: info

**模型迭代很快，具体版本号会过时。** 但选型的**思路**是稳定的：先按任务找模型类别，再按[显存档位](/manual/llm/huggingface/choose-by-vram)选规模，最后看许可。

用下面的命令时，先去 Hub 搜一下该系列有没有更新的版本。

:::

## 对话 / 通用 LLM

| 模型系列 | 规格 | 特点 | 许可 |
| --- | --- | --- | --- |
| **Qwen3** | 0.6B~235B | 中文强，规格齐全，**入门首选** | Apache-2.0 |
| **Llama 3.x** | 1B~405B | 生态庞大，工具链支持广 | Llama 社区许可（商用有条件） |
| **Gemma 3** | 1B~27B | 小尺寸质量高，多模态版本 | Gemma 许可 |
| **Mistral / Ministral** | 3B~123B | 英文强，推理快 | Apache-2.0（部分版本） |
| **DeepSeek-V3 / R1 蒸馏版** | 1.5B~70B | 推理能力强，蒸馏版小而能打 | MIT（蒸馏版） |
| **Phi-4** | 14B | 小模型里推理很强 | MIT |

### 起步推荐

```bash
# 显存 8 G：Qwen3-8B 的 4bit
ollama run hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M
```

```bash
# 显存 24 G：32B 的 4bit，质量明显更好
ollama run hf.co/unsloth/Qwen3-32B-GGUF:Q4_K_M
```

```bash
# 纯 CPU / 低配：4B
ollama run qwen3:4b
```

::: info

**中文场景优先 Qwen 系列。** 它的中文语料占比明显更高，同尺寸下中文表现通常好一截。英文与代码场景，Llama / Mistral / Phi 更有优势。

**不确定就从 Qwen3-8B 开始**——它是当前“小机器能跑、又真的好用”的最佳平衡点。

:::

## 代码模型

| 模型 | 规格 | 说明 |
| --- | --- | --- |
| **Qwen3-Coder** | 30B~480B | 代码能力强，有 MoE 版本 |
| **DeepSeek-Coder-V2** | 16B / 236B | Lite 版单卡可跑 |
| **Codestral** | 22B | 补全质量高 |
| **StarCoder2** | 3B / 7B / 15B | 完全开源，训练数据可溯源 |

**本地代码补全**建议用小的（3B~7B）——补全对延迟极敏感，大模型等不起。

## 向量模型（Embedding）

做 RAG、语义搜索必备。**这类模型很小，几乎什么机器都能跑。**

| 模型 | 维度 | 说明 |
| --- | --- | --- |
| **BAAI/bge-m3** | 1024 | **多语言，中文强，长文本** |
| **BAAI/bge-large-zh-v1.5** | 1024 | 中文专用，经典 |
| **intfloat/multilingual-e5-large** | 1024 | 多语言 |
| **sentence-transformers/all-MiniLM-L6-v2** | 384 | **极小（80 MB），快** |
| **Qwen3-Embedding** | 可变 | 较新，支持指令 |

```bash
pip install sentence-transformers
```

```python
from sentence_transformers import SentenceTransformer

m = SentenceTransformer("BAAI/bge-m3")
vecs = m.encode(["今天天气不错", "The weather is nice today"])
print(vecs.shape)                    # (2, 1024)
print(m.similarity(vecs[0], vecs[1]))
```

::: warning

**别忽略重排模型（reranker）。** RAG 效果不好时，加一个 reranker 往往比换更大的向量模型有效得多：

```python
from sentence_transformers import CrossEncoder
r = CrossEncoder("BAAI/bge-reranker-v2-m3")
scores = r.predict([("查询", "候选文档1"), ("查询", "候选文档2")])
```

流程是**向量检索召回 50 条 → reranker 精排取 5 条**。向量模型负责快，reranker 负责准。

:::

## 语音

### 识别（ASR）

| 模型 | 说明 |
| --- | --- |
| **openai/whisper-large-v3** | 事实标准，多语言 |
| **openai/whisper-large-v3-turbo** | **快 5 倍以上，质量接近** |
| **whisper 小尺寸**（tiny/base/small） | CPU 可跑 |

```python
from transformers import pipeline

asr = pipeline("automatic-speech-recognition",
               model="openai/whisper-large-v3-turbo",
               dtype="auto", device_map="auto")
print(asr("audio.mp3")["text"])
```

**更快的实现**是 `faster-whisper`（基于 CTranslate2），同样的模型速度快数倍、显存更省：

```bash
pip install faster-whisper
```

### 合成（TTS）

| 模型 | 说明 |
| --- | --- |
| **CosyVoice 2** | 中文效果好，支持音色克隆 |
| **Kokoro** | 极小（82M），速度快，英文好 |
| **XTTS-v2** | 多语言音色克隆（注意许可为非商用） |

## 图像

### 生成

| 模型 | 显存 | 说明 |
| --- | --- | --- |
| **FLUX.1-schnell** | 12 G+（fp8 可到 8 G） | 质量高，**Apache-2.0 可商用** |
| **FLUX.1-dev** | 同上 | 质量更高，**非商用许可** |
| **SDXL** | 8 G+ | 生态成熟，LoRA 极多 |
| **SD 1.5** | 4 G+ | 老但极轻，玩法最多 |

```bash
pip install diffusers accelerate
```

```python
import torch
from diffusers import FluxPipeline

pipe = FluxPipeline.from_pretrained("black-forest-labs/FLUX.1-schnell", torch_dtype=torch.bfloat16)
pipe.enable_model_cpu_offload()      # 显存不够时开，慢但能跑

img = pipe("一只戴眼镜的柴犬，水彩风格", num_inference_steps=4, guidance_scale=0.0).images[0]
img.save("out.png")
```

::: info

**`enable_model_cpu_offload()` 是显存不足时的关键一招。** 它把暂时用不到的组件（文本编码器、VAE）挪到内存，只在需要时搬回显存。

代价是慢一些，但能让 8 G 卡跑起本来要 16 G 的模型。比它更激进的是 `enable_sequential_cpu_offload()`——更省但明显更慢。

:::

### 理解 / 多模态

| 模型 | 说明 |
| --- | --- |
| **Qwen3-VL** | 中文强，图表与文档理解好 |
| **InternVL3** | 开源多模态标杆之一 |
| **Gemma 3（多模态版）** | 小尺寸有多模态能力 |
| **SmolVLM** | 极小，边缘设备可跑 |

### 传统视觉任务

这些模型小、成熟、随便跑：

| 任务 | 模型 |
| --- | --- |
| 图像分类 | `google/vit-base-patch16-224` |
| 目标检测 | `facebook/detr-resnet-50` |
| 图文匹配 | `openai/clip-vit-base-patch32` |
| 分割 | `facebook/sam2-hiera-large` |
| OCR | `microsoft/trocr-base-printed`、PaddleOCR |

## NLP 小模型

**别一上来就用 LLM 做所有事**——很多任务上，一个 100 MB 的 BERT 又快又准还便宜。

| 任务 | 模型 | 参数量 |
| --- | --- | --- |
| 中文通用编码 | `hfl/chinese-roberta-wwm-ext` | 100M |
| 情感分类 | `uer/roberta-base-finetuned-jd-binary-chinese` | 100M |
| 命名实体识别 | `dslim/bert-base-NER` | 110M |
| 零样本分类 | `MoritzLaurer/mDeBERTa-v3-base-mnli-xnli` | 280M |
| 翻译 | `Helsinki-NLP/opus-mt-zh-en` | 75M |

```python
from transformers import pipeline

clf = pipeline("zero-shot-classification",
               model="MoritzLaurer/mDeBERTa-v3-base-mnli-xnli")
print(clf("这个手机电池不耐用", candidate_labels=["好评", "差评", "咨询"]))
```

::: warning

**零样本分类是最被低估的一类模型。** 不用训练、不用标数据，给几个标签就能分类，几百 MB，CPU 上毫秒级。

很多人拿 8B 模型 + 提示词做的事，一个 280M 的 mDeBERTa 能做得又快又稳——**而且输出格式确定，不会像 LLM 那样偶尔跑偏**。

:::

## 按硬件的一份“先试这些”

| 你的机器 | 建议起步 |
| --- | --- |
| 无独显，16 G 内存 | `ollama run qwen3:4b`；向量用 `bge-m3` |
| 8 G 显存 | Qwen3-8B Q4_K_M；SD 1.5 / SDXL |
| 12~16 G | Qwen3-8B bf16；FLUX.1-schnell；whisper-large-v3-turbo |
| 24 G | Qwen3-32B Q4；FLUX.1-dev；可开始 [LoRA 微调](/manual/llm/huggingface/finetune-lora) |
| Mac M 系 16 G+ | Ollama 跑 8B~14B，体验很好 |

## 小结

- **中文优先 Qwen 系列**，英文 / 代码看 Llama / Mistral / Phi。
- **不确定就从 Qwen3-8B 起步**，8 G 显存 Q4 能跑。
- RAG 别只堆向量模型，**加 reranker 的收益常常更大**。
- Whisper 要快就用 **turbo 版或 faster-whisper**。
- 图像生成显存不够，**`enable_model_cpu_offload()`**。
- **很多任务不需要 LLM**——零样本分类、NER 这些小模型又快又稳。
- 商用前**逐个确认许可**：FLUX.1-dev、XTTS-v2 等都是非商用。

下一篇：[数据集基础](/manual/llm/huggingface/datasets-basics)。
