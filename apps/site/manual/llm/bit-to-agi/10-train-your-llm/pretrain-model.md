---
title: "预训练模型"
description: "从 Bit 到 AGI · 第十章：自己训练一个模型 · 预训练模型"
source: "https://daiw.org/manual/bit-to-agi/10-train-your-llm/pretrain-model"
---

# 预训练模型

> 从 Bit 到 AGI · 第十章：自己训练一个模型 · 预训练模型

Tokenizer 就绪后，下一步是让模型在语料上做 **next-token prediction**。本篇用 LitGPT 在单卡 24 GB GPU 上预训练一个 12 层、768 维的 GPT（约 125M 参数），并解释 batch size、学习率与训练步数如何选取（若想深入手写 300 行纯 PyTorch GPT 训练循环与底层算子调度，可参考[《跟 Karpathy 手搓 nanoGPT》](https://daiw.org/manual/nanogpt)与[《PyTorch 源码精读》](https://daiw.org/manual/pytorch-internals)）。

## 直觉：填字游戏练一万遍

预训练就是给模型看成千上万段文字，每次遮住下一个 token 让它猜。猜错就调权重（第七章的梯度下降）；猜对说明它内化了统计规律。125M 参数 ≈ 1.25 亿个旋钮，每个 token 更新一次所有旋钮——所以需要**数十亿 token** 才能收敛。

## 定义

**因果语言建模**（CLM）最大化：

$$
\mathcal{L} = -\sum_{t=1}^{T} \log p(x_t \mid x_{<t}; \theta)
$$

本章配置（LitGPT `tiny` 变体）：

| 超参 | 值 |
| ---- | -- |
| $d_{\text{model}}$ | 768 |
| 层数 $L$ | 12 |
| 注意力头 | 12 |
| 词表 $V$ | 32768 |
| 序列长度 | 2048 |
| 参数量 | ~125M |

参数量估算（第七章公式）：

$$
\text{params} \approx 12 L d^2 + V d \approx 12 \times 12 \times 768^2 + 32768 \times 768 \approx 125\text{M}
$$

## 例子

**例 1：安装 LitGPT**

```bash
cd ~/mini-gpt-lab && source .venv/bin/activate
pip install litgpt torch --upgrade

# 准备 LitGPT 数据格式（bin + 索引）
python << 'EOF'
from pathlib import Path
from tokenizers import Tokenizer
import numpy as np

tok = Tokenizer.from_file("tokenizer/tokenizer.json")
eot = tok.token_to_id("<|endoftext|>")
data_dir = Path("data/litgpt")
data_dir.mkdir(parents=True, exist_ok=True)

ids = []
with open("processed/train.txt", encoding="utf-8") as f:
    for para in f:
        para = para.strip()
        if not para:
            continue
        ids.extend(tok.encode(para).ids)
        ids.append(eot)

arr = np.array(ids, dtype=np.uint16)  # vocab < 65536
arr.tofile(data_dir / "train.bin")
print(f"tokens={len(arr):,}, file={data_dir/'train.bin'}")
EOF
```

**例 2：启动预训练**

```bash
# 下载 tiny GPT 配置模板
litgpt download tinyllama --tokenizer_dir tokenizer 2>/dev/null || true

# 用自定义配置预训练（单卡）
litgpt pretrain \
  --model_name tiny \
  --data TinyStories \
  --out_dir checkpoints/pretrain \
  --train_data_path data/litgpt/train.bin \
  --tokenizer_dir tokenizer \
  --micro_batch_size 4 \
  --batch_size 32 \
  --max_seq_length 2048 \
  --lr 3e-4 \
  --max_tokens 500_000_000 \
  --save_interval 1000 \
  --log_interval 10 \
  --devices 1 \
  --precision bf16-mixed
```

若 LitGPT 版本 CLI 不同，等价 Python 入口：

```bash
python -m litgpt pretrain tiny \
  --data TinyStories \
  --out_dir checkpoints/pretrain \
  --train_data_path data/litgpt/train.bin \
  --tokenizer_dir tokenizer \
  --micro_batch_size 4 \
  --batch_size 32 \
  --max_seq_length 2048 \
  --lr 3e-4 \
  --max_tokens 500000000 \
  --devices 1
```

**例 3：观察 loss 曲线**

```bash
# 训练日志通常在 checkpoints/pretrain/logs/
tail -f checkpoints/pretrain/logs/train.log
# 期望：step 100 loss ~8–10，step 10k loss ~4–5（视语料而定）
```

## 量化

| 指标 | 数值 |
| ---- | ---- |
| 125M bf16 权重 | ~250 MB |
| 优化器状态（AdamW） | ~750 MB |
| 激活（batch=4, seq=2048） | ~4–6 GB |
| **单卡 24 GB 可行** | micro_batch=4, grad accum=8 |

训练 FLOPs（粗算）：

$$
\text{FLOPs/token} \approx 6 \times \text{params} = 6 \times 1.25 \times 10^8 = 7.5 \times 10^8
$$

500M tokens → $3.75 \times 10^{17}$ FLOPs。RTX 4090 ~330 TFLOPS bf16 理论峰值 → **纯算约 20 分钟**；实际 I/O 与优化器开销后约 **6–12 小时**。

::: info

`batch_size = micro_batch_size × gradient_accumulation × GPU 数`。显存不够时减小 `micro_batch_size`，增大累积步数保持有效 batch 不变。

:::

## 动手试一试

Dry-run 100 step 验证环境：

```bash
litgpt pretrain tiny \
  --out_dir checkpoints/smoke \
  --train_data_path data/litgpt/train.bin \
  --tokenizer_dir tokenizer \
  --micro_batch_size 2 \
  --batch_size 8 \
  --max_seq_length 512 \
  --max_tokens 8192 \
  --max_steps 100 \
  --devices 1
```

## 学习率与 Warmup

125M 模型推荐 **cosine decay + linear warmup**：

- warmup steps：100–500（总 step 的 1–2%）
- peak lr：3e-4
- min lr：3e-5（peak 的 10%）

```bash
litgpt pretrain tiny \
  --lr 3e-4 \
  --warmup_steps 200 \
  --min_lr 3e-5 \
  ...
```

Warmup 太短 → 初期 loss spike；太长 → 浪费算力。

## 数据混合（可选）

若有多个领域 shard（代码 + 百科 + 新闻），可按比例采样：

```python
# 伪代码：70% 通用 + 20% 代码 + 10% 中文
weights = [0.7, 0.2, 0.1]
```

混合比例影响 downstream 能力；纯英文训出的模型中文生成差。

## 常见误区

1. **学习率过大**：125M 模型 lr > 1e-3 易 loss spike；从 3e-4 起试。
2. **未 shuffle / 未插 EOT**：模型学到段落边界 artifact。
3. **精度混用**：训练 bf16、保存 fp32 可以；推理时再 quantize。
4. **max_steps 与 max_tokens 混用**：只设一个；tokens 更直观对应 Chinchilla。
5. **未固定 seed**：复现实验设 `seed=1337`。

## 端到端实践要点

预训练是第七章「next-token prediction」的直接实现。125M 参数规模对应 2018 年 GPT-1 量级，足以在小型语料上看到 loss 从 ~10 降到 ~4，生成从乱码变成可读短语——**这是验证流水线是否正确的最小规模**，而不是要与 Qwen 比拼 MMLU。

`train.bin` 必须是 uint16 连续流，文档间用 `endoftext` 分隔，训练时按固定 seq_len 切 chunk 并 shuffle。有效 batch size 影响收敛：太小（低于 16）loss 噪声大；太大（>64）125M 模型可能泛化略差但速度更快。本章 batch=32 是折中。`max_tokens` 比 `max_steps` 更直观：500M tokens 约为 Chinchilla 最优 2.5B 的五分之一，属于「预算内实验」而非最优 scaling。

训练前务必 smoke test 100 step：确认 loss 有限、无 NaN、GPU 利用率 >50%、Checkpoint 能写入磁盘。训练后对比 step-1000 与 final 的 val PPL，若 final 更差，说明后期过拟合，应取 best checkpoint 而非 last。预训练完成只是 Base 模型；对话能力来自后续 SFT，不要期待 Base 会「聊天」。

## 命令流水线复盘

`pip install litgpt torch`；运行 bin 转换脚本写 `data/litgpt/train.bin`；`litgpt pretrain tiny ...`（参数见本篇）；另开终端 `watch nvidia-smi` 与 `tail -f` 日志；每约一千 step 确认 `checkpoints/pretrain/step-*` 落地；训满或 early stop 后复制 val 最优到 `checkpoints/best/`。Smoke：`max_steps 100` 应先于长跑。下一篇[验证模型](/manual/llm/bit-to-agi/10-train-your-llm/validate-model)切 `val.bin` 并算 PPL。

## 排错速查

LitGPT CLI 变更：查 `litgpt pretrain --help`。train.bin 空：Tokenizer 或清洗输出为空。loss 不降：lr 过大或数据未 shuffle。OOM：减 micro_batch。tokens/s 极低：bin 在 HDD 上。

## 验收标准

本篇完成后，你应能在终端用一条命令或脚本验证关键产出存在且非空：`test -s` 查文件、`curl` 查 HTTP、`python -c` 查 import 与 shape。把验收命令写进项目 `Makefile` 或 `scripts/verify.sh`，每次改数据或权重后跑一遍，避免带着 silent failure 进入下一篇。全章二十篇都通过验收，即表示你已具备从零训小模型到部署 API 的完整能力。

## 与前后章衔接

本章每篇都假设你已读完第一至九章：比特与文件格式（第一章）解释 `train.bin` 为何是字节流；信息论（第三章）解释为何 PPL 衡量压缩效率；Transformer（第五章）解释预训练在优化什么；Tokenizer（第六章）与本章 BPE 训练一一对应；Training（第七章）给出 loss、LoRA、Checkpoint 理论；Inference（第八章）对应推理与部署；GPU（第九章）对应硬件与显存估算。若某命令报错，先查依赖版本（Python 3.11+、CUDA 驱动、PyTorch 与 vLLM 匹配），再查路径是否与 `mini-gpt-lab` 目录约定一致。整条流水线可在单卡 4090 上于一个周末跑通；失败时回到[从失败中恢复](/manual/llm/bit-to-agi/10-train-your-llm/recover-from-failure)对照症状表，不要跳过日志与 checkpoint 排查。

完成本篇后建议把关键命令与输出路径记录到 `docs/run-log.md`，便于复现与团队协作。

## 练习扩展

若时间充裕，尝试修改一个超参或配置项，观察下游指标变化并记录到 `docs/run-log.md`：例如清洗 threshold、词表大小、学习率、save 间隔或 vLLM 的 `max-model-len`。单次只改一处，才能归因。对比实验最好开 W&B 同名 project 下不同 run，用 Notes 字段标注「baseline / variant B」。这些习惯与工业界 ML 实验管理一致，比单纯跑通命令更有长期价值。

建议每篇末尾自检：关键产出文件存在、体积合理、随机抽检内容可读，再点下一篇链接。

## 小结

- 语料 → `train.bin` → LitGPT `pretrain`。
- 125M GPT、500M tokens、单卡 24 GB、约 6–12 小时。
- 监控 loss 下降；每 1000 step 存 Checkpoint。

→ 下一篇：[验证模型](/manual/llm/bit-to-agi/10-train-your-llm/validate-model)
