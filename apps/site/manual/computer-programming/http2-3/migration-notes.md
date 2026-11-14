---
title: "迁移注意事项"
description: "哪些 1.1 知识作废、哪些照旧，以及升级 h2/h3 时真正会踩的坑。"
source: "https://daiw.org/manual/http2-3/migration-notes"
---

# 迁移注意事项

哪些 1.1 知识作废、哪些照旧，以及升级 h2/h3 时真正会踩的坑。

## 哪些 1.1 知识作废

从 [HTTP/1.1 专栏](/manual/computer-programming/http11/)带过来的内容里，**只有第 1 部分（报文与成帧）**在 h2/h3 上失效：

| 作废的 | 替代 |
| --- | --- |
| [报文四段式结构](/manual/computer-programming/http11/message-format)、CRLF、obs-fold | 二进制帧 |
| [request-line / status-line](/manual/computer-programming/http11/request-line) | 伪头字段 |
| [七步成帧判定链](/manual/computer-programming/http11/message-body-length) | 帧长 + `END_STREAM`/FIN |
| `Transfer-Encoding`、`chunked` | 帧层负责 |
| [`Connection`、`Keep-Alive`、`Upgrade`](/manual/computer-programming/http11/connection-management) | ALPN + `SETTINGS` + `GOAWAY` |
| 流水线、逐跳字段概念 | 流多路复用 |

## 哪些照旧

第 2、3 部分**逐字有效**，三版通用：

- 全部[方法](/manual/computer-programming/http11/methods)及其安全/幂等/可缓存性
- 全部[状态码](/manual/computer-programming/http11/status-codes)
- 全部字段语义：[表示](/manual/computer-programming/http11/representation-fields)、[协商](/manual/computer-programming/http11/content-negotiation)、[条件](/manual/computer-programming/http11/conditional-requests)、[范围](/manual/computer-programming/http11/range-requests)、[缓存](/manual/computer-programming/http11/caching)、[认证](/manual/computer-programming/http11/authentication)、[Cookie](/manual/computer-programming/http11/cookies)

**升级协议不改变任何业务语义。**`ETag` 还是那个 `ETag`，`Cache-Control` 还是那套规则。

## 应用层几乎不用改

对绝大多数应用，升级 h2/h3 是**纯运维动作**——终结点（nginx / CDN / 网关）改配置即可，应用代码不动。因为：

- 网关会自动完成 h2/h3 ↔ 1.1 的转换。
- 框架（Express、Spring、Go net/http）对上层暴露的是同一套请求/响应对象。

需要改代码的少数情况见下。

## 真正会踩的坑

### 1. 字段名大小写

h2/h3 **强制小写**。若代码里有：

```js
if (req.headers['Content-Type'] === ...)   // h2 下永远取不到
```

必须改为小写查找。多数框架已归一化，但**自己拼原始头**或用底层库时要注意。

### 2. 依赖 1.1 特有字段的逻辑

```js
if (req.headers.connection === 'keep-alive')  // h2/h3 下该字段不存在
if (req.headers['transfer-encoding'])         // 同上
```

这些字段在 h2/h3 中**被禁止出现**，相关判断会静默失效。

### 3. 域名分片要撤掉

1.1 时代把静态资源拆到 `img1.example.com`、`img2.example.com` 以突破 6 连接限制。h2/h3 下这是**负优化**：每个域要单独握手、单独维护连接与压缩上下文。**合并回单域**。

同理，**资源合并（雪碧图、打包成一个巨型 JS）的收益也大幅下降**——多路复用后小文件不再昂贵，且细粒度更利于缓存命中。但也不必走极端拆成上千个小文件，请求本身仍有开销。

### 4. `INITIAL_WINDOW_SIZE` 默认值太小

h2 默认 65535 字节。跨洋 100ms RTT 下单流吞吐上限约 **640 KB/s**——大文件下载会明显变慢，且这个现象常被误判为「h2 比 1.1 慢」。

nginx 示例：

```text
http2_body_preread_size    64k;
```

更关键的是上游代理与应用服务器的窗口设置，需逐层检查。

### 5. `MAX_CONCURRENT_STREAMS` 必须设有限值

规范默认**无限**。不设置等于对流洪泛不设防（含 **Rapid Reset** CVE-2023-44487）。生产建议 100–128，并**额外限制单位时间内的 `RST_STREAM` 速率**。

### 6. 0-RTT 的重放风险

启用 h3 的 0-RTT 时，**非幂等请求可能被重放**。要么：

- 服务端对 0-RTT 中的非幂等请求返回 [`425 Too Early`](/manual/computer-programming/http11/status-4xx)；
- 要么实现请求去重（幂等键）。

不要在没有防护的情况下对写接口开 0-RTT。

### 7. UDP 必须可回落

h3 依赖 UDP/443 可达。**必须**同时保留 h2/1.1 端点，并确认防火墙放行 UDP 443。只开 h3 会让部分用户完全无法访问。

### 8. 可观测性要重建

QUIC 加密了传输层元数据，传统抓包分析（RTT、重传、窗口）**失效**。需要：

- 启用 **qlog**（端点导出的结构化传输日志）。
- 在应用层补齐指标：按协议版本分别统计延迟、错误率、连接复用率。

## 部署检查清单

- [ ] TLS 1.2+ 且启用 ALPN；h3 需 TLS 1.3（Nginx 1.25+ 原生支持 `http2 on;` 与 `listen 443 quic; http3 on;`）。
- [ ] 证书链完整（h2 对 TLS 配置更严，禁用重协商与压缩）。
- [ ] 防火墙放行 **UDP 443**（h3）。
- [ ] 下发 `Alt-Svc`，并考虑配置 DNS **HTTPS 记录**以省掉首访的一跳。
- [ ] `MAX_CONCURRENT_STREAMS` 有限值 + `RST_STREAM` 速率限制。
- [ ] 窗口大小按带宽延迟积调整。
- [ ] `MAX_HEADER_LIST_SIZE` 显式设置（防 HPACK 炸弹）。
- [ ] 撤销域名分片，收敛到单域。
- [ ] 保留 h2 与 1.1 回落路径并实测。
- [ ] 用 `curl --http2` / `--http3` 与浏览器 DevTools 的 Protocol 列逐一验证。

验证命令：

```bash
curl -sI --http3 https://example.com | head -1
```

```bash
curl -sI --http2 https://example.com | head -1
```

## 收尾

三版协议的关系可以用一句话概括：

> **HTTP 语义从未改变，改的一直是「怎么把它装进字节」和「这些字节跑在什么之上」。**

- HTTP/2 重写了**装法**（文本 → 二进制帧 + 多路复用 + 压缩）。
- HTTP/3 重写了**载体**（TCP → QUIC），顺带把流管理与流量控制下沉。

理解了这一点，[HTTP/1.1 专栏](/manual/computer-programming/http11/)里关于方法、状态码与字段的每一条规则，在 h2 与 h3 上都可以原样复用——那才是 HTTP 真正稳定的部分。
