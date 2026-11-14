---
title: "特征值 · 幂迭代与 QR 算法"
description: "特征值 Av=λv 在 PCA、PageRank、稳定性分析里无处不在。这一章手写幂迭代（反复乘 A 就能揪出最大特征值），介绍所有库都在用的 QR 算法，并点破一个反直觉的铁律：千万别用特征多项式求根来算特征值。"
source: "https://daiw.org/manual/numerical-computing/eigenvalues"
---

# 特征值 · 幂迭代与 QR 算法

线性代数这一站的最后一块，不是解 $Ax=b$，而是求**特征值**——满足 $Av = \lambda v$ 的标量 $\lambda$ 和向量 $v$。含义是：矩阵 $A$ 作用在 $v$ 上，**只把它拉伸 $\lambda$ 倍、方向不变**。这个看似抽象的东西，其实无处不在：

-   **PCA（主成分分析）**：主成分就是协方差矩阵的特征向量。
-   **PageRank**：网页排名是转移矩阵的**主特征向量**。
-   **稳定性分析**：系统稳不稳，看雅可比矩阵特征值的实部符号。
-   还有振动模态、量子能级、图的谱……

## 幂迭代：反复乘 A，揪出最大的

最简单的特征值算法叫**幂迭代（power iteration）**，思想朴素得可爱：**随便拿个向量，反复用 $A$ 去乘、每次归一化，它会自动收敛到「最大特征值对应的特征向量」。**

为什么？把初始向量按特征向量展开，每乘一次 $A$，每个分量就被放大对应的 $\lambda$ 倍——**最大的那个 $\lambda$ 放大得最快，乘着乘着就盖过所有其他分量**，方向收敛到它的特征向量。特征值本身用**瑞利商** $\lambda \approx \dfrac{v^\top A v}{v^\top v}$ 读出：

```python
import numpy as np

def power_iteration(A, tol=1e-12, maxiter=1000):
    n = A.shape[0]
    v = np.ones(n) / np.sqrt(n)
    lam = 0.0
    for _ in range(maxiter):
        w = A @ v                          # 反复乘 A
        v_new = w / np.linalg.norm(w)      # 归一化,防止爆炸/衰减
        lam_new = v_new @ A @ v_new        # 瑞利商读特征值
        if abs(lam_new - lam) < tol:
            return lam_new, v_new
        v, lam = v_new, lam_new
    return lam, v

A = np.array([[2., 1.], [1., 3.]])
lam, v = power_iteration(A)
print(f"最大特征值 ≈ {lam:.6f}")     # ≈ 3.618034 (即 (5+√5)/2)
```

幂迭代只找**最大**的那个特征值 / 向量——但很多应用（PageRank、PCA 的第一主成分）恰好只要这一个，所以它极实用。想要次大的，可以「减掉」已找到的分量再迭代（deflation）。

## 全部特征值：QR 算法

要**一次性求出所有**特征值，靠的是 **QR 算法**——数值线性代数最优雅的成果之一。它反复做：把 $A$ 做 [QR 分解](/manual/math/numerical/gaussian-lu) $A=QR$，再反序乘回去 $A' = RQ$，如此迭代，$A$ 会**收敛成（准）上三角**，对角线上就是全部特征值。库里直接调：

```python
eigvals, eigvecs = np.linalg.eig(A)
print(eigvals)      # [1.38196601 3.61803399]  两个特征值
```

`np.linalg.eig` 背后是 LAPACK 高度优化的 QR 算法（带位移加速等技巧）。**日常直接用它；幂迭代和 QR 的原理，是为了让你知道它内部在干嘛、以及在超大规模时该怎么手写变体。**

## 铁律：别用特征多项式求根

这是个极其反直觉、却必须记住的点：

::: warning

**千万别通过「解特征多项式 $\det(A-\lambda I)=0$ 的根」来求特征值——尽管教科书就是这么定义的。** 原因：**多项式的根，对系数极度敏感（病态）。** 著名的 **Wilkinson 多项式**是个骇人例子：根是 $1,2,\dots,20$，可某个系数改动 $10^{-10}$，根就乱飞、面目全非。把矩阵化成多项式再求根，等于把一个可能不难的问题，**故意转成一个病态问题**——[条件数](/manual/math/numerical/conditioning)白白爆炸。

更反直觉的是**反过来才对**：要求一个**多项式的根**，数值上的标准做法，竟是构造它的**伴随矩阵**、然后求那个矩阵的**特征值**（用 QR 算法）！NumPy 的 `np.polynomial.Polynomial.roots()`（以及传统 `np.roots`）内部正是这么干的。**「特征值 → 多项式根」是稳的正道，「多项式根 → 特征值」是病态的歧途**——方向搞反，精度天差地别。

:::

## 小结与整站回顾

特征值 $Av=\lambda v$ 在 PCA、PageRank、稳定性里无处不在。**幂迭代**反复乘 $A$ 归一化，揪出最大特征值 / 向量（瑞利商读值），实用于只要主特征的场景；**QR 算法**求全部特征值，是 `np.linalg.eig` 的内核。牢记铁律：**别用特征多项式求根算特征值**（多项式根病态）；反倒是「求多项式根」该转成「求伴随矩阵特征值」。

至此线性代数一站（消元 / LU、选主元、迭代法、特征值）走完，你有了解 $Ax=b$ 和求特征值的全套主力。下一站换个主题——**逼近**：已知一堆离散的点，怎么「连成」一条光滑曲线？先看插值，以及它一个著名的陷阱。👉 [多项式插值与 Runge 现象](/manual/math/numerical/interpolation)。

## 参考文献

-   \[1\] Trefethen & Bau.《Numerical Linear Algebra》, lec. 24-29 —— 特征值算法与 QR。
-   \[2\] Golub & Van Loan.《Matrix Computations》, ch. 7-8 —— 特征值计算权威参考。
-   \[3\] James Wilkinson.《The Algebraic Eigenvalue Problem》1965 —— 病态多项式与特征值。
