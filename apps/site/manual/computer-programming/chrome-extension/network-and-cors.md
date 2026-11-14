---
title: "网络与 CORS"
description: "Chrome 插件开发指南 · fetch、host_permissions、扩展页跨域"
source: "https://daiw.org/manual/chrome-extension/network-and-cors"
---

# 网络与 CORS

Chrome 插件开发指南 · fetch、host_permissions、扩展页跨域

扩展的网络能力是它相对网页最大的特权之一：**在有 `host_permissions` 的前提下，扩展页面与 [Service Worker](/manual/computer-programming/chrome-extension/service-worker) 的 `fetch` 不受 CORS 限制**。但这个特权有明确的边界，而且 MV3 改过一次规则。

## 三个上下文，三种网络行为

| 发起方 | 请求的 Origin | 受 CORS 限制 | 需要什么 |
| ------ | ------------- | ------------ | -------- |
| **Service Worker** | 扩展自身 | **否** | `host_permissions` |
| **扩展页面**（popup / options / side panel） | 扩展自身 | **否** | `host_permissions` |
| **[Content Script](/manual/computer-programming/chrome-extension/content-scripts)** | **所在网页** | **是** | 目标站点的 CORS 头 |

::: warning
**MV3 改了 content script 的网络行为，这是迁移时的高频坑。**

MV2 里 content script 的 `fetch` 也能享受扩展权限、绕过 CORS。**MV3 取消了这个特权**——CS 的请求现在按它所在网页的 origin 走，和页面自己的 `fetch` 没区别。

所以从 MV2 抄来的这类代码会突然报 CORS 错误：

  ```javascript
  // content.js —— MV2 能跑，MV3 报 CORS
  const r = await fetch('https://api.example.com/data');
  ```

**正确做法是让 SW 代发**：

  ```javascript
  // content.js
  const data = await chrome.runtime.sendMessage({ type: 'FETCH', url: '…' });
  ```

  ```javascript
  // background.js
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'FETCH') {
      fetch(msg.url).then((r) => r.json()).then(sendResponse);
      return true;                      // 别忘了
    }
  });
  ```
:::

这个「CS 当手、SW 当网络出口」的分工，和[消息传递](/manual/computer-programming/chrome-extension/messaging)那章说的是同一件事。

## host_permissions

```json
{
  "host_permissions": [
    "https://api.example.com/*",
    "https://*.mycdn.com/*"
  ]
}
```

**没有对应的 `host_permissions`，SW 的 `fetch` 同样会被 CORS 挡住**——特权来自权限声明，不是来自「我是扩展」。

### 写得越窄越好

| 写法 | 安装提示 | 建议 |
| ---- | -------- | ---- |
| `https://api.example.com/*` | 「读取和更改你在 api.example.com 上的数据」 | ✅ 首选 |
| `https://*.example.com/*` | 同上，范围更大 | 可接受 |
| `https://*/*` | **「读取和更改你在所有网站上的数据」** | ⚠️ 装机转化率杀手 |
| `<all_urls>` | 同上，还包含 file:// | ⚠️ 审核重点关照 |

宽权限的代价是双重的：**用户在安装页看到吓人的提示会流失**，而且 Chrome Web Store 会要求你说明为什么需要。详见[权限模型](/manual/computer-programming/chrome-extension/permissions)。

### 运行时申请

```json
{ "optional_host_permissions": ["https://*/*"] }
```

```javascript
const granted = await chrome.permissions.request({
  origins: ['https://api.example.com/*'],
});
if (!granted) return;
```

**必须在用户手势里调用**（点击事件回调中），否则直接被拒。这是「用到才要」的最佳实践——安装时只要最小集，用户启用某功能时再申请。

## 认证与凭据

```javascript
// 默认不带目标站的 cookie
await fetch('https://api.example.com/me');

// 带上 cookie
await fetch('https://api.example.com/me', { credentials: 'include' });
```

`credentials: 'include'` 会带上目标站的 cookie——**这是扩展能做而网页做不到的事**（跨站 cookie）。需要 `host_permissions` 覆盖该域。

::: warning
**别把 API key 硬编码在扩展里。** 扩展包是明文的，用户随时能解压查看——`chrome://extensions` 开发者模式下点几下就能看到你的源码。

已经泄露过无数次的写法：

  ```javascript
  const API_KEY = 'sk-xxxxxxxx';    // 全世界都能看到
  ```

正确做法：**让用户填自己的 key**（存 [`chrome.storage`](/manual/computer-programming/chrome-extension/storage)），或者在你的服务端做中转、扩展只调你的接口。
:::

## 请求头能改吗

`fetch` 里能设的头受浏览器限制，`Origin`、`Referer`、`User-Agent` 等**禁止头**改不了。

要改这些，用 [declarativeNetRequest](/manual/computer-programming/chrome-extension/declarative-net-request) 的 `modifyHeaders`：

```json
{
  "id": 1,
  "priority": 1,
  "action": {
    "type": "modifyHeaders",
    "requestHeaders": [
      { "header": "X-My-Header", "operation": "set", "value": "1" }
    ]
  },
  "condition": { "urlFilter": "||api.example.com", "resourceTypes": ["xmlhttprequest"] }
}
```

**MV3 里 `webRequest` 的阻塞式修改已被移除**，改头一律走 DNR。

## 扩展页面里的图片与 iframe

扩展页面（`chrome-extension://`）加载外部资源，受 [CSP](/manual/computer-programming/chrome-extension/content-security) 而非 CORS 约束：

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; img-src 'self' https://cdn.example.com data:;"
  }
}
```

**默认 CSP 允许图片来自任意 https 源**，但**脚本只能来自 `'self'`**——不能从 CDN 引 JS，这条不可放宽。所有依赖必须打包进扩展。

## 调试网络问题

不同上下文的请求出现在**不同的 DevTools 里**，这是排查时最容易迷路的地方：

| 请求来自 | 去哪看 |
| -------- | ------ |
| Service Worker | `chrome://extensions` → 点「Service Worker」→ Network |
| Popup | 右键 popup → 检查 → Network |
| Content Script | **所在网页的** DevTools → Network |

::: info
**在网页 DevTools 里找不到 SW 发的请求，是正常的**——它们不属于那个页面。反过来也一样。

「请求好像没发出去」的第一步永远是：**确认你打开的是正确那个 DevTools**。
:::

更多手段见[调试](/manual/computer-programming/chrome-extension/debugging)。

## 常见错误对照

| 错误 | 原因 |
| ---- | ---- |
| `has been blocked by CORS policy` | 在 CS 里发请求（MV3 不再有特权），或缺 `host_permissions` |
| `Failed to fetch` | 网络不通、被 DNR 规则拦了、或目标要 mTLS |
| `Refused to connect ... violates CSP` | 扩展页面的 `connect-src` 太严 |
| `Refused to load the script` | 试图从外部 CDN 加载 JS，扩展里不允许 |

## 小结

- **SW 与扩展页面的 `fetch` 不受 CORS 约束**，前提是有 `host_permissions`。
- **MV3 取消了 content script 的网络特权**——CS 的请求按网页 origin 走，要绕就让 SW 代发。
- `host_permissions` **写得越窄越好**，宽权限直接影响安装转化率；能延后就用 `optional_host_permissions` + 用户手势申请。
- **绝不硬编码 API key**——扩展包是明文的。
- 改 `Origin` / `Referer` 等禁止头要用 **DNR 的 `modifyHeaders`**。
- 扩展页面**不能从外部 CDN 加载脚本**，依赖必须打包。
- 排查时先确认**打开的是哪个 DevTools**。

下一篇：[权限模型](/manual/computer-programming/chrome-extension/permissions)。
