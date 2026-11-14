---
title: "二进制分帧层"
description: "9 字节帧头的每个比特、十种帧类型与标志位的精确语义。"
source: "https://daiw.org/manual/http2-3/h2-framing"
---

# 二进制分帧层

9 字节帧头的每个比特、十种帧类型与标志位的精确语义。

## 帧头格式

所有 h2 帧共用 **9 字节**定长头：

```text
+-----------------------------------------------+
|                 Length (24)                   |
+---------------+---------------+---------------+
|   Type (8)    |   Flags (8)   |
+-+-------------+---------------+-------------------------------+
|R|                 Stream Identifier (31)                      |
+=+=============================================================+
|                   Frame Payload (0...)                      ...
+---------------------------------------------------------------+
```

逐字段：

| 字段 | 位宽 | 说明 |
| --- | --- | --- |
| Length | 24 | 载荷长度（**不含**这 9 字节头）。默认上限 **16384**（2^14），由 `SETTINGS_MAX_FRAME_SIZE` 调整，最大 16777215 |
| Type | 8 | 帧类型。未知类型 **MUST** 被忽略而非报错——这是协议的扩展点 |
| Flags | 8 | 类型专属标志位，未定义位 **MUST** 置 0 且被忽略 |
| R | 1 | 保留位，**MUST** 置 0，接收时忽略 |
| Stream Identifier | 31 | 流 ID。**0 表示连接级**，非零表示某个流 |

关键改进：**长度前置且定长**。1.1 必须扫描字节找 CRLF、再按 `Content-Length` 或分块解析——正是这种「靠扫描定界」造成了[请求走私](/manual/computer-programming/http11/message-body-length)。h2 直接读 24 位长度，边界**无歧义**，走私类攻击在协议层被消除。

## 十种帧类型

| Type | 名称 | 流 ID | 作用 |
| --- | --- | --- | --- |
| `0x00` | `DATA` | 非零 | 消息体 |
| `0x01` | `HEADERS` | 非零 | 字段块，开启流 |
| `0x02` | `PRIORITY` | 非零 | 优先级（**已废弃**） |
| `0x03` | `RST_STREAM` | 非零 | 立即终止单个流 |
| `0x04` | `SETTINGS` | **0** | 连接参数协商 |
| `0x05` | `PUSH_PROMISE` | 非零 | 服务端推送预告（**已废弃**） |
| `0x06` | `PING` | **0** | 保活与 RTT 测量 |
| `0x07` | `GOAWAY` | **0** | 优雅关闭连接 |
| `0x08` | `WINDOW_UPDATE` | 0 或非零 | 流量控制窗口增量 |
| `0x09` | `CONTINUATION` | 非零 | 字段块续帧 |

流 ID 用错（如 `SETTINGS` 带非零流 ID）是 `PROTOCOL_ERROR`，**必须**关闭整个连接。

## DATA

承载消息体，等价于 1.1 的 message-body。

标志位：

| 标志 | 值 | 语义 |
| --- | --- | --- |
| `END_STREAM` | `0x01` | 本帧是该流方向上的最后一帧 |
| `PADDED` | `0x08` | 载荷带填充 |

- **受[流量控制](/manual/computer-programming/http2-3/h2-flow-control)约束**——是唯一受控的帧类型。
- 填充用于混淆真实长度以抵御流量分析（BREACH 类）；Pad Length 字段占 1 字节，填充内容 **MUST** 全零且接收方 **MUST NOT** 解释。
- 填充长度大于剩余载荷 → `PROTOCOL_ERROR`。

## HEADERS

承载 HPACK 编码后的字段块，同时**开启一个流**。

标志位：

| 标志 | 值 | 语义 |
| --- | --- | --- |
| `END_STREAM` | `0x01` | 该流方向到此结束（如无体的 GET） |
| `END_HEADERS` | `0x04` | 字段块到此完整，无后续 `CONTINUATION` |
| `PADDED` | `0x08` | 带填充 |
| `PRIORITY` | `0x20` | 载荷含优先级信息（**已废弃**） |

注意 `END_STREAM` 与 `END_HEADERS` 是**两个独立**标志：一个无请求体的 GET 会同时置位；一个带体的 POST 只置 `END_HEADERS`，体由后续 `DATA` 帧发送并在最后一帧置 `END_STREAM`。

## CONTINUATION

字段块超过 `MAX_FRAME_SIZE` 时的续帧。

**最严格的排序约束**：`HEADERS`/`PUSH_PROMISE` 与其后续 `CONTINUATION` 之间 **MUST NOT** 插入任何其他帧（哪怕是其他流的帧）。违反即 `PROTOCOL_ERROR`。

原因：HPACK 动态表是**有状态且顺序相关**的，字段块必须作为不可分割的整体解码。这也意味着**巨大的头部会短暂阻塞整条连接**——即所谓 CONTINUATION Flood 攻击面。

## RST_STREAM

载荷是 4 字节[错误码](/manual/computer-programming/http2-3/h2-connection)，立即终止**单个流**，不影响连接。

这是 1.1 完全没有的能力：1.1 想取消一个进行中的请求，只能关掉整条 TCP 连接。

代价：`RST_STREAM` 极廉价（客户端发一帧即可让服务端丢弃工作），2023 年的 **HTTP/2 Rapid Reset**（CVE-2023-44487）正是利用「快速开流再立即重置」绕过 `MAX_CONCURRENT_STREAMS` 限制发起 DDoS。缓解手段是限制单位时间内的重置速率。

## PING

8 字节不透明载荷，流 ID 必须为 0。

- 收到未置 `ACK` 的 `PING` → **MUST** 原样回送并置 `ACK`（`0x01`）。
- 载荷长度不等于 8 → `FRAME_SIZE_ERROR`。
- 用于测量 RTT 与探测连接存活，优先级应高于其他帧。

## 帧与 1.1 的映射

一次完整的 h2 请求/响应：

```text
客户端 → HEADERS[END_HEADERS]              请求头
客户端 → DATA                              请求体
客户端 → DATA[END_STREAM]                  请求体末尾
服务端 → HEADERS[END_HEADERS]              响应头(含 :status)
服务端 → DATA                              响应体
服务端 → DATA[END_STREAM]                  响应体末尾
```

对照 1.1：`HEADERS` ≈ 起始行 + 字段行，`DATA` ≈ message-body，`END_STREAM` ≈ `Content-Length` 耗尽或 last-chunk。

**trailer 字段**在 h2 中表示为：`END_STREAM` 之前再发一个 `HEADERS` 帧（且该帧置 `END_STREAM`）——比 1.1 的[分块 trailer 区](/manual/computer-programming/http11/field-syntax)干净得多。

下一篇：[流与多路复用](/manual/computer-programming/http2-3/h2-streams)。
