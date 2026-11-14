---
title: "为什么视频可以压缩"
description: "帧间预测、GOP 与码率——1 小时 4K 如何从 TB 级降到 GB 级。"
source: "https://daiw.org/manual/bit-to-agi/01-bits/why-video-compresses"
---

# 为什么视频可以压缩

> 帧间预测、GOP 与码率——1 小时 4K 如何从 TB 级降到 GB 级。

未压缩 1080p30 视频每秒约 **186 MB**（$1920 \times 1080 \times 3 \times 30$），1 小时 ≈ **670 GB**——不可能流式传输。YouTube、Netflix、Sora 训练数据，都靠**视频编解码**把体积压几个数量级。核心比图片多一维：**时间冗余**（相邻帧几乎一样）。

## 直觉：flipbook 与「只存变化」

动画本质是快速翻页。若第 100 帧与第 99 帧只有人物嘴角动了一点，存**整帧 3 MB** 浪费；存「相对上一帧的差分」可能只要 **几十 KB**。H.264/H.265/AV1 都在做：**关键帧（完整图）+ 预测帧（只存运动与残差）**。

## 定义：基本量

| 量 | 公式/典型值 |
| -- | ----------- |
| 未压缩码率 | 宽 × 高 × 3 × fps（字节/秒） |
| 1080p30 raw | ≈ 186 MB/s ≈ **1.49 Gb/s** |
| 压缩后码率 | YouTube 1080p 常见 **5–8 Mbps** |
| 压缩比 | raw / 压缩 ≈ **200×** 量级 |

**GOP**（Group of Pictures）：两个 I 帧（关键帧）之间的帧组。I 帧可独立解码；P/B 帧依赖前后参考帧。GOP 越长，压缩率越高，但随机 seek 和错误传播风险越大。

## 例子一：码率心算

4K（3840×2160）30 fps raw：
$$3840 \times 2160 \times 3 \times 30 \approx 746{,}496{,}000 \text{ B/s} \approx 746 \text{ MB/s}$$

H.265 流媒体 4K 约 **25 Mbps** = 3.125 MB/s，压缩比约 **240×**。

## 例子二：帧类型

- **I 帧**（Intra）：类似 JPEG，帧内 DCT+量化，体积大，~每 1–2 秒一个。
- **P 帧**（Predicted）：运动估计（MV）+ 残差编码；占日常帧大多数。
- **B 帧**（Bidirectional）：参考前后帧，压缩率更高，延迟略增。

```mermaid
flowchart LR
  I1[I 关键帧] --> P1[P 预测帧]
  P1 --> B1[B 双向帧]
  B1 --> P2[P 帧]
  P2 --> I2[I 关键帧]
```

## 与 AI 视频模型

- **Sora / Wan 类**：训练数据是海量压缩视频；解码后 tensor 仍是 float 像素或 latent。
- **时序建模**：3D CNN、Video Transformer 利用帧间相关性——与编解码「预测下一帧」思想同构。
- **生成成本**：生成 1 秒 720p 若逐帧扩散 24 帧 × 单帧算力，成本是单图的 **24 倍**量级；业界用 latent 空间、时序一致性模块降本。

1 分钟 512×512 训练 clip，24 fps，raw float32：
$$512 \times 512 \times 3 \times 4 \times 24 \times 60 \approx 4.5 \text{ GB}$$
实际 pipeline 用 uint8 + 压缩存储 + 按需 decode。

## 音频轨与容器

MP4/MKV **容器**打包 H.264 视频轨 + AAC 音频轨 + 字幕。体积常由**视频轨主导**（占 90%+）。多模态 LLM 若「看视频」，要先 demux + decode，再采样成帧序列或 3D patch embedding。

## 编码器世代对比

| 标准 | 年代 | 相对 H.264 效率 | 解码复杂度 |
| ---- | ---- | --------------- | ---------- |
| H.264/AVC | 2003 | 1× | 低，硬件普及 |
| H.265/HEVC | 2013 | ~1.5–2× 同画质更小 | 中高 |
| AV1 | 2018 | ~再省 30% | 高，软解慢 |

YouTube 默认 AV1 对支持设备；不支持回退 H.264。**Sora 类模型**训练集 decode 多为 H.264/H.265——artifact 分布与 AV1 不同，生成视频若用新 codec 部署需重新考虑 transcode 链。

## 直播与低延迟

直播 GOP 常 **1–2 秒**一个 I 帧（比点播更短），牺牲压缩率换 **seek 与错误恢复**。LLM 流式输出 token 类似「低延迟语义流」——与视频码流不同层，但 **带宽预算思维相同**：每秒能传多少 bit 决定体验上限。

1 小时 1080p Netflix **~3 GB**（~7 Mbps） vs raw **670 GB**——**200×** 压缩让流媒体产业成为可能；AI 视频生成若不做 latent 压缩，存储与分发成本同样不可承受。

## 视频理解模型的帧采样

Video-LLM 不会把 30 fps 全送 GPU：常 **uniform 采样 8–32 帧** 或 **关键帧 + 光流**。1 小时视频 1080p raw **670 GB**；采样 16 帧 × 224² × 3 byte ≈ **2.4 MB** 进模型——**三个数量级的 bit 削减** 在预处理完成，不靠 magic。

Sora 类生成则反过来：latent 视频 tensor **T×H×W×C** 在 VAE 空间扩散；T=121 帧、latent 16×16×4 仍是大矩阵——**时间维压缩与空间维同样重要**。

## 场景实战：YouTube 与训练 crawlers

爬取 YouTube 拿到的是 **DASH/HLS 分片**（mp4/webm），需 **ffmpeg demux + decode** 成帧 tensor。版权与存储限制使公开数据集（HowTo100M 等）常 **只存 video ID**，用户自行下载——**bit 不在 dataset 里，在平台 CDN 上**。

生成 5 秒 720p24 视频若 naive **24×5=120 帧** 各做一次 image diffusion，成本 **120× 单图**；Sora 类用 **spacetime latent** 一次 denoise 多帧——**压缩时间维 bit（latent）** 与 codec 压缩 analog 视频是不同层优化。

## 常见误区

1. **「4K 一定比 1080p 文件大 4 倍」**——还取决于码率设置；同一 codec 下像素 4 倍，但编码器可分配更多比特给复杂场景。
2. **「每帧都是 JPEG」**——只有 I 帧类似；P/B 帧存的是运动矢量 + 残差，不能单独当图打开。
3. **「AI 生成视频不需要懂 codec」**——部署时要 H.264 编码才能播放；训练数据清洗也要处理损坏 GOP。

## 动手试一试

用 ffprobe 看码率（需安装 ffmpeg）：

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,r_frame_rate,bit_rate \
  -of csv=p=0 input.mp4
# 输出示例：1920,1080,30/1,6500000  → 约 6.5 Mbps
```

Python 粗算 raw 与压缩比：

```python
w, h, fps, mbps = 1920, 1080, 30, 6.5
raw_bps = w * h * 3 * fps
enc_bps = mbps * 1e6 / 8
print(f"压缩比约 {raw_bps / enc_bps:.0f}x")
```

## 延伸思考

**B-frames** 不 display order 等于 decode order——**reorder buffer** 增加 **latency**，直播常 **禁用 B-frame**。**CRF vs CBR**：点播 **CRF** 省 bit；直播 **CBR** 稳带宽。**AV1 film grain synthesis** 在 **codec bitstream 里传 grain 参数** 而非传 noise pixel——**生成式压缩思想已进入标准 codec**。AI 生成视频若 **不经过 H.264**，浏览器 **无法 `<video>` 播**，必须 **transcode** 成 **用户设备 decoder 认识的 bit 格式**。

## 温故：视频 bit 与生成式未来

消费侧：**codec 决定 CDN 成本**；生成侧：**latent 帧数 × 分辨率** 决定 GPU 秒数。Long video consistency 要 **temporal bit 在 latent 里对齐**——与 H.264 的 motion vector 异曲同工，只是 **learned 而非 hand-crafted**。

## 小结

视频压缩 = 图像压缩 + **帧间预测**。I/P/B 帧结构、运动估计与变换编码把码率从 Gb/s 降到 Mb/s。AI 视频的数据、训练与推理成本，都建立在这层冗余之上。**生成式视频产品** 最终仍要 **H.264/AV1 编码** 才能进浏览器——plan 转码链路与 GPU 算力同样重要。**Latent 扩散** 省的是 **训练/采样 FLOPs**，不是 **delivery codec**。用户手机播放的仍是 **H.264/AV1 bitstream**。

直播 **低延迟** 与 **高压缩** 不可兼得，产品要选型。

## 第一章衔接

本章用 **bit 语言** 描述 AI 底座；第二章 **[数学](/manual/llm/bit-to-agi/02-math)** 用 **向量与矩阵** 重述同一物理过程。两章对照读：**bytes 是存储，FLOPs 是计算，带宽是瓶颈**——三个量构成工程三角。

下一篇：[声音为什么可以数字化](/manual/llm/bit-to-agi/01-bits/why-audio-digitizes)——采样定理与 Whisper 的输入从哪来。**Screen recording 60 fps** 若画面静态，P 帧 **几乎零增量 bit**——码率随 **motion 强度** 波动，不是固定常数。
