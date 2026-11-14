---
title: "机器精度 · 误差有多大，以及怎么压住它"
description: "「存不准」到底不准多少？机器精度 ε 给出了精确标尺——单次运算的相对误差不超过它。这一章量化 float64 的精度（约 16 位有效数字），看误差在长累加里怎么滚大，并用 Kahan 补偿求和把它压住。"
source: "https://daiw.org/manual/numerical-computing/machine-epsilon"
---

# 机器精度 · 误差有多大，以及怎么压住它

上一章说浮点数「存不准」。不准多少？这不是玄学，有个精确的标尺——**机器精度（machine epsilon，记 $\epsilon$）**。

## 机器精度：相邻浮点数之间的缝

机器精度的定义是：**$1.0$ 和「比它大的下一个能表示的浮点数」之间的间隔**。对 `float64`，这个值约为 $2.22\times10^{-16}$：

```python
import numpy as np
print(np.finfo(np.float64).eps)      # 2.220446049250313e-16
print(np.finfo(np.float32).eps)      # 1.1920929e-07  (单精度差得多)
```

它的意义在于**框定了单次运算的相对误差**。任何一次浮点运算（加减乘除）的结果，和真实值之间的**相对**误差，都不超过约 $\tfrac{1}{2}\epsilon$：

$$
\text{fl}(x \circ y) = (x \circ y)(1 + \delta), \qquad |\delta| \le \tfrac{1}{2}\epsilon
$$

换算成人话：**`float64` 大约有 15~16 位十进制有效数字，`float32` 只有 7~8 位。** 超出这个精度的位，全是不可信的噪声。一个直观的演示——给 $1.0$ 加上半个 $\epsilon$，它「小到」根本改变不了 $1.0$：

```python
eps = np.finfo(np.float64).eps
print(1.0 + eps/2 == 1.0)       # True — 半个 eps 加上去,等于没加
print(1.0 + eps   == 1.0)       # False — 一个完整 eps 才够跨到下一个浮点数
```

## 误差会累积

单次运算误差小到 $10^{-16}$，听着可以忽略。但**运算成千上万次，误差会累积、放大**。最简单的例子——把 `0.1` 加十次，结果居然不是 `1.0`：

```python
s = 0.0
for _ in range(10):
    s += 0.1
print(s, s == 1.0)
# 0.9999999999999999 False
```

每次加 `0.1`（本身就[存不准](/manual/math/numerical/floating-point)）都引入一点舍入误差，十次攒下来，就差出了最后一位。**加的次数越多、数据量级差得越大，累积误差越严重。** 一个求和上亿个数的科学计算，朴素地一个个加，末尾可能丢掉好几位有效数字。

## 一门「艺术」：Kahan 补偿求和

累积误差不是没救。有个漂亮的技巧叫 **Kahan 补偿求和（compensated summation）**：它用一个额外变量，**追踪每一步被舍掉的那一点点误差，并在下一步把它补回来**。

```python
def kahan_sum(nums):
    total = 0.0
    c = 0.0                      # c:记录上一步丢掉的低位误差
    for x in nums:
        y = x - c                # 把上次的误差补进这次
        t = total + y
        c = (t - total) - y      # 算出这次又丢了多少(数学上为 0,浮点下不为 0)
        total = t
    return total

print(kahan_sum([0.1] * 10))     # 1.0  —— 补偿之后,精确了
```

`c = (t - total) - y` 这一行是精髓：数学上它恒等于 0，但**在浮点运算下，它恰好捕捉到了这一步加法丢掉的低位**，留到下一轮补回去。于是长求和的误差从「随次数增长」压到了几乎恒定。

::: info

**实践中你不必自己写 Kahan**——Python 标准库的 `math.fsum` 和 NumPy 在很多地方已经用了更精巧的补偿 / 成对求和：

```python
import math
print(math.fsum([0.1] * 10))   # 1.0  —— 标准库的精确求和
```

但理解 Kahan 的意义，在于它示范了数值计算的核心思维：**误差不是「认命」，而是可以被分析、被追踪、被主动补偿的。** 面对一个精度不够的计算，与其换更高精度的类型（慢、也未必够），不如想想能不能**重新安排运算，让误差自己抵消**——这正是「艺术」二字的分量。后面几乎每一章，都有这种「换个算法，误差就小一个数量级」的例子。

:::

## 一个实用推论：相对误差 vs 绝对误差

机器精度框定的是**相对**误差，这提醒我们：**判断「算得准不准」，通常要看相对误差，而非绝对误差。**

-   算一个约 $10^{9}$ 的量，绝对误差 $100$ 其实很好（相对才 $10^{-7}$）。
-   算一个约 $10^{-9}$ 的量，绝对误差 $100$ 是灾难（相对高达 $10^{11}$）。

所以上一章的容差比较，严谨版常常是**混合容差**：`abs(a-b) <= atol + rtol*abs(b)`（`np.isclose` 正是这么做的）——绝对容差 `atol` 兜住接近 0 的情形，相对容差 `rtol` 兜住大数。**「误差多大」永远要问「相对于什么」。**

## 小结与下一章

机器精度 $\epsilon\approx2.2\times10^{-16}$（float64）框定了单次运算的相对误差，对应约 16 位有效数字。误差会随运算次数**累积**；但它可被**主动补偿**（Kahan 求和 / `math.fsum`），这体现了数值计算「重排运算压制误差」的核心思维。判断精度要看**相对误差**。

累积是误差「慢慢变大」；还有一种误差会**瞬间爆炸**——两个相近的数一相减，有效数字当场湮灭。这是数值计算的头号杀手，下一章专讲。👉 [灾难性抵消：两个相近的数相减](/manual/math/numerical/cancellation)。

## 参考文献

-   \[1\] Nick Higham.《Accuracy and Stability of Numerical Algorithms》, ch. 2-4 —— 舍入误差与求和的权威分析。
-   \[2\] William Kahan.「Further remarks on reducing truncation errors.」1965. —— Kahan 求和原始文献。
-   \[3\] NumPy 文档.「numpy.finfo / isclose.」[https://numpy.org/doc/stable/](https://numpy.org/doc/stable/) —— 机器精度与容差比较。
