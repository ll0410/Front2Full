---
title: "从失败中恢复"
description: "从 Bit 到 AGI · 第十章：自己训练一个模型 · 从失败中恢复"
source: "https://daiw.org/manual/bit-to-agi/10-train-your-llm/recover-from-failure"
---

# 从失败中恢复

> 从 Bit 到 AGI · 第十章：自己训练一个模型 · 从失败中恢复

训练会 OOM、loss 变 NaN、磁盘写满或节点被抢占。本篇是**故障手册**：每种错误的典型原因、恢复命令与预防配置。

## 直觉：断电续传

存档点（Checkpoint）+ 恢复（resume）= 断电后从最近存档继续，而不是从头打 Boss。关键是**知道该回滚几个 step** 还是**改超参重跑**。

## 定义

故障分类：

| 类型 | 症状 | 首要动作 |
| ---- | ---- | -------- |
| OOM | CUDA out of memory | 减 batch / 开 gradient checkpointing |
| NaN loss | loss=nan | 降 lr；查坏数据 |
| 磁盘满 | Errno 28 | 删旧 checkpoint |
| 抢占 | 进程 SIGTERM | resume 最近 save |
| 慢训 | tokens/s 低 | 查 DataLoader / 存储 |

## 例子

**例 1：OOM 恢复**

```bash
# 错误信息示例：
# torch.OutOfMemoryError: CUDA out of memory. Tried to allocate 2.00 GiB

# 方案 A：减 micro_batch
litgpt pretrain tiny \
  --micro_batch_size 2 \
  --batch_size 32 \
  --resume checkpoints/pretrain/step-010000 \
  --devices 1

# 方案 B：gradient checkpointing（LitGPT 配置或 transformers）
# --gradient_checkpointing true
```

有效 batch 不变：micro 4→2，accumulation 8→16。

**例 2：NaN 后回滚**

```bash
# 发现 step 15000 NaN，回滚到 step 12000（W&B 显示 13000 仍正常）
rm -rf checkpoints/pretrain/step-015000  # 坏 checkpoint

litgpt pretrain tiny \
  --resume checkpoints/pretrain/step-012000 \
  --lr 1e-4 \
  --devices 1
# lr 减半重试
```

**例 3：磁盘清理**

```bash
df -h .
du -sh checkpoints/pretrain/*

# 只保留 best + 最新
ls -dt checkpoints/pretrain/step-* | tail -n +4 | xargs rm -rf

# 压缩日志
gzip logs/*.log
```

**例 4：节点抢占后续训**

```bash
# SLURM / 云 Spot 实例被回收后
export WANDB_RESUME=allow
litgpt pretrain tiny \
  --resume checkpoints/pretrain/last \
  --devices 1
```

**例 5：定位坏数据**

```bash
python << 'EOF'
from tokenizers import Tokenizer
tok = Tokenizer.from_file("tokenizer/tokenizer.json")
bad = 0
with open("processed/train.txt", encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        line = line.strip()
        if not line:
            continue
        try:
            ids = tok.encode(line).ids
            if len(ids) > 100_000:
                print("too long", i, len(ids))
                bad += 1
        except Exception as e:
            print("error", i, e)
            bad += 1
print("bad lines", bad)
EOF
```

## 量化

| 故障 | 损失算力 | 恢复时间 |
| ---- | -------- | -------- |
| OOM 调 batch | 0（同 step resume） | 5 min |
| NaN 回滚 3k step | 3k steps 算力 | 10 min 启动 |
| 磁盘满 | 0 | 清理后 resume |
| 从头重训 50k step | 100% | 数小时 |

`save_interval=1000`、50k 训练 → 最多浪费 **1000 step ≈ 2%** 算力。

::: warning

**不要**在 NaN 后继续用同一 lr 硬训——权重可能已污染；回滚 + 降 lr 或 skip 可疑 batch。

:::

## 动手试一试

故意 OOM 测恢复流程：

```bash
# micro_batch_size=999 触发 OOM，确认无 corrupt checkpoint
# 再用正常 batch resume
```

## 预防性配置

训练启动前写入 `checkpoints/pretrain/run_config.yaml`：

```yaml
micro_batch_size: 4
batch_size: 32
lr: 3e-4
save_interval: 1000
keep_last_k: 5
seed: 1337
data_hash: sha256:abc123
```

灾难恢复时知道**该用什么超参 resume**。

## NCCL / 多卡故障

多卡训练 hang 在 barrier：

```bash
export NCCL_DEBUG=INFO
export TORCH_DISTRIBUTED_DEBUG=DETAIL
# 单机多卡常见 fix：
export NCCL_P2P_DISABLE=1
```

## 常见误区

1. **resume 改 batch_size 不改 accumulation**：有效 batch 变，loss 曲线不可比。
2. **坏 checkpoint 未删**：resume 加载 NaN 权重继续 NaN。
3. **Spot 实例无自动 save**：save_interval 设太大（>5000）。
4. **未测 checkpoint 完整性**：`torch.load` 前 `sha256sum lit_model.pth`。
5. **kill -9 后 optimism**：可能 corrupt 最后一份 save；保留 step- N-1000 备份。

## 端到端实践要点

失败恢复是**运维肌肉记忆**：OOM 减 micro_batch、增 accumulation；NaN 回滚 checkpoint 并降 lr；磁盘满删 old saves；Spot 被杀 resume last good。每次故障后更新 runbook 一行，团队不再重复踩坑。

预防优于恢复：`save_interval=1000`、`keep_last_k=5`、训练前 smoke 100 step、run_config.yaml 记录超参。NaN 后不要「同 lr 硬训」——权重可能已污染。多卡 hang 开 `NCCL_DEBUG=INFO`，单机常 `NCCL_P2P_DISABLE=1` 可解。

坏数据可导致 NaN：超长序列、空行、Tokenizer 编码异常。定位脚本扫 `processed/train.txt` 异常行。Checkpoint 完整性用 sha256 校验；kill -9 可能 corrupt 最后一份 save，永远保留 step-N-1000 备份。故障损失算力 = 未 checkpoint 的 step 数；Spot 用户应用 on-demand 跑最后收敛阶段。

## 命令流水线复盘

OOM：`--micro_batch_size 2 --resume step-XXX`；NaN：删坏 save，`--resume` 更早 step 且 `--lr 1e-4`；磁盘满：`ls -dt checkpoints/pretrain/step-* | tail -n +4 | xargs rm -rf`；Spot 被杀：重新起 pod 后 `--resume checkpoints/pretrain/last`。每次故障更新团队 runbook。下一篇[数据集格式](/manual/llm/bit-to-agi/10-train-your-llm/dataset-format)排查 NaN 时顺带校验 JSONL schema。

## 排错速查

resume loss spike：optimizer 未加载或 precision 变。corrupt checkpoint：删最后一份用上一份。NaN 反复：数据 bad line 或 lr 仍太大。Spot 无 save：缩小 save_interval。多卡 resume rank 错：用相同 GPU 数。

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

- OOM → 减 micro_batch 或 checkpointing；resume。
- NaN → 回滚 1–3k step + 降 lr；查坏数据。
- 磁盘 / 抢占 → 清理 + resume last good save。

→ 下一篇：[数据集格式](/manual/llm/bit-to-agi/10-train-your-llm/dataset-format)
