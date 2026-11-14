---
title: "大端与小端"
description: "字节序、网络序与跨平台权重——为何 0x12345678 在内存里两种摆法。"
source: "https://daiw.org/manual/bit-to-agi/01-bits/endianness"
---

# 大端与小端

> 字节序、网络序与跨平台权重——为何 0x12345678 在内存里两种摆法。

整数 `0x12345678` 占 4 字节，在内存里从低地址到高地址，可以是 `12 34 56 78`（**大端 Big-Endian**）或 `78 56 34 12`（**小端 Little-Endian**）。x86、ARM 常见 CPU 都是**小端**；网络协议、部分文件格式规定**大端**。读二进制权重、写跨平台格式、解析 magic number 时，字节序搞错会得到荒谬数字。

## 直觉：从左读还是从右读

大端：**人类书写顺序**，高位字节在前（像写 `1234` 先写千位）。小端：**低地址存低位**，历史原因（Intel 8080 累加器低位先方便进位）。**单个 byte 没有 endian 问题**；**多 byte 整数、float** 才有。

## 定义

对 32 bit 值 `0x12345678`：

| 地址 | +0 | +1 | +2 | +3 |
| ---- | -- | -- | -- | -- |
| 大端 | 0x12 | 0x34 | 0x56 | 0x78 |
| 小端 | 0x78 | 0x56 | 0x34 | 0x12 |

**网络字节序** = 大端。`htonl` / `ntohl` 在 x86 上 swap。

**float32** 按 IEEE 754 bit 模式当 uint32 解释再谈 endian；`struct.pack('<f', x)` 小端，`'>f'` 大端。

## 例子一：Python struct

```python
import struct
n = 0x12345678
print(struct.pack('<I', n).hex())  # 78563412 小端
print(struct.pack('>I', n).hex())  # 12345678 大端
print(struct.unpack('<I', b'\x78\x56\x34\x12')[0])  # 305419896 = 0x12345678
```

## 例子二：PNG 与 safetensors

PNG signature 固定字节 `89 50 4E 47`——与 endian 无关（逐字节 magic）。

Safetensors header 是 JSON 长度 + JSON + tensor bytes；JSON 里 shape/dtype，tensor 按 **little-endian** 原生顺序存（与 PyTorch 默认一致）。在 **大端** 机器（罕见）上读需 swap——几乎只剩历史 mainframe。

NumPy `.npy` 文件头含 `<` 或 `|` 标记 endian。

## 与 AI 工程

| 场景 |  endian |
| ---- | ------- |
| PyTorch `.pt` / `.pth` | 平台原生（x86 小端） |
| ONNX | protobuf little-endian |
| GGUF | little-endian |
| TCP 传 tensor shape（自定义协议） | 应规定网络序或 little-endian + 文档 |

分布式训练 **NCCL** 在 homogenous x86/ARM 小端集群上透明；混合 endian 几乎不存在。

## 位域、异构与 GPU

GPU global memory 与 host 一致（CUDA 小端 x86）。`cudaMemcpy` 拷 float 数组无需 swap。

手动解析 wire format：

```python
def read_u32_le(data, off):
    return data[off] | (data[off+1]<<8) | (data[off+2]<<16) | (data[off+3]<<24)
```

## 历史：字节序战争

1980 年代 **Big-Endian** 派（Motorola 68000、网络）与 **Little-Endian** 派（Intel x86）并存。Jonathan Swift《格列佛游记》鸡蛋大头 vs 小头——**endian** 词源于此。如今 **小端主导** 数据中心与桌面；ARM 可 bi-endian 但实际上普遍运行在 little-endian。

**DMA 与外设**：PCIe 设备寄存器有时规定 big-endian 文档；驱动里 `le32_to_cpu` 转换。

## 手动 swap 与性能

跨 endian 读 1 GB 文件需 **swap 每 2/4/8 字节**——纯 CPU bound，**~1–2 GB/s** 单线程；batch swap 用 SIMD 可加速。Homogeneous 小端集群训练 **零 swap 成本**——全球化云仍假设 little-endian。

## 跨语言 FFI 与字节序

Rust `u32::from_le_bytes([...])`、Go `binary.LittleEndian.Uint32`、Java `ByteBuffer.order(LITTLE_ENDIAN)`——**FFI 边界** 必须显式 endian。C Python `struct.pack` 与 Rust tensor 通过 **numpy memmap** 共享时，两边都 little-endian 则 **零拷贝**；big-endian 主机几乎绝迹于 AI 栈。

Wire format **Protobuf / FlatBuffers / Cap'n Proto** 均在 schema 层规定 integer endian；**gRPC 传 tensor metadata** 时 shape 是 varint，payload 是 little-endian float 裸流。

## 场景实战：读 network pcap 里的整数

Wireshark 显示 TCP payload 里 **big-endian** 字段（IP 头长度、端口号）。自定义 RPC 传 `struct.pack('>I', len)` 前缀 + raw tensor bytes（little-endian float）——**同一 packet 混两种 endian 约定**，靠 schema 文档区分。写跨语言推理网关时 **显式规定** 每个字段 endian，避免 ARM 服务器读 x86 客户端 blob 乱码。

NumPy `np.frombuffer(data, dtype='>f4')` vs `'<f4'` 一行切换——**interpretation 层解决，不改变 raw bit**。

## 常见误区

1. **「UTF-8 有大小端」**——UTF-8 是 byte 序列；UTF-16 有 BOM 标记 LE/BE。
2. **「小端 = 反着存 bit」**——仍是高位 bit 在 byte 内高位；只是** byte 顺序**反了。
3. **「json 文件有 endian」**——文本 UTF-8，无数 endian；二进制 tensor 文件才有。

## 动手试一试

检测本机 endian：

```python
import sys
print(sys.byteorder)  # little 或 big

import struct
print(struct.pack('@I', 1) == struct.pack('<I', 1))  # native vs little on x86: True
```

用 hexdump 看 float：

```python
import struct
f = 3.14159
b = struct.pack('<f', f)
print(b.hex(), struct.unpack('<f', b))
```

## 延伸思考

1980 年代若互联网未统一 **little-endian 数据 plane**，今日 HuggingFace 上 **一个 `.bin` 文件全球同构** 的便利将不存在——每个市场要 endian-specific build。历史路径依赖使 **小端成为 AI 事实标准**；你在 ARM Mac 上训练的 checkpoint 拷到 x86 Linux **零转换** 部署，这是 endian 统一的红利。**Wire protocol 设计** 时，整数长度字段用 big-endian（网络序）而 float payload 用 little-endian 的混用模式，在 **gRPC + raw tensor** 网关里仍可见；读 spec 时圈出每个字段的字节序，比背 endian 定义更有用。

## 补充：常见文件 magic

| 格式 | 头几个 byte（hex） |
| ---- | ------------------ |
| PNG | `89 50 4E 47` |
| JPEG | `FF D8 FF` |
| GIF | `47 49 46 38` |
| ZIP | `50 4B 03 04` |
| safetensors | JSON len + `{"` |

用 `xxd -l 4 file` 比看扩展名可靠——**扩展名可改，magic 难伪造**（除非刻意 polyglot）。

## 温故：何时该关心 endian

日常 PyTorch 训练 **99.9% 场景不用手改 endian**；需要关心的时刻：**手写二进制协议**、**解析 legacy 大端文件**、**嵌入式 cross-compile**、**安全 audit 魔数**。AI 工程师记住一句：**权重与 tensor wire format 默认 little-endian**；网络 JSON 无 endian 问题（文本 UTF-8）；**混合协议自己写文档**。

## 读完带走

**小端** 统治 AI 栈；**网络序大端** 只在 legacy 协议。**Homogeneous cluster** 零 swap 成本。写 binary RPC 时在 schema **显式 endian + dtype**，避免 silent 乱码 tensor。

## 小结

Endian 决定多字节整数/float 在内存中的 byte 顺序。x86/ARM AI 栈几乎全是小端；网络与大端文件格式是例外。读二进制格式认准 magic、文档与 `struct` 的 `<`/`>`。写跨语言推理服务时，**在 API 文档里固定 byte order 与 dtype**，比事后 debug 乱码张量便宜得多。客户端与服务端 **homogeneous little-endian** 时，tensor payload 可 **零拷贝 cast**。**ONNX**  protobuf 层仍要核对 **TensorProto data_type** 字段。

动手作业：打开 `nvidia-smi` 或活动监视器，对照本章公式估算当前进程的 **权重与 KV 占用**，误差在一个数量级内即合格。

读 **ONNX TensorProto** 时核对 **raw_data** 字节序字段说明。

**Wire 协议** 写清 integer endian 与 float dtype，比事后 hex dump 调试省一天。

导出 **numpy.tobytes(order='C')** 默认 little-endian，与 PyTorch 一致。

跨端推理时 **schema 文档** 应写明：整数用 big-endian 长度前缀、tensor body 用 little-endian float32 裸流——混用是常态，不是异常。

**FlatBuffers** 等零拷贝格式在 schema 里固定 endian，适合 edge 推理网关。

读 **Wikipedia「Endianness」** 对照本章 magic number 表，十分钟足够。

**JSON 数字** 无 endian；**JSON 里的 base64 权重** decode 后才是 little-endian tensor。

本章与 **网络字节序** 的核心必记点：TCP 端口与 IP 长度字段用 big-endian。

**`htons`** 即 host-to-network short，C 网络编程必记。

## 第一章衔接

本章用 **bit 语言** 描述 AI 底座；第二章 **[数学](/manual/llm/bit-to-agi/02-math)** 用 **向量与矩阵** 重述同一物理过程。两章对照读：**bytes 是存储，FLOPs 是计算，带宽是瓶颈**——三个量构成工程三角。

下一篇：[从比特到程序](/manual/llm/bit-to-agi/01-bits/from-bits-to-programs)——编译、链接与一次推理的完整链路。跨平台读写二进制权重时，**先确认 byte order 再确认 dtype 宽度**，顺序反了会把完全合法的文件读成噪声张量。
