---
title: "日志"
description: "log_format 的可用变量、缓冲与条件日志、access_log 的数组继承，以及一份可排障的日志格式。"
source: "https://daiw.org/manual/nginx/logging"
---

# 日志

## access\_log

```text
语法:    access_log path [format [buffer=size] [gzip[=level]]
                          [flush=time] [if=condition]];
         access_log off;
默认:    access_log logs/access.log combined;
上下文:  http, server, location, if in location, limit_except
```

**关闭日志用 `access_log off;`**——注意与 [`error_log`](/manual/tools/nginx/core-module) 不同，后者的 `off` 会被当成文件名。

**`access_log` 是[数组型指令](/manual/tools/nginx/contexts)。** 在 location 里写了一条，server 级的全部失效。

这会造成「某些路径的日志突然不见了」——尤其是为某个 location 单独加日志时，很容易把主日志弄丢。

## log\_format

```text
语法:    log_format name [escape=default|json|none] string ...;
上下文:  http
```

内置的 `combined` 格式：

```text
log_format combined '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent"';
```

这是 Apache combined 格式的复刻，工具链兼容性好，但**信息严重不足**——排查性能问题时它什么也告诉不了你。

### 一份可排障的格式

```text
log_format main escape=json
    '{"time":"$time_iso8601",'
    '"remote_addr":"$remote_addr",'
    '"request":"$request",'
    '"uri":"$request_uri",'
    '"status":$status,'
    '"bytes":$body_bytes_sent,'
    '"referer":"$http_referer",'
    '"ua":"$http_user_agent",'
    '"xff":"$http_x_forwarded_for",'
    '"host":"$host",'
    '"request_time":$request_time,'
    '"upstream_addr":"$upstream_addr",'
    '"upstream_status":"$upstream_status",'
    '"upstream_response_time":"$upstream_response_time",'
    '"upstream_connect_time":"$upstream_connect_time",'
    '"cache":"$upstream_cache_status"}';
```

关键字段的意义：

| 字段 | 为什么要记 |
| --- | --- |
| `$request_uri` | **原始 URI**——`$request` 里的路径会被[内部重定向改写](/manual/tools/nginx/variables) |
| `$request_time` | 总耗时（**含读客户端请求体**） |
| `$upstream_response_time` | 上游耗时。`$request_time` 减它 = nginx + 网络开销 |
| `$upstream_connect_time` | 建连耗时。持续偏高说明上游连接池或网络有问题 |
| `$upstream_addr` | 实际打到哪台。**重试过会是列表** |
| `$upstream_status` | 上游返回码。与 `$status` 不同说明 nginx 做了转换 |
| `$upstream_cache_status` | [缓存命中情况](/manual/tools/nginx/caching) |
| `$http_x_forwarded_for` | 代理链 |

### escape 参数

```text
log_format main escape=json '...';
```

三个值：

| 值 | 行为 |
| --- | --- |
| `default` | 转义 `"`、`\` 与不可见字符为 `\xXX` |
| `json` | 按 **JSON 规则**转义 |
| `none` | **不转义**——危险 |

**输出 JSON 格式的日志必须用 `escape=json`**，否则 User-Agent 里的引号会破坏 JSON 结构，导致整行无法解析。

`escape=none` 允许日志注入——攻击者可以在 URI 或 UA 里塞换行伪造日志行。**不要用**。

## 缓冲与压缩

```text
access_log /var/log/nginx/access.log main buffer=64k flush=5s;
```

| 参数 | 作用 |
| --- | --- |
| `buffer=size` | 攒够这么多再写盘 |
| `flush=time` | 最多攒这么久 |
| `gzip[=level]` | **边写边压缩** |

高流量站点必配缓冲——每条日志一次 `write()` 系统调用是可观的开销。

`gzip` 需要日志文件不被外部程序实时读取（压缩流不可中途追加读）：

```text
access_log /var/log/nginx/access.log.gz main gzip=5 buffer=64k flush=5s;
```

**带缓冲时，日志不是实时的。** 调试时看不到刚发的请求属正常现象——要么等 `flush` 时间到，要么临时去掉 buffer 参数。

## 条件日志

```text
map $status $loggable {
    ~^[23]  0;      # 2xx/3xx 不记
    default 1;
}

access_log /var/log/nginx/error-only.log main if=$loggable;
```

`if=` 的值为空或 `"0"` 时**不记录**。

实用场景：

```text
# 健康检查不污染日志
map $request_uri $log_it {
    /healthz 0;
    /metrics 0;
    default  1;
}
access_log /var/log/nginx/access.log main if=$log_it;
```

高流量下这能显著减少日志量——健康检查往往占了请求数的大头。

## 记录请求体

```text
log_format postdata '$remote_addr [$time_local] "$request" $request_body';
```

`$request_body` 只在请求体**被读进内存**时才有值——即经过了 `proxy_pass`/`fastcgi_pass` 且没有写进临时文件。大请求体会是空的。

**记录请求体有隐私与合规风险**：密码、令牌、个人信息都会进日志。只在调试时临时开启，且注意日志文件的访问权限与保留期。

## syslog

```text
access_log syslog:server=10.0.0.1:514,facility=local7,tag=nginx,severity=info main;
error_log  syslog:server=unix:/dev/log,tag=nginx warn;
```

日志送 syslog 而非本地文件，适合集中式日志采集。支持 UDP、TCP（`server=` 前加 `tcp:`）与本地 UNIX 套接字。

## 轮转

nginx **不自带日志轮转**，靠外部工具（logrotate）+ 信号：

```text
postrotate
    /bin/kill -USR1 $(cat /var/run/nginx.pid)
endscript
```

`USR1` 让 nginx **重新打开日志文件**。流程是：logrotate 先 `mv` 走旧文件（nginx 仍持有其 fd，继续写），再发 `USR1`，nginx 关闭旧 fd 打开新文件。

**漏发 `USR1` 会导致 nginx 一直往被 `mv` 走（甚至已删除）的文件里写**——表现是新日志文件永远是空的，磁盘却在涨。这是日志轮转的经典故障。

`logrotate` 的 `copytruncate` 选项可以避免这个问题（复制后清空原文件），但会在复制窗口内丢日志，且对大文件开销高。**优先用 `USR1` 方案**。

## 完整配置

```text
http {
    log_format main escape=json
        '{"time":"$time_iso8601","remote_addr":"$remote_addr",'
        '"method":"$request_method","uri":"$request_uri",'
        '"status":$status,"bytes":$body_bytes_sent,'
        '"rt":$request_time,"urt":"$upstream_response_time",'
        '"uaddr":"$upstream_addr","cache":"$upstream_cache_status",'
        '"host":"$host","ua":"$http_user_agent","xff":"$http_x_forwarded_for"}';

    map $request_uri $log_it {
        /healthz 0;
        default  1;
    }

    access_log /var/log/nginx/access.log main
               buffer=64k flush=5s if=$log_it;
    error_log  /var/log/nginx/error.log warn;
}
```

下一篇：[rewrite、return 与 if](/manual/tools/nginx/rewrite)。
