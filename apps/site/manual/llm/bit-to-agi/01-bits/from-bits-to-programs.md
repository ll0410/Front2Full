---
title: "从比特到程序"
description: "源码、机器码、进程与一次 LLM 推理——比特如何变成可运行程序。"
source: "https://daiw.org/manual/bit-to-agi/01-bits/from-bits-to-programs"
---

# 从比特到程序

> 源码、机器码、进程与一次 LLM 推理——比特如何变成可运行程序。

你写的 Python/CUDA 不会直接进 CPU；**编译器、链接器、加载器**把源码变成磁盘上的**机器码比特**，OS 再把它映射进内存、交给 CPU/GPU 执行。一次 `curl` 调 ChatGPT API，或本地 `llama.cpp` 推理，全链路都是：**数据比特 + 程序比特 + 硬件按指令搬运算**。

## 直觉：菜谱 → 工厂流水线

源码是**菜谱**（人类读）；汇编/机器码是**流水线按钮编号**（硬件读）。`.so`/`.dll` 是备好的半成品库；启动程序 = 把按钮表载入内存、设置 PC 从 `main` 开始跑。

## 定义：关键阶段

| 阶段 | 输入 | 输出 |
| ---- | ---- | ---- |
| 预处理 | `.c` / `.cu` | 展开宏、include |
| 编译 | 源码 | **目标文件** `.o`（机器码 + 符号表） |
| 链接 | `.o` + 库 | 可执行文件 / `.so` |
| 加载 | `execve` | 虚拟地址空间 + 段映射 |
| JIT | Python/JS | 运行时生成机器码 |

**进程**：独立虚拟地址、文件描述符、线程；**线程**共享地址空间。

PyTorch 调用 `libtorch_cuda.so` → CUDA driver → GPU kernel（PTX/SASS 机器码）。

## 例子一：最小 C 到机器码

```c
// add.c
int add(int a, int b) { return a + b; }
```

```bash
gcc -c add.c -o add.o
objdump -d add.o   # 看 x86-64 汇编：mov, add, ret
gcc add.o -o add
```

`add` 可执行文件 ELF 格式：header + `.text`（代码段 bit）+ `.data`（初始化数据）。

## 例子二：Python 推理栈

```
prompt 字符串 (UTF-8 比特)
  → tokenizer (Rust/Python 扩展，机器码)
  → token IDs (int32 比特)
  → embedding 查表 (GPU kernel)
  → 32× Transformer layer (cuBLAS + custom flash-attn)
  → logits → sample → detokenize
  → UTF-8 响应
```

`transformers` 纯 Python 调度；**热点在 `.so` 里**。一次 generate 可能 launch **数百个** CUDA kernel，每个 kernel 是 GPU 上的函数（机器码）。

## 量化：启动与体积

| 组件 | 典型体积 |
| ---- | -------- |
| llama.cpp 可执行 | ~几 MB |
| libtorch | ~数百 MB |
| CUDA runtime + cuDNN | ~GB 级 |
| 7B 权重 | ~14 GB FP16 |

冷启动：读 14 GB 权重 NVMe **~5 s** + CUDA context **~1–3 s** + 首次 kernel JIT（若适用）。

**静态链接 vs 动态链接**：动态 `.so` 省磁盘、可升级；部署 Docker 时要齐依赖链（glibc、CUDA 版本）。

## 容器与云

Docker 镜像 = 文件系统层（比特）+ 启动命令。K8s pod 调度 GPU → 同样的 `python -m vllm` 进程，只是权重从 PVC 或 HF Hub **再读一遍比特**。

Serverless GPU 挑战：**加载权重时间** >> 单次短推理，故需 keep-warm 或 weight 常驻显存。

## 动态链接如何找到符号

`libtorch.so` 导出 `torch::mm` 等符号；可执行文件 **PLT/GOT** 在首次调用时解析地址（lazy binding）。`LD_LIBRARY_PATH` 指定搜索路径——Docker 里版本错配会 **undefined symbol** crash。

Python `import torch` → `dlopen libtorch` → 注册 hundreds of pybind11 方法 → 你调 `torch.matmul` 才 JIT 选 CUDA kernel。

## 从源码到 GPU SASS 的路径

```
CUDA C++ (.cu) → nvcc → PTX (中间 ISA) → driver JIT → SASS (GPU 机器码)
```

不同 **compute capability**（sm_80 A100、sm_89 RTX 4090、sm_90 H100/H200、sm_100 B200、sm_120 RTX 5090）SASS 不同；wheel 常 bundle 多 arch PTX，**首次运行 compile** 可能卡数秒。Triton 语言进一步抽象 tile kernel，仍编译到 SASS。

## 一次完整本地推理的比特旅程

1. 磁盘 **16 GB** safetensors（FP16 权重 bit）
2. `mmap` 进虚拟地址空间
3. tokenize prompt → **int32** 数组
4. CUDA kernel：embedding lookup + 32× decoder layer
5. sample 下一 token → 重复直到 EOS
6. detokenize → UTF-8 **~几百 byte** 文本写 stdout

全程 **无神秘层**；慢在步骤 4 的 HBM 带宽与 FLOPs，不在「理解语义」。

## 容器、K8s 与进程 1 号

Docker `ENTRYPOINT ["python","-m","vllm.entrypoints.openai.api_server"]`：PID 1 进程 exec 后 **代码段 bit 从镜像 layer 映射**，权重 volume mount 进 `/models`。K8s **liveness** 探针 HTTP GET `/health`——仍是比特在网络栈流动。

**Wasm**（边缘推理）：把 compiled module 当 **portable 字节码** 在 sandbox 跑——仍是 bit + 解释/JIT，适合 **低于 1B** 小模型 on device，大 LLM 仍 native CUDA。

## 场景实战：从 `git push` 到 Docker 容器部署

`git push` 传 **对象 zlib 压缩 bit** 到 GitHub；Actions 跑 `pnpm build` 将 MDX 编译成 Next.js standalone 产物，再打包成 **Docker 镜像层（比特）** 推送到 GHCR 并在服务器上启动容器。本站静态预渲染页面 + 轻量搜索 API：**构建期** MDX 编译成 JS/HTML bit，运行时 Node.js 进程只服务 **无状态请求**——与 LLM 推理「权重 bit + 程序 bit」同构，规模不同。

本地 `ollama run llama3`：`ollama` 二进制（机器码）+ `Modelfile` 指向 **GGUF bit  blob** → `llama_runner` 进程 mmap 权重 → stdin UTF-8 prompt → stdout UTF-8 stream——**全链路可 strace 看见 read/write 字节**。

## 常见误区

1. **「解释型语言没有机器码」**——CPython 解释 bytecode；NumPy/CUDA 扩展是编译好的机器码。PyPy JIT 运行时生成。
2. **「编译一次永远不变」**——CUDA kernel 可能根据 GPU arch **即时编译** PTX → SASS。
3. **「程序 = 只有 .text 代码段」**——全局变量、常量字符串、权重 mmap 都在进程地址空间，都是比特。

## 动手试一试

看 Python 扩展模块路径（机器码在哪）：

```python
import torch
print(torch.__file__)  # libtorch 位置
import numpy as np
print(np.__config__.show())  # BLAS 链接
```

Linux：`ldd $(which python)` 看动态库依赖。

```bash
file /bin/ls   # ELF 64-bit LSB executable
readelf -h /bin/ls | head
```

## 延伸思考

**strace** 一次 `python -c "import torch; torch.randn(3).cuda()"` 可见：**dlopen** 数十 `.so`、**mmap** CUDA driver、**ioctl** GPU——全是 OS 把 **程序 bit** 与 **设备** 接起来。Serverless GPU 冷启动慢，因为 **每次新容器都要重复 load + mmap 权重 bit**；**keep-warm** 本质是 **让进程与 VRAM 里的 bit 保持热态**。Wasm edge 推理想把 **程序 bit** 做得 portable，但 **权重 bit** 仍要 fetch——**程序小、数据大** 的结构不变。

## 补充：进程里还有谁占 bit

除权重外，**CUDA context** ~**0.5–1 GB**、**cuDNN workspace**、**NCCL buffer**、**Python heap**（tokenizer、HTTP buffer）都占 VRAM/RAM。`nvidia-smi` **Used** 大于「权重 + KV 理论值」时，差值就是这些 **overhead bit**——OOM 时先 `empty_cache()` 再查 leak。

## 温故：程序栈与 AI 运维

MLOps 本质是 **版本化 bit  artifact**：代码 git commit、权重 model registry hash、Docker 镜像 digest。回滚 = 换回上一版 **bit-identical 组合**。监控 GPU 利用率、PCIe、NVLink 带宽，是在看 **程序是否高效搬运与计算 bit**——可观测性语言与本章一致。

## 小结

程序 = 磁盘上的机器码与数据 + OS 加载成的进程。AI 推理是**编排好的大量已编译 kernel** 对**权重比特**做矩阵运算。从源码到比特到硅片，链条闭合。DevOps 版本化 **镜像 digest + 权重 hash + config yaml**，就是在版本化这条链条上的每一环 bit。**Rollback** = 换回上一组 digest，不是「重新 vibe 部署」。**Immutable artifact** 是 MLOps 的 bit 级纪律。

**strace -e read,write** 可肉眼看见推理 IO。

动手作业：打开 `nvidia-smi` 或活动监视器，对照本章公式估算当前进程的 **权重与 KV 占用**，误差在一个数量级内即合格。

## 第一章衔接

本章用 **bit 语言** 描述 AI 底座；第二章 **[数学](/manual/llm/bit-to-agi/02-math)** 用 **向量与矩阵** 重述同一物理过程。两章对照读：**bytes 是存储，FLOPs 是计算，带宽是瓶颈**——三个量构成工程三角。

下一篇：[第一章总结](/manual/llm/bit-to-agi/01-bits/chapter-summary)——回顾比特视角下的 AI 底座。建议用 `ldd`、`file`、`xxd` 各看一次本机 Python 与 libtorch——**把「程序」从图标还原成 ELF 与 .so 比特**，印象会比读十页文档更深。
