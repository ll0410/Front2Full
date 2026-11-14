---
title: "HTTP/2 与 HTTP/3 协议详解"
description: "二进制分帧、HPACK/QPACK、多路复用与 QUIC——逐项拆解 HTTP/2 与 HTTP/3 相对 1.1 改了什么。"
source: "https://daiw.org/manual/http2-3"
---

# HTTP/2 与 HTTP/3 协议详解

> 内容来源：[daiw.org](https://daiw.org/manual/http2-3) · 作者 David · 原文更新于 2026-08-03

二进制分帧、HPACK/QPACK、多路复用与 QUIC——逐项拆解 HTTP/2 与 HTTP/3 相对 1.1 改了什么。

本专栏只回答一个问题：**HTTP/2 与 HTTP/3 相对 HTTP/1.1 具体改了什么，怎么改的，代价是什么。**

前提：[《HTTP/1.1 协议详解》](/manual/computer-programming/http11/)。本专栏默认你已知道 1.1 的报文语法与字段语义，不再重复。

## 一句话概括

- **HTTP/2** 换掉了 1.1 的**报文成帧层**——文本行改二进制帧，一条连接上多路复用多个请求，头部用 HPACK 压缩。**语义完全不变**。
- **HTTP/3** 换掉了 HTTP/2 的**传输层**——TCP 改 QUIC（跑在 UDP 上），消除 TCP 层的队头阻塞，握手从 2–3 RTT 降到 1 RTT（复访 0 RTT）。

**三个版本的语义是同一套**：方法、状态码、字段含义、条件请求、缓存、认证全部沿用 RFC 9110。变的只有「字节怎么排」与「跑在什么之上」。

## 规范基准

| 规范 | RFC | 年份 |
| --- | --- | --- |
| HTTP 语义（三版共用） | 9110 | 2022 |
| HTTP/2 | **9113**（废止 7540） | 2022 |
| HPACK（h2 头压缩） | 7541 | 2015 |
| HTTP/3 | **9114** | 2022 |
| QPACK（h3 头压缩） | 9204 | 2022 |
| QUIC 传输 / TLS / 恢复 | 9000 / 9001 / 9002 | 2021 |
| 可扩展优先级 | 9218 | 2022 |

## 1.1 的四个瓶颈

后面每一章都在解决其中之一：

| 瓶颈 | 1.1 的表现 | 解法 |
| --- | --- | --- |
| **队头阻塞（应用层）** | 流水线中一个慢响应堵住其后全部 | h2 [多路复用](/manual/computer-programming/http2-3/h2-streams) |
| **队头阻塞（传输层）** | 一个 TCP 包丢失，其后所有数据等重传 | h3 [QUIC 流](/manual/computer-programming/http2-3/quic-transport) |
| **头部冗余** | 每请求重发全部字段，明文数百字节 | h2 [HPACK](/manual/computer-programming/http2-3/hpack) / h3 [QPACK](/manual/computer-programming/http2-3/qpack) |
| **连接数爆炸** | 浏览器每域开 6 条连接绕开阻塞 | 单连接多路复用 |

## 阅读顺序

**第 1 部分 · HTTP/2**——[总览](/manual/computer-programming/http2-3/h2-overview)、[二进制分帧](/manual/computer-programming/http2-3/h2-framing)、[流与多路复用](/manual/computer-programming/http2-3/h2-streams)、[HPACK](/manual/computer-programming/http2-3/hpack)、[伪头字段](/manual/computer-programming/http2-3/h2-pseudo-headers)、[流量控制](/manual/computer-programming/http2-3/h2-flow-control)、[SETTINGS 与优先级](/manual/computer-programming/http2-3/h2-settings-priority)、[连接管理](/manual/computer-programming/http2-3/h2-connection)、[服务端推送](/manual/computer-programming/http2-3/h2-server-push)。

**第 2 部分 · HTTP/3 与 QUIC**——[总览](/manual/computer-programming/http2-3/h3-overview)、[QUIC 传输层](/manual/computer-programming/http2-3/quic-transport)、[帧格式](/manual/computer-programming/http2-3/h3-framing)、[QPACK](/manual/computer-programming/http2-3/qpack)、[连接与发现](/manual/computer-programming/http2-3/h3-connection)。

**第 3 部分 · 对照与迁移**——[三版全面对照](/manual/computer-programming/http2-3/version-comparison)、[迁移注意事项](/manual/computer-programming/http2-3/migration-notes)。

从 [HTTP/2 总览](/manual/computer-programming/http2-3/h2-overview) 开始。

## 本专栏篇目

- [HTTP/2 与 HTTP/3 协议详解](/manual/computer-programming/http2-3/): 二进制分帧、HPACK/QPACK、多路复用与 QUIC——逐项拆解 HTTP/2 与 HTTP/3 相对 1.1 改了什么。

### 第 1 部分 · HTTP/2

- [HTTP/2 总览](/manual/computer-programming/http2-3/h2-overview): h2 改了什么、没改什么，以及 ALPN 协商与 h2c 的废弃。
- [二进制分帧层](/manual/computer-programming/http2-3/h2-framing): 9 字节帧头的每个比特、十种帧类型与标志位的精确语义。
- [流与多路复用](/manual/computer-programming/http2-3/h2-streams): 流 ID 分配规则、七态状态机与多路复用如何消除应用层队头阻塞。
- [HPACK 头部压缩](/manual/computer-programming/http2-3/hpack): 静态表、动态表、整数与字符串编码、六种字段表示格式，以及为何不用 gzip。
- [伪头字段](/manual/computer-programming/http2-3/h2-pseudo-headers): 五个冒号开头的伪头、与 1.1 起始行的映射，以及被禁用的连接级字段。
- [流量控制](/manual/computer-programming/http2-3/h2-flow-control): 连接级与流级窗口、WINDOW_UPDATE 语义与初始窗口变更的边界情况。
- [SETTINGS 与优先级](/manual/computer-programming/http2-3/h2-settings-priority): 六个 SETTINGS 参数、ACK 机制，以及优先级树的废弃与 RFC 9218 扩展优先级。
- [连接管理与错误码](/manual/computer-programming/http2-3/h2-connection): 连接前言、GOAWAY 的优雅关闭语义、十四个错误码与流错误/连接错误的区分。
- [服务端推送](/manual/computer-programming/http2-3/h2-server-push): PUSH_PROMISE 机制、它为什么失败，以及 103 Early Hints 这个替代方案。

### 第 2 部分 · HTTP/3 与 QUIC

- [HTTP/3 总览](/manual/computer-programming/http2-3/h3-overview): TCP 队头阻塞为什么无法在 TCP 上解决，以及 h3 = HTTP/2 语义 + QUIC 传输。
- [QUIC 传输层](/manual/computer-programming/http2-3/quic-transport): 流与流 ID、变长整数、1-RTT/0-RTT 握手、连接 ID 与连接迁移。
- [HTTP/3 帧格式](/manual/computer-programming/http2-3/h3-framing): 变长帧头、七种帧类型、四类单向流，以及被删除的 h2 帧。
- [QPACK 头部压缩](/manual/computer-programming/http2-3/qpack): HPACK 为何在乱序交付下失效、编码器/解码器流、Required Insert Count 与阻塞流。
- [连接与服务发现](/manual/computer-programming/http2-3/h3-connection): Alt-Svc、DNS HTTPS 记录、GOAWAY 的双向语义与回落策略。

### 第 3 部分 · 对照与迁移

- [三版全面对照](/manual/computer-programming/http2-3/version-comparison): 1.1 / 2 / 3 在成帧、多路复用、压缩、连接管理与安全上的逐项差异表。
- [迁移注意事项](/manual/computer-programming/http2-3/migration-notes): 哪些 1.1 知识作废、哪些照旧，以及升级 h2/h3 时真正会踩的坑。
