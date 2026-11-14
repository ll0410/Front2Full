---
title: "启动命令行选项"
description: "claude 子命令与全部命令行参数参考"
source: "https://daiw.org/manual/claude-code/cli-flags"
---

# 启动命令行选项

> claude 子命令与全部命令行参数参考

`claude --help` 不会列出全部参数——某个参数没出现在 `--help` 里，不代表它不存在。本页尽量按官方文档收全，但请以你本机版本的实际行为为准。

## 子命令

除了直接 `claude` 进入交互式会话，`claude` 后面还可以跟一个子命令：

| 子命令 | 作用 |
| --- | --- |
| `claude` | 启动交互式会话 |
| `claude --desktop` | 🆕 **v2.1.285+**：在当前目录打开 Claude 桌面应用；可与 `--continue` / `--resume <id>` 一起使用 |
| `claude "query"` | 携带初始 prompt 启动交互式会话 |
| `claude -p "query"` | 非交互模式：执行一次查询后退出（脚本 / CI 场景） |
| `claude -c` / `claude --continue` | 继续当前目录下最近一次会话 |
| `claude -r "<id\|name>" "query"` | 按 ID 或名称恢复指定会话 |
| `claude update` | 更新到最新版本 |
| `claude install [version]` | 安装/重装原生二进制，可指定版本号或 `stable`/`latest` |
| `claude auth login` / `logout` / `status` | 登录、登出、查看认证状态（🆕 v2.1.318 起 `status` 输出包含已存 claude.ai 登录的到期时间 `loginExpiresAt`） |
| `claude mcp` | 管理 MCP 服务器（详见 MCP 文档） |
| `claude mcp login/logout <server>` | 对指定 MCP 服务器单独走 OAuth 登录/登出（v2.1.186+） |
| `claude plugin` | 管理插件（别名 `claude plugins`）；v2.1.269 起 `claude plugin eval` 可对插件跑评测套件（🆕 v2.1.299 起支持 `--disallow-tools` 排除指定内置工具）；v2.1.271 起 `install` / `update` 可用 `--accept-command <sha256>` 精确接受上一次 `--json` 运行所显示的命令；🆕 v2.1.292 起 `claude plugin install <plugin> --marketplace <source>` 先按策略校验添加该市场再安装插件；v2.1.285 起 `claude plugin configure <plugin>` 查看或设置插件选项，也可用 `--values-stdin` 从 stdin 读取；v2.1.281 起 `validate` 还检查插件声明的 MCP 服务器；⚠️ v2.1.283 起机器上装有 git 时，`eval` 要求 git 2.31 或更高版本 |
| `claude agents` | 打开 agent 视图，监控与派发并行的后台会话 |
| `claude attach <id\|name>` | 在当前终端里接管一个后台会话；🆕 v2.1.290 起可传会话名称的一部分 |
| `claude respawn <id>` | 重启一个后台会话（会话内容保留），`--all` 重启全部 |
| `claude stop <id>` / `claude kill <id>` | 停止一个后台会话 |
| `claude logs <id\|name>` | 打印某个后台会话最近的输出；🆕 v2.1.290 起可传会话名称的一部分 |
| `claude rm <id>` | 从列表移除一个后台会话（本地文件仍保留，仍可 `--resume`) |
| `claude daemon status` / `claude daemon stop --any` | 查看/停止后台会话的 supervisor 进程，用于故障恢复 |
| `claude project purge [path]` | 删除某个项目在本地的全部状态（会话记录、任务列表、编辑历史等；v2.1.311 起 `claude purge` 明确说明仅删除本机数据，不影响 Anthropic 服务端存储） |
| `claude setup-token` | 为 CI/脚本生成长期有效的 OAuth token |
| `claude remote-control` | 以服务模式启动，供 claude.ai / Claude App 远程控制；`--continue` 恢复最近一次 Remote Control 会话（v2.1.229+）。v2.1.282 修复了 `claude remote-control --debug` 报「Unknown argument」；⚠️ v2.1.300 起移除原本无效的 `--sandbox` 与 `--no-sandbox` 参数（现传参直接报错，请改设 `sandbox.enabled`） |
| `claude gateway --config gateway.yaml` | 启动自托管的 Claude apps 网关（面向企业管理员，v2.1.195+） |
| `claude self-hosted-runner` | 🆕 **v2.1.224+**：把你自己的机器或容器注册成自托管运行环境，让 Claude Code web、移动端、桌面端的会话在上面跑（Team 与 Enterprise 套餐）。🆕 v2.1.271 起新增 `--drain-marker-file <path>`（SIGTERM 排空时该文件存在，就向服务端把这次退出报告为主机排空，仅用于遥测）与 `--host-config-snapshot disk\|memory`（同版本修复了主机配置目录超过 64 MiB 时静默丢失全部主机配置）；同版本起跑在自托管运行环境上的会话也能用 fast mode（组织允许时）。⚠️ v2.1.281 起运行环境改用私有文件把系统提示词交给 Claude Code，包装脚本或 `command` hook 里追加的 `--system-prompt` / `--append-system-prompt` 要改成对应的 `-file` 形式；v2.1.283 起生命周期 hook 的 git 跳过仓库自带的 Git LFS `pre-push` hook，没有 `--configure-git` 时不签名提交；🆕 v2.1.299 起 `orchestrator` 新增 `--shutdown-drain-sec`；v2.1.307 起 checkout hook 默认 30 分钟超时（`--checkout-hook-timeout-min` 可调或设 `0`）；v2.1.311 起新增 `--hold-idle-file` 与 `--max-hold-min` 在宿主机仍有遗留进程时保持空闲会话；v2.1.318 起 orchestrator 的 spawn-runner hook 环境新增 `CLAUDE_RUNNER_SPAWN_REASON` |
| `claude ultrareview [target]` | 非交互式跑一次 ultrareview 深度评审。⚠️ v2.1.309 起要求先通过工作区信任确认（终端上会询问，否则拒绝；脚本可传无值标志 `--trust-workspace` 或设 `CLAUDE_CODE_DISABLE_ULTRAREVIEW_TRUST_CHECK=1`） |

## 常用参数速查表

按使用场景分组，便于查找；完整字段名与说明见官方 CLI reference。

### 权限与安全

| 参数 | 说明 |
| --- | --- |
| `--permission-mode <mode>` | 以指定权限模式启动：`default`（即 `manual`）、`acceptEdits`、`plan`、`auto`、`dontAsk`、`bypassPermissions`。⚠️ v2.1.283 起不指定（也没有 `permissions.defaultMode`）时，交互式会话在所有套餐与提供方上都以 `auto` 起步，`-p` 与 Agent SDK 仍是 `default`（v2.1.302 起第三方提供方、关闭遥测或全新安装下的 `-p` 与 Agent SDK 也统一从 `default` 起步） |
| `--dangerously-skip-permissions` | 跳过全部权限确认，等价于 `--permission-mode bypassPermissions`。⚠️ v2.1.281 起危险 `rm` 的确认在这个模式下最多等 2 分钟，无人回答就拒绝并附上改写提示（`CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT=1` 关闭） |
| `--allow-dangerously-skip-permissions` | 把 `bypassPermissions` 加入 `Shift+Tab` 循环列表，但不强制一开始就用它 |
| `--allowedTools` / `--allowed-tools` | 无需确认即可执行的工具白名单，支持模式匹配，如 `"Bash(git log *)"` |
| `--disallowedTools` / `--disallowed-tools` | 拒绝规则，例如 `"Bash(rm *)"` 只拒绝匹配的调用，裸工具名如 `"Edit"` 则整体移除该工具 |
| `--tools` | 限制 Claude 可用的内置工具集合，如 `"Bash,Edit,Read"`；不影响 MCP 工具 |
| `--permission-prompt-tool` | 指定一个 MCP 工具在非交互模式下代为处理权限确认 |
| `--safe-mode` | 禁用全部自定义项（CLAUDE.md、skills、插件、hooks、MCP 等）以排查配置问题，比 `--bare` 更彻底 |
| `--bare` | 极简模式：跳过 hooks/skills/插件/MCP/自动记忆/CLAUDE.md 自动发现，只保留 Bash、文件读写工具 |
| `--restricted` | 🆕 **v2.1.248+**：受限模式。移除能执行命令或代码的内置工具与 `WebFetch`（除非在 `--tools` 里点名），文件工具限定在工作目录内，拒绝 `bypassPermissions`，并忽略用户、项目、本机 settings 文件；等价环境变量 `CLAUDE_CODE_RESTRICTED=1` |
| `--permission-prompts none` | 🆕 **v2.1.259+**：给无人值守的无头主机用，凡是会弹确认的一律自动拒绝，当前权限模式（含 auto）照常裁决 |

### 模型与推理

| 参数 | 说明 |
| --- | --- |
| `--model <name>` | 设置本次会话模型，支持别名 `sonnet`/`opus`/`haiku`/`fable` 或完整模型名（v2.1.280 起 `opus` 在 Anthropic API、Bedrock、Vertex 上指向 Opus 5.5，Foundry 除外；v2.1.284 起 Anthropic API 上 `sonnet` 指向 Sonnet 5.5；v2.1.293 起 Anthropic API 上 `haiku` 指向 Haiku 5.5；v2.1.311 起在 `[1m]` 后缀无实际作用的模型上自动去掉该后缀与标签，传入仍兼容） |
| `--effort <level>` | 设置推理强度：`low`/`medium`/`high`/`xhigh`/`max`，具体可用档位取决于模型。v2.1.257 起它解除新模型的默认强度锁定只作用于本会话，不再永久生效 |
| `--fallback-model <a,b,...>` | 主模型过载/不可用时按顺序自动降级到备用模型 |
| `--advisor <model>` | 为本次会话启用顾问模型（第二模型在关键节点提供建议，v2.1.98+） |
| `--betas` | 附加 `anthropic-beta` 请求头（仅 API Key 用户） |

### 非交互模式与输出

| 参数 | 说明 |
| --- | --- |
| `--print`， `-p` | 打印结果后退出，不进入交互模式（v2.1.277 修复了内部错误后挂起、没有结果：现在报告错误并以退出码 1 结束；🆕 v2.1.318 起 JSON 输出包含已存 claude.ai 登录到期时间 `credential_expires_at`，且到期前 10 天起文本模式在 stderr 打印一行预警） |
| `--output-format <text\|json\|stream-json>` | 非交互模式的输出格式 |
| `--input-format <text\|stream-json>` | 非交互模式的输入格式 |
| `--max-turns <n>` | 限制 agentic 轮数，超出直接报错退出（v2.1.281 修复了模型交替输出无法解析的工具调用与超长截断时，一轮无视这个上限无限重试） |
| `--max-budget-usd <n>` | 单次调用的最高花费上限（仅非交互模式） |
| `--json-schema <schema>` | 让最终输出按给定 JSON Schema 校验（结构化输出） |
| `--include-partial-messages` | 输出流式的中间结果片段（需配合 `stream-json`) |
| `--include-hook-events` | 输出流里包含全部 hook 生命周期事件 |
| `--prompt-suggestions` | 每轮结束后额外输出一条“预测下一句 prompt” |
| `--no-session-persistence` | 不落盘会话记录，无法被 `--resume` |
| `--replay-user-messages` | 把 stdin 收到的用户消息原样回写到 stdout，便于确认 |

### 系统提示词定制

| 参数 | 行为 |
| --- | --- |
| `--system-prompt <text>` | 完全替换默认系统提示词 |
| `--system-prompt-file <path>` | 用文件内容替换默认系统提示词 |
| `--append-system-prompt <text>` | 在默认提示词末尾追加内容 |
| `--append-system-prompt-file <path>` | 追加文件内容到默认提示词末尾 |
| `--append-subagent-system-prompt-file <path>` | 🆕 **v2.1.261+**：从文件读取追加给 subagent 的系统提示词，适合命令行放不下的长提示词 |
| `--system-prompt-snapshot off` | 🆕 **v2.1.267+**：每次请求都重新渲染系统提示词，而不是复用会话记录的那一份，调试提示词文本时用 |
| `--exclude-dynamic-system-prompt-sections` | 把工作目录、环境信息等“因机器/用户而异”的片段移到第一条用户消息里，提升跨用户/跨机器的 prompt 缓存命中率 |

两个 append 参数可以和任一替换参数叠加使用。⚠️ v2.1.283 起 `--system-prompt` 与 `--system-prompt-file` 也能同时传（`--append-system-prompt` 与 `--append-system-prompt-file` 同理），文件里的文本排在前面；此前前两者互斥。想保留默认的工具指引与安全说明、只是叠加规则时用 append；想完全接管身份定位（例如把 Claude Code 当成流水线里的非编程 agent）时才用替换。

🆕 v2.1.275 起，`--system-prompt` 的内容里如果有一行 `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__`，这一行之上的文本会被全局缓存（与 SDK 的数组形式一致）。

### 会话恢复与并行

| 参数 | 说明 |
| --- | --- |
| `--continue`， `-c` | 恢复当前目录最近一次会话 |
| `--resume`， `-r <id\|name>` | 按 ID/名称恢复会话，或不带参数打开交互式选择器 |
| `--fork-session` | 恢复会话时创建新会话 ID，而不是复用原 ID |
| `--from-pr <number\|url>` | 恢复与指定 PR 关联的会话（Claude 创建 PR 时会自动关联） |
| `--session-id <uuid>` | 为本次会话指定一个 UUID |
| `--name`， `-n <name>` | 设置会话显示名称，可用 `--resume <name>` 找回 |
| `--worktree`， `-w [name]` | 在独立的 git worktree 里启动，便于并行开发互不干扰 |
| `--tmux` | 为 worktree 创建 tmux 会话（需配合 `--worktree`) |
| `--bg`， `--background` | 以后台 agent 形式启动并立即返回。⚠️ v2.1.281 起目录还没通过工作区信任确认时会先请你信任（非交互运行则直接退出），不再直接启动并运行项目 hook |
| `--exec <cmd>` | 配合 `--bg`，把一条 shell 命令作为后台任务运行，而非启动 Claude 会话 |
| `--agent <name>` | 指定本次会话使用的 subagent |
| `--agents <json>` | 以 JSON 动态定义本次会话可用的 subagent（字段与 agent 文件的 frontmatter 对应，`prompt` 即它的系统提示词）。🆕 v2.1.281 起配合 `-p` 也可以传一个 JSON 文件的路径，适合命令行放不下的大段定义，`prompt` 也允许为空 |
| `--forward-subagent-text` | 🆕 **v2.1.211 新增**：把 subagent 的思考过程也带进输出（也有同名环境变量）。v2.1.219 起也转发**深度 2 及以上的嵌套 subagent**，按派生它的 Agent `tool_use` id 归类 |
| `--teammate-mode` | 设置 agent team 队友的展示方式：`in-process`/`auto`/`tmux`/`iterm2` |
| `--teleport` | 把一个 web 会话拉到本地终端继续 |
| `--remote-control`， `--rc [name]` | 启动交互式会话并开启远程控制，可从 claude.ai / Claude App 继续操作 |

### 目录、配置与 MCP

| 参数 | 说明 |
| --- | --- |
| `--add-dir <path...>` | 额外授权 Claude 读写的工作目录（不会自动发现这些目录下的 `.claude/` 配置，`.claude/skills/` 除外）。⚠️ v2.1.257 起拒绝网络路径（UNC 共享、`/net/<host>` 自动挂载），Windows 上请改用映射盘符 |
| `--settings <path\|json>` | 指定一份 settings JSON 文件或内联 JSON 字符串，覆盖同名配置项 |
| `--setting-sources <user,project,local>` | 指定加载哪些来源的 settings；v2.1.281 起从这个会话派生的会话（队友、`/bg`、`claude agents` 会话、`--worktree --tmux`）沿用同样的限制 |
| `--mcp-config <file...>` | 从 JSON 文件/字符串加载 MCP 服务器配置 |
| `--strict-mcp-config` | 只使用 `--mcp-config` 里的 MCP 服务器，忽略其它来源 |
| `--plugin-dir <path>` | 仅本次会话从指定目录/`.zip` 加载一个插件，可重复传参。🆕 v2.1.265 起也可以指向**一个装了多个插件的文件夹**：每个带清单的子目录都会加载，运行中增删也会被发现。v2.1.280 起也可以用环境变量 `CLAUDE_CODE_PLUGIN_DIRS` 一次列出多个目录；v2.1.283 起 stream-json 的 `system/init` 消息里，`plugin_errors` 中加载失败的条目带上 `path` |
| `--plugin-url <url>` | 仅本次会话从 URL 拉取插件 `.zip` |
| `--disable-slash-commands` | 本次会话禁用全部 skills 与命令 |

### 调试与其它

| 参数 | 说明 |
| --- | --- |
| `--debug ["cat1,cat2"]` | 开启调试模式，可选按分类过滤（如 `"api,hooks"`,`!` 前缀表示排除） |
| `--debug-file <path>` | 把调试日志写到指定文件（隐式开启调试模式） |
| `--verbose` | 展示完整的逐轮输出 |
| `--version`， `-v` | 输出版本号 |
| `--ide` | 启动时若刚好只有一个可用 IDE，则自动连接 |
| `--init` | 在非交互模式下，会话开始前运行 `init` 匹配的 Setup hooks |
| `--init-only` | 只运行 Setup / SessionStart hooks 然后退出，不进入对话 |
| `--chrome` / `--no-chrome` | 启用/禁用 Chrome 浏览器自动化集成；🆕 v2.1.282 起企业可用托管设置 `allowClaudeInChromeWithManagedMcp` 让它与独占 MCP 控制的 `managed-mcp.json` 共存 |
| `--cloud <task>` | 用给定任务描述在 claude.ai 上新建一个 web 会话（旧名 `--remote`) |
| `--ax-screen-reader` | 输出无装饰边框/动画的纯文本，适配屏幕阅读器 |

## 示例

```bash
# 交互式启动，带初始 prompt
claude "解释一下这个仓库的整体架构"

# 非交互模式，管道输入，输出 JSON
git log --oneline -20 | claude -p "总结这些提交" --output-format json

# 在独立 worktree 里并行修一个 bug
claude --worktree fix-auth-bug

# 计划模式起步，并允许后续切到 bypassPermissions
claude --permission-mode plan --allow-dangerously-skip-permissions

# CI 场景：限制轮数、限制预算、禁用交互确认
claude -p --max-turns 5 --max-budget-usd 2.00 --dangerously-skip-permissions "跑一遍 lint 并修复"
```

## 常见误用提醒

- `claude --dangerously-skip-permissions daemon <id>` 在 v2.1.199 之前会被当成新会话的 prompt 文本（因为 `daemon <id>` 被解释为消息内容，而不是子命令），v2.1.199 起才正确路由到 `daemon` 子命令。只有紧跟在最前面的 `--dangerously-skip-permissions`/`--allow-dangerously-skip-permissions` 才会触发这个特殊路由。
- `--bg` 不能和 `-p`/`--print` 同时使用（v2.1.198 起会直接报错拒绝，而不是静默产生一个无法 attach 的会话）。
- 子命令拼错时（如 `claude udpate`）会提示“你是不是想输入 xxx”，并直接退出而不会误当成新会话的 prompt。
