---
title: "扩展是什么"
description: "Chrome 插件开发指南 · Chrome 扩展与网页、PWA、用户脚本的区别，以及 MV3 下的运行上下文"
source: "https://daiw.org/manual/chrome-extension/what-is-extension"
---

# 扩展是什么

Chrome 插件开发指南 · Chrome 扩展与网页、PWA、用户脚本的区别，以及 MV3 下的运行上下文

扩展不是「在 Chrome 里打开的一个网站」，而是**安装在浏览器配置文件里、跨标签页存活**的程序包。理解它和网页、PWA、油猴脚本的区别，能避免把插件写成「带 `manifest.json` 的网页」。

## 直觉：四个角色

| 形态 | 谁运行它 | 典型能力 | 例子 |
| ---- | -------- | -------- | ---- |
| 普通网页 | 单个标签页 | 只能访问自己源、用户打开才存在 | `https://example.com` |
| PWA | 标签页 + 可安装 | 离线缓存、推送（受平台限制） | 记事本 PWA（见 [附录：PWA 开发指南](/manual/computer-programming/chrome-extension/appendix-pwa)） |
| **Chrome 扩展** | 浏览器进程 + 可选注入页面 | 读改任意允许站点 DOM、拦网络、改工具栏 | 广告拦截、翻译、密码管理 |
| 用户脚本（Tampermonkey） | 注入脚本 | 改 DOM，能力取决于管理器 | 站点美化脚本（见 [附录：油猴脚本开发指南](/manual/computer-programming/chrome-extension/appendix-userscript)） |

扩展的核心是 **manifest 声明能力 + 多种 JS 运行上下文**（Service Worker、Content Script、Popup 等），由 Chrome 按权限调度。

## 定义

**Chrome 扩展（Extension）** 是一个包含 `manifest.json` 的目录（或 zip 包），声明：

- **元数据**：名称、版本、图标、描述
- **入口**：`background` Service Worker、`action` 弹出页、`content_scripts` 注入规则等
- **权限**：`permissions`、`host_permissions`、可选的 `optional_permissions`

用户从 `chrome://extensions` 加载未打包目录，或从 Chrome Web Store 安装后，扩展在**浏览器会话间持久存在**（直到禁用/卸载）。

## MV3 下的三种常见上下文

```
┌─────────────────────────────────────────────────┐
│  Chrome 浏览器                                   │
│  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ Service      │  │ 普通网页（隔离）          │ │
│  │ Worker       │◄─┤ Content Script（隔离世界）│ │
│  │（扩展后台）   │  │ 注入到 tab 的 DOM        │ │
│  └──────┬───────┘  └─────────────────────────┘ │
│         │ chrome.runtime.sendMessage            │
│  ┌──────▼───────┐  ┌─────────────────────────┐ │
│  │ Popup /      │  │ Side Panel / Options    │ │
│  │ Side Panel   │  │（扩展页面，extension://）│ │
│  └──────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

| 上下文 | 能否直接访问网页 DOM | 能否用 `chrome.*` API | 生命周期 |
| ------ | -------------------- | --------------------- | -------- |
| Service Worker | 否 | 是（按 manifest 权限） | 事件驱动，空闲可被回收 |
| Content Script | 是（隔离世界） | 部分（如 `runtime.sendMessage`） | 随匹配页面加载/卸载 |
| Popup / Options | 否（除非 iframe 嵌页面） | 是 | 打开时存在，关闭即销毁 |

**隔离世界（Isolated World）**：Content Script 与页面自己的 JS 共享 DOM，但**不共享** `window` 上的变量；两边要靠 `postMessage` 或注入 `<script>` 桥接（见后文 [消息传递](/manual/computer-programming/chrome-extension/messaging)）。

## 例子 1：翻译插件在做什么

1. `content_scripts` 在 `*://*/*` 匹配页注入 `translate.js`，监听用户选中文本。
2. 用户点击扩展图标，**Popup** 显示设置。
3. **Service Worker** 收到消息，带 `host_permissions` 请求翻译 API，把结果 `sendMessage` 回 Content Script 显示浮层。

没有扩展权限，纯网页无法在读 `bank.com` 的同时读 `news.com` 的 DOM。

## 例子 2：与 MV2 的关键差异（只需记住三条）

| 点 | MV2（旧） | MV3（本专栏） |
| -- | --------- | ------------- |
| 后台 | 持久 `background.page` | **事件型 Service Worker** |
| 拦截网络 | `webRequest` 阻塞 | **declarativeNetRequest** 声明式规则 |
| 远程代码 | 较松 | **禁止远程托管可执行代码**；逻辑须打包进扩展 |

新提交 Chrome Web Store **必须 MV3**。

## 量化：规模直觉

| 指标 | 典型量级 |
| ---- | -------- |
| 最小扩展文件 | `manifest.json` + 1 个 JS，约 **1 KB** |
| 商店热门扩展包体 | **1–5 MB**（含图标、WASM、模型等可达数十 MB） |
| Service Worker 单次运行时限 | 无固定「5 分钟被杀」计时器，但**空闲会休眠**；长任务需 `chrome.alarms` 或拆片 |
| `chrome.storage.local` 配额 | 约 **10 MB**（可申请 `unlimitedStorage`） |

## 常见误区

1. **「扩展 = 内嵌网页」**——Popup 是扩展页，但能力来自 manifest 声明的全局权限，不是 `<iframe>` 能替代的。
2. **「Content Script 能读页面 JS 变量」**——默认不能；这是安全设计。
3. **「Service Worker 一直在后台跑」**——MV3 下会被回收；需要持久状态请用 [存储 API](/manual/computer-programming/chrome-extension/storage) 或 `chrome.alarms`。

## 小结

Chrome 扩展是**跨标签、带特权 API 的浏览器程序**；MV3 用 Service Worker + 声明式网络规则，Content Script 负责「碰网页」，Popup/Side Panel 负责「碰用户」。下一篇准备开发环境，再动手写 [Hello World](/manual/computer-programming/chrome-extension/hello-world)。

→ 下一篇：[开发环境准备](/manual/computer-programming/chrome-extension/environment-setup)
