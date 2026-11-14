---
title: "HTTP/2 与 HTTP/3"
description: "http2 指令取代 listen 参数、QUIC 的双 listen 与 Alt-Svc、quic_gso 与 0-RTT 的前置条件。"
source: "https://daiw.org/manual/nginx/http2-http3"
---

# HTTP/2 与 HTTP/3

协议本身的差异见[《HTTP/2 与 HTTP/3 协议详解》](https://daiw.org/manual/http2-3)，本章只讲怎么配。

## HTTP/2

```text
语法:    http2 on | off;
默认:    http2 off;
上下文:  http, server
```

```text
server {
    listen 443 ssl;
    http2  on;              # ← 新写法
    # listen 443 ssl http2; # ← 旧写法，已废弃
}
```

[前面提过](/manual/tools/nginx/server-listen)：**`listen ... http2` 参数已被官方标记为废弃**（1.25.1 起分离出独立指令）。

两点差异：

-   旧写法是**端口级**的：同端口上所有 server 一起开关。
-   新指令上下文是 `http, server`，可**按 server 独立配置**。

旧写法目前仍工作，但新配置应该用 `http2 on;`。

浏览器只在 TLS 上用 HTTP/2（靠 ALPN 协商），所以实际上 `http2 on` 总是与 `listen ... ssl` 搭配。明文 h2c 浏览器不支持，[官方也已废弃 h2c 升级机制](https://daiw.org/manual/http2-3/h2-overview)。

### 常用调优

| 指令 | 作用 |
| --- | --- |
| `http2_max_concurrent_streams` | 并发流上限，对应 [`SETTINGS_MAX_CONCURRENT_STREAMS`](https://daiw.org/manual/http2-3/h2-settings-priority) |
| `http2_recv_buffer_size` | 接收缓冲 |
| `http2_chunk_size` | 响应体分块大小 |

`http2_max_concurrent_streams` 是防 [Rapid Reset（CVE-2023-44487）](https://daiw.org/manual/http2-3/h2-framing)一类流洪泛的关键——nginx 有默认值（128），但高危环境可调低。

**`http2_push` 相关指令已随[服务端推送废弃](https://daiw.org/manual/http2-3/h2-server-push)而移除**。浏览器已全面移除推送支持，配了也不生效。要优化关键资源加载请改用 `103 Early Hints` + `Link: rel=preload`。

另外，**1.31.7 起 HTTP/2 优先级调度已切换为 [RFC 9218 可扩展优先级方案](https://daiw.org/manual/http2-3/h2-settings-priority)**：握手中默认发送 `SETTINGS_NO_RFC7540_PRIORITIES = 1`，忽略旧的 RFC 7540 依赖树帧，改按 `Priority` 请求头、`PRIORITY_UPDATE` 帧以及上游返回的 `Priority` 响应头合并调度。

## HTTP/3 / QUIC

```text
语法:    http3 on | off;
默认:    http3 on;            ← 注意默认是 on
上下文:  http, server
```

`http3` 指令**默认就是 on**——但它只控制「协商时是否接受 HTTP/3」，真正让 QUIC 生效的是 `listen ... quic`。

### 双 listen

官方给的标准配置：

```text
server {
    listen 8443 quic reuseport;   # UDP，QUIC
    listen 8443 ssl;              # TCP，HTTP/1.1 + HTTP/2

    http2 on;
    ssl_certificate     ...;
    ssl_certificate_key ...;

    add_header Alt-Svc 'h3=":8443"; ma=86400';
}
```

四个要点：

**一、必须两条 listen。** QUIC 跑在 **UDP** 上，普通 HTTPS 跑 TCP——两个不同的套接字。同端口号但协议不同，不冲突。

**二、官方建议用同一个端口号。** 注释原文是 `Use same port for HTTP/3 and HTTPS for better compatibility`——不同端口会让 `Alt-Svc` 通告变复杂，且部分网络环境下非 443 的 UDP 更容易被拦。

**三、`reuseport` 写在 quic 那条上**，且同 address:port [只能写一次](/manual/tools/nginx/server-listen)。

**四、必须发 `Alt-Svc`。** 这是[服务发现](https://daiw.org/manual/http2-3/h3-connection)的唯一途径——客户端不会凭空知道你支持 h3。

```text
add_header Alt-Svc 'h3=":443"; ma=86400';
```

`ma` 是通告有效期（秒）。**首次访问一定走 TCP**，客户端记下通告后**下次**才尝试 QUIC。想消除这一跳需要配 [DNS HTTPS 记录](https://daiw.org/manual/http2-3/h3-connection)（RFC 9460），那是 DNS 侧的事，nginx 管不了。

别忘了 `add_header` 的[继承覆盖问题](/manual/tools/nginx/contexts)——某个 location 里加了别的头，`Alt-Svc` 就没了，h3 也就不会被发现。

### TLS 1.3 是硬前提

QUIC **内建 TLS 1.3**，所以：

```text
ssl_protocols TLSv1.2 TLSv1.3;    # 默认值已包含 1.3，够用
```

若显式禁掉 TLS 1.3，QUIC 直接不可用。

### quic\_gso

```text
语法:    quic_gso on | off;
默认:    quic_gso off;
上下文:  http, server
```

启用 **UDP 分段卸载**（`UDP_SEGMENT`）批量发包，**仅 Linux 且内核支持**时有效。

这是针对 [HTTP/3 的 CPU 开销问题](https://daiw.org/manual/http2-3/h3-overview)的优化——UDP 路径的每包开销远高于 TCP，GSO 能把多个包合并成一次系统调用。高流量场景值得开，但**要实测**：内核/网卡不支持时可能反而出问题。

### quic\_retry

```text
语法:    quic_retry on | off;
默认:    quic_retry off;
上下文:  http, server
```

启用 QUIC **地址验证**（Retry 包 + token）。

作用是防 **放大攻击**——攻击者伪造源 IP 发小包，让服务器向受害者发大量数据。开启后服务器会先要求客户端证明自己确实在那个地址上，代价是多一个 RTT。

公网暴露的服务建议开启。

### 0-RTT 的前置条件

官方特别注明：

> 0-RTT support requires **OpenSSL 3.5.1+** or BoringSSL/LibreSSL/QuicTLS. Before NGINX 1.29.1, 0-RTT could not be enabled with OpenSSL regardless of the `ssl_early_data` directive value.

**历史上用 OpenSSL 编译的 nginx，`ssl_early_data on;` 对 QUIC 完全无效**——不报错，就是不生效。这个坑很隐蔽：配置看着对，抓包发现从来没有 0-RTT。

条件：nginx ≥ 1.29.1 **且** OpenSSL ≥ 3.5.1（或用 BoringSSL/QuicTLS 编译）。

`nginx -V` 可以看编译时链接的 TLS 库。

即便可用，也请先读 [0-RTT 的重放风险](/manual/tools/nginx/ssl)——默认关闭是有道理的。

### http3\_hq

```text
语法:    http3_hq on | off;
默认:    http3_hq off;
```

HTTP/0.9-over-QUIC，**仅用于 QUIC 互操作性测试**。生产环境不要碰。

## 完整配置

```text
server {
    # TCP：HTTP/1.1 + HTTP/2
    listen 443 ssl;
    listen [::]:443 ssl;
    http2  on;

    # UDP：HTTP/3
    listen 443 quic reuseport;
    listen [::]:443 quic;
    http3  on;

    server_name example.com;

    ssl_certificate     /etc/ssl/fullchain.pem;
    ssl_certificate_key /etc/ssl/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    quic_retry on;
    # quic_gso on;        # Linux 上实测后再开

    # 必须：告诉客户端有 h3
    add_header Alt-Svc 'h3=":443"; ma=86400' always;
}
```

**防火墙记得放行 UDP 443**——这是 h3 上不去最常见的原因，且现象是「静默回退到 TCP」，不报任何错。

## 验证

```text
curl -sI --http3 https://example.com | head -1
```

```text
curl -sI --http2 https://example.com | head -1
```

浏览器 DevTools 的 Network 面板加一列 Protocol，能看到 `h3` / `h2` / `http/1.1`。

**必须保留 HTTP/2 与 HTTP/1.1 回退。** 部分企业网络与运营商限制 UDP，只开 h3 会让这些用户完全无法访问——详见[迁移注意事项](https://daiw.org/manual/http2-3/migration-notes)。上面的双 listen 配置天然满足这一点。

下一篇：[缓存](/manual/tools/nginx/caching)。
