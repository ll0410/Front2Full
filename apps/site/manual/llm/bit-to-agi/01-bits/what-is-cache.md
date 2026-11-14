---
title: "Cache 是什么"
description: "L1/L2/L3、局部性与 cache line——为何遍历方式能差 10 倍速度。"
source: "https://daiw.org/manual/bit-to-agi/01-bits/what-is-cache"
---

# Cache 是什么

> L1/L2/L3、局部性与 cache line——为何遍历方式能差 10 倍速度。

CPU 读主内存约 **100 ns**，读 L1 Cache 约 **1 ns**——差两个数量级。Cache 是 CPU 里小块 SRAM，自动把「最近可能要用的内存」拷进来。矩阵乘法、Attention 能不能吃满算力，Often 取决于**数据是否在 Cache 里**，而不是 FLOPs 公式本身。

## 直觉：把常用工具放手边

木工不会每锯一次都跑仓库取锯子。程序访问数组时，若**连续**读 64 字节（一条 **cache line**），硬件会顺带把后面相邻数据 prefetch 进来——下次循环迭代命中 L1，极快。若**随机跳**着读，每次 miss 去 DRAM，GPU 再快也被饿死。

## 定义：内存层次

| 层级 | 典型容量 | 典型延迟 | 谁有 |
| ---- | -------- | -------- | ---- |
| L1d | 32–64 KB/核 | ~4 cycles | CPU |
| L2 | 256 KB–1 MB/核 | ~12 cycles | CPU |
| L3 | 8–64 MB 共享 | ~40 cycles | CPU |
| DRAM | 16–512 GB | ~200 cycles | 系统 |
| L2 Cache（GPU SM） | 128–256 KB/SM | ~20–30 cycles | GPU |
| HBM/GDDR | 8–192 GB | 高带宽、较高延迟 | GPU |

**局部性**：
- **时间局部性**：同一地址反复用（循环变量、累加器）。
- **空间局部性**：相邻地址接着用（行优先遍历二维数组）。

## 例子一：行优先 vs 列优先

```python
import numpy as np
import time
n = 8000
a = np.random.rand(n, n)

t0 = time.perf_counter()
s = 0.0
for i in range(n):
    for j in range(n):
        s += a[i, j]  # C 连续，行优先快
print("row-major", time.perf_counter() - t0)

t0 = time.perf_counter()
s = 0.0
for j in range(n):
    for i in range(n):
        s += a[i, j]  # 列方向跨行，慢很多
print("col-major", time.perf_counter() - t0)
```

在典型 x86 上后者可慢 **5–15×**：`a[i,j]` 与 `a[i+1,j]` 相距 `n × 8` 字节，每条 cache line（64 B）只用到 8 B。

## 例子二：Cache line 与 false sharing

两线程各写数组相邻元素，若落在**同一 64 B cache line**，MESI 协议会让 line 在核间来回 invalidation——**伪共享**，扩展性暴跌。高性能库会对齐 padding（如 `alignas(64)`）。

## 量化：roofline 直觉

算力峰值 FP32 如 15 TFLOPS，内存带宽 100 GB/s。若每 FLOP 需读 12 字节（读两个 float 写一次），**算术强度** = FLOPs/Byte ≈ 0.25，带宽上限吞吐 ≈ 25 GFLOPS——远低于 15 TFLOPS，**内存 bound**。

矩阵乘通过 **blocking/tile**（分块 fit L1/L2）提高重用，GEMM 才接近 peak FLOPS。

## AI 中的 Cache

- **FlashAttention**：减少 HBM 读写，本质是 IO-aware，把 softmax 中间结果留在 SRAM。
- **KV Cache**：名字里的 Cache 是**应用层缓存**（存历史 K/V），不是 CPU L3；但同样利用「重复读历史 token」的时间局部性。
- **权重 layout**：GPTQ/AWQ 量化按 group 排布，便于一次 cache line 读一组 weight。

## TLB 与 Huge Page

虚拟地址 → 物理地址经 **页表**；页表本身也在内存，由 **TLB**（Translation Lookaside Buffer）缓存。4 KB 页管理 16 GB 需 **4M 页表项** 活动集；**Huge Page 2 MB** 项数减 **512×**，TLB miss 降，大模型 mmap 加载常启用 `transparent_hugepage`（Linux）。

Prefetcher：硬件见顺序访问会**预取**后续 cache line；stride 规律 GEMM 受益，指针 chase 链表不受益。

## Cache 友好代码 checklist

1. 结构体热字段放一起（SoA vs AoS：粒子系统常用 **Structure of Arrays**）。
2. 避免 false sharing：padding 到 cache line 边界。
3. 分块矩阵乘：tile size 匹配 L1（**32×32 float** 量级常见）。
4. PyTorch `contiguous()` 后再 `view` 做 batch GEMM。

FlashAttention-2 论文核心 insight：**IO 复杂度**从 $O(N^2 d)$ 降到接近 $O(N^2 d / M)$，$M$ 为 SRAM 大小——把 attention 中间矩阵不写出 HBM，**算法 co-design Cache 层次**。

## 多级 Cache 与 Roofline 模型

Roofline：横轴 **算术强度**（FLOPs/Byte），纵轴 achieved GFLOPS。低于 ridge point 在 **内存屋顶** 下；高于则在 **算力屋顶** 下。LLM decode batch=1 常 memory-bound（读全权重）；prefill 大 prompt 可能 compute-bound。

L3 **共享** 于所有核；多线程 GEMM 争 L3 带宽 **线性分摊**。OpenMP `OMP_NUM_THREADS` 调太大反而因 cache thrashing 变慢——**矩阵规模与线程数需一起调**。

## 场景实战：DataLoader `num_workers=4` 在争什么

PyTorch DataLoader 多进程 **prefetch** batch：CPU 解码 JPEG、tokenize，主进程 GPU 算 forward。workers 争 **L3 与内存带宽**；`num_workers` 过大 **cache thrashing**，过小 GPU **starve**。profile 看 GPU util 低于 80% 且 CPU 未满，常是 **IO 或 decode bound**——**Cache/内存层次在训练 pipeline 全程参与**。

`pin_memory=True`：page-lock host tensor，**DMA 快拷到 GPU**——省一次 copy path，仍是 bit 搬运优化。

## 常见误区

1. **「内存大就不 cache miss」**——工作集超过 L3（几十 MB）仍 miss；7B 权重 14 GB 不可能全进 cache，流式读是常态。
2. **「GPU 没有 cache 问题」**——GPU 有 L1/L2；global memory coalesced access 类似 CPU 空间局部性。
3. **「Python 慢是语言问题」**——NumPy 底层 C 连续数组很快；慢常是 Python 循环 + 非连续视图。

## 动手试一试

用 `numpy.ascontiguousarray` 修复非连续视图：

```python
import numpy as np
a = np.random.rand(5000, 5000)
b = a[::2, ::2]  # 非连续
print(b.flags['C_CONTIGUOUS'])  # False
c = np.ascontiguousarray(b)
print(c.flags['C_CONTIGUOUS'])  # True
# 大算子前 ascontiguousarray 可避免 hidden copy
```

## 延伸思考

**Speculative decoding** 用小 draft 模型快速生成多个 candidate token，大模型 **并行验证**——额外算力换 **减少 serial decode 步数**；内存上同时驻留 **两套权重 bit**。**Prefix caching** 多用户共享相同 system prompt 的 **KV bit**，像 CDN 缓存静态 asset——**重复 bit 只算一次**。理解 Cache 层次（L1/L2/HBM）与这些 **应用层 cache** 的命名相似性，可避免把「KV Cache」误解成 CPU L3。

## 补充：DRAM row buffer

DRAM 读一行 **row buffer** 命中比 random row **快 ~2×**。**Tiling GEMM** 不仅为了 L1，也为了 **DRAM row locality**。LLM 权重太大无法整行驻留 row buffer，但 **分块 attention** 让 **K/V 块** 重复使用——**FlashAttention 的 IO 分析含 DRAM 层**。

## 温故：性能优化从内存层次出发

调 LLM 推理先问：**bound 在算力还是带宽？** batch 加大吃算力；batch=1 decode 常带宽。Profile **Nsight** 看 DRAM throughput vs SM active。写 CPU 预处理优化 **Cache 友好**（连续数组、少 Python 对象）。**本章 Cache 概念是读完 roofline 后的实操入口**。

## 读完带走

**64 B cache line** 是 CPU 搬运单位；**行优先** 对齐它。**Roofline** 判断算力还是带宽 bound；LLM decode 常后者。**FlashAttention** 是 **SRAM-aware 算法**，不是更小模型。

## 小结

Cache 用局部性掩盖 DRAM 延迟。cache line（通常 64 B）是硬件搬运单位；行优先、分块、对齐是为 Cache 服务。AI kernel 优化的一半故事在这里。**Profiling 显示 memory-bound 时**，先查 layout 与 tile，再考虑换 GPU。**Nsight Compute** 的 **Memory Throughput** 指标比 FLOPS 更能解释 decode 慢。**L2 hit rate** 低时先改 kernel tile，再加卡。

动手作业：打开 `nvidia-smi` 或活动监视器，对照本章公式估算当前进程的 **权重与 KV 占用**，误差在一个数量级内即合格。

**Prefetch** 对顺序读有效；随机 attention mask 难 prefetch。

## 第一章衔接

本章用 **bit 语言** 描述 AI 底座；第二章 **[数学](/manual/llm/bit-to-agi/02-math)** 用 **向量与矩阵** 重述同一物理过程。两章对照读：**bytes 是存储，FLOPs 是计算，带宽是瓶颈**——三个量构成工程三角。

下一篇：[GPU 为什么快](/manual/llm/bit-to-agi/01-bits/why-gpu-is-fast)——从串行 CPU 到数千并行线程。调优时若 GFLOPS 远低于 peak 且 bandwidth 打满，**下一刀砍数据搬运**（fusion、量化、KV 布局），而非盲目加卡。
