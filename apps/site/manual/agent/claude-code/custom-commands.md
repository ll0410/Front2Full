---
title: "Commands"
description: "Claude Code 中文手册 · 斜杠命令与 .claude/commands 自定义命令，及与 Skills 体系的迁移关系"
source: "https://daiw.org/manual/claude-code/custom-commands"
---

# Commands

> Claude Code 中文手册 · 斜杠命令与 .claude/commands 自定义命令，及与 Skills 体系的迁移关系

**Commands（自定义命令）** 是你用 Markdown 写的一段固定 prompt，在会话里以 `/命令名` 调用。v2.1 起，旧版 `.claude/commands/*.md` 已**并入 Skills 体系**——文件格式兼容、行为等价，新内容应写在 `.claude/skills/<name>/SKILL.md`。本篇说明两种写法的差异、存放位置与日常用法。

::: info

技能（Skills）的完整机制见 [Skills](/manual/agent/claude-code/skills)。本篇聚焦「命令」视角：如何命名、调用、传参，以及从旧目录迁移。

:::

## 两种形态，一套机制

| 形态 | 路径 | 状态 |
| ---- | ---- | ---- |
| 旧版自定义命令 | `.claude/commands/<name>.md` 或 `~/.claude/commands/<name>.md` | **仍兼容**，建议迁移到 skills |
| 技能（推荐） | `.claude/skills/<name>/SKILL.md` 或 `~/.claude/skills/<name>/SKILL.md` | 当前标准写法 |

两者都会出现在 `/` 补全菜单里；Claude 也可根据 `description` 自动判断是否调用（除非设置了 `disable-model-invocation`）。

## 最小自定义命令（旧版路径）

在项目根创建 `.claude/commands/commit.md`：

```markdown
---
description: 按 Conventional Commits 规范提交当前改动
---

1. 运行 `git status` 与 `git diff` 查看变更
2. 起草简洁的 commit message（英文，focus on why）
3. 执行 `git add` 与 `git commit`
4. 不要 push，除非用户明确要求
```

保存后执行 `/reload-skills`（或重启会话），即可在终端输入 `/commit` 调用。

## 推荐：写成 SKILL.md

同一逻辑迁移到 `.claude/skills/commit/SKILL.md`：

```yaml
---
name: commit
description: 按 Conventional Commits 规范提交当前改动
disable-model-invocation: true
allowed-tools: Bash(git status) Bash(git diff) Bash(git add *) Bash(git commit *)
---

1. 运行 `git status` 与 `git diff` 查看变更
2. 起草简洁的 commit message（英文，focus on why）
3. 执行 `git add` 与 `git commit`
4. 不要 push，除非用户明确要求
```

相比纯 `.md` 命令文件，SKILL 额外支持：

| 能力 | 作用 |
| ---- | ---- |
| `allowed-tools` | 声明工具白名单，减少反复点确认 |
| `disable-model-invocation` | 仅手动 `/commit` 触发，避免 Claude 误提交 |
| `arguments` / `$ARGUMENTS` | 支持 `/commit fix: login bug` 传参 |
| `context: fork` + `agent` | 在独立 [Agent](/manual/agent/claude-code/agents) 里执行 |

## 存放位置与作用域

| 位置 | 影响范围 | 是否进 git |
| ---- | -------- | ---------- |
| `~/.claude/commands/` 或 `~/.claude/skills/` | 你所有项目 | 否 |
| `.claude/commands/` 或 `.claude/skills/` | 当前仓库协作者 | 是（推荐团队共享） |
| 插件内置 | 安装插件的用户 | 由插件分发 |

项目级命令应提交进仓库，让团队共用同一套 `/review`、`/deploy` 等工作流。

## 传参

在 SKILL frontmatter 声明参数：

```yaml
---
name: explain
description: 用通俗语言解释指定文件或概念
argument-hint: [文件路径或概念名]
---

请用中文向初级开发者解释：$ARGUMENTS
```

调用：`/explain src/auth/token.ts`

旧版 `.claude/commands/*.md` 同样支持 `$ARGUMENTS` 与位置参数 `$0`、`$1`（⚠️ v2.1.301 起最多只填充前 64 个参数名，每个最长 64 个字符）。

## 堆叠调用

v2.1.199+ 支持在一次输入里串联多个技能，例如：

```text
/deploy-staging /run-tests 确认通过后部署
```

最多可一次性加载 **5** 个前置技能的上下文（详见 [Skills · 堆叠调用](/manual/agent/claude-code/skills)）。

## 相关斜杠命令

| 命令 | 作用 |
| ---- | ---- |
| `/skills` | 列出全部技能/命令，按名称过滤，按 `t` 按 token 排序，按 `Space` 切换可见性 |
| `/reload-skills` | 热重载磁盘上的技能与命令目录（v2.1.152+），无需重启会话 |
| `/disable-slash-commands` | 本次会话禁用全部 skills 与命令（排查问题时用） |

命令行等价：`claude --disable-slash-commands`。

## 与内置命令的区别

| 类型 | 例子 | 谁维护 |
| ---- | ---- | ------ |
| 内置斜杠命令 | `/clear`、`/model`、`/memory` | Anthropic 随 Claude Code 发布 |
| 随附技能（bundled skills） | `/batch`、`/code-review` | 内置，可用 `disableBundledSkills` 关闭 |
| 自定义命令 / 项目技能 | `/commit`、`/deploy` | 你或团队写在 `.claude/` |
| 插件技能 | `skill-creator:...` | 第三方插件 |

自定义命令**不会**覆盖内置命令名；重名时以命名空间或加载顺序为准，建议避免与内置 `/init`、`/help` 等冲突。

## 常见误区

1. **「改了文件却没出现在菜单里」**——执行 `/reload-skills`，或检查 frontmatter 是否缺少 `description`（影响自动调用，不影响手动 `/name`）。
2. **「命令能执行危险操作」**——对 `/deploy`、`/rm` 类命令务必加 `disable-model-invocation: true`，并用 `permissions.deny` 限制 Bash。
3. **「`.claude/commands` 和 `skills` 二选一」**——可共存，但同一逻辑只维护一份，优先 skills。
4. **「`--add-dir` 会自动加载额外目录的命令」**——只额外发现 `.claude/skills/`，不会加载其它目录下的完整 `.claude/` 配置（见 [会话管理命令](/manual/agent/claude-code/commands-session)；v2.1.309 起 `--add-dir` 目录里的技能若与已有技能重名，会以 `<folder>:<name>` 的形式提供）。
5. **「名字以 `anthropic-skills:` 开头的命令不见了」**——⚠️ v2.1.282 起这个命名空间保留给从 claude.ai 同步的技能，落在其中的命令文件、技能文件夹与工作流命令不再加载，换个名字即可（同版本对 `claude-ai` 的保留已在 v2.1.283 撤回）。另外 v2.1.292 起超过 256 个字符的 `name` 会被忽略，v2.1.299 起文件或文件夹名含隐藏/双向控制字符、空白类字符或 `<>` 的技能与命令不再提供，重命名后才会加载。

## 建议沉淀顺序

1. 把**每周重复口述**的多步骤流程写成项目技能（如 `/pr-checklist`）。
2. 有副作用的操作加 `disable-model-invocation` + `allowed-tools`。
3. 需要跨项目复用时，放到 `~/.claude/skills/`。
4. 需要团队统一分发时，打包成[插件](/manual/agent/claude-code/plugins)。

## 延伸阅读

- [Skills](/manual/agent/claude-code/skills)——frontmatter 全表、`context: fork`、插件技能命名空间
- [Agents](/manual/agent/claude-code/agents)——让技能在独立 subagent 中执行
- [Plugins](/manual/agent/claude-code/plugins)——把命令/技能打包成可分发插件
- [自定义与扩展](/manual/agent/claude-code/commands-customization)——MCP、Hooks、插件一览
