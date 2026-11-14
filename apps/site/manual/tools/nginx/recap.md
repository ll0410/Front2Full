---
title: "常见误配速查"
description: "二十条高频错误、需要改的默认值清单、已过期的旧最佳实践，以及调试手法。"
source: "https://daiw.org/manual/nginx/recap"
---

# 常见误配速查

## 二十条高频误配

### 语法与结构

1.  **块指令右花括号后加了分号** → `unexpected ";"`。见[语法](/manual/tools/nginx/config-syntax)。
2.  **`m` 在大小里是兆、在时间里是分** → 永远写后缀，别省。
3.  **`include` 通配符按字母序展开** → 依赖顺序时用数字前缀。

### 继承（最高频）

4.  **内层写了一条 `add_header`，外层全部失效** → 数组型继承是「全有或全无」。1.29.3+ 可用 `add_header_inherit merge`。见[继承](/manual/tools/nginx/contexts)。
5.  **内层写了 `proxy_set_header`，`Host`/`X-Forwarded-For` 全丢** → 同上，且没有 `_inherit` 开关，只能重复声明或 `include`。
6.  **`access_log` 在 location 里一写，server 级日志就没了** → 同一规则。

### 路由

7.  **`^~` 不是「优先级更高的前缀」** → 它先要赢得最长前缀竞争，才会短路正则。见 [location](/manual/tools/nginx/location)。
8.  **`server_name` 与 `location` 的匹配规则完全不同** → 前者「精确→通配比长度→正则比顺序」，后者「最长前缀记住→正则按顺序→回退前缀」。
9.  **`default_server` 是端口的属性，不是名字的** → 每个端口各有一个。
10.  **`server_name _;` 里的 `_` 没有魔法** → 起作用的是 `default_server`。

### 代理

11.  **`proxy_pass http://backend;` 与 `http://backend/;` 行为完全不同** → 后者那个 `/` 是 URI，会吃掉 location 前缀。见 [proxy](/manual/tools/nginx/proxy)。
12.  **默认传给上游的 `Host` 是 `$proxy_host` 不是客户端的** → 必须 `proxy_set_header Host $host;`。
13.  **`proxy_read_timeout` 不是「响应总时长上限」** → 是两次读之间的间隔。
14.  **上游返回 500 默认不触发换机** → `proxy_next_upstream` 默认只有 `error timeout`。
15.  **`fail_timeout` 同时是统计窗口和隔离时长** → 两者共用一个值。见 [upstream](/manual/tools/nginx/upstream)。

### 文件与路径

16.  **`alias` 的尾斜杠必须与 location 一致** → 不一致会拼出 `/data/imagestop.gif` 这种路径。见 [root/alias](/manual/tools/nginx/root-alias)。
17.  **`try_files` 的最后一个参数必须真实存在** → 否则 `rewrite or internal redirection cycle` + `500`。
18.  **PHP location 缺 `try_files $uri =404;` 是远程代码执行漏洞** → 见 [FastCGI](/manual/tools/nginx/fastcgi-grpc)。

### 变量

19.  **跳转用 `$request_uri` 不是 `$uri`** → 后者不含查询串，且会被内部重定向改写。见[变量](/manual/tools/nginx/variables)。
20.  **`$https` 非 TLS 时是空串而不是 `off`** → 判断要写 `= ""`。

## 默认值不适合生产的清单

nginx 的默认值偏保守，这些**必须显式改**：

| 指令 | 默认 | 生产建议 | 后果 |
| --- | --- | --- | --- |
| `worker_processes` | **1** | `auto` | 只用一个核 |
| `worker_connections` | **512** | 4096–16384 | 并发上限低 |
| `worker_rlimit_nofile` | — | ≥ worker\_connections | `Too many open files` |
| `client_max_body_size` | **1m** | 按需 | 上传 `413` |
| `ssl_session_cache` | **none** | `shared:SSL:10m` | 每次都完整握手 |
| `ssl_session_timeout` | **5m** | `1d` | 复用窗口太短 |
| `gzip` | **off** | `on` | 不压缩 |
| `gzip_comp_level` | **1** | 4–6 | 压缩率低 |
| `gzip_min_length` | **20** | `1024` | 小响应反而变大 |
| `gzip_proxied` | **off** | `any` | **反代后面完全不压缩** |
| `gzip_vary` | **off** | `on` | **CDN 缓存投毒** |
| `sendfile` | **off** | `on` | 静态文件多一次拷贝 |
| `proxy_cache_key` | 含 `$proxy_host` **不含 `$host`** | 加 `$host` | 多域名缓存串号 |
| `proxy_cache_lock` | **off** | `on` | 缓存击穿 |
| `proxy_cache_revalidate` | **off** | `on` | 过期后全量重传 |
| `limit_req_status` | **503** | `429` | 语义错误 |
| `server_tokens` | **on** | `off` | 暴露版本号 |

## 已过期的「最佳实践」

网上大量教程停留在多年前。这些写法现在**不该再抄**：

| 旧写法 | 现状 |
| --- | --- |
| `accept_mutex on;` | **1.11.3 起默认 off**，开启反而降性能 |
| `ssl_protocols TLSv1 TLSv1.1 TLSv1.2;` | 默认已是 `TLSv1.2 TLSv1.3`，照抄等于**开启已废弃协议** |
| `ssl_prefer_server_ciphers on;` | TLS 1.3 时代已无必要，默认 off 即可 |
| `listen 443 ssl http2;` | **`http2` 参数已废弃**，改用 `http2 on;` |
| `proxy_http_version 1.1;`（为了 keepalive） | **1.29.7 起已是默认** |
| upstream 必须手动配 `keepalive` | **1.29.7 起默认启用**（32/worker） |
| `gzip_disable "msie6";` | IE6 已绝迹，可删 |
| `http2_push ...` | [推送已废弃](https://daiw.org/manual/http2-3/h2-server-push)，指令已移除 |

**判断一份 nginx 教程是否过时，看这几处即可**：写着 `accept_mutex on`、`ssl_protocols TLSv1`、`listen ... http2` 的，基本都是 2020 年前的内容，其他部分也需要用[官方文档](https://nginx.org/en/docs/)复核。

## 调试手法

### 先测再重载

```text
nginx -t
```

```text
nginx -s reload
```

`-t` 不过就别 reload。**`reload` 时配置有错，nginx 会保留旧配置继续运行**（不会崩），但新 worker 起不来——容易误以为改动生效了。

### 看展开后的完整配置

```text
nginx -T
```

排查 `include` 顺序、确认某处最终继承到什么值时，比读源文件可靠得多。

### 确认编译参数

```text
nginx -V
```

能看到：编译时的 TLS 库（影响 [QUIC 0-RTT](/manual/tools/nginx/http2-http3)）、是否带 `--with-debug`、装了哪些模块。「指令不认识」的问题多半在这里找到答案。

### 标记法定位

不确定命中哪个 server/location 时：

```text
add_header X-Debug-Server   "$server_name" always;
add_header X-Debug-Uri      "$uri"         always;
add_header X-Debug-Upstream "$upstream_addr" always;
```

**务必带 `always`**——否则错误响应不带这些头，而排查时恰恰常是错误响应。

### 日志里加上游耗时

```text
log_format debug '$remote_addr "$request" $status '
                 'rt=$request_time urt=$upstream_response_time '
                 'uct=$upstream_connect_time ua=$upstream_addr '
                 'cache=$upstream_cache_status';
```

`$request_time − $upstream_response_time` ≈ nginx 自身 + 网络耗时。两者都大是上游慢，只有前者大是客户端慢或 nginx 有瓶颈。

### 调试日志

```text
error_log /var/log/nginx/debug.log debug;
```

需要 `--with-debug` 编译。输出量极大，**只对特定客户端开**：

```text
events {
    debug_connection 192.168.1.100;
}
```

## 一份可直接用的骨架

```text
user              nginx;
worker_processes  auto;
worker_rlimit_nofile 65535;
error_log         /var/log/nginx/error.log warn;
pid               /var/run/nginx.pid;

events {
    worker_connections 16384;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format main escape=json
        '{"time":"$time_iso8601","addr":"$remote_addr",'
        '"req":"$request","uri":"$request_uri","status":$status,'
        '"bytes":$body_bytes_sent,"rt":$request_time,'
        '"urt":"$upstream_response_time","cache":"$upstream_cache_status"}';
    access_log /var/log/nginx/access.log main buffer=64k flush=5s;

    sendfile    on;
    tcp_nopush  on;
    tcp_nodelay on;

    server_tokens        off;
    client_max_body_size 20m;
    keepalive_timeout    65s 60s;

    gzip            on;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_proxied    any;
    gzip_vary       on;
    gzip_types      text/plain text/css text/xml application/json
                    application/javascript application/xml image/svg+xml;

    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;

    include /etc/nginx/conf.d/*.conf;
}
```

## 继续读什么

-   配置里出现的 HTTP 概念 → [《HTTP/1.1 协议详解》](https://daiw.org/manual/http11)
-   `http2 on` / `listen ... quic` 背后的协议 → [《HTTP/2 与 HTTP/3 协议详解》](https://daiw.org/manual/http2-3)
-   权威定义永远以 [nginx.org 官方文档](https://nginx.org/en/docs/) 为准

本专栏基准为 **stable 1.30.6 / mainline 1.31.8**（2026-11-06 快照）。nginx 默认值确实会变——[本章列的多条默认值](#默认值不适合生产的清单)近年都调整过，读到与本文不符时以你实际运行版本的官方文档为准，用 `nginx -v` 确认版本。
