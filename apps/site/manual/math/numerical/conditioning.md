---
title: "条件数与稳定性 · 是问题病态，还是算法不稳"
description: "误差放大有两种：一种是算法写得不好（可以换算法救），一种是问题本身对误差敏感（再好的算法也救不了）。区分它们靠两个词——稳定性（算法的属性）和条件数（问题的属性）。这一章讲清，并教你算出「这个结果还能信几位」。"
source: "https://daiw.org/manual/numerical-computing/conditioning"
---

# 条件数与稳定性 · 是问题病态，还是算法不稳

误差地基的最后一块拼图，是分清一个关键区别：**同样是「结果误差大」，到底该怪算法，还是怪问题本身？** 这两者的解法完全不同，混淆了就会白费力气。

-   **稳定性（stability）** 是**算法**的属性：一个好算法，不会把输入的小误差滚成输出的大误差。[上一章](/manual/math/numerical/cancellation)朴素求根公式就是**不稳定**的——换个等价写法就救了。
-   **条件数（condition number）** 是**问题**的属性：它衡量「问题本身」对输入扰动有多敏感。**条件数大的问题叫「病态（ill-conditioned）」——它天生难算，再完美的算法也给不出很多位正确答案。**

::: info

一个比喻：**稳定性是「司机技术好不好」，条件数是「路本身好不好走」。** 烂路（病态问题）上，再好的司机也开不快、还容易出事；好路上，烂司机（不稳定算法）照样能翻车。**先看路（条件数），再看司机（稳定性）。** 拿到一个诡异结果，第一件事是判断：是问题病态（认命，或改问题），还是我算法没写好（可以修）？

:::

## 条件数：误差被放大多少倍

条件数量化「输出相对误差 ÷ 输入相对误差」的**放大倍数**。对解线性方程组 $Ax=b$，矩阵的条件数是：

$$
\kappa(A) = \lVert A \rVert \cdot \lVert A^{-1} \rVert
$$

它给出一个铁一样的误差界：**输入（右端 $b$）的相对扰动，会被放大最多 $\kappa(A)$ 倍传到解 $x$ 上**：

$$
\frac{\lVert \Delta x \rVert}{\lVert x \rVert} \;\le\; \kappa(A)\,\frac{\lVert \Delta b \rVert}{\lVert b \rVert}
$$

::: warning

**一条极其好用的经验法则：$\kappa(A)\approx 10^{k}$，你就会丢掉大约 $k$ 位有效数字。** `float64` 总共约 16 位，所以 $\kappa\approx10^{10}$ 的问题，解只剩约 6 位可信；$\kappa\approx10^{16}$，**一位都不剩**，算出来的解可能纯属噪声。**算一个数值问题前，先估一下条件数——它直接告诉你「结果最多能信几位」。**

:::

## 眼见为实：病态矩阵

有些矩阵是出了名的病态，**希尔伯特矩阵**是教科书级的坏例子。看它的条件数，再看它怎么把微小扰动放大：

```python
import numpy as np

n = 6
H = np.array([[1/(i + j + 1) for j in range(n)] for i in range(n)])
print(f"条件数 κ(H) = {np.linalg.cond(H):.2e}")
# 条件数 κ(H) = 1.50e+07   —— 病态,预计丢掉约 7 位

# 造一个已知解 x=[1,1,...,1],对应右端 b
x_true = np.ones(n)
b = H @ x_true

# 把右端 b 扰动一丁点(相对约 1e-10)
b2 = b.copy()
b2[0] += 1e-10

x  = np.linalg.solve(H, b)
x2 = np.linalg.solve(H, b2)
print(f"b 的相对扰动 ≈ {1e-10 / np.linalg.norm(b):.1e}")
print(f"x 的相对变化 ≈ {np.linalg.norm(x2 - x) / np.linalg.norm(x):.1e}")
# b 的相对扰动 ≈ 1e-10
# x 的相对变化 ≈ 1e-3     —— 输入扰动被放大了约 κ=1e7 倍!
```

$b$ 只动了相对 $10^{-10}$，解 $x$ 却变了相对 $10^{-3}$——放大了约 $10^{7}$ 倍，正好是条件数的量级。**注意：这里 `np.linalg.solve` 已经是相当稳定的算法了，结果依然烂——因为问题本身病态，不怪算法。** 换任何算法都救不了；能救的只有「换个不病态的问题表述」（比如用正交化、或改变量）。

## 函数的条件数

条件数不只属于矩阵。任何计算 $y=f(x)$，都有条件数，衡量输入 $x$ 的相对扰动怎么放大到 $y$：

$$
\kappa_f = \left| \frac{x\, f'(x)}{f(x)} \right|
$$

举个例子：$f(x)=\ln x$ 在 $x\to 1$ 附近，$\kappa_f = |1/\ln x|\to\infty$——**在 $x=1$ 附近算对数是病态的**（因为 $\ln 1=0$，分母趋零）。这解释了很多「某个函数在某处特别难算准」的现象：不是算法差，是那一点条件数高。

## 小结与整站回顾

误差放大分两种：**算法不稳（可换算法救）** 和 **问题病态（条件数大，天生难算）**。条件数 $\kappa$ 量化放大倍数——$\kappa\approx10^k$ 就丢约 $k$ 位有效数字；希尔伯特矩阵的实测把这条法则演得明明白白。**拿到坏结果，先分清是路烂还是司机烂。**

至此，「有限精度的世界」这一站（浮点、机器精度、抵消、条件数）全部讲完——你已经握有评判一切数值方法的那把**尺子：误差、稳定、条件数**。从下一站起，我们开始解真正的问题，而每一个方法都会被这把尺子丈量。第一个问题：**解方程 $f(x)=0$**，从最笨也最可靠的二分法开始。👉 [二分法：最笨，但绝不失手](/manual/math/numerical/bisection)。

## 参考文献

-   \[1\] Trefethen & Bau.《Numerical Linear Algebra》, lec. 12-15 —— 条件数与稳定性的权威讲解。
-   \[2\] Nick Higham.《Accuracy and Stability of Numerical Algorithms》—— 稳定性分析圣经。
-   \[3\] NumPy 文档.「numpy.linalg.cond.」[https://numpy.org/doc/stable/reference/generated/numpy.linalg.cond.html](https://numpy.org/doc/stable/reference/generated/numpy.linalg.cond.html) —— 条件数计算。
