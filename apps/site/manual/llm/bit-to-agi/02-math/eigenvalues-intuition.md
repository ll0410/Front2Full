---
title: "特征值的直觉"
description: "从 Bit 到 AGI · 第二章：数学（Math） · 特征值的直觉"
source: "https://daiw.org/manual/bit-to-agi/02-math/eigenvalues-intuition"
---

# 特征值的直觉

> 从 Bit 到 AGI · 第二章：数学（Math） · 特征值的直觉

矩阵乘法一般改变向量的方向。但有些特殊方向**只被拉伸、不转向**——拉伸倍数就是**特征值**。本篇给程序员可操作的直觉：特征值描述线性变换的「主轴尺度」，并连接到条件数、谱归一化、以及训练稳定性——不推导特征多项式。

## 直觉：变换沿哪些轴「纯缩放」

捏橡皮泥：大多数方向会弯；若存在某方向只拉长 2 倍、不弯曲，该方向是**特征向量**，2 是**特征值**。

神经网络里，权重矩阵 $\mathbf{W}$ 反复作用隐状态；若最大特征值 $>1$，信号放大 → 梯度爆炸；$<1$ 则衰减 → 梯度消失。谱性质影响**深层稳定性**。

```mermaid
graph LR
  v["特征向量 v"] --> W["× W"]
  W --> lv["= λ·v 只缩放"]
```

## 定义

对方阵 $\mathbf{A} \in \mathbb{R}^{n \times n}$，若存在非零 $\mathbf{v}$ 和标量 $\lambda$ 使：

$$
\mathbf{A}\mathbf{v} = \lambda \mathbf{v}
$$

则 $\lambda$ 是**特征值**，$\mathbf{v}$ 是**特征向量**。

**对称矩阵**（如实对称 $\mathbf{A}=\mathbf{A}^\top$）：特征值全为实数，特征向量正交——协方差矩阵、Hessian 近似常用。

**谱半径**：$\rho(\mathbf{A}) = \max_i |\lambda_i|$，迭代 $\mathbf{x}_{t+1} = \mathbf{A}\mathbf{x}_t$ 收敛当且仅当 $\rho(\mathbf{A}) < 1$。

**条件数**（对称正定）：$\kappa = \lambda_{\max} / \lambda_{\min}$；$\kappa$ 大 → 优化 landscape 扁长、难收敛。

## 例子

**例 1：对角矩阵**

$\mathbf{A} = \mathrm{diag}(2, 3, 0.5)$，特征值即对角线：$2, 3, 0.5$。任意轴对齐向量都是特征向量。

**例 2：2×2 旋转+缩放**

$\mathbf{A} = \begin{bmatrix} 2 & 0 \\ 0 & 0.5 \end{bmatrix}$，沿 $x$ 轴放大 2 倍，沿 $y$ 轴缩小到 0.5。

```python
import numpy as np

A = np.array([[2.0, 0.0], [0.0, 0.5]])
eigenvalues, eigenvectors = np.linalg.eig(A)
print("λ =", eigenvalues)           # [2.0, 0.5]
print("v =", eigenvectors.T)        # 单位轴
```

### 自己拖一下

上面三个例子全是对角阵，特征向量恰好落在坐标轴上——所以你还没真正见过一个需要「找」的特征向量。拖动下面这个 2×2 矩阵，转动白色探针，让它和它的像（蓝箭头）**重合**：

<EigenExplorer />

切到「对称（斜特征轴）」预设，你会发现特征向量**不在坐标轴上**，得转到 45° 才对齐。切到「迭代」模式，反复算 $A\mathbf{x}$：谱半径 $\rho > 1$ 时轨迹飞出屏幕，$\rho < 1$ 时塌向原点——这正是深层网络里信号爆炸/消失的几何来源，也是下面「谱尺度接近 1」这句话的意思。

**例 3：权重初始化与方差**

Xavier/He 初始化按 fan-in/fan-out 控制 $\mathrm{Var}(\mathbf{W}\mathbf{x})$，避免逐层方差爆炸或消失——本质是让**谱尺度**接近 1。若 $\mathbf{W}$ 各奇异值 $\approx 1$，深度复合后信号稳定。

| 初始化 | 适用 | 目标方差尺度 |
| ------ | ---- | ------------ |
| Xavier | tanh/sigmoid | $\mathrm{Var}(w) = 2/(n_{in}+n_{out})$ |
| He (Kaiming) | ReLU | $\mathrm{Var}(w) = 2/n_{in}$ |

## 量化

| 概念 | 数值 / 含义 |
| ---- | ----------- |
| $n \times n$ 特征分解 | $O(n^3)$，7B 矩阵不可做 |
| Power iteration | $O(n^2)$ 每步，估 $\lambda_{\max}$ |
| 谱归一化（GAN） | 约束 $\sigma_{\max}(\mathbf{W}) = 1$ |
| Transformer 32 层复合 | 有效 Jacobian 谱连乘，Pre-Norm 缓解 |
| PCA | 协方差矩阵前 $k$ 大特征值 → 主成分 |

**奇异值分解**（SVD，更一般）：$\mathbf{A} = \mathbf{U}\mathbf{\Sigma}\mathbf{V}^\top$，$\mathbf{\Sigma}$ 对角为奇异值 $\sigma_i \geq 0$。非方阵用 SVD；$\sigma_{\max}$ 类似「最大拉伸」。

::: info

你不会对 4096×4096 权重做完整 eigendecomposition——太贵。但**谱直觉**解释：为何初始化重要、为何谱归一化稳定 GAN、为何 Hessian 最大特征值与学习率上界相关（$\eta < 2/\lambda_{\max}$）。

:::

## 工程视角：不必算，但要懂

**Hessian 特征值与学习率**：凸二次 $\mathcal{L}=\frac{1}{2}\mathbf{x}^\top H \mathbf{x}$，最优 $\eta = 2/(\lambda_{\max}+\lambda_{\min})$。非凸深度网，$\lambda_{\max}$ 过大 → 需小 lr；curvature 启发式支持 warmup、cosine decay。

**Low-rank adaptation（LoRA）**：$\Delta W = BA$，$B \in \mathbb{R}^{d \times r}$，$r \ll d$。有效更新秩 $\leq r$——在大特征值方向上优先学习，小特征值方向忽略。秩 $r=8$–64 是常见 sweet spot。

**PCA 与 embedding 分析**：对 token embedding 矩阵做 PCA，前 3 主成分可视化——看语义是否聚类。奇异值谱 decay 快 → 内在维远低于 4096。

**扩散模型**：forward 逐步加噪，reverse 学去噪；噪声 schedule 设计涉及协方差矩阵特征结构——与谱直觉相关。

Power iteration / Lanczos 估 $\lambda_{\max}$ 用于 GAN 谱归一化：每步只需矩阵-向量乘 $O(n^2)$，不必 $O(n^3)$ 全分解。W 每次更新后 normalize $\sigma_{\max}$ 到 1。

| 应用 | 谱工具 | 在线可行？ |
| ---- | ------ | ---------- |
| 初始化 scale | Xavier/He 方差 | ✓ 解析 |
| GAN 稳定 | 谱归一化 | ✓ 幂迭代 |
| 7B Hessian | Lanczos top-k | ✗ 研究 only |

**Jacobian 奇异值**：$\mathbf{J}=\partial \mathbf{y}/\partial \mathbf{x}$ 的 $\sigma_{\max}$ 控制输入扰动放大——对抗样本、Lipschitz 网络界限都与此相关。

## 常见误区

1. **特征值 ≠ 奇异值**：非对称矩阵两者不同；奇异值恒非负。
2. **「特征值全 < 1 就稳定」**：复数特征值、非对称、残差连接会改变故事；看整体 Jacobian。
3. **PCA 特征值 = 方差解释比例**：第 $k$ 主成分方差 $\propto \lambda_k$。

## 动手试一试

```python
import numpy as np

def power_iteration(A: np.ndarray, steps: int = 100) -> float:
    """估计最大特征值（绝对值最大）"""
    n = A.shape[0]
    v = np.random.randn(n)
    v /= np.linalg.norm(v)
    for _ in range(steps):
        v = A @ v
        lam = np.linalg.norm(v)
        v /= lam
    return lam

A = np.diag([3.0, 1.0, 0.2])
print(f"true λ_max=3.0, estimated={power_iteration(A):.3f}")
```

## 深入一层：谱定理（对称情形）

实对称 $\mathbf{A}=\mathbf{A}^\top$：**谱定理**保证 $\mathbf{A}=\mathbf{Q}\mathbf{\Lambda}\mathbf{Q}^\top$，$\mathbf{Q}$ 正交，$\mathbf{\Lambda}=\mathrm{diag}(\lambda_1,\ldots,\lambda_n)$。几何上：沿 $n$ 个正交主轴各拉伸 $\lambda_i$ 倍。

**PCA 步骤**：数据中心化 → 协方差 $\mathbf{C}=\frac{1}{N}\mathbf{X}^\top\mathbf{X}$ → 求 $\mathbf{C}$ 最大 $k$ 特征值/向量 → 投影。NLP 里分析 embedding 共现结构；CV 里降维可视化。

**矩阵幂** $\mathbf{A}^t$：特征分解下 $\mathbf{A}^t=\mathbf{Q}\mathbf{\Lambda}^t\mathbf{Q}^\top$，$\lambda_i^t$ 决定长期行为——$\|\mathbf{A}^t\|$ 由 $\max|\lambda_i|$ 主导。RNN 稳定性即 $\rho(\mathbf{W}_h) \lt 1$ 的反复。

**Graph Laplacian**（拓展）：GNN 里 $\mathbf{L}=\mathbf{D}-\mathbf{A}$，谱分割、社区发现——与 LLM 主线远，但「特征值 = 结构模式频率」同一直觉。

**Random matrix theory**：超大随机矩阵特征值分布（Marchenko-Pastur）——初始化时 $\mathbf{W}$ 元素 i.i.d.，谱有理论预测，Xavier/He 与此一致。

你不需要 nightly 算 $\lambda_{\max}(\mathbf{W}_\ell)$；需要知道：**若初始化谱尺度错一个数量级，32 层复合后 activation 要么 explode 要么 vanish**——训练从第一步就失败。

## 初始化谱尺度速查

He init 方差 $2/fan\_in$：ReLU 下保持激活方差 $O(1)$ 过层。错误 init（方差 ×10）→ 32 层后 activation $\times 10^{32}$ 或 $\times 10^{-32}$——loss 第一步就 NaN 或 flat。

读 `model.apply(init_fn)` 源码；换 activation 记得换 init 规则。Pre-LNorm 进一步约束每层输入尺度，降低对 init 敏感度。

## 读者备忘

**特征值 = 沿某方向纯缩放倍数；$\mathbf{A}\mathbf{v}=\lambda\mathbf{v}$。** 谱半径决定迭代稳定性。Xavier/He 初始化控制谱尺度。7B 矩阵不做全分解；谱直觉解释 init、残差、Pre-NNorm。对称矩阵谱定理保证主轴正交——PCA 与协方差分析的基础。

## 小结

特征值 $\lambda$ 满足 $\mathbf{A}\mathbf{v}=\lambda\mathbf{v}$，描述线性变换沿特定方向的缩放。谱半径与条件数影响迭代稳定性与优化难度。深度学习用谱直觉指导初始化与归一化，而非在线分解大矩阵。下一篇：**Softmax 与 Logits**——把任意实数变成概率。

→ 下一篇：[Softmax 与 Logits](/manual/llm/bit-to-agi/02-math/softmax-and-logits)
