---
title: "HTTP/2 总览"
description: "h2 改了什么、没改什么，以及 ALPN 协商与 h2c 的废弃。"
source: "https://daiw.org/manual/http2-3/h2-overview"
---

# HTTP/2 总览

h2 改了什么、没改什么，以及 ALPN 协商与 h2c 的废弃。

## 改了什么

HTTP/2 **只替换 RFC 9112 那一层**——报文成帧与连接管理。对照 [1.1 的报文结构](/manual/computer-programming/http11/message-format)：

| 1.1 的机制 | h2 的替代 |
| --- | --- |
| 文本 start-line + 字段行 + CRLF | **二进制帧**（9 字节定长头） |
| `Content-Length` / `chunked` 定界 | 帧头的 Length 字段 + `END_STREAM` 标志 |
| 一连接一请求（或串行流水线） | **流（stream）多路复用** |
| 明文重复的字段 | **HPACK** 压缩 + 跨请求的动态表 |
| `Connection`、`Keep-Alive`、`Upgrade` | 连接级帧（`SETTINGS`、`GOAWAY`、`PING`） |
| `reason-phrase` | **删除**（无语义） |

## 没改什么

以下在 h2 上**逐字不变**，全部来自 RFC 9110：

- 方法及其安全性/幂等性/可缓存性
- 状态码（含三位数字与类别规则）
- 字段语义：`Content-Type`、`ETag`、`Cache-Control`、`Vary`、`Authorization`、`Cookie`…
- [条件请求](/manual/computer-programming/http11/conditional-requests)、[范围请求](/manual/computer-programming/http11/range-requests)、[缓存](/manual/computer-programming/http11/caching)、[认证](/manual/computer-programming/http11/authentication)全部规则

**一个 1.1 请求与其 h2 等价物在语义上完全相同**，可以无损互转——这正是代理能在两版之间转换的前提。

## 一个请求的形态对比

1.1：

```http
GET /index.html HTTP/1.1
Host: example.com
Accept: text/html
```

h2 逻辑等价（`HEADERS` 帧内经 HPACK 编码的字段列表）：

```text
:method: GET
:scheme: https
:authority: example.com
:path: /index.html
accept: text/html
```

三处关键差异：

1. **起始行拆成了[伪头字段](/manual/computer-programming/http2-3/h2-pseudo-headers)**（`:` 开头）。
2. **`Host` 变成 `:authority`**。
3. **字段名必须小写**——h2 中大写字母是协议错误，不是风格问题。

## 版本标识与协商

h2 **不使用** 1.1 的 `Upgrade` 机制协商（见下），而是靠 **ALPN**（TLS 扩展）在握手时直接选定：

| ALPN 标识 | 含义 |
| --- | --- |
| `h2` | HTTP/2 over TLS |
| `h2c` | HTTP/2 over 明文 TCP |
| `http/1.1` | HTTP/1.1 |

要点：

- **浏览器只支持 `h2`（TLS）**，从不支持明文 h2c。规范上 h2 不强制 TLS，实践中等于强制。
- ALPN 在 TLS 握手中完成，**不增加往返**——这是它取代 `Upgrade` 的核心优势。
- 选定 `h2` 后，客户端立即发[连接前言](/manual/computer-programming/http2-3/h2-connection)。

### h2c 与 Upgrade 的废弃

RFC 7540 曾定义用 1.1 的 `Upgrade: h2c` 升级到明文 h2：

```http
GET / HTTP/1.1
Host: example.com
Connection: Upgrade, HTTP2-Settings
Upgrade: h2c
HTTP2-Settings: <base64url 编码的 SETTINGS>
```

**RFC 9113 已废弃该机制**，连同 `HTTP2-Settings` 字段一并移除。原因：几乎无部署（浏览器不支持）、且给中间件带来额外的协议混淆面。

现状：明文 h2 只能靠**先验知识**（客户端已知服务端支持，直接发前言）建立，主要用于内网 gRPC 等场景。

## TLS 要求

h2 over TLS 有额外硬约束（超出普通 TLS 要求）：

- **MUST** 使用 TLS 1.2 及以上。
- **MUST** 禁用压缩与可重协商（renegotiation）。
- 有**密码套件黑名单**：使用被禁套件时，端点 **MAY** 以 `INADEQUATE_SECURITY` 错误关闭连接。实践中要求前向安全 + AEAD（如 `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`）。
- 服务端 **MUST** 支持 SNI。

## 代价

h2 不是纯收益，两个真实代价：

1. **TCP 层队头阻塞仍在**。h2 消除了 HTTP 层的队头阻塞，但所有流共享**一条 TCP 连接**——一个 TCP 段丢失，内核在重传补齐前**不会**把后续数据交给应用，此时所有流一起卡住。丢包率高的网络下，h2 可能**比**多条 1.1 连接**更慢**。这正是 [HTTP/3](/manual/computer-programming/http2-3/h3-overview) 存在的唯一理由。
2. **实现复杂度剧增**。状态机、流量控制、HPACK 动态表同步都可能出错，也带来了新的攻击面（如 HPACK 炸弹、`RST_STREAM` 洪泛的 Rapid Reset）。

下一篇：[二进制分帧层](/manual/computer-programming/http2-3/h2-framing)。
