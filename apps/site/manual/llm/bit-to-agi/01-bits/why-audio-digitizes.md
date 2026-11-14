---
title: "声音为什么可以数字化"
description: "采样率、位深与奈奎斯特定理——从声波到 Whisper 的 16 kHz 波形。"
source: "https://daiw.org/manual/bit-to-agi/01-bits/why-audio-digitizes"
---

# 声音为什么可以数字化

> 采样率、位深与奈奎斯特定理——从声波到 Whisper 的 16 kHz 波形。

麦克风把空气压力变成电压，ADC 再切成每秒几万个数字——这就是**数字化音频**。CD 音质、语音助手、Whisper 转写，底层都是同一套：**采样 + 量化**。本篇说明要多快采样才够、16 bit 意味着什么，以及 MP3 如何再压缩。

## 直觉：电影胶片 vs 声波

电影 24 fps 足够骗过眼睛「连续运动」。声波频率可达 **20 kHz**（人耳上限），要还原波形，采样点必须**足够密**——香农-奈奎斯特定理：采样率至少为最高频率的 **2 倍**。CD 选 **44.1 kHz**，留 guard band。

## 定义

| 术语 | 含义 | 常见值 |
| ---- | ---- | ------ |
| 采样率 $f_s$ | 每秒样本数 | 8 kHz（电话）、16 kHz（Whisper）、44.1/48 kHz（音乐） |
| 位深 | 每个样本 bit 数 | 16 bit（65536 级）、24 bit（专业） |
| 声道 | 独立波形数 | 1 mono、2 stereo |
| 码率（未压缩） | $f_s \times \text{位深} \times \text{声道}$ | CD stereo：44100×16×2 = **1411 kb/s** |

**量化噪声**：16 bit 动态范围约 **96 dB**；8 bit 仅 ~48 dB，明显颗粒感。

## 例子一：1 分钟语音数据量

Whisper 常用 **16 kHz mono float32**（预处理后）：
$$16000 \times 4 \times 60 = 3{,}840{,}000 \text{ B} \approx 3.66 \text{ MB/min}$$

若 uint16 PCM：减半约 **1.83 MB/min**。10 万小时训练音频 uint16 ≈ **11 TB** 量级——仍大，但 MP3/AAC 可再压 **10×**。

## 例子二：从 PCM 到频谱

ASR 模型不直接吃 raw 波形逐点，常做 **STFT**（短时傅里叶变换）→ 梅尔频谱 → log → 神经网络。

```python
import numpy as np
# 模拟 0.1 秒 440 Hz 正弦 @ 16 kHz
fs = 16000
t = np.arange(int(fs * 0.1)) / fs
x = np.sin(2 * np.pi * 440 * t)
print(f"样本数: {len(x)}, 字节 float32: {len(x)*4}")
# 能量集中在 440 Hz 附近 → 频域更紧凑
```

Whisper 输入 30 秒 chunk → 480000 样本 → encoder 下采样成更少 time step 的 feature。

## MP3/AAC：感知编码

与人耳掩蔽效应类似 JPEG：丢弃**听不到的**频率分量。128 kbps MP3 stereo 约为 CD 的 **1/11** 码率，语音可更低（32–64 kbps）。

## 与 AI 语音栈

| 环节 | 典型格式 | 说明 |
| ---- | -------- | ---- |
| 录音 | 48 kHz 24 bit | 手机/麦克风 |
| ASR 预处理 | 16 kHz mono | 重采样 + 归一化 |
| TTS 输出 | 24–48 kHz | vocoder 生成波形或 codec |
| 多模态 LLM | 音频 token 或 embedding | 类似图像 patch |

OpenAI API 音频上限常按 **25 MB/文件** 限制——本质是 bit 体积 cap。

## 采样定理的数学陈述

若连续信号最高频率 $f_{\max}$，则采样率 $f_s > 2 f_{\max}$ 时可无失真重建（理想低通）。语音电话带限 **300 Hz–3.4 kHz**，8 kHz 采样足够；音乐 CD 带限 **22 kHz**，44.1 kHz 留 guard band。超声 **48 kHz** 给编辑留余量（变速不变调仍要 Nyquist 满足原带限）。

欠采样产生 **混叠**（aliasing）：高频 fake 成低频嗡嗡声。抗混叠滤波必须在 ADC 前做——硬件 + 数字 **decimation** 链。

## 语音 codec 与 LLM

**Opus**（WebRTC）：6–510 kbps 自适应，Discord/Zoom 常用。**Whisper** 训练数据来自互联网音视频，经 decode 成 16 kHz mono——**有损 codec  artifact 已 baked in 模型**。TTS 输出 24 kHz WAV 再 Opus 封装上线，听众听到的是 **二次压缩** 后的比特流。

多模态 GPT-4o 类音频输入：可能用 neural codec token（如 SoundStream/EnCodec）把波形压成 **离散 token 序列**——比 raw PCM **少 10–50× bit**，直接当 LLM 词表扩展。

## Mel 频谱与 Whisper 前端

Whisper 把 16 kHz 波形做 STFT，窗长 **25 ms**、步长 **10 ms**，取 log mel **80 维** × time frames。30 秒音频 → ~3000 帧 × 80 float ≈ **960 KB** float32，比 raw PCM **30 s×16000×4=1.92 MB** 略小且更「语义化」——**前端已是矩阵**，encoder 是 CNN/Transformer。

音量归一化到 **-1..1** 或 target dBFS，避免 ADC  clipping 饱和成方波——饱和是非线性，破坏可学习结构。

## 场景实战：Whisper API 与 25 MB 限制

OpenAI Whisper API 限制上传 **25 MB**——约 **25×10⁶ byte**。16 kHz mono int16 约 **32 KB/s**，25 MB 可容纳 **~13 分钟**；若 48 kHz stereo float WAV 则仅 **~1.5 分钟**。限制本质是 **比特配额**；超长音频需 client 侧切片或降采样——**不是模型「记不住」**，是 transport 与 decode 成本 cap。

Podcast 转写 pipeline：ffmpeg `-ar 16000 -ac 1` 重采样 → mono PCM → 送 ASR——**预处理把 bit 流规范化** 成模型训练分布。

## 常见误区

1. **「采样率越高音质永远越好」**——超过信号带宽（语音 ~8 kHz 有效）只是浪费；44.1 kHz 对纯语音无必要。
2. **「数字化丢失灵魂」**——16 bit 44.1 kHz 人耳难辨与模拟源差别；瓶颈常在扬声器与 room。
3. **「float 音频比 int16 更「真」」**——float 是另一种量化；Whisper 用 float32 是为计算方便，不是更高「分辨率」。

## 动手试一试

生成 WAV 并计算大小（标准库 + wave）：

```python
import wave, struct, math
fs, duration = 16000, 2.0
freq = 440
n = int(fs * duration)
with wave.open("tone.wav", "w") as w:
    w.setnchannels(1)
    w.setsampwidth(2)  # 16 bit
    w.setframerate(fs)
    for i in range(n):
        val = int(32767 * 0.5 * math.sin(2 * math.pi * freq * i / fs))
        w.writeframes(struct.pack('<h', val))
import os
print(os.path.getsize("tone.wav"), "bytes")
# 约 64000 字节 = 16000 * 2 * 2
```

## 延伸思考

**Telephony 8 kHz** 保留 **300–3400 Hz** 语音带；**Wideband 16 kHz** 改善辅音识别；**Audiobook 44.1 kHz** 对 ASR 无增益只有 **存储浪费**。**Dynamic range compression** 在播客常见，ASR 训练数据若未覆盖，real-world **响度差异** 致 WER 升——**bit 动态范围与 domain match** 重要。**Multi-channel** 麦克风阵列 beamforming 在 **digitized 多路 PCM** 上做，输出仍 **mono bit 流** 送模型。

## 温故：听与说的 bit 预算

Realtime 语音对话 = **上行 PCM/Opus bit** + **ASR** + **LLM** + **TTS 波形 bit** + **下行**。端到端 latency 预算 **低于 500 ms** 常要求 **流式 ASR + 流式 TTS**，每段 codec 延迟 ** tens of ms**——**音频 bit 管道与 token 管道串联**，任一段 buffer 过大即卡顿。

## 补充：dither 与量化噪声

ADC **量化** 引入 **quantization noise**，功率约 **$-6.02n$ dB**（$n$ bit）。**dither** 在 LSB 加微小随机噪声，使失真 ** perceptually 更自然**——与 **FP 舍入误差** 同属「离散化 artifact」。ASR 训练加 **background noise augmentation** 类似——**让模型见过 imperfect bit**。

## 小结

声音数字化 = 时间上采样 + 幅度量化。奈奎斯特决定最低采样率；位深决定动态范围。ASR/TTS/音频 LLM 都在 PCM 或压缩音频之上做特征提取与生成。**上线音频 API** 时声明 **采样率与声道**，并在服务端 **resample 到模型训练率**，可少一半 WER 纠纷。**Whisper 16 kHz** 是事实标准，别用 48 kHz 原样硬喂除非微调过。**Stereo 转 mono** 常用 **(L+R)/2**，再 resample。

**VoIP 8 kHz** 仍覆盖全球大量通话场景。

## 第一章衔接

本章用 **bit 语言** 描述 AI 底座；第二章 **[数学](/manual/llm/bit-to-agi/02-math)** 用 **向量与矩阵** 重述同一物理过程。两章对照读：**bytes 是存储，FLOPs 是计算，带宽是瓶颈**——三个量构成工程三角。

下一篇：[文字为什么最后都是 UTF-8](/manual/llm/bit-to-agi/01-bits/why-text-is-utf8)——LLM 的输入本质仍是字节序列。录音 **24 bit / 96 kHz** 给 ASR 通常无益，却 **×6 存储与 upload bit** 相对 16 kHz mono——预处理 pipeline 应 **match 训练分布** 而非追求 audiophile 规格。
