---
title: "代理与转发字段"
description: "Via、Forwarded、X-Forwarded-*、Max-Forwards 与逐跳字段的剥离规则。"
source: "https://daiw.org/manual/http11/proxy-fields"
---

# 代理与转发字段

## 中间件的三种角色

| 角色 | 行为 |
| --- | --- |
| **代理（proxy）** | 客户端显式配置，可改写请求、做协议转换 |
| **网关（gateway / reverse proxy）** | 对客户端表现为源服务器，客户端无感 |
| **隧道（tunnel）** | 盲转发字节，不解释内容（`CONNECT` 建立后即此形态） |

三者对字段的处理义务不同：代理与网关**必须**处理逐跳字段，隧道**不得**修改任何内容。

## 逐跳字段的剥离

转发前 **MUST** 移除的字段：

`Connection` 及其**所列出的所有字段名**、`Proxy-Connection`、`Keep-Alive`、`TE`、`Transfer-Encoding`、`Upgrade`、`Proxy-Authenticate`、`Proxy-Authorization`

漏剥离的直接后果：`Transfer-Encoding` 被转发给不支持的下游 → 成帧分歧 → 请求走私。

## Via

```text
Via              = #( received-protocol RWS received-by [ RWS comment ] )
received-protocol = [ protocol-name "/" ] protocol-version
received-by      = pseudonym [ ":" port ] / uri-host [ ":" port ]
```

```text
Via: 1.1 proxy.example.com, 1.0 fred (Squid/3.5)
```

规则：

-   每个转发的中间件 **MUST** 把自己**追加到列表末尾**——顺序即路径顺序，不可重排。
-   `protocol-name` 为 `HTTP` 时**可省略**，只留版本号（上例 `1.1`）。
-   出于隐私可用**假名**替代真实主机名；可将连续的同协议条目合并，但**不得**删除他人条目。
-   用途：检测请求环路、诊断协议降级、判断链路中是否有 HTTP/1.0 节点（决定能否用 `Transfer-Encoding`、`1xx`）。

## Max-Forwards

```text
Max-Forwards = 1*DIGIT
```

仅对 **`TRACE`** 与 **`OPTIONS`** 有定义。

处理规则：

-   中间件收到时：值为 **0** → **MUST NOT** 继续转发，自己作为最终接收方响应。
-   值 > 0 → **MUST** 减 1 后再转发。
-   其他方法收到时 **MUST** 忽略。

配合 `TRACE` 可逐跳定位链路：`Max-Forwards: 0`、`1`、`2`…依次探测每一跳。

## Forwarded

```text
Forwarded     = #forwarded-element
forwarded-element = [ forwarded-pair ] *( ";" [ forwarded-pair ] )
forwarded-pair = token "=" value
```

RFC 7239，**标准化**的转发信息字段，用于取代各式 `X-Forwarded-*`：

```text
Forwarded: for=192.0.2.60;proto=http;by=203.0.113.43
Forwarded: for=192.0.2.43, for="[2001:db8:cafe::17]";proto=https
```

四个标准参数：

| 参数 | 含义 |
| --- | --- |
| `for` | 发起请求的客户端 |
| `by` | 接收请求的中间件接口 |
| `host` | 原始 `Host` 字段值 |
| `proto` | 原始请求所用方案（`http`/`https`） |

语法要点：

-   参数名**大小写不敏感**；节点标识**大小写不敏感**。
-   **IPv6 地址必须加方括号并整体加引号**：`for="[2001:db8::1]"`。带端口时同理：`for="[2001:db8::1]:8080"`、`for="192.0.2.43:47011"`。
-   多个节点用逗号分隔，**最左是最初的客户端**，依次向右。
-   可用混淆标识（`for=_hidden`、`for=unknown`）保护隐私。

## X-Forwarded-\* （事实标准）

非规范字段，但部署远比 `Forwarded` 广泛：

| 字段 | 对应 |
| --- | --- |
| `X-Forwarded-For` | `Forwarded: for=` |
| `X-Forwarded-Proto` | `Forwarded: proto=` |
| `X-Forwarded-Host` | `Forwarded: host=` |

```text
X-Forwarded-For: 203.0.113.195, 70.41.3.18, 150.172.238.178
```

语法：逗号分隔，**最左是原始客户端**，向右依次是各代理。IPv6 **不加**方括号（与 `Forwarded` 相反）。

## 转发字段的安全模型

这是生产事故高发区，必须明确：

**这些字段完全由客户端可控，默认不可信。**

攻击者可直接发送：

```text
X-Forwarded-For: 127.0.0.1
```

若应用据此判定「来自本机、跳过鉴权」，即被绕过。正确做法：

1.  **边缘节点必须覆写**而非追加——最外层反代应**丢弃**客户端自带的 `X-Forwarded-For`，写入自己观测到的对端地址。
2.  内层应用**从右往左**数，跳过自己信任的代理跳数，取第一个不可信地址作为真实客户端 IP。**不要**直接取最左值。
3.  明确配置**受信代理列表**（如 nginx `set_real_ip_from`、Node 的 `trust proxy` 跳数），不要设成「信任所有」。
4.  `X-Forwarded-Host` 同样危险——用它生成绝对 URL 会造成与 Host 头注入等价的漏洞。

## 代理对报文的改动限制

-   **MUST NOT** 改动的：`Content-Encoding`、`Content-Range`、`Content-Type`（除非响应带 `no-transform`，则一律禁止改动体）。
-   **MAY** 改动的：`Transfer-Encoding`（可重新分块）、逐跳字段。
-   转换了内容的代理 **SHOULD** 把状态码改为 `203 Non-Authoritative Information`。
-   代理 **MUST NOT** 转发它无法正确解析的报文——应返回错误而非「尽力而为」地转发。

下一篇：[字段速查表](/manual/computer-programming/http11/field-index)。
