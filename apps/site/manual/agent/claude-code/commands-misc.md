---
title: "账户、诊断与其它命令"
description: "登录账户、用量统计、诊断修复、语音与移动端等零散但常用的命令"
source: "https://daiw.org/manual/claude-code/commands-misc"
---

# 账户、诊断与其它命令

> 登录账户、用量统计、诊断修复、语音与移动端等零散但常用的命令

## 账户与登录

| 命令 | 作用 |
| --- | --- |
| `/login` | 登录 Anthropic 账号。⚠️ v2.1.273 起用 Claude 账号登录时也会请求访问你 claude.ai 上的插件 |
| `/logout` | 登出。v2.1.275 起经 Claude apps 网关登录的，若网关声明支持 token 撤销，`/logout` 也会结束网关上的会话 |
| `/status` | 打开设置界面的 Status 标签页，显示版本、模型、账号、连接状态（Claude 响应过程中也能打开）。v2.1.221 起还会显示会话类型：`interactive`，或后台作业的 `attached` / `unattended`；v2.1.261 起多一行「Organization policy」，说明组织策略为何没能加载；v2.1.274 起 GitHub 一行改叫「Cloud sessions」；v2.1.275 起经 Claude apps 网关登录时显示登录的账号；🆕 v2.1.278 起多一行「Auto mode server」，显示本会话的 auto mode 分类器是否跑在服务端；v2.1.282 起还会列出项目设置里被忽略、或把遥测关掉的遥测变量（`claude doctor` 同样列出） |
| `/upgrade` | 打开升级页面切换到更高的订阅套餐 |
| `/privacy-settings` | 查看/修改隐私设置（仅 Pro/Max 订阅用户可见） |
| `/passes` | 分享一周免费试用给朋友（仅符合条件的账号可见） |

## 用量与费用

| 命令 | 作用 |
| --- | --- |
| `/usage` | 查看会话花费、套餐用量上限、活跃度统计；Pro/Max/Team/Enterprise 套餐下还能按技能、subagent、插件、MCP 服务器细分。别名 `/cost`、`/stats`。v2.1.243 起新增 Loops 细分（每个 `/loop` 的运行次数与 token）；v2.1.251 / v2.1.260 起还显示本会话 prompt 缓存命中率与未命中的可能原因；🆕 v2.1.299 起新增针对 `max` 推理强度、工作流、常驻上下文与大工具结果的告警，v2.1.305 起每条告警给出单行修复说明并可按 `f` 一键应用（`/doctor` 同样提供） |
| `/usage-credits` | 配置用量额度，在触达套餐上限后仍可继续工作（原 `/extra-usage`） |

## 诊断与反馈

| 命令 | 作用 |
| --- | --- |
| `/doctor` | 技能。做一次安装与配置体检：重复或残留的安装、`PATH` 问题、无法解析的 settings 文件、没用上的技能 / MCP / 插件、慢 hook 等，先报告、经你确认再动手修复（v2.1.205 起如此，更早版本是只读的诊断界面，按 `f` 交给 Claude 修复）。别名 `/checkup`；终端里的 `claude doctor` 只打印只读的安装诊断。🆕 v2.1.283 起 `/doctor prompt-audit`（或 `/checkup prompt-audit`）审查你的 CLAUDE.md、技能、agent 与命令里为旧模型写的提示词套路，过时的路径、命令与相互矛盾的说明文件排在报告最前 |
| `/skill-doctor` | 🆕 **v2.1.261+**：列出哪些已加载的技能从未用上、各自占多少上下文，方便清理 |
| `/debug [description]` | 技能。为当前会话开启调试日志并分析问题；调试日志默认关闭（除非以 `claude --debug` 启动），中途运行 `/debug` 只会从此刻开始记录 |
| `/feedback [report]` | 提交反馈、报 bug 或分享会话。别名 `/bug`、`/share`。v2.1.247 起 Claude 可以在会话出问题时用 `SendFeedback` 工具起草报告，由你在这里审阅后再发送（`feedbackDrafts` 设置可关）。⚠️ v2.1.273 起报告只附上最近一次 API 请求里与模型行为有关的参数（模型、系统提示词、工具），不含请求元数据与 `CLAUDE_CODE_EXTRA_BODY` 字段 |
| `/insights` | 生成一份分析报告：你的会话都花在哪些项目区域、交互模式与卡点。🆕 v2.1.281 起报告里多了一条 auto mode 建议，估算最近的会话里有多少权限提示本可以由 auto mode 处理 |
| `/team-onboarding` | 基于过去 30 天的会话、命令、MCP 使用情况，生成一份团队 onboarding 指南 |
| `/release-notes` | 在交互式版本选择器里查看 changelog，可选查看某个具体版本或全部版本 |
| `/heapdump` | 生成 JS 堆快照与内存分析，写到桌面（或 Linux 无桌面环境时的主目录），用于排查高内存占用 |

## MCP 集成

| 命令 | 作用 |
| --- | --- |
| `/mcp reconnect all` | 🆕 **v2.1.284+**：重试所有连接失败或需要重新认证的 MCP 服务器 |

## IDE 与浏览器集成

| 命令 | 作用 |
| --- | --- |
| `/ide` | 管理 IDE 集成并查看连接状态（⚠️ v2.1.318 起在 IDE 内置终端里启动 Claude Code 时不再自动安装或更新 IDE 扩展，请从外部终端运行 `/ide` 或在编辑器扩展面板里管理） |
| `/chrome` | 配置 Claude in Chrome 浏览器自动化设置 |
| `/terminal-setup` | 配置 Shift+Enter 等终端快捷键（仅在需要的终端，如 VS Code、Cursor、Alacritty、Zed 中出现） |

## 语音与移动端

| 命令 | 作用 |
| --- | --- |
| `/voice [hold\|tap\|off]` | 开关语音听写，或指定特定模式（需要 claude.ai 账号） |
| `/mobile` | 显示下载 Claude 移动端 App 的二维码。别名 `/ios`、`/android`。v2.1.271 起只显示一个指向 claude.ai/mobile 的二维码，由它为你的手机打开对应的应用商店 |
| `/install-slack-app` | 安装 Claude Slack App，走浏览器完成 OAuth |

## 第三方 API 提供方配置

| 命令 | 作用 |
| --- | --- |
| `/setup-bedrock` | 交互式向导配置 Amazon Bedrock 的鉴权、区域、模型钉版（需先设置 `CLAUDE_CODE_USE_BEDROCK=1`) |
| `/setup-vertex` | 交互式向导配置 Google Cloud's Agent Platform 的鉴权、项目、区域、模型钉版（需先设置 `CLAUDE_CODE_USE_VERTEX=1`) |

## 杂项

| 命令 | 作用 |
| --- | --- |
| `/help` | 显示帮助与可用命令列表 |
| `/scroll-speed` | 交互式调整鼠标滚轮速度（仅全屏渲染模式） |
| `/radio` | 在浏览器打开 Claude FM lo-fi 电台 |
| `/stickers` | 订购 Claude Code 周边贴纸 |

::: info

并非所有命令对所有用户都可见，取决于平台、套餐与运行环境——例如 `/desktop` 只在 macOS/Windows 且已登录订阅账号时出现，`/upgrade` 只在 Pro/Max 套餐下出现。命令列表以你本机 `/help` 或 `/` 菜单的实际展示为准。

:::
