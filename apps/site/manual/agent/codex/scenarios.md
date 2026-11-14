---
title: "常见使用场景"
description: "从初次运行到 CI、代码审查、MCP 与本地模型的实操套路"
source: "https://daiw.org/manual/codex/scenarios"
---

# 常见使用场景

> 从初次运行到 CI、代码审查、MCP 与本地模型的实操套路

下面是日常高频使用的一批用法，命令可直接照搬，提示词按项目实际情况替换。每个场景末尾都给出了详细说明所在的页面。

## 在仓库里初次运行

```bash
cd /path/to/repo
codex
```

初次运行会先引导登录。当前目录还没有信任记录时，Codex 会询问是否信任这个文件夹（在 Git 仓库的子目录里启动时，信任记在仓库根目录上）：选 Trust and continue 后决定会保存下来，此后在这里默认使用 Auto 预设（工作区内可写，越界时询问）；不信任就不会在这里开始会话。已标记为不受信任的目录以受限方式打开，其中的项目配置、hooks 与命令规则不会加载。进入会话后先执行：

```text
/init
/status
/config
```

`/init` 在当前目录生成 `AGENTS.md` 骨架，补上项目约定后提交，之后的会话都会读取它；`/status` 显示当前模型、审批策略、可写目录和上下文用量；`/config`（v0.162.0 起）打开交互式设置面板调整界面与行为选项；还可以用 `/presets`（v0.164.0 起）把高频提示词或斜杠命令存到 `0`～`9` 数字键位，之后按 `Ctrl+X 0..9` 一键触发。开始任务前后各做一次 Git 提交，方便回滚。详见 [AGENTS.md 项目指令](/manual/agent/codex/agents-md)、[沙箱、审批与安全](/manual/agent/codex/sandbox-approvals)。

## 只读探索陌生代码

```bash
codex --sandbox read-only --ask-for-approval on-request
```

```text
给我讲讲这个项目的整体结构和主要模块
@src/auth 这里的 token 刷新是怎么实现的？
```

只读沙箱下，Codex 可以读文件、在沙箱内运行命令，但不能修改文件，越界的操作会先请求批准。输入 `@` 可搜索工作区文件并把路径插入提示词。会话中也可以用 `/permissions` 切到 Read Only，或用 `/plan` 让它先给出计划再动手。

## 在沙箱里放手让它改

```bash
codex --sandbox workspace-write --ask-for-approval on-request
```

这就是 Auto 预设：Codex 可以在工作区内读写文件、运行命令，只有编辑工作区外的文件或访问网络时才会询问。常用的调整：

- 需要额外的可写目录：加 `--add-dir ../shared-lib`，比直接放开到 `danger-full-access` 安全。
- 需要联网安装依赖：加 `-c sandbox_workspace_write.network_access=true`。
- 不想逐条批准：加 `--approve-for-me`，把审批请求交给自动审查 agent，但不扩大文件与网络权限。
- 完成后用 `/diff` 查看改动（含未跟踪的文件），满意再提交。

工作区里的 `.git`、`.codex`、`.agents` 目录仍是只读的，因此 `git commit` 这类命令可能仍需批准，可以用规则单独放行。详见[沙箱、审批与安全](/manual/agent/codex/sandbox-approvals)、[命令规则 Rules](/manual/agent/codex/rules)。

## 给截图让它修 UI

```bash
codex -i screenshot.png "按钮在窄屏下错位了，找出原因并做小幅修改"
codex --image before.png,after.png "对比两张截图，列出样式回归"
```

多张图片用逗号分隔或重复 `--image`，支持 PNG、JPEG 等常见格式；在交互会话里也可以直接把图片粘贴进输入框。详见[启动命令行选项](/manual/agent/codex/cli-flags)。

## 在 CI 里用 codex exec

```bash
codex exec --sandbox workspace-write "修复 lint 错误并确保测试通过"

# stdout 输出 JSONL 事件流，最终回复另存一份
codex exec --json -o summary.md "总结这次改动的风险" > events.jsonl
```

- `codex exec` 不弹审批；沙箱默认取决于信任记录：CI 里新检出、没有信任记录的仓库默认只读，`config.toml` 里有信任记录的项目默认 `workspace-write`。运行进度打印到 stderr，只有最终回复写到 stdout。
- 用 API key 认证时写成 `CODEX_API_KEY=... codex exec ...`，只对这一条命令设置，不要设成整个 job 的环境变量。
- 不在 Git 仓库里运行需加 `--skip-git-repo-check`；不想保存会话文件用 `--ephemeral`；需要结构化结果用 `--output-schema schema.json`。
- GitHub Actions 中优先使用官方的 `openai/codex-action@v1`，它通过代理避免把 API key 暴露给其他步骤。

详见[非交互模式 codex exec](/manual/agent/codex/exec)。

## 把命令输出交给 Codex 分析

```bash
npm test 2>&1 | codex exec "总结失败的测试，并给出可能性较高的小幅修复"
tail -n 200 app.log | codex exec "找出可能性较高的根因" > triage.md
cat prompt.txt | codex exec -
```

同时提供提示词参数和管道输入时，管道内容会作为 `<stdin>` 块附在提示词之后；省略提示词或写 `-` 时，stdin 整体就是提示词。

## 恢复或分叉会话

```bash
codex resume              # 打开选择器，默认只列当前目录的会话
codex resume --last       # 直接恢复当前目录近期一次会话
codex resume --all        # 列出所有目录的会话
codex fork --last         # 以近期一次会话为起点，分叉出新会话
codex exec resume --last "继续修复刚才发现的问题"
```

会话内对应的是 `/resume` 与 `/fork`。输入框为空时连按两次 `Esc`，可以挑一条之前的提示词，把会话回退到那里重新编辑（v0.156.0 起在原会话中回退，不再分叉；已经改动的文件不会还原）。恢复时如果当前目录与会话记录的目录不同，Codex 会询问使用哪一个。详见[会话管理](/manual/agent/codex/sessions)。

## 提交前让它审查

在交互会话中输入 `/review`，可以选择四种审查范围：对比基础分支、未提交的改动（含暂存、未暂存与未跟踪文件）、某个提交，或自定义审查要求。Codex 会启动专门的审查者，给出按优先级排序的问题清单，且不修改工作区。脚本中用非交互版本：

```bash
codex review --uncommitted
codex review --base main
codex review --commit <SHA> --title "修复登录重定向"
```

想让审查使用与会话不同的模型，在 `config.toml` 中设置 `review_model`。详见[代码审查](/manual/agent/codex/review)。

## 接入 MCP 工具

```bash
# stdio 服务器：-- 之后是启动命令
codex mcp add context7 -- npx -y @upstash/context7-mcp

# 可流式 HTTP 服务器；支持 OAuth 的服务器再单独登录
codex mcp add docs --url https://mcp.example.com/mcp
codex mcp login docs

codex mcp list
```

配置会写入 `~/.codex/config.toml`；会话中用 `/mcp` 查看当前可用的 MCP 工具，`/mcp verbose` 还会显示服务器诊断信息。详见 [MCP 集成](/manual/agent/codex/mcp)。

## 用本地模型

```bash
codex --oss                           # 使用配置的 oss_provider，未配置时弹出选择
codex --oss --local-provider ollama   # 本次指定 Ollama
codex --oss -m <本地模型名>             # 指定具体模型
```

未指定 `-m` 时，Ollama 默认使用 `gpt-oss:20b`，LM Studio 默认使用 `openai/gpt-oss-20b`，本地没有会自动拉取。常用的话写进配置：

```toml
oss_provider = "ollama"   # 或 "lmstudio"
```

`codex exec --oss` 在既没有 `--local-provider` 也没有 `oss_provider` 时会直接报错。详见[模型与推理](/manual/agent/codex/models)。

## 需要新资料时打开实时搜索

```bash
codex --search "查一下这个库新版本的破坏性变更，然后升级依赖"
```

Codex 默认使用 OpenAI 维护的网页搜索缓存（`web_search = "cached"`），`--search` 会切换为实时搜索（等价于 `web_search = "live"`）；在 `config.toml` 中设为 `"disabled"` 可以关闭搜索工具。网页内容一律视为不可信输入，警惕其中的提示注入。
