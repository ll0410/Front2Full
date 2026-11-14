---
title: "并行与后台协作"
description: "后台 agent、批量任务分解、worktree 并行开发、远程控制与团队协作"
source: "https://daiw.org/manual/claude-code/commands-collaboration"
---

# 并行与后台协作

> 后台 agent、批量任务分解、worktree 并行开发、远程控制与团队协作

Claude Code 支持把工作“甩到后台”或“拆成多份并行执行”，这一页汇总相关命令。更完整的场景化讲解见[上手使用 · 并行开发](/manual/agent/claude-code/scenarios)。

## 后台会话

| 命令 | 作用 |
| --- | --- |
| `/background [prompt]` | 把当前会话转入后台运行并释放当前终端；可先补一条指令再转后台。别名 `/bg`。用 `claude agents` 监控 |
| `/agents` | 提示你去让 Claude 创建/管理 subagent，或直接编辑 `.claude/agents/`（旧版本 `/agents` 是交互式管理界面，已在 v2.1.198 移除）。v2.1.281 起命令菜单与 `/help` 里不再列出它，直接敲 `/agents` 仍会给出这段说明 |
| `/tasks` | 查看并管理当前会话后台运行的一切（命令、subagent 等）。别名 `/bashes`。v2.1.277 起面板开着时有后台任务完成，会多出一行提示它的更新正在等待；⚠️ 同版本移除了 TaskOutput 工具，Claude 改用 Read 直接读取后台任务的输出文件。v2.1.283 起每行带状态图标与完整信息，支持翻页键、滚轮与点击；v2.1.281 起对运行中的 `/ultrareview` 按 `x` 会先确认再停止 |
| `/stop` | 停止当前 attach 的后台会话（仅在 attach 状态下可用）；会话记录与 worktree 都会保留 |
| `/fork <directive>` | 🆕 **v2.1.212 起语义变更**：把当前对话**复制成一个独立的后台会话**（可单独继续跑），不再是会话内 subagent（更早版本 `/fork` 曾是 `/branch` 的别名）。⚠️ v2.1.221 起还会**给新会话建独立 worktree**，不再和原会话共用检出；v2.1.257 起新会话保留原对话的 prompt 缓存 |
| `/subtask <directive>` | 🆕 **v2.1.212 新增**：派生一个后台 subagent，继承完整对话上下文，你继续手头工作、等它做完把结果带回来（即 v2.1.212 之前 `/fork` 的行为） |
| `@会话名` / `/list-agents` | 🆕 **v2.1.224+ 跨会话消息**：让另一个 Claude Code 会话（本机或你其它机器上）接手或回复，Claude 会用 `SendMessage` 联系它；v2.1.232 起在输入框里 `@` 点名即可，`/list-agents` 查看可达的会话。详见 [Agents](/manual/agent/claude-code/agents) |

⚠️ v2.1.281 起，Claude 工作时按「立即发送」（`ctrl+enter`，或任何终端都能用的 `ctrl+x ctrl+s`）不再取消这一轮：正在运行的 shell 命令、subagent 等能转入后台的工作会转入后台继续，Claude 在同一轮里读到你的消息；只有 Claude 只是在写回复、或在跑无法转入后台的东西时，才会打断这一轮。

## 大规模并行：/batch

| 命令 | 作用 |
| --- | --- |
| `/batch <task>` | 技能。先研究代码库，把大改动拆成 5~30 个独立单元并给出计划；确认后为每个单元在独立 git worktree 里派生一个后台 subagent，各自实现、跑测试、开 PR。需要 git 仓库（v2.1.281 起由 WorktreeCreate hook 提供 agent worktree 的环境也可以） |

```text
/batch 把 src/ 下的组件从 Vue 迁移到 React
```

## 工作流编排

| 命令 | 作用 |
| --- | --- |
| `/workflows` | 打开工作流进度视图，查看/暂停/恢复/保存正在运行或已完成的动态工作流。v2.1.271 起工作流撞到用量上限时会暂停、额度重置后自动继续，不再丢掉受影响的 agent；v2.1.281 起提示框下方的后台工作流行显示名称、进度条、agent 数、已运行时间与总 token 数，列表支持翻页、j/k 与鼠标，按 `x` 停止指针所在的运行 |

动态工作流（dynamic workflow）是 Claude 根据任务自动生成、跨数十到数百个 subagent 并行编排的后台执行方案，适合体量远超单会话能处理的大型任务（详见 [Agents](/manual/agent/claude-code/agents) 与[版本 Changelog](/manual/agent/claude-code/changelog)）。

## 远程与跨端

| 命令 | 作用 |
| --- | --- |
| `/remote-control` | 让当前会话可以被 claude.ai / Claude App 远程控制。别名 `/rc`。🆕 v2.1.273 起可以从 Claude App fork 用它（或 `claude --remote-control`）启动的会话，fork 出来的会话作为后台会话在你的电脑上运行。v2.1.283 修复了关闭遥测（`DISABLE_TELEMETRY` / `DO_NOT_TRACK`）时付费套餐用不了 Remote Control |
| `/teleport` | 把一个 Claude Code on the web 会话拉到本地终端继续（拉取分支 + 对话）。别名 `/tp`（v2.1.311 起若云端会话经历过压缩、从最近一次压缩点加载时，会提示被总结的早期消息不在本地副本里） |
| `/desktop` | 把当前会话转到 Claude Code Desktop 客户端继续（需 macOS/Windows + 订阅账号）。别名 `/app`。v2.1.271 起它会提议下载 Claude 桌面端；v2.1.275 起桌面端打不开时会说明原因和下一步 |
| `/remote-env` | 选择云端 agent 的默认运行环境 |
| `/web-setup` | 用本地 `gh` CLI 凭证把 GitHub 账号接入 Claude Code on the web |

想让云端会话跑在自己的机器或容器上，可用 `claude self-hosted-runner` 注册自托管运行环境（v2.1.224+，Team 与 Enterprise 套餐），见[启动命令行选项](/manual/agent/claude-code/cli-flags)。

## 定时与循环

| 命令 | 作用 |
| --- | --- |
| `/loop [interval] [prompt]` | 技能。会话保持打开的前提下，按固定或自适应间隔重复执行一个 prompt，例如 `/loop 5m 检查部署是否完成`。别名 `/proactive`。v2.1.248 起自适应节奏模式在所有平台都可用；v2.1.243 起 `/usage` 里能看到按循环细分的用量，失控的循环一眼可见；⚠️ v2.1.295 起在已 attach 的后台会话空闲提示符下按两次 Ctrl+C 只 detach 会话并保留待触发的 `/loop`（按 Esc 才停止循环） |

`/loop` 只在当前会话存活期间有效，关闭会话就停止。需要“电脑关机也能跑”的定时任务，应使用 Routines（云端托管）或 GitHub Actions，而不是 `/loop`——具体取舍见官方 Common workflows 文档的调度选项对比表。

## 与 subagent 的关系

日常对话里，Claude 也会自主派生 subagent 去做代码探索、并行实现等工作（不需要你手动敲上面任何命令）。Subagent 的定义、`.claude/agents/` 与监控方式见 **[Agents](/manual/agent/claude-code/agents)**。手动命令的意义在于：

- `/fork`、`/batch`：你明确知道要并行拆分，主动触发。
- `/background`：你想腾出终端去做别的事，让当前任务继续跑。
- `/tasks`、`/agents`、`claude agents`：你想看清楚“现在到底有哪些东西在后台跑”。
