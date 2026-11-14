---
title: "第 2 课：Content Script"
description: "Chrome 插件开发指南 · 实战课程 · 内容脚本、隔离世界与编程式注入"
source: "https://daiw.org/manual/chrome-extension/lesson-02-content-script"
---

# 第 2 课：Content Script

Chrome 插件开发指南 · 实战课程 · 内容脚本、隔离世界与编程式注入

本课配套开源 Demo [**02-content-script**](https://github.com/davidapp/chrome-extension-demos/tree/main/02-content-script)：开发「网页高亮与字数统计助手」，理解 Content Script、**隔离世界（Isolated World）** 与 `chrome.scripting.executeScript` 的三种用法。

![第 2 课成品：网页助手 Popup](https://daiw.org/screenshots/chrome-extension/lesson-02-content-script.webp)

_▲「网页助手」的 Popup：一键高亮段落 / 清除高亮 / 统计网页字数_

::: info
本文讲解原理与关键片段；**完整 HTML/CSS/JS 及逐步操作**见仓库 [`02-content-script`](https://github.com/davidapp/chrome-extension-demos/tree/main/02-content-script) 目录内的 README。
:::

## 本课目标

- 用 Content Script 读取/修改网页 DOM
- 区分**声明式**与**编程式**注入
- 申请 `activeTab` + `scripting`，避免宽泛 host 权限
- 处理 `chrome://` 等受保护页面注入失败

## 隔离世界

| | Content Script | 页面自身 JS |
| -- | -------------- | ----------- |
| DOM | 共享 | 共享 |
| JS 变量 / 函数 | 独立作用域 | 独立作用域 |

网页里的 `$`、React 状态 Content Script **读不到**；插件函数也不会污染页面全局——这是防劫持的设计。

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "网页高亮与统计助手",
  "version": "1.0.0",
  "permissions": ["activeTab", "scripting"],
  "action": {
    "default_popup": "popup.html"
  }
}
```

- **`activeTab`**：用户点击扩展图标后，**临时**授权当前标签页——比 `<all_urls>` 友好
- **`scripting`**：使用 `chrome.scripting.executeScript` 所必需

## content.js（文件注入）

```javascript
(function () {
  const paragraphs = document.querySelectorAll('p');
  if (paragraphs.length === 0) {
    alert('当前页面未找到任何段落 (<p> 标签)！');
    return;
  }
  paragraphs.forEach((p) => {
    p.style.backgroundColor = 'rgba(253, 224, 71, 0.4)';
    p.style.outline = '2px dashed #f59e0b';
  });
})();
```

## popup.js：三种 executeScript 模式

**1. 注入文件**

```javascript
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: ['content.js'],
});
```

**2. 注入函数（清除高亮）**

```javascript
function clearPageHighlights() {
  document.querySelectorAll('p').forEach((p) => {
    p.style.backgroundColor = '';
    p.style.outline = '';
  });
}
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: clearPageHighlights,
});
```

**3. 注入函数并读返回值（字数统计）**

```javascript
function analyzeWordCount() {
  const text = document.body.innerText || '';
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const english = text.replace(/[^a-zA-Z]/g, ' ').split(/\s+/).filter(Boolean).length;
  return { chinese, english };
}
const results = await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: analyzeWordCount,
});
const { chinese, english } = results[0].result;
```

注入函数在**网页环境**执行，不能闭包引用 Popup 变量；传参用 `args: [...]`。

## 获取源码

```bash
git clone https://github.com/davidapp/chrome-extension-demos.git
cd chrome-extension-demos/02-content-script
```

也可 [Download ZIP](https://github.com/davidapp/chrome-extension-demos/archive/refs/heads/main.zip) 解压后进入 `02-content-script` 目录。

## 体验步骤

1. 打开 `chrome://extensions` → 开发者模式 → **加载已解压的扩展程序** → 选择 `02-content-script` 目录
2. 打开百科/博客等含 `<p>` 的 **https** 页面（勿用 `chrome://`）
3. 点击扩展 → **高亮所有段落** / **统计网页字数**

## 课后练习

1. 颜色选择器 + `args` 传递高亮颜色
2. 统计 `h1`/`h2` 列表，点击 `scrollIntoView({ behavior: 'smooth' })`

## 延伸阅读

- [完整源码：`02-content-script`](https://github.com/davidapp/chrome-extension-demos/tree/main/02-content-script) — 可运行项目与 README 逐步说明
- [Content Scripts](/manual/computer-programming/chrome-extension/content-scripts)
- [Scripting API](/manual/computer-programming/chrome-extension/scripting-api)
- [权限模型](/manual/computer-programming/chrome-extension/permissions)

## 小结

Content Script 改 DOM；Popup 通过 `activeTab` + `scripting` 按需注入。下一课在后台用 Service Worker 监听浏览器事件。

→ 下一课：[第 3 课：Service Worker](/manual/computer-programming/chrome-extension/lesson-03-service-worker)
