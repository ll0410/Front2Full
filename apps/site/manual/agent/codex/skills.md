---
title: "Skills 技能"
description: "SKILL.md 的格式与字段、Codex 从哪些目录加载技能、显式与隐式调用、内置技能与分享方式，以及如何从已弃用的自定义 prompts 迁移。"
source: "https://daiw.org/manual/codex/skills"
---

# Skills 技能

> SKILL.md 的格式与字段、Codex 从哪些目录加载技能、显式与隐式调用、内置技能与分享方式，以及如何从已弃用的自定义 prompts 迁移。

**Skill（技能）** 是一个包含 `SKILL.md` 的目录：把某类任务的操作说明、参考资料和可选脚本打包在一起，让 Codex 每次都按同一套流程做事。它基于开放的 [Agent Skills 标准](https://agentskills.io)，概念上对应 Claude Code 的 [Skills](https://daiw.org/manual/claude-code/skills)。长期有效的项目规则写进 [AGENTS.md](/manual/agent/codex/agents-md)，按需使用的具体流程写成技能。

Codex 采用渐进式加载：会话开始时只把每个技能的名字、描述和文件路径放进上下文，决定使用某个技能时才读取完整的 `SKILL.md`。

## 目录结构

```text
my-skill/
├── SKILL.md          # 必需：元数据 + 操作说明
├── scripts/          # 可选：可执行脚本
├── references/       # 可选：参考文档
├── assets/           # 可选：模板、图标等资源
└── agents/
    └── openai.yaml   # 可选：界面信息、调用策略与依赖
```

## SKILL.md 格式

文件以 YAML frontmatter 开头，下面是写给 Codex 的操作说明：

```markdown
---
name: release-notes
description: 根据 git 提交历史起草版本说明。用户提到 release notes、发布说明、changelog 时使用；不要用于修改代码。
metadata:
  short-description: 起草版本说明
---

1. 用 `git log --oneline <上一个 tag>..HEAD` 收集提交
2. 按新特性、修复、行为变更分组
3. 输出 Markdown，不写提交记录里没有的内容
```

| 字段 | 说明 |
| --- | --- |
| `name` | 技能名，长度上限为 64 个字符，显式调用时写成 `$name`。官方文档要求必填；源码在缺省时使用所在目录名 |
| `description` | 必填，缺失会导致该技能加载失败。写清楚何时使用、何时不用，它是隐式调用的主要依据 |
| `metadata.short-description` | 可选，界面里显示的简短说明 |

frontmatter 必须以 `---` 开头并闭合；其他字段（例如 Claude Code 技能里的 `allowed-tools`）会被忽略。

## agents/openai.yaml

这个可选文件提供界面信息、调用策略和工具依赖：

```yaml
interface:
  display_name: "Release Notes"
  short_description: "Draft release notes from git history"
  icon_small: "./assets/small-logo.svg"
  brand_color: "#3B82F6"
  default_prompt: "Use $release-notes to draft notes for this release."
policy:
  allow_implicit_invocation: false
dependencies:
  tools:
    - type: "mcp"
      value: "openaiDeveloperDocs"
      description: "OpenAI Docs MCP server"
      transport: "streamable_http"
      url: "https://developers.openai.com/mcp"
```

| 字段 | 说明 |
| --- | --- |
| `interface.display_name`、`short_description`、`default_prompt` | 在技能列表等界面中展示 |
| `interface.icon_small`、`icon_large` | 图标路径，必须位于技能目录的 `assets/` 下 |
| `interface.brand_color` | `#RRGGBB` 格式的颜色 |
| `policy.allow_implicit_invocation` | 默认 `true`；设为 `false` 后 Codex 不会自动选用，只能显式调用 |
| `dependencies.tools` | 声明技能依赖的工具，例如某个 MCP 服务器。显式调用技能时，如果依赖的 MCP 服务器还没配置，Codex 会询问是否把它写进全局配置并安装 |

## 存放位置

| 作用域 | 位置 | 用途 |
| --- | --- | --- |
| REPO | 从当前目录到项目根之间每一级的 `.agents/skills` | 随仓库提交的团队技能；放在子目录里的，只在从该子目录或更深处启动时加载 |
| USER | `~/.agents/skills` | 个人技能，在任何仓库都可用 |
| ADMIN | `/etc/codex/skills` | 机器或容器级的共享技能 |
| SYSTEM | 随 Codex 附带，写入 `~/.codex/skills/.system` | 内置技能，见下文 |
| 插件 | 已启用插件的 `skills/` | 名字带插件前缀，形如 `插件名:技能名` |

- 项目根按 `project_root_markers` 判断，默认是包含 `.git` 的目录。
- 源码还会读取两个位置：旧的用户目录 `~/.codex/skills`（即 `$CODEX_HOME/skills`，已弃用但仍兼容），以及项目配置层所在的 `.codex/skills`。
- 项目里的技能不受项目信任约束：即使项目没有被信任（包括被标为 `untrusted`），`.agents/skills` 与项目 `.codex/skills` 里的技能照样加载，只有项目配置、hooks 与 rules 会停用。打开来路不明的仓库时，先看看里面带了哪些技能。
- 支持符号链接的技能目录。同名技能不会合并，也不会互相覆盖，选择器里会同时出现。
- Codex 会自动检测技能文件的变化；更新没有出现时，重启 Codex。

## 调用方式

| 方式 | 做法 |
| --- | --- |
| 显式 | 在输入中写 `$技能名`（例如 `$skill-creator`），后面接具体要求；也可以运行 `/skills` 选择 List skills，或在输入框直接按 `$` 打开技能列表（输入 `@` 打开的菜单里也有技能） |
| 隐式 | 任务与某个技能的 `description` 匹配时，Codex 自动选用 |

初始的技能列表有预算上限：占模型上下文窗口的比例上限为 2%，窗口大小未知时为 8,000 个字符。技能很多时，Codex 先缩短描述，仍放不下就省略一部分技能并给出警告。这个上限只针对初始列表，选中的技能仍会读取完整的 `SKILL.md`，所以描述要把关键用途和触发词写在前面。预算可以用 `skills.max_context_tokens` 调整，显式设置的值上限为 10000 token；设 `skills.include_instructions = false` 则不再自动注入这份列表，显式的 `$技能名` 调用仍然有效。

v0.161.0 起，启用 OpenTelemetry 导出时还会上报技能调用事件（含技能名、来源作用域与触发方式）；v0.163.0 起，只读的技能检索与加载工具支持并行调用。

## 启用与停用

在 `/skills` 中选择 Enable/Disable Skills 可以逐个开关技能，也可以直接写配置：

```toml
# 按 SKILL.md 路径停用
[[skills.config]]
path = "/path/to/skill/SKILL.md"
enabled = false

# 按名字停用（源码支持，文档只写了 path）
[[skills.config]]
name = "imagegen"
enabled = false

# 关闭全部内置技能
[skills.bundled]
enabled = false
```

- 每条 `[[skills.config]]` 只能写 `path` 与 `name` 其中之一，后面的条目覆盖前面的。
- 这些条目只在用户级 `~/.codex/config.toml`（以及 `-c` 会话覆盖）中生效，写在项目配置里不起作用。
- 修改配置后需要重启 Codex。

## 内置技能

v0.167.0 随 Codex 附带以下系统技能（原 `$plugin-creator` 已在 v0.159.0 从内置技能中移除）：

| 技能 | 用途 |
| --- | --- |
| `$skill-creator` | 询问用途和触发条件后创建或更新技能，默认只写说明、不带脚本 |
| `$skill-installer` | 从 openai/skills 的精选列表或其他 GitHub 仓库安装技能 |
| `$openai-docs` | 查询 OpenAI 与 Codex 的官方文档 |
| `$imagegen` | 生成或编辑位图 |
| `$review-agent` | 只读的代码变更审查；关闭了隐式调用，主要供其他 agent 委派使用 |

## 分享技能

- **随仓库共享**：把技能目录提交到仓库的 `.agents/skills/`，协作者拉取后即可使用。
- **安装别人的技能**：例如运行 `$skill-installer linear` 安装精选的 Linear 技能，也可以让它从其他仓库下载。
- **正式分发**：要跨仓库分发、把多个技能打包，或与 MCP 服务器一起发布时，把它们做成[插件](/manual/agent/codex/plugins)。

## 从自定义 prompts 迁移

自定义 prompts 是旧机制：在 `~/.codex/prompts/` 下放 Markdown 文件，用 `/prompts:文件名` 手动触发，支持 `$1`～`$9`、`$ARGUMENTS` 等位置占位符和 `$FILE` 这类具名占位符。它只能显式调用，也不能随仓库共享，官方文档已将其标为弃用，推荐改用 skills。

::: warning

在 v0.167.0 的源码里没有读取 `~/.codex/prompts` 的逻辑，旧的 prompt 文件不会再出现在斜杠菜单中，请尽快迁移。

:::

| 自定义 prompt | Skill |
| --- | --- |
| `~/.codex/prompts/draftpr.md` | `~/.agents/skills/draftpr/SKILL.md`，或仓库里的 `.agents/skills/draftpr/SKILL.md` |
| frontmatter 的 `description` | 保留，并补充触发条件 |
| `argument-hint` | 没有对应字段，把需要的输入写进正文 |
| `$1`、`$ARGUMENTS`、`$FILE` 等占位符 | 不做文本替换；调用时把参数直接写在 `$draftpr` 后面 |
| `/prompts:draftpr` | `$draftpr` |
| 只能手动触发 | 想保持这一点，在 `agents/openai.yaml` 中设置 `allow_implicit_invocation: false` |

迁移后的示例：

```markdown
---
name: draftpr
description: 为当前改动创建分支、提交并开草稿 PR。用户要求开 PR、提交并推送时使用。
---

1. 新建名为 `dev/<功能名>` 的分支
2. 用户指定了文件时只暂存这些文件，否则暂存全部改动
3. 用清晰的提交信息提交
4. 在同一分支上开草稿 PR；用户给了标题就用，否则写一个简短的标题
```
