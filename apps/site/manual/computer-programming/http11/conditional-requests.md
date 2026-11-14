---
title: "条件请求"
description: "ETag 强弱比较、Last-Modified 验证器与五个 If-* 字段的求值优先级。"
source: "https://daiw.org/manual/http11/conditional-requests"
---

# 条件请求

## ETag

```text
ETag       = entity-tag
entity-tag = [ weak ] opaque-tag
weak       = %s"W/"
opaque-tag = DQUOTE *etagc DQUOTE
etagc      = %x21 / %x23-7E / obs-text
```

```text
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
ETag: W/"v1.2"
```

逐条约束：

-   **双引号是语法的一部分**，不可省略。`ETag: abc` 非法——这是最常见的实现错误。
-   前缀 `W/` **大小写敏感**（`%s` 表示区分大小写），且必须紧贴引号。
-   标签内容对客户端**完全不透明**：不得解析、不得比较大小、不得推断含义。
-   内容不可含 `"`（0x22）本身。
-   生成方式不限（哈希、版本号、时间戳皆可），但**必须**在表示改变时改变。

### 强验证器 vs 弱验证器

|  | 强（`"x"`） | 弱（`W/"x"`） |
| --- | --- | --- |
| 保证 | **字节级完全相同** | 语义等价即可，字节可不同 |
| 可用于 `Range` | ✅ | ❌ |
| 典型来源 | 内容哈希 | 「内容没实质变化」的人工判断 |

**gzip 压缩会改变字节**——同一资源的压缩版与非压缩版**必须**用不同的强 ETag，否则范围请求会拼出损坏的文件。许多服务器在启用动态压缩时错误地保留原 ETag 或简单地加后缀，这是真实存在的数据损坏源。

### 两种比较算法

| 算法 | 规则 | 用于 |
| --- | --- | --- |
| **强比较** | 两者均为**强**验证器 且 字节相同 | `If-Match`、`If-Range` |
| **弱比较** | 字节相同即可，**忽略** `W/` 前缀 | `If-None-Match` |

例：`W/"1"` 与 `W/"1"` 弱比较**匹配**、强比较**不匹配**；`"1"` 与 `W/"1"` 两种比较都**不匹配**（前缀不同即字节不同）。

## Last-Modified

```text
Last-Modified = HTTP-date
```

表示的最后修改时刻，是**弱验证器**（精度仅到秒，同一秒内的多次修改无法区分）。

-   **MUST NOT** 晚于响应的 `Date`。
-   仅当满足以下之一时才可当作**强**验证器：修改时间与 `Date` 相差至少 1 秒，或缓存有其他手段确认该秒内无变更。
-   服务端应**同时**发 `ETag` 与 `Last-Modified`——前者精确，后者兼容旧客户端与启发式缓存计算。

## 五个条件字段

```text
If-Match            = "*" / #entity-tag
If-None-Match       = "*" / #entity-tag
If-Modified-Since   = HTTP-date
If-Unmodified-Since = HTTP-date
If-Range            = entity-tag / HTTP-date
```

### If-Match

**强比较**。用于**避免丢失更新**（乐观并发控制）：

```text
PUT /doc HTTP/1.1
If-Match: "v1"
```

-   匹配 → 正常执行。
-   不匹配 → **412 Precondition Failed**，请求不得产生副作用。
-   `*` → 只要资源**当前存在**就通过。

### If-None-Match

**弱比较**。两种用途：

```text
GET /doc HTTP/1.1
If-None-Match: "v1"
```

-   **缓存验证**（`GET`/`HEAD`）：匹配 → **304 Not Modified**；不匹配 → 正常 `200`。
-   **避免覆盖**（其他方法）：`If-None-Match: *` 表示「仅当资源**不存在**时才执行」——用于原子创建，已存在则返回 `412`。

### If-Modified-Since

仅对 `GET`/`HEAD` 有效，且**仅在无 `If-None-Match` 时**才求值。

-   资源在该时刻后**未**修改 → `304`。
-   已修改 → `200`。
-   日期无效或晚于服务端当前时间 → **MUST 忽略**该字段。

### If-Unmodified-Since

`If-Match` 的日期版，仅在**无 `If-Match`** 时求值。未修改 → 执行；已修改 → `412`。

### If-Range

见[范围请求](/manual/computer-programming/http11/range-requests)。仅在有 `Range` 时求值，**强比较**。

## 求值优先级（MUST 按序）

多个条件字段同时出现时，接收方 **MUST** 按此顺序求值，**先命中先返回**：

1.  **`If-Match`** 存在 → 求值。假 → `412`。
2.  `If-Match` **不存在** 且 `If-Unmodified-Since` 存在 → 求值。假 → `412`。
3.  **`If-None-Match`** 存在 → 求值。假（即匹配上了）→ `GET`/`HEAD` 返回 `304`，其他方法返回 `412`。
4.  方法为 `GET`/`HEAD` 且 `If-None-Match` **不存在** 且 `If-Modified-Since` 存在 → 求值。假 → `304`。
5.  方法为 `GET` 且有 `Range` 且 `If-Range` 存在 → 求值。真 → `206`；假 → 忽略 `Range`，返回完整 `200`。

关键推论：**ETag 优先于日期**。同时发 `If-None-Match` 与 `If-Modified-Since` 时，后者被完全忽略——这是有意设计，因为 ETag 更精确。

## 304 响应的构造

命中缓存验证时：

-   **MUST NOT** 有消息体。
-   **MUST** 带若返回 `200` 时会发的 `ETag`、`Last-Modified`（若有）。
-   **SHOULD** 带 `Cache-Control`、`Vary`、`Expires`、`Date`、`Content-Location`。
-   **不应**带 `Content-Type`、`Content-Encoding` 等描述体的字段（无体可描述）。
-   缓存收到后 **MUST** 用这些头更新已存储副本，再把更新后的完整响应交给客户端。

## 副作用约束

条件求值为**假**时，请求 **MUST NOT** 产生任何副作用。这是 `If-Match` 能实现并发控制的前提：服务端必须在**执行前**求值，且求值与执行需相对于其他并发请求保持原子。

下一篇：[范围请求](/manual/computer-programming/http11/range-requests)——Range、Content-Range 与 206 的构造。
