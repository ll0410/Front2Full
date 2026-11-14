---
title: "会话管理"
description: "会话记录的存储位置，resume、fork、archive、delete、queue 等子命令，以及相关斜杠命令与配置"
source: "https://daiw.org/manual/codex/sessions"
---

# 会话管理

> 会话记录的存储位置，resume、fork、archive、delete、queue 等子命令，以及相关斜杠命令与配置

Codex 把每一次对话保存为一个会话（也称线程），用 UUID 标识，也可以用 `/rename` 起名字。大多数会话命令既接受 UUID，也接受会话名称；能解析为 UUID 时优先按 UUID 处理。

## 会话存在哪里

`$CODEX_HOME` 默认是 `~/.codex`。

| 位置 | 内容 |
| --- | --- |
| `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-<时间戳>-<会话ID>.jsonl` | 每个会话的完整记录（rollout），恢复和派生都从这里读取 |
| `$CODEX_HOME/archived_sessions/` | 已归档会话的记录 |
| `$CODEX_HOME/history.jsonl` | 输入过的提示词，每行含 `session_id`、`ts`、`text`，供 `Up` 和 `Ctrl+R` 翻找 |
| SQLite 状态库 | 会话列表元数据（`state_5.sqlite`）、分页线程历史（`thread_history_1.sqlite`）等运行时状态；目录由 `sqlite_home` 配置（优先）或 `CODEX_SQLITE_HOME` 环境变量指定，默认就是 `$CODEX_HOME` |

`codex exec --ephemeral` 不写会话记录，这类运行之后无法恢复。

## 恢复会话 `codex resume`

```bash
codex resume                          # 打开会话选择器，默认只列当前目录的交互式会话
codex resume --last                   # 直接恢复当前目录最近的会话
codex resume --all                    # 列出所有目录的会话，并显示 CWD 列
codex resume 0199a213-81c0-7800-8aa1-bbab2a035a53
codex resume --last "接着把测试补上"   # 恢复后立即发送一条消息
```

| 参数 | 说明 |
| --- | --- |
| `SESSION_ID` | 会话 UUID 或名称；省略时打开选择器 |
| `--last` | 跳过选择器，恢复当前目录近期的会话；此时首个位置参数被当作 `PROMPT` |
| `--all` | 不按当前目录过滤 |
| `--include-non-interactive` | 选择器和 `--last` 也纳入由 `codex exec`、app-server 创建的非交互会话 |
| `--remote <ADDR>`、`--remote-auth-token-env <ENV_VAR>` | 连接远程 app-server |
| 其他 | 接受 `codex` 的全部交互参数（`-m`、`-s`、`-a`、`-C`、`--no-daemon` 等）和 `PROMPT` |

按当前目录过滤时，会把同一仓库的主检出和其他托管 Git worktree 中对应的目录算进来（`worktrees` 自 v0.165.0 起已固化为常驻开启，不再需要功能开关）；v0.165.0 起会话选择器还支持按仓库筛选。v0.167.0 起，你可以在会话选择器里直接切换所连接的后端服务并保留输入框草稿；其他模型提供方下保存的对话也会继续显示，方便切回原提供方恢复，而无法直接恢复的旧对话则支持带可编辑提示词继续跟进。当前目录与会话保存的目录不同时，Codex 会询问使用哪一个。把 `tui.resume_cwd` 设为 `"current"` 或 `"session"` 可以固定选择、不再询问；显式的 `-C`/`--cd` 优先于该设置。

## 派生会话 `codex fork`

把一个已保存的会话复制成新会话（新 ID），原会话保持不变，适合从某个节点尝试另一种做法。

| 参数 | 说明 |
| --- | --- |
| `SESSION_ID` | 要派生的会话 UUID 或名称；省略时打开选择器 |
| `--last` | 跳过选择器，派生当前目录近期的会话；此时首个位置参数被当作 `PROMPT` |
| `--all` | 不按当前目录过滤 |
| `--worktree` | 在新的 worktree 中运行派生出的会话，必须显式给出 `SESSION_ID` |

`codex fork` 同样接受交互参数，目录选择规则与 `codex resume` 相同。在会话内派生当前对话用 `/fork`（或在代理总览中对选中会话按 `f`，v0.161.0 起），非交互场景用 `codex exec fork`（见 [非交互模式](/manual/agent/codex/exec)）。

## 归档与删除

```bash
codex archive <SESSION>              # 从活跃列表中隐藏，记录保留
codex unarchive <SESSION>            # 恢复已归档的会话
codex delete <SESSION>               # 永久删除，会先要求确认
codex delete <SESSION_UUID> --force  # 跳过确认，只接受 UUID
```

- 按名称查找时，`archive` 只在活跃会话中找，`unarchive` 只在已归档会话中找，`delete` 两者都找；按名称只能匹配交互式会话，且同名会话不止一个时会报错；遇到这两种情况请改用 UUID。
- v0.166.0 起，`unarchive` 在恢复父会话时会一并恢复随它归档的派生子代理线程。
- `delete` 不可撤销，由该会话派生的子代理线程会一并删除。确认步骤需要交互式终端，在脚本里只能用 `--force` 加 UUID。
- 这三个命令都接受 `--remote`、`--remote-auth-token-env`，以及 `-c`、`-p` 等配置参数；v0.156.0 起还可以在子命令之前加 `--no-daemon`（如 `codex --no-daemon archive <SESSION>`），不经过共享的后台服务直接操作（不能与 `--remote` 同用）。

## 给会话排队消息 `codex queue`

```bash
codex queue --thread <会话ID或名称> --message "完成后顺便更新 CHANGELOG"
codex queue --thread <会话ID或名称> --resume --message "先加载已保存会话再排队这条消息"
```

| 参数 | 说明 |
| --- | --- |
| `--thread <THREAD>` | 会话 UUID 或精确的会话名称，只查找未归档的会话 |
| `--message <TEXT>` | 要排队的文本，不能为空；不支持图片 |
| `--resume` | 目标会话当前未加载在 app-server 内存中时，先从磁盘恢复该会话再把消息加入队列（v0.166.0 起） |

消息通过 app-server 的实验接口 `thread/queue/add` 加入该会话的队列，成功时打印 `Queued message <ID> for thread <ID>.`。命令会优先连接本机正在运行的 app-server 守护进程；带了配置覆盖参数而无法复用守护进程时会报错，此时去掉这些参数或改用 `--remote`。它必须经由共享服务写入，所以不接受 `--no-daemon`。官方文档没有收录这个子命令。

## 浏览所有 agent 会话 `codex agents`

打开全部 agent 会话的总览（v0.156.0 起界面上称为 agent command center），与会话内的 `/agents` 相同。可用参数有 `--remote`、`--remote-auth-token-env`、`-C`/`--cd <DIR>`（在远程服务器上新建任务时使用的目录）、`--no-alt-screen`，以及 v0.167.0 起支持的 `--no-daemon`（在内嵌 app-server 模式下浏览本地会话，不再强制要求连接后台守护进程）。它不接受初始提示词或图片，workload identity 生效时不可用。在交互会话里，输入框为空时按 `←` 也能打开总览；v0.158.0 起，对话在另一个应用中打开、这里只能只读查看时，同样可以按 `←` 回到总览。总览支持直接隐藏、归档、永久删除、按 `f` 分叉（v0.161.0 起）或按 `p` 置顶（v0.162.0 起）任务，支持按状态筛选，按项目、目录（v0.165.0 起，将 worktree 归入所属仓库下）、状态或模型分组，并在后台任务产生新结果时显示未读标记（v0.167.0 起），详见[子代理](/manual/agent/codex/subagents)。

## 应用云端任务的改动 `codex apply`

```bash
codex apply <TASK_ID>    # 简写 codex a
```

取回 Codex Cloud 任务近期的 diff，用 `git apply` 应用到本地工作区；有冲突时以非零状态退出。云端任务的用法见 [Codex Cloud、GitHub 与 IDE](/manual/agent/codex/cloud-integrations)。

## 迁移旧会话 `codex migrate-rollouts`

检查旧版的本地会话，或者把它们迁移为分页的线程历史存储。默认只扫描并报告，不做任何修改。

| 参数 | 说明 |
| --- | --- |
| `--apply` | 真正执行迁移 |
| `--thread <THREAD_ID>` | 只处理指定的线程，可重复 |
| `--max-mib-per-second <MIB>` | 限制读写吞吐，单位 MiB/s，下限为 1 |
| `--json` | 输出完整的逐线程 JSON 报告 |
| `--verbose` | 每个会话打印一行结果 |

有任一会话迁移失败时以非零状态退出。官方文档没有收录这个子命令。

新建的本地会话默认就使用分页线程历史，恢复旧会话时则沿用它原来的格式；在原会话里回退（空输入框中按两次 `Esc`）等功能只支持分页格式，旧格式的会话可以先用这个命令迁移。

## 会话内的相关命令

| 命令 | 作用 |
| --- | --- |
| `/resume [ID或名称]` | 恢复已保存的会话；省略参数时打开选择器 |
| `/new [名称]`、`/clear [名称]` | 开始新对话；`/clear` 会先清屏 |
| `/fork [名称]` | 把当前对话派生为新对话 |
| `/rename [名称]` | 重命名当前会话 |
| `/archive`、`/delete` | 归档或永久删除当前会话（v0.162.0 起 `/archive` 在任务仍在运行时也可直接执行）。使用内嵌服务时两者完成后都会退出；连接本机守护进程或远程 app server 时改为回到代理总览（`/archive` 自 v0.155.0 起，`/delete` 自 v0.156.0 起） |
| `/side [问题]` | 打开侧边对话（别名 `/btw`）；v0.163.0 起切换其他线程后再次执行 `/side`（不带参数）可回到刚才的侧边对话 |
| `/export [路径]` | 把对话导出为 Markdown |
| `/agents` | 打开代理总览，查看、筛选并切换所有 agent 会话（v0.167.0 起在 `--no-daemon` 内嵌模式下也可用） |
| 空输入框中按两次 `Esc` | 浏览之前的提示词，选中后把当前会话回退到那条提示词之前重新编辑；v0.156.0 起在原会话中回退，不再分叉出新会话，文件改动不会撤销。回退只支持分页历史格式的会话，旧格式会话会报错，可先用 `codex migrate-rollouts --apply` 迁移 |

完整列表见 [斜杠命令](/manual/agent/codex/slash-commands)。

## 相关配置

| 配置项 | 说明 |
| --- | --- |
| `history.persistence` | `save-all` 或 `none`，控制是否写入 `history.jsonl` |
| `history.max_bytes` | `history.jsonl` 的大小上限，超出时丢弃较早的条目 |
| `tui.resume_cwd` | 恢复或派生会话时使用的目录：`current` 或 `session`；未设置时询问 |
| `sqlite_home` | SQLite 状态库所在的目录 |

配置文件的写法见 [配置文件 config.toml](/manual/agent/codex/configuration)，完整字段见 [配置项速查](/manual/agent/codex/config-reference)。
