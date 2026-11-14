---
title: "代码审查"
description: "交互模式的 /review、非交互的 codex review、审查模型配置、AGENTS.md 中的审查规则，以及 GitHub 与 GitLab 上的 @codex review"
source: "https://daiw.org/manual/codex/review"
---

# 代码审查

> 交互模式的 /review、非交互的 codex review、审查模型配置、AGENTS.md 中的审查规则，以及 GitHub 与 GitLab 上的 @codex review

Codex 的代码审查由一个专门的审查子代理完成：它读取选定范围的 diff，给出按优先级排序、可以直接行动的问题清单，**不会修改工作区**。

## 审查如何运行

- 审查子代理使用专用的审查提示词，审批策略固定为 `never`，并关闭网页搜索和子代理协作工具。
- 沿用当前会话已经加载的 `AGENTS.md` 指令。
- 使用 `review_model` 指定的模型；没有设置时用当前会话的模型。

每个问题都带有优先级、置信度和代码位置，文末给出整体结论（`patch is correct` 或 `patch is incorrect`）及理由。

| 优先级 | 含义 |
| --- | --- |
| P0 | 必须立刻处理，会阻塞发布、运维或主要功能 |
| P1 | 紧急，应在下一个周期修复 |
| P2 | 普通，迟早要修 |
| P3 | 低优先级，锦上添花 |

审查结果作为一轮对话留在记录里，之后可以直接让 Codex 修复，修复时照常受沙箱与审批设置约束。

## 交互模式 `/review`

```text
/review                              # 打开审查预设菜单
/review 重点检查数据库迁移能否回滚     # 直接按这段说明审查
```

| 预设 | 审查范围 |
| --- | --- |
| Review against a base branch（PR Style） | 从本地分支中选择基准分支，找到当前分支与它的 merge base，审查之后的全部改动 |
| Review uncommitted changes | 已暂存、未暂存和未跟踪的文件 |
| Review a commit | 从近期 100 个提交中选一个，审查它引入的改动 |
| Custom review instructions | 输入自定义说明，按说明审查 |

- 任务进行中（或还有排队待发的消息时）不能发起 `/review`；审查进行中不能使用 `/side`、`/btw`。
- 审查被中断时，Codex 会提示重新运行 `/review`。
- 想逐行查看改动，可以配合 `/diff`。

## 非交互 `codex review`

```bash
codex review --uncommitted
codex review --base main
codex review --commit 1a2b3c4 --title "修复登录重定向"
codex review "只关注权限校验相关的问题"
cat review-focus.md | codex review -
```

| 参数 | 说明 |
| --- | --- |
| `--uncommitted` | 审查已暂存、未暂存和未跟踪的改动 |
| `--base <BRANCH>` | 审查相对基准分支的改动 |
| `--commit <SHA>` | 审查某个提交引入的改动 |
| `--title <TITLE>` | 审查摘要中显示的提交标题，只能与 `--commit` 同用 |
| `PROMPT` | 自定义审查说明；`-` 表示从 stdin 读取 |
| `--strict-config` | `config.toml` 含本版本不认识的字段时报错 |

`--uncommitted`、`--base`、`--commit` 和 `PROMPT` 互斥，并且必须指定其中之一。

`codex review` 等价于 `codex exec review`，因此遵循 `codex exec` 的规则：要求在 Git 仓库中运行，审批固定为 `never`，结果输出到 stdout，失败时以非零状态退出。`-m` 这类全局参数要写在 `review` 之前（如 `codex -m <模型> review --uncommitted`）。需要 `--json`、`-o` 等 exec 专有参数时，改用 `codex exec review`：

```bash
codex exec review --base main --json -o review.md
```

非交互模式的完整说明见 [非交互模式 codex exec](/manual/agent/codex/exec)。

## 审查使用的模型

在 `config.toml` 中设置 `review_model` 后，`/review` 和 `codex review` 都会使用它；不设置时沿用当前会话的模型。也可以只对一次运行生效：

```toml
# ~/.codex/config.toml
review_model = "gpt-6.1-sol"   # 示例
```

```bash
codex -c review_model='"gpt-6.1-sol"' review --uncommitted
```

模型的选择见 [模型与推理](/manual/agent/codex/models)。

## 在 AGENTS.md 中写审查规则

GitHub、GitLab 上的云端审查会在仓库中查找 `AGENTS.md`，并遵循其中适用的 `## Code Review Rules` 小节。全仓库通用的规则放在根目录的 `AGENTS.md`，模块专属的规则放在离代码较近的子目录 `AGENTS.md` 中，Codex 会针对每个改动文件合并根目录和更具体的规则；可以用 `###` 标题分组。本地的审查子代理同样会带上当前会话加载的 `AGENTS.md`，审查提示词还要求它按改动文件查看适用的根目录与子目录指令文件（`AGENTS.override.md`、`AGENTS.md` 及配置的备用文件名，越具体的越优先），依据这些规则提出的问题会附上规则所在文件与行号的引用。

```markdown
## Code Review Rules

### 数据库迁移

- 迁移必须可以回滚；删除列之前，必须先有一个版本停止读写该列。
  安全做法：先发布兼容版本，下一个版本再删除列。
```

写规则的建议：

- 从两三条起步，写仓库特有、后果严重的检查，并说明原因。
- 写明安全做法或例外情况，帮助 Codex 区分真问题和预期行为。
- 描述结果而不是容易改名的函数名，并把规则放在它约束的代码附近。
- 格式、lint 等确定性检查交给 CI；审查规则不能代替测试、分支保护和必需的审批。

`AGENTS.md` 的完整写法见 [AGENTS.md 项目指令](/manual/agent/codex/agents-md)。

## GitHub 上的 `@codex review`

前提：仓库已经配置 Codex Cloud，并在 Codex 设置的 Code review 页面为该仓库打开 **Code review**。

| 在 PR 评论中写 | 效果 |
| --- | --- |
| `@codex review` | Codex 先加一个表情回应，再像队友一样发布一条标准的 GitHub review；只标出 P0、P1 问题 |
| `@codex review for <关注点>` | 本次审查额外关注指定方面，例如数据库迁移 |
| `@codex security review` | 请求更深入的安全审查（研究预览），完整报告在对应 Codex 任务的 Security Report 标签页 |
| `@codex fix the P1 issue` | 以该 PR 为上下文启动云端任务修复问题，有权限时把修复推送到 PR 分支 |
| `@codex` 加其他内容 | 以该 PR 为上下文启动一个云端任务 |

在设置中打开 **Automatic reviews** 后，每个新开的待审 PR 都会自动审查，不需要评论触发。Codex 没有反应时，检查仓库是否打开了 Code review、是否配置了 Codex Cloud，以及触发词是否写成 `@codex review`。

## GitLab 上的 `@codex review`（Beta）

在 MR 评论中写 `@codex review` 即可请求审查，Codex 会在 MR 上发布讨论和评论。手动请求的审查默认可以包含 P0 到 P2 的问题，自动审查只关注 P0 和 P1；自动审查可以选择在 MR 打开时、每次推送时或按 Smart Trigger（实验）触发。修复问题或执行其他任务需要为项目配置环境，只开启群组级活动时仅能审查。连接与设置见 [Codex Cloud、GitHub 与 IDE](/manual/agent/codex/cloud-integrations)。
