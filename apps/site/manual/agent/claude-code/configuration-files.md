---
title: "配置文件"
description: "settings.json、CLAUDE.md、.mcp.json 等配置文件的位置、格式与优先级"
source: "https://daiw.org/manual/claude-code/configuration-files"
---

# 配置文件

> settings.json、CLAUDE.md、.mcp.json 等配置文件的位置、格式与优先级

Claude Code 的配置分散在几类文件里，各自管不同的东西：`settings.json` 管行为开关与权限，`CLAUDE.md` 管“给 Claude 的说明书”，`.mcp.json` 管项目级 MCP 服务器，`~/.claude.json` 管登录状态等杂项。理解它们各自的位置和优先级，能解决大部分“为什么我改了配置却没生效”的问题。

## 作用域总览

Claude Code 用统一的“作用域”体系决定一份配置对谁生效、要不要进代码仓库：

| 作用域 | 位置 | 影响范围 | 是否随仓库共享 |
| --- | --- | --- | --- |
| Managed（企业管控） | 服务端下发 / MDM（plist、注册表）/ 系统级 `managed-settings.json` | 组织全体成员或本机全部用户 | 是（IT 部署） |
| User（个人） | `~/.claude/` 目录 | 你自己，跨所有项目 | 否 |
| Project（项目） | 仓库内 `.claude/` 目录 | 该仓库的全部协作者 | 是（提交进 git） |
| Local（本机项目级） | `.claude/settings.local.json` | 你自己，仅当前仓库 | 否（Claude Code 自动创建时会加进 `.gitignore`) |

不同功能对应的具体文件路径：

| 功能 | User 位置 | Project 位置 | Local 位置 |
| --- | --- | --- | --- |
| settings.json | `~/.claude/settings.json` | `.claude/settings.json` | `.claude/settings.local.json` |
| CLAUDE.md | `~/.claude/CLAUDE.md` | `./CLAUDE.md` 或 `./.claude/CLAUDE.md` | `./CLAUDE.local.md` |
| Subagent | `~/.claude/agents/` | `.claude/agents/` | 无 |
| MCP 服务器 | `~/.claude.json` | `.mcp.json` | `~/.claude.json`（按项目区分） |
| 插件 | `~/.claude/settings.json` | `.claude/settings.json` | `.claude/settings.local.json` |

Windows 上 `~/.claude` 对应 `%USERPROFILE%\.claude`。

### 优先级与合并规则

同一个配置项在多处出现时，按下面顺序生效（从高到低）：

1. **Managed**（企业管控）—— 任何其它层级都无法覆盖，包括命令行参数
2. **命令行参数**（如 `--settings`）—— 仅本次会话临时覆盖
3. **Local**(`.claude/settings.local.json`)
4. **Project**(`.claude/settings.json`)
5. **User**(`~/.claude/settings.json`）—— 兜底

**标量值**（字符串/数字/布尔）是“高优先级覆盖低优先级”；**数组类配置**（如 `permissions.allow`）则是跨层级**拼接去重**，而不是覆盖——例如企业策略里 `allowWrite` 设了 `["/opt/company-tools"]`，你个人又加了 `["~/.kube"]`，最终两条路径都生效。`fallbackModel`（有序降级链）和 managed 层设置的 `availableModels` 是例外，由最高优先级那一份文件整体决定，不做合并。

想知道当前会话实际加载了哪些配置来源，运行 `/status`，查看 `Setting sources` 一行；配置文件本身有 JSON 格式错误或校验失败，`/doctor` 会列出具体文件与错误详情。

## settings.json

这是最核心的配置文件，支持权限规则、环境变量、hooks、状态栏、插件开关等几乎所有行为定制。

```json [.claude/settings.json]
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": ["Bash(npm run lint)", "Bash(npm run test *)"],
    "deny": ["Bash(curl *)", "Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)"]
  },
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1"
  },
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}
```

顶部的 `$schema` 指向官方 JSON Schema，在 VS Code / Cursor 等支持 JSON Schema 校验的编辑器里能获得自动补全和内联校验（schema 更新有滞后，新字段偶尔会被误报，不代表配置真的错了）。

### 何时生效

Claude Code 会监听配置文件变化并自动重新加载，`permissions`、`hooks`、`apiKeyHelper` 等大多数字段改完立刻在当前会话生效（`ConfigChange` hook 会为每次检测到的变化触发一次）。只有两个字段例外，改完要下次重启或用对应命令才生效：

- `model` —— 用 `/model` 临时切换
- `outputStyle` —— 属于系统提示词的一部分，只有 `/clear` 或重启会话时才会重建

### 常用字段精选

`settings.json` 支持的字段有几百个（权限、hooks、沙箱、插件、企业策略……），这里只列日常最常用的一批；完整列表见官方 [Settings](https://code.claude.com/docs/en/configuration) 文档。

| 字段 | 说明 |
| --- | --- |
| `permissions.allow` / `ask` / `deny` | 权限规则数组，按 `Tool` 或 `Tool(specifier)` 语法匹配，如 `"Bash(git diff *)"`、`"Read(./.env)"`。规则按 deny → ask → allow 顺序评估，第一个匹配的生效 |
| `permissions.defaultMode` | 默认权限模式（`default`/`acceptEdits`/`plan`/`auto`/`dontAsk`/`bypassPermissions`）；`auto` 与（⚠️ v2.1.257 起）`bypassPermissions` 在 project/local 里都会被忽略，只能在用户级或托管设置里设，防止仓库自我授权。⚠️ v2.1.283 起不设它时，终端与 VS Code 里的交互式会话在所有套餐与提供方上都以 `auto` 起步（此前只有 Pro、Max、Team 套餐如此），`-p` 与 Agent SDK 仍从 `default` 起步 |
| `permissions.additionalDirectories` | 等价于持久化的 `--add-dir` |
| `model` | 覆盖默认模型，如 `"claude-sonnet-5"` |
| `fallbackModel` | 主模型过载时按顺序尝试的降级模型链，最多 3 个 |
| `modelPicker` | 🆕 **v2.1.243+**：用一份有序、带标签的模型列表定制 `/model` 选择器（任何 ID 写法都行，含 Vertex/Bedrock ID），可追加到或替换内置列表 |
| `effortLevel` | 跨会话保留的推理强度（`low`/`medium`/`high`/`xhigh`)，`/effort` 会自动写回这里；⚠️ v2.1.251 起按模型分别保存。⚠️ v2.1.280 起用户级 settings 里旧式的顶层 `effortLevel`（按模型保存之前写下的）不再作用于 Opus 5.5 这类新发布的模型，它们从自己的默认强度起步（Opus 5.5 默认 `medium`）；项目、本机、托管设置与 `--settings` 里的顶层 `effortLevel` 仍对所有模型生效 |
| `maxEffortLevel` | 🆕 **v2.1.267+**：推理强度封顶（顶层或 `modelSettings` 下按模型），对所有提供方生效，用户仍可选更低档 |
| `env` | 应用到每个会话及其子进程的环境变量，等价于逐条设置[环境变量](/manual/agent/claude-code/environment-variables)。⚠️ v2.1.251 起项目级文件里的 `env` 不能设 `CLAUDE_CONFIG_DIR`、`CLAUDE_CODE_TMPDIR`、`TMPDIR` 等目录变量；v2.1.282 起也不能开启 OpenTelemetry 导出、设置导出端点或采集内容（如 `CLAUDE_CODE_ENABLE_TELEMETRY`、`OTEL_LOG_*`） |
| `hooks` | 生命周期事件（`PreToolUse`、`PostToolUse`、`Stop` 等）对应的自定义命令，详见[自定义与扩展](/manual/agent/claude-code/commands-customization) |
| `statusLine` | 自定义状态栏命令，见 `/statusline` |
| `outputStyle` | 系统提示词风格，如 `"Explanatory"` |
| `autoUpdatesChannel` | 更新渠道，见[安装与升级](/manual/agent/claude-code/installation) |
| `autoMemoryEnabled` / `autoMemoryDirectory` | 自动记忆开关与自定义存储目录 |
| `fileCheckpointingEnabled` | 是否为 `/rewind` 做文件快照（默认开启） |
| `cleanupPeriodDays` | 会话记录本地保留天数（默认 30；⚠️ v2.1.314 起 `~/.claude/skills/.trash` 与 `~/.claude/plugins/.trash` 无论此值设多少，都各自限制保留约 1024 个条目） |
| `idleCompaction` | 🆕 **v2.1.299+**：超过 200K token 的对话闲置约 54 分钟后，在 1 小时 prompt 缓存过期前自动压缩摘要（v2.1.314 起 VS Code、Claude Desktop Code 标签页及开启 1 小时缓存的云厂商/网关会话也支持）；设为 `false` 关闭，或用 `/config` 的 `Idle compaction` 切换 |
| `editorMode` | 输入框按键模式：`"normal"` 或 `"vim"` |
| `vimInsertModeRemaps` | 把 `jj` 这类两键序列映射成 Escape（v2.1.208+） |
| `emojiCompletionEnabled` | 表情 shortcode 自动补全（输入 `:heart:` 插入 ❤️）；设 `false` 关闭（v2.1.217+） |
| `allowShortlineEdits` | 🆕 **v2.1.213+**：允许 Edit 工具直接做单行或小段多行替换（搜索串不到 50 个字符且不含换行），省掉「先删再写」那一步 |
| `bashOutputMaxChars` / `taskOutputMaxChars` | 🆕 **v2.1.261+**：命令与后台任务输出内联给 Claude 的字符上限（最高 128K），超过才落盘。⚠️ v2.1.277 起 TaskOutput 工具被移除，`taskOutputMaxChars` 不再有任何作用 |
| `bashEditDiffEnabled` | 🆕 **v2.1.269+**：Bash 命令改了文件时，把改动的 diff 附在 Bash 工具结果里 |
| `permissions.blockReadsOutsideWorkingDirectories` | 🆕 **v2.1.257+**：禁止读取工作目录以外的文件；auto mode 首次读外部文件时也会询问是否开启 |
| `permissions.blockWritesOutsideWorkingDirectories` | 🆕 **v2.1.314+**：在所有权限模式下禁止 `Write`、`Edit` 与 `NotebookEdit` 写入工作目录以外的路径 |
| `promptCacheTtl` / `subagentPromptCacheTtl` | 🆕 **v2.1.243+**：API Key 与云厂商用户的 prompt 缓存 TTL，例如主对话 1 小时、subagent 保持 5 分钟 |
| `crossSessionInbound` / `dialogExpiry` | 🆕 **v2.1.224+**：其它会话发来的消息接受 / 暂存 / 拒绝，以及对话框的过期行为；`/config` 里对应「Messages from your other sessions」与「Dialog expiry」 |
| `timeFormat` / `timeZone` | 🆕 **v2.1.257+**：轮次结束时钟与 transcript 时间戳的格式（12/24 小时、UTC 或 strftime）与时区 |
| `maxProseWidth` | 🆕 **v2.1.282+**：宽终端里 Claude 正文的最大列宽（不小于 40 的整数，如 `80`），段落、标题、列表与引用在这个宽度内换行，表格与代码块仍用满终端宽度 |
| `spellcheck` | 🆕 **v2.1.235+**：用本机的 `aspell`/`hunspell`/`ispell` 在输入框里给拼错的词加下划线 |
| `feedbackDrafts` | v2.1.247+：是否允许 Claude 在会话出问题时用 `SendFeedback` 起草反馈报告（发送前由你在 `/feedback` 里审阅），设 `false` 关闭 |
| `disableBundledSkills` / `disableWorkflows` | 关闭随附技能/动态工作流 |
| `syncClaudeAiSkills` / `syncClaudeAiPlugins` | 🆕 **v2.1.275+**：用 claude.ai 账号登录的终端会话会同步该账号上启用的技能与插件，设 `false` 退出 |
| `workflowSizeGuideline` | 🆕 **v2.1.219+**：动态工作流规模建议值（默认「中等」＝目标少于 15 个 agent）。写进任意 settings 文件后，`/config` 里对应那一行会隐藏。⚠️ v2.1.271 起「中等」的指导值降到 10 个 agent，Pro 套餐默认改为「小」规模 |
| `sandbox.credentials` | 沙箱化命令能否读取凭证文件与密钥环境变量。v2.1.221 起新增 `mode: "mask"`（Linux / WSL）：沙箱内读到哨兵副本，出网时由代理换回真值；macOS 回退为 `deny` |
| `sandbox.filesystem.disabled` | 🆕 **v2.1.216+**：跳过文件系统隔离，但保留网络出口管控 |
| `sandbox.allowNestedUserNamespaces` | 🆕 **v2.1.305+**（Linux）：允许沙箱化命令创建用户命名空间（如 Chromium、rootless podman）；注意这会让它们绕过沙箱的文件保护 |
| `sandbox.network.strictAllowlist` | 🆕 **v2.1.219+**：沙箱命令访问非白名单主机时直接拒绝，不再弹窗询问 |
| `sandbox.excludedCommands` | 不进沙箱运行的命令（glob 匹配）。⚠️ v2.1.277 起复合 Bash 命令要**每一段**都匹配才会被豁免，此前只要其中一段匹配，整条命令就跑在沙箱外；⚠️ v2.1.282 起托管设置或 `--settings` 设了 `allowUnsandboxedCommands: false`，或托管设置设了 `allowManagedDomainsOnly: true` 时，项目级与本机设置里的条目会被忽略 |
| `enabledPlugins` | 插件启用状态，格式 `"插件名@marketplace名": true/false` |
| `extraKnownMarketplaces` | 注册额外的插件 marketplace 源；v2.1.232 起也可写成更直观的别名 `additionalMarketplaces` |
| `strictKnownMarketplaces` / `blockedMarketplaces` | 企业管控用的 marketplace 白/黑名单（前者 v2.1.232 起有别名 `allowedMarketplaces`）。v2.1.223 起支持 owner 通配 `"owner/*"`，可整组放行或封禁某个 GitHub 组织下的全部仓库；v2.1.277 修复了其中一条格式错误就让整个企业 marketplace 策略静默失效 |
| `attribution` | 自定义 git commit / PR 的署名文案（对象，含 `commit`、`pr`、`sessionUrl`）。🆕 v2.1.281 起可以直接写 `"attribution": false` 隐藏全部署名——但更早的版本读到它会跳过整份 settings 文件，跨版本共用的文件请继续用对象写法（`commit`、`pr` 设为空字符串，`sessionUrl` 设为 `false`） |
| `claudeMdExcludes` | 排除指定路径的 `CLAUDE.md`，常用于 monorepo 中跳过其它团队的说明文件 |
| `forceLoginMethod` / `forceLoginGatewayUrl` | 强制登录方式与网关地址；🆕 v2.1.295 起没有托管设置的机器也可以在个人用户设置里设 `forceLoginMethod: "gateway"` 与 `forceLoginGatewayUrl`，让 `/login` 直接打开该 Claude apps 网关 |

::: warning

`.claude/settings.json` 是项目共享文件，会被提交进仓库——不要在里面放 API Key、Token 等敏感信息。个人专属的临时配置放 `.claude/settings.local.json`（Claude Code 创建时会自动加进 `.gitignore`，自己手建则要记得手动加）。

:::

### 权限规则速查

`permissions.allow` / `ask` / `deny` 是最常用的一组字段，规则格式为 `Tool` 或 `Tool(specifier)`:

| 规则 | 效果 |
| --- | --- |
| `Bash` | 匹配全部 Bash 命令 |
| `Bash(npm run *)` | 匹配以 `npm run` 开头的命令 |
| `Read(./.env)` | 匹配读取 `.env` 文件 |
| `WebFetch(domain:example.com)` | 匹配对 example.com 的 fetch 请求 |
| `mcp__*` | 匹配全部 MCP 工具 |

⚠️ v2.1.282 起，中间带 `:*` 的 Bash 规则（此前只有 `--allowedTools` 认、写在 settings 文件里会被跳过）对所有来源都生效，启动时会告警说明它怎么匹配；`Skill(anthropic-skills:*)` 这类技能规则在 v2.1.282 / v2.1.283 的变化见 [Skills](/manual/agent/claude-code/skills)。⚠️ v2.1.299 起 MCP allow 规则只覆盖它点名的那个服务器（`mcp__a` 不再顺带放行 `a__b` 或 `a_`，请写完整规范化名称 `mcp__<server>__*`）。

::: warning

**v2.1.214 修正了单段 `dir/**` 的匹配范围，两处语义现在不同，别搞混：**

- **hook 的 `if:` 条件**里，`Edit(src/**)` 这种单段写法**只匹配 `<cwd>/src`**；想匹配任意深度的 `src/` 目录，要写成 `Edit(**/src/**)`。🆕 v2.1.314 起 `if:` 条件还支持用 `Monitor(tail *)` 匹配 Monitor 工具启动的 shell 命令（与 `Bash(tail *)` 一致）。
- **`permissions` 的 `deny` / `ask` 规则**不受影响，**保持任意深度匹配**。

这条改动修的是一个真实的越权：此前 `Edit(src/**)` 会把树里**任何位置**的 `src/` 都自动放行，包括你没打算授权的嵌套目录。如果你依赖过旧行为，检查一下 hook 条件是否需要改写。

:::

排除敏感文件是最常见的用法之一：

```json
{
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
      "Read(./config/credentials.json)"
    ]
  }
}
```

## CLAUDE.md：项目记忆

`CLAUDE.md` 是一份纯文本 markdown 文件，每次会话开始时都会被加载，用来存放“你不想每次重新口述一遍”的项目知识：构建/测试命令、代码规范、架构决策、目录约定。

### 存放位置与加载顺序

| 作用域 | 位置 | 用途 |
| --- | --- | --- |
| 企业策略 | 系统级目录（见下方管控配置） | 组织级强制指令，所有用户在所有仓库都会加载 |
| 用户 | `~/.claude/CLAUDE.md` | 你的个人偏好，对所有项目生效 |
| 项目 | `./CLAUDE.md` 或 `./.claude/CLAUDE.md` | 团队共享的项目说明，进版本控制 |
| 本机项目级 | `./CLAUDE.local.md` | 个人在这个项目里的私有偏好，建议加进 `.gitignore` |

Claude Code 从当前工作目录往上逐级查找 `CLAUDE.md`/`CLAUDE.local.md` 并全部拼接进上下文（离工作目录越近的排在越后面，即“越具体的指令越靠后被读到”）；子目录下的 `CLAUDE.md` 则是按需加载——只有 Claude 读取该子目录下的文件时才会带上（v2.1.293 修复了用单文件 `cat`/`head`/`tail`/`sed -n`/`grep` 查看时未触发加载；⚠️ v2.1.309 起超过大小上限的嵌套 `CLAUDE.md` 只加载开头部分，避免反复触发自动压缩）。

用 `/init` 可以自动生成初版 `CLAUDE.md`（已存在时则给出改进建议而非覆盖）；建议控制在 200 行以内，太长的文件会占用上下文并降低指令遵循度，长内容应该拆到 `.claude/rules/` 里按需加载，而不是塞进主文件。

### `@` 导入与 AGENTS.md 兼容

CLAUDE.md 里可以用 `@path/to/file` 语法导入其它文件，启动时一并展开进上下文（最多 4 层递归，反引号包裹的 `` `@path` `` 不会被当作导入）：

```text
参见 @README 了解项目概况，@package.json 查看可用的 npm 命令。

# 个人偏好
- @~/.claude/my-project-instructions.md
```

如果仓库已经在用 `AGENTS.md` 给其它编码工具用，不用重复维护两份，导入一下即可：

```markdown [CLAUDE.md]
@AGENTS.md

## Claude Code 专属说明

`src/billing/` 下的改动一律先进计划模式。
```

🆕 **v2.1.277+**：项目里**没有 `CLAUDE.md`** 时，Claude Code 会直接读取 `AGENTS.md` 作为项目说明，这项行为可以在 `/config` 的「Project instructions」里修改。⚠️ v2.1.281 起 Bedrock、Vertex、Foundry、LLM 网关与关闭遥测的会话也支持（此前这些会话只读 `CLAUDE.md`）。已有 `CLAUDE.md` 的项目照旧读 `CLAUDE.md`，想同时用上 `AGENTS.md` 仍按上面的方式导入。

### 用 `.claude/rules/` 拆分大型说明

大项目建议把 `CLAUDE.md` 拆成多个主题文件放进 `.claude/rules/`，每个文件一个主题，可选用 `paths` frontmatter 限定只在操作匹配文件时才加载，节省上下文：

```markdown [.claude/rules/api-design.md]
---
paths:
  - "src/api/**/*.ts"
---

# API 开发规则

- 所有接口必须包含入参校验
- 统一使用标准错误响应格式
```

不带 `paths` 的规则和 `.claude/CLAUDE.md` 一样，每次都会加载。`~/.claude/rules/` 则是个人级、跨项目生效的规则目录。

## 自动记忆（Auto Memory）

除了你手写的 `CLAUDE.md`，Claude 还会在工作过程中自己积累笔记——构建命令、调试心得、代码风格偏好等，不需要你手动维护。

- 存放位置：`~/.claude/projects/<project>/memory/`，以 `MEMORY.md` 为索引入口，配合若干主题文件
- 每次会话只加载 `MEMORY.md` 的前 200 行或 25KB（以先到者为准），主题文件按需读取
- 默认开启，可在 `settings.json` 里设 `"autoMemoryEnabled": false` 关闭，或在会话内用 `/memory` 切换
- 同一个 git 仓库的所有 worktree 共享同一份自动记忆，但**不跨机器同步**

自动记忆是纯 markdown，随时可以用 `/memory` 打开查看、编辑或删除。

## .mcp.json：项目级 MCP 服务器

项目要用到的 MCP 服务器配置写在仓库根目录的 `.mcp.json` 里，和团队共享：

```json [.mcp.json]
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

出于安全考虑，仓库自带的 `.mcp.json` 不会被自动信任启动——首次使用需要你在会话里手动批准。想提前在 `settings.json` 里声明批准/拒绝名单，用 `enabledMcpjsonServers`/`disabledMcpjsonServers`:

```json [.claude/settings.local.json]
{
  "enabledMcpjsonServers": ["github", "memory"]
}
```

个人级、只在你本机生效的 MCP 服务器配置（以及 OAuth 会话）则存放在 `~/.claude.json` 里，通常通过 `claude mcp add`/`/mcp` 管理，不建议手动编辑。

⚠️ v2.1.274 起，`.mcp.json`（以及 settings、插件与 agent 文件）里 `"type": "sdk"` 的 MCP 条目会被跳过并告警：进程内服务器只有 SDK 宿主应用才能注册。

## ~/.claude.json：其它状态

这个文件保存的是“不属于团队共享配置”的杂项状态：OAuth 登录会话、用户/本机作用域的 MCP 服务器配置、每个项目的信任状态与已批准工具缓存等。Claude Code 会自动为配置文件创建带时间戳的备份并保留最近 5 份，避免误操作导致数据丢失。日常不需要手动改这个文件，出问题时优先用 `claude doctor`/`/doctor` 诊断，而不是直接编辑。

## 企业级管控配置（简述）

面向组织统一下发的策略配置，不属于个人日常配置范围，这里只做提要：

- **服务端下发**：通过 claude.ai 管理后台或自托管的 Claude apps 网关，登录时远程下发
- **MDM / 系统策略**：macOS 用 `com.anthropic.claudecode` 配置描述文件，Windows 用 `HKLM\SOFTWARE\Policies\ClaudeCode` 注册表项
- **文件下发**：`managed-settings.json`（以及可选的 `managed-settings.d/` 目录做策略分片）放在系统级目录（macOS `/Library/Application Support/ClaudeCode/`、Linux `/etc/claude-code/`、Windows `C:\Program Files\ClaudeCode\`)

这一层配置**任何用户/项目/本机配置都无法覆盖**，常用于强制安全策略（禁用 `bypassPermissions`、限制可用模型、企业级 `CLAUDE.md` 等），具体格式和字段与个人 `settings.json` 完全一致。另有几个只在托管层有意义的键：`managedMcpServers`（v2.1.259+，给全员下发 HTTP/SSE 类 MCP 服务器）、`modelPricing`（v2.1.243+，让 `/cost` 与遥测按合同单价计算；v2.1.271 起其中的 `multiplier` 可以大于 1，最高 10，用于加价后的内部分摊费率）。

🆕 v2.1.283 起多了两个按版本管控模型的托管键：`availableModelsMatch` 设为 `"exact"` 时，`availableModels` 里的每个模型 ID 只放行它点名的那个版本（`"claude-opus-5"` 不再顺带放行 Opus 5.5），新版本在列入名单前一直被挡住；`deniedModels` 点名封禁某些模型，即使 `availableModels` 允许也不行。两者写在用户、项目、本机设置或 `--settings` 里都会被忽略并告警：

```json [managed-settings.json]
{
  "availableModels": ["opus", "sonnet"],
  "deniedModels": ["claude-opus-5-5"]
}
```

🆕 v2.1.282 起还有 `allowClaudeInChromeWithManagedMcp`：让 `claude --chrome` 能与独占 MCP 控制的 `managed-mcp.json` 同时使用。⚠️ v2.1.305 起 `allowedMcpServers` 不再过滤 `managed-mcp.json` 里仅在 `env` 中使用 `${VAR}` 的 stdio 服务器，需禁用请改用 `deniedMcpServers`；v2.1.318 起 `deniedMcpServers` 的 URL 条目也会拦截上游 URL 匹配的 Anthropic 官方服务器，以及云端与自托管运行环境里注入了自身 URL 的 connector。⚠️ v2.1.316 起 Team 与 Enterprise 登录从 Anthropic API 拉取的服务端托管设置无需审批直接生效，且未通过校验的本地缓存副本会被拒绝。

⚠️ v2.1.259 起托管设置文件、MDM plist 或注册表值**无法解析时 Claude Code 直接拒绝启动**并指出来源，不再静默地不执行策略。v2.1.271 起企业 `managed-mcp.json` 无法读取或解析时同样不会被忽略：它继续独占 MCP 控制（用户、项目与插件的服务器都不加载），并在启动时告警。

v2.1.282 起托管的 `permissions`、`autoMode`、`worktree`、`attribution`（v2.1.283 起还有 `sandbox`）里某个嵌套值不合法时，不再整块作废，其余部分照常生效；`disableClaudeAiConnectors` 这类布尔锁定键的值写错时，锁定照样生效，启动时点名这个键。⚠️ 同样从 v2.1.282 起，Windows 与 WSL 上的管理员策略（HKLM 或 `managed-settings.json`）存在但无效或读不了时，用户可写的 HKCU 与 WSL 的 `/etc/claude-code` 也不再生效。

## 排查配置问题

- `/status` —— 查看当前会话实际加载了哪些配置来源（`Setting sources`），配置文件有语法/校验错误时也会在这里列出受影响的文件
- `/doctor` —— 做一次安装与配置体检，给出每个问题的详细信息与来源，经你确认后直接修复
- `/memory` —— 确认 `CLAUDE.md`/`CLAUDE.local.md`/rules 是否被正确加载
- 指令没被遵守，优先检查：文件是否在会被加载的位置、指令是否够具体、多份 `CLAUDE.md` 之间是否有冲突

::: info

Claude 把配置分成两层：**settings 是硬性约束**（不管 Claude 怎么“决定”，客户端都会强制执行，比如 `permissions.deny`），**CLAUDE.md 是软性指导**（会影响 Claude 的行为倾向，但不保证严格遵守）。需要“无论如何都要拦住”的场景，用 settings/hooks；需要“教会 Claude 怎么做”的场景，用 CLAUDE.md。

:::
