---
title: "CSP：从报告模式到严格模式"
description: "白名单式 CSP 早已被证明容易绕过——基于 nonce 与 strict-dynamic 的严格 CSP 才是现代答案。附完整的四阶段落地路径、Next.js 实现和常见踩坑。"
source: "https://daiw.org/manual/web-security/csp"
---

# CSP：从报告模式到严格模式

白名单式 CSP 早已被证明容易绕过——基于 nonce 与 strict-dynamic 的严格 CSP 才是现代答案。附完整的四阶段落地路径、Next.js 实现和常见踩坑。

CSP（内容安全策略）是一个响应头，告诉浏览器**「这个页面只允许从哪些地方加载哪些东西」**。它是 XSS 纵深防御里最有价值的一层：**即使攻击者成功注入了脚本，CSP 也能让它执行不了、或者数据传不出去**。

## 白名单式 CSP 的问题

大多数教程教你这么写：

```
Content-Security-Policy: script-src 'self' https://cdn.example.com https://www.google-analytics.com
```

看起来很严谨，实际上**大概率可以被绕过**。研究者对上百万个真实站点的 CSP 做过分析，结论是**绝大多数白名单 CSP 存在可利用的绕过路径**。

原因有三：

**一、白名单域名上常常有 JSONP 接口。**

```html
<!-- cdn 在白名单里，但它有个 JSONP 接口 -->
<script src="https://cdn.example.com/api/jsonp?callback=alert(1)"></script>
```

CSP 检查通过（域名在白名单里），但回调参数让攻击者执行了任意代码。

**二、白名单域名上托管着有漏洞的库。**
很多 CDN 提供各版本的 AngularJS 等框架，攻击者加载一个旧版本，用它的模板注入能力绕过 CSP。

**三、`'unsafe-inline'` 一旦出现，CSP 基本作废。**
而很多站为了兼容内联脚本，不得不加上它。

::: warning
**加了 `'unsafe-inline'` 的 `script-src`，防 XSS 的作用趋近于零。** 因为 XSS 注入的正是内联脚本。你可能觉得「至少还挡住了外部脚本」——但攻击者根本不需要外部脚本，内联就够干所有事。

如果你的 CSP 里有 `script-src ... 'unsafe-inline'`，请把它当作「暂时没有 CSP」来对待。
:::

## 严格 CSP：nonce + strict-dynamic

现代推荐做法：

```
Content-Security-Policy:
  script-src 'nonce-{每次请求随机} ' 'strict-dynamic' https: 'unsafe-inline';
  object-src 'none';
  base-uri 'none';
  require-trusted-types-for 'script';
```

逐项解释：

| 指令 | 作用 |
| --- | --- |
| `'nonce-xxx'` | **只有带正确 nonce 属性的 script 标签才能执行**。nonce 每次请求随机生成，攻击者猜不到 |
| `'strict-dynamic'` | 被信任的脚本动态创建的脚本也自动受信——**这让白名单变得不必要**，解决了第三方库动态加载子资源的问题 |
| `https:` 与 `'unsafe-inline'` | **只是给不支持 `strict-dynamic` 的老浏览器兜底**。支持的浏览器会忽略它们 |
| `object-src 'none'` | 禁掉 Flash/Java 等插件，它们是老牌绕过途径 |
| `base-uri 'none'` | **关键但常被漏掉**：防止攻击者注入 `<base href="//evil.com">` 把所有相对路径的脚本源改掉 |

用法：

```html
<script nonce="r4nd0m-per-request">...</script>
<script nonce="r4nd0m-per-request" src="/app.js"></script>
```

::: warning
**nonce 必须满足三个条件，缺一不可：**

1. **每次响应重新生成**（不是每次部署，是每个请求）；
2. **足够随机**（至少 128 bit，用密码学安全的随机源）；
3. **页面不能被缓存**，否则 nonce 会跟着缓存一起被复用，等于公开。

第三条最容易踩：**静态站点用 nonce 是有问题的**——HTML 被 CDN 缓存后，所有用户拿到同一个 nonce，攻击者只要访问一次就知道它了。

**静态站点的替代方案是 hash**：`script-src 'sha256-...'`，把每个内联脚本的哈希列进去。构建工具通常能自动生成。
:::

## 四阶段落地

CSP 直接上强制模式几乎必然打断线上功能。**必须分阶段。**

### 阶段一：只报告，不拦截

```
Content-Security-Policy-Report-Only:
  script-src 'self';
  report-uri /api/csp-report
```

用 `-Report-Only` 头，浏览器**只上报违规、不阻止任何东西**。跑一到两周，收集报告。

接收端点：

```javascript
// app/api/csp-report/route.ts
export async function POST(req: Request) {
  const report = await req.json();
  console.warn('[CSP violation]', {
    documentUri: report['csp-report']?.['document-uri'],
    blockedUri:  report['csp-report']?.['blocked-uri'],
    directive:   report['csp-report']?.['violated-directive'],
  });
  return new Response(null, { status: 204 });
}
```

::: info
**报告端点会收到大量噪音**，做好心理准备。主要来源是**浏览器扩展**注入的脚本、运营商劫持插入的内容、以及各种 App 内置浏览器的注入。

过滤技巧：`blocked-uri` 为 `chrome-extension://`、`moz-extension://`、`about:` 之类的一律忽略。剩下的才值得看。
:::

### 阶段二：按报告调整

看报告里被拦的都是什么：

- **是你自己的合法资源** → 加 nonce 或调整指令
- **是第三方服务** → 决定是加进策略还是干脆去掉这个依赖
- **是扩展/劫持** → 忽略

这个阶段的产出是一份「真实需要的资源清单」。**顺带一提，这个清单本身就很有价值**——很多团队第一次做 CSP 时，才发现自己的页面在加载十几个不知道哪来的第三方脚本。

### 阶段三：强制，但先从宽松开始

把 `-Report-Only` 去掉，同时**保留 `report-uri`**——强制模式下也能继续收报告，这样才知道你误伤了谁。

```
Content-Security-Policy:
  script-src 'nonce-xxx' 'strict-dynamic' https: 'unsafe-inline';
  object-src 'none';
  base-uri 'none';
  report-uri /api/csp-report
```

### 阶段四：逐步收紧

稳定运行后，再逐条加严：`style-src`、`img-src`、`connect-src`、`frame-ancestors`、`require-trusted-types-for`。

## 一份完整的现代策略

```
Content-Security-Policy:
  default-src 'self';
  script-src 'nonce-{RANDOM}' 'strict-dynamic' https: 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'none';
  object-src 'none';
  upgrade-insecure-requests;
  report-uri /api/csp-report
```

几个说明：

- **`style-src` 里的 `'unsafe-inline'`** 是现实妥协。CSS 注入的危害远小于 JS（主要是数据外传和界面伪装），而绝大多数框架都会产生内联样式。**先接受它，把精力放在 `script-src` 上**。
- **`connect-src`** 很重要：它限制 `fetch`/`XHR`/WebSocket 能往哪发。**即使 XSS 成功执行了，这一条也能阻止数据被传到攻击者的服务器**——这是 CSP 兜底价值最直接的体现。
- **`frame-ancestors 'none'`** 取代了老的 `X-Frame-Options`，防点击劫持。
- **`form-action 'self'`** 防止注入的表单把用户输入提交到外部。

## Next.js 里的实现

因为 nonce 要每次请求生成，需要在 middleware 里做：

```typescript
// middleware.ts
import { NextResponse } from 'next/server';

export function middleware(request: Request) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const csp = [
    `default-src 'self'`,
    `script-src 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'none'`,
    `object-src 'none'`,
  ].join('; ');

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);          // 传给页面使用

  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}
```

::: warning
**全静态站（SSG）用不了这个方案**——没有请求期的中间件，也不该有。静态站的正确选择是：

- 用 **hash 方式**（构建时算出所有内联脚本的 sha256），或者
- **干脆不用内联脚本**，全部走外部文件 + `script-src 'self'`。

第二条更简单也更彻底。如果你的站点能做到「零内联脚本」，`script-src 'self'` 就是一条又短又强的策略。
:::

## 验证

```bash
# 看看线上到底下发了什么策略
curl -sSI https://example.com/ | grep -i content-security-policy

# 检查有没有致命的 unsafe-inline（在 script-src 里）
curl -sSI https://example.com/ | grep -i "content-security-policy" | grep -o "script-src[^;]*"
```

浏览器控制台是最好的调试工具——违规会以明确的错误信息打印出来，告诉你哪条指令拦了什么。

## 小结

- **白名单式 CSP 大多可绕过**（JSONP、旧版库、`'unsafe-inline'`）。
- 现代答案是 **nonce + `strict-dynamic`**，配合 `object-src 'none'` 与 `base-uri 'none'`。
- **nonce 必须每请求随机且页面不可缓存**；静态站应改用 hash 或彻底去掉内联脚本。
- 必须走**四阶段**：report-only → 调整 → 强制（保留报告）→ 逐步收紧。
- **`connect-src` 是 XSS 兜底的关键**：脚本跑起来了，数据也传不出去。
- 报告端点噪音大，先过滤掉浏览器扩展。

下一章讲另一类跨站问题。👉 [CSRF 与 SameSite](/manual/computer-programming/web-security/csrf)
