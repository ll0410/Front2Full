---
title: "连接与服务发现"
description: "Alt-Svc、DNS HTTPS 记录、GOAWAY 的双向语义与回落策略。"
source: "https://daiw.org/manual/http2-3/h3-connection"
---

# 连接与服务发现

Alt-Svc、DNS HTTPS 记录、GOAWAY 的双向语义与回落策略。

## 发现问题

客户端不能凭空知道某个站点支持 h3——直接发 UDP 包给一个不支持的服务器只会超时。所以 h3 **必须先被发现**。

三条路径：

### 1. Alt-Svc 字段（RFC 7838）

服务端在 h2/1.1 响应里声明「我还有个 h3 端点」：

```http
alt-svc: h3=":443"; ma=86400
alt-svc: h3=":443"; ma=86400, h2=":443"; ma=3600
```

| 参数 | 含义 |
| --- | --- |
| `h3=":443"` | 协议 ALPN + 端口（主机省略表示同主机） |
| `ma` | max-age，该通告的有效秒数（默认 86400） |
| `persist=1` | 网络变更后仍保留该记录 |

客户端行为：

- **本次请求仍走当前协议**，把通告存入 Alt-Svc 缓存。
- **后续**请求尝试用 h3 连接；成功则持续使用，失败则回落。
- 这意味着**首次访问必然不走 h3**——至少要一个来回才能升级。

### 2. DNS HTTPS/SVCB 记录（RFC 9460）

解决 Alt-Svc 的「首访必慢一拍」问题——把发现提前到 DNS 查询阶段：

```text
example.com.  3600  IN  HTTPS  1 . alpn="h3,h2" port=443 ipv4hint=203.0.113.1
```

客户端在解析域名时就知道支持 h3，**第一个请求即可直发 QUIC**。同时 `ipv4hint`/`ipv6hint` 还能省一次 A/AAAA 查询，`ech` 参数用于加密 SNI。

这是目前推荐的方式，主流浏览器与 CDN 均已支持。

### 3. 先验知识

客户端被显式配置为使用 h3（如 API 客户端固定配置），跳过发现。

## 回落策略

h3 跑在 UDP 上，而 UDP 在部分网络中被封禁或严重限速。客户端**必须**具备回落能力：

```text
1. 并发或竞速发起 QUIC 连接与 TCP 连接
2. QUIC 在超时内握手成功 → 用 h3，标记该网络可用 UDP
3. QUIC 超时/被拒 → 用已经建好的 TCP 连接走 h2/1.1
4. 记录失败，一段时间内不再对该网络/该源尝试 h3
```

Chrome 等实现使用「竞速（racing）」：同时发起两种连接，先成功者胜出，另一条丢弃。代价是多一点连接开销，换取无感回落。

服务端侧：**必须同时保留 h2/1.1 端点**。只提供 h3 会让相当比例的用户完全无法访问。

## GOAWAY

h3 也有 `GOAWAY`，但语义比 h2 更完整——它是**双向**的：

| 发送方 | 载荷含义 |
| --- | --- |
| **服务端** | 最大的**已处理**请求流 ID。大于该值的请求一定未被处理 |
| **客户端** | 最大的**推送 ID**（表示不再接受更大的推送） |

h2 的 [`GOAWAY`](/manual/computer-programming/http2-3/h2-connection) 只能由任一端发送并标注 Last-Stream-ID；h3 明确区分了两个方向的用途。

规则：

- 只能在**控制流**上发送。
- 可以发**多次**，但后发的 ID **MUST NOT 大于**先发的（只能收紧，不能放宽）——违反 → `H3_ID_ERROR`。
- 与 h2 相同的两阶段优雅关闭做法同样适用：先发大值表达意图，处理完在途请求后再发真实边界。

## 连接关闭

QUIC 层提供了 h2 没有的能力：

| 场景 | 机制 |
| --- | --- |
| 优雅关闭 | h3 `GOAWAY` → 处理完 → QUIC `CONNECTION_CLOSE` |
| 立即关闭 | QUIC `CONNECTION_CLOSE`（带错误码与原因短语） |
| 空闲超时 | QUIC 传输参数 `max_idle_timeout`，双方取较小值 |
| 无状态重置 | 服务端重启丢失状态后，用 Stateless Reset Token 告知对端「这条连接我不认识了」，避免客户端长时间重试 |

**无状态重置**是 TCP 的 `RST` 在加密传输上的等价物——因为服务端重启后无法解密该连接的包，只能靠预先分发的 token 来证明「确实是我发的重置」。

## 与 h2 的连接管理对照

| 能力 | h2 | h3 |
| --- | --- | --- |
| 连接前言 | `PRI * HTTP/2.0` 魔数 | 无（ALPN 已确定） |
| 参数协商 | 流 0 的 `SETTINGS` + ACK | 控制流首帧 `SETTINGS`，**无 ACK、不可重发** |
| 保活 | h2 `PING` 帧 | **QUIC** `PING` 帧 |
| 单流终止 | `RST_STREAM` | **QUIC** `RESET_STREAM` / `STOP_SENDING` |
| 优雅关闭 | `GOAWAY` | `GOAWAY`（双向语义）+ QUIC `CONNECTION_CLOSE` |
| 换网络 | **断连重建** | **连接迁移**，无感 |

`STOP_SENDING` 是 QUIC 独有的：它表示「别再往这条流发了」，而 `RESET_STREAM` 是「我不发了」。h2 的 `RST_STREAM` 把两个方向混为一谈，QUIC 拆开了。

## 0-RTT 与幂等性

复用[前文](/manual/computer-programming/http2-3/quic-transport)的结论，落到 HTTP 层：

- 客户端 **SHOULD** 只在 0-RTT 中发送安全且幂等的请求。
- 服务端若不愿在 0-RTT 中处理某请求，返回 [`425 Too Early`](/manual/computer-programming/http11/status-4xx)；客户端 **MUST** 在握手完成后重发。
- 服务端也可整体拒绝 0-RTT（不下发会话票据或忽略早期数据）。

这是 [`425` 这个状态码存在的真正场景](/manual/computer-programming/http11/status-4xx)——它在 1.1 时代几乎无用武之地。

第 2 部分结束。下一篇：[三版全面对照](/manual/computer-programming/http2-3/version-comparison)。
