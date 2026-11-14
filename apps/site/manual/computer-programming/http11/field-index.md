---
title: "字段速查表"
description: "全部字段按 A–Z 索引——方向、语法要点、是否逐跳，链到详解。"
source: "https://daiw.org/manual/http11/field-index"
---

# 字段速查表

方向：**Req** = 请求，**Res** = 响应，**Rep** = 表示字段（两侧皆可）。逐跳字段以 **⚠️** 标注（代理必须剥离）。

## A–C

| 字段 | 方向 | 语法要点 | 详解 |
| --- | --- | --- | --- |
| `Accept` | Req | `#( media-range [ weight ] )`；特异性优先于 q | [协商](/manual/computer-programming/http11/content-negotiation) |
| `Accept-Charset` | Req | **已废弃**，勿用 | [协商](/manual/computer-programming/http11/content-negotiation) |
| `Accept-Encoding` | Req | 空值 = 只接受 `identity` | [协商](/manual/computer-programming/http11/content-negotiation) |
| `Accept-Language` | Req | 语言范围 + q；子标签数不影响排序 | [协商](/manual/computer-programming/http11/content-negotiation) |
| `Accept-Patch` | Res | `#media-type` | [上下文](/manual/computer-programming/http11/context-fields) |
| `Accept-Ranges` | Res | `bytes` / `none` | [范围](/manual/computer-programming/http11/range-requests) |
| `Age` | Res | `delta-seconds`，缓存添加 | [缓存](/manual/computer-programming/http11/caching) |
| `Allow` | Res | `#method`；`405` 中必需 | [方法](/manual/computer-programming/http11/methods) |
| `Authentication-Info` | Res | `#auth-param` | [认证](/manual/computer-programming/http11/authentication) |
| `Authorization` | Req | `auth-scheme SP (token68 / #auth-param)` | [认证](/manual/computer-programming/http11/authentication) |
| `Cache-Control` | Req/Res | `#cache-directive`；未知指令须忽略 | [缓存](/manual/computer-programming/http11/caching) |
| `Connection` | Req/Res ⚠️ | 列逐跳字段名 + `close` | [连接](/manual/computer-programming/http11/connection-management) |
| `Content-Disposition` | Res | `attachment; filename*=UTF-8''…` | [上下文](/manual/computer-programming/http11/context-fields) |
| `Content-Encoding` | Rep | 端到端；改变 ETag | [表示](/manual/computer-programming/http11/representation-fields) |
| `Content-Language` | Rep | `#language-tag`，指受众 | [表示](/manual/computer-programming/http11/representation-fields) |
| `Content-Length` | Rep | **十进制**；与 TE 冲突时无效 | [成帧](/manual/computer-programming/http11/message-body-length) |
| `Content-Location` | Rep | 本表示的 URI，非重定向 | [表示](/manual/computer-programming/http11/representation-fields) |
| `Content-Range` | Res | `bytes SP 0-499/10000`（**SP** 非 `=`） | [范围](/manual/computer-programming/http11/range-requests) |
| `Content-Type` | Rep | `type/subtype` + 参数 | [表示](/manual/computer-programming/http11/representation-fields) |
| `Cookie` | Req | `;` 分隔；**只有名值对** | [Cookie](/manual/computer-programming/http11/cookies) |

## D–L

| 字段 | 方向 | 语法要点 | 详解 |
| --- | --- | --- | --- |
| `Date` | Res | IMF-fixdate，恒 GMT | [日期](/manual/computer-programming/http11/http-date) |
| `ETag` | Res | **双引号必需**；`W/` 区分大小写 | [条件](/manual/computer-programming/http11/conditional-requests) |
| `Expect` | Req ⚠️ | 仅 `100-continue`；未知值 → `417` | [连接](/manual/computer-programming/http11/connection-management) |
| `Expires` | Res | 绝对时刻；优先级低于 `max-age` | [缓存](/manual/computer-programming/http11/caching) |
| `Forwarded` | Req | `for=`/`by=`/`host=`/`proto=`；IPv6 须 `"[…]"` | [代理](/manual/computer-programming/http11/proxy-fields) |
| `From` | Req | 邮箱；无鉴权语义 | [上下文](/manual/computer-programming/http11/context-fields) |
| `Host` | Req | **必需且唯一**；缺失 → `400` | [请求行](/manual/computer-programming/http11/request-line) |
| `If-Match` | Req | **强比较**；失败 → `412` | [条件](/manual/computer-programming/http11/conditional-requests) |
| `If-Modified-Since` | Req | 仅 GET/HEAD；被 `If-None-Match` 压制 | [条件](/manual/computer-programming/http11/conditional-requests) |
| `If-None-Match` | Req | **弱比较**；命中 → `304` | [条件](/manual/computer-programming/http11/conditional-requests) |
| `If-Range` | Req | **强验证器**；不匹配 → 完整 `200` | [范围](/manual/computer-programming/http11/range-requests) |
| `If-Unmodified-Since` | Req | 仅在无 `If-Match` 时求值 | [条件](/manual/computer-programming/http11/conditional-requests) |
| `Keep-Alive` | Req/Res ⚠️ | `timeout=`/`max=`；仅为提示 | [连接](/manual/computer-programming/http11/connection-management) |
| `Last-Modified` | Res | 弱验证器；不得晚于 `Date` | [条件](/manual/computer-programming/http11/conditional-requests) |
| `Link` | Res | `<uri>; rel=…`，尖括号必需 | [上下文](/manual/computer-programming/http11/context-fields) |
| `Location` | Res | 可为相对引用；`201` 中语义不同 | [3xx](/manual/computer-programming/http11/status-3xx) |

## M–Z

| 字段 | 方向 | 语法要点 | 详解 |
| --- | --- | --- | --- |
| `Max-Forwards` | Req | 仅 TRACE/OPTIONS；转发前减 1 | [代理](/manual/computer-programming/http11/proxy-fields) |
| `Proxy-Authenticate` | Res ⚠️ | 配 `407` | [认证](/manual/computer-programming/http11/authentication) |
| `Proxy-Authorization` | Req ⚠️ | 逐跳，不可转发 | [认证](/manual/computer-programming/http11/authentication) |
| `Range` | Req | **闭区间**；仅 GET 有定义 | [范围](/manual/computer-programming/http11/range-requests) |
| `Referer` | Req | 拼写少一个 r；禁含 fragment | [上下文](/manual/computer-programming/http11/context-fields) |
| `Retry-After` | Res | 秒数或日期；数字开头即秒 | [上下文](/manual/computer-programming/http11/context-fields) |
| `Server` | Res | 同 UA 语法；宜精简 | [上下文](/manual/computer-programming/http11/context-fields) |
| `Set-Cookie` | Res | **绝不可合并**；每个一行 | [Cookie](/manual/computer-programming/http11/cookies) |
| `TE` | Req ⚠️ | 须列入 `Connection` | [成帧](/manual/computer-programming/http11/message-body-length) |
| `Trailer` | Req/Res | 声明 trailer 区将出现的字段 | [字段语法](/manual/computer-programming/http11/field-syntax) |
| `Transfer-Encoding` | Req/Res ⚠️ | `chunked` 必须在末位 | [成帧](/manual/computer-programming/http11/message-body-length) |
| `Upgrade` | Req/Res ⚠️ | 须配 `Connection: Upgrade` | [连接](/manual/computer-programming/http11/connection-management) |
| `User-Agent` | Req | 可嵌套 comment；不可信 | [上下文](/manual/computer-programming/http11/context-fields) |
| `Vary` | Res | 缺失 = 缓存投毒；`*` = 不可复用 | [协商](/manual/computer-programming/http11/content-negotiation) |
| `Via` | Req/Res | 追加到**末尾**，顺序即路径 | [代理](/manual/computer-programming/http11/proxy-fields) |
| `WWW-Authenticate` | Res | `401` 中**必需** | [认证](/manual/computer-programming/http11/authentication) |

## 十个最易错的细节

1.  `Content-Length` 是**十进制**，chunk-size 是**十六进制**。
2.  `Range: bytes=0-499` 是 **500** 字节（两端闭区间）。
3.  `Content-Range` 用 **SP** 分隔单位（`bytes 0-499/10000`），`Range` 用 **`=`**。
4.  `ETag` 的**双引号是语法的一部分**，不能省。
5.  `Set-Cookie` **不可**合并成一行——`Expires` 里有逗号。
6.  Cookie 的 `Domain` **不写反而更严格**（不含子域）。
7.  `Accept` 的匹配**特异性优先于 q 值**。
8.  `If-None-Match` 存在时，`If-Modified-Since` 被**完全忽略**。
9.  `no-cache` 是「用前先验证」，`no-store` 才是「不存」。
10.  漏发 `Vary` 会导致 CDN 把压缩版发给不支持的客户端。

## 收尾

全专栏基准为 **RFC 9110 / 9111 / 9112**（2022-06）。与 HTTP/2、HTTP/3 的分界：

-   **仍然适用**：全部字段语义、方法、状态码、条件请求、范围请求、缓存、认证（归 RFC 9110，跨版本通用）。
-   **已被取代**：报文成帧、`Transfer-Encoding`/`chunked`、`Connection` 与逐跳字段、`Upgrade`、`Keep-Alive`、`reason-phrase`（归 RFC 9112，HTTP/1.1 专属；HTTP/2+ 由二进制帧层负责）。

换句话说，[第 1 部分](/manual/computer-programming/http11/message-format)是 HTTP/1.1 独有的，第 2、3 部分的知识在 HTTP/2 与 HTTP/3 上原样成立。
