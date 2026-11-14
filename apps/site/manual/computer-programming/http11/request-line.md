---
title: "请求行"
description: "method、request-target 的四种形式、HTTP-version——请求起始行逐字段解析。"
source: "https://daiw.org/manual/http11/request-line"
---

# 请求行

## 语法

```text
request-line = method SP request-target SP HTTP-version
method       = token
HTTP-version = "HTTP/" DIGIT "." DIGIT
```

三个字段，两个 SP 分隔，**分隔符必须恰好是一个空格**（不是 OWS）。接收方遇到多个空格时不得「宽容地」合并——这同样是走私向量。

## method

大小写**敏感**，按惯例全大写。`get` 与 `GET` 是不同的方法名，服务端应对未知方法返回 **501 (Not Implemented)**，对已知但目标资源不支持的方法返回 **405 (Method Not Allowed)** 并带 `Allow` 字段。

详见[方法](/manual/computer-programming/http11/methods)。

## request-target

四种形式，用哪种取决于方法与是否经代理：

```text
request-target = origin-form / absolute-form / authority-form / asterisk-form
```

### origin-form

最常见形式。直连服务器时的绝大多数请求用它：

```text
origin-form = absolute-path [ "?" query ]
```

```text
GET /where?q=now HTTP/1.1
Host: www.example.org
```

要点：

-   **绝对路径不得为空**——若 URI 无路径分量，必须发 `/`。
-   **不含**方案与 authority；目标主机由 `Host` 字段给出。
-   fragment（`#...`）**永不**出现在 request-target 中，由客户端本地处理。

### absolute-form

发往**正向代理**时必须用：

```text
absolute-form = absolute-URI
```

```text
GET http://www.example.org/pub/WWW/ HTTP/1.1
Host: www.example.org
```

要点：

-   客户端向代理发请求时 **MUST** 用此形式。
-   服务端 **MUST** 接受此形式（即使自己不是代理），以兼容将来经代理转发的情况。
-   同时仍需发 `Host`，且当两者冲突时，**接收方 MUST 忽略 `Host` 而以 absolute-form 中的 authority 为准**。

### authority-form

仅用于 **CONNECT**：

```text
authority-form = uri-host ":" port
```

```text
CONNECT server.example.com:80 HTTP/1.1
Host: server.example.com:80
```

主机与端口都**不可省略**。

### asterisk-form

仅用于针对服务器整体（而非某资源）的 **OPTIONS**：

```text
OPTIONS * HTTP/1.1
Host: www.example.org
```

## HTTP-version

```text
HTTP-version = "HTTP/" DIGIT "." DIGIT
```

严格两位数字、一个点，**不允许**多位数字或省略次版本号（`HTTP/1` 非法）。

处理规则：

-   服务端收到 major 版本不支持的请求 → **505 (HTTP Version Not Supported)**。
-   收到 `HTTP/1.x`（x ≥ 2，如 `HTTP/1.9`）→ 当作 HTTP/1.1 处理（同 major 版本向前兼容）。
-   响应中回送的版本是**服务端自身支持的最高版本**（在同一 major 内），不是照抄请求版本。
-   `HTTP/1.1` 请求 **MUST** 带 `Host`；缺失或多于一个 → **400**。

## 与 Host 的关系

`Host` 携带目标 authority，是 HTTP/1.1 虚拟主机的基础：

```text
Host = uri-host [ ":" port ]
```

优先级：**absolute-form 的 authority > Host 字段**。服务端据此决定虚拟主机时必须遵循该优先级，否则出现 Host 混淆攻击。

下一篇：[状态行](/manual/computer-programming/http11/status-line)——版本、三位状态码与 reason-phrase。
