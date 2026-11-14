---
title: "变量"
description: "$uri 与 $request_uri 的关键差异、$host 的三级回退、动态变量族与求值时机。"
source: "https://daiw.org/manual/nginx/variables"
---

# 变量

变量是 nginx 配置里唯一的「数据」。用错变量是仅次于[继承](/manual/tools/nginx/contexts)与 [location](/manual/tools/nginx/location) 的第三大错误源。

## `$uri` vs `$request_uri`

最重要的一对，官方定义：

> **`$uri`** — current URI in request, **normalized**. The value of `$uri` **may change during request processing**, e.g. when doing internal redirects, or when using index files.
> 
> **`$request_uri`** — **full original** request URI (**with arguments**)

|  | `$uri` | `$request_uri` |
| --- | --- | --- |
| 是否含查询串 | **否** | **是** |
| 是否归一化 | **是**（解码 `%XX`、合并 `//`、消解 `.`/`..`） | **否**，原样 |
| 处理中是否变化 | **会变**（内部重定向、index） | **不变** |

对请求 `GET /a//b/../c.html?x=1`：

```text
$uri          = /a/c.html          归一化，无参数
$request_uri  = /a//b/../c.html?x=1  原始，含参数
```

**重定向时该用哪个？**

```text
return 301 https://$host$request_uri;   # ✅ 保留查询参数与原始形式
return 301 https://$host$uri;           # ❌ 丢掉 ?x=1
```

HTTP→HTTPS 跳转必须用 `$request_uri`，否则所有带查询参数的请求都会丢参数。这是极高频的误配。

反过来，做**路径判断**时要用 `$uri`——它已归一化，不会被 `//`、`%2e%2e` 这类编码绕过。用 `$request_uri` 做安全判断存在绕过风险。

`$document_uri` 是 `$uri` 的别名，二者完全相同。

## $host 的三级回退

官方定义写得很精确：

> **in this order of precedence**: host name from the **request line**, or host name from the **"Host" request header** field, or the **server name** matching a request

```text
1. 请求行里的主机名（absolute-form 请求，见 HTTP/1.1 请求行）
2. Host 请求头
3. 匹配到的 server_name
```

关键推论：**`$host` 永远有值**（最差回退到 `server_name`），而 `$http_host` 是**原样的 Host 头**，可能为空。

| 变量 | 来源 | 可能为空 | 是否含端口 |
| --- | --- | --- | --- |
| `$host` | 三级回退，**小写** | 否 | **否** |
| `$http_host` | Host 头原样 | **是** | **是**（如果客户端发了） |
| `$server_name` | 匹配到的 server\_name | 否 | 否 |

`$host` 会**转小写并去掉端口**，`$http_host` 不会。做重定向时用 `$host` 更安全。

## 动态变量族

三个「前缀 + 名字」的变量族，可以取任意字段：

| 形式 | 取什么 | 例 |
| --- | --- | --- |
| `$http_名字` | **请求**头 | `$http_user_agent`、`$http_x_forwarded_for` |
| `$sent_http_名字` | **响应**头 | `$sent_http_content_type` |
| `$arg_名字` | 查询参数 | `$arg_page`（对应 `?page=2`） |
| `$cookie_名字` | Cookie | `$cookie_session` |

**转换规则**：字段名转小写，`-` 换成 `_`。`X-Forwarded-For` → `$http_x_forwarded_for`。

另有 `$upstream_http_名字`（上游响应头）等，见[代理章节](/manual/tools/nginx/proxy)。

## 常用变量速查

### 请求

| 变量 | 官方定义 |
| --- | --- |
| `$request_method` | request method, usually `GET` or `POST` |
| `$scheme` | request scheme, `http` or `https` |
| `$https` | `on` if connection operates in SSL mode, or an **empty string** otherwise |
| `$args` / `$query_string` | arguments in the request line（两者相同） |
| `$is_args` | `?` if a request line has arguments, or an **empty string** otherwise |
| `$remote_addr` | client address |
| `$remote_port` | client port |
| `$remote_user` | user name supplied with the Basic authentication |

注意 **`$https` 在非 TLS 时是空串而不是 `off`**——判断时应写 `if ($https = "")` 或直接用 `$scheme`。

`$is_args` 专门配合拼接使用：

```text
rewrite ^ /new$is_args$args;   # 有参数才带 ?
```

### 路径

| 变量 | 官方定义 |
| --- | --- |
| `$request_filename` | file path for the current request, based on the `root` or `alias` directives, and the request URI |
| `$document_root` | `root` or `alias` directive's value for the current request |
| `$realpath_root` | absolute pathname \[…\] **with all symbolic links resolved** |

`$realpath_root` 与 `$document_root` 的区别就是**符号链接是否解析**。给 PHP-FPM 传 `DOCUMENT_ROOT` 时，用哪个取决于应用是否依赖真实路径（OPcache 在符号链接部署下常需要 `$realpath_root`）。

### 服务端与响应

| 变量 | 官方定义 |
| --- | --- |
| `$server_name` | name of the server which accepted a request |
| `$server_port` | port of the server which accepted a request |
| `$hostname` | host name（**机器主机名**，不是请求的） |
| `$status` | response status（1.3.2, 1.2.2 起） |
| `$body_bytes_sent` | number of bytes sent to a client, **not counting the response header** |
| `$request_time` | request processing time in seconds with a **milliseconds resolution**（1.3.9, 1.2.6 起）; time elapsed since the **first bytes were read from the client** |

`$hostname` 是**运行 nginx 那台机器的主机名**，与请求内容无关。想要请求的主机名用 `$host`。这两个名字太像，容易写错。

`$request_time` 的计时起点是**读到客户端第一个字节**——包含了读请求体的时间。所以慢客户端上传大文件会让这个值很大，但那不是服务端慢。区分服务端耗时要看 `$upstream_response_time`（见[代理章节](/manual/tools/nginx/proxy)）。

## 变量的求值时机

nginx 变量是**惰性求值**的：用到才算，且多数会缓存本次请求的结果。

两个实际影响：

**一、`$uri` 在内部重定向后会变。** [`try_files`](/manual/tools/nginx/root-alias)、`index`、`rewrite` 都会改写 `$uri`。所以日志里记的 `$uri` 可能不是客户端请求的那个——日志要记原始路径应该用 `$request_uri`。

**二、`map` 定义的变量在首次使用时才计算。** 见 [map 与 geo](/manual/tools/nginx/map-geo)。

## 自定义变量

`set` 指令（属于 `ngx_http_rewrite_module`）：

```text
set $my_var "value";
set $combined "$host$request_uri";
```

注意它的执行时机受 rewrite 阶段影响，详见 [rewrite 与 if](/manual/tools/nginx/rewrite)。

## 一个综合例子

```text
# HTTP → HTTPS：必须用 $request_uri
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name example.com;

    # 按查询参数分流
    location /search {
        if ($arg_debug = "1") {
            return 403;
        }
        proxy_pass http://backend;
    }

    # 传给上游的标准头
    location /api/ {
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass http://backend;
    }
}
```

`$proxy_add_x_forwarded_for` 来自 proxy 模块——它是「原有 `X-Forwarded-For` 头 + `$remote_addr`」的拼接，正是[逐跳追加](https://daiw.org/manual/http11/proxy-fields)的实现。

下一篇：[proxy 反向代理](/manual/tools/nginx/proxy)。
