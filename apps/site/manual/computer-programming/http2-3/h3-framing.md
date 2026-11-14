---
title: "HTTP/3 帧格式"
description: "变长帧头、七种帧类型、四类单向流，以及被删除的 h2 帧。"
source: "https://daiw.org/manual/http2-3/h3-framing"
---

# HTTP/3 帧格式

变长帧头、七种帧类型、四类单向流，以及被删除的 h2 帧。

## 帧格式

```text
HTTP/3 Frame {
  Type   (变长整数),
  Length (变长整数),
  Frame Payload (..),
}
```

对照 [h2 的 9 字节定长头](/manual/computer-programming/http2-3/h2-framing)，三处差异：

| | h2 | h3 |
| --- | --- | --- |
| 头部长度 | **固定 9 字节** | **通常 2 字节**（变长） |
| 流 ID | **在帧头里** | **不在**——由 QUIC 流承载 |
| 标志位 | 8 位 Flags | **无**——语义改由帧类型或 QUIC 表达 |

h3 帧头不含流 ID，因为**帧已经写在某条 QUIC 流上了**，流身份由传输层提供。同理 `END_STREAM` 标志也没了——改用 QUIC 的流 FIN 位。

## 七种帧类型

| Type | 名称 | 允许出现在 |
| --- | --- | --- |
| `0x00` | `DATA` | 请求流 |
| `0x01` | `HEADERS` | 请求流、推送流 |
| `0x03` | `CANCEL_PUSH` | 控制流 |
| `0x04` | `SETTINGS` | 控制流（**必须是首帧**） |
| `0x05` | `PUSH_PROMISE` | 请求流 |
| `0x07` | `GOAWAY` | 控制流 |
| `0x0d` | `MAX_PUSH_ID` | 控制流 |

**未知帧类型 MUST 被忽略**（扩展点，同 h2）。

## 被删除的 h2 帧

这些帧类型在 h3 中**被永久保留为非法**——收到即 `H3_FRAME_UNEXPECTED`：

| h2 帧 | 类型值 | 为什么没了 |
| --- | --- | --- |
| `PRIORITY` | `0x02` | 优先级树[已废弃](/manual/computer-programming/http2-3/h2-settings-priority)，改用 `priority` 字段 |
| `PING` | `0x06` | QUIC 有 `PING` 帧 |
| `WINDOW_UPDATE` | `0x08` | QUIC 有 `MAX_DATA`/`MAX_STREAM_DATA` |
| `CONTINUATION` | `0x09` | **不再需要**——见下 |
| `RST_STREAM` | — | QUIC 有 `RESET_STREAM` 帧 |

保留这些值而非复用，是为了让「h2 帧被误发到 h3 连接上」这种协议混淆能被**立即检出**。

### CONTINUATION 消失的意义

h2 中字段块超过 `MAX_FRAME_SIZE` 就要拆成 `HEADERS` + 若干 `CONTINUATION`，且[中间不得插入任何其他帧](/manual/computer-programming/http2-3/h2-framing)——巨大的头部会短暂**独占整条连接**。

h3 的 `HEADERS` 帧长度是**变长整数**（上限 2^62−1），一个帧就能装下任意大的字段块；而且它写在自己的 QUIC 流上，天然不影响其他流。**CONTINUATION Flood 这类攻击面在 h3 上不存在。**

## 四类单向流

h3 用 QUIC 的**单向流**承载连接级信令。每条单向流的**第一个变长整数是流类型**：

| 流类型 | 名称 | 作用 |
| --- | --- | --- |
| `0x00` | **控制流** | `SETTINGS`、`GOAWAY`、`MAX_PUSH_ID`、`CANCEL_PUSH` |
| `0x01` | 推送流 | 服务端推送的响应（已无实际使用） |
| `0x02` | **QPACK 编码器流** | [动态表](/manual/computer-programming/http2-3/qpack)插入指令 |
| `0x03` | **QPACK 解码器流** | 确认与取消指令 |

规则：

- 双方**各 MUST 开一条控制流**，且**在连接早期开启**。
- 控制流上的**首帧 MUST 是 `SETTINGS`**，否则 `H3_MISSING_SETTINGS`。
- 控制流、QPACK 两条流**每种只能有一条**，重复开启 → `H3_STREAM_CREATION_ERROR`。
- 这些流**MUST NOT 被关闭**。关闭任何一条 → `H3_CLOSED_CRITICAL_STREAM`，整条连接终止。
- 未知流类型 **MUST** 被忽略（可安全地停止读取）。

对照 h2：h2 用**流 0** 承载所有连接级帧；h3 没有流 0，改用专门的单向流——因为 QUIC 的流 ID 空间里没有「0 号连接级流」这个概念。

## 没有连接前言

h2 有 24 字节的 [`PRI * HTTP/2.0` 魔数](/manual/computer-programming/http2-3/h2-connection)，用于防止把 h2 帧发给 1.1 服务端。

h3 **不需要**：ALPN 在 QUIC 握手中已经确定了协议是 `h3`，且 QUIC 本身与 TCP 不兼容，不存在「误发给 1.1 服务端」的可能。取而代之的是「控制流首帧必须是 `SETTINGS`」这一约定。

## SETTINGS

同样是单向声明 + 不可重发，但与 h2 有三点不同：

| | h2 | h3 |
| --- | --- | --- |
| 承载 | 流 0 的 `SETTINGS` 帧 | **控制流首帧** |
| 是否需 ACK | **需要**（`ACK` 标志） | **不需要** |
| 可否重发 | 可以，随时更新 | **不可**——一条连接只发一次，再发 → `H3_FRAME_UNEXPECTED` |

h3 的三个标准参数：

| ID | 名称 | 作用 |
| --- | --- | --- |
| `0x01` | `QPACK_MAX_TABLE_CAPACITY` | QPACK 动态表容量，默认 **0**（即默认禁用动态表） |
| `0x06` | `MAX_FIELD_SECTION_SIZE` | 字段列表未压缩大小上限（对应 h2 的 `MAX_HEADER_LIST_SIZE`） |
| `0x07` | `QPACK_BLOCKED_STREAMS` | 允许因 QPACK 而阻塞的最大流数，默认 **0** |

注意 h2 的 `INITIAL_WINDOW_SIZE`、`MAX_CONCURRENT_STREAMS`、`MAX_FRAME_SIZE` 在 h3 中**都不存在**——分别由 QUIC 的传输参数 `initial_max_stream_data_*`、`initial_max_streams_bidi` 承担，帧大小则无需限制。

## 请求流的帧序列

```text
客户端在一条双向流上:
  HEADERS                 请求头(QPACK 编码)
  DATA (可选，可多个)      请求体
  HEADERS (可选)          trailer 字段
  → QUIC 流 FIN 位        相当于 h2 的 END_STREAM

服务端在同一条流上:
  HEADERS (可选，多个)     1xx 中间响应
  HEADERS                 最终响应头
  DATA (可选，可多个)      响应体
  HEADERS (可选)          trailer
  → QUIC 流 FIN 位
```

约束：

- 请求流上**必须**恰好有一个请求与一个最终响应。
- 客户端流上收到 `DATA` 而无先行 `HEADERS` → `H3_FRAME_UNEXPECTED`。
- 请求流未完整（缺响应就 FIN）→ `H3_REQUEST_INCOMPLETE`。

## 错误码

h3 错误码从 `0x0100` 起，与 QUIC 传输层错误码共用同一空间但不重叠：

| 码 | 名称 | 触发 |
| --- | --- | --- |
| `0x0100` | `H3_NO_ERROR` | 正常关闭 |
| `0x0101` | `H3_GENERAL_PROTOCOL_ERROR` | 未归类的协议违规 |
| `0x0102` | `H3_INTERNAL_ERROR` | 实现内部错误 |
| `0x0103` | `H3_STREAM_CREATION_ERROR` | 流创建违规（如重复控制流） |
| `0x0104` | `H3_CLOSED_CRITICAL_STREAM` | 关键流被关闭 |
| `0x0105` | `H3_FRAME_UNEXPECTED` | 帧出现在不允许的位置 |
| `0x0106` | `H3_FRAME_ERROR` | 帧格式或长度错 |
| `0x0107` | `H3_EXCESSIVE_LOAD` | 对端负载过大（对应 h2 的 `ENHANCE_YOUR_CALM`） |
| `0x0109` | `H3_SETTINGS_ERROR` | SETTINGS 违规 |
| `0x010a` | `H3_MISSING_SETTINGS` | 控制流首帧不是 SETTINGS |
| `0x010b` | `H3_REQUEST_REJECTED` | **未处理**即拒绝，客户端可安全重试（对应 `REFUSED_STREAM`） |
| `0x010c` | `H3_REQUEST_CANCELLED` | 请求被取消 |
| `0x010e` | `H3_MESSAGE_ERROR` | 消息 malformed（如伪头违规） |
| `0x0110` | `H3_VERSION_FALLBACK` | 要求客户端改用 HTTP/1.1 重试 |

下一篇：[QPACK 头部压缩](/manual/computer-programming/http2-3/qpack)。
