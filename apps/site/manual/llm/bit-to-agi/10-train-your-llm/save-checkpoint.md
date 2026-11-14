---
title: "保存 Checkpoint"
description: "从 Bit 到 AGI · 第十章：自己训练一个模型 · 保存 Checkpoint"
source: "https://daiw.org/manual/bit-to-agi/10-train-your-llm/save-checkpoint"
---

# 保存 Checkpoint

> 从 Bit 到 AGI · 第十章：自己训练一个模型 · 保存 Checkpoint

训练数小时到数天，Checkpoint 是**回溯训练状态的时间机器**：保存权重、优化器状态与训练步数，以便恢复训练、回滚最佳模型或导出推理格式。本篇讲清存什么、占多少磁盘、如何 resume 与如何导出 HuggingFace 格式。

## 直觉：游戏存档

RPG 每进一个关卡自动存档。Checkpoint 同理：**模型权重**是角色属性，**优化器状态**是 Buff 持续时间，**步数 / lr schedule** 是剧情进度。只存权重可以推理，但**无法无缝续训**——Adam 的一阶二阶矩丢了，恢复后 loss 可能跳变。

## 定义

典型 Checkpoint 目录结构：

```
checkpoints/pretrain/step-010000/
├── lit_model.pth          # 模型权重 (~250 MB for 125M bf16)
├── optimizer.pth          # Adam 状态 (~750 MB)
├── meta.json              # step, lr, config
└── tokenizer/             # 可选拷贝
```

| 内容 | 125M 模型大小 | 是否推理必需 |
| ---- | ------------- | ------------ |
| 权重 | ~250 MB | 是 |
| 优化器 | ~750 MB | 续训需要 |
| 随机数状态 | ~几 KB | 严格复现需要 |

## 例子

**例 1：训练时配置 save_interval**

```bash
cd ~/mini-gpt-lab && source .venv/bin/activate

litgpt pretrain tiny \
  --out_dir checkpoints/pretrain \
  --train_data_path data/litgpt/train.bin \
  --tokenizer_dir tokenizer \
  --save_interval 2000 \
  --keep_last_k 5 \
  --devices 1
```

`keep_last_k 5` 只保留最近 5 个，防止磁盘爆掉：5 × (250+750) MB ≈ **5 GB**。

**例 2：手动导出「最佳」Checkpoint**

```bash
# 假设 step-020000 val PPL 最低
BEST=checkpoints/pretrain/step-020000
mkdir -p checkpoints/best
cp -r "$BEST"/* checkpoints/best/
cp -r tokenizer checkpoints/best/tokenizer

# 写 manifest
cat > checkpoints/best/meta.json << EOF
{
  "step": 20000,
  "val_ppl": 28.4,
  "params": 125000000,
  "notes": "best val PPL on SlimPajama sample"
}
EOF
```

**例 3：从 Checkpoint 恢复训练**

```bash
litgpt pretrain tiny \
  --out_dir checkpoints/pretrain \
  --train_data_path data/litgpt/train.bin \
  --tokenizer_dir tokenizer \
  --resume checkpoints/pretrain/step-020000 \
  --devices 1
```

**例 4：转换为 HuggingFace 格式（便于 vLLM / transformers）**

```bash
pip install transformers safetensors

python << 'EOF'
# LitGPT → HF（示意，以当前 litgpt 文档为准）
from litgpt import LLM
from pathlib import Path

llm = LLM.load(Path("checkpoints/best"))
llm.save_hf(Path("checkpoints/best-hf"))
print("Saved to checkpoints/best-hf/")
EOF
```

或 CLI：

```bash
litgpt convert_to_hf checkpoints/best --out_dir checkpoints/best-hf
```

## 量化

| 训练规模 | save 间隔 | Checkpoint 数 | 磁盘占用 |
| -------- | --------- | ------------- | -------- |
| 50k steps | 1000 | 50（无 rotate） | ~50 GB |
| 50k steps | 2000, keep 5 | 5 | ~5 GB |
| 125M + 仅权重导出 | — | 1 | ~250 MB |

上传到 HuggingFace Hub：`best-hf/` 约 **250 MB**（bf16 safetensors），带宽 100 Mbps 上传约 **30 秒**。

::: info

生产环境会把 Checkpoint **异步写到对象存储**（S3 / R2），本地 NVMe 只留 hot checkpoint。本章单机 `keep_last_k` 足够。

:::

## 动手试一试

验证 Checkpoint 可加载：

```bash
python << 'EOF'
import torch
from pathlib import Path
p = Path("checkpoints/best/lit_model.pth")
if p.exists():
    state = torch.load(p, map_location="cpu", weights_only=True)
    print("keys:", list(state.keys())[:5], "...")
    print("size MB:", p.stat().st_size / 1024**2)
else:
    print("Run pretrain first")
EOF
```

## 多格式导出对照

| 格式 | 用途 | 命令 |
| ---- | ---- | ---- |
| LitGPT `.pth` | 续训 | 默认 save |
| HF safetensors | vLLM / transformers | `litgpt convert_to_hf` |
| GGUF Q4 | llama.cpp / Ollama | `convert_hf_to_gguf.py` |
| ONNX | 边缘 / ORT | optimum-cli export |

```bash
# GGUF 转换（需 llama.cpp 仓库）
python ~/llama.cpp/convert_hf_to_gguf.py checkpoints/best-hf \
  --outfile checkpoints/best-q4.gguf --outtype q4_k_m
```

Q4 125M 约 **80 MB**，CPU 推理友好。

## 版本管理与命名

推荐目录命名：

```
checkpoints/
├── pretrain/
│   ├── step-010000/
│   └── final/
├── best/              # val PPL 最优
├── best-hf/           # 部署用
└── sft-lora/          # 微调 adapter
```

`meta.json` 字段：`step`, `val_ppl`, `train_tokens`, `git_commit`, `data_hash`。

## 常见误区

1. **只备份 final**：final 未必 val 最优；按 PPL 选 best。
2. **Tokenizer 未随 Checkpoint 归档**：换机器推理时词表不一致。
3. **优化器与权重精度不匹配**：resume 时应用相同 precision（bf16-mixed）。
4. **上传到 Git 不用 LFS**：100MB+ 文件会被 GitHub 拒。
5. **未验证 convert 后权重**：HF 转换后跑一条 generate 对比 logits。

## 端到端实践要点

Checkpoint 是训练投资的**保险单**。云 Spot 实例、宿舍断电、OOM kill 都会让数小时算力归零；有 save_interval=1000 最多浪费一千 step。125M 模型单份 checkpoint（权重+优化器）约 1 GB，`keep_last_k=5` 占 5 GB，对现代磁盘可接受。

部署只需 HF 格式权重（~250 MB），不必上传 optimizer；但续训必须保留 optimizer 与相同 precision。转换 HF 后务必跑一条 generate 对比 LitGPT 原生输出 logits 是否一致（抽样几个 token 即可）。多格式导出（HF、GGUF）服务不同推理后端：vLLM 要 HF，Ollama 要 GGUF，提前规划避免部署时临时转换。

命名与 meta.json 是团队协作的 lingua franca：写清 step、val_ppl、data_hash、git commit，三个月后你仍知道这份权重怎么来的。不要把 checkpoint push 到 GitHub 主分支；用 Hub、S3 或至少 Git LFS。最后，best 与 final 可能不是同一份——**上线永远用 val 最优**，这是工程常识。

## 命令流水线复盘

确认 `checkpoints/pretrain/` 有多份 `step-*`；`litgpt convert_to_hf checkpoints/best --out_dir checkpoints/best-hf`；`python -c "import torch; torch.load('checkpoints/best/lit_model.pth', map_location='cpu', weights_only=True)"` 验证可读；写 `checkpoints/best/meta.json`；可选 `convert_hf_to_gguf` 得 `best-q4.gguf`。续训：`litgpt pretrain ... --resume checkpoints/pretrain/step-020000`。部署用 `best-hf/`，勿直接用含 optimizer 的目录。下一篇[跑推理](/manual/llm/bit-to-agi/10-train-your-llm/run-inference)加载 `checkpoints/best` 或 `best-hf`。

## 排错速查

convert HF 失败：LitGPT 版本与文档命令不一致。resume 步数归零：meta.json 未读。磁盘满 mid-save：corrupt 文件需删。optimizer 巨大：部署不必打包。sha 不一致：传输损坏 re-upload。

## 验收标准

本篇完成后，你应能在终端用一条命令或脚本验证关键产出存在且非空：`test -s` 查文件、`curl` 查 HTTP、`python -c` 查 import 与 shape。把验收命令写进项目 `Makefile` 或 `scripts/verify.sh`，每次改数据或权重后跑一遍，避免带着 silent failure 进入下一篇。全章二十篇都通过验收，即表示你已具备从零训小模型到部署 API 的完整能力。

## 与前后章衔接

本章每篇都假设你已读完第一至九章：比特与文件格式（第一章）解释 `train.bin` 为何是字节流；信息论（第三章）解释为何 PPL 衡量压缩效率；Transformer（第五章）解释预训练在优化什么；Tokenizer（第六章）与本章 BPE 训练一一对应；Training（第七章）给出 loss、LoRA、Checkpoint 理论；Inference（第八章）对应推理与部署；GPU（第九章）对应硬件与显存估算。若某命令报错，先查依赖版本（Python 3.11+、CUDA 驱动、PyTorch 与 vLLM 匹配），再查路径是否与 `mini-gpt-lab` 目录约定一致。整条流水线可在单卡 4090 上于一个周末跑通；失败时回到[从失败中恢复](/manual/llm/bit-to-agi/10-train-your-llm/recover-from-failure)对照症状表，不要跳过日志与 checkpoint 排查。

完成本篇后建议把关键命令与输出路径记录到 `docs/run-log.md`，便于复现与团队协作。

## 练习扩展

若时间充裕，尝试修改一个超参或配置项，观察下游指标变化并记录到 `docs/run-log.md`：例如清洗 threshold、词表大小、学习率、save 间隔或 vLLM 的 `max-model-len`。单次只改一处，才能归因。对比实验最好开 W&B 同名 project 下不同 run，用 Notes 字段标注「baseline / variant B」。这些习惯与工业界 ML 实验管理一致，比单纯跑通命令更有长期价值。

建议每篇末尾自检：关键产出文件存在、体积合理、随机抽检内容可读，再点下一篇链接。

## 小结

- 定期 `save_interval` + `keep_last_k` 控制磁盘。
- 续训需权重+优化器；部署可只导出 HF 权重。
- 用 `meta.json` 记录 step 与 val PPL，便于追溯。

→ 下一篇：[跑推理](/manual/llm/bit-to-agi/10-train-your-llm/run-inference)
