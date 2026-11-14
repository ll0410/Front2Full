---
title: "核心模块指令"
description: "worker 进程与连接、events 块、error_log 八级、user/pid，以及连接数的真实上限。"
source: "https://daiw.org/manual/nginx/core-module"
---

# 核心模块指令

`ngx_core_module` 管的是**进程模型与全局行为**，绝大多数指令只能写在 `main` 上下文。

## worker\_processes

```text
语法:    worker_processes number | auto;
默认:    worker_processes 1;
上下文:  main
```

工作进程数。**默认是 1**——这个默认值在多核机器上严重浪费，几乎所有发行版的默认配置都会改掉它。

`auto` 表示自动等于 CPU 核心数（1.2.5 起）。生产配置基本都写：

```text
worker_processes auto;
```

nginx 是**多进程单线程 + 事件驱动**：一个 master 进程管理若干 worker，每个 worker 单线程跑事件循环。所以 worker 数超过核心数没有意义——它们会互相抢 CPU。

## worker\_connections

```text
语法:    worker_connections number;
默认:    worker_connections 512;
上下文:  events
```

**每个 worker** 能同时打开的最大连接数。默认 512。

理论最大并发连接：

```text
worker_processes × worker_connections
```

但这个数字有两个常被忽略的修正：

**一、反向代理场景要除以 2。** 每个客户端连接会对应一个到上游的连接，两者都占 worker\_connections 名额：

```text
最大并发客户端 ≈ worker_processes × worker_connections / 2
```

**二、受系统文件描述符限制。** 连接就是文件描述符，超过 `ulimit -n` 会报 `Too many open files`，与 nginx 配置无关。

## worker\_rlimit\_nofile

```text
语法:    worker_rlimit_nofile number;
默认:    —
上下文:  main
```

给 worker 进程设置 `RLIMIT_NOFILE`（可打开文件数上限）。**这是上一条的解药**：不必去改系统 `ulimit`，nginx 自己抬高限制。

配置原则：

```text
worker_rlimit_nofile 65535;   # ≥ worker_connections，留出余量给日志、上游连接等
events {
    worker_connections 16384;
}
```

只调 `worker_connections` 不调 `worker_rlimit_nofile` 是常见错误——配置里写着支持 6 万并发，实际到 1024 就开始报 `Too many open files`（多数系统 `ulimit -n` 默认 1024）。

## events 块

```text
语法:    events { ... }
上下文:  main
```

连接处理相关指令的容器。**必需**——没有 `events {}` 块 nginx 起不来。

### use

```text
语法:    use method;
上下文:  events
```

指定连接处理方法（`epoll`、`kqueue`、`select`、`poll`、`eventport` 等）。

**通常不需要写**——nginx 会自动选择当前平台最高效的方法。Linux 上是 `epoll`，BSD/macOS 上是 `kqueue`。手工指定只在调试或特殊平台时有用。

### multi\_accept

```text
语法:    multi_accept on | off;
默认:    multi_accept off;
上下文:  events
```

`on` 时，worker 一次性接受**所有**待处理的新连接；`off` 时一次只接受一个。

高并发短连接场景开启可能降低 accept 开销，但也可能让某个 worker 一口气抢走大量连接造成不均衡。**默认关闭是安全的**，改动前应实测。

### accept\_mutex

```text
语法:    accept_mutex on | off;
默认:    accept_mutex off;
上下文:  events
```

**默认关闭**（1.11.3 起改的默认值）。

它曾经用于解决「惊群」问题——多个 worker 同时被新连接唤醒。现代内核有 `EPOLLEXCLUSIVE`、nginx 也有 `reuseport`，这个互斥锁反而成了瓶颈，所以默认关掉了。

网上大量旧教程仍写着 `accept_mutex on;`。**那是 1.11.3 之前的建议**，现在照抄会降低性能。这类「过期最佳实践」是 nginx 配置里的普遍问题——本专栏所有默认值均以[当前官方文档](/manual/tools/nginx/)为准。

## error\_log

```text
语法:    error_log file [level] [json];
默认:    error_log logs/error.log error;
上下文:  main, http, mail, stream, server, location
```

**八个级别**，官方原文按严重程度递增排列：

> `debug`, `info`, `notice`, `warn`, `error`, `crit`, `alert`, or `emerg` Log levels above are listed in the order of increasing severity.

| 级别 | 含义 |
| --- | --- |
| `debug` | 调试（**需编译时 `--with-debug`**） |
| `info` | 信息 |
| `notice` | 注意 |
| `warn` | 警告 |
| `error` | 错误（**默认**） |
| `crit` | 严重 |
| `alert` | 需立即处理 |
| `emerg` | 紧急 |

**指定某级别 = 记录该级别及更严重的全部**。写 `warn` 会同时记 warn/error/crit/alert/emerg。

要点：

-   **`debug` 需要编译支持**。没带 `--with-debug` 编译的 nginx 写了 `debug` 也只能输出到 `info` 级别。用 `nginx -V` 查编译参数。
-   **`json` 参数**是较新的结构化输出选项，便于日志采集。
-   它可以出现在 `location` 级——不同路径可以有不同的错误日志与级别。
-   特殊值 `error_log /dev/null crit;` 或 `error_log off;`——注意 `off` **不是**关闭日志的标准写法（它会创建一个名为 `off` 的文件），关闭应写 `error_log /dev/null crit;`。

## user

```text
语法:    user user [group];
默认:    user nobody nobody;
上下文:  main
```

worker 进程的运行身份。master 进程以 root 启动（为了绑定特权端口 `<1024`），随后 worker **降权**到这里指定的用户。

省略 group 时用与 user 同名的组。

## pid

```text
语法:    pid file;
默认:    pid logs/nginx.pid;
上下文:  main
```

master 进程 PID 的记录文件。`nginx -s reload` 等信号操作依赖它——文件丢失或路径不对会导致「找不到进程」。

## daemon 与 master\_process

```text
语法:    daemon on | off;          默认: daemon on;
语法:    master_process on | off;  默认: master_process on;
上下文:  main
```

两者都**只用于调试与容器**：

-   `daemon off;`——不后台化，前台运行。**容器里必须这么写**，否则主进程退出容器就停了。
-   `master_process off;`——不起 worker，master 自己处理请求。仅供调试，**生产禁用**。

Docker 镜像的官方启动命令就是：

```text
nginx -g "daemon off;"
```

## worker\_cpu\_affinity

```text
语法:    worker_cpu_affinity cpumask ...;
         worker_cpu_affinity auto [cpumask];
上下文:  main
```

把 worker 绑定到指定 CPU 核心，减少上下文切换与缓存失效。

```text
worker_processes    4;
worker_cpu_affinity 0001 0010 0100 1000;   # 4 个 worker 各绑一核
```

或让 nginx 自动分配：

```text
worker_processes    auto;
worker_cpu_affinity auto;
```

**仅 Linux/FreeBSD 有效**，且只在 CPU 密集或超高并发场景下有可测收益。一般部署不必配。

## 一份最小可用的顶层配置

```text
user              nginx;
worker_processes  auto;
worker_rlimit_nofile 65535;
error_log         /var/log/nginx/error.log warn;
pid               /var/run/nginx.pid;

events {
    worker_connections 16384;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    # ...
}
```

下一篇：[server 与 listen](/manual/tools/nginx/server-listen)。
