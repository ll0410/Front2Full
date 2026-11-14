---
title: "连接管理"
description: "Connection、Keep-Alive、Upgrade、Expect——持久连接与逐跳字段的处理规则。"
source: "https://daiw.org/manual/http11/connection-management"
---

# 连接管理

## 持久连接的默认行为

HTTP/1.1 中**持久连接是默认**，无需任何字段声明。与 HTTP/1.0 相反：

| 版本 | 默认 | 关闭方式 | 保持方式 |
| --- | --- | --- | --- |
| HTTP/1.0 | 短连接 | 默认即关 | `Connection: keep-alive` |
| HTTP/1.1 | **持久** | `Connection: close` | 默认 |

任一方都可在**任意时刻**关闭连接，接收方必须能处理。发送 `Connection: close` 表示「这是本连接上的最后一个报文」，发送后 **MUST** 在完成当前报文后关闭。

## Connection

```text
Connection = #connection-option
connection-option = token
```

两个职责，同一个字段：

1.  **列出逐跳字段名**——被列出的字段只对当前连接有效，代理转发前 **MUST** 移除它们及 `Connection` 自身。
2.  **携带 `close` 指令**——`close` 是保留的连接选项，非字段名。

```text
Connection: keep-alive, Upgrade
Connection: close
```

值**大小写不敏感**。

### 恒为逐跳的字段

即使未被 `Connection` 列出，以下字段也**不得**被代理转发：

`Connection`、`Proxy-Connection`、`Keep-Alive`、`TE`、`Transfer-Encoding`、`Upgrade`

代理必须逐条剥离并按需重新生成——例如可自行决定回源时是否使用 `chunked`。

## Keep-Alive

```text
Keep-Alive: timeout=5, max=1000
```

-   `timeout`：空闲多少**秒**后可能关闭。
-   `max`：本连接上还能处理多少个请求（HTTP/1.1 中已少用）。

关键：这是**提示而非承诺**，且是**逐跳**的——必须配 `Connection: Keep-Alive` 使用，不可跨代理传递。客户端不得依赖它精确预测关闭时机，仍须处理连接被随时关闭的情况。

## 流水线（pipelining）

客户端可在收到响应前连发多个请求。约束：

-   服务端 **MUST** 按请求到达顺序回送响应（HTTP/1.1 无多路复用，响应无标识符）。
-   客户端**不应**用流水线发送**非幂等**请求（见[方法](/manual/computer-programming/http11/methods)）——连接中断时无法判断哪些已被处理。
-   队头阻塞（head-of-line blocking）由此产生：一个慢响应堵住其后所有响应。这是 HTTP/2 引入流复用的直接动因。

实践中主流浏览器**已默认禁用**流水线（实现兼容性差），改用多条并行连接。

## Upgrade

```text
Upgrade = #protocol
protocol = protocol-name ["/" protocol-version]
```

请求方声明愿意切换协议，服务端同意则返回 **101 Switching Protocols**：

```text
GET /chat HTTP/1.1
Host: example.com
Connection: Upgrade
Upgrade: websocket
```

要点：

-   **MUST** 同时发 `Connection: Upgrade`，否则该字段必须被忽略。
-   服务端不同意时按普通请求正常响应（忽略 `Upgrade` 即可），不是错误。
-   101 之后，连接上的字节按新协议解释，不再是 HTTP/1.1。
-   逐跳字段，代理不得转发。
-   HTTP/2 中**已移除**（改用 `:protocol` 扩展 CONNECT）。

## Expect 与 100-continue

```text
Expect = #expectation
expectation = token [ "=" ( token / quoted-string ) parameters ]
```

唯一标准值是 `100-continue`：客户端在发送**大请求体前**先发头部并等待，避免体被白发。

```text
PUT /large HTTP/1.1
Host: example.com
Content-Length: 1073741824
Expect: 100-continue
```

各方处理规则：

-   服务端愿意接收 → 回 `100 Continue`，客户端随即发体。
-   服务端拒绝 → 直接回最终状态码（如 `401`、`417`、`413`），且**MUST NOT** 再等待体；客户端见到最终响应后应停止发送。
-   服务端对**未知**期望值 → **MUST** 返回 **417 (Expectation Failed)**。
-   客户端**不应**无限等待：超时（常见 1–2 秒）后可直接发送体。
-   服务端若已收到部分体，则**不得**再发 `100 Continue`。
-   逐跳语义：代理需按下游情况自行决定是否转发或代答。

## 连接关闭与重试

-   **半关闭**：发送方完成后可关闭写方向，仍读取对端剩余数据。服务端应在关闭前尽量读完客户端已发的数据，避免对端收到 RST 而丢失响应。
-   **重试安全性**：连接在收到响应前中断时，客户端**仅可自动重试幂等方法**。非幂等（`POST`、`PATCH`）必须由上层决策，否则可能重复扣款、重复下单。
-   `408 Request Timeout` 响应应带 `Connection: close`。

本部分结束。下一部分从[方法](/manual/computer-programming/http11/methods)开始，逐个解析方法的安全性、幂等性与可缓存性。
