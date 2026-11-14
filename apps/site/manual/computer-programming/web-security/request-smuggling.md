---
title: "HTTP 请求走私"
description: "前端代理和后端服务器对「这个请求到哪结束」理解不一致，攻击者就能把一个请求藏进另一个里面——CL.TE 与 TE.CL 两种经典形态、它能造成什么后果，以及为什么 HTTP/2 端到端是最彻底的解法。"
source: "https://daiw.org/manual/web-security/request-smuggling"
---

# HTTP 请求走私

前端代理和后端服务器对「这个请求到哪结束」理解不一致，攻击者就能把一个请求藏进另一个里面——CL.TE 与 TE.CL 两种经典形态、它能造成什么后果，以及为什么 HTTP/2 端到端是最彻底的解法。

这是本专栏里最「精巧」的一个漏洞。它不利用任何一方的编程错误，而是利用**两方对同一段字节的解读差异**。

## 根因：一个请求到哪儿结束

HTTP/1.1 里，判断请求体长度有两种方式：

| 方式 | 头 | 含义 |
| --- | --- | --- |
| 定长 | `Content-Length: 13` | 后面还有 13 字节 |
| 分块 | `Transfer-Encoding: chunked` | 按块传，读到 `0\r\n\r\n` 结束 |

规范说：**两个头同时出现时，以 `Transfer-Encoding` 为准，且应当拒绝这种请求。** 但现实中，不同实现的处理不一致——有的取 CL，有的取 TE，有的被畸形写法骗过去。

只要**前端代理和后端服务器取了不同的那个**，走私就成立。

```
攻击者 ──一个 TCP 连接──> 前端代理（按 A 理解）──同一连接──> 后端（按 B 理解）
        前端认为「这是 1 个请求」，后端认为「这是 1.5 个请求」
        剩下的半个，会拼到下一个用户的请求前面
```

**关键前提**：前端到后端是**复用的长连接**。这在现代架构里是默认配置——所以这个漏洞的适用面很广。

## 形态一：CL.TE

**前端看 `Content-Length`，后端看 `Transfer-Encoding`。**

```http
POST / HTTP/1.1
Host: example.com
Content-Length: 6
Transfer-Encoding: chunked

0

G
```

- **前端**按 `Content-Length: 6` 读取，body 是 `0\r\n\r\nG`（6 字节），认为这是一个完整请求，整个转发给后端。
- **后端**按 chunked 解析：读到 `0\r\n\r\n` 就认为 body 结束了。**剩下的那个 `G` 没人认领**，它被留在连接缓冲区里，成为「下一个请求的开头」。

于是下一个正常用户的请求 `GET /home HTTP/1.1` 拼在 `G` 后面，变成 `GGET /home HTTP/1.1` —— 那位用户收到一个莫名其妙的错误。

这只是演示。**把 `G` 换成一个完整的请求前缀，就能劫持别人的请求**。

## 形态二：TE.CL

**前端看 `Transfer-Encoding`，后端看 `Content-Length`。**

```http
POST / HTTP/1.1
Host: example.com
Content-Length: 4
Transfer-Encoding: chunked

5c
GPOST /admin/delete-user?id=1 HTTP/1.1
Host: example.com
Content-Length: 15

x=1
0

```

- **前端**按 chunked 解析，读完 `5c` 那一大块和结尾的 `0`，认为整个是一个请求，转发。
- **后端**按 `Content-Length: 4` 只读 4 个字节（`5c\r\n`），**剩下的全部被当作下一个请求**——也就是那个 `POST /admin/delete-user`。

**这个走私进去的请求，是后端自己「读」出来的**：它没有经过前端代理，因此**绕过了前端的所有检查**——WAF 规则、鉴权、路径封禁、限流，全部无效。

## 形态三：TE.TE（用畸形头骗过一边）

两边都支持 chunked，但可以用畸形写法让其中一边**认不出** `Transfer-Encoding`：

```http
Transfer-Encoding: xchunked
Transfer-Encoding : chunked          ← 冒号前有空格
Transfer-Encoding: chunked, identity
Transfer-Encoding:\tchunked          ← 用 Tab 而非空格
X: X\nTransfer-Encoding: chunked     ← 换行注入
```

宽容的解析器接受，严格的拒绝——差异就出来了。**「宽容解析」在这里是缺陷不是优点**，这也是 Postel 定律在安全场景下的经典反例。

## 能造成什么后果

::: warning
走私本身不直接造成危害，它是个**放大器**——把「无害」变成「致命」：

- **绕过前端鉴权**：走私进去的请求没经过代理，`/admin/` 的 IP 白名单、WAF 规则全部失效。
- **劫持他人请求**：把前缀塞进连接，下一个用户的请求被拼接进你构造的上下文里——**他的 Cookie 会跟着一起发到你指定的路径**，等于会话窃取。
- **投毒响应队列**：让后端的响应和请求错位，用户 A 收到用户 B 的响应页面（含其个人数据）。
- **反射型 XSS 升级为存储型**：走私一个带 XSS 的请求，让它污染缓存，影响所有人。

第二条最狠：**受害者什么都没做错，只是恰好在攻击者之后使用了同一条后端连接。**
:::

## 怎么防

### 一、最彻底：前后端之间用 HTTP/2

**HTTP/2 用二进制帧，长度由帧头明确给出，不存在「两种长度表示法打架」的问题。**

```nginx
# Nginx 到后端走 HTTP/2（需要后端支持）
location / {
    proxy_pass https://backend;
    proxy_http_version 2;      # 需要较新版本的 Nginx
}
```

::: info
注意一个细节：**HTTP/2 只在「端到端」时才彻底解决问题**。如果前端用 HTTP/2 接收、然后**降级成 HTTP/1.1 转发给后端**（这是极常见的部署），走私风险依然存在——甚至出现了专门的 **H2.CL / H2.TE** 攻击变种，利用 HTTP/2 到 1.1 的转换过程注入头。

所以如果做不到端到端 HTTP/2，下面几条仍然必须做。
:::

### 二、拒绝有歧义的请求

最直接的原则：**同时出现 `Content-Length` 和 `Transfer-Encoding` 的请求，一律拒绝。**

```nginx
# Nginx 较新版本默认会拒绝这类请求；显式加一层保险
if ($http_transfer_encoding != "") {
    set $smuggle "${smuggle}te";
}
if ($http_content_length != "") {
    set $smuggle "${smuggle}cl";
}
if ($smuggle = "tecl") {
    return 400;
}
```

（前面说过 `if is evil`，这里用它是因为需要在早期阶段判断；更稳的做法是在 WAF 或后端框架层做。）

### 三、关掉前后端之间的连接复用

```nginx
# 每个请求用新连接 —— 走私的前提是复用，断了它就没了
proxy_http_version 1.1;
proxy_set_header Connection "close";
```

**代价是性能**：每个请求都要重新握手。这是「安全换性能」的取舍，只在**确认存在风险且无法升级组件**时用作临时措施。

### 四、保持前后端解析行为一致

理想情况是**前后端用同一套 HTTP 解析实现**。做不到的话，至少：

- 保持组件版本更新（这类漏洞持续被发现和修补）
- 前后端都配置成**严格模式**，宁可拒绝也不猜测
- 避免在链路里堆叠多个不同厂商的代理——**每多一跳，就多一次解析差异的机会**

## 怎么检测

::: warning
**请求走私的探测本身有破坏性**：它会污染真实用户的连接，可能导致其他人收到错误响应。

**只在你自己拥有的、且最好是非生产环境上测试。** 生产环境测试请安排在低峰期，并做好回滚准备。
:::

最实用的检测方法是**基于时间的探测**：构造一个请求，如果服务端存在走私，它会因为等待「不存在的后续字节」而超时。

Burp Suite 的 HTTP Request Smuggler 扩展是这个领域的事实标准工具，它内置了各种变体的探测逻辑和安全护栏。手工构造容易误伤，不推荐。

## 小结

- 根因是**前端代理与后端对「请求边界」理解不一致**，前提是两者之间复用长连接。
- 三种形态：CL.TE、TE.CL、TE.TE（畸形头）。
- 危害在于它是**放大器**：绕过前端一切防护、劫持他人请求与会话、投毒响应队列。
- 最彻底的解法是**端到端 HTTP/2**；注意 HTTP/2 降级转发到 1.1 仍有风险。
- 其次：拒绝 CL+TE 同现的请求、必要时关闭连接复用、减少链路上不同实现的代理跳数。
- **探测有破坏性**，别在生产上随手试。

第三部分结束。下一部分从服务端走到浏览器里。👉 [XSS：三种形态与真实防御](/manual/computer-programming/web-security/xss)
