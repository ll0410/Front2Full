---
title: "Nginx 配置详解"
description: "以官方文档为准，逐指令讲清语法、取值、上下文、继承规则与常见误配。"
source: "https://daiw.org/manual/nginx"
---

# Nginx 配置详解

> 内容来源：[daiw.org](https://daiw.org/manual/nginx) · 作者 David · 原文更新于 2026-11-06

本专栏**逐指令**解析 nginx 配置：每条指令的语法、默认值、可用上下文、取值含义，以及配错时会发生什么。

不讲「nginx 是什么」，不讲安装教程，只讲**配置文件里的每一行到底是什么意思**。

## 版本基准

以 [nginx.org 官方文档](https://nginx.org/en/docs/)为准，快照于 **2026-11-06**：

| 分支 | 版本 | 说明 |
| --- | --- | --- |
| **stable** | **1.30.6** | 生产推荐。第二段是**偶数**，只收高危修复，不加新特性 |
| **mainline** | **1.31.8** | 活跃开发分支，新特性先进这里。第二段是**奇数** |

nginx 的版本号规则与多数项目相反：**偶数是稳定分支，奇数是主线**。`1.30.x` 稳定、`1.31.x` 主线。官方实际推荐多数场景用 mainline——它包含全部修复且质量长期稳定，stable 只是变更更保守。

本专栏标注指令时会注明「x.y.z 起可用」，遇到较新特性会提示所需版本。

## 文档怎么读

nginx 官方文档按**模块**组织，每个模块一页，页内列出该模块的全部指令。三类模块：

| 前缀 | 数量 | 作用域 |
| --- | --- | --- |
| `ngx_core_module` 等 | 4 | 主上下文与全局 |
| `ngx_http_*` | 80+ | HTTP 处理 |
| `ngx_stream_*` | 20+ | TCP/UDP 代理 |
| `ngx_mail_*` | 7 | 邮件代理 |

每条指令在文档里都有固定的三行元信息，本专栏沿用这个格式：

```text
语法:    directive_name value [value...];
默认:    directive_name default;
上下文:  http, server, location
```

**「上下文」是最容易被忽略却最重要的一行**——它决定这条指令能写在哪，写错位置轻则不生效，重则 nginx 起不来。

## 阅读顺序

-   **第 0 部分 · 基础**——配置语法、指令与上下文、继承规则、请求处理流程。**必读**，后面所有章节都建立在这四篇之上。
-   **第 1 部分 · 核心指令**——`ngx_core_module`、server 与 listen、location 匹配、root/alias/try\_files、变量。
-   **第 2 部分 · 代理与上游**——proxy、upstream 负载均衡、FastCGI/uWSGI/gRPC。
-   **第 3 部分 · TLS 与协议**——ssl 模块、HTTP/2 与 HTTP/3。
-   **第 4 部分 · 性能**——缓存、压缩、静态文件与连接调优。
-   **第 5 部分 · 访问控制**——access/auth、限流限速。
-   **第 6 部分 · 日志与重写**——log\_format、rewrite/return/if、map/geo。
-   **第 7 部分 · stream 与收尾**——TCP/UDP 代理、常见误配速查。

从 [配置文件语法](/manual/tools/nginx/config-syntax) 开始。

## 与站内其他专栏的关系

配置里大量出现 HTTP 概念（`Host`、`ETag`、`Cache-Control`、`Range`、`Connection`）。不清楚这些字段的精确语义时，回查：

-   [《HTTP/1.1 协议详解》](https://daiw.org/manual/http11)——字段语义、状态码、缓存与条件请求。
-   [《HTTP/2 与 HTTP/3 协议详解》](https://daiw.org/manual/http2-3)——`listen ... http2` / `quic` 背后的协议差异。
