---
title: "硬件规划"
description: "从 Bit 到 AGI · 第十章：自己训练一个模型 · 硬件规划"
source: "https://daiw.org/manual/bit-to-agi/10-train-your-llm/hardware-planning"
---

# 硬件规划

> 从 Bit 到 AGI · 第十章：自己训练一个模型 · 硬件规划

选 GPU、估显存、决定是否多机——硬件规划决定你能否在预算内跑完流水线。本篇给出 125M 到 7B 的显存公式、推荐卡型与云实例对照表。

## 直觉：选多大的锅

模型是食材，GPU 显存是**锅的容量**。锅太小（OOM）装不下；锅太大（A100 训 125M）浪费租金。还要考虑 **HBM 带宽**——同样 24 GB，4090 训小模型足够，70B 全参微调不够。

## 定义

显存估算（训练，AdamW，bf16 权重）：

$$
\text{VRAM} \approx \underbrace{2 \times P}_{\text{weights+grad}} + \underbrace{12 \times P}_{\text{Adam states}} + \underbrace{A}_{\text{activations}}
$$

$P$ = 参数量（bytes，bf16 每参数 2 bytes 只算权重部分；上式用参数个数 × 字节估算时简化为）：

更实用的 **经验公式**（bf16 + Adam + 无 ZeRO）：

$$
\text{VRAM (GB)} \approx \frac{16 \times \text{params}}{10^9} + \text{activation}
$$

| 模型 | 权重+opt 约 | activation (batch=1, seq=2048) |
| ---- | ----------- | ------------------------------ |
| 125M | ~2 GB | ~2 GB |
| 7B | ~28 GB | ~4–8 GB |
| 70B | ~280 GB | 需 ZeRO-3 / 多卡 |

LoRA 只训 ~0.1% 参数，7B LoRA **~18 GB** 可训。

## 例子

**例 1：查本机 GPU**

```bash
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv
python << 'EOF'
import torch
print("cuda:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("device:", torch.cuda.get_device_name(0))
    print("vram GB:", torch.cuda.get_device_properties(0).total_memory / 1024**3)
EOF
```

**例 2：125M 预训练配置**

| 硬件 | micro_batch | 结论 |
| ---- | ----------- | ---- |
| RTX 3060 12 GB | 2 | 可行，较慢 |
| RTX 4090 24 GB / 5090 32 GB | 4–8 | 推荐 |
| Apple M2/M3/M4 无 CUDA | — | 用 MPS 或 MLX / 云 GPU |

**例 3：7B SFT LoRA 配置**

| 硬件 | batch | 结论 |
| ---- | ----- | ---- |
| RTX 4090 24 GB / 5090 32 GB | 2–4, accum 8 | 可行 |
| A100 40/80 GB 或 H100 | 4, accum 4 | 舒适 |
| 2×4090 | DDP | 加速数据并行 |

**例 4：云实例选型（2026 参考价，按需浮动）**

| 云 | 实例 | GPU | 约 \$/h |
| -- | ---- | --- | ------ |
| AWS | g5.xlarge | 1×A10G 24GB | 1.0 |
| Lambda | 1×A100 80GB | 1×A100 | 1.5 |
| RunPod | RTX 4090 | 1×4090 | 0.4 |
| 国内 | 轻量 GPU | T4 16GB | ¥2–5/h |

```bash
# RunPod / 云启动后快速自检
ssh user@pod "nvidia-smi && df -h && pip show torch"
```

## 量化

125M 预训练 500M tokens on 4090：

| 项 | 值 |
| -- | -- |
| wall time | 6–12 h |
| 功耗 | ~450 W × 10 h = 4.5 kWh |
| 电费（¥0.8/kWh） | ~¥3.6 |

7B LoRA 5k 样本：

| 项 | 值 |
| -- | -- |
| wall time | ~45 min |
| 4090 电费 | 低于 ¥1 |

多卡扩展效率：DDP 2 卡理想 **1.9×**（通信 overhead ~5%）。

::: warning

消费级卡（4090/5090）无 HBM ECC，长跑建议 frequent checkpoint；数据中心卡（A100/H100/B200）更稳但贵。

:::

## 动手试一试

用 `accelerate` 估算最大 batch：

```bash
pip install accelerate
accelerate estimate-memory --model_name_or_path checkpoints/best-hf \
  --dtype bfloat16
```

## 分布式与多机（预览）

125M 单卡足够；7B 继续预训练需 **DDP / FSDP**：

```bash
# torchrun 2 卡 DDP 示例
torchrun --nproc_per_node=2 -m litgpt pretrain tiny \
  --out_dir checkpoints/pretrain \
  --train_data_path data/litgpt/train.bin \
  --devices 2
```

线性扩展效率约 0.85–0.95× 卡数；需 NVLink 或 InfiniBand 降低 all-reduce 延迟。

## CPU / 内存 / 磁盘

| 组件 | 125M 预训练 | 7B LoRA |
| ---- | ----------- | ------- |
| 系统 RAM | 16 GB+ | 32 GB+ |
| 磁盘 I/O | NVMe 读 bin >500 MB/s | 同左 |
| CPU 核 | DataLoader workers=4 | 4–8 |

HDD 读 bin 会成为瓶颈，tokens/s 从 100 跌到 20——语料放 SSD。

## 网络（云多节点）

多机训练需 **NCCL** 互通：同一 VPC、安全组放行 29500 端口、`NCCL_SOCKET_IFNAME=eth0`。单机用户可跳过。

## 常见误区

1. **只看显存不看带宽**：125M 算力轻；70B 推理 bound 在 HBM 带宽（见[第九章 GPU](/manual/llm/bit-to-agi/09-gpu)）。
2. **CPU RAM 不足**：DataLoader `num_workers=4` 预加载 token 需 **32 GB+ 系统内存** 训大语料。
3. **NVLink 不存在仍做 TP**：PCIe 多卡 tensor parallel 通信慢。
4. **笔记本 GPU 长时间 100%**：注意散热降频；桌面机清灰。
5. **云盘 IOPS 不足**：AWS gp3 默认 3000 IOPS，大语料随机读需 provisioned IOPS。

## 端到端实践要点

硬件规划把第九章 GPU 理论换成**采购清单**。125M 预训练：1×24 GB 消费卡足够；7B LoRA：同卡；7B full FT：40 GB+ 或多卡。显存公式「16×参数量(GB)+激活」是 bf16+Adam 粗算；LoRA 只训少量参数，optimizer 状态小很多。

带宽对小模型不重要，对 70B 推理是瓶颈——本章规模可忽略。系统 RAM 16 GB 训 125M 够，32 GB 训 7B LoRA 更稳。磁盘要 NVMe：HDD 读 bin 拖垮 tokens/s。云选型 RunPod 4090 性价比训小模型；A100 适合大 batch 7B。

多机 DDP 是预览：125M 不需要。买 GPU 前用 `accelerate estimate-memory` 试最大 batch。消费卡无 ECC，长跑 frequent checkpoint；数据中心卡更稳。别用笔记本 GPU 24×7 训——散热降频后 wall time 翻倍。

## 命令流水线复盘

`nvidia-smi` 与 `python -c "import torch; print(torch.cuda.get_device_name(0))"` 确认 GPU；对照本篇表格选 micro_batch；云租机：`ssh` 登录后同样命令；`accelerate estimate-memory --model_name_or_path checkpoints/best-hf` 试上限。125M 预训练无需多卡。下一篇[成本估算](/manual/llm/bit-to-agi/10-train-your-llm/cost-estimation)把 GPU 小时换成美元。

## 排错速查

accelerate OOM 误报：关闭其他占 GPU 进程。云机无 GPU：选 GPU 实例而非 CPU。MPS 训练慢：Mac 仅适合 smoke。PCIe 多卡慢：125M 用单卡即可。磁盘满：bin 与 checkpoint 占 tens of GB。

## 验收标准

本篇完成后，你应能在终端用一条命令或脚本验证关键产出存在且非空：`test -s` 查文件、`curl` 查 HTTP、`python -c` 查 import 与 shape。把验收命令写进项目 `Makefile` 或 `scripts/verify.sh`，每次改数据或权重后跑一遍，避免带着 silent failure 进入下一篇。全章二十篇都通过验收，即表示你已具备从零训小模型到部署 API 的完整能力。

## 与前后章衔接

本章每篇都假设你已读完第一至九章：比特与文件格式（第一章）解释 `train.bin` 为何是字节流；信息论（第三章）解释为何 PPL 衡量压缩效率；Transformer（第五章）解释预训练在优化什么；Tokenizer（第六章）与本章 BPE 训练一一对应；Training（第七章）给出 loss、LoRA、Checkpoint 理论；Inference（第八章）对应推理与部署；GPU（第九章）对应硬件与显存估算。若某命令报错，先查依赖版本（Python 3.11+、CUDA 驱动、PyTorch 与 vLLM 匹配），再查路径是否与 `mini-gpt-lab` 目录约定一致。整条流水线可在单卡 4090 上于一个周末跑通；失败时回到[从失败中恢复](/manual/llm/bit-to-agi/10-train-your-llm/recover-from-failure)对照症状表，不要跳过日志与 checkpoint 排查。

完成本篇后建议把关键命令与输出路径记录到 `docs/run-log.md`，便于复现与团队协作。

## 练习扩展

若时间充裕，尝试修改一个超参或配置项，观察下游指标变化并记录到 `docs/run-log.md`：例如清洗 threshold、词表大小、学习率、save 间隔或 vLLM 的 `max-model-len`。单次只改一处，才能归因。对比实验最好开 W&B 同名 project 下不同 run，用 Notes 字段标注「baseline / variant B」。这些习惯与工业界 ML 实验管理一致，比单纯跑通命令更有长期价值。

建议每篇末尾自检：关键产出文件存在、体积合理、随机抽检内容可读，再点下一篇链接。

遇到问题先查日志与磁盘空间，再查本章排错速查表。

## 小结

- 125M 预训练：1×24 GB；7B LoRA：1×24 GB；7B full：需 40 GB+ 或多卡。
- 显存 ≈ 16×参数量(GB) + 激活；LoRA 大幅降低需求。
- 云 GPU 按小时租；4090 / 5090 训小模型性价比突出。

→ 下一篇：[成本估算](/manual/llm/bit-to-agi/10-train-your-llm/cost-estimation)
