---
title: "nginx 如何处理请求"
description: "虚拟服务器选择的两步、default_server 的真实含义、server_name 匹配的四级优先级。"
source: "https://daiw.org/manual/nginx/request-processing"
---

# nginx 如何处理请求

搞清一个请求**落到哪个 server**，是排查「配置没生效」的第一步。

## 两步选择

官方 [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html) 描述的顺序：

> nginx first tests the **IP address and port** of the request against the `listen` directives of the `server` blocks. It then tests the **"Host" header field** of the request against the `server_name` entries of the `server` blocks **that matched the IP address and port**.

```text
第 1 步：按 listen 匹配 IP:端口   → 得到候选 server 集合
第 2 步：在候选集合内按 Host 匹配 server_name
```

**顺序不可颠倒**：`server_name` 只在**已经匹配上 listen** 的 server 之间比较。一个 `server_name example.com` 但 `listen 8080` 的块，永远不会接到 80 端口的请求，哪怕 Host 完全对得上。

## default\_server

Host 匹配不上任何 `server_name` 时怎么办：

> If its value does not match any server name, or **the request does not contain this header field at all**, then nginx will route the request to the **default server** for this port.

默认服务器的确定方式：

```text
server {
    listen      80 default_server;
    server_name example.net www.example.net;
}
```

没有显式标注时：

> the default server is **the first one** — which is nginx's standard default behaviour.

**该端口上第一个出现的 server 块**就是默认服务器。

官方特别强调的一句：

> Note that the default server is a property of the **listen port** and not of the server name.

**默认服务器是「端口」的属性，不是「名字」的属性。** 所以 `default_server` 写在 `listen` 上而不是 `server_name` 上，而且**每个端口各有一个**默认服务器——80 和 443 的默认服务器是相互独立的。

这条经常被误解成「default\_server 是兜底站点」。准确说法是：**它是该端口上 Host 匹配失败时的接管者**。

## 拒绝无 Host 的请求

官方给的做法：

```text
server {
    listen      80;
    server_name "";
    return      444;
}
```

> Here, the server name is set to an **empty string** that will match requests **without the "Host" header field**, and a special nginx's non-standard code **444** is returned that closes the connection.

两个知识点：

-   **`server_name ""`** 专门匹配「没有 Host 头」的请求。
-   **`444`** 是 nginx 私有的非标准码：**不返回任何响应，直接关闭连接**。它不在 [HTTP 状态码](https://daiw.org/manual/http11/status-codes)注册表里，只在 nginx 内部有意义。

[HTTP/1.1 规定](https://daiw.org/manual/http11/request-line) `Host` 必需且唯一，缺失应返回 `400`。用 `444` 直接断连是更省资源的做法——对扫描器不必浪费一个响应。

## server\_name 的匹配优先级

多个 server 都可能匹配时，官方给了**严格的四级顺序**：

> The search is performed in the following **order of priority** and **terminates on the first matching variant**:
> 
> 1.  the **exact** name
> 2.  the **longest wildcard name starting with an asterisk**, e.g. `*.example.com`
> 3.  the **longest wildcard name ending with an asterisk**, e.g. `mail.*`
> 4.  the **first matching regular expression** (in order of appearance in the configuration file)

| 优先级 | 形式 | 例子 |
| --- | --- | --- |
| 1 | 精确名 | `www.example.com` |
| 2 | **前置**通配，取**最长**匹配 | `*.example.com` |
| 3 | **后置**通配，取**最长**匹配 | `mail.*` |
| 4 | 正则，取**配置中第一个**匹配 | `~^www\d+\.example\.com$` |

三个易错点：

-   **通配符只能在开头或结尾**，且必须以 `.` 分隔。`www.*.com` 非法。
-   通配之间比**长度**，正则之间比**出现顺序**——两套不同的裁决方式。
-   **精确名永远赢**，哪怕正则写在前面。

不要把这四级顺序与 [location 的匹配规则](/manual/tools/nginx/location)混为一谈——两者规则完全不同，是最常见的记忆混淆。`server_name` 是「先精确、再通配比长度、最后正则比顺序」；location 是「前缀取最长并记住、再按顺序试正则、正则命中即用」。

## 完整流程

图表加载中…

## listen 的匹配精度

`listen` 本身也有精确度之分，nginx 优先选**更具体**的：

```text
server { listen 192.0.2.1:80; server_name example.com; }  # 具体 IP
server { listen 80;           server_name example.com; }  # 所有 IP
```

发往 `192.0.2.1:80` 的请求命中第一个——**绑定具体 IP 比绑定通配地址更精确**。

## 调试手法

不确定请求落到哪个 server 时，给每个 server 加一个标记头：

```text
server {
    server_name example.com;
    add_header X-Debug-Server "example.com-block" always;
}
```

注意加 `always`——`add_header` 默认只对 `200`、`201`、`204`、`206`、`301`、`302`、`303`、`304`、`307`、`308` 生效，**错误响应不会带上这个头**，而排查时恰恰常是错误响应。相关的[继承覆盖问题](/manual/tools/nginx/contexts)也要留意。

下一篇：[核心模块指令](/manual/tools/nginx/core-module)。
