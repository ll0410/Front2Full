---
title: "范围请求"
description: "Range 的三种范围形式、Content-Range 语法、206 与 multipart/byteranges 的构造。"
source: "https://daiw.org/manual/http11/range-requests"
---

# 范围请求

## Accept-Ranges

```text
Accept-Ranges = acceptable-ranges
acceptable-ranges = 1#range-unit / "none"
```

**响应**字段，声明服务端是否支持范围请求：

```text
Accept-Ranges: bytes
Accept-Ranges: none
```

唯一标准单位是 **`bytes`**。`none` 表示明确不支持。字段缺失时客户端**不应假定**支持，但可以试探性发送 `Range`。

## Range

```text
Range            = ranges-specifier
ranges-specifier = range-unit "=" range-set
range-set        = 1#range-spec
range-spec       = int-range / suffix-range / other-range
int-range        = first-pos "-" [ last-pos ]
suffix-range     = "-" suffix-length
```

### 三种形式

设表示总长为 10000 字节：

| 写法 | 含义 | 实际字节 |
| --- | --- | --- |
| `bytes=0-499` | 第 0 到第 499 字节 | 前 500 字节 |
| `bytes=500-` | 从第 500 字节到末尾 | 后 9500 字节 |
| `bytes=-500` | **最后** 500 字节 | 第 9500–9999 字节 |

**两端均为闭区间**——`bytes=0-499` 是 500 字节，不是 499。这是最高频的差一错误。

`bytes=-500` 的前导 `-` **不是负数**，是「后缀长度」记法。

### 多范围

```text
Range: bytes=0-499, 1000-1499, -200
```

-   范围**可以**重叠、**可以**乱序。
-   服务端 **MAY** 合并重叠范围、**MAY** 按升序重排、**MAY** 只返回其中一部分。
-   服务端 **MAY** 因范围过多（DoS 防护）直接返回 `200` 完整内容——这是允许的降级。

### 服务端处理规则

-   `Range` **仅对 `GET` 有定义**；其他方法收到时 **MUST** 忽略。
-   `first-pos` > `last-pos` → 该 range-spec **非法**，整个 `Range` 字段 **MUST** 被忽略（按 `200` 处理）。
-   所有范围都超出表示长度 → **416 Range Not Satisfiable**。
-   部分范围可满足 → 只返回可满足的那些，`206`。
-   `last-pos` 超出末尾 → 截断到末尾，不算错误。
-   服务端**始终**可以忽略 `Range` 返回完整 `200`。

## Content-Range

```text
Content-Range     = range-unit SP ( range-resp / unsatisfied-range )
range-resp        = incl-range "/" ( complete-length / "*" )
incl-range        = first-pos "-" last-pos
unsatisfied-range = "*/" complete-length
```

三种形态：

```text
Content-Range: bytes 0-499/10000      表示总长已知
Content-Range: bytes 0-499/*          总长未知（流式生成）
Content-Range: bytes */10000          416 响应，告知实际总长
```

要点：

-   单位与范围之间是 **SP**，不是 `=`（与 `Range` 相反）——高频写错点。
-   `complete-length` 是**完整表示**的长度，不是本次返回的长度；本次长度由 `Content-Length` 给出。
-   `Content-Range` 在 **`PUT` 请求中无意义**，服务端收到 **MUST** 返回 `400`。

## 206 的构造

### 单范围

```text
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-499/10000
Content-Length: 500
Content-Type: text/html

<500 字节数据>
```

-   **MUST** 带 `Content-Range`。
-   `Content-Length` = 本次返回的字节数（500），不是 10000。

### 多范围：multipart/byteranges

```text
HTTP/1.1 206 Partial Content
Content-Type: multipart/byteranges; boundary=SEP

--SEP
Content-Type: text/html
Content-Range: bytes 0-499/10000

<数据>
--SEP
Content-Type: text/html
Content-Range: bytes 1000-1499/10000

<数据>
--SEP--
```

规则：

-   **不带**顶层 `Content-Range`——每个 part 各自带。
-   每个 part **MUST** 带 `Content-Range`，**SHOULD** 带 `Content-Type`。
-   即使只请求了一个范围，服务端也**可以**用 multipart 形式回应；客户端必须能处理两种形态。

### 206 中的其他字段

`206` **MUST** 包含若返回 `200` 时会发的这些字段：`Date`、`Cache-Control`、`ETag`、`Content-Location`、`Expires`、`Vary`。

## If-Range

```text
If-Range = entity-tag / HTTP-date
```

解决**断点续传时资源已变**的问题。客户端把上次拿到的验证器带上：

```text
GET /big.iso HTTP/1.1
Range: bytes=5000000-
If-Range: "abc123"
```

服务端处理：

-   验证器**匹配** → 资源未变，返回 `206` 续传部分。
-   验证器**不匹配** → 资源已变，**忽略 `Range`**，返回完整 `200`（而不是 `412`）。

关键约束：

-   **必须用强验证器**。用 `ETag` 时是**强比较**；弱 ETag 不可用于 `If-Range`。
-   用日期形式时，仅当服务端能确保该 `Last-Modified` 是强验证器（与 `Date` 差 ≥1 秒）才可信任。
-   `If-Range` **无 `Range` 时必须被忽略**。
-   该设计让客户端一次往返就能处理两种情况：要么续传，要么重下。

## 缓存与范围

-   缓存可以存储 `206` 的部分内容，并在后续范围请求时**拼接**已存片段——前提是各片段的**验证器相同**。
-   验证器不同的片段**MUST NOT** 拼接（会产生损坏文件）。
-   这正是弱 ETag 被禁止用于 `Range` 的根本原因。

下一篇：[缓存](/manual/computer-programming/http11/caching)——Cache-Control 指令全集与新鲜度计算。
