---
title: "版本 Changelog"
description: "从 1.0 GA 到 2.1.318 的关键里程碑（精选，非逐条流水账），着重梳理近期逐版本变化"
source: "https://daiw.org/manual/claude-code/changelog"
---

# 版本 Changelog

> 从 1.0 GA 到 2.1.318 的关键里程碑（精选，非逐条流水账），着重梳理近期逐版本变化

官方 [CHANGELOG.md](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) 已超过 9900 行、覆盖每一个补丁版本。这里只挑对日常使用有实际影响的**里程碑事件**，而不是逐条搬运。想看某个具体版本的完整变更，用会话内的 `/release-notes` 或直接翻官方文件。

**当前最新版本：v2.1.318**（2026-11-04 发布）。以下按版本梳理近期变化，标记约定：🆕 = 该版本引入的**新特性 / 新命令 / 新配置**；⚠️ = **行为变更**（可能影响你现有的用法）；其余为修复与体验优化。更早的版本只保留速览与主题线索。

## 模型发布节点

| 版本 | 事件 |
| --- | --- |
| 1.0.0 | Claude Code 正式 GA，随附 Sonnet 4 与 Opus 4 |
| 2.0.51 附近 | Opus 4.5 发布，推出 Claude Code for Desktop |
| 2.1.111 | Opus 4.7 上线 |
| 2.1.154 | Opus 4.8 fast mode 大幅降价（2 倍单价换 2.5 倍速度） |
| 2.1.170 | **Fable 5** 发布——Mythos 级模型，能力超过此前任何正式发布的模型 |
| 2.1.197 | **Sonnet 5** 发布并成为默认模型，原生 1M token 上下文窗口，发布初期促销价 \$2/\$10 每 Mtok（2.1.243 起转为正式标价） |
| 2.1.219 | **Opus 5**（`claude-opus-5`）发布并成为默认 Opus 模型，1M 上下文，fast mode \$10/\$50 每 Mtok；同版本 Opus 4.7 退出 fast mode |
| 2.1.251 | 按席位计费的 Enterprise 订阅默认模型改为 Opus 5，与其它高端套餐一致 |
| 2.1.257 | **Fable 5.1**（`claude-fable-5-1`）发布并成为默认 Fable 模型：1M 上下文，\$10/\$50 每 Mtok，缓存读取 \$0.25/Mtok |
| 2.1.277 | Anthropic API 上 Fable 始终出现在 `/model` 选择器里，只有组织设置禁用它时才显示为灰色 |
| 2.1.280 | **Opus 5.5**（`claude-opus-5-5`）发布并成为默认 Opus 模型：1M 上下文，\$4/\$20 每 Mtok，缓存读取 \$0.20/Mtok，默认推理强度 `medium`；同版本 Pro 与 Team Standard 套餐的默认模型从 Sonnet 改为 Opus |
| 2.1.283 | 托管设置新增 `availableModelsMatch: "exact"` 与 `deniedModels`：新发布的模型版本在列入白名单之前保持封禁，也可以点名封禁某些模型 |
| 2.1.284 | **Sonnet 5.5**（`claude-sonnet-5-5`）发布并成为 Anthropic API 上默认 Sonnet 模型：1M 上下文，\$2/\$10 每 Mtok（2.1.296 起缓存读取从 \$0.20/Mtok 下调至 \$0.10/Mtok） |
| 2.1.293 | **Haiku 5.5**（`claude-haiku-5-5`）发布并成为 Anthropic API 上默认 Haiku 模型：1M 上下文，\$0.10/\$0.50 每 Mtok（提示词超过 100K 时为 \$0.50/\$2.50） |
| 2.1.316 | **Opus 4.8 fast mode 弃用**（2026-10-30 起弃用，2026-11-30 移除，移除后直接报错而不再回退标准速度，建议迁至 Opus 5.5） |

## 协作与编排能力的演进

这条线索大致反映了 Claude Code 从“单会话问答工具”演变为“可编排的并行 agent 平台”的过程：

- **自定义 subagent**（约 1.0.60）：可以创建专用 subagent 处理特定任务，`/agents` 首次上线（交互式管理界面，后在 2.1.198 简化为提示语，改为直接编辑 `.claude/agents/`)。
- **Explore subagent**（2.0.17）：内置一个基于 Haiku 的探索型 subagent，专门用来高效检索代码库、节省主上下文。
- **检查点与回滚**（2.0.0）：引入 `/rewind`，可以撤销代码改动。
- **插件体系**（2.0.12 附近）：`/plugin install`、`enable`/`disable`、marketplace 管理陆续完善，支持打包分发技能、subagent、hooks、MCP 服务器。2.1.275 起 claude.ai 账号上启用的技能与插件还会同步到用该账号登录的终端会话。
- **技能取代自定义命令**（2.1.0 前后）：`context: fork` 让技能可以派生到独立 subagent 执行；技能支持热重载，新增/修改后无需重启会话。
- **动态工作流**（2.1.154）：让 Claude 把一个大任务编排成跨数十到数百个 subagent 的后台执行方案，`/workflows` 用于查看进度——这是目前处理“体量远超单会话”任务的核心机制。2.1.271 起工作流撞到用量上限时会暂停，额度重置后自动继续；2.1.281 起提示框下方的后台工作流行会显示名称、进度条、agent 数、已运行时间与总 token 数。
- **结构化 Task 工具默认开启**（2.1.142）：`TaskCreate`/`TaskUpdate`/`TaskGet`/`TaskList` 取代旧版 `TodoWrite` 成为默认任务追踪方式。⚠️ 后来又收回：2.1.233 起新模型不再提供这组工具，2.1.268 起只在 Claude 3.x、Opus 4.0–4.7、Sonnet 4.0–4.6、Haiku 4.5 上提供（`CLAUDE_CODE_ENABLE_TODO_TOOLS=1` 可找回）。
- **后台 subagent 默认开启**（2.1.198）：subagent 默认在后台运行，Claude 可以一边等待结果一边继续做别的事；同版本 Claude in Chrome 正式 GA。2.1.277 起移除 TaskOutput 工具，Claude 直接用 Read 读取后台任务的输出文件；2.1.281 起「立即发送」（`ctrl+enter`）不再取消这一轮，而是把正在运行的 shell 命令、subagent 等工作转入后台，队友、`/bg`、`claude agents` 派生的会话也沿用父会话的 `--setting-sources` 限制；2.1.318 起后台 subagent 在所有提供方上都会把运行满 3 分钟的 shell 命令转入后台，避免等待期间 prompt 缓存过期。
- **扇出开始设闸**（2.1.212 → 2.1.219）：subagent 派生数、WebSearch 次数、并发 subagent 数、嵌套深度、工作流规模先后被加上默认上限——从“能并行多少就并行多少”转向“默认收着跑、要放开自己调”。其中单会话 200 个的 subagent 派生总数上限在 2.1.224 取消（并发与深度上限仍在）；2.1.271 起「中等」工作流规模的指导值又从 15 个 agent 降到 10 个，Pro 套餐默认「小」规模。
- **fork subagent 默认开启**（2.1.232）：`subagent_type: "fork"` 的 subagent 继承完整对话与 prompt 缓存；交互式会话里非 teammate 的 agent 默认后台运行。2.1.302 起 `claude -p`、Agent SDK、桌面端与 VS Code 也默认开启 fork subagent（`CLAUDE_CODE_FORK_SUBAGENT=0` 关闭），桌面端与 VS Code 的主对话 subagent 同样一律后台运行。
- **跨会话消息**（2.1.224 → 2.1.239）：`SendMessage` + `ListAgents` 让本机或你其它机器上的 Claude Code 会话互相发消息；2.1.232 起在输入框里 `@会话名` 即可点名，2.1.239 起 Windows 也支持，2.1.283 起全屏模式下来自其它会话的截断消息可以点击展开，2.1.317 起发往正在运行的后台 agent 时，对方正在执行的命令会直接转入后台而不停止，让消息更早送达。
- **自托管运行环境**（2.1.224）：`claude self-hosted-runner` 把你自己的机器或容器变成 Claude Code web / 移动端 / 桌面端会话的运行地（Team 与 Enterprise 套餐）。2.1.281 起运行环境改用私有文件把系统提示词交给 Claude Code，包装脚本里追加的 `--system-prompt` 要改用 `--system-prompt-file`。
- **subagent 回传加固**（2.1.271 → 2.1.277）：auto mode 下 subagent 改用专门的交还调用向调用方回报，由安全分类器审查（2.1.271）；subagent 的结果放在标明「subagent 输出」的标头下并缩进后才交给主 agent，结果里的文字无法冒充会话自身的指令（2.1.277）。
- **Claude Code on the web / Remote Control 生态**持续加固：`/teleport`、`/remote-control`、`/desktop`、`claude agents` 等命令让本地终端、Web 会话、移动端可以互相流转与监控（集中体现在 2.1.19x 系列的大量修复与体验优化中）。2.1.271 起 Remote 会话（云端与自托管运行环境）也能用 fast mode，2.1.273 起可以从 Claude App 把 Remote Control 会话 fork 成你电脑上的后台会话。

## v2.1.292 → v2.1.318（逐版本详解）

这一批版本于 2026 年 10 月中旬至 11 月 4 日发布（CHANGELOG 中无 2.1.297、2.1.298、2.1.313、2.1.315）。以下精选影响日常 CLI、配置或安全行为的变化；桌面、云端及 Slack 专属条目从略。

- **v2.1.292** —— 🆕 `claude plugin install` 新增 `--marketplace <source>`（按与 `marketplace add` 相同的策略校验自动添加市场再安装插件）；`Agent` 工具新增 `effort` 参数，可按指定推理强度运行 subagent；新增 `CLAUDE_CODE_OVERLOADED_RETRY_BASE_DELAY_MS` 调整 529 过载重试的基础退避延迟；Claude Mods 新增 `prompt.autocomplete` 事件、`$.model.complete` 的 prompt 缓存支持（`cache: true`）以及 `agent.spawn` 对 workflow agent 的拦截。⚠️ 本地（stdio）MCP 服务器在所有安装上默认协商 `2026-07-28` 协议（`MCP_PROTOCOL_NEGOTIATION=legacy` 退出）；agent 名称及技能/插件文件的 `name` 最长限制为 256 个字符。安全修复：阻止 PreToolUse hook 与 auto mode 绕过 UNC 网络路径读取确认。
- **v2.1.293** —— 🆕 **Claude Haiku 5.5**（`claude-haiku-5-5`）发布并成为 Anthropic API 默认 Haiku 模型（1M 上下文，\$0.10/\$0.50 每 Mtok，超 100K 提示词为 \$0.50/\$2.50）；`subagentStatusLine` 负载新增 `agentType`；Mods 的 `$.tool.register` 新增 `isDeferred: false` 以直接注入工具 schema。修复用单文件 `cat`/`head`/`tail`/`sed -n`/`grep` 查看文件时未触发路径规则与嵌套 `CLAUDE.md` 加载的问题。
- **v2.1.294** —— 修复写成指令句式的 `prompt` 与 `agent` hook 放行了本应拦截的操作，并改进 `Stop` / `SubagentStop` 上指令式 `prompt` hook 的判定以减少过早停止。
- **v2.1.295** —— 🆕 `command` 与 `http` hook 新增 `onFailure: "block"`（无法启动、超时或异常退出码时阻断操作而非放行）；支持终端进度状态协议（OSC 7501）；`/copy` 选择器新增引用文本项（复制草稿时去掉 `>` 前缀）；用户设置支持 `forceLoginMethod: "gateway"` 与 `forceLoginGatewayUrl`；新增 `CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS` 限制无人值守模式下等待 429/529 的最长时间；Mods 新增 `$.ui.notify`。⚠️ tool search 按需加载的 MCP 工具描述上限从 2,048 提高到 16,384 字符；subagent 从 `skills` 字段预加载最多 32 个技能；在已 attach 的后台会话空闲提示符下按两次 Ctrl+C 只 detach 并保留待触发的 `/loop`（按 Esc 才停止循环）。
- **v2.1.296** —— 🆕 subagent frontmatter 与 `--agents` 定义新增 `autoCompactWindow`，可早于主会话触发自动压缩；新增 `CLAUDE_CODE_WORKFLOW_SUBAGENT_MODEL` 单独指定所有 workflow agent 的模型；新增 `CLAUDE_CODE_OVERLOADED_RETRY_MAX_DELAY_MS` 调整 529 重试的最大退避延迟；`Read` 工具新增 `allow_large` 参数以单次读取超大文本文件；`/plugin` 对因同名插件已启用而被跳过 hook 的插件显示提示。⚠️ Sonnet 5.5 缓存读取计费下调至 \$0.10/Mtok；预发送的 MCP 工具描述与服务器说明默认上限从 2,048 提高到 4,096 字符；按 `←` 将会话转入后台时，正在启动的一轮或 `!` 命令会被停止而非在后台暗中跑完。
- **v2.1.299** —— 🆕 终端新增**空闲自动压缩**（Idle compaction）：超过 200K token 的对话闲置约 54 分钟后，会在 1 小时 prompt 缓存过期前自动压缩，可用 `settings.json` 的 `"idleCompaction": false` 关闭或用 `CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS` 调整阈值；新增 `CLAUDE_CODE_DISABLE_FILE_MENTIONS=1` 让 `@` 文件引用只传路径而不内联文件内容；`claude agents` 视图支持 `/effort` 与 `/fast`；`claude plugin eval` 新增 `--disallow-tools`（及用例字段 `disallowed_tools`）；网关环境支持 `CLAUDE_CODE_ATTRIBUTION_HEADER=0` 移除归属块；`/usage` 新增针对 `max` 强度、工作流、常驻上下文与大工具结果的告警；Mods 新增 `$.prompt.media` 与 `$.session.identity()`。⚠️ `UserPromptSubmit` hook 改在技能或自定义斜杠命令展开前运行，阻断提示词即可一并阻止内嵌的 `!` 命令；技能自身 frontmatter 里的 `UserPromptSubmit` hook 从调用该技能之后的下一条提示词才开始生效；MCP allow 规则与 agent `tools:` 列表改为严格匹配完整规范化服务器名（`mcp__<server>__*`）；文件名含隐藏/双向控制字符或 `<>` 的技能与命令不再加载。
- **v2.1.300** —— 🆕 Claude Platform on AWS 支持 `/advisor`，新增 `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` 关闭顾问工具；OTel `api_request` 事件拆分 `cache_creation_5m_tokens` 与 `cache_creation_1h_tokens`，trace span 补齐 GenAI 语义约定属性；Mods 新增输入框 `virtualText` 装饰、`$.ui.view({ agentId })`、`prompt.change` 事件，以及在 `agent.spawn` 中改写 workflow agent 的 `prompt` 与 `model`。⚠️ 移除 `claude remote-control` 上原本无效的 `--sandbox` 与 `--no-sandbox` 标志（现传参直接报错，改用 `sandbox.enabled` 设置）；`PreToolUse` 与 `PermissionRequest` hook 返回的 `updatedInput` 会按工具 schema 校验（剔除未知键，参数不合法则拒绝调用）；发往 `api.anthropic.com` 的大请求即使关闭遥测也默认启用 gzip 压缩（`CLAUDE_CODE_GZIP_REQUEST_BODIES=0` 关闭）。
- **v2.1.301** —— 🆕 新增 `CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS`，在额度重置时间过远时直接结束请求而非干等；vim 模式新增 `%` 括号匹配跳转（可配合 `d`/`c`/`y`）；OTel `tool_decision` 事件新增 `classifier_verdict`、`permission_mode` 与 `classifier_category`；Mods 的 `Input` 组件支持多行 `rows`。⚠️ 技能与命令最多只填充前 64 个参数名（每个最长 64 字符）。改进切换小窗口模型时的自动压缩（先由原模型总结再切换）。
- **v2.1.302** —— 🆕 新增 `CLAUDE_CODE_AUTO_MODE_MODEL` 指定客户端本地 auto mode 分类器使用的模型；`/config` 新增 `Idle compaction` 开关行。⚠️ **fork subagent（`subagent_type: "fork"`）在 `claude -p`、Agent SDK、桌面端与 VS Code 中也改为默认开启**（与终端一致，`CLAUDE_CODE_FORK_SUBAGENT=0` 关闭，`claude mcp serve` 不提供）；桌面端与 VS Code 的主对话 subagent 一律后台运行，而 subagent 自己在 `-p`、SDK、桌面端与 VS Code 中派生的 Agent 调用默认前台运行；未指定权限模式的 `claude -p` 与 Agent SDK 会话在第三方提供方、关闭遥测或全新安装下统一从 `default` 模式起步；同一事件的 `prompt` 与 `agent` hook 最多同时运行 12 个；`/design-sync` 与 `/design-login` 提示独立版 Claude Design（`claude.ai/design`）将于 2026-12-14 下线；`Read` 工具拒绝超过 128 MB 的图片源。
- **v2.1.303 / v2.1.306 / v2.1.308** —— 稳定性与可靠性修复（包括云端会话内无环境变量运行 `claude -p` 误报未登录、多 MCP 工具会话把 API 错误误报为上下文超长等）。
- **v2.1.304** —— 🆕 新增 `/auto-mode-setup` 引导式配置，读取项目与近期会话来帮助 auto mode 适应当前环境（Bedrock、Vertex、Foundry、网关与关闭遥测会话均可用）；新增 `/claude-api managed-agents-secure` 安全配置比对；Pro 与 Max 套餐恢复长时间闲置会话、且会显著消耗 5 小时额度时给出提示；Mods 的 `tool.check` 支持 `decider: "person"`（强制人工审批）与 `e.isReadOnly`，`settings.read` 可按层级改写合并后的设置。⚠️ `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 支持 `k`/`M` 后缀（如 `200k`）；自定义 `ANTHROPIC_BASE_URL` 网关后默认开启 tool search（网关返回 400/422 时自动回退）；压缩完成后会自动把技能列表重发给 Claude，而 `/reload-skills` 只补发新增或变更的技能；单一来源的技能每会话最多注册 1,024 个 hook 与 16,384 字符 matcher。
- **v2.1.305** —— 🆕 Linux 沙箱新增 `sandbox.allowNestedUserNamespaces`（允许 Chromium、rootless podman 等创建用户命名空间，注意这会让它们绕过沙箱的文件保护）；新增 `CLAUDE_CODE_RETRY_WATCHDOG_USAGE_LIMIT_RECHECK_MS` 定期重查提前解除的用量上限；`/usage` 与 `/doctor` 的每条告警附带单行修复说明，按 `f` 一键应用。⚠️ `allowedMcpServers` 不再过滤 `managed-mcp.json` 里仅在 `env` 中使用 `${VAR}` 的 stdio 服务器，需禁用请改用 `deniedMcpServers`。
- **v2.1.307** —— 🆕 新增 `/claude-api api-version`，可将 Claude API 代码迁移至 `2026-10-21` 版本；新增 `claude_code.safety_event` OTel 事件（后在 2.1.312 停发）。⚠️ `axScreenReader` 设置与 settings `env` 里的 `CLAUDE_AX_SCREEN_READER` 只在用户级、托管设置或 `--settings` 中生效；自托管运行环境的 checkout hook 默认 30 分钟超时（可用 `--checkout-hook-timeout-min` 调高或设 `0`）。
- **v2.1.309** —— ⚠️ `claude ultrareview`（及 2.1.314 起的 `/ultrareview`）在运行 git 前要求先通过工作区信任确认，脚本可传无值标志 `--trust-workspace` 或设 `CLAUDE_CODE_DISABLE_ULTRAREVIEW_TRUST_CHECK=1`；`sed -i` 改走标准 Bash 提示并按原样执行，不再生成模拟文件编辑预览，也不再由 `/rewind` 恢复；子目录下超大的嵌套 `CLAUDE.md` 只加载开头部分，避免反复触发自动压缩。修复 macOS/Linux 沙箱命令在沙箱外执行 shell 启动文件、符号链接绕过 `denyWrite` 以及 `--add-dir` 同名技能无法访问（现以 `<folder>:<name>` 提供）等问题。
- **v2.1.310** —— 🆕 `Monitor` 工具与插件监视器扩展到 Bedrock、Vertex、Foundry 以及关闭遥测或非必要流量的环境（长耗时前台 `sleep` 同样在那里被拦截）；Linux 下 `/sandbox` 与启动告警会点名 Ubuntu AppArmor 对用户命名空间的限制并给出解除方法。
- **v2.1.311** —— 🆕 `claude self-hosted-runner` 新增 `--hold-idle-file` 与 `--max-hold-min`，在宿主机报告仍有遗留进程时保持空闲会话。⚠️ 交互式终端里的 `ultrathink` 在 Opus 5.5、Sonnet 5.5、Haiku 5.5 与 Fable 5.1（Anthropic API）上将该轮推理强度提至 `xhigh`；模型名称与 ID 在 `[1m]` 后缀无实际作用的模型上去掉该后缀与标签（传入仍兼容）；`settings.json` 与 Mod `$.env.set` 里的 `DISABLE_COMPACT` 只能关闭压缩、不能重新开启；Bedrock、Mantle、Vertex 与 Foundry 默认从 `downloads.claude.ai` 加载签名模型目录（`CLAUDE_CODE_MODEL_CATALOG=off` 关闭）；`claude purge` 明确说明只删除本机数据。
- **v2.1.312** —— 🆕 全屏模式下点击排队消息下方的「to send now」提示即可立即发送；网关新增 `oidc.user_id_claim`。⚠️ Bedrock、Vertex、Foundry 与 Mantle 对未识别的模型名（如自定义部署名、推理配置 ARN）默认使用精简系统提示词（`CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=0` 保留完整提示词），安全拦截后的自动模型切换也覆盖这类未识别模型名（`CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK=1` 关闭）；单会话内（含 subagent）同时运行的 `prompt` 与 `agent` hook 上限设为 24 个；subagent 的 `autoCompactWindow` 可压低 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 设定的窗口；用量提示里的「session limit」统一改称「5-hour limit」。
- **v2.1.314** —— 🆕 新增 `permissions.blockWritesOutsideWorkingDirectories`，在所有权限模式下禁止 `Write`、`Edit`、`NotebookEdit` 写入工作目录以外的路径；VS Code 与 Claude Desktop Code 标签页支持空闲自动压缩（Idle compaction），关闭遥测的订阅会话以及开启 1 小时缓存的 Bedrock / Vertex / Foundry / 网关会话同样支持；网关上游支持按 IdP 组路由的 `groups` 列表与 Bedrock `guardrail_trace`。⚠️ hook 的 `if:` 条件支持用 `Monitor(tail *)` 匹配 Monitor 工具的 shell 命令（与 `Bash(tail *)` 相同）；`/permissions` 的审查标签页改名为 `Recently blocked`，且在终端过矮无法完整显示命令时拒绝批准；`FORCE_HYPERLINK=false`（及 `no`/`off`）改为关闭超链接；`PreCompact` hook 输出截断在 10,000 字符，且 `~/.claude/skills/.trash` 与 `~/.claude/plugins/.trash` 各自保留约 1,024 条目上限。
- **v2.1.316** —— 🆕 新增 `CLAUDE_CODE_DISABLE_ULTRATHINK=1` 关闭 `ultrathink` 关键词；新增 `CLAUDE_CODE_SUBAGENT_EFFORT` 为未显式指定强度的 subagent 设置默认推理强度（不再继承主会话）；新增 `CLAUDE_CODE_DISABLE_LOOPED_CROSS_CERT_DROP` 保留互相交叉签名的系统证书；网关支持团队共享月度预算 `pooled_budget`、多层合并策略 `managed.policy_mode: layered` 与 Bedrock `guardrail.input_tagging`。⚠️ **Opus 4.8 的 fast mode 自 2026-10-30 起弃用，将于 2026-11-30 移除**（移除后请求直接报错且不回退标准速度，请迁至 Opus 5.5）；Team 与 Enterprise 登录从 Anthropic API 拉取的服务端托管设置无需审批直接生效，且未通过校验的本地缓存副本会被拒绝。
- **v2.1.317** —— 🆕 Agent SDK 的 hook 回调支持 `onFailure: "block"`；自托管运行环境新增 `CLAUDE_CODE_DISABLE_NESTED_SESSION_ID=1`（让会话内运行的 `claude -p` 沿用外层会话 ID 与 transcript，默认改为独立 ID 以免串台）；网页或 shell 工具调用向网络发送当前账号邮箱前会先询问确认；OTel 指标、事件与 span 新增 `anthropic.plan`、`anthropic.seat_type`、`anthropic.provider` 与 `anthropic.custom_base_url`；网关管理 API 新增 `GET /v1/organizations/analytics/cost` 费用报表。⚠️ `SendMessage` 发给正在运行的后台 agent 时，对方正在执行的命令会直接转入后台而不停止，使消息更早送达；使用不同于主对话模型的 subagent 与队友改为采用该模型自己保存的推理强度或默认强度，不再继承主会话强度；移除 `Read` 工具「文件自上次读取后未变化」的占位短句，再次读取未改动文件会照常返回内容；退出时对插件监视器不再弹出「后台工作正在运行」确认。
- **v2.1.318** —— 🆕 `claude auth status` 新增 `loginExpiresAt`、`claude -p` 的 JSON 结果新增 `credential_expires_at`（显示已保存的 claude.ai 登录何时到期），且到期前 10 天起 `claude -p` 文本模式会在 stderr 打一行预警；Mods 的 `$.model.fork` 新增 `effort` 选项，并在会话询问是否启用 Claude 编写的 Mod 时记录你的回答；网关 `mantle` 上游支持 `assume_role`，自托管运行环境 orchestrator 的 spawn-runner hook 新增 `CLAUDE_RUNNER_SPAWN_REASON`。⚠️ 在 IDE 终端内启动 Claude Code 时不再自动安装或更新 IDE 扩展（改在外部终端运行 `/ide` 或从编辑器扩展面板管理）；后台 subagent 在所有提供方上都会把运行满 3 分钟的 shell 命令转入后台，防止等待期间 prompt 缓存过期；「消息被标记时切换模型」设为「每次询问」时，subagent 遇到标记会直接停止而非切换模型；`deniedMcpServers` 的 URL 条目也会拦截上游 URL 匹配的 Anthropic 官方服务器，以及云端与自托管运行环境里注入了自身 URL 的 connector；`/claude-api managed-agents-onboard` 默认给新建 agent 的内置工具与模板 MCP 工具设置 `auto` 权限策略。

## v2.1.284 → v2.1.291（逐版本详解）

这一批版本于 2026 年 9 月 28 日至 10 月 6 日发布。以下精选影响日常 CLI、配置或安全行为的变化；桌面、云端及 Slack 专属条目从略。

- **v2.1.284** —— 🆕 Sonnet 5.5 成为 Anthropic API 默认 Sonnet；auto mode 在读取工作目录以外文件的提示中新增「这次允许、下次仍询问」选项；交互终端增加 `/mcp reconnect all`，可一次重试所有掉线或待认证的 MCP 服务器。Ultracode 改为独立开关，不再强制 `xhigh` 推理强度，见[模型与推理](/manual/agent/claude-code/commands-model-permissions)。
- **v2.1.285** —— 🆕 `CLAUDE_CODE_DISABLE_WEB_FETCH=1` 可关闭 WebFetch；`claude --desktop` 可在当前目录打开 Claude 桌面应用，也可结合 `--continue` / `--resume` 打开会话；新增 `claude plugin configure <plugin>`；托管设置可用 `allowedProviders` 限制机器允许的模型提供方。
- **v2.1.286** —— 权限提示堆叠时显示当前请求序号；修复会话恢复时丢失并行工具调用后的对话，以及无效模型导致请求失败的问题；fallback 模型不能运行 fast mode 时自动退回标准速度。
- **v2.1.287** —— 🆕 插件可注册 Claude Mods 以扩展更深层行为；加入内置侧边审查插件 `cc-plugin-you-should-know`，在支持的第一方会话中可用 `/plugin enable cc-plugin-you-should-know@builtin` 开启；MCP 支持新协议的 URL elicitation。
- **v2.1.288** —— 🆕 `/code-review` 增加 `--max-findings <n>|all`，可调整报告数量并记住选择，输入 `--max-findings default` 恢复默认；清空输入框后按 `↑` 可找回 Ctrl+C 清除的草稿（含粘贴文本和图片）。修复响应中断、长对话自动压缩及 `--resume` 丢失内容等问题。
- **v2.1.289** —— 加固 Bash 与 Read deny/ask 规则，修复沙箱自动放行时复合 shell 命令、环境变量前缀或符号链接绕过规则的问题。
- **v2.1.290** —— 插件 hook 新增 agent 身份与组织审批边界信息；新增 `claude attach <会话名片段>`、`claude logs <会话名片段>`，便于按名称连接与查看会话；`/status` 与 `claude doctor` 会提示托管设置覆盖本机沙箱路径或域名规则的情况。
- **v2.1.291** —— 修复 v2.1.290 中云端会话可能丢弃权限提示答复的问题，以及 v2.1.288 中退出时可能丢失会话末尾消息的问题。

完整发布记录见 [Anthropic Claude Code Releases](https://github.com/anthropics/claude-code/releases)。

## v2.1.278 → v2.1.283（逐版本详解）

这是手册上一版（截至 v2.1.277）之后的全部版本，共 5 个发布（CHANGELOG 与 npm 上都没有 2.1.279），于 2026 年 9 月 19 日至 25 日陆续推出。VS Code 扩展、Claude Code on the web（2.1.282 起的条目改标为 Cloud sessions）、Claude Tag（Slack）、Code Review 等非 CLI 条目从略。🆕 新特性、⚠️ 行为变更单独标出，其余为修复/优化的精选。

::: warning

这一批版本里有几条**最容易让旧配置悄悄失效**：没有配置权限模式的交互式会话在所有套餐与提供方上都以 auto mode 起步（283）；项目级与本机 settings 的 `env` 里开启 OpenTelemetry 导出、设置端点或采集内容的变量一律被忽略（282）；`anthropic-skills:` 命名空间下的技能、命令与工作流命令不再加载（282）；自托管运行环境改用文件传系统提示词，包装脚本或 `command` hook 里追加的 `--system-prompt` 要改成 `--system-prompt-file`（281）；写了 `"attribution": false` 的 settings 文件会被旧版本整份跳过（281）；`y` / `n` 不再默认确认或关闭对话框（280）；`PermissionRequest` 事件上的 agent 型 hook 不再运行（280）；用户级 settings 里旧的顶层 `effortLevel` 不再作用于 Opus 5.5 这类新模型，Pro 与 Team Standard 的默认模型改为 Opus（280）。

:::

**v2.1.283**（上一版手册基准）

- ⚠️ **交互式会话默认以 auto mode 起步的范围扩大**：没有配置权限模式时，第三方提供方与关闭遥测的交互式会话也以 auto mode 起步（此前只有 Pro、Max、Team 套餐如此；按官方文档，现在终端与 VS Code 里的交互式会话在所有套餐与提供方上都是这样，`-p` 与 Agent SDK 仍从 `default` 起步），`permissions.defaultMode` 照样优先。
- 🆕 **按版本管控可用模型**（托管设置）：`availableModelsMatch: "exact"` 让 `availableModels` 里的每个模型 ID 只放行它点名的那个版本（`"claude-opus-5"` 不再顺带放行 Opus 5.5），新版本在列入名单之前一直被挡住；`deniedModels` 点名封禁某些模型，即使 `availableModels` 允许也不行。
- 🆕 **`/doctor prompt-audit`**（也可以写 `/checkup prompt-audit`）：审查你的 CLAUDE.md、技能、agent 与命令里为旧模型写的提示词套路；过时的路径、过时的命令与相互矛盾的说明文件排在报告最前，Claude Code 文档里写明的思考关键词会保留，不被当成过时写法。
- 🆕 给 LLM 网关的提示请求头新增 `x-claude-code-prompt-id`（同样要设 `CLAUDE_CODE_GATEWAY_HINT_HEADERS=1`），网关可以据此把服务同一条用户提示词的请求归到一起；`OTEL_LOG_TOOL_CONTENT=1` 时，MCP 工具、WebFetch 与 WebSearch 的输出也写进 `tool.output` span 事件。
- 🆕 Claude apps 网关：配置里可选的 `load_test_mode` 块让请求照常构建、签名但不发往上游，客户端收到固定回复，用来给部署做压测；新增对接 Amazon Bedrock Mantle 端点的 `mantle` 上游提供方。
- 🆕 全屏模式下，来自你其它会话的截断消息可以点击展开；stream-json 的 `system/init` 消息里，`plugin_errors` 中 `--plugin-dir` 加载失败的条目带上 `path`，点明没加载上的目录。
- ⚠️ **`--system-prompt` 与 `--append-system-prompt` 可以和各自的 `-file` 形式同时使用**，文件里的文本排在前面。
- ⚠️ 撤回 2.1.282 对 `claude-ai` 名字的保留：以它命名的技能、命令、工作流以及 MCP 服务器的技能与 prompt 重新加载，`Skill(claude-ai:*)` 规则恢复为普通的前缀规则。`Skill(anthropic-skills:<name>)` 的 deny 规则在 Claude Desktop 以插件形式下发该技能时也能拦住它，`Skill(skill:<name>)` 的 deny 规则同时匹配技能的别名与显示名。
- ⚠️ `claude plugin eval` 在装有 git 时要求 git 2.31 或更高版本，版本太旧会被拒绝并给出版本号；`/model` 选择器的 Opus 一行与 Default 模型名在 Opus 本就是 1M 窗口时去掉「(1M context)」字样（窗口大小不变）；连续 20 条提示词建议都没被采用后，终端里的建议出现得更少，采用一条即恢复。
- ⚠️ `/rewind` 与 `/diff` 的列表改用与其它列表相同的 `select:*` 按键动作（原来的 `messageSelector:*` / `diff:*` 重绑定仍然有效）；`/workflows` 运行列表按其它列表的规则定高（内联时占半个终端）；自动布设（不是你要求）的 artifact 监视在 3.5 小时无活动后结束，再次发布或监视即重新布设；`/ultrareview` 的启动对话框会说明，评审本地分支可能上传已跟踪文件里未提交的改动。
- ⚠️ 自托管运行环境：生命周期 hook 里的 git 跳过仓库自带的 Git LFS `pre-push` hook、忽略可写的系统级 `core.hooksPath`，没有 `--configure-git` 时不签名提交；由 Anthropic 管理 git 时，运行环境自己的 git 始终校验 Anthropic 的 git 路由，并在告警里说明 `GIT_SSL_CAINFO`、`GIT_SSL_NO_VERIFY` 分别对哪里生效。
- 安全：修复 Windows 上 PowerShell 工具允许用 `cmd /c rd`、`rmdir`、`del`、`erase` 删除驱动器根目录、主目录等 `Remove-Item` 会拒绝删除的目录（官方文档另列了关闭这项检查的 `CLAUDE_CODE_DISABLE_POWERSHELL_CMD_RM_DENY`）；修复托管的 `sandbox` 设置里只要有一个嵌套值不合法就整块被忽略（现在非法值按最严处理，其余照常生效）。
- MCP：长时间运行的工具调用转入后台后不再丢弃进度通知（后台任务显示最新进度）；会话结束时仍在启动的 stdio 服务器不再被留着运行；无状态远程服务器短暂返回 HTTP 404（如代理正在重新部署）后，不再整场会话不可用却仍显示为已连接；没有合法 URL 的服务器登录时不再报出看不懂的 SDK 错误，`/mcp` 也不再为它提供 Authenticate；`claude mcp add`、`add-json`、`remove` 写不进用户或本机配置文件（如在沙箱里）时不再报告成功。
- MCP 改进：MCP 工具返回的图片同时存成文件，Bash、Read 等工具可以直接打开；`/mcp` 工具列表一次显示更多工具，能用翻页键与鼠标滚动，组织封禁的工具带告警图标；`/context` 把 MCP 服务器说明单列一行并计入总量。
- 插件：`claude plugin validate` 对 Claude Code 实际装不上的插件或 marketplace 名字报错，也不再放过 `outputStyles`、`themes`、`monitors`、`lspServers` 路径缺失或指向插件目录之外的插件；修复 `claude plugin uninstall` 可能误删 id 只差大小写的另一个插件（连同其选项与密钥）；修复没声明版本的插件缓存丢失时被静默恢复成源的最新提交，而不是已安装的那一版；修复主目录或配置目录搬家后（如 bind mount 的 devcontainer）插件与 marketplace 以「cache-miss」加载失败。
- `installed_plugins.json`：存有非法插件 id 的记录时不再显示为空；存有本版本读不懂的记录时不再被改写而丢记录，`claude plugin` 命令会点出那条记录并说明恢复办法；整个文件读不了时，先把内容另存到旁边的文件再重建，`claude plugin list` 会指出这个文件。此外 `claude plugin details` 能数出在 `plugin.json` 里声明的 MCP 服务器，`claude plugin marketplace remove` 会列出随 marketplace 一并卸载的插件。
- 修复模型回退期间启动的动态工作流让每个 agent 都跑在回退模型上，而不是重试配置的模型；修复 Haiku 作为会话主模型时 `DISABLE_PROMPT_CACHING_HAIKU` 不起作用；修复 `ANTHROPIC_DEFAULT_HAIKU_MODEL` 钉住别的模型时 `/model` 仍显示写死的 Haiku 版本与价格；修复关闭遥测时 `/usage` 看不到 Fable 的每周额度。
- 修复关闭遥测（`DISABLE_TELEMETRY` 或 `DO_NOT_TRACK`）时付费套餐用不了 Remote Control；修复从 git 仓库的子目录启动时，Claude 改写自己的自动记忆笔记被当成敏感文件写入拦下；修复沙箱里的 `git` 让凭证 helper 保存沙箱代理的登录信息（打印「failed to store」）；修复 CA 证书以 `GIT_CONFIG_COUNT` 环境变量对传给 git 时，worktree 检出（如 Git LFS 下载）证书校验失败。
- 按键与 vim：`keybindings.json` 里拼错的修饰键（如 `ctl+k`）不再被静默接受，改在调试日志里告警并提示正确写法；快速连续到达的按键（预输入、按键重复、ssh 或 tmux 下的突发输入）不再按过时的状态处理；内置的快捷键指南改正为组合键 3 秒（不是 1 秒）超时、`cmd` 并非 `meta` 的别名；vim 模式修正 `.` 重复、`J` 合并行的空格与光标位置等一批与 Vim 不一致的行为。
- 界面：`/tasks` 每行带状态图标、名称与完整信息，任务多时标题与按键提示留在屏幕上，并支持翻页键、滚轮与点击；`/help`、`/hooks`、`/copy`、`/chrome`、`/memory`、`/ide`、`/release-notes`、`/rewind`、`/diff`、`/remote-env`、`/plugin` 等选择列表同样支持翻页键、滚轮与点击；压缩时的 spinner 从压缩开始时计时、实时统计摘要的 token 数，取代百分比进度条；Warp 终端里的 markdown 链接可以点击；屏幕阅读器模式下，权限对话框不再把引号里的命令与路径当成对话框自己的文字朗读。
- 更快的首轮：首个请求复用预先建立的 API 连接；首条回复末尾的一个模式编译步骤改在回复流式输出期间完成；`claude -p` 与 Claude Code Remote 不再加载交互式 UI，auto mode 分类器规则与 Artifact 工具改为首次使用时才加载；claude.ai 账号首次运行、Artifact 工具的功能还不确定时，输入框不再为检查它们最多等 1.5 秒。
- 修复 SDK 会话在一轮提前结束时丢掉延迟的工具调用或已完成的工具结果、worker 重启后保留的审批提示，以及非流式回退的 `result.usage`；技能所属插件加载失败时，Skill 工具如实告诉 Claude 是插件没能加载，而不是说技能没装。

**v2.1.282**

- 🆕 **`maxProseWidth` 设置**：在宽终端里限制 Claude 正文的行宽，段落、标题、列表与引用在这个列数内换行，表格与代码块仍用满终端宽度（官方文档：取不小于 40 的整数）。
- 🆕 **托管设置 `allowClaudeInChromeWithManagedMcp`**：让 `claude --chrome` 能与独占 MCP 控制的 `managed-mcp.json` 同时使用，Chrome 被拦下时的报错也会点出这个设置。
- 🆕 Claude apps 网关新增 `store.readiness_grace_seconds`，Postgres 短暂中断（如数据库故障切换）期间 `/readyz` 仍保持就绪；全屏模式下 `/feedback` 的草稿列表多了滚动条（鼠标悬停时出现）。
- ⚠️ **项目级与本机 settings 忽略会开启 OpenTelemetry 导出、设置导出端点或采集内容的变量**（如 `CLAUDE_CODE_ENABLE_TELEMETRY`、`OTEL_LOG_*`），这些要写在 shell、用户级或托管设置里；启动时会有提示，`/status` 与 `claude doctor` 也会列出项目设置里被忽略、或把遥测关掉的遥测变量。
- ⚠️ **保留 `anthropic-skills` 与 `claude-ai` 两个命名空间**：落在其中的技能文件夹、命令文件与工作流命令不再加载（同名插件仍会加载，但与同步来的技能重名时让位）；以这两个名字配置的 MCP 服务器不再列出技能与 prompt（工具照常可用，改掉服务器名即可恢复）；`Skill(anthropic-skills:*)` 与 `Skill(claude-ai:*)` 的 allow 规则只覆盖从 claude.ai 同步来的技能，不再覆盖只是用了这类名字的插件或其它技能。对 `claude-ai` 的保留在 2.1.283 撤回。
- ⚠️ 直连 Anthropic API 且关闭遥测时，auto mode 也默认使用服务端分类器（`CLAUDE_CODE_AUTO_MODE_SERVER=0` 退出）；托管设置或 `--settings` 设了 `allowUnsandboxedCommands: false`，或托管设置设了 `allowManagedDomainsOnly: true` 时，项目级与本机设置里的 `sandbox.excludedCommands` 条目被忽略。
- ⚠️ Windows 与 WSL：管理员策略（HKLM 或 `managed-settings.json`）存在但无效或读不了时，用户可写的 HKCU 与 WSL 的 `/etc/claude-code` 也不再生效。中间带 `:*` 的 Bash 权限规则此前在 settings 文件里被跳过、只有 `--allowedTools` 认，现在对所有来源都生效，启动时会告警说明它怎么匹配。
- 安全：托管设置里 `disableClaudeAiConnectors`、`allowManagedPermissionRulesOnly` 这类布尔锁定键的值写错时不再被忽略（锁定照样生效，启动时点名这个键）；托管的 `permissions`、`autoMode`、`worktree`、`attribution` 里有一个嵌套值不合法时不再整块作废；托管 `allowManagedPermissionRulesOnly` 生效时，仓库、用户与 `--add-dir` 的技能、命令以及 skills-dir 插件清单不能再用 `allowed-tools` 预先批准自己的工具；启动时不再经由仓库里的符号链接（通过 `..` 或 `/.vol` 形式的内核路径到达 macOS 的 `/Network`）读取 CLAUDE.md 与规则文件。
- 修复历史里有 API 无法解密的网页搜索结果（例如某一轮是经第三方网关回答的）时每个请求都报 400；修复更多继续或恢复（`--continue`、`--resume`）的会话把早先的消息以改动过的形式重发、导致 API 丢弃 Claude 之前的推理；修复 Claude 工作时用了 `/model`、`/rename`、`/artifacts` 等立即执行的斜杠命令后丢掉之前的扩展思考，以及用少了某个早先提供过的内置工具的 `--tools` 列表重新启动时丢失之前的扩展思考。
- 修复会话每一轮都因「Invalid `data` in `redacted_thinking` block」API 错误失败（现在丢弃对话里的思考块并重试一次）；修复总结请求被拒绝时压缩失败（改在回退模型上重试）；修复关闭思考、强度高于 high 的会话在安全相关的模型切换后，本轮以「Effort 'xhigh' isn't available with thinking turned off」失败。
- Fable 与登录：SDK 宿主的会话（如 Claude Desktop）里没人回应 Fable 用量额度提示时不再擅自切换模型（本轮直接结束，Remote Control 客户端也能看到换模型的通知）；套餐需要尚未开通的用量额度时，`/model` 加完整的 Fable 模型 id 会打开额度提示，而不是停在 API 错误；另一个进程在刷新登录中途被关掉或杀掉后，请求不再在最长一分钟里报「another Claude Code process is refreshing it」；另一个窗口正在刷新登录时启动的会话（开着多个 VS Code 窗口时常见）会重试组织策略拉取。
- 修复 Bash 与 PowerShell 把磁盘配额写满藏在「Exit code 1」后面，并在临时目录留下大体积输出文件；修复工具入参校验错误只点名一个未知、缺失或类型错误的参数（同一调用里其它不合法的参数现在一并列出）；修复终端的 bracketed paste 模式中途被重置后，粘贴的多行文本被逐行提交；修复远程会话的 worker 重启后，在恢复的权限提示上批准的命令执行两次。
- 修复 `claude remote-control --debug` 报「Unknown argument: --debug」（Remote Control 自己的资格报错却让你加 `--debug` 运行）；修复在把 `ctrl+enter` 当成换行发送的终端上（Windows Terminal 1.25 之前）立即发送的提示仍写 `ctrl+enter`（现在显示 `ctrl+x ctrl+s`）；修复 `/install-github-app` 显示「cancelled」之后仍推送分支、保存 API Key 密钥；修复 Bedrock、Vertex 等第三方提供方上 `/feedback`、`/bug`、`/share` 在保存时取消仍会存下报告文件。
- 修复插件卸载在设置文件仍启用它或读不了时报告成功并删掉插件保存的选项（现在中止并点出文件）；修复卸载后读不到已装插件列表时删掉插件保存的选项与密钥（现在保留并说明）；Vertex AI 上 Claude Code 还不认识的模型（如刚发布的）也能用网页搜索；Amazon Bedrock 与 Bedrock Mantle 上的安全拦截消息会显示请求 ID 与消息 ID。
- 体验：恢复超大会话（包括从没压缩过的）更快；Windows 上会话记录文件读不了（EBADF）导致无法恢复时，报错会列出可能原因与处理办法；`/artifacts` 的标题对齐成一列，放不下的信息整段省略而不是从词中间截断，并支持 PgUp/PgDn、Home/End、滚轮与点击；随附的 `claude-api` 技能更新了拒答计费说明（输出前的拒答计入速率限制，流式中途的拒答按正常价格计费），并推荐用 `ant apply` 把 Managed Agents 资源作为版本化文件管理。
- 界面修复：在 `/skills` 里紧跟 `/` 输入的按键会进搜索框，打字时光标不再跳到技能列表（输入法的文字也不会落错位置）；非全屏模式下带滚动条的列表不再窄两列；全屏启动时首帧之前不再闪白屏，有 `SessionStart` hook 的项目启动时输入框的示例文字不再一闪而过；diff 里重绘的行中 CJK 字符或表情折到下一行时，最后一列不再留下残字；Claude 给 artifact 版本起的标签超过 60 个字符时自动截短，发布不再失败；`/effort` 与输入框里 `ultracode` 的视觉效果改为朴素样式，并去掉动态工作流的 spinner 提示；vim 模式修正 `>>`、带计数的 `r`、`2J`、`.` 前的计数等一批行为。

**v2.1.281**

- 🆕 **`"attribution": false`**：在 `settings.json` 里一行隐藏所有 commit 与 PR 署名。更早的版本读到它会跳过整份 settings 文件，跨版本共用的文件请继续用对象写法（`commit`、`pr` 设为空字符串，`sessionUrl` 设为 `false`）。
- 🆕 **`--agents` 可以传 JSON 文件路径**（配合 `-p`），适合命令行放不下的大段 subagent 定义；定义里的 `prompt` 也允许为空。
- 🆕 **MCP URL 模式的 elicitation**：在 2026-07-28 协议的连接上，服务器可以请 Claude Code 打开一个基于浏览器的流程；服务器无法确认完成时，屏幕上不会留下一个等待中的对话框。
- 🆕 `claude plugin validate` 新增 MCP 服务器检查：报告加载时会被静默丢弃的 `.mcp.json` 条目、未声明的 `${user_config.*}` 引用与不安全的 URL；shell 形式的 hook 没给 `${CLAUDE_PLUGIN_ROOT}` 加引号时告警（插件路径含空格就会出错），插件 hook 失败时报错会点名是哪个插件。
- 🆕 `/insights` 新增 auto mode 建议，估算最近的会话里有多少权限提示本可以由 auto mode 处理；全屏模式下 `/skills`、`/mcp` 与 `/plugin` 的 Installed 列表加上滚动条（和 `/workflows` 一样，鼠标悬停时出现，可以点击或拖动）。
- 🆕 Claude apps 网关：Bedrock 上游支持 `assume_role`（经 STS 以 IAM 角色调用 Bedrock，可跨 AWS 账号，可选每位开发者一个会话）与 `guardrail: {id, version}`（给经过的每个请求套用 Amazon Bedrock guardrail，要么所有 Bedrock 上游都设、要么都不设）；新增 `telemetry.resource_attributes`，给 Claude Desktop 与 `/login` 会话的遥测打上固定标签；`desktop` 策略块支持更新的 Claude Desktop 键，包括 `blockReadsOutsideWorkingDirectories` 与 `disableBypassPermissionsMode`；`managedMcpServers` 条目的 `envHelper` 路径以 `\??\` 或 `/??/` 开头时网关拒绝启动。
- ⚠️ **立即发送（`ctrl+enter` 或 `ctrl+x ctrl+s`）不再取消这一轮**，而是把正在运行的工具转入后台，Claude 在同一轮里读到你的消息。
- ⚠️ **危险 `rm` 的确认加上时限**：`--dangerously-skip-permissions` 与 auto mode 下最多等 2 分钟，无人回答就拒绝并附上改写提示，让无人值守的会话能继续跑（`CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT=1` 关闭）；目标只是命令替换输出的递归 `rm`（如 `rm -rf "$(pwd)"`）在这两种模式下不再不经询问就执行，即使有 Bash allow 规则也会询问（`CLAUDE_CODE_DISABLE_SUBSTITUTION_RM_PROMPT=1` 关闭）；危险 `rm` 检查还会标记删除「shell 变量加顶层目录名」、由工作目录派生的变量，以及只有反斜杠的目标。
- ⚠️ **`CLAUDE_CODE_AUTO_MODE_SERVER` 也作用于直连 Anthropic API**：`0` 退出服务端分类器（本地分类器的请求计入用量），`1` 启用；服务端审查的会话里，只读与沙箱化的 shell 命令也要等审查结果，被标记就拦下。
- ⚠️ **`AGENTS.md` 支持扩展到 Amazon Bedrock、Google Vertex AI、Microsoft Foundry、LLM 网关以及关闭遥测的会话**。
- ⚠️ **自托管运行环境改用私有文件把系统提示词交给 Claude Code**，不再放在命令行里，大段提示词不会再导致启动失败；包装脚本或 `command` hook 里追加 `--system-prompt` / `--append-system-prompt` 的，要改用 `--system-prompt-file` / `--append-system-prompt-file`。
- ⚠️ 提示框下方的会话 artifact 链接合并成一个页脚标签（`⧉ name` 或 `⧉ N`），点开即 `/artifacts`，列表里本会话的 artifact 排在最前；Artifact 工具允许 Claude 在 artifact 页面里加载 unpkg.com 上的脚本；排队中的消息改为显示在对话里 spinner 的上方；在 `/tasks` 里对运行中的 `/ultrareview` 按 `x` 会先确认再停止。
- ⚠️ MCP 资源列表（资源列表工具与 `@` 提及建议）跳过 MCP Apps 的 UI 资源，按 URI 读取仍然可以；Remote Control 下载附件时复用连接、跳过本会话已下载过的文件；插件文件夹因另一个已装插件在用、或安装记录读不了而保留时，`claude plugin uninstall --json` 与 `/plugin` 对话框会说明数据被保留；命令菜单与 `/help` 里去掉残留的「(removed)」`/agents` 条目（直接敲 `/agents` 仍会说明向导去哪了）。
- ⚠️ 列表界面统一：全屏模式下鼠标悬停的行改为着色，不再在焦点行之外多画一个 `❯`（`/config` 也一样）；`/mcp` 每行以状态图标与名称开头、状态只说一次，窄终端里先省掉「managed」这类尾部信息再截短名字；`/workflows` 每行以状态图标与已运行时间开头，窄终端保留名称与时间，先省掉 agent 与 token 数。
- 安全：修复权限对话框与附件检查在批准之前就读取 macOS `/.vol`、`/.nofollow`、`/.resolve` 下（可能通往网络挂载）的路径；修复含 NUL 字节的权限规则被展开成通配匹配（现在什么都不匹配）；修复 `claude --bg` 在未通过工作区信任确认的目录里启动后台会话并运行项目 hook（现在先请求信任，非交互运行时直接退出）；修复 `--setting-sources`（以及 SDK 的 `settingSources`）没有传给派生的会话，队友、`/bg`、`claude agents` 会话与 `--worktree --tmux` 现在都沿用父会话的限制；`--channels` 的插件条目除了 marketplace，已装插件的名字也必须匹配。
- 沙箱：`excludedCommands` 条目现在能匹配 `git rev-parse --git-dir`、与 shell 内建命令同名的程序，以及含 `[WIP]` 或 `#` 行的提交信息；设了 `CLAUDE_CODE_TMPDIR` 时，沙箱化的 Bash 命令能写 `$TMPDIR`；macOS 上本地开发服务器绑不了端口时，Claude 会指向 `sandbox.network.allowLocalBinding`。
- 恢复会话一批修复：恢复的会话不再把早先的轮次以改动过的形式重发（并行工具调用的一轮、服务器重连期间的 MCP 工具入参或 tool search 结果等），避免 API 丢弃之前的推理；超大会话恢复时不再只恢复最后几条消息；权限提示未决时重启、之后再恢复，不再发出不同的历史而击穿 prompt 缓存；在工具调用中途结束的会话恢复后，Claude 能看到这次调用并被告知结果未知，手动恢复也不再追加隐藏的「Continue」消息。
- 代理与网关一批修复：被代理或网关干净地提前关闭的流不再被当成完整回复而毫无告警，重复的流事件也不再让工具调用执行两次；代理丢掉流事件时不再报「Content block not found」（保留已收到的部分回复，网页搜索也保留已到的结果）；代理在末尾补发只含用量的帧时不再丢失 stop reason；连接在最终事件前断开时不再把空的完成回复请求两次；关闭 tool search 时（如走代理或网关），MCP 服务器在对话中途断开、或恢复后仍在连接，不再让 prompt 缓存失效。
- 重试与崩溃：修复重试 API 请求期间可能以「unrecoverable interface error」崩溃、结束会话；修复模型交替输出无法解析的工具调用与超长截断时，一轮无视 `--max-turns` 无限重试；修复 `CLAUDE_CODE_RETRY_WATCHDOG` 会话在一连串 429/529 等待后遇到第一个 5xx 或断线就失败，以及对 5xx 的超长 `Retry-After` 无上限地静默等待；修复 fast mode 在服务器发来 `Retry-After: 0` 时背靠背重试被限流的请求；修复较早的 advisor 结果 API 读不了时每轮都有一个请求失败、反复丢失推理（现在一次性修复历史）。
- 工具修复：返回超大图片的工具不再让同批的其它工具调用无人应答、继续运行，或让本轮没有最终消息就结束；模型用超长名字调用工具后，对话不再永久卡在「tool_use.name: String should have at most 200 characters」；读不到自身内存用量（如文件描述符耗尽）时，工具调用不再以「Failed to get memory usage」失败；Read、Write、Edit、NotebookEdit 遇到含 NUL 字节的路径只让这次调用失败并给出清楚的错误，不再结束整轮；Write 在两个参数名下给出相同的路径或内容时不再拒绝。
- 无头与 SDK：之前的 assistant 消息是纯字符串内容时，`--input-format stream-json` 会话（Agent SDK、VS Code 扩展）与定时的云端会话不再每轮报错；启动目录在会话中途被删后，非交互会话（`-p`、Agent SDK）的下一轮不再失败；宿主（SDK）侧的 MCP 服务器握手中途失去响应时，首条消息不再卡住（远程会话最多等几秒）；工作目录内的 `--add-dir` 目录里的 CLAUDE.md 与规则文件不再在无头与 SDK 会话里发给模型两次。
- 启动与性能：没有配置 MCP 服务器或插件时，交互式启动不再等托管设置的网络请求（约 80 毫秒，网络不通时 17 秒以上）；托管设置与策略拉取不再重试注定失败的请求；git 读取、启动遥测与 Bedrock / Vertex 的模型升级检查不再挡在首帧之前；恢复读过很多文件的长会话、以及压缩过的超长会话都更快（经 Agent SDK 与 Claude Desktop 时最明显）；读取或 `@` 提及大于 3 MB 的 PDF 不再最多延迟两分钟，中断读取指定 PDF 页面后，渲染也不再继续跑最多两分钟。
- auto mode 与压缩：在新进程里恢复会话后，权限分类器可以复用之前的 prompt 缓存，不必重写；拒绝消息让 Claude 明白被拒的是这个结果本身，而不只是这一条命令；一份超大的首条提示词占据大半会话时，「Prompt is too long」恢复会单独总结它，而不是把它排除在摘要之外。
- 远程与定时：定时任务与 `/loop` 的唤醒投递失败时不再每秒重发（此前可能让 Claude Code 在一轮结束时退出）；组织策略还没加载完时，Remote Control 不再报「disabled by your organization's policy」（改为重试并说明无法验证）；`claude remote-control` 为你启动、供 Claude Desktop、claude.ai 或移动端打开的会话里不再缺少 Artifact 工具；远程会话里定时 routine 与通知触发的轮次，在首个工具调用之前就能收到轮次开始通知（新可用的工具、MCP 变化、日期、todo）；权限提示与沙箱网络访问提示重叠并都回答后，远程会话不再停在「needs approval」。
- 登录与 MCP：登录钥匙串锁定时（如刚唤醒），macOS 写凭证不再丢掉已存的 MCP OAuth token 或删掉钥匙串条目；Claude Code 退出或刷新超时后不再留下 `gcpAuthRefresh` / `awsAuthRefresh` 登录进程（Windows 上还占着本地回调端口）；从另一个 Claude Code 进程登录后，「Not logged in · Run /login」页脚与缺失的 claude.ai connector 不再残留；阻断型事件（如 PreToolUse）上的 `mcp_tool` hook 在 MCP 服务器还在连接时不再被跳过，而是最多等到 MCP 连接超时；插件或 claude.ai connector 与配置的服务器 URL 写法不同（主机大小写、默认端口、结尾斜杠）时，不再重复连接同一个服务器；`MCP_CONNECTION_NONBLOCKING=0` 不再 1 秒就放弃 claude.ai connector，而是遵守 `MCP_CONNECT_TIMEOUT_MS`。
- 插件：`--plugin-dir` 指向同时带 `.claude-plugin/marketplace.json` 的插件文件夹时，不再只加载出一个空插件；`claude plugin uninstall` 能卸载未启用的项目级插件；省略 `--scope` 时，`claude plugin update` 按插件实际的安装作用域更新项目级插件；`claude plugin validate` 不再把 `plugin.json` 里 `privacyPolicyUrl`、`supportUrl` 等上架元数据键报成未知字段；远程不可达、`CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` 保留了旧克隆时，`known_marketplaces.json` 不再把 marketplace 记成已刷新。
- 对话框与按键：`/permissions` 删除规则、移除目录的确认框里指针在 No 上时，按 `1` 不再答成 Yes（此前按住 `1` 会一个接一个地删掉工作目录）；在无法关闭思考的模型上，Alt+T 与 `/config` 不再提供关闭思考的开关（改为一行说明原因）；快速按两次 Shift+Tab 不再落到错误的权限模式；`/memory`、`/hooks`、`/mcp`、`/export`、`/copy`、`/theme` 等其余对话框与选择器里连按两次 Ctrl+C 或 Ctrl+D 只关闭对话框，不再退出 Claude Code；一次性到达的一串按键（如经 Remote Control）不再作用于之前的选中项。
- 其它修复：`/context` 的总量算上上次回复之后新增的消息（因此可能比状态栏显示的高）；API 拒绝所选模型时，`/model` 显示服务器的说明并告知模型没有更换，而不是原始 JSON 与请求 ID；来自 HTML 错误页（如代理的 429 或 502 页面）的 API 错误不再打印原始标记或漏掉 HTTP 状态码；`/feedback`、`/bug`、`/share` 在发送中取消后不再照发；`/setup-bedrock` 或 `/setup-vertex` 重启 Claude Code 应用新设置后，终端不再处于损坏状态；Bash 编辑 diff 的快照目录不再在临时目录里堆积；Windows 上同时更新的会话不再可能互删 `claude.exe` 备份、最后连一个 `claude.exe` 都不剩，写入 `$TMPDIR/…` 的 Bash 命令也不再报「Permission denied」。
- 改进：`/batch` 在由 WorktreeCreate hook 提供 agent worktree 的环境里也能运行，不再限于 git 仓库；`/` 菜单、`/skills`、`/context` 与 `/plugin` 的 Installed 列表在没有冲突时用短名显示从 claude.ai 同步的技能，而不是 `anthropic-skills:<name>`；大 CLAUDE.md 的启动提示把多份说明文件合起来计算，许多中等大小的文件与 `@` 导入也会被发现；调试日志会点名因启动环境已设置而被忽略的 settings `env` 变量；`/deep-research` 在长研究任务书上更可靠；随附的 artifact-design 技能要求 Claude 在发布的页面里用平实直接的文字，慢速网络下大页面改为压缩上传。
- 界面：提示框下方的后台工作流行显示名称、进度条、agent 数（宽终端）、已运行时间、总 token 数与大规模工作流告警；`/workflows` 与 `/mcp` 列表支持翻页（PgUp/PgDn、Home/End）、j/k 与鼠标，方向键跟随 `select:previous` / `select:next` 的重绑定，`/workflows` 里按 `x` 停止指针所在的运行；`/skills` 每行以技能名开头，只用 ✔ 或 ◯ 表示开关；`/plugin` 的 Installed 列表各段按列对齐；`/diff` 的长文件列表带滚动条；`/hooks` 的详情页会说明这是哪种 hook、该到哪里改；`/permissions`、`/usage` 等分页对话框里 ↑/↓ 在标签行与内容之间移动焦点；`/install-github-app`、`/desktop` 等提示改用带按键提示的标准对话框框架，第二次按 Ctrl+C 或 Ctrl+D 取消。

**v2.1.280**

- 🆕 **Claude Opus 5.5**（`claude-opus-5-5`）发布并成为默认 Opus 模型：1M 上下文，\$4/\$20 每 Mtok，缓存读取 \$0.20/Mtok。按官方文档，它的默认推理强度是 `medium`（比 Opus 5 的 `high` 低一档），并且和 Fable 模型一样无法关闭思考。
- ⚠️ **Pro 与 Team Standard 套餐的默认模型从 Sonnet 改为 Opus**，与 Max、Team Premium、Enterprise 一致。
- ⚠️ **推理强度的两处调整**：`/effort` 改为按模型保存之前存下的强度，不再套用到 Opus 5.5 这类新发布的模型，它们从自己的默认强度起步，直到你选一个；Opus 4.7、Opus 4.8 与 Fable 5 不再用发布时的默认强度压过 `-p` 或 Agent SDK 里的 `/effort`、项目 / 托管 / `--settings` 里的 `effortLevel`，以及按模型保存的强度。
- 🆕 `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH`：调整会话里所有 MCP 服务器的工具描述与服务器说明的 2048 字符上限；`hook_execution_complete` OTel 事件新增 hook 输出的大小，以及超长输出被存成文件的个数。
- 🆕 全屏模式下更多列表支持鼠标：滚轮滚动 `/skills` 列表，`/plugin` 里技能的状态选项可以点击，有隐藏选项的选择列表（如 `/model`、`/permissions`）也能用滚轮滚动；`/config` 设置列表与 `/model`、`/memory`、权限提示等选择列表支持 Home / End。
- ⚠️ **`y` / `n` 不再默认确认或关闭对话框**：统一用 Enter 与 Esc 确认、取消，误按的 `y` 或 `n` 不会再替你做决定（想找回就在 `keybindings.json` 里把 `y`、`n` 绑到 `confirm:yes`、`confirm:no`）；对话框里的文本框不再把输入的字母、数字或空格让给该键上的快捷键；`/model`、`/effort`、`/config`、`/status`、`/usage`、`/plugin`、`/permissions` 等大多数对话框里连按两次 Ctrl+C 或 Ctrl+D 只关闭对话框，不再退出 Claude Code。
- ⚠️ **`PermissionRequest` 事件上不再运行 agent 型 hook**（它的回答本来就无法批准或拒绝请求），改为报错并指向 command 或 http hook。
- ⚠️ 名字模仿保留 marketplace 名的插件 marketplace 在添加时被拒绝，已经添加的也会停止加载；撤回 2.1.260 起全屏模式下 `ctrl+l` / `cmd+k` 清空 transcript 视图的做法，它们重新只重绘屏幕；`/autocompact` 的页脚提示改为说明 ←/→，`/fast` 的页脚写明用空格切换。
- ⚠️ 自托管运行环境：生命周期 hook 里的 git 忽略运行环境共享 git 文件里指定的 hook 目录与程序，那里的本地路径与 `git://` 远程需要 `GIT_ALLOW_PROTOCOL`；另修复 `--configure-git` 下生命周期 hook 的提交签名失败，以及一轮恰好在 `--retire-at` 发布点结束时丢失完成信号。
- 安全：修复经符号链接路径的写入按它在工作树里的写法判定——现在提示会说明实际落在哪里，`acceptEdits`、allow 规则与 auto mode 不再批准落在外面的写入；`/ultrareview` 上传时，重命名过的关键文件副本（如 `id_rsa copy`、`kubeconfig (1).yaml`）同样留在本机。
- auto mode：安全检查拒绝审查某个操作时，不再一遍遍重试（改为拒绝一次并说明重试无用）；安全检查没给出答复时，不再不停地连续拒绝（改为退避重试，连续十次后停下本轮并说明）。
- 修复会话每轮都报「role 'system' must precede an 'assistant' message」API 错误；修复代理或网关不支持 advisor 时，开着 advisor 的会话每轮都以 API Error 400「Input tag 'advisor_20260301'」失败（现在去掉它重试）；修复保存的历史里有格式错误的「MCP 工具无法加载」通知时，每轮与 `/compact` 都失败；修复恢复带格式错误系统消息、或缺文件列表的记忆保存通知的会话时崩溃；修复长时间运行的全屏会话以「unrecoverable interface error」退出的一个原因（损坏的消息列表缓存现在会重建）。
- 后台任务：恢复带未完成后台 agent、shell 或工作流的会话时，不再没等你输入就自己开始一轮；无头与 SDK 会话里发给正在收尾的后台 subagent 的消息不再静默丢失；启动 subagent 的对话在读取报告前被压缩时，已完成 subagent 的报告不再丢失；LSP 插件启用时，后台 subagent 可以用 LSP 工具；后台 shell 任务的良性非零退出（如 grep 没有匹配）不再被报告成失败；后台 subagent 运行时按两次 Ctrl+C 即可退出（此前要三四次）。
- prompt 缓存：恢复的 fork subagent 改为重发它最初用的工具列表，而不是重建一份导致缓存失效；Claude 工作时从宿主应用（Claude Desktop、VS Code、SDK）切换模型，不再让下一条提示词的 prompt 缓存未命中；`/cost` 的缓存未命中原因会点名思考模式与思考显示方式的变化。另修复 subagent 交还消息在非 verbose 模式下展开时露出内部的来源说明前言。
- 修复模型把参数写成 `path`、`file_text`、`file_content` 或多带一个 `description`（而不是 `file_path` 与 `content`）时 Write 调用校验失败；修复设置文件、或编辑后重读的文件在读取中途被换成命名管道时 Claude Code 挂起；修复已迁到 `settings.json` 的偏好在 `~/.claude.json` 里仍是 `null` 或 `"false"` 时 `/config` 崩溃、部分开关被误读；修复 `claude --bg` 会话在传入的环境变量含 NUL 字符时无法运行 git、hook、插件等辅助程序。
- 插件与技能：从跟踪分支或 tag 的 GitHub 仓库或 git URL 更新插件后，`installed_plugins.json` 不再保留安装时的提交；`~/.claude/skills/` 里的 `manifest.json` 列出技能名时，这些技能不再被挪进 `~/.claude/skills/.trash/`；后台 marketplace 自动更新遵守 git 凭证 helper，私有仓库的 marketplace 不再每次重新克隆或永远不更新；官方 marketplace 的快照文件是链接或过大时，`claude plugin update` 不再清掉插件记录的提交、把版本变成「unknown」；`claude mcp remove` 后以同名重新添加的 MCP 服务器会直接重连，不再显示需要认证。
- Artifact：组织策略加载不了（如在网页代理之后）时 Artifact 工具不再悄悄消失，Claude 会说明是什么挡住了它；重新发布时漏发数据库访问规则或 viewer profile 范围的，不再静默重置，而是被拒绝；Claude 读不了收到的 artifact 链接时会先告诉你再继续；artifact 页面去掉打印按钮、确认对话框与查看者会屏蔽的设备功能，邮箱与电话显示为文本，暗色模式覆盖到表单控件与滚动条。
- 输入与语音：Windows 终端里按 Enter 移除不可见字符后，提示词行不再保持错乱（屏幕会重绘，让你审阅的正是将要发送的文本）；不可见字符清理不再移除波斯语、阿拉伯语用来把后缀接到拉丁词或数字上的零宽非连接符；语音听写按 Ctrl+C 会停止录音，处理转写时按 Esc 能取消；发出去的提示词回到输入框时（如按 Esc 编辑、rewind 回来）不再丢掉 IDE 选区；用 Ctrl+S 暂存的 `!` shell 模式提示词恢复后仍是 shell 模式；只是把终端窗口带到前台的那次点击，不再同时触发指针下的项目。
- 其它：`/ultrareview` 不再把停止的云端评审报告成已完成或可重试的错误，会话被删或登录账号变了也不再干等到超时；临时目录已满、不可写或属于别的用户时，`claude agents` 显示错误，而不是空白无响应的界面；Windows 上后台清理不再删掉用来搬迁 `~/.claude/session-env`、`image-cache` 等目录的目录符号链接或 junction；云端与自托管运行环境会话在长时间过载、访问 token 期间被轮换后，不再以「Authentication failed」失败。
- 改进：`/permissions` 查看、添加或删除规则后焦点回到规则列表，删除规则与移除目录的确认默认选 No，规则列表里按 ←/→ 或 Tab 直接切换标签页；没标语言的代码块改为按行内代码着色，命令更醒目；工具还在运行时问 `/btw`，旁支问题知道这次调用正在进行，不再当成失败；UserPromptSubmit hook 超时的提示与调试日志会点名是哪条 hook 命令；`@` 文件建议里文件名包含查询词的，排在只有目录名匹配的前面；`/artifacts` 与 `/workflows` 的长列表右边缘显示滚动条；跨会话消息的启动告警说明 `--debug-file` 会把调试日志写到你指定的路径。

**v2.1.278**

- ⚠️ **auto mode 默认改用服务端分类器**：Claude API 与 Enterprise 用户，以及 Bedrock、Vertex、Foundry 与网关上，auto mode 默认由服务端分类器审查，分类器的开销不再收费（取代 2.1.273 在 Bedrock、Vertex、Foundry 上暂时默认本地分类器的做法；这些平台与网关上可用 `CLAUDE_CODE_AUTO_MODE_SERVER=0` 退出）；回落到计费的本地分类器请求时会给出提示，说明见官方 [Auto mode classifier request charges](https://code.claude.com/docs/en/auto-mode-classifier-billing)。
- 🆕 `/status` 新增「Auto mode server」一行，显示本会话的 auto mode 分类器是否跑在服务端。

## v2.1.270 → v2.1.277（速览）

这一段是手册上一版覆盖的最后一批版本，只保留影响较大的变化：

- **v2.1.277** —— 🆕 项目里没有 `CLAUDE.md` 时改读 `AGENTS.md`（`/config` 的「Project instructions」可改）、`CLAUDE_GATEWAY_PROXY_IS_EGRESS_BOUNDARY`；⚠️ 移除 TaskOutput 工具，`taskOutputMaxChars` 与 `TASK_MAX_OUTPUT_LENGTH` 随之失效；subagent 的结果放在标明「subagent 输出」的标头下交给主 agent；提示词里不可见的 Unicode 格式字符与标签字符会被移除；`sandbox.excludedCommands` 要求复合命令的每一段都匹配才豁免。
- **v2.1.276** —— 修复 2.1.275 引入的回归：`ANTHROPIC_BASE_URL` 指向代理或网关时，每个请求都报 `Input tag 'advisor_20260301'` 的 400。
- **v2.1.275** —— 🆕 立即发送键 `ctrl+enter`（或 `ctrl+x ctrl+s`）、同步 claude.ai 账号上的技能与插件（`syncClaudeAiSkills` / `syncClaudeAiPlugins` 可退出）、`/plugin install <plugin> --marketplace <source>`；⚠️ npm 来源的插件改用 `npm pack --ignore-scripts` 拉取，不再运行安装脚本；`--system-prompt` 里 `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__` 一行之上的文本全局缓存。
- **v2.1.274** —— 🆕 `CLAUDE_CODE_MCP_STARTUP_WAIT_MS`、`OTEL_LOG_MANAGED_SETTINGS`、内存临界告警；⚠️ `/code-review` 对没有专属调优的模型改用精简的内联评审；Bedrock、Vertex、Foundry 与关闭遥测的安装也默认用 v2 MCP 客户端与 2026-07-28 协议协商；`"type": "sdk"` 的 MCP 条目被跳过；插件与 marketplace 克隆不再下载 Git LFS 文件。
- **v2.1.273** —— 🆕 给 LLM 网关的提示请求头（`CLAUDE_CODE_GATEWAY_HINT_HEADERS=1`）、从 Claude App fork Remote Control 会话；⚠️ Bedrock、Vertex、Foundry 上的 auto mode 暂时默认用本地分类器（2.1.278 起又改为默认服务端）；撤回 2.1.268 把 Read / Edit deny 规则套到无法分析的 Bash 命令上的改动。
- **v2.1.271** —— 🆕 Remote 会话支持 fast mode、agent frontmatter 的 `omitClaudeMd`、沙箱 auto mode 下按命令放行的 `allowed_domains`、`claude plugin install` / `update` 的 `--accept-command <sha256>`；⚠️ Monitor 监视一律带时限（取代 `persistent`）；「中等」动态工作流规模降到 10 个 agent、Pro 套餐默认「小」，撞到用量上限改为暂停；auto mode 下 subagent 改用交还调用回报。
- **v2.1.270** —— 修复 2.1.269 引入的回归：会话运行一段时间后，Bash 里的只读 git 命令意外要求权限。

## v2.1.224 → v2.1.269（速览）

更早一批版本，只保留影响较大的变化：

- **v2.1.269** —— 🆕 `claude plugin eval` 插件评测、`/output-style [name]`、`bashEditDiffEnabled` 设置、`CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS`；⚠️ `!` 开头的 deny/ask 规则只在写它的 settings 来源内生效；云端会话里同步的技能改名为 `anthropic-skills:<name>`；`/ultrareview --post` 直接发 PR 评论。
- **v2.1.268** —— ⚠️ 任务追踪工具只在 Claude 3.x、Opus 4.0–4.7、Sonnet 4.0–4.6、Haiku 4.5 上提供（`CLAUDE_CODE_ENABLE_TODO_TOOLS=1` 找回）；`/plugin` 里的安装、启用、禁用在关闭菜单时即生效；普通的 `WebFetch` 规则不再管 Artifact 工具；🆕 `CLAUDE_CODE_WEBFETCH_DEADLINE_MS`，`claude plugin` 各子命令支持 `--json`。
- **v2.1.267** —— 🆕 `maxEffortLevel` 设置、`--system-prompt-snapshot off`；一大批 prompt 缓存稳定性修复。
- **v2.1.265** —— 🆕 `--plugin-dir` 可指向装了多个插件的文件夹；⚠️ 非交互会话里的 `cd` 跨轮保留。
- **v2.1.261** —— 🆕 `/skill-doctor`、`bashOutputMaxChars` / `taskOutputMaxChars`（后者 2.1.277 起失效）、`--append-subagent-system-prompt-file`；⚠️ 输入框的删词按键改为与 Bash 一致，`keybindingFlavor` 不再生效。
- **v2.1.260** —— 🆕 全屏 diff 面板（`/diff` 切换）、`/cost` 给出 prompt 缓存未命中的可能原因；⚠️ 撤回 2.1.259 把 `Read()` deny 规则套到 Bash 参数上的改动；`!` bash 模式里的命令在沙箱外运行。
- **v2.1.259** —— 🆕 `managedMcpServers` 托管设置、`--permission-prompts none`；⚠️ `allowedMcpServers` 只管用户自己添加的服务器；托管设置无法解析时拒绝启动。
- **v2.1.257** —— 🆕 **Fable 5.1** 发布，`timeFormat` / `timeZone`、`CLAUDE_CODE_SUBAGENT_MODEL_FORCE`；⚠️ 项目级设置里的 `defaultMode: "bypassPermissions"` 被忽略；`--add-dir` 拒绝网络路径。
- **v2.1.251** —— 🆕 `PreModelSwitch` / `PostModelSwitch` hook 事件；⚠️ `CLAUDE_CODE_SUBAGENT_MODEL` 改为默认值而非强制覆盖；`/effort` 按模型分别保存；项目级 `env` 不能再设 `CLAUDE_CONFIG_DIR` 等目录变量。
- **v2.1.248** —— 🆕 `--restricted` 受限模式、agent frontmatter 的 `experimental.cacheTtl`；⚠️ Workflow 工具描述瘦身，写脚本的参考资料移进 `workflow-authoring` 技能。
- **v2.1.247** —— 🆕 `SendFeedback` 工具、`/claude-api cost-optimize`；⚠️ Sonnet 5 的默认自动压缩窗口改为完整 1M。
- **v2.1.246** —— 🆕 `/permissions` 的 Auto mode 标签页；⚠️ `/cd` 后新目录的项目设置、hooks、技能与 agent 立即生效；subagent 撞到 `maxTurns` 时返回「部分完成」的输出。
- **v2.1.243** —— 🆕 `modelPicker`、`promptCacheTtl` / `subagentPromptCacheTtl`、`modelPricing` 托管设置；下载包改用 zstd 压缩（Linux x64 约 75 MB）。
- **v2.1.239** —— 🆕 跨会话消息支持 Windows、`/claude-api upgrade`；⚠️ 成本估算计入数据驻留工作区的 1.1× 溢价。
- **v2.1.238** —— 🆕 插件 marketplace 的 `headersHelper`；⚠️ 项目 `.mcp.json` 里的 `headersHelper` 与 agent 文件里的内联 MCP 服务器要求目录已通过信任确认。
- **v2.1.237** —— 🆕 内置「Concise」输出风格。
- **v2.1.236** —— 🆕 `ANTHROPIC_DEFAULT_MODEL`、跨会话 `SendMessage` 的 `notify_when_idle`；⚠️ 拼错的斜杠命令直接报错，不再跑模糊匹配。
- **v2.1.235** —— 🆕 `spellcheck` 设置。
- **v2.1.234** —— 🆕 用量上限重置后自动继续会话、`/goal` 主动检查后台工作的进度；⚠️ 从 `/config` 移除「Default teammate model」。
- **v2.1.233** —— ⚠️ 任务追踪工具在新模型上不再提供；🆕 `CLAUDE_CODE_TOOL_MEMORY_LIMIT`、`CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS`。
- **v2.1.232** —— ⚠️ **fork subagent 默认开启**；🆕 输入框里 `@` 点名其它会话、`additionalMarketplaces` / `allowedMarketplaces` 别名。
- **v2.1.229** —— 🆕 marketplace 的 `command` 来源、`claude remote-control --continue`。
- **v2.1.228** —— ⚠️ Write 工具在新模型上可以覆写本会话还没读过的已有文件。
- **v2.1.225** —— 🆕 `SendMessage` 可以按名字主动联系你其它机器上的 Remote Control 会话。
- **v2.1.224** —— 🆕 **自托管运行环境**（`claude self-hosted-runner`）、**跨会话 `SendMessage`**、`archive` 插件来源；⚠️ 取消单会话 200 个 subagent 的派生总数上限。

## v2.1.213 → v2.1.223（速览）

- **v2.1.223** —— ⚠️ `/review` 成为 `/code-review` 的别名；`/code-review` 不带强度时沿用上次的强度；`CLAUDE_CODE_DISABLE_1M_CONTEXT` 扩大到所有原生 1M 窗口的模型；🆕 marketplace 管控支持 `"owner/*"` 通配。
- **v2.1.222** —— ⚠️ 移除 `/ultraplan`；Remote Control 自动启动不能再由仓库级设置开启。
- **v2.1.221** —— ⚠️ `/fork` 新建独立 worktree；后台会话默认提交并推送以保住工作；`/plugin` 装的插件立即生效；🆕 沙箱凭证 `mode: "mask"`。
- **v2.1.219** —— 🆕 **Opus 5** 发布；⚠️ subagent 嵌套默认深度 3；动态工作流默认「中等规模」（少于 15 个 agent）；🆕 `workflowSizeGuideline`、`sandbox.network.strictAllowlist`、`DirectoryAdded` hook。
- **v2.1.218** —— ⚠️ `/code-review` 改为后台 subagent 运行；`context: fork` 技能默认后台；`/deep-research` 只在手动调用时启动；agent 文件名不许含 `:`。
- **v2.1.217** —— ⚠️ 并发 subagent 上限 20；`--max-budget-usd` 能拦住后台 subagent；🆕 表情 shortcode 自动补全。
- **v2.1.216** —— 🆕 `sandbox.filesystem.disabled`；长会话消息规范化开销不再随轮数二次方增长。
- **v2.1.215** —— ⚠️ Claude 不再自行调用 `/verify` 与 `/code-review`。
- **v2.1.214** —— ⚠️ hook `if:` 条件里单段 `dir/**` 只匹配 `<cwd>/dir`；`docker` 守护进程重定向标志需确认；🆕 `EndConversation` 工具。
- **v2.1.213** —— 🆕 `allowShortlineEdits` 设置。

## v2.1.205 → v2.1.212（速览）

- **v2.1.212** —— ⚠️ `/fork` 语义变更：复制成独立后台会话，原来的「会话内派生 subagent」改用新命令 `/subtask`；🆕 会话级上限：`WebSearch` 默认封顶 200 次、subagent 派生默认封顶 200 个；⚠️ Task 工具的 `mode` 参数弃用，subagent 直接继承父会话权限；安全修复：计划模式不再未经确认执行会改文件的 Bash 命令。
- **v2.1.211** —— 🆕 `--forward-subagent-text` 标志与同名环境变量；「always allow」规则改存到仓库根，git worktree 之间也持久生效。
- **v2.1.210** —— 🆕 Agent 工具加固，抵御经由 subagent 内容的**间接提示注入**；`ultracode` 关键词不再被 webhook / 转发的 PR 评论误触发。
- **v2.1.208** —— 🆕 屏幕阅读器模式（纯文本渲染）；🆕 `vimInsertModeRemaps` 设置（把 `jj` 映射成 Escape）与 `CLAUDE_CODE_PROCESS_WRAPPER`；安全：带子 shell 的毁灭性删除命令即使在 `--dangerously-skip-permissions` 下也弹确认。
- **v2.1.207** —— 🆕 auto mode 在 Bedrock / Vertex / Foundry 上免 opt-in 可用；⚠️ 这些平台上 Claude Platform 默认模型改为 Opus 4.8。
- **v2.1.206** —— 🆕 `/commit-push-pr` 对配置好的 push remote 自动放行 `git push`；`EnterWorktree` 进入 `.claude/worktrees/` 以外的 worktree 前先确认。
- **v2.1.205** —— 🆕 auto mode 新增规则：阻止篡改会话 transcript；`--json-schema` 遇到非法 schema 改为报错。

## v2.1.190 → v2.1.204（速览）

- **v2.1.203** —— 登录即将过期时提前预警；`/mcp` 的 `roots/list` 带上本次会话新增的工作目录。
- **v2.1.200** —— ⚠️ `AskUserQuestion` 对话框默认不再自动继续；默认权限模式展示名从 “default” 改为 “Manual”。
- **v2.1.199** —— 堆叠式技能调用最多一次加载 5 个前置技能；`CLAUDE_CODE_RETRY_WATCHDOG` 把瞬时错误默认重试提到 300 次。
- **v2.1.198** —— **subagent 默认后台化**；**Claude in Chrome 正式 GA**；新增 `/dataviz` 技能；`/run`、`/verify`、`/run-skill-generator` 三件套上线。
- **v2.1.197** —— **Sonnet 5 发布**，成为默认模型。
- **v2.1.196** —— 支持组织级默认模型；`.mcp.json` 里仓库自行批准的 MCP 服务器不再被 `claude mcp list`/`get` 静默启动。
- **v2.1.193** —— 新增 `autoMode.classifyAllShell`、OTel `assistant_response` 日志事件、bash 模式实时路径补全。
- **v2.1.187** —— 新增 `sandbox.credentials` 设置；远程 MCP 工具调用新增空闲超时 `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`。
- **v2.1.186** —— `claude mcp login/logout <server>` 支持单独对某个 MCP 服务器走 OAuth。

## 更早的重要节点

- **2.0.0**：全新原生 VS Code 插件；引入 `/rewind` 检查点回滚。
- **1.0.81 前后**：推出输出风格（output styles），含内置的 “Explanatory”、“Learning” 教学向风格（该功能后续经历过一次弃用又恢复的反复，最终保留）。
- **0.2.x 系列**：项目早期阶段，OTel 支持初具雏形，`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` 等隐私类开关陆续加入。

::: info

Claude Code 的发布节奏很快（经常一天多个补丁版本），`autoUpdatesChannel` 设为 `stable` 可以避免第一时间踩到重大回归——细节见[安装与升级 · 配置发布渠道](/manual/agent/claude-code/installation)。

:::
