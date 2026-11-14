---
title: "位、字节与寻址"
description: "8 bit 一字节、指针与 64 位地址——算清模型体积与对齐。"
source: "https://daiw.org/manual/bit-to-agi/01-bits/bits-and-bytes"
---

# 位、字节与寻址

> 8 bit 一字节、指针与 64 位地址——算清模型体积与对齐。

「7B 模型 14 GB」「指针 8 字节」——这些说法都建立在 **bit → byte → 地址** 的链条上。本篇把寻址单位、对齐、64 位地址空间讲清楚，方便你心算张量占多少内存、为何 struct padding 浪费字节。

## 直觉：门牌号与包裹大小

内存像长街，**地址**是门牌号（从 0 开始的整数），**字节**是每扇门里固定大小的邮箱（**8 bit**）。CPU 说「从地址 `0x7fff1000` 读 8 字节」，一次取一个 `uint64`。指针就是**存门牌号的变量**——64 位系统里通常占 **8 字节**。

## 定义

| 单位 | 大小 | 说明 |
| ---- | ---- | ---- |
| bit | 1 | 0 或 1 |
| byte (B) | 8 bit | 寻址常用最小单位 |
| KB/MiB | $2^{10}$ B | 1024 B；存储标称有时用 $10^3$ |
| GB/GiB | $2^{30}$ B | 16 GB 显卡 ≈ $16 \times 2^{30}$ B |
| word | 平台相关 | x86-64 常指 64 bit = 8 B |

**对齐**（alignment）：`uint64` 地址最好是 8 的倍数；未对齐访问可能慢或 fault（ARM 严格）。CUDA 常要求 **128 bit** 对齐向量化 load。

**64 位虚拟地址**：$2^{64}$ B 理论空间 ≈ **16 EB**；实际 CPU 用 **48 bit** 用户空间（256 TB）够用。

## 例子一：7B 参数体积

| dtype | bytes/参数 | 总字节 | 约 GiB |
| ----- | ---------- | ------ | ------ |
| FP32 | 4 | 28 GB | 26.1 |
| FP16 | 2 | 14 GB | 13.0 |
| INT8 | 1 | 7 GB | 6.5 |
| INT4 | 0.5 | 3.5 GB | 3.3 |

$1 \text{ GiB} = 1024^3 \text{ B}$；硬盘标 16 GB 常是 $16 \times 10^9$——**差 ~7%**。

## 例子二：struct padding

```c
struct Bad {
    char c;   // 1 B @0
    // 3 B padding
    int i;    // 4 B @4
};  // size 8，浪费 3 B

struct Good {
    int i;
    char c;
    // 3 B padding
};  // size 8
```

百万个小 struct 浪费 → MB 级；GPU kernel 参数 struct 也受对齐影响。

Python 侧：

```python
import sys
sys.getsizeof(0)      # 28，小 int 对象头
import numpy as np
np.dtype(np.float32).itemsize  # 4
np.dtype(np.float64).itemsize  # 8
```

## 指针与引用

```python
# Python 无裸指针；C 扩展 / ctypes
# void* 64-bit = 8 bytes
# 引用计数对象：PyObject* + 实际数据 buffer 可能分离
import numpy as np
a = np.zeros(10**7)  # 80 MB float64 数据 + 小对象头
```

C++ `std::vector<float>`：24 B 对象头（指针+cap+size）+ 堆上 **4×N** 字节数据。

## 量化：带宽与寻址

读 1 GB 权重，HBM 2 TB/s → **0.5 ms** 纯带宽下限；若随机 4 B 访问（cache miss 风暴）→ 有效吞吐暴跌。

**页大小** 4 KB：mmap 16 GB 模型 → $\lceil 16\text{GB}/4\text{KB}\rceil \approx 4$M 页表项，TLB miss 也有成本——大页（huge page 2 MB）可减开销。

## 位域与按位操作

```c
flags = READ | WRITE;      // 按位或
if (flags & READ) { ... }  // 按位与
x << 3;                    // 乘 8
x >> 1;                    // 除 2 向下取整
```

Attention ** bitmask** 常用 float `-inf` 加 mask 或 **uint8** 布尔矩阵；GPU kernel 里 `__shfl_sync` 在 warp 内交换 bit 级数据。

**Hamming weight**：popcount 指令数 1 中 bit 个数；Bloom filter、哈希表用到。

## 地址空间布局（Linux x86-64 示意）

用户态低地址：代码 **.text** → **.data/.bss** → **heap** 向上 → **mmap 区**（大数组、模型权重常在此）→ **stack** 向下。ASLR 随机化基址防 exploit。`ulimit -v` 限制虚拟内存；OOM killer 在 **物理耗尽** 时杀进程——PyTorch OOM 常先于 OS OOM。

## 比特与信息的单位换算

| 说法 | 精确含义 |
| ---- | -------- |
| 1 byte | 8 bit |
| 1 KB (SI) | 1000 byte |
| 1 KiB | 1024 byte |
| 1 Gb/s 网络 | **bit**/秒，÷8 得 GB/s |
| 1 GB/s 内存带宽 | **byte**/秒 |

云厂商网络标 **Gbps**（bit），NVMe 标 **GB/s**（byte）——**差 8 倍** 阅读文档时必核对，否则带宽预算错一个数量级。

## 场景实战：从 Mbps 到模型下载时间

家庭宽带 **500 Mbps** = **62.5 MB/s**（÷8）。下载 **16 GB** 模型：$16\times1024/62.5 \approx 262$ **秒 ~4.4 分钟**（理想满速；磁盘写入、TCP 慢启动会更久）。数据中心 **10 Gbps** **~1.25 GB/s**，同文件 **~13 秒**——**bit 传输时间 = 字节数 / 有效带宽**，部署 MLOps 要算这一笔。

HuggingFace **LFS** 单文件 50 GB 需 **断点续传**；wget/curl `-C -` 续传字节 range——**文件是 byte stream，HTTP 是 transport**。

## 常见误区

1. **「1 KB = 1000 B」**——SI 用 kB=1000；内存语境 **KiB=1024**；混用导致「硬盘比标称小」。
2. **「32 位程序只能用 4 GB RAM」**——用户态虚拟 4 GB；PAE/服务器另论；现桌面几乎全 64 位。
3. **「指针大小 = 指向对象大小」**——指针永远 8 B（64 位）；指向 16 GB tensor 仍 8 B。

## 动手试一试

心算 tensor 字节：

```python
def tensor_bytes(shape, dtype_bytes):
    n = 1
    for d in shape:
        n *= d
    return n * dtype_bytes

for shape, name in [((8, 4096, 4096), "FP16 2D"), ((32, 128, 4096, 128), "KV-ish")]:
    b = tensor_bytes(shape, 2)
    print(name, f"{b/1e9:.2f} GB")
```

## 延伸思考

比特、字节、地址是 **三种粒度** 的同一套坐标系：网络带宽用 **bit/s**，内存用 **byte/s**，调试器用 **十六进制地址**。学会在三者间心算切换，看到「400 Gbps NIC」不会误当成 **400 GB/s**（实际约 **50 GB/s**）。模型 sharding 按 **byte offset** 切分 tensor；分布式训练 **all-reduce** 按 **byte buffer** 同步——**地址 + 长度** 描述一切 payload。对齐到 64 B 不是洁癖，是 **让每一次 load 落在一条 cache line 上**；量化 pack 4bit 两个 nibbles 进 1 byte 则是 **在地址不变前提下塞更多信息**。掌握这些，读 NCCL、读 GGUF spec、读 CUDA `cudaMemcpy` 文档都不会迷失在术语里。

## 补充：心算练习

| 场景 | 心算 |
| ---- | ---- |
| 13B FP16 | $13 \times 2 \approx 26$ GB |
| 1M token UTF-8 纯中文 | $\approx 3$ MB 量级 |
| 4096 context KV（8B 粗算） | **~2 GB** 量级 |
| PCIe 传 14 GB | $14/32 \approx 0.4$ s @32 GB/s |

每天随机抽一个部署场景练 **30 秒心算**，第二章看到矩阵维度时就不会晕。

## 温故：从比特到部署的一页纸

把本章串起来：**磁盘文件**（safetensors 的 GB 级 bit）→ **mmap/读入** VRAM 或 RAM → **程序**（CUDA/cuBLAS 机器码）按 **layout**（连续 float 矩阵）读取 → **Cache/HBM 带宽**决定有效速度 → **Attention/FFN** 全是 GEMM → 输出 **UTF-8** 或 **像素 bit** 回给用户。任一环节算错 **字节数**，就会出现 OOM、慢 10 倍、或乱码——**不是模型「变笨」，是比特账没算对**。

## 小结

8 bit = 1 byte，地址按 byte 编号，指针存地址占 8 B（64 位）。模型体积、对齐、页表都建立在这套单位上；算 AI 资源从 **参数量 × bytes/param** 开始。遇到 **「GB vs GiB」** 差 **7%**、**「Gbps vs GB/s」** 差 **8 倍** 时，回到本章单位表核对——可避免一半部署估算错误。下一章矩阵运算的 **FLOPs 估算** 也依赖 **dtype 字节数**，单位混乱会连锁算错。**心算表** 建议贴显示器旁。

**指针 8B、float32 4B、int64 8B** 应脱口而出。

动手作业：打开 `nvidia-smi` 或活动监视器，对照本章公式估算当前进程的 **权重与 KV 占用**，误差在一个数量级内即合格。

**1 TB = 1024 GB** 是容量；**1 Tbps** 是带宽，别混。

## 第一章衔接

本章用 **bit 语言** 描述 AI 底座；第二章 **[数学](/manual/llm/bit-to-agi/02-math)** 用 **向量与矩阵** 重述同一物理过程。两章对照读：**bytes 是存储，FLOPs 是计算，带宽是瓶颈**——三个量构成工程三角。

下一篇：[大端与小端](/manual/llm/bit-to-agi/01-bits/endianness)——多字节整数在内存里谁先谁后。记住：**参数个数 × 每参数字节数 = 权重体积**；**带宽 × 时间 = 可搬运字节数**——这两条公式会重复出现在第二章的矩阵与梯度讨论里。
