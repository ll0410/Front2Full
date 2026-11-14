---
title: "插件"
description: "插件能打包的组件、codex plugin 与 marketplace 子命令、插件目录结构与清单文件，以及本地开发、测试与分发的流程。"
source: "https://daiw.org/manual/codex/plugins"
---

# 插件

> 插件能打包的组件、codex plugin 与 marketplace 子命令、插件目录结构与清单文件，以及本地开发、测试与分发的流程。

**插件（plugin）** 是 Codex 的打包与分发单元：把 [skills](/manual/agent/codex/skills)、[MCP 服务器](/manual/agent/codex/mcp)、应用连接器和 [hooks](/manual/agent/codex/hooks) 装进一个目录，通过 marketplace 安装、启用和更新。ChatGPT 与 Codex 共用同一个公共插件目录；Codex CLI 和 ChatGPT 桌面端支持插件，IDE 扩展不支持。概念上对应 Claude Code 的 [Plugins](https://daiw.org/manual/claude-code/plugins)。

还在打磨个人流程时先写成技能；需要分享、打包多个技能或连接外部服务时，再做成插件。

## 插件能打包什么

| 组件 | 默认位置 | 清单字段 |
| --- | --- | --- |
| Skills | `skills/` | `skills`（路径或路径数组） |
| MCP 服务器 | `.mcp.json` | `mcpServers`（路径，或内联的服务器对象） |
| 应用连接器 | `.app.json` | `apps` |
| Hooks | `hooks/hooks.json` | `hooks`（路径、路径数组、内联对象或对象数组） |
| 展示信息 | — | `interface` |

清单为某个组件写了路径，就只读清单指定的位置，不再读默认位置。路径必须以 `./` 开头、不能含 `..`、不能跑出插件根目录，否则该字段会被忽略并记录警告。

- 插件技能的名字带命名空间，形如 `插件名:技能名`。
- 不是 Agent Plugins 格式的插件如果带有 `commands/` 目录（也可以在清单里用 `commands` 字段指定路径），安装时会把其中写了 `description` frontmatter 的命令 Markdown 转换成技能，名字形如 `source-command-<命令名>`；用到 `$ARGUMENTS`、`$1` 这类参数占位符的命令不会转换。
- 插件 hook 运行时可以读取环境变量 `PLUGIN_ROOT`（插件安装目录）和 `PLUGIN_DATA`（插件可写的数据目录），为兼容已有插件还会设置 `CLAUDE_PLUGIN_ROOT` 与 `CLAUDE_PLUGIN_DATA`；命令字符串里的 `${PLUGIN_ROOT}` 这类写法会被替换成实际路径。
- 安装或启用插件不会自动信任它的 hooks，要在 `/hooks` 中审阅并信任后才会运行。
- 插件 MCP 服务器的启动方式由插件决定，用户只能在 `config.toml` 里控制开关和工具策略，见 [MCP 集成](/manual/agent/codex/mcp)。
- v0.167.0 起，还可以在 `config.toml` 的 `[plugins."<插件>@<市场>".apps.<连接器ID>]` 表中直接配置插件关联的应用连接器（App）设置，如 `enabled`、`default_tools_approval_mode`、`default_tools_enabled` 与单个工具的 `tools.<工具名>.approval_mode`。

## 目录结构与清单

```text
meeting-follow-up/
├── .codex-plugin/
│   └── plugin.json         # 清单
├── skills/
│   └── meeting-follow-up/
│       └── SKILL.md
├── hooks/
│   └── hooks.json          # 可选
├── .mcp.json               # 可选
└── assets/                 # 可选：图标、截图
```

Codex 按以下顺序查找清单：

1. 插件根目录的 `plugin.json`，且其 `$schema` 指向 `https://agent-plugins.org/schemas/...`（可移植的 Agent Plugins 格式），此时 `.codex-plugin/plugin.json` 可作为 Codex 专用的补充。这种格式的插件只提供技能与 MCP 服务器，其中的 hooks 与应用连接器不会加载
2. `.codex-plugin/plugin.json`（Codex 原生插件清单格式）
3. `.claude-plugin/plugin.json`
4. `.cursor-plugin/plugin.json`

```json
{
  "name": "meeting-follow-up",
  "version": "1.0.0",
  "description": "Turn meeting notes into decisions and next steps",
  "keywords": ["meetings", "notes"],
  "skills": "./skills/",
  "mcpServers": "./.mcp.json",
  "interface": {
    "displayName": "Meeting Follow-up",
    "shortDescription": "Decisions, owners and next steps",
    "category": "Productivity",
    "defaultPrompt": ["Summarize my latest meeting notes"],
    "composerIcon": "./assets/icon.png"
  }
}
```

| 字段 | 说明 |
| --- | --- |
| `name` | 插件标识，建议用 kebab-case；为空时取目录名，同时是插件技能的命名空间 |
| `version` | 版本号，安装缓存按版本分目录；本地开发时靠修改它触发重新安装 |
| `description`、`keywords` | 描述与检索标签 |
| `skills`、`mcpServers`、`apps`、`hooks` | 组件位置，规则见上文 |
| `extensions` | 各平台的扩展字段。v0.156.0 起 Codex 读取 `extensions["com.openai"].onboardingSkill`：指向插件里的一个技能（相对路径，`./` 可省略），作为插件的上手引导技能显示在插件详情中；路径必须在插件目录内，且对应一个已加载的技能 |
| `interface` | 展示信息：`displayName`、`shortDescription`、`longDescription`、`developerName`、`category`、`capabilities`、`websiteURL`、`privacyPolicyURL`、`termsOfServiceURL`、`defaultPrompt`（上限 3 条，每条不超过 128 字符）、`brandColor`、`composerIcon`、`logo`、`logoDark`、`screenshots` |

`author`、`homepage`、`repository`、`license` 等字段可以写进清单，但 Codex 运行时不解析它们。

## 安装与管理

在 TUI 中运行 `/plugins` 打开插件浏览器：按 marketplace 分标签浏览，打开插件查看详情、安装或卸载，在已安装的插件上按 `Space` 启用或停用。插件功能由 `features.plugins` 控制，默认开启。

会话中要点名使用某个插件，就在输入框输入 `@`，从菜单里选择已安装并启用的插件；Codex 会把这个插件的技能前缀、MCP 服务器和应用告诉模型。

命令行用 `codex plugin`，插件以 `插件名@marketplace名` 标识：

| 命令 | 作用 |
| --- | --- |
| `codex plugin add <插件>@<市场>` | 安装插件；也可写成 `codex plugin add <插件> -m <市场>` |
| `codex plugin list` | 按 marketplace 列出插件、状态与版本；`-m` 只看一个 marketplace |
| `codex plugin remove <插件>@<市场>` | 卸载插件并删除本地缓存 |
| `codex plugin marketplace add <来源>` | 添加 marketplace，来源可以是本地目录、`owner/repo[@ref]`、HTTPS 或 SSH 的 Git URL；`--ref` 固定 Git ref，`--sparse PATH` 可重复，用于稀疏检出 |
| `codex plugin marketplace list` | 列出当前生效的 marketplace 及其根目录 |
| `codex plugin marketplace upgrade [名字]` | 刷新 Git marketplace 的快照，省略名字则全部刷新 |
| `codex plugin marketplace remove <名字>` | 移除 marketplace |

这些命令都支持 `--json`；`codex plugin list --json` 默认只输出已安装的插件，加 `--available` 才会带上未安装的。

CLI 没有 enable 或 disable 子命令。停用插件用 `/plugins`，或直接写配置：

```toml
[plugins."meeting-follow-up@personal"]
enabled = false
```

- 安装的插件会复制到 `~/.codex/plugins/cache/<市场>/<插件>/<版本>/`，插件数据目录位于 `~/.codex/plugins/data/` 下；v0.164.0 起，已废弃的 marketplace 检出目录会被自动清理。
- `codex plugin marketplace add` 会在用户配置里写入 `[marketplaces.<名字>]`，包含 `source_type`（`git` 或 `local`）、`source`、`ref`、`sparse_paths`。
- 远程目录 `openai-curated-remote` 需要用 ChatGPT 账号登录，v0.153.0 起 CLI 可以从中列出、安装和移除插件。用 API key 登录也能使用受支持的 OpenAI 精选插件，但连接流程依赖 OAuth 能力、API key 不支持的插件不可用。
- 插件自带的技能在新会话中可用。v0.154.0 起，已打开的会话也能拿到新安装插件的工具；插件在外部升级或回滚后，会话中的 skills 与 hooks 会随之刷新。

::: warning

插件可以带 hooks 和 MCP 服务器，它们以你的用户权限运行代码。只安装可信来源的插件，添加 marketplace 前确认来源，并在 `/hooks` 中逐条审阅插件 hook 后再信任。

:::

## Marketplace 文件

marketplace 是一份插件清单，放在 marketplace 根目录的 `.agents/plugins/marketplace.json`，也识别 `.agents/plugins/api_marketplace.json`、`.claude-plugin/marketplace.json` 与 `.cursor-plugin/marketplace.json`（同一目录有多个时按这个顺序取首个）。OpenAI 官方精选目录在不经 ChatGPT 账号（例如用 API key）登录时，读取的就是其中的 `api_marketplace.json`。

- 个人 marketplace `~/.agents/plugins/marketplace.json` 总会被自动发现。
- TUI 的 `/plugins` 还会检查当前目录，找不到时再看所在 Git 仓库的根目录；`codex plugin` 命令行不会自动扫描它们。
- 除个人 marketplace 外，要用命令行安装，都得先 `codex plugin marketplace add`。

```json
{
  "name": "team-tools",
  "interface": { "displayName": "Team Tools" },
  "plugins": [
    {
      "name": "meeting-follow-up",
      "source": { "source": "local", "path": "./plugins/meeting-follow-up" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Productivity"
    }
  ]
}
```

| 字段 | 说明 |
| --- | --- |
| `name` | marketplace 名，即 `插件@市场` 的后半段 |
| `plugins[].source` | 插件来源：`./` 开头的相对路径字符串，或对象形式，`source` 为 `local`（配 `path`）、`url`（Git URL，可带 `path`、`ref`、`sha`）、`git-subdir`（`url` 与 `path`，也可带 `ref`、`sha`）、`npm`（`package`、`version`、`registry`） |
| `plugins[].policy.installation` | `AVAILABLE`（默认）、`INSTALLED_BY_DEFAULT` 或 `NOT_AVAILABLE` |
| `plugins[].policy.authentication` | `ON_INSTALL`（默认，安装时认证）或 `ON_USE`（初次使用时认证） |
| `plugins[].category` | 展示分类 |

本地路径相对于 marketplace 根目录，也就是包含 `.agents/` 的那一层。例如个人 marketplace 里的 `./plugins/x` 指向 `~/plugins/x`。

## 本地开发与测试

1. **生成脚手架**：创建 `.codex-plugin/plugin.json` 与 `skills/` 等目录，并登记到个人 marketplace（`~/.agents/plugins/marketplace.json`，默认名 `personal`；注意原内置的 `$plugin-creator` 技能已在 v0.159.0 移除）。精简的可移植格式只需根目录的 `plugin.json` 加一个技能：

   ```json
   {
     "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
     "name": "meeting-follow-up",
     "version": "1.0.0",
     "description": "Turn meeting notes into decisions and next steps"
   }
   ```

2. **安装**：在 marketplace 文件里登记后运行 `codex plugin add meeting-follow-up@personal`，然后新开会话，用有代表性的请求测试。
3. **迭代**：安装是把插件复制进缓存，改了源码不会自动生效。把 `version` 改成 `1.0.0+codex.local-20260915-101500` 这样带新后缀的版本，再运行一次 `codex plugin add`，然后新开会话测试。
4. **排查**：`codex plugin list` 能看出是哪个 marketplace 在提供这个插件、装的是哪个版本；hooks 不运行时，到 `/hooks` 看是否待信任。

团队内分发时，把 marketplace 与插件目录推到 Git 仓库，协作者运行 `codex plugin marketplace add owner/repo` 后即可安装，之后用 `codex plugin marketplace upgrade` 获取更新。要上架公共插件目录，按 [OpenAI 插件开发文档](https://developers.openai.com/plugins)中的提交流程提审。
