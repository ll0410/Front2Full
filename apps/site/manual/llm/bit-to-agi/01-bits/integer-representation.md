---
title: "整数如何表示"
description: "补码、溢出与 int32/int64——CPU 里的整数算术规则。"
source: "https://daiw.org/manual/bit-to-agi/01-bits/integer-representation"
---

# 整数如何表示

> 补码、溢出与 int32/int64——CPU 里的整数算术规则。

程序里的 `count`、`token_id`、数组下标，绝大多数在底层是**整数**。但「整数」在内存里不是抽象的数学 ℤ，而是**固定 bit 宽**上的位模式，加法会溢出，负数有一套叫**补码**的约定。

本篇讲清：无符号、有符号、补码如何工作，以及 overflow 为何在 AI 代码里也要当心。

## 直觉：汽车里程表与回绕

无符号 8 bit 像只有 3 位显示的里程表：255 再加 1 变成 **0**（溢出回绕），不是 256。有符号 8 bit 补码里，127 + 1 = **-128**。硬件不报错，除非你用特定指令检测溢出——**语义由类型宽度决定**。

## 定义

| 类型（典型） | 宽度 | 无符号范围 | 有符号（补码）范围 |
| ------------ | ---- | ---------- | ------------------ |
| int8 | 8 bit | 0 … 255 | −128 … 127 |
| int32 | 32 bit | 0 … $2^{32}-1$ | −$2^{31}$ … $2^{31}-1$ |
| int64 | 64 bit | 0 … $2^{64}-1$ | −$2^{63}$ … $2^{63}-1$ |

**补码**（two's complement）：负数 $-x$ 的 bit 模式 = 对 $|x|$ 按位取反再加 1。例如 int8 的 −1 全是 `11111111`，便于硬件用同一加法器做减法。

Token ID 在 LLM 里常用 int32 或 int64：词表 128256 远小于 $2^{31}$，int32 足够；embedding 表索引也依赖这些整数。

## 例子一：−5 的 8 bit 补码

```
+5 = 00000101
取反 = 11111010
+1   = 11111011  → 这就是 −5
验证：11111011 + 00000101 = 1_00000000，丢弃进位得 0 ✓
```

## 例子二：溢出陷阱

```python
import numpy as np
# NumPy 模拟 uint8 溢出
a = np.uint8(255)
b = np.uint8(1)
print(a + b)  # 0，不是 256

# Python int 任意精度，但 C 扩展里仍是固定宽
x = 2**63 - 1
# 在 C int64 里 x + 1 溢出成 -2**63
```

C 语言 `INT_MAX + 1` 是**未定义行为**（有符号溢出）；无符号溢出则**定义良好**为模 $2^n$。写高性能算子时要注意语言差异。

## 量化：AI 场景里的整数

| 用途 | 典型宽度 | 数量级 |
| ---- | -------- | ------ |
| Token ID | int32 | 0 … 128k |
| Batch 内序列长度 | int32 | 0 … 128k（上下文窗口） |
| 参数数量计数 | int64 | 7B = 7×10⁹ |
| 量化权重（INT8） | 8 bit/权重 | 体积 ÷2 vs FP16 |
| 文件偏移 / 模型 shard | int64 | 大模型分片 >4GB 需 64 位 |

7B 模型 INT8 权重约 **7 GB**（$7 \times 10^9$ 字节），比 FP16 的 14 GB 省一半——整数表示直接决定部署成本。

## 位运算：整数的另一副面孔

```python
# 快速判断奇偶
n & 1

# 2 的幂对齐（常见于 GPU kernel）
align = (x + 31) // 32 * 32  # 或 (x + 31) & ~31

# 权限标志位打包
READ, WRITE = 1, 2
perm = READ | WRITE
has_read = bool(perm & READ)
```

Attention mask 常是 0/1 整数矩阵；位图索引在推理框架里用于压缩布尔掩码。

## 扩展整数：BigInt 与任意精度

Python 3 的 `int` 在值超过机器字长时自动变 **任意精度**（limb 数组存大整数）。算 $2^{100000}$ 可以，但极慢——密码学 RSA 用专门的大整数库（GMP）。AI 训练很少用 BigInt；**索引与计数** 用固定宽就够。

NumPy `int64` 最大 $2^{63}-1 \approx 9.2 \times 10^{18}$；全球网页数远小于此，但 **token 总训练量** 已达 **10¹³–10¹⁴** token 量级，累加计数用 int64 仍够，但 FLOPs 累计需 float 或专门大数。

## 无符号在系统编程中的角色

数组长度、内存大小、`len()` 在 C 里常是 `size_t`（无符号）。比较 `unsigned a` 与 `int b` 时，`b = -1` 会被转成巨大无符号数，导致 `a < b` 恒真——Linux kernel 历史 bug 类别之一。

文件 `st_size` 是无符号；超过 2 GB 的文件在 32 位系统曾需 **LFS**（Large File Support）。现代 64 位 `off_t` 支持 EB 级文件，safetensors 分片单文件 17 GB 无压力。

## Zigzag 与 Varint（预告）

Protobuf 用 **varint** 编码小整数占 fewer bytes；负数 zigzag 映射到无符号再 varint。Tokenizer 词表 ID 传输在 RPC 里常受益——**整数表示影响网络比特数**，不只是内存。

## 固定点与量化（连接 INT8）

INT8 量化有时用 **对称** `q = round(x / scale)`，scale 由 tensor min/max 定；**zero_point** 非对称处理偏移。推理时 `deq = (q - zp) * scale`，仍是整数 bit 运算 +  occasional float scale——**整数路径省带宽**。

Per-channel vs per-tensor：Conv 权 per-output-channel scale 精度更好；per-tensor 省 metadata。**GPTQ** 按 column group 存 scale + 4bit packed nibbles——读出来仍是 bit，解释成 float 近似。

## 场景实战：tokenizer 里的整数

HuggingFace `tokenizer.encode("Hello")` 返回 `[9906]` 等——每个 ID 是 **0 到 vocab_size-1** 的整数，存 `int64` 或 `int32` tensor 送 GPU。`vocab_size=128256` 需 **17 bit** 以上表示；embedding 表是 **128256 × hidden_dim** 的矩阵，行索引就是 token ID。**整数不是附属品，是 LLM  IO 的桥梁类型**。

BPE merge 规则本身存在 **JSON 文本文件**里（UTF-8 bit）；运行时加载成 Python dict，merge 操作仍是整数对整数——**全栈离不开整数表示**。

想看一段文字被切成哪些 token、每个 token 对应什么整数 id？用这个在线小工具试试：[Token 词元查看器](https://handapp.com/tools/token-viewer)。

## 常见误区

1. **「char 是字符类型」**——在 C 里 `char` 常是 8 bit 整数，`A` 是 65；字符语义来自 IO 库。
2. **「Python 里 1+1 永远等于 2」**——Python 大整数无限精度；`numpy.int32(2**31-1) + 1` 会溢出成负数。
3. **「无符号更安全」**——无符号比较 `a - b < 0` 在 `a < b` 时会变成巨大正数，经典 bug 来源。

## 动手试一试

手动实现 8 bit 补码加法（理解硬件在做什么）：

```python
def add8(u, v):
    s = (u + v) & 0xFF
    # 解释为有符号
    if s >= 128:
        s -= 256
    return s

print(add8(127, 1))   # -128
print(add8(255, 1))   # 0（无符号视角）
```

## 延伸思考

**溢出** 在密码学里是 feature（模运算）；在 ML 索引里是 bug。**Embedding 表** 行号必须 `< vocab_size`；越界读在 C 里是 **UB**，在 CUDA 可能 **silent wrong row** 或 **segfault**。DataLoader 应用 `torch.clamp` 或 assert 在 debug 模式检查 token id 范围——**整数语义错误不会「差不多对」**。分布式 **global step** 用 int64 计数到 $10^{12}$ 步训练仍安全；**学习率 schedule** 用 float——**整数管离散事件，浮点管连续旋钮**。

## 温故：整数贯穿数据管线

从 **HTTP Content-Length**（字节数 int）到 **shape 各维 int** 到 **token id int** 到 **INT8 qweight**，整数是 **索引、计数、压缩编码** 的通用类型。浮点负责「可微」；整数负责「离散、精确计数与打包」——**二者在 AI 栈里分工明确，缺一不可**。

## 小结

整数 = 固定宽度 bit 串 + 解释规则（无符号或补码）。溢出是模运算，不是异常。AI 里的 token、索引、量化权重都建立在这套规则上。**Debug 越界** 时优先查 `max(token_id)` 与 `vocab_size-1`，比猜 embedding 坏掉更快。**Special token**（pad/bos/eos）也占 id 行，词表大小 **包含** 它们。Padding batch 时 pad id 通常是 **0 或 vocab-1**，别与有效 token 混淆。

越界是 **embedding 行索引** 最高频 bug 之一。

下一篇：[浮点数为什么会有误差](/manual/llm/bit-to-agi/01-bits/floating-point-error)——模型权重为何不是「精确小数」。**Embedding 表** 行索引即 token id；若 id 越界，GPU kernel **不会** 像 Python 那样抛 IndexError——可能 **读错行 silent**，debug 时用 `assert ids.max() < vocab_size`。
