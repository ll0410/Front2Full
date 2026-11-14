---
title: "贝叶斯是什么"
description: "从 Bit 到 AGI · 第二章：数学（Math） · 贝叶斯是什么"
source: "https://daiw.org/manual/bit-to-agi/02-math/what-is-bayes"
---

# 贝叶斯是什么

> 从 Bit 到 AGI · 第二章：数学（Math） · 贝叶斯是什么

看到新数据后，如何更新对模型的信念？**贝叶斯定理**给出答案：后验 ∝ 似然 × 先验。本篇讲清公式、一个垃圾邮件数字例子，以及贝叶斯思想在 LLM 训练（MLE vs 贝叶斯推断）、正则化、不确定性量化中的位置——不要求你手算 7B 参数的后验。

## 直觉：先有偏见，再用证据修正

医生诊断：事前认为某病罕见（**先验** 1%）；化验阳性（**似然** 高）；综合后患病概率（**后验**）可能仍不高——因为先验太低。

机器学习：**先验** $P(\theta)$ 偏好简单模型；**数据** $\mathcal{D}$ 提供似然 $P(\mathcal{D} \mid \theta)$；训练找到使后验最大的 $\theta$（MAP）或采样整个后验（全贝叶斯）。

## 定义

**贝叶斯定理**：

$$
P(\theta \mid \mathcal{D}) = \frac{P(\mathcal{D} \mid \theta) \, P(\theta)}{P(\mathcal{D})}
$$

| 项 | 名称 | 含义 |
| -- | ---- | ---- |
| $P(\theta)$ | 先验 | 见数据前对参数的信念 |
| $P(\mathcal{D} \mid \theta)$ | 似然 | 参数为 $\theta$ 时观测到数据的概率 |
| $P(\theta \mid \mathcal{D})$ | 后验 | 见数据后对参数的更新信念 |
| $P(\mathcal{D})$ | 证据 | 归一化常数，常难算 |

**最大后验估计**（MAP）：

$$
\hat{\theta}_{MAP} = \arg\max_\theta \, P(\mathcal{D} \mid \theta) P(\theta) = \arg\max_\theta \, \log P(\mathcal{D} \mid \theta) + \log P(\theta)
$$

等价于：**对数似然 + 先验正则项**——L2 正则化 $\lambda \|\theta\|^2$ 对应高斯先验 $\mathcal{N}(0, \frac{1}{\lambda})$。

## 例子

**例 1：二分类贝叶斯（朴素贝叶斯 spam）**

邮件含词「免费」：垃圾邮件中 80% 出现，正常邮件 5%。

先验：$P(\text{spam}) = 0.3$，$P(\text{ham}) = 0.7$。

$$
P(\text{spam} \mid \text{「免费」}) = \frac{0.8 \times 0.3}{0.8 \times 0.3 + 0.05 \times 0.7} = \frac{0.24}{0.275} \approx 0.87
$$

### 自己拖一下

本章开头承诺了一个更反直觉的例子——「先验 1% 的罕见病 + 化验阳性 → 后验可能仍不高」，然后再没算过。现在拖出来：

<BayesGrid />

默认那档：一种罕见病（先验 1%），化验很准（灵敏度 99%、假阳仅 5%）。你化验**阳性**，患病概率是多少？直觉喊「99%」，真相是**约 17%**。看那 100 格网格就懂了：假阳的人（橙）几乎总是碾压真阳的人（红），因为健康人的基数太大。这就是「后验被先验牢牢拽住」——也是为什么罕见病筛查里，**降假阳比升灵敏更重要**。

**例 2：MLE vs MAP vs 全贝叶斯**

| 方法 | 目标 | 深度学习对应 |
| ---- | ---- | ------------ |
| MLE | $\max_\theta P(\mathcal{D} \mid \theta)$ | 标准 cross-entropy 训练 |
| MAP | $\max_\theta P(\mathcal{D} \mid \theta) P(\theta)$ | weight decay = L2 正则 |
| 全贝叶斯 | 对 $P(\theta \mid \mathcal{D})$ 积分/采样 | 贝叶斯 NN、LoRA 不确定性（研究向） |

LLM 预训练本质是 **MLE**：70 亿参数，显式后验不可算；weight decay $10^{-2}$ 量级相当于弱高斯先验。

## 量化

**高斯先验 + 高斯似然 → 后验仍高斯**（共轭）。先验 $\theta \sim \mathcal{N}(0, \sigma_p^2)$，等价 L2 惩罚 $\frac{1}{2\sigma_p^2}\|\theta\|^2$。

| weight decay | 对应先验 std $\sigma_p$ |
| ------------ | ----------------------- |
| 0.01 | ≈ 7.07 |
| 0.1 | ≈ 2.24 |

**证据下界**（ELBO，变分推断）：

$$
\log P(\mathcal{D}) \geq \mathbb{E}_{q(\theta)}[\log P(\mathcal{D} \mid \theta)] - D_{KL}(q(\theta) \| P(\theta))
$$

VAE、某些不确定性方法走这条路；标准 LLM 预训练不用。

::: info

日常训练说的「过拟合」= 似然过高、后验过于集中在训练数据附近的 $\theta$。Dropout、数据增强、early stopping 都是隐式或显式地约束后验不要过窄。

:::

## 工程视角：正则即先验

Weight decay 在 AdamW 里**与梯度解耦**：更新 $\theta$ 后单独乘 $(1-\lambda)$，等价 MAP 里高斯先验 $\mathcal{N}(0, \sigma^2 I)$，$\lambda \propto 1/\sigma^2$。

Dropout 可解释为**贝叶斯近似**：训练时随机丢神经元 ≈ 对指数级子网络集成；推理时 scale 权重。MC Dropout 推理时多次采样估不确定性——小模型可用，LLM 不现实。

**Ensemble** vs **Bayesian**：训练 5 个模型平均预测，类似近似 $P(y|x,\mathcal{D})$；全贝叶斯对 $P(\theta|\mathcal{D})$ 积分，单模型 + 变分 $q(\theta)$ 折中（Bayes by Backprop 等）。

RLHF 里 reward model 给分数，PPO 优化 policy——不是经典贝叶斯，但「先验 = SFT 模型，数据 = 人类偏好」可类比后验更新。

| 正则手段 | 贝叶斯解释 |
| -------- | ---------- |
| L2 / weight decay | 高斯先验 |
| L1 | Laplace 先验 → 稀疏 |
| Dropout | 变分推断近似 |
| Early stopping | 限制后验复杂度 |

**Conjugate prior** 使后验闭式——深度学习不用，因为似然（神经网络）非指数族。变分推断用 $q(\theta)$ 逼近，ELBO 可优化——VAE、Bayesian NN 研究线；工业 LLM 仍以 MLE + 启发式正则为主。

## 常见误区

1. **「贝叶斯 = 贝叶斯网络」**：贝叶斯定理是通用更新规则；贝叶斯网络是图模型的一种。
2. **「LLM 训练是贝叶斯的」**：主流是 MLE + 启发式正则；全贝叶斯 LLM 算力不可行。
3. **后验概率 $P(\theta \mid \mathcal{D})$ 与 $P(y \mid x)$ 混淆**：前者对参数，后者对预测（预测时可对参数积分：$P(y \mid x, \mathcal{D}) = \int P(y \mid x, \theta) P(\theta \mid \mathcal{D}) d\theta$）。

## 动手试一试

```python
def bayes_binary(prior: float, likelihood_pos: float, likelihood_neg: float) -> float:
    """P(class=1 | feature) 二分类"""
    num = likelihood_pos * prior
    den = likelihood_pos * prior + likelihood_neg * (1 - prior)
    return num / den

p_spam = bayes_binary(0.3, 0.8, 0.05)
print(f"P(spam | '免费') = {p_spam:.2f}")  # 0.87
```

## 深入一层：后验预测

**后验预测分布**：

$$
P(y|x, \mathcal{D}) = \int P(y|x,\theta) P(\theta|\mathcal{D}) d\theta
$$

全贝叶斯对参数积分；单点 MAP 用 $\hat{\theta}_{MAP}$ 代入。Deep ensemble 用有限个 $\theta^{(k)}$ 平均——实用不确定性估计。

**Prior predictive**：没看数据前 $P(y|x)=\int P(y|x,\theta)P(\theta)d\theta$。若先验很宽，predictive 也宽——Regularization 收窄 effective prior，predictive 更 sharp。

**Bayes factor** 比模型：$P(\mathcal{D}|M_1)/P(\mathcal{D}|M_2)$——选架构（层数、宽度）的理论工具；实践中用 validation loss / benchmark。

**Thompson sampling**（Bandit）：从后验抽 $\theta$ 再 act——探索与利用平衡。RL 元学习里有 Bayes-optimal 叙事；LLM RLHF 更 ad-hoc。

你不必手算 $P(\theta|\mathcal{D})$；只需知道：**weight decay、dropout、early stop 都在隐含地「不要后验过窄于训练集」**，与过拟合叙事一致。

## 工业 LLM 与贝叶斯

生产训练不做 MCMC 采后验。不确定性来自：ensemble、dropout 推理、校准 temperature、拒绝低 confidence 回答。贝叶斯框架仍 useful：**解释正则、理解 overfitting、读 uncertainty quantification 论文**。

RLHF：SFT 模型 ≈ 先验，人类偏好数据 ≈ 似然，PPO 更新 policy——贝叶斯叙事近似，实现是 policy gradient。

## 读者备忘

**贝叶斯 = 用数据更新信念；MAP ≈ MLE + L2。** LLM 预训练是 MLE 为主，AdamW 的 weight decay 是实用先验。全贝叶斯 7B 不可算；理解公式即可读懂正则化论文里的 prior 语言。后验预测 $P(y|x,\mathcal{D})$ 是部署不确定性讨论的理论锚点。

::: info

本章内容面向程序员：公式可手推，数字可心算，代码可运行。遇到符号不熟时，先查本篇定义表，再查总结篇速查表，不必一次背熟全部细节。

:::

::: info

复习建议：先通读直觉与定义，再跑代码块验证数字，最后看读者备忘与小结。与第一章的 float 数组、SIMD、GPU 并行对照阅读，印象更深。后续章节会在 Transformer、训练、推理中反复调用本章符号，值得在笔记里自建一张 shape/FLOPs 速查表。

:::

## 小结

贝叶斯定理 $P(\theta \mid \mathcal{D}) \propto P(\mathcal{D} \mid \theta) P(\theta)$ 用数据更新信念。MAP = MLE + 先验正则；L2 weight decay 即高斯先验。LLM 预训练以 MLE 为主，贝叶斯思想体现在正则与不确定性讨论中。下一篇回到线性代数：**点积**——attention 相似度的原子运算。

→ 下一篇：[点积是什么](/manual/llm/bit-to-agi/02-math/dot-product)
