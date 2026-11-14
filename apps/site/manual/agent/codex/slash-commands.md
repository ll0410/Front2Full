---
title: "斜杠命令"
description: "交互会话中的全部斜杠命令（按用途分组），常用快捷键与输入技巧，以及全屏对话记录的操作"
source: "https://daiw.org/manual/codex/slash-commands"
---

# 斜杠命令

> 交互会话中的全部斜杠命令（按用途分组），常用快捷键与输入技巧，以及全屏对话记录的操作

在输入框**开头**输入 `/` 会弹出命令菜单（v0.162.0 起在 Vim 普通模式下输入框为空时按 `/` 同样会打开），继续输入会按命令名的前缀筛选（不分大小写，与输入完全相同的命令排在首位）；支持参数的命令把参数写在同一行，例如 `/review 只看权限相关的改动`。本页已核对至 Codex CLI v0.167.0；CLI 文档没有列出的命令会在备注中注明。

Codex 正在工作时，输入斜杠命令后按 `Tab` 可以把它排到下一轮执行。排队的命令在真正执行时才解析，所以菜单和报错会在当前这一轮结束后才出现。

## 模型与模式

| 命令 | 作用 | 参数 | 备注 |
| --- | --- | --- | --- |
| `/model` | 选择模型与推理强度 | 可选，行内指定模型、推理强度与速度（v0.164.0 起） | 选择器里按 `Enter` 保存为默认值，按 `s` 只用于当前会话（v0.156.0 起） |
| `/presets` | 运行或保存可复用的提示词与斜杠命令 | | v0.164.0 新增；支持 10 个编号槽位（`0`–`9`，保存在 `tui.presets`），可通过快捷键菜单快速调用；不支持 `!` 开头的 shell 命令 |
| `/daybreak` | 开启或关闭 Daybreak 网络安全访问模式 | | v0.161.0 新增；需启用 `features.cli_daybreak`（v0.163.0 起符合条件的账号默认开启），开启后状态栏与终端标题显示指示器 |
| `/fast` | 开关当前模型的 Fast 服务档位，并记住选择 | | 只有模型目录为当前模型提供该档位时才出现，见[模型与推理](/manual/agent/codex/models) |
| `/plan` | 切换到计划模式 | 可选，作为首条规划请求 | `Shift+Tab` 也可以切换协作模式 |
| `/goal` | 设置或查看长任务的目标 | `<目标>`，或 `edit`、`pause`、`resume`、`clear` | 目标上限 4000 字符；不带参数时打开目标菜单 |
| `/voice` | 开始或结束实时语音对话 | 可选：`settings`（选择语音音色，v0.161.0 起还可选择麦克风、扬声器与输入声道并保存在本机）、`mute`（开关麦克风）或 `stop`（结束对话）；不带参数时在开始与结束之间切换 | 快捷键 `F8`（静音快捷键自 v0.163.0 起为 `F9`）。v0.164.0 起 `realtime_conversation` 特性开关退役，在附带语音运行时的平台（macOS、Linux、Windows 发布包）上常驻可用；旁支对话中不可用；CLI 文档未列出 |

`/personality` 已在 v0.156.0 移除（官方 CLI 文档仍列着它）：`friendly`、`pragmatic` 两种沟通风格已经退役，配置项 `personality` 只剩 `none` 还有作用，见[模型与推理](/manual/agent/codex/models)。

## 权限与沙箱

| 命令 | 作用 | 参数 | 备注 |
| --- | --- | --- | --- |
| `/permissions` | 选择 Codex 无需询问即可执行的操作（如 Auto、Read Only 预设） | 可选，行内直接指定权限预设或命名权限档案（v0.164.0 起） | 配置了命名权限配置档时也会列出 |
| `/approve` | 对近期一次被自动审查拒绝的操作批准重试一次 | | 配合自动审查（Auto-review）使用 |
| `/setup-default-sandbox` | 设置提权版 Windows 沙箱 | | 仅 Windows，且正在使用降级的受限令牌沙箱时出现 |

原来仅限原生 Windows、让沙箱额外读取一个目录的 `/sandbox-add-read-dir` 已在 v0.155.0 移除，官方 CLI 参考目前仍列着它。沙箱与审批的完整说明见 [沙箱、审批与安全](/manual/agent/codex/sandbox-approvals)。

## 会话

| 命令 | 作用 | 参数 | 备注 |
| --- | --- | --- | --- |
| `/new` | 在同一个 CLI 进程里开始新对话 | 可选，新对话名称 | 不清屏；在本地 Git 仓库里会先询问在当前检出还是新 worktree 中运行（v0.164.0 起 worktrees 常驻可用） |
| `/clear` | 清屏并开始新对话 | 可选，新对话名称 | `Ctrl+L` 只清屏、不换对话（v0.167.0 起清屏后仍可通过 `Ctrl+T` 查看此前消息） |
| `/resume` | 恢复一个已保存的会话 | 可选，会话 ID 或名称；省略则打开选择器 | |
| `/fork` | 把当前对话复制为新对话（新 ID），原记录不变 | 可选，新对话名称 | 在本地 Git 仓库里同样先询问放在哪个检出；派生其他已保存会话用 `codex fork` |
| `/rename` | 重命名当前对话 | 可选，新名称；省略则弹出输入框 | |
| `/archive` | 归档当前会话 | | 需确认；v0.162.0 起允许在轮次运行期间执行；用 `codex unarchive` 恢复。使用内嵌服务时归档后退出；连接本机守护进程或远程 app server 时回到代理指挥中心 |
| `/delete` | 永久删除当前会话 | | 需确认；派生的子代理线程一并删除。使用内嵌服务时删除后退出；v0.156.0 起，连接本机守护进程或远程 app server 时回到代理总览 |
| `/compact` | 总结对话以释放上下文 | | |
| `/recap` | 立即生成当前对话的摘要 | | CLI 文档未列出 |
| `/side`、`/btw` | 在临时分叉中开一个旁支对话，不影响主对话记录 | 可选，直接跟问题 | `Ctrl+/` 切换旁支对话，`Ctrl+C` 返回主线程；v0.163.0 起切换会话后仍可用 `/side` 回到已有的旁支对话 |
| `/export` | 把对话导出为 Markdown | 可选，输出文件路径；省略则弹出导出选项 | CLI 文档未列出 |
| `/copy` | 复制近期一条已完成的回复，或按块浏览并复制对话内容（v0.162.0 起） | | 快捷键 `Ctrl+O` |
| `/worktree` | 在新的 Git worktree 中开始或继续对话 | | v0.164.0 起 `worktrees` 特性开关退役，常驻可用；CLI 文档未列出 |
| `/cd` | 切换当前工作目录 | 可选，路径；省略时为 `~` | CLI 文档未列出 |
| `/pwd` | 显示当前工作目录 | | 别名 `/cwd`；CLI 文档未列出 |
| `/app` | 在 ChatGPT 桌面应用中继续当前会话 | | 仅 macOS、Windows |
| `/quit`、`/exit` | 退出 Codex | | |

会话的存储位置与命令行管理见 [会话管理](/manual/agent/codex/sessions)。

## 代码与上下文

| 命令 | 作用 | 参数 | 备注 |
| --- | --- | --- | --- |
| `/review` | 审查当前改动并找出问题 | 可选，自定义审查说明；省略则打开预设菜单 | 见 [代码审查](/manual/agent/codex/review) |
| `/diff` | 显示 git diff，包括未跟踪的文件 | | |
| `/mention` | 插入 `@` 并打开文件搜索 | | 等同直接输入 `@` |
| `/init` | 让 Codex 在当前目录生成 `AGENTS.md` | | 见 [AGENTS.md 项目指令](/manual/agent/codex/agents-md) |
| `/ide` | 把 IDE 的当前选区、打开的文件等上下文带入对话 | 可选，`on`、`off` 或 `status` | |
| `/status` | 显示会话配置（模型、审批策略、可写目录、当前选中的 ChatGPT 工作区）与 token 用量 | | 连接本机守护进程时 Server 一行显示 Local background server；v0.166.0 起显示选中的 ChatGPT 工作区 |
| `/usage` | 查看账号用量分析，或使用一次额度重置 | 可选，`daily`、`weekly` 或 `cumulative`，直接打开对应的 token 活动视图 | 需用 ChatGPT 账号登录。v0.156.0 起菜单里的 View analytics 打开全屏的用量分析面板，分概览、用量、消息、插件、技能、对话等标签页 |
| `/debug-config` | 显示配置层顺序与 requirements 来源，排查配置为何不生效 | | 不在弹出菜单中显示，但可以直接输入 |
| `/warnings` | 查看保留下来的警告与诊断详情（启动、运行时、MCP、弃用提示等），可逐条复制 | | v0.156.0 新增，快捷键 `F2`，底部状态栏显示去重后的警告数；v0.166.0 起支持文本选择与鼠标滚轮滚动；CLI 文档未列出 |

## 扩展与集成

| 命令 | 作用 | 参数 | 备注 |
| --- | --- | --- | --- |
| `/mcp` | 列出已配置的 MCP 工具，或在会话中登录 MCP 服务器 | 可选，`verbose` 显示服务器详情，或 `login <name>` 登录指定服务器（v0.161.0 起） | 见 [MCP 集成](/manual/agent/codex/mcp) |
| `/skills` | 选择一个技能用于接下来的请求 | | 也可以输入 `$` 提及技能，见 [Skills 技能](/manual/agent/codex/skills) |
| `/plugins` | 浏览已安装和可发现的插件 | | 在已安装插件上按 `Space` 启用或停用 |
| `/apps` | 管理应用（连接器），选中后以 `$app-slug` 插入输入框 | | 需 ChatGPT 登录；不在弹出菜单中显示 |
| `/hooks` | 查看生命周期 hooks，信任、停用或重新启用非托管 hooks | | 见 [Hooks](/manual/agent/codex/hooks) |
| `/memories` | 配置是否使用、生成记忆 | | |
| `/import` | 从 Claude Code 或 Cursor 导入配置、项目和近期对话 | | v0.157.0 起远程会话与连接本机守护进程的会话也能用 |

## 多代理与后台终端

| 命令 | 作用 | 参数 | 备注 |
| --- | --- | --- | --- |
| `/agents` | 打开代理指挥中心（agent command center），查看、筛选并切换 agent 会话 | | 输入框为空按 `←` 也能打开；v0.167.0 起内嵌会话（`--no-daemon`）中同样可用，且支持按 `f` 分叉（v0.161.0）、按 `p` 置顶（v0.162.0）、按目录分组（v0.165.0）与未读结果标记（v0.167.0）；见[子代理](/manual/agent/codex/subagents) |
| `/daemon` | 管理本机的后台服务（app-server 守护进程）：显示正在运行的版本，可选择重启服务（v0.163.0 起）、安装稳定版，或改用当前 CLI 的安装包并固定版本 | | v0.156.0 新增；重启服务会提示可能中断的工作并在重启后自动重连；执行更新时 Codex 退出并在当前终端更新；连接远程 app server 时不可用。见 [SDK 与 App Server](/manual/agent/codex/sdk-app-server)；CLI 文档未列出 |
| `/subagents` | 在本会话的子代理线程之间切换 | | 见 [子代理](/manual/agent/codex/subagents) |
| `/ps` | 列出后台终端及其近期几行输出 | | 使用 `unified_exec` 时才会有后台终端；v0.158.0 起多行命令的预览不再只显示首行，换行显示为 `↵`，整条预览上限 80 个字符 |
| `/stop` | 停止本会话的所有后台终端 | | 别名 `/clean` |

## 界面、账户与其他

| 命令 | 作用 | 参数 | 备注 |
| --- | --- | --- | --- |
| `/config` | 打开交互式配置面板，按分类搜索并修改 Codex 偏好设置 | | v0.163.0 新增；可热更新的设置立即生效，需要重启的设置会在界面中标明 |
| `/keymap` | 查看并重映射快捷键，保存到 `tui.keymap` | 可选，`debug` 打开按键调试视图 | v0.163.0 起支持配置前导键（Leader Key，默认 `Ctrl+X`）；v0.164.0 起支持绑定 `Command` / `Super` 修饰键 |
| `/vim` | 开关输入框的 Vim 模式 | | 默认开启可设 `tui.vim_mode_default = true` |
| `/raw` | 开关原始回滚模式，方便在终端里选中复制 | 可选，`on` 或 `off` | 快捷键 `Alt+R`；默认值用 `tui.raw_output_mode` |
| `/tui` | 选择下次启动时的界面模式：Fullscreen（全屏对话记录）或 Scrollback（使用终端自己的回滚记录） | | v0.156.0 新增，需确认，保存为 `tui.fullscreen_transcript`，重启后生效；`--no-alt-screen` 等启动参数仍然优先；CLI 文档未列出 |
| `/theme` | 选择语法高亮主题，保存到 `tui.theme` | | v0.156.0 起新增 `ada`、`babbage`、`curie`、`cushman`、`dali`、`davinci` 六个内置主题，界面的强调色也跟随主题；自定义 `.tmTheme` 放在 `$CODEX_HOME/themes` |
| `/statusline` | 配置底部状态栏显示哪些项，保存到 `tui.status_line` | 可选，行内直接指定状态栏项或会话级覆盖（v0.164.0 起） | v0.166.0 起新增 `profile` 与 `provider` 状态栏项 |
| `/title` | 配置终端标题显示哪些项，保存到 `tui.terminal_title` | 可选，行内直接指定标题栏项或会话级覆盖（v0.164.0 起） | |
| `/pets` | 选择或隐藏终端宠物 | 可选，宠物 ID，或 `off` 隐藏 | 别名 `/pet` |
| `/experimental` | 开关实验功能（如网络代理、系统代理、运行时防止休眠等） | | 保存到配置，部分需重启生效；v0.167.0 新增“System proxy”（`respect_system_proxy`） |
| `/logout` | 退出登录，清除本地凭据 | | |
| `/feedback` | 把日志与诊断信息发送给维护者 | | 先选反馈类别，再决定是否上传日志；v0.158.0 起，同意上传日志时还会附上 TUI 客户端近期 1 MiB 的日志（`client-logs.txt`）。诊断日志写不进本地数据库时，Codex 会发出一次警告，提醒退出前用 `/feedback` 附带日志上传，或运行 `codex doctor` |

此外还有只在开发构建中出现的 `/rollout`（打印会话记录文件路径）和 `/test-approval`，以及源码中标注“请勿使用”的 `/debug-m-drop`、`/debug-m-update`。

::: info

**哪些情况下命令不可用：**

- **任务进行中**：`/new`、`/clear`、`/delete`、`/fork`、`/worktree`、`/init`、`/compact`、`/recap`、`/export`、`/review`、`/plan`、`/cd`、`/import`、`/memories`、`/config`、`/experimental`、`/keymap`、`/tui`、`/vim`、`/theme`、`/pets`、`/logout` 以及 Windows 的 `/setup-default-sandbox` 会提示当前不可用，其余命令（包括 v0.162.0 起放开的 `/archive`、`/resume` 以及 `/presets`、`/daybreak` 等）随时可用。v0.156.0 起，MCP 服务器仍在启动时也能使用 `/review`。
- **旁支对话中**：只能用 `/ide`、`/agents`、`/copy`、`/export`、`/raw`、`/diff`、`/mention`、`/status`、`/daemon`、`/warnings`、`/pwd`、`/usage`；代码审查进行中不能开旁支对话。
- **按功能开关显示**：`/goal`、`/plugins`、`/daybreak` 默认可用，关闭对应的功能开关（`goals`、`plugins`、`cli_daybreak`）后隐藏；`/worktree` 与 `/voice` 的功能开关已在 v0.164.0 退役（`/voice` 只在附带语音运行时的安装包里出现）。

:::

## 快捷键与输入技巧

| 按键或输入 | 作用 |
| --- | --- |
| `/` | 打开斜杠命令菜单（仅在消息开头） |
| `@` | 在工作区中搜索文件，并把路径插入输入框 |
| 行首 `!` | 把这一行当作本地 shell 命令直接执行：不经审批、不进沙箱（相当于完全访问），也不走会话的网络代理；v0.167.0 起删字后露出句首 `!` 时保持在普通对话草稿模式 |
| `$` | 提及技能或应用，例如 `$skill-creator` |
| `Ctrl+V`、`Shift+Insert`、`Ctrl+Alt+V` | 粘贴剪贴板中的文本或图片（Windows 上 v0.163.0 起 `Ctrl+V` 与 `Shift+Insert` 同时支持文本与图片）；直接粘贴图片文件路径也会变成图片附件，v0.167.0 起在支持图形协议的终端上编写时可直接预览本地图片附件 |
| `Enter` | 发送；Codex 正在工作时发送，会立即打断当前回复或活跃的 Code Mode 单元并注入新指令（`instant_interrupt` 自 v0.163.0 起默认开启） |
| `Tab` | Codex 正在工作时，把消息、斜杠命令或 shell 命令排到下一轮 |
| `Ctrl+J` | 插入换行（终端支持时也可以用 `Shift+Enter`、`Alt+Enter`） |
| `Esc` | Codex 正在工作时中断当前这一轮 |
| 输入框为空时按两次 `Esc` | 浏览之前的提示词：`←`、`→` 选择，`Enter` 把当前会话回退到所选提示词之前，并把它放回输入框重新编辑。v0.156.0 起在原会话中回退，不再分叉出新会话；已经发生的文件改动不会撤销 |
| `Up`、`Down` | 翻阅草稿历史 |
| `Ctrl+R`、`Ctrl+S` | 向前、向后搜索提示历史；`Enter` 采用，`Esc` 取消 |
| `Ctrl+G` | 用 `VISUAL`（未设置时用 `EDITOR`）指定的编辑器编写长提示词，保存并关闭后回到输入框 |
| `Ctrl+O` | 复制近期一条已完成的回复 |
| `Ctrl+T` | 打开完整的对话记录视图；浏览之前的提示词时用来展开或收起详情 |
| `Ctrl+L` | 清屏，保留当前对话（v0.167.0 起清屏后仍可通过 `Ctrl+T` 查看此前消息） |
| `Alt+R` | 开关原始回滚模式 |
| `F8` | 开始或结束语音对话（v0.156.0 起，对应 `tui.keymap.chat.toggle_voice`） |
| `F9` | 语音对话进行中开关麦克风静音（v0.163.0 起由 `Ctrl+X` 移至 `F9`） |
| `Ctrl+X` | 前导键（Leader Key，v0.163.0 起默认绑定）：按下后展开快捷键提示，保持打开直至选择或取消 |
| `F2` | 打开警告查看器，同 `/warnings`（v0.156.0 起） |
| `F3`、`F4` | 在对话记录中查找；聚焦某组工具活动查看详情（v0.156.0 起，见下文“全屏对话记录”） |
| `Ctrl+/` | 切换旁支对话 |
| `Shift+Tab` | 在协作模式（如计划模式）之间切换 |
| `Alt+,`、`Alt+.` | 在当前模型支持的档位间降低、提高推理强度，只对当前会话生效（也可以用 `Shift+Down`、`Shift+Up`）。v0.158.0 起可以一直调到 `max`，`ultra` 仍要在 `/model` 选中模型后的 More reasoning… 里选择 |
| `Shift+Left` | 编辑已排队的消息（也可以用 `Alt+Up`）。v0.158.0 起不再按终端挑选，界面提示统一显示 `Shift+Left`（此前多数终端里提示的是 `Alt+Up`） |
| `Alt+Left`、`Alt+Right` | 切换到上一个、下一个 agent |
| 输入框为空时按 `←` | 打开代理总览（连接本机守护进程时）。v0.158.0 起，对话正在另一个应用中打开、这里只能只读查看时，除了 `Esc` 也可以按 `←` 回到代理总览 |
| 空输入框中按 `?` | 显示快捷键提示 |
| `Ctrl+C` | 中断当前任务；空闲时再按一次退出（`Ctrl+D` 同样可以退出） |

除 `/`、`@`、`!`、`$`、`Esc`（回溯）、`Ctrl+C`、`Ctrl+D`、`Ctrl+V`、`Ctrl+Alt+V`、`Shift+Tab`、`Alt+Left`、`Alt+Right`、`F2` 与空输入框里的 `←`（把 `editor.move_left` 改成不含 `left` 后它就不再打开代理总览）这些固定按键外，上表中的快捷键都可以用 `/keymap` 或 `config.toml` 中的 `tui.keymap` 重新绑定。键名写作 `ctrl-a`、`shift-enter`、`page-down` 这样的形式；针对具体场景的绑定会覆盖 `tui.keymap.global`，绑定为空列表表示解绑。v0.156.0 新增的默认键（`F2`、`F3`、`F4`、`F8`）如果已经被你绑定给了别的操作，会自动让位，不会冲突。

## 全屏对话记录

v0.157.0 起，交互界面默认使用“全屏对话记录”（`tui.fullscreen_transcript = true`，v0.156.0 可以用 `/tui` 手动开启）：对话记录画在终端的备用屏幕里，滚动、选择与搜索都由 Codex 自己处理，不再依赖终端的回滚记录。

| 操作 | 作用 |
| --- | --- |
| `PgUp`、`PgDn`、鼠标滚轮 | 滚动对话记录（v0.162.0 起可用 `tui.mouse_scroll_speed` 调节滚轮速度倍率，默认 `1.0`） |
| `Ctrl+Home`、`Ctrl+End` | 跳到开头、回到底部（也可以用 `Alt+Shift+,`、`Alt+Shift+.`） |
| 鼠标拖动、双击、三击 | 选择文本，双击选中整个词，三击选中整行；按住 `Shift` 单击可以扩展已有的选区（v0.157.0 起） |
| 松开鼠标 | v0.158.0 起，用鼠标选中文字后一松开就自动复制，选区保留，由 `tui.copy_on_select` 控制（v0.164.0 起输入框文本同样适用，见下文） |
| `Ctrl+Space` | 用键盘开始选择，再用方向键或按词、行、页移动选区并支持内置搜索与自定义快捷键（v0.166.0 增强） |
| 有选区时按 `Ctrl+C`、`Ctrl+Insert`、`Enter` | 复制选中的文本（`Ctrl+Shift+C`、`Ctrl+Insert`（v0.162.0 起）以及终端转发过来的 `Cmd+C` 也可以；复制时同时保留纯文本与富文本 HTML），`Enter` 复制后回到底部；`Esc` 取消选择 |
| 右键 | 有选区时复制选中的文本（在输入框里同样可用）；v0.158.0 起，没有选区时把剪贴板里的文本粘贴到输入框，由 `tui.right_click_paste` 控制 |
| 单击链接或图片路径 | 打开链接（Markdown 链接和裸 URL 均可；v0.162.0 起审批标题、提问、MCP 提示、警告与横幅中的跨行 URL 也可点击；v0.167.0 起对话记录里查看过的本地图片路径也可点击打开） |
| `F3` | 在整个对话记录中查找，不区分大小写，需要时会加载更早的历史；对话记录视图里也可以按 `/` |
| `F4` | 聚焦某组工具活动，查看它的详细内容 |

v0.158.0 起，从对话记录里复制选区会保留 Markdown 格式：粗体、斜体、行内代码、链接、标题、列表、引用和表格都按 Markdown 写出，只选中代码等原样内容时仍按原文复制；想要整条回复的 Markdown 原文，用 `/copy` 或 `Ctrl+O`。松开即复制与右键粘贴各有一个配置：

- `tui.copy_on_select`：`auto`（默认）、`always` 或 `never`，对 `Ctrl+T` 打开的对话记录视图、恢复/派生会话时的预览以及底部输入框文本（v0.164.0 起）同样生效。`auto` 下大多数终端松开即复制，在 tmux、Zellij 里也是；只有直接在 Ghostty 1.2 及以上、macOS 上的 Kitty、Windows Terminal、Windows 上的 VS Code 中运行时不自动复制，因为这些终端的复制快捷键在终端自己没有选区时会转发给 Codex，直接按它即可。`never` 表示只用上表的按键或右键复制。另有 `tui.copy_on_select_clear_selection = true` 可在复制只读对话记录后自动取消选区。
- `tui.right_click_paste`：`auto`（默认）、`on` 或 `off`。`auto` 在 Windows、Linux（含 WSL）上启用，`on` 另外在 macOS 上启用；两者在 SSH 会话和 VS Code 的终端里都不读取剪贴板，也只在输入框可以编辑、没有选区、没在查找时才粘贴。`off` 则不做这种粘贴，右键粘贴留给终端自己处理。

在支持 Kitty 或 Sixel 图形协议的终端上，v0.164.0 起全屏对话记录可直接内嵌预览模型查看或生成的图片；v0.167.0 起，当审批提示打开时，还可以直接在对话记录中展开补丁详情。新会话标题栏在 v0.161.0 起移除了随机问候语，保持紧凑样式；全屏模式下空白处的花朵动画点一下会重播（受 `tui.animations` 与 `tui.effects.welcome` 控制）。全屏模式不显示启动提示，输入框上方不再轮换显示使用提示（那里只留给额度提醒），改为：一轮运行超过 30 秒时，工作状态指示下方会出现一条随机提示；从第三轮起，部分成功完成的回复后面也会出现一条（每次启动上限两条）。提示里的快捷键按你当前的绑定显示，也不会被选中或查找到；`tui.show_tooltips = false` 可以关掉。

想换回终端自己的回滚记录（例如习惯用终端的搜索与复制），在 `/tui` 里选 Scrollback 后重启，或在配置里写 `tui.fullscreen_transcript = false`。不使用备用屏幕时（`--no-alt-screen` 或 `tui.alternate_screen = "never"`）也是回滚记录模式；`tui.alternate_screen = "auto"` 时，通过 SSH 使用 macOS 自带的 Terminal.app 会自动改用回滚记录。v0.157.0 起，tmux 中设置了 `mouse off` 时，Codex 不再捕获鼠标。
