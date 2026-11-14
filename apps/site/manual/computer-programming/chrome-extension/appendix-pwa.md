---
title: "PWA 开发指南"
description: "Chrome 插件开发指南 · 附录：渐进式 Web 应用（PWA）的核心概念、manifest、Service Worker 与扩展的选型边界"
source: "https://daiw.org/manual/chrome-extension/appendix-pwa"
---

# PWA 开发指南

Chrome 插件开发指南 · 附录：渐进式 Web 应用（PWA）的核心概念、manifest、Service Worker 与扩展的选型边界

**渐进式 Web 应用（Progressive Web App，PWA）** 是让普通网页具备「可安装、可离线、可推送」等类原生体验的一套 Web 标准。它和 Chrome 扩展共享部分技术名词（如 Service Worker），但**运行模型、分发渠道、能力边界**完全不同。本篇作为附录，帮你在「做扩展」之外判断何时该做 PWA，并给出最小可运行路径。

![PWA 成品：道雾记事本](https://daiw.org/screenshots/chrome-extension/appendix-pwa.webp)

_▲ 可安装、离线可用的记事本 PWA —— 页脚显示「SW: 已注册 ✓」_

::: info
本附录面向已读完 [扩展是什么](/manual/computer-programming/chrome-extension/what-is-extension) 的读者。PWA 不依赖 `chrome.*` API，可在任意现代浏览器上渐进增强。
:::

## 与 Chrome 扩展的边界

| 维度 | PWA | Chrome 扩展（MV3） |
| ---- | --- | ------------------ |
| 入口 | 用户访问 URL，可选「安装到桌面/开始菜单」 | `chrome://extensions` 或 Chrome Web Store |
| 清单文件 | `manifest.webmanifest`（Web App Manifest） | `manifest.json`（Extension Manifest） |
| 后台逻辑 | 页面域下的 **Web Service Worker** | 扩展域下的 **Extension Service Worker** |
| 改任意网站 DOM | 否（仅限自己的源） | 是（Content Script + `host_permissions`） |
| 拦截第三方请求 | 仅缓存自己源资源 | 是（`declarativeNetRequest` 等） |
| 审核 | 无商店审核（自托管） | Chrome Web Store 审核（若上架） |

**选型口诀**：能力要「钉」在别人的网站上 → 扩展或油猴；能力只在「自己的站点」且希望可安装、离线 → PWA。

## 最小 PWA 需要三件套

```
your-pwa/
├── index.html          # 可访问的 HTTPS 页面
├── manifest.webmanifest
├── sw.js               # Web Service Worker
└── icons/
    └── icon-192.png
```

1. **HTTPS**（`localhost` 开发除外）——Service Worker 只在安全上下文注册。
2. **Web App Manifest**——声明名称、图标、`start_url`、`display: standalone` 等。
3. **Service Worker**——负责离线缓存、推送（可选）、后台同步（可选）。

## manifest.webmanifest 示例

```json
{
  "name": "道雾记事本",
  "short_name": "记事本",
  "description": "离线可用的简易记事 PWA",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a1a2e",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

在 HTML 中链接：

```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#1a1a2e" />
```

## Web Service Worker：离线缓存

```javascript
// sw.js
const CACHE = 'notes-v1';
const ASSETS = ['/', '/index.html', '/app.js', '/styles.css'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)),
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request)),
  );
});
```

在页面注册（注意与扩展 SW **不是同一个 API 命名空间**）：

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

## 安装提示（beforeinstallprompt）

Chrome 在满足 PWA 安装条件时触发 `beforeinstallprompt`，可自定义安装按钮：

```javascript
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('install-btn').hidden = false;
});

document.getElementById('install-btn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
});
```

::: warning
iOS Safari 对 PWA 安装与推送的支持与 Chrome 不同；若主要面向国内移动端，需单独验证「添加到主屏幕」与离线行为。
:::

## 例子：同一功能两种实现

**需求**：给用户一个「随时打开的 Todo 列表」。

| 方案 | 做法 | 优点 | 缺点 |
| ---- | ---- | ---- | ---- |
| PWA | 部署 `https://todo.example.com`，用户安装到桌面 | 无需商店审核、跨浏览器、迭代快 | 不能自动注入 GitHub 页面 |
| 扩展 | Popup + `chrome.storage` | 工具栏一键打开、可读写指定站点 | 需打包、上架要审核 |

若 Todo 只服务你自己的域名，**PWA 更轻**；若要在 `github.com` 旁路显示项目 Todo，**只能扩展或油猴**。

## 与扩展技术的易混点

1. **两个 Service Worker**——PWA 的 SW 挂在 `https://your-domain/sw.js`；扩展 SW 挂在 `chrome-extension://<id>/service-worker.js`，API 面有 `chrome.*` 扩展专用接口。
2. **两个 manifest**——`manifest.webmanifest`（W3C）与 `manifest.json`（Chrome Extension）字段名部分重叠（`name`、`icons`），**不可混用文件**。
3. **存储**——PWA 用 IndexedDB / Cache API / localStorage；扩展用 `chrome.storage` 且可跨设备 sync。

## 常见误区

1. **「PWA 能替代扩展」**——不能跨站改 DOM、不能声明 `host_permissions` 级别的网络拦截。
2. **「注册了 SW 就等于 PWA」**——还需有效 manifest + 图标 + `start_url`，且站点的 [Lighthouse PWA 检查](https://developer.chrome.com/docs/lighthouse/pwa/) 才会通过安装条件。
3. **「PWA 一定能离线」**——取决于 SW 缓存策略；默认 `fetch` 仍可能回源失败。

## 调试与验收

- Chrome DevTools → **Application** 面板：查看 Manifest、Service Workers、Cache Storage。
- **Lighthouse** → PWA 类别：检查可安装性与离线能力。
- `chrome://apps`：查看已安装的 PWA（与扩展分开管理）。

## 延伸阅读

- [MDN：渐进式 Web 应用](https://developer.mozilla.org/zh-CN/docs/Web/Progressive_web_apps)
- [web.dev：PWA 清单](https://web.dev/articles/add-manifest)
- 本站对比入门：[扩展是什么](/manual/computer-programming/chrome-extension/what-is-extension)

## 小结

PWA 是**自有站点上的可安装 Web 应用**，用 Web Manifest + Web Service Worker 实现离线与应用壳体验；Chrome 扩展是**浏览器级特权程序**，可跨站注入与拦截。先问「功能是否只服务我的域名」——是则优先 PWA，否则回到扩展或 [油猴脚本](/manual/computer-programming/chrome-extension/appendix-userscript) 路线。

← 回到：[专栏首页](/manual/computer-programming/chrome-extension/)
