---
title: "Plugins"
description: "Claude Code 中文手册 · 插件的组成、目录结构、Marketplace 安装分发、作者侧打包与团队 settings"
source: "https://daiw.org/manual/claude-code/plugins"
---

# Plugins

> Claude Code 中文手册 · 插件的组成、目录结构、Marketplace 安装分发、作者侧打包与团队 settings

**Plugins（插件）** 是 Claude Code 的**打包与分发层**：把 [Commands](/manual/agent/claude-code/custom-commands)、[Skills](/manual/agent/claude-code/skills)、[Agents](/manual/agent/claude-code/agents)，连同 hooks、MCP 服务器、LSP 服务器等，装进一个**自包含目录**，做成可版本化、可一键安装、可跨项目与团队共享的单元。前三篇讲「怎么写单个能力」，这一篇讲「怎么把它们打成一个包发出去、别人怎么装」。

::: info

单独放在 `.claude/` 下的技能/命令/agent 只在**当前项目**可用、名字是 `/hello`；打成插件后可通过 **Marketplace** 分发、带版本、跨项目复用，代价是技能名带命名空间前缀 `/插件名:hello`。先用 `.claude/` 快速试，成型了再打包成插件。

:::

## 独立配置 vs 插件

| 维度 | 独立配置（`.claude/`） | 插件（Plugin） |
| ---- | ---------------------- | -------------- |
| 技能名 | `/hello` | `/插件名:hello`（带命名空间，避免多插件重名冲突） |
| 作用域 | 单个项目或个人 | 可跨项目、跨团队分发 |
| 分发 | 手动复制 | `/plugin install`，走 Marketplace |
| 版本 | 无 | 有版本号或 git commit SHA |
| 适合 | 个人工作流、项目定制、快速试验 | 团队统一、社区发布、versioned 发布 |

## 插件能打包什么

一个插件目录里，除清单外的组件都放在**插件根目录**（不是 `.claude-plugin/` 里）：

| 目录 / 文件 | 组件 |
| ----------- | ---- |
| `.claude-plugin/plugin.json` | 插件清单（名字、描述、版本） |
| `skills/<name>/SKILL.md` | 技能（推荐新写法） |
| `commands/*.md` | 旧版扁平命令文件（兼容，新插件用 `skills/`） |
| `agents/` | 自定义 subagent 定义 |
| `hooks/hooks.json` | 生命周期 hooks |
| `.mcp.json` | MCP 服务器配置 |
| `.lsp.json` | LSP 语言服务器（代码智能） |
| `monitors/monitors.json` | 后台监视器（watch 日志/文件，有事件就通知 Claude） |
| `bin/` | 可执行文件，启用插件期间加入 Bash 工具的 `PATH` |
| `settings.json` | 启用插件时应用的默认设置（目前仅 `agent`、`subagentStatusLine` 两个键生效；v2.1.293 起 `subagentStatusLine` 负载新增 `agentType`） |

::: warning

**最常见的错误**：把 `commands/`、`agents/`、`skills/`、`hooks/` 放进了 `.claude-plugin/` 目录里。`.claude-plugin/` 里**只放 `plugin.json`**，其余全部放在插件根目录。插件根是插件自己的目录（你 `--plugin-dir` 指向的那个），**永远不是 `~/.claude/`**。

:::

## 安装与使用（用户侧）

`/plugin` 打开插件管理面板，四个 tab 用 `Tab` 循环切换：

- **Discover** —— 浏览已添加 Marketplace 里的插件
- **Installed** —— 查看/启用/禁用/卸载已装插件
- **Marketplaces** —— 增删、刷新 Marketplace
- **Errors** —— 插件加载错误

官方 Marketplace `claude-plugins-official` 开箱即用，直接装：

```text
/plugin install github@claude-plugins-official
```

常用命令（交互式 `/plugin ...` 与非交互式 `claude plugin ...` 一一对应，后者别名 `claude plugins`，适合脚本/CI）：

| 命令 | 作用 |
| ---- | ---- |
| `/plugin install <名>@<市场>` | 安装某插件 |
| `/plugin install <名> --marketplace <来源>` | 🆕 **v2.1.275+**：先提议添加该 marketplace，再安装插件（🆕 v2.1.292 起命令行 `claude plugin install <名> --marketplace <来源>` 也支持，按与 `marketplace add` 相同的策略校验自动添加市场再安装） |
| `claude plugin install` / `update` 加 `--accept-command <sha256>` | 🆕 **v2.1.271+**：精确接受上一次 `--json` 运行所显示的那条命令，代替 `-y` |
| `/plugin list [--enabled\|--disabled]` | 列出已装插件 |
| `/plugin enable` / `disable <名>@<市场>` | 启用/禁用（不卸载） |
| `/plugin uninstall <名>@<市场>` | 彻底卸载 |
| `/reload-plugins [--force]` | 不重启会话即应用插件变更；若会改动已加载的 MCP 工具集（使 prompt 缓存失效），需 `--force`。⚠️ v2.1.268 起用 `/plugin` 安装、启用、禁用的改动在关闭菜单时即生效，不再需要这一步 |

🆕 v2.1.275 起，claude.ai 账号上启用的插件会同步到用该账号登录的终端会话，设置 `syncClaudeAiPlugins: false` 可以关闭；v2.1.273 起用 Claude 账号登录时也会请求访问你 claude.ai 上的插件。

::: warning

⚠️ 插件会以**你的用户权限执行任意代码**（hooks、MCP 服务器、`bin/` 脚本都是）。**只安装你信任来源的插件、只添加你信任的 Marketplace**。Anthropic 不审核第三方插件里打包了什么。企业可用托管设置的 `strictKnownMarketplaces` 限制可添加的来源。

:::

## Marketplace（插件市场）

Marketplace 是一份**插件目录**，本质是一个含 `.claude-plugin/marketplace.json` 的 git 仓库（或本地路径、远程 URL）。用它分两步：先 `add` 注册目录，再 `install` 挑装。

```text
# 从 GitHub owner/repo 添加(可 @ref 固定分支/tag);别名 /plugin market
/plugin marketplace add anthropics/claude-code
# 从任意 git host(带 https:// 与 .git),或本地路径
/plugin marketplace add https://gitlab.com/company/plugins.git
/plugin marketplace add ./my-marketplace
# 刷新 / 移除(别名 rm)
/plugin marketplace update [名字]
/plugin marketplace remove <名字>
```

Anthropic 维护三个公共 Marketplace：

| Marketplace | 添加方式 | 内容 |
| ----------- | -------- | ---- |
| `claude-plugins-official` | 自动可用 | 官方精选：代码智能 LSP（`typescript-lsp`、`pyright-lsp`、`gopls-lsp`、`rust-analyzer-lsp` 等）、外部集成 MCP（`github`、`gitlab`、`linear`、`notion`、`figma`、`slack`、`sentry` 等）、`security-guidance`、`commit-commands`、`pr-review-toolkit`、`plugin-dev` |
| `claude-community` | `/plugin marketplace add anthropics/claude-plugins-community` | 通过审核的第三方插件，装为 `<名>@claude-community` |
| `claude-code-plugins`（示例） | `/plugin marketplace add anthropics/claude-code` | 官方演示插件，展示能做什么 |

> `claude-plugins-official`、`claude-community` 等名字为官方保留，第三方 Marketplace 不能占用。⚠️ v2.1.280 起名字模仿保留名的 Marketplace 在添加时就被拒绝，已经添加的也会停止加载。

## 写一个插件（作者侧）

最小插件 = 一个清单 + 一个技能。以下从零建一个 `my-first-plugin`：

```bash
mkdir -p my-first-plugin/.claude-plugin my-first-plugin/skills/hello
```

清单 `my-first-plugin/.claude-plugin/plugin.json`：

```json
{
  "name": "my-first-plugin",
  "description": "A greeting plugin to learn the basics",
  "version": "1.0.0",
  "author": { "name": "Your Name" }
}
```

技能 `my-first-plugin/skills/hello/SKILL.md`：

```markdown
---
description: Greet the user with a friendly message
disable-model-invocation: true
---

Greet the user warmly and ask how you can help them today.
```

本地加载测试（不必先发布），然后调用带命名空间的技能：

```bash
claude --plugin-dir ./my-first-plugin      # 可重复传多次;也接受 .zip(v2.1.128+)
# 会话内:
/my-first-plugin:hello
```

v2.1.265 起 `--plugin-dir` 还能指向**装着多个插件的父目录**：每个带清单的子目录各算一个插件，运行中增删子目录也会被发现，适合同时开发一组插件（v2.1.281 修复了这样的父目录里同时带 `.claude-plugin/marketplace.json` 时只加载出一个空插件）。v2.1.280 起也可以用环境变量 `CLAUDE_CODE_PLUGIN_DIRS` 列出要加载的目录：Unix 用 `:`、Windows 用 `;` 分隔，须为绝对路径或以 `~` 开头。

清单 `plugin.json` 字段：

| 字段 | 说明 |
| ---- | ---- |
| `name` | 唯一标识，也是技能命名空间前缀（`/name:skill`） |
| `description` | 插件管理器里展示的描述 |
| `version` | 可选。设了它，用户仅在你 bump 版本号时才收到更新；**省略且用 git 分发时，每个 commit 的 SHA 都算新版本** |
| `author` / `homepage` / `repository` / `license` | 可选，元数据 |

改动后 `/reload-plugins` 热重载，无需重启。想验证清单/YAML 是否合法，跑 `claude plugin validate .`（或会话内 `/plugin validate .`）——v2.1.221 起它还会在 marketplace 名或插件名可能被 Claude Desktop 的托管同步拒绝时给出告警。技能路径也从该版本起接受 `"."`（表示插件根目录）。v2.1.259 起 `validate` 支持 `--json`，输出机器可读的校验报告。🆕 v2.1.281 起它还检查插件声明的 MCP 服务器（加载时会被静默丢弃的条目、未声明的 `${user_config.*}` 引用、不安全的 URL），并在 shell 形式的 hook 没给 `${CLAUDE_PLUGIN_ROOT}` 加引号时告警（插件路径含空格就会出错）；v2.1.283 起 Claude Code 实际装不上的插件或 marketplace 名字，以及缺失或越出插件目录的 `outputStyles` / `themes` / `monitors` / `lspServers` 路径都会校验失败。

🆕 **v2.1.269 起还有 `claude plugin eval`**：对插件跑它自带的评测套件，给出可复现的打分结果（JSON + HTML 报告），适合发布前做回归，具体参数见 `claude plugin eval --help`（🆕 v2.1.299 起新增 `--disallow-tools` 及用例字段 `disallowed_tools` 排除指定内置工具）。⚠️ v2.1.283 起机器上装有 git 时，它要求 git 2.31 或更高版本，版本太旧会直接拒绝并说明版本号。

🆕 **v2.1.287 起 Claude Mods**：插件可以扩展 Claude Code 更深层的运行行为。Anthropic 同版还提供内置的 `cc-plugin-you-should-know` 审查插件；在支持它的第一方会话中，可用 `/plugin enable cc-plugin-you-should-know@builtin` 开启。v2.1.292 至 v2.1.318 持续扩充了 Mods 接口（如 `prompt.autocomplete` 与 `prompt.change` 事件、`$.model.complete` 的 prompt 缓存、`$.model.fork` 的 `effort` 选项、`$.ui.notify` 与 `$.ui.view({ agentId })`、托管 Mod 的 `$.prompt.media` / `$.session.identity()` / `settings.read` 层级改写，以及 `tool.check` 的 `decider: "person"` 强制人工审批等）。Mods 属于插件作者侧的扩展能力，普通插件的技能、agent、hook 与 MCP 配置方式不变。

> 🆕 **skills-dir 插件**：`claude plugin init my-tool` 会在 `~/.claude/skills/my-tool/` 脚手架一个带清单的插件，下次启动直接以 `my-tool@skills-dir` 加载，**无需 Marketplace 也无需 install**。适合个人自用又想要插件目录结构的场景。

发布时，再写一份 `.claude-plugin/marketplace.json` 目录、推到 GitHub，别人就能 `/plugin marketplace add 你的仓库` + `/plugin install`。marketplace.json 顶层是 `name` / `owner` / `plugins[]`，每个插件项至少给 `name` 与 `source`（相对路径、`github`、`url`、`git-subdir`、`npm`，或 v2.1.224 起的 `archive`——通过 HTTPS 下载 zip，无需 git 或 npm，可选 SHA-256 钉版）。完整 schema 见官方文档。

⚠️ v2.1.275 起 `npm` 来源的插件改用 `npm pack --ignore-scripts` 拉取并做完整性校验，包里的安装脚本不再运行；v2.1.274 起插件与 marketplace 克隆时 Git LFS 文件只留指针、不再下载，需要的话在检出目录里跑 `git lfs pull`。

Marketplace 本身除了 git 仓库、本地路径与 URL，v2.1.229 起还支持 `command` 来源：由一条本地命令（比如 IDE）打印插件目录，每个会话重新解析、免重启生效；v2.1.232 起裸 `gitlab.com` 仓库 URL（含嵌套子组）也能像 `github.com` 那样直接克隆。

## 团队分发与 settings

要让协作者 clone 仓库、信任目录后被**自动提示安装**，在项目 `.claude/settings.json` 里声明 Marketplace 与默认启用的插件：

```json
{
  "extraKnownMarketplaces": {
    "company-tools": {
      "source": { "source": "github", "repo": "your-org/claude-plugins" }
    }
  },
  "enabledPlugins": {
    "code-formatter@company-tools": true,
    "deployment-tools@company-tools": true
  }
}
```

安装作用域三选一：**user**（自己所有项目）、**project**（写进仓库 `.claude/settings.json`，全体协作者）、**local**（仅自己、仅本仓库）。企业管理员可用托管设置的 `strictKnownMarketplaces` 锁定/allowlist 允许添加的来源（`[]` 完全锁死），用户无法覆盖。Marketplace 与缓存状态存在 `~/.claude/plugins/`（`known_marketplaces.json`、`cache/`）。

## 版本与更新

Claude Code 按这个顺序解析插件版本：① `plugin.json` 的 `version` → ② Marketplace 条目里的 `version` → ③ 插件源的 git commit SHA。所以**要么每次发布 bump `version`，要么干脆省略 version、靠 commit SHA 自动区分**——两者都设且忘了改，老版本用户会一直停在缓存里。v2.1.274 起，插件或 marketplace 目录自身没有 git 仓库时，不再从外层的 git 仓库（比如用 git 管理的 `~/.claude`）取版本号。

官方 Marketplace 默认开启后台自动更新（启动后随机延迟至多 10 分钟拉取，不打断当前会话，更新后提示你 `/reload-plugins`）；第三方与本地开发 Marketplace 默认关闭。手动刷新用 `/plugin marketplace update`。v2.1.280 修复了后台自动更新不走 git 凭证 helper，导致私有仓库的 Marketplace 每次重新克隆或永远不更新。

记录已装插件的 `installed_plugins.json` 出问题时，v2.1.283 起的处理更稳妥：遇到本版本读不懂的记录不再改写文件（`claude plugin` 命令会点出那条记录并说明恢复办法）；整个文件读不了时，先把内容另存到旁边的文件再重建，`claude plugin list` 会指出这个文件。

## 常见误区

1. **组件放错层级** —— `commands/`、`skills/`、`agents/`、`hooks/` 必须在插件根，不能塞进 `.claude-plugin/`（只放 `plugin.json`）。
2. **改了插件却没生效** —— 跑 `/reload-plugins`；涉及 MCP 工具集变化时加 `--force`。`/reload-skills` 不会重载插件。注意 v2.1.221 起用 `/plugin` 安装的插件在安全的前提下会立即生效，**v2.1.268 起安装、启用、禁用都在关闭 `/plugin` 菜单时生效**——所以这条排查主要针对「手改了插件文件」的场景。
3. **推了新 commit 用户却没更新** —— `plugin.json` 里写死了 `version` 又没 bump；要么 bump，要么删掉 version 用 SHA。
4. **URL 直链 Marketplace 里用了相对路径 source** —— 只下载 `marketplace.json` 本身，相对路径插件文件取不到；改用 `github`/`npm`/git URL source，或把 Marketplace 托管成完整 git 仓库。
5. **引用了插件目录外的文件**（如 `../shared-utils`） —— 插件安装时会被复制进缓存，外部文件不会跟着走；用 `${CLAUDE_PLUGIN_ROOT}` 引用包内文件，跨插件共享用 symlink。

## 延伸阅读

- [Commands](/manual/agent/claude-code/custom-commands)、[Skills](/manual/agent/claude-code/skills)、[Agents](/manual/agent/claude-code/agents)——插件打包的三类主要组件
- [自定义与扩展 · 插件](/manual/agent/claude-code/commands-customization)——`/plugin`、`/reload-plugins` 命令速查
- [配置文件](/manual/agent/claude-code/configuration-files)——`settings.json` 里的 `extraKnownMarketplaces`、`enabledPlugins`
