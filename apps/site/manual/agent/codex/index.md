---
title: "Codex 中文手册"
description: "基于 Codex CLI v0.167.0 官方文档整理的 Codex 中文手册。"
source: "https://daiw.org/manual/codex"
---

# Codex 中文手册

> 内容来源：[daiw.org](https://daiw.org/manual/codex) · 作者 David · 原文更新于 2026-11-06

> 基于 Codex CLI v0.167.0 官方文档整理的 Codex 中文手册。

[Codex CLI](https://github.com/openai/codex) 是 OpenAI 出品、在你本机运行的编码 agent，以 `codex` 命令启动：在终端里阅读代码、修改文件、执行命令、调用 MCP 工具，也能用 `codex exec` 嵌入脚本和 CI 流水线。它用 Rust 编写，以 Apache-2.0 协议在 GitHub 开源（仓库 `openai/codex`）。

本手册已核对至 **Codex CLI v0.167.0**（GitHub tag `rust-v0.167.0`，2026-11-06 发布），依据官方文档与近期稳定版发布说明整理。Codex 迭代很快，具体行为请以你本机的版本为准：

```bash
codex --version
codex doctor   # 检查安装、配置、登录与运行环境
```

## Codex 的几种形态

同一个 Codex 有多个使用入口。本手册以 CLI 为主，其他形态只在相关处简要提及：

| 形态 | 运行位置 | 与 CLI 的关系 |
| --- | --- | --- |
| Codex CLI | 本机终端 | 本手册的主题，开源 |
| ChatGPT 桌面应用中的 Codex | macOS、Windows（Linux 版处于预览阶段） | 图形界面的本地客户端。`codex app` 可以从终端打开它（未安装时启动安装程序），会话中输入 `/app` 可把当前会话转到桌面端继续 |
| IDE 扩展 | VS Code、Cursor、Windsurf 等（Xcode、JetBrains 有各自的集成） | 编辑器侧边栏里的 Codex，不开源 |
| Codex cloud | OpenAI 托管的隔离容器 | 在云端并行运行任务。CLI 中用 `codex cloud` 浏览或提交云端任务，用 `codex apply` 把任务产生的 diff 应用到本地；只支持 ChatGPT 账号登录 |

桌面应用、CLI 与 IDE 扩展读取同一个配置文件 `~/.codex/config.toml`；CLI 与 IDE 扩展还共享同一份登录缓存，在其中一处登出后，两边下次启动都需要重新登录。

## 快速上手

```bash
# 1. 安装（macOS / Linux；Windows 与其他方式见安装页）
curl -fsSL https://chatgpt.com/codex/install.sh | sh

# 2. 进入项目目录启动，首次运行按提示登录（推荐 Sign in with ChatGPT）
cd /path/to/project
codex

# 3. 在会话里为项目生成 AGENTS.md
/init

# 4. 在脚本或 CI 中非交互运行
codex exec "总结这个仓库的结构，列出风险最高的 5 个模块"
```

之后的日常使用，基本就是“用自然语言描述任务，在需要时用斜杠命令调整会话”，常见套路见[常见使用场景](/manual/agent/codex/scenarios)。

## 手册导读

**入门**

- [安装、登录与升级](/manual/agent/codex/installation)——系统要求，安装脚本、npm、Homebrew 与二进制安装，登录方式与凭据存储，`codex update`、`codex doctor` 与卸载。
- [启动命令行选项](/manual/agent/codex/cli-flags)——全部子命令一览，以及模型、沙箱与审批、目录、配置覆盖等全局参数。
- [配置文件 config.toml](/manual/agent/codex/configuration)——Codex 的主要配置入口。
- [配置项速查](/manual/agent/codex/config-reference)——`config.toml` 配置项的速查表。
- [环境变量](/manual/agent/codex/environment-variables)——按用途分组的环境变量，以及 Codex 注入给子进程的变量。
- [常见使用场景](/manual/agent/codex/scenarios)——从初次运行到 CI、代码审查、MCP、本地模型的实操套路。

**核心概念**

- [沙箱、审批与安全](/manual/agent/codex/sandbox-approvals)、[AGENTS.md 项目指令](/manual/agent/codex/agents-md)、[模型与推理](/manual/agent/codex/models)。

**命令参考**

- [斜杠命令](/manual/agent/codex/slash-commands)、[非交互模式 codex exec](/manual/agent/codex/exec)、[会话管理](/manual/agent/codex/sessions)、[代码审查](/manual/agent/codex/review)。

**进阶**

- [命令规则 Rules](/manual/agent/codex/rules)、[MCP 集成](/manual/agent/codex/mcp)、[Skills 技能](/manual/agent/codex/skills)、[插件](/manual/agent/codex/plugins)、[Hooks](/manual/agent/codex/hooks)、[子代理](/manual/agent/codex/subagents)、[SDK 与 App Server](/manual/agent/codex/sdk-app-server)、[Codex Cloud、GitHub 与 IDE](/manual/agent/codex/cloud-integrations)。

**其它**

- [更新日志](/manual/agent/codex/changelog)。

## 与《Claude Code 中文手册》的关系

本站的[《Claude Code 中文手册》](https://daiw.org/manual/claude-code)与本手册结构基本对应，两者的很多概念可以一一对照（例如 `AGENTS.md` 之于 `CLAUDE.md`、`codex exec` 之于 `claude -p`），同时使用两款工具时可以对照阅读。

## 想看源码怎么实现

本手册讲怎么用。想知道这些功能在源码里是怎么实现的（app-server 协议、agent 循环、工具编排、三个平台的沙箱等），可以接着读本站的[《Codex 源码解读》](https://daiw.org/manual/codex-source)。源码解读目前以 `rust-v0.158.0` 为准，各章会链接回本手册的对应页面；CLI 后续版本的变化请以本手册与官方发布记录为准。
