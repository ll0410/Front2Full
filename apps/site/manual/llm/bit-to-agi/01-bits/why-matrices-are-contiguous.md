---
title: "矩阵为什么连续存储"
description: "行优先、stride 与 contiguity——PyTorch 张量布局如何影响性能。"
source: "https://daiw.org/manual/bit-to-agi/01-bits/why-matrices-are-contiguous"
---

# 矩阵为什么连续存储

> 行优先、stride 与 contiguity——PyTorch 张量布局如何影响性能。

数学上矩阵是 $m \times n$ 个数；在内存里必须排成**一维**字节串。怎么排？**行优先**（C/NumPy/PyTorch 默认）还是**列优先**（Fortran/MATLAB）？是否**连续**？选错会导致 cache miss、多余 copy，以及 CUDA kernel 直接报错。

## 直觉：读书从左到右、从上到下

把二维表格**按行接成一行**：第 0 行放最前，接着第 1 行……读 `M[i][j]` 时，固定 `i` 增 `j` 是连续地址（行优先）——与 Cache、SIMD、GPU coalescing 同向。

## 定义

**行优先**（row-major）：`index(i,j) = i * n + j`（$n$ 列数）

**列优先**（column-major）：`index(i,j) = j * m + i`

**stride**：沿某一维移动 1 步，内存地址跳多少字节。行优先 `M[i,j]` 到 `M[i,j+1]` stride = `itemsize`；到 `M[i+1,j]` stride = `n * itemsize`。

**C-contiguous**：行优先且整块无洞，适合 `memcpy`、BLAS、CUDA。

## 例子一：非连续视图

```python
import torch
x = torch.arange(12).reshape(3, 4)  # 行优先连续
y = x[:, ::2]   # 每隔一列，stride 变大
print(x.is_contiguous())  # True
print(y.is_contiguous())  # False
z = y.contiguous()  # 可能触发 copy，分配新连续 buffer
```

`contiguous()` 对 7B 激活张量若误调用，可能 **瞬间多占 GB** 显存。

## 例子二：与 BLAS 的 lda

GEMM $C = \alpha AB + \beta C$，cuBLAS 默认 **列优先**（Fortran）；PyTorch tensor 行优先，调用时通过转置等价变换。leading dimension `lda` 告诉库「相邻列（或行）间隔多少元素」——非 square 或 submatrix 时 lda ≥ 实际行数。

$1024 \times 1024$ float32 连续矩阵：**4 MB** 一块；batch 维 `B×M×N` 常见 layout `(B, M, N)` 或合并成 `(B*M, N)` 一次 GEMM。

## 量化：错误 layout 的代价

| 场景 | 影响 |
| ---- | ---- |
| 列优先遍历行优先数组 | CPU **5–15×** 慢 |
| 非连续 tensor 送 CUDA | 额外 copy 或非 coalesced，**2–10×** |
| channels_last (NHWC) vs NCHW | 卷积/ViT 依 implementation 差 **10–30%** |

Transformer 权重 `[out_features, in_features]` 连续；attention $QK^\top$ 涉及 transpose，框架内部选 layout 避免物理 transpose。

## channels_last 与图像

CNN 常用 **NCHW**；TensorRT、部分 mobile 内核偏好 **NHWC**（通道在最内，spatial 连续）——与像素扫描一致。`tensor.to(memory_format=torch.channels_last)` 可能加速 conv。

## 广播（Broadcasting）与内存

NumPy/PyTorch **broadcast** 不复制数据，只改 **stride 元数据**：`(3,1)` 与 `(3,4)` 相加，后者逻辑上「虚拟 expand」——stride 设 0 重复读同一地址。省内存但可能 **非连续输出**，后续算子触发 copy。

`expand()` vs `repeat()`：`expand` 共享 storage；`repeat` 物理复制——**10× 显存** 差在此一线。

## 转置与 BLAS 性能

数学上 $(AB)^\top = B^\top A^\top$。PyTorch `linear` 权重 shape `[out, in]`，输入 `[batch, in]`，实际调用 `addmm(input, weight.t())` 或等价——框架选 layout 避免显式 transpose。

**Tensor Core** 要求 **16×16×16** 对齐块（依架构）；`cudnn` 选 algorithm 时 benchmark 多种 tile——用户感知的「同样 shape 不同速度」常是 layout + algorithm 组合。

## `torch.compile` 与 layout 优化

PyTorch 2 `torch.compile` 可能 **fuse** 连续 elementwise、选 **Triton** tile 大小，并消除部分 `contiguous()` copy。仍要求输入 stride 友好；**dynamic shape** 会 recompile——LLM 变长序列需 `dynamic=True` 或 bucket 固定长度。

**Channels last** 对 Conv 友好；Transformer 线性层默认 `[N, C]` row-major，**无需 NHWC**——跟任务相关，勿盲目 `.contiguous()` 全图。

## 场景实战：`tensor.transpose(0,1)` 后送 Linear

```python
import torch
x = torch.randn(128, 512)      # batch=128, dim=512
w = torch.randn(1024, 512)     # out=1024
y = x @ w.T                    # (128,512) @ (512,1024) -> (128,1024)

x_t = x.t()                    # (512,128), 非 contiguous
# x_t @ w.T  shape 不对；需 x_t.contiguous() 或改写法
```

转置只改 **stride (128, 1)** vs **(1, 128)**；`Linear` 期望 **最后一维 contiguous**。debug 性能时第一行 `print(x.is_contiguous(), x.stride())`——**大量 hidden copy 来自 layout 误用**。

## 常见误区

1. **「reshape 不改变内存」**——`view` 可能共享；`reshape` 不连续时会 copy。
2. **「transpose 免费」**——只改 stride 元数据；后续算子若需连续则一次性付 copy 费。
3. **「batch 维随便放哪」**——`(N, C, H, W)` vs `(C, N, H, W)` 影响 kernel 选择；跟框架约定走。

## 动手试一试

检查 stride 与字节偏移：

```python
import torch
t = torch.randn(4, 5)
print("shape", t.shape, "stride", t.stride(), "storage offset", t.storage_offset())
t2 = t.t()  # 转置
print("t2 stride", t2.stride(), "contiguous", t2.is_contiguous())
# t2[i,j] 访问 t[j,i]，内存跳跃
```

## 延伸思考

**Column-major**（Fortran/MATLAB）历史久；**Row-major**（C/NumPy）与 **行优先 human 读法** 一致。**SciPy `order='F'`** 与 NumPy 混用会 **silent copy**。CUDA **cuBLAS 默认 column-major**，PyTorch **row-major** 调用时传 **`transposed` flag**——**数学 $C=AB$ 与 storage layout 解耦**，靠 BLAS API 桥接。**`einstein summation`** 指定下标，编译器选 **不物理 transpose 的 contraction path**。

## 温故：layout 是免费午餐还是 hidden tax

写自定义 CUDA/Triton 前：**打印 stride**。`permute`、`transpose`、`narrow` 后是否 contiguous？一次 **多余 copy** 在 7B 激活上可能是 **数百 MB** 搬运——**latency  spike 几毫秒**。框架越自动，越要懂 **底层 bit 布局**。

## 补充：`channels_last` 与 Conv

PyTorch 2 对 **Conv2d + BatchNorm** 在 `channels_last` memory format 下有 **fused kernel**；纯 Linear Transformer 收益有限。**NHWC** 在 TensorRT/ONNXRuntime CUDA EP 有时 **+15% throughput**——**layout 优化要 profile 具体 graph**，不能教条 row-major。

## 补充：`as_strided` 危险 beauty

```python
# 仅示意：stride 0 可「广播」维而不 copy
# 误用可能 overlap 写 — undefined behavior 级坑
```

PyTorch **`expand`** 用 stride 0；**`as_strided` 自定义 view** 可能 **overlap**——backward 时 **梯度累加错**。理解 contiguous 是为 **避免 silent wrong gradient bit**。

## 读完带走

**Row-major** 是 C/NumPy/PyTorch 默认；**cuBLAS 列优先** 由框架桥接。**Contiguous** 是性能与显存的开关；`view` 便宜，`reshape` 可能 copy。**Layout bug** 表现为 GPU util 低却找不到 kernel 问题。

## 小结

矩阵在内存里是一维数组 + layout 约定。行优先、连续存储让 CPU Cache、SIMD、GPU coalescing 同时受益。PyTorch 的 stride/contiguous 是性能与显存的开关。**写 custom autograd 前** 打印 `tensor.stride()` 应成肌肉记忆——比事后 profile 找 copy 省小时。**`permute` 后接 `matmul`** 是性能 bug 高发区。**`einsum('bij,bjk->bik')`** 有时自动选 **无 copy 路径**。

动手作业：打开 `nvidia-smi` 或活动监视器，对照本章公式估算当前进程的 **权重与 KV 占用**，误差在一个数量级内即合格。

**NCHW vs NHWC** 选错 conv 实现可慢 **10–30%**。

**`torch.compile`** 可能消除部分 layout 导致的 hidden copy。

**`memory_format=torch.channels_last`** 对 Conv 友好，对纯 Linear 未必。

读 **PyTorch 文档 `Tensor.stride`**  five 分钟，胜过 blind `contiguous()`  everywhere；理解 stride 就理解 **view 与 copy 的分界线**。

**`ascontiguousarray`** 在 NumPy 与 PyTorch 中语义相同：不连续则 **copy 到新 buffer**。

**Fortran order** 数组在 SciPy **`order='F'`** 与 C 混用时最易踩 copy 坑。

**`torch.empty_strided`** 可手动构造 broadcast 用 stride-0 维；高级优化与 debug 布局必备 API。

**`tensor.storage().size()`** 可小于 **`numel()`**：view 共享 storage 时常见，省 VRAM bit。

**`reshape(-1)`** 要求 contiguous；否则 PyTorch 提示先 `.contiguous()`——错误信息即 layout 课作业。

**Column-major GEMM** 在数学上等价于 **row-major 的 transposed 乘法**——实现细节，结论不变。

**`mT`**（矩阵转置属性）在 PyTorch 2 返回 **view**，不 copy；链式 matmul 要注意 stride。

**`torch.row_stack`** 默认沿 dim=0 拼接，输出 **C-contiguous**——构造 batch 矩阵的常用 API。

## 第一章衔接

本章用 **bit 语言** 描述 AI 底座；第二章 **[数学](/manual/llm/bit-to-agi/02-math)** 用 **向量与矩阵** 重述同一物理过程。两章对照读：**bytes 是存储，FLOPs 是计算，带宽是瓶颈**——三个量构成工程三角。layout 是 **免费性能** 或 **hidden tax** 的分界线；读懂 stride 即读懂一半 kernel 优化。建议对照 PyTorch 官方 **Understanding Memory Format** 文档阅读本章。下一章矩阵乘法将默认 **行优先连续存储**。**stride 即答案**——debug 性能从打印 stride 开始。本章收。继续读吧。

下一篇：[为什么 AI 喜欢矩阵](/manual/llm/bit-to-agi/01-bits/why-ai-likes-matrices)——从线性代数到 Transformer 的一层。
