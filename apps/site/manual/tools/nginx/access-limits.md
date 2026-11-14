---
title: "访问控制与限流"
description: "allow/deny 的顺序语义、auth_basic 与 auth_request、漏桶限流的 burst/nodelay 与连接数限制。"
source: "https://daiw.org/manual/nginx/access-limits"
---

# 访问控制与限流

## allow / deny

```text
语法:    allow address | CIDR | unix: | all;
         deny  address | CIDR | unix: | all;
上下文:  http, server, location, limit_except
```

```text
location /admin/ {
    allow 192.168.1.0/24;
    allow 10.0.0.1;
    deny  all;
}
```

**按书写顺序自上而下匹配，第一条命中即生效。** 所以 `deny all;` 必须写在最后——写在前面会把后面的 `allow` 全废掉。

拒绝时返回 **`403`**。

**`allow`/`deny` 判断的是 `$remote_addr`——即直连 nginx 的对端地址。**

nginx 前面有 CDN 或负载均衡时，`$remote_addr` 是**那台代理的 IP**，不是真实用户 IP。此时基于 IP 的访问控制会**全部失效**（要么全放行要么全拒绝）。

解法是 `ngx_http_realip_module`：

```text
set_real_ip_from 10.0.0.0/8;        # 信任的代理网段
real_ip_header   X-Forwarded-For;
real_ip_recursive on;
```

它会按信任列表从 `X-Forwarded-For` 中还原真实 IP 并**改写 `$remote_addr`**。

`set_real_ip_from` **必须精确列出可信代理**——写成 `0.0.0.0/0` 等于让任何人都能伪造自己的 IP。这与 [HTTP 转发字段的安全模型](https://daiw.org/manual/http11/proxy-fields)是同一条原则。

## limit\_except

```text
location /upload/ {
    limit_except GET HEAD {
        allow 192.168.1.0/24;
        deny  all;
    }
}
```

**语义是反的**：限制**除了**列出方法之外的所有方法。上面表示 GET/HEAD 任何人可用，其他方法（POST/PUT/DELETE）只允许内网。

注意 `GET` 会**自动包含 `HEAD`**（[HTTP 语义上 HEAD 是 GET 的无体版本](https://daiw.org/manual/http11/methods)）。

## auth\_basic

```text
语法:    auth_basic string | off;      默认: off
         auth_basic_user_file file;
上下文:  http, server, location, limit_except
```

```text
location /private/ {
    auth_basic           "Restricted Area";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

那个字符串是 [`WWW-Authenticate` 挑战里的 `realm`](https://daiw.org/manual/http11/authentication)，会显示在浏览器弹窗里。

密码文件用 `htpasswd` 生成（支持 `bcrypt`、`apr1`、crypt）：

```text
htpasswd -B -c /etc/nginx/.htpasswd alice
```

[Basic 认证的 Base64 不是加密](https://daiw.org/manual/http11/authentication)——**必须在 TLS 上使用**，否则等于明文传密码。

嵌套 location 里要关掉继承的认证，用 `auth_basic off;`。

## auth\_request

```text
location /private/ {
    auth_request /auth;
    proxy_pass   http://backend;
}

location = /auth {
    internal;
    proxy_pass              http://auth-service/verify;
    proxy_pass_request_body off;              # 不转发请求体
    proxy_set_header        Content-Length "";
    proxy_set_header        X-Original-URI $request_uri;
}
```

（需 `--with-http_auth_request_module`）

把鉴权**委托给一个子请求**：

| 子请求返回 | nginx 行为 |
| --- | --- |
| `2xx` | 放行 |
| `401` / `403` | 拒绝，原样返回该状态 |
| 其他 | `500` |

要点：

-   **`internal;`** 让 `/auth` 只能被内部子请求访问，外部直接请求返回 404。
-   **`proxy_pass_request_body off`** 避免把请求体（可能很大）也发给鉴权服务。
-   用 `auth_request_set` 把鉴权服务返回的信息传给上游：

```text
auth_request_set $user $upstream_http_x_user;
proxy_set_header X-User $user;
```

这是把 SSO/OAuth 网关接进 nginx 的标准模式。

## limit\_req：漏桶限流

```text
语法:    limit_req_zone key zone=name:size rate=rate [sync];
上下文:  http

语法:    limit_req zone=name [burst=number] [nodelay | delay=number];
上下文:  http, server, location
```

```text
http {
    limit_req_zone $binary_remote_addr zone=one:10m rate=10r/s;

    server {
        location /api/ {
            limit_req zone=one burst=20 nodelay;
        }
    }
}
```

官方明确说明用的是 **漏桶（leaky bucket）** 算法。

### key 用 $binary\_remote\_addr

**不要用 `$remote_addr`**——它是点分十进制字符串（IPv4 最多 15 字节），而 `$binary_remote_addr` 是**二进制形式**（IPv4 仅 4 字节）。同样的 zone 大小能存更多状态。

zone 容量（官方给的数字）：

| 平台 | 每状态 | 每 MB 状态数 |
| --- | --- | --- |
| 32 位 | 64 字节 | 约 **16000** |
| 64 位 | 128 字节 | 约 **8000** |

所以 `zone=one:10m` 在 64 位上约存 8 万个 IP。**zone 满了新请求会被拒绝**（返回 `503`），且会记 error 日志。

### rate

```text
rate=10r/s;    # 每秒 10 个
rate=30r/m;    # 每分钟 30 个 = 0.5r/s
```

`r/m` 用于低频限制——`rate=1r/m` 比 `rate=0.016r/s` 好写得多（后者也不合法）。

nginx 内部按**毫秒**粒度平滑：`10r/s` 实际是「每 100ms 允许 1 个」，而不是「每秒开头放 10 个」。

### burst 与 nodelay

这是最需要理解的一对：

| 配置 | 行为 |
| --- | --- |
| `limit_req zone=one;` | 严格 10r/s，**超出立即 503** |
| `limit_req zone=one burst=20;` | 超出的排队**延迟处理**，队列满 20 才 503 |
| `limit_req zone=one burst=20 nodelay;` | 超出的**立即处理**不排队，但仍占用桶容量 |
| `limit_req zone=one burst=20 delay=10;` | 前 10 个立即处理，第 11–20 个延迟，超过 20 拒绝 |

**没有 `burst` 时限流极其严酷**：页面加载会同时发几十个请求，10r/s 会把绝大部分打成 503。真实场景基本都要配 `burst`。

**`nodelay` 通常是想要的**：允许突发但维持长期平均速率。不加 `nodelay` 时请求会被**人为延迟**，用户感觉是「网站变慢」而不是「被限流」。

### 状态码与日志

```text
limit_req_status    503;      默认
limit_req_log_level error;    默认（延迟的记低一级 = warn）
```

**建议改成 429**——[`429 Too Many Requests`](https://daiw.org/manual/http11/status-4xx) 才是语义正确的限流状态码，`503` 表示「服务不可用」会误导客户端与监控：

```text
limit_req_status 429;
```

### 干跑模式

```text
limit_req_dry_run on;
```

**只统计不拦截**。上线新限流规则前先干跑一段时间，配合 `$limit_req_status` 变量观察会拦掉多少：

```text
log_format limit '$remote_addr "$request" limit=$limit_req_status';
```

`$limit_req_status` 取值：`PASSED`、`DELAYED`、`REJECTED`、`DELAYED_DRY_RUN`、`REJECTED_DRY_RUN`。

## limit\_conn：并发连接数

```text
limit_conn_zone $binary_remote_addr zone=perip:10m;
limit_conn_zone $server_name        zone=perserver:10m;

server {
    limit_conn perip     10;    # 每 IP 最多 10 个并发连接
    limit_conn perserver 1000;  # 本站总共最多 1000
}
```

与 `limit_req` 的区别：**限的是「同时打开的连接数」而非「请求速率」**。对下载站、流媒体更合适。

`limit_conn_status` 同样建议改 `429`。

## limit\_rate：带宽限速

```text
location /download/ {
    limit_rate      500k;      # 每连接 500 KB/s
    limit_rate_after 10m;      # 前 10 MB 不限速
}
```

`limit_rate_after` 很实用：**小文件全速，大文件才限速**——既保证网页体验又防止大文件占满带宽。

注意限的是**每个连接**，一个客户端开 5 个连接就能拿到 5 倍带宽——要配合 `limit_conn` 使用。

可以用变量动态限速：

```text
map $http_user_agent $rate {
    default        1m;
    ~*bot          100k;
}
limit_rate $rate;
```

## 组合示例

```text
http {
    limit_req_zone  $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone  $binary_remote_addr zone=login:10m rate=1r/m;
    limit_conn_zone $binary_remote_addr zone=conn:10m;

    limit_req_status  429;
    limit_conn_status 429;

    server {
        # 还原真实 IP（前面有 CDN 时必需）
        set_real_ip_from 10.0.0.0/8;
        real_ip_header   X-Forwarded-For;
        real_ip_recursive on;

        limit_conn conn 20;

        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
        }

        # 登录接口严格限流，防撞库
        location = /login {
            limit_req zone=login burst=3;
            proxy_pass http://backend;
        }

        location /admin/ {
            allow 10.0.0.0/8;
            deny  all;
            auth_basic           "Admin";
            auth_basic_user_file /etc/nginx/.htpasswd;
            proxy_pass http://backend;
        }

        location /download/ {
            limit_rate       1m;
            limit_rate_after 10m;
        }
    }
}
```

下一篇：[日志](/manual/tools/nginx/logging)。
