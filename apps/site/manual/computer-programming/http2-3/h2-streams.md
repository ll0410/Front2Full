---
title: "流与多路复用"
description: "流 ID 分配规则、七态状态机与多路复用如何消除应用层队头阻塞。"
source: "https://daiw.org/manual/http2-3/h2-streams"
---

# 流与多路复用

流 ID 分配规则、七态状态机与多路复用如何消除应用层队头阻塞。

## 流是什么

**流（stream）** 是一条连接内的独立双向帧序列，承载一个请求/响应交换。一条 h2 连接上可**并发**存在成百上千个流。

这是 h2 最核心的改进——直接消灭了 1.1 [流水线](/manual/computer-programming/http11/connection-management)的两个致命缺陷：

| 1.1 流水线 | h2 流 |
| --- | --- |
| 响应**必须按请求顺序**返回（无标识符） | 帧带 Stream ID，**响应可任意顺序** |
| 一个慢响应堵住其后所有响应 | 各流独立，互不阻塞 |
| 无法取消单个请求 | `RST_STREAM` 单独终止 |
| 浏览器实际禁用 | 默认启用 |

## 流 ID 分配

31 位无符号整数，规则是硬性的：

| 规则 | 说明 |
| --- | --- |
| `0` | 保留给**连接级**控制帧（`SETTINGS`、`PING`、`GOAWAY`、连接级 `WINDOW_UPDATE`） |
| **奇数** | **客户端**发起 |
| **偶数** | **服务端**发起（仅 `PUSH_PROMISE`，已废弃） |
| 单调递增 | 新建流的 ID **MUST** 大于本端已用过的所有 ID |

关键推论：

- 使用**小于等于**已用 ID 的新流 → `PROTOCOL_ERROR`。
- ID 只增不减，**不可复用**。耗尽 2^31 后 **MUST** 建立新连接——长连接的服务端应主动 `GOAWAY` 让客户端重连。
- 客户端首个流通常是 **1**。

## 状态机

七个状态：

| 状态 | 含义 | 进入方式 |
| --- | --- | --- |
| `idle` | 初始态，任何未用流 ID 的默认状态 | — |
| `reserved (local)` | 本端已发 `PUSH_PROMISE` 预留 | 推送（已废弃） |
| `reserved (remote)` | 对端已发 `PUSH_PROMISE` 预留 | 推送（已废弃） |
| `open` | 双向均可收发 | 收/发 `HEADERS` |
| `half-closed (local)` | 本端已发 `END_STREAM`，只能收 | 发 `END_STREAM` |
| `half-closed (remote)` | 对端已发 `END_STREAM`，只能发 | 收 `END_STREAM` |
| `closed` | 终态 | 双向 `END_STREAM`，或 `RST_STREAM` |

典型请求的迁移路径：

```text
客户端视角:
  idle
   → (发 HEADERS)            open
   → (发 DATA[END_STREAM])   half-closed (local)
   → (收 HEADERS + DATA)     ...
   → (收 END_STREAM)         closed
```

**半关闭是常态**：客户端发完请求即进入 `half-closed (local)`，此后只接收响应。这与 1.1 的 TCP 半关闭是不同层次的概念。

### 状态相关的错误

- 向 `closed` 流发帧 → `STREAM_CLOSED`。
- 在 `half-closed (remote)` 上收到 `DATA`/`HEADERS` → `STREAM_CLOSED`。
- 因竞态在刚关闭的流上收到少量帧属**正常现象**——接收方 **SHOULD** 在一段时间内宽容忽略，而非立刻杀掉整条连接。

## 并发上限

`SETTINGS_MAX_CONCURRENT_STREAMS` 限制**对端**可同时打开的流数：

- 默认**无限制**——但双方都 **SHOULD** 设置有限值（常见 100–128）。
- 只计 `open` 与两种 `half-closed` 状态的流；`closed` 与 `idle` 不计。
- 超限时接收方 **MAY** 用 `REFUSED_STREAM` 或 `PROTOCOL_ERROR` 拒绝。
- 该值调小时，已存在的超限流**不必**关闭，但不得再开新流。

`REFUSED_STREAM` 有特殊价值：它**明确保证服务端未处理该请求**，因此客户端可以**自动重试任何方法**（含非幂等的 `POST`）——这是 1.1 完全没有的确定性。

## 多路复用的实际收益

对同一域下 100 个小资源：

| | 1.1（6 条连接） | h2（1 条连接） |
| --- | --- | --- |
| TCP 握手 | 6 次 | 1 次 |
| TLS 握手 | 6 次 | 1 次 |
| 并发上限 | 6 | 100+ |
| 头部字节 | 100 × 全量 | 首个全量，其余增量（[HPACK](/manual/computer-programming/http2-3/hpack)） |
| 单个慢资源 | 阻塞其所在连接的队列 | 只影响自己 |

副作用：**域名分片（domain sharding）成了反模式**。1.1 时代把资源拆到 `img1.`/`img2.` 多域以突破 6 连接限制；h2 下这只会增加握手与连接开销，应合并回单域。

## 仍然存在的队头阻塞

h2 消除的是 **HTTP 层**的队头阻塞，**TCP 层的仍在**：

```text
TCP 字节流:  [流1帧][流3帧][流1帧][流5帧]
                    ↑ 此段丢失
结果: 内核在重传补齐前不向应用交付后续任何字节
      → 流 3、流 5 明明已完整到达，也必须干等
```

丢包率越高，单连接 h2 越吃亏——极端情况下**不如**多条 1.1 连接（每条连接的丢包只影响自己）。这是 [HTTP/3 改用 QUIC](/manual/computer-programming/http2-3/quic-transport) 的唯一动机。

下一篇：[HPACK 头部压缩](/manual/computer-programming/http2-3/hpack)。
