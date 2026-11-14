---
title: "server 与 listen"
description: "listen 的三种形式与全部参数、http2 参数的废弃、reuseport 与 backlog，以及 server 级常用指令。"
source: "https://daiw.org/manual/nginx/server-listen"
---

# server 与 listen

## listen

```text
语法:    listen address[:port] [parameters];
         listen port [parameters];
         listen unix:path [parameters];
默认:    listen *:80 | *:8000;
上下文:  server
```

三种形式：**`地址[:端口]`**、**纯端口**、**UNIX 套接字**。

默认值那个 `*:80 | *:8000` 的写法含义是：以 root 运行时默认 80，非 root 时默认 8000（绑不了特权端口）。

### 常见写法

```text
listen 80;                      # 所有 IPv4 地址的 80 端口
listen *:8000;                  # 同上，显式通配
listen 127.0.0.1:8000;          # 仅本机
listen [::]:8000;               # IPv6
listen localhost:8000;
listen unix:/var/run/nginx.sock;
```

## http2 参数已废弃

官方文档对 `listen` 的 `http2` 参数标注：

> `http2` — Configure port to accept HTTP/2 connections (**deprecated**; use `http2` directive instead)

**`listen 443 ssl http2;` 这种写法已被官方标记为废弃**（1.25.1 起分离），应改成：

```text
listen 443 ssl;
http2 on;
```

原因是 `http2` 作为 listen 参数是**端口级**的，而独立的 `http2` 指令可以写在 `http`/`server` 级，粒度更合理——同一端口上不同 server 可以有不同的 HTTP/2 开关。

旧写法目前仍能工作，但网上绝大多数教程停留在旧形式，新配置应该用新写法。

## 全部参数

| 参数 | 含义 |
| --- | --- |
| `default_server` | 该 address:port 的[默认服务器](/manual/tools/nginx/request-processing) |
| `ssl` | 该端口所有连接走 TLS |
| `http2` | **已废弃**，改用 `http2` 指令 |
| `quic` | 接受 QUIC 连接（**1.25.0+**），[HTTP/3](/manual/tools/nginx/http2-http3) 用 |
| `proxy_protocol` | 该端口所有连接走 PROXY 协议 |
| `backlog=number` | `listen()` 的 backlog。默认 BSD/macOS 为 -1，其他为 **511** |
| `reuseport` | **每个 worker 独立 socket**（`SO_REUSEPORT`），Linux 3.9+ |
| `bind` | 对该 address:port 单独调 `bind()` |
| `ipv6only=on|off` | `IPV6_V6ONLY`，**默认 on** |
| `deferred` | 延迟 accept（Linux `TCP_DEFER_ACCEPT`） |
| `fastopen=number` | TCP Fast Open 队列长度 |
| `so_keepalive=...` | TCP keepalive，形如 `30m::10` |
| `rcvbuf=` / `sndbuf=` | socket 收发缓冲 |
| `accept_filter=` | FreeBSD/NetBSD 的 `dataready` / `httpready` |
| `multipath` | Multipath TCP，Linux 5.6+ |
| `setfib=number` | 路由表，仅 FreeBSD |

### reuseport

```text
listen 80 reuseport;
```

每个 worker 拿到**自己的监听 socket**，由内核直接把新连接分发到各 worker。

价值：**彻底消除惊群与 accept 争抢**，高并发短连接下能显著提升吞吐与均衡性。这也是 [`accept_mutex` 默认关闭](/manual/tools/nginx/core-module)的底气之一。

注意：`reuseport` **只需在一个 server 块的 listen 上写一次**，同 address:port 的其他 server 不要重复写（会报错）。

### ipv6only

```text
listen [::]:80;                # 默认 ipv6only=on，只收 IPv6
listen [::]:80 ipv6only=off;   # 同时收 IPv4（v4-mapped）
```

**默认 `on`**。想用一个 socket 同时服务 v4/v6 才关掉，但更常见的做法是写两条 listen：

```text
listen 80;
listen [::]:80;
```

### backlog

未被 accept 的连接排队长度，**默认 511**。突发流量下 accept 队列打满会导致连接被拒（表现为客户端连接超时）。高并发场景可调大，但同时要抬高内核的 `net.core.somaxconn`——**两者取较小值生效**。

## server\_name

见 [nginx 如何处理请求](/manual/tools/nginx/request-processing)的四级优先级。补充几个写法：

```text
server_name example.com www.example.com;   # 多个名字
server_name *.example.com;                 # 前置通配
server_name mail.*;                        # 后置通配
server_name ~^www(?<num>\d+)\.example\.com$;  # 正则 + 命名捕获
server_name "";                            # 匹配无 Host 的请求
server_name _;                             # 「无效名」惯例，见下
```

**`server_name _;` 不是什么特殊语法。** `_` 只是一个不可能与任何真实 Host 匹配的普通名字（下划线不是合法域名字符）。它常与 `default_server` 一起用来表达「这是兜底块」，但**起作用的是 `default_server`，不是 `_`**。

写成 `server_name __;` 或 `server_name ---;` 效果完全一样。

正则形式的**命名捕获可以直接当变量用**：

```text
server {
    server_name ~^(?<subdomain>.+)\.example\.com$;
    root /sites/$subdomain;
}
```

## client\_max\_body\_size

```text
语法:    client_max_body_size size;
默认:    client_max_body_size 1m;
上下文:  http, server, location
```

请求体大小上限，**默认仅 1 MB**。超过返回 **`413`**（[Content Too Large](https://daiw.org/manual/http11/status-4xx)）。

设为 `0` 关闭检查。

「上传文件失败/413」的头号原因就是这个 1m 默认值。改的时候注意：如果后面还有一层上游（另一个 nginx、应用服务器），**每一层都要改**——任何一层拒绝都会失败。

## keepalive\_timeout

```text
语法:    keepalive_timeout timeout [header_timeout];
默认:    keepalive_timeout 75s;
上下文:  http, server, location
```

-   **第一个参数**：服务端保持[长连接](https://daiw.org/manual/http11/connection-management)的超时。设为 `0` **禁用 keep-alive**。
-   **第二个参数（可选）**：写进响应头 `Keep-Alive: timeout=N` 的值。

两者**可以不同**——常见做法是让通告值略小于实际值，给客户端留出关闭余量：

```text
keepalive_timeout 65s 60s;
```

## server\_tokens

```text
语法:    server_tokens on | off | build | string;
默认:    server_tokens on;
上下文:  http, server, location
```

控制错误页与 [`Server` 响应头](https://daiw.org/manual/http11/context-fields)里是否带 nginx 版本号。

| 值 | 效果 |
| --- | --- |
| `on` | `Server: nginx/1.30.6` |
| `off` | `Server: nginx`（**版本隐藏，但仍暴露是 nginx**） |
| `build` | 版本 + 构建名（1.11.10+） |
| `string` | 自定义（**商业版**，1.9.13+）；空串则完全去掉 `Server` 头 |

**开源版做不到彻底隐藏 `Server` 头**——`off` 只去掉版本号。要完全去掉需要商业版，或用第三方模块 `headers-more`。

生产建议至少：

```text
server_tokens off;
```

理由见 [HTTP 的 `Server` 字段](https://daiw.org/manual/http11/context-fields)：精确版本号方便攻击者匹配已知漏洞。

## 一个典型 server 块

```text
server {
    listen              443 ssl reuseport;
    listen              [::]:443 ssl;
    http2               on;

    server_name         example.com www.example.com;
    root                /var/www/example;

    client_max_body_size 20m;
    keepalive_timeout    65s 60s;
    server_tokens        off;

    ssl_certificate     /etc/ssl/example.crt;
    ssl_certificate_key /etc/ssl/example.key;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

下一篇：[location 匹配规则](/manual/tools/nginx/location)。
