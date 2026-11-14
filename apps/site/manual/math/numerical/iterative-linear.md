---
title: "迭代法 · Jacobi、Gauss-Seidel 与共轭梯度"
description: "几百万维的大稀疏方程组，直接法 O(n³) 跑不动。迭代法从一个猜测出发、反复逼近解，每步只做便宜的矩阵向量乘。这一章手写 Jacobi 与 Gauss-Seidel，讲清收敛条件，并介绍对称正定系统的王牌——共轭梯度。"
source: "https://daiw.org/manual/numerical-computing/iterative-linear"
---

# 迭代法 · Jacobi、Gauss-Seidel 与共轭梯度

[高斯消元 / LU](/manual/math/numerical/gaussian-lu) 是**直接法**——有限步得到精确解，但代价 $O(n^3)$。对几百上千维还行；可科学计算里的方程组动辄**几百万维**（有限元、图、PDE 离散化），$O(n^3)$ 直接爆炸。好在这些大矩阵通常**稀疏**（绝大多数元素是 0）。对付它们，要换一套思路：**迭代法**。

## 思路：从猜测出发，反复逼近

迭代法不追求「一步到位的精确解」，而是**从一个初始猜测出发，反复改进，让它越来越接近真解**——像[求根](/manual/math/numerical/iteration-order)的不动点迭代，只不过对象从一个数变成了一整个向量。每一步只做一次**矩阵向量乘法**，对稀疏矩阵这极便宜（$O(\text{非零元个数})$，而非 $O(n^2)$）。

## Jacobi：最简单的迭代

Jacobi 法的想法：把第 $i$ 个方程解出 $x_i$，用**其它变量的旧值**代进去，更新 $x_i$：

$$
x_i^{(k+1)} = \frac{1}{a_{ii}}\Big(b_i - \sum_{j\neq i} a_{ij}\, x_j^{(k)}\Big)
$$

```python
import numpy as np

def jacobi(A, b, tol=1e-10, maxiter=500):
    n = len(b)
    x = np.zeros(n)
    D = np.diag(A)                      # 对角线
    R = A - np.diagflat(D)              # 其余部分
    for k in range(maxiter):
        x_new = (b - R @ x) / D         # 一次矩阵向量乘,搞定所有 x_i
        if np.linalg.norm(x_new - x) < tol:
            return x_new, k + 1
        x = x_new
    return x, maxiter

A = np.array([[10., -1., 2.], [-1., 11., -1.], [2., -1., 10.]])
b = np.array([6., 25., -11.])
x, iters = jacobi(A, b)
print(x, f"({iters} 步)")     # [1.05  2.06  -1.05...]  约 20+ 步收敛
```

## Gauss-Seidel：立刻用新值，更快

Jacobi 更新 $x_i$ 时，用的全是**上一轮的旧值**。**Gauss-Seidel** 只改一点：算 $x_i$ 时，**前面刚更新好的 $x_1,\dots,x_{i-1}$ 立刻用上**（而不是等下一轮）。这个「用最新值」的小改动，通常让它**收敛快近一倍**：

```python
def gauss_seidel(A, b, tol=1e-10, maxiter=500):
    n = len(b); x = np.zeros(n)
    for k in range(maxiter):
        x_old = x.copy()
        for i in range(n):
            s = A[i, :] @ x - A[i, i] * x[i]      # 用到的 x 里,前面的已是新值
            x[i] = (b[i] - s) / A[i, i]
        if np.linalg.norm(x - x_old) < tol:
            return x, k + 1
    return x, maxiter
```

## 收敛条件：对角占优

::: warning

**迭代法不总收敛——最常用的充分条件是「对角占优」：每一行，对角元的绝对值 $\ge$ 该行其余元素绝对值之和。** 直觉：对角元「主导」了该行，方程之间耦合弱，迭代才会收缩而非放大。上面例子的矩阵（$10 > 1+2$ 等）就是严格对角占优，所以稳稳收敛。

**矩阵不满足这个条件时，迭代可能发散**——就像[不动点迭代](/manual/math/numerical/iteration-order) $|g'|>1$ 时发散一样。所以用迭代法前，先看看矩阵结构是否「友好」（对角占优、或对称正定）。不友好的，要么预处理（preconditioning）改善它，要么老老实实用直接法。

:::

## 王牌：共轭梯度（CG）

Jacobi / Gauss-Seidel 是入门款。真正的主力，是对**对称正定（SPD）** 矩阵的**共轭梯度法（Conjugate Gradient，CG）**。它把「解方程」变成「最小化一个二次函数」，沿一组精心构造的**互不干扰（共轭）** 的方向逐步逼近，理论上 $n$ 步内到精确解，实践中对大稀疏问题**远快于此**：

```python
from scipy.sparse.linalg import cg
from scipy.sparse import csr_matrix

A_sparse = csr_matrix(A)          # 稀疏存储:只存非零元
x, info = cg(A_sparse, b, rtol=1e-10)
print(x, "converged" if info == 0 else "failed")
```

CG（及其变体 GMRES、BiCGStab 等 **Krylov 子空间方法**）是现代大规模科学计算的支柱。有限元求解、图拉普拉斯、机器学习里的大线性系统，背后大多是它们。

## 直接法 vs 迭代法：怎么选

|  | 直接法（LU） | 迭代法（CG 等） |
| --- | --- | --- |
| 复杂度 | $O(n^3)$ 定死 | 每步 $O(\text{非零元})$，步数看收敛 |
| 适合 | **中小、稠密** 矩阵 | **大、稀疏** 矩阵 |
| 精度 | 一步到位（受舍入限） | 逼近，可控到任意精度 |
| 内存 | 要存整个（含填充） | 只存非零元，省 |
| 收敛 | 总能解（选主元） | **需矩阵友好**（对角占优 / SPD） |

::: info

**一句话选型：矩阵小而稠密 → 直接法（`np.linalg.solve`）；矩阵大而稀疏 → 迭代法（`scipy.sparse.linalg.cg` / `gmres`）。** 中间地带看具体规模和稀疏度。绝大多数「几百万未知数」的物理仿真，都落在迭代法这边——因为直接法连矩阵都存不下（稀疏矩阵 LU 分解会产生大量「填充」非零元）。

:::

## 小结与下一章

大稀疏方程组用**迭代法**：从猜测出发反复逼近，每步只做便宜的稀疏矩阵向量乘。Jacobi（用旧值）、Gauss-Seidel（立刻用新值、更快）是入门款，收敛需**对角占优**；**共轭梯度（CG）** 是对称正定系统的王牌，是现代大规模计算的支柱。选型：小稠密用直接法，大稀疏用迭代法。

线性代数这一站还剩一块拼图——不是解 $Ax=b$，而是求 $Av=\lambda v$ 的**特征值**。它在稳定性分析、PCA、PageRank 里无处不在，而算它也有专门的迭代招法。👉 [特征值：幂迭代与 QR 算法](/manual/math/numerical/eigenvalues)。

## 参考文献

-   \[1\] Trefethen & Bau.《Numerical Linear Algebra》, lec. 32-38 —— 迭代法与 Krylov 子空间。
-   \[2\] Yousef Saad.《Iterative Methods for Sparse Linear Systems》—— 迭代法权威专著。
-   \[3\] SciPy 文档.「scipy.sparse.linalg.」[https://docs.scipy.org/doc/scipy/reference/sparse.linalg.html](https://docs.scipy.org/doc/scipy/reference/sparse.linalg.html) —— CG/GMRES 等实现。
