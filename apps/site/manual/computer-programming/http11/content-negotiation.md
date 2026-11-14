---
title: "内容协商"
description: "Accept 系列字段、qvalue 语法、媒体范围优先级规则与 Vary 的缓存含义。"
source: "https://daiw.org/manual/http11/content-negotiation"
---

# 内容协商

## qvalue

所有协商字段共用的权重语法：

```text
weight = OWS ";" OWS "q=" qvalue
qvalue = ( "0" [ "." 0*3DIGIT ] ) / ( "1" [ "." 0*3("0") ] )
```

硬性约束：

-   取值范围 **0–1**，**最多三位小数**。`q=0.3333` 非法，`q=1.5` 非法。
-   缺省为 **`q=1`**。
-   **`q=0` 表示「不可接受」**，不是「最低优先级」——服务端不得返回该项。
-   参数名 `q` 大小写不敏感。
-   `q` 是**分隔符**：`q` 之前的参数属于媒体类型本身，之后的属于扩展。`text/html;level=1;q=0.5;ext=x` 中 `level` 是类型参数，`ext` 是扩展参数。

## Accept

```text
Accept      = #( media-range [ weight ] )
media-range = ( "*/*" / ( type "/*" ) / ( type "/" subtype ) ) parameters
```

```text
Accept: text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8
```

### 优先级规则（必须按此顺序判定）

**特异性优先于 q 值**——这是最常被实现错的地方：

1.  `type/subtype` **带参数** 最具体
2.  `type/subtype`
3.  `type/*`
4.  `*/*` 最不具体

只有在特异性**相同**时才比较 q 值。例：

```text
Accept: text/*;q=0.9, text/html;q=0.5
```

对 `text/html` 而言，匹配的是 `text/html;q=0.5`（更具体），**不是** `q=0.9`。结果权重 0.5。

### 缺省与空值

-   字段**缺失** = `*/*`，接受任何类型。
-   字段**存在但为空** = 不接受任何类型（合法但无意义）。
-   无可接受表示时，服务端 **MAY** 返回 `406`，也 **MAY** 忽略协商直接返回首选表示——后者在实践中更常见。

## Accept-Encoding

```text
Accept-Encoding = #( codings [ weight ] )
codings         = content-coding / "identity" / "*"
```

```text
Accept-Encoding: gzip, br;q=1.0, *;q=0.1
```

特殊规则：

-   **字段缺失** → 服务端可用任意编码（实践中应发不压缩的）。
-   **字段存在但为空** → 只接受 `identity`（不编码）。
-   `identity` **始终可接受**，除非显式 `identity;q=0`。
-   `Accept-Encoding: identity;q=0, *;q=0` → 无任何可接受编码 → `406`。
-   `*` 匹配所有**未在字段中显式列出**的编码。

服务端选择了非 `identity` 编码时，响应 **MUST** 带 `Content-Encoding` 与 `Vary: Accept-Encoding`。

## Accept-Language

```text
Accept-Language = #( language-range [ weight ] )
```

`language-range` 语法见 RFC 4647，大小写不敏感：

```text
Accept-Language: zh-CN, zh;q=0.9, en;q=0.8, *;q=0.5
```

匹配算法两种，服务端自选：

-   **Basic filtering**：范围 `zh` 匹配 `zh`、`zh-CN`、`zh-Hans-CN`（按 `-` 前缀逐段匹配），但不匹配 `zho`。
-   **Lookup**：逐段截断寻找最佳单一匹配（`zh-Hans-CN` → `zh-Hans` → `zh`），配 `*` 作兜底。

注意：语言标签的**子标签数量不影响特异性排序**——排序只看 q 值，与 `Accept` 的规则不同。

## Accept-Charset（已废弃）

```text
Accept-Charset = #( ( token / "*" ) [ weight ] )
```

RFC 9110 **明确废弃**该字段：绝大多数场景应统一用 UTF-8，逐请求协商字符集弊大于利。

-   客户端 **SHOULD NOT** 再发送。
-   服务端 **SHOULD** 忽略。
-   保留定义仅为兼容历史实现。

## Vary

```text
Vary = #( "*" / field-name )
```

**响应**字段。声明服务端在选择本表示时**使用了哪些请求字段**，是内容协商与缓存正确性的桥梁。

```text
Vary: Accept-Encoding, Accept-Language
```

缓存规则：

-   缓存**必须**在后续请求的这些字段值与已存储请求**相符**时才可复用该响应。
-   `Vary: *` → 该响应**永不可**被缓存复用（等价于不可缓存）。
-   字段名大小写不敏感。
-   **遗漏 `Vary` 是严重 bug**：CDN 会把 gzip 版发给不支持 gzip 的客户端，或把中文版发给英文用户。
-   值列得**过多**同样有害：每多一个字段，缓存命中率按其取值组合数下降。`Vary: User-Agent` 几乎等于禁用缓存。

### 与内容协商的配对

| 用了什么协商 | 必须发的 Vary |
| --- | --- |
| 按 `Accept-Encoding` 压缩 | `Vary: Accept-Encoding` |
| 按 `Accept-Language` 选语言 | `Vary: Accept-Language` |
| 按 `Accept` 选格式 | `Vary: Accept` |
| 按 `Authorization` 定制 | `Vary: Authorization`（且通常需 `private`） |
| 按 Cookie 定制 | `Vary: Cookie`（命中率极低，宜改用 `private`） |

## 主动式 vs 响应式协商

-   **主动式（proactive）**：服务端按 `Accept-*` 选表示。即本篇全部内容。缺点是客户端偏好未必准确、`Vary` 拖累缓存。
-   **响应式（reactive）**：服务端返回 `300` 列出可选项，客户端自选。多一轮往返，实际几乎不用。

下一篇：[日期与时间](/manual/computer-programming/http11/http-date)——HTTP-date 的三种格式与 Date 字段规则。
