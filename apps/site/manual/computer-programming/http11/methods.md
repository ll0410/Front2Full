---
title: "方法"
description: "安全性、幂等性、可缓存性——九个方法的精确语义与请求体约束。"
source: "https://daiw.org/manual/http11/methods"
---

# 方法

## 语法与匹配规则

```text
method = token
```

**大小写敏感**，全大写是注册惯例而非语法要求。服务端匹配方法时**必须**做精确字节比较：收到 `Get` 时不得当作 `GET`。

两个易混的拒绝码：

| 情况 | 状态码 | 附加要求 |
| --- | --- | --- |
| 服务端**根本不实现**该方法 | **501 Not Implemented** | — |
| 方法已实现，但**目标资源**不支持 | **405 Method Not Allowed** | **MUST** 带 `Allow` 字段列出该资源支持的方法 |

```text
Allow = #method
```

`Allow: GET, HEAD, PUT`。空值合法，表示该资源不允许任何方法。

## 三个属性

每个方法有三个正交属性，决定中间件能对它做什么：

-   **安全（safe）**——语义上只读。客户端发起时不期望产生副作用。服务端实际做了什么（如写日志、计数）不影响该分类，因为**责任不在客户端**。
-   **幂等（idempotent）**——同一请求执行 N 次（N ≥ 1）与执行一次对服务器的**预期效果**相同。响应本身可以不同（如 `DELETE` 第二次返回 404）。所有安全方法都幂等。
-   **可缓存（cacheable）**——响应允许被存储并复用。还需状态码本身可缓存且无 `no-store` 等指令。

| 方法 | 安全 | 幂等 | 可缓存 | 请求体 | 响应体 |
| --- | --- | --- | --- | --- | --- |
| `GET` | ✅ | ✅ | ✅ | 不应有 | 有 |
| `HEAD` | ✅ | ✅ | ✅ | 不应有 | **恒无** |
| `POST` | ❌ | ❌ | ⚠️ 仅显式 | 有 | 有 |
| `PUT` | ❌ | ✅ | ❌ | 有 | 可有 |
| `DELETE` | ❌ | ✅ | ❌ | 不应有 | 可有 |
| `CONNECT` | ❌ | ❌ | ❌ | 无 | 无（转隧道） |
| `OPTIONS` | ✅ | ✅ | ❌ | 不应有 | 可有 |
| `TRACE` | ✅ | ✅ | ❌ | **MUST NOT** | 有（回显） |
| `PATCH` | ❌ | ❌ | ⚠️ 仅显式 | 有 | 可有 |

**幂等的工程意义**：连接在收到响应前中断时，客户端**仅可自动重试幂等方法**。`POST`/`PATCH` 的重试必须由上层决策（幂等键、去重表），否则重复下单。

## GET

检索目标资源的当前表示。

-   支持[条件请求](/manual/computer-programming/http11/conditional-requests)与[范围请求](/manual/computer-programming/http11/range-requests)——`GET` 是唯一被要求支持 `Range` 的方法。
-   客户端 **SHOULD NOT** 在 `GET` 中发送请求体：语义未定义，且部分实现直接拒绝（或在代理链上被丢弃，引发走私分歧）。需要复杂查询条件时用 `POST` 或把条件放进 query。
-   成功：`200`。资源无内容时也应是 `200` + 空体或 `204`。

## HEAD

与 `GET` 完全相同，但**响应恒无消息体**。

-   服务端 **SHOULD** 返回与对应 `GET` **相同的头字段**（含 `Content-Length`、`ETag`、`Content-Type`）。此处的 `Content-Length` 指「若为 GET 会返回多长」，接收方**不得**据此读体。
-   用途：检查存在性、验证缓存、读取元数据而不传输体。
-   缓存中 `HEAD` 响应可用于更新已存储的 `GET` 响应的头；若 `Content-Length`/`ETag` 与已存储副本不符，**必须**作废该缓存条目。

## POST

按资源自身语义处理所载荷。它是唯一「语义由目标资源定义」的方法——协议不规定它做什么。

-   不幂等：重复提交产生重复效果。
-   **可缓存性特殊**：`POST` 响应仅在带**显式新鲜度信息**（`Cache-Control: max-age=...` 或 `Expires`）时才可缓存，且后续只能被同 URI 的 `GET`/`HEAD` 命中。绝大多数实现直接不缓存。
-   常见响应：
    -   `201 Created` + `Location` 指向新建资源。
    -   `200`/`204` 表示已处理但未新建。
    -   `303 See Other` + `Location`——POST/Redirect/GET 模式，避免刷新重复提交。

## PUT

用请求体**完整替换**目标资源的表示。

-   幂等：连发 N 次等价于一次。这是与 `POST` 的核心区别，不是「新建 vs 更新」。
-   **必须整体替换**，不做部分更新——部分更新用 `PATCH`。
-   `Content-Range` 在 `PUT` 中**无意义**，服务端收到带 `Content-Range` 的 `PUT` **MUST** 返回 `400`。
-   响应：新建返回 `201`（带 `Location`），覆盖已有返回 `200`/`204`。
-   服务端 **MAY** 忽略或改写客户端发来的验证器相关字段；若存储的表示与请求体不同（如做了规范化），响应 **MUST NOT** 暗示两者一致——应返回 `200` 并说明，或不带 `ETag`。

## DELETE

请求删除目标资源与其 URI 的映射。

-   幂等但**不安全**。第二次 `DELETE` 通常返回 `404`/`410`——响应不同不影响幂等性判定。
-   响应：`204`（已删、无内容）、`200`（已删、返回状态描述）、`202`（已受理、异步删除）。
-   请求体语义未定义，**不应**发送。

## CONNECT

建立到目标 authority 的隧道，用于 HTTPS 经正向代理。

-   目标必须是 [authority-form](/manual/computer-programming/http11/request-line)：`CONNECT host:port HTTP/1.1`，主机端口均不可省。
-   代理返回 `2xx` 后，**该连接上的后续字节不再按 HTTP 解析**，纯双向转发。
-   `2xx` 响应**不得**带 `Transfer-Encoding` 或 `Content-Length`（成帧规则第 2 条）。
-   失败时返回普通错误响应（`403`、`502`、`504`），连接不转隧道。
-   代理 **SHOULD** 限制可 CONNECT 的端口（通常仅 443），否则成为开放中继。

## OPTIONS

查询目标资源或服务器整体的通信选项。

-   `OPTIONS *` 针对**服务器整体**（[asterisk-form](/manual/computer-programming/http11/request-line)）；`OPTIONS /path` 针对该资源。
-   响应 **SHOULD** 带 `Allow`。
-   响应**不可缓存**（无 `Cache-Control` 时不应被存储）。
-   CORS 预检请求即 `OPTIONS` + `Access-Control-Request-*`，但那属于 Fetch 规范而非 HTTP 核心。

## TRACE

回显收到的请求，用于诊断代理链。

-   客户端 **MUST NOT** 在 `TRACE` 中发送请求体，**MUST NOT** 带敏感字段。
-   服务端响应体是**收到的整个请求报文**，`Content-Type: message/http`。
-   与 `Max-Forwards` 配合定位中间跳（见[代理字段](/manual/computer-programming/http11/proxy-fields)）。
-   **安全**：曾用于跨站追踪（XST）读取 `HttpOnly` Cookie，绝大多数生产服务器**默认禁用**（返回 `405`）。规范未要求禁用，但禁用是合理实践。

## PATCH

RFC 5789 定义，不在 RFC 9110 核心方法内。对资源应用**部分修改**。

-   **默认不幂等**——请求体是「修改指令集」，重复应用可能叠加（如 `{"op":"add"}`）。可通过 `If-Match` 变为条件性执行来获得幂等效果。
-   请求体是**补丁文档**，其格式由 `Content-Type` 指定：`application/json-patch+json`（RFC 6902）、`application/merge-patch+json`（RFC 7386）等。**不是**资源的部分表示。
-   服务端 **MUST** 原子应用：要么全部成功，要么全部不改。
-   不支持的补丁格式返回 `415 Unsupported Media Type`；补丁语法合法但无法应用返回 `422 Unprocessable Content`；`If-Match` 不匹配返回 `409`/`412`。
-   服务端可用 `Accept-Patch` 响应字段声明支持的补丁格式。

下一篇：[状态码总览与 1xx/2xx](/manual/computer-programming/http11/status-codes)。
