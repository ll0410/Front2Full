---
title: "第 7 课：Context Menus"
description: "Chrome 插件开发指南 · 实战课程 · 右键上下文菜单与网页 Toast 反馈"
source: "https://daiw.org/manual/chrome-extension/lesson-07-context-menus"
---

# 第 7 课：Context Menus

Chrome 插件开发指南 · 实战课程 · 右键上下文菜单与网页 Toast 反馈

本课配套开源 Demo [**07-context-menus**](https://github.com/davidapp/chrome-extension-demos/tree/main/07-context-menus)：「右键快捷收藏与搜索工具」——用 `chrome.contextMenus` 按选中文字/图片/链接显示不同菜单，并通过 Content Script 在网页内弹出 Toast。

![第 7 课成品：网页内 Toast 反馈](https://daiw.org/screenshots/chrome-extension/lesson-07-context-menus.webp)

_▲ 右键菜单触发后，Content Script 在网页右上角弹出的 Toast（真实网页注入效果）_

::: info
本文讲解原理与关键片段；**完整 HTML/CSS/JS 及逐步操作**见仓库 [`07-context-menus`](https://github.com/davidapp/chrome-extension-demos/tree/main/07-context-menus) 目录内的 README。
:::

## 本课目标

- 在 `onInstalled` 中注册菜单（避免重复 `create`）
- 使用 `contexts`：`selection`、`image`、`link`、`page`
- `onClicked` 处理收藏、搜索、开新标签
- `chrome.tabs.sendMessage` 向页面展示操作反馈

## 核心概念

右键菜单项由 **Service Worker** 注册，点击后在 `background.js` 处理。操作完成后必须给用户**可见反馈**（Toast、通知或角标），不能静默执行。

| contexts | 出现场景 |
| -------- | -------- |
| `selection` | 用户选中文字 |
| `image` | 右键图片 |
| `link` | 右键超链接 |
| `page` | 页面空白处 |

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "右键收藏工具",
  "permissions": ["contextMenus", "scripting", "activeTab", "storage"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background.js" },
  "content_scripts": [{
    "matches": ["http://*/*", "https://*/*"],
    "js": ["content.js"]
  }]
}
```

## background.js：注册与点击

```javascript
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-text',
    title: '📚 收藏选中文字',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'search-text',
    title: '🔍 百度搜索选中文字',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-text') {
    await saveFavorite({ type: 'text', content: info.selectionText });
    await chrome.tabs.sendMessage(tab.id, {
      action: 'showToast',
      message: '📚 已收藏选中文字',
    });
  }
  if (info.menuItemId === 'search-text') {
    const q = encodeURIComponent(info.selectionText);
    await chrome.tabs.create({ url: `https://www.baidu.com/s?wd=${q}` });
  }
});
```

Demo 还支持父子菜单、`image`/`link` 收藏，收藏列表写入 `chrome.storage.local` 的 `favorites` 数组（最多 100 条）。

## content.js：Toast

监听 `showToast`，在 `body` 注入固定定位卡片，`setTimeout` 3 秒后移除。`tabs.sendMessage` 在 `chrome://` 页面会失败，需 `try/catch` 静默处理。

## 获取源码

```bash
git clone https://github.com/davidapp/chrome-extension-demos.git
cd chrome-extension-demos/07-context-menus
```

也可 [Download ZIP](https://github.com/davidapp/chrome-extension-demos/archive/refs/heads/main.zip) 解压后进入 `07-context-menus` 目录。

## 体验步骤

1. 打开 `chrome://extensions` → 开发者模式 → **加载已解压的扩展程序** → 选择 `07-context-menus` 目录
2. 普通 https 页面：选中文字 → 右键 → 收藏 / 搜索
3. 右键图片 → 收藏图片链接
4. 在 `chrome://extensions` 打开 SW 控制台：`chrome.storage.local.get('favorites')` 查看数据

## 课后练习

1. 增加 `popup.html` 展示收藏列表并支持删除
2. 搜索引擎前缀存 `storage.local`，支持百度/必应/谷歌切换

## 延伸阅读

- [完整源码：`07-context-menus`](https://github.com/davidapp/chrome-extension-demos/tree/main/07-context-menus) — 可运行项目与 README 逐步说明
- [消息传递](/manual/computer-programming/chrome-extension/messaging) — `tabs.sendMessage`
- [存储 API](/manual/computer-programming/chrome-extension/storage)

## 小结

右键菜单 = SW 注册 + `contexts` 过滤 + 点击后 storage/导航/页面反馈。下一课学习常驻 **Side Panel**。

→ 下一课：[第 8 课：Side Panel](/manual/computer-programming/chrome-extension/lesson-08-side-panel)
