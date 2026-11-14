---
title: "第 3 课：Service Worker"
description: "Chrome 插件开发指南 · 实战课程 · 后台 Service Worker、事件监听与 Badge"
source: "https://daiw.org/manual/chrome-extension/lesson-03-service-worker"
---

# 第 3 课：Service Worker

Chrome 插件开发指南 · 实战课程 · 后台 Service Worker、事件监听与 Badge

本课配套开源 Demo [**03-service-worker**](https://github.com/davidapp/chrome-extension-demos/tree/main/03-service-worker)：「标签页浏览计数器」——在 MV3 后台监听标签事件、更新工具栏角标，并理解 **Service Worker 无全局状态** 原则。

![第 3 课成品：浏览监控 Popup](https://daiw.org/screenshots/chrome-extension/lesson-03-service-worker.webp)

_▲ Service Worker 在后台记录访问与标签切换次数，Popup 实时展示统计_

::: info
本文讲解原理与关键片段；**完整 HTML/CSS/JS 及逐步操作**见仓库 [`03-service-worker`](https://github.com/davidapp/chrome-extension-demos/tree/main/03-service-worker) 目录内的 README。
:::

## 本课目标

- 注册 `background.service_worker`
- 监听 `onInstalled`、`tabs.onActivated`、`tabs.onUpdated`
- 用 `chrome.storage.local` 持久化计数（禁止 `let count = 0` 全局累加）
- 用 `chrome.action.setBadgeText` 显示角标

## Service Worker 特点

::: warning
1. **事件驱动**：空闲约 30s 可被终止，不能假设常驻内存。<br />
2. **无 DOM**：没有 `window`/`document`。<br />
3. **状态进 storage**：重启后全局变量归零。
:::

## manifest.json

```json
{
  "manifest_version": 3,
  "name": "标签页浏览计数器",
  "version": "1.0.0",
  "permissions": ["storage"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

## background.js 核心逻辑

```javascript
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ visitCount: 0, switchCount: 0 });
  await chrome.action.setBadgeText({ text: '0' });
  await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
});

async function incrementCounter(type) {
  const data = await chrome.storage.local.get(['visitCount', 'switchCount']);
  let visitCount = data.visitCount ?? 0;
  let switchCount = data.switchCount ?? 0;
  if (type === 'visit') visitCount++;
  else if (type === 'switch') switchCount++;
  await chrome.storage.local.set({ visitCount, switchCount });
  await chrome.action.setBadgeText({ text: String(visitCount + switchCount) });
}

chrome.tabs.onActivated.addListener(() => incrementCounter('switch'));

chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status === 'complete') incrementCounter('visit');
});
```

`changeInfo.status === 'complete'` 避免 loading 阶段重复计数。

## Popup 读 storage + 重置

```javascript
const data = await chrome.storage.local.get(['visitCount', 'switchCount']);
// 渲染到界面…

resetBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({ visitCount: 0, switchCount: 0 });
  await chrome.action.setBadgeText({ text: '0' });
});
```

## 获取源码

```bash
git clone https://github.com/davidapp/chrome-extension-demos.git
cd chrome-extension-demos/03-service-worker
```

也可 [Download ZIP](https://github.com/davidapp/chrome-extension-demos/archive/refs/heads/main.zip) 解压后进入 `03-service-worker` 目录。

## 加载与体验

1. 打开 `chrome://extensions` → 开发者模式 → **加载已解压的扩展程序** → 选择 `03-service-worker` 目录
2. 切换标签页、刷新页面，观察工具栏角标数字变化
3. 打开 Popup 查看计数详情，或点击重置

## 调试 Service Worker

`chrome://extensions` → 扩展卡片 → **Service Worker**（或「检查视图」）→ 独立 DevTools。切换标签页观察 Console 日志；卡片显示「无活动视图」表示 SW 已休眠。

## 课后练习

1. 仅 `complete` 时计 visit（代码已示范）
2. Popup 增加「清空历史」按钮（示例已含 `reset-btn`）

## 延伸阅读

- [完整源码：`03-service-worker`](https://github.com/davidapp/chrome-extension-demos/tree/main/03-service-worker) — 可运行项目与 README 逐步说明
- [Service Worker](/manual/computer-programming/chrome-extension/service-worker)
- [存储 API](/manual/computer-programming/chrome-extension/storage)

## 小结

后台逻辑放 Service Worker；数字角标用 `chrome.action`；持久化用 storage。下一课让 Popup、Content Script、SW 通过消息协作。

→ 下一课：[第 4 课：消息传递](/manual/computer-programming/chrome-extension/lesson-04-message-passing)
