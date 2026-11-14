---
title: "连接管理与错误码"
description: "连接前言、GOAWAY 的优雅关闭语义、十四个错误码与流错误/连接错误的区分。"
source: "https://daiw.org/manual/http2-3/h2-connection"
---

# 连接管理与错误码

连接前言、GOAWAY 的优雅关闭语义、十四个错误码与流错误/连接错误的区分。

## 连接前言

建立 h2 连接后，客户端 **MUST** 首先发送 24 字节的魔数：

```text
PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n
```

十六进制：`505249202a20485454502f322e300d0a0d0a534d0d0a0d0a`。

设计意图很精巧：这串字节在 1.1 解析器看来是一个**方法为 `PRI`、目标为 `*`、版本 `HTTP/2.0`** 的畸形请求，**必定**被 1.1 服务端拒绝——从而防止 h2 客户端误把 h2 帧发给只懂 1.1 的服务端（以及由此产生的协议混淆攻击）。

前言之后，客户端 **MUST** 立即发一个 `SETTINGS` 帧（可为空）。服务端也 **MUST** 以 `SETTINGS` 帧作为其首帧。双方随后互相 `ACK`。

服务端收到的首帧不是合法前言 → **MUST** 以 `PROTOCOL_ERROR` 关闭连接。

## 两级错误

这是 h2 相对 1.1 的重要改进：**错误可以只杀一个流，不必杀整条连接**。

| | 流错误 | 连接错误 |
| --- | --- | --- |
| 帧 | `RST_STREAM` | `GOAWAY` |
| 影响 | 单个流 | 整条连接 |
| 典型场景 | 该请求本身有问题（malformed、超限） | 状态失步、帧格式错、HPACK 解码失败 |

**判定原则**：凡是可能让双方**状态失步**的错误，必须升级为连接错误。最典型的是 `COMPRESSION_ERROR`——[HPACK 动态表](/manual/computer-programming/http2-3/hpack)一旦失步，后续所有字段块都会解错，只能弃连接。

1.1 的对照：任何解析错误都只能 `400` + 关连接，没有中间选项。

## 十四个错误码

4 字节无符号整数，`RST_STREAM` 与 `GOAWAY` 共用同一套：

| 码 | 名称 | 含义 |
| --- | --- | --- |
| `0x00` | `NO_ERROR` | 无错误。用于优雅关闭 |
| `0x01` | `PROTOCOL_ERROR` | 未具体归类的协议违规 |
| `0x02` | `INTERNAL_ERROR` | 实现内部故障 |
| `0x03` | `FLOW_CONTROL_ERROR` | 违反流量控制约定 |
| `0x04` | `SETTINGS_TIMEOUT` | 发出的 SETTINGS 迟迟未被 ACK |
| `0x05` | `STREAM_CLOSED` | 在已关闭的流上收到帧 |
| `0x06` | `FRAME_SIZE_ERROR` | 帧长度非法 |
| `0x07` | `REFUSED_STREAM` | 流在**任何处理前**被拒绝 |
| `0x08` | `CANCEL` | 不再需要该流（非错误，客户端主动取消） |
| `0x09` | `COMPRESSION_ERROR` | HPACK 状态损坏 —— **必为连接错误** |
| `0x0a` | `CONNECT_ERROR` | `CONNECT` 建立的隧道异常 |
| `0x0b` | `ENHANCE_YOUR_CALM` | 对端行为过载（限流信号） |
| `0x0c` | `INADEQUATE_SECURITY` | TLS 配置不满足 h2 要求 |
| `0x0d` | `HTTP_1_1_REQUIRED` | 要求客户端降级到 1.1 重试 |

两个值得注意的：

- **`REFUSED_STREAM` 保证请求未被处理**——客户端可安全重试**任何**方法，含 `POST`。这是 1.1 无法提供的确定性（1.1 连接中断时无从判断服务端是否已执行）。
- **`HTTP_1_1_REQUIRED`** 用于需要 TLS 客户端证书重协商等 h2 禁止的场景（h2 禁止 TLS 重协商）。

## GOAWAY

```text
+-+-------------------------------------------------------------+
|R|                  Last-Stream-ID (31)                        |
+-+-------------------------------------------------------------+
|                      Error Code (32)                          |
+---------------------------------------------------------------+
|                  Additional Debug Data (*)                    |
+---------------------------------------------------------------+
```

流 ID **MUST** 为 0。核心是 **Last-Stream-ID** 的语义：

- 表示发送方**已经或可能已经处理过**的最大流 ID。
- **ID 大于该值的流一定未被处理**，客户端可无条件安全重试。
- 这使得优雅关闭成为可能，而 1.1 只能靠 `Connection: close` 且无法告知「哪些请求已处理」。

### 优雅关闭的两阶段

生产服务端重启时的标准做法：

```text
1. 发 GOAWAY(Last-Stream-ID = 2^31-1, NO_ERROR)   ← 「我要关了，别开新流」
2. 等待 1 个 RTT，让在途请求到达
3. 处理完现有流
4. 发 GOAWAY(Last-Stream-ID = 实际最大已处理 ID, NO_ERROR)
5. 关闭 TCP 连接
```

第一个 `GOAWAY` 用最大值是关键：它只表达「停止新建」的意图，**不**放弃任何在途请求；第二个才给出真实边界。少了这一步，与客户端刚发出的新流会发生竞态，导致本可成功的请求被误杀。

发送 `GOAWAY` 后仍 **MUST** 继续处理 ID ≤ Last-Stream-ID 的流。

## PING 与保活

- 8 字节不透明载荷，原样回送并置 `ACK`。
- 用途：测 RTT、探活、穿越 NAT 保持映射。
- 因为 h2 是单连接长驻，中间设备的空闲超时（常见 60–300 秒）会静默断连，`PING` 是标准对策。

## CONNECT 在 h2 中的形态

[1.1 的 `CONNECT`](/manual/computer-programming/http11/methods) 用 authority-form 目标；h2 改为：

- `:method: CONNECT`
- **`:authority` 必填**，携带 `host:port`
- **`:scheme` 与 `:path` MUST 省略**（省略与否是判定该请求是否为隧道的依据）

隧道建立后，该**流**上的 `DATA` 帧载荷即为隧道字节。与 1.1 的关键差异：**隧道只占用一个流，而非整条连接**——同一条 h2 连接可同时承载多个隧道和普通请求。

扩展 CONNECT（RFC 8441）再加一个 `:protocol` 伪头，使 WebSocket 能跑在 h2 流上——这补上了 h2 删除 `Upgrade` 后留下的空缺。

下一篇：[服务端推送](/manual/computer-programming/http2-3/h2-server-push)。
