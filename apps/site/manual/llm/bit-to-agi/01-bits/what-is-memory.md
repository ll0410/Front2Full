---
title: "内存是什么"
description: "RAM、虚拟地址与页表——16 GB 权重如何映射进进程地址空间。"
source: "https://daiw.org/manual/bit-to-agi/01-bits/what-is-memory"
---

# 内存是什么

> RAM、虚拟地址与页表——16 GB 权重如何映射进进程地址空间。

「内存不够 OOM」「模型要 24 GB 显存」——这里的内存指 **RAM（随机存取存储器）**：断电即失、纳秒级读写、CPU/GPU 直接寻址的工作区。文件在磁盘上持久；**推理时权重和激活值必须在内存（或显存）里**，速度才跟得上。

## 直觉：书桌 vs 仓库

磁盘像仓库（大、慢、便宜）；内存像书桌（小、快、贵）。做数学题（计算）只能把当前要用的纸摊在书桌上；摊不下就得换页（swap）或分批（模型分片）——**慢几个数量级**。

## 定义

| 术语 | 说明 | 典型量级（现代桌面/服务器） |
| ---- | ---- | ---------------------------- |
| DRAM | 主内存，按地址随机访问 | 16–512 GB |
| VRAM | GPU 专用 GDDR/HBM | 8–192 GB（消费级到 H100/H200/B200） |
| 虚拟地址 | 进程看到的连续 0…$2^{64}-1$ 空间 | 48 bit 常用 |
| 物理页 | 通常 **4 KB** 一块，MMU 映射 | — |
| 带宽 | 字节/秒 | DDR5 ~50–100 GB/s；H100 HBM3 ~3.35 TB/s；B200 HBM3e ~8 TB/s |

**虚拟内存**：每个进程独立地址空间；OS **页表** 把虚拟页映射到物理帧或磁盘 swap。`malloc` 返回虚拟地址，首次 touch 才分配物理页。

## 例子一：加载 7B FP16 模型

权重 **14 GB** + 运行时 KV Cache（视 batch 与序列长）+ 激活 + CUDA context：

- 仅权重 14 GB → **16 GB 显卡不够**（系统还要占 1–2 GB）
- 24 GB 卡（3090/4090）可跑 7B FP16，余量给 KV
- CPU RAM 推理 7B INT4 ~4 GB 权重可行，但 **~5–20 token/s** vs GPU **~50–100+**

## 例子二：虚拟地址连续 ≠ 物理连续

```python
import numpy as np
# NumPy 数组在虚拟地址空间通常连续（便于 SIMD）
a = np.zeros((1024, 1024), dtype=np.float32)  # 4 MB
print(a.flags['C_CONTIGUOUS'])  # True
# 底层仍由 OS 按页映射；物理页可能分散
```

矩阵连续存储（后文）是为了 **cache line** 和 DMA 友好，不是物理磁盘式连续。

## 量化：内存预算公式（推理粗算）

**权重**：参数量 × 字节/参数（FP16=2，INT4≈0.5）

**KV Cache**（Transformer decoder，粗算）：
$$\text{KV} \approx 2 \times L \times n_{kv} \times d_{\text{head}} \times \text{seq\_len} \times \text{batch} \times \text{bytes}$$

$L$ 层数，factor 2 是 K 和 V，$n_{kv} \times d_{\text{head}}$ 是**每层每 token 的 KV 宽度**。

::: warning

**这里有个几乎人人踩的坑：别拿 $d_{\text{model}}$ 当 KV 宽度。**

现代模型普遍用 **GQA**（多个 attention 头共享一组 KV 头，第 8 章细讲）。Llama 3 8B 有 **32 个 attention 头，但只有 8 个 KV 头**：KV 宽度是 $8 \times 128 = 1024$，而 $d_{\text{model}} = 4096$——**差 4 倍**。

更别把两者相乘（$d_{\text{model}} \times n_{kv}$）——那是把 head 维算了两遍，差 32 倍。

:::

Llama 3 8B：$L=32$，$n_{kv}=8$，$d_{\text{head}}=128$，seq=4096，batch=1，FP16：
$$2 \times 32 \times 8 \times 128 \times 4096 \times 1 \times 2 \approx 0.5 \text{ GB}$$

即 **128 KB/token**——这个数值得记住，长上下文的账全从它来。

总 VRAM ≈ 16（权重）+ 0.5（KV）+ overhead ≈ **17 GB** 量级。

### 自己拖一下

这笔账是个乘法，而乘法的手感只能拖出来。把 context 从 4K 拖到 32K，看 KV 那一段怎么从一小截长到把卡顶爆：

<VramBudget />

## Swap 与 OOM

物理 RAM 耗尽 → OS swap 到 SSD → 延迟从 **100 ns** 跳到 **100 μs–ms**。GPU OOM 通常直接 **CUDA out of memory**，无透明 swap（Unified Memory 可 oversubscribe 但极慢）。

## NUMA 与多路服务器

双路 Xeon/EPYC 有 **NUMA**（Non-Uniform Memory Access）：CPU0 本地内存快，访问 CPU1 本地内存慢 **~1.5–2×**。大模型 CPU 推理绑核 + **numactl --membind** 可省 **10–20%** 延迟。GPU 服务器 CPU 侧 DataLoader 同样受益。

**Unified Memory**（CUDA）：CPU/GPU 共享虚拟地址，oversubscribe 显存时 page migrate 到 host——**能跑但极慢**，只适合 prototyping。

## 显存与内存的统一视角

| 资源 | 典型容量 | 带宽 |
| ---- | -------- | ---- |
| DDR5 系统 RAM | 128 GB | ~80 GB/s |
| RTX 4090 / 5090 GDDR6X/GDDR7 | 24 / 32 GB | ~1.0 / ~1.79 TB/s |
| H100 / H200 / B200 HBM3/3e | 80 / 141 / 192 GB | ~3.35 / ~4.8 / ~8.0 TB/s |
| H100 HBM3 | 80 GB | ~3.35 TB/s |

7B INT4 **~4 GB** 权重可放消费级 GPU；70B INT4 **~35 GB** 需 A100 80GB 或 **CPU offload**（权重放 RAM，逐层拷 GPU 算——token/s 个位数）。**内存/显存预算表**是部署第一页 checklist。

## Swap 与 zram：内存不够时的比特去向

Linux **swap** 把冷页写到 SSD；**zram** 在 RAM 里压缩页（算法如 lzo/zstd）——适合内存略不够、SSD 慢的场景。训练大模型 **禁止依赖 swap**；一步 backward 随机访问全权重，swap 导致 **分钟级 stall**。

**Gradient checkpointing**：不存全部中间激活，forward 时重算——用 **额外 FLOPs 换 RAM/VRAM bit 容量**，典型省 **30–50%** 激活内存，训练慢 **~20–33%**。

## 场景实战：算一张 A100 80GB 能跑多长 context

Llama 3 8B FP16 权重 **16 GB**，余 **~64 GB** 给 KV 与 overhead。KV 公式 $2 L\, n_{kv} d_{head} \cdot \text{seq} \cdot batch \cdot 2$ bytes，$L=32, n_{kv}=8, d_{head}=128$（GQA，KV 宽度是 $n_{kv} \times d_{head}=1024$，**不是** $d_{model}=4096$）：seq=32768 batch=1 → 每 token 128 KB × 32768 ≈ KV **4 GB**——**context 与权重争同一 VRAM bit 池**。INT4 权重 **4 GB** 则 context 可翻倍——**量化首先省的是 weight bit，间接释放 KV 空间**。

CPU RAM 跑 7B INT4：**4 GB 权重 + OS + Python** 需 **8 GB+** 机器；16 GB 笔记本可行但 token/s **个位数**。

## 常见误区

1. **「内存和硬盘都是存储，差不多」**——带宽差 **100–1000×**，延迟差 **10⁵×** 量级。
2. **「free 显示还有很多就能开新进程」**——Linux 会用空闲 RAM 做 page cache；`available` 才靠谱。
3. **「显存大就只放更大的模型」**——长上下文 KV 线性涨，batch 也线性涨。

## 动手试一试

看本进程 RSS 与数组占用：

```python
import numpy as np
try:
    import psutil, os
    proc = psutil.Process(os.getpid())
    print("RSS before MB:", proc.memory_info().rss / 1e6)
    big = np.zeros((2000, 2000), dtype=np.float64)  # 32 MB
    print("RSS after MB:", proc.memory_info().rss / 1e6)
    print("array MB:", big.nbytes / 1e6)
except ImportError:
    x = np.zeros((2000, 2000))
    print(x.nbytes / 1e6, "MB")
```

## 延伸思考

**Unified Memory** 与 **CPU offload**（llama.cpp `--n-gpu-layers`）都在 **VRAM bit 不够时 spill 到 RAM bit**，代价是 **PCIe 或 NVLink 搬运 latency**。ZeRO-3 训练把 **optimizer state bit** 分片到多机 RAM，forward 时 **all-gather 参数 bit**——**内存层次从单机扩展到集群**。规划 405B 训练时，**内存/显存/网络** 三条 bit 管道同时饱和；只加 GPU 不加 **NVLink/IB 带宽** 会 **comm-bound**。

## 补充：Swap 与 training

**Never train with swap active**——若 `vmstat` 见 si/so 非零，训练 step 时间会从 **秒变分钟**。**Activation checkpointing** 与 **ZeRO** 是正路；swap 是 **把 RAM bit 暂存到磁盘 bit**，延迟 **$10^5$×** 级，不适合 iterative gradient 访问模式。

## 温故：内存规划 checklist

部署前填表：**权重 GB** + **KV GB（max seq × batch）** + **激活峰值 GB** + **2 GB OS/driver** ≤ **VRAM/RAM**。不够则：**量化**、**减 context**、**GQA/MQA**、**offload**、**TP 分片**——全是 **在 bit 容量约束下换时间或精度** 的旋钮。

## 小结

内存是 CPU/GPU 的高速工作区：虚拟地址、物理页、带宽与容量共同约束 AI 能跑多大模型、多长上下文。权重与 KV 的字节账算不清，部署必踩 OOM。**HBM 带宽** 常比 **容量** 更早成为 decode 瓶颈——规划 serving 时两个数字都要看。

动手作业：打开 `nvidia-smi` 或活动监视器，对照本章公式估算当前进程的 **权重与 KV 占用**，误差在一个数量级内即合格。

**Page fault** 首次 touch 分配物理页；大 mmap 模型启动时有 **延迟尖峰**。

**KV cache 量化**（FP8/INT8/FP4）是长上下文 Serving 的主流方向之一。

**Gradient checkpointing** 用算力换激活 bit，训练大模型常用。

**Activation** 峰值常出现在 **中间层 width 最大处**（如 FFN 4× hidden）；算显存时别只算权重与 KV，要留 **20–30% 给激活与 workspace**。

**CPU offload** 每层 forward 多一次 **PCIe round-trip**，只适合权重大于算力的超大模型。

**zombie CUDA context** 占 VRAM 不释放；`nvidia-smi` 查无进程但 memory used 高时常见。

## 第一章衔接

本章用 **bit 语言** 描述 AI 底座；第二章 **[数学](/manual/llm/bit-to-agi/02-math)** 用 **向量与矩阵** 重述同一物理过程。两章对照读：**bytes 是存储，FLOPs 是计算，带宽是瓶颈**——三个量构成工程三角。

下一篇：[Cache 是什么](/manual/llm/bit-to-agi/01-bits/what-is-cache)——为何矩阵布局影响「有效内存速度」。**Unified Memory oversubscribe** 适合 demo，不适合 SLA 生产；用户 P99 latency 敏感时，**权重与 KV 必须物理在 VRAM**。
