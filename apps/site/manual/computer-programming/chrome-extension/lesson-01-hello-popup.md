---
title: "第 1 课：Hello Popup"
description: "Chrome 插件开发指南 · 实战课程 · Manifest V3 基础与弹出窗口"
source: "https://daiw.org/manual/chrome-extension/lesson-01-hello-popup"
---

# 第 1 课：Hello Popup

Chrome 插件开发指南 · 实战课程 · Manifest V3 基础与弹出窗口

本课配套开源 Demo [**01-hello-popup**](https://github.com/davidapp/chrome-extension-demos/tree/main/01-hello-popup)：创建第一个带精美 UI 的 Chrome 插件，理解 MV3 清单、Popup 生命周期与 CSP 约束。

![第 1 课成品：Hello Popup 弹窗界面](https://daiw.org/screenshots/chrome-extension/lesson-01-hello-popup.webp)

_▲ 在真实 Chrome 中加载 01-hello-popup 后，点击工具栏图标弹出的 Popup_

::: info
本文讲解原理与关键片段；**完整 HTML/CSS/JS 及逐步操作**见仓库 [`01-hello-popup`](https://github.com/davidapp/chrome-extension-demos/tree/main/01-hello-popup) 目录内的 README。
:::

## 本课目标

- 理解 Chrome 扩展 = Web 技术 + 浏览器特权 API
- 写出最小 `manifest.json`（`manifest_version: 3` + `action.default_popup`）
- 实现 Popup 内时钟、问候卡片、明暗主题切换
- 掌握 Popup 调试技巧（DevTools 保持窗口不关闭）

## 核心概念

### Chrome 插件是什么

插件由 HTML、CSS、JavaScript 和图片组成，但可调用 `chrome.*` API（标签页、存储、脚本注入等），能力远超普通网页。

### Manifest V3 三条变化

| 点 | MV3 |
| -- | --- |
| 安全 | 禁止远程托管可执行 JS，代码必须打包进扩展 |
| 后台 | 用 **Service Worker** 替代常驻 Background Page（本课暂不涉及） |
| API | 异步接口支持 Promise / async-await |

### Popup 生命周期

Popup 是点击工具栏图标弹出的**临时窗口**。点击外部或切换标签页会**立即销毁**——每次打开 HTML/JS 重新执行，内存变量清零。持久化请用 [Storage API](/manual/computer-programming/chrome-extension/storage)（第 5 课）。

## 文件结构

```text
01-hello-popup/
├── manifest.json
├── popup.html
├── popup.css
└── popup.js
```

::: warning
CSP 禁止内联脚本：不能写 `onclick="..."` 或 `<script>console.log(1)</script>`，必须用 `<script src="popup.js"></script>` 外部引入。
:::

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "Hello Chrome Extension",
  "version": "1.0.0",
  "description": "我的第一个 Chrome 插件 - 体验 Manifest V3 和 Popup",
  "action": {
    "default_popup": "popup.html"
  }
}
```

本课**不声明 icons**——Chrome 使用默认占位图。若声明 `icons`，对应 PNG 必须存在，否则加载失败。

## popup.js 要点

```javascript
document.addEventListener('DOMContentLoaded', () => {
  const timeEl = document.getElementById('current-time');
  const updateTime = () => {
    timeEl.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  };
  updateTime();
  const timerId = setInterval(updateTime, 1000);

  const btn = document.getElementById('action-btn');
  const nameInput = document.getElementById('name-input');
  btn.addEventListener('click', () => {
    const name = nameInput.value.trim() || '开发者';
    // 切换问候卡片显示…
  });

  window.addEventListener('unload', () => clearInterval(timerId));

  // 主题：本课用 localStorage（Popup 专用）；跨上下文请用 chrome.storage
  const savedTheme = localStorage.getItem('theme') || 'dark';
  // …
});
```

## 获取源码

```bash
git clone https://github.com/davidapp/chrome-extension-demos.git
cd chrome-extension-demos/01-hello-popup
```

也可 [Download ZIP](https://github.com/davidapp/chrome-extension-demos/archive/refs/heads/main.zip) 解压后进入 `01-hello-popup` 目录。

## 加载与调试

1. 打开 `chrome://extensions`，开启**开发者模式**
2. 点击 **加载已解压的扩展程序** → 选择 `01-hello-popup` 目录
3. 固定工具栏图标，点击体验 Popup
4. **调试**：在 Popup 内右键 → **检查**；DevTools 打开期间 Popup **不会自动关闭**

## 课后练习

1. 输入框定制问候：`Hello, [名字]! 欢迎来到 Chrome 插件世界！`
2. 明暗主题切换并持久化（本课 `localStorage` 即可）

## 延伸阅读

- [完整源码：`01-hello-popup`](https://github.com/davidapp/chrome-extension-demos/tree/main/01-hello-popup) — 可运行项目与 README 逐步说明
- [Hello World](/manual/computer-programming/chrome-extension/hello-world) — 更简版最小示例
- [manifest.json 概览](/manual/computer-programming/chrome-extension/manifest-overview)
- [Popup 与选项页](/manual/computer-programming/chrome-extension/popup-and-ui)
- [调试](/manual/computer-programming/chrome-extension/debugging)

## 小结

第 1 课完成 **Popup-only** 扩展：清单 + 外部 JS + CSP。下一课用 Content Script 操作当前网页 DOM。

→ 下一课：[第 2 课：Content Script](/manual/computer-programming/chrome-extension/lesson-02-content-script)
