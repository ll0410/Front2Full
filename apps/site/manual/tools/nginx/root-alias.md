---
title: "root、alias 与 try_files"
description: "拼接 vs 替换的本质差异、alias 的尾斜杠陷阱、try_files 的三种回退目标与无限循环。"
source: "https://daiw.org/manual/nginx/root-alias"
---

# root、alias 与 try_files

## root：拼接

```text
语法:    root path;
默认:    root html;
上下文:  http, server, location, if in location
```

**把 URI 追加到 root 值后面**：

```text
location /i/ {
    root /data/w3;
}
```

请求 `/i/top.gif` → 文件路径 `/data/w3` + `/i/top.gif` = **`/data/w3/i/top.gif`**

注意 URI 里的 `/i/` **保留在最终路径里**。

## alias：替换

```text
语法:    alias path;
上下文:  location
```

**把 URI 中匹配 location 的那部分替换成 alias 值**：

```text
location /i/ {
    alias /data/w3/images/;
}
```

请求 `/i/top.gif` → `/i/` 被替换成 `/data/w3/images/` = **`/data/w3/images/top.gif`**

`alias` 的上下文**只有 `location`**——它的语义依赖「匹配掉的那一段」，在 server 级没有意义。

## 一张表说清区别

|  | `root` | `alias` |
| --- | --- | --- |
| 行为 | 路径 = root + **完整 URI** | 路径 = alias + **URI 去掉 location 前缀** |
| 上下文 | http, server, location, if | **仅 location** |
| location 段是否保留 | **保留** | **丢弃** |

```text
location /images/ {
    root  /data/w3;          # → /data/w3/images/top.gif
}
location /images/ {
    alias /data/w3/images/;  # → /data/w3/images/top.gif
}
```

两者结果相同——此时官方明确建议用 `root`：

> When location matches the last part of the directive's value \[…\] it is **better to use the `root` directive instead**.

**location 段与目标目录末段同名时用 `root`**，更简洁也更不易错。

## alias 的尾斜杠陷阱

这是 `alias` 最经典的坑：

```text
location /i/ {
    alias /data/w3/images;    # ← 少了结尾的 /
}
```

请求 `/i/top.gif` → `/data/w3/images` + `top.gif` = **`/data/w3/imagestop.gif`**

路径被拼成了一坨。

**规则：`location` 以 `/` 结尾时，`alias` 也必须以 `/` 结尾。** 两者的尾斜杠要么都有，要么都没有。

`root` 则相反——**`root` 的值不应该带尾斜杠**（带了通常也能工作，因为 URI 本身以 `/` 开头，但会产生 `//` 这样的双斜杠路径）。

### alias 与正则 location

`alias` 在正则 location 里必须用捕获组显式构造完整路径：

```text
location ~ ^/users/(.+\.(?:gif|jpe?g|png))$ {
    alias /data/w3/images/$1;
}
```

正则 location 没有「固定前缀」可以替换，所以 `alias` 的值必须自己拼出完整路径。

## try\_files

```text
语法:    try_files file ... uri;
         try_files file ... =code;
上下文:  server, location
```

官方描述：

> Checks the existence of files in the **specified order** and uses the **first found** file for request processing; the processing is performed **in the current context**. The path to a file is constructed from the `file` parameter according to the `root` and `alias` directives. It is possible to **check directory's existence by specifying a slash at the end** of a name, e.g. `$uri/`. If none of the files were found, an **internal redirect** to the `uri` specified in the **last parameter** is made.

四个要点：

1.  **按顺序**找，用**第一个存在**的。
2.  路径按当前的 `root`/`alias` 构造。
3.  **末尾加 `/` 表示检查目录**（`$uri/`）。
4.  **最后一个参数是回退目标**，不是待检查的文件。

### 三种回退目标

```text
# 1. 回退到另一个 URI（内部重定向）
location /images/ {
    try_files $uri /images/default.gif;
}

# 2. 回退到状态码
location / {
    try_files $uri $uri/index.html $uri.html =404;
}

# 3. 回退到命名 location
location / {
    try_files $uri $uri/ @drupal;
}
```

三种形式都来自官方示例。

### 最常见的两个用法

**静态站 / SPA**：

```text
location / {
    try_files $uri $uri/ /index.html;
}
```

先找实体文件 → 找目录 → 都没有就交给 `/index.html`（前端路由接管）。

**动态应用**：

```text
location / {
    try_files $uri $uri/ @backend;
}
location @backend {
    proxy_pass http://app;
}
```

### 无限循环陷阱

```text
location / {
    try_files $uri $uri/ /index.php;
}

location ~ \.php$ {
    try_files $uri =404;         # ← 这一行是必需的
    fastcgi_pass 127.0.0.1:9000;
}
```

如果 `.php` 的 location 里**没有** `try_files $uri =404;`，而 `/index.php` 又不存在，就会：`/foo` → 回退 `/index.php` → 匹配 php location → 文件不存在但仍转给 FastCGI → 上游返回错误 → 可能再触发回退……

更直接的循环是回退目标本身会再次落到同一个 location：

```text
location / {
    try_files $uri $uri/ /index.html;   # 若 /index.html 不存在
}
```

`/index.html` 不存在时，内部重定向到 `/index.html`，又匹配 `location /`，又回退……nginx 会检测到并返回 **`500`**，错误日志里是 `rewrite or internal redirection cycle`。

**回退目标必须真实存在，或者是 `=code` / 命名 location。** 这是避免循环最简单的规则。

nginx 有内部重定向次数上限（10 次），超过即 `500` 并记录 `rewrite or internal redirection cycle while internally redirecting to "..."`。看到这条日志就去查 try\_files 的最后一个参数。

## index

```text
语法:    index file ...;
默认:    index index.html;
上下文:  http, server, location
```

请求以 `/` 结尾时依次尝试的索引文件：

```text
index index.html index.htm index.php;
```

与 `try_files $uri/` 的关系：`$uri/` 检查**目录是否存在**，`index` 决定**目录下返回哪个文件**。两者配合：

```text
location / {
    index      index.html;
    try_files  $uri $uri/ =404;
}
```

请求 `/docs/` → `$uri` 不是文件 → `$uri/` 是目录，存在 → 由 `index` 决定返回 `/docs/index.html`。

`index` 触发的是**内部重定向**——它会让请求重新走一遍 location 匹配。所以 `/docs/` 最终可能命中的是 `location ~ \.html$` 而不是原来的 `location /`。这在配置分路径缓存策略时会造成意外。

## autoindex

```text
语法:    autoindex on | off;
默认:    autoindex off;
上下文:  http, server, location
```

目录列表。**默认关闭**，开启前想清楚是否要暴露目录结构。

## 完整示例

```text
server {
    root /var/www/site;          # server 级默认
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源：root 拼接，路径含 /assets/
    location ^~ /assets/ {
        # 文件在 /var/www/site/assets/...
        expires 30d;
    }

    # 下载区在别处：必须用 alias，注意两边尾斜杠
    location /downloads/ {
        alias /mnt/storage/public/;
        autoindex on;
    }

    # 正则 alias：必须用捕获组拼完整路径
    location ~ ^/thumbs/(.+\.(?:png|jpg))$ {
        alias /var/cache/thumbs/$1;
    }
}
```

下一篇：[变量](/manual/tools/nginx/variables)。
