---
title: "SETTINGS 与优先级"
description: "六个 SETTINGS 参数、ACK 机制，以及优先级树的废弃与 RFC 9218 扩展优先级。"
source: "https://daiw.org/manual/http2-3/h2-settings-priority"
---

# SETTINGS 与优先级

六个 SETTINGS 参数、ACK 机制，以及优先级树的废弃与 RFC 9218 扩展优先级。

## SETTINGS 帧

连接级参数协商，流 ID **MUST** 为 0。

机制要点：

- **不是握手，是单向声明**：每一端各自声明「**我这边**的接收能力」。双方的值互相独立，无需一致。
- 载荷是若干 6 字节条目：2 字节标识符 + 4 字节值。载荷长度不是 6 的倍数 → `FRAME_SIZE_ERROR`。
- 接收方 **MUST** 立即（在处理后续帧之前）应用这些值，并回一个置 `ACK` 标志（`0x01`）的空 `SETTINGS`。
- 带 `ACK` 的帧载荷长度必须为 0，否则 `FRAME_SIZE_ERROR`。
- 长时间收不到 ACK **MAY** 以 `SETTINGS_TIMEOUT` 关闭连接。
- 未知标识符 **MUST** 被忽略（扩展点）。

## 六个标准参数

| ID | 名称 | 默认值 | 语义 |
| --- | --- | --- | --- |
| `0x01` | `HEADER_TABLE_SIZE` | 4096 | 对端 [HPACK 动态表](/manual/computer-programming/http2-3/hpack)上限（字节） |
| `0x02` | `ENABLE_PUSH` | 1 | 是否允许[服务端推送](/manual/computer-programming/http2-3/h2-server-push)；只能取 0/1，其他值 → `PROTOCOL_ERROR` |
| `0x03` | `MAX_CONCURRENT_STREAMS` | 无限 | 对端可同时打开的流数 |
| `0x04` | `INITIAL_WINDOW_SIZE` | 65535 | 流级[流量控制](/manual/computer-programming/http2-3/h2-flow-control)初始窗口；> 2^31−1 → `FLOW_CONTROL_ERROR` |
| `0x05` | `MAX_FRAME_SIZE` | 16384 | 可接收的最大帧载荷；**合法范围 16384 – 16777215**，越界 → `PROTOCOL_ERROR` |
| `0x06` | `MAX_HEADER_LIST_SIZE` | 无限 | 可接收的字段列表未压缩大小上限（含每字段 32 字节开销）；仅为**建议** |

生产调优的三个重点：

1. `INITIAL_WINDOW_SIZE` —— 默认 65535 在高 BDP 链路上严重限速，通常调到 MB 级。
2. `MAX_CONCURRENT_STREAMS` —— 默认无限意味着无防护，**必须**设有限值（常见 100–128），否则易受流洪泛。
3. `MAX_HEADER_LIST_SIZE` —— 默认无限，是 HPACK 炸弹的防线，应显式设置。

## 优先级：一段被推翻的设计

### RFC 7540 的优先级树（已废弃）

原设计中，`PRIORITY` 帧与 `HEADERS` 的优先级字段可构建一棵**依赖树**：

- 每个流可声明**依赖**另一个流（`Stream Dependency`）。
- 同层兄弟按**权重**（1–256）按比例分配带宽。
- 支持**独占依赖**（`E` 标志），把原有兄弟全部改挂到自己名下。

**RFC 9113 已将其全部废弃**（deprecated）。废弃原因，逐条：

| 问题 | 说明 |
| --- | --- |
| 过度复杂 | 服务端要维护每连接一棵可变树，含已关闭流的「幽灵节点」 |
| 实现分歧大 | 各服务端调度策略互不兼容，客户端无法预期效果 |
| 浏览器各行其是 | Chrome 用线性链、Firefox 用分组树，服务端难以同时优化 |
| 收益不明 | 实测多数场景与简单的 FIFO/轮转差别不大 |
| 攻击面 | 恶意构造的深树消耗服务端内存与 CPU |

现状：端点**仍 MUST 能解析**这些字段（向后兼容，收到即忽略），但 **SHOULD NOT** 再生成。多数现代服务端直接无视优先级树。

### RFC 9218 扩展优先级（现行方案）

替代方案把优先级从「二进制帧里的树」改成了**普通的 HTTP 字段**，且 h2 与 h3 **通用**：

```http
priority: u=1, i
```

两个参数（[结构化字段](/manual/computer-programming/http11/field-syntax)语法）：

| 参数 | 类型 | 取值 | 语义 |
| --- | --- | --- | --- |
| `u` | 整数 | **0–7**，默认 **3** | 紧急度，**数值越小优先级越高** |
| `i` | 布尔 | 默认 false | incremental：为真表示可**渐进式**呈现（如渐进 JPEG、HTML 流式渲染） |

用法：

- 客户端在请求的 `priority` 字段中声明。
- 服务端可在响应中用 `priority` 字段**覆盖**（服务端更清楚资源性质）。
- 也可用 `PRIORITY_UPDATE` 帧（h2 类型 `0x10`，h3 类型 `0xF0700`/`0xF0701`）在请求发出后**动态改**。
- `i=?1` 的同优先级流应**轮转**调度（让多个可渐进资源同时推进）；`i=?0` 的应**顺序**完成（一个一个来，早点可用）。

设计上的进步：无状态、可读、可被中间件理解、h2/h3 统一——而不是一棵需要双方精确同步的树。

下一篇：[连接管理与错误码](/manual/computer-programming/http2-3/h2-connection)。
