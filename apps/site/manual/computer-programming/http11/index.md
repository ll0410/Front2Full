---
title: "HTTP/1.1 协议详解"
description: "逐字段拆解 HTTP/1.1——报文语法、起始行、方法、状态码与每一个头字段的精确语义。"
source: "https://daiw.org/manual/http11"
---

# HTTP/1.1 协议详解

> 内容来源：[daiw.org](https://daiw.org/manual/http11) · 作者 David · 原文更新于 2026-08-03

本专栏逐字段解析 HTTP/1.1：**报文怎么切分、每个字段的 ABNF 语法是什么、取值范围有哪些、收到非法值该怎么办**。不讲发展史，不讲「为什么要有网络」，只讲协议本身。

## 规范基准

以 **RFC 9110（HTTP 语义）** 与 **RFC 9112（HTTP/1.1 报文语法）** 为准，二者于 2022 年 6 月取代 RFC 7230–7235（更早的 RFC 2616 已废弃）。相关：RFC 9111（缓存）、RFC 6265（Cookie）、RFC 7617（Basic 认证）。

字段语义归 RFC 9110（跨版本通用），**报文成帧与连接管理归 RFC 9112（HTTP/1.1 专属）**——这是理解「哪些东西 HTTP/2 还有、哪些没了」的分界线。

## 记号约定

全书用 **ABNF**（RFC 5234）描述语法，并复用 RFC 9110 的核心规则：

```text
OWS  = *( SP / HTAB )          ; optional whitespace
RWS  = 1*( SP / HTAB )         ; required whitespace
BWS  = OWS                     ; "bad" whitespace，语法允许但语义上应为空
tchar = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." /
        "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA
token = 1*tchar
quoted-string = DQUOTE *( qdtext / quoted-pair ) DQUOTE
```

`CRLF` 一律指 `\r\n`（0x0D 0x0A）。示例报文中的行尾均为 CRLF，正文里不再重复标注。

## 阅读顺序

**第 1 部分 · 报文与成帧**——[报文结构](/manual/computer-programming/http11/message-format)、[请求行](/manual/computer-programming/http11/request-line)、[状态行](/manual/computer-programming/http11/status-line)、[字段行语法](/manual/computer-programming/http11/field-syntax)、[消息体长度](/manual/computer-programming/http11/message-body-length)、[连接管理](/manual/computer-programming/http11/connection-management)。HTTP/1.1 的骨架，先读。

**第 2 部分 · 方法与状态码**——[方法](/manual/computer-programming/http11/methods)的安全性/幂等性/可缓存性，以及 [1xx/2xx](/manual/computer-programming/http11/status-codes)、[3xx](/manual/computer-programming/http11/status-3xx)、[4xx](/manual/computer-programming/http11/status-4xx)、[5xx](/manual/computer-programming/http11/status-5xx) 每个码的精确触发条件。

**第 3 部分 · 字段详解**——[表示字段](/manual/computer-programming/http11/representation-fields)、[内容协商](/manual/computer-programming/http11/content-negotiation)、[日期](/manual/computer-programming/http11/http-date)、[条件请求](/manual/computer-programming/http11/conditional-requests)、[范围请求](/manual/computer-programming/http11/range-requests)、[缓存](/manual/computer-programming/http11/caching)、[认证](/manual/computer-programming/http11/authentication)、[Cookie](/manual/computer-programming/http11/cookies)、[上下文字段](/manual/computer-programming/http11/context-fields)、[代理字段](/manual/computer-programming/http11/proxy-fields)，末尾附 [字段速查表](/manual/computer-programming/http11/field-index)。

急用查字段直接跳 [字段速查表](/manual/computer-programming/http11/field-index)；系统读从 [报文结构](/manual/computer-programming/http11/message-format) 开始。
