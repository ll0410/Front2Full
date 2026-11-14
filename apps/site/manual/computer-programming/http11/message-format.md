---
title: "报文结构"
description: "start-line、字段行、空行、消息体——HTTP/1.1 报文的四段式语法与解析规则。"
source: "https://daiw.org/manual/http11/message-format"
---

# 报文结构

## 总语法

RFC 9112 §2.1：

```text
HTTP-message = start-line CRLF
               *( field-line CRLF )
               CRLF
               [ message-body ]

start-line   = request-line / status-line
```

四段依次为：**起始行**、**零或多个字段行**、**一个空行（裸 CRLF）**、**可选消息体**。空行是头部结束的唯一标志；消息体的存在与长度**不由空行决定**，而由成帧规则决定（见[消息体长度](/manual/computer-programming/http11/message-body-length)）。

一条完整请求的字节流：

```text
GET /index.html HTTP/1.1
Host: example.com
Accept: text/html
```

最后那个空行必须存在，即使没有消息体。

## 解析顺序

接收方必须按此顺序处理，不可跳步：

1.  读 start-line。允许**在起始行之前**接收并忽略至少一个空行（`CRLF`），用于兼容老客户端在 POST 体后多发的 CRLF；但不得在期望 start-line 时接受无限空行（拒绝服务风险）。
2.  逐行读 field-line 直到遇到空行。
3.  按成帧规则确定消息体长度。
4.  读取消息体（若有）。

## 行终止符

-   规范行终止符是 **CRLF**。
-   接收方 **MAY** 把裸 `LF` 当作行终止符并忽略前导 `CR`（健壮性）；**发送方 MUST** 始终发 CRLF。
-   **不得**把裸 `CR` 当行终止符。

裸 LF 的宽容处理是请求走私（request smuggling）的经典温床：当前端与后端对 `LF` vs `CRLF` 的判定不一致时，同一段字节会被切成不同的报文边界。生产中前后端解析器行为必须一致。

## 长度限制

规范**不规定**起始行与字段行的长度上限，但要求：

-   服务端接收的 request-line 过长时返回 **414 (URI Too Long)**。
-   字段区过大时返回 **431 (Request Header Fields Too Large)**。

实现常见默认：nginx `large_client_header_buffers` 8k/行、Apache `LimitRequestLine` 8190、Node.js `--max-http-header-size` 16KB（总量）。跨代理链路时以最小值为准。

## 健壮性要求（MUST 级）

RFC 9112 明确禁止的几种「宽容」：

| 场景 | 要求 |
| --- | --- |
| start-line 与首个 field-line 之间出现空白 | **MUST** 拒绝（400），不得当作续行 |
| 字段名与冒号之间有空白（`Host : x`） | **MUST** 拒绝（400）；代理 **MUST** 移除该报文而非转发 |
| 同时收到 `Content-Length` 与 `Transfer-Encoding` | **MUST** 按 `Transfer-Encoding` 处理并视 `Content-Length` 无效；代理应拒绝 |
| `Content-Length` 值不一致的多个实例 | **MUST** 拒绝（400） |

这四条都是走私攻击的直接防线，属于必须实现的硬要求，不是建议。

## obs-fold（已废弃的续行）

历史上字段值可跨行折叠：

```text
obs-fold = OWS CRLF RWS
```

现行规范：**发送方 MUST NOT** 生成 obs-fold（`message/http` 媒体类型内除外）。接收方处理：

-   非 `message/http` 场景收到 obs-fold → **MUST** 返回 400，或在转发前把 obs-fold 替换成一个或多个 SP。
-   直接原样转发是错误实现。

## 请求 vs 响应的结构差异

两者语法同构，只有起始行不同：

|  | 请求 | 响应 |
| --- | --- | --- |
| 起始行 | `request-line`：方法 + 目标 + 版本 | `status-line`：版本 + 状态码 + 原因短语 |
| 必需字段 | `Host`（HTTP/1.1 强制） | 无强制字段（但多数需 `Date`） |
| 体的存在 | 由 `Content-Length`/`Transfer-Encoding` 决定 | 还受方法与状态码约束（如 HEAD、204、304 恒无体） |

下一篇：[请求行](/manual/computer-programming/http11/request-line)——方法、request-target 的四种形式与版本号。
