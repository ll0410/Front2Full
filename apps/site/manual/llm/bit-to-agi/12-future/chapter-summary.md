---
title: "第十二章总结"
description: "从 Bit 到 AGI · 第十二章 · Agent 栈、能力边界与通向 AGI 的诚实结论"
source: "https://daiw.org/manual/bit-to-agi/12-future/chapter-summary"
---

# 第十二章总结

> 从 Bit 到 AGI · 第十二章 · Agent 栈、能力边界与通向 AGI 的诚实结论

第十二章把 LLM 从「聊天框」扩展到 **Agent、记忆、工具、GUI、机器人与世界模型**。若只记一句：**每一块都有公开 benchmark 和工程上限，乘在一起才是系统能力**——不要因单个 demo 推断 AGI 已至。

## 能力拼图回顾

| 篇目 | 核心机制 | 2026 诚实状态 |
| ---- | -------- | ------------- |
| [Agent](/manual/llm/bit-to-agi/12-future/what-is-agent) | LLM + 循环 + 工具 | 多步成功率 $\approx p^n$，$p$ 常 0.7–0.9 |
| [Memory](/manual/llm/bit-to-agi/12-future/memory) | 上下文 + RAG | 窗口与检索二选一瓶颈；摘要有损 |
| [Tool](/manual/llm/bit-to-agi/12-future/tool-use) | Function calling | 工具多时选错率上升；需 schema 与权限 |
| [MCP](/manual/llm/bit-to-agi/12-future/mcp-future) | 标准 IO 协议 | 插口统一，Server 质量与安全不统一 |
| [Computer Use](/manual/llm/bit-to-agi/12-future/computer-use) | 截图 → 动作 | WebArena 级 **~30–45%**；分钟级延迟 |
| [Robotics](/manual/llm/bit-to-agi/12-future/robotics) | 分层控制 | LLM 在顶；1 kHz 底；sim-to-real gap |
| [World Model](/manual/llm/bit-to-agi/12-future/world-model) | 预测 $s_{t+1}$ | 短 horizon 可用；长 rollout 崩 |
| [AGI 路线图](/manual/llm/bit-to-agi/12-future/agi-roadmap) | 五线并行 | 无 operational AGI 验收 |
| [安全与对齐](/manual/llm/bit-to-agi/12-future/safety-and-alignment) | RLHF + 护栏 + 权限 | 越狱与 Agent 注入仍活跃 |

## 与全书的关系

- **第一～四章**：比特、数学、网络——Agent 运行的硬件与算法底座
- **第五～七章**：Transformer、训练、对齐——**能力**从哪来
- **第八～十一章**：推理、GPU、训练自己的模型、Serving——**成本与延迟**决定 Agent 能否上线
- **第十二章**：把这些组件**组装成系统**，并面对**开放世界**与**安全**

公式化系统可靠度（过于简化，仅供直觉）：

$$
P(\text{任务成功}) \approx p_{\text{llm}} \times p_{\text{mem}} \times p_{\text{tool}}^n \times p_{\text{env}}
$$

任一项接近 0，整体接近 0。

## 工程师行动清单

1. **Agent 设计**：硬限步数、写操作确认、observation 必回传、可观测 trace
2. **Memory**：RAG 评测 Recall@k；长对话摘要 + 保留最近轮； citation 防幻觉
3. **Tool/MCP**：最小权限 Server；动态工具路由；JSON Schema 校验
4. **Computer Use / Robot**：沙箱 VM；急停；不把 video model 当安全 sim
5. **Eval**：用真实任务集，不只看 MMLU；red team prompt injection

## 仍未解决（诚实缺口）

- **持续学习**与**个性化**不 catastrophic forgetting
- **可验证**推理（数学证明、程序正确性）与 LLM 概率本质的张力
- **经济级**自主（小时～天）无公开可靠 metrics
- **价值对齐**无完备规范；多文化、多利益相关方冲突无共识
- **物理世界**数据 flywheel 成本比文本高 **多个数量级**

::: info

「从 Bit 到 AGI」走完：你具备读论文、估成本、搭 Serving、评 Agent 的**工程语言**。AGI 若到来，更可能是**渐进系统集成**，而非单次权重发布——保持用数字和 benchmark 检验叙事。

:::

## 小结

第十二章描绘通向 AGI 的**技术拼图**：Agent 栈、具身与世界模型、对齐护栏。2026 年的共识是**能力快速进步、系统可靠性滞后、安全与 eval 必须同步**。全书正文在此收束；后续实践请回到 [第十章](/manual/llm/bit-to-agi/10-train-your-llm) 与 [第十一章](/manual/llm/bit-to-agi/11-engineering) 动手部署，并用真实任务评测——而非 hype——检验每一步。查阅全书术语请见专栏附录 [AI术语大全](/manual/llm/bit-to-agi/ai-glossary)。
