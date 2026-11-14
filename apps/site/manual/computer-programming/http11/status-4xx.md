---
title: "状态码：4xx 客户端错误"
description: "400–451 每个码的精确触发条件，以及易混对（401/403、400/422、409/412）的判定标准。"
source: "https://daiw.org/manual/http11/status-4xx"
---

# 状态码：4xx 客户端错误

4xx 表示**请求有问题**，除响应 `HEAD` 外 **SHOULD** 带解释性消息体。服务端 **SHOULD** 在无法确定客户端能否理解时保守选择更通用的码。

## 400 Bad Request

请求本身语法或成帧有误，服务端**无法或拒绝**处理。

明确要求返回 `400` 的场景（均为 MUST 级）：

-   缺少 `Host`，或多于一个 `Host`。
-   字段名与冒号间有空白。
-   多个不一致的 `Content-Length`。
-   请求中 `Transfer-Encoding` 的最后一个编码不是 `chunked`。
-   收到 obs-fold（非 `message/http` 场景）。
-   `PUT` 带 `Content-Range`。

**误用警告**：业务校验失败（字段值不合法但报文语法正确）**不该**返回 `400`——应用 `422`。`400` 属于「报文层」错误。

## 401 Unauthorized

**未认证**或认证凭据无效。

-   **MUST** 带 `WWW-Authenticate` 字段给出挑战，否则违反规范（客户端无从得知该怎么认证）。
-   客户端可携带 `Authorization` 重试。

与 `403` 的判定标准：**`401` = 我不知道你是谁（换个身份可能行）；`403` = 我知道你是谁，但你不行（换凭据没用）**。

## 402 Payment Required

保留码，无标准语义。部分 API 用于配额/欠费，非标准用法。

## 403 Forbidden

服务端理解请求但**拒绝授权**，且重新认证无济于事。

-   与 `401` 的区别见上。
-   若不想暴露资源存在性（避免枚举），**SHOULD** 返回 `404` 而非 `403`。
-   不必带 `WWW-Authenticate`。

## 404 Not Found

无匹配的目标资源，且不透露该情况是暂时还是永久。**默认可缓存**——需注意误缓存。

## 405 Method Not Allowed

方法被目标资源禁止。**MUST** 带 `Allow` 列出允许的方法。与 `501` 的区别见[方法](/manual/computer-programming/http11/methods)。

## 406 Not Acceptable

按请求的[主动协商](/manual/computer-programming/http11/content-negotiation)字段（`Accept` 等）找不到可接受的表示。

-   规范允许服务端**忽略协商失败直接返回其首选表示**，这在实践中更常见——`406` 会让客户端彻底拿不到内容。
-   返回 `406` 时 **SHOULD** 在体中列出可用表示。

## 407 Proxy Authentication Required

同 `401`，但针对**代理**。**MUST** 带 `Proxy-Authenticate`；客户端用 `Proxy-Authorization` 重试。这组字段是**逐跳**的。

## 408 Request Timeout

客户端在服务端愿意等待的时间内**未发完请求**。

-   **SHOULD** 带 `Connection: close`。
-   与 `504` 无关（那是网关等上游超时）。

## 409 Conflict

请求与目标资源**当前状态**冲突，且冲突可能由客户端自行解决。

-   典型：版本冲突、并发编辑、`DELETE` 一个非空容器。
-   体 **SHOULD** 说明冲突原因以便客户端修正后重试。
-   与 `412` 的区别：`412` 是**客户端显式给了前置条件且未满足**；`409` 是资源自身状态不允许，无关前置条件。

## 410 Gone

资源**曾经存在、已永久移除**，且无转发地址。默认可缓存。

与 `404` 的区别纯粹是「是否愿意承诺永久性」。不确定时用 `404`。

## 411 Length Required

服务端拒绝无 `Content-Length` 的请求。客户端补上该字段后可重试。若客户端用了 `chunked` 而服务端不支持，也走这个码。

## 412 Precondition Failed

一个或多个[条件请求](/manual/computer-programming/http11/conditional-requests)前置条件求值为**假**（如 `If-Match` 的 ETag 不匹配）。

用于乐观并发控制：客户端带 `If-Match: "v1"` 提交，资源已变为 `"v2"` 时返回 `412`，避免丢失更新。

## 413 Content Too Large

请求体超出服务端**愿意或能够**处理的上限。

-   若是暂时性限制，**SHOULD** 带 `Retry-After`。
-   曾名 `Payload Too Large`（RFC 7231）与 `Request Entity Too Large`（RFC 2616）。

## 414 URI Too Long

request-target 超长。默认可缓存。常因把大量数据塞进 query 触发——改用 `POST`。

## 415 Unsupported Media Type

请求体的**格式**不被目标资源支持。

-   因 `Content-Type` 不支持 → **SHOULD** 带 `Accept` 列出支持的类型。
-   因 `Content-Encoding` 不支持 → **SHOULD** 带 `Accept-Encoding`。
-   `PATCH` 的补丁格式不支持也用此码，可配 `Accept-Patch`。

## 416 Range Not Satisfiable

`Range` 中所有范围都超出当前表示长度。

-   **SHOULD** 带 `Content-Range: bytes */<完整长度>` 告知实际长度。
-   注意：若**部分**范围可满足，服务端应返回 `206` 而非 `416`；无法满足时也可直接忽略 `Range` 返回 `200`。

## 417 Expectation Failed

`Expect` 字段中的期望无法被满足（含服务端不认识的期望值）。

## 418 I'm a Teapot

RFC 2324（愚人节玩笑协议 HTCPCP）。**不是 HTTP 状态码**，IANA 已将 418 保留以防误用。生产勿用。

## 421 Misdirected Request

请求被发到**无法产生响应**的服务器——该服务器未被配置为该 authority 提供服务。

主要场景：HTTP/2 连接复用时，客户端复用了一条 TLS 连接向不同 authority 发请求。客户端收到后 **MAY** 换新连接重试。

## 422 Unprocessable Content

语法正确、`Content-Type` 支持，但**语义上无法处理**（业务校验失败）。

这是 API 返回参数校验错误的正确码，不是 `400`。RFC 4918 引入，RFC 9110 已纳入核心。

## 423 / 424 / 425 / 426

| 码 | 名称 | 语义 |
| --- | --- | --- |
| `423` | Locked | WebDAV，资源被锁定 |
| `424` | Failed Dependency | WebDAV，依赖的前序操作失败 |
| `425` | Too Early | RFC 8470，拒绝处理 TLS 早期数据（0-RTT）中的请求，防重放 |
| `426` | Upgrade Required | 必须升级协议。**MUST** 带 `Upgrade` 字段 |

## 428 Precondition Required

RFC 6585。服务端要求请求**必须**带前置条件——强制客户端使用 `If-Match` 以避免丢失更新。

## 429 Too Many Requests

RFC 6585。超出速率限制。**SHOULD** 带 `Retry-After`。

```text
Retry-After = HTTP-date / delay-seconds
```

两种形式：`Retry-After: 120`（秒）或 `Retry-After: Wed, 21 Oct 2026 07:28:00 GMT`。

## 431 Request Header Fields Too Large

RFC 6585。字段区总量或单个字段过大。可只针对单个超限字段返回，体中应指明是哪个。

## 451 Unavailable For Legal Reasons

RFC 7725。因法律要求不可用。**SHOULD** 带 `Link` 字段（`rel="blocked-by"`）指向实施封锁的实体。与 `403` 的区别是明确归因于法律而非授权。

下一篇：[状态码：5xx 服务端错误](/manual/computer-programming/http11/status-5xx)。
