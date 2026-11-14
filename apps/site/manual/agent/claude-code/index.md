---
title: "Claude Code 中文手册"
description: "基于 Claude Code v2.1.318 官方文档整理的 Claude Code 中文手册。"
source: "https://daiw.org/manual/claude-code"
---

# Claude Code 中文手册

> 内容来源：[daiw.org](https://daiw.org/manual/claude-code) · 作者 David · 原文更新于 2026-11-06

> 基于 Claude Code v2.1.318 官方文档整理的 Claude Code 中文手册。

[Claude Code](https://claude.com/product/claude-code) 是 [Anthropic](https://www.anthropic.com/) 官方提供的命令行 AI 编程助手，以 `claude` 命令启动，在终端里读写文件、执行命令、调用 MCP 工具，完成从代码理解到提交 PR 的完整开发流程。

本手册已核对至 **Claude Code v2.1.318**（2026-11-04 发布）。内容随官方文档更新，但不追踪每一个补丁版本；具体行为请以你本机 `claude doctor` 与 `claude --version` 的实际结果为准。

```bash
claude --version
```

## 手册结构

- [安装与升级](/manual/agent/claude-code/installation)——原生安装脚本、Homebrew/WinGet/包管理器、npm、二进制完整性校验、自动更新与卸载。
- [启动命令行选项](/manual/agent/claude-code/cli-flags)——`claude` 子命令与 `--flag` 全量参考。
- [环境变量](/manual/agent/claude-code/environment-variables)——按用途分类的环境变量速查。
- [配置文件](/manual/agent/claude-code/configuration-files)——`settings.json`、`CLAUDE.md`、`.mcp.json` 等配置文件的位置、格式与优先级。
- [上手使用](/manual/agent/claude-code/scenarios)——从熟悉新代码库到修 bug、重构、写测试、开 PR、并行开发的实操套路。
- 命令参考——按使用场景拆成会话管理、模型与权限、并行协作、代码评审、自定义扩展、其它实用命令六个子页面，涵盖全部内置斜杠命令与随附技能（skill）。
- **进阶**——[Commands](/manual/agent/claude-code/custom-commands)、[Skills](/manual/agent/claude-code/skills)、[Agents](/manual/agent/claude-code/agents)、[Plugins](/manual/agent/claude-code/plugins)。
- [版本 Changelog](/manual/agent/claude-code/changelog)——从 1.0 GA 到 2.1.318 的关键里程碑（见「其它」分组）。

## 最快上手路径

```bash
# 1. 安装（macOS / Linux / WSL）
curl -fsSL https://claude.ai/install.sh | bash

# 2. 在项目根目录启动并登录
cd /path/to/project
claude

# 3. 首次进入项目，先生成 CLAUDE.md
/init
```

之后的操作大多是「用自然语言描述任务 + 在需要时用斜杠命令控制会话」的组合，具体可参考[上手使用](/manual/agent/claude-code/scenarios)。
