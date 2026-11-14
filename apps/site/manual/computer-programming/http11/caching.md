---
title: "缓存"
description: "Cache-Control 请求与响应指令全集、Expires/Age 与新鲜度计算公式。"
source: "https://daiw.org/manual/http11/caching"
---

# 缓存

规范基准是 **RFC 9111**。缓存键默认是「请求方法 + 目标 URI」，再由 `Vary` 扩展。

## 可存储的前提

缓存 **MUST NOT** 存储响应，除非全部满足：

1.  请求方法可缓存（`GET`/`HEAD`，或带显式新鲜度的 `POST`）。
2.  响应状态码可缓存（见[状态码](/manual/computer-programming/http11/status-codes)的默认可缓存列表），或有显式指令允许。
3.  请求与响应中都**无 `no-store`**。
4.  若是**共享缓存**：响应无 `private`；且请求无 `Authorization`（除非响应带 `public`/`s-maxage`/`must-revalidate`）。
5.  响应有以下之一：`Expires`、`max-age`、`s-maxage`（共享缓存）、可用的启发式依据、`public`。

## Cache-Control 语法

```text
Cache-Control = #cache-directive
cache-directive = token [ "=" ( token / quoted-string ) ]
```

指令名**大小写不敏感**。不认识的指令 **MUST** 被忽略（不影响其他指令）。`delta-seconds` 是**非负十进制整数**，溢出实现上限时按上限处理。

## 响应指令

| 指令 | 语义 |
| --- | --- |
| `max-age=N` | 响应在生成后 N 秒内新鲜 |
| `s-maxage=N` | 同上，**仅对共享缓存**，且**覆盖** `max-age` 与 `Expires` |
| `no-cache` | **可以存储**，但复用前 **MUST** 向源站成功验证 |
| `no-store` | **MUST NOT** 存储本请求或响应的任何部分 |
| `private` | 仅**私有**缓存可存储；共享缓存禁止 |
| `public` | 即使通常不可缓存（如带 `Authorization`）也可被共享缓存存储 |
| `must-revalidate` | 一旦陈旧，**MUST NOT** 在未成功验证前使用；源站不可达时 **MUST** 返回 `504` |
| `proxy-revalidate` | 同上，仅对共享缓存 |
| `must-understand` | 缓存仅在**理解该状态码**的缓存需求时才可存储；应与 `no-store` 连用作降级 |
| `no-transform` | 中间件 **MUST NOT** 改动体或 `Content-Encoding`/`Content-Type`/`Content-Range` |

### no-cache 与 no-store 的区别

高频混淆：

-   **`no-cache`**：存，但每次用前必须验证（可命中 `304`，省带宽）。
-   **`no-store`**：**根本不存**，磁盘上不留痕迹。用于敏感数据。

要「绝对不缓存」应发 `Cache-Control: no-store`，单发 `no-cache` 达不到目的。

### 带参数的限定形式

```text
Cache-Control: no-cache="Set-Cookie"
Cache-Control: private="X-Internal-Id"
```

仅对**列出的字段**生效：可以复用缓存，但复用前必须移除这些字段。**仅响应指令**可带此参数形式；共享缓存必须支持，否则应按无参数形式（更严格）处理。

### 扩展指令

| 指令 | RFC | 语义 |
| --- | --- | --- |
| `immutable` | 8246 | 新鲜期内即使用户强制刷新也**不发验证请求**。用于带哈希文件名的静态资源 |
| `stale-while-revalidate=N` | 5861 | 陈旧后 N 秒内可**先返回旧副本**，后台异步验证 |
| `stale-if-error=N` | 5861 | 源站返回 `5xx`/不可达时，N 秒内可继续用旧副本 |

## 请求指令

| 指令 | 语义 |
| --- | --- |
| `max-age=N` | 只接受年龄 ≤ N 秒的副本 |
| `max-stale[=N]` | 接受已陈旧的副本；带 N 则限制超期不超过 N 秒；不带值表示接受任意陈旧程度 |
| `min-fresh=N` | 要求副本在 N 秒内仍保持新鲜 |
| `no-cache` | 强制向源站验证后再返回（浏览器 Ctrl+F5 的行为） |
| `no-store` | 不得存储本次请求与响应 |
| `no-transform` | 禁止中间件改动 |
| `only-if-cached` | **仅**返回已缓存副本；无可用副本时 **MUST** 返回 `504` |

## Expires

```text
Expires = HTTP-date
```

绝对过期时刻。**优先级低于** `max-age`/`s-maxage`——两者同时存在时 `Cache-Control` 胜出（因其不受时钟偏差影响）。

-   无效日期（含 `Expires: 0`）**MUST** 被解析为「已过期」。
-   早于 `Date` 表示已过期。
-   建议值不超过一年后。

## Age

```text
Age = delta-seconds
```

**响应**字段，由缓存添加，表示该副本自源站生成以来经过的**秒数**估计值。源站不发 `Age`；`Age: 0` 表示刚从源站取回。

## 新鲜度计算

### freshness\_lifetime 的取值顺序

```text
1. s-maxage        (仅共享缓存)
2. max-age
3. Expires - Date
4. 启发式估算
```

命中即停。

### current\_age

```text
apparent_age          = max(0, response_time - date_value)
corrected_age_value   = age_value + (response_time - request_time)
corrected_initial_age = max(apparent_age, corrected_age_value)
current_age           = corrected_initial_age + (now - response_time)
```

取 `max` 的目的是**抵消时钟偏差**：无论本机时钟快还是源站时钟慢，都取更保守（更老）的估计。

### 判定

```text
响应新鲜  ⟺  freshness_lifetime > current_age
```

陈旧后并非不可用——除非有 `must-revalidate`/`no-cache`，缓存 **MAY** 在客户端允许（`max-stale`）或源站不可达（`stale-if-error`）时继续返回陈旧副本。

### 启发式新鲜度

无任何显式过期信息时，缓存 **MAY** 自行估算。常见做法是取 `(Date − Last-Modified) × 10%`，并设上限（如 24 小时）。

-   仅可用于**默认可缓存**的状态码。
-   RFC 9111 **移除了 `Warning` 字段**（原用于标注启发式/陈旧响应），不应再发送或依赖。

## 验证与更新

副本陈旧后，缓存发**条件请求**（`If-None-Match` 优先于 `If-Modified-Since`）：

-   收到 `304` → 用响应头**更新**已存副本，重置年龄，返回给客户端。
-   收到 `200` → 用新响应**替换**旧副本。
-   收到 `5xx` → 按 `stale-if-error` 决定返回旧副本还是透传错误；有 `must-revalidate` 时 **MUST** 返回 `504`。

## 失效（invalidation）

缓存 **MUST** 在收到**非安全方法**（`POST`/`PUT`/`DELETE`/`PATCH`）的**成功**响应后，失效以下 URI 的已存副本：

1.  请求的目标 URI。
2.  响应中 `Location` 与 `Content-Location` 所指 URI——**仅当**其 origin 与目标 URI **相同**（防止跨站投毒）。

非成功响应（4xx/5xx）**不触发**失效。

## 与 Authorization 的交互

带 `Authorization` 的请求，其响应**默认不可被共享缓存存储**。仅当响应显式带 `public`、`s-maxage` 或 `must-revalidate` 时才允许——这是防止把 A 用户的私有数据发给 B 用户的关键防线。

下一篇：[认证](/manual/computer-programming/http11/authentication)——挑战语法与 Authorization 字段。
