---
title: "刚性与隐式方法 · 显式为什么会爆炸"
description: "有些 ODE「快慢尺度悬殊」，叫刚性方程。对它，RK4 这类显式方法会被迫用小到离谱的步长——不是为了精度，是为了不爆炸。这一章用 y'=-1000y 演示显式发散，再用隐式方法（每步解个方程）取回任意大步长的稳定。"
source: "https://daiw.org/manual/numerical-computing/stiffness"
---

# 刚性与隐式方法 · 显式为什么会爆炸

[上一章](/manual/math/numerical/ode-euler-rk)的 RK4 很好用——**在非刚性问题上**。可有一类 ODE 会让它（以及所有**显式**方法）集体翻车，哪怕真解平滑得像条水平线。这类方程叫**刚性（stiff）**，是 ODE 数值解最深的坑。

## 演示：一个会爆炸的简单方程

考虑史上最无聊的方程 $y' = -1000y$，$y(0)=1$。真解是 $y=e^{-1000t}$——**飞快衰减到 0，然后一直贴着 0**，平滑无比，没有任何戏剧性。可用**显式 Euler** 去解它：

```python
def forward_euler(lam, y0, h, n):
    y, ys = y0, [y0]
    for _ in range(n):
        y = y + h * lam * y          # y_{n+1} = (1 + hλ) y_n
        ys.append(y)
    return ys

# λ=-1000,步长 h=0.0025
print(forward_euler(-1000, 1.0, 0.0025, 8))
# [1, -1.5, 2.25, -3.375, 5.06, -7.59, 11.4, -17.1, 25.6]
```

**真解安静地衰减到 0，数值解却在 $\pm$ 之间越震越大，冲向无穷——爆炸了。** 而且注意：$h=0.0025$ 已经很小了（才 2.5 毫秒），依然炸。

## 病根：稳定性，不是精度

为什么炸？显式 Euler 每步是 $y_{n+1} = (1 + h\lambda)\,y_n$——每步把 $y$ 乘上**放大因子** $1+h\lambda$。要不发散，必须 $|1+h\lambda| < 1$。这里 $\lambda=-1000$，于是要求：

$$
|1 - 1000h| < 1 \;\Longrightarrow\; 0 < h < 0.002
$$

::: warning

**关键：$h < 0.002$ 这个限制，是为了「不爆炸（稳定）」，不是为了「算得准（精度）」！** 真解平滑无奇，精度上你用大步长毫无问题——可显式方法**为了不发散**，被强迫把步长压到 $0.002$ 以下。如果这个衰减发生在一个要模拟很长时间的系统里，你就得走**成千上万**个这种小步，慢到无法接受。**「明明解很温和，显式方法却被迫用极小步长」，这就是刚性的定义性症状。** 刚性通常来自系统里**快慢尺度悬殊**（有的分量瞬间衰减、有的慢慢变化），显式方法的步长被那个**最快**的分量卡死，哪怕你只关心慢的。

:::

## 解药：隐式方法

出路是**隐式方法**。最简单的**隐式（后向）Euler**，把斜率取在**终点**而非起点：

$$
y_{n+1} = y_n + h\, f(t_{n+1},\, y_{n+1})
$$

注意 $y_{n+1}$ **同时出现在等号两边**——它是「隐式」定义的，每步得**解一个方程**才能求出 $y_{n+1}$。对 $y'=-1000y$，这个方程能直接解出 $y_{n+1} = \dfrac{y_n}{1+1000h}$：

```python
def backward_euler(lam, y0, h, n):
    y, ys = y0, [y0]
    for _ in range(n):
        y = y / (1 - h * lam)        # 解出 y_{n+1};这里 = y_n/(1+1000h)
        ys.append(y)
    return ys

# 步长 h=0.1,比显式的极限大 50 倍!
print(backward_euler(-1000, 1.0, 0.1, 5))
# [1, 0.0099, 9.8e-5, 9.7e-7, 9.6e-9, 9.5e-11]  —— 平稳衰减到 0,不炸
```

**用 $h=0.1$（是显式稳定极限的 50 倍），隐式方法稳稳地衰减到 0，毫无爆炸。** 因为它的放大因子是 $\dfrac{1}{1+1000h}$，**无论 $h$ 多大，绝对值都 $<1$**——对任意步长都稳定。刚性问题的克星，正是这种「无条件稳定」的隐式方法。

## 取舍：每步更贵，但步子能迈大

::: info

**隐式方法不是免费的：每步要解一个方程**（上面是线性的、能直接解；一般的非线性 $f$ 要用[牛顿法](/manual/math/numerical/newton)迭代，还常要解[线性方程组](/manual/math/numerical/gaussian-lu)）。所以**单步比显式贵**。但对刚性问题，它能迈**巨大**的步子而不失稳——步数少几个数量级，**总账**上远远划算。这是个经典权衡：**显式（每步便宜、步长受限）vs 隐式（每步贵、步长自由）。非刚性用显式（RK4），刚性用隐式。**

实践中，`solve_ivp` 给刚性问题准备了专门的方法：

```python
from scipy.integrate import solve_ivp
# method='BDF' 或 'Radau' 是隐式方法,专治刚性
sol = solve_ivp(lambda t, y: -1000*y, [0, 1], [1.0], method='BDF')
```

**怎么判断问题刚性？** 症状很典型：用默认（显式）方法跑，它**慢得离谱、或步长被压到极小、或干脆报 warning**——这时换 `method='BDF'`，往往立竿见影。

:::

## 小结与整站回顾

刚性方程「快慢尺度悬殊」，让**显式**方法（RK4 等）为了**稳定**（而非精度）被迫用极小步长，否则**爆炸**——$y'=-1000y$ 演示得淋漓尽致。**隐式方法**（后向 Euler、BDF）每步解个方程，换来**任意步长的稳定**；单步更贵，但刚性问题上总账大赚。**非刚性用显式，刚性用隐式**（`solve_ivp` 的 `BDF`/`Radau`）。

微积分数值版（微分、积分、ODE、刚性）到此走完。下一站是三件各自成体系的**利器**——快速傅里叶变换、蒙特卡洛、最优化，它们在数值计算里各占一方天地。先看名震江湖的 FFT。👉 [快速傅里叶变换：从 O(n²) 到 O(n log n)](/manual/math/numerical/fft)。

## 参考文献

-   \[1\] Hairer & Wanner.《Solving Ordinary Differential Equations II: Stiff and Differential-Algebraic Problems》—— 刚性问题权威。
-   \[2\] Cleve Moler.《Numerical Computing with MATLAB》, §7.9 —— 刚性直观解释。
-   \[3\] SciPy 文档.「solve\_ivp — BDF / Radau methods.」[https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve\_ivp.html](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html) —— 刚性求解器。
