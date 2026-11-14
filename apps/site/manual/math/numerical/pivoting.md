---
title: "选主元与病态矩阵 · 方程为什么会算崩"
description: "高斯消元里「除以主元」是个定时炸弹：主元为 0 直接崩，主元很小则误差被放大。解药是「选主元」——每步把最大的元素换到对角线上。这一章演示不选主元怎么算出错误解，并厘清「算法不稳」和「矩阵病态」两种崩法。"
source: "https://daiw.org/manual/numerical-computing/pivoting"
---

# 选主元与病态矩阵 · 方程为什么会算崩

上一章的高斯消元里，那句 `m = A[i,k] / A[k,k]`——**除以主元 `A[k,k]`**——是个定时炸弹。主元为 0，直接除零崩溃；主元**很小**，更阴险：不报错，却悄悄算出**错误的解**。这一章拆掉这颗雷。

## 演示：小主元算出错误解

看一个简单到只有 2×2 的方程组，它会让不选主元的消元**翻车**：

```python
import numpy as np

def solve_nopivot(A, b):          # 上一章的朴素消元(不选主元)
    A = A.astype(float).copy(); b = b.astype(float).copy(); n = len(b)
    for k in range(n):
        for i in range(k+1, n):
            m = A[i,k] / A[k,k]
            A[i,k:] -= m * A[k,k:]; b[i] -= m * b[k]
    x = np.zeros(n)
    for i in range(n-1, -1, -1):
        x[i] = (b[i] - A[i,i+1:] @ x[i+1:]) / A[i,i]
    return x

eps = 1e-18
A = np.array([[eps, 1.0], [1.0, 1.0]])
b = np.array([1.0, 2.0])

print("不选主元:", solve_nopivot(A, b))     # [0. 1.]   ← x1 错成了 0!
print("库(选主元):", np.linalg.solve(A, b))  # [1. 1.]   ← 正确
print("真解      ≈ [1, 1]")
```

真解是 $x\approx[1,1]$，可不选主元算出 $x_1=0$——**大错特错，还没报任何错。** 病根：第一个主元是 $\epsilon=10^{-18}$，极小。消元乘子 $m = 1/\epsilon = 10^{18}$ 巨大，它把第二行乘上这个天文数字去减，原本的信息（[灾难性抵消](/manual/math/numerical/cancellation)）被淹没得干干净净，$x_1$ 的精度全丢了。

## 解药：部分选主元

修法简单得出奇：**每一步消元前，在当前列里挑出绝对值最大的元素，把它所在的行换到对角线位置上**，再消元。这叫**部分选主元（partial pivoting）**。

```python
def solve_pivot(A, b):
    A = A.astype(float).copy(); b = b.astype(float).copy(); n = len(b)
    for k in range(n):
        p = k + np.argmax(np.abs(A[k:, k]))    # 找当前列最大元所在行
        if p != k:                             # 换到对角线上
            A[[k, p]] = A[[p, k]]; b[[k, p]] = b[[p, k]]
        for i in range(k+1, n):
            m = A[i,k] / A[k,k]                 # 现在主元是最大的 → m 的量级 ≤ 1
            A[i,k:] -= m * A[k,k:]; b[i] -= m * b[k]
    x = np.zeros(n)
    for i in range(n-1, -1, -1):
        x[i] = (b[i] - A[i,i+1:] @ x[i+1:]) / A[i,i]
    return x

print("选主元:", solve_pivot(A, b))     # [1. 1.]   ← 修好了
```

::: info

**为什么选最大的元素当主元就稳了？** 因为主元一大，消元乘子 $m = A[i,k]/A[k,k]$ 的绝对值就 $\le 1$——它不会把某一行**放大**再去减别的行，于是误差不会被爆炸式放大。把「最大的」放到对角线，等于**永远避开「除以小数」**。数学上，这对应 $PA = LU$——多了个记录换行的**置换矩阵** $P$。**部分选主元是高斯消元能实用的前提**，所以所有正经的库（`np.linalg.solve`、LAPACK）**默认都选主元**；你几乎不该手写不选主元的版本。

:::

## 两种「算崩」，别混

这里要接回[条件数那章](/manual/math/numerical/conditioning)的关键区分——方程组算崩，有两种**完全不同**的原因：

::: warning

**① 算法不稳（小主元）—— 可以救。** 上面的例子，矩阵本身**不病态**（$\kappa$ 不大），只是**朴素算法**碰上小主元翻了车。选主元一上，立刻修好。这是「司机的问题」。

**② 矩阵病态（条件数大）—— 救不了。** 如果矩阵本身[病态](/manual/math/numerical/conditioning)（如希尔伯特矩阵，$\kappa=10^{10}$），那么**即便你完美地选了主元**，解依然会丢掉约 10 位有效数字——因为这是**问题本身**对误差敏感，不是算法的错。选主元治不了病态。这是「路的问题」。

**所以拿到一个可疑的解，别急着改算法：先算 `np.linalg.cond(A)`。** 条件数不大 → 大概率是算法 / 主元问题，选主元或换稳定算法能救；条件数巨大 → 是问题病态，得从**建模层面**想办法（换变量、正则化、提高精度、或改用正交分解 QR）。**先分清病态还是不稳，再对症下药。**

:::

## 小结与下一章

高斯消元「除以主元」的隐患：主元为 0 崩、主元小则误差被放大、算出错误解。解药是**部分选主元**——每步把当列最大元换到对角线，让乘子 $|m|\le1$，避开「除以小数」（$PA=LU$）。库默认都选主元。牢记两种算崩之分：**小主元（算法不稳，可救）vs 矩阵病态（问题敏感，选主元也救不了，得改建模）**。

高斯消元 / LU 是**直接法**，$O(n^3)$——对几百上千维还行，但科学计算里动辄几百万维的**大稀疏**矩阵（大部分元素是 0），$O(n^3)$ 就跑不动了。这时要换思路，用**迭代法**。下一章讲。👉 [迭代法：Jacobi、Gauss-Seidel 与共轭梯度](/manual/math/numerical/iterative-linear)。

## 参考文献

-   \[1\] Trefethen & Bau.《Numerical Linear Algebra》, lec. 21-22 —— 选主元与稳定性。
-   \[2\] Golub & Van Loan.《Matrix Computations》, §3.4 —— 部分 / 完全选主元。
-   \[3\] Nick Higham.《Accuracy and Stability of Numerical Algorithms》, ch. 9 —— 高斯消元的误差分析。
