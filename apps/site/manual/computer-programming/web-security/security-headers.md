---
title: "安全响应头"
description: "一份逐条讲清「挡什么、怎么配、有什么代价」的响应头清单——点击劫持、MIME 嗅探、Referer 泄露、跨源隔离，以及那些已经过时不该再配的头。"
source: "https://daiw.org/manual/web-security/security-headers"
---

# 安全响应头

一份逐条讲清「挡什么、怎么配、有什么代价」的响应头清单——点击劫持、MIME 嗅探、Referer 泄露、跨源隔离，以及那些已经过时不该再配的头。

这是整个专栏里**投入产出比最高**的一章：几行配置，挡掉一批攻击，通常几十分钟就能上完。

## 一份完整配置

先给结论，再逐条解释：

```nginx
# ── 必配 ──
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'" always;

# ── 强烈建议 ──
add_header X-Frame-Options "DENY" always;              # 给老浏览器兜底
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;

# ── 需要跨源隔离时（SharedArrayBuffer 等）──
# add_header Cross-Origin-Opener-Policy "same-origin" always;
# add_header Cross-Origin-Embedder-Policy "require-corp" always;
# add_header Cross-Origin-Resource-Policy "same-origin" always;
```

::: warning
**`always` 参数不能省。** 不加的话，Nginx 只在 2xx/3xx 响应上添加这些头，**4xx 和 5xx 页面不带**。而错误页恰恰是攻击者最常访问的路径，也是最容易泄露信息的地方。

另外记住[基线那一章](/manual/computer-programming/web-security/nginx-baseline)提过的坑：**`add_header` 在子块里是覆盖不是合并**。把这些头抽成 `include` 文件，在每个 location 里引一次。
:::

## 逐条拆解

### Strict-Transport-Security（HSTS）

**挡什么**：SSL 剥离攻击。用户输入 `example.com`（没带 https），中间人把跳转拦下来，一直用 HTTP 通信。HSTS 让浏览器**记住「这个域只能用 HTTPS」**，之后连尝试都不会尝试 HTTP。

**代价**：[证书那一章](/manual/computer-programming/web-security/tls-and-certs)详细讲过——`includeSubDomains` 和 `preload` 能把你锁死，必须分阶段上。

### X-Content-Type-Options: nosniff

**挡什么**：MIME 嗅探。浏览器发现 `Content-Type` 和内容对不上时，会「聪明地」猜测真实类型。

**为什么危险**：用户上传了一个 `avatar.jpg`，内容其实是 HTML+JS。你返回 `Content-Type: image/jpeg`，但浏览器嗅探后决定「这是 HTML」，于是**执行了里面的脚本**——在你的域下。一个头像上传变成了存储型 XSS。

```
add_header X-Content-Type-Options "nosniff" always;
```

**代价：几乎为零。** 唯一的要求是**你必须设对 `Content-Type`**——如果你的服务器给 CSS 返回 `text/plain`，加了 nosniff 之后样式会失效。这其实是好事，逼你修正配置。

### Referrer-Policy

**挡什么**：URL 泄露。默认情况下，用户从你的页面点击外链时，浏览器会把**当前完整 URL** 放进 `Referer` 头发给对方。

**真实泄露场景**：

```
https://example.com/reset-password?token=abc123xyz
                    ↑ 用户在这个页面点了一个外部链接
                    → 密码重置 token 就到了第三方的日志里
```

同类的还有：包含订单号、用户 ID、搜索关键词的 URL。

| 值 | 行为 |
| --- | --- |
| `no-referrer` | 完全不发。最安全，但会让你的站在别人的统计里变成「直接访问」 |
| `same-origin` | 只在同源时发 |
| **`strict-origin-when-cross-origin`** | **推荐**：同源发完整 URL，跨源只发源（`https://example.com`），降级到 HTTP 时不发 |

**根本对策还是「敏感信息不要放进 URL」**——URL 会进浏览器历史、服务器日志、CDN 日志、Referer 头，泄露面太广。响应头只是兜底。

### frame-ancestors / X-Frame-Options

**挡什么**：点击劫持（clickjacking）。攻击者把你的页面放进一个透明的 iframe，上面盖一层诱导性内容：

```html
<style>
  iframe { opacity: 0; position: absolute; z-index: 2; width: 400px; height: 300px; }
  button { position: absolute; z-index: 1; }
</style>
<button>点击领取奖品</button>
<iframe src="https://example.com/account/delete"></iframe>
```

用户以为在点「领取奖品」，实际点的是 iframe 里你的「确认删除账号」按钮。**他的会话是有效的，操作会真的执行。**

```
# 新标准（CSP 的一部分）
Content-Security-Policy: frame-ancestors 'none'

# 老标准，给不支持 CSP 的浏览器兜底
X-Frame-Options: DENY
```

**两个都配**：`frame-ancestors` 优先级更高、更灵活（支持多来源白名单），`X-Frame-Options` 覆盖老浏览器。

需要被特定站点嵌入时：

```
Content-Security-Policy: frame-ancestors 'self' https://partner.example.com
```

::: info
**`X-Frame-Options: ALLOW-FROM` 已被废弃**，主流浏览器都不支持了。需要白名单就只能用 `frame-ancestors`。
:::

### Permissions-Policy

**挡什么**：限制页面（**包括其中的 iframe**）能使用哪些浏览器能力。

```
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
```

`()` 表示「谁都不许用」。**主要价值在于限制嵌入的第三方内容**——你嵌了一个广告 iframe，它不该能调用摄像头。

即使你的站点根本不用这些能力，也建议显式关掉：**万一将来出现 XSS，攻击者也无法调用摄像头或定位。**

### Cross-Origin-* 三兄弟

这三个是较新的隔离机制，主要为了防御 Spectre 类的侧信道攻击：

| 头 | 作用 |
| --- | --- |
| `Cross-Origin-Opener-Policy: same-origin` | 切断与 `window.open` 打开者/被打开者的引用关系 |
| `Cross-Origin-Embedder-Policy: require-corp` | 要求所有跨源资源显式声明允许被嵌入 |
| `Cross-Origin-Resource-Policy: same-origin` | 声明本资源不允许被跨源加载 |

::: warning
**COOP + COEP 会打破很多第三方集成。** 开启 `require-corp` 后，所有跨源资源（图片、脚本、iframe）都必须带 `Cross-Origin-Resource-Policy` 头或走 CORS——大量第三方 CDN 和统计脚本不满足这个要求，会直接加载失败。

**除非你确实需要 `SharedArrayBuffer` 或高精度计时器，否则不必开。** 这三个头是「有明确需求才配」，不是通用基线。
:::

## 不该再配的过时头

| 头 | 为什么别配 |
| --- | --- |
| `X-XSS-Protection` | 浏览器内置的 XSS 过滤器**已被全部移除**，因为它自身引入过漏洞。配 `1; mode=block` 无效，配错还可能有害。**建议显式设为 `0` 或干脆不发** |
| `Expect-CT` | 已废弃，CT 现在是强制要求，不需要这个头 |
| `Public-Key-Pins`（HPKP） | **已废弃且危险**——配错会把自己的域名锁死数月，无法挽回。绝对不要用 |
| `X-Frame-Options: ALLOW-FROM` | 无浏览器支持，用 `frame-ancestors` |

## Cookie 属性也算「响应头安全」

```
Set-Cookie: session=abc;
            HttpOnly;               ← JS 读不到，XSS 偷不走
            Secure;                 ← 只在 HTTPS 上发送
            SameSite=Lax;           ← 限制跨站携带
            Path=/;
            Max-Age=3600            ← 别用超长有效期
```

不写 `Domain` 属性——[子域名接管那一章](/manual/computer-programming/web-security/subdomain-takeover)讲过，不写的话 Cookie 只对当前主机生效，子域名被接管也偷不走。

**前缀是个额外的保险**：

```
Set-Cookie: __Host-session=abc; Secure; Path=/; SameSite=Lax
```

`__Host-` 前缀是浏览器强制的约束：**必须有 `Secure`、必须 `Path=/`、不能有 `Domain`**。任何不满足的 `Set-Cookie` 会被浏览器直接丢弃。这能防止子域名给主域写 Cookie（Cookie tossing 攻击）。

## 一条命令自查

```bash
D=example.com
curl -sSI https://$D/ | grep -iE "strict-transport|content-security|x-frame|x-content-type|referrer-policy|permissions-policy|set-cookie|^server|x-powered-by"

echo "── 404 页也要有（验证 always）──"
curl -sSI https://$D/definitely-not-exist | grep -icE "strict-transport|x-frame|nosniff"
```

**第二条命令是关键**：很多人配了头但漏了 `always`，或者被子块的 `add_header` 覆盖了。打一个 404 一试便知。

## 小结

- 必配四件套：**HSTS、nosniff、Referrer-Policy、CSP**（含 `frame-ancestors`）。
- **`always` 不能省**，否则错误页不带头；`add_header` 在子块里是覆盖不是合并。
- `nosniff` 挡的是「上传的图片被当 HTML 执行」这类存储型 XSS，代价几乎为零。
- Referrer 泄露的**根本对策是「别把敏感信息放 URL」**，响应头只是兜底。
- **COOP/COEP 会打破第三方集成**，有明确需求才配。
- `X-XSS-Protection`、HPKP 等已过时甚至有害，**别再配**。
- Cookie 用 `__Host-` 前缀能防子域名写 Cookie。

下一章讲前端最后一块、也是最容易失控的一块。👉 [前端供应链](/manual/computer-programming/web-security/frontend-supply-chain)
