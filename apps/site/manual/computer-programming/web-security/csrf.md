---
title: "CSRF 与 SameSite"
description: "浏览器自动带 Cookie 是 CSRF 的根因——SameSite 默认值改变后哪些场景仍然有风险、双提交与同步器令牌怎么选、以及为什么「只用 JSON 就安全了」是个危险的误解。"
source: "https://daiw.org/manual/web-security/csrf"
---

# CSRF 与 SameSite

浏览器自动带 Cookie 是 CSRF 的根因——SameSite 默认值改变后哪些场景仍然有风险、双提交与同步器令牌怎么选、以及为什么「只用 JSON 就安全了」是个危险的误解。

CSRF（跨站请求伪造）的根因只有一句话：

> **浏览器在向某个站点发请求时，会自动带上该站点的 Cookie——不管这个请求是从哪个页面发起的。**

于是攻击者可以在自己的页面上构造一个指向你网站的请求，受害者一访问，请求就带着他的登录态发出去了。

## 一个经典例子

用户登录了 `bank.example.com`，然后访问了攻击者的页面：

```html
<!-- evil.com 上的页面 -->
<form id="f" action="https://bank.example.com/transfer" method="POST">
  <input name="to" value="attacker-account">
  <input name="amount" value="10000">
</form>
<script>document.getElementById('f').submit();</script>
```

页面一加载就自动提交。浏览器带上了用户在 `bank.example.com` 的会话 Cookie，服务端一看「会话有效」，转账执行。

**注意攻击者并不需要读到响应**——跨域限制会挡住他看结果，但**操作已经发生了**。这就是 CSRF 只对「有副作用的请求」有意义的原因。

::: info
**CSRF 与 XSS 的区别**：XSS 是「攻击者的代码在你的域里跑」，CSRF 是「攻击者借用用户的身份发请求，但代码在别人的域里」。

所以 **XSS 能完全绕过 CSRF 防护**（脚本在你的域里，能读到 token）。这也意味着：**一旦有 XSS，讨论 CSRF 就没意义了**——先解决 XSS。
:::

## 第一道防线：SameSite Cookie

现代浏览器已经把 Cookie 的 `SameSite` 默认值改成了 `Lax`，这挡掉了很大一部分 CSRF。

| 值 | 行为 |
| --- | --- |
| `Strict` | **任何**跨站请求都不带 Cookie。最安全，但从外部链接点进来会显示未登录 |
| `Lax`（多数浏览器默认） | 跨站的 **GET 顶层导航**会带（点链接进来仍是登录态），**POST / iframe / fetch 不带** |
| `None` | 一律携带，**必须同时加 `Secure`** |

```
Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Lax; Path=/
```

**`Lax` 已经挡住了上面那个表单自动提交的例子**——因为那是跨站 POST。

::: warning
**但不能只靠 SameSite，有四个缺口：**

1. **`SameSite=Lax` 允许跨站 GET 导航带 Cookie。** 如果你有「用 GET 执行副作用」的接口（`/logout`、`/delete?id=1`），它仍然可被 CSRF。**这也是「GET 必须是安全方法」这条规范要求的实际意义。**
2. **同站不等于同源。** `SameSite` 判定的是「同一个可注册域」——`evil.example.com` 和 `www.example.com` 算**同站**。所以[子域名接管](/manual/computer-programming/web-security/subdomain-takeover)会直接击穿 SameSite 防护。
3. **老浏览器和某些 App 内置 WebView** 可能不支持或行为不一致。
4. **需要 `SameSite=None` 的场景**（第三方嵌入、跨站 SSO）等于主动放弃这层防护。对于合法的跨站 iframe 嵌入场景，建议搭配 CHIPS（`Partitioned` 属性，即 `Set-Cookie: ...; SameSite=None; Secure; Partitioned`），将第三方 Cookie 按顶层站点分区隔离。

所以 SameSite 是**减轻**措施，不是完整方案。
:::

## 第二道防线：CSRF Token

核心思路：**要求请求携带一个攻击者无法获取的值。** 攻击者能让浏览器发请求，但**读不到你页面里的内容**（同源策略），所以拿不到 token。

### 方案 A：同步器令牌（服务端有状态）

```
1. 服务端生成随机 token，存进会话
2. 渲染表单时把它嵌进去：<input type="hidden" name="csrf_token" value="...">
3. 提交时比对表单里的和会话里的是否一致
```

最经典、最可靠。缺点是服务端要存状态，对无状态 API 不友好。

### 方案 B：双提交 Cookie（无状态）

```
1. 服务端下发一个随机值，同时写进 Cookie 和页面
2. 前端提交时把页面里的那份放进请求头：X-CSRF-Token
3. 服务端比对「请求头里的」和「Cookie 里的」是否一致
```

攻击者虽然能让浏览器带上 Cookie，但**无法设置自定义请求头**（跨站 fetch 加自定义头会触发 CORS 预检，而预检会被拒），所以对不上。

```javascript
// 前端
const token = document.cookie.match(/csrf_token=([^;]+)/)?.[1];
fetch('/api/transfer', {
  method: 'POST',
  headers: { 'X-CSRF-Token': token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ to, amount }),
});
```

::: warning
**朴素的双提交有个已知弱点**：如果攻击者能在你的域上**写 Cookie**（通过子域名接管，或者一个 Cookie 注入漏洞），他就能同时控制两边的值，让它们「对上」。

**加固方式：签名双提交**——Cookie 里放的不是裸随机值，而是 `HMAC(session_id, secret)`。这样攻击者即使能写 Cookie，也伪造不出对应当前会话的签名。
:::

### 方案 C：校验 Origin / Referer

```javascript
function checkOrigin(req) {
  const origin = req.headers.get('origin') ?? req.headers.get('referer');
  if (!origin) return false;              // 没有就拒绝，不要默认放行
  try {
    return new URL(origin).origin === 'https://example.com';
  } catch {
    return false;
  }
}
```

**要点是「缺失时拒绝」**。很多实现写成「有 Origin 就校验，没有就放行」——这等于告诉攻击者「把这个头去掉就行了」。

现代浏览器在跨站请求上会稳定发送 `Origin`，所以这个方案的可靠性比过去高很多。适合作为**额外一层**。

### 更简单的现代方案：Fetch Metadata

浏览器会自动带上 `Sec-Fetch-*` 系列头，且**这些头是「禁止修改的头」，脚本改不了**：

```javascript
function isSafeRequest(req) {
  const site = req.headers.get('sec-fetch-site');
  // same-origin / same-site / none(用户直接输入地址) 放行，cross-site 拒绝
  return !site || ['same-origin', 'same-site', 'none'].includes(site);
}
```

配合 `Sec-Fetch-Mode` 和 `Sec-Fetch-Dest` 能做得更精细。**这是目前最省事的一层防护**，因为完全由浏览器保证，不需要你管理 token。老浏览器不发这些头，所以需要配合其它方案兜底。

## 「用 JSON 就安全了」——一个危险的误解

常见说法：「我的 API 只接受 `Content-Type: application/json`，HTML 表单发不出这种请求，所以不用防 CSRF。」

**部分正确，但有两个致命前提**：

**前提一：服务端必须严格校验 Content-Type。**

HTML 表单能发出的 `Content-Type` 只有三种：`application/x-www-form-urlencoded`、`multipart/form-data`、`text/plain`。**但如果你的框架宽容地把 `text/plain` 的 body 也当 JSON 解析**，那么：

```html
<form action="https://example.com/api/transfer" method="POST" enctype="text/plain">
  <input name='{"to":"attacker","amount":10000,"x":"' value='"}'>
</form>
```

这个表单发出的 body 正好是一段合法 JSON。**防线就没了。**

```javascript
// 必须严格校验，不能宽容
if (!req.headers.get('content-type')?.startsWith('application/json')) {
  return new Response('Unsupported Media Type', { status: 415 });
}
```

**前提二：不能有任何一个接受表单编码的副作用接口。** 只要有一个遗漏（比如某个老的上传接口），整条防线就有缺口。

## 推荐组合

对大多数应用：

```
1. Cookie: HttpOnly; Secure; SameSite=Lax          ← 基础层，挡掉大部分
2. Sec-Fetch-Site 校验                              ← 现代浏览器免费的一层
3. 双提交 Token（签名版）或同步器令牌                 ← 兜底，覆盖老浏览器
4. 严格校验 Content-Type                            ← 防 text/plain 绕过
5. GET 绝不产生副作用                               ← 规范要求，也是安全要求
```

**第 5 条是纪律问题，不是技术问题**，但它挡掉的是 `SameSite=Lax` 唯一的大缺口。

## 验证

```bash
# 1. 检查 Cookie 属性
curl -sSI https://example.com/login -X POST -d "..." | grep -i set-cookie
# 期望看到 HttpOnly; Secure; SameSite=Lax

# 2. 模拟跨站请求（不带 token、带上 Origin）
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://example.com/api/transfer \
  -H "Origin: https://evil.com" \
  -H "Content-Type: application/json" \
  -d '{"to":"x","amount":1}' \
  --cookie "session=你的测试会话"
# 期望 403，返回 200 就有问题
```

**只在自己的测试账号上做这个验证。**

## 小结

- 根因是**浏览器自动携带 Cookie**；CSRF 只针对有副作用的请求。
- **`SameSite=Lax` 挡掉大部分，但有四个缺口**：GET 副作用接口、同站不等于同源（子域名接管）、老浏览器、必须用 `None` 的场景。
- Token 方案里，**双提交要用签名版**，朴素版会被 Cookie 写入能力击穿。
- **Origin/Fetch-Metadata 校验必须「缺失时拒绝」**。
- **「只收 JSON 就安全」需要严格校验 Content-Type**，否则 `enctype="text/plain"` 能构造出合法 JSON 绕过。
- 有 XSS 时一切 CSRF 防护失效，**先解决 XSS**。

下一章把该加的响应头一次性配齐。👉 [安全响应头](/manual/computer-programming/web-security/security-headers)
