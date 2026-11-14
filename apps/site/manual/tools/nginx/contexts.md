---
title: "指令、上下文与继承"
description: "值继承与数组继承的本质区别、add_header 覆盖陷阱，以及 1.29.3 起的 add_header_inherit。"
source: "https://daiw.org/manual/nginx/contexts"
---

# 指令、上下文与继承

这是 nginx 配置**误配率最高**的一章。绝大多数「配了但没生效」都出在继承规则上。

## 两种继承语义

nginx 的指令继承分成截然不同的两类：

| 类型 | 行为 | 例子 |
| --- | --- | --- |
| **值型** | 内层覆盖外层的**那一个值** | `root`、`client_max_body_size`、`keepalive_timeout` |
| **数组型** | 内层**只要定义了任何一条**，外层的**全部**失效 | `add_header`、`proxy_set_header`、`access_log`、`gzip_types` |

值型很直观。**数组型是坑的来源。**

## 数组型继承：全有或全无

`add_header` 的官方原文：

> These directives are inherited from the previous configuration level **if and only if there are no `add_header` directives defined on the current level**.

「当且仅当当前层级**没有任何** `add_header`」才继承。翻译成后果：

```text
server {
    add_header X-Frame-Options   SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header Strict-Transport-Security "max-age=31536000";

    location /api/ {
        add_header X-Api-Version 2;   # ← 只加了这一条
    }
}
```

**`/api/` 下那三个安全头全部消失**，只剩 `X-Api-Version`。

这不是 bug，是明确定义的行为。但它在真实场景里造成过大量安全头缺失——因为「我只是在 location 里加了个头」看起来完全无害。

### 传统解法：重复声明

1.29.3 之前唯一的办法是把外层的全部抄进内层：

```text
location /api/ {
    add_header X-Frame-Options   SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header Strict-Transport-Security "max-age=31536000";
    add_header X-Api-Version 2;
}
```

丑陋且易漏。常见变通是把公共头抽到一个文件用 `include` 引入每个 location。

### 新解法：add\_header\_inherit（1.29.3 起）

```text
语法:    add_header_inherit on | off | merge;
默认:    add_header_inherit on;
上下文:  http, server, location
```

`merge` 让内层的 `add_header` **与外层合并**而不是覆盖：

```text
server {
    add_header_inherit merge;          # ← 1.29.3+
    add_header X-Frame-Options SAMEORIGIN;

    location /api/ {
        add_header X-Api-Version 2;    # 现在两个头都有
    }
}
```

这是较新的指令，用前确认版本：`nginx -v`。低于 1.29.3 时它会导致**启动失败**（unknown directive），而不是被忽略——所以不能用它做「新版生效、旧版降级」的兼容写法。

## proxy\_set\_header 同理

```text
server {
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;

    location /special/ {
        proxy_set_header X-Special 1;   # ← 上面三条全没了
    }
}
```

后果比 `add_header` 更严重：上游收不到 `Host`（会退回 `proxy_pass` 里的值）与 `X-Forwarded-For`，可能直接导致上游路由错误或[取不到真实客户端 IP](https://daiw.org/manual/http11/proxy-fields)。

`proxy_set_header` **没有**对应的 `_inherit` 开关，仍需重复声明或 include。

## 上下文层级速查

```text
main
├── events                     连接处理方式
├── http
│   ├── (http 级指令)          全站默认
│   ├── upstream               上游组
│   ├── map / geo / split_clients
│   ├── server
│   │   ├── (server 级指令)    单站默认
│   │   ├── location
│   │   │   ├── (location 级)  单路径
│   │   │   ├── location       嵌套 location
│   │   │   └── if             ← 有坑，见 rewrite 章
│   │   └── if
│   └── ...
├── stream                     TCP/UDP，与 http 平级
│   ├── upstream
│   └── server
└── mail
```

**`stream` 与 `http` 是平级的两套世界**：指令不通用、变量不通用、模块不通用（`ngx_stream_proxy_module` ≠ `ngx_http_proxy_module`）。

## 「上下文」那一行必须看

官方每条指令的元信息第三行是允许的上下文。举例：

```text
语法:    add_header name value [always];
上下文:  http, server, location, if in location
```

注意 `if in location` 与 `if` 是**不同**的上下文标注——前者只允许写在 location 内部的 `if` 里，不能写在 server 级的 `if` 里。这类细微差别在文档里是精确的。

## 查看最终生效值

推理继承容易出错，直接看展开结果最可靠：

```text
nginx -T
```

它输出**所有 include 展开后的完整配置**。想确认某个 location 实际继承到什么，比读源配置靠谱得多。

## 一条实践建议

数组型指令**尽量只在一个层级定义**。要么全放 `http`，要么全放 `server`，避免跨层级混用。需要分路径差异化时，用 `include` 把公共部分做成片段：

```text
# /etc/nginx/snippets/security-headers.conf
add_header X-Frame-Options SAMEORIGIN;
add_header X-Content-Type-Options nosniff;
```

```text
location /api/ {
    include /etc/nginx/snippets/security-headers.conf;
    add_header X-Api-Version 2;
}
```

下一篇：[nginx 如何处理请求](/manual/tools/nginx/request-processing)——server 与 location 的选择规则。
