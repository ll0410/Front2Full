---
title: "非交互模式 codex exec"
description: "在脚本和 CI 中运行 Codex：全部参数、默认的沙箱与审批、JSONL 事件流、结构化输出与会话恢复"
source: "https://daiw.org/manual/codex/exec"
---

# 非交互模式 codex exec

> 在脚本和 CI 中运行 Codex：全部参数、默认的沙箱与审批、JSONL 事件流、结构化输出与会话恢复

`codex exec`（简写 `codex e`）不打开交互界面，执行完一轮任务就退出。运行过程输出到 stderr，最终回复单独输出到 stdout，方便重定向或接管道。

```bash
codex exec "总结仓库结构，列出风险较高的 5 个区域"
codex exec "根据近期 10 个提交生成发布说明" | tee release-notes.md
```

## 参数

`codex exec` 专有的参数：

| 参数 | 说明 |
| --- | --- |
| `PROMPT` | 任务指令；省略或写 `-` 时从 stdin 读取 |
| `--json` | stdout 改为输出 JSONL 事件流，别名 `--experimental-json` |
| `-o`, `--output-last-message <FILE>` | 把最终回复写入文件 |
| `--output-schema <FILE>` | 用 JSON Schema 约束最终回复的结构 |
| `--color <always\|never\|auto>` | 输出的 ANSI 颜色，默认 `auto` |
| `--ephemeral` | 不把会话记录写入磁盘 |
| `--skip-git-repo-check` | 允许在 Git 仓库之外运行 |
| `--ignore-user-config` | 不加载 `$CODEX_HOME/config.toml`，认证仍使用 `CODEX_HOME` |
| `--ignore-rules` | 不加载用户层和项目层的 `.rules` 命令规则 |
| `--strict-config` | `config.toml` 含本版本不认识的字段时报错 |
| `--cyber-access-program <PROGRAM>` | 选择网络安全评估访问计划：可选 `standard`、`daybreak_blue` 或 `daybreak_red`（v0.161.0 起，v0.163.0 起新增 `daybreak_red`；需账户具备相应授权） |
| `--thread-source <SOURCE>` | 线程的来源分类（如 `user`），一般无需设置 |

与交互模式共用的参数：

| 参数 | 说明 |
| --- | --- |
| `-m`, `--model <MODEL>` | 本次使用的模型 |
| `-s`, `--sandbox <MODE>` | `read-only`、`workspace-write` 或 `danger-full-access` |
| `--approve-for-me` | 审批请求交给自动审查，沙箱用 `workspace-write`，别名 `--not-so-yolo`；与 `--sandbox`、`--yolo` 互斥 |
| `--dangerously-bypass-approvals-and-sandbox`, `--yolo` | 无沙箱、不审批，并跳过 Git 仓库检查；仅用于外部已隔离的环境 |
| `--dangerously-bypass-hook-trust` | 不要求 hooks 已被信任，仅用于已审核 hook 来源的自动化 |
| `-C`, `--cd <DIR>` | 工作根目录 |
| `--add-dir <DIR>` | 额外的可写目录，可重复 |
| `-i`, `--image <FILE>` | 给首条消息附加图片，可重复或用逗号分隔 |
| `-p`, `--profile <NAME>` | 在用户配置之上叠加 `$CODEX_HOME/<NAME>.config.toml` |
| `-c`, `--config <key=value>` | 临时覆盖配置项，可重复 |
| `--enable`、`--disable <FEATURE>` | 开关某个功能，等价于 `-c features.<name>=true` 或 `false` |
| `--oss`、`--local-provider <lmstudio\|ollama>` | 使用本地开源模型提供方 |
| `--worktree` | 在新建的托管 Git worktree 中运行（`worktrees` 功能开关自 v0.165.0 起已固化为常驻开启）；不能与 `--ephemeral`、`--ignore-user-config` 同用 |

`codex exec` 没有交互模式的 `-a` 和 `--search`；需要实时网页搜索时可以用 `-c web_search="live"`。

::: warning

官方文档仍列出 `codex exec --full-auto`（称其已弃用、会打印警告），但 v0.167.0 的源码中没有这个参数。请改用 `--sandbox workspace-write`。

:::

## 默认的沙箱与审批

- **审批**：固定以 `approval_policy = "never"` 运行，需要批准的操作直接被拒绝，失败信息返回给模型。例外是有效配置中 `approvals_reviewer = "auto_review"`（如用了 `--approve-for-me`），此时沿用配置的审批策略，由自动审查代为裁决。
- **沙箱**：依次取 `--sandbox`、配置中的 `sandbox_mode`。都没有时，`config.toml` 中有信任记录（`trust_level`）的项目默认 `workspace-write`，其他目录默认 `read-only`；未启用 Windows 沙箱的原生 Windows 一律为 `read-only`。官方文档笼统写作“默认只读”，在没有信任记录的 CI 环境中确实如此。
- **Git 检查**：默认必须在 Git 仓库内运行，否则报错退出；`--skip-git-repo-check` 或 `--yolo` 会跳过这一检查。
- **启动检查**：规则文件加载失败，或 `required = true` 的 MCP 服务器初始化失败时，直接报错退出。

需要改文件用 `--sandbox workspace-write`；`danger-full-access` 只用于隔离的容器或虚拟机，详见 [沙箱、审批与安全](/manual/agent/codex/sandbox-approvals)。

## 读取 stdin

| 用法 | 行为 |
| --- | --- |
| 给了 `PROMPT`，同时有管道输入 | `PROMPT` 是指令，stdin 的内容作为 `<stdin>` 块附在指令后面 |
| 不给 `PROMPT`，或 `PROMPT` 写 `-` | stdin 的全部内容就是指令，不能为空 |
| 不给 `PROMPT`，stdin 又是终端 | 报错退出 |

stdin 须为 UTF-8 文本（带 BOM 的 UTF-16 也能识别），其他编码会报错退出。

```bash
# 指令 + 管道数据
npm test 2>&1 | codex exec "总结失败的测试，并给出改动幅度较小的修复建议"

# stdin 就是完整指令
cat prompt.txt | codex exec -
```

## 输出与退出码

- stdout 被重定向或接管道时，只有最终回复写到 stdout，其余进度信息都在 stderr；直接在终端里运行时，最终回复和进度显示在一起。
- `-o <FILE>` 在本轮成功结束时把最终回复写入文件，stdout 照常输出；本轮失败或被中断时不写文件。
- 本轮失败、被中断，或者出现不再重试的错误时，以退出码 1 结束。

## `--json` 事件流

加上 `--json` 后，stdout 每行是一个 JSON 对象，顶层的 `type` 字段表示事件类型：

| 事件 | 说明 |
| --- | --- |
| `thread.started` | 首个事件，带 `thread_id`，之后可以用它恢复会话 |
| `turn.started` | 一轮开始 |
| `turn.completed` | 一轮完成，`usage` 中有 `input_tokens`、`cached_input_tokens`、`cache_write_input_tokens`、`output_tokens`、`reasoning_output_tokens` |
| `turn.failed` | 一轮失败，带 `error.message`；被中断的一轮既不发 `turn.completed`，也不发 `turn.failed` |
| `item.started`、`item.updated`、`item.completed` | 条目开始、更新、结束，条目内容在 `item` 字段中 |
| `error` | 错误，带 `message`；自动重试中的连接错误（如 `Reconnecting... 1/5`）也用这个事件报告，这类错误不影响退出码 |

条目的 `item.type`：

| 类型 | 主要字段 |
| --- | --- |
| `agent_message` | `text`；使用 `--output-schema` 时是一段 JSON 字符串 |
| `reasoning` | `text`，推理摘要 |
| `command_execution` | `command`、`aggregated_output`、`exit_code`、`status`（`in_progress`、`completed`、`failed`、`declined`）。v0.158.0 起，完成事件的 `aggregated_output` 不再漏掉命令刚启动时的输出；命令进程没能创建（如工作目录不存在）时也会发出这一条目，`status` 为 `failed`，`exit_code` 为 -1，`aggregated_output` 是错误信息 |
| `file_change` | `changes`（每项含 `path` 和 `kind`：`add`、`delete`、`update`）、`status`（`in_progress`、`completed`、`failed`，被拒绝的补丁也记为 `failed`）；开始处理补丁时发 `item.started`，结束时发 `item.completed`。v0.162.0 起，`apply_patch` 工具默认保留被修改文件原有的 CRLF 行尾（原开关 `apply_patch_preserve_line_endings` 已退役） |
| `mcp_tool_call` | `server`、`tool`、`arguments`、`result`、`error`、`status` |
| `collab_tool_call` | 子代理协作工具调用，`tool` 为 `spawn_agent`、`send_input`、`wait` 或 `close_agent`；另有 `receiver_thread_ids`、`prompt`、`agents_states`、`status` 等 |
| `web_search` | `query`、`action`（`type` 为 `search`、`open_page`、`find_in_page` 等，分别带查询词、`url`，或 `url` 加 `pattern`）；v0.156.0 起有结构化结果时另带 `results` |
| `todo_list` | `items`（`text`、`completed`）；计划变化时发 `item.updated`，本轮结束时发 `item.completed` |
| `error` | `message`，非致命错误与警告 |

```json
{"type":"thread.started","thread_id":"0199a213-81c0-7800-8aa1-bbab2a035a53"}
{"type":"turn.started"}
{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"bash -lc ls","aggregated_output":"","exit_code":null,"status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"仓库包含 docs、sdk 和 examples 三个目录。"}}
{"type":"turn.completed","usage":{"input_tokens":24763,"cached_input_tokens":24448,"cache_write_input_tokens":0,"output_tokens":122,"reasoning_output_tokens":0}}
```

## 结构化输出

`--output-schema` 读取一个 JSON Schema 文件（必须是合法 JSON，否则直接退出），要求模型的最终回复符合这个结构；对 `resume`、`fork` 发送的后续指令同样有效。

```json
{
  "type": "object",
  "properties": {
    "project_name": { "type": "string" },
    "programming_languages": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["project_name", "programming_languages"],
  "additionalProperties": false
}
```

```bash
codex exec "提取项目元数据" \
  --output-schema ./schema.json \
  -o ./project-metadata.json
```

## 恢复与派生会话

多阶段流水线可以接着上一次的会话继续：

```bash
codex exec "检查这次改动有没有竞态条件"
codex exec resume --last "修复你刚才发现的竞态问题"
```

| `codex exec resume` 参数 | 说明 |
| --- | --- |
| `SESSION_ID` | 会话 UUID 或名称（UUID 优先） |
| `--last` | 恢复当前目录下近期的会话（候选包括交互式会话）；此时首个位置参数被当作 `PROMPT` |
| `--all` | 不按当前目录过滤 |
| `-i`, `--image <FILE>` | 给后续指令附加图片 |
| `PROMPT` | 恢复后立即发送的指令；省略或写 `-` 时改从 stdin 读取，两者都没有就报错退出 |

`codex exec fork <SESSION_ID> [PROMPT]` 先把指定会话复制成新会话，再发送 `PROMPT`；不带 `PROMPT` 时只做派生。`SESSION_ID` 也可以是会话名称，查找时不按当前目录过滤。附带图片、`-o`、`--output-schema` 或 `--ephemeral` 时必须提供 `PROMPT`。官方文档没有列出这个子命令；它支持 `--worktree`，而 `codex exec resume` 不支持。

`codex exec review` 等价于 `codex review`，见 [代码审查](/manual/agent/codex/review)。

## 在 CI 中使用

**认证**：默认复用本机已保存的登录。CI 中推荐用 API key，并只对这一条命令设置 `CODEX_API_KEY`：

```bash
CODEX_API_KEY=<api-key> codex exec --json "分析失败的测试"
```

- 不要把 `OPENAI_API_KEY`、`CODEX_API_KEY` 设为 job 级环境变量：同一个 job 里的构建脚本、测试和依赖的生命周期钩子都能读到它们。
- GitHub Actions 推荐用官方的 `openai/codex-action`：它安装 Codex 并通过 Responses API 代理减少密钥暴露，见 [Codex Cloud、GitHub 与 IDE](/manual/agent/codex/cloud-integrations)。
- 也可以用 workload identity federation 代替长期凭据；ChatGPT Enterprise 工作区还可以只给这条命令设置 Codex access token（`CODEX_ACCESS_TOKEN`，见 [环境变量](/manual/agent/codex/environment-variables)）；或在受信任的 runner 上以 ChatGPT 账号运行（需维护 `~/.codex/auth.json`，它等同于密码，不要用于公开仓库）。

**推荐参数**：`--json` 保留机器可读的全过程，`-o` 单独拿到最终总结。

```bash
codex exec \
  --sandbox workspace-write \
  --json \
  -o codex-summary.md \
  "运行 npm test 复现失败，只做让测试通过的必要修改"
```

受控环境可再加 `--ignore-user-config`、`--ignore-rules`；在 Git 仓库外运行加 `--skip-git-repo-check`；无需事后恢复会话加 `--ephemeral`。
