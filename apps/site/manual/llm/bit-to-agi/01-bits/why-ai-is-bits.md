---
title: "为什么 AI 最后只是比特"
description: "从照片、权重到 GPU 显存——现代 AI 在计算机里不过是海量 0 和 1 的排列组合"
source: "https://daiw.org/manual/bit-to-agi/01-bits/why-ai-is-bits"
---

# 为什么 AI 最后只是比特

> 从照片、权重到 GPU 显存——现代 AI 在计算机里不过是海量 0 和 1 的排列组合

你看到的 ChatGPT 回复、Stable Diffusion 生成的图片、自动驾驶的感知结果，在计算机内部**没有魔法**：它们最终都会变成内存与磁盘里连续的 **0 和 1**。本篇用数量级和具体例子，把「AI」拆成你能亲手验证的比特。

## 直觉：三层「表象」与一层「真相」

| 你感受到的 | 程序员看到的 | 机器里实际存的 |
| --- | --- | --- |
| 一段中文回答 | Python 字符串 / JSON | UTF-8 字节序列 |
| 一张 1024×1024 图 | `numpy` 数组 / 张量 | `float32` 或 `uint8` 的比特模式 |
| 「70B 大模型」 | `model.safetensors` 文件 | 约 140 GB 的权重比特（FP16） |

第一章的目标，是在碰「神经网络」这个词之前，先把**数据如何被比特表示**讲透。读完本章，你会自然接受：AI 训练与推理，本质是对**超大数组**做算术。

## 量化：一段回复占多少比特？

假设模型输出 200 个汉字。UTF-8 下常见汉字约 **3 字节/字**：

$$
200 \times 3 = 600\ \text{字节} = 4800\ \text{bit}
$$

若 API 以 JSON 返回，加上字段名与转义，**1–2 KB** 很常见——仍只是几千个比特。

对比：一张未压缩的 1920×1080 RGB 图（每通道 8 bit）：

$$
1920 \times 1080 \times 3 = 6{,}220{,}800\ \text{字节} \approx 5.9\ \text{MiB}
$$

即 **约 4980 万 bit**。一次「看图说话」多模态请求，图像往往比文本重 **四个数量级**。

## 例子 1：权重文件就是比特仓库

Llama-3-70B 若用 **FP16**（16 bit/参数）存储权重：

$$
70 \times 10^9 \times 16\ \text{bit} = 1.12 \times 10^{12}\ \text{bit} \approx 140\ \text{GiB}
$$

文件系统不关心「这是语言模型」——`safetensors` 里只是一段**可 mmap 的字节数组**。加载到 GPU 显存时，PCIe/NVLink 搬运的仍是这些比特的副本。

```python
# 感受量级：140 GiB 权重 ≈ 1.5e11 字节
params = 70_000_000_000
bytes_fp16 = params * 2
print(f"{bytes_fp16 / 1024**3:.1f} GiB")  # ~130.5（未计 embedding 等额外张量）
```

换个参数量或精度（FP16 / INT8 / INT4）想立刻知道体积？可以用这个在线小工具直接试：[LLM 模型大小计算器](https://handapp.com/tools/llm-model-size)。

## 例子 2：一次矩阵乘也是比特在 ALU 上跳舞

推理时核心运算是 `Y = X @ W`（批大小 × 维度）。以单层为例：`X` 为 `[1, 4096]`，`W` 为 `[4096, 4096]`，FP16：

- 读 `X`：$1 \times 4096 \times 2 \approx 8$ KiB
- 读 `W`：$4096^2 \times 2 \approx 32$ MiB
- 写 `Y`：$1 \times 4096 \times 2 \approx 8$ KiB

[FLOPs](/manual/llm/bit-to-agi/ai-glossary) 约 $2 \times 4096^2 \approx 33.5$ [MFLOP](/manual/llm/bit-to-agi/ai-glossary)——**每次乘加都在对寄存器里的比特做 IEEE754/FP16 规则运算**。Tensor Core 只是把同样的事做得更并行。

## 为什么必须落到比特？

1. **硬件只认识电压门限**：高电平≈1，低电平≈0；没有「第三个符号」。
2. **可复制、可校验**：模型文件可用 SHA256 校验，比特错一位，哈希完全不同。
3. **可压缩、可传输**：比特流才能走网络、CDN、对象存储——商业 API 按 **token（仍是比特编码）** 计费。

## 训练与推理：比特流动的两个阶段

**训练**时，反向传播把 [loss](/manual/llm/bit-to-agi/ai-glossary) 对每一层权重的梯度算出来，再用 [Adam](/manual/llm/bit-to-agi/ai-glossary) 等优化器更新权重——更新的仍是内存里的 float 比特，写回 [checkpoint](/manual/llm/bit-to-agi/ai-glossary) 文件还是 `.safetensors` 或 `.bin`。**推理**时通常只读权重、不写（除 KV Cache 增长），但每一次 token 生成都重复「读权重 → 矩阵乘 → 写激活」的比特搬运。

以 7B 模型、batch=1、输出 100 token 粗算：每 token 约 2× 参数量 FLOPs（forward），100 token ≈ $100 \times 2 \times 7 \times 10^9 \approx 1.4 \times 10^{12}$ FLOPs。A100 若平均 50 TFLOPS 有效算力，纯算力约 **28 毫秒**——实际因 KV Cache、内存带宽和 kernel 融合远快于此，但数量级说明：**智能体验背后是天文数字级的 bit 翻转**。

OpenAI API 返回 JSON，body 仍是 UTF-8 文本比特；流式 SSE 是一行行走字节的 HTTP 响应。本地 Ollama 则在 loopback 上传输 protobuf 或 JSON，**没有一步脱离序列化**。

## 与其他「智能系统」的对比

| 系统 | 存储形态 | 运行时 |
| ---- | -------- | ------ |
| 规则引擎 | if-else 代码 + 事实库 | 符号匹配 |
| 搜索引擎 | 倒排索引（Posting list） | 排序算法 |
| 大模型 | 浮点权重矩阵 | 矩阵乘 + 采样 |

规则引擎的「知识」显式写在代码和数据结构里；LLM 的「知识」**分布式**编码在权重里，无法指读某一行说「这里存了巴黎是法国首都」——这也是幻觉的来源：统计关联不等于事实库查询。

## 部署 checklist：用比特语言读模型卡片

拿到一个 [HuggingFace 模型页](https://huggingface.co/models)，你应能立刻回答：**参数量 N、默认 [dtype](/manual/llm/bit-to-agi/ai-glossary)、文件总大小、是否分片**。例如 `meta-llama/Llama-3-8B-Instruct`：8B 参数、FP16 默认、~16 GB、`config.json` 里 `hidden_size=4096`、`num_hidden_layers=32`。这些数字不是 marketing，而是 **显存与延迟预算的输入**。

推理服务 SLA 也常按 **比特吞吐** 写：「单卡 80 GB 显存、INT4 量化、最大 context 32K、吞吐 2000 token/s」——每一项都可追溯到本章概念。训练集群合同则按 **GPU·小时 × 卡数** 与 **checkpoint 存储 TB·月** 计费，底层仍是比特在磁盘与网络上传输。

## 常见误区

- **误区**：「模型理解了意义。」——工程上只有：给定比特输入，按固定程序产生比特输出；「意义」是人类对统计规律的解释。
- **误区**：「浮点数更真实。」——`float32` 同样是指定位模式；`0.1 + 0.2 != 0.3` 就是比特舍入的副作用（见[浮点数为什么会有误差](/manual/llm/bit-to-agi/01-bits/floating-point-error)）。

## 动手试一试

在终端查看任意文件的本质——十六进制字节：

```bash
# 取 UTF-8「你好」4 字节 + 换行
printf '你好\n' | xxd
```

你会看到类似 `e4 bd a0 e5 a5 bd 0a`——这就是「文字」在 AI 管线入口处的样子。

## 小结

- AI 产物与中间态，**全部**可还原为比特序列。
- 文本轻、图像重、权重最重——用字节数估算即可。
- 下一篇从最根本的问题出发：[为什么世界只有 0 和 1](/manual/llm/bit-to-agi/01-bits/why-world-is-01)。读完后请记住：**参数个数 × 每参数字节数 = 权重体积**，这是估算显存与下载时间的第一公式。
