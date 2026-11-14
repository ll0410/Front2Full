---
title: "安装、登录与升级"
description: "Codex CLI 的系统要求、安装方式、登录与凭据存储、升级、诊断与卸载"
source: "https://daiw.org/manual/codex/installation"
---

# 安装、登录与升级

> Codex CLI 的系统要求、安装方式、登录与凭据存储、升级、诊断与卸载

## 系统要求

| 项目 | 要求 |
| --- | --- |
| 操作系统 | macOS 12+；Ubuntu 20.04+ / Debian 10+；Windows 11（原生或 WSL2），Windows 10 1809+ 为尽力支持 |
| 处理器 | x86_64 或 ARM64，Windows 须为 64 位系统 |
| 内存 | 至少 4 GB，推荐 8 GB |
| Git | 可选但推荐，2.23+（内置的 PR 辅助功能需要） |

Linux 与 WSL2 上的命令沙箱依赖 `bwrap`，建议先安装 `bubblewrap`（`sudo apt install bubblewrap` 或 `sudo dnf install bubblewrap`）。找不到 `bwrap` 时 Codex 会退回内置的辅助程序，但它要求系统允许创建非特权用户命名空间；Ubuntu 24.04 上可能还要加载 AppArmor 配置，见[官方 Sandbox 文档](https://learn.chatgpt.com/docs/sandboxing)。

## 安装方式

### 官方安装脚本（推荐）

macOS / Linux：

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
```

Windows（PowerShell）：

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"
```

脚本会识别平台（macOS Apple Silicon / Intel、Linux x64 / ARM64、Windows x64 / ARM64；v0.162.0 起 Windows 的 `install.ps1` 已附带 Authenticode 代码签名），优先从 `https://releases.openai.com/codex` 下载，不可用时回退到 GitHub Releases。程序本体放在 `$CODEX_HOME/packages/standalone`（默认 `~/.codex/packages/standalone`），`codex` 命令放在 `~/.local/bin`（Windows 为 `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin`）。该目录不在 `PATH` 中时，脚本会把它写进 shell 启动文件（macOS 为 `~/.zprofile` 或 `~/.bash_profile`，Linux 为 `~/.zshrc` 或 `~/.bashrc`，其他 shell 为 `~/.profile`，内容夹在 `# >>> Codex installer >>>` 标记之间）或 Windows 的用户级 `Path`。重新运行同一条命令即可升级；v0.164.0 与 v0.166.0 起，安装与升级时会自动清理 `packages/standalone` 下不再使用的旧版本（仅保留当前活跃版本与回滚版本），v0.163.0 起也不再附带定制补丁版 `zsh`（改用标准 shell 执行器）。

| 环境变量 | 默认 | 作用 |
| --- | --- | --- |
| `CODEX_RELEASE` | `latest` | 安装指定版本，如 `0.167.0`（`install.sh` 也可用 `--release` 参数） |
| `CODEX_NON_INTERACTIVE` | `false` | 设为 `1`、`true` 或 `yes` 时跳过提示、采用默认答案 |
| `CODEX_INSTALL_DIR` | 见上文 | 更改 `codex` 命令的安装目录 |
| `CODEX_INSTALLER_USE_RELEASES_OPENAI_COM` | `true` | 设为 `false`、`0` 或 `no` 时只从 GitHub Releases 下载 |

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_RELEASE=0.167.0 sh
```

```powershell
$env:CODEX_RELEASE='0.167.0'; irm https://chatgpt.com/codex/install.ps1 | iex
```

### npm

```bash
npm install -g @openai/codex
```

npm 包只是一个 Node.js 启动器（要求 Node.js 16+），原生程序在按平台拆分的可选依赖里（如 `@openai/codex-linux-x64`）。启动时若报 `Missing optional dependency`，说明平台包没装上，重新执行 `npm install -g @openai/codex@latest` 即可。用 pnpm、bun 或 Vite+（`vp`）全局安装的，同样能被 `codex update` 识别。

### Homebrew

```bash
brew install --cask codex
brew upgrade --cask codex   # 升级
```

### GitHub Releases 二进制

从 [GitHub Releases](https://github.com/openai/codex/releases/latest) 下载对应平台的压缩包：macOS 为 `codex-aarch64-apple-darwin.tar.gz`（Apple Silicon）或 `codex-x86_64-apple-darwin.tar.gz`（Intel），Linux 为 `codex-x86_64-unknown-linux-musl.tar.gz` 或 `codex-aarch64-unknown-linux-musl.tar.gz`。压缩包里只有一个带平台名的可执行文件，解压后改名为 `codex` 并放进 `PATH`。Release 中还附带名为 `codex` 的 [DotSlash](https://dotslash-cli.com/) 文件，可提交进仓库，让团队在各平台上统一版本。

## 验证安装

```bash
codex --version
codex doctor
codex doctor --network-only
```

`codex doctor` 检查系统与安装、配置、认证、更新、网络与连通性（含 WebSocket 与模型提供方的可达性）、MCP、沙箱、磁盘、Git、终端、本地状态库、app-server 与会话清单是否正常，只报告问题、不做修复，有检查失败时退出码为 `1`，报 issue 前建议先跑一遍。v0.156.0 起它还会逐个解析配置里授权的文件系统路径，慢或解析失败时给出警告，配置加载出错时只报告文件、行号与列号，不回显配置内容；v0.157.0 起会列出完整性检查失败的 SQLite 数据库路径。v0.158.0 起，诊断日志写不进本地 SQLite 数据库时，Codex 会给出一次警告，建议在关闭前用 `/feedback` 附带日志上报，或运行 `codex doctor` 排查。常用参数：`--network-only`（v0.166.0 起，仅运行代理环境变量、HTTPS/TLS、DNS 与 WebSocket 连通性检查）、`--summary`（只看分组结果与计数）、`--all`（展开较长的列表）、`--json`（输出脱敏的机器可读报告）、`--no-color`、`--ascii`（只用 ASCII 字符）。

## 登录

Codex 支持两种个人登录方式：

- **ChatGPT 账号**：使用套餐内的 Codex 用量，遵循 ChatGPT 工作区的权限与数据保留设置；Codex cloud 只支持这种方式。
- **API key 或云提供方**：按 OpenAI Platform 的 API 标准价格或云服务商计费，适合 CI 等自动化场景；依赖 ChatGPT 工作区或云服务的部分功能受限或不可用。

初次运行 `codex` 会出现登录界面，提供 Sign in with ChatGPT、Sign in with Device Code，并在 **Sign in another way**（v0.164.0 起）下归组 Provide your own API key（若已设置 `OPENAI_API_KEY` 会自动预填）与云平台设置向导（Amazon Bedrock 配置向导自 v0.164.0 起默认开启，Google Cloud Vertex AI 配置向导在 v0.167.0 新增并可通过 `features.gcp_setup_wizard = true` 开启）。v0.158.0 起，浏览器没有自动打开时，可以在登录界面按 `c` 复制登录链接，也可以直接用鼠标选中链接与设备码；TUI 连接本机的后台服务（app-server 守护进程）时，选 Sign in with ChatGPT 也会自动打开浏览器。也可以直接使用 `codex login`：

| 命令 | 作用 |
| --- | --- |
| `codex login` | 打开浏览器完成 ChatGPT OAuth 登录。本地回调服务监听 `127.0.0.1:1455`（被占用时改用 `127.0.0.1:1457`）；v0.158.0 起浏览器回调地址也由 `localhost` 改为 `127.0.0.1` |
| `codex login --device-auth` | 设备码登录（beta）：在浏览器打开链接、登录后输入一次性代码 |
| `printenv OPENAI_API_KEY \| codex login --with-api-key` | 从 stdin 读取 API key 并保存 |
| `printenv CODEX_ACCESS_TOKEN \| codex login --with-access-token` | 从 stdin 读取 Codex access token（企业自动化场景） |
| `codex login status` | 显示当前登录方式；已登录时退出码为 `0`，未登录为 `1` |
| `codex logout` | 删除已保存的凭据（API key 与 ChatGPT 登录均清除） |

- `--with-api-key` 与 `--with-access-token` 只能二选一；旧版直接跟 key 的 `--api-key` 已废弃，使用时会报错并提示改用管道传入。
- 公司网络有 TLS 拦截代理或私有根证书时，登录前把 `CODEX_CA_CERTIFICATE` 指向 PEM 证书包（未设置时使用 `SSL_CERT_FILE`）；登录失败时可查看日志目录中的 `codex-login.log`。
- CI 中更推荐 API key：`codex exec` 与 `codex review` 会读取 `CODEX_API_KEY`，见[环境变量](/manual/agent/codex/environment-variables)。

### 在没有浏览器的远程机器上登录

1. **设备码**（推荐）：先在 ChatGPT 安全设置（个人账号）或工作区权限（管理员）中启用设备码登录，再运行 `codex login --device-auth`。
2. **转发回调端口**：用 `ssh -L 1455:127.0.0.1:1455 user@remote` 登录远程机器后运行 `codex login`，在本机浏览器打开它打印的地址。远程的 1455 端口被占用时，回调会改用 1457，需要相应地转发 1457。
3. **复制凭据缓存**：在有浏览器的机器上登录，再把 `~/.codex/auth.json` 复制到远程机器的同一路径（仅适用于文件存储）：

```bash
ssh user@remote 'mkdir -p ~/.codex && cat > ~/.codex/auth.json' < ~/.codex/auth.json
```

### 凭据存储

登录信息会缓存并重复使用，ChatGPT 登录的 token 会在过期前自动刷新。缓存位置由 `config.toml` 中的 `cli_auth_credentials_store` 决定：

| 取值 | 行为 |
| --- | --- |
| `file`（默认） | 以明文保存在 `$CODEX_HOME/auth.json`（默认 `~/.codex/auth.json`） |
| `keyring` | 保存到操作系统凭据库，不可用时报错 |
| `auto` | 凭据库可用时用凭据库，否则回退到 `auth.json` |
| `ephemeral` | 只保存在当前进程的内存中 |

::: warning

`auth.json` 里存的是访问令牌，要像密码一样对待：不要提交到仓库，也不要贴进工单或聊天。

:::

托管环境中，管理员可以用 `forced_login_method = "chatgpt"`（或 `"api"`）只允许一种登录方式，用 `forced_chatgpt_workspace_id` 把 ChatGPT 登录限定到指定工作区；凭据不符合限制时，Codex 会登出并退出。

## 升级

`codex update` 会识别当前的安装方式，执行对应的升级命令：

| 安装方式 | `codex update` 实际执行 |
| --- | --- |
| 安装脚本（macOS / Linux） | `curl -fsSL https://chatgpt.com/codex/install.sh \| CODEX_NON_INTERACTIVE=1 sh` |
| 安装脚本（Windows） | 用 PowerShell 以非交互方式重新运行 `install.ps1` |
| npm | `npm install -g @openai/codex` |
| pnpm / bun / Vite+ | `pnpm add -g @openai/codex` / `bun install -g @openai/codex` / `vp install -g @openai/codex` |
| Homebrew | `brew upgrade --cask codex` |

识别不出安装方式时（如手动放置的二进制）会提示手动更新。Codex 默认在启动时检查新版本并提示升级；版本由公司统一管理时，可设置 `check_for_update_on_startup = false` 关闭检查。

v0.155.0 起，安装脚本会记下你装的是 `latest` 还是指定版本。跟随 `latest` 的独立安装版，后台的 app-server 守护进程运行时会定期自动更新，也可以用 `codex app-server daemon update` 立即更新（设置方法见 [SDK 与 App Server](/manual/agent/codex/sdk-app-server)）；用 `CODEX_RELEASE` 或 `--release` 指定版本安装的，守护进程保持在该版本。更早用安装脚本装的，要重新用 `latest` 安装一次才会开始自动更新。

v0.156.0 起，新装的守护进程使用独立的安装包目录 `CODEX_HOME/packages/app-server-daemon`，和 `codex` 命令分开更新：`codex update` 只升级 CLI 本身，守护进程由它自己的更新程序、`codex app-server daemon update` 或 TUI 中的 `/daemon` 更新；之前启动过的旧守护进程仍与独立安装版共用 `packages/standalone`，执行一次 `codex app-server daemon update` 就会迁移过去。两者版本不一致时，TUI 启动时会给出提示。

## Windows 与 WSL

**原生 Windows**：用 PowerShell 脚本安装即可。命令在原生 Windows 沙箱中运行，可在 `config.toml` 中选择沙箱实现：

```toml
[windows]
sandbox = "elevated" # 或 "unelevated"；v0.156.0 起还可以是 "mxc"
```

`elevated`（推荐）使用专门的低权限沙箱用户、文件系统权限边界与防火墙规则，初次设置需要管理员批准；`unelevated`（回退）使用当前用户派生的受限令牌，隔离较弱，可在会话中用 `/setup-default-sandbox` 改走 elevated 设置。推荐 Windows 11；Windows 10 需 1809 及以上版本（依赖 ConPTY）。

v0.158.0 起，在 Windows 上自动启动后台服务时，如果启动 Codex 的程序不允许后台进程脱离它继续运行（如 `cargo run`），Codex 改用内嵌服务并给出警告，不再直接启动失败；以管道方式启动的子进程也不再弹出控制台窗口（启动 code-mode host 与本地 stdio MCP 服务器时的弹窗已在 v0.157.1 修复）。

**WSL2**：需要 Linux 原生工具链、或项目本就在 WSL 中时选择它。在管理员 PowerShell 中执行 `wsl --install` 装好发行版，再在 WSL 里用 macOS / Linux 的安装脚本安装并装好 `bubblewrap`。仓库尽量放在 Linux 家目录（如 `~/code`）而不是 `/mnt/c` 下，I/O 更快。自 0.115 起 Linux 沙箱改用 `bubblewrap`，**WSL1 不再受支持**。

## 卸载

官方文档未单独说明卸载，以下依据各安装方式的行为整理：

| 安装方式 | 卸载方法 |
| --- | --- |
| npm | `npm uninstall -g @openai/codex` |
| Homebrew | `brew uninstall --cask codex` |
| 安装脚本（macOS / Linux） | 删除 `~/.local/bin/codex`（macOS 上可能还有同目录的 `codex-code-mode-host`）与 `~/.codex/packages/standalone`，再删掉 shell 启动文件中 Codex installer 标记之间的内容 |
| 安装脚本（Windows） | 若启用了 Windows 沙箱，先运行 `codex sandbox uninstall`（v0.162.0 起）清理沙箱目录、本地沙箱账户与防火墙规则；再删除 `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin` 与 `%USERPROFILE%\.codex\packages\standalone`，并从用户级 `Path` 中移除该目录 |

用过后台服务的，先运行 `codex app-server daemon stop` 停掉守护进程；v0.156.0 起它的安装包单独放在 `~/.codex/packages/app-server-daemon`（Windows 为 `%USERPROFILE%\.codex\packages\app-server-daemon`），也要一并删除。

如果还要清除配置、凭据与会话记录（**不可恢复**），先运行 `codex logout`（凭据存放在系统凭据库时，只删目录清除不了它们），再删除 `~/.codex`（或你设置的 `CODEX_HOME`）。桌面应用与 IDE 扩展也使用这个目录，删除前请确认。
