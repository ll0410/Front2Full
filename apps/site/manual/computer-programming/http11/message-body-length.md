---
title: "消息体长度"
description: "Transfer-Encoding、Content-Length 与连接关闭——七条成帧规则的判定优先级。"
source: "https://daiw.org/manual/http11/message-body-length"
---

# 消息体长度

消息体长度**不由空行决定**，而由下面这条七步判定链决定。RFC 9112 §6.3 规定接收方 **MUST** 按顺序求值，命中即停。

## 判定链

1.  **响应对应 HEAD 请求，或状态码为 `1xx`/`204`/`304`** → 无消息体。头里即使有 `Content-Length` 也**不读体**（该值描述的是「若是 GET 会返回多长」）。
2.  **响应对应 CONNECT 且为 `2xx`** → 无消息体；连接自此转为隧道，后续字节不再按 HTTP 解析。
3.  **存在 `Transfer-Encoding`**：
    -   若最后一个编码是 `chunked` → 按分块解码确定长度。
    -   若 `chunked` 不在最后（或不存在）→ 响应：读到连接关闭为止；**请求：MUST 返回 400 并关闭连接**（无法确定边界，走私风险）。
4.  **存在多个 `Content-Length`，或单个含多个值且不一致** → **MUST** 拒绝（400 / 502）。
5.  **存在合法单一 `Content-Length`** → 该十进制值即长度。
6.  **请求** → 无消息体（请求不能靠连接关闭定界）。
7.  **响应** → 读到连接关闭为止。

## Transfer-Encoding 优先于 Content-Length

两者同时出现时：**`Transfer-Encoding` 生效，`Content-Length` MUST 被视为无效并移除**。这是防走私的关键——但更安全的做法是直接拒绝该报文：

```text
POST / HTTP/1.1
Host: x
Content-Length: 6
Transfer-Encoding: chunked

0
```

前端若按 `Content-Length` 读、后端按 `chunked` 读，两者对「报文在哪结束」产生分歧，攻击者可把后续字节注入成下一个请求（CL.TE / TE.CL 走私）。规范要求代理**拒绝**此类报文。

## Content-Length

```text
Content-Length = 1*DIGIT
```

-   **十进制**，无正负号、无前导 `+`、不接受十六进制或前导 `0x`。前导零语法上合法但不应生成。
-   单位是**字节**，且是**编码后**（应用 `Content-Encoding` 之后）的长度。
-   值必须与实际体字节数完全一致：
    -   实际体**短于**声明 → 接收方视为消息不完整，MUST 当作出错（连接不可复用）。
    -   实际体**长于**声明 → 多出的字节被当作下一个报文的开头（走私）。
-   响应可在无体时仍带 `Content-Length: 0`；HEAD 与 304 的 `Content-Length` 是元信息，见判定链第 1 条。

## chunked 传输编码

```text
chunked-body = *chunk last-chunk trailer-section CRLF
chunk        = chunk-size [ chunk-ext ] CRLF chunk-data CRLF
chunk-size   = 1*HEXDIG
last-chunk   = 1*("0") [ chunk-ext ] CRLF
```

一个实例：

```text
HTTP/1.1 200 OK
Transfer-Encoding: chunked

7
Mozilla
9
Developer
0
```

要点：

-   **`chunk-size` 是十六进制**，大小写不敏感，不带 `0x`。与十进制的 `Content-Length` 正好相反，是高频错误点。
-   `chunk-size` 不含 CRLF 与 chunk-ext 本身的长度。
-   每个 `chunk-data` 之后**必须**跟 CRLF。
-   长度为 0 的块表示结束，其后是可选的 trailer 区，再跟一个 CRLF 收尾。
-   解码后的字节流才是真正的消息体；`Content-Length` 若与之共存则无效。

### chunk-ext

```text
chunk-ext = *( BWS ";" BWS ext-name [ BWS "=" BWS ext-val ] )
```

无标准化的扩展名，接收方 **MUST** 忽略不认识的扩展。实践中几乎不用，且部分实现对超长 chunk-ext 有拒绝策略（DoS 防护）。

## 编码栈的顺序

```text
Transfer-Encoding = #transfer-coding
transfer-coding   = token *( OWS ";" OWS transfer-parameter )
```

已注册值：`chunked`、`compress`、`deflate`、`gzip`、`trailers`（后者仅用于 `TE`）。

-   列表顺序即**应用顺序**：`Transfer-Encoding: gzip, chunked` 表示先 gzip 再分块；接收方逆序解码。
-   `chunked` **MUST** 是请求中的最后一个编码，且**不得**重复出现。
-   客户端**不得**向 HTTP/1.0 接收方发送 `Transfer-Encoding`。
-   HTTP/2 与 HTTP/3 中该字段**被禁用**（成帧由协议层负责）。

## Transfer-Encoding vs Content-Encoding

高频混淆点，二者正交：

|  | `Transfer-Encoding` | `Content-Encoding` |
| --- | --- | --- |
| 层次 | 传输层，逐跳 | 表示层，端到端 |
| 是否影响成帧 | **是** | 否 |
| 是否改变资源本身 | 否，接收即还原 | **是**，`ETag` 针对编码后的表示 |
| 代理可否改动 | 可以（可重新分块） | **不可** |
| 典型值 | `chunked` | `gzip`、`br`、`zstd` |

`Content-Length` 计的是 `Content-Encoding` **之后**、`Transfer-Encoding` **之前**的长度。

## TE 与 trailers

```text
TE = #t-codings
t-codings = "trailers" / ( transfer-coding [ weight ] )
```

客户端用 `TE` 声明自己能接受哪些传输编码；`TE: trailers` 表示愿意接收 trailer 区。`TE` 是逐跳字段，**必须**在 `Connection` 中列出：`Connection: TE`。

下一篇：[连接管理](/manual/computer-programming/http11/connection-management)——持久连接、Connection 字段与逐跳语义。
