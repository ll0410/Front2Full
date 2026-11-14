---
title: "SDK 与 App Server"
description: "用 TypeScript 或 Python SDK 编程控制 Codex，codex app-server 的传输方式、协议与主要方法，守护进程、codex remote-control 与 Codex Remote，codex mcp-server 移除后的迁移，以及实验性的 exec-server。"
source: "https://daiw.org/manual/codex/sdk-app-server"
---

# SDK 与 App Server

> 用 TypeScript 或 Python SDK 编程控制 Codex，codex app-server 的传输方式、协议与主要方法，守护进程、codex remote-control 与 Codex Remote，codex mcp-server 移除后的迁移，以及实验性的 exec-server。

除了在终端里交互，Codex 还提供两层编程接口：**Codex SDK**（TypeScript、Python）适合在 CI/CD、脚本或自己的工具里自动执行编码任务；**App Server**（`codex app-server`）面向需要认证、会话历史、审批和流式事件的深度集成，VS Code 扩展就基于它。App Server 目前是实验性的，官方不支持用于生产负载。

## TypeScript SDK

在服务端使用，需要 Node.js 18 或更高版本：

```bash
npm install @openai/codex-sdk
```

SDK 会启动 `codex` CLI（`codex exec --experimental-json`），通过 stdin 和 stdout 交换 JSONL 事件；默认使用 `@openai/codex` 包里对应平台的二进制，也可以用 `codexPathOverride` 指定。

```ts
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread({ workingDirectory: "/path/to/project" });

const turn = await thread.run("找出 CI 失败的原因，先给出修复计划");
console.log(turn.finalResponse);
await thread.run("按计划实施修复"); // 在同一个 thread 上继续

// 需要实时进度时用 runStreamed()
const { events } = await thread.runStreamed("诊断测试失败");
for await (const event of events) {
  if (event.type === "item.completed") console.log(event.item);
}

// 按 ID 恢复之前的 thread（保存在 ~/.codex/sessions）
const resumed = codex.resumeThread(process.env.CODEX_THREAD_ID!);
```

- `run()` 等整轮结束才返回 `items`、`finalResponse` 和 `usage`；第二个参数可以传 `outputSchema`（按 JSON Schema 输出）和 `signal`（取消本轮）。
- 流式事件有 `thread.started`、`turn.started`、`turn.completed`、`turn.failed`、`item.started`、`item.updated`、`item.completed` 和 `error`。
- `startThread()` 的常用选项：`model`、`modelReasoningEffort`、`sandboxMode`（`read-only`、`workspace-write`、`danger-full-access`）、`approvalPolicy`（`never`、`on-request`、`on-failure`、`untrusted`）、`workingDirectory`、`skipGitRepoCheck`（跳过“必须是 Git 仓库”的检查）、`networkAccessEnabled`、`webSearchMode`、`additionalDirectories`、`cyberAccessProgram`（v0.161.0 起支持传入 `"standard"`、`"daybreak_blue"` 或 `"daybreak_red"`）。
- `new Codex()` 还接受 `apiKey`、`baseUrl`、`env`（传给 CLI 的全部环境变量，提供后不再继承 `process.env`）、`config`（JSON 对象，展平成 `--config key=value`）和 `configOverrides`（原样传入的 TOML 覆盖项）。

## Python SDK

需要 Python 3.10 或更高版本；`pip install openai-codex` 安装当前稳定版，加 `--pre` 选用预发布版。Python SDK 通过 JSON-RPC 控制本地的 `codex app-server`，发布的版本自带固定版本的 Codex CLI 运行时依赖，只有想换成某个本地可执行文件时才需要 `CodexConfig(codex_bin=...)`。已有的 Codex 登录会被复用，也可以调用 `login_chatgpt()`、`login_chatgpt_device_code()` 或 `login_api_key()` 登录。

```python
from openai_codex import Codex, Sandbox

with Codex() as codex:
    thread = codex.thread_start(sandbox=Sandbox.workspace_write)
    result = thread.run("用三条要点介绍这个仓库。")
    print(result.final_response)

    # 给某一轮单独收紧文件系统权限，之后的轮次也沿用
    thread.run("只评审 diff，不要修改文件。", sandbox=Sandbox.read_only)
```

- 异步应用改用 `AsyncCodex`（配合 `async with` 与 `await`）；`run()` 返回 `TurnResult`，包含 `final_response`、`items`、`usage` 等字段。
- `sandbox` 可选 `Sandbox.read_only`、`Sandbox.workspace_write`、`Sandbox.full_access`，不传时用 app server 配置的默认值。
- `approval_mode` 默认是 `ApprovalMode.auto_review`（需要提权的请求交给自动审批审查），`ApprovalMode.deny_all` 则一律不批准。

## App Server

### 启动与传输

```bash
codex app-server                                # 默认：stdio 上的 JSONL，每行一条消息
codex app-server --listen ws://127.0.0.1:4500   # WebSocket，每个文本帧一条消息
codex app-server --listen unix://               # Codex 默认的 Unix socket
```

| 参数 | 说明 |
| --- | --- |
| `--listen URL` | `stdio://`（默认）、`unix://`、`unix://PATH`、`ws://IP:PORT` 或 `off`；`--stdio` 等同于 `--listen stdio://` |
| `--ws-auth MODE` | `capability-token`：配 `--ws-token-file`（token 文件）或 `--ws-token-sha256`（token 的 SHA-256 十六进制摘要），二选一；`signed-bearer-token`：配 `--ws-shared-secret-file`（HS256 共享密钥，至少 32 字节），可再用 `--ws-issuer`、`--ws-audience`、`--ws-max-clock-skew-seconds`（默认 30 秒）校验 JWT。文件路径必须是绝对路径 |
| `--code-mode-host URL` | 连接远程 Code Mode host，而不是在本地启动一个 |
| `--strict-config` | `config.toml` 里有本版本不认识的字段时报错 |
| `--analytics-default-enabled` | `config.toml` 没有设 `analytics.enabled` 时也导出统计指标（不带这个参数时独立启动的 app server 默认不导出）；VS Code 扩展与本机后台守护进程（v0.161.0 起）启动 app server 时会带上它。它只管指标：产品分析事件在 app server 里默认就会上报（登录后），要把两者都关掉，设 `analytics.enabled = false` |

WebSocket 传输是实验性的：监听非回环地址（如 `ws://0.0.0.0:4500`）时必须配置 `--ws-auth`，否则 app server 拒绝启动（官方文档仍写着“目前默认允许未认证连接”，以源码为准）。客户端在 WebSocket 握手时用 `Authorization: Bearer <token>` 出示凭据，校验在 `initialize` 之前完成；客户端用 `wss://` 连接时由 TLS 终止代理负责加密，明文 `ws://` 只用于本机或 SSH 端口转发。

同一端口还提供 `/readyz`、`/healthz` 两个健康检查，带 `Origin` 请求头的请求一律返回 403。请求队列满时返回错误码 `-32001`。`codex app-server generate-ts --out DIR` 和 `generate-json-schema --out DIR` 生成与当前版本对应的类型定义（加 `--experimental` 包含实验性部分）。

TUI 可以直接连接 app server，如 `codex --remote ws://127.0.0.1:4500`；非本地连接时把 bearer token 放进环境变量，用 `--remote-auth-token-env` 只传变量名（只能配合 `wss://` 或回环地址的 `ws://`）。

### 协议概要

协议是双向的 JSON-RPC 2.0，只是线上省略了 `"jsonrpc": "2.0"` 字段；通知不带 `id`：

```json
{ "method": "thread/start", "id": 10, "params": { "model": "gpt-6.1-sol" } }
{ "id": 10, "result": { "thread": { "id": "thr_123" } } }
{ "method": "turn/started", "params": { "turn": { "id": "turn_456" } } }
```

1. 每个连接先发 `initialize`（用 `clientInfo` 标明客户端），再发 `initialized` 通知，握手之前的请求一律返回 `Not initialized`；
2. 用 `thread/start` 新建线程，或用 `thread/resume`、`thread/fork` 继续或分叉已有线程（v0.165.0 起实验 API 支持创建挂载在父线程下的 attached thread fork）；
3. 用 `turn/start` 发起一轮，带上 `threadId` 和用户输入，可以覆盖模型、`cwd`、沙箱策略等；
4. 持续读取通知直到 `turn/completed`，中途可以用 `turn/steer` 追加输入、用 `turn/interrupt` 取消。

线程（thread）由多轮（turn）组成，每轮包含若干条目（item）。实验性的方法和字段要在 `initialize` 时声明 `capabilities.experimentalApi: true` 才能使用。v0.156.0 删除了已弃用的 `thread/rollback`，回退线程历史改用 `thread/revert`（TUI 编辑之前的提示词时用的就是它；只支持分页历史的线程，临时线程不支持）；v0.157.0 新增 `account/gatewayOAuth/read`、`login`、`cancel` 等方法，供需要自己控制模型网关登录时机的客户端使用。

v0.158.0 起的协议变化：`codexErrorInfo` 新增 `flexUnavailable`（Flex 档位容量不足，本轮直接结束、不再重试），套餐类型 `PlanType` 新增 `promax`，插件摘要 `PluginSummary` 删除了 `extensions` 字段；命令进程根本没能启动时，也会发出这条命令的 `item/started` 与 `item/completed`（退出码 `-1`，附带启动失败的诊断），完成通知里的汇总输出也包含订阅开始之前就已产生的输出。v0.166.0 起，`thread/queue/add` 支持在目标线程尚未加载时先从磁盘恢复再排队消息（对应 `codex queue --resume`），`thread/unarchive` 在恢复父会话时会一并恢复随它归档的派生子代理线程。Python SDK 的生成类型随之更新。

| 分类 | 主要方法 |
| --- | --- |
| 线程与轮次 | `thread/start`、`thread/resume`、`thread/fork`、`thread/read`、`thread/list`、`thread/archive`、`turn/start`、`turn/steer`、`turn/interrupt`、`review/start` |
| 执行命令 | `command/exec`（在服务端沙箱里跑单条命令）、`thread/shellCommand`（用户发起，在沙箱外以完全权限运行） |
| 配置与扩展 | `model/list`、`config/read`、`config/value/write`、`skills/list`、`mcpServerStatus/list`、`account/read` |
| 服务端通知 | `turn/started`、`turn/completed`、`turn/diff/updated`、`item/started`、`item/completed`、`item/agentMessage/delta` |
| 需要客户端答复 | `item/commandExecution/requestApproval`、`item/fileChange/requestApproval`、`item/permissions/requestApproval`、`item/tool/requestUserInput`、`mcpServer/elicitation/request` |

## 守护进程、remote-control 与 Codex Remote

`codex app-server daemon` 在后台运行一个共享的 app server（TUI 里称为 background server，即后台服务），本机的 TUI 会话、`codex agents`（见[子代理](/manual/agent/codex/subagents)）与 `codex queue` 都通过它共享任务。子命令有 `start`（幂等）、`restart`（v0.163.0 起提供幂等重启）、`stop`、`version`、`update`（v0.155.0 起）、`enable-remote-control`、`disable-remote-control`，以及面向 SSH 场景的 `bootstrap --remote-control`。每个命令输出一个 JSON 对象，状态保存在 `CODEX_HOME/app-server-daemon/`（v0.164.0 起守护进程日志文件有容量上限，长期运行不会无限膨胀）；v0.154.0 起 Windows 也能运行守护进程，需要在非管理员终端里启动。

守护进程监听的是 `CODEX_HOME/app-server-control/app-server-control.sock`，也就是 `--listen unix://` 的默认 socket。`codex app-server proxy` 把自己的标准输入输出原样转接到这个 socket（`--sock PATH` 可以另行指定），只能拉起子进程、通过 stdio 通信的客户端可以借它连上守护进程；转发的是原始字节，客户端仍要像直接连 Unix socket 那样先完成 WebSocket 握手。

### 交互式启动与后台服务

v0.157.0 起功能开关 `daemon_auto_start` 默认开启，交互式启动 `codex`（包括 `codex resume`、`codex fork`）时会自动拉起并连接这个共享服务：

- 以下情况本次改用内嵌服务，并在界面上说明原因：`--oss`、`--profile`、大多数 `-c`、`--enable`、`--disable`、`--search` 配置覆盖、`--strict-config`、`--dangerously-bypass-hook-trust`、设置了环境变量 `CODEX_EXEC_SERVER_URL`、workload identity 生效，以及初次登录时走 Amazon Bedrock 或 Google Cloud Vertex AI 设置向导。加了 `--no-daemon` 则直接跳过，不给提示。
- 自动启动或连接失败时，不会悄悄退回内嵌服务，而是报错并提示用同样的命令（包括 `resume`、`fork` 及其参数）加上 `--no-daemon` 重跑。v0.158.0 起有一个例外：Windows 上的启动器（例如 `cargo run`）不允许后台进程在它退出后继续运行时，本次改用内嵌服务，并在界面上说明原因；`codex app-server daemon start` 这类显式命令遇到同样情况仍然报错，提示直接构建并运行 `codex.exe`。
- 已经运行的守护进程与这次启动要求的共享功能设置不一致时，会让你在 Run without daemon this time、Restart with these settings、Cancel 之间选择。按新设置重启会影响其他客户端，也可能打断进行中或排队的工作，所以默认选中取消。
- 在配置里设 `features.daemon_auto_start = false`，可以回到之前的做法：只在守护进程已经运行时连接它，连不上就退回内嵌服务。v0.156.0 里这项还是 `/experimental` 中默认关闭的实验功能。
- 会话中 `/status` 的 Server 一行会显示 Local background server；`/daemon` 显示守护进程的版本并提供重启（v0.163.0 起）和更新入口，见下文。

TUI 连接的守护进程或远程 app server 与 CLI 版本不同时（v0.155.0 起提示更旧的稳定版，v0.156.0 起也包括预发布版与本地构建），启动和重连时会给出提示，本机守护进程还会建议用 `/daemon` 管理；不想看到这条提示，设 `tui.show_server_version_notice = false`（不影响版本不兼容时的报错）。

### 守护进程的安装包

v0.156.0 起，守护进程使用独立的安装包目录 `CODEX_HOME/packages/app-server-daemon/current`，与你的 `codex` 命令分开，单独更新守护进程不会改动 `codex` 命令与 shell 配置：

- 还没有守护进程安装时，`start`、`restart` 与 `bootstrap` 会把当前 CLI 的完整安装包复制过去（单独的可执行文件不行），所以 `bootstrap` 不再要求独立安装版。已有的安装会被沿用，不会因为调用它的 CLI 版本不同而被悄悄替换。
- 之前启动过的旧守护进程继续使用 `CODEX_HOME/packages/standalone/current`；执行一次 `codex app-server daemon update` 会把它迁移到新目录，并且只重启原本在运行的守护进程。
- `codex app-server daemon update --from-cli` 把当前 CLI 的完整安装包复制过去并固定版本，也可以用来降级或换成本地构建；需要交互确认，脚本里加 `-y`（`--yes`）。固定之后不再自动更新，运行不带参数的 `codex app-server daemon update` 即可回到正式版。
- TUI 中的 `/daemon` 提供管理菜单：Restart background server（v0.163.0 起，对应 `daemon restart`）、Install latest public stable（对应 `daemon update`）与 Use this CLI build（对应 `daemon update --from-cli`）。选择更新后 Codex 退出，在当前终端里执行更新，完成后重新启动 Codex 即可；连接远程 app server 时不可用。

### 守护进程的自动更新与重启

跟随 `latest` 渠道的托管守护进程在 `start`、`restart` 或 `bootstrap` 时会一并拉起更新程序：启动 5 分钟后检查一次，之后默认每小时一次，装好新版本后先重启 app server。v0.155.0 起可以在 `CODEX_HOME/app-server-daemon/settings.json` 中调整：

```json
{
  "remoteControlEnabled": false,
  "shutdownGraceSeconds": 60,
  "updater": { "autoUpdateEnabled": false, "updateIntervalMinutes": 120 }
}
```

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `updater.autoUpdateEnabled` | `true` | 设为 `false` 关闭自动更新，`daemon restart` 后生效；不影响手动的 `codex update` 与 `daemon update` |
| `updater.updateIntervalMinutes` | `60` | 两次检查之间的分钟数，须为正整数，下一次等待时生效 |
| `shutdownGraceSeconds` | `60` | 停止、重启（包括更新引起的重启）时等待 app server 正常退出的秒数，取 0～300，超时后强制结束；`0` 表示请求退出后立即强制结束 |

- `codex app-server daemon update` 立即选用当前稳定版，关闭了自动更新也照样执行。v0.156.0 起它还能让固定了版本或装着本地安装包的守护进程回到正式版更新（自动更新的开关保持原样），并顺带把旧的独立安装迁移到新目录。JSON 输出的状态是 `updated`、`noUpdate` 或 `unsupported`；正在运行的守护进程会重启，进行中或排队的工作可能被打断，已经停止的则保持停止。
- 用 `CODEX_RELEASE` 指定版本安装时不会自动更新；v0.155.0 之前用安装脚本装的，要重新用 `latest` 安装一次才会启用自动更新。
- 托管守护进程重启（`daemon restart` 或更新触发的重启）后，会在后台恢复重启前已加载的线程，进行中的目标（goal）不必等客户端重新连接就能继续；先 `stop` 再 `start` 则不会恢复。

`codex remote-control`（实验性）在前台运行开启了远程控制的 app server，按 Ctrl-C 停止；`start`、`stop` 启停对应的守护进程，`pair` 打印一个短时有效的手动配对码，都支持 `--json`。这组命令供托管的远程控制客户端和 SSH 远程工作流使用，自己开发协议客户端时用 `codex app-server --listen`。

**Codex Remote** 让你在手机的 ChatGPT 应用里发起、跟进、审批和审查任务，任务运行在已连接的 Mac 或 Windows 电脑上，沿用那台电脑的项目、凭据、MCP 与沙箱设置。设置要在电脑的 ChatGPT 桌面应用里完成（Settings > Connections > Control this Mac or PC，再用手机扫码），不能从 CLI 发起。桌面应用通过 SSH 连接远程项目时，会用远程用户的登录 shell 启动 app server，所以远程主机的 `PATH` 里要能找到 `codex`。

## 从 codex mcp-server 迁移

v0.154.0 删除了已弃用的 `codex mcp-server` 命令和独立的 `codex-mcp-server` 二进制，依赖它们的集成要先迁移再升级：把 Codex 当作 MCP 服务器调用的，改为启动 `codex app-server`，按上文的 `thread/start`、`turn/start` 流程对接；只是在 CI 或脚本里驱动 Codex 的，改用 SDK 或 `codex exec`。App server 用自己的 JSON-RPC 协议，不能直接替换 MCP，集成代码需要改写。让 Codex 连接外部 MCP 服务器的功能不受影响，仍然用 `codex mcp` 管理（见 [MCP 集成](/manual/agent/codex/mcp)）。

## codex exec-server（实验性）

`codex exec-server` 是独立的执行服务：一个启动和控制子进程、执行文件系统操作的小型 JSON-RPC 服务器，用于把命令执行放到远程环境里，一般用户用不到。`--listen` 支持 `ws://IP:PORT` 和 `stdio`，默认 `ws://127.0.0.1:0`（本机回环上的随机端口，启动后把实际地址打印到标准输出）；`--remote URL --environment-id ID` 把本机注册为远程执行环境（默认经 Noise 中继加密通信），`forward --connect URL` 把已有的 exec-server 注册为远程环境并转发流量。远程注册默认使用 `codex login` 的登录态，也可以用 `CODEX_API_KEY`，或加 `--use-agent-identity-auth` 改用 `CODEX_ACCESS_TOKEN` 里的 Agent Identity。

v0.158.0 起：

- 直接的 WebSocket 监听可以要求鉴权，参数就是 `codex app-server` 的那组 `--ws-auth`（capability token 或签名的 JWT），客户端每次连接都要带 `Authorization: Bearer <token>`，缺少或无效时返回 HTTP 401。这组参数不能与 `stdio` 监听、`--remote` 或 `forward` 同时使用。不配置时 exec-server 仍接受未认证连接，非回环地址也一样，对外开放前应加鉴权或放在受保护的通道、TLS 代理之后。
- app server 连接执行端时也能带 bearer token：实验性方法 `environment/add` 新增 `authBearerToken`，`CODEX_HOME/environments.toml` 里带 `url` 的条目新增 `auth_bearer_token`。token 在初次连接和每次重连时作为 `Authorization: Bearer` 请求头发送，不会自动刷新；只允许发往 `wss://` 或回环地址，日志里会被隐去。
- `--linux-sandbox-pid-namespace isolate|inherit`（默认 `isolate`）：`inherit` 让 Linux 沙箱沿用调用方的 PID 命名空间与 `/proc`，用于容器不允许重新挂载 `/proc`、沙箱内外进程号对不上的情况。代价是沙箱里的命令可以向同一用户的其他进程（包括 exec-server 自己）发信号，只应在专用环境里使用，也只能在命令行上指定。
