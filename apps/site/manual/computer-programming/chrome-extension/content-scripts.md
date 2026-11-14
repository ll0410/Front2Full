---
title: "Content Scripts"
description: "Chrome 插件开发指南 · 匹配规则、run_at、隔离世界、CSS 注入"
source: "https://daiw.org/manual/chrome-extension/content-scripts"
---

# Content Scripts

Chrome 插件开发指南 · 匹配规则、run_at、隔离世界、CSS 注入

Content Script 是唯一能碰到网页 DOM 的上下文。它跑在页面里，却又不完全属于页面——**这个「半在半不在」的状态，是它所有特性和限制的来源**。

## 隔离世界

```text
        同一个标签页
┌────────────────────────────────────┐
│  页面 JS 世界        CS 隔离世界     │
│  ┌──────────┐       ┌──────────┐   │
│  │ window.a │       │ window.a │   │  ← 两个不同的 window
│  │ jQuery   │  ✗    │ （看不到）│   │  ← 变量互不可见
│  └────┬─────┘       └────┬─────┘   │
│       │                  │          │
│       └────► 同一个 DOM ◄┘          │  ← DOM 是共享的
└────────────────────────────────────┘
```

**DOM 共享，JS 环境隔离。**

这意味着：

- ✅ 你能读改页面上任何元素、加事件监听、插入节点。
- ❌ 你**看不到**页面定义的 `window.jQuery`、`window.__INITIAL_STATE__` 等变量。
- ❌ 页面也看不到你的变量——所以不必担心和页面脚本重名。

::: info
**隔离世界是安全设计，不是限制。** 如果 CS 和页面共享 JS 环境，恶意网页就能覆写你的函数、窃取你的 `chrome.*` 调用权限。隔离让页面无法干涉扩展逻辑。

代价是「读页面变量」变麻烦了——下面讲怎么绕。
:::

### 要读页面的 JS 变量怎么办

注入一个真正跑在页面世界里的 `<script>`，用 `postMessage` 把数据传回来：

```javascript
// content.js —— 隔离世界
const s = document.createElement('script');
s.src = chrome.runtime.getURL('injected.js');
s.onload = () => s.remove();
(document.head || document.documentElement).appendChild(s);

window.addEventListener('message', (e) => {
  if (e.source !== window || e.data?.from !== 'my-ext') return;
  console.log('拿到页面变量：', e.data.payload);
});
```

```javascript
// injected.js —— 页面世界，能看到 window 上的一切
window.postMessage({ from: 'my-ext', payload: window.__INITIAL_STATE__ }, '*');
```

`injected.js` 必须在 manifest 里声明为可访问资源：

```json
{
  "web_accessible_resources": [
    { "resources": ["injected.js"], "matches": ["https://*.example.com/*"] }
  ]
}
```

::: warning
**`window.postMessage` 是页面能看到的。** 任何脚本都能监听它，也能伪造消息。别用它传 token 之类的敏感数据，收到消息时也要校验 `e.source === window` 和自定义标识。
:::

现代的替代方案是 [Scripting API](/manual/computer-programming/chrome-extension/scripting-api) 的 `world: 'MAIN'`——直接把函数注入页面世界，不用中转文件。

## 匹配规则

```json
{
  "content_scripts": [{
    "matches": ["https://*.example.com/*"],
    "exclude_matches": ["https://admin.example.com/*"],
    "js": ["content.js"]
  }]
}
```

### match pattern 语法

```text
<scheme>://<host><path>
```

| 模式 | 匹配 | 不匹配 |
| ---- | ---- | ------ |
| `https://*/*` | 所有 https 站点 | http 站点 |
| `https://*.example.com/*` | `example.com`、`a.example.com` | `notexample.com` |
| `https://example.com/*` | 仅该主机 | 任何子域 |
| `*://*/*` | 所有 http + https | `file://`、`chrome://` |
| `<all_urls>` | 所有 scheme（含 file、ftp） | — |

三条容易踩的规则：

1. **路径部分必填。** `https://example.com` 非法，必须写成 `https://example.com/*`。
2. **`*.example.com` 也匹配裸域** `example.com` 本身——这和 DNS 通配符的直觉不同。
3. **`chrome://` 页面永远注入不了**，`chromewebstore.google.com`（及旧版 `chrome.google.com/webstore`）等商店域也被禁止，无论怎么配。

### 其他过滤字段

| 字段 | 作用 |
| ---- | ---- |
| `exclude_matches` | 排除子集 |
| `include_globs` / `exclude_globs` | 在 matches 结果上再用 glob 过滤（可匹配 query） |
| `all_frames` | 是否注入 iframe，默认 `false` |
| `match_about_blank` | 是否注入 `about:blank` 框架 |
| `match_origin_as_fallback` | 注入由 blob / data URL 创建的框架 |

::: info
**`all_frames: true` 的代价常被低估。** 一个页面可能有几十个 iframe（广告位、追踪像素、嵌入播放器），每个都会跑一份你的脚本。

先问自己：真的需要处理 iframe 吗？如果只是想覆盖某些嵌套页面，用 `all_frames: true` + 在脚本开头判断 `location.href` 精确退出，比无差别注入好。
:::

## run_at：注入时机

| 值 | 时机 | 此时 DOM |
| -- | ---- | -------- |
| `document_start` | CSS 已加载，**DOM 构建前** | `document.body` 可能是 `null` |
| `document_end` | DOM 构建完，图片等资源未必到 | 完整可用 |
| `document_idle` | 默认；`document_end` 与 `window.onload` 之间 | 完整可用 |

```json
{ "run_at": "document_start" }
```

**什么时候用 `document_start`：** 需要**抢在页面脚本之前**做事——比如覆写 `window.fetch`、拦截即将执行的内联脚本、在页面渲染前隐藏元素（防闪烁）。

```javascript
// document_start 下必须自己等 DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

**默认用 `document_idle` 就好**——Chrome 会挑一个「页面已可用但还不忙」的时机，对性能最友好。

## CSS 注入

```json
{
  "content_scripts": [{
    "matches": ["https://*.example.com/*"],
    "css": ["content.css"]
  }]
}
```

CSS 在 `document_start` 就注入（无视 `run_at`），所以**不会有样式闪烁**。

::: warning
**CSS 不隔离。** 与 JS 不同，注入的样式和页面样式在同一个层叠上下文里——你的 `div { margin: 0 }` 会命中整个页面。

两条纪律：

1. **所有选择器加唯一前缀**：`.myext-panel` 而不是 `.panel`。
2. UI 复杂时用 **Shadow DOM** 彻底隔离：

  ```javascript
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>${css}</style><div class="panel">…</div>`;
  document.body.appendChild(host);
  ```

Shadow DOM 里的样式进不去也出不来，是注入复杂 UI 的标准做法。
:::

## 能用哪些 chrome API

CS 里 `chrome` 对象存在，但**只有一小部分可用**：

| 可用 | 不可用 |
| ---- | ------ |
| `chrome.runtime.sendMessage` / `connect` / `getURL` / `id` | `chrome.tabs.*` |
| `chrome.storage.*` | `chrome.scripting.*` |
| `chrome.i18n.*` | `chrome.cookies.*` |
| `chrome.dom.openOrClosedShadowRoot` | 其余绝大多数 |

**需要别的能力，就发消息让 [Service Worker](/manual/computer-programming/chrome-extension/service-worker) 代劳**：

```javascript
// content.js
const tabs = await chrome.runtime.sendMessage({ type: 'QUERY_TABS' });
```

```javascript
// background.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'QUERY_TABS') {
    chrome.tabs.query({}).then(sendResponse);
    return true;
  }
});
```

这个「CS 当手、SW 当脑」的分工是扩展的基本架构，详见[消息传递](/manual/computer-programming/chrome-extension/messaging)。

## SPA 的路由变化

单页应用切换路由时**不会重新注入** CS——脚本只在真实的页面加载时跑一次。

```javascript
// 监听 SPA 路由变化
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    onRouteChange();
  }
}).observe(document, { subtree: true, childList: true });
```

更省资源的做法是在 SW 里监听 `chrome.webNavigation.onHistoryStateUpdated`，再通知 CS。

## 小结

- **DOM 共享、JS 隔离**——这是 CS 的定义性特征，也是安全边界。
- 读页面变量要**注入页面世界**（`<script>` + `postMessage`，或 `world: 'MAIN'`）。
- match pattern **路径必填**，`*.example.com` 含裸域，`chrome://` 永远不可注入。
- `run_at` 默认 `document_idle`；要抢在页面脚本前用 `document_start`（此时得自己等 DOM）。
- **CSS 不隔离**——加前缀，或者上 Shadow DOM。
- CS 只能用少数 `chrome.*` API，其余找 Service Worker 代办。
- SPA 换路由不会重新注入，得自己监听。

下一篇：[Popup 与选项页](/manual/computer-programming/chrome-extension/popup-and-ui)。
