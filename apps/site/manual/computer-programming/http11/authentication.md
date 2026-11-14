---
title: "认证"
description: "challenge/credentials 语法、realm、token68、Basic 与 Bearer 方案及代理认证字段。"
source: "https://daiw.org/manual/http11/authentication"
---

# 认证

## 四个核心字段

| 字段 | 方向 | 配对状态码 | 性质 |
| --- | --- | --- | --- |
| `WWW-Authenticate` | 响应 | `401` | 端到端 |
| `Authorization` | 请求 | — | 端到端 |
| `Proxy-Authenticate` | 响应 | `407` | **逐跳** |
| `Proxy-Authorization` | 请求 | — | **逐跳** |

代理认证字段**不得**被转发，必须在每一跳独立处理。

## 挑战语法

```text
WWW-Authenticate = #challenge
challenge   = auth-scheme [ 1*SP ( token68 / #auth-param ) ]
auth-scheme = token
auth-param  = token BWS "=" BWS ( token / quoted-string )
token68     = 1*( ALPHA / DIGIT / "-" / "." / "_" / "~" / "+" / "/" ) *"="
```

```text
WWW-Authenticate: Basic realm="Admin Area", charset="UTF-8"
WWW-Authenticate: Bearer realm="api", error="invalid_token"
WWW-Authenticate: Newauth realm="apps", Basic realm="simple"
```

解析要点：

-   `auth-scheme` 与其后内容之间是 **1 个或多个 SP**，不是 OWS。
-   **`token68` 与 `auth-param` 二选一**，不可混用。
-   多个挑战用逗号分隔——这使解析变得棘手：逗号既分隔挑战、也分隔同一挑战内的参数。解析器**必须**靠「是否形如 `scheme SP`」来判断新挑战的起点。
-   `401` 响应 **MUST** 带至少一个挑战。
-   客户端**应**选择自己支持的**最强**方案，而非第一个。

### realm 参数

-   **所有方案通用**的唯一保留参数，定义受保护空间。
-   值 **MUST** 是 `quoted-string`（不可用裸 token），且**大小写敏感**。
-   客户端据 `(origin, realm)` 决定复用哪份凭据。
-   `Bearer` 中 `realm` 可选。

## 凭据语法

```text
Authorization = credentials
credentials   = auth-scheme [ 1*SP ( token68 / #auth-param ) ]
```

`auth-scheme` **大小写不敏感**（`basic` == `Basic`）；参数名不敏感，参数值除非另有规定否则敏感。

## Basic

RFC 7617。

```text
credentials = "Basic" SP token68
token68     = base64( user-id ":" password )
```

```text
Authorization: Basic YWxhZGRpbjpvcGVuc2VzYW1l
```

约束：

-   `user-id` **不得含冒号**——第一个冒号即分隔符，密码中的冒号合法。
-   编码字符集历史上未定义（多为 ISO-8859-1），服务端可用挑战中的 `charset="UTF-8"` 声明期望 UTF-8。该参数**只允许**取值 `UTF-8`。
-   **Base64 不是加密**——明文等价。必须在 TLS 上使用。
-   客户端可在收到 `401` 前**抢先**发送（避免额外往返），Basic 是少数支持抢先认证的方案。

## Bearer

RFC 6750。

```text
Authorization: Bearer mF_9.B5f-4.1JqM
WWW-Authenticate: Bearer realm="api", error="invalid_token",
                  error_description="The access token expired"
```

-   令牌是 `token68`，持有即可用（bearer = 持票人）——**必须** TLS 传输。
-   错误参数：`invalid_request`（→ `400`）、`invalid_token`（→ `401`）、`insufficient_scope`（→ `403`）。
-   **MUST NOT** 把令牌放进 URI query——会进日志、Referer 与浏览器历史。

## Digest（已不推荐）

RFC 7616。用挑战-应答避免明文传输密码，参数含 `nonce`、`qop`、`algorithm`、`opaque` 等。

现状：实现复杂、与现代密码存储（服务端需存可逆或特定哈希）冲突、且 TLS 已解决明文问题。**新系统不应使用**，改用 TLS + Bearer/OAuth2。

## Authentication-Info

```text
Authentication-Info = #auth-param
```

在**成功**响应中携带认证相关的补充信息（如 Digest 的 `nextnonce`、双向认证的服务端应答）。对应的代理版是 `Proxy-Authentication-Info`。

## 安全约束（MUST 级）

-   凭据**跨 origin 重定向时 MUST NOT 携带**。跳到不同 origin 必须重新认证。
-   带 `Authorization` 的请求，其响应**默认不可被共享缓存存储**（见[缓存](/manual/computer-programming/http11/caching)）；需存储时必须显式 `public`/`s-maxage`/`must-revalidate`。
-   `401` 与 `403` 的选择见[状态码 4xx](/manual/computer-programming/http11/status-4xx)：能换凭据解决用 `401`，换了也没用用 `403`。
-   认证失败的响应**不应**泄露「用户不存在」与「密码错误」的区别。

下一篇：[Cookie](/manual/computer-programming/http11/cookies)——Set-Cookie 属性全集与安全前缀。
