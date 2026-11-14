---
title: "Codex Cloud、GitHub 与 IDE"
description: "CLI 之外的 Codex 入口，包括 Codex Cloud 与 codex cloud 命令、GitHub Action 与 PR 代码审查、IDE 扩展与桌面端、worktree，以及从 Claude Code 或 Cursor 导入配置。"
source: "https://daiw.org/manual/codex/cloud-integrations"
---

# Codex Cloud、GitHub 与 IDE

> CLI 之外的 Codex 入口，包括 Codex Cloud 与 codex cloud 命令、GitHub Action 与 PR 代码审查、IDE 扩展与桌面端、worktree，以及从 Claude Code 或 Cursor 导入配置。

Codex 不只在终端里运行。本篇介绍 CLI 之外的几个入口，以及 CLI 怎样与它们衔接。

## Codex Cloud

Codex Cloud 在 OpenAI 托管的隔离容器里运行任务，可以并行，适合耗时长、想放在后台跑或想比较几种方案的工作。任务可以从网页、GitHub、GitLab、Linear、Slack、IDE 扩展或 CLI 发起。初次使用时，在 [chatgpt.com/codex](https://chatgpt.com/codex) 用 ChatGPT 账号登录，连接 GitHub 或 GitLab（Beta），再到[环境设置](https://chatgpt.com/codex/settings/environments)里为仓库创建环境；任务完成后查看 diff，再追问或开 PR。

| 环境项 | 说明 |
| --- | --- |
| 执行过程 | 创建容器并检出分支 → 运行 setup 脚本（恢复缓存的容器时可再运行 maintenance 脚本）→ agent 循环执行命令、修改代码、运行检查 → 给出回答和 diff |
| 镜像与依赖 | 默认镜像 `universal` 预装常用语言；能识别 npm、yarn、pnpm、pip、pipenv、poetry 并自动安装依赖，复杂的情况自己写 setup 脚本 |
| 变量与 secrets | 环境变量在整个任务期间有效；secrets 只有 setup 脚本能用，agent 阶段开始前会被移除 |
| 缓存 | 容器状态缓存时长上限为 12 小时，修改脚本、变量或 secrets 会让缓存自动失效 |
| 联网 | setup 阶段可以联网；agent 阶段默认断网，可以按环境开启，并用域名白名单和 HTTP 方法限制收紧 |

setup 脚本里 `export` 的变量不会带到 agent 阶段，持久的变量请写进 `~/.bashrc` 或环境设置。

### codex cloud 命令

`codex cloud`（别名 `cloud-tasks`，实验性）在终端里浏览云端任务，并把改动应用到本地；它需要用 ChatGPT 账号登录（`codex login`）。不带子命令时打开交互式界面。

| 子命令 | 说明 |
| --- | --- |
| `exec QUERY --env ENV_ID` | 提交新任务，成功后打印任务链接；`QUERY` 省略或写 `-` 时从 stdin 读取，`--env` 也可以写环境名称；`--attempts N` 指定尝试次数（1～4，默认 1），`--branch` 指定分支（默认当前分支） |
| `list` | 列出任务；`--env` 按环境过滤，`--limit`（1～20，默认 20），`--cursor` 翻页，`--json` 输出 JSON |
| `status TASK_ID` | 查看任务状态（`PENDING`、`READY`、`APPLIED`、`ERROR`）；不是 `READY` 时以非零状态退出 |
| `diff TASK_ID`、`apply TASK_ID` | 显示任务的 diff，或把它应用到本地；`--attempt N` 选择第几次尝试；`apply` 没有完全成功时以非零状态退出 |

这几个子命令的 `TASK_ID` 也可以直接写任务链接。`codex cloud` 会把诊断信息（包括认证方式与账号 ID、应用失败的详情）追加写进**当前目录**下的 `error.log`（源码行为，官方文档未提及）；在仓库里运行时注意别把它提交上去。

```bash
codex cloud exec --env ENV_ID --attempts 2 "修复 CI 里失败的单元测试"
codex cloud apply TASK_ID --attempt 2
```

顶层的 `codex apply TASK_ID`（别名 `codex a`）同样要求 ChatGPT 账号登录，它用 `git apply` 把云端任务近期的 diff 应用到本地工作区，失败（例如有冲突）时以非零状态退出。

## GitHub Action

`openai/codex-action@v1` 在 GitHub Actions 里安装 Codex CLI，提供 API key 时启动 Responses API 代理，再按指定的权限运行 `codex exec`。使用前把 API key 存为仓库 secret，并在调用 action 之前检出代码；runner 用 Linux 或 macOS（Windows 必须设置 `safety-strategy: unsafe`）。

```yaml
name: Codex review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - id: codex
        uses: openai/codex-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          sandbox: read-only
          output-file: codex-review.md
          prompt: |
            评审本 PR 相对目标分支的改动，只列出会导致错误行为、安全问题或缺少测试的地方，
            每条附上文件和行号。

      - uses: actions/upload-artifact@v4
        with:
          name: codex-review
          path: codex-review.md
```

| 输入 | 说明 |
| --- | --- |
| `prompt`、`prompt-file` | 二选一：内联提示词，或仓库里的提示词文件 |
| `codex-args` | 额外的 `codex exec` 参数，写成 JSON 数组或 shell 字符串（如 `--profile ci`） |
| `model`、`effort`、`sandbox` | 模型、推理强度和沙箱模式（`workspace-write`、`read-only`、`danger-full-access`） |
| `output-file`、`codex-version`、`codex-home` | 最终消息写入的文件；固定的 CLI 版本（留空用当前稳定版）；共享的 Codex home |
| `safety-strategy` | 默认 `drop-sudo`（运行前移除 sudo）；另有 `unprivileged-user`（配合 `codex-user`）、`read-only`、`unsafe` |
| `allow-users`、`allow-bots` | 额外允许触发的账号，默认只有对仓库有写权限的用户 |

action 的输出 `final-message` 是 Codex 的末尾一条消息，需要结构化结果时通过 `codex-args` 传入 `--output-schema`（见[非交互模式 codex exec](/manual/agent/codex/exec)）。要把结果发回 PR，就在另一个拥有 `pull-requests: write` 权限、但不运行 Codex 的 job 里用这个输出发评论。安全方面：限制谁能触发工作流；PR 与 issue 里的文字可能夹带提示注入，送进 Codex 前先清洗；多租户 runner 上不要用 `unsafe`；`read-only` 模式下 Codex 仍以较高权限运行，不能单靠它保护密钥。

## PR 代码审查

仓库接入 Codex Cloud 后，在 [Codex 设置](https://chatgpt.com/codex/settings/code-review)里为它打开 Code review（需要该仓库的 push 或 admin 权限），就可以在 PR 评论里使用：

| 写法 | 效果 |
| --- | --- |
| `@codex review` | 发起评审并提交 GitHub review，只标记 P0、P1 级问题；可以追加关注点，如 `@codex review for issues in the database migration` |
| `@codex security review` | 更深入的安全评审（研究预览） |
| `@codex fix the P1 issue` 或其他指令 | 以该 PR 为上下文启动云端任务，有权限时把修复推回分支 |

打开 Automatic reviews 后，每个新 PR 都会自动评审。仓库专属的评审规则写在离相关代码较近的 `AGENTS.md` 里的 `## Code Review Rules` 小节。GitLab 合并请求同样支持（Beta）。本地评审见[代码审查](/manual/agent/codex/review)。

## IDE 扩展与桌面端

- **IDE 扩展**：VS Code、Cursor、Windsurf 使用 Codex 扩展（`openai.chatgpt`），Xcode 和 JetBrains IDE 提供各自的集成。扩展能把打开的文件、选中的代码加进提示，在代码旁审查改动，任务变大时委派给 Codex Cloud。终端里的 `/ide` 会把 IDE 中打开的文件、当前选区等上下文带进下一条提示（见[斜杠命令](/manual/agent/codex/slash-commands)）。
- **桌面端**：`codex app [PATH]`（仅 macOS 和 Windows）在 ChatGPT 桌面应用中打开指定的工作区（默认当前目录）。没有安装时，macOS 上先下载安装再打开；Windows 上打开安装程序，并提示装好后要打开的路径。TUI 里的 `/app` 把当前会话转到桌面应用继续。桌面应用新建 Codex 对话时，可以选择 Local、Worktree 或 Cloud 作为运行位置。

## Worktree

worktree 基于 `git worktree`：同一仓库检出多份独立的文件副本，共享 `.git` 元数据，多个对话可以并行而互不干扰。

### CLI：--worktree 与 /worktree

v0.154.0 起 CLI 支持创建托管 worktree；v0.156.0 起默认开启，v0.165.0 起托管 worktree 已固化为常驻开启能力，原有的 `features.worktrees` 功能开关随之退役（配置中残留时会被忽略）：

| 用法 | 效果 |
| --- | --- |
| `codex --worktree [PROMPT]` | 在新 worktree 里开始新会话 |
| `codex fork SESSION_ID --worktree` | 把指定会话分叉到新 worktree，必须写明会话 ID |
| `codex exec --worktree`、`codex exec fork SESSION_ID --worktree` | 非交互地在新 worktree 里运行或分叉 |
| `/worktree` | 带着当前对话进入新检出、在新检出里开新对话，或浏览已有的 worktree（恢复所属会话、复制工作目录；v0.155.0 起还能删除） |
| 代理总览中按 `w` | 从项目的默认分支新建 worktree，并在其中开一个空白会话（v0.156.0 起）；默认分支优先取远端的 `HEAD`，找不到时用 `main` 或 `master`，不会先 fetch |

`codex resume`、`codex exec resume`、`codex exec review` 等命令不支持 `--worktree`。在本地 Git 仓库里执行 `/new` 或 `/fork` 时，都会先问新对话放在当前检出还是新 worktree 里。按 v0.167.0 源码：

- 从当前仓库的 `HEAD` 以 detached HEAD 方式检出，未提交的改动和被 Git 忽略的文件不会带过去；
- 默认放在 `$CODEX_HOME/worktrees/` 下，与桌面应用共用同一个根目录（`config.toml` 的 `[desktop]` 表里设置 `git-worktree-root` 可以改成别的绝对路径）；CLI 不会自动清理，不用时在源仓库里执行 `git worktree remove`，或者在 `/worktree` 的浏览器里删除（v0.155.0 起，需确认，只能删当前仓库中不含本地改动、未跟踪文件或被忽略文件的托管 worktree，也不能删你正在用的那个；对话记录会保留）；
- v0.155.0 起，浏览器里会显示每个 worktree 所属对话的标题、更新时间，以及已归档、不可用等状态，只有能恢复的对话才提供恢复选项；v0.165.0 起，会话选择器支持按仓库筛选，代理总览也支持按目录分组并将 worktree 归在所属仓库下展示；
- 只支持本地会话，不能从明确标记为不受信任的项目创建，且要求主会话空闲；
- 连接的本机守护进程版本过旧、缺少所需的接口时，创建 worktree（以及 `/cd`）会被拦下，并提示运行 `codex app-server daemon update` 后重启 Codex。

### 桌面应用的 worktree

桌面应用的功能更完整：Handoff 在 Local 和 Worktree 之间搬移对话与代码；托管 worktree 默认保留近期 15 个，超出上限或归档对话时自动删除（删除前保存快照），永久 worktree 不会被自动删除；`.worktreeinclude` 列出要复制进新 worktree 的被忽略文件（如 `.env`）；项目 `.codex` 目录里的本地环境可以定义新建 worktree 时自动运行的 setup 脚本和常用 actions。

## 从其他 agent 导入

在本地 CLI 会话里输入 `/import`，选择 Claude Code 或 Cursor，勾选要导入的配置、项目文件和近期的对话（上限 50 个，限近 30 天）即可，原 agent 的配置不会被改动。指令文件导入为 `AGENTS.md`，`settings.json` 转成 `config.toml`，技能和斜杠命令变成 [Skills](/manual/agent/codex/skills)，此外还能导入插件、MCP 服务器配置、hooks 与[子代理](/manual/agent/codex/subagents)。Claude Code 的项目记忆要先开启仍在开发中的功能开关 `external_agent_memory_import`（默认关闭）才会出现在可导入的列表里；没开时，app server 也会拒绝导入记忆。

- `/import` 在任务运行中不可用。v0.157.0 之前，它在远程会话里、以及连接本地 app-server 守护进程时也不可用；v0.157.0 起这两种情况都能直接导入，由所连接的 app server 执行。
- 导入后检查技能与 agent 的工具限制、使用自定义认证的 MCP 服务器（可能要重新登录）和 hooks 的行为。
- 桌面应用在 Settings > Import 里导入，额外支持 Claude Cowork，还可以开启自动同步。
