---
title: "字段行语法"
description: "field-name、field-value、OWS 处理、重复字段合并与 list-based 字段的通用规则。"
source: "https://daiw.org/manual/http11/field-syntax"
---

# 字段行语法

## 语法

```text
field-line  = field-name ":" OWS field-value OWS
field-name  = token
field-value = *field-content
field-content = field-vchar [ 1*( SP / HTAB / field-vchar ) field-vchar ]
field-vchar   = VCHAR / obs-text
```

要点逐条：

-   冒号**前不得有任何空白**。`Host : x` 必须被拒（400），代理必须丢弃该报文而非转发。
-   冒号后的 `OWS` 与值尾的 `OWS` 在解析时**必须剥除**，不属于值。
-   值**内部**的空白保留。
-   值可以为空。

## field-name

-   **大小写不敏感**：`Content-Type`、`content-type`、`CONTENT-TYPE` 等价。实现应做大小写无关的查找。
-   必须是 `token`——即不含分隔符与空白。含非法字符的字段名整条报文应拒绝。
-   无长度上限规定，实现自设（见[报文结构](/manual/computer-programming/http11/message-format)的限制表）。

## field-value 的字符集

-   合法字符：VCHAR（0x21–0x7E）、SP、HTAB，以及 `obs-text`（0x80–0xFF）。
-   **不得**含 CR、LF、NUL。任何在字段值中出现的 CR/LF 都是**头注入（CRLF injection）**，接收方必须拒绝，生成方必须转义或拒绝写入。
-   `obs-text` 的字符编码**未定义**。跨语言场景应改用 RFC 8187 的 `field*=UTF-8''...` 编码形式（如 `Content-Disposition` 的 `filename*`）。

## 重复字段的合并

**通用规则**：当且仅当该字段的定义是**逗号分隔列表**（`#rule`）时，多个同名字段行才可合并为一行，反之亦然：

```text
Accept: text/html
Accept: application/json
```

等价于：

```text
Accept: text/html, application/json
```

合并时按**接收顺序**用 `,` 连接，顺序不可打乱——某些字段（如 `Via`、`Forwarded`）的顺序承载语义。

### 三个例外

| 字段 | 规则 |
| --- | --- |
| `Set-Cookie` | **不可合并**。语法含未加引号的逗号（Expires 日期），合并会破坏解析。必须作为多个独立字段行发送与处理 |
| `Host` | 多于一个 → **400** |
| `Content-Length` | 多个且值不一致 → **400**；值一致时可当作单个 |

## list-based 字段的通用扩展语法

RFC 9110 用 `#rule` 记法表示逗号分隔列表，展开后允许**空元素**：

```text
#element => [ element ] *( OWS "," OWS [ element ] )
```

因此 `Accept: text/html,,application/json` 语法合法，接收方**必须忽略空元素**而非报错。生成方不应产生空元素。

## 参数（parameters）

大量字段（`Content-Type`、`Accept`、`Cache-Control` 等）复用同一参数语法：

```text
parameters      = *( OWS ";" OWS [ parameter ] )
parameter       = parameter-name "=" parameter-value
parameter-name  = token
parameter-value = ( token / quoted-string )
```

-   参数名**大小写不敏感**；参数值是否敏感由具体字段定义（如 `charset=UTF-8` 不敏感，boundary 敏感）。
-   `=` 两侧**不允许**有空白（BWS 在部分旧定义中允许，新规范要求生成方不产生）。
-   值含 `token` 之外的字符时必须用 `quoted-string`。

## quoted-string 与转义

```text
quoted-string = DQUOTE *( qdtext / quoted-pair ) DQUOTE
qdtext        = HTAB / SP / %x21 / %x23-5B / %x5D-7E / obs-text
quoted-pair   = "\" ( HTAB / SP / VCHAR / obs-text )
```

-   引号内的 `"` 与 `\` **必须**用 `\` 转义。
-   解析时须先去引号再解转义，得到的才是真实值。
-   `quoted-pair` 仅在 `quoted-string` 与 `comment` 内合法。

## 字段的分类

按适用位置分四类，决定字段可出现在何处：

| 类别 | 出现位置 | 例 |
| --- | --- | --- |
| 请求字段 | 仅请求 | `Host`、`Accept`、`If-Match` |
| 响应字段 | 仅响应 | `Server`、`ETag`、`WWW-Authenticate` |
| 表示字段 | 请求或响应，描述消息体 | `Content-Type`、`Content-Encoding` |
| 逐跳字段 | 单个连接内有效，**不得转发** | `Connection`、`Transfer-Encoding`、`Upgrade` |

**逐跳（hop-by-hop）字段**由 `Connection` 列出，代理必须在转发前移除，见[连接管理](/manual/computer-programming/http11/connection-management)。

## Trailer 字段

分块编码时，部分字段可放在体之后的 trailer 区：

-   **不得**放入 trailer 的字段：影响成帧的（`Transfer-Encoding`、`Content-Length`）、路由的（`Host`）、请求控制的（`Cache-Control`、`Expect`、`TE`、`Authorization`）、以及处理需前置的（`Content-Encoding`、`Content-Type`、`Range`）。
-   接收方**可以**丢弃全部 trailer；发送方不得把必要语义只放在 trailer 里。

下一篇：[消息体长度](/manual/computer-programming/http11/message-body-length)——成帧规则的完整优先级链。
