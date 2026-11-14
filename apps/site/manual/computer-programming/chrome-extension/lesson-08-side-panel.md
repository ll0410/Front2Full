---
title: "第 8 课：Side Panel"
description: "Chrome 插件开发指南 · 实战课程 · 侧边栏面板与 Popup 生命周期差异"
source: "https://daiw.org/manual/chrome-extension/lesson-08-side-panel"
---

# 第 8 课：Side Panel

Chrome 插件开发指南 · 实战课程 · 侧边栏面板与 Popup 生命周期差异

本课配套开源 Demo [**08-side-panel**](https://github.com/davidapp/chrome-extension-demos/tree/main/08-side-panel)：「边栏网页笔记本」——Side Panel **不会因失焦关闭**，适合需要持续操作的工具界面。

![第 8 课成品：边栏笔记本](https://daiw.org/screenshots/chrome-extension/lesson-08-side-panel.webp)

_▲ 常驻侧边栏的笔记面板，切换标签也不关闭，内容每 2 秒自动保存_

::: info
本文讲解原理与关键片段；**完整 HTML/CSS/JS 及逐步操作**见仓库 [`08-side-panel`](https://github.com/davidapp/chrome-extension-demos/tree/main/08-side-panel) 目录内的 README。
:::

## Side Panel vs Popup

| 特性 | Popup | Side Panel |
| ---- | ----- | ---------- |
| 触发 | 点击图标（`default_popup`） | `chrome.sidePanel.open()` |
| 持久性 | 失焦即销毁 | **常驻侧边栏** |
| 典型场景 | 快捷操作 | 笔记、AI 助手、阅读辅助 |

::: warning
仅声明 `side_panel.default_path` **不会**自动打开侧边栏，必须由代码调用 `chrome.sidePanel.open()`。<br />
`chrome.action.onClicked` 仅在 **没有** `default_popup` 时触发。
:::

::: warning
**`activeTab` 不适用于侧边栏内触发的 tabs 操作**。从 Side Panel 读当前标签 URL 需 `tabs` 权限，不能依赖 `activeTab`。
:::

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "边栏笔记本",
  "permissions": ["sidePanel", "storage", "tabs"],
  "side_panel": { "default_path": "sidepanel.html" },
  "background": { "service_worker": "background.js" },
  "action": {}
}
```

`"action": {}` 为空对象，无 `default_popup`，图标点击走 `onClicked`。

## background.js

```javascript
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});
```

## sidepanel.js 要点

- 笔记存 `chrome.storage.local` 的 `sidebarNote`
- 输入防抖 **2 秒**自动保存
- **插入当前页 URL**：`chrome.tabs.query({ active: true, lastFocusedWindow: true })` 取标题与 URL 追加到笔记

## 获取源码

```bash
git clone https://github.com/davidapp/chrome-extension-demos.git
cd chrome-extension-demos/08-side-panel
```

也可 [Download ZIP](https://github.com/davidapp/chrome-extension-demos/archive/refs/heads/main.zip) 解压后进入 `08-side-panel` 目录。

## 加载与体验

1. 打开 `chrome://extensions` → 开发者模式 → **加载已解压的扩展程序** → 选择 `08-side-panel` 目录
2. 点击工具栏扩展图标，侧边栏应打开
3. 在笔记区输入文字，切换标签页后测试「插入当前页 URL」

## 调试

侧边栏内右键 → **检查**；或 `chrome://extensions` → **检查视图：侧边栏**。

## 课后练习

1. 按域名 `hostname` 分桶保存多份笔记，切换标签自动加载
2. 简单 Markdown 预览（`#`、`**`、列表）

## 延伸阅读

- [完整源码：`08-side-panel`](https://github.com/davidapp/chrome-extension-demos/tree/main/08-side-panel) — 可运行项目与 README 逐步说明
- [Side Panel](/manual/computer-programming/chrome-extension/side-panel)
- [权限模型](/manual/computer-programming/chrome-extension/permissions)

## 小结

Side Panel 适合长会话 UI；打开侧栏与读 tabs 的权限设计要早于功能编码。下一课学习 **DNR 网络拦截**。

→ 下一课：[第 9 课：Declarative Net Request](/manual/computer-programming/chrome-extension/lesson-09-declarative-net-request)
