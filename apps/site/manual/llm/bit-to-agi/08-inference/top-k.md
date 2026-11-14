---
title: "TopK"
description: "从 Bit 到 AGI · 第八章：推理（Inference） · 只保留概率最高的 K 个 token"
source: "https://daiw.org/manual/bit-to-agi/08-inference/top-k"
---

# TopK

> 从 Bit 到 AGI · 第八章：推理（Inference） · 只保留概率最高的 K 个 token

词表有 10 万项，但下一步合理候选往往只有几十个。TopK 采样在 softmax 前 **只保留 logits 最高的 $K$ 个**，其余设为 $-\infty$，再归一化抽样——砍掉长尾里的离谱 token（如随机 Unicode）。

## 直觉

选秀决赛：不管海选有多少人，**只让票数前 K 名** 进 PK 台抽签。$K=1$ 就是 greedy；$K=50$ 在「不太疯」和「还有选择」之间折中。

TopK 是 **硬阈值**：第 $K$ 名和第 $K+1$ 名差 0.001 分也会被一刀切开。

## 定义

给定 logits $\mathbf{z}$，整数 $K \in [1, |V|]$：

1. 取索引集 $S_K = \text{top-}K(\mathbf{z})$
2. 构造 $\tilde{z}_i = z_i$ if $i \in S_K$ else $-\infty$
3. $p_i = \text{softmax}(\tilde{z})_i$（仅 $S_K$ 上非零）
4. 从 $p$ 抽样

与 **temperature** 可组合：先 $z/T$，再 TopK，再 softmax。

| $K$ | 行为 |
| --- | ---- |
| 1 | Greedy（$\arg\max$） |
| 10～50 | 常见聊天 |
| $|V|$ | 无截断（等价全词表） |

## 例子

**例 1：$|V|=100000$，$K=40$**

- 截断前：softmax 需 exp 10 万次
- 截断后：只对 40 个算 exp → **~2500×** 少（常数级，整体 forward 仍主导）
- 被砍掉的 99960 个 token 概率 **精确为 0**，不可能被抽到

**例 2：数值对比**

$\mathbf{z}$ 前 5 维：$[5.0, 4.5, 4.0, 1.0, 0.5]$，其余 $\ll 0$。$K=3$：

| token | $z$ | 截断后 $p$（$T=1$） |
| ----- | --- | ------------------- |
| 0 | 5.0 | 0.506 |
| 1 | 4.5 | 0.307 |
| 2 | 4.0 | 0.186 |
| 3+ | — | 0 |

**例 3：$K$ 过小 vs 过大**

| $K$ | 现象 |
| --- | ---- |
| 5 | 回复 **重复、模板化** |
| 40 | 平衡 |
| 500 | 接近无 TopK，**怪 token** 概率回升 |

```python
import torch

def top_k_logits(logits, k: int):
    if k <= 0:
        return logits
    values, _ = torch.topk(logits, min(k, logits.size(-1)))
    min_keep = values[..., -1, None]
    return torch.where(logits < min_keep, torch.full_like(logits, float("-inf")), logits)

z = torch.randn(128256)
filtered = top_k_logits(z, k=50)
probs = torch.softmax(filtered, dim=-1)
assert (probs > 0).sum() == 50
```

## 量化

- **计算**：`topk` 在 GPU 上 $O(|V|)$ 或近似 $O(|V| \log K)$；$|V|=128k, K=50$ **低于  0.05 ms**。
- **分布熵上界**：$H \le \log K$ bit；$K=50 \to$ 最多 **~5.6 bit/token** 随机性。
- **与 TopP 关系**：TopK **固定候选数**；TopP **固定概率质量**（下篇）。现代栈常 **单独使用 TopP** 或 **TopK + TopP 同时**（先 K 再 P 防极端长尾）。

::: info

早期 GPT-2 时代 TopK=40 是默认；大词表时代固定 $K$ 对「简单续写」和「生僻专名」**一视同仁**，TopP 更自适应。

:::

## 工程现场：$K$ 与词表 $|V|$ 的缩放

GPT-2 时代 $|V| \approx 50257$，TopK=40 覆盖 **~0.08%** 词表——足够砍掉 **尾部噪声**。Llama 3 $|V| \approx 128256$，同样 $K=40$ 只占 **0.03%**——比例更小，但 **绝对候选数仍 40**，对 **尖峰分布** 仍够用。

**动态 vs 固定 K**：

| 策略 | 优点 | 缺点 |
| ---- | ---- | ---- |
| 固定 K=50 | 实现简单、延迟可预期 | 简单步浪费、难步不够 |
| TopP | 自适应 | 排序 $|V|$ 略贵 |
| K=4096 + TopP | 双保险 | 两遍截断 |

**长尾 token 案例**：医学专有名词 token id 可能 **logit 排第 80**——TopK=50 **永远抽不到**；TopP=0.95 可能 **保留**。领域应用若 TopK 过小，需 **提高 K 或改 TopP**。

**与 min_p（新兴）**：部分框架加 **min_p**——去掉 $p_i < \max(p) \times p_{\min}$ 的 token；与 TopK 正交，**进一步削尾**。

**延迟实测**：$|V|=128k$，TopK=50 vs 无 TopK，softmax 阶段 **差异 < 0.1 ms**（相对 25 ms ITL **低于  0.5%**）——TopK 主要价值在 **质量**，不在 **加速**（除非配合 **近似 topk** 内核）。

**代码补全 $K=50$ vs 创意写作 $K=200$**：IDE 里 **上下文强约束**（语法、类型），尖峰更尖，小 $K$ 够用；小说续写 **flat 尾** 需要更大 $K$ 或 **TopP**。

**非法 token**：结构化输出前 **mask** 掉不在 grammar 内的 id——等价于 **动态 TopK**，$K$ 每步变。

## 手算例题

$\mathbf{z}=[6,4,2,1,0.5]$，$K=3$：保留前三项，softmax 后 $p \approx [0.576, 0.212, 0.078, 0, 0]$。若真实专名在 **第 4 位**（$z=1$），TopK=3 **永远抽不到**——医学/法律场景应 **增大 K 或改 TopP**。

## 常见误区

1. **「TopK 越大越聪明」**——只是 **放宽候选**；太大等于没截断。
2. **「TopK=1 等于 temperature=0」**——都是 greedy，但 $K=1$ 是 TopK 语义；$T=0$ 是 temperature 语义，实现路径可能不同。
3. **「TopK 保证事实正确」**——只是去掉 **极低分** token；高分 hallucination 仍在 TopK 内。

## 动手试一试

对同一 logits，比较 $K=10$ 与 $K=100$ 的 softmax 熵；画 $K$ 从 1 到 500 的熵曲线（单图即可手算前 5 点）。

## 回顾与衔接

TopK 是 **Holtzman et al. 2019** 提出 **Nucleus (TopP)** 之前的标准做法；GPT-2 **top_k=40** 写进了很多人的肌肉记忆。词表从 50k → 128k 后，**固定 K** 的 **相对词表比例** 变小，但 **绝对候选数不变**——对 **尖峰分布步** 仍够用，对 **平坦步** 可能 **过早砍掉** 合理候选。

与 [TopP](/manual/llm/bit-to-agi/08-inference/top-p) 联用 **先 K 后 P**：先 cap 最多 4096 候选再 nucleus，防 **极 flat 分布** 下 TopP 要 sort 几乎全词表。**vLLM SamplingParams** 支持 `top_k=-1` 表示禁用。

TopK **不加速 forward**——LM head 仍算全 $|V|$ logits；节省在 **softmax + sample** 的 **尾项**（若实现 **只 exp top-K**）。相对 25 ms ITL **边际极小**。

## 读者问答

**问：TopK 和 TopP 只开一个？**
可以；生产 **单独开 TopP=0.9** 很常见。双开时 **先 K 后 P**，防 flat 分布 **候选爆炸**。

**问：TopK 能加速 forward 吗？**
**不能**；LM head 仍算 **全词表 logits**。节省在 **softmax/sample**，占 ITL **低于 1%**。

## 速查卡

| $K$ | 效果 |
| --- | ---- |
| 1 | greedy |
| 40～50 | GPT-2 时代默认 |
| 500+ | 接近无截断 |
| -1（vLLM） | 禁用 TopK |

**适用**：尖峰分布步 **够用**；专名/长尾步 **考虑 TopP 或增大 K**。

**历史注**：TopK 在 **小词表时代** 足够；**128k 词表 + 多语言** 时代 **TopP 或 TopK+TopP** 更稳——**不必迷信 K=40**。

专名在 logits **第 80 名** 而 $K=50$ 时，模型 **永远输出更常见但错误的 token**——这是 **TopK 结构性缺陷**，不是模型 **不够大**。

GPT-2 **官方 sample 代码** 仍用 TopK=40；迁移到 Llama 3 时 **务必重测**，不要 **照搬超参**。

在生产环境中，TopK 往往作为 **TopP 的安全网** 出现：例如 `top_k=4096, top_p=0.95`。单独使用 TopK=40 时，遇到 **专名、罕见 API、冷门库函数** 等 **logit 排名靠后但唯一正确** 的 token，会 **系统性失败**。若你观察到 **「模型明明懂却不说」**，优先 **增大 K 或改用 TopP**，而不是 **换更大模型**。

**本章衔接**：TopK 常与 TopP **联用**；下一篇 TopP 用 **累计概率** 实现 **自适应候选数**——**更推荐为 chat 默认**。**固定 K=40 迁移 Llama 3 需重测**。专名场景 **优先 TopP 或增大 K**。**TopK 是硬截断，不随步自适应**——这是与 TopP 的 **根本区别**。遇到 **专名抽不到** 时 **先增大 K** 再 **考虑换模型**。**单独使用 TopK 已非现代 chat 首选**。**与 TopP 联用更稳**。**读下一篇理解 nucleus 采样原理**。**TopK 是硬阈值截断策略**。**专名场景慎用过小 K 值**。**下一篇见 TopP 原理**。**硬截断需慎用之**。

## 小结

TopK 硬保留 logits 最高的 $K$ 项再采样，砍掉长尾噪声；$K$ 太小死板、太大无效。下一篇 **TopP（Nucleus）** 按 **累计概率** 动态决定保留多少 token。

→ 下一篇：[TopP](/manual/llm/bit-to-agi/08-inference/top-p)
