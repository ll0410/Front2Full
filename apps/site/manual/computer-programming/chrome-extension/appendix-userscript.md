---
title: "油猴脚本开发指南"
description: "Chrome 插件开发指南 · 附录：Tampermonkey / Violentmonkey 用户脚本的元数据、GM API 与扩展的选型边界"
source: "https://daiw.org/manual/chrome-extension/appendix-userscript"
---

# 油猴脚本开发指南

Chrome 插件开发指南 · 附录：Tampermonkey / Violentmonkey 用户脚本的元数据、GM API 与扩展的选型边界

**用户脚本（Userscript）** 是一段带元数据头的 JavaScript，由 **Tampermonkey**、**Violentmonkey**、**Greasemonkey** 等管理器注入到匹配的网站。它常被称为「油猴脚本」。能力上最接近 Chrome 扩展的 [Content Script](/manual/computer-programming/chrome-extension/content-scripts)，但**无需打包、无需上架商店**，适合个人工具与站点增强。

![用户脚本运行效果](https://daiw.org/screenshots/chrome-extension/appendix-userscript.webp)

_▲ 同一网页上三个脚本的注入效果：段落高亮、右下角全站便签、左下角跨域「一言」角标_

::: info
本附录默认以 **Tampermonkey**（Chrome 上广泛使用的用户脚本管理器）为例。Violentmonkey 语法大体兼容，部分 `GM_*` API 名称略有差异。
:::

## 与 Chrome 扩展的边界

| 维度 | 油猴脚本 | Chrome 扩展（MV3） |
| ---- | -------- | ------------------ |
| 分发 | 粘贴脚本 / 从 Greasy Fork 安装 | 未打包目录 / Chrome Web Store |
| 运行上下文 | 页面主世界或隔离世界（取决于管理器与 `@grant`） | Content Script 固定**隔离世界** |
| 后台常驻 | 无独立 Service Worker；随页面加载执行 | Extension Service Worker |
| 工具栏 / Popup | 依赖管理器 UI，无原生 `action` | 原生 Popup、Side Panel |
| 改任意站 | `@match` 声明 URL 模式 | `content_scripts` + `host_permissions` |
| 审核 | 无 Google 审核（脚本来源自负） | 商店扩展需审核 |

**选型口诀**：个人用、只改少数站点、快速迭代 → 油猴；要工具栏图标、后台长任务、商店分发、企业策略部署 → 扩展。

## 脚本文件结构

油猴脚本是一个 `.user.js` 文件，**顶部元数据块**由管理器解析，下方是业务逻辑：

```javascript
// ==UserScript==
// @name         划词高亮
// @namespace    https://daiw.org/
// @version      1.0.0
// @description  双击段落添加黄色高亮
// @author       You
// @match        https://*/*
// @match        http://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  document.addEventListener('dblclick', (e) => {
    const p = e.target.closest('p');
    if (!p) return;
    p.style.backgroundColor = '#fef08a';
  });
})();
```

在 Tampermonkey 中：**添加新脚本 → 粘贴 → 保存**。匹配页面刷新后即生效。

::: warning
**MV3 下的 `userScripts` 授权开关：** 在 Manifest V3 中，Tampermonkey（v5+）、Violentmonkey 等管理器底层依赖 `chrome.userScripts` API。从 **Chrome 138+** 起，安装管理器后需打开 `chrome://extensions` → 点击该管理器卡片的 **详情（Details）** → 开启 **允许用户脚本（Allow User Scripts）** 开关，脚本才能正常注入（Chrome 138 之前则要求开启右上角的全局「开发者模式」）。
:::

## 常用元数据字段

| 字段 | 含义 | 示例 |
| ---- | ---- | ---- |
| `@name` | 脚本显示名称 | `划词高亮` |
| `@match` / `@include` | 注入哪些 URL | `https://github.com/*` |
| `@exclude` | 排除 URL | `https://github.com/settings/*` |
| `@grant` | 申请的特权 API | `GM_setValue`、`GM_xmlhttpRequest` |
| `@run-at` | 注入时机 | `document-start` / `document-idle` / `document-end` |
| `@connect` | `GM_xmlhttpRequest` 允许访问的域名 | `api.example.com` |
| `@require` | 注入外部库（CDN） | `https://cdn.jsdelivr.net/npm/jquery@3` |
| `@icon` | 脚本图标 URL | |

`@match` 使用 [match 模式](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns) 与扩展类似：`<scheme>://<host><path>`。

## @grant 与 GM API

`@grant none` 表示脚本在页面上下文中运行，**只能使用页面已有的 DOM / `fetch`**（受页面 CSP 约束）。

需要跨域请求、持久存储、注册菜单时，声明对应 grant：

```javascript
// ==UserScript==
// @name         跨域天气角标
// @match        https://news.example.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      api.weather.example.com
// ==/UserScript==

(function () {
  'use strict';

  const KEY = 'lastTemp';

  GM_xmlhttpRequest({
    method: 'GET',
    url: 'https://api.weather.example.com/v1/current',
    onload(res) {
      const { temp } = JSON.parse(res.responseText);
      GM_setValue(KEY, temp);
      const badge = document.createElement('div');
      badge.textContent = `${temp}°C`;
      badge.style.cssText =
        'position:fixed;top:8px;right:8px;z-index:99999;padding:4px 8px;background:#111;color:#fff;border-radius:4px;font-size:12px;';
      document.body.appendChild(badge);
    },
  });
})();
```

| API | 作用 | 扩展中的近似能力 |
| --- | ---- | ---------------- |
| `GM_setValue` / `GM_getValue` | 键值存储 | `chrome.storage.local` |
| `GM_xmlhttpRequest` | 跨域 XHR（需 `@connect`） | `fetch` + `host_permissions` |
| `GM_addStyle` | 注入 CSS | Content Script 注入 `<style>` |
| `GM_registerMenuCommand` | 管理器菜单项 | `chrome.contextMenus`（扩展侧） |
| `GM_notification` | 系统通知 | `chrome.notifications` |

## 与 Content Script 的对比

扩展 Content Script（见 [第 2 课](/manual/computer-programming/chrome-extension/lesson-02-content-script)）：

- 运行在**隔离世界**，默认读不到页面 `window.jQuery`。
- 通过 `chrome.runtime.sendMessage` 与 Service Worker 通信。

油猴脚本（`@grant none` 时）：

- 常运行在**页面主世界**，可直接调用站点已有库（也更容易被页面 CSP 或反篡改检测）。
- 无内置「扩展后台」；长连接、定时任务需自己用 `setInterval` 或配合管理器能力。

若需要**稳定后台 + 最小页面耦合**，扩展更合适；若只是「给 Wikipedia 加个深色模式」，油猴更快。

## 例子：站点阅读模式（最小版）

```javascript
// ==UserScript==
// @name         简易阅读模式
// @match        https://en.wikipedia.org/wiki/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

GM_addStyle(`
  #content { max-width: 42rem; margin: 2rem auto; font-size: 18px; line-height: 1.7; }
  #mw-navigation, .noprint { display: none !important; }
`);
```

等价的 MV3 扩展需要：`manifest.json`、`content_scripts` 匹配规则、可能还有 Popup 开关——文件更多，但可上架商店、统一图标入口。

## 安全与维护

1. **只安装可信来源**——脚本拥有匹配页面的完整访问权，恶意脚本可窃取 Cookie、篡改表单。
2. **`@require` 远程库**——CDN 被劫持时脚本行为会被替换；生产环境优先内联或锁定版本。
3. **站点改版**——选择器失效时脚本静默失败；扩展同样面临 DOM 变更，但可用 `chrome.scripting` 动态调试。
4. **企业环境**——部分公司禁止 Tampermonkey；扩展可通过策略强制安装。

## 从油猴迁移到扩展

当你需要以下能力时，应考虑升级为 MV3 扩展：

- 工具栏图标、Side Panel、快捷键
- `declarativeNetRequest` 广告拦截
- `chrome.storage.sync` 跨设备同步
- Chrome Web Store 公开分发

迁移步骤概要：

1. 将 `@match` 转为 `content_scripts.matches`。
2. 将 `GM_*` 调用映射为 `chrome.storage`、`fetch`（带 `host_permissions`）。
3. 把需后台逻辑的部分迁入 Extension Service Worker。
4. 参考本站 [Hello World](/manual/computer-programming/chrome-extension/hello-world) 与 [10 课实战](/manual/computer-programming/chrome-extension/lesson-01-hello-popup) 搭骨架。

## 常见误区

1. **「油猴能调用 chrome.*」**——不能；除非再装一个桥接扩展。
2. **「@grant none 最安全」**——仍与页面共享上下文，XSS 可影响脚本；敏感操作应用 `@grant` 隔离 API。
3. **「一个脚本匹配所有 URL」**——`@match *://*/*` 会在每个页面注入，浪费性能且增加暴露面；尽量收窄匹配。

## 调试

- Tampermonkey 面板 → 脚本 → **检查视图**（Inspector）查看注入时机与错误。
- 普通页面 DevTools **Console** 中错误栈指向 `userscript.html` 或脚本名。
- 使用 `console.log` + `@run-at document-idle` 避免 DOM 未就绪。

## 延伸阅读

- [Tampermonkey 文档](https://www.tampermonkey.net/documentation.php)
- [Greasy Fork](https://greasyfork.org/)——公开脚本托管与评论
- 本站：[消息传递](/manual/computer-programming/chrome-extension/messaging)（扩展侧页面通信）

## 小结

油猴脚本是**轻量级的页面增强方案**：元数据头声明匹配与权限，`GM_*` 补齐跨域与存储。它与扩展共享「改网页」的目标，但省去 manifest 打包与商店流程。个人工具、单站增强优先油猴；要全局入口、后台能力与正规分发，用本专栏主线里的 MV3 扩展。

← 回到：[专栏首页](/manual/computer-programming/chrome-extension/) · 相关：[PWA 开发指南](/manual/computer-programming/chrome-extension/appendix-pwa)
