---
title: "启动命令行选项"
description: "codex 子命令一览与全局参数、交互模式参数参考"
source: "https://daiw.org/manual/codex/cli-flags"
---

# 启动命令行选项

> codex 子命令一览与全局参数、交互模式参数参考

`codex` 有两种调用形式：

```text
codex [OPTIONS] [PROMPT]
codex [OPTIONS] <COMMAND> [ARGS]
```

不带子命令时启动交互式终端界面（TUI），`PROMPT` 会作为首条消息发送；带子命令时执行对应功能。本页按 Codex CLI v0.167.0 与官方 CLI 参考整理；与本机不符时，请用 `codex <COMMAND> --help` 查看对应版本的完整参数。

## 子命令一览

| 子命令 | 作用 | 详见 |
| --- | --- | --- |
| `codex` | 启动交互式 TUI | 本页 |
| `codex exec`（别名 `e`） | 非交互运行，适合脚本与 CI；子命令 `resume`、`fork`、`review` | [exec](/manual/agent/codex/exec) |
| `codex review` | 非交互代码审查：`--uncommitted`、`--base`、`--commit` 或自定义审查提示词 | [代码审查](/manual/agent/codex/review) |
| `codex resume` | 恢复交互会话：默认打开选择器，`--last` 直接恢复近期一次 | [会话管理](/manual/agent/codex/sessions) |
| `codex fork` | 把旧会话分叉成新会话，原会话记录保持不变 | 同上 |
| `codex archive` / `codex unarchive` | 按会话 ID 或名称归档 / 取消归档 | 同上 |
| `codex delete` | 永久删除会话；`--force` 跳过确认（只接受 UUID） | 同上 |
| `codex queue` | 给已有会话排队一条消息：`--thread`、`--message`；v0.166.0 起支持 `--resume` 在入队后唤醒未加载的会话 | 同上 |
| `codex agents` | 打开代理指挥中心，浏览并切换会话（默认连共享的本机 app-server 守护进程，v0.167.0 起支持 `--no-daemon` 使用内嵌服务） | 同上 |
| `codex migrate-rollouts` | 检查旧版本地会话，或将其迁移为分页线程历史（加 `--apply` 才真正执行） | 同上 |
| `codex login` / `codex logout` | 登录、查看登录状态（`codex login status`）、登出 | [安装、登录与升级](/manual/agent/codex/installation) |
| `codex update` | 按安装方式自更新 | 同上 |
| `codex doctor` | 生成本机诊断报告；v0.166.0 起支持 `--network-only` 聚焦检查配置、网络环境、提供方 HTTP 与 WebSocket 连通性 | 同上 |
| `codex mcp` | 管理 MCP 服务器：`list`、`get`、`add`（v0.158.0 起支持 `--oauth-client-secret`）、`remove`、`login`（v0.156.0 起支持 `--no-browser`）、`logout` | [MCP 集成](/manual/agent/codex/mcp) |
| `codex plugin` | 管理插件：`add`、`list`、`remove`、`marketplace` | [插件](/manual/agent/codex/plugins) |
| `codex sandbox` | 在 Codex 沙箱中运行任意命令：`codex sandbox [OPTIONS] -- COMMAND...`；Windows 上 v0.162.0 起提供 `codex sandbox uninstall` 卸载旧版沙箱的机器级账户与网络规则 | [沙箱、审批与安全](/manual/agent/codex/sandbox-approvals) |
| `codex features` | 列出功能开关及其成熟度（`list`），或在 `config.toml` 中持久开启 / 关闭（`enable` / `disable`） | [配置文件](/manual/agent/codex/configuration) |
| `codex completion` | 生成 shell 补全脚本 | 本页 |
| `codex cloud`（别名 `cloud-tasks`，实验性） | 浏览或提交 Codex cloud 任务：`exec`、`status`、`list`、`apply`、`diff` | [Codex Cloud、GitHub 与 IDE](/manual/agent/codex/cloud-integrations) |
| `codex apply`（别名 `a`） | 把某个 Codex cloud 任务近期的 diff 用 `git apply` 应用到本地 | 同上 |
| `codex app` | 打开 ChatGPT 桌面应用，未安装时启动安装程序（仅 macOS / Windows） | — |
| `codex app-server`（实验性） | 运行 app server，以及守护进程管理（`daemon start`、`daemon restart`、`daemon stop`、`daemon update` 等，v0.156.0 起 `update` 加 `--from-cli` 可改用当前 CLI 的安装包）、协议绑定生成等工具 | [SDK 与 App Server](/manual/agent/codex/sdk-app-server) |
| `codex remote-control`（实验性） | 前台运行远程控制，或管理开启远程控制的 daemon：`start`、`stop`、`pair` | 同上 |
| `codex exec-server`（实验性） | 运行独立的 exec-server 服务；v0.158.0 起 WebSocket 监听可以用 `--ws-auth` 等参数要求 bearer token 鉴权（与 `app-server` 的同名参数一致，不能与 `--remote` 同用），并新增 `--linux-sandbox-pid-namespace`（默认 `isolate`；`inherit` 让 Linux 沙箱沿用调用方的 PID 命名空间，只适合专用环境） | 同上 |
| `codex debug` | 调试工具：`models`、`prompt-input`、`app-server send-message-v2` | — |

`codex exec` 在全局参数之外还有自己的参数，如 `--json`（输出 JSONL 事件流）、`-o, --output-last-message`、`--output-schema`、`--cyber-access-program`（v0.161.0 起）、`--ephemeral`、`--skip-git-repo-check`、`--ignore-user-config`、`--ignore-rules`、`--color`，详见[非交互模式 codex exec](/manual/agent/codex/exec)。

## 全局参数

全局参数写在 `codex` 之后，大多也会传给子命令（例如 `codex --oss exec "..."` 让 `exec` 使用本地模型）；同一参数也可以写在子命令后面，此时以子命令处的取值为准。标注“仅交互”的参数只对 TUI 生效。

### 模型

| 参数 | 说明 |
| --- | --- |
| `-m, --model <MODEL>` | 覆盖配置中的 `model`，如 `gpt-6.1-sol` |
| `--oss` | 使用本地开源模型提供方（Ollama 或 LM Studio）。未指定 `-m` 时默认模型为 `gpt-oss:20b`（Ollama）或 `openai/gpt-oss-20b`（LM Studio），本地没有时会自动下载 |
| `--local-provider <PROVIDER>` | `lmstudio` 或 `ollama`，覆盖本次 `--oss` 使用的提供方；默认读取配置 `oss_provider`，两者都没有时交互模式会弹出选择，`codex exec` 直接报错 |

推理强度没有专门的参数，可用 `-c model_reasoning_effort=high` 覆盖，或在会话中用 `/model` 切换。

### 沙箱与审批

| 参数 | 说明 |
| --- | --- |
| `-s, --sandbox <MODE>` | 模型生成的命令使用的沙箱策略：`read-only`、`workspace-write`、`danger-full-access`；不指定时取配置 |
| `-a, --ask-for-approval <POLICY>` | 何时暂停等你批准（仅交互）：`on-request`（由模型决定何时请求）或 `never`（从不询问，失败直接返回给模型）。`codex exec` 没有此参数，默认不询问 |
| `--approve-for-me` | 别名 `--not-so-yolo`，v0.147.0 起提供。把审批请求交给自动审查（Auto-review），等价于同时设置 `approvals_reviewer="auto_review"`、`approval_policy="on-request"`、`sandbox_mode="workspace-write"`，不扩大文件系统与网络权限 |
| `--dangerously-bypass-approvals-and-sandbox` | 别名 `--yolo`。跳过全部审批且不使用沙箱，**极其危险**，只应在外部已隔离的环境（专用虚拟机、容器）中使用 |
| `--dangerously-bypass-hook-trust` | 本次调用直接运行已启用的 hooks，不要求事先持久化的 hook 信任；仅用于已自行审核 hook 来源的自动化场景 |

互斥关系：`--approve-for-me` 不能与 `--sandbox`、`--yolo` 同时使用；交互模式下 `-a` 不能与 `--yolo`、`--approve-for-me` 同时使用。`-a` 只接受上面两个值，旧的 `untrusted` 已退役，配置中残留 `approval_policy = "untrusted"` 可能导致无法启动。

### 目录与工作区

| 参数 | 说明 |
| --- | --- |
| `-C, --cd <DIR>` | 以指定目录作为 agent 的工作根目录 |
| `--add-dir <DIR>` | 与主工作区并列、额外授予写权限的目录，可重复。需要写多个目录时优先用它，而不是改用 `danger-full-access` |
| `--worktree` | 在新建的受管 Git worktree 中运行会话。v0.164.0 起 `worktrees` 功能开关退役，受管 worktree 常驻可用；只支持本地的新交互会话、`codex fork <SESSION_ID>`、`codex exec` 与 `codex exec fork`。官方 CLI 参考尚未收录此参数 |

### 配置

| 参数 | 说明 |
| --- | --- |
| `-c, --config <key=value>` | 覆盖任意配置项，可重复。键用点号表示嵌套（如 `sandbox_workspace_write.network_access`），值按 TOML 解析，解析失败时当作字符串。多层子命令同时传入 `-c` 时会完整保留（v0.164.0 修复），写在子命令之后的 `-c` 优先于写在子命令之前的 |
| `-p, --profile <NAME>` | 在用户配置之上叠加 `$CODEX_HOME/<NAME>.config.toml`。只对 `codex`、`exec`、`review`、`resume`、`fork`、`queue`、`archive`、`delete`、`unarchive`、`agents`、`mcp`、`sandbox` 与 `debug prompt-input` 生效，其他子命令会报错 |
| `--enable <FEATURE>` / `--disable <FEATURE>` | 开启 / 关闭某个功能开关，等价于 `-c features.<FEATURE>=true` / `false`；可重复，名称未知时报错。可用名称见 `codex features list` |
| `--strict-config` | `config.toml` 中出现当前版本不认识的字段时报错退出。适用于 `codex`、`exec`、`review`、`resume`、`fork`、`queue`、`archive`、`unarchive`、`delete`、`agents`、`exec-server` 与不带子命令的 `app-server`；`mcp`、`plugin`、`login`、`update`、`sandbox` 等管理类子命令会拒绝它 |

配置的优先级从高到低依次是：命令行参数与 `-c`、项目内的 `.codex/config.toml`（仅受信任项目）、`--profile` 选中的 profile 文件、用户配置 `~/.codex/config.toml`、云端下发的默认值、系统配置 `/etc/codex/config.toml`、内置默认值；部分企业机器上旧式的 `managed_config.toml` 压在所有层之上。详见[配置文件 config.toml](/manual/agent/codex/configuration)。

### 输入与界面

| 参数 | 说明 |
| --- | --- |
| `PROMPT` | 可选的初始提示词；省略则直接进入空白输入框 |
| `-i, --image <FILE>` | 给首条消息附加图片，多个路径用逗号分隔或重复该参数；`codex exec` 同样支持 |
| `--search` | 启用实时网页搜索（仅交互），等价于 `web_search="live"`；默认为 `cached`，即使用 OpenAI 维护的搜索缓存 |
| `--no-alt-screen` | 不使用终端的备用屏幕（仅交互），以内联模式运行并保留终端回滚记录，覆盖本次的 `tui.alternate_screen`；此时也不会进入全屏对话记录（`tui.fullscreen_transcript`，v0.157.0 起默认开启） |

### 后台服务与远程 app server

| 参数 | 说明 |
| --- | --- |
| `--no-daemon` | 本次不使用共享的后台服务（本机的 app-server 守护进程）：不探测、不连接，也不自动启动它，即使它已经在运行（v0.156.0 起）。`resume`、`fork`、`agents`（v0.167.0 起）同样认这个参数，写在子命令前后都可以；`archive`、`unarchive`、`delete` 也认，但要写在子命令之前（如 `codex --no-daemon archive <SESSION>`）；不能与 `--remote` 同用，也不能用于必须连上共享服务的 `codex queue`。官方 CLI 参考尚未收录此参数 |
| `--remote <ADDR>` | 让 TUI 连接远程 app server：`ws://host:port`、`wss://host:port`、`unix://`（默认套接字）或 `unix://PATH`。只用于 `codex`、`resume`、`fork`、`archive`、`unarchive`、`delete`、`queue`、`agents`，其他子命令会拒绝 |
| `--remote-auth-token-env <ENV_VAR>` | 从该环境变量读取 bearer token 随连接发送；需配合 `--remote`，token 只会经 `wss://` 或本机 `ws://` 发送 |

### 其它

| 参数 | 说明 |
| --- | --- |
| `-h, --help` | 显示帮助 |
| `-V, --version` | 显示版本号 |

## 示例

```bash
# 带初始提示词启动
codex "解释一下这个仓库的整体架构"

# 低摩擦的本地开发：工作区内可写，越界时询问
codex --sandbox workspace-write --ask-for-approval on-request

# 只读探索
codex -s read-only -a on-request

# 指定模型与推理强度
codex -m gpt-6.1-sol -c model_reasoning_effort=high

# 本次允许沙箱内的命令联网
codex -c sandbox_workspace_write.network_access=true

# 附图并开启实时搜索
codex -i before.png,after.png --search "对比两张截图，找出样式回归"

# 叠加 ~/.codex/deep-review.config.toml
codex --profile deep-review

# 使用本地 Ollama 模型
codex --oss --local-provider ollama

# 本次不使用共享的后台服务，以内嵌服务运行
codex --no-daemon
```

## `codex completion`

```bash
codex completion zsh > "${fpath[1]}/_codex"
# 或者在 ~/.zshrc 中加载
eval "$(codex completion zsh)"
```

支持 `bash`（默认）、`zsh`、`fish`、`powershell`、`elvish`。zsh 若提示 `command not found: compdef`，先执行 `autoload -Uz compinit && compinit` 再加载。官方 CLI 参考把 PowerShell 的取值写成 `power-shell`，按源码实际应为 `powershell`。

## 常见误用提醒

- `-p` 在 Codex 中是 `--profile`，不是“打印结果后退出”；非交互运行请用 `codex exec`。
- `-c` 在 Codex 中是 `--config`，不是“继续上次会话”；继续近期一次会话用 `codex resume --last`。
- 官方文档称 `codex exec --full-auto` 作为已弃用的兼容参数保留，但 v0.158.0 源码中没有这个参数，请改用 `--sandbox workspace-write`。
- 官方文档中的 `codex sandbox macos` / `linux` / `windows` 写法与源码不符：v0.158.0 的 `codex sandbox` 直接使用当前平台的沙箱，命令写在 `--` 之后，如 `codex sandbox -- ls`。

## 隐藏与已移除的子命令

以下子命令存在于源码中，但不会出现在 `codex --help` 里：

- `codex execpolicy check`：用规则文件检查某条命令会被允许、提示还是禁止（官方文档标为实验性），详见[命令规则 Rules](/manual/agent/codex/rules)。
- `codex responses-api-proxy`、`codex stdio-to-uds`：内部使用。
- `codex tcp-tunnel`：v0.156.0 新增，把本机 TCP 连接经 HTTP/3 CONNECT 代理转发出去，内部使用。
- `codex debug trace-reduce`、`codex debug clear-memories`：内部调试。

`codex mcp-server` 与独立的 `codex-mcp-server` 二进制已被移除，改用 `codex app-server`。
