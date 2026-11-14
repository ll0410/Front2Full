---
title: "常微分方程 · 从 Euler 到 RK4"
description: "已知变化率 y'=f(t, y)，求 y 随时间怎么演化——这是数值计算里极重要的一大类问题。这一章从最简单的 Euler 法（沿切线走一步）讲到主力 RK4（每步探四个斜率），用代码对比精度，并给出实践默认 solve_ivp。"
source: "https://daiw.org/manual/numerical-computing/ode-euler-rk"
---

# 常微分方程 · 从 Euler 到 RK4

**常微分方程（ODE）** 是数值计算里最有分量的一块：物理运动、化学反应、电路、人口、传染病模型……凡是「随时间演化」的系统，都归结为一个 ODE：

$$
\frac{dy}{dt} = f(t, y), \qquad y(t_0) = y_0
$$

已知**变化率** $f$ 和**初值** $y_0$，求 $y$ 随时间怎么走。解析解往往求不出，只能数值地**一步步往前推**。

## Euler 法：沿切线走一步

最朴素的想法：当前在 $(t_n, y_n)$，变化率 $f(t_n,y_n)$ 就是此刻的斜率，那就**沿这个斜率走一小步 $h$**，到达下一点：

$$
y_{n+1} = y_n + h\, f(t_n, y_n)
$$

这就是 **Euler 法**。像[牛顿法](/manual/math/numerical/newton)沿切线滑一样，它沿解曲线的切线走一步，一步步拼出整条轨迹。

```python
import numpy as np

def euler(f, y0, t0, t1, h):
    t, y = t0, y0
    while t < t1 - 1e-12:
        y = y + h * f(t, y)          # 沿当前斜率走一步
        t += h
    return y

f = lambda t, y: y                    # y' = y,初值 y(0)=1,真解是 eᵗ
print(euler(f, 1.0, 0, 1, 0.1))       # 2.5937...  (真值 e=2.71828,差不少)
```

Euler 简单，但**精度差**——它是**一阶方法**，误差 $O(h)$，而且误差会随步数**累积**。上面用 $h=0.1$ 算 $e$，结果 $2.59$，差了 5%。要准就得把 $h$ 取得很小，步数暴增。

## RK4：每步多探几个斜率

Euler 的毛病是「只用了起点的斜率」——可这一步内斜率会变啊。**四阶龙格-库塔法（RK4）** 的主意：**一步之内，在起点、中点、终点各探几次斜率，加权平均**，得到一个准得多的「有效斜率」再走：

```python
def rk4(f, y0, t0, t1, h):
    t, y = t0, y0
    while t < t1 - 1e-12:
        k1 = f(t,       y)             # 起点斜率
        k2 = f(t + h/2, y + h/2*k1)    # 用 k1 试探到中点的斜率
        k3 = f(t + h/2, y + h/2*k2)    # 再修正一次中点斜率
        k4 = f(t + h,   y + h*k3)      # 终点斜率
        y = y + h/6 * (k1 + 2*k2 + 2*k3 + k4)   # 加权平均
        t += h
    return y

print(rk4(f, 1.0, 0, 1, 0.1))         # 2.718279...  几乎就是 e!
print(np.e)                            # 2.718281828...
```

**同样的 $h=0.1$，Euler 差 5%，RK4 只差百万分之一。** RK4 是**四阶方法**，误差 $O(h^4)$——每步多花几次函数求值，换来精度暴涨。**它是解 ODE 的核心主力**，「非刚性问题用 RK4」是常识。

## 阶与步长：精度的两个旋钮

| 方法 | 阶 | 误差 | 每步代价 |
| --- | --- | --- | --- |
| Euler | 1 | $O(h)$ | 1 次求值 |
| RK2（中点法） | 2 | $O(h^2)$ | 2 次 |
| RK4 | 4 | $O(h^4)$ | 4 次 |

调精度有两个旋钮：**减小步长 $h$**（线性增加步数）或**提高方法的阶**（每步多算但收敛快）。RK4 是「阶」和「每步代价」之间公认的甜点。更进一步，**自适应步长**（如 RK45）会**自动**在解平缓处放大步长、剧变处缩小——省算力、控误差。

::: info

**实践默认：`scipy.integrate.solve_ivp`。** 它内置自适应步长的 RK45（以及给刚性问题的方法），你只管给 $f$、区间、初值：

```python
from scipy.integrate import solve_ivp
sol = solve_ivp(lambda t, y: y, [0, 1], [1.0])
print(sol.y[0, -1])      # ≈ 2.71828  (自动控制步长和误差)
```

手写 Euler / RK4 是为了理解「一步步推进」的原理；真解 ODE 用 `solve_ivp`——它自适应、带误差控制、还能切换算法应对下一章的刚性问题。

:::

## 小结与下一章

ODE $y'=f(t,y)$ 靠**一步步推进**求解：**Euler** 沿切线走一步（一阶 $O(h)$，简单但差）；**RK4** 每步探四个斜率加权平均（四阶 $O(h^4)$，精度暴涨，主力）。调精度靠减步长或提阶，自适应步长（RK45）自动权衡。实践用 `solve_ivp`。

但 RK4 这类**显式**方法有个致命软肋：遇到「快慢尺度悬殊」的**刚性方程**，它会被迫用小到离谱的步长，否则直接**爆炸**——哪怕真解平滑无比。这是 ODE 数值解最深的一个坑，下一章专门拆解。👉 [刚性与隐式方法：显式为什么会爆炸](/manual/math/numerical/stiffness)。

## 参考文献

-   \[1\] Hairer, Nørsett & Wanner.《Solving Ordinary Differential Equations I》—— ODE 数值解权威。
-   \[2\] Burden & Faires.《Numerical Analysis》, ch. 5 —— Euler 与 Runge-Kutta。
-   \[3\] SciPy 文档.「scipy.integrate.solve\_ivp.」[https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve\_ivp.html](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html) —— 库实现。
