---
title: "TopP"
description: "从 Bit 到 AGI · 第八章：推理（Inference） · Nucleus 采样与累计概率"
source: "https://daiw.org/manual/bit-to-agi/08-inference/top-p"
---

# TopP

> 从 Bit 到 AGI · 第八章：推理（Inference） · Nucleus 采样与累计概率

TopK 固定保留 $K$ 个候选，简单续写和生僻专名却需要不同大小的候选池。TopP（Nucleus Sampling）按 **累计概率** 截断：从小到大累加排序后的概率，直到和 $\ge p$，只在这 **最小候选集** 里抽样——故名 nucleus（核）。

## 直觉

打包行李有 **重量上限**（概率预算 $p=0.9$）：把物品按「必需程度」从高到低装袋，装到总重量达 90% 就停——**装了多少件是动态的**。简单问题可能 3 个 token 就够 90%；难题可能要 200 个。

TopP 比 TopK **自适应**：分布尖（确定性强）→ 候选少；分布平（不确定）→ 候选多。

## 定义

1. 对 logits 算 $p = \text{softmax}(\mathbf{z}/T)$
2. 将 $p$ **降序** 排列：$p_{(1)} \ge p_{(2)} \ge \cdots$
3. 找最小 $n$ 使得 $\sum_{i=1}^{n} p_{(i)} \ge p_{\text{cut}}$（常用 $p_{\text{cut}}=0.9$ 或 $0.95$）
4. 仅保留这 $n$ 个 token 的概率（重归一化），再抽样

参数 **top_p** $\in (0, 1]$；$p=1$ 时不截断。

```mermaid
flowchart LR
  sort["概率降序"] --> cum["累加 cumsum"]
  cum --> cut["第一个 cum ≥ p 的位置"]
  cut --> renorm["重归一化 + 抽样"]
```

## 例子

**例 1：尖峰分布**

$p = [0.85, 0.10, 0.03, 0.02]$，top_p=0.9

| 步骤 | 累计 | 保留 |
| ---- | ---- | ---- |
| token0 | 0.85 | ✓ |
| token0+1 | 0.95 ≥ 0.9 | ✓，停 |

**n=2** 即够；TopK=40 会 **浪费 38 个空位**。

**例 2：平坦分布**

100 个 token 各 $p_i \approx 0.01$，top_p=0.9 → 需 **~90 个** token 才够 90% 质量——TopP **自动放大** 候选池。

**例 3：API 默认值**

| 平台 | 典型默认 |
| ---- | -------- |
| OpenAI Chat | temperature=1, top_p=1（或用户设 0.9） |
| HuggingFace | top_p=1.0（不启用） |
| vLLM | `SamplingParams(top_p=1.0, top_k=-1)` |

```python
import torch

def top_p_filter(logits, top_p: float):
    probs = torch.softmax(logits, dim=-1)
    sorted_probs, sorted_idx = torch.sort(probs, descending=True)
    cum = torch.cumsum(sorted_probs, dim=-1)
    # 保留 cum <= top_p 的最小前缀（实现细节：常 shift 1 位）
    mask = cum - sorted_probs > top_p
    sorted_probs = sorted_probs.masked_fill(mask, 0.0)
    sorted_probs = sorted_probs / sorted_probs.sum(dim=-1, keepdim=True)
    # scatter 回原顺序再 multinomial ...
    return sorted_probs, sorted_idx
```

## 量化

| top_p | 典型候选数 n（尖峰分布） | 典型 n（平坦分布） |
| ----- | ------------------------ | ------------------ |
| 0.5 | 1～3 | 50+ |
| 0.9 | 2～10 | 100+ |
| 0.95 | 3～20 | 150+ |
| 1.0 | $|V|$ | $|V|$ |

- **延迟**：排序 $|V|$ 概率 **~0.05～0.2 ms**（GPU）
- **与 TopK 联用**：`top_k=50, top_p=0.9` → 先 K 再 P，**双保险** 防 flat 分布时 n 过大

::: warning

top_p=0 在多数实现中 **非法或未定义**；greedy 请用 temperature=0 或 top_k=1。

:::

## 工程现场：top_p 与业务 SLA

**OpenAI 兼容 API** 里 `top_p=1` 表示 **不截断**；`0.9` 是 **经典默认**。调参时常见现象：

- **top_p 0.5～0.7**：输出 **短、确定**；客服 FAQ 有时适用
- **0.85～0.95**：通用聊天甜区
- **1.0**：完全信任 temperature 形塑的分布

**与 temperature 的交互表**（同一 logits，粗感）：

| 组合 | 效果 |
| ---- | ---- |
| 低 T + 低 P | 近乎 greedy，易重复 |
| 低 T + 高 P | 窄而稍多样 |
| 高 T + 低 P | 在「核内」发散 |
| 高 T + 高 P | 极度发散，幻觉风险显著升高 |

### 自己拖一下

这张表是四个采样点，而三个旋钮是连续的。拖一遍，尤其注意**存活候选数**——把 top-p 锁在 0.9，然后在「尖分布」和「平分布」之间切换：同一个 p，留下的候选数从 2 个变成十几个。**这就是 nucleus sampling 所谓「自适应」的全部含义**：它适应的是分布形状，不是你的意图。

<Sampler />

**排序成本**：每步对 $|V|$ 概率 **full sort** $O(|V| \log |V|)$；$|V|=128k$ 仍 **低于  0.2 ms**。部分实现用 **partial sort** 只找 cumsum ≥ p 的前缀，**略快**。

**流式输出**：TopP 每步独立——**不会** 跨 token 记忆 nucleus；长文 **主题漂移** 是模型问题，不是 TopP bug。

**A/B 指标**：对比 top_p=0.9 vs 1.0 时，看 **用户续聊率、编辑距离、人工评分**；单纯 **perplexity** 对 chat **不敏感**。

**cumsum 实现细节**：`cumsum - sorted_prob > top_p` 的 **mask 边界** 各框架 **差 1 token** 不罕见——回归测试用 **同一框架**。

**top_p=0.95 vs 0.9**：对尖峰分布 **候选数几乎相同**；对 flat 分布 **0.95 多 ~20% 候选**——主观 **「更活」** 一点。

## 手算例题

$p=[0.5,0.25,0.15,0.06,0.04]$，top_p=0.9：累加 0.5→0.75→**0.9**，保留 **前 3 项**（不是 90% 词表）。改 top_p=0.5 只保留 **第 1 项**——输出 **几乎 deterministic**。

## 常见误区

1. **「top_p=0.9 表示只保留 90% 的词」**——是 **概率质量** 90%，不是词表 90%。
2. **「TopP 取代 Temperature」**——二者正交：Temperature **形** 分布，TopP **切** 尾部。
3. **「top_p 越低越安全」**——过低 → 几乎 greedy → **重复、缺乏多样性**。

## 动手试一试

构造 $p=[0.4,0.3,0.15,0.1,0.05]$，手算 top_p=0.7、0.9、1.0 各保留几个 token；与 TopK=2 对比差异。

## 回顾与衔接

TopP（**Nucleus Sampling**, Holtzman et al. 2019）动机：自然语言 **有效支持集大小** 步间 **剧烈变化**——「The capital of France is」后 **Paris** 占 90%+ 质量；开放续写时 **上百 token** 都有非 trivial 概率。固定 TopK **无法自适应**；TopP 用 **累计概率质量** 定义 **最小 sufficient 候选集**。

OpenAI API 长期把 **top_p** 与 **temperature** 并列为 **核心采样旋钮**；HuggingFace `generate()` 默认 **top_p=1.0**（不启用），迁移时要注意 **默认值差异** 导致 **输出风格漂移**。

与 [Prefix Caching](/manual/llm/bit-to-agi/08-inference/prefix-caching) 无关（采样在 logits，cache 在 KV）；与 [Speculative Decoding](/manual/llm/bit-to-agi/08-inference/speculative-decoding) **有关**——verify 步的 rejection 用 **target 分布**，若线上 TopP 与 draft 不一致，accept rate **下降**。

## 读者问答

**问：top_p=0.9 和保留 90% 词表是一回事吗？**
**不是**；是 **概率质量 90%**，候选个数 **每步可变**——简单步可能 **2 个**，难步 **上百个**。

**问：top_p 和 temperature 哪个更重要？**
**都重要**；只调一个时，chat 常 **固定 top_p=0.9 调 T**，或 **固定 T=0.8 调 top_p**——**A/B 决定**。

## 速查卡

| top_p | 含义 |
| ----- | ---- |
| 1.0 | 不截断 |
| 0.9 | 经典默认 |
| 0.5 | 很保守 |
| 0 | 非法/未定义 |

**Nucleus**：累计概率 **≥ p** 的紧凑候选集——**自适应 K**。

**默认建议**：不确定时 **top_p=0.9, temperature=0.8** 是 **常见起点**；代码任务 **top_p=1, T=0.2**——**任务类型优先于玄学**。

**尖峰步** top_p=0.9 可能只留 **2 个 token**；**开放步** 留 **上百个**——这是 **Nucleus 自适应** 的核心价值，TopK **无法复制**。

Holtzman **Nucleus Sampling** 原论文 **Figure 1** 直观展示 **核大小随步变化**——比任何文字描述都清楚。

TopP 已成为 **开源与商业 API 的事实标准** 之一，因为它 **随步调整支持集大小**——这是固定 TopK 无法做到的。部署时建议 **记录每步 nucleus size 的 P50/P99**（若框架支持 debug），你会发现 **简单步与难步的候选数可差两个数量级**；这对理解 **为何同一 top_p 有时很稳、有时很野** 至关重要。

**本章衔接**：TopP 之后 [Prefix Caching](/manual/llm/bit-to-agi/08-inference/prefix-caching) 回到 **系统层**，优化 **TTFT 而非采样**。**top_p=0.9** 仍是 **广泛使用的默认配置之一**。与 Temperature **联调时一次只动一个旋钮**。**Nucleus 大小随 logits 形状自动伸缩**——简单步少、难步多。生产 chat **推荐 top_p=0.9 为起点** 再 **按业务微调**。**TopP 是自适应核采样的事实标准**。**与 Temperature 联调时单旋钮变动**。**下一篇进入 Prefix Caching 系统优化**。**TopP 截的是概率质量而非词表比例**。**chat 默认常用零点九附近**。**务必 A/B 验证效果**。

## 小结

TopP 按累计概率动态选最小候选集（nucleus），比 TopK 更适应不同置信度的步。下一篇 **Prefix Caching** 把相同 prompt 前缀的 KV **算一次、用多次**。

→ 下一篇：[Prefix Caching](/manual/llm/bit-to-agi/08-inference/prefix-caching)
