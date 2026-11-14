---
title: "交叉熵是什么"
description: "从 Bit 到 AGI · 第三章：信息（Information） · 交叉熵是什么"
source: "https://daiw.org/manual/bit-to-agi/03-information/cross-entropy"
---

# 交叉熵是什么

> 从 Bit 到 AGI · 第三章：信息（Information） · 交叉熵是什么

训练 GPT 时，日志里写的 **loss** 本质上就是交叉熵。它回答一个问题：模型猜的概率分布 $q$，与语料真实的分布 $p$，平均差多少 bit？交叉熵越小，模型越接近「真正」的语言统计规律。

## 直觉：用错误的地图导航

真实分布 $p$：某路口 90% 左转、10% 右转。

模型 $q$：预测 50% 左转、50% 右转。

你按 $q$ 做决策，却生活在 $p$ 的世界里——**平均多付出的「惊喜」**就是交叉熵。地图越准（$q$ 越接近 $p$），额外代价越小。

## 定义

离散分布 $p$（真实）与 $q$（模型）的**交叉熵**：

$$
H(p, q) = -\sum_x p(x) \log_2 q(x)
$$

注意：求和用 $p(x)$ 加权，对数里是 $q(x)$——「真实世界按 $p$ 发生，你却用 $q$ 来编码/预测」。

**分类训练**（含 GPT 每步预测）：真实标签是 one-hot 的 $p$（正确类概率 1），得：

$$
H(p, q) = -\log_2 q(x_{\text{correct}})
$$

这就是**负对数似然**（NLL），与[为什么 GPT 可以预测下一个 Token](/manual/llm/bit-to-agi/03-information/why-gpt-predicts-next-token)里的 $\mathcal{L}$ 完全一致。

::: info

自然对数版本 $H(p,q) = -\sum p \ln q$ 在 PyTorch 里常见（`nn.CrossEntropyLoss` 默认 `log` 底为 $e$）。差一个 $\ln 2$ 常数因子，比较不同论文时注意单位。

:::

## 例子一：二分类数字

| 场景 | $p(\text{正})$ | $q(\text{正})$ | $H(p,q)$ |
| ---- | -------------- | -------------- | -------- |
| 完美预测 | 0.7 | 0.7 | 0.88 bit |
| 略偏 | 0.7 | 0.6 | 0.91 bit |
| 完全猜反 | 0.7 | 0.3 | 1.37 bit |
| 均匀瞎猜 | 0.7 | 0.5 | 1.00 bit |

计算第一行：$H(p,q) = -0.7\log_2 0.7 - 0.3\log_2 0.3 \approx 0.88$ bit。**注意「完美预测」的交叉熵不是 0，而是 $0.88 = H(p)$——这正是熵墙**：$q=p$ 时交叉熵触到真实分布的熵，不可能更低。交叉熵能降到 0 的唯一情形是 $p$ 本身确定（某类概率为 1）。

## 例子二：GPT 单步损失

词表 $|V| = 50{,}257$，正确 Token 模型给概率 $q = 0.05$（已经不错——随机仅 0.00002）：

$$
H_{\text{step}} = -\log_2 0.05 \approx 4.32 \text{ bit}
$$

整句 100 Token，平均损失 3.5 bit/Token → 总 NLL ≈ 350 bit，**困惑度** $\text{PPL} = 2^{3.5} \approx 11.3$。

| 平均 CE（bit/Token） | PPL | 水平（英文） |
| -------------------- | --- | ------------ |
| 15.6 | 50,257 | 随机 |
| 8.0 | 256 | 极差 |
| 4.0 | 16 | GPT-3 量级 |
| 2.0 | 4 | 接近人类估测下限 |

## 量化：与熵、KL 的关系

**关键分解**（下一篇详讲 KL）：

$$
H(p, q) = H(p) + D_{\mathrm{KL}}(p \| q)
$$

- $H(p)$：真实分布固有的不确定性，**模型无法消除**
- $D_{\mathrm{KL}}(p \| q)$：模型带来的**额外损失**

因此最小化交叉熵 = 同时压低 KL（$H(p)$ 对固定语料是常数）。

训练 1B Token、平均 CE = 4 bit → 总「预测代价」≈ **4 Gbit** 信息；模型要把这么多不确定性解释掉。参数量提供容量，SGD 提供搜索——第二章的梯度在此落地。

## 动手试一试

```python
import math

def cross_entropy(p: dict, q: dict) -> float:
    """p, q: 事件 -> 概率，键集合相同。"""
    h = 0.0
    for x, px in p.items():
        qx = max(q[x], 1e-15)  # 避免 log(0)
        h -= px * math.log2(qx)
    return h

# 公平硬币真实分布，模型预测
p = {"H": 0.5, "T": 0.5}
q_good = {"H": 0.5, "T": 0.5}
q_bad = {"H": 0.9, "T": 0.1}
print(f"完美: {cross_entropy(p, q_good):.3f} bit")  # 1.000
print(f"偏差: {cross_entropy(p, q_bad):.3f} bit")  # > 1

# GPT 单 Token（one-hot 标签）
def token_ce(prob_correct: float) -> float:
    return -math.log2(prob_correct)

for q in [1/50257, 0.01, 0.05, 0.5]:
    print(f"q={q:.5f} -> CE={token_ce(q):.2f} bit, PPL={2**token_ce(q):.0f}")
```

PyTorch 等价（单样本、自然对数）：

```python
import torch
import torch.nn.functional as F

logits = torch.randn(50257)          # 模型输出
target = torch.tensor(1234)          # 正确 Token id
loss = F.cross_entropy(logits.unsqueeze(0), target.unsqueeze(0))
# loss ≈ -log(softmax(logits)[target])
```

## 量化：批量训练与 label smoothing

一个 batch 有 $B$ 个样本、序列长 $T$，总损失：

$$
\mathcal{L}_{\text{batch}} = \frac{1}{BT}\sum_{b=1}^{B}\sum_{t=1}^{T} -\log q_\theta(x_t^{(b)} \mid x_{<t}^{(b)})
$$

GPT-3 规模粗算：$B \approx 3\text{M}$ Token/step（多卡累加），每步 CE ≈ 3.5 bit → 每步「消化」约 **10 Mbit** 不确定性。训练 300B Token ≈ $10^5$ 这样的步（极大简化），总梯度更新把 $q_\theta$ 从 $\log_2 |V|$ 附近拉向 $p$。

**Label smoothing**（标签平滑）：把 one-hot 的 $p$ 改成 $(1-\varepsilon)\delta_{y} + \varepsilon/|V|$，典型 $\varepsilon = 0.1$。效果：

- 防止 logits 爆炸（$q \to 1$ 时 $-\log q \to 0$ 过猛）
- 隐含正则，提升泛化
- 交叉熵略升，但验证 PPL 常降

对 $|V|=50257$、$\varepsilon=0.1$，正确类目标概率从 1.0 变为 0.9，其余类共分 0.1——最低损失不再为 0，**理论下界抬高**，却更符合真实语言「永远有备选续写」的性质。

**多分类 vs 语言建模**：图像分类 ImageNet 1000 类，每图 1 标签，CE 单步最高 $\log_2 1000 \approx 10$ bit。语言建模每步 50257 类，上限 $\approx 16$ bit，但真实 $p$ 极尖，好模型每步仅 3–4 bit——**有效难度**由语料熵决定，不由词表大小单独决定。扩大词表（加多语言子词）会抬高 $\log |V|$，但若新 Token 更贴合文本切分，每步 CE 可能反而降：切分更自然 → 序列更短、每步更可预测。

**监控指标换算**：训练日志 `loss=1.2`（自然对数 nat）→ bit 需乘 $\log_2 e \approx 1.443$ → 约 1.73 bit/Token → PPL $\approx 2^{1.73} \approx 3.3$。读论文时先确认 loss 底数是 $e$ 还是 $2$。

**与分类准确度的关系**：Top-1 准确（猜对最高概率类）与 CE 相关但不等价。CE 惩罚「对正确类不够自信」——$q=0.34$ 猜对比 $q=0.99$ 猜对 CE 高得多。GPT 要校准整个分布，不只 argmax 命中，因为生成时要**采样**整个 $q$。

**从零实现 CE 损失**（帮助与 PyTorch 对齐）：

```python
import math

def softmax(logits: list[float]) -> list[float]:
    m = max(logits)
    exps = [math.exp(z - m) for z in logits]
    s = sum(exps)
    return [e / s for e in exps]

def cross_entropy_one_hot(logits: list[float], target: int) -> float:
    probs = softmax(logits)
    return -math.log2(probs[target])

# 3 类玩具：正确类 idx=1，logit 越大 CE 越低
print(cross_entropy_one_hot([1.0, 3.0, 0.5], 1))  # 较低
print(cross_entropy_one_hot([1.0, 1.1, 0.5], 1))  # 较高（不自信）
```

训练曲线解读：CE 从初始 $\log_2 |V| \approx 16$ bit 降到 3–4 bit，对应 PPL 从 50257 降到 10 左右——**三个数量级的「有效候选数」缩减**。验证集 CE 略高于训练集属正常；验证 CE 反升则是过拟合信号。部署时别只看 loss：同一 CE 下，事实性、安全性还需另评。多任务微调时，不同领域 CE 加权求和（代码权重 2×、闲聊 0.5× 等）是常见配方——本质是给不同 $p$ 子分布分配训练预算。第七章训练章节会再次见到这个损失，此处只需记住：**GPT 的全部预训练梯度，都来自交叉熵对 logits 的求导**。把 CE 当作「每步猜词多付的 bit 税」，训练就是减税过程。初始税约 16 bit/Token，好模型可压到 3 bit 左右，对应 PPL 从五万降到十几——三个数量级的差距，全是统计规律被学进权重里。

## 常见误区

| 误区 | 纠正 |
| ---- | ---- |
| 「交叉熵 = 熵」 | 熵 $H(p)$ 只含 $p$；交叉熵 $H(p,q)$ 还看模型 $q$ |
| 「CE 可以为负」 | 离散分布下 $q(x)\le 1$，$-\log q \ge 0$，故 $H(p,q) \ge H(p)$ |
| 「loss 越小模型越真理」 | CE 衡量**拟合训练分布**；不等于事实正确或对齐人类价值 |

## 小结

- 交叉熵 $H(p,q) = -\sum p(x)\log q(x)$：用 $q$ 预测、按 $p$ 发生的平均代价。
- GPT 每步损失 = $-\log q_\theta(\text{正确 Token})$；整句平均 → 困惑度 $\text{PPL} = 2^{\text{CE}}$。
- $H(p,q) = H(p) + D_{\mathrm{KL}}(p\|q)$；训练就是在降 KL。
- 英文好模型 CE ≈ 3–4 bit/Token，PPL ≈ 10–16。

下一篇专门拆 $D_{\mathrm{KL}}$：[KL 散度是什么](/manual/llm/bit-to-agi/03-information/kl-divergence)。
