---
title: "子代理"
description: "Codex CLI 的子代理（subagent）用法，涵盖触发与切换、并发与汇总、自定义 agent 文件与 agents 配置，以及 codex agents 代理总览。"
source: "https://daiw.org/manual/codex/subagents"
---

# 子代理

> Codex CLI 的子代理（subagent）用法，涵盖触发与切换、并发与汇总、自定义 agent 文件与 agents 配置，以及 codex agents 代理总览。

子代理（subagent）是 Codex 为子任务派生出来的独立 agent：它在自己的线程里完成模型调用和工具调用，主代理等它们结束后把结果汇总成一次回复。中间输出留在子线程里，主线程只保留需求、决策和结论。

当前版本默认启用子代理，CLI、桌面端和 IDE 扩展都能看到子代理的活动。每个子代理都要单独调用模型和工具，所以同样的任务，用子代理比单代理消耗更多 token。

## 什么时候用

| 适合 | 需要谨慎 |
| --- | --- |
| 代码库探索、只读扫描、问题分诊 | 多个 agent 同时改代码（容易冲突，协调成本高） |
| 从多个角度评审同一个分支 | 步骤之间强依赖、拆不开的任务 |
| 跑测试、分析日志、总结长文档 | 对 token 成本敏感的场景 |

确实要多个 agent 并行写代码时，给每个 agent 明确划分负责的文件或模块。

## 在 CLI 里使用

### 触发

默认情况下，本地 Codex 不会自作主张地派生子代理，只在两种情况下委派：

- 你直接提出，例如“派两个子代理”“把这些工作并行委派出去”“每一点派一个 agent”；
- 适用的 `AGENTS.md` 或技能指令要求委派。

例外是使用 V2 多代理实现（见下文）且推理强度为 `ultra` 时：Codex 会收到“可以主动委派”的提示，在并行能节省时间或提高质量时自行派生子代理；你在对话里的明确要求仍然优先。

好的委派提示要说清三件事：怎么拆分、是否等所有子代理完成再继续、每个子代理返回什么。

```text
用并行子代理评审这个分支：一个查安全风险，一个查测试缺口，一个看可维护性。
三个都完成后，按类别汇总问题，并附上文件引用。
```

### 编排与汇总

派生、转发后续指令、等待结果、关闭线程都由 Codex 负责。同时运行多个子代理时，Codex 会等所有请求的结果到齐，再给出一份汇总回复。运行过程中，你可以直接让 Codex 引导（steer）某个子代理、停掉它，或者关闭已完成的线程。

### 查看与切换

| 命令 | 作用 |
| --- | --- |
| `/subagents` | 在本会话的子代理线程之间切换，查看某个线程的进展 |
| `/agents` | 打开代理总览，浏览、筛选共享后台服务上的所有 agent 会话（见下文） |

::: info

官方文档把切换线程的命令写作 `/agent`；v0.167.0 CLI 里注册的是 `/subagents`（本会话的子代理）和 `/agents`（代理总览），没有单独的 `/agent`。

:::

### 审批与沙箱

- 交互模式下，非当前线程的审批请求也会弹出，覆盖层会标出来源线程；按 `o` 可以先打开那个线程，再批准、拒绝或回答。
- 非交互运行（例如 `codex exec`），或者当前无法弹出新审批时，需要新审批的操作会直接失败，错误交回给父工作流。
- v0.156.0 起，子代理也可以发起 MCP elicitation（如浏览器登录、表单输入），按当前的审批策略与自动审查规则交给你处理；请求安装插件则只允许主线程发起。
- 子代理的沙箱、审批策略、审批审查方式与工作目录都跟随父轮次当前的设置，包括父轮次在运行时改过的部分（例如用 `/permissions` 调整的权限、`--yolo`）。自定义 agent 文件改不了这些设置，写了 `sandbox_mode`、`approval_policy` 也不生效（见下文“文件位置与字段”）。

## 并发与嵌套

| 项 | 配置键 | 默认值 |
| --- | --- | --- |
| 同时打开的子代理线程（不含主线程） | `agents.max_concurrent_threads_per_session` | 由多代理实现决定，见下 |
| 嵌套深度 | `agents.max_depth` | `1`，即子代理不能再派生下一层；只对 V1 实现生效 |

Codex 有两套多代理实现，用哪一套由模型元数据决定：v0.167.0 的模型目录中，默认模型 `gpt-6.1-sol` 与 `gpt-6.1-terra`、`gpt-6-astra`、`gpt-6-sol` 等默认标记为 V2（`multi_agent_version = "v2"`，默认子代理推理强度为 `xhigh`）；模型的具体 V1/V2 标记与服务端目录可能变化，可以在 CLI 的 `/model` 与 `codex debug models` 中核对。`features.multi_agent_v2 = true` 可以固定使用 V2（v0.161.0 起 Amazon Bedrock 提供方也支持 `multi_agent_v2` 的路径寻址多代理工作流）。不设上限时，源码默认值是 V2 上限为 3 个子代理（连同主线程共 4 个线程），V1 上限为 6 个。V2 的上限也可以写在 `[features.multi_agent_v2]` 表里的 `max_concurrent_threads_per_session`（写成表时用 `enabled = true` 固定使用 V2），这个数连同主线程一起算，并且优先于 `agents.max_concurrent_threads_per_session`。

v0.158.0 起，`[features.multi_agent_v2]` 新增 `disable_direct_message`（默认 `false`）：设为 `true` 后，V2 不再提供 agent 之间直接发消息的工具（`send_message`、`followup_task`），派生子代理、子代理结果的自动回传和其他管理工具不受影响。它要求当前会话里有可用的 agent 留言板（仍在开发中的 `features.agent_message_board`），否则这一轮会直接报错，所以目前只在试用留言板时才用得上。

## 模型与推理强度

不做任何配置时，子代理沿用父代理的模型和推理强度。需要区分时，按以下规则解析：

1. 自定义 agent 文件里写了 `model` 或 `model_reasoning_effort`，以文件为准；
2. 否则依次取：派生请求里显式指定的值 → `[agents]` 里的默认值 → 父代理的值；
3. 只选了模型、没给推理强度时，使用该模型的默认强度；自定义 agent 文件只写 `model` 时，沿用前面解析出的强度，新模型不支持这个强度的话，就在文件里一并写上 `model_reasoning_effort`。

探索类任务可以用更快、更便宜的模型，评审、安全审查可以用更高的推理强度，详见[模型与推理](/manual/agent/codex/models)。

## 自定义 agent

### 内置 agent

| 名称 | 用途 |
| --- | --- |
| `default` | 通用的兜底 agent |
| `worker` | 执行型：实现功能的一部分、修测试或 bug、拆分大型重构 |
| `explorer` | 读为主的代码库探索，回答具体、范围明确的问题 |

这三个内置角色只有说明文字，不改模型、权限或其他设置。只有在你定义了至少一个自定义 agent 时，派生子代理的工具才会带上 `agent_type` 参数，模型这时才能按名字选用角色（内置角色也会一并列出）；没有自定义 agent 时，子代理一律按 `default` 派生。自定义 agent 与内置 agent 同名（例如也叫 `explorer`）时，以自定义的为准。

### 文件位置与字段

每个 TOML 文件定义一个 agent，个人的放在 `~/.codex/agents/`，项目级的放在 `.codex/agents/`（可以提交到仓库）。Codex 递归查找这些目录下的 `*.toml` 文件。agent 文件的写法与 `config.toml` 相同，但派生时只有下表列出的设置会生效：它只能定制子代理的指令、模型与输出风格，或者收窄它的能力，不能扩大父会话的权限。

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | 派生或引用时使用的名字；以此字段为准，文件名与它一致更省事 |
| `description` | 是 | 告诉 Codex 什么时候该用这个 agent |
| `developer_instructions` | 是 | 定义行为的核心指令 |
| `nickname_candidates` | 否 | 派生出的 agent 可用的昵称；只能含 ASCII 字母、数字、空格、`-` 和 `_`，不能重复 |
| `model`、`model_reasoning_effort`、`model_reasoning_summary`、`model_verbosity`、`personality`、`service_tier` | 否 | 子代理使用的模型、推理与输出设置；省略时按下文“模型与推理强度”的规则继承 |
| `[features]` | 否 | 只能关闭 `shell_tool`、`apps`、`plugins`、`memories`、`request_permissions_tool` 这几项能力；写成 `true` 或写其他开关都不生效 |
| `[skills]` | 否 | 只能停用技能：`skills.config` 中 `enabled = false` 的条目、`skills.bundled.enabled = false`、`skills.include_instructions = false` |

除此之外的键（如 `sandbox_mode`、`approval_policy`、`mcp_servers`、`model_provider`、`notify`）写了也不生效：子代理的沙箱、审批与工作目录跟随父轮次，MCP 服务器、模型提供方等沿用父会话的配置。需要专用的 MCP 服务器，就把它配置在主配置里，再在 agent 的指令里说明该用哪个。

### 示例

`.codex/agents/reviewer.toml`：

```toml
name = "reviewer"
description = "PR 评审：关注正确性、安全和缺失的测试。"
model_reasoning_effort = "high"
developer_instructions = """
像代码负责人一样评审。
优先看正确性、安全、行为回归和缺失的测试。
先列具体问题，尽量附复现步骤；不要只提风格意见。
"""
```

`.codex/agents/docs-researcher.toml`（只做调研，关掉 shell 工具）：

```toml
name = "docs_researcher"
description = "文档专家：通过文档 MCP 服务器核实 API 与框架行为。"
developer_instructions = """
用 openaiDeveloperDocs 这个 MCP 服务器确认 API、选项和特定版本的行为。
回答简洁，附上链接或准确出处。不要修改代码。
"""

[features]
shell_tool = false   # agent 文件只能关掉能力，不能打开
```

这里用到的 `openaiDeveloperDocs` 要事先配置在 `~/.codex/config.toml` 的 `[mcp_servers]` 里，子代理沿用父会话的 MCP 服务器。

之后在提示里点名即可，例如“让 reviewer 找出真实风险，让 docs_researcher 核实补丁依赖的框架 API”。

也可以在 `config.toml` 里声明角色，把配置放进单独的文件（相对路径相对于声明它的那个配置文件解析）：

```toml
[agents.researcher]
description = "偏重调研的角色。"
config_file = "./agents/researcher.toml"
nickname_candidates = ["Herodotus", "Ibn Battuta"]
```

`[agents]` 下的标量设置名（如 `enabled`）是保留字，不能用作角色名。

## 全局设置：[agents]

| 键 | 默认值 | 说明 |
| --- | --- | --- |
| `agents.enabled` | `true` | 设为 `false` 关闭多代理工具；显式开启的 `features.multi_agent_v2` 优先于它 |
| `agents.max_concurrent_threads_per_session` | 由实现决定 | 同时打开的子代理线程上限，不含主线程，下限为 `1`；旧名 `agents.max_threads` 仍然可用，同一层配置里两者都写时以新名为准 |
| `agents.max_depth` | `1` | 嵌套深度，只对 V1 实现生效 |
| `agents.default_subagent_model` | 未设置 | 子代理的默认模型，派生时显式指定的模型优先 |
| `agents.default_subagent_reasoning_effort` | 未设置 | 子代理的默认推理强度，派生时显式指定的值优先 |
| `agents.interrupt_message` | `true` | agent 的轮次被中断时，是否在它的上下文里记一条模型可见的消息 |

```toml
[agents]
max_concurrent_threads_per_session = 8
default_subagent_reasoning_effort = "medium"
```

## codex agents：代理总览

`codex agents` 打开代理总览，浏览所有 agent 会话及其子代理、查看实时任务详情并恢复会话。TUI 里的 `/agents` 打开的是同一个视图；输入框为空时按 `←` 也能打开（前提是编辑器的左移键仍是 `←`，底部会有提示）。v0.156.0 起它在界面上改称 agent command center；v0.167.0 起，除了共享的后台守护进程或远程 app server 外，内嵌 app server 模式（`--no-daemon`）下也可以直接使用 `codex agents` 与 `/agents` 浏览和管理本地会话。

| 参数 | 说明 |
| --- | --- |
| `--remote ADDR` | 连接远程 app server，支持 `ws://host:port`、`wss://host:port`、`unix://`、`unix://PATH` |
| `--remote-auth-token-env ENV_VAR` | 保存 WebSocket bearer token 的环境变量名；只能配合 `wss://` 或回环地址的 `ws://` |
| `-C, --cd DIR` | 在远程服务器上新建任务时使用的目录 |
| `--no-daemon` | 不连接也不启动共享后台服务，在内嵌 app server 上打开代理总览（v0.167.0 起支持，不能与 `--remote` 同用） |
| `--no-alt-screen` | 不使用终端的备用屏幕 |

```bash
codex agents              # 默认连接或自动拉起本机后台服务
codex agents --no-daemon  # 内嵌模式下浏览本地会话
```

总览顶部按状态分成 All、Needs you、Working、Ready、Inactive 几个标签，标签上带任务数；任务可以按项目、目录（v0.165.0 起支持按目录分组，并将托管 Git worktree 归入所属仓库之下）、状态或模型分组，且所选分组方式在下次启动时会保留（v0.162.0 起）。后台任务产生尚未查看的新结果时会显示未读标记（v0.167.0 起）。选中任务后，详情里显示所用模型、输入与输出 token 数，Business 与 Enterprise 套餐还会显示估算的 credits 与美元费用。启动时除了已加载的会话，还会列出近期的 10 个会话。

v0.156.0 起的默认按键如下。除导航键外，它们对应 `tui.keymap.agents` 下的 `new_task`、`new_worktree`、`resume`、`search`、`fork`、`pin`、`rename`、`stop`、`archive`、`hide`、`delete`、`toggle_grouping`，可以重新绑定；按 `?` 随时查看当前生效的按键：

| 按键 | 作用 |
| --- | --- |
| `↑`、`↓`、`PgUp`、`PgDn` | 在任务列表中移动、翻页 |
| `Enter` | 打开选中的任务 |
| `Tab`、`Shift+Tab` | 在状态标签之间切换 |
| `n` | 新开一个会话（按项目分组时，放在选中任务所在的检出里）；v0.158.0 起，会话建好之前输入框一直可见、可以先输入，不再被清掉或换成 Loading task 画面 |
| `w` | 从项目的默认分支新建 worktree 并在其中开一个空白会话（优先用远端的 `HEAD`，找不到时用 `main` 或 `master`，不会先 fetch） |
| `o` | 打开会话恢复选择器 |
| `f` | 将选中的任务分叉（fork）为新会话（v0.161.0 起） |
| `p` | 置顶或取消置顶选中的任务（v0.162.0 起） |
| `r`、`x` | 重命名选中的任务；停止正在运行的任务 |
| `g` | 在按项目、按目录、按状态、按模型分组之间切换（v0.162.0 起跨启动记住选择） |
| `h` | 隐藏选中的任务但不停止它，直到你再次恢复它或重启 TUI |
| `a` | 归档选中的任务及其子代理，需确认（v0.166.0 起取消归档父会话时会一并恢复这些派生的子代理线程） |
| `Backspace` | 永久删除选中的任务及其子代理的记录，需确认 |
| `?` | 显示全部按键 |
| `Esc` | 关闭帮助，或取消搜索、重命名；再按一次离开总览 |

v0.155.0 的默认键是 `Ctrl+N`、`Ctrl+E`、`Ctrl+W` 这类组合键以及 `Delete`，v0.156.0 起统一改成上表的单个按键；在 `tui.keymap.agents` 里自定义过的，以你的配置为准。

- 由另一个 app server 管理的任务（例如正在桌面应用里打开的对话）会以只读历史打开：按 `r` 重试接管，v0.157.0 起按 `f` 可以分叉出一个可编辑的副本继续，按 `Esc` 回到总览（v0.158.0 起也可以按 `←`，草稿保留）。
- 连接守护进程或远程 app server 时，在会话里执行 `/archive`（v0.155.0 起）或 `/delete`（v0.156.0 起）之后都会回到这个总览。v0.157.0 起，正在进行语音对话的任务带有 `voice` 标记。
- `codex agents` 不接受初始提示词或图片。连接远程服务器时，不能再带 `--oss` 之类的本地模型提供方参数或 `--add-dir`；工作负载身份（workload identity）生效时不可用。

守护进程的管理见 [SDK 与 App Server](/manual/agent/codex/sdk-app-server)。

## 注意事项

1. **成本**：子代理越多，token 消耗越多；嵌套子代理的用量也计入根目标（`/goal`）的 token 预算（v0.151.0 起）。
2. **项目级 agent 需要信任**：未受信任的项目会跳过项目级的 `.codex/` 配置层，其中的 `.codex/agents/` 也不会加载。
3. **非交互运行没有审批弹窗**：`codex exec` 里需要新审批的子代理操作会失败，事先用沙箱和审批设置放行必要的操作（见[沙箱、审批与安全](/manual/agent/codex/sandbox-approvals)）。
