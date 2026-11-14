---
title: "Cookie"
description: "Set-Cookie 的七个属性、Cookie 请求语法、SameSite 与 __Host- 前缀规则。"
source: "https://daiw.org/manual/http11/cookies"
---

# Cookie

规范基准 **RFC 6265**（及其修订草案 6265bis）。Cookie **不属于** HTTP 核心语义（RFC 9110），是独立的状态管理层。

## Set-Cookie

```text
set-cookie        = cookie-pair *( ";" SP cookie-av )
cookie-pair       = cookie-name "=" cookie-value
cookie-name       = token
cookie-value      = *cookie-octet / ( DQUOTE *cookie-octet DQUOTE )
cookie-octet      = %x21 / %x23-2B / %x2D-3A / %x3C-5B / %x5D-7E
```

```text
Set-Cookie: sid=abc123; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600
```

硬性规则：

-   **每个 Cookie 一个 `Set-Cookie` 字段行**。该字段 **MUST NOT** 被合并成逗号分隔的单行——其 `Expires` 值内部含逗号，合并即破坏解析。这是[字段合并规则](/manual/computer-programming/http11/field-syntax)的头号例外。
-   `cookie-value` **不得**含空白、逗号、分号、反斜杠。需要这些字符时自行做百分号或 Base64 编码——规范**不定义**任何编码。
-   属性名**大小写不敏感**；未知属性 **MUST** 被忽略。
-   属性顺序无意义，但同名属性**以最后一个为准**。

## 七个属性

### Expires

```text
Expires = <sane-cookie-date>
```

绝对过期时刻（IMF-fixdate）。无 `Expires` 且无 `Max-Age` → **会话 Cookie**，浏览器关闭即删。

设为**过去**的时间是删除 Cookie 的标准做法——且删除时的 `Path`/`Domain` **必须与设置时完全一致**，否则删不掉（高频 bug）。

### Max-Age

```text
Max-Age = [ "-" ] 1*DIGIT
```

相对秒数。**优先级高于 `Expires`**——两者同时存在时 `Max-Age` 胜出（不受客户端时钟偏差影响）。

`Max-Age=0` 或负值 → 立即删除。

### Domain

```text
Set-Cookie: a=1; Domain=example.com
```

反直觉规则：

-   指定 `Domain` → Cookie 对该域**及其所有子域**可见（`example.com` + `www.example.com` + `api.example.com`）。
-   **不指定** `Domain` → 仅对**当前精确主机**可见，**不含**子域。**不指定反而更严格**。
-   前导点（`Domain=.example.com`）在 6265 中**被忽略**，等价于无点形式。
-   **不得**设为公共后缀（`.com`、`.co.uk`）或上级无关域——浏览器按 Public Suffix List 拒绝。

### Path

```text
Set-Cookie: a=1; Path=/admin
```

-   匹配规则：请求路径等于该值，或以该值加 `/` 为前缀。`Path=/admin` 匹配 `/admin`、`/admin/x`，**不匹配** `/administrator`。
-   缺省值由请求 URI **推导**：取最后一个 `/` 之前的部分（`/a/b/c` → `/a/b`），而非 `/`。
-   **`Path` 不是安全边界**——同源不同路径的脚本可通过 iframe 等方式互访。不要用它做隔离。

### Secure

仅通过**安全传输**（HTTPS）发送。

注意：`Secure` 只防「明文发出」，**不防**「被明文写入」——非安全来源的脚本仍可能覆盖同名 Cookie（除非用 `__Secure-` 前缀）。

### HttpOnly

禁止 JavaScript（`document.cookie`）访问。是防 XSS 窃取会话的基本手段，**会话 Cookie 必须开启**。

### SameSite

```text
SameSite = "Strict" / "Lax" / "None"
```

控制跨站请求是否携带：

| 值 | 行为 |
| --- | --- |
| `Strict` | 任何跨站请求都**不**携带，含从外站点击链接跳入 |
| `Lax` | 跨站的**顶层导航 GET** 携带；跨站 `POST`、iframe、img、XHR **不**携带 |
| `None` | 始终携带，**MUST** 同时带 `Secure`，否则浏览器拒绝（跨站嵌入场景可配 `Partitioned` 启用 CHIPS 分区存储） |

现代浏览器在**缺省时按 `Lax`** 处理（6265bis 方向），但该默认不是规范强制，**应显式声明**。

`SameSite=Lax` 已可挡住大部分 CSRF，但不能替代 CSRF token——它不防同站攻击，且旧客户端不支持。

## Cookie（请求字段）

```text
cookie-header = "Cookie:" OWS cookie-string OWS
cookie-string = cookie-pair *( ";" SP cookie-pair )
```

```text
Cookie: sid=abc123; theme=dark; lang=zh
```

关键差异：

-   **只发名值对，不发任何属性**——服务端**无法**从请求得知某 Cookie 的 `Domain`、`Path`、`Secure` 等。
-   分隔符是 **`;`** （分号加空格），不是逗号。
-   多个同名 Cookie（不同 `Domain`/`Path`）**可以**同时出现，且**顺序不保证**、无法区分来源——这是「Cookie 覆盖/投毒」类攻击的基础。
-   所有 Cookie 在**同一个** `Cookie` 字段中发送（不像 `Set-Cookie` 每个一行）。
-   无 Cookie 时**不发**该字段（不发空字段）。

## 安全前缀

浏览器对特定名字前缀强制附加约束：

| 前缀 | 强制要求 |
| --- | --- |
| `__Secure-` | 必须带 `Secure`，且由安全来源设置 |
| `__Host-` | 必须带 `Secure`、`Path=/`、**且不得带 `Domain`**，由安全来源设置 |

```text
Set-Cookie: __Host-sid=abc; Path=/; Secure; HttpOnly; SameSite=Lax
```

`__Host-` 是**最强**形式：它保证该 Cookie 只属于当前精确主机，子域无法写入或覆盖——能挡住子域接管类攻击。会话 Cookie 应优先使用。

## 容量限制

规范建议的下限（浏览器实际值接近）：

-   每个 Cookie ≥ 4096 字节（名 + 值 + 属性总长）。
-   每个域 ≥ 50 个。
-   总数 ≥ 3000 个。

超限时浏览器按最近最少使用淘汰，**静默丢弃**——不会有任何错误提示。Cookie 过大还会显著拖慢每个请求（每请求都全量携带）。

下一篇：[上下文与控制字段](/manual/computer-programming/http11/context-fields)。
