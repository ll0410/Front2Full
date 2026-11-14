---
title: "安装与升级"
description: "系统要求、各平台安装方式、更新策略与卸载方法"
source: "https://daiw.org/manual/claude-code/installation"
---

# 安装与升级

> 系统要求、各平台安装方式、更新策略与卸载方法

## 系统要求

- 操作系统：macOS 13.0+、Windows 10 1809+ / Windows Server 2019+、Ubuntu 20.04+、Debian 10+、Alpine Linux 3.19+。
- 硬件：4 GB+ 内存，x64 或 ARM64 处理器。
- 网络：需要联网（见下方代理相关环境变量）。
- Shell：Bash、Zsh、PowerShell 或 CMD。
- 依赖：`ripgrep` 通常随 Claude Code 一起打包，无需单独安装（Alpine 等 musl 发行版例外，见下文）。

## 安装方式

### 原生安装脚本（推荐）

macOS / Linux / WSL:

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Windows PowerShell:

```powershell
irm https://claude.ai/install.ps1 | iex
```

Windows CMD:

```batch
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

原生安装会在后台自动更新。Windows 原生环境建议安装 Git for Windows，以便 Claude Code 使用 Bash 工具；不安装则回退到 PowerShell 工具。WSL 环境不需要 Git for Windows。

### Homebrew

```bash
brew install --cask claude-code
```

Homebrew 提供两个 cask：`claude-code` 跟踪 `stable` 渠道（通常滞后约一周，会跳过有重大问题的版本），`claude-code@latest` 跟踪 `latest` 渠道。**Homebrew 安装不会自动更新**，需要手动运行 `brew upgrade claude-code`（或 `@latest`）。

### WinGet

```powershell
winget install Anthropic.ClaudeCode
```

同样不会自动更新，需定期运行 `winget upgrade Anthropic.ClaudeCode`。

### Linux 包管理器（apt / dnf / apk）

官方为 Debian/Ubuntu（apt）、Fedora/RHEL（dnf）、Alpine（apk）提供了签名仓库，每个仓库都有 `stable` 与 `latest` 两个渠道。以 apt 的 `stable` 渠道为例：

```bash
sudo install -d -m 0755 /etc/apt/keyrings
sudo curl -fsSL https://downloads.claude.ai/keys/claude-code.asc \
  -o /etc/apt/keyrings/claude-code.asc
echo "deb [signed-by=/etc/apt/keyrings/claude-code.asc] https://downloads.claude.ai/claude-code/apt/stable stable main" \
  | sudo tee /etc/apt/sources.list.d/claude-code.list
sudo apt update
sudo apt install claude-code
```

导入密钥后务必核对指纹：`31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE`。dnf、apk 的用法类似，分别用 `.repo` 文件和 `/etc/apk/repositories` 追加一行，详见官方文档。这三种包管理器安装均**不会自动更新**，升级走各自系统的正常升级命令（`apt upgrade`、`dnf upgrade`、`apk upgrade`)。

### npm 全局安装

```bash
npm install -g @anthropic-ai/claude-code
```

自 v2.1.198 起，npm 包要求 Node.js 22+；更早的 Node 版本只会打印 `EBADENGINE` 警告，不影响安装和运行——因为安装的其实是各平台的原生二进制（如 `@anthropic-ai/claude-code-darwin-arm64`)，`claude` 命令本身不依赖 Node.js 运行时。

支持的平台：`darwin-arm64`、`darwin-x64`、`linux-x64`、`linux-arm64`、`linux-x64-musl`、`linux-arm64-musl`、`win32-x64`、`win32-arm64`。

升级请用：

```bash
npm install -g @anthropic-ai/claude-code@latest
```

::: warning

不要使用 `npm update -g`，它遵循安装时的 semver 范围，可能不会真正升到最新版。也不要用 `sudo npm install -g`，否则容易引发权限问题，遇到权限报错应参考官方 troubleshooting 文档而不是加 `sudo`。

:::

### Alpine / musl 发行版的额外依赖

Alpine 等基于 musl/uClibc 的发行版，原生安装器需要额外的 `libgcc`、`libstdc++`、`ripgrep`：

```bash
apk add libgcc libstdc++ ripgrep
```

并在 `settings.json` 里关闭内置 ripgrep，改用系统版本：

```json
{
  "env": {
    "USE_BUILTIN_RIPGREP": "0"
  }
}
```

## 验证安装

```bash
claude --version
claude doctor
```

`claude doctor` 会给出更详细的安装与配置自检结果（包括最近一次自动更新是否成功）。

## 认证

Claude Code 需要 Pro / Max / Team / Enterprise / Console 账号（免费版 claude.ai 不包含 Claude Code 访问权限），也可以通过 Amazon Bedrock、Google Cloud's Agent Platform、Microsoft Foundry 等第三方 API 提供方接入。安装完成后直接运行 `claude`，按浏览器提示完成登录。

## 安装后推荐配置

### 用 shell 函数默认跳过权限确认

如果你每次都在**可信、可回滚**的环境里用 Claude Code（比如自己的项目仓库、容器、或有 Git 兜底的目录），反复点“允许”会很累。可以在 shell 配置里包一层函数，让 `claude` 每次都以 `bypassPermissions` 模式启动：

```bash
# 加到 ~/.bashrc 或 ~/.zshrc，然后 source ~/.zshrc（或重开终端）生效
claude() {
  command claude --permission-mode bypassPermissions "$@"
}
```

- **`command claude`** 是关键：函数名也叫 `claude`，必须用 `command` 显式调用真正的可执行文件，否则会无限递归调用函数自身。
- **`"$@"`** 把你敲的所有参数原样透传，所以 `claude -p "..."`、`claude update`、`claude doctor` 等用法都不受影响。

::: warning

**先想清楚这到底跳过了什么。** `bypassPermissions`（等价于 `--dangerously-skip-permissions`）会跳过**几乎所有**确认——Claude 可以不经询问就执行任意 shell 命令、写删文件、发网络请求。它适合**隔离/可回滚**的场景，**不要**在生产代码库、有写权限的服务器、有敏感数据的机器、或克隆下来的不可信仓库里默认开启。各权限模式的准确边界见[权限模式说明](/manual/agent/claude-code/commands-model-permissions)。

:::

想要折中的话，把上面的 `bypassPermissions` 换成 **`acceptEdits`**——它只自动接受文件编辑，shell 命令等仍会逐个确认，日常写代码摩擦小很多，又保留了对“执行命令”这类高风险操作的把关：

```bash
claude() {
  command claude --permission-mode acceptEdits "$@"
}
```

需要临时用回完整确认（default 模式）时，直接调 `command claude` 绕开这个函数即可，无需改配置。

### 在服务器上长期运行：建一个专用非 root 用户

云服务器默认常常直接以 `root` 登录。但 Claude Code **拒绝在 root / sudo 身份下**使用 `--dangerously-skip-permissions`（也就是上面 shell 函数里用的 `bypassPermissions`），会直接报错退出：

```text
--dangerously-skip-permissions cannot be used with root/sudo privileges for security reasons
```

这是有意的安全护栏——一个会跳过所有确认的 agent 若再叠加 root 权限，破坏面就是整台机器。正确做法是**建一个专用的非 root 用户**来跑 Claude Code：

```bash
# 1. 新建专用用户(会提示设置密码,其余信息一路回车即可)
sudo adduser claude

# 2. 加入 sudo 组,方便这个用户自己做运维(装依赖、重启服务等)
sudo usermod -aG sudo claude

# 3. 给它配好 SSH 公钥登录:把你的公钥写进 /home/claude/.ssh/authorized_keys
#    再从本地以该用户登录服务器:
#    ssh claude@你的服务器地址

# 4. 以 claude 用户身份运行,这次不会再报 root 错误
claude --dangerously-skip-permissions
```

::: info

加进 `sudo` 组**不会**让第 4 步重新报错——那条校验只看「当前进程是不是 root、是不是经 `sudo` 启动」，与组成员身份无关。你以 `claude` 用户直接 SSH 登录后跑 `claude`，uid 不为 0，校验通过；而无人值守时 Claude 也不会替你敲 `sudo`（那要密码）。真正的收益是：万一这个 agent 被诱导做危险操作，权限也被圈在这个普通账户里，而不是 root。

:::

只是想**少点确认、又不想彻底放开**的话，更稳的选择是 `--permission-mode auto`（带分类器逐条预审），或上面的 `acceptEdits`；若要从管理侧**彻底禁用** bypass，用 managed settings 的 `permissions.disableBypassPermissionsMode: "disable"`。

## 更新策略

原生安装在启动时以及运行过程中会定期检查更新，并在后台静默下载，下次启动时生效——不影响当前会话。（v2.1.281 修复了 Windows 上多个会话同时更新时可能互删 `claude.exe` 的备份，最后一个 `claude.exe` 都不剩；v2.1.318 起校验新版本时若遇短暂网络故障会立即重试，且版本清理不会把本机其它用户如 `sudo claude` 仍在运行的进程误判为已退出而删掉二进制。）

### 配置发布渠道

用 `autoUpdatesChannel` 控制走哪个渠道：

```json
{
  "autoUpdatesChannel": "stable"
}
```

- `"latest"`（默认）：第一时间拿到新特性。
- `"stable"`：滞后约一周，跳过有重大回归的版本。

也可以在会话内用 `/config` → Auto-update channel 切换。企业部署可以通过 managed settings 强制统一渠道。

### 钉住最低版本

`minimumVersion` 设定一个更新下限，自动更新和 `claude update` 都不会把版本降到这个值以下：

```json
{
  "autoUpdatesChannel": "stable",
  "minimumVersion": "2.1.100"
}
```

如果需要“版本不在范围内就直接拒绝启动”这种更强的约束，要用 managed settings 里的 `requiredMinimumVersion` / `requiredMaximumVersion`，而不是 `minimumVersion`。

⚠️ v2.1.277 起格式不合法的 `minimumVersion` 会被忽略；同版本修复了设有最低或最高版本时，代理返回非法版本号导致更新检查每 30 分钟报错、`claude update` 挂起。

### 禁用自动更新

```json
{
  "env": {
    "DISABLE_AUTOUPDATER": "1"
  }
}
```

`DISABLE_AUTOUPDATER` 只关闭后台检查，`claude update` 手动更新依旧可用。如果连手动更新也要禁止（比如你通过自己的渠道分发 Claude Code，不希望用户自行升级），要设置更严格的 `DISABLE_UPDATES`。

### 手动更新 / 安装指定版本

```bash
claude update
```

原生安装器也支持直接装某个具体版本或渠道：

```bash
curl -fsSL https://claude.ai/install.sh | bash -s 2.1.89
curl -fsSL https://claude.ai/install.sh | bash -s stable
```

## 二进制完整性校验

每个发布版本都会附带一份 `manifest.json`，列出各平台二进制的 SHA256 校验和，并用 Anthropic 的 GPG 密钥签名（`31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE`）。macOS 二进制额外经过 Apple 公证（`codesign --verify --verbose ./claude`），Windows 二进制由 “Anthropic， PBC” 签名（`Get-AuthenticodeSignature .\claude.exe`）。通过 apt / dnf / apk 安装时，包管理器会自动用仓库签名密钥校验，无需手动操作。

## 卸载

不同安装方式对应不同的卸载命令，例如原生安装：

```bash
rm -f ~/.local/bin/claude
rm -rf ~/.local/share/claude
```

若要彻底清除配置、已登录凭证、MCP 配置与会话历史（**不可恢复**）：

```bash
# 用户级配置
rm -rf ~/.claude
rm ~/.claude.json

# 项目级配置（在项目目录下执行）
rm -rf .claude
rm -f .mcp.json
```

::: warning

VS Code 插件、JetBrains 插件、Desktop 客户端也会写入 `~/.claude/`。只要其中任意一个还装着，这个目录就会在它下次运行时被重新创建。要彻底卸载，需要先卸载这些客户端再删除配置目录。

:::
