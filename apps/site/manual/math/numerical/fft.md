---
title: "快速傅里叶变换 · 从 O(n²) 到 O(n log n)"
description: "FFT 被誉为 20 世纪最重要的算法之一。它把离散傅里叶变换从 O(n²) 加速到 O(n log n)，让信号处理、音频、图像压缩、频谱方法全都成为可能。这一章讲清 DFT 在做什么、FFT 快在哪，并用代码从一段带噪信号里「捞」出隐藏的频率。"
source: "https://daiw.org/manual/numerical-computing/fft"
---

# 快速傅里叶变换 · 从 O(n²) 到 O(n log n)

第六站是三件各自成体系的**利器**。头一件，是被誉为「20 世纪最重要算法」之一的 **FFT（快速傅里叶变换）**。它的意义，不在于「发明了傅里叶变换」，而在于把它**算快了**——快到改变了整个工程世界。

## DFT：把信号拆成频率

**傅里叶变换**的核心思想：任何信号都可以拆成一堆**不同频率的正弦波的叠加**。给定 $N$ 个采样点 $x_0,\dots,x_{N-1}$，**离散傅里叶变换（DFT）** 算出每个频率成分的强度：

$$
X_k = \sum_{n=0}^{N-1} x_n\, e^{-2\pi i\, kn/N}, \qquad k = 0,1,\dots,N-1
$$

直接照这个公式算：每个 $X_k$ 要做 $N$ 次乘加，一共 $N$ 个 $X_k$，总共 **$O(N^2)$**。$N=100$ 万时，$N^2=10^{12}$——一秒钟的音频就能让计算机卡到天荒地老。

## FFT：分治，把 N² 砍成 N log N

**FFT（Cooley-Tukey 算法）** 的洞察：DFT 里藏着大量**重复计算**。把序列按下标**奇偶拆成两半**，DFT 可以递归地由两个半长的 DFT 拼出来——**分治**。于是复杂度从 $O(N^2)$ 暴跌到：

$$
O(N \log N)
$$

::: info

**这个加速有多夸张？** 取 $N=10^6$：

| 算法 | 运算量 | 相对 |
| --- | --- | --- |
| 朴素 DFT | $N^2 = 10^{12}$ | 1× |
| FFT | $N\log_2 N \approx 2\times10^7$ | **快约 5 万倍** |

从「跑一小时」变成「跑几十毫秒」。正是这 5 万倍，让**实时**音频处理、图像压缩（JPEG 的核心是 DCT，FFT 的近亲）、通信（OFDM）、频谱分析、乃至快速大整数 / 多项式乘法，全都从「理论上可行」变成「工程上现实」。算法的价值，有时就是这么直接。

:::

## 眼见为实：从噪声里捞出频率

FFT 最直观的用途：给一段混杂的信号，**找出里面藏着哪些频率**。造一个「5 Hz + 12 Hz 两个正弦波 + 噪声」的信号，让 FFT 把它们揪出来：

```python
import numpy as np

fs = 200                                    # 采样率 200 Hz
t = np.linspace(0, 1, fs, endpoint=False)
signal = (np.sin(2*np.pi*5*t)               # 5 Hz 成分
          + 0.5*np.sin(2*np.pi*12*t))       # 12 Hz 成分

X = np.fft.rfft(signal)                      # 实数信号用 rfft
freqs = np.fft.rfftfreq(len(t), 1/fs)        # 每个分量对应的频率

peaks = freqs[np.abs(X) > 10]                # 找出强度突出的频率
print(peaks)                                 # [ 5. 12.]  —— 精确捞出!
```

**FFT 在频谱上，恰好在 5 Hz 和 12 Hz 处冒出两个尖峰**——原信号里叠加的两个频率，被干干净净地分离出来。这就是频谱分析、滤波、均衡器、声纹识别背后每天在跑的事。

## 不止于信号

FFT 的能耐远不止「看频率」。因为它能在**频域**里把一些昂贵的运算变廉价：

-   **卷积 → 逐点乘法**：时域卷积等于频域相乘，于是 FFT 把 $O(N^2)$ 的卷积 / 多项式乘法降到 $O(N\log N)$——大整数乘法、滤波都靠它。
-   **图像 / 音频压缩**：变换到频域后，人眼 / 人耳不敏感的高频可以大胆丢弃（JPEG、MP3）。
-   **谱方法解 PDE**：在频域里，微分变成了简单的乘法，某些偏微分方程因此能极高精度地求解。

**日常直接用 `numpy.fft` 或 `scipy.fft`**——它们是高度优化的 FFT 实现，你几乎永远不需要自己写。

## 小结与下一章

**FFT** 把 DFT（把信号拆成频率成分，$X_k=\sum x_n e^{-2\pi i kn/N}$）从 $O(N^2)$ 分治加速到 $O(N\log N)$——$N=10^6$ 时快约 5 万倍，由此点亮了实时信号处理、图像 / 音频压缩、快速卷积、谱方法。代码上 `np.fft.rfft` 能从带噪信号里精确捞出隐藏频率。

下一件利器走另一条路——**当问题维度太高、区域太复杂，确定性方法全线崩溃时，故意「掷骰子」**：蒙特卡洛方法。👉 [蒙特卡洛：用随机性做计算](/manual/math/numerical/monte-carlo)。

## 参考文献

-   \[1\] Cooley & Tukey.「An Algorithm for the Machine Calculation of Complex Fourier Series.」1965. —— FFT 原始论文。
-   \[2\] Brigham.《The Fast Fourier Transform and Its Applications》—— FFT 应用经典。
-   \[3\] NumPy 文档.「numpy.fft.」[https://numpy.org/doc/stable/reference/routines.fft.html](https://numpy.org/doc/stable/reference/routines.fft.html) —— 库实现。
