---
title: "SSL/TLS 配置"
description: "证书链、协议与套件的默认值、会话复用三件套、OCSP stapling 与 0-RTT 重放风险。"
source: "https://daiw.org/manual/nginx/ssl"
---

# SSL/TLS 配置

## 证书与私钥

```text
语法:    ssl_certificate file;
         ssl_certificate_key file;
上下文:  http, server
```

```text
ssl_certificate     /etc/ssl/example.crt;
ssl_certificate_key /etc/ssl/example.key;
```

官方说明的两个要点：

-   **`ssl_certificate` 里可以包含中间证书**——按「服务器证书 → 中间 CA」的顺序拼在同一个文件里。**顺序错了会导致部分客户端验证失败**。
-   私钥也可以放进同一个文件（不推荐，权限管理更麻烦）。

缺中间证书是最常见的证书问题：浏览器往往能自动补全（AIA fetching）所以你看着正常，但 curl、Java 客户端、移动端会直接失败。

可以配置**多组证书**以同时支持 RSA 与 ECDSA：

```text
ssl_certificate     /etc/ssl/ecdsa.crt;
ssl_certificate_key /etc/ssl/ecdsa.key;
ssl_certificate     /etc/ssl/rsa.crt;
ssl_certificate_key /etc/ssl/rsa.key;
```

nginx 按客户端能力自动选。ECDSA 握手更快、证书更小，但老客户端只认 RSA。

## ssl\_protocols

```text
语法:    ssl_protocols [SSLv2] [SSLv3] [TLSv1] [TLSv1.1] [TLSv1.2] [TLSv1.3];
默认:    ssl_protocols TLSv1.2 TLSv1.3;
上下文:  http, server
```

**默认已经是 `TLSv1.2 TLSv1.3`**——现代 nginx 不需要手动禁用旧协议了。

网上大量教程写着 `ssl_protocols TLSv1 TLSv1.1 TLSv1.2;`，那是十年前的配置，照抄反而**开启了已废弃的 TLS 1.0/1.1**（两者已被 RFC 8996 正式弃用）。

TLS 1.3 的价值见 [HTTP/3 与 QUIC 章节](https://daiw.org/manual/http2-3/quic-transport)：握手 1-RTT、会话恢复 0-RTT。

## ssl\_ciphers 与 ssl\_prefer\_server\_ciphers

```text
语法:    ssl_ciphers ciphers;
默认:    ssl_ciphers HIGH:!aNULL:!MD5;
上下文:  http, server

语法:    ssl_prefer_server_ciphers on | off;
默认:    ssl_prefer_server_ciphers off;
上下文:  http, server
```

默认套件 `HIGH:!aNULL:!MD5` 已经排除了匿名与 MD5，对多数场景够用。

`ssl_prefer_server_ciphers` **默认 off**。历史上建议开启（让服务端决定套件优先级，防止客户端选弱套件），但在 **TLS 1.3 时代这条建议已过时**——TLS 1.3 的套件全部安全，且客户端更清楚自己的硬件加速能力（有 AES-NI 就选 AES，没有就选 ChaCha20）。

**只跑 TLS 1.3 时保持 off 即可**；仍需支持 TLS 1.2 且面对老客户端时可以开。

## 会话复用三件套

TLS 完整握手很贵（2 RTT + 非对称运算）。三个指令控制复用：

```text
ssl_session_cache    off | none | [builtin[:size]] [shared:name:size];
默认: none                          ← 默认不缓存!

ssl_session_timeout  time;
默认: 5m

ssl_session_tickets  on | off;
默认: on
```

**`ssl_session_cache` 默认是 `none`——即默认不做服务端会话缓存。** 这是个「默认值不适合生产」的典型例子。

标准生产配置：

```text
ssl_session_cache   shared:SSL:10m;   # 所有 worker 共享，约 4 万会话
ssl_session_timeout 1d;               # 默认 5m 太短
```

必须用 **`shared`**——`builtin` 是每 worker 独立的 OpenSSL 内置缓存，多 worker 时命中率极低。

`ssl_session_tickets`（RFC 5077）**默认开启**，是无状态的复用方式——会话状态加密后交给客户端保管。

关于 ticket 的安全争议：ticket 密钥若长期不轮换，会削弱前向安全性（拿到密钥可解密历史流量）。nginx 会自动轮换内存中的密钥，但**多台 nginx 之间不同步**——负载均衡后面的多实例需要用 `ssl_session_ticket_key` 显式共享密钥文件并定期轮换。

## OCSP stapling

```text
ssl_stapling         on | off;      默认: off
ssl_stapling_verify  on | off;      默认: off
ssl_trusted_certificate file;
```

```text
ssl_stapling         on;
ssl_stapling_verify  on;
ssl_trusted_certificate /etc/ssl/chain.pem;
resolver 1.1.1.1 8.8.8.8 valid=300s;
```

**作用**：由 nginx 代客户端去查证书吊销状态（OCSP），把响应「钉」在握手里一起发。客户端不必自己再发一次 OCSP 查询——省一次往返，也避免了客户端向 CA 暴露访问行为。

三个易错点：

1.  **需要 `resolver`**——nginx 要自己去访问 CA 的 OCSP 服务器，没有 DNS 解析器就静默失败。
2.  **`ssl_trusted_certificate` 需要包含完整链**（含根证书）才能验证 OCSP 响应。
3.  **首次请求不会有 stapling**——nginx 是异步获取的，第一个握手时还没拿到。

验证是否生效：

```text
openssl s_client -connect example.com:443 -status < /dev/null 2>&1 | grep -A2 "OCSP Response Status"
```

## ssl\_early\_data（0-RTT）

```text
语法:    ssl_early_data on | off;
默认:    ssl_early_data off;
上下文:  http, server
```

TLS 1.3 的 0-RTT：复用会话时**第一个包就带应用数据**，省掉一个 RTT。

**默认关闭是对的。0-RTT 数据可被重放。**

攻击者截获 0-RTT 数据后可以重复发送，服务端无法区分。对 `GET` 无所谓，对 `POST /transfer` 就是重复转账。

开启时必须配合幂等性防护——见 [HTTP 的 `425 Too Early`](https://daiw.org/manual/http11/status-4xx) 与 [QUIC 0-RTT 章节](https://daiw.org/manual/http2-3/quic-transport)。nginx 会把 early data 请求标记在 `$ssl_early_data` 变量里，可以据此拒绝非幂等方法：

```text
proxy_set_header Early-Data $ssl_early_data;
```

由上游根据这个头决定是否返回 `425`。

## 客户端证书（mTLS）

```text
ssl_client_certificate  file;        发给客户端的 CA 列表
ssl_trusted_certificate file;        不发给客户端的 CA 列表
ssl_verify_client       on | off | optional | optional_no_ca;   默认: off
```

| 值 | 行为 |
| --- | --- |
| `off` | 不验证（默认） |
| `on` | **必须**提供有效客户端证书 |
| `optional` | 请求证书，提供了就验证 |
| `optional_no_ca` | 请求证书但**不做 CA 验证**——交给应用自己判断 |

`ssl_client_certificate` 与 `ssl_trusted_certificate` 的区别，官方说得很明确：

> Unlike `ssl_client_certificate`, this list is **not sent to clients**.

前者的 CA 列表会在握手时**发给客户端**（帮客户端选证书），后者不发。CA 列表很大时，发送会显著增加握手体积——此时用 `ssl_trusted_certificate`。

配合变量做应用层鉴权：

```text
location /admin/ {
    if ($ssl_client_verify != SUCCESS) { return 403; }
    proxy_set_header X-Client-DN $ssl_client_s_dn;
    proxy_pass http://backend;
}
```

## ssl\_dhparam

```text
语法:    ssl_dhparam file;
上下文:  http, server
```

DHE 套件用的 DH 参数。

**现代配置基本不需要**——TLS 1.3 只用 ECDHE，TLS 1.2 也普遍优先 ECDHE。只在必须支持 DHE 的老客户端时才配，且**必须至少 2048 位**（1024 位有 Logjam 风险）。

## 一份现代 TLS 配置

```text
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2  on;

    server_name example.com;

    # 证书（含中间链）
    ssl_certificate     /etc/ssl/fullchain.pem;
    ssl_certificate_key /etc/ssl/privkey.pem;

    # 协议与套件：默认已足够，此处显式声明便于审计
    ssl_protocols             TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    # 会话复用（默认 none，必须改）
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets on;

    # OCSP stapling
    ssl_stapling            on;
    ssl_stapling_verify     on;
    ssl_trusted_certificate /etc/ssl/chain.pem;
    resolver 1.1.1.1 8.8.8.8 valid=300s;
    resolver_timeout 5s;

    # HSTS（注意 always，见 headers 继承）
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```

`Strict-Transport-Security` 的语义见 [HTTP 上下文字段](https://daiw.org/manual/http11/context-fields)；`always` 的必要性见[继承章](/manual/tools/nginx/contexts)。

下一篇：[HTTP/2 与 HTTP/3](/manual/tools/nginx/http2-http3)。
