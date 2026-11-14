---
title: "自定义与扩展"
description: "CLAUDE.md、技能（skills）、插件、MCP、Hooks 与界面自定义"
source: "https://daiw.org/manual/claude-code/commands-customization"
---

# 自定义与扩展

> CLAUDE.md、技能（skills）、插件、MCP、Hooks 与界面自定义

## 项目记忆：CLAUDE.md

| 命令 | 作用 |
| --- | --- |
| `/init` | 探索项目并生成一份 `CLAUDE.md`。设置 `CLAUDE_CODE_NEW_INIT=1` 后会先交互式询问要生成哪些文件（CLAUDE.md、skills、hooks），再动手 |
| `/memory` | 编辑 `CLAUDE.md` 记忆文件，开关自动记忆（auto-memory），查看自动记忆已经记了什么 |

一个新仓库的标准起手式是 `/init` 生成初版 `CLAUDE.md`，再用 `/memory` 逐步精修——把项目约定、常用命令、代码风格写成 Claude 每次都会看到的“常识”，而不是每次对话重复口述。`CLAUDE.md` 的存放位置、加载顺序、`@` 导入语法等文件层面的细节见[配置文件](/manual/agent/claude-code/configuration-files)。

## 技能（Skills）

技能是“你反复复制粘贴的一段指令/清单/多步骤流程”的固化产物：写一个 `SKILL.md`，Claude 就能在合适时机自动使用，或者你用 `/skill-name` 直接调用。旧版的 `.claude/commands/*.md` 自定义命令已经并入技能体系，写法兼容，行为等价。完整说明见 **[Skills](/manual/agent/claude-code/skills)** 与 **[Commands](/manual/agent/claude-code/custom-commands)**。

## MCP(Model Context Protocol)

| 命令 | 作用 |
| --- | --- |
| `/mcp [reconnect <server>\|enable\|disable [<server>\|all]]` | 管理 MCP 服务器连接与 OAuth 登录状态；不带参数打开交互列表。v2.1.273 起服务器在会话中途断开、自动重连也放弃时，会弹出指向这里的通知；v2.1.283 起工具列表一次显示更多工具，支持翻页键与鼠标，组织封禁的工具带告警图标 |

命令行侧对应 `claude mcp`（增删配置）、`claude mcp login/logout <server>`（单独走 OAuth，v2.1.186+）。MCP 服务器暴露的 prompt 会以 `/mcp__<server>__<prompt>` 的形式出现在命令列表里。

## 插件

| 命令 | 作用 |
| --- | --- |
| `/plugin [subcommand]` | 管理插件；不带参数打开插件菜单，或直接传 `list`/`install`/`enable`/`disable`。🆕 v2.1.275 起 `/plugin install <plugin> --marketplace <source>` 会先提议添加该 marketplace，再安装插件 |
| `/reload-plugins [--force]` | 重新加载全部已启用插件，应用未生效的变更；如果会改变已加载的 MCP 工具集（从而让 prompt 缓存失效），需要加 `--force` 才会真正执行。v2.1.268 起用 `/plugin` 安装、启用、禁用的改动在关闭菜单时即生效，这一步只在手改插件文件后才需要 |
| `/reload-skills` | 重新扫描技能/命令目录，让磁盘上新增或修改的技能无需重启即可生效（v2.1.152+）。⚠️ v2.1.299 / v2.1.304 起自动压缩完成后会自动把技能列表重发给 Claude，而平时运行 `/reload-skills` 只补发新增或修改过的技能 |

插件可以打包技能、subagent、hooks、MCP 服务器、输出风格，统一分发给团队；完整的组成、目录结构、Marketplace 与作者侧打包见 **[Plugins](/manual/agent/claude-code/plugins)**。安装示例：

```text
/plugin install skill-creator@claude-plugins-official
```

## Hooks

| 命令 | 作用 |
| --- | --- |
| `/hooks` | 查看当前生效的 hook 配置（按工具事件分类） |

Hooks 用于在特定生命周期事件（如 `SessionStart`、`PreToolUse`、`Stop`）上运行确定性的脚本逻辑，弥补“技能只能靠模型自觉遵守指令”的不足，适合强制校验、审计、自动格式化等场景。v2.1.251 新增 `PreModelSwitch` / `PostModelSwitch` 事件，可以拦截、确认或注释一次模型切换。v2.1.271 起 SessionStart、UserPromptSubmit、PreToolUse、SessionEnd hook 运行时 spinner 会显示出来并计时，等待 SessionStart hook 的提示可以按 Esc 取消。

⚠️ v2.1.280 起 `PermissionRequest` 事件上不再运行 agent 型 hook（它的回答本来就无法批准或拒绝请求），会报错并指向 command 或 http hook。v2.1.281 起阻断型事件（如 PreToolUse）上的 `mcp_tool` hook 在 MCP 服务器还在连接时会等它连上（最长到 MCP 连接超时），不再被跳过；`/hooks` 的详情页也会说明这是哪种 hook、该到哪里修改，而不是一律指向 settings.json。🆕 v2.1.295 起 `command` 与 `http` hook（以及 v2.1.317 起 Agent SDK 的 hook 回调）支持 `onFailure: "block"`：无法启动、超时或返回非预期退出码时阻断操作而非放行。⚠️ v2.1.299 起 `UserPromptSubmit` hook 改在技能或自定义命令展开前运行，阻断提示词即可一并阻止内嵌的 `!` 命令；v2.1.300 起 `PreToolUse` 与 `PermissionRequest` 返回的 `updatedInput` 会按工具 schema 校验（剔除未知键，参数不合法则拒绝调用）；v2.1.302 / v2.1.312 起单会话同时运行的 `prompt` 与 `agent` hook 上限为 24 个（单事件最多 12 个）。

## 界面与体验

| 命令 | 作用 |
| --- | --- |
| `/theme` | 切换配色主题，含跟随终端明暗的 `auto`、色盲友好主题、ANSI 主题，以及 `~/.claude/themes/` 自定义主题 |
| `/statusline` | 配置状态栏；描述你想要的效果，或不带参数从当前 shell prompt 自动生成 |
| `/keybindings` | 打开快捷键配置文件。⚠️ v2.1.280 起 `y` / `n` 不再默认绑定对话框的确认 / 取消（统一用 Enter / Esc），想找回就在 `keybindings.json` 里把它们绑到 `confirm:yes` / `confirm:no`；v2.1.283 起拼错的修饰键（如 `ctl+k`）会在调试日志里告警，`/rewind` 与 `/diff` 的列表改用通用的 `select:*` 动作（旧的 `messageSelector:*` / `diff:*` 绑定仍然有效） |
| `/color [color\|default]` | 设置当前会话 prompt bar 颜色，连接 Remote Control 时会同步到 claude.ai/code |
| `/focus` | 切换聚焦视图：只显示最后一条 prompt、一行工具调用摘要与最终回复 |
| `/output-style [name]` | 🆕 **v2.1.269+**：列出并切换输出风格（含 v2.1.237 起内置的「Concise」：先给结果、省掉铺垫），Remote Control 与无头会话里也能用 |
| `/tui [default\|fullscreen]` | 设置终端 UI 渲染模式并重新进入（`fullscreen` 为无闪烁 alt-screen 渲染器） |

## 项目专属能力

| 命令 | 作用 |
| --- | --- |
| `/run` | 技能。启动并驱动你的应用，用真实运行效果而非只靠测试来验证改动（v2.1.145+） |
| `/verify` | 技能。构建并运行项目，用观察到的实际行为确认一次代码改动是否达到预期（v2.1.145+） |
| `/run-skill-generator` | 技能。从一次干净环境的启动过程中，记录安装命令、环境变量、启动脚本，固化成项目专属技能 `.claude/skills/run-<project>/`，供 `/run`、`/verify` 及其它 agent 复用（每个项目建议跑一次） |
| `/dataviz [request]` | 技能。图表/仪表盘设计指导：自动挑选图表形式、按角色分配颜色、校验色盲友好度与对比度（v2.1.198+） |
| `/claude-api [migrate\|upgrade\|cost-optimize\|managed-agents-onboard\|managed-agents-secure\|api-version]` | 技能。加载 Claude API 参考资料（按项目语言自动匹配），或帮你把已有 Claude API 代码升级到新模型。v2.1.239 起 `upgrade` 把 Python 项目从 `anthropic` 0.x 迁到 1.x；v2.1.247 起 `cost-optimize` 分析现有项目的 API 花费，逐项做可测量的降本改动；🆕 v2.1.304 起 `managed-agents-secure` 对照官方安全指南检查 Managed Agents 设置；v2.1.307 起 `api-version` 将代码迁移至 API 版本 `2026-10-21`；v2.1.318 起 `managed-agents-onboard` 默认给新建 agent 的内置工具与模板 MCP 工具设置 `auto` 权限策略 |
| `/design-sync [hint]` | 技能。把仓库里的 React 设计系统同步上传到 Claude Design，让生成的设计使用你的真实组件（仅 Anthropic API 可用；⚠️ v2.1.302 起提示独立版 `claude.ai/design` 将于 2026-12-14 下线，v2.1.317 起设计系统已迁入 Claude 时会提前告知并停止） |
| `/design-sync [hint]` | 技能。把仓库里的 React 设计系统同步上传到 Claude Design，让生成的设计使用你的真实组件（仅 Anthropic API 可用；⚠️ v2.1.302 起提示独立版 `claude.ai/design` 将于 2026-12-14 下线，v2.1.317 起设计系统已迁入 Claude 时会提前告知并停止） |
| `/design-login` | 为 `/design-sync` 授权 claude.ai 账号访问设计系统 |

## 建议的自定义投入顺序

1. 先写好 `CLAUDE.md`(`/init` + `/memory`），这是成本最低、收益最直接的一步。
2. 把“经常口述的多步骤指令”沉淀成个人/项目技能。
3. 需要跨项目共享或团队统一分发时，再打包成插件。
4. 需要“确定性强制执行”（而不是靠模型自觉）时，才引入 hooks。
