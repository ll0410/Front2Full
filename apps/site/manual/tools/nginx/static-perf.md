---
title: "压缩与静态文件"
description: "gzip 全部默认值的陷阱、gzip_vary 与代理缓存、sendfile/tcp_nopush 组合与 open_file_cache。"
source: "https://daiw.org/manual/nginx/static-perf"
---

# 压缩与静态文件

## gzip 的默认值几乎全都要改

```text
gzip              on | off;         默认: off
gzip_types        mime-type ...;    默认: text/html
gzip_comp_level   1..9;             默认: 1
gzip_min_length   length;           默认: 20
gzip_proxied      ...;              默认: off
gzip_vary         on | off;         默认: off
gzip_http_version 1.0 | 1.1;        默认: 1.1
```

**七个默认值里有五个在生产中都不合适**，逐条看。

### gzip\_types：默认只压 HTML

> Enables gzipping for specified MIME types **in addition to** "text/html".

关键是 **in addition to**——`text/html` 是**无条件包含**的，写不写都压。所以：

```text
gzip_types text/css application/javascript application/json;
```

不需要（也不应该）再写 `text/html`。写了不报错，但冗余。

一份实用清单：

```text
gzip_types
    text/plain
    text/css
    text/xml
    application/json
    application/javascript
    application/xml
    application/rss+xml
    image/svg+xml;
```

**不要压已压缩的格式**：JPEG/PNG/WebP/MP4/ZIP/woff2。它们本身已压缩，再压 CPU 白烧、体积可能变大。

特别注意 **`woff2` 不要压**（woff2 内建 Brotli），但 **`svg` 要压**（SVG 是文本）。

`gzip_types *;` 匹配所有类型——**不要用**，会连图片一起压。

### gzip\_comp\_level：默认 1

范围 1–9。**默认 1**（最快最弱）。

实践共识是 **4–6**：再往上压缩率提升极小而 CPU 消耗陡增。9 级相比 6 级通常只多省 1–2% 体积，却要多花一倍 CPU。

```text
gzip_comp_level 5;
```

### gzip\_min\_length：默认 20 字节

**20 字节太小**。小响应压缩后可能**比原文更大**（gzip 有固定头部开销），且每次压缩都有 CPU 成本。

```text
gzip_min_length 1024;
```

注意它**依赖 `Content-Length`**——分块传输（无 `Content-Length`）时这个判断失效，会压缩所有响应。

### gzip\_proxied：默认 off ← 反代场景的大坑

**`gzip_proxied` 默认是 `off`，意味着「来自代理的请求一律不压缩」。**

判断依据是请求里**有没有 `Via` 头**——[`Via` 是代理逐跳追加的](https://daiw.org/manual/http11/proxy-fields)。所以：

-   nginx 作为**边缘**直接面对用户 → 请求没有 `Via` → 正常压缩。
-   nginx 前面**还有一层** CDN/LB → 请求带 `Via` → **默认完全不压缩**。

这是「本地测试有 gzip、上线后没有」的头号原因。

解法：

```text
gzip_proxied any;
```

其他取值用于按上游响应头细分（`expired`、`no-cache`、`no-store`、`private`、`auth`…），`any` 表示无条件压缩。

### gzip\_vary：默认 off ← 缓存正确性问题

```text
gzip_vary on;
```

开启后响应会带 `Vary: Accept-Encoding`。

**这不是可选项，是缓存正确性的必需品。** [如 HTTP 协商章节所述](https://daiw.org/manual/http11/content-negotiation)：漏发 `Vary` 会让 CDN/代理把 gzip 版本发给不支持 gzip 的客户端，得到一堆乱码。

只要开了 gzip 且前面有任何缓存层，**必须** `gzip_vary on;`。

### gzip\_disable

```text
gzip_disable "msie6";
```

`msie6` 是内置掩码，对应 `MSIE [4-6]\.`。IE6 早已绝迹，这行现在**可以删掉**——它只是徒增一次正则匹配。

## 预压缩：gzip\_static

```text
gzip_static on;
```

（需 `ngx_http_gzip_static_module`，编译时 `--with-http_gzip_static_module`）

直接返回**预先压缩好的 `.gz` 文件**：请求 `/app.js` 时，若存在 `/app.js.gz` 就直接发它。

优势明显：**构建时压一次，运行时零 CPU**，且可以用最高压缩级别（`gzip -9` 甚至 `zopfli`）。静态资源应优先用这个而不是实时压缩。

## sendfile 与 tcp\_nopush

```text
sendfile     on | off;    默认: off
tcp_nopush   on | off;    默认: off
tcp_nodelay  on | off;    默认: on
```

```text
sendfile    on;
tcp_nopush  on;
tcp_nodelay on;
```

**`sendfile on`**——用 `sendfile()` 系统调用在内核态直接把文件送到 socket，**零拷贝**，不经过用户态缓冲。静态文件服务的关键优化。

**`tcp_nopush on`**（Linux 的 `TCP_CORK`）——**只在 `sendfile` 开启时生效**。它让内核攒够一个完整数据包再发，避免响应头单独占一个小包。

**`tcp_nodelay on`**（禁用 Nagle 算法）——默认已开。它与 `tcp_nopush` 看似矛盾，实际 nginx 处理得很好：传输大文件时用 nopush 攒包，最后一个包用 nodelay 立即发。**三个一起开是标准配置**。

`sendfile` 与 [`proxy_buffering`](/manual/tools/nginx/proxy) 无关——前者针对**本地文件**，后者针对**上游响应**。

另外 `sendfile` 在某些虚拟化/网络文件系统上有已知问题，遇到静态文件传输异常可以试着关掉排查。

大文件场景可以配 `sendfile_max_chunk` 防止单个连接长时间独占 worker：

```text
sendfile_max_chunk 2m;
```

## open\_file\_cache

```text
open_file_cache          off | max=N [inactive=time];   默认: off
open_file_cache_valid    time;                          默认: 60s
open_file_cache_min_uses number;                        默认: 1
open_file_cache_errors   on | off;                      默认: off
```

缓存**文件描述符、大小、修改时间**与目录查找结果——避免每个请求都 `open()`/`stat()`。

```text
open_file_cache          max=10000 inactive=60s;
open_file_cache_valid    60s;
open_file_cache_min_uses 2;
open_file_cache_errors   on;
```

**它缓存的是元数据，不是文件内容。** 但仍有一致性风险：文件在 `open_file_cache_valid` 期间被替换，nginx 可能仍返回旧的描述符。

静态资源用**内容哈希文件名**（`app.a1b2c3.js`）时完全无碍——文件名变了就是新文件。用固定文件名 + 原地覆盖部署时要注意这个窗口。

`open_file_cache_errors on` 会连「文件不存在」也缓存——能挡住对不存在路径的反复探测，但部署新文件后需要等失效。

## expires

```text
语法:    expires [modified] time;
         expires epoch | max | off;
默认:    expires off;
上下文:  http, server, location, if in location
```

设置 [`Expires` 与 `Cache-Control`](https://daiw.org/manual/http11/caching) 响应头：

| 值 | `Expires` | `Cache-Control` |
| --- | --- | --- |
| 正数时间 | 当前 + time | `max-age=t` |
| `0` | 当前时间 | `max-age=0` |
| 负数 | 当前 − |time| | **`no-cache`** |
| `epoch` | `Thu, 01 Jan 1970 00:00:01 GMT` | `no-cache` |
| `max` | `Thu, 31 Dec 2037 23:55:55 GMT` | 10 年 |
| `off` | — | 不修改 |

只对这些状态码生效：`200 201 204 206 301 302 303 304 307 308`。

用变量做按类型区分（1.7.9+），官方示例：

```text
map $sent_http_content_type $expires {
    default         off;
    application/pdf 42d;
    ~image/         max;
}

expires $expires;
```

带哈希的静态资源用 `max` + `immutable`：

```text
location ~* \.[0-9a-f]{8}\.(js|css)$ {
    expires    max;
    add_header Cache-Control "public, immutable";
}
```

`immutable` 的语义见 [HTTP 缓存扩展指令](https://daiw.org/manual/http11/caching)——新鲜期内即使用户强刷也不发验证请求。

## 一份静态站配置

```text
http {
    sendfile    on;
    tcp_nopush  on;
    tcp_nodelay on;

    gzip              on;
    gzip_comp_level   5;
    gzip_min_length   1024;
    gzip_proxied      any;      # 反代后面必须
    gzip_vary         on;       # 缓存正确性必须
    gzip_types        text/plain text/css text/xml
                      application/json application/javascript
                      application/xml image/svg+xml;
    gzip_static       on;       # 优先用预压缩文件

    open_file_cache          max=10000 inactive=60s;
    open_file_cache_valid    60s;
    open_file_cache_min_uses 2;

    server {
        root /var/www/site;

        # 带哈希的资源：永久缓存
        location ~* \.[0-9a-f]{8,}\.(js|css|woff2)$ {
            expires    max;
            add_header Cache-Control "public, immutable";
        }

        # HTML：不缓存，保证发版即生效
        location ~* \.html$ {
            expires    -1;
            add_header Cache-Control "no-cache";
        }

        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```

下一篇：[访问控制与限流](/manual/tools/nginx/access-limits)。
