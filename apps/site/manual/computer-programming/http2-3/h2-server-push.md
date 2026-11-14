---
title: "服务端推送"
description: "PUSH_PROMISE 机制、它为什么失败，以及 103 Early Hints 这个替代方案。"
source: "https://daiw.org/manual/http2-3/h2-server-push"
---

# 服务端推送

PUSH_PROMISE 机制、它为什么失败，以及 103 Early Hints 这个替代方案。

服务端推送是 HTTP/2 早期备受关注、但最终**被实践否决**的代表性特性（另一个是 RFC 7540 的依赖优先级树）。这一篇讲清它怎么工作、为什么废了。

## 机制

想法：服务端知道客户端拿了 `index.html` 就一定会来要 `style.css`，那不如**主动推过去**，省一个 RTT。

```text
客户端 → HEADERS(流1): GET /index.html
服务端 → PUSH_PROMISE(流1, 承诺流2): GET /style.css   ← 预告
服务端 → HEADERS(流1) + DATA(流1): index.html 的响应
服务端 → HEADERS(流2) + DATA(流2): style.css 的响应   ← 推送内容
```

### PUSH_PROMISE

```text
+-+-------------------------------------------------------------+
|R|                Promised Stream ID (31)                      |
+-+-------------------------------------------------------------+
|                   Header Block Fragment (*)                   |
+---------------------------------------------------------------+
```

规则：

- **MUST** 在其所关联的流上发送（不是在被承诺的流上）。
- Promised Stream ID **MUST 是偶数**（服务端发起）且单调递增。
- 携带的字段块是**服务端替客户端构造的请求头**——即「你本来会发的那个请求」。
- 该请求 **MUST 是安全且幂等**的（实际上只有 `GET`/`HEAD` 合理），且 **MUST NOT** 带请求体。
- 被承诺的流进入 `reserved (remote)` 状态，客户端此时可用 `RST_STREAM`（`CANCEL`）拒绝。

### 关闭推送

`SETTINGS_ENABLE_PUSH = 0` 表示不接受推送。服务端在收到该设置后仍发 `PUSH_PROMISE` → `PROTOCOL_ERROR`。

客户端**不能**在收到推送前预先知道要推什么，只能整体开关或逐个 `RST_STREAM`。

## 为什么失败

推送在 2015 年被寄予厚望，2022 年后主流浏览器全部移除支持（Chrome 106 起默认关闭并最终删除）。原因逐条：

### 1. 服务端不知道客户端缓存里有什么

这是**根本性缺陷**。服务端推送 `style.css` 时，客户端很可能早已缓存了它。结果是白白浪费带宽——而且推送发生在客户端有机会说「我有了」之前。

规范提供的补救（`RST_STREAM` 取消）来得太晚：取消到达服务端时，数据往往已经在路上或已发完。曾有过 **Cache Digest** 提案（客户端把缓存摘要发给服务端），因复杂度与隐私问题被放弃。

### 2. 与流量控制争抢

推送的流与真正被请求的资源**共享同一个[连接窗口](/manual/computer-programming/http2-3/h2-flow-control)**。推送一个不需要的大文件，会直接拖慢客户端真正在等的 HTML——**负优化**。

### 3. 优先级难以调对

推送的资源该排在哪个优先级？服务端很难判断。推早了挤占关键资源带宽，推晚了失去意义。而 h2 的[优先级树本身也已废弃](/manual/computer-programming/http2-3/h2-settings-priority)。

### 4. 实测收益微弱

Chrome 团队 2020–2021 的大规模实测结论：推送对首屏指标的改善**中位数接近零**，且有相当比例的站点因误用而**变慢**。同时它显著增加了服务端实现与运维复杂度。

### 5. 有更好的替代品

见下。

## 替代方案：103 Early Hints

RFC 8297 的 [`103` 状态码](/manual/computer-programming/http11/status-line)完成了同样的目标，且没有上述缺陷：

```http
HTTP/2 103 Early Hints
link: </style.css>; rel=preload; as=style
link: </app.js>; rel=preload; as=script

HTTP/2 200 OK
content-type: text/html
...
```

对比：

| | 服务端推送 | 103 Early Hints |
| --- | --- | --- |
| 服务端发的是 | **资源本身** | **资源的 URL 提示** |
| 客户端有缓存时 | 带宽已浪费 | 客户端自行跳过，零浪费 |
| 抢占带宽 | 会 | 不会 |
| 客户端控制权 | 只能事后取消 | 完全自主决定要不要取 |
| 省下的 RTT | 1 个完整 RTT | 服务器思考时间那一段 |
| 现状 | **已废弃** | 浏览器与 CDN 广泛支持 |

代价是省得少一点（仍需客户端发起请求），但**永远不会负优化**——工程上这个取舍显然更优。

## 当前状态

- HTTP/2：`PUSH_PROMISE` 与 `ENABLE_PUSH` 在 RFC 9113 中仍有定义，但浏览器不再支持。**新系统不应使用**。
- HTTP/3：RFC 9114 **仍定义**了 `PUSH_PROMISE` 帧、`MAX_PUSH_ID` 与 `CANCEL_PUSH`，处境相同——规范里在，实践中无人用。
- 服务端应把 `SETTINGS_ENABLE_PUSH` 视作恒为 0 来设计。

**结论**：把它当作一段值得了解的协议史。要优化关键资源加载，用 `103 Early Hints` + `preload`。

第 1 部分结束。下一篇进入 [HTTP/3 总览](/manual/computer-programming/http2-3/h3-overview)。
