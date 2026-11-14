---
title: "第 10 课：Offscreen Document"
description: "Chrome 插件开发指南 · 实战课程 · 离屏文档与后台 TTS"
source: "https://daiw.org/manual/chrome-extension/lesson-10-offscreen-document"
---

# 第 10 课：Offscreen Document

Chrome 插件开发指南 · 实战课程 · 离屏文档与后台 TTS

本课配套开源 Demo [**10-offscreen-document**](https://github.com/davidapp/chrome-extension-demos/tree/main/10-offscreen-document)：「网页文字转语音播放器」——Service Worker 无 DOM，通过 **Offscreen Document** 使用 `SpeechSynthesis` 等 Web API。

![第 10 课成品：TTS 语音助手 Popup](https://daiw.org/screenshots/chrome-extension/lesson-10-offscreen-document.webp)

_▲ 输入文字后交给 Offscreen Document 调用 Web Speech API 朗读_

::: info
本文讲解原理与关键片段；**完整 HTML/CSS/JS 及逐步操作**见仓库 [`10-offscreen-document`](https://github.com/davidapp/chrome-extension-demos/tree/main/10-offscreen-document) 目录内的 README。
:::

## 为什么需要 Offscreen

Service Worker **没有** `window` / `document`，无法直接调用：

- `SpeechSynthesisUtterance`（TTS）
- `HTMLCanvasElement`
- `Audio`、`DOMParser`

Offscreen 创建**用户不可见**的 HTML 文档，完整支持上述 API。

::: warning
Offscreen 内**几乎不能用** `chrome.tabs`、`chrome.storage`、`chrome.action` 等——仅 `runtime.sendMessage` / `getURL` 等少数 API。其余操作必须由 Service Worker 代理。
:::

::: info
全局同时只能存在 **一个** Offscreen Document。`createDocument` 前必须 `chrome.offscreen.hasDocument()`。
:::

## 通信架构

```text
Popup sendMessage('speak')
    → background.js
        → ensureOffscreenDocument()
        → sendMessage({ action: 'doSpeak', target: 'offscreen' })
    → offscreen.js → speechSynthesis.speak()
        → sendMessage('speechEnded')
    → background.js → closeDocument() + 清除 Badge
```

## manifest.json

```json
{
  "permissions": ["offscreen"],
  "background": { "service_worker": "background.js" },
  "action": { "default_popup": "popup.html" }
}
```

## background.js 片段

```javascript
async function ensureOffscreenDocument() {
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: '使用 Web Speech API 进行 TTS 播放',
    });
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'speak') {
    handleSpeak(msg.text, sendResponse);
    return true;
  }
});
```

## offscreen.js 片段

```javascript
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return;
  if (message.action === 'doSpeak') {
    const u = new SpeechSynthesisUtterance(message.text);
    u.lang = /[\u4e00-\u9fa5]/.test(message.text) ? 'zh-CN' : 'en-US';
    u.onend = () => chrome.runtime.sendMessage({ action: 'speechEnded' });
    speechSynthesis.speak(u);
    sendResponse({ success: true });
  }
});
```

## 获取源码

```bash
git clone https://github.com/davidapp/chrome-extension-demos.git
cd chrome-extension-demos/10-offscreen-document
```

也可 [Download ZIP](https://github.com/davidapp/chrome-extension-demos/archive/refs/heads/main.zip) 解压后进入 `10-offscreen-document` 目录。

## 体验与调试

1. 打开 `chrome://extensions` → 开发者模式 → **加载已解压的扩展程序** → 选择 `10-offscreen-document` 目录
2. Popup 输入文字 → **朗读** / **停止**
3. 朗读期间 `chrome://extensions` 出现 **检查视图：offscreen**；播放结束 SW 关闭文档，链接消失

## 10 课能力总览

| 课 | 核心能力 | 源码 |
| -- | -------- | ---- |
| 01 | MV3、Popup、CSP | [01-hello-popup](https://github.com/davidapp/chrome-extension-demos/tree/main/01-hello-popup) |
| 02 | Content Script、`scripting` | [02-content-script](https://github.com/davidapp/chrome-extension-demos/tree/main/02-content-script) |
| 03 | Service Worker、Badge、storage | [03-service-worker](https://github.com/davidapp/chrome-extension-demos/tree/main/03-service-worker) |
| 04 | `sendMessage`、`return true` | [04-message-passing](https://github.com/davidapp/chrome-extension-demos/tree/main/04-message-passing) |
| 05 | `storage.local`、`onChanged` | [05-storage-api](https://github.com/davidapp/chrome-extension-demos/tree/main/05-storage-api) |
| 06 | `options_ui`、`storage.sync` | [06-options-page](https://github.com/davidapp/chrome-extension-demos/tree/main/06-options-page) |
| 07 | `contextMenus`、Toast 反馈 | [07-context-menus](https://github.com/davidapp/chrome-extension-demos/tree/main/07-context-menus) |
| 08 | Side Panel、`tabs` 权限 | [08-side-panel](https://github.com/davidapp/chrome-extension-demos/tree/main/08-side-panel) |
| 09 | DNR 静态/动态规则 | [09-declarative-net-request](https://github.com/davidapp/chrome-extension-demos/tree/main/09-declarative-net-request) |
| 10 | Offscreen、后台 TTS | [10-offscreen-document](https://github.com/davidapp/chrome-extension-demos/tree/main/10-offscreen-document) |

完整仓库：[davidapp/chrome-extension-demos](https://github.com/davidapp/chrome-extension-demos)

## 课后练习

1. Popup 增加语速滑块、`lang` 下拉，传给 Offscreen 设置 `utterance.rate` / `utterance.lang`
2. 用 Offscreen Canvas 生成文字像素图，`toDataURL` 回 Popup 展示

## 延伸阅读

- [完整源码：`10-offscreen-document`](https://github.com/davidapp/chrome-extension-demos/tree/main/10-offscreen-document) — 可运行项目与 README 逐步说明
- [Service Worker](/manual/computer-programming/chrome-extension/service-worker)（第 3 课曾提及 Offscreen，见本篇）
- [调试](/manual/computer-programming/chrome-extension/debugging)
- [上架 Chrome Web Store](/manual/computer-programming/chrome-extension/publish-chrome-web-store)

## 小结

Offscreen 补全 SW 的 DOM 能力缺口；职责分离：Popup 触发、SW 管生命周期、Offscreen 只跑 Web API。十课实战完结，可继续阅读专栏工程化章节。

← 上一课：[第 9 课：DNR](/manual/computer-programming/chrome-extension/lesson-09-declarative-net-request) · 回到：[专栏首页](/manual/computer-programming/chrome-extension/)
