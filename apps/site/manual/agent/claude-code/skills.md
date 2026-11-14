---
title: "Skills"
description: "Claude Code 中文手册 · SKILL.md 格式、自动调用、工具白名单、fork 执行与团队分发"
source: "https://daiw.org/manual/claude-code/skills"
---

# Skills

> Claude Code 中文手册 · SKILL.md 格式、自动调用、工具白名单、fork 执行与团队分发

**Skills（技能）** 是 Claude Code 里复用 prompt 的一等公民：把反复使用的检查清单、评审流程、部署步骤写成 `SKILL.md`，Claude 可在合适时机**自动调用**，你也可以用 `/skill-name` **手动触发**。旧版的 `.claude/commands/*.md` 自定义命令已并入同一体系（见 [Commands](/manual/agent/claude-code/custom-commands)）。

## 核心概念

```
你写 SKILL.md
    ↓
Claude Code 扫描 ~/.claude/skills/ 与 .claude/skills/
    ↓
出现在 / 菜单 + 可被 Claude 根据 description 自动选用
    ↓
激活时把正文注入上下文（可带 allowed-tools 白名单）
```

技能不是独立进程；除非设置 `context: fork`，否则与主会话共享同一上下文窗口。

## 文件结构

```
.claude/skills/
└── deploy/
    └── SKILL.md
```

或单文件技能（较少用）：

```
.claude/skills/quick-lint/SKILL.md
```

个人全局技能：`~/.claude/skills/<name>/SKILL.md`。

## SKILL.md 完整示例

```yaml
---
name: deploy
description: 将应用部署到 staging 或 production；用户提到发布、上线、deploy 时使用
disable-model-invocation: true
allowed-tools: Bash(git status) Bash(git diff) Bash(npm run build) Bash(npm run test *)
argument-hint: [staging|production]
---

将 $ARGUMENTS 环境部署到目标：

1. 确认当前分支干净，`git status` 无未提交改动
2. 运行 `npm run test` 与 `npm run build`
3. 按项目 README 中的部署脚本执行（先读 README 再动手）
4. 部署后做最小冒烟验证并汇报 URL
```

## Frontmatter 字段速查

| 字段 | 作用 |
| ---- | ---- |
| `name` | 技能 ID，对应 `/name` 调用名（v2.1.292 起超过 256 个字符的 `name` 会被忽略；v2.1.299 起文件或目录名含隐藏/双向控制字符、空白类字符或 `<>` 的不加载） |
| `description` | **强烈建议填写**——Claude 判断是否自动使用该技能的主要依据 |
| `disable-model-invocation: true` | 仅用户手动 `/name` 可触发（适合 deploy、commit 等有副作用流程） |
| `user-invocable: false` | 不出现在 `/` 菜单，仅 Claude 可自动触发（背景知识类） |
| `allowed-tools` | 技能激活期间免确认可用的工具列表 |
| `context: fork` | 在独立 subagent 中执行技能正文（见 [Agents](/manual/agent/claude-code/agents)） |
| `agent` | 与 `context: fork` 联用，指定 subagent 类型 |
| `model` / `effort` | 为该技能指定模型与推理强度（v2.1.259 修复了交互式会话里 `model:` 被忽略，v2.1.267 修复了 `effort:` 在默认强度被钉住的模型上被忽略） |
| `background: false` | 🆕 **v2.1.218+**：`context: fork` 的技能默认改为**后台运行**，写这一行可让某个技能退回同步等待 |
| `argument-hint` | `/` 补全时提示参数格式 |
| `arguments` | 声明结构化参数（与 `$0`、`$1`、`$ARGUMENTS` 配合；⚠️ v2.1.301 起最多填充前 64 个参数名，每个最长 64 个字符） |

::: info

**v2.1.218 起，frontmatter 里的布尔值不止接受 `true`/`false`**：`yes`/`no`/`on`/`off`/`1`/`0` 都认，且不区分大小写。技能与插件的 frontmatter 同样适用。

:::

⚠️ v2.1.271 起在 auto mode 下，技能或斜杠命令正文里内联的 `!` shell 命令改按默认模式的权限规则处理、不再交给分类器；没有规则裁决的命令作为一次受审查的工具调用运行。⚠️ v2.1.299 起 `UserPromptSubmit` hook 改在技能或自定义命令展开前运行（阻断提示词即可一并阻止内嵌的 `!` 命令），且技能自身 frontmatter 里的 `UserPromptSubmit` hook 从调用该技能之后的下一条提示词才开始运行。v2.1.304 起单一来源的技能每会话最多注册 1,024 个 hook 与 16,384 字符 matcher；在仅允许插件 hook 的策略下，hook 被挡在门外的技能也不再获得自身的 `allowed-tools`。

## 存放位置与优先级

| 位置 | 作用域 | 典型用途 |
| ---- | ------ | -------- |
| `~/.claude/skills/` | 个人，跨项目 | 你的 commit 模板、个人评审习惯 |
| `.claude/skills/` | 项目，可提交 git | 团队统一的 `/verify`、`/run` |
| 插件携带 | 安装插件的用户 | `插件名:技能名` 命名空间 |

插件技能示例：`/plugin install skill-creator@claude-plugins-official`。

从 claude.ai 同步来的技能不会遮蔽本地命令或 MCP prompt，在你本机也不会执行其中的 `!` 命令或展开 `@` 文件（v2.1.228+）；v2.1.269 起它们在云端会话里统一命名为 `anthropic-skills:<name>`（与 Claude Desktop 一致，没有重名时裸名仍可用）；v2.1.281 起 `/` 菜单、`/skills`、`/context` 与 `/plugin` 的 Installed 列表在没有冲突时也直接用短名显示它们。

🆕 v2.1.275 起，claude.ai 账号上启用的技能会同步到用该账号登录的终端会话，设置 `syncClaudeAiSkills: false` 可以关闭；在同步技能的文件夹里用 Write / Edit 改文件不会存回你的账号，工具结果会提示这一点以及怎么保存。登出后超过 `cleanupPeriodDays` 未刷新的同步副本（v2.1.271 起），以及组织关闭 Skills 之后的同步技能（v2.1.273 起），都会被移进可恢复的回收站（v2.1.280 修复了 `~/.claude/skills/` 里有 `manifest.json` 列出技能名时，这些本地技能也被误挪进 `~/.claude/skills/.trash/`）。

⚠️ **v2.1.282 起 `anthropic-skills` 命名空间保留给从 claude.ai 同步的技能**：落在这个命名空间下的技能文件夹、命令文件与工作流命令不再加载，以 `anthropic-skills` 命名的 MCP 服务器也不再列出技能与 prompt（工具照常可用）；`Skill(anthropic-skills:*)` 的 allow 规则只覆盖同步来的技能，不再覆盖只是用了这类名字的插件或其它技能。v2.1.283 起 `Skill(anthropic-skills:<name>)` 的 deny 规则在 Claude Desktop 以插件形式下发该技能时同样生效，`Skill(skill:<name>)` 的 deny 规则也会匹配技能的别名与显示名。v2.1.282 对 `claude-ai` 名字的同样保留已在 v2.1.283 撤回。

## 管理与调试

| 命令 / 操作 | 作用 |
| ----------- | ---- |
| `/skills` | 交互列表：过滤、按 token 排序、切换对 Claude/菜单的可见性（v2.1.281 起每行以技能名开头，✔ / ◯ 表示开关；v2.1.280 起关掉的技能显示暗色 ◯，不再与加载失败的插件共用红色 ✘） |
| `/reload-skills` | 热重载磁盘变更（v2.1.152+；v2.1.299 / v2.1.304 起自动压缩完成后会自动把技能列表重发给 Claude，而平时运行 `/reload-skills` 只补发新增或修改过的技能） |
| `/skill-doctor` | 🆕 **v2.1.261+**：列出哪些已加载的技能从来没用上、各自占了多少上下文，方便清理 |
| `/usage` | 按技能、subagent、插件细分用量（套餐用户） |
| `SLASH_COMMAND_TOOL_CHAR_BUDGET` | 技能很多时调大，避免 description 被裁剪（见[环境变量](/manual/agent/claude-code/environment-variables)） |

排查「技能不出现」：

1. 路径是否为 `.claude/skills/<dir>/SKILL.md`
2. YAML frontmatter 是否合法
3. 执行 `/reload-skills`
4. 是否被 `--bare`、`--safe-mode` 或 `disableBundledSkills` 禁用
5. 名字是否落在保留的 `anthropic-skills:` 命名空间里（v2.1.282 起不再加载）
6. 技能是否来自加载失败的插件：v2.1.283 起 Claude 会如实说是插件没能加载，而不是说技能没装，到 `/plugin` 的 Errors 标签页看原因

## 自动调用 vs 手动调用

| 模式 | 配置 | 适用 |
| ---- | ---- | ---- |
| 双向 | 默认（有 `description`） | 评审清单、测试流程——Claude 见机行事，你也可 `/name` |
| 仅手动 | `disable-model-invocation: true` | 部署、删库、发 PR——避免误触发 |
| 仅自动 | `user-invocable: false` | 编码规范、领域术语表——当背景知识注入 |

## 堆叠调用

v2.1.199+ 支持一条输入串联多个技能，最多 **5** 个前置技能上下文一并加载：

```text
/code-review --fix /simplify 对 src/api/ 做一轮清理
```

适合「先评审再简化」等固定组合；注意 token 消耗会叠加。

## 在独立 Agent 中执行（context: fork）

需要隔离上下文、避免污染主会话时：

```yaml
---
name: deep-research
description: 对指定模块做深度代码调研并只返回摘要
context: fork
agent: Explore
---

调研范围：$ARGUMENTS

要求：只返回结构化摘要（文件列表、调用链、风险点），不要把全文贴进主会话。
```

`agent: Explore` 使用内置的 Haiku 探索型 subagent，省主上下文 token。自定义 agent 见 [Agents](/manual/agent/claude-code/agents)。

⚠️ **v2.1.218 起这类技能默认在后台跑**：触发后主会话立刻能继续做别的事，结果稍后回来。要同步等结果就加 `background: false`。

## 内置技能（Bundled Skills）精选

随 Claude Code 附带、无需自建文件即可 `/` 调用，例如：

| 技能 | 用途 |
| ---- | ---- |
| `/batch` | 大任务拆成多 worktree 并行 subagent |
| `/code-review` | 多维度代码评审，可 `--fix`；v2.1.218 起在后台 subagent 里跑（v2.1.232 起所有强度档都如此） |
| `workflow-authoring` | v2.1.248+：Workflow 脚本的写作参考，从 Workflow 工具描述里拆出来按需加载（工具描述因此从约 5.7k token 降到约 1k） |
| `/run`、`/verify` | 实际跑应用验证改动（v2.1.145+） |
| `/run-skill-generator` | 从启动过程生成项目专属 `/run` 技能 |
| `/fewer-permission-prompts` | 扫描历史会话生成 Bash 白名单 |

可用 `disableBundledSkills` 或环境变量 `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS` 关闭（不影响自定义技能）。

## 与 CLAUDE.md、插件的关系

1. **CLAUDE.md**——常驻项目记忆；技能是**按需加载**的流程模板。先写好 CLAUDE.md（`/init`），再把重复流程沉淀为技能。
2. **插件**——可打包多个技能 + agents + hooks + MCP，适合团队分发。见 [Plugins](/manual/agent/claude-code/plugins)。
3. **Hooks**——确定性脚本拦截（如 PreToolUse）；技能靠模型遵守指令。副作用强制的步骤用 hooks 兜底。

## 常见误区

1. **不写 `description`**——技能只能手动 `/name`，Claude 几乎不会自动选用。
2. **把所有 CLAUDE.md 内容塞进一个巨大技能**——应拆分：常识放 CLAUDE.md，流程放技能。
3. **忘记 `allowed-tools`**——技能里反复 `Bash` 会点到手软；把只读命令写进白名单。
4. **以为 `/reload-skills` 会重载插件**——插件变更用 `/reload-plugins [--force]`。

## 延伸阅读

- [Commands](/manual/agent/claude-code/custom-commands)——`.claude/commands` 兼容写法与迁移
- [Agents](/manual/agent/claude-code/agents)——subagent 文件格式与后台并行
- [Plugins](/manual/agent/claude-code/plugins)——把技能打包成可分发插件
- [配置文件](/manual/agent/claude-code/configuration-files)——`settings.json` 中的 `disableBundledSkills`
