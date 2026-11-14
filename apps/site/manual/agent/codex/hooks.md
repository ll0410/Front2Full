---
title: "Hooks"
description: "在 Codex 生命周期的固定节点运行脚本或 MCP 工具：全部事件与触发时机、配置写法、匹配规则、输入输出约定、信任与调试，附完整示例。"
source: "https://daiw.org/manual/codex/hooks"
---

# Hooks

> 在 Codex 生命周期的固定节点运行脚本或 MCP 工具：全部事件与触发时机、配置写法、匹配规则、输入输出约定、信任与调试，附完整示例。

Hooks 让你在 agent 循环的固定节点运行自己的命令或调用已连接的 MCP 工具，用于拦截危险操作、补充上下文、记录审计日志、在回合结束时检查或通知。功能默认开启；除企业托管的 hook 外，每条 hook 都要先审阅并信任才会运行。事件名和 JSON 约定大体沿用了 Claude Code 的 hooks。

## 事件一览

| 事件 | 触发时机 | 能做什么 |
| --- | --- | --- |
| `SessionStart` | 会话启动、恢复、清空、压缩之后，以及分叉出新会话时（v0.155.0 起） | 注入上下文；返回 `continue: false` 时本轮不再请求模型 |
| `UserPromptSubmit` | 用户输入发给模型之前 | 注入上下文，或拦下这条输入 |
| `PreToolUse` | 工具执行之前 | 拒绝、改写参数、注入上下文 |
| `PermissionRequest` | Codex 准备弹出审批时（配置了自动审查时先于审查运行） | 直接批准或拒绝 |
| `PostToolUse` | 工具产生结果之后 | 用反馈替换结果、注入上下文（无法撤销已执行的操作） |
| `PreCompact`、`PostCompact` | 压缩上下文之前、之后 | 返回 `continue: false` 中止 |
| `SubagentStart`、`SubagentStop` | 子代理启动、结束 | 给子代理注入上下文；让子代理继续 |
| `Stop` | 一轮即将结束时 | 让 Codex 接着做（自动生成续写提示） |
| `Interrupt` | 你中断主线程上正在进行的一轮（v0.150.0 新增） | 只能记录或清理，无法阻止中断 |
| `SessionEnd` | 主线程会话结束 | 仅通知，不影响流程 |

`Interrupt` 与 `SessionEnd` 不会为子代理触发。`SessionEnd` 在正常退出 Codex、归档或删除仍打开的对话时运行；对话闲置（没有进行中的回合）且没有任何客户端打开它，超过 `thread_unload_delay_secs`（默认 60 秒）被 app server 卸载时也会运行。

## 配置位置与合并

hook 可以写在 `hooks.json` 里，也可以写在 `config.toml` 的 `[hooks]` 表中。常用位置：

- `~/.codex/hooks.json` 或 `~/.codex/config.toml`
- `<仓库>/.codex/hooks.json` 或 `<仓库>/.codex/config.toml`（项目 `.codex/` 层受信任时才加载）
- 已启用插件的 `hooks/hooks.json`，见[插件](/manual/agent/codex/plugins)
- 企业托管的 `requirements.toml`、MDM 等

所有来源的 hook 都会加载，高优先级的层不会替换低优先级的 hook；同一层同时有 `hooks.json` 和 `[hooks]` 时会合并并警告。匹配同一事件的多个命令 hook 并发启动，彼此无法阻止。

## 配置结构

分三层：事件、匹配组（`matcher`）、一个或多个处理器。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "^Bash$",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.codex/hooks/pre_tool_use.py",
            "timeout": 30,
            "statusMessage": "Checking Bash command"
          }
        ]
      }
    ]
  }
}
```

在 `config.toml` 里写成 `[[hooks.PreToolUse]]` 与 `[[hooks.PreToolUse.hooks]]` 两级数组表，字段相同，写法见文末的通知示例。

| 字段 | 说明 |
| --- | --- |
| `type` | `command` 或 `mcp_tool`；`prompt`、`agent` 能解析，但会被跳过并告警 |
| `command` | 交给 shell 执行的命令，工作目录是会话的 `cwd` |
| `commandWindows` | Windows 上替代 `command`，TOML 中也可写 `command_windows` |
| `timeout` | 秒，默认 600；`SessionEnd`、`Interrupt` 默认 1、上限为 3 |
| `async` | 设为 `true` 在后台运行，不等结果，也不能控制流程 |
| `statusMessage` | 运行期间在界面上显示的提示 |
| `additionalContextLimit` | 只对能返回 `additionalContext` 的事件有效，默认约 2500 token，超出时全文写入临时文件、模型只看预览；`0` 为不限制 |

仓库内的 hook 建议用基于 git 根目录的路径（写法见文末示例），因为 Codex 可能从子目录启动。

### 调用 MCP 工具

`mcp_tool` 处理器直接调用 MCP 服务器上的工具。`input` 里可以用 `${字段.子字段}` 引用事件数据：占位符占满整个值时保留原 JSON 类型，嵌在字符串里时按文本插入。

```json
{
  "type": "mcp_tool",
  "server": "scanner",
  "tool": "scan_patch",
  "input": { "patch": "${tool_input.command}" },
  "timeout": 30
}
```

v0.164.0 起，如果目标 MCP 服务器已配置但处于休眠（尚未启动）状态，Codex 会在执行 hook 调用时自动按需启动该服务器；服务器不存在、工具不可用或调用出错都不会阻止原操作。它同步运行，不触发审批或其他 hook。`SessionEnd` 不支持 MCP hook。

## matcher 匹配规则

`matcher` 写 `*`、空字符串或省略都表示匹配全部。只由字母、数字、下划线和 `|` 组成时按名称精确匹配，`|` 分隔多个候选（`Bash` 不会匹配 `BashOutput`）；含其他字符时按正则表达式在名称中查找，不会自动加首尾锚点（`^Bash` 也能匹配 `BashOutput`）。

| 事件 | 匹配对象 | 取值 |
| --- | --- | --- |
| `PreToolUse`、`PostToolUse`、`PermissionRequest` | 工具名 | `Bash`、`apply_patch`（也可写 `Edit`、`Write`）、`mcp__fs__read_file`、`mcp__fs__.*` |
| `SessionStart` | 启动来源 | `startup`、`resume`、`clear`、`compact`、`fork`（v0.155.0 起） |
| `PreCompact`、`PostCompact` | 触发方式 | `manual`、`auto` |
| `SubagentStart`、`SubagentStop` | 子代理类型 | 视子代理而定 |
| `SessionEnd` | 结束原因 | 目前只有 `other` |
| `UserPromptSubmit`、`Stop`、`Interrupt` | 不支持 | 写了也会被忽略 |

v0.155.0 之前，分叉出的会话按 `startup` 上报，匹配 `startup` 的 hook 会把父会话里已有的启动上下文再注入一遍；现在分叉上报 `fork`，通过 app server 传入历史记录来恢复的会话也改报 `resume`。派生子代理照常触发 `SubagentStart`，不论它是全新上下文还是分叉上下文。

工具类事件覆盖 shell 命令与 `exec_command`（都按 `Bash` 匹配）、`apply_patch`、MCP 工具，以及 `update_plan` 等本地函数工具（`spawn_agent` 也可按 `Agent` 匹配）；网页搜索等托管工具不经过 hook。工具 hook 是防护栏，不是完整的安全边界。

`write_stdin` 只是向已启动的命令会话发送输入或轮询输出，不会再触发 `PreToolUse`（原命令启动时已按 `Bash` 触发过）。v0.158.0 起终端输入审批默认开启：向运行中的终端写入输入需要审批时（例如这个终端当初在沙箱外启动，见[沙箱、审批与安全](/manual/agent/codex/sandbox-approvals)），会以工具名 `write_stdin` 触发 `PermissionRequest`，`tool_input` 里有终端会话号 `session_id` 和输入内容 `chars` 等字段。

## 输入

命令 hook 从 stdin 读到一个 JSON 对象，通用字段有 `session_id`、`transcript_path`、`cwd`、`hook_event_name`，除 `SessionEnd` 外还有 `model`；回合内的事件带 `turn_id`，多数事件还带 `permission_mode`（审批策略为 `never` 时是 `bypassPermissions`，否则是 `default`）。在子代理里触发的工具类事件、压缩事件和 `UserPromptSubmit` 还会带上 `agent_id`、`agent_type`。

| 事件 | 额外字段 |
| --- | --- |
| `PreToolUse`、`PostToolUse` | `tool_name`、`tool_use_id`、`tool_input`（`Bash` 与 `apply_patch` 的内容在 `tool_input.command`）；`PostToolUse` 另有 `tool_response` |
| `PermissionRequest` | `tool_name`、`tool_input`（`Bash` 的 `tool_input` 可能带审批理由 `description`；被拦截的联网请求也以 `Bash` 出现，`description` 为 `network-access <目标>`） |
| `UserPromptSubmit` | `prompt` |
| `Stop` | `stop_hook_active`、`last_assistant_message` |
| `SubagentStart`、`SubagentStop` | `agent_id`、`agent_type`；`SubagentStop` 另有 `agent_transcript_path`、`stop_hook_active`、`last_assistant_message` |
| 其他 | `SessionStart` 的 `source`、压缩事件的 `trigger`、`SessionEnd` 的 `reason` |

`transcript_path` 所指文件的格式不是稳定接口。

## 输出与返回值

| 退出码 | 含义 |
| --- | --- |
| `0` | 成功。stdout 为空表示没有意见，也可以输出 JSON。纯文本只有 `SessionStart`、`SubagentStart`、`UserPromptSubmit` 当作上下文；工具类事件忽略纯文本；`Stop`、`SubagentStop`、`Interrupt` 视纯文本为无效 |
| `2` | 控制信号，以 stderr 内容为理由：`PreToolUse` 拦下调用，`PermissionRequest` 拒绝，`PostToolUse` 替换工具结果，`UserPromptSubmit` 拦下输入，`Stop` 与 `SubagentStop` 用它作续写提示。stderr 为空时算失败 |
| 其他 | hook 失败，报告错误后原操作照常进行 |

各事件常用的 JSON 输出（多数事件还可以用 `systemMessage` 在界面上显示一条警告）：

| 事件 | JSON |
| --- | --- |
| `PreToolUse` | 在 `hookSpecificOutput` 中：`permissionDecision` 为 `deny` 并给出非空的 `permissionDecisionReason` 即拒绝；为 `allow` 并带 `updatedInput` 即改写参数；`additionalContext` 补充上下文 |
| `PermissionRequest` | `hookSpecificOutput.decision.behavior` 为 `allow` 或 `deny`（可带 `message`）；任一 `deny` 优先，都不表态就走正常审批 |
| `PostToolUse` | `decision: "block"` 加 `reason`，或 `continue: false`，都会用反馈替换工具结果；`additionalContext` |
| `UserPromptSubmit` | `decision: "block"` 加 `reason`，或 `continue: false`，都会拦下输入；`additionalContext` |
| `Stop`、`SubagentStop` | `decision: "block"` 加 `reason`，以 `reason` 作为新提示继续；任一 hook 返回 `continue: false` 时优先停止 |
| `SessionStart`、`SubagentStart` | `hookSpecificOutput.additionalContext`；`SessionStart` 返回 `continue: false` 时本轮不再请求模型，`SubagentStart` 忽略它 |
| `PreCompact`、`PostCompact` | `continue: false` 中止 |
| `Interrupt` | 只接受 `systemMessage` |

`PreToolUse` 拒绝一条命令：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Destructive command blocked by hook."
  }
}
```

`PreToolUse` 也接受旧式的 `decision: "block"`（需带非空的 `reason`）；返回 `permissionDecision: "ask"`、不带 `updatedInput` 的 `allow`、`decision: "approve"`、`continue` 等尚未支持的写法时，该 hook 记为失败，工具调用照常进行。

## 后台运行与超时

- `async: true` 的 hook 在后台运行，结果在下一个安全点交给模型，不能拦截、批准或改写操作；每个会话同时运行的上限为 8 个，会话结束时未完成的被取消；`SessionEnd` 总是同步运行。
- 超时后 Codex 终止 hook 进程并记为失败，原操作照常继续。v0.155.0 起，向 hook 写入 stdin 也计入超时，hook 不读 stdin 时不会再卡住；Unix 上的命令 hook 不再继承控制终端，shell 启动脚本碰到终端 I/O 时不会把 hook 挂起。
- 超过约 2500 token 的输出会写入 `<临时目录>/hook_outputs/<session_id>/`，模型只看到预览和路径，所以不要在输出里带密钥。

## 信任、开关与调试

- **审阅与信任**：Codex 按 hook 定义的哈希记录信任，新增或改动的 hook 会被跳过，直到你在 TUI 的 `/hooks` 中审阅并信任；这里也能单独停用某条 hook。有待审阅的 hook 时启动会提示，信任状态保存在 `config.toml` 的 `hooks.state` 中。
- **托管 hook**：来自系统、MDM、云端或 `requirements.toml` 的 hook 由策略直接信任，不能停用；管理员设置 `allow_managed_hooks_only = true` 后只运行托管 hook。
- **跳过信任**：`--dangerously-bypass-hook-trust` 让本次运行中已启用的 hook 无需信任即可执行，仅适合已在外部审核过来源的自动化（`codex` 与 `codex exec` 都支持）。
- **整体关闭**：在 `config.toml` 的 `[features]` 下设 `hooks = false`（旧名 `codex_hooks` 仍可用）。
- **调试**：留意启动警告（JSON 解析失败、matcher 正则无效、超时被截断等）；也可以把示例 JSON 用管道喂给脚本单独测试，如 `echo '{"tool_input":{"command":"rm -rf /"}}' | ./block-dangerous.sh; echo $?`。

## 示例

### 拦截危险命令，提交前自动格式化

两个处理器挂在同一个 `PreToolUse` 匹配组下，脚本放在 `.codex/hooks/`：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "^Bash$",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$(git rev-parse --show-toplevel)/.codex/hooks/block-dangerous.sh\"",
            "timeout": 10
          },
          {
            "type": "command",
            "command": "bash \"$(git rev-parse --show-toplevel)/.codex/hooks/format-before-commit.sh\"",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

`block-dangerous.sh` 命中规则时以退出码 2 拦下，stderr 作为理由反馈给模型（需要 `jq`）：

```bash
#!/usr/bin/env bash
cmd=$(jq -r '.tool_input.command // empty')
if printf '%s' "$cmd" | grep -Eq 'rm -rf /|git push .*(--force|-f)|git reset --hard'; then
  echo "Blocked by hook: $cmd" >&2
  exit 2
fi
exit 0
```

`format-before-commit.sh` 只在 `git commit` 前格式化已暂存的文件并重新暂存（未处理带空格的文件名）。两个处理器并发运行，它不能依赖前一个的结果。

```bash
#!/usr/bin/env bash
cmd=$(jq -r '.tool_input.command // empty')
case "$cmd" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac
cd "$(git rev-parse --show-toplevel)" || exit 0
files=$(git diff --cached --name-only --diff-filter=ACM -- '*.ts' '*.tsx' '*.js' '*.css')
if [ -n "$files" ]; then
  npx prettier --write $files >/dev/null 2>&1 && git add $files
fi
exit 0
```

### 会话结束时发桌面通知

```toml
[[hooks.SessionEnd]]

[[hooks.SessionEnd.hooks]]
type = "command"
command = "bash ~/.codex/hooks/notify.sh"
timeout = 3
```

```bash
#!/usr/bin/env bash
if command -v osascript >/dev/null; then
  osascript -e 'display notification "Codex session ended" with title "Codex"'
elif command -v notify-send >/dev/null; then
  notify-send "Codex" "Codex session ended"
fi
exit 0
```

想在每轮结束时提醒，就把同一个脚本挂到 `Stop` 事件上，脚本不要输出任何内容。
