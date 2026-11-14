---
title: "流量控制"
description: "连接级与流级窗口、WINDOW_UPDATE 语义与初始窗口变更的边界情况。"
source: "https://daiw.org/manual/http2-3/h2-flow-control"
---

# 流量控制

连接级与流级窗口、WINDOW_UPDATE 语义与初始窗口变更的边界情况。

## 为什么需要

1.1 完全依赖 **TCP 的流量控制**：接收方读得慢，TCP 窗口收缩，发送方自然被限速。

h2 打破了这个假设——一条 TCP 连接上有几十个流。若只靠 TCP，一个慢消费者（比如客户端把某个大下载的数据攒在内存里没处理）会让**整条连接**的 TCP 窗口关闭，把其他所有流一起憋死。

于是 h2 在 HTTP 层**重新实现了一套流量控制**，粒度到单个流。

## 两级窗口

每个方向上维护两套窗口，**同一个 `DATA` 帧同时消耗两者**：

| 级别 | 作用范围 | 由谁计 |
| --- | --- | --- |
| **连接级** | 整条连接（流 ID = 0） | 全部 `DATA` 帧之和 |
| **流级** | 单个流 | 该流的 `DATA` 帧 |

发送一个 N 字节载荷的 `DATA` 帧：连接窗口 −N，且该流窗口 −N。**两者都必须 ≥ N 才允许发送**——任一为 0 即阻塞。

关键限制：**只有 `DATA` 帧受流量控制**。`HEADERS`、`SETTINGS`、`RST_STREAM`、`PING` 等控制帧**不受限**，保证控制信令永远能通过（否则会死锁）。这也意味着巨大的头部无法被流量控制约束，需靠 `MAX_HEADER_LIST_SIZE` 单独限制。

## 窗口参数

| 项 | 值 |
| --- | --- |
| 初始窗口（两级） | **65535** 字节（2^16 − 1） |
| 流级初始值可调 | `SETTINGS_INITIAL_WINDOW_SIZE` |
| 连接级初始值 | **不可**用 SETTINGS 调整，只能靠 `WINDOW_UPDATE` 增大 |
| 窗口上限 | 2^31 − 1 |

默认 65535 字节在高带宽延迟积（BDP）链路上是**严重瓶颈**：跨洋 100ms RTT 下，单流吞吐上限约 `65535 / 0.1s ≈ 640 KB/s`。生产部署几乎都要调大（常见 1–16 MB）——这是 h2 调优的头号参数。

## WINDOW_UPDATE

```text
+-+-------------------------------------------------------------+
|R|              Window Size Increment (31)                     |
+-+-------------------------------------------------------------+
```

- 载荷 4 字节，其中 1 位保留 + 31 位**增量**（不是新的绝对值）。
- 流 ID = 0 → 增连接级窗口；非零 → 增该流窗口。
- **增量为 0 是错误**：流级 → `PROTOCOL_ERROR` 的 `RST_STREAM`；连接级 → 连接错误。
- 累加后超过 2^31 − 1 → `FLOW_CONTROL_ERROR`。
- 即使流已进入 `half-closed`/`closed`，仍可能收到对端发来的 `WINDOW_UPDATE`（竞态），**MUST** 容忍。

接收方通常在把数据交给应用层后立即发 `WINDOW_UPDATE` 补足窗口。

## INITIAL_WINDOW_SIZE 变更的坑

`SETTINGS_INITIAL_WINDOW_SIZE` 改变时，**已存在的所有流**的窗口要按差值调整：

```text
新流级窗口 = 当前窗口 + (新 INITIAL_WINDOW_SIZE - 旧 INITIAL_WINDOW_SIZE)
```

两个必须注意的后果：

1. **窗口可以变成负数**。若已发送 60000 字节、随后对端把初始窗口从 65535 调到 16384，则窗口变为 `5535 + (16384 − 65535) = −43616`。此时发送方 **MUST** 停止发送，直到 `WINDOW_UPDATE` 把它拉回正数。**负窗口是合法状态，不是错误。**
2. 该设置**只影响流级**，连接级窗口不受影响。

## 死锁风险

流量控制是自己实现的，就有自己造死锁的可能：

- 接收方必须**及时**发 `WINDOW_UPDATE`，否则发送方永久阻塞。
- 一个不读数据的应用会让窗口耗尽——服务端应设读超时，必要时 `RST_STREAM`。
- 双方都在等对方的窗口时（如双向大流量的 gRPC 流式调用），实现必须保证控制帧优先发送。

## 与 TCP 流量控制的关系

两层**同时生效**，取更严格者：

```text
应用可发送量 = min(h2 连接窗口, h2 流窗口, TCP 拥塞窗口, TCP 接收窗口)
```

h2 窗口调得再大也突破不了 TCP 的限制；反之 TCP 再快，h2 窗口没补上也发不出去。调优时两者都要看。

## HTTP/3 的对照

HTTP/3 **删除了这一层**——流量控制下沉到 QUIC 传输层：

| h2 | h3 / QUIC |
| --- | --- |
| `WINDOW_UPDATE`（流级） | QUIC `MAX_STREAM_DATA` 帧 |
| `WINDOW_UPDATE`（连接级） | QUIC `MAX_DATA` 帧 |
| `SETTINGS_INITIAL_WINDOW_SIZE` | QUIC 传输参数 `initial_max_stream_data_*` |
| 还额外受 TCP 窗口约束 | QUIC 自己就是传输层，只有一层 |

这消除了 h2「HTTP 层与 TCP 层两套流控互相打架」的复杂性——详见 [QUIC 传输层](/manual/computer-programming/http2-3/quic-transport)。

下一篇：[SETTINGS 与优先级](/manual/computer-programming/http2-3/h2-settings-priority)。
