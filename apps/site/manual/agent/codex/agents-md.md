---
title: "AGENTS.md 项目指令"
description: "AGENTS.md 的发现与合并规则、覆盖文件、大小上限、备用文件名、如何确认实际加载的指令，以及写法建议"
source: "https://daiw.org/manual/codex/agents-md"
---

# AGENTS.md 项目指令

> AGENTS.md 的发现与合并规则、覆盖文件、大小上限、备用文件名、如何确认实际加载的指令，以及写法建议

`AGENTS.md` 是写给编码代理看的“项目说明书”，格式开放（见 [agents.md](https://agents.md)），多种工具通用。Codex 在开始工作前读取它，把全局偏好与项目规范拼成一条指令链。指令链在会话启动时构建，之后每次向模型发请求前都会再检查一遍：`CODEX_HOME` 里的全局文件每次都重新读取；项目级文件在同一会话里会缓存，只有工作目录或项目信任状态变化时才重新查找。指令有变化时，模型会收到新的完整版本，并被告知它取代之前的全部 `AGENTS.md` 指令。

## 发现与合并规则

1. **全局层**：在 `CODEX_HOME`（默认 `~/.codex`）中先找 `AGENTS.override.md`，没有或内容为空时再找 `AGENTS.md`，只取首个非空文件。
2. **项目层**：从项目根（默认是包含 `.git` 的目录）逐级走到当前目录。每一级依次尝试 `AGENTS.override.md`、`AGENTS.md` 以及 `project_doc_fallback_filenames` 中的备用名，**每个目录至多取一个文件**。找不到项目根时只检查当前目录。
3. **合并顺序**：全局文件排在开头，项目文件按从根到当前目录的顺序拼接，文件之间用空行分隔（全局与项目之间另有一个 `--- project-doc ---` 分隔标记）。离当前目录越近的文件越靠后，发生冲突时以它为准。

一个典型的布局：

```text
~/.codex/AGENTS.md                         # 全局：个人习惯
repo/AGENTS.md                             # 仓库根：团队规范
repo/services/payments/AGENTS.md           # 被同目录的 override 取代，不会加载
repo/services/payments/AGENTS.override.md  # 支付服务专用规则
```

在 `repo/services/payments` 下启动时，加载顺序为：全局 `AGENTS.md`、仓库根 `AGENTS.md`、payments 目录的 `AGENTS.override.md`。

几个容易踩坑的细节：

- 只会走到当前目录为止：当前目录之下的子目录里的 `AGENTS.md` 不会在启动时加载，也不会越过项目根继续往上找。
- 空文件（只有空白字符也算）会被跳过。但在项目层，同一目录中排在前面的候选文件只要存在就会被选中；如果它是空的 `AGENTS.override.md`，这一层就什么也不贡献，不会退回读取同目录的 `AGENTS.md`。
- `project_root_markers` 可以改变项目根的判定，例如 `[".git", ".hg"]`；设为 `[]` 则只看当前目录。这一项只从项目配置以外的各层（用户配置、profile、`-c` 覆盖、系统配置等）读取，写在项目 `.codex/config.toml` 里不影响这里的查找。
- 在用户配置中被标为 `trust_level = "untrusted"` 的项目，不会加载任何项目级 `AGENTS.md`，只保留全局指令。

## 大小上限

`project_doc_max_bytes`（默认 32768 字节，即 32 KiB）限制的是**所有项目级指令文件的总字节数**：按加载顺序累加，超出预算的那个文件会被截断，之后的文件不再加载。全局 `AGENTS.md` 不计入这个预算。设为 `0` 则完全不加载项目级指令。

指令被截断时，要么调大上限，要么把内容拆到离代码更近的子目录中：

```toml [~/.codex/config.toml]
project_doc_max_bytes = 65536
```

## 备用文件名

如果仓库里已经有别的说明文件（例如给 Claude Code 用的 `CLAUDE.md`），把它加进备用列表，Codex 就会像对待 `AGENTS.md` 一样读取：

```toml [~/.codex/config.toml]
project_doc_fallback_filenames = ["CLAUDE.md", "TEAM_GUIDE.md"]
```

此后每个目录的查找顺序是 `AGENTS.override.md`、`AGENTS.md`、`CLAUDE.md`、`TEAM_GUIDE.md`，仍然只取首个存在的文件；不在列表里的文件名一律忽略。修改配置后需重新启动 Codex 才会生效。

列表里只能写单纯的文件名。v0.156.0 起，含 `/` 的条目（在 Windows 上还有含 `\` 或 `:` 的条目），以及 `.`、`..` 会被忽略并记录警告，其余合法的文件名照常生效；这样可以避免 Codex 去探测 Windows 网络路径时顺带发出凭据。

## 覆盖文件的用途

`AGENTS.override.md` 适合在不删除原文件的前提下临时替换指令：

- 放在 `~/.codex/` 下：临时换一套全局指令，删掉 override 即恢复原来的全局文件。
- 放在某个子目录：让该目录使用完全不同的规则，例如支付服务用 `make test-payments` 而不是 `npm test`。

## 确认实际加载了哪些指令

| 方法 | 说明 |
| --- | --- |
| `/status` | “Agents.md”一行列出本会话加载的指令文件（按相对当前目录的路径显示） |
| `codex debug prompt-input` | 以 JSON 输出模型实际看到的输入列表，可直接核对指令正文 |
| 直接询问 | `codex --ask-for-approval never "Summarize the current instructions."` |
| 纯文本日志 | 用 `codex -c log_dir=./.codex-log` 启动，再查看 `./.codex-log/codex-tui.log` |

结果不符合预期时，依次检查：是否在预期的仓库和目录里启动；上层目录或 `CODEX_HOME` 中是否有遗留的 `AGENTS.override.md`；`CODEX_HOME` 是否指向了别的目录；文件是否为空，或因超出上限被截断；是否在会话进行中改过项目里的指令文件——这种情况新开一个会话才会读到新内容。

## 相关配置

| 配置 | 默认 | 作用 |
| --- | --- | --- |
| `project_doc_max_bytes` | `32768` | 项目级指令的总字节上限 |
| `project_doc_fallback_filenames` | `[]` | 备用文件名列表 |
| `project_root_markers` | `[".git"]` | 判定项目根的标记 |
| `developer_instructions` | — | 以开发者消息形式额外注入的指令 |
| `model_instructions_file` | — | 替换模型的内置指令（与 `AGENTS.md` 无关），官方明确不推荐 |

全局目录由环境变量 `CODEX_HOME` 决定，详见[配置文件](/manual/agent/codex/configuration)。

## 用 `/init` 起草

在项目根启动 Codex 后输入 `/init`，它会为当前项目生成一份 `AGENTS.md` 初稿，再按需修改即可。

## 写法建议

- 写“新人初次接手这个仓库需要知道的事”：构建、测试与 lint 命令，目录约定，代码风格，提交规范。
- 优先写可执行的具体指令（如“修改 JavaScript 文件后运行 `npm test`”），少写空泛原则。
- 全局文件放个人习惯，仓库根放团队共识，子目录放局部例外，越靠近代码越具体。
- 控制篇幅：总量受 `project_doc_max_bytes` 限制，冗长的文件也会占用上下文。
- GitHub 上的 Codex 代码审查会参考 `AGENTS.md` 中的 `## Code Review Rules` 小节，可把审查要点写在离相关代码较近的文件里，详见[代码审查](/manual/agent/codex/review)。
- 不要写入密钥等敏感信息。`AGENTS.md` 只是指导而非强制，需要“无论如何都拦住”的限制，请用沙箱、[rules](/manual/agent/codex/rules) 或 [hooks](/manual/agent/codex/hooks)。
