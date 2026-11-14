---
title: "发布你的模型"
description: "从 Bit 到 AGI · 第十章：自己训练一个模型 · 发布你的模型"
source: "https://daiw.org/manual/bit-to-agi/10-train-your-llm/publish-your-model"
---

# 发布你的模型

> 从 Bit 到 AGI · 第十章：自己训练一个模型 · 发布你的模型

Checkpoint 在本地只有你能用。发布到 HuggingFace Hub 后，他人可以 `from_pretrained` 加载、复现 Benchmark，你也可以接 Spaces Demo。本篇走完上传、Model Card 与许可证配置（更多 Hub 与 CLI 实战详见[《HuggingFace 全家桶》](https://daiw.org/manual/huggingface)）。

## 直觉：上架应用商店

训练是开发；发布是**上架**——写清楚「这是什么、能干什么、不能干什么」（Model Card），选好许可证，打包权重与 Tokenizer。

## 定义

发布清单：

| 文件 | 必需 |
| ---- | ---- |
| `config.json` | 架构超参 |
| `model.safetensors` 或分片 | 权重 |
| `tokenizer.json` / `tokenizer_config.json` | 分词 |
| `README.md` (Model Card) | 说明 |
| `LICENSE` | 法律 |

Model Card 最小章节：简介、训练数据、评估结果、限制与偏见、用法示例。

## 例子

**例 1：登录 HuggingFace**

```bash
cd ~/mini-gpt-lab && source .venv/bin/activate
pip install huggingface_hub

huggingface-cli login
# 或 export HF_TOKEN=hf_xxx
```

**例 2：创建 Hub 仓库并上传**

```bash
export HF_USER=your-username
huggingface-cli repo create mini-gpt-125m --type model --private

huggingface-cli upload your-username/mini-gpt-125m \
  checkpoints/best-hf/ \
  --commit-message "Release 125M pretrain on SlimPajama sample"
```

**例 3：编写 Model Card**

```bash
cat > checkpoints/best-hf/README.md << 'EOF'
---
license: apache-2.0
language:
  - en
  - zh
tags:
  - causal-lm
  - gpt
  - from-scratch
datasets:
  - cerebras/SlimPajama-627B
metrics:
  - perplexity
model-index:
  - name: mini-gpt-125m
    results:
      - task:
          type: text-generation
        metrics:
          - name: perplexity
            value: 28.4
            verified: false
---

# mini-gpt-125m

125M parameter GPT trained from scratch for educational purposes.

## Usage

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
tok = AutoTokenizer.from_pretrained("your-username/mini-gpt-125m")
model = AutoModelForCausalLM.from_pretrained("your-username/mini-gpt-125m")
```

## Training

- Tokens: 500M
- Architecture: 12L, d=768, V=32768
- Hardware: 1× RTX 4090

## Limitations

Base model only — no instruction tuning. Not for production.
EOF

huggingface-cli upload your-username/mini-gpt-125m checkpoints/best-hf/README.md
```

**例 4：上传 LoRA adapter**

```bash
huggingface-cli repo create mini-gpt-alpaca-lora --type model

huggingface-cli upload your-username/mini-gpt-alpaca-lora \
  checkpoints/sft-lora/ \
  --commit-message "LoRA SFT on Alpaca 5k"
```

**例 5：创建 Spaces Demo（Gradio）**

```python
# README 同 repo 或独立 Space
# app.py
import gradio as gr
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

MODEL = "your-username/mini-gpt-125m"
tok = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.bfloat16, device_map="auto")

def generate(prompt, max_tokens=128, temperature=0.7):
    inputs = tok(prompt, return_tensors="pt").to(model.device)
    out = model.generate(**inputs, max_new_tokens=max_tokens, temperature=temperature, do_sample=True)
    return tok.decode(out[0], skip_special_tokens=True)

demo = gr.Interface(fn=generate, inputs=["text", "slider", "slider"], outputs="text",
                    title="mini-gpt-125m Demo")
demo.launch()
```

在 huggingface.co/new-space 选 Gradio + ZeroGPU（小模型 CPU 也可）。

## 量化

| 资产 | 大小 | 上传时间（100 Mbps） |
| ---- | ---- | -------------------- |
| 125M bf16 | ~250 MB | ~30 s |
| 7B bf16 | ~14 GB | ~20 min |
| LoRA adapter | ~50 MB | ~10 s |

Hub 免费账号：**公开** 模型无限；私有模型有存储配额（见官网，通常数 GB–数十 GB 够用）。

::: warning

发布前确认训练数据**许可证允许衍生模型**；SlimPajama 等各有条款。Model Card 如实写数据来源，避免侵权。

:::

## 动手试一试

本地验证他人视角可加载：

```bash
python << 'EOF'
from transformers import AutoModelForCausalLM, AutoTokenizer
# 上传后替换为 Hub id
id = "your-username/mini-gpt-125m"
tok = AutoTokenizer.from_pretrained(id)
model = AutoModelForCausalLM.from_pretrained(id)
print("loaded", sum(p.numel() for p in model.parameters()) / 1e6, "M params")
EOF
```

## Gated Model 与私有仓库

Llama 等需在 HuggingFace 网页点 **Agree** 后才能下载：

```bash
huggingface-cli login
huggingface-cli download meta-llama/Llama-3.2-3B-Instruct \
  --local-dir checkpoints/base/llama-3.2-3b
```

私有 repo：

```bash
huggingface-cli repo create my-company-model --type model --private
huggingface-cli upload my-company/my-model checkpoints/best-hf/ --private
```

## 量化版本发布

同时发布 bf16 与 GPTQ/AWQ 量化，降低推理门槛：

```bash
pip install gptqmodel  # 替代已归档的 auto-gptq，或使用 llmcompressor
python -m auto_gptq.llama_quantize checkpoints/best-hf checkpoints/best-gptq 4
huggingface-cli upload your-username/mini-gpt-125m-gptq checkpoints/best-gptq/
```

Model Card 注明：`original → GPTQ 4bit，PPL 变化 +0.5`。

## 常见误区

1. **漏传 tokenizer**：别人无法复现生成。
2. **license 与数据冲突**：数据 CC-BY-NC 却标 Apache-2.0。
3. **未 .gitignore 大文件就 push Git**：应用 `git lfs` 或只传 Hub，权重不进 GitHub。
4. **Model Card 缺 Limitations**：下游误用于医疗/法律。
5. **未设 model card metadata**：Hub 搜索标签靠 YAML frontmatter。

## 端到端实践要点

发布让 Checkpoint **脱离你的硬盘**，进入可复现、可引用的公共资产。Hub 上传权重+Tokenizer+Model Card 三件套；README YAML frontmatter 填 license、language、metrics。Limitations 段诚实写「Base 无 SFT、不可医疗用途」——保护下游也保护你。

Gated model 需 HF 授权；private repo 适合企业内部。GPTQ/AWQ 量化版另建 repo，Card 注明精度损失。Spaces Demo 用 Gradio 五分钟内可搭，但 ZeroGPU 队列可能慢；125M CPU 也能 demo。不要用 Git 存权重，用 LFS 或只 Hub。

发布前 checklist：license 与训练数据一致、Tokenizer 齐全、generate 冒烟、Benchmark 数字写入 Card（若未独立复现则标 `verified: false`）。引用你的模型时他人会看 Card——写得专业等于免费 PR。发布后 tag 版本 `v1.0.0`，breaking change 升 major。

## 命令流水线复盘

`huggingface-cli login`；`huggingface-cli repo create mini-gpt-125m --type model`；写 `README.md` Model Card；`huggingface-cli upload your-username/mini-gpt-125m checkpoints/best-hf/`；网页检查 Files 页；`from_pretrained` 远程加载冒烟。可选 Gradio Space。最后读[本章总结](/manual/llm/bit-to-agi/10-train-your-llm/chapter-summary)串起全链路。

## 排错速查

upload 403：token 权限或 repo 未创建。缺文件：tokenizer 未一并 upload。Card 不渲染：README YAML 缩进错。他人 load 失败：config.json 与权重不匹配。大文件超时：分片 upload 或 CLI resume。

## 验收标准

本篇完成后，你应能在终端用一条命令或脚本验证关键产出存在且非空：`test -s` 查文件、`curl` 查 HTTP、`python -c` 查 import 与 shape。把验收命令写进项目 `Makefile` 或 `scripts/verify.sh`，每次改数据或权重后跑一遍，避免带着 silent failure 进入下一篇。全章二十篇都通过验收，即表示你已具备从零训小模型到部署 API 的完整能力。

## 与前后章衔接

本章每篇都假设你已读完第一至九章：比特与文件格式（第一章）解释 `train.bin` 为何是字节流；信息论（第三章）解释为何 PPL 衡量压缩效率；Transformer（第五章）解释预训练在优化什么；Tokenizer（第六章）与本章 BPE 训练一一对应；Training（第七章）给出 loss、LoRA、Checkpoint 理论；Inference（第八章）对应推理与部署；GPU（第九章）对应硬件与显存估算。若某命令报错，先查依赖版本（Python 3.11+、CUDA 驱动、PyTorch 与 vLLM 匹配），再查路径是否与 `mini-gpt-lab` 目录约定一致。整条流水线可在单卡 4090 上于一个周末跑通；失败时回到[从失败中恢复](/manual/llm/bit-to-agi/10-train-your-llm/recover-from-failure)对照症状表，不要跳过日志与 checkpoint 排查。

完成本篇后建议把关键命令与输出路径记录到 `docs/run-log.md`，便于复现与团队协作。

## 练习扩展

若时间充裕，尝试修改一个超参或配置项，观察下游指标变化并记录到 `docs/run-log.md`：例如清洗 threshold、词表大小、学习率、save 间隔或 vLLM 的 `max-model-len`。单次只改一处，才能归因。对比实验最好开 W&B 同名 project 下不同 run，用 Notes 字段标注「baseline / variant B」。这些习惯与工业界 ML 实验管理一致，比单纯跑通命令更有长期价值。

建议每篇末尾自检：关键产出文件存在、体积合理、随机抽检内容可读，再点下一篇链接。

遇到问题先查日志与磁盘空间，再查本章排错速查表。

保持 `mini-gpt-lab` 目录结构与命名一致，可显著减少路径类错误。

全章命令均在 bash + Python venv 下验证；Windows 用户请用 WSL2 或调整路径分隔符。

建议 fork 本章 `mini-gpt-lab` 仓库模板，在 README 中勾选已完成篇目，便于跟踪进度。

遇阻可在本章总结页的命令速查中对照当前阶段。耐心排查，多数错误来自路径与环境。完成验收后再进入下一篇。

## 小结

- `huggingface-cli upload` 发布权重 + tokenizer + Model Card。
- Model Card 写数据、指标、限制；许可证与数据一致。
- 可选 Spaces Demo 展示；LoRA 单独 repo 或合并 merge 后发布。

→ 下一篇：[本章总结](/manual/llm/bit-to-agi/10-train-your-llm/chapter-summary)
