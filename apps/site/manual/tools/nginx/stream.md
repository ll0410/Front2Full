---
title: "stream：TCP/UDP 代理"
description: "与 http 平行的另一套世界、UDP 的会话语义、SNI 分流与 PROXY 协议。"
source: "https://daiw.org/manual/nginx/stream"
---

# stream：TCP/UDP 代理

`stream` 块提供**四层（TCP/UDP）代理**，与 `http` 块**平级且完全独立**。

## 与 http 的边界

```text
# nginx.conf 顶层
events { }

http {
    server { listen 80; }
}

stream {              # ← 与 http 平级
    server { listen 3306; }
}
```

**`stream` 与 `http` 是两套互不相通的世界：**

|  | `http` | `stream` |
| --- | --- | --- |
| 模块 | `ngx_http_*` | `ngx_stream_*` |
| 代理指令 | `proxy_pass http://x` | `proxy_pass x`（**无协议前缀**） |
| location | **有** | **没有** |
| 变量 | `$uri`、`$host`、`$request` | 大部分**不存在** |
| 日志 | `access_log` + `log_format` | 各自独立的同名指令 |

**`stream` 里没有 `location`**——四层代理看不到 HTTP 路径，无从匹配。整个 `server` 块就是一个整体。

两边的同名指令（如 `proxy_pass`、`access_log`）分属不同模块，**参数与行为都不同**，不能照搬 http 的写法。

编译时需要 `--with-stream`（多数发行版包已带）。

## 基本 TCP 代理

```text
stream {
    upstream mysql_backend {
        server 10.0.0.1:3306;
        server 10.0.0.2:3306;
    }

    server {
        listen     3306;
        proxy_pass mysql_backend;

        proxy_connect_timeout 5s;
        proxy_timeout         10m;
    }
}
```

注意 `proxy_pass` **不带 `http://`**——四层代理不关心应用协议，直接写上游组名或 `host:port`。

## proxy\_timeout

```text
语法:    proxy_timeout timeout;
默认:    proxy_timeout 10m;
上下文:  stream, server
```

**两个方向都无数据传输的超时**。默认 10 分钟。

与 [http 的 `proxy_read_timeout`](/manual/tools/nginx/proxy) 语义不同：这里是「双向都静默」才算超时。长连接协议（数据库、MQTT）要按实际心跳间隔调整。

## UDP 代理

```text
server {
    listen     53 udp;
    proxy_pass dns_backend;

    proxy_responses      1;
    proxy_timeout        1s;
}
```

`listen ... udp` 开启 UDP 模式。两个 UDP 专用指令：

**`proxy_responses`**——期望从上游收到几个响应包。

```text
proxy_responses 1;    # 收到 1 个响应就结束会话（DNS 典型）
proxy_responses 0;    # 不期望响应（syslog 单向）
```

**不设置时**，nginx 会一直等到 `proxy_timeout` 才释放会话——对 DNS 这类一问一答的协议，会白白占用会话槽位。

**UDP 的「会话」是 nginx 虚构的**：UDP 本身无连接，nginx 按「客户端地址+端口」维护一个虚拟会话，把后续包发往同一上游。

## SNI 分流

`stream` 最有价值的用法之一：**在不解密的情况下按 TLS SNI 分流**。

```text
stream {
    map $ssl_preread_server_name $upstream {
        example.com      web_backend;
        api.example.com  api_backend;
        default          web_backend;
    }

    upstream web_backend { server 10.0.1.10:443; }
    upstream api_backend { server 10.0.2.10:443; }

    server {
        listen      443;
        ssl_preread on;              # ← 关键
        proxy_pass  $upstream;
    }
}
```

`ssl_preread on`（`ngx_stream_ssl_preread_module`）让 nginx **窥探 TLS ClientHello 里的 SNI 而不做 TLS 终止**——证书与解密都留给后端。

可用变量：

| 变量 | 内容 |
| --- | --- |
| `$ssl_preread_server_name` | SNI 主机名 |
| `$ssl_preread_alpn_protocols` | ALPN 列表 |
| `$ssl_preread_protocol` | TLS 版本 |

按 ALPN 分流也很有用（把 gRPC 与普通 HTTPS 分开）：

```text
map $ssl_preread_alpn_protocols $backend {
    ~\bh2\b      grpc_backend;
    default      https_backend;
}
```

这是「一个 443 端口同时服务多种后端」的标准方案：TLS 不在 nginx 终止，各后端自己管证书。代价是 nginx 看不到 HTTP 层信息，无法做路径路由、缓存、压缩。

## PROXY 协议

四层代理会丢失客户端真实 IP——后端只看到 nginx 的地址。解法是 PROXY 协议：

```text
# nginx 作为四层代理，向后端发 PROXY 头
server {
    listen     443;
    proxy_pass backend;
    proxy_protocol on;   # 默认发 v1 文本头；1.31.4 起可写 proxy_protocol v2; 发二进制 v2 头（含 TLS ALPN/SNI 等 TLV）
}
```

后端（若也是 nginx）接收：

```text
http {
    server {
        listen 8443 ssl proxy_protocol;

        set_real_ip_from 10.0.0.0/8;
        real_ip_header   proxy_protocol;
    }
}
```

**`listen ... proxy_protocol` 一旦开启，该端口的所有连接都必须带 PROXY 头**——直连（不带头）会被当作协议错误拒绝。

所以这个端口不能同时服务普通客户端。混用场景需要开两个端口。

## 访问控制与限流

`stream` 有自己的一套同名模块：

```text
stream {
    limit_conn_zone $binary_remote_addr zone=perip:10m;

    server {
        listen 3306;
        proxy_pass mysql_backend;

        allow 10.0.0.0/8;
        deny  all;

        limit_conn perip 5;
    }
}
```

`ngx_stream_access_module`、`ngx_stream_limit_conn_module` 与 http 版同名同参，但**是不同的模块**——写在各自的上下文里。

注意 **stream 没有 `limit_req`**（四层没有「请求」的概念，只有连接）。

## 日志

```text
stream {
    log_format basic '$remote_addr [$time_local] '
                     '$protocol $status $bytes_sent $bytes_received '
                     '$session_time "$upstream_addr"';

    access_log /var/log/nginx/stream.log basic;
}
```

stream 专有变量：

| 变量 | 含义 |
| --- | --- |
| `$protocol` | `TCP` 或 `UDP` |
| `$status` | **会话状态**（200 成功、400 客户端错、500 内部错、502 上游不可达、503 受限） |
| `$bytes_sent` / `$bytes_received` | 双向字节数 |
| `$session_time` | 会话时长 |
| `$upstream_bytes_sent` / `$upstream_bytes_received` | 上游侧字节数 |

`$status` 借用了 HTTP 的数字但**语义是 nginx 自定义的会话结果**，与 [HTTP 状态码](https://daiw.org/manual/http11/status-codes)无关。

## TLS 终止

`stream` 也可以自己终止 TLS：

```text
server {
    listen              8443 ssl;
    ssl_certificate     /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;
    proxy_pass          plain_backend;   # 明文转发给后端
}
```

反过来向上游发起 TLS：

```text
server {
    listen        3306;
    proxy_pass    remote_db;
    proxy_ssl     on;
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/ca.pem;
}
```

## 完整示例

```text
stream {
    log_format basic '$remote_addr [$time_local] $protocol '
                     '$status $bytes_sent/$bytes_received '
                     '$session_time $upstream_addr';
    access_log /var/log/nginx/stream.log basic;

    limit_conn_zone $binary_remote_addr zone=sperip:10m;

    # 按 SNI 分流的 443
    map $ssl_preread_server_name $https_pool {
        api.example.com  api_tls;
        default          web_tls;
    }
    upstream api_tls { server 10.0.2.10:443; }
    upstream web_tls { server 10.0.1.10:443; }

    server {
        listen      443 reuseport;
        ssl_preread on;
        proxy_pass  $https_pool;
        proxy_timeout 10m;
    }

    # 内网数据库代理
    upstream pg { server 10.0.3.10:5432; }
    server {
        listen     5432;
        proxy_pass pg;
        allow      10.0.0.0/8;
        deny       all;
        limit_conn sperip 10;
        proxy_timeout 1h;
    }

    # DNS
    upstream dns { server 10.0.4.1:53; }
    server {
        listen          53 udp;
        proxy_pass      dns;
        proxy_responses 1;
        proxy_timeout   1s;
    }
}
```

下一篇：[常见误配速查](/manual/tools/nginx/recap)。
