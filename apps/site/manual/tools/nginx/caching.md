---
title: "代理缓存"
description: "proxy_cache_path 全参数、缓存键的默认值陷阱、优先级链、锁与后台更新、stale 兜底。"
source: "https://daiw.org/manual/nginx/caching"
---

# 代理缓存

## proxy\_cache\_path

```text
语法:    proxy_cache_path path [levels=levels] [keys_zone=name:size]
                          [inactive=time] [max_size=size]
                          [use_temp_path=on|off] [min_free=size] ...;
上下文:  http
```

**只能写在 `http` 上下文**（它定义的是全局共享资源）。

```text
proxy_cache_path /data/nginx/cache
                 levels=1:2
                 keys_zone=one:10m
                 inactive=60m
                 max_size=1g;
```

| 参数 | 含义 |
| --- | --- |
| `levels` | 目录层级，每级 1 或 2 位，最多 3 级 |
| `keys_zone=名:大小` | **共享内存区**，存键与元数据。**1 MB ≈ 8000 个键** |
| `inactive` | 多久没被访问就删除，**默认 10 分钟** |
| `max_size` | 磁盘上限，超了由 cache manager 清理 |
| `use_temp_path` | 是否用独立临时目录，**默认 on** |
| `min_free` | 文件系统最小剩余空间（1.19.1+） |

### levels 为什么需要

不分层的话所有缓存文件堆在一个目录里，几十万文件会让文件系统查找变得极慢。`levels=1:2` 表示按哈希值切出「1 位 / 2 位」两级子目录：

```text
/data/nginx/cache/c/29/b7f54b2df7773722d382f4809d65029c
                  ^ ^^
                  1  2
```

### keys\_zone 要多大

**只存键和元数据，不存内容**。按 1 MB ≈ 8000 键估算：

```text
10m  → 约 8 万个缓存对象
100m → 约 80 万个
```

**zone 满了会按 LRU 淘汰**——即使磁盘还有空间。所以 `keys_zone` 与 `max_size` 要匹配：平均对象 20 KB 时，`max_size=1g` 对应约 5 万对象，`keys_zone=10m` 够用。

### use\_temp\_path

```text
use_temp_path=off
```

**建议设为 off**。默认 `on` 时，响应先写到 `proxy_temp_path`，再**移动**到缓存目录。如果两者不在同一个文件系统，「移动」变成「跨设备复制」——白白多一次完整 IO。

设 off 让 nginx 直接写在缓存目录下的临时文件里，然后原地 rename。

## proxy\_cache

```text
语法:    proxy_cache zone | off;
默认:    proxy_cache off;
上下文:  http, server, location
```

```text
proxy_cache one;   # 引用 keys_zone 里定义的名字
```

**默认关闭**——定义了 `proxy_cache_path` 不等于启用了缓存，还必须在需要的地方写 `proxy_cache`。

## proxy\_cache\_key

```text
语法:    proxy_cache_key string;
默认:    proxy_cache_key $scheme$proxy_host$request_uri;
```

**默认键里没有 `$host`，只有 `$proxy_host`。**

`$proxy_host` 是 [`proxy_pass` 里写的上游名](/manual/tools/nginx/proxy)，不是客户端请求的域名。所以**多个域名共用同一个 upstream 时，它们的缓存会互相串**——`a.example.com/x` 与 `b.example.com/x` 命中同一条缓存。

多域名场景必须改：

```text
proxy_cache_key "$scheme$host$request_uri";
```

内容协商也要进键。若上游按 `Accept-Encoding` 返回不同编码，键里没有它就会把 gzip 版发给不支持的客户端——这与 [HTTP 的 `Vary` 语义](https://daiw.org/manual/http11/content-negotiation)是同一个问题。nginx 会**自动尊重上游的 `Vary` 头**，但如果上游没发 `Vary`，就得自己把维度加进键。

## proxy\_cache\_valid 与优先级链

```text
proxy_cache_valid 200 302 10m;
proxy_cache_valid 404      1m;
proxy_cache_valid any      1m;
```

不写状态码时**只对 200、301、302 生效**：

```text
proxy_cache_valid 5m;   # 等价于 proxy_cache_valid 200 301 302 5m;
```

**缓存时长的优先级链**（官方顺序）：

```text
1. X-Accel-Expires（上游响应头，秒；nginx 私有）
2. Expires 或 Cache-Control（上游响应头）
3. proxy_cache_valid（nginx 配置）
```

**上游的头优先于 nginx 配置。** 所以 `proxy_cache_valid 200 10m;` 未必生效——上游发了 `Cache-Control: no-store` 就不会缓存。

要**强制忽略上游的缓存头**：

```text
proxy_ignore_headers Cache-Control Expires Set-Cookie;
proxy_cache_valid 200 10m;
```

`proxy_ignore_headers Set-Cookie` 要极其小心——忽略它意味着**带 `Set-Cookie` 的响应也会被缓存**，可能把一个用户的会话 Cookie 发给其他用户。只在确认上游不会返回用户相关内容时才用。

## 缓存击穿防护

### proxy\_cache\_lock

```text
语法:    proxy_cache_lock on | off;
默认:    proxy_cache_lock off;
```

**默认关闭**。关闭时，一个热点对象过期的瞬间，所有并发请求会**同时**打到上游——即缓存击穿。

```text
proxy_cache_lock         on;
proxy_cache_lock_timeout 5s;   # 默认 5s
proxy_cache_lock_age     5s;   # 默认 5s，超时后允许第二个请求去回源
```

开启后只有第一个请求回源，其余等待。`lock_age` 是保险丝：第一个请求太慢时放第二个过去，避免全部堵死。

注意 `lock_timeout` 超时后的行为：**该响应不会被缓存**。

### proxy\_cache\_use\_stale

```text
默认:    proxy_cache_use_stale off;
```

```text
proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
```

**上游出问题时继续返回过期内容**——比返回 502 好得多。

`updating` 参数特别重要：**正在更新时，其他请求直接拿旧的**，不必等待。它与 `proxy_cache_lock` 是两种思路（等 vs 用旧的），`updating` 对用户体验更好。

nginx 也支持上游用 [RFC 5861 的 `stale-while-revalidate` / `stale-if-error`](https://daiw.org/manual/http11/caching) 来控制这一行为。

### proxy\_cache\_background\_update

```text
默认:    proxy_cache_background_update off;
```

```text
proxy_cache_use_stale        updating;
proxy_cache_background_update on;
```

**先把过期内容返回给用户，后台异步去更新**。用户永远不等待回源——这是「陈旧但快」优于「新鲜但慢」的典型取舍。

**必须与 `proxy_cache_use_stale updating` 一起配**，单独开不生效。

## proxy\_cache\_revalidate

```text
默认:    proxy_cache_revalidate off;
```

```text
proxy_cache_revalidate on;
```

开启后，缓存过期时发\*\*[条件请求](https://daiw.org/manual/http11/conditional-requests)\*\*（带 `If-None-Match` / `If-Modified-Since`）而不是完整请求。上游若返回 `304`，nginx 直接续期本地副本——**省掉一次完整传输**。

对大文件收益巨大。**建议总是开启**。

## 绕过与不缓存

```text
proxy_cache_bypass $cookie_nocache $arg_nocache $http_pragma;
proxy_no_cache     $cookie_nocache $arg_nocache $http_authorization;
```

两者容易混：

| 指令 | 含义 |
| --- | --- |
| `proxy_cache_bypass` | **不查**缓存（直接回源），但**结果仍会存**进缓存 |
| `proxy_no_cache` | **不存**缓存（可能仍会查） |

**判定规则**：任一参数非空且不等于 `"0"` 就触发。

要「既不查也不存」两个都写。典型用于登录用户：

```text
proxy_cache_bypass $http_authorization;
proxy_no_cache     $http_authorization;
```

这与 [HTTP 缓存对 `Authorization` 的默认约束](https://daiw.org/manual/http11/caching)一致——带凭据的响应默认不该进共享缓存。

## proxy\_cache\_methods

```text
默认:    proxy_cache_methods GET HEAD;
```

**默认只缓存 GET 与 HEAD**，与 [HTTP 的方法可缓存性](https://daiw.org/manual/http11/methods)一致。加 `POST` 需谨慎——POST 不幂等，缓存它需要确信语义安全。

## $upstream\_cache\_status

排查缓存必看的变量，值：

| 值 | 含义 |
| --- | --- |
| `MISS` | 未命中，已回源 |
| `HIT` | 命中 |
| `EXPIRED` | 命中但已过期，已回源 |
| `STALE` | 返回了过期内容（`use_stale` 生效） |
| `UPDATING` | 正在更新，返回了旧的 |
| `REVALIDATED` | 条件请求验证后确认仍有效 |
| `BYPASS` | 被 `proxy_cache_bypass` 绕过 |

调试时加进响应头与日志：

```text
add_header X-Cache-Status $upstream_cache_status always;
log_format cache '$remote_addr [$time_local] "$request" '
                 '$status $body_bytes_sent '
                 'cache=$upstream_cache_status rt=$request_time';
```

## 一份完整缓存配置

```text
http {
    proxy_cache_path /var/cache/nginx
                     levels=1:2
                     keys_zone=web:100m
                     inactive=24h
                     max_size=10g
                     use_temp_path=off;

    server {
        location / {
            proxy_pass http://backend;
            proxy_set_header Host $host;

            proxy_cache     web;
            proxy_cache_key "$scheme$host$request_uri";   # 含 $host

            proxy_cache_valid 200 301 302 1h;
            proxy_cache_valid 404          1m;

            # 击穿防护 + 高可用
            proxy_cache_lock              on;
            proxy_cache_use_stale         error timeout updating
                                          http_500 http_502 http_503 http_504;
            proxy_cache_background_update on;
            proxy_cache_revalidate        on;

            # 登录用户不走缓存
            proxy_cache_bypass $http_authorization $cookie_session;
            proxy_no_cache     $http_authorization $cookie_session;

            add_header X-Cache-Status $upstream_cache_status always;
        }
    }
}
```

下一篇：[压缩与静态文件](/manual/tools/nginx/static-perf)。
