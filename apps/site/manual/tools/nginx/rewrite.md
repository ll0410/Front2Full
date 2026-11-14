---
title: "rewrite、return 与 if"
description: "四个 flag 的精确差异、rewrite 阶段的执行时机、「if is evil」的真实含义与安全替代。"
source: "https://daiw.org/manual/nginx/rewrite"
---

# rewrite、return 与 if

`ngx_http_rewrite_module` 提供 `rewrite`、`return`、`set`、`if`、`break` 五条指令。它们**不是按书写顺序简单执行的**——理解「rewrite 阶段」是用对它们的前提。

## return

```text
语法:    return code [text];
         return code URL;
         return URL;
上下文:  server, location, if
```

**最简单也最该优先用的一条**：

```text
return 301 https://$host$request_uri;    # 永久重定向
return 404;                              # 状态码
return 200 "OK\n";                       # 状态码 + 文本
return 444;                              # nginx 私有：直接断连
```

`return` **立即终止处理**，不再执行后续指令。

带文本时可以指定类型：

```text
location = /healthz {
    default_type text/plain;
    return 200 "ok\n";
}
```

**能用 `return` 就不要用 `rewrite`。** 它更快（无正则匹配）、语义更明确、没有阶段陷阱。

域名跳转的正确写法：

```text
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;   # ✅
}
```

而不是：

```text
rewrite ^(.*)$ https://$host$1 permanent;   # ❌ 更慢，且丢查询参数需另处理
```

`301`/`302`/`303`/`307`/`308` 的语义差别见 [HTTP 3xx 章节](https://daiw.org/manual/http11/status-3xx)——尤其注意 `301`/`302` 会改写方法而 `307`/`308` 不会。

## rewrite

```text
语法:    rewrite regex replacement [flag];
上下文:  server, location, if
```

```text
rewrite ^/old/(.*)$ /new/$1 last;
```

### 四个 flag

| flag | 行为 |
| --- | --- |
| （无） | 继续执行**后续 rewrite 指令** |
| `last` | **停止当前 rewrite 集，用新 URI 重新搜索 location** |
| `break` | **停止当前 rewrite 集，不重新搜索 location** |
| `redirect` | 返回 **302** 临时重定向 |
| `permanent` | 返回 **301** 永久重定向 |

**`last` 与 `break` 的区别是全篇最关键的一点**：

```text
last   → 改写 URI → 回到 location 匹配阶段，重新找 location
break  → 改写 URI → 留在当前 location 继续处理
```

```text
location /a/ {
    rewrite ^/a/(.*)$ /b/$1 last;    # 会去匹配 location /b/
}
location /a/ {
    rewrite ^/a/(.*)$ /b/$1 break;   # 留在 location /a/ 里，用新 URI 取文件
}
```

**`last` 有循环风险。** 每次 `last` 都会重新走一遍 location 匹配，规则写得不好会无限循环。nginx 的内部重定向上限是 **10 次**，超过返回 `500` 并记录：

```text
rewrite or internal redirection cycle while processing "/xxx"
```

这与 [`try_files` 的循环](/manual/tools/nginx/root-alias)是同一个计数器。

`replacement` 以 `http://`、`https://`、`$scheme` 开头时，**自动变成重定向**（不需要写 flag）：

```text
rewrite ^/old$ https://example.com/new;   # 自动 302
```

### 查询参数的处理

```text
rewrite ^/old/(.*)$ /new/$1;        # 原查询串会被自动附加
rewrite ^/old/(.*)$ /new/$1?;       # 结尾的 ? 丢弃原查询串
```

**默认会保留原查询参数**。结尾加 `?` 才丢弃。

## rewrite 阶段的执行时机

这是理解一切诡异行为的钥匙。nginx 处理请求分多个阶段，rewrite 模块的指令在 **`server` 级的 rewrite 阶段**与 **`location` 级的 rewrite 阶段**执行：

```text
1. server 级 rewrite 指令        ← 此时还没选 location！
2. location 匹配
3. location 级 rewrite 指令
4. try_files / index
5. 内容生成（proxy_pass / root 等）
```

由此推出两条重要结论：

**一、server 级的 `rewrite` 在 location 选择之前执行。** 所以它改写的 URI 会影响后续 location 匹配——这是它的正确用途。

**二、`set` 也在 rewrite 阶段。** 所以下面这段的行为可能反直觉：

```text
location / {
    set $x "A";
    return 200 $x;      # 输出 A
}
```

但如果 `set` 写在 `if` 里，就要小心了。

## if is evil

nginx 官方 wiki 有一篇著名的 [If Is Evil](https://www.nginx.com/resources/wiki/start/topics/depth/ifisevil/)。核心结论：

> **在 `location` 内部，`if` 只有用于 `return` 和 `rewrite ... last` 时是 100% 安全的。**

其他用法可能产生不可预期的行为。

### 为什么

`if` 会创建一个**隐式的嵌套 location**，配置继承与执行顺序变得难以推理。经典反例：

```text
location /x/ {
    set $a 1;
    if ($request_method = POST) {
        set $a 2;
    }
    if ($http_x_test) {
        set $a 3;        # 两个 if 都成立时，结果未必是你想的
    }
    return 200 $a;
}
```

更危险的是与 `proxy_pass` 混用：

```text
location /x/ {
    proxy_pass http://backend;
    if ($http_x_flag) {
        add_header X-Flag 1;   # ← 这会让 proxy_pass 失效或行为异常
    }
}
```

`if` 块内没有 `proxy_pass`，请求进了 if 创建的隐式 location 后**可能找不到内容处理器**，导致返回空响应或 404。

### 安全用法

```text
# ✅ 安全：if + return
if ($request_method = POST) {
    return 405;
}

# ✅ 安全：if + rewrite ... last
if ($http_user_agent ~* "bot") {
    rewrite ^ /bot-page last;
}

# ❌ 危险：if + 其他任何指令
if ($x) {
    proxy_pass ...;    # 不要
    add_header ...;    # 不要
    set ...;           # 尽量不要
}
```

### 替代方案

大多数 `if` 都能用 [`map`](/manual/tools/nginx/map-geo) 替代：

```text
# ❌ if
if ($http_user_agent ~* "(bot|spider)") {
    set $is_bot 1;
}

# ✅ map（在 http 上下文，无副作用）
map $http_user_agent $is_bot {
    default          0;
    ~*(bot|spider)   1;
}
```

`map` 在 `http` 上下文定义，**惰性求值、无执行顺序问题**，是 nginx 里表达条件逻辑的正确工具。

按方法路由用 `limit_except` 或独立 location：

```text
location /api/ {
    limit_except GET { deny all; }
    proxy_pass http://backend;
}
```

## set

```text
语法:    set $variable value;
上下文:  server, location, if
```

```text
set $backend "http://app1";
set $combined "$host$request_uri";
```

在 rewrite 阶段执行。可以引用其他变量。

注意它**不能覆盖内置变量**（如 `$uri`、`$args` 部分可写，多数只读）。

## break

```text
语法:    break;
上下文:  server, location, if
```

单独的 `break` 指令停止执行**当前 rewrite 指令集**，与 `rewrite ... break` 的效果相同但不改写 URI。

## 常见场景写法

```text
# 1. HTTP → HTTPS：用 return
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name example.com www.example.com;

    # 2. www → 裸域：用 if + return（安全用法）
    if ($host = www.example.com) {
        return 301 https://example.com$request_uri;
    }

    # 3. 旧路径迁移：server 级 rewrite，影响后续 location 匹配
    rewrite ^/blog/(.*)$ /posts/$1 permanent;

    # 4. 内部改写：break 留在当前 location
    location /files/ {
        rewrite ^/files/(.*)$ /storage/$1 break;
        root /var/data;
    }

    # 5. 条件逻辑：用 map 不用 if
    location /api/ {
        proxy_pass http://$backend_pool;
    }
}

map $http_x_canary $backend_pool {
    default  "stable";
    "1"      "canary";
}
```

下一篇：[map、geo 与 split\_clients](/manual/tools/nginx/map-geo)。
