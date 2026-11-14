---
title: "上下文与控制字段"
description: "User-Agent、Server、Referer、Retry-After、Allow、Link 等字段的语法与约束。"
source: "https://daiw.org/manual/http11/context-fields"
---

# 上下文与控制字段

## User-Agent

```text
User-Agent = product *( RWS ( product / comment ) )
product    = token [ "/" product-version ]
comment    = "(" *( ctext / quoted-pair / comment ) ")"
```

```text
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)
```

-   产品按**重要性降序**排列。
-   `comment` 用圆括号，**可嵌套**——解析时必须配对计数，不能简单找第一个 `)`。
-   浏览器 UA 因历史兼容原因几乎全部谎报（都以 `Mozilla/5.0` 开头），**不应**用于功能判断——用特性检测或 Client Hints。
-   **MUST NOT** 用于安全决策；客户端可任意伪造。

## Server

```text
Server = product *( RWS ( product / comment ) )
```

语法同 `User-Agent`，用于响应。

**SHOULD** 精简：暴露精确版本号（`Server: nginx/1.24.0`）便于攻击者匹配已知漏洞。生产环境宜只留产品名或完全移除。

## Referer

```text
Referer = absolute-URI / partial-URI
```

请求的来源页面 URI。**注意拼写**——规范中就是错拼的 `Referer`（少一个 r），不可写成 `Referrer`。

强制约束：

-   **MUST NOT** 含 fragment。
-   **MUST NOT** 含 `userinfo`（`user:pass@`）。
-   从 **HTTPS 页面跳到 HTTP** 时 **MUST NOT** 发送——防止泄露安全上下文的 URL。
-   客户端 **MAY** 完全省略以保护隐私。

现代浏览器由 `Referrer-Policy`（拼写正确的那个，属 W3C 规范而非 HTTP 核心）控制发送粒度，默认多为 `strict-origin-when-cross-origin`（跨源时只发 origin）。

URL 里带令牌/会话 ID 会经由 `Referer` 泄露给第三方——这是[不把凭据放 query](/manual/computer-programming/http11/authentication) 的直接原因。

## From

```text
From = mailbox
```

发起请求者的**人类**邮箱地址（RFC 5322 格式），用于爬虫标注联系方式：

```text
From: [email protected]
```

-   **不是**认证字段，无任何鉴权语义。
-   因隐私原因，浏览器**从不**发送。

## Allow

```text
Allow = #method
```

响应字段，列出目标资源支持的方法。

-   `405` 响应中 **MUST** 出现。
-   `OPTIONS` 响应中 **SHOULD** 出现。
-   空值合法，表示不允许任何方法。
-   该字段可被缓存，方法集变化时需注意失效。

## Retry-After

```text
Retry-After = HTTP-date / delay-seconds
```

两种形式，接收方必须都能解析：

```text
Retry-After: 120
Retry-After: Wed, 21 Oct 2026 07:28:00 GMT
```

判别方式：**以数字开头即为秒数**（日期形式恒以字母开头的星期缩写起始）。

适用状态码：

| 码 | 含义 |
| --- | --- |
| `503` | 服务多久后恢复 |
| `429` | 多久后可再请求 |
| `301`/`3xx` | 资源多久后可用（罕见） |

客户端**应**遵循该值，并在其基础上加**随机抖动**——大量客户端在同一秒重试会造成二次雪崩。

## Link

```text
Link       = #link-value
link-value = "<" URI-Reference ">" *( OWS ";" OWS link-param )
```

RFC 8288。以机器可读方式表达资源间关系：

```text
Link: </style.css>; rel=preload; as=style
Link: <https://api.example.com/page/2>; rel="next"
Link: <https://legal.example>; rel="blocked-by"
```

-   URI **必须**用尖括号包围。
-   `rel` 取值来自 IANA Link Relation 注册表（`next`、`prev`、`canonical`、`preload`、`alternate`…）。
-   多个关系用空格分隔并加引号：`rel="alternate stylesheet"`。
-   用于 `103 Early Hints`（预加载）与 `451`（`rel="blocked-by"`）。

## Host（回顾）

```text
Host = uri-host [ ":" port ]
```

已在[请求行](/manual/computer-programming/http11/request-line)详述，此处仅列关键约束：

-   HTTP/1.1 请求 **MUST** 包含，且**有且仅有一个**；缺失或重复 → `400`。
-   出现在 absolute-form 时，以 request-target 中的 authority 为准。
-   端口与方案默认端口相同时可省略。
-   是虚拟主机路由的依据，**必须**校验白名单——否则产生 Host 头注入（污染密码重置链接等）。

## 其他常见字段一览

| 字段 | 方向 | 语法要点 |
| --- | --- | --- |
| `Date` | 响应（请求可选） | 见[日期](/manual/computer-programming/http11/http-date) |
| `Location` | 响应 | 见[3xx](/manual/computer-programming/http11/status-3xx) |
| `Expect` | 请求 | 见[连接管理](/manual/computer-programming/http11/connection-management) |
| `Accept-Patch` | 响应 | `#media-type`，声明支持的补丁格式 |
| `Content-Disposition` | 响应 | RFC 6266。`attachment; filename="x"`；非 ASCII 用 `filename*=UTF-8''...` |
| `Alt-Svc` | 响应 | RFC 7838。声明可用的替代服务（HTTP/2、HTTP/3 发现） |

下一篇：[代理与转发字段](/manual/computer-programming/http11/proxy-fields)。
