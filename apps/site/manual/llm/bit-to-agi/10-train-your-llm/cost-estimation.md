---
title: "成本估算"
description: "从 Bit 到 AGI · 第十章：自己训练一个模型 · 成本估算"
source: "https://daiw.org/manual/bit-to-agi/10-train-your-llm/cost-estimation"
---

# 成本估算

> 从 Bit 到 AGI · 第十章：自己训练一个模型 · 成本估算

租 GPU、买存储、跑电——训练有明确账单。本篇用 **FLOPs × 电价 / 云单价** 估算 125M 预训练与 7B LoRA 的总成本，并对比「自训 vs 调 API」的 break-even 点。

## 直觉：自驾 vs 打车

自训模型像买车： upfront 高、开多了便宜。调 OpenAI API 像打车：按 token 计费、零运维。用户量小时 API 划算；**日调用百万次** 或 **数据不能出境** 时自训更合算。

## 定义

训练算力（粗算，Kaplan/Chinchilla 常数）：

$$
\text{FLOPs} \approx 6 \times N_{\text{params}} \times N_{\text{tokens}}
$$

125M × 500M tokens：

$$
6 \times 1.25 \times 10^8 \times 5 \times 10^8 = 3.75 \times 10^{17}\ \text{FLOPs} = 375\ \text{PFLOPs}
$$

GPU 有效算力（考虑 30–50% MFU）：

$$
T \approx \frac{\text{FLOPs}}{\text{GPU TFLOPS} \times \text{MFU} \times 3600}
$$

RTX 4090 bf16 ~330 TFLOPS，MFU 0.35：

$$
T \approx \frac{3.75 \times 10^{17}}{330 \times 10^{12} \times 0.35 \times 3600} \approx 0.9\ \text{小时（纯算）}
$$

实际含 I/O 约 **6–12 小时**（MFU 降至 ~0.05–0.10 端到端）。

## 例子

**例 1：电费成本（自有 4090）**

```python
hours = 10
watts = 450
kwh = hours * watts / 1000
price_per_kwh = 0.8  # 元
print(f"电费: {kwh * price_per_kwh:.1f} 元")  # ~3.6 元
```

**例 2：云 GPU 成本**

```python
scenarios = [
    ("RunPod 4090", 0.44, 10),
    ("AWS A10G", 1.0, 8),
    ("Lambda A100", 1.5, 5),
]
for name, usd_per_h, hours in scenarios:
    print(f"{name}: ${usd_per_h * hours:.2f}")
# 4090: $4.40, A10G: $8.00, A100: $7.50
```

**例 3：7B LoRA SFT**

| 项 | 值 |
| -- | -- |
| tokens  processed | ~5k × 512 ≈ 2.5M |
| FLOPs | $6 × 7 \times 10^9 \times 2.5 \times 10^6 ≈ 1.05 \times 10^{17}$ |
| 4090 时间 | ~45 min |
| 云成本 | **低于 \$0.50** |

**例 4：推理成本 vs API**

```python
# 自托管 vLLM 125M：忽略 GPU 折旧，仅电费
tokens_per_day = 1_000_000
# 125M @ 100 tok/s → 1M tok ≈ 2.8 h GPU
daily_kwh = 2.8 * 0.45
daily_elec = daily_kwh * 0.8
print(f"自托管日电费 ~{daily_elec:.1f} 元")

# API 对比（价格示意，以官网为准）
api_price_per_1m = 0.15  # USD input+output blended
daily_api_usd = tokens_per_day / 1_000_000 * api_price_per_1m * 2  # 简算
print(f"API 日费 ~${daily_api_usd:.2f}")
```

1M tokens/天：自训 125M 电费 **~1 元/天**；旗舰闭源 API（如 GPT-5 / Claude Sonnet 4.6）**数美元到数十美元/天**——但 125M 质量不可比旗舰模型，对比的是 **同等质量模型** 的自托管 vs API。

**例 5：总拥有成本（TCO）表格**

| 项目 | 125M 实验 | 7B 产品 LoRA |
| ---- | --------- | ------------ |
| 数据 | 免费开源 | 免费 + 人工标注 ¥ |
| 预训练 GPU | \$5–10 云 | 跳过（用基座） |
| SFT GPU | — | \$1–5 |
| 存储 | \$0 本地 | Hub 免费 |
| 运维 | 业余 | 部署 \$20–50/月 |
| **合计** | **低于 \$20** | **低于 \$100 起步** |

## 量化

Chinchilla 最优：$N_{\text{tokens}} \approx 20 \times N_{\text{params}}$。125M 应用 **2.5B tokens** 才算「算力配平」；本章 500M 是**预算内实验**，非最优 scaling。

| 规模 | 推荐 tokens | 4090 小时 | 云 \$ |
| ---- | ----------- | --------- | ---- |
| 125M | 0.5–2.5B | 10–50 | 5–25 |
| 1B | 20B | 200+ | 100+ |
| 7B CPT | 100B+ | 多卡周级 | 1000+ |

::: info

**hidden cost**：工程师时间 >> GPU 租金。教学实验用周末 + 4090；生产优先基座 + LoRA 降低 FLOPs。

:::

## 动手试一试

计算器脚本：

```bash
cat > scripts/estimate_cost.py << 'EOF'
def train_cost(params_b, tokens_b, tflops=330, mfu=0.08, usd_per_hour=0.44):
    """params_b: billions, tokens_b: billions"""
    flops = 6 * params_b * 1e9 * tokens_b * 1e9
    hours = flops / (tflops * 1e12 * mfu * 3600)
    return hours, hours * usd_per_hour

h, c = train_cost(0.125, 0.5)
print(f"125M x 500M tokens: {h:.1f} h, ${c:.2f}")
h, c = train_cost(7, 0.0025, mfu=0.3)  # LoRA effective
print(f"7B LoRA x 2.5M tokens: {h:.1f} h, ${c:.2f}")
EOF
python scripts/estimate_cost.py
```

## API 定价 break-even 详细推导

设自托管 GPU 月租 \$150（4090 云），日推理 10M tokens，125M 模型 100 tok/s：

- 日 GPU 时间：$10^7 / 100 = 10^5$ s ≈ 28 h → 需多卡或量化，**125M 不适合 10M/日生产**
- 7B 量化 Q4 单卡 50 tok/s：$10^7/50 = 2.3×10^5$ s ≈ 64 h → 仍不够

结论：**高流量生产用更大卡或 tensor parallel**；125M 适合学习，不适合与旗舰闭源 API 比成本。

7B Q4 单卡 30 tok/s、2M tokens/天：$2×10^6/30 ≈ 18.5$ h → 单卡可扛。API 价 \$0.15/1M × 2M × 2 ≈ **\$0.60/天** vs 云 GPU **\$5/天** 分摊 → 月流量低于 30M tokens 时 API 更省。

## 隐性成本清单

| 项目 | 估算 |
| ---- | ---- |
| 工程师调参 20 h | 远超 GPU 费 |
| 数据标注 1 万条 QA | ¥5000–20000 |
| W&B 团队版 | \$0–50/月 |
| 域名 + TLS | \$10/年 |
| 合规审查 | 视行业 |

## 常见误区

1. **只算训练不算迭代**：实验常跑 3–5 次才调通，预算 ×3。
2. **忽视 egress**：云盘下载 Checkpoint 到本地可能收流量费。
3. **125M 与旗舰模型比 API 价**：质量不同，break-even 无意义。
4. **忽略人力**：周末 hobby 项目 OK；企业生产 ROI 要算 PM+ML 工程师工时。
5. **Spot 实例被杀**：未 checkpoint 的算力损失 = 从头跑，应用 on-demand 跑最后 10% 步。

## 端到端实践要点

成本估算是 **Go/No-Go 决策**工具。FLOPs ≈ 6×P×T 给出算力下界；实际 wall time 除以 MFU（0.05–0.35）得真实小时数。125M×500M tokens 云成本 < \$10，适合教学；7B CPT 进千美元，别误入门槛。

隐性成本：工程师调参时间 >> GPU 租金；数据标注、合规、运维域名 TLS。API break-even 取决于日 token 量与模型质量：125M 自托管不能替代旗舰闭源 API 比价钱；同等 7B 量化模型日 2M tokens 可能 API 更省直到流量超临界。

预算乘 3 留迭代余量；Spot 被杀损失未 checkpoint 算力。Chinchilla 最优 tokens≈20×params，本章 500M 是实验非最优 scaling。记录每次 run 的 \$ 与 val PPL，建立「美元 per PPL 点下降」直觉，避免盲目加卡。

## 命令流水线复盘

运行 `scripts/estimate_cost.py`；填入你的 `usd_per_hour` 与实测 `hours`；对比 RunPod 4090 与自有电表；若日推理 >1M tokens，用本篇 API break-even 公式粗算。Go/No-Go：教学实验低于 \$20 直接做；7B CPT 先写预算审批。下一篇[发布你的模型](/manual/llm/bit-to-agi/10-train-your-llm/publish-your-model)上传 Hub 带宽成本通常可忽略。

## 排错速查

估算小时数远小于实际：MFU 取 0.05–0.10 而非 0.35。云账单超预期：忘记乘迭代次数与失败重跑。API 对比失真：用同等质量 7B 而非 125M。隐藏成本未计 W&B、存储 egress、标注人力。

## 验收标准

本篇完成后，你应能在终端用一条命令或脚本验证关键产出存在且非空：`test -s` 查文件、`curl` 查 HTTP、`python -c` 查 import 与 shape。把验收命令写进项目 `Makefile` 或 `scripts/verify.sh`，每次改数据或权重后跑一遍，避免带着 silent failure 进入下一篇。全章二十篇都通过验收，即表示你已具备从零训小模型到部署 API 的完整能力。

## 与前后章衔接

本章每篇都假设你已读完第一至九章：比特与文件格式（第一章）解释 `train.bin` 为何是字节流；信息论（第三章）解释为何 PPL 衡量压缩效率；Transformer（第五章）解释预训练在优化什么；Tokenizer（第六章）与本章 BPE 训练一一对应；Training（第七章）给出 loss、LoRA、Checkpoint 理论；Inference（第八章）对应推理与部署；GPU（第九章）对应硬件与显存估算。若某命令报错，先查依赖版本（Python 3.11+、CUDA 驱动、PyTorch 与 vLLM 匹配），再查路径是否与 `mini-gpt-lab` 目录约定一致。整条流水线可在单卡 4090 上于一个周末跑通；失败时回到[从失败中恢复](/manual/llm/bit-to-agi/10-train-your-llm/recover-from-failure)对照症状表，不要跳过日志与 checkpoint 排查。

完成本篇后建议把关键命令与输出路径记录到 `docs/run-log.md`，便于复现与团队协作。

## 练习扩展

若时间充裕，尝试修改一个超参或配置项，观察下游指标变化并记录到 `docs/run-log.md`：例如清洗 threshold、词表大小、学习率、save 间隔或 vLLM 的 `max-model-len`。单次只改一处，才能归因。对比实验最好开 W&B 同名 project 下不同 run，用 Notes 字段标注「baseline / variant B」。这些习惯与工业界 ML 实验管理一致，比单纯跑通命令更有长期价值。

## 小结

- FLOPs ≈ $6 \times P \times T$；125M×500M tokens 云成本 **低于 \$10**。
- 7B LoRA 极便宜；7B 从零 CPT 才贵。
- 推理 break-even 取决于 token 量与质量要求。

→ 下一篇：[发布你的模型](/manual/llm/bit-to-agi/10-train-your-llm/publish-your-model)
