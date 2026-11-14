---
title: "upstream 负载均衡"
description: "五种调度算法、server 参数全解、被动健康检查的真实语义与 keepalive 的默认值变更。"
source: "https://daiw.org/manual/nginx/upstream"
---

# upstream 负载均衡

## upstream 块

```text
upstream backend {
    server backend1.example.com weight=5;
    server backend2.example.com:8080;
    server unix:/tmp/backend3;

    server backup1.example.com backup;
}

server {
    location / {
        proxy_pass http://backend;
    }
}
```

`upstream` 的上下文是 **`http`**——与 `server` 平级，不能写在 `server` 里面。

## server 参数

| 参数 | 默认 | 含义 |
| --- | --- | --- |
| `weight=n` | **1** | 权重 |
| `max_conns=n` | **0**（不限） | 最大并发连接 |
| `max_fails=n` | **1** | 判定不可用前的失败次数 |
| `fail_timeout=t` | **10s** | **双重含义**，见下 |
| `backup` | — | 仅当主服务器全不可用时启用 |
| `down` | — | 永久标记不可用 |
| `resolve` | — | 跟踪 DNS 变化自动更新（需 `resolver`） |
| `drain` | — | 排空模式，只接受已绑定的请求 |
| `slow_start=t` | — | 恢复时权重渐增（**商业版**） |

## 被动健康检查

nginx 开源版**没有主动健康检查**（那是商业版功能）。开源版靠 `max_fails` + `fail_timeout` 做**被动**检测：

```text
server backend1.example.com max_fails=3 fail_timeout=30s;
```

**`fail_timeout` 有两个含义**，这是最容易误解的地方：

1.  **统计窗口**——在这段时间内失败达到 `max_fails` 次才判定不可用。
2.  **隔离时长**——判定不可用后，隔离这么久再重试。

上面的配置读作：「**30 秒内失败 3 次** → 标记不可用 → **隔离 30 秒**」。两个时长共用同一个值，无法分开设置。

「失败」的定义由 [`proxy_next_upstream`](/manual/tools/nginx/proxy) 决定——默认只有 `error` 和 `timeout` 算。**上游返回 500 默认不算失败**，所以一台持续返回 500 的机器不会被摘掉。要摘就得：

```text
proxy_next_upstream error timeout http_500 http_502 http_503;
```

注意 `http_403`/`http_404` **永远不计入失败次数**，即使列出来也不影响 `max_fails`。

### backup 与 down

```text
upstream backend {
    server primary1.example.com;
    server primary2.example.com;
    server standby.example.com backup;   # 主的全挂了才用
    server retired.example.com down;     # 永久下线
}
```

`down` 的一个重要用途是配合 `ip_hash`——见下。

## 五种调度算法

### 1\. round-robin（默认）

不写任何算法指令时的默认。按权重轮询：

```text
upstream backend {
    server backend1.example.com weight=5;
    server backend2.example.com;   # weight=1
    server backend3.example.com;   # weight=1
}
```

每 7 个请求：backend1 拿 5 个，另两台各 1 个。

### 2\. least\_conn

```text
upstream backend {
    least_conn;
    server backend1.example.com;
    server backend2.example.com;
}
```

发给**当前活跃连接数最少**的机器（同样考虑权重）。

适用于**请求处理时长差异大**的场景——轮询会把慢请求和快请求平均分配，导致某些机器堆积；least\_conn 能自动避开繁忙的机器。

### 3\. ip\_hash

```text
upstream backend {
    ip_hash;
    server backend1.example.com;
    server backend2.example.com;
    server backend3.example.com down;   # ← 注意这里
}
```

按客户端 IP 哈希：**IPv4 取前 3 段**，IPv6 取完整地址。同一客户端总落到同一台——用于**会话保持**。

**要临时移除机器时用 `down` 而不是删掉那一行。** 官方示例里特意写了 `down`，原因是：删除一行会改变服务器列表长度，导致**所有**客户端的哈希结果重新分配（会话全丢）；标 `down` 则保留了位置，只有原本落在该机器上的客户端被重新分配。

IPv4 只取前 3 段（`/24`）意味着同一个 C 段的客户端会落到同一台——对 NAT 后的大量用户会造成不均衡。

### 4\. hash

```text
upstream backend {
    hash $request_uri consistent;
    server backend1.example.com;
    server backend2.example.com;
}
```

按**任意 key** 哈希，key 可以是任何[变量](/manual/tools/nginx/variables)组合：

```text
hash $cookie_sessionid;          # 按会话
hash $arg_userid consistent;     # 按用户
hash $request_uri consistent;    # 按 URI（缓存友好）
```

**`consistent` 参数启用 ketama 一致性哈希**——增删机器时只有少部分 key 需要重映射，而不是全部。做缓存分片时**必须加**，否则加一台机器会导致缓存全部失效。

### 5\. random

```text
upstream backend {
    random two least_conn;
    server backend1.example.com;
    server backend2.example.com;
}
```

随机按权重选。`two` 参数是关键：**随机挑 2 台，再用指定方法（默认 `least_conn`）从中选一台**。

这是「**二选一的力量**」（power of two choices）——只需两次随机采样就能获得接近全局最优的负载均衡效果，且**无需维护全局状态**。在多 nginx 实例的场景下比 `least_conn` 更优：`least_conn` 只知道自己这台 nginx 的连接数，多实例时会集体涌向同一台后端。

## keepalive

```text
upstream backend {
    server 127.0.0.1:8080;
    keepalive 32;
}
```

**保持到上游的长连接池**，避免每个请求都 TCP+TLS 握手。

**1.29.7 起 keepalive 默认启用**，每 worker 32 条连接。相关默认值：

| 项 | 默认 |
| --- | --- |
| 连接数（每 worker） | **32**（1.29.7 起默认开启） |
| `keepalive_timeout` | 60 秒 |
| `keepalive_requests` | 1000（1.15.3+） |
| `keepalive_time` | 1 小时（1.19.10+） |

这是个重要变更：以前不显式配 `keepalive` 就完全没有长连接，每个请求都要重新握手。现在默认就有了。

历史上还需要这两行配合：

```text
location / {
    proxy_pass http://backend;
    proxy_http_version 1.1;      # 1.29.7 起已是默认
    proxy_set_header Connection ""; # 清掉默认的 Connection: close
}
```

`proxy_http_version` [默认已改为 1.1](/manual/tools/nginx/proxy)，但 `Connection ""` 在旧版本仍需显式写。

### 各协议的 keepalive 支持

| 协议 | 支持 | 额外要求 |
| --- | --- | --- |
| HTTP | ✅ | `proxy_http_version 1.1` + `Connection ""` |
| FastCGI | ✅ | **`fastcgi_keep_conn on;`** |
| SCGI | ❌ | 不支持 |
| uwsgi | ❌ | 不支持 |

FastCGI 的 `fastcgi_keep_conn on` 容易漏——只配 upstream 的 `keepalive` 而不开这个，连接池不会生效。

## resolve：动态 DNS

```text
resolver 10.0.0.2 valid=30s;

upstream backend {
    zone backend 64k;
    server api.internal.example.com resolve;
}
```

默认情况下 nginx **只在启动时解析一次** upstream 里的域名——后端 IP 变了（K8s 滚动更新、云负载均衡漂移）不会感知，必须 reload。

`resolve` 参数让它跟踪 DNS 变化。**需要 `resolver` 指令**，且通常需要 `zone`（共享内存）。

这是容器/云环境的常见故障：后端 Pod 重建换了 IP，nginx 还在往旧 IP 发请求，表现为持续 502 直到 reload。开源版可用 `resolve` 解决，但注意它对某些配置组合有限制（如 `proxy_pass` 里直接写域名而非 upstream 名时行为不同）。

## 一份生产 upstream

```text
upstream api_backend {
    least_conn;

    server 10.0.1.10:8080 weight=2 max_fails=3 fail_timeout=15s;
    server 10.0.1.11:8080 weight=2 max_fails=3 fail_timeout=15s;
    server 10.0.1.12:8080          max_fails=3 fail_timeout=15s;
    server 10.0.1.99:8080 backup;

    keepalive     64;
    keepalive_requests 10000;
    keepalive_timeout  60s;
}

server {
    location / {
        proxy_pass http://api_backend;

        proxy_http_version 1.1;
        proxy_set_header   Connection "";
        proxy_set_header   Host $host;

        proxy_next_upstream       error timeout http_502 http_503;
        proxy_next_upstream_tries 2;
    }
}
```

下一篇：[FastCGI、uWSGI 与 gRPC](/manual/tools/nginx/fastcgi-grpc)。
