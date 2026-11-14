---
title: "命令规则 Rules"
description: "用 .rules 文件控制哪些命令可以在沙箱外运行：文件位置、Starlark 语法、匹配与决策、测试方法以及与审批策略的关系"
source: "https://daiw.org/manual/codex/rules"
---

# 命令规则 Rules

> 用 .rules 文件控制哪些命令可以在沙箱外运行：文件位置、Starlark 语法、匹配与决策、测试方法以及与审批策略的关系

Rules（源码中称 execpolicy）按**命令前缀**决定 Codex 要执行的命令如何处理：直接在沙箱外运行（`allow`）、先征求你的同意（`prompt`），还是直接拒绝（`forbidden`）。该功能仍属实验性质，后续可能调整。

## 规则文件放在哪里

Codex 启动时扫描每个生效配置层旁边的 `rules/` 目录，加载其中所有扩展名为 `.rules` 的普通文件（同一目录内按文件名排序；符号链接形式的规则文件会被跳过）。修改规则后需要重启 Codex。

| 位置 | 说明 |
| --- | --- |
| `~/.codex/rules/`（即 `$CODEX_HOME/rules/`） | 用户层。在 TUI 里把某个命令加入允许列表时，Codex 会向这里的 `default.rules` 追加一条 `allow` 规则；在联网审批里选择以后都允许或拦截某个主机时，追加的是一条 `network_rule()` |
| `<repo>/.codex/rules/` | 项目层，只有项目的 `.codex/` 配置层被信任时才加载 |
| Team Config 等其他配置层的 `rules/` | 同样会被扫描 |
| 管理员 `requirements.toml` 中的 `[rules]` | 强制规则，与 `.rules` 文件合并，见文末 |

低优先级的层先加载，高优先级的层后加载。`codex exec --ignore-rules` 可以跳过用户层和项目层的规则。

## 语法

`.rules` 文件使用 Starlark 语言：语法类似 Python，但执行时没有副作用（不会读写文件系统）。可用的函数有 `prefix_rule()`、`host_executable()` 和 `network_rule()`。

```python
# ~/.codex/rules/default.rules

# 只读的 git 查询：允许直接在沙箱外运行
prefix_rule(
    pattern = ["git", ["status", "diff", "log"]],
    decision = "allow",
    justification = "只读的 git 查询",
    match = ["git status", "git diff --stat", ["git", "log", "-5"]],
    not_match = ["git push origin main"],
)

# 推送之前先问我
prefix_rule(
    pattern = ["git", "push"],
    decision = "prompt",
    justification = "推送到远端前需要人工确认",
    match = ["git push", "git push origin main"],
)

# 直接禁止，并给出替代做法
prefix_rule(
    pattern = ["rm", "-rf"],
    decision = "forbidden",
    justification = "不要用 rm -rf，先用 git clean -n 预览再删除",
)
```

`prefix_rule()` 的参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `pattern` | 是 | 非空列表，从命令的首个参数开始逐个匹配；每个元素是字符串，或字符串列表（表示该位置多选一） |
| `decision` | 否 | `allow`（默认）、`prompt` 或 `forbidden` |
| `justification` | 否 | 规则理由，不能是空字符串；可能出现在审批提示或拒绝信息中。`forbidden` 规则建议写上替代做法 |
| `match` | 否 | 必须匹配本规则的示例命令 |
| `not_match` | 否 | 不能匹配本规则的示例命令 |

`match` 与 `not_match` 相当于内联的单元测试：示例可以写成字符串（按 shell 规则拆分）或字符串列表，加载时逐条校验，不符合就报错，让你在规则生效之前发现写错的地方。

### 限定可执行文件路径 `host_executable()`

规则的首个参数通常写命令名（如 `git`）。Codex 运行时遇到以绝对路径调用的命令（如 `/usr/bin/git status`），如果没有规则精确匹配这个路径，会回退为按文件名 `git` 匹配。`host_executable()` 可以限定只有列出的路径才允许这样回退：

```python
host_executable(
    name = "git",
    paths = ["/usr/bin/git", "/opt/homebrew/bin/git"],
)
```

`paths` 必须是绝对路径，且文件名要与 `name` 一致；没有为某个命令名定义 `host_executable()` 时，任何路径都可以回退。

### 网络规则 `network_rule()`

开启网络代理（`features.network_proxy`，见[沙箱、审批与安全](/manual/agent/codex/sandbox-approvals)）后，联网请求被代理拦下时的审批里可以选择以后都允许或都拦截这个主机，Codex 会把选择写成一条 `network_rule()` 追加到用户层的 `default.rules`，之后的会话照样生效。也可以手写：

```python
network_rule(
    host = "api.github.com",
    protocol = "https",
    decision = "allow",
    justification = "允许访问 GitHub API",
)
```

- `host` 必须是具体的主机名或 IP（端口会被忽略），不能带协议、路径或通配符；`protocol` 为 `http`、`https`、`socks5_tcp`、`socks5_udp` 之一。
- `decision` 为 `allow` 或 `deny`（也可写 `forbidden`），分别把主机加入代理的允许或拒绝名单；`prompt` 不起作用。目前按主机整体生效，不区分 `protocol`。
- 网络规则只在网络代理启用时起作用，`codex execpolicy check` 也只检查命令规则。

## 匹配与决策

Codex 把待执行的命令看作参数列表（类似 `execvp(3)` 接收的参数），与 `pattern` 从头逐个比较：

- 每个位置必须与字符串完全相同，或者命中多选一列表中的某一项；命令可以比 `pattern` 更长。因此 `["git", "reset", "--hard"]` 不会匹配 `git reset --keep`，`["rm", "-rf"]` 也不会匹配 `rm -fr`。
- 多条规则同时命中时取严格程度较高的决策：`forbidden` 高于 `prompt-user`（仅托管规则可用），`prompt-user` 高于 `prompt`，`prompt` 高于 `allow`。

| 决策 | 效果 |
| --- | --- |
| `allow` | 不询问直接运行；只有拆分后的每一段命令都被规则明确允许时，才会跳过沙箱执行（生效的权限配置档含 `deny` 条目时仍在沙箱内运行） |
| `prompt` | 每次执行前都请求批准（开启自动审查时可交由自动审查判断） |
| `prompt-user` | 仅用于管理员 `requirements.toml`（v0.167.0 起）：每次执行前强制要求真人审批，即使启用了自动审查也不交给审查 agent |
| `forbidden` | 直接拒绝，不询问 |

**没有命中任何规则的命令**按内置启发式和审批策略处理：被识别为危险的命令需要批准（审批策略为 `never` 时直接拒绝）；其余命令在沙箱内运行，需要越出沙箱时再按审批策略处理。

### Shell 包装与复合命令

`bash -lc "git add . && rm -rf /"` 这类调用把多个动作藏在一个字符串里，所以 Codex 对 `bash -lc`、`bash -c` 以及对应的 `zsh`、`sh` 形式做特殊处理：

- 脚本只由普通单词和 `&&`、`||`、`;`、`|` 组成时，Codex 用 tree-sitter 把它拆成多条命令分别判定，取严格程度较高的结果。上例中即使允许了 `["git", "add"]`，`rm -rf /` 这一段也会阻止整条命令被自动放行。
- 脚本含重定向、变量展开、`$(...)`、通配符、控制流等复杂写法时不拆分，整条调用按 `["bash", "-lc", "<完整脚本>"]` 匹配。
- 在 Windows 上，`powershell`、`pwsh` 以 `-Command`（或 `-c`）传入的脚本也按同样思路处理：只由字面命令组成时拆开分别判定，含动态写法时不拆分。

## 与审批策略的关系

| 审批设置 | 对规则的影响 |
| --- | --- |
| `approval_policy = "on-request"` | `prompt` 规则命中时弹出审批；配置了 `approvals_reviewer = "auto_review"` 时改由自动审查决定是否放行 |
| `approval_policy = "never"`（`codex exec` 默认） | `prompt` 规则命中时无法询问，直接拒绝 |
| `granular` 策略中 `rules = false` | `prompt` 规则触发的审批被自动拒绝 |
| 项目的 `trust_level = "untrusted"` | 没有被规则 `allow` 的命令每次都要批准 |

- `forbidden` 在任何审批策略下都会拒绝；`allow` 在任何审批策略下都免于询问。
- Codex 请求越权执行时，模型可能顺带建议一条 `prefix_rule`（官方文档称为 Smart approvals），审批界面会多出“以后以此开头的命令不再询问”的选项，选中后写入用户层的 `default.rules`。模型建议的若是 `bash -lc`、`python`、`node`、`git`、`rm`、`sudo` 这类过宽的前缀，Codex 不会采纳；接受之前仍请确认前缀没有放得太宽，否则会一次放行一大类命令。
- v0.158.0 起，被 `allow` 规则放到沙箱外运行的交互式命令（如 `ssh`），模型之后向它的终端写入输入时仍要逐次审批，审批策略为 `never` 时直接拒绝，详见[沙箱、审批与安全](/manual/agent/codex/sandbox-approvals)。
- 规则只决定“能否在沙箱外运行、要不要问你”，沙箱本身的边界见 [沙箱、审批与安全](/manual/agent/codex/sandbox-approvals)。

## 测试规则 `codex execpolicy check`

::: info

`execpolicy` 是隐藏子命令，`codex --help` 里看不到；官方文档称它仍处于预览阶段，输出格式将来可能变化。

:::

```bash
codex execpolicy check --pretty \
  --rules ~/.codex/rules/default.rules \
  -- git push origin main
```

```json
{
  "matchedRules": [
    {
      "prefixRuleMatch": {
        "matchedPrefix": [
          "git",
          "push"
        ],
        "decision": "prompt",
        "justification": "推送到远端前需要人工确认"
      }
    }
  ],
  "decision": "prompt"
}
```

| 参数 | 说明 |
| --- | --- |
| `-r`, `--rules <PATH>` | 规则文件，必填；可重复，多个文件按给出的顺序合并 |
| `--pretty` | 格式化输出的 JSON |
| `--resolve-host-executables` | 对绝对路径的程序启用按文件名回退匹配（受 `host_executable()` 约束） |
| `COMMAND...` | 要检查的命令，建议写在 `--` 之后 |

输出中的 `matchedRules` 列出所有命中的规则（`matchedPrefix` 是实际命中的前缀；经文件名回退命中时还有 `resolvedProgram`），`decision` 是其中严格程度较高的决策；没有规则命中时 `matchedRules` 为空数组，也没有 `decision` 字段。注意 `check` 只按你给出的参数列表匹配，不会像运行时那样拆分 `bash -lc` 脚本，也不套用内置启发式。

规则文件有语法错误或示例校验失败时：`execpolicy check` 会报错并指出文件和位置；`codex exec` 打印 `Error loading rules` 后退出；交互会话会给出警告，本次加载的 `.rules` 文件都不生效，只保留管理员强制的规则。

## 管理员强制规则

管理员可以在 `requirements.toml` 中用 `[rules]` 表下发强制规则。它们与 `.rules` 文件合并，仍然取严格程度较高的决策；与 `.rules` 不同，这里必须写 `decision`，且只允许 `prompt`、`prompt-user`（v0.167.0 起新增，要求真人审批，跳过自动审查）或 `forbidden`：

```toml
[rules]
prefix_rules = [
  { pattern = [{ token = "rm" }], decision = "forbidden", justification = "Use git clean -fd instead." },
  { pattern = [{ token = "git" }, { any_of = ["push", "commit"] }], decision = "prompt-user", justification = "Require human review before mutating history." },
]
```

此外，`requirements.toml` 的 `[auto_review]` 表可以用 `ignore_rules` 列出模型（写完整的模型 slug），这些模型运行时会忽略所有 `allow` 前缀规则，也不再提供“以后不再询问”的前缀选项，`prompt`、`prompt-user`、`forbidden` 与网络规则照常生效。专用于网络安全的模型本身就按这种方式处理。
