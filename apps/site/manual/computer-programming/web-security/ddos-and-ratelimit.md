---
title: "DDoS 与限流"
description: "网络层洪水和应用层慢刀是两回事，防法也完全不同。Nginx 限流的三个模块怎么配才不误伤、按什么维度限、以及为什么「按 IP 限流」在移动网络下会伤到真实用户。"
source: "https://daiw.org/manual/web-security/ddos-and-ratelimit"
---

# DDoS 与限流

网络层洪水和应用层慢刀是两回事，防法也完全不同。Nginx 限流的三个模块怎么配才不误伤、按什么维度限、以及为什么「按 IP 限流」在移动网络下会伤到真实用户。

先分清两件常被混为一谈的事：

| | **网络层 DDoS** | **应用层耗尽** |
| --- | --- | --- |
| 长什么样 | SYN flood、UDP 反射，带宽/包量打满 | 每秒几十个请求，但每个都很贵 |
| 量级 | Gbps ~ Tbps | 可能只有几 QPS |
| 谁来挡 | **只能靠上游**（CDN、云清洗），你的机器扛不住 | **只能靠你自己**，CDN 看不出这是攻击 |
| 典型 | 打瘫整个链路 | 打爆数据库连接池 / CPU |

**第一类别指望自己解决**——带宽被打满时，流量根本到不了你的服务器，任何本机配置都无意义。买 CDN/高防，这是钱能解决的问题。

**第二类才是这一章的重点**，因为它便宜、隐蔽，而且 CDN 通常放行——每个请求看起来都完全合法。

## 应用层最容易被打爆的地方

找出你系统里「单个请求代价特别高」的接口，它们就是靶子：

| 类型 | 例子 | 为什么贵 |
| --- | --- | --- |
| **未加限制的搜索** | `?q=` 全文检索、模糊查询 | 一次查询扫全表 |
| **导出/报表** | 导出 CSV、生成 PDF | CPU + 内存 + 长事务 |
| **登录** | 密码校验 | **bcrypt 故意很慢**——这既是防撞库的优点，也是被打的弱点 |
| **注册/短信** | 发验证码 | 每次都真金白银 |
| **图片处理** | 上传后缩略图 | 一张精心构造的图能吃光内存 |
| **深分页** | `?page=99999` | `OFFSET` 越大越慢 |
| **正则** | 用户可控的正则匹配 | ReDoS，一个字符串卡死一个核 |

::: warning
**登录接口是最典型的双刃剑。** 你用 bcrypt/argon2 是对的——慢哈希让离线爆破变得昂贵。但这也意味着**每次登录请求都要烧掉你几十到几百毫秒的 CPU**。攻击者用几十个并发、全部输错密码，就能把 CPU 打满，而每个请求在日志里都是合法的登录尝试。

所以登录接口**必须**限流，而且要在**验证密码之前**就限。
:::

## Nginx 三个限流模块

### limit_req：限请求速率（漏桶）

```nginx
http {
    # 按客户端 IP 建 10MB 的状态表，平均每秒 10 个请求
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    # 登录接口单独一个更严的桶
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    server {
        location / {
            # burst：允许短时突发 20 个排队；nodelay：不拖慢，超出直接拒
            limit_req zone=general burst=20 nodelay;
        }

        location = /api/login {
            limit_req zone=login burst=3 nodelay;
            limit_req_status 429;      # 默认是 503，429 语义更准确
        }
    }
}
```

**`burst` 与 `nodelay` 是最容易配错的一对**：

- 只写 `burst=20`：超出速率的请求会**排队等待**，客户端体验是变慢。队列满了才拒。
- 加上 `nodelay`：突发的 20 个**立即处理**，之后按速率补充令牌，超出的**立即返回 429**。

**给正常业务用 `nodelay`**——用户宁可看到明确的「请稍后重试」，也不想对着转圈等 30 秒。

### limit_conn：限并发连接

```nginx
limit_conn_zone $binary_remote_addr zone=perip:10m;

location /download/ {
    limit_conn perip 5;        # 单 IP 最多 5 个并发下载
    limit_rate 500k;           # 每连接限速 500KB/s
}
```

对大文件下载、流媒体这类**长连接**场景，`limit_conn` 比 `limit_req` 有效得多——攻击者只需建立少量连接就能占满你的 worker。

### 请求体大小与超时

限流之外，把「慢速攻击」的门也关上：

```nginx
client_max_body_size 10m;      # 拒绝超大 body
client_body_timeout 10s;       # 慢速发 body（Slowloris 变种）
client_header_timeout 10s;     # 慢速发 header
send_timeout 10s;
keepalive_timeout 30s;
```

**Slowloris** 的原理就是：建立大量连接，然后每隔几十秒发一个字节，让每个连接都「还没发完」，把 worker 全部占住。上面这几个超时就是它的克星。

## 按什么维度限流

**`$binary_remote_addr` 只是默认起点，很多场景下它是错的。**

::: warning
**按 IP 限流在移动网络下会误伤真实用户。** 运营商 NAT 会把成千上万用户聚合到少数几个出口 IP；公司/学校出口也一样。你把阈值设成「每 IP 10r/s」，一个正常的办公室可能瞬间超标。

反过来，攻击者用代理池轻松换 IP，按 IP 限流对他几乎无效。**IP 是一个又误伤好人、又拦不住坏人的维度。**
:::

更好的做法是**分层限流，按业务身份**：

```nginx
# 已登录用户按用户 ID 限，未登录按 IP 限
map $cookie_session $limit_key {
    ""      $binary_remote_addr;   # 匿名：退回 IP
    default $cookie_session;       # 已登录：按会话
}
limit_req_zone $limit_key zone=byuser:10m rate=30r/s;
```

在应用层还可以更细：

| 维度 | 适合 |
| --- | --- |
| 用户 ID | 已登录的业务接口 |
| 手机号 / 邮箱 | 发验证码、找回密码（**必须**，否则短信费用被刷爆） |
| API Key | 对外开放接口 |
| IP + 路径 | 匿名接口的兜底 |
| 设备指纹 | 反薅羊毛（对抗性强，成本高） |

**验证码类接口要多维度叠加**：同一手机号每分钟 1 次、每天 10 次；同一 IP 每小时 20 次。少了任何一维都会被绕。

## 关键：拿到真实客户端 IP

在 CDN 后面，`$remote_addr` 是 CDN 的回源 IP——**所有用户看起来都是同一个 IP，限流会瞬间误杀全站**。

```nginx
# 只信任 CDN 回源段传来的 X-Forwarded-For
set_real_ip_from 198.51.100.0/24;
set_real_ip_from 203.0.113.0/24;
real_ip_header X-Forwarded-For;
real_ip_recursive on;
```

::: warning
**`set_real_ip_from` 必须精确列出可信来源，绝不能写 `0.0.0.0/0`。** 否则任何人都能伪造 `X-Forwarded-For` 头来冒充任意 IP——限流、IP 封禁、审计日志会被一起绕过，而你的日志里记录的是攻击者随手编的 IP。

这是个非常常见的配置错误：为了「让日志里的 IP 好看」而信任了所有来源，等于把 IP 相关的一切安全机制交给攻击者控制。
:::

## 超限之后返回什么

```nginx
limit_req_status 429;
limit_conn_status 429;

# 给客户端一个明确的重试提示
error_page 429 = @ratelimited;
location @ratelimited {
    add_header Retry-After 60 always;
    return 429 '{"error":"rate_limited","retry_after":60}';
}
```

用 **429 Too Many Requests** 而不是 503：语义准确，客户端 SDK 和爬虫大多认得它并会自觉退避。带上 `Retry-After` 让行为良好的客户端知道等多久。

## 验证你的限流真的生效

```bash
# 连打 30 个请求，统计状态码分布
for i in $(seq 1 30); do
  curl -s -o /dev/null -w "%{http_code}\n" https://example.com/api/login
done | sort | uniq -c
```

期望看到一部分 `200`/`401`、一部分 `429`。**如果全是 200，说明限流没生效**——常见原因：配在了 `http` 块但 `location` 里忘了写 `limit_req`，或者被更靠前的 `location` 匹配走了。

## 小结

- 网络层 DDoS 只能靠上游；**应用层耗尽只能靠自己**，且更隐蔽。
- 先找出「单请求代价高」的接口——登录、搜索、导出、图片处理是常客。
- `limit_req` 配 `nodelay` 给正常业务，`limit_conn` 管长连接，超时参数防慢速攻击。
- **按 IP 限流既误伤好人又拦不住坏人**，尽量按用户/手机号/API Key 等业务维度分层。
- **`set_real_ip_from` 写宽了，等于把所有 IP 相关的安全机制拱手让人。**

下一章讲边缘的另一件武器，以及它的能力边界。👉 [WAF：能挡什么，挡不了什么](/manual/computer-programming/web-security/waf)
