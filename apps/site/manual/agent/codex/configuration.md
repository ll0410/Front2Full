---
title: "配置文件 config.toml"
description: "config.toml 的位置与分层优先级、-c 单次覆盖、profile、项目信任、requirements.toml，以及常用配置段落示例"
source: "https://daiw.org/manual/codex/configuration"
---

# 配置文件 config.toml

> config.toml 的位置与分层优先级、-c 单次覆盖、profile、项目信任、requirements.toml，以及常用配置段落示例

Codex 的持久设置都写在 TOML 格式的 `config.toml` 里，命令行、IDE 扩展与 ChatGPT 桌面端共用同一套配置层。本页讲文件在哪、谁覆盖谁、常用段落怎么写；每个键的类型与默认值见[配置项速查](/manual/agent/codex/config-reference)。

## 文件位置

| 文件 | 层级 | 说明 |
| --- | --- | --- |
| `~/.codex/config.toml` | 用户配置 | 个人默认值，日常主要修改的文件 |
| `~/.codex/<name>.config.toml` | profile | 用 `--profile <name>` 选中时叠加在用户配置之上 |
| `.codex/config.toml`（仓库内） | 项目配置 | 仅在项目受信任时加载 |
| `/etc/codex/config.toml` | 系统配置 | Windows 为 `%ProgramData%\OpenAI\Codex\config.toml` |
| `requirements.toml` | 强制约束 | 由管理员下发、限制可选值，见文末 |

`~/.codex` 是 `CODEX_HOME` 的默认值，可用同名环境变量改到别处，但该目录必须已存在，否则 Codex 启动即报错。这个目录还存放 `auth.json`（文件方式保存的登录凭证）、`history.jsonl`、`sessions/`、`log/` 以及全局 `AGENTS.md`、`hooks.json` 等。

## 优先级

同一个键出现在多处时，按以下顺序生效（从高到低）：

1. 命令行参数，以及 `-c` / `--config` 覆盖
2. 项目配置：从项目根到当前目录的每个 `.codex/config.toml`，离当前目录越近越优先
3. 用 `--profile` 选中的 profile 文件
4. 用户配置 `~/.codex/config.toml`
5. 云端托管的 `config.toml`（登录的工作区下发时）
6. 系统配置 `/etc/codex/config.toml`
7. 内置默认值

各层的表（table）逐键合并，所以上层文件只需写要改的键。改过名的旧键（如 `agents.max_threads`、`memories.no_memories_if_mcp_or_web_search`）仍然可用：每一层在合并前都会先换成新键名，所以跨层照常按上面的顺序覆盖，同一文件里新旧写法并存时以新键名为准；v0.158.0 起 `tui.whimsy` 也作为 `tui.effects.starfield` 的别名重新生效。部分企业机器上还有旧式的 `managed_config.toml`，它压在所有层之上，正逐步被 `requirements.toml` 取代。

排查“改了没生效”：TUI 中的 `/config`（v0.163.0 新增）支持按分类搜索并即时修改偏好设置（同时标注哪些改动需重启生效），`/debug-config` 列出所有配置层与要求来源，`/status` 显示当前生效的模型、权限与已加载的 `AGENTS.md`；v0.156.0 起，生效配置或 requirements 里出现不认识的字段（常见于拼错或已弃用的键）时，启动会给出警告，只列来源与字段名，上限三条，可以在 `/warnings` 里查看；启动时加 `--strict-config` 可让不认识的字段直接报错；`codex doctor`（或 `codex doctor --network-only`）可做体检。

## 单次覆盖：`-c key=value`

不想改文件时，用 `-c`（`--config`）只覆盖本次运行。键用点号表示嵌套，值按 TOML 解析，解析失败时当作普通字符串：

```bash
codex -m gpt-6.1-sol                                # 有专用参数时优先用专用参数
codex -c model_reasoning_effort=high
codex -c sandbox_workspace_write.network_access=true
codex -c 'shell_environment_policy.include_only=["PATH","HOME"]'
codex -c mcp_servers.context7.enabled=false
codex --enable memories --disable shell_snapshot    # 等价于 -c features.<name>=true/false
```

值里含空格、方括号或引号时整体加单引号。多层子命令同时传入 `-c` / `--config` 时会完整保留全部覆盖项（v0.164.0 修复），`-c` 写在子命令之后比写在之前优先级更高。

## Profile：成套切换配置

profile 是一份独立的 TOML 文件 `~/.codex/<name>.config.toml`，用 `--profile <name>`（`-p`）选中后叠加在用户配置之上、项目配置之下，因此只需写与基础配置不同的键。文件里直接写顶层键，不要再套 `[profiles.xxx]`：

```toml [~/.codex/deep-review.config.toml]
model = "gpt-6.1-sol"
model_reasoning_effort = "xhigh"
approval_policy = "on-request"
```

```bash
codex --profile deep-review
codex exec --profile deep-review "review this change"
```

- profile 名只能包含 ASCII 字母、数字、`-` 和 `_`。
- 自 0.134.0 起，`config.toml` 中的 `[profiles.<name>]` 表不再生效，`--profile` 遇到同名的旧表会直接报错，提示迁移到独立文件；顶层残留的 `profile = "<name>"` 则会让配置加载失败，提示改用 `--profile <name>` 与 `<name>.config.toml`。
- 项目配置不能选择 profile。

## 项目配置与信任

仓库内的 `.codex/config.toml` 适合放团队共享的项目级设置。Codex 从当前目录向上寻找项目根（默认是包含 `.git` 的目录，可在用户级配置里用 `project_root_markers` 修改，写在项目配置里的这一项不影响查找），再从根往下加载沿途每个 `.codex/config.toml`；其中的相对路径相对于所在的 `.codex/` 目录解析。

项目文件来自仓库内容，因此只有**受信任的项目**才会加载项目级 `.codex/` 层（项目配置、项目 hooks、项目 rules）。在还没有信任决定的目录启动 TUI 时，会先弹出“Folder access”确认（“Trust this folder?”），选择“Trust and continue”后把信任写入用户配置，取消则不做记录；在 Git 仓库的子目录中，信任作用于仓库根（在 Git worktree 里则作用于主仓库的根目录）。已标为 `untrusted` 的目录每次启动也会先提示：以受限方式打开，项目级配置、hooks 与 rules 保持停用，已保存的信任设置不变。也可以手动写：

```toml [~/.codex/config.toml]
[projects."/Users/me/code/app"]
trust_level = "trusted"   # 或 "untrusted"
```

未受信任的项目仍会加载用户与系统配置。被显式标为 `untrusted` 的项目还会：不加载项目内的 `AGENTS.md`；在未显式设置 `approval_policy` 时，命令默认需要审批（被 rules 放行的除外）。

下列键即使写进项目配置也会被忽略并在启动时警告，请放在用户级或系统级配置中：`openai_base_url`、`chatgpt_base_url`、`apps_mcp_product_sku`、`responses_api_metadata`、`model_provider`、`model_providers`、`notify`、`profile`、`profiles`、`experimental_realtime_ws_base_url`、`experimental_realtime_webrtc_call_base_url`、`otel`。此外，项目配置里的 `features.system_proxy_fallback`，以及 `[tui.keymap.chat]` 中切换权限模式的 `previous_permission_mode`、`next_permission_mode` 快捷键也会被忽略。

## 常用配置段落

### 模型与推理

```toml
model = "gpt-6.1-sol"
model_reasoning_effort = "high"    # 可选档位取决于模型
model_reasoning_summary = "auto"   # auto / concise / detailed / none
```

v0.156.0 起 `personality` 的 `friendly`、`pragmatic` 不再改变回复风格，不必再写。

更多见[模型与推理](/manual/agent/codex/models)。

### 审批与沙箱

```toml
approval_policy = "on-request"     # 或 "never"，或 granular 细粒度表
sandbox_mode = "workspace-write"   # read-only / workspace-write / danger-full-access
approvals_reviewer = "user"        # 改为 "auto_review" 则交给审查 agent

[sandbox_workspace_write]
network_access = false
writable_roots = ["/Users/me/.cache/pnpm"]
```

`approval_policy = "untrusted"` 已停止支持，生效配置中出现它会导致 Codex 无法启动。各模式的含义与组合见[沙箱、审批与安全](/manual/agent/codex/sandbox-approvals)。

### Shell 环境

`[shell_environment_policy]` 决定 Codex 派生的命令能看到哪些环境变量：

```toml
[shell_environment_policy]
inherit = "core"                 # all（默认）/ core / none
ignore_default_excludes = false  # 默认 true，即不自动剔除名含 KEY、SECRET、TOKEN 的变量
set = { CI = "1" }

[shell_environment_policy.filters]
"AWS_*" = "exclude"
"AZURE_*" = "exclude"
```

处理顺序：按 `inherit` 取初始集合；`ignore_default_excludes = false` 时剔除名含 `KEY`、`SECRET`、`TOKEN` 的变量；应用 exclude 规则；写入 `set`；最后若存在 include 规则，只保留匹配项。模式不区分大小写，支持 `*` 与 `?`。旧写法 `exclude`、`include_only` 数组仍可用，但不能与 `filters` 写在同一层。另有 `allow_login_shell`（默认 `true`），设为 `false` 可禁止 shell 工具使用登录 shell。

### 通知

```toml
notify = ["python3", "/Users/me/.codex/notify.py"]   # 外部程序，收到一个 JSON 参数

[tui]
notifications = ["agent-turn-complete", "approval-requested"]  # 或 true / false
notification_method = "auto"          # auto / osc9 / bel
notification_condition = "unfocused"  # unfocused / always
```

`notify` 目前只在 `agent-turn-complete` 事件触发，JSON 含 `type`、`thread-id`、`turn-id`、`cwd`、`input-messages`、`last-assistant-message` 等字段。`tui.notifications` 是 TUI 内置的终端通知，`auto` 模式优先使用 OSC 9，终端不支持时退回响铃（BEL）。

### 界面（TUI）

```toml
[tui]
animations = true
alternate_screen = "auto"      # never 可保留终端回滚记录，效果同 --no-alt-screen
fullscreen_transcript = true   # v0.157.0 起的默认值；设为 false 改用终端自己的回滚记录
mouse_scroll_speed = 1.0       # v0.162.0 起：鼠标滚轮滚动速度倍率（正浮点数，默认 1.0）
copy_on_select = "auto"        # v0.158.0 起：松开鼠标时复制选中文字；auto 按终端决定，always / never 强制开关
right_click_paste = "auto"     # v0.158.0 起：全屏模式下右键粘贴；on 连 macOS 也启用，off 关闭
show_tooltips = true
vim_mode_default = false

[tui.effects]
shimmer = false                # 只关掉文字闪烁，其他动画照常

[tui.rendering]
mermaid = false                # Mermaid 代码块显示原文，不画成图

[tui.keymap.global]
open_transcript = "ctrl-t"
```

通用配置、界面模式、主题、状态栏、终端标题、预设槽位与快捷键也可分别用 `/config`（v0.163.0 起）、`/tui`、`/theme`、`/statusline`、`/title`、`/presets`（v0.164.0 起）、`/keymap` 交互式调整。`[tui.effects]` 的六项效果、`[tui.rendering]` 的四类渲染，以及 `copy_on_select`、`right_click_paste` 在不同终端下的默认行为，见[配置项速查](/manual/agent/codex/config-reference)。

### 历史与日志

```toml
log_dir = "/Users/me/codex-logs"   # 默认 CODEX_HOME/log；显式设置时还会写纯文本 codex-tui.log

[history]
persistence = "save-all"   # 或 "none"：不写 history.jsonl
max_bytes = 104857600      # 100 MiB，超出后丢弃较早的记录
```

### 功能开关

可选与实验性能力在 `[features]` 表中开关：

```toml
[features]
memories = true
network_proxy = true
```

`codex features list` 列出全部开关及其成熟度与当前状态，`codex features enable <name>` / `disable <name>` 直接改写 `config.toml`；只想临时打开用 `--enable` / `--disable`，TUI 中可用 `/experimental`。启用“开发中”阶段的开关会出现警告，可设 `suppress_unstable_features_warning = true` 关闭。常用开关见[配置项速查](/manual/agent/codex/config-reference)。

## requirements.toml 与托管配置

组织可以用 `requirements.toml` 强制约束安全相关设置，用户与项目配置都无法越过。它可以放在 `/etc/codex/requirements.toml`（Windows 为 `%ProgramData%\OpenAI\Codex\requirements.toml`），也可以通过 macOS MDM、Windows 注册表策略（v0.164.0 起）或 ChatGPT Business / Enterprise 工作区云端下发：

```toml [/etc/codex/requirements.toml]
allowed_approval_policies = ["on-request"]
allowed_sandbox_modes = ["read-only", "workspace-write"]
allowed_web_search_modes = ["cached"]

[features]
memories = false
```

与之相对，系统级或云端下发的 `config.toml` 只提供默认值，用户仍可覆盖。未显式设置的默认值若被要求禁止，Codex 会回退到允许的值并记录警告。更多可用的约束键见[配置项速查](/manual/agent/codex/config-reference)。

## 编辑器补全

在文件顶部加一行 schema 注释，配合 VS Code / Cursor 的 Even Better TOML 扩展即可获得补全与校验：

```toml
#:schema https://developers.openai.com/codex/config-schema.json
```
