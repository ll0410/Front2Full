---
title: "QPACK 头部压缩"
description: "HPACK 为何在乱序交付下失效、编码器/解码器流、Required Insert Count 与阻塞流。"
source: "https://daiw.org/manual/http2-3/qpack"
---

# QPACK 头部压缩

HPACK 为何在乱序交付下失效、编码器/解码器流、Required Insert Count 与阻塞流。

RFC 9204。它存在的唯一原因：**HPACK 在乱序交付的传输上会失效**。

## HPACK 为什么不能直接用

[HPACK 的动态表](/manual/computer-programming/http2-3/hpack)要求编解码双方**严格按同一顺序**演进：

```text
h2 (TCP，全局有序):
  请求1: 插入 "cookie: abc" → 动态表索引 62
  请求2: 引用索引 62
  → TCP 保证请求 1 先于请求 2 到达，解码必定成功
```

QUIC 的流是**独立交付**的——这正是它消除队头阻塞的方式，但也意味着**没有全局顺序**：

```text
h3 (QUIC，流间无序):
  流A: 插入 "cookie: abc" → 索引 62
  流B: 引用索引 62
  → 若流 A 的包丢失，流 B 先到达
  → 解码器不知道索引 62 是什么 → 解码失败
```

若为此强制全局有序，就等于把队头阻塞又装了回来——HTTP/3 的意义荡然无存。

QPACK 的解法：**把「动态表更新」与「字段块引用」分离到不同的流上，并让编码器自己决定冒多大的阻塞风险。**

## 三条流

| 流 | 方向 | 内容 |
| --- | --- | --- |
| **请求流** | 双向 | `HEADERS` 帧，含字段块（**引用**表项） |
| **编码器流** | 单向 | 动态表**插入**指令 |
| **解码器流** | 单向 | 插入计数确认、流取消 |

编码器把「插入 `cookie: abc`」发在**编码器流**上，把「引用它」发在**请求流**上。两条流独立交付。

## 静态表

99 个条目（索引 0–98），比 HPACK 的 61 个更大，且是按 HTTP/3 实测流量重新统计选出的。节选：

| 索引 | 字段名 | 值 |
| --- | --- | --- |
| 0 | `:authority` | — |
| 1 | `:path` | `/` |
| 17 | `:method` | `GET` |
| 25 | `:status` | `200` |
| 31 | `content-type` | `application/json` |
| 95 | `user-agent` | — |

静态表**无状态**，任何流随时可引用，永不阻塞。

## 动态表与绝对索引

QPACK 的动态表条目有**绝对索引**（从 0 起单调递增，永不回绕）。字段块中用两种相对形式引用：

- **相对索引**：相对于该字段块的 `Base`。
- **后基索引（post-base）**：引用在本字段块编码**之后**才插入的条目。

这套设计让编码器可以在同一往返中「边插入边引用」。

## Required Insert Count

每个字段块的前缀里带 **Required Insert Count（RIC）**——解码本块所需的**最小动态表插入数**。

解码器的逻辑：

```text
若 已收到的插入数 >= RIC:
    立即解码
否则:
    该流「阻塞」，等编码器流补齐后再解
```

**RIC = 0 表示该块完全不引用动态表**（只用静态表和字面量），可**无条件立即解码**——永不阻塞。

## 阻塞流与风险控制

`SETTINGS_QPACK_BLOCKED_STREAMS`（默认 **0**）声明解码器**最多容忍多少条流处于阻塞状态**。

编码器据此权衡：

| 编码器策略 | 压缩率 | 阻塞风险 |
| --- | --- | --- |
| 只用静态表 + 字面量（RIC 恒 0） | 低 | **零** |
| 积极引用最新插入的条目 | 高 | 高——丢包时多条流一起等 |
| 只引用**已被确认**的条目 | 中 | **零**（确认意味着解码器已收到） |

第三种是生产中的常见折中：编码器通过**解码器流**上的 `Section Acknowledgement` 得知哪些插入已确认，只引用这些，从而在拿到大部分压缩收益的同时**完全避免**队头阻塞。

注意默认值：`QPACK_MAX_TABLE_CAPACITY` 与 `QPACK_BLOCKED_STREAMS` **都默认为 0**——即**默认不启用动态表**，退化为「静态表 + 字面量 + Huffman」。要用动态表必须双方显式协商。

## 指令格式

### 编码器流指令

| 指令 | 首位模式 | 作用 |
| --- | --- | --- |
| Set Dynamic Table Capacity | `001xxxxx` | 调整动态表容量 |
| Insert With Name Reference | `1Txxxxxx` | 插入，名字引用静态/动态表 |
| Insert With Literal Name | `01Mxxxxx` | 插入，名字为字面量 |
| Duplicate | `000xxxxx` | 复制已有条目（把老条目挪到表头防淘汰） |

### 解码器流指令

| 指令 | 首位模式 | 作用 |
| --- | --- | --- |
| Section Acknowledgement | `1xxxxxxx` | 确认某流的字段块已解码 |
| Stream Cancellation | `01xxxxxx` | 流被取消，其引用作废 |
| Insert Count Increment | `00xxxxxx` | 告知已处理的插入数 |

`Section Acknowledgement` 是关键的反馈通道：它让编码器知道「这个条目对端确实有了」，从而安全地重复引用。

## 与 HPACK 的对照

| | HPACK (h2) | QPACK (h3) |
| --- | --- | --- |
| 静态表 | 61 项 | **99 项** |
| 表更新与引用 | **同一通道**（严格有序） | **分离到不同流** |
| 乱序容忍 | 无（必须有序） | **有**（RIC + 阻塞机制） |
| 表失步后果 | `COMPRESSION_ERROR` 杀连接 | `QPACK_DECOMPRESSION_FAILED` 杀连接 |
| 默认启用动态表 | 是（4096 字节） | **否**（容量默认 0） |
| 整数/字符串编码 | 前缀整数 + Huffman | **相同**（复用 HPACK 的编码原语与 Huffman 表） |
| 安全表示 | Never Indexed | 同样有（`N` 位） |

**编码原语是一样的**——变的只是「如何在无序传输上安全地维护共享状态」这一层。

下一篇：[连接与服务发现](/manual/computer-programming/http2-3/h3-connection)。
