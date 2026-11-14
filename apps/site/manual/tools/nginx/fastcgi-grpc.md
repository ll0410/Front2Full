---
title: "FastCGI、uWSGI 与 gRPC"
description: "fastcgi_param 的必填项、PATH_INFO 与安全陷阱、uwsgi/scgi 对照与 grpc_pass。"
source: "https://daiw.org/manual/nginx/fastcgi-grpc"
---

# FastCGI、uWSGI 与 gRPC

除 HTTP 外，nginx 还能直接说 FastCGI、uwsgi、SCGI、gRPC 四种上游协议。它们的指令高度同构——`*_pass`、`*_param`、`*_buffering`、`*_read_timeout` 一一对应。

## FastCGI

最常见的用途是 PHP-FPM。

```text
location ~ \.php$ {
    try_files $uri =404;                       # ← 必需，见下

    fastcgi_pass  127.0.0.1:9000;              # 或 unix:/run/php-fpm.sock
    fastcgi_index index.php;

    include       fastcgi_params;              # 发行版自带的公共参数
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    fastcgi_param PATH_INFO       $fastcgi_path_info;
}
```

### fastcgi\_pass

```text
语法:    fastcgi_pass address;
上下文:  location, if in location
```

与 [`proxy_pass`](/manual/tools/nginx/proxy) 不同，**`fastcgi_pass` 不带 URI**——FastCGI 是通过参数传递路径信息的，没有「URI 替换」这回事。

地址可以是 `host:port`、`unix:/path`，或一个 [upstream 名](/manual/tools/nginx/upstream)。

### SCRIPT\_FILENAME 是必填的

```text
fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
```

**没有它 PHP-FPM 不知道要执行哪个文件**，会返回 `No input file specified` 或空白页。

多数发行版的 `fastcgi_params` 文件里**故意不含**这一行——因为它依赖具体的 `root` 配置，必须由使用者自己写。这是「配了 include 还是不工作」的常见原因。

`$document_root` vs `$realpath_root` 的选择见[变量章](/manual/tools/nginx/variables)：符号链接部署 + OPcache 时通常需要 `$realpath_root`。

### 那个 `try_files $uri =404;` 为什么必需

```text
location ~ \.php$ {
    try_files $uri =404;    # ← 少了这行是安全漏洞
    fastcgi_pass ...;
}
```

**这是 nginx + PHP 最著名的安全陷阱。**

没有这行时，请求 `/uploads/evil.jpg/x.php` 会：

1.  匹配 `location ~ \.php$`（URI 以 `.php` 结尾）；
2.  `SCRIPT_FILENAME` 被拼成 `/var/www/uploads/evil.jpg/x.php`；
3.  PHP 的 `cgi.fix_pathinfo` 默认会向上回退，找到真实存在的 `/var/www/uploads/evil.jpg`；
4.  **把上传的图片当 PHP 执行** → 任意代码执行。

`try_files $uri =404;` 先确认「这个 `.php` 文件真的存在」，不存在直接 404，切断了整条链路。

另一半防护在 PHP 侧：`php.ini` 里设 `cgi.fix_pathinfo=0`。**两边都做才稳妥。**

### PATH\_INFO

```text
fastcgi_split_path_info ^(.+\.php)(/.+)$;
fastcgi_param PATH_INFO $fastcgi_path_info;
```

`fastcgi_split_path_info` 用正则把 URI 切成「脚本路径」与「路径信息」两段，分别填进 `$fastcgi_script_name` 与 `$fastcgi_path_info`。

框架路由（`/index.php/user/1`）需要它。不用这种路由风格时不必配。

### FastCGI 的 keepalive

```text
upstream php {
    server unix:/run/php-fpm.sock;
    keepalive 8;
}

location ~ \.php$ {
    fastcgi_pass      php;
    fastcgi_keep_conn on;        # ← FastCGI 专用，必需
}
```

[前一章](/manual/tools/nginx/upstream)提过：**FastCGI 需要额外的 `fastcgi_keep_conn on;`**，只配 upstream 的 `keepalive` 不生效。

### 缓冲与超时

与 proxy 完全同构，只是前缀不同：

| FastCGI | 对应 proxy | 默认 |
| --- | --- | --- |
| `fastcgi_buffering` | `proxy_buffering` | `on` |
| `fastcgi_buffer_size` | `proxy_buffer_size` | 4k|8k |
| `fastcgi_buffers` | `proxy_buffers` | 8 4k|8k |
| `fastcgi_connect_timeout` | `proxy_connect_timeout` | 60s |
| `fastcgi_read_timeout` | `proxy_read_timeout` | 60s |
| `fastcgi_next_upstream` | `proxy_next_upstream` | error timeout |

PHP 长任务超时要同时调 nginx 的 `fastcgi_read_timeout` 与 PHP 的 `max_execution_time`——**两边取较小值生效**。

## uwsgi 与 SCGI

```text
location / {
    include     uwsgi_params;
    uwsgi_pass  unix:/run/uwsgi/app.sock;
}
```

指令集与 FastCGI 一一对应（`uwsgi_param`、`uwsgi_buffering`、`uwsgi_read_timeout`…），用于 Python WSGI 应用。

**uwsgi 与 SCGI 都不支持 keepalive**（官方明确说明）。所以这两种协议下配 upstream `keepalive` 无效——每个请求都是新连接。

现代 Python 部署更多用 `proxy_pass` 直连 gunicorn/uvicorn 的 HTTP 端口，从而能用上 HTTP keepalive。

## gRPC

```text
server {
    listen 443 ssl;
    http2  on;                    # gRPC 必须走 HTTP/2

    location / {
        grpc_pass grpc://127.0.0.1:50051;
    }
}
```

TLS 上游用 `grpcs://`：

```text
grpc_pass grpcs://backend.internal:50051;
```

要点：

-   **必须开 [HTTP/2](/manual/tools/nginx/http2-http3)**——gRPC 基于 HTTP/2，没有 h2 就不成立。
-   指令族同构：`grpc_set_header`、`grpc_connect_timeout`、`grpc_read_timeout`、`grpc_next_upstream`。
-   **流式 RPC 要调大 `grpc_read_timeout`**——服务端流可能长时间无数据。
-   上游是 upstream 组时写 `grpc_pass grpc://组名;`。

按服务分流：

```text
location /helloworld.Greeter/ {
    grpc_pass grpc://greeter_backend;
}
location /routeguide.RouteGuide/ {
    grpc_pass grpc://route_backend;
}
```

gRPC 的路径就是 `/包名.服务名/方法名`，所以用普通的[前缀 location](/manual/tools/nginx/location) 就能按服务路由。

## 四种协议对照

|  | FastCGI | uwsgi | SCGI | gRPC |
| --- | --- | --- | --- | --- |
| 典型场景 | PHP-FPM | Python WSGI | 通用 | 微服务 RPC |
| pass 指令 | `fastcgi_pass` | `uwsgi_pass` | `scgi_pass` | `grpc_pass` |
| 传参方式 | `fastcgi_param` | `uwsgi_param` | `scgi_param` | HTTP/2 头 |
| keepalive | ✅（需 `fastcgi_keep_conn`） | ❌ | ❌ | ✅（h2 原生） |
| 要求 HTTP/2 | 否 | 否 | 否 | **是** |

下一篇：[SSL/TLS 配置](/manual/tools/nginx/ssl)。
