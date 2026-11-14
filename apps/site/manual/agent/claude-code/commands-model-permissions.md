---
title: "模型、效率与权限"
description: "模型切换、推理强度、执行速度、权限模式与规则管理"
source: "https://daiw.org/manual/claude-code/commands-model-permissions"
---

# 模型、效率与权限

> 模型切换、推理强度、执行速度、权限模式与规则管理

## 模型与推理

| 命令 | 作用 |
| --- | --- |
| `/model [model]` | 切换模型并保存为新会话默认值；支持左右方向键调整推理强度。不带参数打开选择器，在某一行按 `s` 表示“仅本次会话切换”。⚠️ v2.1.277 起 Anthropic API 上 Fable 始终出现在选择器里，只有组织设置禁用它时才显示为灰色。⚠️ v2.1.280 起 `opus` 指向新的默认 Opus 模型 Opus 5.5，Pro 与 Team Standard 套餐的默认模型也从 Sonnet 改为 Opus；v2.1.284 起 Anthropic API 上的 `sonnet` 默认指向 Sonnet 5.5；v2.1.293 起 Anthropic API 上的 `haiku` 默认指向 Haiku 5.5；v2.1.311 起在 `[1m]` 后缀无实际作用的模型上自动去掉该后缀与标签（传入仍兼容） |
| `/effort [level\|auto]` | 设置推理强度：`low`/`medium`/`high`/`xhigh`/`max`（可用档位取决于模型）。不带参数打开滑块交互。Ultracode 现在是独立开关：在滑块按 `Tab` 切换，或输入 `/effort ultracode [on\|off]`；它不再强制使用 `xhigh`。⚠️ v2.1.251 起按模型分别保存默认强度；v2.1.257 起在滑块里按 `s` 只改本会话。⚠️ v2.1.280 起按模型保存之前存下的强度不再套到 Opus 5.5 这类新模型上（它们从自己的默认强度起步，Opus 5.5 默认 `medium`）；⚠️ v2.1.311 起交互终端里的 `ultrathink` 关键词在 Opus 5.5、Sonnet 5.5、Haiku 5.5 与 Fable 5.1（Anthropic API）上把该轮推理强度提至 `xhigh`（设 `CLAUDE_CODE_DISABLE_ULTRATHINK=1` 关闭） |
| `/fast [on\|off]` | 切换 fast mode（用更高单价换取更快响应速度）。⚠️ v2.1.219 起适用于 **Opus 5 与 Opus 4.8**，Opus 4.7 已退出 fast mode；v2.1.304 起 Opus 5.5 的 `/fast` 对话框去掉「(research preview)」字样；⚠️ **v2.1.316 起 Opus 4.8 的 fast mode 弃用**（2026-10-30 起弃用，2026-11-30 移除，移除后直接报错且不回退标准速度，建议迁至 Opus 5.5）。🆕 v2.1.271 起 Claude Code Remote 会话（云端与自托管运行环境）也支持：宿主的 fast mode 设置或在会话里敲的 `/fast`，在组织允许时生效 |
| `/advisor [model\|off]` | 启用/关闭顾问工具：在任务关键节点额外咨询第二个模型的意见，支持 `opus`/`sonnet`/`fable` 或完整模型 ID（v2.1.98+）。v2.1.260 起桌面端、Remote Control 与无头会话也能用文本形式 `/advisor <model>`、`/advisor off`；🆕 v2.1.300 起 Claude Platform on AWS 也支持（设 `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` 可关闭顾问工具） |

## 权限与执行模式

| 命令 | 作用 |
| --- | --- |
| `/permissions` | 管理 allow/ask/deny 规则的交互界面，可按作用域查看、增删规则、管理工作目录、查看 auto mode 最近的拒绝记录。别名 `/allowed-tools`。v2.1.246 起新增 **Auto mode 标签页**，可查看与编辑 auto mode 分类器规则；v2.1.234 起 Claude 工作时也能打开，改动作用于当前这一轮剩余部分；v2.1.280 起删除规则与移除目录的确认默认选 No；🆕 v2.1.314 起审查标签页改名为 **Recently blocked**，且在终端过矮无法完整显示命令时拒绝批准；v2.1.318 起规则详情、内置规则与删除确认统一使用标准对话框（连按两次 Ctrl+C 返回或取消，不再退出 CLI） |
| `/auto-mode-setup` | 🆕 **v2.1.304+**：引导式配置向导，读取当前项目与近期会话，教 auto mode 了解你的环境（Bedrock、Vertex、Foundry、Claude apps 网关与关闭遥测的会话均可用） |
| `/plan [description]` | 直接进入计划模式（Claude 只读文件、给出方案，不做任何修改，需你确认后才真正动手）；可带任务描述，如 `/plan 修复认证 bug` |
| `/sandbox` | 切换沙箱模式（仅部分平台支持） |

## 会话级配置

| 命令 | 作用 |
| --- | --- |
| `/config [key=value ...]` | 打开设置界面调整主题、模型、输出风格等；也可以直接 `/config thinking=false`、`/config model=sonnet` 一步到位设置，非交互模式（`-p`）和 Remote Control 也支持这种写法。别名 `/settings`。🆕 v2.1.271 起全屏模式下支持鼠标（滚轮滚动设置列表、点击设置的值即可修改）；v2.1.277 起多了「Project instructions」一项，用来修改“没有 `CLAUDE.md` 时改读 `AGENTS.md`”这项行为；v2.1.302 起新增「Idle compaction」开关行 |
| `/goal [condition\|clear]` | 设定一个目标条件，Claude 会持续跨轮工作直到条件满足；不带参数查看当前/最近达成的目标，传 `clear`/`stop`/`off` 提前取消。v2.1.234 起被后台任务卡住 30 分钟以上会主动检查进度（之后退避，`CLAUDE_CODE_GOAL_CHECKIN_MINUTES=0` 关闭）；v2.1.269 起遇到 API 错误或断网会退避重试，或暂停并说明原因，而不是静默停滞 |

## 权限模式说明

Claude Code 有一组可以互相切换的权限模式（用 `--permission-mode` 启动指定，或会话中按 `Shift+Tab` 循环切换）：

| 模式 | 行为 |
| --- | --- |
| `default`（即 `manual`） | 每个有副作用的工具调用都需要你手动确认 |
| `acceptEdits` | 自动接受文件编辑，其它操作仍需确认 |
| `plan` | 只读：Claude 探索代码并给出计划，不执行任何修改 |
| `auto` | 用内置分类器自动放行“看起来安全”的操作。⚠️ v2.1.271 起技能与斜杠命令里内联的 `!` shell 命令改按默认模式的权限规则处理、不再交给分类器；v2.1.273 起 Bedrock、Vertex、Foundry 上暂时默认使用本地分类器（`CLAUDE_CODE_AUTO_MODE_SERVER=1` 改用平台的服务端分类器）；⚠️ v2.1.278 起 Claude API、Enterprise 以及 Bedrock、Vertex、Foundry 与网关上又改为默认服务端分类器（分类器开销不再收费，`CLAUDE_CODE_AUTO_MODE_SERVER=0` 退出），`/status` 的「Auto mode server」一行显示本会话是否在用；v2.1.281 起服务端审查的会话里，只读与沙箱化的 shell 命令也要等审查结果。⚠️ **v2.1.283 起没配置权限模式时，终端与 VS Code 里的交互式会话在所有套餐与提供方上都以 auto mode 起步**（此前只有 Pro、Max、Team 套餐如此），`permissions.defaultMode` 可覆盖 |
| `dontAsk` | 减少确认提示的更宽松模式 |
| `bypassPermissions` | 跳过全部权限确认（高风险，建议只在隔离/一次性环境使用）。⚠️ v2.1.281 起这个模式与 auto mode 下，危险 `rm` 的确认最多等 2 分钟，无人回答就拒绝并附上改写提示（`CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT=1` 关闭） |

::: warning

`bypassPermissions`（对应 `--dangerously-skip-permissions`）会跳过几乎所有确认步骤。在生产代码库或有写权限的 CI 环境中使用前，务必先了解清楚它*不会*跳过什么（见官方 permission modes 文档），并优先考虑限定作用域的 `--allowedTools` 规则。

:::

## 示例

```text
/model sonnet          # 切到 sonnet 系列
/effort high            # 提高本次任务的推理强度
/plan 重构订单模块的状态机
/permissions            # 打开权限规则管理
```
