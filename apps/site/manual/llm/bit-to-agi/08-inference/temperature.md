---
title: "Temperature"
description: "从 Bit 到 AGI · 第八章：推理（Inference） · 温度参数如何缩放 logits"
source: "https://daiw.org/manual/bit-to-agi/08-inference/temperature"
---

# Temperature

> 从 Bit 到 AGI · 第八章：推理（Inference） · 温度参数如何缩放 logits

Temperature（温度）$T$ 在 softmax 前把 logits **除以 $T$**：$T<1$ 放大差距、输出更「果断」；$T>1$ 缩小差距、输出更「发散」。API 里的 `temperature=0.7` 不是玄学，是 **对概率分布形状的精确控制**。

## 直觉

投票时，Temperature 像 **调节计票规则**：

- **冷**（$T \to 0$）：得票最高者 **几乎必赢**（贪心）
- **常温**（$T=1$）：按原始票数比例抽签
- **热**（$T=2$）：第二名、第三名 **更容易爆冷**

化学里温度越高分子越乱；这里 $T$ 越高，token 分布 **熵越大**。

## 定义

给定 logits $\mathbf{z}$，温度 $T > 0$：

$$
p_i = \frac{\exp(z_i / T)}{\sum_j \exp(z_j / T)}
$$

性质：

| $T$ | 效果 |
| --- | ---- |
| $T \to 0^+$ | $\arg\max_i z_i$（greedy） |
| $T = 1$ | 标准 softmax |
| $T > 1$ | 分布更均匀 |
| $T \to +\infty$ | 接近均匀分布 $|V|$ 分之一 |

**与 logits 缩放等价**：$\mathbf{z}' = \mathbf{z}/T$；整体乘常数不改变 softmax，但 **除以 $T$** 会改变 **相对** 比例。

## 例子

**例 1：同一 logits，不同 $T$**

$\mathbf{z} = [4.0,\ 2.0,\ 1.0]$（三 token）

| $T$ | $p_0$ | $p_1$ | $p_2$ | 熵 $H$（bit） |
| --- | ----- | ----- | ----- | ------------- |
| 0.5 | 0.843 | 0.114 | 0.043 | 0.72 |
| 1.0 | 0.659 | 0.242 | 0.099 | 1.01 |
| 1.5 | 0.534 | 0.281 | 0.185 | 1.35 |
| 2.0 | 0.455 | 0.303 | 0.242 | 1.50 |

$T=0.5$ 时第一名 **84%**；$T=2$ 时仍最高但只有 **45%**。

**例 2：产品参数对照**

| 场景 | 推荐 $T$ | 原因 |
| ---- | -------- | ---- |
| 代码生成 / JSON | 0～0.2 | 语法错误代价高 |
| 通用聊天 | 0.6～0.9 | 自然多样 |
| 头脑风暴 | 1.0～1.2 | 更高创意 |
| 事实问答 | 0～0.3 | 降低 hallucination |

OpenAI Chat：`temperature=0` 时配合 **确定性引擎**（非纯 argmax 的内部实现），行为接近 greedy。

**例 3：与 TopP 叠加顺序**

常见管线：

```python
def sample(logits, temperature=1.0, top_p=1.0):
    z = logits / temperature
    if top_p < 1.0:
        z = apply_top_p_mask(z, top_p)  # 见 TopP 篇
    probs = softmax(z)
    return multinomial(probs)
```

**先 temperature，再 top_p/top_k**，再 softmax——顺序错会改变语义。

## 量化

- **熵缩放**：$T$ 增大 1 倍，分布熵单调增（在非退化 logits 下）。
- **极端 $T$**：$T<0.01$ 在 FP16 下可能 **softmax 溢出** 为 one-hot；实现常 clamp $T \ge 0.01$。
- **延迟**：除法 + softmax **无 measurable 差异**；$T=0$ 走 argmax 略快（无随机数）。

::: warning

`temperature=0` 与 `do_sample=False`（HuggingFace）并不完全同一——后者常强制 greedy；前者在部分框架仍走采样框架的 argmax 分支。

:::

## 工程现场：按任务调参

**Temperature 远不只是「创造力滑块」**——它改 **整个分布形状**，与任务 **错误代价** 强相关：

| 任务类型 | 建议 $T$ | 若过高 |
| -------- | -------- | ------ |
| JSON / API 输出 | 0～0.3 | 括号、引号错误 |
| 中英翻译（单候选） | 0.3～0.5 | 漏译、增译 |
| 通用助手 | 0.7～0.9 | 幻觉增 |
| 故事续写 | 1.0～1.2 | 连贯性降 |

**与 TopP 联调经验**：许多团队固定 **top_p=0.9**，只调 temperature；或 **temperature=0.8 + top_p=0.95** 双约束。单独 $T=1.2$ 无 top_p 时，**低概率 token** 仍可能被抽到——长尾风险 **高于** $T=0.8, top_p=0.9$。

**FP16 数值**：$T=0.01$ 时 $z/T$ 放大 100 倍，softmax 易 **one-hot 溢出**；框架常 `max(T, 1e-5)` 或 **直接 argmax 分支**。

**评测复现**：论文报告 **pass@k** 常 $T=0.8$ 多次采样；**MMLU** 等多用 **greedy 或 $T→0$**——对比模型时 **采样设置必须一致**，否则 **±2～5 点** 波动不奇怪。

**Entropies 监控**：线上可对每步 $H(p)$ 打点；$H$ 突然飙升可能 **prompt 注入** 或 **分布 collapse 前兆**（需结合业务判断）。

**$T=0.7$ 经验法则**：不少团队 **固定 0.7** 作为 chat 默认——在 **MMLU 与主观多样性** 间折中；**代码** 降到 **0.2** 往往 **compile rate** 更高。

**Logit bias / 禁止 token**：API 的 `logit_bias` 在 softmax **前** 加常数——等价于 **手动改 temperature 的局部版本**；与全局 $T$ **可叠加**。

## 曲线直觉

固定 logits，画 $T \in [0.1, 2.0]$ 的 **熵 $H$** 曲线：$T<0.5$ 时 $H$ **骤降**（接近 greedy）；$T>1.5$ 时 $H$ **趋近 $\log |V|$**——**创意写作** 与 **事实问答** 落在 **曲线不同区间**。

## 常见误区

1. **「$T=1$ 是随机，$T=0$ 是确定」**——$T=1$ 仍是 **按概率** 随机；只是分布未被压平/锐化。
2. **「低温一定更准确」**——低温减少胡编，但也可能 **重复、死板**；代码与创意任务最优 $T$ 不同。
3. **「temperature 训练时也这样」**——训练 loss 无此 $T$；这是 **纯推理** 旋钮（蒸馏/RL 采样除外）。

## 动手试一试

固定 prompt，设 $T \in \{0.2, 0.8, 1.2\}$ 各生成 5 次，统计 **唯一续写比例** 与 **平均长度**。

## 回顾与衔接

Temperature 来自 **统计物理 Boltzmann 分布** $p \propto e^{-E/kT}$ 的类比：「能量」低（logit 高）的状态更易占据。$T \to 0$ 只留最低能态 → **greedy**；$T \to \infty$ 各态等概率 → **均匀随机**。

它与 [TopP](/manual/llm/bit-to-agi/08-inference/top-p) **正交**：Temperature **连续形塑** 全部 $|V|$ 项的相对 odds；TopP **离散砍掉** 尾部。实践 **先 T 后 P** 的顺序不能乱——先 P 再 T 等价于 **对已是子集的概率再缩放**，与「对全词表升温再截核」**不等价**。

API 文档里的 `temperature=0` 在部分后端走 **专用 deterministic 路径**（非数学极限 softmax）——做 **回归测试** 时用 **固定 seed + greedy** 双保险。

## 读者问答

**问：temperature=0 和 top_k=1 一样吗？**
输出 **通常都是 greedy**；实现路径不同，**极端 logits** 下 **数值细节** 可能差 1 token。

**问：能否对 system 低 T、user 高 T？**
标准 API **全局一个 T**；要分区控制需 **分段生成** 或 **constrained 模板**——**非默认能力**。

## 速查卡

| $T$ | 行为 |
| --- | ---- |
| →0 | greedy |
| 0.3～0.7 | 任务常用 |
| 1.0 | 训练分布 |
| >1 | 高熵、高风险 |

**顺序**：先 **temperature**，再 **top_p/top_k**，再 softmax——**勿颠倒**。

**调参顺序建议**：新模型 **先 T=0 测能力上限** → **T=0.7 测主观** → 再动 **top_p**；**一次只动一个旋钮**，否则 **无法归因**。

第二章 **softmax 与概率** 是本章数学底座；调参时心里要有 **熵** 这把尺子，而不是 **凭感觉滑 slider**。**Eval 与 Chat 用不同 T** 是 **正常工程实践**。

Temperature 调参 **切忌多旋钮同动**：若同时改 **system prompt、模型版本、T、top_p**，线上 **回归将无法归因**。建议 **固定 prompt 与模型**，每次 **只动一个采样参数**，用 **100 条 golden set** 做 **side-by-side**。记住：**低温不能补知识**，**高温不能补逻辑**——采样只 **重加权**，不 **增能力**。

**本章衔接**：Temperature 之后 [TopK](/manual/llm/bit-to-agi/08-inference/top-k) 与 [TopP](/manual/llm/bit-to-agi/08-inference/top-p) 进一步 **截断尾部**。**三者组合** 构成 **绝大多数 API 的采样面**。调参时 **记录 entropy 便于对比**。**低温不能替代 RAG 与微调**——采样 **只改分布**，不 **增知识**。**调参请谨慎对比验证**。

## 小结

Temperature 通过 $z_i/T$ 控制 softmax 锐度：低 $T$ 贪心、高 $T$ 多样。下一篇 **TopK** 在 softmax 前 **硬截断** 低分候选。

→ 下一篇：[TopK](/manual/llm/bit-to-agi/08-inference/top-k)
