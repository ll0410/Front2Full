---
title: "高斯消元与 LU 分解 · 解方程组的主力"
description: "解 Ax=b 是数值计算里最基础、也最庞大的一块。这一章从人人学过的高斯消元讲起，引出 LU 分解——把矩阵拆成 L·U，一次分解、多次复用，还点破一条铁律：解方程组千万别求逆矩阵。"
source: "https://daiw.org/manual/numerical-computing/gaussian-lu"
---

# 高斯消元与 LU 分解 · 解方程组的主力

进入第三站：解**线性方程组 $Ax=b$**。这可能是整个科学计算里出现频率最高的问题——拟合、微分方程离散化、优化、图形学……最后大多归结到「解一个线性方程组」。这一站从最基础的高斯消元讲到大稀疏系统的迭代法。

## 高斯消元：消成三角形，再回代

解方程组的经典方法，就是中学学过的**消元**，系统化之后叫**高斯消元（Gaussian elimination）**，分两步：

1.  **前向消元**：用行变换，把 $A$ 变成**上三角**（对角线以下全是 0）。
2.  **回代（back substitution）**：从最后一个方程（只剩一个未知数）倒着往上解。

手写一遍：

```python
import numpy as np

def solve_gauss(A, b):
    A = A.astype(float).copy()
    b = b.astype(float).copy()
    n = len(b)
    # ① 前向消元 → 上三角
    for k in range(n):
        for i in range(k + 1, n):
            m = A[i, k] / A[k, k]        # 消元乘子(注意:除以「主元」A[k,k])
            A[i, k:] -= m * A[k, k:]
            b[i]     -= m * b[k]
    # ② 回代
    x = np.zeros(n)
    for i in range(n - 1, -1, -1):
        x[i] = (b[i] - A[i, i+1:] @ x[i+1:]) / A[i, i]
    return x

A = np.array([[2, 1, -1], [-3, -1, 2], [-2, 1, 2]], float)
b = np.array([8, -11, -3], float)
print(solve_gauss(A, b))   # [2. 3. -1.]
```

消元的开销是 $O(n^3)$，回代是 $O(n^2)$。注意那句 `m = A[i,k] / A[k,k]`——**除以主元 `A[k,k]`**，这里藏着下一章的大坑（主元要是 0 或很小怎么办）。

## LU 分解：一次分解，多次复用

高斯消元有个浪费：如果你要对**同一个 $A$、不同的 $b$** 解很多次（工程里极常见），每次都重新消元一遍（$O(n^3)$）太亏。**LU 分解**解决这个：把消元的成果**存下来**。

它把矩阵拆成一个**下三角** $L$ 和一个**上三角** $U$ 的乘积：

$$
A = LU
$$

有了 $L$、$U$，解 $Ax=b$ 就变成两步**三角求解**（各 $O(n^2)$，便宜）：

$$
Ax=b \;\Rightarrow\; LUx=b \;\Rightarrow\; \underbrace{Ly=b}_{\text{前代,求 }y} \;\text{然后}\; \underbrace{Ux=y}_{\text{回代,求 }x}
$$

```python
from scipy.linalg import lu_factor, lu_solve

lu, piv = lu_factor(A)              # 分解一次:O(n³)
x1 = lu_solve((lu, piv), b1)        # 之后每个 b 只要 O(n²)
x2 = lu_solve((lu, piv), b2)        # 复用同一个 LU,省大了
```

::: info

**LU 的价值，是把「贵的分解」和「便宜的求解」分开。** 分解一次 $O(n^3)$，之后对任意多个右端 $b$，每个只花 $O(n^2)$。这在「系数矩阵不变、右端反复变」的场景（时间步进、多右端）里，能省一两个数量级。所以库里 `scipy.linalg.lu_factor` / `lu_solve` 是分开的两步——分解的结果值得攒着复用。

:::

## 一条铁律：别求逆矩阵

新手最爱的写法，恰恰是最该避免的：

::: warning

**解 $Ax=b$，永远不要写 `x = inv(A) @ b`——要写 `x = solve(A, b)`。**

```python
# ✗ 又慢又不准
x = np.linalg.inv(A) @ b
# ✓ 又快又更准
x = np.linalg.solve(A, b)
```

两个理由：① **慢**——求逆矩阵本身要先做一次 LU、再解 $n$ 个方程组，比直接解一个 $b$ 贵好几倍；② **不准**——显式求逆会引入更多舍入误差，数值上比直接解更差，尤其当 $A$ [病态](/manual/math/numerical/conditioning)时。「$x = A^{-1}b$」是漂亮的**数学记号**，但在计算机上，你几乎**永远不该真的去算那个 $A^{-1}$**。需要解方程就 `solve`，它内部走的是 LU，又快又稳。**这是数值线性代数第一课。**

:::

## 小结与下一章

解 $Ax=b$ 的主力是**高斯消元**（消成上三角 + 回代，$O(n^3)$）；**LU 分解**把消元成果存成 $A=LU$，实现「一次分解、多次 $O(n^2)$ 复用」。牢记铁律：**解方程组用 `solve`，别求逆矩阵**（`inv` 又慢又不准）。

但消元里那句「除以主元 `A[k,k]`」是个定时炸弹：主元要是 0，直接崩；主元要是很小，误差会被[放大](/manual/math/numerical/cancellation)。怎么救？靠一个简单却关键的技巧——选主元。下一章讲，顺带看病态矩阵怎么让方程组「算崩」。👉 [选主元与病态矩阵：方程为什么会算崩](/manual/math/numerical/pivoting)。

## 参考文献

-   \[1\] Trefethen & Bau.《Numerical Linear Algebra》, lec. 20-21 —— 高斯消元与 LU 分解。
-   \[2\] Golub & Van Loan.《Matrix Computations》, ch. 3 —— LU 分解权威参考。
-   \[3\] SciPy 文档.「scipy.linalg.lu\_factor / lu\_solve.」[https://docs.scipy.org/doc/scipy/reference/linalg.html](https://docs.scipy.org/doc/scipy/reference/linalg.html) —— 库实现。
