---
title: "更新日志"
description: "Codex CLI 近期稳定版（0.149 → 0.167.0）的新特性、行为变更与重要修复，整理自 GitHub Releases。"
source: "https://daiw.org/manual/codex/changelog"
---

# 更新日志

> Codex CLI 近期稳定版（0.149 → 0.167.0）的新特性、行为变更与重要修复，整理自 GitHub Releases。

Codex CLI 的变更记录已经不写在仓库的 `CHANGELOG.md` 里——那个文件只有一句指向 [GitHub Releases](https://github.com/openai/codex/releases) 的说明（偶尔在 Unreleased 小节里补记一两条修复）。本页整理近期的稳定版，只挑对 CLI 日常使用有影响的条目；某个版本完整的 PR 列表请看对应的发布页。

**本手册基准版本：v0.167.0**（2026-11-06 发布）。稳定版之间还夹着大量 `rust-v0.x.y-alpha.N` 预发布版本，本页不收录。查看本机版本用 `codex --version`，升级用 `codex update`（见[安装、登录与升级](/manual/agent/codex/installation)）。

标记约定：🆕 新特性；⚠️ 行为变更（可能影响你现有的用法）；其余为修复与体验优化。

## v0.167.0（2026-11-06）

- 🆕 **内嵌模式下的代理指挥中心与未读标记**：支持通过 `codex agents --no-daemon`（以及内嵌会话中的 `/agents`）在不依赖共享后台服务的情况下打开代理指挥中心；代理指挥中心与会话选择器现在会标记包含未读结果的会话（见[子代理与多 Agent 协作](/manual/agent/codex/subagents)、[会话管理](/manual/agent/codex/sessions)）。
- 🆕 **终端会话选择器切换后端**：可在会话选择器中直接切换已连接的对话后端，切换时保留当前输入框草稿（见[会话管理](/manual/agent/codex/sessions)）。
- 🆕 **本地图片附件预览与点击打开**：在支持图形协议的终端中编写输入时即可预览本地图片附件，对话记录里查看过的本地图片路径也支持点击直接打开（见[斜杠命令](/manual/agent/codex/slash-commands)）。
- 🆕 **云厂商登录入口与 Vertex AI 向导**：登录引导界面将 API Key 与云端模型提供方统一收纳到“Sign in another way”下；启用 `features.gcp_setup_wizard = true` 后可通过向导配置 Google Cloud Vertex AI（支持 Application Default Credentials 或服务账号凭据文件，见[安装、登录与升级](/manual/agent/codex/installation)、[模型与推理](/manual/agent/codex/models)）。
- 🆕 **系统代理与补丁详情展开**：`/experimental` 菜单新增“System proxy”（`features.respect_system_proxy`），允许 Codex 请求直接读取 macOS 或 Windows 系统代理设置；审批提示打开期间，可以直接在对话记录中展开补丁详情。
- 🆕 **托管网络约束与 `prompt-user` 命令规则**：管理员配置支持在 `[permissions.network]` 下声明托管网络约束，并在命令规则中使用要求人工即时确认的 `prompt-user` 决策（见[配置参数参考](/manual/agent/codex/config-reference)、[命令审批规则](/manual/agent/codex/rules)）。
- 🆕 **插件应用设置与网关 OAuth 凭据存储**：插件配置支持关联 app 设置；新增网关 OAuth 凭据的文件级持久化存储（见[插件与组件包](/manual/agent/codex/plugins)）。
- 修复项：切换模型提供方后已保存的历史会话仍保持可见，遇到无法直接恢复的会话时可以阅读完整对话记录并生成可编辑的提示词到新会话中继续；`Ctrl+L` 清屏后仍可通过 `Ctrl+T` 查看此前消息；删字后露出句首 `!` 时保持在普通对话草稿模式而不误切入 shell 模式；网络审批提示在对应请求结束时自动关闭，发往同一端点的并发请求逐一提示；长时语音（Realtime V3）会话在记录增长时分批将已完成的语音保存到对话历史；自动上下文压缩会正确计入失败响应保留的输出以及缺少 token 统计的响应。

完整变更见 [v0.167.0](https://github.com/openai/codex/releases/tag/rust-v0.167.0)。

## v0.166.0（2026-10-29）

- 🆕 **键盘驱动的对话记录选区与搜索**：支持用键盘按词、行、页移动选区，内置搜索并可自定义快捷键；警告查看器（`/warnings`）也支持文本选择与鼠标滚轮滚动；异步提问、选项、回答与对话回复统一渲染 Markdown（见[斜杠命令](/manual/agent/codex/slash-commands)）。
- 🆕 **GPT-6.1 Terra 扩展至各大模型目录**：随附模型目录、Google Cloud Vertex AI 与 Amazon Bedrock 目录均已收录 `gpt-6.1-terra`；移除显式模型目录响应的 1 MiB 体积限制，并允许为内置 OpenAI 提供方覆盖模型目录 URL（见[模型与推理](/manual/agent/codex/models)）。
- 🆕 **`codex queue --resume` 与 `codex doctor --network-only`**：`codex queue --resume` 可在消息入队后唤醒未加载的会话；`codex doctor --network-only` 聚焦执行配置、网络连通性与 WebSocket 诊断（见[命令行参考](/manual/agent/codex/cli-flags)、[安装、登录与升级](/manual/agent/codex/installation)）。
- 🆕 **安全拦截说明与替代提示**：TUI 提供更清晰的安全拦截原因说明，并给出可直接选用的合规跟进提示词。
- 🆕 **托管配置与 MCP 连接复用**：管理员 `requirements.toml` 支持配置 `network_proxy` 与 OpenTelemetry 策略要求；符合条件的本地 stdio MCP 连接支持跨会话复用（`features.mcp_connection_sharing`）；状态栏新增 `profile` 与 `provider` 显示项，`/status` 显示当前选中的 ChatGPT 工作区（见[配置参数参考](/manual/agent/codex/config-reference)、[MCP 集成](/manual/agent/codex/mcp)）。
- 修复项：恢复或分叉会话时保留已确认的审批与权限设置，并保留推理 token 累计值以避免过早触发上下文压缩；撤回恢复已删除的输入框文本时保留本地图片附件；反归档父会话时一并恢复其派生的子代理线程；修复 app-server 线程启动与关闭竞态，改进 TUI 断线重连恢复及离线状态下的 `/quit`、`/exit` 退出处理。

完整变更见 [v0.166.0](https://github.com/openai/codex/releases/tag/rust-v0.166.0)。

## v0.165.0（2026-10-27）

- 🆕 **内置 Google Cloud Vertex AI 提供方**：新增内置模型提供方 `model_provider = "gcp"`（并在 v0.166.0 支持在提供方配置中指定 GCP 项目、区域与凭据文件覆盖，见[模型与推理](/manual/agent/codex/models)、[配置参数参考](/manual/agent/codex/config-reference)）。
- 🆕 **新增 GPT-6.1 Terra 模型**：模型目录引入 `gpt-6.1-terra`（基础上下文窗口 500K token，上限 872K token，见[模型与推理](/manual/agent/codex/models)）。
- 🆕 **会话仓库筛选与目录分组**：会话选择器支持按代码仓库筛选，代理指挥中心支持按目录分组，方便在关联的多个 Git worktree 之间定位会话（见[会话管理](/manual/agent/codex/sessions)）。
- 🆕 **对话中途切换推理强度默认开启**：特性开关 `reasoning_effort_override` 默认启用，支持在对话进行中动态调整推理强度并即时生效；全新配置默认启用第二代记忆（Memory v2），并支持导入外部 agent 的记忆（`features.external_agent_memory_import`）；app-server API 新增实验性的附着式线程分叉（attached thread forks）。
- 修复项：新建 TUI 会话在未显式指定覆盖时遵循服务端默认的审批审查器（approval reviewer）；执行设置无效时仍允许编辑并立即应用 TUI 界面偏好；本地响应 future 被丢弃时自动取消远端 MCP 工具请求；中断轮次或切入 Plan 模式后不再因排队的代理消息而意外重启工作；模型提供方返回“模型不存在”时立即停止重试并原样保留报错信息。

完整变更见 [v0.165.0](https://github.com/openai/codex/releases/tag/rust-v0.165.0)。

## v0.164.0（2026-10-23）

- 🆕 **`/presets` 预设槽位与行内命令参数**：新增 `/presets` 命令，可将常用提示词或斜杠命令保存在 10 个编号槽位中并通过快捷键菜单快速调用；`/model`、`/permissions`、`/title`、`/statusline` 支持直接在命令行内传入参数（如快速切换模型、推理强度、速度档位、权限档案或仅对当前会话生效的标题栏/状态栏设置，见[斜杠命令](/manual/agent/codex/slash-commands)）。
- 🆕 **终端内嵌图片预览**：在支持 Kitty 或 Sixel 图形协议的终端上，全屏对话记录可直接预览模型查看或生成的图片。
- 🆕 **企业级 MCP 鉴权与远程命令凭据脱敏**：企业 MCP 连接支持使用符合条件的 Codex 账号授权或独立登录（含需要客户端密钥的 OAuth 客户端）；远程 Bash 命令与 Zsh 快照会话执行期间自动对凭据（含自定义提供方凭据）进行脱敏；休眠中的 MCP 服务器在被生命周期钩子（hooks）调用时会自动按需启动（见 [MCP 集成](/manual/agent/codex/mcp)、[Hooks 生命周期钩子](/manual/agent/codex/hooks)）。
- 🆕 **Bedrock 向导默认启用与 Windows 注册表托管策略**：Amazon Bedrock 登录设置向导（`bedrock_setup_wizard`）默认开启，检测到 AWS 凭据时将 API Key 输入与其他 AWS 登录方式集中展示；管理员约束 `requirements.toml` 支持通过 Windows 注册表配置覆盖；TUI 键位映射支持绑定 `Command`/`Super` 修饰键，选中即复制（`copy_on_select`）扩展至底部输入框文本。
- ⚠️ **退役多个旧特性开关**：`worktrees` 与 `realtime_conversation`（语音）特性开关完成退役（功能本身已常驻可用），`transcript_v2` 标记为已移除（请改用 `tui.fullscreen_transcript`，见[配置参数参考](/manual/agent/codex/config-reference)）。
- 修复项：上下文压缩失败不再在对话历史中残留半截摘要，后台压缩失败时平滑回退而不崩溃；恢复会话可读取压缩格式的历史记录并还原会话专属设置，不再被全局默认值覆盖；Windows 下 HTTPS 与 WebSocket 连接支持使用当前登录用户的 Negotiate 或 NTLM 凭据完成代理鉴权；多层子命令同时传入 `-c` / `--config` 时完整保留全部覆盖项；自动清理未使用的历史安装版本、废弃的插件市场检出目录并限制守护进程日志体积。

完整变更见 [v0.164.0](https://github.com/openai/codex/releases/tag/rust-v0.164.0)。

## v0.163.0（2026-10-15）

- 🆕 **`/config` 交互式配置面板**：新增 `/config` 斜杠命令，支持按分类搜索偏好设置、立即修改受支持的选项，并直观标注哪些改动需要重启后生效（见[斜杠命令](/manual/agent/codex/slash-commands)、[配置文件与优先级](/manual/agent/codex/configuration)）。
- 🆕 **即时引导打断（`instant_interrupt`）默认开启**：在 Codex 回复期间发送跟进消息可立即引导其转向，打断轮次时会同步终止活跃的 Code Mode 单元及其嵌套工具调用；Codex 现在还能并行执行相互独立的只读工具调用（包括技能、记忆与对话历史检索）。
- 🆕 **前导键（Leader Key）与 `/daemon` 重启**：`/keymap` 支持配置前导键（默认为 `Ctrl+X`），快捷键提示保持展开直至选择或取消，语音静音快捷键移至 `F9`；`/daemon` 菜单支持直接重启本机托管后台服务（重启前会提示可能中断的工作并自动重连）。
- 🆕 **Daybreak 默认启用与 Bedrock Ultrafast**：符合条件的账号默认开启 `cli_daybreak`，服务端开放权限时 `codex exec` 也可配合 OpenAI API Key 选择 Daybreak；Amazon Bedrock 上的 GPT-6.1 Sol 开放 Ultrafast 服务档位（见[模型与推理](/manual/agent/codex/models)）。
- ⚠️ **移除捆绑的修补版 `zsh`**：Codex 统一使用标准 shell 执行器，不再随附修补版 `zsh`；配置中仍残留 `shell_zsh_fork` 或 `unified_exec_zsh_fork` 的用户会收到迁移提示。
- 修复项：恢复保存的会话时还原其权限与网络审批记录（同时遵循显式命令行覆盖与当前托管策略）；网络代理在发起 DNS 查询前先检查权限、拒绝重复的 `Host` 请求头并防止凭据别名绕过检查钩子；切换会话后仍可用 `/side` 回到已有的支线对话，待处理的审批/提问回答会准确送回发起提问的线程；Windows 下 `Ctrl+V` 与 `Shift+Insert` 同时支持粘贴文本和图片。

完整变更见 [v0.163.0](https://github.com/openai/codex/releases/tag/rust-v0.163.0)。

## v0.162.x（2026-10-08 至 10-09）

- 🆕 **受管 Git Worktree 工具与代理指挥中心置顶**：在受信任的本地项目中，Codex 提供创建与列出受管 Git worktree 的内置工具；代理指挥中心支持按 `p` 置顶任务（服务端支持时归入共享的 Pinned 分组），并跨启动记住分组方式（见[子代理与多 Agent 协作](/manual/agent/codex/subagents)）。
- 🆕 **对话复制增强与滚轮调速**：`/copy` 支持按块浏览并复制对话内容，新增 `Ctrl+Insert` 复制选区，并可通过 `tui.mouse_scroll_speed` 调节鼠标滚轮滚动速度；复制对话选区时同时提供纯文本与富文本 HTML；审批标题、提问、MCP 提示、警告与横幅中的 URL（含跨行折行链接）均可点击打开（见[斜杠命令](/manual/agent/codex/slash-commands)、[配置参数参考](/manual/agent/codex/config-reference)）。
- 🆕 **自定义提供方能力声明与旧版沙箱卸载**：自定义 Responses 兼容模型提供方支持配置实时网页访问（live web access）与远端上下文压缩（remote compaction）能力；Amazon Bedrock Astra 模型支持 Ultrafast 服务档位；回合运行期间允许执行 `/archive`；新增 `codex sandbox uninstall` 命令用于在 Windows 上以管理员身份卸载旧版 Windows 沙箱的全局账户与网络规则（保留 `.codex` 用户数据，见[命令行参考](/manual/agent/codex/cli-flags)）。
- 修复项：`apply_patch` 更新文件时默认保留原有的 CRLF 换行符（无需再开特性开关，`apply_patch_preserve_line_endings` 随之退役）；Windows 发布包附带签名版 PowerShell 安装脚本；v0.162.1 修复异步多行提问导致的 TUI 崩溃，并放宽后台服务与 CLI 默认特性开关不一致时的启动兼容性检查（仅对显式命令行特性覆盖做严格校验）。

完整变更见 [v0.162.0](https://github.com/openai/codex/releases/tag/rust-v0.162.0) 与 [v0.162.1](https://github.com/openai/codex/releases/tag/rust-v0.162.1)。

## v0.161.0（2026-10-07）

- 🆕 **GPT-6.1 Sol 成为默认模型与 Bedrock 增强**：随附模型目录与 Amazon Bedrock 目录将 `gpt-6.1-sol` 设为默认模型；Amazon Bedrock 在兼容模型上支持多代理 V2（`multi_agent_v2`）与 `ultra` 推理强度，且 Bedrock Mantle 支持 AWS GovCloud 区域；`api_key_model_discovery` 默认开启（见[模型与推理](/manual/agent/codex/models)）。
- 🆕 **`/mcp login`、语音设备选择与 Daybreak 控制**：支持在终端会话中直接运行 `/mcp login <name>` 完成 MCP 服务器登录；`/voice settings` 支持选择麦克风、扬声器与输入声道并保存在本机；新增 `/daybreak` 切换命令、`codex exec --cyber-access-program` 标志以及 TypeScript SDK 的 `cyberAccessProgram` 选项，用于按轮次选择网络安全访问计划（`standard`、`daybreak_blue`、`daybreak_red`，见[斜杠命令](/manual/agent/codex/slash-commands)、[非交互执行](/manual/agent/codex/exec)、[SDK 与 App Server](/manual/agent/codex/sdk-app-server)）。
- 🆕 **TUI 与遥测改进**：移除新会话标题栏中的随机问候语；代理指挥中心新增 `f` 快捷键用于分叉会话；通过 OpenTelemetry 导出技能调用事件；由守护进程启动的 app-server 默认开启分析遥测。
- 修复项：获批的文件系统提权在授予更广写入权限的同时保留已拒绝的读取路径与网络限制，后台任务保留发起轮次的权限；提权 Windows 终端会话可回退使用内嵌服务启动；启动阶段更早检测可恢复的 SQLite 损坏并将受损数据库保留为备份。

完整变更见 [v0.161.0](https://github.com/openai/codex/releases/tag/rust-v0.161.0)。

## v0.159.x–v0.160.1（2026-09-29 至 10-05）

- 🆕 **默认模型更新为 GPT-6.1 Sol**：v0.159.1 起随附模型目录及 Amazon Bedrock Mantle / Runtime 目录把 GPT-6.1 Sol 设为默认模型。具体可用项仍受账号套餐、工作区策略与提供方影响，请以 `/model` 选择器为准（见[模型与推理](/manual/agent/codex/models)）。
- 🆕 v0.159.0 增加可选的 `instant_interrupt`，允许新输入在模型回复或长时间 code-mode 调用期间即时引导 Codex；默认关闭。该版还更新了新会话欢迎界面、允许在计划确认期间滚动对话，并改进 Markdown / Mermaid 原生呈现。
- ⚠️ v0.159.0 移除 TUI 自动后续提示及其 `tui.prompt_suggestions` 设置，也移除了随附的 `plugin-creator` 技能；依赖该技能的流程需改为自建技能或插件。
- 🆕 v0.160.0 的代理总览可以键盘分页浏览更早的任务；符合策略时，可在项目外按工作区默认设置启动会话，并在恢复时还原已保存的权限。Guardian 审查可选择取回较早的用户指令及 agent 交接上下文。
- 修复项：v0.159.x 加固 Windows 子进程/MCP 启动、审批拒绝规则与 `.aws` 目录保护；改善 TLS 代理环境。v0.160.0 修复 Windows 沙箱 PowerShell 回退与长路径权限处理，并修正子代理在执行环境启动期间丢失环境配置的问题。
- v0.160.1 为远程 stdio MCP 服务器保留 `SYSTEMROOT`、`TEMP`、`TMP`，修复在 Unix 主机上连接 Windows executor 时丢失启动环境变量的问题。

完整变更见 [v0.159.0](https://github.com/openai/codex/releases/tag/rust-v0.159.0)、[v0.159.1](https://github.com/openai/codex/releases/tag/rust-v0.159.1)、[v0.159.2](https://github.com/openai/codex/releases/tag/rust-v0.159.2)、[v0.159.3](https://github.com/openai/codex/releases/tag/rust-v0.159.3)、[v0.160.0](https://github.com/openai/codex/releases/tag/rust-v0.160.0) 与 [v0.160.1](https://github.com/openai/codex/releases/tag/rust-v0.160.1)。

## GPT-6 Sol 与 GPT-6 Luna

2026-09-22 起，GPT-6 Sol 与 GPT-6 Luna 逐步向 Codex 推出，token 价格低于对应的 GPT-5.6 模型。CLI 分两步收录：

| 版本 | 事件 |
| --- | --- |
| 0.156.1 | 热修复：模型选择器加入 GPT-6 Sol 与 GPT-6 Luna，选用旧模型时提示迁移，触发限流时的换模型提示改为推荐 GPT-6 Luna |
| 0.157.0 | 主线版本收录；Amazon Bedrock 目录加入这两个模型，GPT-6 Sol 成为 Bedrock 的默认模型 |

## GPT-6-Astra 的上线过程

GPT-6-Astra 是分几个热修复版本逐步放出的：

| 版本 | 事件 |
| --- | --- |
| 0.153.1 | 可以通过 API 配置使用 GPT-6-Astra，但不改变默认模型，也不出现在模型选择器里 |
| 0.153.2 | Fast 档的说明文字更正为“2x speed, increased usage”（此前误写为 1.5x；只改文案，不影响请求） |
| 0.153.3 | Amazon Bedrock 的模型选择器加入 GPT-6-Astra（Mantle 与 Runtime 的 global、US 路由） |
| 0.153.4 | 修复 Astra 在内置模型选择器里不显示的问题，并在没有显式配置模型时成为内置默认模型 |
| 0.154.0 | 正式出现在模型选择器与 Amazon Bedrock 目录中 |

模型的选择与配置见[模型与推理](/manual/agent/codex/models)。

## v0.158.0（2026-09-28）

- 🆕 全屏对话记录支持松开鼠标即复制：选中一段对话记录后松开按键，选区就复制到剪贴板，由新配置 `tui.copy_on_select` 控制（`auto`、`always`、`never`）。默认的 `auto` 只在已知会把原生复制快捷键转交给程序的终端里关闭，即 Ghostty 1.2 及以上、macOS 上的 Kitty、Windows Terminal 与 Windows 上的 VS Code，在 tmux、Zellij 与识别不出的终端里一律开启；对话记录视图以及恢复、分叉会话时的预览同样适用。复制出来的选区保留 Markdown 格式，粗体、链接、标题、列表、引用块与表格都还原成 Markdown，只选中代码时仍按原文复制；剪贴板操作改到后台进行，系统剪贴板卡住时界面不再跟着卡住（见[斜杠命令](/manual/agent/codex/slash-commands)）。
- 🆕 全屏模式下没有选区时，右键把剪贴板里的文本粘贴进输入框，由新配置 `tui.right_click_paste` 控制：默认的 `auto` 在 Windows 与 Linux 上开启（WSL 中判断不出是否为 VS Code 终端时除外），`on` 连 macOS 也开启，`off` 把右键完全留给终端；SSH 会话与识别出的 VS Code 终端里一律不启用。有选区时右键仍是复制。
- 🆕 `codex mcp add --oauth-client-secret`：对接要求预注册 OAuth 客户端密钥的 MCP 服务器，必须同时给出 `--url` 与 `--oauth-client-id`。密钥保存在服务器配置的 `oauth.client_secret` 中，换取与刷新 token 时使用，不会出现在授权链接与保存的 token 记录里（见 [MCP 集成](/manual/agent/codex/mcp)）。
- 🆕 MCP 服务器新增两项配置：`startup_readiness = "catalog"` 允许启动阶段先用有效的缓存工具目录，不必等实时连接建立（调用工具仍要等连接就绪），默认 `"connection"`；`tool_input_schema_max_bytes` 调整工具输入 schema 的压缩阈值（默认 5000 字节），调大能保留更多参数说明，Code Mode 另有 `features.code_mode.tool_input_schema_max_bytes`。
- 🆕 `codex exec-server` 的 WebSocket 监听可以要求 bearer token 鉴权，参数与 `codex app-server` 的 `--ws-auth` 一组相同（capability token 或签名的 JWT），不能与 `--remote` 或转发同时使用；app server 连接执行端时也能带上 bearer token（`environment/add` 的 `authBearerToken`，或 `environments.toml` 的 `auth_bearer_token`）。另有 `--linux-sandbox-pid-namespace inherit`，让沙箱沿用调用方的 PID 命名空间与 `/proc`，只适合专用环境（见 [SDK 与 App Server](/manual/agent/codex/sdk-app-server)）。
- 🆕 图像生成可以明确要求透明背景（抠图、去背景时使用），编辑图片时也能引用对话中以文件形式出现的图片。
- 🆕 `otel.log_agent_responses` 与 `otel.log_guardian_assessments`（默认关闭）：把主代理与子代理的最终回答、自动审批审查的评估结果导出到 OTLP 日志（需要配置 OTLP 日志导出器），单条上限 64 KiB。
- 🆕 推理强度快捷键 `Alt+.`、`Shift+Up` 能一路调到 `max`（`ultra` 仍要在选择器里选）；在另一个应用中打开、这里只能只读查看的对话里，除了 `Esc` 也可以按 `←` 回到代理总览，草稿保留；`/ps` 的命令预览显示多行命令，换行显示为 `↵`。
- ⚠️ 终端输入审批默认开启：功能开关 `write_stdin_approval` 转为稳定并默认开启。模型向一个仍在运行的终端会话写入输入时，如果这个终端当初是在沙箱外或带着额外权限启动的，或者启动之后权限设置发生了变化，这次输入要先经过审批（交给你或自动审批审查）；按当前权限启动的终端不受影响，只在运行时授予的内部权限（如插件指标用到的文件系统授权）也不会触发（见[沙箱、审批与安全](/manual/agent/codex/sandbox-approvals)）。
- ⚠️ `tui.whimsy` 改为 `tui.effects.starfield` 的别名：v0.156.0 起不再生效的旧设置重新控制星空动画，同一层配置里两者都写时以 `tui.effects.starfield` 为准。配置别名改在合并各层配置之前统一换算。
- ⚠️ 移除功能开关 `features.guardianv2.thread_context`：自动审批审查一律使用线程自身的上下文，配置里（包括 profile）残留这一项会被忽略，并提示删除。
- ⚠️ 随附目录删去 `gpt-5.4`，Amazon Bedrock 目录删去 `openai.gpt-5.4`，设置里仍是它们时提示迁移到 GPT-6 Sol。Bedrock 的 GovCloud 端点（主机名形如 `bedrock-mantle.us-gov-*.api.aws`）改用单独的默认目录，只有 GPT-5.6 Terra 与 GPT-5.6 Luna，默认 GPT-5.6 Terra（见[模型与推理](/manual/agent/codex/models)）。
- ⚠️ ChatGPT 登录的本地回调地址由 `localhost` 改为 `127.0.0.1`（端口仍是 1455，见[安装、登录与升级](/manual/agent/codex/installation)）。
- 全屏模式下不再显示启动提示，输入框上方也不再轮换显示使用提示（那里只留给额度提醒）；改为一轮工作超过 30 秒时在工作状态下方随机显示一条提示，成功完成的轮次偶尔也会在回复后显示一条（从第三轮起，每次启动上限两次），`tui.show_tooltips = false` 可以关闭。新会话的标题改为紧凑样式加一句随机问候语（见[斜杠命令](/manual/agent/codex/slash-commands)）。
- 登录引导界面按 `c` 复制浏览器登录链接，也可以直接用鼠标选中链接与设备码；修复连接本机守护进程时不会自动打开浏览器登录的问题。
- 自动启动后台服务时，如果 Windows 上的启动器（如 `cargo run`）不允许后台进程脱离它继续运行，改用内嵌服务并给出警告，不再无法打开；Windows 上以管道方式启动的子进程也不再弹出控制台窗口。
- Windows 沙箱：修复 Windows 10 上普通本地路径打不开、已保存的沙箱账户凭据被系统拒绝，以及权限策略过大、超出命令行长度限制时的启动失败。
- Linux 沙箱在可写目录相互嵌套时（如只读的 `.codex` 下面还有可写目录）能正常启动，元数据仍受保护；Linux 与 macOS 上，`.git` 指向另一个可写根目录里的 Git 目录时，这个目录同样保持只读。macOS 上的补丁权限检查能识别 `/tmp` 与 `/private/tmp` 这类系统路径别名，不再为已经授权的位置多弹审批；全局按文件名拒绝的规则（如 `/**/.env`）不再阻止移动或删除它们的上层目录。
- 自动审批审查进行期间收到你的新消息（比如只是问一句进度）时，改为按更新后的授权依据重新审查，不再直接中止待审的操作。
- Mermaid 流程图支持带引号的标签以及标签里的 `&`（如 `A["Review & confirm"]`）；渲染不了的图会在源码上方说明原因（语法不支持、超出尺寸限制或终端太窄）。
- 服务端返回 `Retry-After` 时按它的时间重试；使用 Flex 服务档位时容量不足（`flex_unavailable`）会直接结束本轮并提示 `Flex capacity unavailable.`，不再重试；上传文件遇到 HTTP 502、504 也会重试。
- 命令完成事件包含订阅开始之前就已产生的输出；进程根本没能启动时，同样发出命令开始与失败事件（退出码 `-1`），客户端不再漏掉这类失败。
- `/feedback` 在你同意上传日志时，附带 TUI 客户端近期 1 MiB 的日志，以及所选会话从上游 rollout 继承的历史；SQLite 诊断日志写入失败时给出警告，提示提交日志或运行 `codex doctor`。info 级别的日志不再记录 WebSocket 响应头与工具调用参数的预览。
- shell 快照遵循 `shell_environment_policy`：被排除的变量不再进入快照，重放时也不会覆盖 `set` 指定的值。
- 支持 ChatGPT Pro Max 套餐，界面上的套餐名改为 Pro、Pro (More)、Pro (Max)，分别对应 `prolite`、`pro`、`promax`（见[模型与推理](/manual/agent/codex/models)）。
- 网络策略的管控扩展到历史笔记、图像生成与 ChatGPT 后端请求。
- 多代理 V2 新增 `features.multi_agent_v2.disable_direct_message`，关闭 agent 之间直接发消息的工具（派生子代理与结果回传不受影响）；它依赖仍在开发中的 agent 留言板，目前只在试用留言板时用得上（见[子代理](/manual/agent/codex/subagents)）。
- App server：`thread/revert` 不再接受临时（ephemeral）线程；插件摘要去掉 `extensions` 字段；错误信息新增 `flexUnavailable`，套餐类型新增 `promax`。

## v0.157.x

### v0.157.0（2026-09-25）

- 🆕 GPT-6 Sol（`gpt-6-sol`）与 GPT-6 Luna（`gpt-6-luna`）进入主线版本；Amazon Bedrock 目录加入 `openai.gpt-6-sol` 与 `openai.gpt-6-luna`（Bedrock Runtime 另有 `global.`、`us.` 开头的路由），GPT-6 Sol 成为 Bedrock 的默认模型与兜底模型（见[模型与推理](/manual/agent/codex/models)）。
- 🆕 对话正在另一个应用中打开、这里只能只读查看时，按 `f` 可以分叉出一个可编辑的副本继续工作，草稿与排队的提示词一并带过去。
- 🆕 `/import` 在远程会话和连接本机守护进程的会话中也能用了，导入通过所连接的 app server 执行。
- 🆕 Markdown 列表的项目符号显示为 `•`，任务列表的勾选框显示为 `☐`、`☑`（设 `tui.rendering.lists = false` 恢复原样）；公式渲染支持 `aligned` 对齐、`\boxed`、求和上下限以及 `\underset`、`\overset` 等优化问题常用的写法。
- 🆕 `auto_review.extra_policy` 给自动审批审查追加一段策略文本，托管的 `guardian_extra_policy` 优先；自动审批审查默认改用线程自身的上下文（`guardianv2.thread_context` 默认开启）。
- ⚠️ 全屏对话记录默认开启：`tui.fullscreen_transcript` 的默认值改为 `true`，界面由 Codex 接管对话记录的滚动、选择与搜索。想继续用终端自己的回滚记录，在 `/tui` 里选 Scrollback，或把它设为 `false`；`--no-alt-screen` 与 `tui.alternate_screen = "never"` 仍然优先。全屏模式下按住 `Shift` 单击可以扩展已有的选区（见[斜杠命令](/manual/agent/codex/slash-commands)）。
- ⚠️ 自动启动后台服务默认开启：`daemon_auto_start` 转为稳定功能并移出 `/experimental`，符合条件的交互式启动（包括恢复与分叉会话）会自动拉起共享的本机 app-server 守护进程。带了 `--oss`、`--profile`、大多数 `-c` 配置覆盖或 `--strict-config` 等参数时，本次改用内嵌服务并给出提示；守护进程的共享功能设置与本次启动不兼容时，会让你选择这次不用守护进程、按新设置重启它，或者取消（见 [SDK 与 App Server](/manual/agent/codex/sdk-app-server)）。
- ⚠️ 随附模型目录里的 `gpt-5.6-sol` 去掉了 Ultrafast 服务档位，对应的 `/ultrafast` 命令随之消失，只剩 Fast。
- 语音对话在切换线程时不再中断，回到原线程即可继续；代理总览里正在通话的任务带有 `voice` 标记，`?` 打开的快捷键提示里也列出了语音开关。
- 一轮结束时，提问框里还没发送的回答会追加回主输入框，不会丢失，也不打断正在进行的 `Ctrl+R` 历史搜索。
- tmux 中把 `mouse` 设为关闭时，Codex 不再捕获鼠标；通过 SSH 使用 macOS 自带的 Terminal.app、且 `tui.alternate_screen = "auto"` 时，自动改用终端原生的回滚记录。
- 语音对话的实时连接与独立的网页搜索（包括搜索结果的重定向）会遵循配置的代理；上传文件遇到暂时性错误时自动重试，上传超时从 60 秒放宽到 5 分钟。
- 网络限制对重定向以及进行中的 HTTP、WebSocket 流量持续生效，策略变化撤销访问权限时会取消相应请求；托管的 `application.network` 要求也覆盖 app server、AWS 认证与遥测等请求。
- MCP：Unix 上的本地 stdio 服务器只继承标准输入、输出与错误三个文件描述符；OAuth 授权端点只接受 `http` 与 `https`（见 [MCP 集成](/manual/agent/codex/mcp)）。
- `codex doctor` 会列出完整性检查失败的 SQLite 数据库路径，并按检查结果给路径与 URL 上色。
- 原生 Windows 沙箱令牌的默认访问权限只授予当前登录会话；Linux 沙箱能遮蔽经由上层目录挂载暴露出来的守护进程套接字，不再因此拒绝启动。
- App server：新增 `account/gatewayOAuth/read`、`account/gatewayOAuth/login`、`account/gatewayOAuth/cancel` 方法与 `account/gatewayOAuth/changed` 通知，客户端在 `initialize` 中声明 `explicitGatewayOauth` 后，可以自己决定何时为模型网关发起浏览器登录；MCP 服务器状态新增 `httpOrigin`；轮次进行中也能更新执行环境的选择。

### v0.157.1（2026-09-26）

这一版的发布说明是空的（生成失败），以下依据 `rust-v0.157.0...rust-v0.157.1` 之间的提交整理，都是 Windows 上的修复：

- 启动 code-mode host 与本地 stdio MCP 服务器时不再弹出控制台窗口。
- 修复守护进程在残留 Job Object 成员关系时无法启动，以及分离启动的守护进程继承启动器的输出管道、导致调用方一直等待的问题。

## v0.156.x

### v0.156.0（2026-09-22）

- 🆕 全屏对话记录：新增 `/tui`，选择下次启动时的界面模式。Fullscreen 由 Codex 接管对话记录的滚动、选择与搜索，Scrollback 沿用终端自己的回滚记录，选择保存为 `tui.fullscreen_transcript`（这一版默认 `false`，v0.157.0 起默认开启）。全屏模式下可以用鼠标拖选、双击选词、右键复制，`F3`（对话记录视图里也可以按 `/`）在整个对话中搜索，`F4` 聚焦某组工具活动查看详情，普通单击就能打开链接（见[斜杠命令](/manual/agent/codex/slash-commands)）。
- 🆕 语音对话默认开启：功能开关 `realtime_conversation` 转为稳定并默认开启，不必再到 `/experimental` 里打开。`F8` 开始或结束语音对话（`tui.keymap.chat.toggle_voice`），`/voice settings` 从服务端的声音目录里选择之后对话使用的声音（保存为 `realtime.voice`）；Linux 与 Windows 的发布包也附带了语音运行时。
- 🆕 `/usage` 的菜单改为 View analytics 与 Redeem reset 两项。前者打开全屏的账户用量分析面板，分概览、用量、消息、插件、技能、对话等标签页展示 token 用量、活跃情况与常用的插件和技能，支持 7 天与 30 天两种范围，Business 与 Enterprise 账号看到的是 token 与 credits；`/usage daily`、`weekly`、`cumulative` 直接打开对应的 token 活动视图。
- 🆕 代理总览（界面上改称 agent command center）大改：按 All、Needs you、Working、Ready、Inactive 分标签筛选（`Tab`、`Shift+Tab` 切换），可以按项目、状态或模型分组；任务详情显示所用模型、token 数，Business 与 Enterprise 套餐还显示 credits 与美元估算；由另一个 app server 管理的任务以只读历史打开。任务操作的默认快捷键改成单个按键，如 `n` 新建、`w` 新建 worktree 会话、`a` 归档、`h` 隐藏、`Backspace` 删除，按 `?` 查看全部（见[子代理](/manual/agent/codex/subagents)）。
- 🆕 worktree 转为稳定功能并默认开启：`--worktree`、`/worktree` 不必再先启用实验功能；在本地 Git 仓库里执行 `/new`、`/fork` 会先问新对话放在当前检出还是新 worktree 里；代理总览里按 `w` 从项目的默认分支新建 worktree 会话（见 [Codex Cloud、GitHub 与 IDE](/manual/agent/codex/cloud-integrations)）。
- 🆕 新增 `ada`、`babbage`、`curie`、`cushman`、`dali`、`davinci` 六个内置主题，选中项等处的强调色也跟随主题变化。回复中的 Mermaid 代码块渲染成字符图，`$$...$$`、`\[...\]` 形式的独立公式与行内公式以 Unicode 排版；Mermaid、公式与表格的渲染可以分别用 `tui.rendering.mermaid`、`tui.rendering.math`、`tui.rendering.tables` 关掉，关掉后显示原文。
- 🆕 `/daemon` 菜单显示本机后台服务（app-server 守护进程）的版本，可以选择安装当前稳定版，或者把当前 CLI 的安装包复制过去并固定版本；确认后 Codex 退出，在当前终端里执行更新。另有启动参数 `--no-daemon`：本次完全不使用共享的后台服务，`resume`、`fork` 以及 `archive`、`unarchive`、`delete` 同样认这个参数（见[启动命令行选项](/manual/agent/codex/cli-flags)）。
- 🆕 实验功能 `daemon_auto_start`（`/experimental` 中的 Automatically start the background server，这一版默认关闭）：交互式启动时自动拉起共享的后台服务，启动或连接失败时直接报错并建议改用 `--no-daemon`，不再悄悄退回内嵌服务。
- 🆕 守护进程改用独立的安装包目录 `CODEX_HOME/packages/app-server-daemon`：还没有守护进程安装时，`daemon start`、`restart`、`bootstrap` 会复制当前 CLI 的完整安装包，`bootstrap` 因此不再要求独立安装版；单独更新守护进程不会改动你的 `codex` 命令与 shell 配置。`codex app-server daemon update` 会把旧的独立安装迁移过去，也能让固定了版本的安装回到正式版更新；新增的 `daemon update --from-cli [-y]` 则把当前 CLI 的安装包复制过去并固定版本（见 [SDK 与 App Server](/manual/agent/codex/sdk-app-server)）。
- 🆕 `/warnings` 或 `F2` 打开警告查看器，集中查看启动、运行时、MCP 与弃用提示等诊断信息，底部状态栏只显示去重后的警告数；额度快用完的提醒改为固定显示在输入框上方的提示行里。
- 🆕 `/model` 选择器里按 `s`，只把所选模型与推理强度用于当前会话，不改动保存的默认值。
- 🆕 `codex mcp login <名字> --no-browser`：只打印授权链接、不打开浏览器，在别处完成授权后，把浏览器地址栏里的回调 URL 粘贴回终端即可（见 [MCP 集成](/manual/agent/codex/mcp)）。
- 🆕 `[tui.effects]` 分别控制 `starfield`、`shimmer`、`welcome`、`effort`、`progress`、`title` 六种动画效果，取代 `tui.whimsy`（旧设置仍能读取，但不再生效）；首次启动检测到屏幕阅读器、而你又没设置过 `tui.animations` 时，自动写入 `tui.animations = false`；系统开启“减少动态效果”时也不播放动画。
- 🆕 新配置项 `model_post_turn_compact_threshold_percent`（0～100，默认不启用）：一轮结束后，上下文用量达到可用窗口的这个百分比就先做压缩。
- 🆕 模型提供方新增 `model_catalog_url`（从指定地址获取 Codex 格式的模型目录）与 `gateway_oauth`（网关额外要求的 OAuth 凭据，按配置放进请求头或 cookie）；`requirements.toml` 可以用 `model_provider`、`model_providers` 强制指定提供方（见[模型与推理](/manual/agent/codex/models)）。
- ⚠️ 在输入框为空时连按两次 `Esc`，改为浏览之前的提示词：`←`、`→` 选择，`Ctrl+T` 展开详情，`Enter` 把当前会话回退到所选提示词之前，并把它放回输入框重新编辑。回退在原会话里进行，会话 ID、设置与目标都不变，不再分叉出新会话；已经发生的文件改动不会撤销。
- ⚠️ 移除 `/personality` 与功能开关 `personality`：`personality` 设为 `friendly` 或 `pragmatic` 不再改变回复风格，只有 `personality = "none"` 仍会去掉模型指令里的 Personality 小节。
- ⚠️ 移除 `windows.sandbox_private_desktop`，原生 Windows 的 elevated 与 unelevated 沙箱一律在私有桌面上运行，配置里残留这一项会提示删除；`windows.sandbox` 新增 `mxc` 取值（微软的 MXC 容器，需要系统支持）；TUI 不再在启动时扫描并警告全局可写的目录。
- ⚠️ 连接本机守护进程或远程 app server 时，`/delete` 删除会话后回到代理总览，不再退出（使用内嵌服务时仍然退出）；在“对话正在另一个应用中打开”的只读界面按 `Esc`，同样回到代理总览。
- ⚠️ 每轮结束时显示的完成时间去掉了 `done` 前缀，写作 `2:32 PM` 或 `Worked for 2m 5s · 2:32 PM`；系统设置为 24 小时制时显示成 `14:32` 这样的格式。
- ⚠️ `project_doc_fallback_filenames` 只接受单纯的文件名：含 `/`（Windows 上还有 `\`、`:`）的条目以及 `.`、`..` 会被忽略并记录警告（见 [AGENTS.md 项目指令](/manual/agent/codex/agents-md)）。
- ⚠️ App server 删除了已弃用的 `thread/rollback`，改用 `thread/revert`。
- 生效配置或 requirements 里出现不认识的字段时，启动会给出警告（只列来源与字段名，上限三条），拼错或已弃用的设置不再被悄悄忽略。
- `codex doctor` 新增文件系统路径检查，逐个解析配置中授权的路径，慢或失败时给出警告；配置加载失败时只报告文件、行号与列号，不再回显配置内容；非交互运行时 `TERM=dumb` 只算警告。
- 登录与启动阶段的账户发现、云端配置请求直连失败时，改走系统代理重试（功能开关 `system_proxy_fallback`，默认开启）；MCP 的 OAuth 元数据发现返回 503 时改用 OIDC 发现。
- 子代理也可以发起 MCP elicitation（如浏览器登录、表单输入），按现有的审批设置交给你处理；插件安装请求只允许主线程发起。
- 恢复会话时一并恢复之前的计划模式（Plan mode）；`codex exec --json` 的 `web_search` 条目保留打开页面、页内查找等动作的细节，有结构化结果时附带 `results`。
- 沙箱：原生 Windows 的离线沙箱同样拦截非回环的入站连接；app server 的 Unix 套接字对受文件系统限制的命令不可见；macOS Seatbelt 禁止能绕过只读限制改写文件的 `fcntl` 调用，并拒绝 XPC 服务查找；受限的 Linux 沙箱会隐藏 WSLg 暴露的重复根目录。
- 修复 tmux 与 SSH 会话中的剪贴板转发；终端把粘贴内容逐键发送时保留制表符缩进；轮次失败、被中断或收到子代理完成事件时，已经流式输出的回答与计划不再丢失。
- App server：`mcpServerStatus/list` 返回服务器声明的 `serverCapabilities`，`thread/resume` 返回 `collaborationMode`，`plugin/read` 返回插件声明的上手技能 `onboardingSkill`；新增实验性的 `rollout/compress`。

### v0.156.1（2026-09-23）

- 🆕 模型选择器加入 GPT-6 Sol 与 GPT-6 Luna。随附目录在你选用 `gpt-5.5`、`gpt-5.6-sol`、`gpt-5.6-terra` 时提示迁移到 GPT-6 Sol，选用 `gpt-5.6-luna` 时提示迁移到 GPT-6 Luna，已下线的 `gpt-5.4`、`gpt-5.4-mini` 也分别指向这两个新模型；触发限流时的换模型提示改为推荐 GPT-6 Luna。
- ⚠️ 随附目录把 GPT-6 Sol 与 GPT-6 Luna 的默认服务档位设为 Fast：配置里没有 `service_tier`、也没用 `/fast` 关过时，交互式 TUI 选用这两个模型默认就以 Fast 发送请求（官方 Speed 页说明 GPT-6 模型的 Fast 按标准费率的 2.5 倍计），见[模型与推理](/manual/agent/codex/models)。

## v0.155.x

### v0.155.0（2026-09-17）

- 🆕 实验性的语音对话 `/voice`：在 `/experimental` 中开启 Voice conversations（功能开关 `realtime_conversation`）后，新会话里就能用语音给 Codex 布置任务，界面显示实时字幕与麦克风、扬声器电平，语音发起的任务完成后会把最终回答念出来。`/voice mute` 或 `Ctrl+X` 开关麦克风，`/voice stop` 结束对话。只有附带语音运行时的构建才提供这项功能（从发布流程看，目前是 macOS 与 Linux 的发布包），见[斜杠命令](/manual/agent/codex/slash-commands)。
- 🆕 TUI 的状态行实时显示推理摘要；每轮成功结束后，原来的分隔线换成完成时间（如 `done 2:32 PM`）。推理摘要默认是否开启见下文 v0.155.1。
- 🆕 代理总览（`codex agents`、`/agents`）可以隐藏（`Ctrl+W`，不停止任务）、归档（`Ctrl+E`）或永久删除（`Delete`）选中的任务，后两者连同子代理一起处理，执行前要确认；`→` 打开选中的任务，新建后台任务时可以粘贴图片（见[子代理](/manual/agent/codex/subagents)）。
- 🆕 `/worktree` 的浏览器显示每个 worktree 所属对话的标题、更新时间以及已归档、不可用等状态，还能在确认后删除当前仓库里干净的托管 worktree。
- 🆕 在支持 Touch ID 的 Mac 上，本地 TUI 会话可以用 Touch ID 完成 Codex Apps（连接器）发起的 MCP 身份验证请求；其他 MCP 服务器发起的这类请求一律取消。
- 🆕 新增 `codex app-server daemon update`，立即检查并安装当前稳定版，再重启托管的守护进程；守护进程的自动更新可以在 `CODEX_HOME/app-server-daemon/settings.json` 中关闭或调整间隔，重启后会恢复之前已加载的线程，进行中的目标（`/goal`）不必等客户端重连就能继续（见 [SDK 与 App Server](/manual/agent/codex/sdk-app-server)）。
- 🆕 TUI 连接的 app server 是比 CLI 更旧的稳定版时会给出提示，本机守护进程会建议运行 `codex app-server daemon update`；设 `tui.show_server_version_notice = false` 可以关闭。
- 🆕 Amazon Bedrock 提供方支持 `aws.credential_export`：由外部命令输出 AWS 凭据，凭据缓存在内存里、过期前自动刷新，认证失败时先运行 `aws.auth_refresh` 再重新导出（见[模型与推理](/manual/agent/codex/models)）。
- 🆕 `memories.version` 可以选用新的 `v2` 记忆管线（默认仍是 `v1`），两个版本分开存储；`memories.dual_write = true` 时两版记忆同时生成。
- 🆕 `SessionStart` hook 的来源新增 `fork`：分叉出的会话不再按 `startup` 触发，避免重复注入启动上下文（见 [Hooks](/manual/agent/codex/hooks)）。
- ⚠️ 移除原生 Windows 专用的 `/sandbox-add-read-dir` 命令。
- ⚠️ 连接本机守护进程或远程 app server 时，`/archive` 归档后不再退出 Codex，而是回到代理总览；使用内嵌服务时仍然退出。
- ⚠️ 限制了文件系统写入的 Linux 沙箱禁止 `AF_VSOCK` 套接字与 `io_uring`，在 WSL 中还会屏蔽 WSL interop（沙箱内的命令不能再启动 Windows 程序）；原生 Windows 的 elevated 沙箱拒绝不允许读取文件系统根目录的权限配置（见[沙箱、审批与安全](/manual/agent/codex/sandbox-approvals)）。
- ⚠️ 随附的模型目录删去 `gpt-5.2` 与 `gpt-5.4-mini`，设置里仍是 `gpt-5.4-mini` 时会提示迁移到 `gpt-5.6-luna`；`remote_compaction_v2` 功能开关退役，支持的提供方一律使用流式远程压缩。
- 轮次开始前的上下文压缩失败时，已经提交的提示词仍会保存到对话记录里。
- 修复 tmux 中漏掉窗口尺寸变化、对话记录视图的位置恢复与半页滚动，以及切换线程后残留旧历史的问题。
- MCP 服务器的 OAuth token 过期且无法刷新时，`/mcp` 中的认证状态改为未登录，工具调用会收到重新连接的提示。
- 自动审批审查更完整地保留待审操作与授权依据，遇到限流等暂时性错误会重试，审查没能完成时仍然拒绝操作，但不再把它说成不安全；单个待审操作不再受 8,000 字节的限制，改以审查模型的输入窗口为限。
- 切换账号后，远程控制会话、缓存的 WebSocket 状态与模型目录一并失效，不再沿用上一个身份。
- 网络代理的凭据代理（`features.network_proxy.credential_broker`）可以用新的 `features.network_proxy.credentials` 声明自定义凭据提供方；启用凭据代理时，shell 快照不会暴露真实凭据。
- HTTP 429 中表示额度耗尽的错误（如 `insufficient_quota`）改按用量上限报告，不再显示为重试次数用尽。
- 目标（goal）可以应你的明确要求暂停；自动续跑连续 3 轮只给出空回复、没有任何进展时，目标会被标为 `blocked`。
- Unix 上的命令 hook 不再继承控制终端，hook 不读 stdin 时也不会卡住（写入 stdin 同样受超时约束）。
- App server 新增 `thread/attachment/add`、`thread/attachment/list`、`thread/attachment/remove` 方法与 `thread/attachment/updated` 通知，以及实验性的 `memory/status`；Unix 上收到 `SIGTERM` 会先清理连接再退出。
- 新增两个默认关闭、仍在开发中的功能开关：`api_key_model_discovery`（用 OpenAI API key 登录时从服务端获取模型目录）与 `codex_apps_mcp_2026_07_28`（让内置的 Codex Apps 服务单独启用 2026-07-28 版 MCP 协议）。
- Python SDK 与其运行时包改为在 CLI 稳定版发布后按同一版本号发布；SDK 新增 `ExternalMessage`（以工具输出的身份传入不受信任的外部内容），`thread_resume`、`thread_fork` 增加 `include_turns` 等参数。

### v0.155.1（2026-09-18）

- ⚠️ 本地 TUI 的新会话在没有设置 `model_reasoning_summary` 时，恢复为不请求推理摘要（`none`）。v0.155.0 为了在状态行显示推理摘要，默认按 `detailed` 请求，不支持推理摘要的提供方因此拒绝请求；显式设置的值不受影响。想在状态行看到推理摘要，在配置里设置 `model_reasoning_summary`（如 `"auto"`）即可。

## v0.154.0（2026-09-09）

- 🆕 模型选择器与 Amazon Bedrock 目录加入 GPT-6-Astra。
- 🆕 实验性的 worktree 支持：用 `--worktree` 或 `/worktree` 为新会话或分叉会话创建隔离的检出目录，之后可以浏览并恢复它们；`codex exec` 同样支持托管 worktree。
- 🆕 Codex 继续工作的同时，你可以在行内回答它提出的问题：从建议选项里选，或者自己输入，正在编辑的草稿不会丢。
- 🆕 Windows 上的多个会话可以共享一个后台 Codex 服务，附带守护进程的生命周期命令与托管更新。
- 🆕 Vim 编辑模式新增 `R` 替换模式（支持撤销与 `.` 重复），旧式终端里的 Esc 处理也更可靠。
- 🆕 复制回复时在富文本应用中保留格式；`/copy` 还能复制状态输出或会话的单个字段。
- ⚠️ 已弃用的 `codex mcp-server` 入口被移除，需要把 Codex 嵌入其他程序时改用 app server（见 [SDK 与 App Server](/manual/agent/codex/sdk-app-server)）。
- 已打开的会话能拿到新安装插件的工具；在外部升级或回滚插件后，会话里的 skills 与 hooks 会随之刷新。
- MCP 连接会协调 OAuth token 的刷新；刷新失败时提示重新登录，而不会自动重放被拒绝的工具调用。
- 在确认信任工作区之前，启动过程不再运行工作区里的辅助程序；macOS 沙箱阻止向终端注入输入。
- 远程恢复与分叉会保留已保存的权限；新会话与分叉默认沿用服务端的模型设置，除非显式覆盖。
- 恢复一个正在另一个应用里打开的对话时，改为显示只读记录并提供重试，同时保留你的草稿。
- 自动审批审查在上下文压缩后能更好地保留授权上下文，并拒绝已被新的用户指令或回答作废的审批。

## v0.153.x

### v0.153.0（2026-09-03）

- 🆕 Vim 模式支持 `u` 撤销、`Ctrl+R` 重做，完整保留草稿，包括粘贴的内容与附件。
- 🆕 插件 CLI 可以从远程 marketplace 列出、安装和移除插件（见[插件](/manual/agent/codex/plugins)）。
- 🆕 设置 `tui.auto_recap = false` 可以关闭自动回顾，手动的 `/recap` 仍然可用。
- 🆕 TUI 历史里显示完整的补丁、发给后台终端的输入，以及每一条已完成的命令。
- 🆕 Plus 与 Team 用户在约五小时的用量窗口里剩余额度不足一半时，会更早收到提醒。
- 🆕 新增默认关闭的 `features.context_management.experimental_mode`：为符合条件的 ChatGPT Plus、Pro 或 Pro Lite 会话（使用 Codex 后端）启用 token 预算上下文、历史笔记与 `new_context` 工具；API key 会话、自定义提供方与临时的结构化线程不在此列。
- ⚠️ `tui.disable_paste_burst` 取代原来的顶层设置，旧写法仍作为回退继续有效。
- ⚠️ Full Access 模式下，只需确认的操作不再经过自动审批审查；User approval 模式跳过后台的审查评分与预热，敏感操作检查与向用户提问的处理不变。
- 外部 app-server 连接断开后，TUI 会话会自动重连，保留草稿与对话记录；状态不确定或排队中的提交会暂停，等你确认。
- 自动审批审查的记录能跨越压缩、重启与用户创建的分叉保留下来，同时遵守回滚边界、隔离子代理的历史。
- 记住的 MCP 工具审批按所选的应用账号生效；macOS 上用相对路径配置的 MCP 可执行文件启动更可靠。
- rollout 压缩包含共享历史；`codex exec resume` 按工作目录挑选会话时能处理压缩过的 rollout；分叉支持符号链接的会话根目录。
- App server：线程元数据新增可为空的 `model` 与 `reasoningEffort` 字段；模型目录启用时，支持通过 `request_user_input_async` 发起结构化的异步提问。

### v0.153.1 → v0.153.4（2026-09-03 → 09-04）

都是围绕 GPT-6-Astra 的热修复，内容见本页开头的表格；0.153.4 起，没有显式配置模型时默认使用 Astra。

## v0.152.x

### v0.152.0（2026-09-01）

- 🆕 Vim 模式支持在草稿里用 `/` 与 `?` 搜索、高亮匹配，并用 `n`、`N` 重复跳转。
- 🆕 触发限流时的横幅提供操作入口：查看用量、管理 credits、重置额度、管理套餐。
- 🆕 TUI 与 `codex exec` 会显示凭据刷新的进度，包括 Amazon Bedrock 的重新认证。
- 🆕 MCP 服务器名可以包含 `:`、`@`、`/`、`.`，支持包名风格的名字，CLI 命令与认证全程可用。
- 🆕 单个 MCP 工具支持 `output_token_limit` 设置，会话恢复前后的截断行为保持一致（见 [MCP 集成](/manual/agent/codex/mcp)）。
- 🆕 App server 客户端可以配置 `thread/shellCommand` 的超时，包括超过一小时的期限。
- ⚠️ 计划工具默认关闭，需要时设置 `tools.update_plan.enabled = true` 开启。
- 插件推荐在启动时就开始加载，减少首轮之前的等待。
- 启用 Vim 的输入框在新草稿里（包括提交消息或执行斜杠命令之后）一律从 Insert 模式开始。
- 自动审批审查能保留更长的消息与更大的对话记录，并在压缩后保留用户的指令、回答与有效授权。
- 恢复的线程在没有指定工作目录时，回到它保存时的工作目录；更新客户端元数据时保留文件系统权限。
- MCP 工具在缓存刷新与远程插件变化期间保持可用；认证重试会使用辅助程序刷新后提供的请求头。
- 打开模型选择器时会刷新可用模型，且不丢失当前高亮的选项。
- 修复 Windows 沙箱下 Microsoft Store 版 PowerShell 的执行问题、子进程在终端查询时挂起，以及老版 JediTerm 终端的光标显示错乱。
- Codex Cloud 任务请求拒绝不受信任的后端 URL 并禁用重定向，以保护已保存的凭据。

### v0.152.1（2026-09-01）

- 自动审批审查遵守模型元数据里提供的 Node REPL 策略。

## v0.151.0（2026-08-29）

- 🆕 可以配置可选 MCP 服务器的工具发现宽限期。
- 🆕 扩展（extensions）可以在 MCP 工具结果到达模型之前检查或替换它。
- 🆕 插件目录会合并各仓库的配置；某个项目的 marketplace 无效时会被报告出来，而不再连带隐藏其他有效的插件。
- TUI 的各轮之间保留恢复出的权限配置档，并防止 `/cd` 放宽沙箱限制。
- 切换模型或回退到其他模型时，工具的可用性与推理强度保持正确。
- 远程沙箱按执行端实际的主目录、操作系统与路径约定来执行限制。
- app server 的响应里保留结构化的 MCP 工具与资源错误。
- 嵌套子代理的 token 用量计入根目标的预算。
- 权限状态变化后，过期的审查分类结果不再能授权操作。

## v0.150.x

### v0.150.0（2026-08-26）

- 🆕 可以用 `@` 提及引用其他 Codex 任务，并在终端里让 agent 读取、创建任务或给任务发消息。
- 🆕 `/copy` 提供选择器，可以复制完整回复、单个代码块或引用块。
- 🆕 未命名的终端任务会自动得到描述性的标题；`/rename` 会根据对话建议一个可编辑的标题。
- 🆕 在支持的终端里，Markdown 链接显示为可点击的标签，其他终端仍显示 URL。
- 🆕 可以绑定快捷键循环切换权限模式；Vim 模式支持用 `.` 重复上一次编辑。
- 🆕 新增 `Interrupt` hook：顶层轮次被中断时，可以运行命令或 MCP 处理器（见 [Hooks](/manual/agent/codex/hooks)）。
- ⚠️ 未受信任的项目不再提供项目级的 `AGENTS.md` 指令（见 [AGENTS.md 项目指令](/manual/agent/codex/agents-md)）；权限变更之后，托管的禁止读取规则仍然有效。
- app server 的诊断信息对凭据的脱敏更完整，覆盖提供方、认证刷新与证明相关字段。
- 修复远程 MCP 的 bearer token 查找与必需服务器的启动，同时保持与旧版执行端兼容。
- 修复 Windows 在 Unicode 用户路径下的提权沙箱设置与启动别名。
- 修复 Unix 上脱离的进程占着终端或终端输出缓冲区写满时导致的退出挂起。
- 修复 Amazon Bedrock 模型的对话压缩与多代理兼容性。

### v0.150.1（2026-08-27）

- 远程压缩默认把保留的图片计入 token 预算，必要时裁掉较早的图片。

## v0.149.1（2026-08-24）

发布说明里没有列出面向用户的变更。

## 查看更完整的变更

- 每个版本的完整 PR 列表在 `https://github.com/openai/codex/releases/tag/rust-v<版本号>`。
- 官方文档站的 What's new 每周汇总一次 CLI、桌面端、IDE 扩展与 Codex Cloud 的新功能。
- 实验性功能是否在你的版本里可用、是否已开启，可以用 `codex features list` 查看（列出每个功能的成熟阶段与实际生效状态）。
