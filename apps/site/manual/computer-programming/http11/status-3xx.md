---
title: "状态码：3xx 重定向"
description: "301/302/303/307/308 的方法改写差异、Location 解析规则与 300/304 的特殊语义。"
source: "https://daiw.org/manual/http11/status-3xx"
---

# 状态码：3xx 重定向

## Location

```text
Location = URI-reference
```

3xx 的核心字段。要点：

-   值可以是**相对引用**，接收方 **MUST** 以请求的目标 URI 为基准解析。
-   值中的 fragment：若 `Location` 自身无 fragment，客户端 **SHOULD** 沿用原请求 URI 的 fragment。
-   `Location` 在 `201` 中语义不同——指新建资源，不是重定向。
-   值**不做**百分号解码；含非 ASCII 时必须先编码为 URI。

## 五个重定向码的差异

唯一需要记的维度是：**后续请求是否保留原方法与请求体**。

| 码 | 语义 | 后续方法 | 缓存 | 引入 |
| --- | --- | --- | --- | --- |
| `301 Moved Permanently` | 永久迁移 | **可改写为 GET**（历史行为） | 默认可缓存 | 早期 |
| `302 Found` | 临时 | **可改写为 GET**（历史行为） | 需显式 | 早期 |
| `303 See Other` | 去别处取结果 | **MUST 改为 GET** | 需显式 | HTTP/1.1 |
| `307 Temporary Redirect` | 临时 | **MUST 保留原方法与体** | 需显式 | HTTP/1.1 |
| `308 Permanent Redirect` | 永久迁移 | **MUST 保留原方法与体** | 默认可缓存 | RFC 7538 |

### 301/302 的方法改写问题

规范原意是保留方法，但**历史实现**普遍把 `POST` 后的 `301`/`302` 改写成 `GET`。RFC 9110 承认这一现实：允许（而非要求）改写。

后果：`301`/`302` 对非 GET 请求的行为**不可预测**。工程结论——

-   需要**确保改为 GET** → 用 `303`。
-   需要**确保保留方法** → 用 `307`（临时）或 `308`（永久）。
-   `301`/`302` 只用于 GET/HEAD 场景。

### 301/308 的缓存影响

两者默认可缓存且常被浏览器**长期持久化**（甚至无 `Cache-Control` 时也硬缓存到磁盘）。误发一次 `301` 到错误目标，用户侧可能长期无法恢复。

生产建议：新上线的永久重定向先用 `302`/`307` 观察，确认无误再改 `301`/`308`；或对 `301` 显式加 `Cache-Control: max-age=<较小值>`。

## 300 Multiple Choices

目标资源有多个表示，供客户端选择（**主动式内容协商**）。

-   **SHOULD** 在体中列出可选表示的清单，格式未规范化。
-   可用 `Location` 指出服务端的首选项。
-   默认可缓存。实际部署极少。

## 304 Not Modified

条件请求命中——客户端的缓存副本仍然有效。**不是重定向**，归在 3xx 是历史分类。

硬性约束：

-   **MUST NOT** 有消息体。响应终止于头后的空行。
-   **MUST** 带若与 `200` 一起发送时会发的验证器：`ETag`、`Last-Modified`（若有）。
-   **SHOULD** 带在同样情况下会发的 `Cache-Control`、`Content-Location`、`Date`、`Expires`、`Vary`。
-   可带 `Content-Length`（指若为 200 时的长度），接收方**不得**据此读体。
-   缓存收到 `304` 后 **MUST** 用响应中的头**更新**已存储的响应，然后把更新后的副本交给客户端。

详见[条件请求](/manual/computer-programming/http11/conditional-requests)。

## 305 与 306

-   `305 Use Proxy`：**已废弃**（RFC 7231 起）。曾要求客户端经指定代理重发，因存在被劫持风险被移除。客户端 **MUST NOT** 遵循它。
-   `306`：**已保留不用**。曾是 `Switch Proxy` 草案，从未标准化。

## 重定向循环

规范**不规定**最大跳数。客户端 **MUST** 自行检测并中断循环（常见上限 20 跳，浏览器多为 20，curl 默认 `--max-redirs 50`）。

跨重定向时的安全要求：

-   跳到**不同 origin** 时，客户端 **MUST NOT** 携带原 `Authorization` 字段。
-   `Cookie` 按各自域的规则重新计算，不是照抄。

下一篇：[状态码：4xx 客户端错误](/manual/computer-programming/http11/status-4xx)。
