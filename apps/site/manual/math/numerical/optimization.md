---
title: "最优化 · 梯度下降与找到最小值"
description: "「找到让函数最小的那个点」渗透进一切现代应用——机器学习训练、曲线拟合、工程设计，本质都是最优化。这一章从梯度下降（沿负梯度下山）讲起，说清学习率的两难、凸与非凸的分野，以及为什么实践里直接用 scipy.optimize.minimize。"
source: "https://daiw.org/manual/numerical-computing/optimization"
---

# 最优化 · 梯度下降与找到最小值

最后一件利器，可能是当代应用数学里**最重要**的一个词——**最优化（optimization）**：找到让目标函数 $f(x)$ **最小**（或最大）的那个 $x$。机器学习训练模型、[最小二乘](/manual/math/numerical/splines-lsq)拟合数据、工程调参数、投资组合配比……剥开外壳，内核几乎都是「最小化某个函数」。

## 梯度下降：沿着最陡的方向下山

想象站在一片起伏的山地里，蒙着眼要走到**最低点**。最自然的策略：**感受脚下哪个方向最陡，朝下坡迈一步，再重复。** 数学上，「最陡上坡方向」就是梯度 $\nabla f$，所以朝**负梯度**走：

$$
x_{k+1} = x_k - \alpha\, \nabla f(x_k)
$$

$\alpha$ 是**步长 / 学习率**。这就是**梯度下降**——现代机器学习训练的核心基石。拿一个简单的碗形函数 $f(x,y)=(x-3)^2+(y+1)^2$（最小值显然在 $(3,-1)$）试：

```python
import numpy as np

def f(v):    return (v[0]-3)**2 + (v[1]+1)**2
def grad(v): return np.array([2*(v[0]-3), 2*(v[1]+1)])   # 梯度(解析)

x = np.array([0.0, 0.0])
lr = 0.1
for _ in range(50):
    x = x - lr * grad(x)         # 沿负梯度下山一步
print(x)                          # [ 2.9999...  -0.9999...]  → 收敛到 (3, -1)
```

50 步，从 $(0,0)$ 稳稳走到了最低点 $(3,-1)$。注意它和[牛顿法](/manual/math/numerical/newton)的血缘：牛顿法找 $f'=0$ 的根，而最优化的极小值点正是 $\nabla f=0$ 的地方——**「求极值」和「求根」在这里握手**。

## 学习率：太大发散，太小龟速

梯度下降最要命的旋钮是学习率 $\alpha$：

::: warning

**$\alpha$ 太大，会越过谷底、来回震荡甚至发散；$\alpha$ 太小，收敛慢如龟爬。** 把上面的 `lr` 改成 `1.1`，迭代会**炸到无穷**（每步都冲过头且越冲越远）；改成 `0.001`，50 步远远到不了谷底。这个两难和[数值微分选 $h$](/manual/math/numerical/differentiation)、[ODE 选步长](/manual/math/numerical/ode-euler-rk)一脉相承——**步子的大小，是数值方法反复出现的核心矛盾。** 现代优化器（Adam、RMSProp 等）本质就是在**自动、自适应地调这个步长**，这也是深度学习框架里最要紧的一环。

:::

## 凸与非凸：能不能保证找到全局最优

优化问题分两个世界，天壤之别：

-   **凸函数（convex）**：整个函数就一个「碗」，**唯一的极小值就是全局最小**。梯度下降只要别把步长搞砸，**保证**收敛到全局最优。最小二乘、线性 / 逻辑回归都落在这个幸福的世界里。
-   **非凸函数（non-convex）**：遍地是**局部极小、鞍点**。梯度下降下到某个坑里就出不来，**你无从保证那是不是全局最优**。神经网络的损失函数就是高维非凸的——之所以还能训练出好模型，靠的是随机性（SGD）、动量、以及高维空间里「坏的局部极小其实没那么多」的经验事实。

**判断问题凸不凸，往往比选算法更重要**——它决定了你能不能**信任**得到的解。

## 实践：别手写，用 minimize

::: info

**一般的最优化，别手写梯度下降——用 `scipy.optimize.minimize`。** 它内置 BFGS、L-BFGS、Nelder-Mead 等成熟算法（有的用二阶信息收敛更快，有的连梯度都不用你给），还自动处理步长：

```python
from scipy.optimize import minimize
res = minimize(lambda v: (v[0]-3)**2 + (v[1]+1)**2, x0=[0, 0])
print(res.x)         # [3. -1.]  —— 直接给出最小值点
```

手写梯度下降是为了理解「下山」的原理和学习率的两难；**日常求解用 `minimize`**（带约束的用 `scipy.optimize` 里的 `linprog`/`SLSQP` 等）。当然，训练大规模神经网络是另一个天地——那里 SGD + Adam 及其在 GPU 上的实现才是主角，但「沿负梯度走一步」的内核，和这里一模一样。

:::

## 小结与下一站

**最优化**（找 $f$ 的最小值点）是现代应用的通用内核。**梯度下降** $x_{k+1}=x_k-\alpha\nabla f$ 沿负梯度下山，与[牛顿法](/manual/math/numerical/newton)求根同源（$\nabla f=0$）；**学习率** $\alpha$ 太大发散、太小龟速，是「步长两难」的又一次现身。**凸问题**保证全局最优，**非凸**只能得局部解（神经网络即如此）。实践用 `scipy.optimize.minimize`。

七站走到这里，数值计算的地图已经铺满：有限精度、求根、线性代数、逼近、微积分数值版、三大利器。最后一章，我们把这一路反复出现的那几条**主线**收拢成一张全景图。👉 [收尾：一张图串起整条主线](/manual/math/numerical/recap)。

## 参考文献

-   \[1\] Nocedal & Wright.《Numerical Optimization》—— 数值最优化权威教材。
-   \[2\] Boyd & Vandenberghe.《Convex Optimization》—— 凸优化圣经(免费开放)。
-   \[3\] SciPy 文档.「scipy.optimize.minimize.」[https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.minimize.html](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.minimize.html) —— 库实现。
