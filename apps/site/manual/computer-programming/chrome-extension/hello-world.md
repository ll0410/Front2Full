---
title: "Hello World"
description: "Chrome 插件开发指南 · 最小 Manifest V3 扩展：工具栏图标、Popup、Service Worker 日志"
source: "https://daiw.org/manual/chrome-extension/hello-world"
---

# Hello World

Chrome 插件开发指南 · 最小 Manifest V3 扩展：工具栏图标、Popup、Service Worker 日志

本篇从零写一个**能加载、能点击、能在后台打日志**的 MV3 扩展。完成后你应能在工具栏看到图标，点开 Popup 显示文字，并在 Service Worker 控制台看到启动记录。

::: info
本篇为**最小**可运行示例。带精美 UI 的完整 Popup 实战见 [第 1 课：Hello Popup](/manual/computer-programming/chrome-extension/lesson-01-hello-popup)，源码在 [01-hello-popup](https://github.com/davidapp/chrome-extension-demos/tree/main/01-hello-popup)。
:::

## 目标效果

- 工具栏显示扩展图标
- 点击图标弹出 **Hello, Chrome Extension!**
- Service Worker 启动时 `console.log('SW started')`

## 完整文件

在空目录创建以下 4 个文件（图标可先用任意 PNG，或暂时省略 `icons` 字段）。

**manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Hello MV3",
  "version": "1.0.0",
  "description": "最小 Chrome 扩展示例",
  "action": {
    "default_title": "Hello",
    "default_popup": "popup.html"
  },
  "background": {
    "service_worker": "service-worker.js"
  }
}
```

**service-worker.js**

```javascript
console.log('SW started', new Date().toISOString());

chrome.runtime.onInstalled.addListener(({ reason }) => {
  console.log('onInstalled', reason);
});
```

**popup.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        margin: 16px;
        font: 14px system-ui, sans-serif;
        min-width: 200px;
      }
    </style>
  </head>
  <body>
    <p>Hello, Chrome Extension!</p>
  </body>
</html>
```

（Popup 无需单独 `popup.js` 即可显示静态文案。）

## 加载与验证

1. `chrome://extensions` → 开发者模式 → **加载已解压的扩展程序** → 选该目录
2. 点击工具栏拼图图标，固定 **Hello MV3**
3. 点击图标，应出现 Popup 文案
4. 在扩展卡片点击 **Service Worker** → Inspect，Console 应有 `SW started` 与 `onInstalled install`

## 字段说明

| 字段 | 作用 |
| ---- | ---- |
| `manifest_version: 3` | 声明 MV3；缺省或写 2 将无法上架新包 |
| `action` | 替代 MV2 的 `browser_action`；`default_popup` 为点击图标弹出的 HTML |
| `background.service_worker` | 后台单例脚本路径（相对扩展根） |

## 加图标（推荐）

```json
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
```

商店与 `chrome://extensions` 列表会用到 128；工具栏常用 16/32（Chrome 会自动缩放）。

## 常见报错

| 错误 | 原因 |
| ---- | ---- |
| `Service worker registration failed` | `service-worker.js` 路径错误或语法错误 |
| `default_popup` 空白 | `popup.html` 路径错或 HTML 解析失败 |
| 看不到图标 | 未 pin 到工具栏；或缺少 `action` / `icons` |

## 延伸：点击 Popup 发消息给 Service Worker

在 `popup.html` 底部增加：

```html
    <button id="ping">Ping SW</button>
    <script src="popup.js"></script>
```

**popup.js**

```javascript
document.getElementById('ping').addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'PING' });
  console.log('reply', res);
});
```

**service-worker.js** 追加：

```javascript
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PING') {
    sendResponse({ ok: true, ts: Date.now() });
  }
  return true;
});
```

右键 Popup → 检查，点按钮应在 Popup 控制台看到 `reply`。消息机制详见 [消息传递](/manual/computer-programming/chrome-extension/messaging)。

## 小结

最小 MV3 扩展 = `manifest.json` + `background.service_worker` + `action.default_popup`。加载目录、刷新、查 Service Worker 控制台，构成日常开发三角。建议 clone [开源 Demo 仓库](https://github.com/davidapp/chrome-extension-demos) 进入实战课程，或继续系统学习 manifest 各字段。

→ 下一篇：[第 1 课：Hello Popup](/manual/computer-programming/chrome-extension/lesson-01-hello-popup) · 参考：[manifest.json 概览](/manual/computer-programming/chrome-extension/manifest-overview)
