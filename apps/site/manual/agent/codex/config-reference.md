---
title: "配置项速查"
description: "按主题分组的常用 config.toml 配置项，列出键名、类型、默认值与作用（基于 Codex CLI v0.167.0）"
source: "https://daiw.org/manual/codex/config-reference"
---

# 配置项速查

> 按主题分组的常用 config.toml 配置项，列出键名、类型、默认值与作用（基于 Codex CLI v0.167.0）

本页挑出日常高频使用的配置项并按主题分组，键名、取值与默认值以 v0.167.0 源码为准。完整清单（含 MCP、插件、浏览器、遥测等数百项）见官方 [Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference) 与 [JSON Schema](https://developers.openai.com/codex/config-schema.json)；文件位置与优先级见[配置文件](/manual/agent/codex/configuration)。

表中“—”表示默认不设置；`a.b` 形式的键在文件里写作 `[a]` 表下的 `b`。

## 模型与推理

| 键 | 类型 / 取值 | 默认 | 作用 |
| --- | --- | --- | --- |
| `model` | 字符串 | 模型目录的默认模型 | 默认使用的模型 |
| `review_model` | 字符串 | 当前会话模型 | `/review` 使用的模型 |
| `model_reasoning_effort` | `low`、`medium`、`high`、`xhigh`、`max`、`ultra` 等 | 模型默认 | 推理强度，可用档位由模型决定；`reasoning_effort_override`（v0.163.0 起默认开启）允许请求超出目录预设列表的档位 |
| `plan_mode_reasoning_effort` | 同上 | 计划模式预设 | 计划模式专用的推理强度 |
| `model_reasoning_summary` | `auto`、`concise`、`detailed`、`none` | 模型默认 | 推理摘要的详细程度；本地 TUI 新会话未设置时按 `none` 请求，TUI 状态行的实时推理摘要（v0.155.0 起）要设成其他值才会出现 |
| `model_verbosity` | `low`、`medium`、`high` | 模型默认 | 回答详略 |
| `model_context_window` | 整数 | 模型默认 | 上下文窗口 token 数 |
| `model_auto_compact_token_limit` | 整数 | 模型默认 | 触发自动压缩的 token 阈值 |
| `model_post_turn_compact_threshold_percent` | 整数 0～100 | — | 一轮结束后，上下文用量达到可用窗口的这个百分比就先压缩；省略或设为 `0` 表示不启用（v0.156.0 起） |
| `service_tier` | 字符串 | — | 服务档位，如 `fast`（即 `priority`）、`ultrafast`、`flex`、`default` |
| `personality` | `none`、`friendly`、`pragmatic` | — | 已弃用：v0.156.0 起 `friendly`、`pragmatic` 不再改变回复风格，`/personality` 也已移除；`none` 仍会去掉模型指令里的 Personality 小节 |
| `hide_agent_reasoning` | 布尔 | `false` | 隐藏推理事件（TUI 与 `codex exec`） |
| `show_raw_agent_reasoning` | 布尔 | `false` | 显示模型输出的原始推理内容 |
| `model_catalog_json` | 路径 | — | 启动时加载的自定义模型目录（v0.167.0 起取消了 1 MiB 文件大小上限） |

## 模型提供方

| 键 | 类型 / 取值 | 默认 | 作用 |
| --- | --- | --- | --- |
| `model_provider` | 字符串 | `openai` | 使用哪个提供方（内置支持 `openai`、`amazon-bedrock`、`gcp`、`ollama`、`lmstudio` 等） |
| `openai_base_url` | 字符串 | — | 改写内置 `openai` 提供方的地址（代理、数据驻留） |
| `oss_provider` | `ollama`、`lmstudio` | — | `--oss` 的默认本地提供方，未设时交互询问 |
| `model_providers.<id>.base_url` | 字符串 | — | 提供方 API 地址 |
| `model_providers.<id>.env_key` | 字符串 | — | 存放 API Key 的环境变量名 |
| `model_providers.<id>.wire_api` | `responses` | `responses` | 协议，`chat` 已不再支持 |
| `model_providers.<id>.query_params` | 表 | — | 追加到请求 URL 的查询参数 |
| `model_providers.<id>.http_headers` | 表 | — | 固定请求头；`env_http_headers` 则从环境变量取值 |
| `model_providers.<id>.request_max_retries` | 整数 | `4` | HTTP 请求重试次数 |
| `model_providers.<id>.stream_max_retries` | 整数 | `5` | 流式响应中断后的重连次数 |
| `model_providers.<id>.stream_idle_timeout_ms` | 整数 | `300000` | 流式响应空闲超时（毫秒） |
| `model_providers.<id>.requires_openai_auth` | 布尔 | `false` | 使用 OpenAI 登录凭证 |
| `model_providers.<id>.auth.command` | 字符串 | — | 通过外部命令获取 bearer token |
| `model_providers.<id>.model_catalog_url` | 字符串 | — | Codex 格式模型目录的完整地址，获取时带上该提供方的认证、请求头与查询参数（v0.156.0 起；v0.167.0 起内置 `openai` 提供方也允许单独覆盖该项并取消了 1 MiB 大小限制） |
| `model_providers.<id>.capabilities` | 表（`supports_remote_compaction`、`supports_turn_metadata_header`、`supports_web_search`、`supports_image_generation`、`supports_Parallel_tool_calls`） | 依提供方而定 | 显式声明自定义提供方支持的传输层能力（v0.165.0 起） |
| `model_providers.<id>.gateway_oauth` | 表（`authorization_url`、`token_url`、`client_id`、`delivery`、`credentials_store` 等） | — | 提供方网关额外要求的 OAuth 凭据：浏览器登录后按 `delivery` 放进请求头或 cookie，与主认证一起发送；`credentials_store` 可选 `auto`、`file`、`keyring`（v0.156.0 起） |
| `model_providers.amazon-bedrock.aws.profile` | 字符串 | — | AWS CLI 配置档名，配合 `aws.region` 使用 |
| `model_providers.amazon-bedrock.aws.credential_export` | 表（`command`、`args`、`timeout_ms`） | — | 用外部命令导出 Bedrock 签名所需的 AWS 凭据，`timeout_ms` 默认 `30000`，不能与 `aws.profile` 同用（v0.155.0 起） |
| `model_providers.gcp.project_id` | 字符串 | — | Google Cloud Vertex AI 项目 ID（也可由 `GOOGLE_CLOUD_PROJECT` 提供，v0.165.0 起） |
| `model_providers.gcp.location` | 字符串 | `global` | Vertex AI 区域或 `global`（也可由 `GOOGLE_CLOUD_LOCATION` 提供，v0.165.0 起） |
| `model_providers.gcp.credential_file` | 路径 | — | 显式指定 ADC 凭据 JSON 文件路径（也可由 `GOOGLE_APPLICATION_CREDENTIALS` 提供，v0.165.0 起） |

## 审批与沙箱

| 键 | 类型 / 取值 | 默认 | 作用 |
| --- | --- | --- | --- |
| `approval_policy` | `on-request`、`never`、`{ granular = { ... } }` | `on-request` | 何时暂停请求审批；`untrusted` 已不支持 |
| `approval_policy.granular.*` | 布尔 | — | `sandbox_approval`、`rules`、`mcp_elicitations`、`request_permissions`、`skill_approval`，为 `false` 的类别自动拒绝 |
| `approvals_reviewer` | `user`、`auto_review` | `user` | 审批请求交给谁审 |
| `auto_review.policy` | 字符串 | — | 自动审查的本地策略，托管的 `guardian_policy_config` 优先 |
| `auto_review.extra_policy` | 字符串 | — | 追加给自动审查的策略文本，托管的 `guardian_extra_policy` 优先（v0.157.0 起） |
| `sandbox_mode` | `read-only`、`workspace-write`、`danger-full-access` | 见下方说明 | 执行命令时的沙箱模式 |
| `sandbox_workspace_write.writable_roots` | 路径数组 | `[]` | 额外的可写目录 |
| `sandbox_workspace_write.network_access` | 布尔 | `false` | 允许沙箱内命令联网 |
| `sandbox_workspace_write.exclude_tmpdir_env_var` | 布尔 | `false` | 不把 `$TMPDIR` 视为可写 |
| `sandbox_workspace_write.exclude_slash_tmp` | 布尔 | `false` | 不把 `/tmp` 视为可写 |
| `default_permissions` | 字符串 | — | 默认权限配置档（beta），如 `:workspace` |
| `permissions.<name>.*` | 表 | — | 自定义权限配置档，不可与 `sandbox_mode` 混用 |
| `allow_login_shell` | 布尔 | `true` | 是否允许 shell 工具使用登录 shell |
| `projects.<path>.trust_level` | `trusted`、`untrusted` | — | 项目信任状态 |
| `windows.sandbox` | `elevated`、`unelevated`、`mxc` | — | 原生 Windows 沙箱实现；`mxc` 使用微软的 MXC 容器，需要系统支持（v0.156.0 起） |
| `web_search` | `disabled`、`cached`、`indexed`、`live` | `cached` | 网页搜索模式，完全访问时默认为 `live` |

`sandbox_mode` 未设置时：已有信任决定（`trusted` 或 `untrusted`）的目录默认 `workspace-write`，其余目录默认 `read-only`；原生 Windows 未配置沙箱时，`workspace-write` 会降为 `read-only`。原来的 `windows.sandbox_private_desktop` 已在 v0.156.0 移除，elevated 与 unelevated 沙箱一律在私有桌面上运行。

## Shell 与命令执行

| 键 | 类型 / 取值 | 默认 | 作用 |
| --- | --- | --- | --- |
| `shell_environment_policy.inherit` | `all`、`core`、`none` | `all` | 子进程环境变量的初始集合 |
| `shell_environment_policy.ignore_default_excludes` | 布尔 | `true` | 为 `true` 时不自动剔除名含 `KEY`、`SECRET`、`TOKEN` 的变量 |
| `shell_environment_policy.set` | 表 | — | 强制设置的变量 |
| `shell_environment_policy.filters` | 表（`include` / `exclude`） | — | 按模式过滤变量，不区分大小写 |
| `shell_environment_policy.exclude` | 数组 | — | 旧写法（另有 `include_only`），不能与 `filters` 同层混用 |
| `shell_environment_policy.experimental_use_profile` | 布尔 | `false` | 用用户的 shell profile 启动子进程 |
| `background_terminal_max_timeout` | 整数（毫秒） | `300000` | 轮询后台终端输出的等待时间上限 |
| `tool_output_token_limit` | 整数 | — | 单个工具输出存入历史的 token 预算 |

## 项目指令

| 键 | 类型 / 取值 | 默认 | 作用 |
| --- | --- | --- | --- |
| `project_doc_max_bytes` | 整数 | `32768` | 项目级 `AGENTS.md` 合计读取上限（字节） |
| `project_doc_fallback_filenames` | 字符串数组 | `[]` | `AGENTS.md` 缺失时尝试的备用文件名 |
| `project_root_markers` | 字符串数组 | `[".git"]` | 判定项目根的标记，`[]` 表示只看当前目录；写在项目配置里不影响查找 |
| `developer_instructions` | 字符串 | — | 额外注入的开发者指令 |
| `model_instructions_file` | 路径 | — | 替换内置模型指令（官方不建议） |
| `compact_prompt` | 字符串 | — | 自定义历史压缩提示词；只用于本地压缩，OpenAI、Azure、Amazon Bedrock 等走服务端压缩的提供方不使用它 |

## 通知与界面

| 键 | 类型 / 取值 | 默认 | 作用 |
| --- | --- | --- | --- |
| `notify` | 字符串数组 | — | 回合结束时调用的外部程序 |
| `tui.notifications` | 布尔或字符串数组 | `true` | 开关 TUI 通知，或只保留指定事件 |
| `tui.notification_method` | `auto`、`osc9`、`bel` | `auto` | 终端通知方式 |
| `tui.notification_condition` | `unfocused`、`always` | `unfocused` | 仅在终端失焦时通知，还是始终通知 |
| `tui.animations` | 布尔 | `true` | 动画总开关；v0.156.0 起，首次启动检测到屏幕阅读器、而你又没设置过这一项时，会写入 `false`，系统开启“减少动态效果”时也不播放动画 |
| `tui.effects.<效果>` | 布尔 | `true` | 分别开关 `starfield`、`shimmer`、`welcome`、`effort`、`progress`、`title` 六种效果，受 `tui.animations` 约束；v0.156.0 起取代 `tui.whimsy`。v0.158.0 起旧键 `tui.whimsy` 作为 `tui.effects.starfield` 的别名重新生效，同一文件里两者都写时以 `tui.effects.starfield` 为准 |
| `tui.alternate_screen` | `auto`、`always`、`never` | `auto` | 是否使用终端备用屏幕；v0.157.0 起，`auto` 在通过 SSH 使用 macOS Terminal.app 时改用内联模式 |
| `tui.fullscreen_transcript` | 布尔 | `true` | 全屏对话记录，由 Codex 接管滚动、选择与搜索；v0.156.0 新增时默认 `false`，v0.157.0 起默认 `true`。不使用备用屏幕时不生效，可用 `/tui` 切换 |
| `tui.mouse_scroll_speed` | 浮点数 | `1.0` | 调整全屏模式下鼠标滚轮或触控板滚动的速度倍率（v0.165.0 起） |
| `tui.copy_on_select` | `auto`、`always`、`never` | `auto` | 在 Codex 接管的对话记录或输入框（v0.164.0 起扩展到输入框）中用鼠标选中文字、松开鼠标时是否自动复制；`auto` 在已知会自行转发复制快捷键的终端（Ghostty 1.2 及以上、macOS 上的 Kitty、Windows Terminal、Windows 上的 VS Code）里不自动复制，其他终端以及 tmux、Zellij 里照常复制（v0.158.0 起） |
| `tui.copy_on_select_clear_selection` | 布尔 | `false` | 自动复制选中文本后是否立即清除选区高亮 |
| `tui.right_click_paste` | `auto`、`on`、`off` | `auto` | 全屏模式下没有选中文字时，右键把剪贴板文本粘贴进输入框；`auto` 只在 Windows、WSL、Linux 上启用，`on` 连 macOS 也启用，SSH 会话和 VS Code 终端里一律不启用（v0.158.0 起） |
| `tui.rendering.<类型>` | 布尔 | `true` | 分别开关 `mermaid`（图表）、`math`（公式）、`tables`（表格）与 `lists`（列表符号，v0.157.0 起）的渲染，关闭后显示原文（v0.156.0 起） |
| `tui.show_tooltips` | 布尔 | `true` | 启动时的使用提示；v0.158.0 起全屏对话记录不再在开头显示，改为在回合运行超过 30 秒时或回合结束后偶尔显示一条，同样由它开关 |
| `tui.show_server_version_notice` | 布尔 | `true` | 连接的 app server 与 CLI 版本不同时显示提示，不影响兼容性报错（v0.155.0 起；v0.156.0 起预发布版与本地构建也会提示） |
| `tui.theme` | 字符串 | 自动 | 语法高亮主题；v0.156.0 起内置 `ada`、`babbage`、`curie`、`cushman`、`dali`、`davinci` 等主题 |
| `tui.status_line` | 字符串数组 | `model-with-reasoning`、`current-dir`、`thread-name` | 状态栏显示项；v0.166.0 起新增 `profile` 与 `provider` 展示项 |
| `tui.terminal_title` | 字符串数组 | `activity`、`thread-name`、`project-name` | 终端标题显示项 |
| `tui.vim_mode_default` | 布尔 | `false` | 输入框默认进入 Vim 模式 |
| `tui.raw_output_mode` | 布尔 | `false` | 以便于复制的原始回滚模式启动 |
| `tui.presets.<0..9>` | 表（`input`、`label`） | — | 数字键快捷预设（v0.164.0 起），用 `/presets` 或 `Ctrl+X 0..9` 触发；`input` 长度上限 8000 字节且不可用 `!` 开头 |
| `tui.keymap.<context>.<action>` | 字符串或数组 | — | 自定义快捷键，空数组表示解绑。支持 `Command` / `Super` 修饰键与双键序列（如默认的 `Ctrl+X` 前缀键，v0.163.0 起）；v0.167.0 起支持 `chat.toggle_voice_mute`（默认 `f9`） |
| `realtime.voice` | 字符串 | 服务端默认 | 语音对话使用的声音，如 `marin`、`cedar`；`/voice settings` 会写入它（v0.156.0 起） |
| `file_opener` | `vscode`、`vscode-insiders`、`windsurf`、`cursor`、`none` | `vscode` | 文件引用链接使用的 URI 方案 |
| `check_for_update_on_startup` | 布尔 | `true` | 启动时检查更新 |

## 历史、日志与凭证

| 键 | 类型 / 取值 | 默认 | 作用 |
| --- | --- | --- | --- |
| `history.persistence` | `save-all`、`none` | `save-all` | 是否写入 `history.jsonl` |
| `history.max_bytes` | 整数 | — | 历史文件大小上限，超出时丢弃较早记录 |
| `log_dir` | 路径 | `$CODEX_HOME/log` | 日志目录，显式设置时额外写 `codex-tui.log` |
| `sqlite_home` | 路径 | `CODEX_SQLITE_HOME` 或 `CODEX_HOME` | SQLite 状态库位置 |
| `cli_auth_credentials_store` | `file`、`keyring`、`auto`、`ephemeral` | `file` | CLI 登录凭证存放方式 |
| `mcp_oauth_credentials_store` | `auto`、`file`、`keyring` | `auto` | MCP OAuth 凭证存放方式 |
| `forced_login_method` | `chatgpt`、`api` | — | 限定登录方式 |
| `analytics.enabled` | 布尔 | `true` | 匿名使用与健康数据上报 |
| `feedback.enabled` | 布尔 | `true` | 是否允许 `/feedback` |

## 功能开关

`[features]` 表中的常用键，`codex features list` 可列出全部：

| 键 | 默认 | 成熟度 | 作用 |
| --- | --- | --- | --- |
| `hooks` | `true` | 稳定 | 生命周期 hooks |
| `multi_agent` | `true` | 稳定 | 子代理协作工具 |
| `multi_agent_v2` | `false` | 稳定 | 路径寻址（`/root/...`）的多代理协作工具集（v0.161.0 起支持 Amazon Bedrock） |
| `goals` | `true` | 稳定 | 持久化目标与自动续跑 |
| `fast_mode` | `true` | 稳定 | Fast 服务档位选择 |
| `ultrafast_mode` | `true` | 稳定 | Ultrafast 服务档位选择 |
| `reasoning_effort_override` | `true` | 稳定 | 允许请求超出模型目录预设档位列表的推理强度（v0.163.0 起默认开启） |
| `api_key_model_discovery` | `true` | 稳定 | 使用 API Key 登录时从 `/v1/models` 动态发现可用模型（v0.163.0 起默认开启） |
| `cli_daybreak` | `true` | 稳定 | 在 TUI 中启用 `/daybreak` 命令（v0.163.0 起默认开启） |
| `bedrock_setup_wizard` | `true` | 稳定 | 登录流程中展示 Amazon Bedrock 配置向导（v0.164.0 起默认开启） |
| `gcp_setup_wizard` | `false` | 稳定 | 登录流程中展示 Google Cloud Vertex AI 配置向导（v0.167.0 起） |
| `apps` | `true` | 稳定 | App（连接器）集成 |
| `plugins` | `true` | 稳定 | 插件 |
| `shell_snapshot` | `true` | 稳定 | 快照 shell 环境以加速重复命令 |
| `memories` | `false` | 稳定 | 记忆功能 |
| `daemon_auto_start` | `true` | 稳定 | 交互式启动时自动拉起共享的后台服务（v0.157.0 起默认开启） |
| `system_proxy_fallback` | `true` | 稳定 | 登录与启动阶段的请求直连失败时，改走系统代理重试（v0.156.0 起） |
| `write_stdin_approval` | `true` | 稳定 | 模型向已在运行的终端写入输入时，若该终端是在沙箱外启动的、带着额外授予的权限，或沙箱设置已与当前权限不一致，要先经过审批（v0.158.0 起默认开启） |
| `network_proxy` | `false` | 实验 | 按域名策略约束已联网的沙箱命令 |
| `respect_system_proxy` | `false` | 实验 | 尊重系统代理配置（v0.167.0 起） |
| `prevent_idle_sleep` | `false` | 实验 | 运行期间阻止系统休眠 |
| `analytics_plan_history` | `false` | 实验 | 在用量分析面板里预览个人套餐的五小时与每周额度历史（v0.156.0 起） |
| `login_shell_package_path` | `false` | 实验 | 在登录 shell 中注入捆绑工具路径 |

多个旧功能开关已因能力固化而退役（配置里残留时会被忽略并在必要时给出清理提示）：`personality`（v0.156.0）、`guardianv2.thread_context`（v0.158.0，自动审查始终使用线程上下文）、`apply_patch_preserve_line_endings`（v0.162.0，`apply_patch` 默认保留 CRLF）、`shell_zsh_fork` 与 `unified_exec_zsh_fork`（v0.163.0，改用标准 shell 执行器）、`worktrees`（v0.165.0，Git worktree 支持常驻开启）、`realtime_conversation`（v0.166.0，包含语音运行时的构建常驻开启）、`transcript_v2`（请改用 `tui.fullscreen_transcript`）以及 `web_search_cached` / `web_search_request`（请改用顶层 `web_search`）。

## MCP 服务器（摘要）

| 键 | 类型 / 取值 | 默认 | 作用 |
| --- | --- | --- | --- |
| `mcp_servers.<id>.command` | 字符串 | — | stdio 服务器的启动命令（配合 `args`、`env`、`cwd`） |
| `mcp_servers.<id>.url` | 字符串 | — | 可流式 HTTP 服务器地址 |
| `mcp_servers.<id>.bearer_token_env_var` | 字符串 | — | 从环境变量读取 bearer token |
| `mcp_servers.<id>.enabled` | 布尔 | — | 设为 `false` 可停用而不删除配置 |
| `mcp_servers.<id>.required` | 布尔 | — | 为 `true` 时初始化失败会让启动失败 |
| `mcp_servers.<id>.startup_timeout_sec` | 数字 | `30` | 启动超时（秒）；官方文档写作 `10` |
| `mcp_servers.<id>.startup_readiness` | `connection`、`catalog` | `connection` | 启动时是否必须等实时连接就绪；设为 `catalog` 时可先用有效的缓存工具清单把工具提供给模型，真正调用工具仍需实时连接。与 `required = true` 同用时，有效的缓存也算启动成功，连接失败要到调用工具时才报错（v0.158.0 起） |
| `mcp_servers.<id>.tool_timeout_sec` | 数字 | `300` | 单次工具调用超时（秒）；官方文档写作 `60` |
| `mcp_servers.<id>.enabled_tools` | 数组 | — | 工具白名单，另有黑名单 `disabled_tools` |
| `mcp_servers.<id>.tool_input_schema_max_bytes` | 整数（字节） | `5000` | 单个工具的输入 schema 超过这个大小时逐步压缩（先删参数说明，再删定义等），调大可保留更多参数说明（v0.158.0 起） |
| `mcp_servers.<id>.oauth.client_secret` | 字符串 | — | 预注册 OAuth 客户端的密钥，换取令牌时使用，必须同时设置 `oauth.client_id`；也可用 `codex mcp add --oauth-client-secret` 写入（v0.158.0 起） |

完整字段与用法见 [MCP 集成](/manual/agent/codex/mcp)。

## 其他

| 键 | 类型 / 取值 | 默认 | 作用 |
| --- | --- | --- | --- |
| `agents.max_concurrent_threads_per_session` | 整数 | 由 Codex 决定 | 同时打开的子代理线程上限 |
| `agents.default_subagent_model` | 字符串 | — | 子代理默认模型，见[子代理](/manual/agent/codex/subagents) |
| `plugins.<id>.enabled` | 布尔 | `false` | 启用或停用已安装的插件 |
| `plugins.<id>.apps.<connector_id>.*` | 表 | — | 在插件配置内直接设置关联连接器（App）的启用状态与审批策略（v0.167.0 起） |
| `hooks.<Event>` | 表数组 | — | 内联 hooks，见 [Hooks](/manual/agent/codex/hooks) |
| `memories.version` | `v1`、`v2` | 新配置档默认 `v2` | 记忆管线版本，`v2` 的数据单独存放（v0.155.0 起；v0.165.0 起新开启记忆的配置档默认采用 `v2`） |
| `memories.dual_write` | 布尔 | `false` | 两个版本的记忆同时生成，上下文仍取 `memories.version` 选中的版本（v0.155.0 起） |
| `otel.exporter` | `none`、`otlp-http`、`otlp-grpc` | `none` | OpenTelemetry 日志导出 |
| `otel.log_user_prompt` | 布尔 | `false` | 导出时是否包含用户提示原文 |
| `otel.log_agent_responses` | 布尔 | `false` | 把主代理与子代理的最终回复写入 OTLP 日志，只在 `otel.exporter` 为 `otlp-http` 或 `otlp-grpc` 时生效；内容可能敏感，每条上限为 64 KiB（v0.158.0 起） |
| `otel.log_guardian_assessments` | 布尔 | `false` | 把自动审查完成的评估（含理由）写入 OTLP 日志，生效条件同上，理由上限为 64 KiB（v0.158.0 起） |

## requirements.toml 常用键

以下键只在管理员下发的 `requirements.toml`（或系统级 MDM / Windows 注册表策略）中有意义，用户与项目配置无法越过：

| 键 | 作用 |
| --- | --- |
| `allowed_approval_policies` | 允许的 `approval_policy`；列入 `untrusted` 表示允许不信任项目派生出的严格策略 |
| `allowed_approvals_reviewers` | 允许的 `approvals_reviewer` |
| `allowed_sandbox_modes` | 允许的 `sandbox_mode` |
| `allowed_permission_profiles` | 允许的权限配置档，未列出的一律禁止 |
| `allowed_web_search_modes` | 允许的 `web_search` 模式，`disabled` 始终允许 |
| `guardian_policy_config` | 托管的自动审查策略，优先于本地 `auto_review.policy` |
| `guardian_extra_policy` | 托管的附加审查策略，优先于本地 `auto_review.extra_policy`（v0.157.0 起） |
| `model_provider`、`model_providers` | 强制选用的提供方，以及整体替换本地同名条目的提供方定义（v0.156.0 起） |
| `features.<name>` | 锁定某个功能开关的取值 |
| `permissions.filesystem.deny_read` | 跨层级叠加禁止读取的路径或 glob 模式 |
| `permissions.network` | 托管的网络权限约束（域名策略、Unix 套接字等，v0.165.0 起支持直接配置） |
| `network_proxy` | 托管的网络代理设置（v0.162.0 起） |
| `rules.prefix_rules` | 托管的命令前缀规则列表，取值可为 `prompt`、`prompt-user`（v0.167.0 起，即使开启自动审查也要求真人审批）或 `forbidden` |
| `otel` | 托管的 OpenTelemetry 遥测导出配置（v0.163.0 起） |
| `windows.allowed_sandbox_implementations` | 允许的原生 Windows 沙箱实现 |
| `models.new_thread.model` | 新会话的托管默认模型，显式指定模型或推理强度时失效 |
