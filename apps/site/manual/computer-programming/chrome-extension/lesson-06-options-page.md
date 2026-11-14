---
title: "第 6 课：Options Page"
description: "Chrome 插件开发指南 · 实战课程 · options_ui 与 chrome.storage.sync 配置联动"
source: "https://daiw.org/manual/chrome-extension/lesson-06-options-page"
---

# 第 6 课：Options Page

Chrome 插件开发指南 · 实战课程 · options_ui 与 chrome.storage.sync 配置联动

本课配套开源 Demo [**06-options-page**](https://github.com/davidapp/chrome-extension-demos/tree/main/06-options-page)：「个性化配置中心」——选项页保存昵称与主题色到 **`chrome.storage.sync`**，Popup 读取并应用样式。

![第 6 课成品：插件设置选项页](https://daiw.org/screenshots/chrome-extension/lesson-06-options-page.webp)

_▲ 将昵称与主题色保存到 chrome.storage.sync 的选项页_

::: info
本文讲解原理与关键片段；**完整 HTML/CSS/JS 及逐步操作**见仓库 [`06-options-page`](https://github.com/davidapp/chrome-extension-demos/tree/main/06-options-page) 目录内的 README。
:::

## 本课目标

- 在 manifest 注册 `options_ui`
- 三种入口打开选项页
- Options 写 sync、Popup 读 sync 实现联动
- 理解嵌入 Modal vs 独立标签页

## Options Page 是什么

成熟扩展需要设置页：API Key、快捷键、主题等。

**进入方式：**

- `chrome://extensions` 卡片 → **扩展程序选项**
- 工具栏图标右键 → **选项**
- 代码：`chrome.runtime.openOptionsPage()`

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "个性化配置中心",
  "permissions": ["storage"],
  "options_ui": {
    "page": "options.html",
    "open_in_tab": false
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

| `open_in_tab` | 行为 |
| ------------- | ---- |
| `false` | 在扩展管理页内**嵌入 Modal**（MV3 推荐） |
| `true` | 新标签页打开完整选项页 |

## options.js

```javascript
const data = await chrome.storage.sync.get({
  username: '开发者',
  themeColor: 'blue',
});
usernameInput.value = data.username;
document.querySelector(`input[value="${data.themeColor}"]`).checked = true;

saveBtn.addEventListener('click', async () => {
  await chrome.storage.sync.set({
    username: usernameInput.value.trim() || '开发者',
    themeColor: document.querySelector('input[name="theme-color"]:checked').value,
  });
});
```

## popup.js（联动 Popup）

仓库 [`06-options-page`](https://github.com/davidapp/chrome-extension-demos/tree/main/06-options-page) 中 `popup.js` 需与 `popup.html` 配套；核心逻辑如下：

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.sync.get({
    username: '开发者',
    themeColor: 'blue',
  });

  document.getElementById('welcome-msg').textContent = `你好，${data.username}！`;

  const card = document.getElementById('popup-card');
  card.classList.remove('theme-blue', 'theme-emerald', 'theme-purple', 'theme-rose');
  card.classList.add(`theme-${data.themeColor}`);

  document.getElementById('open-options-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
```

CSS 中为 `.theme-blue` / `.theme-emerald` / `.theme-purple` / `.theme-rose` 定义不同渐变色即可。

::: info
仓库 [`06-options-page`](https://github.com/davidapp/chrome-extension-demos/tree/main/06-options-page) 已补全 `popup.js` 与 `popup.css`，可直接在 `chrome://extensions` 加载。
:::

## 获取源码

```bash
git clone https://github.com/davidapp/chrome-extension-demos.git
cd chrome-extension-demos/06-options-page
```

也可 [Download ZIP](https://github.com/davidapp/chrome-extension-demos/archive/refs/heads/main.zip) 解压后进入 `06-options-page` 目录。

## 体验流程

1. 打开 `chrome://extensions` → 开发者模式 → **加载已解压的扩展程序** → 选择 `06-options-page` 目录
2. Popup → **打开配置页面** → 改昵称与主题色 → 保存
3. 再开 Popup：问候语与主题色已更新

## 课后练习

1. **恢复默认**：清除 sync 中 `username` / `themeColor`
2. 选项页右侧**实时预览**（改 radio 即更新预览卡片，无需点保存）

## 延伸阅读

- [完整源码：`06-options-page`](https://github.com/davidapp/chrome-extension-demos/tree/main/06-options-page) — 可运行项目与 README 逐步说明
- [Popup 与选项页](/manual/computer-programming/chrome-extension/popup-and-ui)
- [存储 API](/manual/computer-programming/chrome-extension/storage)
- [manifest.json 概览](/manual/computer-programming/chrome-extension/manifest-overview)

## 小结

Options + `storage.sync` 是用户配置的标配；Popup 只负责展示与跳转。下一课学习右键 **Context Menus**。

→ 下一课：[第 7 课：Context Menus](/manual/computer-programming/chrome-extension/lesson-07-context-menus)
