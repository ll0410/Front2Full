---
title: "状态行"
description: "HTTP-version、status-code 三位数字、reason-phrase——响应起始行逐字段解析。"
source: "https://daiw.org/manual/http11/status-line"
---

# 状态行

## 语法

```text
status-line   = HTTP-version SP status-code SP reason-phrase
status-code   = 3DIGIT
reason-phrase = 1*( HTAB / SP / VCHAR / obs-text )
```

```text
HTTP/1.1 404 Not Found
```

三段之间**各恰好一个 SP**。注意 `reason-phrase` 在 ABNF 里是 `1*`，但实践中允许为空——此时形如 `HTTP/1.1 200` （状态码后仍有一个 SP）。

## status-code

**恰好三位数字**，不多不少。首位决定类别：

| 类别 | 含义 | 客户端对未知码的处理 |
| --- | --- | --- |
| `1xx` | 信息性，中间响应 | 忽略该中间响应，继续等最终响应 |
| `2xx` | 成功 | 当作 `200` |
| `3xx` | 重定向 | 当作 `300`（不自动跟随） |
| `4xx` | 客户端错误 | 当作 `400` |
| `5xx` | 服务端错误 | 当作 `500` |

**关键规则**：客户端 **MUST** 理解类别，但**不必**理解每个具体码；遇到不认识的状态码时，按该类别的 `x00` 处理。这使得新增状态码无需改造客户端。首位为 `0` 或 `6`–`9` 的码非法。

具体每个码的触发条件见[状态码](/manual/computer-programming/http11/status-codes)。

## reason-phrase

纯人类可读描述，**无语义**。要点：

-   客户端 **MUST NOT** 依据它做任何逻辑判断——只看状态码。
-   服务端可自定义甚至置空；`HTTP/1.1 200 OK` 与 `HTTP/1.1 200 Yay` 完全等价。
-   允许 `obs-text`（0x80–0xFF），但编码未定义，不应使用非 ASCII。
-   HTTP/2 与 HTTP/3 中该字段**已彻底移除**——它不携带信息，是纯历史遗留。

## 1xx 的特殊性

`1xx` 是**中间响应**：一次请求可先收到零或多个 `1xx`，最后才是唯一的最终响应（`2xx`–`5xx`）。

-   `1xx` 响应**终止于其后的空行，且恒无消息体**——不受 `Content-Length` 影响。
-   HTTP/1.0 客户端不认识 `1xx`，服务端 **MUST NOT** 向其发送。

| 码 | 语义 |
| --- | --- |
| `100 Continue` | 已收到请求头，客户端可继续发送请求体。配合 `Expect: 100-continue` 使用 |
| `101 Switching Protocols` | 服务端同意按 `Upgrade` 切换协议（WebSocket 握手即用此码） |
| `102 Processing` | （WebDAV，RFC 2518）已废弃 |
| `103 Early Hints` | 先行给出 `Link` 等预加载提示，最终响应随后到达 |

## 与消息体的关系

状态码直接决定响应**能否有体**，且优先级高于 `Content-Length`：

| 状态码 | 消息体 |
| --- | --- |
| `1xx` | **恒无** |
| `204 No Content` | **恒无** |
| `304 Not Modified` | **恒无**（但可带 `Content-Length`，指代若返回 200 时的长度，接收方不得据此读体） |
| `2xx` 对 CONNECT | 无体；其后字节属于隧道 |
| 其余 | 由成帧规则决定 |

对 **HEAD** 请求的响应恒无体，与状态码无关——但其头字段应与对应 GET 一致。详见[消息体长度](/manual/computer-programming/http11/message-body-length)。

下一篇：[字段行语法](/manual/computer-programming/http11/field-syntax)——字段名、值、OWS 与重复字段的合并规则。
