---
title: "前端供应链"
description: "你页面上的第三方脚本拥有和你自己代码完全相同的权限——SRI 怎么用、为什么它对统计脚本不适用、以及用沙箱 iframe 和 CSP 把第三方关进笼子的实际做法。"
source: "https://daiw.org/manual/web-security/frontend-supply-chain"
---

# 前端供应链

你页面上的第三方脚本拥有和你自己代码完全相同的权限——SRI 怎么用、为什么它对统计脚本不适用、以及用沙箱 iframe 和 CSP 把第三方关进笼子的实际做法。

一个残酷的事实：

> **你页面上的每一个第三方脚本，都拥有和你自己代码完全相同的权限。** 它能读取页面上的任何数据、修改任何 DOM、发起任何请求、读取非 HttpOnly 的 Cookie。

一个统计脚本、一个客服插件、一个字体加载器——**任何一个被投毒，你的整站就被投毒了**。而且这类攻击极难发现：页面看起来一切正常。

## 攻击是怎么发生的

| 路径 | 说明 |
| --- | --- |
| **CDN 被攻破** | 直接篡改托管的 JS 文件 |
| **服务商自己作恶或被收购** | 免费插件被卖给别人，新东家加了埋点甚至恶意代码 |
| **npm 包投毒** | 维护者账号被盗，或恶意 PR 被合并，随构建打进你的产物 |
| **域名过期被抢注** | 你引的某个小众库的域名到期，别人注册了它 |
| **子资源被替换** | 引用的是 `latest` 或某个可变 tag，内容悄悄变了 |

::: warning
**「引用 `@latest` 或不带版本号」是最常见也最危险的做法**：

  ```html
  <!-- ❌ 内容随时可能变，你完全不知道 -->
  <script src="https://cdn.example.com/lib/latest/lib.min.js"></script>
  ```

你今天审计过的代码，明天可能就是另一份。**永远锁定具体版本**，并配合下面的 SRI。
:::

## SRI：子资源完整性

SRI 让浏览器在执行外部资源前**校验它的哈希**，对不上就拒绝加载。

```html
<script
  src="https://cdn.example.com/lib/1.2.3/lib.min.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
  crossorigin="anonymous"
></script>
```

生成哈希：

```bash
curl -s https://cdn.example.com/lib/1.2.3/lib.min.js \
  | openssl dgst -sha384 -binary \
  | openssl base64 -A
```

`crossorigin="anonymous"` 是**必须的**——没有它，浏览器拿不到跨源资源的完整内容来校验，SRI 会静默失效。

::: warning
**SRI 对「内容会变的脚本」不适用**，这是它最大的局限。

统计脚本（Google Analytics、百度统计）、A/B 测试、客服widget、广告——**这些服务的 JS 文件本来就在持续更新**。你锁死哈希，明天它更新了，脚本直接加载失败，功能全挂。

所以现实是：**最需要防护的那类第三方脚本，恰恰是 SRI 用不上的。** 这时只能靠下面几种手段。
:::

## 自托管：最彻底的一招

对**行为稳定**的库（框架、UI 库、字体、图标），最好的做法是**不用第三方 CDN，全部自托管**：

```bash
# 下载并纳入自己的构建产物
npm install some-lib
# 或者直接下载文件放进 public/
```

好处不止安全：

| 维度 | 自托管 | 第三方 CDN |
| --- | --- | --- |
| 供应链风险 | **没有** | 有 |
| 可用性 | 和你的站同生共死 | 多一个故障点 |
| 隐私 | 不泄露用户 IP 给第三方 | 泄露 |
| 国内可访问性 | **可控** | 很多境外 CDN 在国内不稳定 |
| 缓存收益 | 无跨站共享 | 曾经有，**现在已被浏览器的缓存分区消除** |

::: info
**「用公共 CDN 能共享缓存」这个理由已经过时了。** 现代浏览器为了防止跨站追踪，都实现了**缓存分区（cache partitioning）**——不同站点即使引用同一个 URL，也不共享缓存。

这意味着公共 CDN 的最大卖点消失了，而风险还在。**本站（daiw）的做法就是全部自托管**，字体走 `next/font` 构建期下载，理由既有安全也有国内可访问性。
:::

## 用 CSP 限制第三方能做什么

即使必须引入第三方脚本，也能限制它的能力：

```
Content-Security-Policy:
  script-src 'self' https://trusted-analytics.com;
  connect-src 'self' https://api.example.com https://trusted-analytics.com;
  form-action 'self';
```

**`connect-src` 是这里的关键**：即使第三方脚本被投毒，它想把窃取的数据发到攻击者的服务器，也会被 CSP 拦下——**数据出不去，危害就小得多**。

配合 CSP 的报告端点，你还能**发现**第三方脚本在偷偷往哪发数据：

```
report-uri /api/csp-report
```

真实经历里，很多团队上了 CSP 报告后才发现某个「统计脚本」在往三四个不同的域名发请求。

## 沙箱 iframe：把第三方关进笼子

对于需要展示但不需要访问你页面数据的第三方内容（广告、嵌入式内容、富文本预览），用沙箱 iframe：

```html
<iframe
  src="https://third-party.example.com/widget"
  sandbox="allow-scripts allow-popups"
  referrerpolicy="no-referrer"
  loading="lazy"
></iframe>
```

`sandbox` 属性是**白名单式**的——不写任何值就是「什么都不允许」，然后按需放开：

| 值 | 放开什么 |
| --- | --- |
| `allow-scripts` | 允许执行 JS |
| `allow-forms` | 允许提交表单 |
| `allow-popups` | 允许 `window.open` |
| `allow-same-origin` | **保留其源**——⚠️ 见下方警告 |

::: warning
**`allow-scripts` 和 `allow-same-origin` 同时出现，沙箱基本失效。**

因为有了 `allow-same-origin`，iframe 里的内容和父页面同源；再有 `allow-scripts`，它就能通过 `parent.document` 直接操作父页面——**它可以自己把 sandbox 属性删掉**。

这两个只能选一个。展示第三方内容时，**绝不要给 `allow-same-origin`**。
:::

## npm 依赖：构建期的供应链

前面讲的是运行时加载的脚本，还有一类是**构建时打进产物的 npm 包**。它同样是前端供应链的一部分，而且更隐蔽——**用户看到的是你的域名下的一个 bundle 文件，看不出里面有第三方代码**。

几条实用纪律：

**一、锁定版本，提交 lockfile。**

```bash
# CI 里必须用 frozen-lockfile，禁止自动升级
pnpm install --frozen-lockfile
```

**二、警惕 postinstall 脚本。** 这是投毒最常用的执行点：

```bash
# 装依赖时不跑生命周期脚本（需要的包单独放行）
pnpm install --ignore-scripts
```

**三、注意抢注（typosquatting）。** `crossenv` vs `cross-env`、`lodahs` vs `lodash`——安装前看清楚包名和周下载量。

**四、审计新增依赖。** 加一个包之前问三个问题：**它有多少维护者？最近更新是什么时候？它自己又依赖了多少东西？** 一个为了省 20 行代码而引入的包，可能带来 50 个传递依赖。

[依赖审计那一章](/manual/computer-programming/web-security/dependency-audit)会展开讲怎么系统地做这件事。

## 定期盘点你的第三方

很多站点根本不知道自己加载了多少外部资源。跑一次就知道了：

```bash
# 列出页面加载的所有外部域名
curl -s https://example.com/ \
  | grep -oE '(src|href)="https?://[^"]+"' \
  | grep -oE 'https?://[^/"]+' \
  | sort -u
```

浏览器 DevTools 的 Network 面板按域名分组看更全（能抓到 JS 动态插入的请求）。

**对每一个外部域名问**：

- 它是干什么的？还需要吗？
- 能不能自托管？
- 它能不能被 SRI 锁定？
- 它在 CSP 的 `connect-src` 里吗？

**「还需要吗」这一问经常有惊喜**——很多站上挂着几年前接的、早就不看数据的统计脚本。**删掉一个不用的第三方，是最彻底的加固。**

## 小结

- 第三方脚本与你的代码**权限完全相同**，一个被投毒 = 整站被投毒。
- **永远锁定版本**，别用 `latest`。
- **SRI 只适用于内容不变的资源**；统计、客服、广告这类恰恰用不了。
- **自托管是最彻底的方案**，且「公共 CDN 共享缓存」的理由已被缓存分区消除。
- 必须引第三方时，用 **CSP 的 `connect-src` 限制数据外传**，用**沙箱 iframe** 隔离展示型内容。
- **`allow-scripts` + `allow-same-origin` 同时给 = 沙箱失效。**
- 定期盘点外部域名，**删掉不用的第三方是最彻底的加固**。

第四部分结束。下一部分回到服务端。👉 [注入：一个根因，多种形态](/manual/computer-programming/web-security/injection)
