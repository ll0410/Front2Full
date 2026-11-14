---
title: "MCP 集成"
description: "在 config.toml 中配置本地 stdio 与远程 HTTP 两类 MCP 服务器，用 codex mcp 管理服务器与 OAuth 登录，以及 codex mcp-server 移除后的替代方案。"
source: "https://daiw.org/manual/codex/mcp"
---

# MCP 集成

> 在 config.toml 中配置本地 stdio 与远程 HTTP 两类 MCP 服务器，用 codex mcp 管理服务器与 OAuth 登录，以及 codex mcp-server 移除后的替代方案。

MCP（Model Context Protocol）让 Codex 连接外部的工具与上下文，例如实时的开发文档、浏览器、Figma、Sentry。Codex CLI 在这里是 **MCP 客户端**：服务器写在 `config.toml` 里，CLI、IDE 扩展和 ChatGPT 桌面端共用同一份配置，配好一次就能在几个客户端之间切换。

::: warning

v0.154.0 起，把 Codex 本身当作 MCP 服务器的 `codex mcp-server` 命令已被移除，见本页文末小节。连接外部 MCP 服务器的功能不受影响。

:::

## 两类服务器

| 类型 | 由哪个字段决定 | 适用场景 |
| --- | --- | --- |
| stdio | `command` | 由 Codex 启动的本地进程 |
| Streamable HTTP | `url` | 远程服务，或本机已在运行的服务 |

一个条目里 `command` 与 `url` 只能出现一个。把 HTTP 专属字段（如 `bearer_token_env_var`、`http_headers`、`oauth`）写进 stdio 条目，或把 `args`、`env`、`cwd` 写进 HTTP 条目，都会导致配置加载报错。

每个服务器对应 `config.toml` 里的一张 `[mcp_servers.<名字>]` 表。全局配置在 `~/.codex/config.toml`；也可以写进项目的 `.codex/config.toml`，但只对受信任的项目生效。v0.152.0 起名字可以包含字母、数字以及 `-`、`_`、`:`、`@`、`/`、`.`，含特殊字符时 TOML 键要加引号，例如 `[mcp_servers."@acme/docs"]`。

## stdio 服务器

```toml
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
env_vars = ["LOCAL_TOKEN"]

[mcp_servers.context7.env]
MY_ENV_VAR = "MY_ENV_VALUE"
```

| 字段 | 说明 |
| --- | --- |
| `command` | 必填，启动服务器的命令 |
| `args` | 传给命令的参数数组 |
| `env` | 固定写给服务器进程的环境变量表 |
| `env_vars` | 额外放行、从 Codex 所在环境转发给服务器的变量名列表；也可写成带 `name` 与 `source` 的内联表，`source = "remote"` 只用于远程执行环境 |
| `cwd` | 服务器进程的工作目录 |

v0.157.0 起，Unix 上的本地 stdio 服务器只继承标准输入、输出与错误这三个文件描述符，Codex 进程打开的其他管道、套接字与文件不会再泄漏给服务器及其子进程；v0.157.1 起，Windows 上启动本地服务器不再弹出控制台窗口。v0.166.0 起，开启实验开关 `features.mcp_connection_sharing` 后，符合条件的本地 stdio MCP 连接可在多个对话之间共享复用。

## Streamable HTTP 服务器

```toml
[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
bearer_token_env_var = "FIGMA_OAUTH_TOKEN"
http_headers = { "X-Figma-Region" = "us-east-1" }
```

| 字段 | 说明 |
| --- | --- |
| `url` | 必填，服务器地址 |
| `bearer_token_env_var` | 从这个环境变量读取 token，放进 `Authorization: Bearer` 请求头 |
| `http_headers` | 固定的请求头 |
| `env_http_headers` | 请求头名到环境变量名的映射，值在运行时从环境读取 |
| `http_headers_helper` | 本地命令，输出请求头组成的 JSON 对象；只用于本地发起的连接 |
| `auth` | 其他凭据都没有时的认证方式：`oauth`（默认，用已保存的 OAuth 凭据）或 `chatgpt`（用当前 ChatGPT 会话，仅限受信任的 ChatGPT 官方源）。v0.156.0 起另有企业用的 `ema_auth`：用企业身份提供方的刷新令牌换取该资源的授权，需要配合 `mcp_enterprise_managed_auth` 与 `use_xaa`；v0.164.0 起，企业托管认证支持直接复用符合条件的 Codex 账户授权或发起独立登录（含带 `client_secret` 的 OAuth 客户端） |
| `scopes` | OAuth 登录时请求的 scope 列表 |
| `oauth_resource` | OAuth 登录时附带的 RFC 8707 `resource` 参数 |
| `oauth.client_id`、`oauth.callback_url`、`oauth.callback_port` | 预注册 OAuth 客户端的 ID、回调地址与本地监听端口 |
| `oauth.client_secret` | v0.158.0 起，预注册客户端的密钥，换取与刷新令牌时使用；必须同时配置非空的 `oauth.client_id`，值不能为空，见下文 OAuth 登录 |

凭据全都没有时，Codex 会不带认证直接连接。v0.165.0 起，当本地调用因超时或回合中断被取消时，Codex 会同步向远程 MCP 服务器发送取消请求。

## 通用字段

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `enabled` | `true` | 设为 `false` 可停用服务器而保留配置 |
| `required` | `false` | 设为 `true` 后，这个已启用的服务器初始化失败会让启动或恢复会话失败，`codex exec` 也会报错退出 |
| `startup_readiness` | `connection` | 启动时怎样才算就绪（v0.158.0 起）：`connection` 以实时连接为准；`catalog` 允许先用缓存的工具目录，见表后说明 |
| `startup_timeout_sec` | 30 | 启动服务器并初次列出工具的超时（秒）；`startup_timeout_ms` 是毫秒写法 |
| `tool_timeout_sec` | 300 | 单次工具调用的超时（秒） |
| `enabled_tools` | 不限 | 工具白名单，设置后只注册这些工具 |
| `disabled_tools` | 无 | 工具黑名单，在 `enabled_tools` 之后应用 |
| `default_tools_approval_mode` | `auto` | 这个服务器的工具何时需要确认，取值见下表 |
| `tools.<工具名>.approval_mode` | 同上 | 单个工具的审批方式，覆盖默认值 |
| `tools.<工具名>.output_token_limit` | 模型默认 | 单个工具输出的 token 预算（正整数），另加 20% 的序列化余量（v0.152.0 起） |
| `supports_parallel_tool_calls` | `false` | 设为 `true` 表示这个服务器的所有工具都可以并行调用 |
| `tool_input_schema_max_bytes` | 5000 | 单个工具输入 schema 的压缩阈值（UTF-8 字节，v0.158.0 起）；超出时 Codex 会逐步删去说明文字、类型定义等来压缩，调大可保留更多参数说明 |

v0.158.0 起，配置了 `startup_readiness = "catalog"` 的服务器，实时连接还没就绪时可以先用同一进程里 30 分钟内缓存的工具目录（至少含一个可用工具）把工具提供给模型，真正执行工具仍需当前连接。它主要配合 `required = true`：有可用的缓存目录就算满足启动要求，连接失败改到调用工具时才报告。通过 OAuth 或 ChatGPT 会话认证、或使用 `http_headers_helper` 的 HTTP 服务器不缓存工具目录，这个设置对它们不起作用。

仍在开发中的 Code Mode 渲染工具输入类型时另有预算（v0.158.0 起）：取 16000、`features.code_mode.tool_input_schema_max_bytes` 与服务器上显式设置的 `tool_input_schema_max_bytes` 三者中的较大值。

::: info

官方文档写的默认超时是启动 10 秒、工具调用 60 秒；v0.167.0 源码（`codex-rs/codex-mcp/src/rmcp_client.rs`）里的默认值是 30 秒与 300 秒，本页以源码为准。对超时敏感时，建议在配置里显式写出。

:::

审批方式依据工具声明的 MCP 注解（`readOnlyHint`、`destructiveHint`、`openWorldHint`）判断：

| 取值 | 何时需要确认 |
| --- | --- |
| `auto` | 声明破坏性的要确认；声明只读的不用；同时声明非破坏性、非开放世界的也不用；没有注解的要确认 |
| `prompt` | 每次调用都要确认 |
| `writes` | 只有声明只读的工具免确认 |
| `approve` | 从不确认 |

与审批相关的其他设置见[沙箱、审批与安全](/manual/agent/codex/sandbox-approvals)。

## 全局设置

| 键 | 默认值 | 说明 |
| --- | --- | --- |
| `mcp_optional_startup_grace_ms` | `1000` | 构建首轮工具列表时等待非必需服务器的宽限时间（毫秒）；设为 `0` 则等满各服务器的 `startup_timeout_sec`（v0.151.0 起） |
| `mcp_oauth_credentials_store` | `auto` | OAuth 凭据存放处：`auto` 优先用系统钥匙串，不可用时退回文件；`file` 存到 `~/.codex/.credentials.json`；`keyring` 只用钥匙串 |
| `mcp_oauth_callback_port` | 系统分配 | OAuth 回调的本地监听端口，单个服务器的 `oauth.callback_port` 优先 |
| `mcp_oauth_callback_url` | 未设置 | 自定义回调地址，例如远程开发机的入口 URL；未设置时用 `http://127.0.0.1/callback` |

## 插件提供的 MCP 服务器

已安装的[插件](/manual/agent/codex/plugins)可以自带 MCP 服务器。它们的启动方式由插件决定，用户配置只能控制开关与工具策略，写在 `plugins.<插件>.mcp_servers.<服务器>` 下：

```toml
[plugins."sample@test".mcp_servers.sample]
enabled = true
default_tools_approval_mode = "prompt"
enabled_tools = ["read", "search"]

[plugins."sample@test".mcp_servers.sample.tools.search]
approval_mode = "approve"
```

插件的 `.mcp.json` 也可以给 HTTP 服务器声明 OAuth 设置，字段用驼峰写法 `clientId`、`callbackUrl`、`callbackPort`，v0.158.0 起还支持 `clientSecret`。

## codex mcp 命令

| 命令 | 作用 |
| --- | --- |
| `codex mcp add <名字> -- <命令> [参数...]` | 添加 stdio 服务器；`--env KEY=VALUE` 可重复 |
| `codex mcp add <名字> --url <URL>` | 添加 HTTP 服务器；可选 `--bearer-token-env-var`、`--oauth-client-id`、`--oauth-client-secret`（v0.158.0 起）、`--oauth-client-registration`、`--oauth-resource` |
| `codex mcp list [--json]` | 列出全部服务器，stdio 与 HTTP 分两张表，含启用状态与认证状态 |
| `codex mcp get <名字> [--json]` | 查看单个服务器的配置 |
| `codex mcp remove <名字>` | 删除服务器条目 |
| `codex mcp login <名字>` | 对 HTTP 服务器发起 OAuth 登录；`--scopes a,b` 指定 scope，`--oauth-client-registration auto\|cimd\|dcr` 只影响本次登录，`--no-browser` 不打开浏览器、改为手动粘贴回调地址（v0.156.0 起） |
| `codex mcp logout <名字>` | 删除该服务器已保存的 OAuth 凭据 |

```bash
# stdio：-- 之后是启动命令
codex mcp add context7 -- npx -y @upstash/context7-mcp
codex mcp add my-db --env DB_URL=postgres://localhost/dev -- node ./mcp-server.js

# HTTP：token 从环境变量读取
codex mcp add docs --url https://mcp.example.com/mcp --bearer-token-env-var DOCS_TOKEN

# 预注册的 OAuth 客户端，服务商要求时再带上客户端密钥（v0.158.0 起）
codex mcp add private --url https://mcp.example.com/mcp --oauth-client-id my-client --oauth-client-secret "$CLIENT_SECRET"

codex mcp login docs
codex mcp list --json
```

- `add` 与 `remove` 只改全局的 `~/.codex/config.toml`，项目级服务器需要手动编辑 `.codex/config.toml`。
- 添加 HTTP 服务器时，`add` 会先探测服务器：检测到 OAuth 支持就立即开始登录；无法判断时提示你再运行 `codex mcp login`。

## OAuth 登录

- **客户端注册**：默认 `auto`，授权服务器声明支持 CIMD（Client ID Metadata Document）时用 CIMD，否则在可用时用 DCR（动态客户端注册）。配置了 `oauth.client_id` 就跳过注册。
- **预注册客户端**：用 `--oauth-client-id` 添加时，Codex 会打印要到服务商处登记的完整回调地址，并与 client ID 一起写进 `[mcp_servers.<名字>.oauth]`。
- **客户端密钥**：v0.158.0 起，服务商要求预注册客户端提供密钥时，添加服务器时再加 `--oauth-client-secret`（必须同时给出 `--url` 与非空的 `--oauth-client-id`，密钥不能为空），或直接在 `[mcp_servers.<名字>.oauth]` 里写 `client_secret`。密钥只在换取和刷新令牌时发送，不会存进 OAuth 凭据存储，但会以明文保存在 `config.toml` 中，含密钥的配置不要提交到仓库。配置了密钥后，如果 `client_id` 与已保存凭据里的不一致，需要重新登录。
- **scope 优先级**：`--scopes` 参数 > 配置里的 `scopes` > 服务器声明的 `scopes_supported`；服务商拒绝自动发现的 scope 时，Codex 会去掉 scope 再试一次。
- **没有本地浏览器**：v0.156.0 起可以用 `codex mcp login <名字> --no-browser`。Codex 只打印授权链接，你在任意设备的浏览器里完成授权，再把授权完成后跳转到的回调地址从地址栏整个复制、粘贴回终端（输入不回显，按 `Ctrl+C` 取消）；在此期间本地回调仍然有效，谁先到用谁。
- **授权端点**：v0.157.0 起只接受 `http` 与 `https` 协议的授权端点，其他协议在注册客户端之前就会被拒绝；OAuth 元数据发现返回 503 时，v0.156.0 起会改用 OIDC 发现。
- **令牌刷新**：v0.154.0 起 MCP 连接会协调 OAuth token 的刷新；刷新失败时提示重新登录，不会自动重放被拒绝的工具调用。
- **令牌过期**：v0.155.0 起，access token 已过期又刷新失败时，`/mcp` 里该服务器的认证状态显示为未登录，工具调用会收到“MCP authentication required. Reconnect to continue using this server.”的提示；运行 `codex mcp login <名字>` 或在会话中直接执行 `/mcp login <名字>`（v0.161.0 起）重新登录即可。

## Touch ID 身份验证

v0.155.0 起，在支持 Touch ID 的 Mac 上，本地 TUI 会话可以用 Touch ID 完成 Codex Apps（连接器）发起的身份验证请求：TUI 弹出验证提示，你确认后用 Touch ID 签名，再把结果交回原来的请求。只有 Codex 内置的 Apps 服务能发起这种请求，你自己配置的 MCP 服务器即使同名，发起的验证请求也会被直接取消；远程工作区暂不支持。

## 在会话里查看与登录

- `/mcp`：列出已配置的 MCP 工具与认证状态。
- `/mcp verbose`：显示每个服务器的工具、资源等完整信息。
- `/mcp login <名字>`：在不退出当前 TUI 会话的情况下，直接对指定的 MCP 服务器发起 OAuth 登录（v0.161.0 起）。

## 常见问题

1. **首轮看不到某个服务器的工具**：Codex 构建首轮工具列表时只等非必需服务器约 1 秒。可以调大 `mcp_optional_startup_grace_ms`，或给该服务器设 `required = true`；启动本身就慢的，再调大 `startup_timeout_sec`。
2. **HTTP 服务器提示未授权**：运行 `codex mcp login <名字>`，再看 `codex mcp list` 的 Auth 列确认状态。
3. **项目里的 `.codex/config.toml` 没生效**：项目未被信任时不会加载项目级配置。

## Codex 作为 MCP 服务器（已移除）

v0.154.0 移除了已弃用的 `codex mcp-server` 命令和独立的 `codex-mcp-server` 二进制。过去通过这两个入口、用 MCP 工具调用驱动 Codex 的集成，升级前必须迁移到 app server（`codex app-server`）。

app server 使用自己的 JSON-RPC 协议，负责认证、对话历史、审批与流式事件。它不是 MCP 服务器，也不能直接替换 MCP 调用，集成方需要改用 app server 协议；该命令目前仍标记为实验性。详见 [SDK 与 App Server](/manual/agent/codex/sdk-app-server)。
