---
title: "proxy 反向代理"
description: "proxy_pass 带不带 URI 的本质区别、默认 Host 的坑、缓冲与超时、proxy_next_upstream 的重试语义。"
source: "https://daiw.org/manual/nginx/proxy"
---

# proxy 反向代理

## proxy\_pass 的斜杠之争

这是 nginx 配置里**最著名**的一个坑。官方规则原文：

> If the `proxy_pass` directive is specified **with a URI**, then when a request is passed to the server, the part of a **normalized request URI matching the location is replaced** by a URI specified in the directive.

一句话：**带 URI 就替换，不带 URI 就透传**。

### 带 URI（含末尾 `/`）→ 替换

```text
location /name/ {
    proxy_pass http://127.0.0.1/remote/;
}
```

```text
请求 /name/test  →  上游收到 /remote/test
     ^^^^^^ 被替换成 /remote/
```

### 不带 URI → 透传

```text
location /some/path/ {
    proxy_pass http://127.0.0.1;
}
```

```text
请求 /some/path/test  →  上游收到 /some/path/test
     完整 URI 原样传过去
```

**判断标准是「proxy\_pass 里主机后面有没有路径」，不是「有没有斜杠」这么简单：**

| 写法 | 是否带 URI | 效果 |
| --- | --- | --- |
| `proxy_pass http://backend;` | **否** | 透传完整 URI |
| `proxy_pass http://backend/;` | **是**（URI 是 `/`） | `/name/test` → `/test` |
| `proxy_pass http://backend/api/;` | 是 | `/name/test` → `/api/test` |

**`http://backend;` 与 `http://backend/;` 行为完全不同**——后者那个孤零零的 `/` 就是一个 URI，会把 location 前缀吃掉。这一个字符的差别造成过无数 404。

### 三种不能带 URI 的情况

官方明确列出：

-   **正则 location** 与**命名 location**——必须用不带 URI 的形式。
-   **`rewrite ... break` 之后**——指令里的 URI 被忽略，传的是改写后的完整 URI。
-   **proxy\_pass 里含变量时**——指定的 URI 原样传递，替换原 URI。

```text
# 正则 location：不能带 URI
location ~ ^/api/(.*)$ {
    proxy_pass http://backend;      # ✅
    # proxy_pass http://backend/$1; ← 含变量，行为又不同
}
```

含变量时行为特殊，且**变量形式不会做上游组解析**（后面 upstream 章会讲），慎用。

## Host 头默认值的坑

官方给的默认：

```text
proxy_set_header Host       $proxy_host;
proxy_set_header Connection close;
```

**默认传给上游的 `Host` 是 `$proxy_host`**——即 `proxy_pass` 里写的那个主机名，**不是客户端请求的 Host**。

后果：上游若按 [Host 做虚拟主机路由](/manual/tools/nginx/request-processing)，会全部落到默认站点；应用生成的绝对 URL 也会带错域名。

**所以几乎所有反代配置的第一行都是**：

```text
proxy_set_header Host $host;
```

HTTP/2 与 gRPC 场景下，`:authority` 伪头默认同样用 `$proxy_host`；若显式设置了 `proxy_set_header Host` 或 `grpc_set_header Host`，则将其值写入 `:authority`（1.31.4 起不再同时附带冗余的 `Host` 头）。见 [HTTP/2 伪头](https://daiw.org/manual/http2-3/h2-pseudo-headers)。

## 标准转发头四件套

```text
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

`$proxy_add_x_forwarded_for` = **原有 `X-Forwarded-For` 值 + `,` \+ `$remote_addr`**，实现[逐跳追加](https://daiw.org/manual/http11/proxy-fields)。

**边缘节点应该覆写而不是追加。** 最外层 nginx 直接面对公网时，客户端可以自己伪造 `X-Forwarded-For`，追加会把伪造值留在最左边。边缘应写：

```text
proxy_set_header X-Forwarded-For $remote_addr;   # 覆写，丢弃客户端自带的
```

只有在**内层**（前面确定有可信代理）才用 `$proxy_add_x_forwarded_for`。详见 [HTTP 代理字段的安全模型](https://daiw.org/manual/http11/proxy-fields)。

别忘了[数组型继承](/manual/tools/nginx/contexts)：任何一个内层 location 写了 `proxy_set_header`，这四条全失效。

## proxy\_http\_version

```text
语法:    proxy_http_version 1.0 | 1.1;
默认:    proxy_http_version 1.1;    ← 1.29.7 起
上下文:  http, server, location
```

**默认值在 1.29.7 改了**：原先是 `1.0`，现在是 `1.1`。

网上几乎所有教程都会告诉你「用 upstream keepalive 必须手动写 `proxy_http_version 1.1;`」——那是针对旧默认值的建议。新版本已经不必，但**显式写上仍然无害**，且对旧版本部署是必要的。

配合 [upstream keepalive](/manual/tools/nginx/upstream) 时还需要清掉 `Connection` 头：

```text
proxy_http_version 1.1;
proxy_set_header   Connection "";
```

因为默认会发 `Connection: close`，与长连接冲突。

## proxy\_buffering

```text
语法:    proxy_buffering on | off;
默认:    proxy_buffering on;
上下文:  http, server, location
```

| 状态 | 行为 |
| --- | --- |
| `on`（默认） | nginx **先把上游响应完整读进缓冲**，再发给客户端 |
| `off` | 收到多少**同步转发**多少 |

缓冲的价值：**快速释放上游连接**。慢客户端下载时，上游不必陪着等——nginx 已经把数据收下来了。这对后端是宝贵的保护。

缓冲区配置：

```text
proxy_buffer_size   4k;      # 存响应头的那块（默认 4k|8k）
proxy_buffers       8 4k;    # 存响应体（默认 8 个 4k|8k）
proxy_busy_buffers_size 8k;
```

超出缓冲的部分写**临时文件**（`proxy_max_temp_file_size`、`proxy_temp_file_write_size` 控制）。

**什么时候要关掉**：SSE、流式响应、长轮询、大文件实时转发——这些场景缓冲会让数据卡在 nginx 里不下发。

```text
location /events {
    proxy_pass       http://backend;
    proxy_buffering  off;
    proxy_cache      off;
}
```

上游也可以用响应头 `X-Accel-Buffering: no` 单次关闭缓冲，无需改 nginx 配置。

## 超时三兄弟

| 指令 | 默认 | 含义 |
| --- | --- | --- |
| `proxy_connect_timeout` | **60s** | 与上游**建立连接** |
| `proxy_send_timeout` | **60s** | 两次**写**操作之间 |
| `proxy_read_timeout` | **60s** | 两次**读**操作之间 |

**`proxy_read_timeout` 不是「响应总时长上限」**，而是「两次读之间的最大间隔」。上游只要持续有数据流出，跑一小时也不会超时；反之上游思考 61 秒再吐第一个字节就会 `504`。

官方另有一条限制：`proxy_connect_timeout` 通常**不能超过 75 秒**（受系统 TCP 连接超时约束）。

慢接口（大报表、AI 推理）需要调大 `proxy_read_timeout`：

```text
location /slow-api/ {
    proxy_pass         http://backend;
    proxy_read_timeout 300s;
}
```

## proxy\_next\_upstream

```text
语法:    proxy_next_upstream error | timeout | invalid_header |
                             http_500 | http_502 | http_503 | http_504 |
                             http_403 | http_404 | http_429 |
                             non_idempotent | off ...;
默认:    proxy_next_upstream error timeout;
上下文:  http, server, location
```

**默认只在 `error` 与 `timeout` 时换下一台**。500/502/503 默认**不重试**——想要就显式加：

```text
proxy_next_upstream error timeout http_502 http_503 http_504;
```

三条重要语义：

**一、`http_403` / `http_404` 永不算失败尝试。** 即使列出来触发换机，也不会计入该上游的失败次数（不影响 `max_fails`）。

**二、`non_idempotent`（1.9.13+）才会重试 POST。** 默认**不重试非幂等方法**——这与 [HTTP 的幂等性语义](https://daiw.org/manual/http11/methods)一致。加上它意味着你接受重复提交的风险，必须有幂等键兜底。

**三、已经开始给客户端发数据就不能重试。** 官方原话：request can only be retried if **nothing sent to client yet**。

限制重试规模：

```text
proxy_next_upstream_tries   3;    # 默认 0 = 不限
proxy_next_upstream_timeout 10s;  # 默认 0 = 不限
```

**默认不限次数**意味着上游全挂时会把所有机器试一遍——生产建议设个上限。

## 上游相关变量

| 变量 | 含义 |
| --- | --- |
| `$upstream_addr` | 实际连的上游地址（重试过会是逗号/冒号分隔的列表） |
| `$upstream_status` | 上游返回的状态码 |
| `$upstream_response_time` | **上游**响应耗时 |
| `$upstream_connect_time` | 建连耗时 |
| `$upstream_cache_status` | 缓存命中状态，见[缓存章](/manual/tools/nginx/caching) |
| `$upstream_http_名字` | 上游响应头 |

把它们记进[日志](/manual/tools/nginx/logging)是排查性能问题的基础——`$request_time` 减去 `$upstream_response_time` 就是 nginx 自身与网络的开销。

## 一份完整反代配置

```text
upstream backend {
    server 10.0.0.1:8080;
    server 10.0.0.2:8080;
    keepalive 32;
}

server {
    listen 443 ssl;
    http2  on;
    server_name api.example.com;

    location / {
        proxy_pass http://backend;

        proxy_http_version 1.1;
        proxy_set_header   Connection "";

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $remote_addr;    # 边缘：覆写
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 5s;
        proxy_read_timeout    60s;

        proxy_next_upstream       error timeout http_502 http_503;
        proxy_next_upstream_tries 2;
    }

    location /events {
        proxy_pass      http://backend;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

下一篇：[upstream 负载均衡](/manual/tools/nginx/upstream)。
