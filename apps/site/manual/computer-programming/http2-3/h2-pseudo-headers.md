---
title: "伪头字段"
description: "五个冒号开头的伪头、与 1.1 起始行的映射，以及被禁用的连接级字段。"
source: "https://daiw.org/manual/http2-3/h2-pseudo-headers"
---

# 伪头字段

五个冒号开头的伪头、与 1.1 起始行的映射，以及被禁用的连接级字段。

h2 没有[起始行](/manual/computer-programming/http11/request-line)——它的信息被拆成五个 **伪头字段（pseudo-header field）**，以 `:` 开头，与普通字段一起放在 `HEADERS` 帧里。

## 五个伪头

### 请求（四个）

| 伪头 | 对应 1.1 | 必需性 |
| --- | --- | --- |
| `:method` | method | **MUST** |
| `:scheme` | URI 方案（`http`/`https`） | **MUST** |
| `:authority` | `Host` 字段 | 应发 |
| `:path` | request-target 的路径 + query | **MUST** |

### 响应（一个）

| 伪头 | 对应 1.1 | 必需性 |
| --- | --- | --- |
| `:status` | 三位状态码 | **MUST** |

**`reason-phrase` 被彻底删除**——它在 1.1 里就无语义（见[状态行](/manual/computer-programming/http11/status-line)），h2 不再传输。

## 硬性规则

违反任意一条即 **malformed（畸形）**，接收方 **MUST** 以 `PROTOCOL_ERROR` 处理该流：

1. **伪头 MUST 出现在所有普通字段之前**。一旦出现普通字段，其后再出现伪头即错误。
2. **不得发送规范未定义的伪头**（`:` 开头的自定义字段非法）。
3. **请求伪头不得出现在响应中**，反之亦然。
4. **同一伪头不得重复**。
5. 字段名 **MUST 全小写**——`Content-Type` 是错误，`content-type` 才对。大写字母直接判定 malformed。

第 5 条是从 1.1 迁移时最常踩的坑：1.1 的字段名[大小写不敏感](/manual/computer-programming/http11/field-syntax)，h2 则是**强制小写**。多数库会自动转换，手写帧时必须注意。

## :path 的细节

- **不得为空**——即使 URI 无路径也 **MUST** 发 `/`（同 1.1 的 origin-form）。
- 包含 query：`/search?q=x` 整体放在 `:path` 里。
- **不含** fragment（同 1.1）。
- 例外：`OPTIONS *` 请求的 `:path` 为 `*`。

## :authority 与 Host

这是最容易出问题的一处映射：

| | h2 |
| --- | --- |
| 客户端 | **SHOULD** 发 `:authority`，**SHOULD NOT** 发 `Host` |
| 服务端 | 两者都收到时，**MUST** 确保其值一致，否则 **MUST** 拒绝该请求 |
| 转 1.1 的中间件 | 用 `:authority` 生成 `Host` |

不一致时必须拒绝，是为了防止 **请求走私 / Host 混淆**：若前端按 `:authority` 路由、后端按 `Host` 路由，攻击者可用两个不同的值让请求落到非预期的虚拟主机。

## 被禁用的字段

h2 自己管理连接，1.1 的**逐跳字段全部作废**。以下字段 **MUST NOT** 出现在 h2 消息中，出现即 malformed：

| 字段 | 为什么没了 |
| --- | --- |
| `Connection` | 连接管理由帧层负责 |
| `Keep-Alive` | 连接恒持久 |
| `Proxy-Connection` | 同上 |
| `Transfer-Encoding` | 成帧由 `DATA` 帧 + `END_STREAM` 负责 |
| `Upgrade` | 协议协商改用 ALPN |

**唯一例外**：`TE` 字段可以出现，但其值 **MUST** 只有 `trailers`——任何其他值（如 `gzip`）都非法。

`Content-Length` **仍然合法**且有用：它不再负责成帧（那是 `END_STREAM` 的事），而是作为**元信息**供接收方预分配缓冲、校验完整性。若其值与实际 `DATA` 字节数不符，接收方 **SHOULD** 视为 malformed。

## 完整映射示例

1.1 请求：

```http
POST /api/items?draft=1 HTTP/1.1
Host: example.com
Content-Type: application/json
Content-Length: 18
Connection: keep-alive

{"name":"widget"}
```

h2 等价（`HEADERS` 帧的字段列表 + 一个 `DATA` 帧）：

```text
:method: POST
:scheme: https
:authority: example.com
:path: /api/items?draft=1
content-type: application/json
content-length: 18
```

变化点：起始行拆成三个伪头、`Host` → `:authority`、字段名转小写、**`Connection` 被丢弃**、体移入 `DATA` 帧并以 `END_STREAM` 收尾。

1.1 响应：

```http
HTTP/1.1 201 Created
Location: /api/items/42
```

h2 等价：

```text
:status: 201
location: /api/items/42
```

## 1xx 中间响应

h2 中 [`1xx` 响应](/manual/computer-programming/http11/status-line)表示为一个额外的 `HEADERS` 帧（`:status: 1xx`，**不置** `END_STREAM`），其后才是最终响应的 `HEADERS`。

`103 Early Hints` 在 h2/h3 上才真正实用——1.1 下中间响应与最终响应必须串行占用连接，h2 则可在同一流上自然承载。

下一篇：[流量控制](/manual/computer-programming/http2-3/h2-flow-control)。
