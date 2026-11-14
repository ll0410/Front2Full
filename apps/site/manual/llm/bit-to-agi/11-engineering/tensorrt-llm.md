---
title: "TensorRT-LLM"
description: "从 Bit 到 AGI · 第十一章：工程化（Serving） · NVIDIA 编译级 LLM 推理 TensorRT-LLM"
source: "https://daiw.org/manual/bit-to-agi/11-engineering/tensorrt-llm"
---

# TensorRT-LLM

> 从 Bit 到 AGI · 第十一章：工程化（Serving） · NVIDIA 编译级 LLM 推理 TensorRT-LLM

vLLM 和 SGLang 是「解释执行」：PyTorch 算子 + 运行时调度。当你把延迟压到极限、要在 **H100 / H200 / B200 / L40S** 上榨干 Tensor Core，就需要 **编译**——把模型图融合、量化、选最优 kernel，生成不可改但极快的 **TensorRT Engine**。TensorRT-LLM 是 NVIDIA 官方的这条路径。

## 直觉

vLLM 像**现场编排的爵士乐队**——灵活，即兴改曲。TensorRT-LLM 像**预录的 studio 母带**——建 engine 时要花几小时，但播放（推理）时每个音符都经过声学工程师（编译器）优化。代价：换模型、改 seq len 上限、改 batch size 往往要 **rebuild engine**。

```mermaid
flowchart LR
  HF[HuggingFace 权重] --> BUILD[trtllm-build]
  BUILD --> ENGINE[.engine 文件]
  ENGINE --> TRT[trtllm-serve / Triton]
  TRT --> API[OpenAI API / gRPC]
```

## 定义

**TensorRT-LLM** = NVIDIA 的 LLM 推理 SDK，包含：

| 模块 | 作用 |
| ---- | ---- |
| Model Definition | 各架构（Llama、GPT、Mixtral…）的 TRT 算子实现 |
| Builder | 图优化、kernel 自动调优、量化（FP8/INT8/INT4 AWQ/GPTQ） |
| Runtime | In-flight batching、Paged KV、Multi-GPU（TP/PP） |
| Triton Backend | 与 NVIDIA Triton Inference Server 集成 |

**关键指标**：在相同硬件上相对 vLLM 的 **speedup**（常见 **1.3～2.5×** tok/s），以及 **engine build 时间**（70B 可达数小时）。

## 例子

**例 1：Llama-3-8B，单 H100 80GB，FP8**

| 引擎 | 并发 64，512 in / 128 out | tok/s | TTFT P50 |
| ---- | ------------------------- | ----- | -------- |
| vLLM bf16 | ~3 200 | ~280 ms |
| TensorRT-LLM FP8 | ~5 100 | ~190 ms |
| TensorRT-LLM INT4 AWQ | ~6 800 | ~210 ms |

FP8 在 H100 上利用 **Transformer Engine**，精度损失通常 < 0.5% on MMLU（需自家 eval 验证）。

**例 2：构建与启动**

```bash
# 1. 转换 HF 权重并 build engine
python convert_checkpoint.py --model_dir ./Llama-3-8B-Instruct \
  --output_dir ./tllm_checkpoint --dtype float16

trtllm-build --checkpoint_dir ./tllm_checkpoint \
  --output_dir ./engines/llama3-8b-fp8 \
  --gemm_plugin float16 \
  --max_batch_size 128 \
  --max_input_len 8192 \
  --max_seq_len 9216 \
  --use_fp8_context_fmha enable

# 2. 启动服务
trtllm-serve serve ./engines/llama3-8b-fp8 \
  --host 0.0.0.0 --port 8001
```

**例 3：Llama-3-70B，4×H100 TP=4，INT4**

| 指标 | 数值 |
| ---- | ---- |
| 吞吐（并发 32） | ~2 200 tok/s |
| TTFT P95（2K in） | ~1.4 s |
| Engine 体积 | ~38 GB（4 卡各一份 shard） |
| Build 时间 | ~2.5 h（含 auto-tuning） |

## 量化

**Engine 参数锁定**：`max_batch_size`、`max_input_len`、`max_seq_len` 在 build 时写死。运行时超出会 reject 或 truncate——生产必须按 **P99 prompt 长度 + 20% headroom** 设定。

**FP8 算力**（H100 SXM）：

- bf16 峰值 ~990 TFLOPS（dense）
- FP8 峰值 ~1 979 TFLOPS（with sparsity 更高）

实际 LLM decode 受 **内存带宽** 限制（~3.35 TB/s HBM3），INT4/FP8 的主要收益是 **权重更小 → 带宽压力下降 → 更高 batch**。

**成本对比**（同等 SLO，70B 对话）：

| 方案 | GPU 数 | 月成本（按需 \$3/GPU-h） |
| ---- | ------ | ----------------------- |
| vLLM bf16 TP=4 | 4×A100 | ~\$8 640 |
| TRT-LLM INT4 TP=4 | 4×H100 | ~\$10 300（但 QPS **~1.8×** → 等效 **~\$5 700**/等效吞吐） |

::: info

TensorRT-LLM 与 Triton 组合是 NVIDIA 企业客户的标准栈；云厂商托管（如 NIM）底层也是类似编译管线。

:::

## 常见误区

1. **「编译一次永久用」**——CUDA / driver / TRT-LLM 版本升级常需 rebuild；CI 里应存 build 脚本而非只存 engine 二进制。
2. **「INT4 一定比 FP8 快」**——极短输出、小 batch 时 dequant 开销可能抵消收益；用 benchmark 而非假设。
3. **「只能在 NVIDIA 上跑」**——正确，且无 ROCm 移植；AMD 路线看 vLLM / SGLang。
4. **「比 vLLM 麻烦就不值得」**——当单卡 tok/s 差 **40%** 就意味着少买 **40% GPU**；10 卡以上集群通常值得投入编译流水线。

## 生产 Checklist

TensorRT-LLM 运维重心在 **engine 生命周期**：

1. **Build 流水线**：CI 存 `convert_checkpoint.py` 参数 + git SHA；engine 二进制放 object storage，按 `{model}-{quant}-{max_seq}-{commit}` 命名。
2. **参数 headroom**：`max_input_len` = P99 prompt × **1.2**；`max_batch_size` 覆盖峰值并发 ÷ 每 engine 舒适 batch。
3. **A/B 与回滚**：新 engine 先 shadow 100% 流量 24 h，对比 tok/s 与 output 一致性（logprob diff < 1e-3）。
4. **驱动锁定**：Node 镜像 pin NVIDIA driver + CUDA + TRT-LLM 三元组；升级任一需完整 regression build。
5. **多 region**：engine **不能跨架构**（H100 vs A100）；每 region 独立 build，避免拉错 artifact。

**Break-even 估算**：团队 **≥6 GPU** 且需 **+40% tok/s** 时，投入 0.5 FTE 维护 build 流水线通常 **3～6 月** 回本。

## 动手试一试

```bash
# 用官方 benchmark（需已 build engine）
python benchmarks/cpp/benchmark \
  --engine_dir ./engines/llama3-8b-fp8 \
  --batch_size 32 \
  --input_output_len "512,128" \
  --warm_up 10 \
  --num_runs 100
```

记录 `total latency`、`seq throughput (tokens/sec)`，与 vLLM `benchmark_serving.py` 同 prompt 分布对比。若 TRT 在 batch=1 时优势低于 10%，说明 workload 偏 latency-sensitive 小请求，优先优化 MII/vLLM 调度而非换 TRT。

## 小结

TensorRT-LLM 用 **编译 + FP8/INT4** 换极致吞吐，H100 上 8B 可达 **~5 000～6 800 tok/s**，相对 vLLM 常见 **1.3～2×** 提升；代价是 build 慢、参数写死、NVIDIA 锁定。适合延迟敏感、规模够大、团队能维护编译 CI 的场景。

→ 下一篇：[DeepSpeed](/manual/llm/bit-to-agi/11-engineering/deepspeed)
