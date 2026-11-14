---
title: "Agents"
description: "Claude Code 中文手册 · Subagent 定义、后台并行、动态工作流与 claude agents 监控"
source: "https://daiw.org/manual/claude-code/agents"
---

# Agents

> Claude Code 中文手册 · Subagent 定义、后台并行、动态工作流与 claude agents 监控

**Agents（代理）** 在 Claude Code 里主要指 **subagent（子代理）**：拥有独立上下文窗口、可并行运行的 Claude 实例。主会话把子任务派给 subagent，只收回摘要结果，从而节省主上下文、提高探索与并行开发的效率。v2.1.198 起，subagent **默认在后台运行**，主会话可继续其它工作；v2.1.232 起又默认开启 **fork 型 subagent**（`subagent_type: "fork"`，v2.1.302 起在 `claude -p`、Agent SDK、桌面端与 VS Code 中也默认开启，`CLAUDE_CODE_FORK_SUBAGENT=0` 关闭）：它继承完整对话与 prompt 缓存，适合「接着当前上下文分头干」。

::: info

与「Claude Agent SDK / 第三方 Agent 平台」不同，本篇讲的是 **Claude Code 内置的 subagent 机制**（`.claude/agents/`、Task 工具、`claude agents` 命令）。

:::

## 三种使用方式

| 方式 | 谁触发 | 典型场景 |
| ---- | ------ | -------- |
| **自动派生** | Claude 自主决定 | 代码库探索、并行读多文件 |
| **技能 fork** | `/skill` + `context: fork` | 隔离执行某段 SKILL 正文 |
| **手动命令** | `/fork`、`/batch`、`/background` | 你明确要并行或腾终端 |

日常开发多数时候**不用手动管**——Claude 会在需要时自己开 subagent；你要做的是在复杂任务时知道如何监控和显式编排。

⚠️ v2.1.277 起，subagent 的结果交回主 agent 时放在一个标明「subagent 输出」的标头下并缩进，结果里的文字无法冒充会话自身的指令；v2.1.271 起 auto mode 下 subagent 改用专门的交还调用（hand-back call）向调用方回报，由安全分类器审查，而不是事后再审查它的最后一条消息。

## 自定义 Subagent：.claude/agents/

与技能类似，subagent 用 Markdown + frontmatter 定义，放在：

| 位置 | 作用域 |
| ---- | ------ |
| `~/.claude/agents/<name>.md` | 个人，跨项目 |
| `.claude/agents/<name>.md` | 项目，可提交 git |

示例 `.claude/agents/security-reviewer.md`：

```yaml
---
name: security-reviewer
description: 专注 OWASP Top 10、密钥泄露、依赖 CVE 的安全评审
tools: Read, Grep, Glob, Bash
model: sonnet
---

你是一名安全评审专家。收到代码路径或 diff 描述后：

1. 列出潜在漏洞与误报可能
2. 标注严重级别（critical / high / medium / low）
3. 给出可操作的修复建议，不要直接改代码除非用户要求
```

创建或修改后，让 Claude「创建一个 security-reviewer agent」或直接编辑文件即可；旧版交互式 `/agents` 管理界面已在 v2.1.198 移除，改为**直接编辑 `.claude/agents/`** 或在对话中描述需求由 Claude 生成。

🆕 v2.1.248 起 agent frontmatter 还支持 `experimental.cacheTtl`（`"5m"` 或 `"1h"`），在没有全局 subagent 缓存 TTL 设置时为这个 agent 单独指定 prompt 缓存时长。

🆕 v2.1.271 起 frontmatter（以及 `--agents` 传入的 JSON）支持 `omitClaudeMd`：让自定义与插件 subagent 运行时不加载用户、项目与本机的 CLAUDE.md，托管策略文件仍会加载。

🆕 v2.1.281 起 `--agents` 配合 `-p` 也可以传一个 JSON 文件的路径（例如 `claude -p --agents ./agents.json "Review my changes"`），适合命令行放不下的大段定义；定义里的 `prompt` 也允许为空。

🆕 v2.1.292 起 `Agent` 工具新增 `effort` 参数（让 Claude 按你要求的推理强度运行 subagent），agent 名称上限设为 256 个字符；v2.1.295 起 subagent 从 `skills` 字段最多预加载 32 个技能（其余仍可通过 Skill 工具调用）；🆕 v2.1.296 起 frontmatter 与 `--agents` 定义支持 `autoCompactWindow`，可早于主对话窗口触发自动压缩（v2.1.312 起还能压低 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 设定的窗口）；⚠️ v2.1.299 起 `tools:` 列表引用 MCP 服务器时只取所点名服务器的工具（名称含 `__` 的服务器请写 `mcp__<完整名称>__*`）。

## 内置 Subagent

| Agent | 模型倾向 | 用途 |
| ----- | -------- | ---- |
| **Explore** | Haiku（轻量） | 快速搜索代码库、查引用、省主会话 token |
| **Plan** 等 | 随版本迭代 | 任务规划、调研（以你本机 `/agents` 提示为准） |

在对话中说「用 Explore subagent 查一下认证模块」即可触发；Explore 自 v2.0.17 起内置。

## 手动编排命令

| 命令 / CLI | 作用 |
| ---------- | ---- |
| `/fork <directive>` | 🆕 **v2.1.212 起语义变更**：把当前对话**复制成一个独立的后台会话**（可单独继续跑），而不再是会话内 subagent。v2.1.221 起它还会**给新会话建一个自己的 worktree**，不再和原会话共用检出 |
| `/subtask <directive>` | 🆕 **v2.1.212 新增**：派生后台 subagent，**继承完整对话上下文**，做完把结果带回（即 v2.1.212 之前 `/fork` 的行为） |
| `/batch <task>` | 技能：拆成 5–30 单元，每单元独立 git worktree + 后台 subagent + PR；v2.1.281 起在由 WorktreeCreate hook 提供 agent worktree 的环境里也能用，不再限于 git 仓库 |
| `/background [prompt]` | 当前会话转后台，释放终端；别名 `/bg` |
| `/tasks` | 查看本会话所有后台任务（命令、subagent 等）；别名 `/bashes`。v2.1.283 起每行带状态图标，支持翻页键、滚轮与点击 |
| `/workflows` | 查看/暂停/恢复**动态工作流**进度 |
| `claude agents` | 终端 UI：监控与派发并行后台会话 |
| `claude --agent <name>` | 指定本次会话使用的 subagent |
| `claude --bg` | 启动后立即转后台 |

详见 [并行与后台协作](/manual/agent/claude-code/commands-collaboration)。

## 动态工作流（Dynamic Workflow）

v2.1.154 引入：Claude 把超大任务自动编排成**数十到数百个 subagent** 的后台执行图，适合：

- 全仓库迁移（框架升级、语言改写）
- 大规模文档生成
- 跨模块一致性重构

用 `/workflows` 查看进度；`/config` 里可调整「动态工作流规模」建议值（非硬限制）。关闭：`disableWorkflows` in settings 或 `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS` 相关开关。

⚠️ **v2.1.219 起默认采用「中等规模」建议：目标少于 15 个 agent。** 想要更大或不限制，在 `/config` 的「Dynamic workflow size」里改；也可以把 `workflowSizeGuideline` 写进任意 settings 文件固定下来（写了之后 `/config` 里那一行会隐藏）。运行中的工作流状态栏会显示当前默认规模。

⚠️ **v2.1.271 起又下调了一档**：「中等」规模的指导值从 15 个 agent 降到 10 个，Pro 套餐默认改为「小」规模。同版本起工作流撞到用量上限时会暂停，额度重置后自动继续，不再丢掉受影响的 agent。

v2.1.281 起提示框下方的后台工作流行会显示名称、进度条、agent 数（宽终端）、已运行时间、总 token 数与大规模工作流告警，`/workflows` 里按 `x` 停止指针所在的那次运行；v2.1.283 修复了模型回退期间启动的工作流让每个 agent 都跑在回退模型上（现在会重试配置的模型）。

## 扇出闸门：三个默认上限

从 v2.1.212 到 v2.1.219，Claude Code 陆续给「无限并行」加上了默认闸门。这是这一批版本里**最容易让人困惑的一组变化**——同一个任务在旧版本能开出几十个 agent，新版本可能自己收着跑：

| 闸门 | 默认值 | 怎么调 | 引入版本 |
| ---- | ------ | ------ | -------- |
| ~~单会话 subagent 派生总数~~ | ⚠️ **v2.1.224 已取消**（原为 200） | — | 2.1.212 |
| 单会话 `WebSearch` 调用数 | 200 | 环境变量 | 2.1.212 |
| **同时在跑的 subagent 数** | **20** | `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` | 2.1.217 |
| **subagent 嵌套派生深度** | **3** | `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` | 2.1.219 |
| 动态工作流规模建议 | 「中等」10 个 agent（v2.1.271 前为 15）；Pro 套餐默认「小」 | `/config` 或 `workflowSizeGuideline` | 2.1.219（2.1.271 下调） |

::: warning

**嵌套深度这条来回改过，别照着旧笔记调。** v2.1.217 把 subagent 的嵌套派生**默认关掉**（深度 1）；两个版本后 v2.1.219 又改成**默认深度 3**。现在要关闭嵌套，设 `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`。

另外 v2.1.217 起 `--max-budget-usd` 是真的能拦住后台 subagent 的：到达上限后新派生会被拒绝，**在跑的后台 agent 也会被停掉**。此前这个上限对后台 agent 形同虚设。

:::

## 后台 Agent 与 claude agents

v2.1.198 起 subagent 默认后台化后的典型工作流：

```bash
# 终端 1：主会话继续交互
claude

# 终端 2：统一监控
claude agents
```

`claude agents` 可查看多个并行会话状态、attach 到后台任务（🆕 v2.1.299 起在 `claude agents` 视图里可用 `/effort` 与 `/fast` 设定新会话的起始值，不带参数敲 `/model`、`/effort` 或 `/fast` 打开选择器）。禁用后台能力：`CLAUDE_CODE_DISABLE_AGENT_VIEW=1`（见[环境变量](/manual/agent/claude-code/environment-variables)）。

⚠️ v2.1.281 起，Claude 工作时按「立即发送」（`ctrl+enter`，或任何终端都能用的 `ctrl+x ctrl+s`）不再取消这一轮：正在运行的 shell 命令、subagent 等能转入后台的工作会转入后台继续跑，Claude 在同一轮里读到你的消息。同版本起 `--setting-sources` 限制会传给派生的会话，队友、`/bg`、`claude agents` 会话与 `--worktree --tmux` 都沿用父会话的设置来源。

v2.1.280 修复了一批后台 subagent 问题：LSP 插件启用时后台 subagent 可以用 LSP 工具；无头与 SDK 会话里发给正在收尾的后台 subagent 的消息不再丢失；启动它的对话在读取报告前被压缩，也不再丢掉已完成 subagent 的报告；后台 subagent 运行时按两次 Ctrl+C 即可退出。⚠️ v2.1.302 起桌面端与 VS Code 的主对话 subagent 也一律在后台运行（而 subagent 自己在 `-p`、SDK、桌面端与 VS Code 中派生的 Agent 调用默认前台运行）；⚠️ v2.1.317 起使用不同于主对话模型的 subagent 与队友改为采用该模型自己保存的推理强度或默认强度（不再继承主会话强度）；⚠️ v2.1.318 起后台 subagent 在所有提供方上都会把运行满 3 分钟的 shell 命令转入后台以防 prompt 缓存过期，且在「消息被标记时切换模型」设为「每次询问」时遇到标记直接停止而非切换模型。

::: warning

⚠️ **v2.1.221 起后台会话的收尾行为变了**：它默认会**提交并推送**以保住工作，只在任务确实需要时才开草稿 PR，并且结束时一定报告工作落在哪里。它会遵循你 `CLAUDE.md` 里写的 git 约定——**如果你不希望后台会话自动推送，就把这条规矩明确写进 `CLAUDE.md`**，否则它按默认行为走。

:::

并行开发还可为每个任务开**独立 worktree**（`claude --worktree feature-a`），在[上手使用 · 并行开发](/manual/agent/claude-code/scenarios)有逐步说明。

## 跨会话消息：SendMessage 与 ListAgents

🆕 v2.1.224 起，**不同的 Claude Code 会话之间可以互相发消息**——本机的也好，你其它机器上的 Remote Control 会话也好。Claude 用 `ListAgents` 发现可达的会话，用 `SendMessage` 把任务或问题递过去：

- **点名**：v2.1.232 起在输入框里 `@会话名` 即可，Claude 会直接联系那个会话。同一台机器上的交互式会话名字保持唯一，重名时自动加 `name-word-word` 后缀并告诉你。
- **等对方空闲**：v2.1.236 起可以带 `notify_when_idle`，请对方下次空闲时通知你一次（macOS 与 Linux，一次性，不轮询）。
- **平台**：首发支持 macOS 与 Linux，v2.1.239 起 Windows 也可用；v2.1.248 起 Bedrock、Vertex、Foundry 与关闭遥测时同样可用。
- **入站控制**：`crossSessionInbound` 设置（或 `/config` 里的「Messages from your other sessions」）决定别的会话发来的消息是接受、暂存还是拒绝；以绕过权限模式运行的会话收到的消息会先暂存等你批准。v2.1.271 起消息被对方的权限模式策略暂存时，无头发送方会收到投递通知，`SendMessage` 的结果也不再暗示对方已读；⚠️ v2.1.317 起 `SendMessage` 发给正在运行的后台 agent 时，对方正在执行的命令会直接转入后台而不停止，让消息更早送达。

::: info

跨会话消息默认折叠成一行 `Message from @<sender>: <首行>` 的预览（v2.1.247+），按 Ctrl+O 展开全文。subagent 给另一个会话发消息时，对方的回复会送回**父会话**，而不是那个 subagent。

:::

## 技能 + Agent：context: fork

在 [Skills](/manual/agent/claude-code/skills) 里设置：

```yaml
context: fork
agent: Explore
```

技能正文会在指定 subagent 内执行，结果摘要回到主会话——适合深度调研而不撑爆主上下文。

⚠️ **v2.1.218 起，带 `context: fork` 的技能默认在后台运行**（此前是同步等待）。也就是说触发后主会话立刻能继续干别的，结果稍后以通知形式回来。需要同步等结果的技能，在其 frontmatter 里单独写 `background: false` 退出这个默认。

## Task 工具与任务追踪

v2.1.142 起默认用结构化 Task API 替代旧版 `TodoWrite`：

- `TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList`

Claude 在复杂多步任务中用来维护任务板；与 subagent 并行互补——Task 管「计划」，subagent 管「谁去干活」。

⚠️ **这组工具在新模型上已不再提供**：v2.1.233 起 Opus 4.8、Sonnet 5、Fable 5 及更新的模型拿不到 Task 系列与 `TodoWrite`；v2.1.268 起进一步收窄到只有 Claude 3.x、Opus 4.0–4.7、Sonnet 4.0–4.6、Haiku 4.5 提供。确实需要的话设 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` 找回。

## 环境变量精选

| 变量 | 作用 |
| ---- | ---- |
| `CLAUDE_CODE_SUBAGENT_MODEL` | subagent 的默认模型（可与主会话不同）。⚠️ v2.1.251 起 agent 定义里的 `model:` 与单次派生指定的模型优先于它 |
| `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` | v2.1.257+：强制所有 subagent 都用上面那个模型（未设则用主模型），无视其它指定 |
| `CLAUDE_CODE_SUBAGENT_EFFORT` | 🆕 v2.1.316+：为未显式指定强度的 subagent 设置默认推理强度，不再继承主会话强度 |
| `CLAUDE_CODE_WORKFLOW_SUBAGENT_MODEL` | 🆕 v2.1.296+：单独指定所有动态工作流（workflow）agent 的运行模型，其它 subagent 保持各自模型 |
| `CLAUDE_CODE_FORK_SUBAGENT` | 🆕 v2.1.302+：设为 `0` 关闭默认开启的 fork 型 subagent（`subagent_type: "fork"`） |
| `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS` | v2.1.269+：Workflow 工具单次运行的并发 agent 上限（1–256） |
| `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | 只读工具与 subagent 最大并行数（默认 10） |
| `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` | 同时在跑的 subagent 上限（默认 20，v2.1.217+） |
| `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` | subagent 嵌套派生深度（默认 3，设 `1` 关闭嵌套，v2.1.219+） |
| `CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS` | 后台 subagent 无进展超时（默认 10 分钟） |
| `TASK_MAX_OUTPUT_LENGTH` | subagent 输出截断前最大字符（默认 32000）。⚠️ v2.1.277 起随 TaskOutput 工具移除，不再有任何作用 |
| `CLAUDE_CODE_DISABLE_AGENT_VIEW` | 关闭 `claude agents` / `/background` 等 |

## 与插件、MCP 的关系

[插件](/manual/agent/claude-code/plugins)可打包 **agents + skills + hooks + MCP**，一次安装全团队对齐编排能力：

```text
/plugin install my-team-pack@company-marketplace
```

MCP 服务器暴露的工具对 subagent 同样可用（受 manifest 权限约束）。

## 常见误区

1. **「每个 subagent 有无限上下文」**——仍有模型窗口上限；Explore 用 Haiku 是为了又快又省，不是魔法。
2. **「后台 = 电脑关机也能跑」**——本地后台会话依赖本机进程；长期无人值守用 Claude Code on the web、Routines 或 CI。
3. **「/agents 打不开管理界面」**——v2.1.198 后改为编辑 `.claude/agents/` 或口述让 Claude 创建。
4. **「subagent 输出总是完整文件内容」**——应要求 subagent 只返回摘要。旧版本靠 `TASK_MAX_OUTPUT_LENGTH` 截断，⚠️ v2.1.277 起这个变量已不再有任何作用。
5. **「subagent 返回了就是做完了」**——v2.1.246 起撞到 `maxTurns` 上限的 subagent 会返回标记为「部分完成」的输出，并提示可以用 `SendMessage` 让它继续；看到这个标记别当成已完成。

## 建议实践

1. **探索型问题**交给 Explore，主会话只收结论。
2. **大重构**用 `/batch` 或动态工作流，不要在一个会话里硬扛。
3. **团队专用评审/安全/agent** 放进 `.claude/agents/` 并提交 git。
4. 用 `claude agents` 或 `/tasks` 养成「先看后台在跑什么」的习惯。

## 延伸阅读

- [并行与后台协作](/manual/agent/claude-code/commands-collaboration)——命令速查表
- [Skills](/manual/agent/claude-code/skills)——`context: fork` 与 bundled skills
- [Plugins](/manual/agent/claude-code/plugins)——把 agents 打包分发给团队
- [配置文件](/manual/agent/claude-code/configuration-files)——agents 路径与作用域
- [版本 Changelog](/manual/agent/claude-code/changelog)——subagent 与动态工作流演进时间线
