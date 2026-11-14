---
title: "location 匹配规则"
description: "五种修饰符、「记住最长前缀再试正则」的两阶段算法、^~ 与 = 的短路，以及嵌套 location。"
source: "https://daiw.org/manual/nginx/location"
---

# location 匹配规则

`location` 的匹配算法与 [`server_name` 的四级优先级](/manual/tools/nginx/request-processing)**完全不同**，是 nginx 配置里第二大混淆源。

## 语法

```text
语法:    location [ = | ~ | ~* | ^~ ] uri { ... }
         location $variable { ... }
         location @name { ... }
上下文:  server, location
```

六种形式：

| 修饰符 / 形式 | 含义 |
| --- | --- |
| （无） | **前缀**匹配 |
| `=` | **精确**匹配 |
| `~` | 正则，**区分**大小写 |
| `~*` | 正则，**不分**大小写 |
| `^~` | 前缀匹配，且**命中后不再试正则** |
| `$variable` | **谓词 location**（1.31.5 起），运行时求值非空且非 `"0"` 即命中 |
| `@name` | **命名 location**，只能内部跳转，不匹配外部请求 |

## 匹配算法

官方原文是理解这套规则的唯一可靠依据：

> To find location matching a given request, nginx **first checks locations defined using the prefix strings** (prefix locations). Among them, the location with the **longest matching prefix is selected and remembered**. Then **regular expressions are checked, in the order of their appearance** in the configuration file. The search of regular expressions **terminates on the first match**, and the corresponding configuration is used. **If no match with a regular expression is found** then the configuration of the prefix location **remembered earlier** is used.

拆成步骤：

```text
1. 遍历所有【前缀】location，找出匹配且【最长】的那个 → 记住它（先不用）
2. 按【配置文件中出现的顺序】逐个试【正则】location
3. 第一个匹配的正则 → 用它，结束
4. 没有正则匹配 → 用第 1 步记住的前缀 location
```

**核心要点：前缀比「长度」，正则比「顺序」。** 前缀 location 在配置里的书写顺序完全不影响结果；正则 location 的顺序则决定一切。

## 两个短路规则

### `^~` —— 前缀命中就不试正则

> If the longest matching prefix location has the `^~` modifier then **regular expressions are not checked**.

```text
location ^~ /images/ {
    root /data;
}

location ~* \.(gif|jpg|png)$ {
    expires 30d;
}
```

请求 `/images/logo.png`：前缀 `^~ /images/` 是最长匹配且带 `^~` → **直接用它，正则块被跳过**，`expires 30d` 不生效。

典型用途：静态资源目录要整体走一套配置，不希望被后面的通用正则截走。

### `=` —— 精确匹配立即结束

> Also, using the `=` modifier it is possible to define an **exact match** of URI and location. If an exact match is found, **the search terminates**.

```text
location = / {
    # 只匹配 "/"，不匹配 "/index.html"
}
```

`=` 是**最快**的：命中即停，连「记住最长前缀」那一步都省了。高频且路径固定的端点（`/`、`/health`、`/favicon.ico`）用它能省下遍历开销。

## 完整优先级

综合起来：

```text
1. location = /exact          精确匹配 → 命中即停
2. location ^~ /prefix/       最长前缀且带 ^~ → 命中即停（跳过正则与谓词）
3. location ~ /regex          正则，按【配置顺序】，第一个命中即停
   location ~* /regex
4. location $predicate        谓词 location（1.31.5+），按【配置顺序】，第一个非空且非 "0" 即停
5. location /prefix           最长前缀（前面都没命中时的兜底）
```

注意第 2 与第 4 的关系：**`^~` 参与的是同一轮「最长前缀」竞争**。它不是「优先级更高的前缀」，而是「如果我赢了最长前缀，就别再试正则」。

```text
location ^~ /a/    { }      # 前缀长度 3
location    /a/b/  { }      # 前缀长度 5 ← 更长，这个赢
```

请求 `/a/b/c` 命中的是 `/a/b/`（更长），`^~` 的短路效果不生效，正则照常被试。

## 命名 location

```text
location / {
    try_files $uri $uri/ @backend;
}

location @backend {
    proxy_pass http://app_servers;
}
```

`@name` **不参与请求匹配**，只能被 [`try_files`](/manual/tools/nginx/root-alias)、`error_page` 等指令内部跳转过来。用于把「兜底逻辑」抽出来复用。

## 嵌套 location

```text
location /api/ {
    proxy_pass http://backend;

    location /api/v1/legacy/ {
        proxy_pass http://legacy_backend;
    }
}
```

`location` 的上下文是 `server, location`——**可以嵌套**。嵌套的 location 只在外层匹配成功后才参与匹配。

嵌套主要用于组织结构，性能上与平铺没有本质差别。**注意继承规则**：嵌套 location 会从外层 location 继承配置，[数组型指令的覆盖问题](/manual/tools/nginx/contexts)同样适用。

## 一个完整例子

```text
server {
    # 1. 精确：命中即停，最快
    location = / {
        return 200 "home\n";
    }

    # 2. ^~ 前缀短路：静态资源整体接管，不被下面的正则截走
    location ^~ /static/ {
        root    /var/www;
        expires 30d;
    }

    # 3. 正则：按顺序试。这个在前，先匹配
    location ~* \.(js|css)$ {
        expires 7d;
    }

    # 4. 正则：上面没中才轮到这个
    location ~* \.(png|jpg|gif)$ {
        expires 30d;
    }

    # 5. 前缀：兜底
    location / {
        try_files $uri $uri/ @app;
    }

    location @app {
        proxy_pass http://backend;
    }
}
```

对照几个请求：

| 请求 | 命中 | 原因 |
| --- | --- | --- |
| `/` | 1 | 精确匹配 |
| `/index.html` | 5 | 精确不中；前缀最长是 `/`；无正则匹配 |
| `/static/app.js` | 2 | `^~ /static/` 最长前缀 + 短路，**正则 3 被跳过** |
| `/assets/app.js` | 3 | 前缀最长是 `/`；正则 3 先命中 |
| `/img/a.png` | 4 | 正则 3 不中，正则 4 中 |

**注意 `/static/app.js` 那行**——直觉上「js 文件应该走正则 3」，但 `^~` 让它停在了 2。这正是 `^~` 的意义，也是它容易造成意外的地方。

## 调试

不确定命中哪个 location 时，最直接的办法是在每个块里加标记：

```text
location ^~ /static/ {
    add_header X-Debug-Location "static" always;
}
```

或者开 `error_log ... debug;`（需[编译带 `--with-debug`](/manual/tools/nginx/core-module)），日志里会打印完整的 location 选择过程。

下一篇：[root、alias 与 try\_files](/manual/tools/nginx/root-alias)。
