---
title: "环境变量"
description: "Codex CLI 读取的环境变量，以及它注入给子进程的环境变量"
source: "https://daiw.org/manual/codex/environment-variables"
---

# 环境变量

> Codex CLI 读取的环境变量，以及它注入给子进程的环境变量

Codex 的持久设置写在 `config.toml` 里；环境变量适合按 shell 临时覆盖、传入自动化所需的密钥、控制安装脚本和诊断输出。下表以官方 Environment variables 文档为主，标注“源码”的条目是在 v0.167.0 仓库中确认、但官方文档未列出的补充项，可能随版本变化。

自定义模型提供方所用的 API key 变量名由 `model_providers.<id>.env_key` 自行指定（如 `MISTRAL_API_KEY`），不是固定的 Codex 变量，这里不列出，见[配置文件 config.toml](/manual/agent/codex/configuration)。

## 路径与状态

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `CODEX_HOME` | `~/.codex` | Codex 状态的根目录，配置、认证、日志、会话、技能以及独立安装包的元数据都在这里；CLI、IDE 扩展、app-server 与安装脚本都会读取。**设置时该目录必须已存在**，否则启动报错 |
| `CODEX_SQLITE_HOME` | 同 `CODEX_HOME` | SQLite 状态库的存放目录；配置项 `sqlite_home` 优先于它，相对路径按当前工作目录解析 |

用不同的 `CODEX_HOME` 可以让多套配置和账号并存：

```bash
mkdir -p "$HOME/.codex-work"
alias codex-work='CODEX_HOME="$HOME/.codex-work" codex'
codex-work login
```

Codex 启动时还会读取 `$CODEX_HOME/.env`（默认 `~/.codex/.env`；源码行为，官方文档未提及），把其中的变量写入自身的进程环境，与 shell 里已有的变量同名时以文件为准；名称以 `CODEX_` 开头的变量（不分大小写）一律忽略，所以 `CODEX_HOME`、`CODEX_API_KEY` 这类变量写在这里不会生效。这些变量和其他环境变量一样，会按 `shell_environment_policy` 传给模型运行的命令。

## 安装脚本

以下变量作用于 `https://chatgpt.com/codex/install.sh` 与 `install.ps1` 两个安装脚本：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `CODEX_NON_INTERACTIVE` | `false` | 设为 `1`、`true` 或 `yes` 时跳过安装提示、采用默认答案，用于脚本化安装与更新 |
| `CODEX_INSTALL_DIR` | macOS / Linux 为 `~/.local/bin`，Windows 为 `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin` | `codex` 命令的安装目录；安装包缓存仍在 `CODEX_HOME/packages/standalone` |
| `CODEX_RELEASE`（源码） | `latest` | 要安装的版本号，如 `0.167.0`；v0.155.0 起，指定版本安装后后台守护进程不再自动更新 |
| `CODEX_INSTALLER_USE_RELEASES_OPENAI_COM`（源码） | `true` | 设为 `false`、`0` 或 `no` 时只从 GitHub Releases 下载 |

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh
```

```powershell
$env:CODEX_NON_INTERACTIVE=1; irm https://chatgpt.com/codex/install.ps1 | iex
```

## 认证

| 变量 | 适用范围 | 说明 |
| --- | --- | --- |
| `CODEX_API_KEY` | `codex exec`、`codex review`、TypeScript SDK、`codex exec-server --remote` | 给非交互进程提供 API key。在会运行仓库代码的 CI 中，只对 Codex 这一条命令设置，不要设成整个 job 的环境变量 |
| `CODEX_ACCESS_TOKEN` | CLI、app-server、受信任的自动化 | 提供 ChatGPT / Codex access token；需要持久登录时用 `printenv CODEX_ACCESS_TOKEN \| codex login --with-access-token` |
| `OPENAI_API_KEY`（源码） | 交互式登录界面 | 选择 API key 登录时用它预填输入框。内置的 `openai` 提供方不会直接读取它，需要先 `codex login --with-api-key`，或在自定义提供方中用 `env_key` 引用 |
| `OPENAI_ORGANIZATION` / `OPENAI_PROJECT`（源码） | 内置 `openai` 提供方 | 设置后分别作为 `OpenAI-Organization`、`OpenAI-Project` 请求头发送 |
| `OPENAI_FEDERATION_RULE_ID` | workload identity | 选择该工作负载所用的联合规则 |
| `OPENAI_IDENTITY_TOKEN_FILE` | workload identity | 保存当前 OIDC token 或 SPIFFE JWT-SVID 的文件的绝对路径 |
| `OPENAI_WORKLOAD_IDENTITY_CONTEXT` | workload identity | 可选，提供用于审计归属的有界 JSON 标识，不影响认证与授权 |

```bash
# 只为这一次运行提供 API key
CODEX_API_KEY="$MY_KEY" codex exec --json "triage open bug reports"
```

使用内置的云平台提供方时，认证走各平台的标准环境变量：

- **Amazon Bedrock**（`model_provider = "amazon-bedrock"`）：可用 `AWS_BEARER_TOKEN_BEDROCK`（Bedrock API key）、`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` 或 `AWS_PROFILE`，并用 `AWS_REGION` 指定区域。
- **Google Cloud Vertex AI**（`model_provider = "gcp"`，v0.165.0 起）：可用 `GOOGLE_CLOUD_PROJECT`（项目 ID）、`GOOGLE_CLOUD_LOCATION`（区域，默认 `global`）与 `GOOGLE_APPLICATION_CREDENTIALS`（ADC 凭据 JSON 文件路径）。

## 网络与证书

| 变量 | 说明 |
| --- | --- |
| `CODEX_CA_CERTIFICATE` | 指向 PEM 格式的 CA 证书包，用于公司 TLS 拦截代理或私有根证书；登录、普通 HTTPS 请求与安全 WebSocket 连接都使用它，优先于 `SSL_CERT_FILE` |
| `SSL_CERT_FILE` | 未设置 `CODEX_CA_CERTIFICATE` 时使用的 CA 证书包 |
| `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY` / `NO_PROXY`（源码） | Codex 自身的出站请求默认沿用 HTTP 客户端库 reqwest 的代理行为，会读取这些标准代理变量；`codex doctor` 会报告它们的设置情况。v0.156.0 起，登录与启动阶段的账户发现、云端配置等请求直连失败时，还会改走操作系统设置的代理重试（功能开关 `system_proxy_fallback`，默认开启）；v0.167.0 起另提供实验开关 `respect_system_proxy` |

## 本地模型（实验性）

| 变量 | 说明 |
| --- | --- |
| `CODEX_OSS_BASE_URL`（源码） | `--oss` 模式下本地提供方的完整 base URL，默认 `http://localhost:<端口>/v1` |
| `CODEX_OSS_PORT`（源码） | 只改端口，默认 Ollama 为 `11434`、LM Studio 为 `1234` |

源码注释说明这两个变量属于实验性质，将来可能改为从 `config.toml` 读取。

## 执行环境（实验性）

| 变量 | 说明 |
| --- | --- |
| `CODEX_EXEC_SERVER_URL`（源码） | 让模型的命令与文件操作在指定的 exec-server 上执行（如 `ws://127.0.0.1:4501`，服务端用 `codex exec-server` 启动）；设为 `none` 时不提供 shell 与文件系统工具。设置了它的交互式启动不会连接或自动启动共享的后台服务，以免丢掉这里指定的执行环境 |

## 日志与诊断

| 变量 | 说明 |
| --- | --- |
| `RUST_LOG` | CLI 与 app-server 的日志过滤，如 `error`、`warn`、`info`、`debug`、`trace`，也可以写 `codex_core=debug,codex_tui=debug` 这样的定向过滤；`codex exec` 默认为 `error` |
| `CODEX_TUI_RECORD_SESSION`（源码） | 设为 `1`、`true` 或 `yes` 时把 TUI 会话事件记录为 JSONL，默认写到日志目录下的 `session-<时间戳>.jsonl` |
| `CODEX_TUI_SESSION_LOG_PATH`（源码） | 配合上一项，指定记录文件的路径 |
| `CODEX_TUI_DISABLE_KEYBOARD_ENHANCEMENT`（源码） | 设为 `1`、`true` 或 `yes` 关闭终端的键盘增强协议，设为 `0`、`false` 或 `no` 强制开启；未设置时，只在 WSL 中判断为（或无法排除是）VS Code 终端时自动关闭 |

交互模式默认把诊断信息记录在有容量上限的本地存储中，纯文本日志 `codex-tui.log` 需要显式设置 `log_dir`（默认 `$CODEX_HOME/log`）才会生成：

```bash
RUST_LOG=debug codex -c log_dir=./.codex-log
tail -F ./.codex-log/codex-tui.log
```

`codex exec` 把日志直接打印在输出中，不单独写 TUI 日志文件。

## 编辑器

| 变量 | 说明 |
| --- | --- |
| `VISUAL` / `EDITOR` | 在输入框中按 `Ctrl+G` 时打开的外部编辑器，优先使用 `VISUAL`，未设置时用 `EDITOR`；保存并关闭编辑器后，文本回到输入框 |

## Codex 注入给子进程的变量

Codex 为模型生成的命令创建子进程时，会在环境中加入以下变量（均来自源码），脚本可以据此判断自己是否运行在 Codex 里。你自己的哪些环境变量会被传给子进程，由配置项 `shell_environment_policy` 决定。

| 变量 | 取值与含义 |
| --- | --- |
| `CODEX_THREAD_ID` | 当前线程（会话）的 ID |
| `CODEX_SESSION_ID` / `CODEX_VERSION` | 根会话 ID 与 Codex 版本号 |
| `CODEX_SANDBOX` | 命令运行在 macOS Seatbelt 沙箱内时为 `seatbelt` |
| `CODEX_SANDBOX_NETWORK_DISABLED` | 该命令的网络访问受沙箱限制时为 `1` |
| `CODEX_PERMISSION_PROFILE` | 当前命名权限配置的名称，仅供参考；子进程可以改写它，不能当作权限已被强制执行的证明 |
| `CODEX_CI=1` 等 | 经 unified exec（默认开启）运行的命令还会被设置 `NO_COLOR=1`、`TERM=dumb`、`PAGER=cat`、`GIT_PAGER=cat`、`GH_PAGER=cat`，清空 `COLORTERM`，并把 `LANG`、`LC_CTYPE`、`LC_ALL` 设为 `C.UTF-8` |
