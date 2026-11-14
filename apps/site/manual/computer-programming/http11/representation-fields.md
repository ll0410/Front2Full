---
title: "表示字段"
description: "Content-Type、Content-Encoding、Content-Language、Content-Location——描述消息体的四个字段。"
source: "https://daiw.org/manual/http11/representation-fields"
---

# 表示字段

**表示（representation）** = 元数据 + 数据。表示字段描述的是「体里装的是什么」，与「资源是什么」分开——同一资源可有多个表示（不同语言、不同编码）。

## Content-Type

```text
Content-Type = media-type
media-type   = type "/" subtype parameters
type         = token
subtype      = token
```

指明体的**媒体类型**。缺失时接收方 **MAY** 自行嗅探或按 `application/octet-stream` 处理。

-   `type` 与 `subtype` **大小写不敏感**，惯例小写。
-   参数名大小写不敏感；参数值是否敏感由具体类型定义。
-   `+` 后缀表示结构化语法：`application/json-patch+json` 按 JSON 解析。

### charset 参数

```text
Content-Type: text/html; charset=UTF-8
```

-   值**大小写不敏感**，取自 IANA 字符集注册表。
-   对 `text/*` 尤为关键：缺失时各实现的默认值不一致（历史默认 ISO-8859-1，现代浏览器多按 UTF-8 或嗅探），是乱码的首要成因。
-   `application/json` **不接受** `charset` 参数——RFC 8259 规定 JSON 必须是 UTF-8，写 `charset=UTF-8` 无效但无害。

### boundary 参数

`multipart/*` 必需，且**大小写敏感**：

```text
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryXYZ
```

-   长度 1–70 字符，不得以空白结尾。
-   体中每个分隔行是 `--` + boundary，结束行是 `--` + boundary + `--`。
-   值含特殊字符时须用 `quoted-string`。

### 嗅探与防护

服务端应始终发送准确的 `Content-Type`。浏览器的 MIME 嗅探会把 `text/plain` 的内容当 HTML 执行，造成 XSS——用响应字段 `X-Content-Type-Options: nosniff` 关闭嗅探（非 HTTP 核心规范，但属必备实践）。

## Content-Encoding

```text
Content-Encoding = #content-coding
content-coding   = token
```

指明体已被施加的**内容编码**，接收方需逆序解码才能得到原始表示。

| 值 | 说明 |
| --- | --- |
| `gzip` | RFC 1952，LZ77 + CRC32。别名 `x-gzip` |
| `deflate` | RFC 1950 zlib 格式。历史实现混淆（有的发裸 deflate），兼容性差 |
| `br` | Brotli，RFC 7932。文本压缩率优于 gzip |
| `zstd` | Zstandard，RFC 8878 |
| `compress` | LZW，已废弃。别名 `x-compress` |
| `identity` | 不编码。**仅可用于 `Accept-Encoding`**，不得出现在 `Content-Encoding` |

关键性质：

-   **端到端**——代理**不得**擅自改动（与逐跳的 `Transfer-Encoding` 相反）。
-   编码是**表示的一部分**：`ETag` 针对编码后的字节，gzip 版与非 gzip 版必须有**不同的 ETag**，且响应须带 `Vary: Accept-Encoding`。
-   多个编码按**应用顺序**列出：`Content-Encoding: gzip, br` 表示先 gzip 再 br（罕见）。
-   `Content-Length` 计的是**编码后**的长度。
-   客户端不支持所收编码时无法恢复；请求体编码不被支持则服务端返回 `415` + `Accept-Encoding`。

## Content-Language

```text
Content-Language = #language-tag
```

标注表示的**目标受众语言**（RFC 5646 语言标签，大小写不敏感）：

```text
Content-Language: zh-CN
Content-Language: en, de
```

-   多值表示内容**同时面向**多种语言受众，**不是**「内含多语言片段」。
-   描述的是受众而非文字：一份写给中文读者的英文教材可标 `zh-CN`。
-   与 `Accept-Language` 配对做协商，需配 `Vary: Accept-Language`。

## Content-Location

```text
Content-Location = absolute-URI / partial-URI
```

给出**该特定表示**的直接 URI。相对引用以请求目标 URI 为基准解析。

与 `Location` 的区别（高频混淆）：

|  | `Content-Location` | `Location` |
| --- | --- | --- |
| 指向 | 本响应体所对应表示的 URI | 重定向目标 / 新建资源 |
| 出现于 | 任何带体的响应 | `3xx`、`201` |
| 客户端动作 | 无，仅元信息 | 跳转 / 记录新资源 |

典型用途：`/article` 内容协商后返回中文版，带 `Content-Location: /article.zh.html` 告知该版本的固定地址。

**注意**：`Content-Location` **不改变**请求的目标 URI，也**不改变**缓存键——缓存仍以请求 URI 存储。

## 表示字段在请求中的含义

这些字段出现在**请求**里时，描述的是请求体：

```text
POST /upload HTTP/1.1
Content-Type: image/png
Content-Encoding: gzip
Content-Length: 20480
```

服务端处理规则：

-   不支持的 `Content-Type` → `415`，**SHOULD** 带 `Accept`。
-   不支持的 `Content-Encoding` → `415`，**SHOULD** 带 `Accept-Encoding`。
-   `GET`/`DELETE` 带这些字段时语义未定义，不应发送。

下一篇：[内容协商](/manual/computer-programming/http11/content-negotiation)——Accept 系列字段与 q 值排序规则。
