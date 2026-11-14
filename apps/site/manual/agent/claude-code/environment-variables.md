---
title: "环境变量"
description: "按用途分类的环境变量速查（认证、模型、网络、隐私、Bash 行为等）"
source: "https://daiw.org/manual/claude-code/environment-variables"
---

# 环境变量

> 按用途分类的环境变量速查（认证、模型、网络、隐私、Bash 行为等）

Claude Code 的绝大多数运行时行为都能用环境变量控制，且效果等价于在 `settings.json` 的 `env` 字段里写同名键值——写进 `settings.json` 的好处是不用改 shell 配置、且能提交到仓库让团队共享。

```json [settings.json]
{
  "env": {
    "API_TIMEOUT_MS": "1200000",
    "DISABLE_AUTOUPDATER": "1"
  }
}
```

**优先级**：同一个行为如果既有环境变量又有 settings 字段，环境变量优先（例如 `ANTHROPIC_MODEL` 优先于 `model` 设置）。环境变量与 CLI 参数、`/` 命令的优先级则因功能而异，例如 `--model`/`/model` 优先于 `ANTHROPIC_MODEL`，而 `CLAUDE_CODE_EFFORT_LEVEL` 优先于 `/effort`。环境变量在**启动时**读取一次，运行中修改需要重启 `claude` 才生效。

⚠️ 写进 `env` 并不总是等价：项目级的 `.claude/settings.json` 与 `.claude/settings.local.json` 不能设置 `CLAUDE_CONFIG_DIR` 等目录变量（v2.1.251 起），也不能开启 OpenTelemetry 导出、设置导出端点或采集内容（v2.1.282 起，见下文 OpenTelemetry 一节）；少数安全相关的变量（如下文的 `CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT`）只认启动 Claude Code 时的环境，写在任何 settings 的 `env` 里都无效。

下面按用途分类列出常用变量；完整的长尾列表（约 250 个）见官方 [Environment variables](https://code.claude.com/docs/en/env-vars) 文档。

## 认证与 API 路由

| 变量 | 说明 |
| --- | --- |
| `ANTHROPIC_API_KEY` | 直接用 API Key 鉴权，优先于已登录的订阅账号。非交互模式（`-p`）下始终生效；交互模式下首次使用会提示确认。`unset ANTHROPIC_API_KEY` 可临时切回订阅账号 |
| `ANTHROPIC_AUTH_TOKEN` | 自定义 `Authorization` 头的值（会自动加 `Bearer ` 前缀） |
| `ANTHROPIC_BASE_URL` | 把请求路由到自建代理/网关，而非 `api.anthropic.com` |
| `ANTHROPIC_CUSTOM_HEADERS` | 附加自定义请求头，格式 `Name: Value`，多个用换行分隔 |
| `ANTHROPIC_BETAS` | 逗号分隔的额外 `anthropic-beta` header，任何鉴权方式（含订阅）都生效 |
| `CLAUDE_CODE_USE_BEDROCK` / `CLAUDE_CODE_USE_VERTEX` / `CLAUDE_CODE_USE_FOUNDRY` / `CLAUDE_CODE_USE_ANTHROPIC_AWS` | 切换到 Amazon Bedrock / Google Cloud's Agent Platform / Microsoft Foundry / Claude Platform on AWS |
| `CLAUDE_CODE_AUTO_MODE_SERVER` | 🆕 **v2.1.273+**：控制 auto mode 是否交给服务端分类器审查操作，`0` 改用 Claude Code 自己的分类器请求，`1` 启用服务端审查。v2.1.273 时 Bedrock、Vertex、Foundry 上暂时默认本地分类器；⚠️ v2.1.278 起 Claude API、Enterprise 以及 Bedrock、Vertex、Foundry 与网关上改为默认服务端分类器（分类器开销不再收费），v2.1.281 起直连 Anthropic API 时也认这个变量，v2.1.282 起关闭遥测的直连会话同样默认服务端。官方说明它是临时变量，以后可能移除 |
| `CLAUDE_CODE_AUTO_MODE_MODEL` | 🆕 **v2.1.302+**：指定客户端本地 auto mode 分类器使用的模型（不影响服务端 auto mode） |
| `CLAUDE_CODE_ATTRIBUTION_HEADER` | 🆕 **v2.1.299+**：设为 `0` 移除经 Claude apps 网关（或 Claude Desktop Code 标签页 `code` 策略）运行的会话请求里的归属块 |
| `AWS_BEARER_TOKEN_BEDROCK` | Amazon Bedrock 的 API Key 鉴权 |
| `CLAUDE_CODE_OAUTH_TOKEN` | claude.ai 的 OAuth access token，适合 SDK/自动化环境，可用 `claude setup-token` 生成 |
| `CLAUDE_CODE_OAUTH_REFRESH_TOKEN` / `CLAUDE_CODE_OAUTH_SCOPES` | 用 refresh token 免浏览器完成登录，常用于容器/CI 预置认证 |
| `CLAUDE_CONFIG_DIR` | 覆盖配置目录（默认 `~/.claude`），便于多账号并存，如 `alias claude-work='CLAUDE_CONFIG_DIR=~/.claude-work claude'`。⚠️ v2.1.251 起项目级 `.claude/settings.json` 的 `env` 不能再设置它（`CLAUDE_CODE_TMPDIR`、`TMPDIR` 同理），请写在 shell、用户级或托管设置里 |
| `VERTEX_REGION_CLAUDE_*` | 一组变量，分别覆盖各代 Claude 模型在 Google Cloud's Agent Platform 上的区域（如 `VERTEX_REGION_CLAUDE_5_SONNET`)；v2.1.280 起新增 Opus 5.5 对应的 `VERTEX_REGION_CLAUDE_5_5_OPUS` |

## 模型选择与推理

| 变量 | 说明 |
| --- | --- |
| `ANTHROPIC_MODEL` | 设置使用的模型，优先于 `model` 设置，但会被 `--model`/`/model` 覆盖 |
| `ANTHROPIC_DEFAULT_MODEL` | 🆕 **v2.1.236+**：设定新会话的起始模型。与 `ANTHROPIC_MODEL` 的区别在于，`/model` 选过的模型会覆盖它并跨重启保留 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` / `_OPUS_MODEL` / `_HAIKU_MODEL` / `_FABLE_MODEL` | 分别覆盖 `/model` 里 `sonnet`/`opus`/`haiku`/`fable` 别名对应的具体模型 ID，常用于网关/自定义路由场景 |
| `CLAUDE_CODE_SUBAGENT_MODEL` | subagent 的默认模型。⚠️ v2.1.251 起它只是「默认值」：agent 定义里的 `model:` 与单次派生显式指定的模型优先于它 |
| `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` | 🆕 **v2.1.257+**：把 `CLAUDE_CODE_SUBAGENT_MODEL`（未设则主模型）强制套到所有 subagent，无视 agent 定义与单次派生里的模型 |
| `CLAUDE_CODE_SUBAGENT_EFFORT` | 🆕 **v2.1.316+**：为未显式指定推理强度的 subagent 设置默认推理强度，不再继承主会话的强度 |
| `CLAUDE_CODE_WORKFLOW_SUBAGENT_MODEL` | 🆕 **v2.1.296+**：让所有动态工作流（workflow）agent 运行在指定模型上，其它 subagent 保持各自模型 |
| `CLAUDE_CODE_EFFORT_LEVEL` | 设置推理强度（`low`/`medium`/`high`/`xhigh`/`max`/`auto`），优先于 `/effort` 与 `effortLevel` 设置 |
| `CLAUDE_CODE_DISABLE_ULTRATHINK` | 🆕 **v2.1.316+**：设为 `1` 关闭 `ultrathink` 关键词（v2.1.311 起交互终端里的 `ultrathink` 在 Opus 5.5、Sonnet 5.5、Haiku 5.5 与 Fable 5.1 上会把该轮推理强度提至 `xhigh`） |
| `CLAUDE_CODE_DISABLE_ADVISOR_TOOL` | 🆕 **v2.1.300+**：设为 `1` 关闭顾问工具（`/advisor`） |
| `MAX_THINKING_TOKENS` | 扩展思考的 token 预算上限；设为 `0` 在 Anthropic API 上禁用思考（Fable 模型与 v2.1.280 起的 Opus 5.5 除外，它们无法关闭思考） |
| `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` | 禁用 Opus 4.6 / Sonnet 4.6 的自适应推理，回退到固定思考预算（对 Fable 5、Sonnet 5、Opus 4.7+ 无效） |
| `CLAUDE_CODE_DISABLE_WEB_FETCH` | 🆕 **v2.1.285+**：设为 `1` 禁用内置 WebFetch 工具 |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | 单次请求的最大输出 token 数 |
| `CLAUDE_CODE_MAX_CONTEXT_TOKENS` | 覆盖 Claude Code 假定的上下文窗口大小，用于自定义模型路由场景 |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` / `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | 自定义自动压缩触发的上下文容量阈值及百分比（⚠️ v2.1.304 起 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 支持 `k` 与 `M` 后缀，如 `200k`，超出范围时告警） |
| `CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS` | 🆕 **v2.1.299+**：调整空闲自动压缩（Idle compaction，对话闲置约 54 分钟后在 1 小时缓存过期前自动压缩）触发的最小 token 阈值，默认 200K；要关闭空闲自动压缩请在 `settings.json` 设 `"idleCompaction": false` 或在 `/config` 切换 |
| `DISABLE_AUTO_COMPACT` | 禁用自动压缩，保留手动 `/compact` |
| `DISABLE_COMPACT` | 连手动 `/compact` 一起禁用（⚠️ v2.1.311 起写在 settings 文件或 Mod `$.env.set` 里只能关闭压缩，不能重新开启） |
| `CLAUDE_CODE_MODEL_CATALOG` | 🆕 **v2.1.311+**：设为 `off` 关闭 Bedrock、Mantle、Vertex 与 Foundry 从 `downloads.claude.ai` 加载签名模型目录配置 |
| `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT` | 🆕 **v2.1.312+**：Bedrock、Vertex、Foundry 与 Mantle 对未识别的模型名（如自定义部署名、推理配置 ARN）默认改用精简系统提示词；设为 `0` 保留完整系统提示词 |
| `CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK` | 🆕 **v2.1.312+**：设为 `1` 关闭消息被安全标记后的自动模型切换（v2.1.312 起该切换也覆盖未识别的模型名） |
| `CLAUDE_CODE_DISABLE_1M_CONTEXT` | 禁用 1M 上下文窗口支持，常用于有合规要求的企业环境。⚠️ v2.1.223 起适用范围从一份固定模型名单扩大到**所有原生 1M 窗口的 Claude 模型**，统一靠自动压缩压到 200K；压不住时启动会告警 |
| `CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT` | 设为 `1` 恢复旧行为：不再把**未识别的模型 ID** 约束在假定的上下文窗口内（v2.1.223 起默认约束） |

## 网络、代理与超时

| 变量 | 说明 |
| --- | --- |
| `API_TIMEOUT_MS` | 单次 API 请求超时（默认 600000ms，即 10 分钟） |
| `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` | 标准代理配置，`NO_PROXY` 支持逗号分隔的域名/IP 白名单 |
| `CLAUDE_CODE_CERT_STORE` | TLS 信任的 CA 证书来源，`bundled`（内置 Mozilla CA 集）和/或 `system`，默认两者都用 |
| `CLAUDE_CODE_CLIENT_CERT` / `CLAUDE_CODE_CLIENT_KEY` / `CLAUDE_CODE_CLIENT_KEY_PASSPHRASE` | mTLS 客户端证书鉴权 |
| `CLAUDE_ENABLE_STREAM_WATCHDOG` / `CLAUDE_STREAM_IDLE_TIMEOUT_MS` | 流式响应的空闲看门狗开关与超时时间，防止连接静默卡死 |
| `CLAUDE_CODE_PROXY_RESOLVES_HOSTS` | 允许代理而非本机做 DNS 解析 |
| `CLAUDE_CODE_GATEWAY_HINT_HEADERS` | 🆕 **v2.1.273+**：设为 `1` 后，发往 LLM 网关的请求附带 `x-claude-code-request-class`、`x-claude-code-agent-type`、`x-claude-code-prev-tool-durations`、`x-claude-code-compaction`、`x-claude-code-context-compacted` 等提示请求头；🆕 v2.1.283 起再加上 `x-claude-code-prompt-id`（同一条用户提示词触发的请求共用一个随机 UUID，含它派生的 subagent 轮次），网关可以据此按提示词分组 |
| `CLAUDE_GATEWAY_PROXY_IS_EGRESS_BOUNDARY` | 🆕 **v2.1.277+**：给唯一出口是正向代理的 Claude apps 网关用，设为 `1` 后每个出站请求都把主机名交给代理，不在本地解析 |
| `CLAUDE_GATEWAY_DRAIN_TIMEOUT_MS` | 🆕 **v2.1.274+**：Claude apps 网关收到 SIGTERM 后，让进行中的请求最多再跑多久才退出（更新日志的说法是“最多 25 秒”），不再一下切断所有流 |
| `CLAUDE_CODE_WEBFETCH_DEADLINE_MS` | 🆕 **v2.1.268+**：WebFetch 单次抓取的总时限（默认 300 秒，防止被一直不结束响应的服务器挂住）；设 `0` 关闭 |
| `CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS` | 🆕 **v2.1.233+**：WebFetch 会话内 URL 缓存的有效期（默认 15 分钟） |
| `CLAUDE_CODE_OVERLOADED_RETRY_BASE_DELAY_MS` / `CLAUDE_CODE_OVERLOADED_RETRY_MAX_DELAY_MS` | 🆕 **v2.1.292+ / v2.1.296+**：重试 529 过载请求时退避算法的基础延迟与最大延迟 |
| `CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS` / `_MAX_USAGE_LIMIT_WAIT_MS` / `_USAGE_LIMIT_RECHECK_MS` | 🆕 **v2.1.295+ / v2.1.301+ / v2.1.305+**：在无人值守重试模式（`CLAUDE_CODE_RETRY_WATCHDOG`）下，分别限制等待 429/529 的最长时间、额度重置时间过远时直接结束请求的最大等待时长，以及定期重查提前解除的用量上限的间隔 |
| `CLAUDE_CODE_GZIP_REQUEST_BODIES` | 🆕 **v2.1.300+**：发往 `api.anthropic.com` 的大请求即使关闭遥测也默认启用 gzip 压缩；设为 `0` 关闭 |
| `CLAUDE_CODE_DISABLE_LOOPED_CROSS_CERT_DROP` | 🆕 **v2.1.316+**：保留系统证书库里互相交叉签名成环的证书（供私有 CA 依赖此类证书的服务器使用） |

## Bash 工具行为

| 变量 | 说明 |
| --- | --- |
| `BASH_DEFAULT_TIMEOUT_MS` | 长时间运行命令的默认超时（默认 120000ms） |
| `BASH_MAX_TIMEOUT_MS` | 模型可为单条命令设置的超时上限（默认 600000ms） |
| `BASH_MAX_OUTPUT_LENGTH` | 输出超过该字符数时落盘保存，Claude 只拿到文件路径 + 预览（v2.1.261 起也可用 `bashOutputMaxChars` 设置调高，最高 128K 字符） |
| `CLAUDE_CODE_SHELL` | 指定 Bash 工具使用的 shell 路径（仅支持 `bash`/`zsh`) |
| `CLAUDE_CODE_SHELL_PREFIX` | 给所有 Claude Code 派生的 shell 命令套一层前缀命令，常用于审计/日志 |
| `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR` | 每条 Bash/PowerShell 命令执行后都恢复到最初的工作目录 |
| `CLAUDE_CODE_USE_POWERSHELL_TOOL` | Windows/Linux/macOS 上启用 PowerShell 工具（需要 `pwsh` 在 PATH 上） |
| `CLAUDE_CODE_GIT_BASH_PATH` | Windows 下手动指定 Git Bash 路径 |
| `CLAUDE_CODE_TOOL_MEMORY_LIMIT` | 🆕 **v2.1.233+**（Linux）：用内存 cgroup 限制 Bash 工具命令，防止失控的构建拖垮整个会话 |
| `CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT` | 🆕 **v2.1.281+**：v2.1.281 起 auto mode 与 `--dangerously-skip-permissions` 下，危险删除（关键路径上的 `rm` 等）的确认最多等 2 分钟，无人回答就拒绝并附上改写提示；设为 `1` 取消这个时限（auto mode 改交分类器裁决，bypass 模式则一直等你回答）。只认启动 Claude Code 时的环境，写在 settings 的 `env` 里无效 |
| `CLAUDE_CODE_DISABLE_SUBSTITUTION_RM_PROMPT` | 🆕 **v2.1.281+**：v2.1.281 起目标完全来自命令替换的递归 `rm`（如 `rm -rf "$(pwd)"`）即使有 Bash allow 规则也会询问；设为 `1` 关闭这项检查（其它关键路径检查照常）。同样只认启动环境 |
| `CLAUDE_CODE_DISABLE_POWERSHELL_CMD_RM_DENY` | 🆕 **v2.1.283+**（Windows）：v2.1.283 起 PowerShell 工具拒绝经 `cmd` 用 `rd`、`rmdir`、`del`、`erase` 删除驱动器根目录、主目录等系统路径；设为 `1` 关闭这项检查。同样只认启动环境（这个变量见于官方文档，更新日志只记了这项修复） |
| `CLAUDE_CODE_STRICT_INLINE_SHELL_RM_PROMPT` | 🆕 **v2.1.299+**：v2.1.299 起不再对不含 `rm` 的 `sh -c` 脚本误弹确认；若脚本在运行时动态拼出 Claude Code 静态读不到的 `rm`，设为 `1` 仍强制弹出确认 |

## 更新、遥测与隐私

| 变量 | 说明 |
| --- | --- |
| `DISABLE_AUTOUPDATER` | 关闭后台自动更新检查，`claude update` 仍可手动更新 |
| `DISABLE_UPDATES` | 连手动更新一起彻底禁止，适合自建分发渠道 |
| `CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE` | 让 Homebrew/WinGet 安装也能在后台自动跑升级命令 |
| `DISABLE_TELEMETRY` / `DO_NOT_TRACK` | 退出遥测收集（不含代码、文件路径、bash 命令等用户数据），两者等价。⚠️ 关闭遥测的会话不拉取 feature flag，一些默认值随之不同：v2.1.282 起直连 Anthropic API 时 auto mode 默认用服务端分类器，v2.1.283 起没配置权限模式的交互式会话以 auto mode 起步；v2.1.283 修复了关闭遥测时付费套餐用不了 Remote Control |
| `DISABLE_ERROR_REPORTING` | 退出 Sentry 错误上报 |
| `DISABLE_GROWTHBOOK` | 禁用 feature flag 拉取，统一使用代码内置默认值 |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | 一次性等价于同时设置 `DISABLE_AUTOUPDATER` + `DISABLE_FEEDBACK_COMMAND` + `DISABLE_ERROR_REPORTING` + `DISABLE_TELEMETRY`，适合内网/隔离环境 |
| `DISABLE_COST_WARNINGS` | 关闭费用提醒 |
| `DISABLE_INSTALLATION_CHECKS` | 关闭安装方式警告（仅在你手动管理安装路径时使用） |
| `IS_DEMO` | 演示模式：隐藏邮箱/组织名，跳过 onboarding，适合直播/录屏 |

## 会话、上下文与运行时

| 变量 | 说明 |
| --- | --- |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | 禁用/强制开启自动记忆（`1` 禁用，`0` 强制开启） |
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS` | 不加载任何 CLAUDE.md 记忆文件 |
| `CLAUDE_CODE_MAX_TURNS` | 未显式传 `--max-turns` 时的默认轮数上限 |
| `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | 只读工具与 subagent 的最大并行数（默认 10） |
| `CLAUDE_CODE_ENABLE_TASKS` | 控制是否使用结构化 Task 工具而非旧版 `TodoWrite`（2.1.142 起默认开启） |
| `CLAUDE_CODE_ENABLE_TODO_TOOLS` | ⚠️ v2.1.268 起任务追踪工具（Task 系列与 `TodoWrite`）只在 Claude 3.x、Opus 4.0–4.7、Sonnet 4.0–4.6、Haiku 4.5 上提供；设为 `1` 在其它（更新的）模型上找回 |
| `CLAUDE_CODE_RESTRICTED` | 🆕 **v2.1.248+**：等价于 `--restricted`，移除能执行命令或代码的内置工具与 `WebFetch`，文件工具限定在工作目录内，拒绝 `bypassPermissions`，并忽略用户、项目、本机 settings 文件 |
| `CLAUDE_CODE_GOAL_CHECKIN_MINUTES` | v2.1.234+：`/goal` 被后台任务卡住等待时，多久主动检查一次进度（默认 30 分钟，之后退避）；设 `0` 关闭 |
| `CLAUDE_CODE_SKIP_PROMPT_HISTORY` | 不写会话记录到磁盘，无法被 `--resume`/`--continue` 找到，适合一次性脚本化会话 |
| `CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING` | 禁用文件检查点，`/rewind` 将无法回滚代码改动 |
| `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` | 从系统提示词里移除内置的 commit/PR 工作流指引 |
| `CLAUDECODE` | Claude Code 派生的子进程里会被设为 `1`，用于脚本判断“我是不是被 Claude Code 调用的” |
| `CLAUDE_CODE_CHILD_SESSION` | 类似 `CLAUDECODE`，但只有 Claude Code 自己派生子进程时才设置，可用来区分嵌套会话 |
| `CLAUDE_CODE_SESSION_ID` | 子进程/hook 里的当前会话 ID，用于日志关联 |
| `CLAUDE_CODE_RESUME_INTERRUPTED_TURN` | 是否在恢复会话时自动重跑被中断的那一轮；设为 `0` 关闭（v2.1.221 起假值才被正确识别） |
| `CLAUDE_CODE_SIMPLE` | 精简系统提示词 + 仅 Bash/文件读写工具，等价于 `--bare` |
| `CLAUDE_ENV_FILE` | 一个 shell 脚本路径，每条 Bash 命令执行前会先 source 它，用于跨命令保持 virtualenv/conda 的激活状态 |
| `CLAUDE_CODE_DISABLE_FILE_MENTIONS` | 🆕 **v2.1.299+**：设为 `1` 后，`@` 文件引用只把文件路径传给 Claude 由文件工具按需读取，不再直接内联文件内容 |
| `CLAUDE_CODE_DISABLE_ULTRAREVIEW_TRUST_CHECK` | 🆕 **v2.1.309+**：设为 `1` 跳过 `claude ultrareview` 运行前的目录信任确认（等价于传 `--trust-workspace`） |
| `CLAUDE_CODE_DISABLE_NESTED_SESSION_ID` | 🆕 **v2.1.317+**：在自托管运行环境上设为 `1`，让会话内运行的 `claude -p` 沿用外层会话 ID 与 transcript（v2.1.317 起默认改为独立 ID 以免串台） |

## 后台任务与并行

| 变量 | 说明 |
| --- | --- |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | 禁用全部后台任务能力（`run_in_background`、自动转后台、`Ctrl+B`) |
| `CLAUDE_AUTO_BACKGROUND_TASKS` | 强制开启长任务自动转后台（约运行 2 分钟后） |
| `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` | 同时在跑的 subagent 数量上限（默认 20，v2.1.217 引入），防止一条消息无限扇出后台 agent |
| `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` | subagent 嵌套派生的深度上限（v2.1.219 起默认 3；设为 `1` 即关闭嵌套） |
| `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS` | 🆕 **v2.1.269+**：Workflow 工具单次运行的并发 agent 上限（1–256），推理密集的大扇出可调高 |
| `CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS` | 后台 subagent 的停滞超时（默认 10 分钟无进展则判定失败） |
| `TASK_MAX_OUTPUT_LENGTH` | subagent 输出截断前的最大字符数（默认 32000）。⚠️ v2.1.277 起 TaskOutput 工具被移除（Claude 改用 Read 读取后台任务的输出文件），该变量不再有任何作用 |
| `CLAUDE_CODE_DISABLE_AGENT_VIEW` | 关闭 `claude agents`/`--bg`/`/background` 等后台 agent 能力 |
| `CLAUDE_CODE_TASK_LIST_ID` | 多个 Claude Code 实例共享同一个任务列表 |
| `CLAUDE_CODE_FORK_SUBAGENT` | 🆕 **v2.1.302+**：v2.1.302 起 fork 型 subagent（`subagent_type: "fork"`）在 `claude -p`、Agent SDK、桌面端与 VS Code 中也默认开启（与终端一致）；设为 `0` 关闭 |

## MCP 相关

| 变量 | 说明 |
| --- | --- |
| `MCP_TIMEOUT` | MCP 服务器启动超时（默认 30000ms） |
| `MCP_TOOL_TIMEOUT` | 单次 MCP 工具调用超时（默认约 28 小时，几乎不设限） |
| `MCP_CONNECTION_NONBLOCKING` | 设为 `0` 恢复旧版“启动时阻塞等待 MCP 连接”行为（2.1.142 起默认非阻塞）；v2.1.281 修复了设为 `0` 时 claude.ai connector 1 秒就放弃、不遵守 `MCP_CONNECT_TIMEOUT_MS` |
| `MCP_CONNECT_TIMEOUT_MS` | 阻塞模式下等待 MCP 连接批次完成的超时（默认 5000ms） |
| `CLAUDE_CODE_MCP_STARTUP_WAIT_MS` | 🆕 **v2.1.274+**：非交互模式下，首轮最多等多久让正在连接的 MCP 服务器连上（`0` = 不等） |
| `MCP_SDK_GENERATION` / `MCP_PROTOCOL_NEGOTIATION` | ⚠️ v2.1.274 起 Bedrock、Vertex、Foundry 与关闭遥测的安装，对直连 HTTP 的 MCP 服务器也默认使用 v2 MCP 客户端与 MCP `2026-07-28` 协议协商；v2.1.292 起本地（stdio）MCP 服务器在所有安装上同样默认协商 `2026-07-28` 协议，v2.1.295 / v2.1.299 起 claude.ai、云端与 Remote Control connector 也一致；设 `MCP_SDK_GENERATION=v1` 或 `MCP_PROTOCOL_NEGOTIATION=legacy` 退出 |
| `MCP_SERVER_CONNECTION_BATCH_SIZE` / `MCP_REMOTE_SERVER_CONNECTION_BATCH_SIZE` | 本地（stdio）/远程（HTTP、SSE）MCP 服务器启动时的并行连接数 |
| `MAX_MCP_OUTPUT_TOKENS` | MCP 工具响应允许的最大 token 数（默认 25000） |
| `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH` | 🆕 **v2.1.280+**：发给模型的每个 MCP 工具描述与每个服务器说明的字符上限（⚠️ v2.1.296 起预发送描述与服务器说明默认上限从 2048 提高到 4096，超出部分截断；v2.1.295 起经 tool search 按需加载的工具描述截断上限提高到 16384；v2.1.299 起 `api.anthropic.com` 上的第一方 MCP 服务器不截断） |
| `CLAUDE_CODE_MCP_ALLOWLIST_ENV` | 只给 stdio MCP 服务器传递安全基线环境变量，而不是继承整个 shell 环境 |
| `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` | 远程 MCP 工具调用的空闲超时（默认 5 分钟，超时则报错而非无限等待） |
| `ENABLE_TOOL_SEARCH` | 控制 MCP 工具是否延迟加载（按需检索）还是一次性全部载入上下文 |

## 插件与技能

| 变量 | 说明 |
| --- | --- |
| `CLAUDE_CODE_PLUGIN_CACHE_DIR` | 覆盖插件根目录（默认 `~/.claude/plugins`) |
| `CLAUDE_CODE_PLUGIN_DIRS` | 🆕 **v2.1.280+**：本次会话要加载的插件目录，每个都像 `--plugin-dir` 那样加载；Unix 用 `:`、Windows 用 `;` 分隔，路径须为绝对路径或以 `~` 开头（相对路径会被跳过）。这个变量见于官方文档，更新日志里没有单列 |
| `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` | 安装/更新插件时 git 操作的超时（默认 120000ms） |
| `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` | 插件仓库用 HTTPS 而非 SSH 克隆，适合没配 SSH key 的 CI/容器环境 |
| `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS` | 禁用随 Claude Code 自带的技能与工作流（不影响自定义/插件技能） |
| `CLAUDE_CODE_SYNC_SKILLS` | 非交互模式下，首次查询前把你在 claude.ai 上启用的技能同步到本地。🆕 v2.1.275 起用 claude.ai 账号登录的终端会话会同步该账号上启用的技能与插件，要关闭请把设置 `syncClaudeAiSkills` / `syncClaudeAiPlugins` 设为 `false`（见[配置文件](/manual/agent/claude-code/configuration-files)） |
| `SLASH_COMMAND_TOOL_CHAR_BUDGET` | 技能元数据展示给 Skill 工具时的字符预算，技能很多时可调大避免描述被裁剪 |

## 终端 UI 与可访问性

| 变量 | 说明 |
| --- | --- |
| `CLAUDE_CODE_ACCESSIBILITY` | 保持原生终端光标可见，便于屏幕放大镜类工具跟踪光标 |
| `CLAUDE_AX_SCREEN_READER` | 输出无装饰边框/动画的纯文本，适配屏幕阅读器（⚠️ v2.1.305 / v2.1.307 起写在 settings `env` 里时，以及 `axScreenReader` 设置，只在用户级、托管设置或 `--settings` 中生效） |
| `CLAUDE_CODE_DISABLE_MOUSE` / `CLAUDE_CODE_DISABLE_MOUSE_CLICKS` | 全屏渲染下禁用鼠标追踪 / 只禁用点击拖拽（保留滚轮） |
| `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` | 禁用全屏渲染，回退到传统主屏渲染器（终端原生回滚缓冲区可用） |
| `CLAUDE_CODE_NO_FLICKER` | 启用全屏渲染（减少闪烁、长会话内存更平稳的实验性渲染器） |
| `CLAUDE_CODE_TMUX_TRUECOLOR` | 允许 tmux 内使用 24 位真彩色（需先在 `~/.tmux.conf` 开启 `Tc`) |
| `CLAUDE_CODE_SCROLL_SPEED` | 全屏渲染下的鼠标滚轮倍率 |
| `CLAUDE_CODE_HIDE_CWD` | 启动 Logo 里隐藏工作目录路径，适合截图/录屏 |
| `CLAUDE_CODE_SYNTAX_HIGHLIGHT` | 设为 `false` 关闭 diff 输出的语法高亮 |
| `FORCE_HYPERLINK` | v2.1.217 起页脚 PR 徽标即使在检测不到终端超链接支持时（ssh/tmux 等）也渲染成可点链接；设为 `0`、`false`、`no` 或 `off` 退出（后三者自 v2.1.314 起生效） |

## OpenTelemetry 监控

| 变量 | 说明 |
| --- | --- |
| `CLAUDE_CODE_ENABLE_TELEMETRY` | 启用 OpenTelemetry 数据采集，是配置其它 OTel 变量的前提。⚠️ v2.1.282 起，它以及选择导出器、设置导出端点（`OTEL_EXPORTER_OTLP_*_ENDPOINT` 等）、采集内容（`OTEL_LOG_*`）的变量写在项目级 `.claude/settings.json` / `.claude/settings.local.json` 的 `env` 里会被忽略（只有 `none`、`0` 这类关闭用的值仍然生效），要写在 shell、用户级或托管设置里；本地交互式会话启动时会提示，`/status` 与 `claude doctor` 会列出被忽略的变量，而 `-p` 与 Agent SDK 会话没有提示，升级后记得确认采集端还收得到数据 |
| `OTEL_LOG_USER_PROMPTS` / `OTEL_LOG_ASSISTANT_RESPONSES` | 是否在日志事件中包含用户提示词/模型回复原文（默认脱敏） |
| `OTEL_LOG_TOOL_CONTENT` / `OTEL_LOG_TOOL_DETAILS` | 是否包含工具调用的输入输出内容与详细参数（默认关闭以保护敏感信息）。⚠️ v2.1.273 起 `OTEL_LOG_TOOL_DETAILS=1` 时，成本与 token 指标也带上真实的 agent、技能、插件与 MCP 服务器名；v2.1.283 起 `OTEL_LOG_TOOL_CONTENT=1` 时，MCP 工具、WebFetch 与 WebSearch 的输出也写进 `claude_code.tool` span 的 `tool.output` 事件 |
| `OTEL_METRICS_INCLUDE_SESSION_ID` / `_ACCOUNT_UUID` / `_VERSION` | 控制指标里包含哪些附加维度 |
| `OTEL_METRICS_INCLUDE_REPOSITORY` | 🆕 **v2.1.269+**：给 OTel 指标与事件打上 `vcs.*` 仓库属性；配合 `OTEL_LOG_TOOL_DETAILS` 时提交事件还带 `vcs.ref.head.*` |
| `OTEL_LOG_MANAGED_SETTINGS` | 🆕 **v2.1.274+**：同版本新增的 `claude_code.managed_settings_resolved` 事件记录托管设置的来源与策略 helper 状态；设为 `1` 时再附上脱敏后的设置与摘要 |
| `OTEL_LOG_RAW_API_BODIES` | 把完整的 API 请求与响应体作为 OTel 日志事件输出，供调试（v2.1.111+）。v2.1.274 起用 `file:<dir>` 形式时多一个 `index.jsonl`，事件新增 `request_body_id` / `message.id` 属性，能把每个响应对应到它的请求文件与 transcript 消息 |
| `CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH` | 调整 OTel 内容属性默认 60 KB 的截断上限（v2.1.214+）。同版本日志事件新增 `message.uuid`、`client_request_id`、`tool_source` 属性，便于消息级关联与工具来源追溯 |
| 标准 OTel 变量 | `OTEL_METRICS_EXPORTER`、`OTEL_LOGS_EXPORTER`、`OTEL_EXPORTER_OTLP_ENDPOINT`、`OTEL_EXPORTER_OTLP_PROTOCOL`、`OTEL_EXPORTER_OTLP_HEADERS`、`OTEL_RESOURCE_ATTRIBUTES` 等标准导出器配置同样支持 |

## 调试

| 变量 | 说明 |
| --- | --- |
| `DEBUG` | 设为 `1`/`true`/`yes`/`on` 开启调试模式，等价于 `--debug` |
| `CLAUDE_CODE_DEBUG_LOGS_DIR` | 调试日志文件路径（默认 `~/.claude/debug/<timestamp>.txt`) |
| `CLAUDE_CODE_DEBUG_LOG_LEVEL` | 日志级别：`verbose`/`debug`（默认）/`info`/`warn`/`error` |

::: info

以上覆盖了日常最常用的变量类别。企业级场景（网关鉴权、Perforce 集成、屏幕阅读器细节、agent team 相关变量等）数量繁多且更新频繁，建议直接查阅官方 [Environment variables](https://code.claude.com/docs/en/env-vars) 页面获取权威、实时的完整列表。

:::
