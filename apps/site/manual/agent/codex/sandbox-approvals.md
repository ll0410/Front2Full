---
title: "沙箱、审批与安全"
description: "沙箱模式与审批策略、常用组合与危险参数、网络访问、权限配置档、自动审查、各平台沙箱实现与 codex sandbox 测试"
source: "https://daiw.org/manual/codex/sandbox-approvals"
---

# 沙箱、审批与安全

> 沙箱模式与审批策略、常用组合与危险参数、网络访问、权限配置档、自动审查、各平台沙箱实现与 codex sandbox 测试

Codex 的本地安全由两层控制共同决定：**沙箱**规定模型生成的命令在技术上能碰什么（写哪些目录、能否联网），**审批策略**规定越过边界之前要不要停下来问你。沙箱作用于 Codex 派生的所有命令及其子进程，`git`、包管理器、测试脚本都一样受限。

## 沙箱模式

| 模式 | 文件系统 | 网络 |
| --- | --- | --- |
| `read-only` | 可以读文件、在只读沙箱里跑命令，不能修改文件 | 关闭 |
| `workspace-write` | 可读；工作区内可写 | 默认关闭 |
| `danger-full-access` | 不受限（没有沙箱） | 不受限 |

`workspace-write` 的可写范围是当前工作目录、`--add-dir` 追加的目录、`sandbox_workspace_write.writable_roots`，以及 `$TMPDIR`、`/tmp` 等临时目录（可用 `exclude_tmpdir_env_var`、`exclude_slash_tmp` 排除）。即便在可写目录内，`.git`（含 `gitdir:` 指向的真实目录）、`.agents`、`.codex` 仍递归只读，所以 `git commit` 这类命令常常需要审批才能在沙箱外执行。v0.158.0 起，在 Linux 与 macOS 上，`gitdir:` 指向的真实目录即使位于另一个可写根目录之下，也保持只读。

启动时用 `-s` / `--sandbox` 指定，或在 `config.toml` 中设 `sandbox_mode`。未设置时，已有信任决定的目录默认 `workspace-write`，其他目录默认 `read-only`（首次启动时 TUI 会询问是否信任当前目录）。

## 审批策略

| 策略 | 行为 |
| --- | --- |
| `on-request`（默认） | 沙箱内的操作直接执行；需要越界（写工作区外、联网、提权等）时由模型发起审批请求 |
| `never` | 从不询问，失败直接返回给模型 |
| `{ granular = { ... } }` | 细粒度：按类别决定弹出审批还是自动拒绝 |

交互模式的 `-a` / `--ask-for-approval` 只接受 `on-request` 和 `never`；旧值 `on-failure` 在配置文件中仍被当作 `on-request`。细粒度写法的五个字段依次对应沙箱提权、rules 的 `prompt` 规则、MCP elicitation、`request_permissions` 工具与 skill 脚本审批，`true` 表示照常弹出，`false` 表示自动拒绝（前三项必填，后两项省略时为 `false`）：

```toml
approval_policy = { granular = { sandbox_approval = true, rules = true, mcp_elicitations = true, request_permissions = false, skill_approval = false } }
```

::: warning

`approval_policy = "untrusted"` 已停止支持，生效配置里出现它时 Codex 会拒绝启动。想要“除非规则放行，否则每条命令都审批”的严格行为，请在用户配置中把项目标为 `trust_level = "untrusted"`，并且不要显式设置 `approval_policy`。

:::

v0.158.0 起，终端输入审批默认开启（功能开关 `write_stdin_approval` 转为稳定）：模型向一个仍在运行的终端会话写入输入时，如果这个终端当初在沙箱外启动（经审批提权，或被 [rules](/manual/agent/codex/rules) 的 `allow` 放行）、带着额外授予的权限启动，或者它启动时的沙箱、网络设置与当前设置已经不同（例如中途用 `/permissions` 换了配置档），这次输入要先经过审批，配置了自动审查时交给审查 agent。每次写入单独审批，没有“本会话不再询问”的选项；审批策略为 `never`，或 `granular` 中 `sandbox_approval = false` 时直接拒绝。只读取输出的空写入不需要审批，Codex 为运行命令在内部附加的权限也不会引发这类审批；送审内容超过 8,000 字节时直接拒绝，可以改发较短的输入或新开一个终端。

v0.167.0 起，当 TUI 中弹出文件改动（patch）审批对话框时，可以直接按 `Ctrl+O`（或展开快捷键）在对话记录中展开查看完整的待审补丁详情，无需先关闭审批弹窗。

## 常用组合

| 场景 | 参数 | 效果 |
| --- | --- | --- |
| 默认（Auto） | 不加参数（受信任目录），或 `-s workspace-write -a on-request` | 工作区内读写、运行命令；越界或联网时询问 |
| 只读浏览 | `-s read-only -a on-request` | 只读，越界时询问 |
| 只读 CI | `-s read-only -a never` | 只读，从不询问 |
| 自动审查 | `--approve-for-me`（别名 `--not-so-yolo`） | 等价于 `workspace-write` + `on-request` + `approvals_reviewer = "auto_review"` |
| 完全放开 | `--dangerously-bypass-approvals-and-sandbox`（别名 `--yolo`） | 无沙箱、无审批，也可写成 `-s danger-full-access -a never` |

`--approve-for-me` 与 `--sandbox`、`--yolo` 互斥；交互模式下这两个参数也不能与 `-a` 同时使用。

::: info

v0.167.0 源码中没有 `--full-auto` 参数。非交互地在工作区内干活，请直接用 `codex exec --sandbox workspace-write`。

:::

## 网络访问

`workspace-write` 默认不联网，需要时打开 `[sandbox_workspace_write]` 表中的 `network_access`。打开后命令可访问任意地址；若要限制在白名单内，再启用实验性的网络代理 `features.network_proxy`（默认关闭），它只约束已开启的网络，本身不会开网：

```toml
[sandbox_workspace_write]
network_access = true

[features.network_proxy]
enabled = true
domains = { "api.openai.com" = "allow", "*.github.com" = "allow", "tracking.example.com" = "deny" }
```

域名支持精确主机名、`*.example.com`（仅子域）、`**.example.com`（含根域）和只能用于 allow 的全局 `*`，`?` 匹配恰好一个字符（包括 `.`，例如 `api?.example.com` 匹配 `api1.example.com`，不匹配 `api.example.com`），`deny` 总是优先；回环与内网地址默认被拦截，`allow_local_binding = true` 可以放行本机服务与回环连接（域名规则照常生效，使用 MXC 沙箱时它默认就是 `true`）。代理只过滤沙箱内命令的流量，不管网页搜索、MCP 服务器与 Codex 自身的模型请求。联网请求被代理拦下时，审批里可以选择以后都允许或都拦截这个主机，选择会以 `network_rule()` 的形式写进 `~/.codex/rules/default.rules`，见[命令规则](/manual/agent/codex/rules)。

网页搜索单独用 `web_search` 控制：默认 `cached`（查询 OpenAI 维护的索引，不实时抓取），`--search` 或 `web_search = "live"` 为实时搜索，`"indexed"` 只允许经搜索索引把关的外部访问，`"disabled"` 关闭；完全访问模式下，只要没设为 `disabled` 或 `indexed`，就会改用 `live`（管理员或模型提供方不允许实时搜索时除外）。

## 权限配置档（beta）

权限配置档把文件系统与网络规则打包成可复用的命名策略，用来替代 `sandbox_mode` 加 `[sandbox_workspace_write]` 的旧写法。内置 `:read-only`、`:workspace`、`:danger-full-access`；自定义的写在 `[permissions.<name>]` 下，用 `default_permissions` 选中：

```toml
default_permissions = "project-edit"

[features]
network_proxy = true

[permissions.project-edit]
extends = ":workspace"   # 继承内置配置档，保留 .git、.codex 只读等保护

[permissions.project-edit.filesystem.":workspace_roots"]
"**/*.env" = "deny"

[permissions.project-edit.network]
enabled = true

[permissions.project-edit.network.domains]
"api.openai.com" = "allow"
```

- 文件系统取值为 `read`、`write`、`deny`，越具体的路径越优先，同一路径上 `deny` 优先于其他取值；特殊路径有 `:root`、`:minimal`、`:workspace_roots`、`:tmpdir`、`:slash_tmp`。
- 生效的配置档里只要有 `deny` 条目，命令就不会再被放到沙箱外执行：提权审批通过、或被 rules 的 `allow` 放行的命令仍在沙箱内运行，以免绕过这些拒绝读取的规则。v0.166.0 起，针对文件系统的权限提权也会保留原有的拒绝读取路径（`deny_read`）与当前的网络限制，不会连带放宽无关的沙箱边界。
- `network.enabled = true` 只是允许联网，域名规则要配合 `features.network_proxy` 才会执行。管理员还可以在 `requirements.toml` 中直接通过 `network_proxy`（v0.162.0 起）或 `[permissions.network]`（v0.165.0 起）强制下发网络代理与网络权限策略。
- 两套机制不能混用：传了 `--sandbox` 就用旧的沙箱设置；否则看优先级靠前的、设置了 `sandbox_mode` 或 `default_permissions` 的那一层配置（同一层两者都有时以 `default_permissions` 为准）。管理员在 requirements 中设了 `allowed_permission_profiles` 时一律使用配置档；定义了 `[permissions]` 却没有设置 `default_permissions`（也没用旧写法）时会拒绝启动。会话中可用 `/permissions` 或 `/permissions <模式>`（v0.164.0 起支持直接带参数）切换配置档。

## 自动审查（auto-review）

把 `approvals_reviewer` 设为 `auto_review`（旧值 `guardian_subagent` 仍可用）并保持 `approval_policy = "on-request"`，原本弹给你的审批请求会改交给一个独立的审查 agent 判断。

- 它只换审批人，不扩大沙箱边界：沙箱内允许的操作不会被审查，审查的是提权、被拦截的网络请求、工作区外写入、需要审批的 MCP 或 App 工具调用、Computer Use 类操作（v0.158.0 起也包括 Browser 连接器发起的操作）、需要审批的终端输入等。`approval_policy = "never"` 时没有可审的请求。管理员在 `requirements.toml` 的 `[rules]` 中设为 `decision = "prompt-user"` 的命令规则（v0.167.0 起）即使开启了自动审查，也会强制要求真人审批。
- 被拒绝后，主 agent 会收到理由并被要求换更安全的做法或停下来问你。同一回合内连续 3 次被拒，或近 50 次审查中有 10 次被拒，会中断该回合。
- v0.155.0 起，审查遇到限流等暂时性错误会在时限内重试；审查未能完成时操作仍被拒绝，但理由会说明是审查未完成，而不是判定操作不安全。单个待审操作也不再受 8,000 字节的限制，只要完整内容连同基础的审查上下文放得进审查模型的输入窗口就会送审；放不下时这次审查作废，一般改由你亲自审批。
- v0.158.0 起，审查进行中你又发来新消息（哪怕只是问一句进度）时，审查会基于更新后的对话重新进行，待审操作不会再因此被中止；审查所依据的授权上下文也更完整，会保留主 agent 已发出的回复和你用 `/goal` 明确设置或修改的目标。旧开关 `features.guardianv2.thread_context` 已移除，审查恒定使用线程自有的上下文，配置里残留时会提示删除。
- 要推翻某次拒绝，在 TUI 中输入 `/approve`，选一条近期的拒绝记录放行一次重试（重试仍会经过审查）。
- 可用 `[auto_review]` 表的 `policy` 自定义审查策略，组织托管的 `guardian_policy_config` 优先；v0.157.0 起还能用 `extra_policy` 在策略之外追加一段说明，托管的 `guardian_extra_policy` 优先。审查会产生额外的模型调用，计入用量。

## 各平台的沙箱实现

| 平台 | 实现 | 说明 |
| --- | --- | --- |
| macOS | Seatbelt（`sandbox-exec`） | 开箱即用 |
| Linux | bubblewrap + seccomp | 需先安装 `bubblewrap` |
| WSL2 | 同 Linux | WSL1 自 0.115 起不再支持 |
| 原生 Windows | Windows 沙箱（`elevated` / `unelevated`，v0.156.0 起另有 `mxc`） | 在 `[windows]` 表中配置 |

**Linux 与 WSL2**：Codex 优先使用 `PATH` 上的首个 `bwrap`，找不到时退回内置辅助程序（需要系统允许非特权用户命名空间）；`PATH` 上没有 `bwrap`，或它无法创建所需的用户命名空间时，启动会给出警告。旧 Landlock 实现的开关 `features.use_legacy_landlock` 已弃用，而且在 v0.158.0 中，只要文件系统不是完全可写（例如只读或 `workspace-write`），开启它后沙箱会直接报错退出，要求改用 bubblewrap，已不能用来切回旧实现。在禁止命名空间或 `seccomp` 的 Docker 等容器中，应由容器负责隔离，并在容器内使用 `--sandbox danger-full-access`。

```bash
sudo apt install bubblewrap   # Ubuntu / Debian；24.04 可能还需加载 AppArmor 的 bwrap-userns-restrict 配置
sudo dnf install bubblewrap   # Fedora
```

v0.155.0 起，只要沙箱限制了文件系统写入（也就是不在完全访问模式），Linux 沙箱就会禁止 `AF_VSOCK` 套接字与 `io_uring`，即使开了网络访问也是如此；在 WSL 中还会屏蔽 WSL interop，沙箱里的命令不能再调用 `cmd.exe` 这类 Windows 程序，也不能借 `wsl.exe` 以 root 身份重新进入发行版。v0.156.0 起，受限的 Linux 沙箱还会隐藏 WSLg 暴露的那份重复的发行版根目录。

同样从 v0.156.0 起，app server 的 Unix 控制套接字放在只有当前用户能访问的固定目录里，受文件系统限制的命令即使开了网络或 Unix 套接字白名单也连不上它；macOS 的 Seatbelt 策略还会禁止能绕过只读限制改写文件的 `fcntl` 调用，并拒绝 XPC 服务查找。

v0.158.0 至 v0.165.0 期间，Linux 与 macOS 沙箱进一步收紧了多层边界：
- v0.158.0 修复了可写根目录相互嵌套时 Linux 沙箱无法启动的问题；macOS 上检查补丁权限时会把 `/tmp` 与 `/private/tmp` 这类系统路径别名视为同一位置，且在存在 `/**/.env` 这类全盘按文件名拒绝读取的规则时，Seatbelt 不再禁止移动目录。`codex exec-server` 新增 `--linux-sandbox-pid-namespace`（默认 `isolate` 新建 PID 命名空间，`inherit` 沿用调用方 PID 命名空间与 `/proc`）。
- v0.161.0 为敏感的仓库控制目录生成只读快照，防止沙箱内运行的命令篡改 Git 引用（git refs）。
- v0.163.0 保护 Linux 沙箱中的只读绑定挂载免受递归子挂载覆盖，使嵌套在可写根目录内的 `.git` 与 `.codex` 目录继续维持只读。
- v0.164.0 在通过远程 Bash 或 Zsh 执行命令时，会在拼装命令字符串阶段自动遮蔽内联凭据与敏感环境变量。
- v0.165.0 在 Linux `bwrap` 沙箱中阻止在命中拒绝读取目录 glob 的路径下新建文件，并在被拒绝的 glob 跨越不可读的祖先符号链接时隐藏这些路径。

**原生 Windows**：推荐 `elevated`，使用专门的低权限沙箱用户、文件系统 ACL 与防火墙规则，初次配置需要管理员授权；`unelevated` 以受限令牌运行，网络隔离较弱，用于拿不到管理员权限时兜底。未配置 Windows 沙箱时，`workspace-write` 会降级为 `read-only`。

```toml
[windows]
sandbox = "elevated"   # 或 "unelevated"；v0.156.0 起还可以是 "mxc"
```

- v0.156.0 起，elevated 与 unelevated 沙箱一律在私有桌面上运行，`windows.sandbox_private_desktop` 已移除，配置里残留时会提示删除（官方 Windows 沙箱文档仍在介绍这个设置）；离线沙箱除了出站，也拦截非回环的入站连接。v0.157.0 起，沙箱令牌的默认访问权限只授予当前登录会话。
- `mxc` 通过微软的 MXC 容器运行命令，需要系统支持相应的进程安全环境，不像 elevated 那样创建沙箱用户或修改 ACL。显式指定 `mxc` 时不会退回其他实现，系统不支持则命令直接失败；requirements 中的 `windows.allowed_sandbox_implementations` 只约束 elevated 与 unelevated。另有仍在开发中的功能开关 `prefer_mxc`（v0.157.0 起，默认关闭），系统可用时优先选用 MXC。
- v0.158.0 修复了几类导致 Windows 沙箱失败的问题：Windows 10 上的普通路径、已存储的沙箱凭据被拒，以及权限策略过大。

`/setup-default-sandbox` 用于设置 elevated 沙箱；排查问题时查看 `CODEX_HOME/.sandbox/` 下按天生成的 `sandbox.<日期>.log`（官方文档写作 `sandbox.log`）。v0.155.0 移除了让沙箱在本会话内多读一个目录的 `/sandbox-add-read-dir`（官方 Windows 沙箱文档仍在介绍它）。同一版本起，elevated 沙箱要求权限配置允许读取文件系统根目录（`:root`），拒绝读取根目录的配置档会直接报错，范围更小的 `deny` 规则不受影响。

v0.162.0 起，Windows 上新增 `codex sandbox uninstall` 子命令，用于一键清理本机的 Windows 沙箱状态：它会删除 `CODEX_HOME/.sandbox`、`CODEX_HOME/.sandbox-secrets` 与 `CODEX_HOME/.sandbox-bin` 目录，并在已配置 elevated 沙箱时请求管理员权限，一并移除 `CodexSandboxOffline` / `CodexSandboxOnline` 本地账户与关联防火墙规则。

## 用 `codex sandbox` 测试

`codex sandbox` 在当前系统的沙箱中运行任意命令，便于验证策略：

```bash
codex sandbox -- ls -la ~/.ssh                    # 默认使用只读沙箱
codex sandbox -P project-edit -- touch probe.txt  # 使用 [permissions.project-edit]
codex sandbox --log-denials -- ./build.sh         # macOS：结束后打印被拦截的操作
codex sandbox uninstall                           # Windows：清理本机沙箱目录、账户与防火墙规则
```

| 选项 | 说明 |
| --- | --- |
| `-P` / `--permission-profile <NAME>` | 按指定权限配置档运行 |
| `-C` / `--cd <DIR>` | 工作目录，需配合 `-P` |
| `--include-managed-config` | 需配合 `-P`：解析配置档时也套用管理员的 requirements（指定 `-P` 时默认忽略） |
| `--log-denials` | 仅 macOS，结束后打印拒绝记录 |
| `--allow-unix-socket <PATH>` | 仅 macOS，允许访问指定的 Unix 套接字 |
| `uninstall`（子命令） | 仅 Windows（v0.162.0 起），卸载并清理本机 Windows 沙箱状态 |

未指定 `-P` 且配置中没有 `default_permissions` 时固定使用只读沙箱（不继承 `sandbox_mode`），可用 `-c sandbox_mode=workspace-write` 覆盖。官方文档中 `codex sandbox macos` 等平台子命令写法不适用于 v0.167.0。

## 安全建议

- 日常保持默认的 `workspace-write` 加 `on-request`；多写一个目录用 `--add-dir` 或 `writable_roots`，反复放行的命令用 [rules](/manual/agent/codex/rules) 精确到前缀，而不是切到完全访问。
- `--yolo` 与 `danger-full-access` 只用于一次性虚拟机、容器等外部隔离环境；即使在容器里，恶意项目也能读取容器内的一切，包括 Codex 凭证。
- 联网与实时搜索会增加提示注入风险；不熟悉的仓库先用只读模式浏览，确认后再信任目录。
