---
title: "数值积分 · 梯形、Simpson 与自适应"
description: "数值积分和数值微分恰好相反——它又稳又好算（积分抹平误差，微分放大误差）。这一章从梯形法讲到 Simpson（精度从 O(h²) 跳到 O(h⁴)）、自适应积分和高斯求积，并说清为什么 scipy.integrate.quad 是你日常的默认选择。"
source: "https://daiw.org/manual/numerical-computing/integration"
---

# 数值积分 · 梯形、Simpson 与自适应

上一章的[数值微分](/manual/math/numerical/differentiation)让人头疼（天生不稳）。这一章是它的反面——**数值积分（quadrature）又稳又好算**，你可以松口气。

::: info

**为什么积分比微分「乖」？** 因为**微分是「放大」，积分是「抹平」。** 微分在算「局部的变化率」，对噪声和误差极其敏感（一点点抖动斜率就大变）；积分在算「整体的累加 / 面积」，把局部的抖动**平均掉了**——误差在求和中相互抵消、被抹平。所以数值积分**没有微分那种 U 形陷阱**，步长越细通常就越准，踏踏实实。这是数值计算里一个深刻的对称：**求导危险，积分安全。**

:::

## 从「切成小条」开始

数值积分的基本思想：把积分区间**切成小段**，每段用简单形状（矩形、梯形、抛物线）近似曲线下的面积，加起来。近似的形状越贴合，越准。

**梯形法（trapezoidal）**——每段用一个梯形（直线连两端）：

$$
\int_a^b f\,dx \approx h\left(\frac{y_0}{2} + y_1 + \cdots + y_{n-1} + \frac{y_n}{2}\right),\quad \text{误差 } O(h^2)
$$

**Simpson 法**——每两段用一条**抛物线**拟合（比直线贴合得多），精度直接跳两个阶：

```python
import numpy as np

def trapezoid(f, a, b, n):
    x = np.linspace(a, b, n + 1); y = f(x); h = (b - a) / n
    return h * (y[0]/2 + y[1:-1].sum() + y[-1]/2)

def simpson(f, a, b, n):                 # n 必须是偶数
    x = np.linspace(a, b, n + 1); y = f(x); h = (b - a) / n
    return h/3 * (y[0] + y[-1] + 4*y[1:-1:2].sum() + 2*y[2:-2:2].sum())

f = lambda x: np.exp(-x**2)
true = 0.7468241328124271                # ∫₀¹ e^{-x²} dx 的真值

for n in [4, 8, 16]:
    print(f"n={n:2d}  梯形误差={abs(trapezoid(f,0,1,n)-true):.2e}"
          f"   Simpson误差={abs(simpson(f,0,1,n)-true):.2e}")
```

```text
n= 4  梯形误差=1.53e-03   Simpson误差=8.51e-06
n= 8  梯形误差=3.83e-04   Simpson误差=5.29e-07
n=16  梯形误差=9.57e-05   Simpson误差=3.30e-08
```

**梯形每翻倍点数、误差降 4 倍（$O(h^2)$）；Simpson 降 16 倍（$O(h^4)$）。** 同样的点数，Simpson 准得多——一条抛物线比一条直线会贴合太多。

## 自适应：哪里陡，就在哪里加密

均匀切段有个浪费：函数**平坦的地方**其实不需要那么多点，**陡峭 / 剧烈变化的地方**才需要加密。**自适应积分（adaptive quadrature）** 就干这个——它**自动**在函数变化剧烈处细分、平缓处粗放，用最少的函数求值达到目标精度。这也是库函数的做法。

## 高斯求积：用更少的点算更准

还有一招更聪明的：**高斯求积（Gaussian quadrature）**。前面的方法都在**等距**点上取值；高斯求积**同时优化「取值点的位置」和「每个点的权重」**，让 $n$ 个点能**精确**积分到 $2n-1$ 次多项式——用极少的点榨出极高的精度。它是很多高精度积分器的核心。

## 实践：直接用 quad

::: info

**日常算积分，别手写——用 `scipy.integrate.quad`。** 它基于自适应的高斯-Kronrod 求积，又准又稳，还**顺带返回一个误差估计**，让你知道结果可信到什么程度：

```python
from scipy.integrate import quad
val, err = quad(lambda x: np.exp(-x**2), 0, 1)
print(val, err)      # 0.7468241328124271  误差估计 ≈ 8.3e-15
```

那个返回的 `err`（误差估计）很宝贵——大多数数值方法**不会告诉你结果有多准**，而 `quad` 会。手写梯形 / Simpson 是为了理解原理；真要算，`quad` 是默认答案。多重积分有 `dblquad`/`tplquad`，无穷区间、奇点它也能处理。

:::

## 小结与下一章

数值积分**又稳又好算**（积分抹平误差，与[微分](/manual/math/numerical/differentiation)放大误差正相反，无 U 形陷阱）。梯形法 $O(h^2)$、Simpson $O(h^4)$（抛物线拟合，精度跳两阶）；自适应在陡处加密；高斯求积用最少的点榨最高精度。**日常直接用 `scipy.integrate.quad`**（自适应 + 误差估计）。

积分是「已知导数（被积函数），求原函数的增量」的静态版本。它的动态推广，是数值计算里极其重要的一大类问题——**微分方程**：已知变化率 $y'=f(t,y)$，求 $y$ 随时间怎么演化。下一章从最简单的 Euler 法讲到主力 RK4。👉 [常微分方程：从 Euler 到 RK4](/manual/math/numerical/ode-euler-rk)。

## 参考文献

-   \[1\] Burden & Faires.《Numerical Analysis》, ch. 4 —— 数值积分与高斯求积。
-   \[2\] Cleve Moler.《Numerical Computing with MATLAB》, ch. 6 —— 自适应积分。
-   \[3\] SciPy 文档.「scipy.integrate.quad.」[https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.quad.html](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.quad.html) —— 库实现。
