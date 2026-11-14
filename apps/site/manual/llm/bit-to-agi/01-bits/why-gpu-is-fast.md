---
title: "GPU 为什么快"
description: "吞吐 vs 延迟、数千核心与 HBM——矩阵乘为何在 GPU 上快 100 倍。"
source: "https://daiw.org/manual/bit-to-agi/01-bits/why-gpu-is-fast"
---

# GPU 为什么快

> 吞吐 vs 延迟、数千核心与 HBM——矩阵乘为何在 GPU 上快 100 倍。

同样算 $4096 \times 4096$ 矩阵乘，CPU 可能要 **数百毫秒**，GPU 常 **几毫秒**——不是晶体管更快，而是**并行度与带宽**完全不同。AI 训练推理几乎默认 GPU，本篇用数量级解释原因，并澄清 GPU 不擅长什么。

## 直觉：一支精兵小队 vs 万人方阵

CPU 像 **8–128 个** 极强特种兵（复杂分支、大 cache、乱序执行），优化**单线程延迟**。GPU 像 **数千个** 普通步兵同时做同一指令、打不同数据（**SIMT**），优化**总吞吐量**。矩阵乘每个输出元素独立，完美匹配「万人同时做乘法」。

## 定义

| 指标 | 典型 CPU（16 核） | 典型 GPU（RTX 4090/5090、A100/H100/B200） |
| ---- | ----------------- | --------------------------- |
| 并行线程 | 16–32 硬件线程 | **10⁴–10⁵** 软件线程 |
| FP32 峰值 | ~1–2 TFLOPS | 4090 ~**83 TFLOPS**；A100 ~**19.5 TFLOPS**（Tensor 更高） |
| 内存带宽 | ~50–100 GB/s | 4090 ~**1 TB/s**；A100 HBM ~**2 TB/s** |
| 单线程延迟 | 低 | 高（调度、同步开销） |

**SIMT**（Single Instruction Multiple Threads）：warp（32 线程） lockstep 执行同一条指令，数据指针不同。

## 例子一：GEMM 为何适合 GPU

$C = A \times B$，$A$ 为 $M \times K$，$B$ 为 $K \times N$。每个 $C_{ij}$ 是 $K$ 次乘加——**$M \times N$ 个独立任务**。GPU 启动 $M \times N / 32$ 个 warp 分工；cuBLAS/ CUTLASS 再分 **tile**  fit 共享内存。

$4096^3$ GEMM FP32 运算量 $\approx 2 \times 4096^3 \approx 1.37 \times 10^{11}$ FLOPs。A100 若 50% peak 10 TFLOPS → **~14 ms** 理论下限；CPU 1 TFLOPS → **~137 ms**。

## 例子二：GPU 不擅长什么

```python
# 分支杂乱、串行依赖 — GPU 差
def collatz(n):
    while n != 1:
        n = n // 2 if n % 2 == 0 else 3 * n + 1
    return n
```

- **小 batch 推理**：kernel launch 固定开销 ~**5–20 μs**，batch=1 时 GPU 吃不饱。
- **复杂 if/else**：warp 内分支 diverge，两条路径都要跑，mask 掉一半线程。
- **频繁 CPU↔GPU 拷贝**：PCIe 4.0 x16 ~**32 GB/s**，远慢于 HBM。

## Tensor Core

NVIDIA Volta 起 **Tensor Core** 做 $4 \times 4$ 或更大 **矩阵乘累加**（WMMA），FP16/BF16/INT8/FP8 混合精度。Llama 训练/推理实际 FLOPS 常按 Tensor Core 峰值算，非标量 CUDA core。

H100 FP8 峰值可达 **~2,000 TFLOPS**（稠密）、Blackwell B200 FP8/FP4 可达 **~4,500 / 9,000 TFLOPS** 量级；实际 sustained 受 memory roofline 限制。

## 与 AI 栈

| 阶段 | GPU 角色 |
| ---- | -------- |
| 预训练 | 万卡集群，NVLink 组网 |
| 微调 | 1–8 卡，LoRA 减显存 |
| 推理 | vLLM continuous batching 提高占用 |
| 边缘 | 无 GPU 则 CPU/NNAPI，慢 10–100× |

## Warp 与 Occupancy

NVIDIA GPU 以 **warp = 32 线程** 为调度单位。SM（Streaming Multiprocessor）上可同时驻留多个 warp 隐藏 **memory latency**。**Occupancy** = 活跃 warp / 最大 warp；过低则算力空闲等内存。

Register spill：单线程寄存器用太多 → 溢出到 local memory（其实在 DRAM）→ 性能暴跌。CUDA kernel 调 `__launch_bounds__` 平衡 register vs occupancy。

## CPU vs GPU 分工（推理 pipeline）

典型 vLLM 请求路径：**CPU** tokenize → 组 batch → **GPU** forward → **CPU** detokenize + HTTP 响应。GPU 利用率靠 **continuous batching** 凑满 batch；空闲 GPU 常是 batch 太小或 waiting I/O。

**PCIe Gen4 x16** ~32 GB/s：传 7B FP16 权重 **14 GB** 需 **~0.45 s** 纯拷贝——**权重放 GPU 常驻** 是 serving 默认；仅 CPU 推理免拷贝但算慢 **50–100×**。

## Multi-GPU：NVLink 与 All-Reduce

8× H100 训练用 **NVLink/NVSwitch** 互联，GPU-GPU **900 GB/s** 量级，远高于 PCIe。梯度 **all-reduce** 每 step 传 **2×模型大小** 梯度 bit（ring 算法可优化常数）——**通信 bit 与计算同样计费**。

推理 **Tensor Parallel** 切 weight 列/行到多卡，每 token 需 **all-reduce 激活**；适合单模型太大单卡放不下，但 **latency** 高于单卡——70B TP=8 常见。

## 场景实战：Llama.cpp 在 Mac 上为何能跑

**GGUF** 格式把 INT4/INT8 权重 + metadata 打包成单文件；**llama.cpp** 用 **Metal**（Apple GPU）或 **AVX** 做 GEMV/GEMM。70B INT4 **~35 GB** 文件 mmap 进内存，M2 Max **96 GB** 统一内存可装下——**CPU/GPU 共享物理 bit 池**，无 PCIe 拷贝。速度 **~10 token/s** vs A100 **~100+**，但证明 **bit 级模型 + 合适程序 = 本地可运行**。

消费级 **8 GB** 显存跑 7B 必须 INT4 + 短 context；**bit 预算表**决定产品形态，不是「模型聪不聪明」。

## 常见误区

1. **「GPU 核数 = CUDA cores 数字」**——那是标量 ALU；有效并行看 occupancy、warp、SM 数量。
2. **「买高价 GPU 一定能大幅加速单用户推理」**——LLM 推理常 **memory bound**（读权重）；H100/H200/B200 优势在 HBM 带宽 + FP8/FP4 + 大显存。
3. **「CPU 完全没用」**——数据加载、tokenization、调度、小算子仍在 CPU；瓶颈常在 pipeline 未 overlap。

## 动手试一试

粗测 matmul（需 PyTorch + CUDA）：

```python
import torch, time
if torch.cuda.is_available():
    n = 4096
    a = torch.randn(n, n, device="cuda", dtype=torch.float16)
    b = torch.randn(n, n, device="cuda", dtype=torch.float16)
    torch.cuda.synchronize()
    t0 = time.perf_counter()
    for _ in range(10):
        c = a @ b
    torch.cuda.synchronize()
    print("GPU avg ms", (time.perf_counter()-t0)*100)
else:
    print("无 CUDA，跳过")
```

## 延伸思考

**Amdahl 定律**：若 tokenize 占 10% 时间且无法 SIMD，整体加速上限 **10×** 无济于事——**pipeline profiling** 看 **CPU/GPU 谁等谁**。**CUDA Graph** 减 launch overhead 对 **小 batch decode**  crucial；**FlashDecoding** 对 long context **并行 KV 读**。买 H100 若 **batch=1 在线服务**，常 **memory bandwidth bound**，峰值 TFLOPS **用不满**——**GPU 选购要 match workload bit pattern**。

## 补充：功耗与 bit 搬运

H100 **700 W TDP** 大头是 **HBM refresh + FLOPs**；**idle GPU** 仍耗 **数十 W**——keep-warm 集群 **空转也费电**。**每 Joule 能搬多少 byte、算多少 FLOP** 是 datacenter PUE 与 **\$/token** 的物理根。**LPU/ASIC** 把 GEMM **硬化**，省 **fetch-decode 通用指令 bit**——专用芯片 = **narrower 程序 bit + 固定 datapath**。

## 温故：选 GPU 看三个数

买卡或租云 GPU 时列 **TFLOPS（Tensor 精度）**、**VRAM GB**、**内存带宽 TB/s**——与本章 roofline 一致。7B 推理 batch 小：**带宽和显存** 优先；70B 训练：**NVLink 与显存** 优先；超大 batch 预训练：**算力峰值** 才吃满。**三个数都来自 bit 搬运与 bit 运算速度**。

## 读完带走

GPU 赢 **吞吐**，CPU 赢 **单线程延迟 + 分支**。LLM decode **memory-bound** 常见；prefill **compute-bound** 可能。**Tensor Core** 吃 **FP16/BF16/INT8**；消费决策看 **VRAM、带宽、MFU** 三角。

## 小结

GPU 快在**大规模数据并行 + 高内存带宽 + Tensor Core**，慢在单线程与分支。AI 的核心是矩阵运算，天然贴合 GPU；理解吞吐与延迟分工，才懂何时用 CPU、何时用 GPU。**小模型 edge 场景** 未必需要 GPU——INT8 CPU + SIMD 可能 **watt/\$ 更优**。**MFU 40–55%** 在大模型训练是正常，不是实现烂。**Decode batch=1** 时 GPU 空转是 **workload 特性**，不是「没优化好」。

动手作业：打开 `nvidia-smi` 或活动监视器，对照本章公式估算当前进程的 **权重与 KV 占用**，误差在一个数量级内即合格。

**Warp diverge** 时两条分支都执行，有效线程减半。

**Multi-instance GPU**（MIG）把一张卡切成多份 VRAM 池，共享算力单元。

**CUDA Graph** 减 launch overhead，固定 shape decode 常用。

**LLM serving** 优化顺序常是：量化减 weight bit → continuous batching 提占用 → FlashAttention 减 KV bit 读写 → 最后才加卡。

**TPU** 把 **systolic array** 硬化矩阵乘；哲学与 GPU 宽 SIMD 不同，问题仍是 **大矩阵**。

**ROCm** 上 AMD GPU 跑 PyTorch 哲学相同：大矩阵 + 高带宽。

## 第一章衔接

本章用 **bit 语言** 描述 AI 底座；第二章 **[数学](/manual/llm/bit-to-agi/02-math)** 用 **向量与矩阵** 重述同一物理过程。两章对照读：**bytes 是存储，FLOPs 是计算，带宽是瓶颈**——三个量构成工程三角。

下一篇：[SIMD 是什么](/manual/llm/bit-to-agi/01-bits/what-is-simd)——CPU 侧的「小矩阵并行」。**MFU**（Model FLOPs Utilization）= 实际 FLOPs / 峰值 FLOPs；H100 训练 LLM 常见 **40–55%**——**never 100%**，memory 与 launch 开销是常态，不是实现 bug。
