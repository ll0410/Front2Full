---
title: "图片为什么可以压缩"
description: "空间冗余、感知冗余与 JPEG/PNG——768 KB 原图如何变成 80 KB。"
source: "https://daiw.org/manual/bit-to-agi/01-bits/why-images-compress"
---

# 图片为什么可以压缩

> 空间冗余、感知冗余与 JPEG/PNG——768 KB 原图如何变成 80 KB。

一张 1024×1024 的 RGB 图，未压缩约 **3 MB**（$1024^2 \times 3$ 字节），存成 JPEG 可能只有 **200–400 KB**，肉眼几乎看不出差别。压缩不是「魔法删数据」，而是利用**冗余**：相邻像素很像、人眼对某些误差不敏感。

理解图像压缩，就理解多模态模型里「图像 token 化」和 dataset 存储为什么可行。

## 直觉：相邻像素在说同一件事

蓝天区域上千像素 RGB 值可能是 `(135, 206, 235)` 与 `(134, 205, 234)` 的微小波动——用「平均值 + 一点点差」描述，比存每个像素省得多。JPEG 还丢弃人眼不敏感的高频细节（比如细微纹理），进一步变小。

## 定义：无损 vs 有损

| 类型 | 能否原样还原 | 典型格式 | 压缩比（经验） |
| ---- | ------------ | -------- | -------------- |
| 无损 | 能 | PNG、WebP-lossless | 2–3× |
| 有损 | 不能 bitwise 还原 | JPEG、WebP-lossy | 5–20× |

**信息论**：真实照片熵远低于随机噪声；随机 3 MB 数据几乎不可压缩（柯尔莫哥洛夫复杂度 ≈ 原长）。

## 例子一：未压缩 vs JPEG 体积

```
1024 × 1024 × 3 = 3,145,728 字节 ≈ 3.0 MiB  （raw RGB）
JPEG quality=85 常见 ≈ 300 KB，约 10× 压缩
512×512 训练常用分辨率：raw ≈ 768 KB → JPEG ≈ 50–100 KB
```

Stable Diffusion 训练集 LAION 以 WebP/JPEG 存图，总 **数十 TB**；若全 raw RGB 会是 **数百 TB**，成本不可接受。

## 例子二：PNG 无损原理简述

1. 预测相邻像素（Paeth 滤波），得到**残差**（很多 0 或小整数）。
2. 残差 **DEFLATE**（LZ77 + Huffman）——与 zip 同源。

```python
# 用 Pillow 粗测压缩比（需安装 Pillow）
from PIL import Image
import io
img = Image.new("RGB", (512, 512), (100, 150, 200))
raw = img.tobytes()
buf = io.BytesIO()
img.save(buf, format="JPEG", quality=85)
jpeg = buf.getvalue()
print(f"raw {len(raw)} B, jpeg {len(jpeg)} B, ratio {len(raw)/len(jpeg):.1f}x")
```

## JPEG 流水线（量化视角）

1. RGB → YCbCr（亮度 + 色度；人眼对色度分辨率低）。
2. 分块 8×8，**DCT**（离散余弦变换）→ 频率系数。
3. **量化**：除以表再取整，高频系数变 0（主要有损步骤）。
4. Zigzag + 游程编码 + Huffman。

质量因子 q=50 时，高频能量可能丢弃 **90%+** 系数，体积骤降。

## 与 AI 的关系

- **ViT / CLIP**：输入常 resize 到 224×224，再归一化 float tensor；JPEG  artifact 会进模型，数据增强用随机 JPEG 质量模拟。
- **Latent Diffusion**：不在像素空间扩散，而在 **4× 下采样** 的 latent（如 64×64×4），进一步减算力；像素级压缩与 latent 压缩是不同层次。
- **Dataset**：1M 张 512 图，JPEG 平均 80 KB → **~80 GB**；raw → **~750 GB**。

## WebP 与 AVIF：新一代格式

**WebP**（Google）：有损类似 JPEG，无损类似 PNG，体积常再省 **25–35%**；浏览器与 CDN 广泛支持。**AVIF** 基于 AV1 视频帧内编码，同样 512×512 照片可能比 JPEG 再小 **30–50%**，编码慢、解码中等——适合静态 CDN，训练 pipeline 解码成本需 benchmark。

LAION-5B 等数据集混合 JPEG/WebP；DataLoader 多进程 decode 常占 CPU **30–50%** 训练时间——**压缩格式影响 AI 训练吞吐**，不只是磁盘体积。

## 感知与 SSIM/PSNR

客观指标 **PSNR**（峰值信噪比）与主观质量不完全一致；**SSIM** 结构相似性更接近人眼。超分模型优化 PSNR 可能过平滑；生成模型用 LPIPS（学习感知指标）——都建立在「像素 = 数字矩阵」之上。

训练数据增广 `RandomJPEG(quality=30–95)` 故意引入 block artifact，提升模型对压缩噪声鲁棒性——**压缩伪影是 AI 见过的真实世界的一部分**。

## CLIP 与 ViT：从 JPEG 到 patch embedding

OpenAI CLIP 训练 pipeline：Web 上 **4亿** 图文对，图像 side 解码 JPEG → resize **224×224** → 归一化 → 切成 **16×16=256** 个 patch，每 patch 展平成向量经 linear 投到 embedding 维——**第一步就把像素 bit 变成 float 矩阵行**。

Patch size 14、image 224 → grid 16×16 patches。更大 ViT（384、518）线性增 token 数 → **Attention $O(T^2)$** 算力涨——压缩只在存储侧；进模型后是 **未压缩 float tensor**（除非 input quantization）。

## 场景实战：DALL·E 输入图与 data URL

网页里 `data:image/jpeg;base64,/9j/4AAQ...` 把 **JPEG 比特 Base64 编码**成 ASCII 文本（体积膨胀 **4/3**），再 POST 给 API。服务端 decode → 像素 tensor → VAE encoder → latent diffusion。**Base64 只是 transport 编码**，不改变「图像 = 压缩 bit 流」本质。

训练 dataloader：`PIL.Image.open()` decode JPEG → `ToTensor()` 变 **CHW float [0,1]**，归一化 **mean/std**——从 **8 bit 像素** 到 **32 bit float**，体积膨胀 **4×**，算力换精度。

## 常见误区

1. **「PNG 总是比 JPEG 小」**——照片 JPEG 通常更小；PNG 适合图标、截图（大块纯色）。
2. **「压缩损失等于模糊」**——block artifact、ringing 是 DCT 量化特有；不是单纯高斯模糊。
3. **「AI 超分辨率能恢复 JPEG 删掉的频率」**——模型在「猜」合理细节，不是恢复真信息。

## 动手试一试

观察相邻像素相关性（冗余来源）：

```python
from PIL import Image
import numpy as np
# 任选一张本地照片路径
path = "photo.jpg"
a = np.array(Image.open(path).convert("RGB"), dtype=np.int16)
diff = np.abs(a[:, 1:, :] - a[:, :-1, :])  # 水平相邻差
print("平均相邻差:", diff.mean(), "最大:", diff.max())
# 自然图平均差通常远小于 255；随机噪声接近 ~85
```

## 延伸思考

**Progressive JPEG** 先模糊后清晰——**bit 按频率分层传输**；**super-resolution** 模型学的是 **从少 bit 猜多 bit** 的统计映射，非恢复真高频。**Diffusion** 在 **latent 4× 下采样** 空间工作，512 图变 64×64×4 channel latent，**pixel bit 经 VAE 压到更少 float bit** 再扩散——**压缩与生成是同一套「少 bit 表示多信息」思想的两面**。

## 温故：图像 bit 贯穿多模态

Upload → decode JPEG **bit** → tensor float → ViT patch → transformer → 可能再 **decode 到像素 bit** 保存。任一环节 **分辨率翻倍**，像素 bit **×4**，算力 **×4** 起（Attention 更惨）。产品定 **max edge 1024** 不是随意，是 **bit 与 FLOPs 预算**。

## 小结

图像可压缩，因为像素高度相关且人眼有感知盲区。JPEG 用 DCT+量化做有损压缩，PNG 用预测+DEFLATE 做无损。多模态 AI 的数据与输入 pipeline 都依赖这一事实。**Dataset 存 JPEG、训练读 tensor** 是工业界默认——别用 raw PNG 堆满 NAS，除非做无损科研。**Augmentation** 里 RandomJPEG 是免费 domain robustness。**CLIP 224×224** 输入比原图 **小几个数量级 pixel bit**，是多模态默认 trade-off。

**Progressive JPEG** 适合 web 渐进显示。

## 第一章衔接

本章用 **bit 语言** 描述 AI 底座；第二章 **[数学](/manual/llm/bit-to-agi/02-math)** 用 **向量与矩阵** 重述同一物理过程。两章对照读：**bytes 是存储，FLOPs 是计算，带宽是瓶颈**——三个量构成工程三角。

下一篇：[为什么视频可以压缩](/manual/llm/bit-to-agi/01-bits/why-video-compresses)——在时间维度上再利用冗余。**WebP lossy quality=80** 对照片常 **比 JPEG 小 25%**；dataset 全转 WebP 可省 **数 TB 存储 bit**，代价是 DataLoader **decode CPU 时间** 略升——**存储与算力 trade-off**。
