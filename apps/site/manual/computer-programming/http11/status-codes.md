---
title: "状态码：1xx 与 2xx"
description: "状态码注册规则、可缓存码集合，以及信息性与成功类每个码的精确触发条件。"
source: "https://daiw.org/manual/http11/status-codes"
---

# 状态码：1xx 与 2xx

## 注册与扩展规则

状态码是**三位数字**，首位定类别。核心码由 RFC 9110 定义，其余散见于 WebDAV（RFC 4918）等扩展并登记在 IANA 注册表。

三条硬规则：

1.  客户端 **MUST** 理解类别，**不必**理解具体码；不认识的码按该类别的 `x00` 处理（见[状态行](/manual/computer-programming/http11/status-line)）。
2.  缓存 **MUST NOT** 缓存不认识的状态码的响应，除非有显式的 `Cache-Control` 允许。
3.  新增状态码**不得**要求客户端改造——这正是规则 1 存在的原因。

## 默认可缓存的状态码

以下码的响应在**无显式缓存指令时**也可被缓存（「heuristically cacheable」）：

`200`、`203`、`204`、`206`、`300`、`301`、`308`、`404`、`405`、`410`、`414`、`501`

其余状态码**必须**有显式 `Cache-Control`/`Expires` 才可存储。注意 `404`、`410` 在列——这是「删掉的页面仍返回旧 404」的常见成因，必要时用 `Cache-Control: no-store` 覆盖。

## 1xx：信息性

**中间响应**，其后必有最终响应。恒无消息体，**MUST NOT** 发给 HTTP/1.0 客户端。

### 100 Continue

服务端愿意接收请求体，客户端应继续发送。仅在客户端发了 `Expect: 100-continue` 时产生。

-   服务端已开始读取请求体后 **MUST NOT** 再发 `100`。
-   客户端超时未收到时可直接发体，不算错误。
-   详见 [Expect 与 100-continue](/manual/computer-programming/http11/connection-management)。

### 101 Switching Protocols

服务端同意按 `Upgrade` 切换协议，**MUST** 带 `Upgrade` 字段指明切到什么。响应结束后连接按新协议解释。WebSocket 握手的标准响应码。

### 102 Processing

WebDAV（RFC 2518）。表示「仍在处理，别超时」。已在 RFC 4918 中被移除，不应新用。

### 103 Early Hints

RFC 8297。在最终响应前先发 `Link` 等提示，让客户端提前预加载资源。

-   只携带**提示性**头字段，客户端 **MUST NOT** 把它当最终响应的头。
-   最终响应可能与提示不一致（如实际返回 `404`），客户端需容忍。

## 2xx：成功

### 200 OK

请求成功，语义随方法而异：`GET` 返回资源表示、`POST` 返回处理结果、`PUT`/`DELETE` 返回状态描述。默认可缓存。

### 201 Created

已新建一个或多个资源。

-   **SHOULD** 带 `Location` 指向主要新资源；无 `Location` 时以请求 URI 为准。
-   响应中的验证器字段（`ETag`、`Last-Modified`）描述的是**新建资源**的表示。

### 202 Accepted

已受理但**未完成**，且不保证最终完成。用于异步处理。

-   响应体应说明当前状态与查询进度的方式（如带轮询 URI）。
-   这是「故意不承诺」的码——不能用它表示「已成功」。

### 203 Non-Authoritative Information

`200` 的变体：返回的载荷被**中间代理修改过**（如转码、注入），不再来自源服务器。默认可缓存。极少使用。

### 204 No Content

成功，且**无消息体**（恒无，见成帧规则）。

-   可带验证器（`ETag`）表示新状态。
-   语义：「已完成，页面不必跳转、不必刷新」。表单提交与 `DELETE` 常用。
-   与 `205` 的区别：`204` 不要求客户端做任何界面动作。

### 205 Reset Content

成功，且要求客户端**重置**引发该请求的文档视图（如清空表单）。

-   **MUST NOT** 有消息体（应发 `Content-Length: 0` 或空 chunked 体）。

### 206 Partial Content

范围请求成功，体是所请求范围的一部分。

-   单范围：**MUST** 带 `Content-Range`，`Content-Length` 为该范围长度。
-   多范围：体为 `multipart/byteranges`，`Content-Type` 指明 boundary，**不带**顶层 `Content-Range`。
-   详见[范围请求](/manual/computer-programming/http11/range-requests)。

### 207 / 208 / 226

-   `207 Multi-Status`（RFC 4918）：WebDAV，体为 XML，内含多个独立状态。
-   `208 Already Reported`（RFC 5842）：WebDAV 绑定去重。
-   `226 IM Used`（RFC 3229）：增量编码，实际几乎无部署。

下一篇：[状态码：3xx 重定向](/manual/computer-programming/http11/status-3xx)。
