---
title: "Service Worker"
description: "Chrome 插件开发指南 · MV3 后台、生命周期、事件、持久状态"
source: "https://daiw.org/manual/chrome-extension/service-worker"
---

# Service Worker

Chrome 插件开发指南 · MV3 后台、生命周期、事件、持久状态

MV3 用 Service Worker 取代了 MV2 的常驻后台页。**这是 MV3 最大的行为变化，也是老代码迁移时踩坑最多的地方**——从 MV2 抄来的后台逻辑，十有八九在这里出问题。

## 核心差异：它随时会被杀掉

```text
MV2 背景页（background page）        MV3 Service Worker
┌──────────────────────────┐        ┌──────────────────────────┐
│ 浏览器一启动就加载        │        │ 有事件才唤醒              │
│ 一直活着                  │        │ 空闲约 30 秒被终止        │
│ 全局变量一直在            │        │ 全局变量随终止清零        │
│ 有 DOM（可以 document.…）│        │ 无 DOM、无 window        │
└──────────────────────────┘        └──────────────────────────┘
```

**「空闲就回收」是 MV3 后台的第一原理。** 所有反直觉的行为都由它推出。

::: warning
**最常见的错误：把状态放在全局变量里。**

  ```javascript
  // ✗ 错的：SW 一被回收，count 就归零
  let count = 0;
  chrome.action.onClicked.addListener(() => {
    count++;
    chrome.action.setBadgeText({ text: String(count) });
  });
  ```

  ```javascript
  // ✓ 对的：状态进 chrome.storage
  chrome.action.onClicked.addListener(async () => {
    const { count = 0 } = await chrome.storage.local.get('count');
    await chrome.storage.local.set({ count: count + 1 });
    await chrome.action.setBadgeText({ text: String(count + 1) });
  });
  ```

症状很有欺骗性：**开发时一切正常**（你在不停操作，SW 一直被唤醒），发布后用户隔几分钟点一次，计数就总是 1。
:::

状态该放哪，见[存储 API](/manual/computer-programming/chrome-extension/storage)。

## 事件监听必须同步注册

```javascript
// ✗ 错的：SW 被唤醒后，监听器还没注册就错过了事件
chrome.storage.local.get('config').then((cfg) => {
  chrome.runtime.onMessage.addListener(handler);   // 太晚了
});
```

```javascript
// ✓ 对的：顶层同步注册，异步逻辑放进 handler 内部
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  chrome.storage.local.get('config').then((cfg) => {
    sendResponse(handle(msg, cfg));
  });
  return true;                                      // 见下文
});
```

**理由：** SW 被事件唤醒时，Chrome 会重新执行整个脚本，然后**立刻**派发那个事件。如果你的 `addListener` 在 `await` / `.then()` 之后才执行，那次派发就没人接。

## 三个生命周期事件

| 事件 | 何时触发 | 典型用途 |
| ---- | -------- | -------- |
| `chrome.runtime.onInstalled` | 首次安装、**版本更新**、Chrome 升级 | 初始化默认配置、建右键菜单、数据迁移 |
| `chrome.runtime.onStartup` | 浏览器启动、加载了该扩展的配置文件 | 恢复定时任务 |
| （脚本顶层代码） | **每次唤醒** | 只做注册，别做初始化 |

```javascript
chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  if (reason === 'install') {
    await chrome.storage.local.set({ config: DEFAULTS });
  }
  if (reason === 'update') {
    await migrate(previousVersion);
  }
  chrome.contextMenus.create({ id: 'my-item', title: '用本扩展处理', contexts: ['selection'] });
});
```

::: info
**右键菜单要在 `onInstalled` 里建，不要在顶层建。** 菜单项是持久化的，顶层每次唤醒都跑一遍会报 `Cannot create item with duplicate id`。
:::

## 别用 setTimeout 做长定时

`setTimeout` / `setInterval` 挂在 SW 上，**SW 一死定时器就没了**。超过几十秒的定时一律用 `chrome.alarms`：

```json
{ "permissions": ["alarms"] }
```

```javascript
chrome.alarms.create('sync', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync') doSync();
});
```

alarm 触发时 Chrome 会**唤醒 SW**，这正是它和 `setInterval` 的本质区别。注意最小周期有下限（打包发布的扩展约 1 分钟），别指望用它做秒级轮询。

## 保持存活的正确姿势

一个高频问题：「我的任务要跑 2 分钟，SW 中途死了怎么办？」

**先确认它真的会死。** Chrome 的规则是「**没有待处理的事件或未 settle 的 Promise 时**，空闲约 30 秒回收」——只要你在事件 handler 里 `return` 了一个还没完成的 Promise，SW 就会被保活到它 settle。

```javascript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  longRunningTask().then(sendResponse);
  return true;      // 关键：告诉 Chrome「我会异步回复」，保持通道与 SW 存活
});
```

那个 **`return true`** 是 MV3 里最容易漏、也最难查的一行——漏了它，`sendResponse` 调用时通道已关闭，调用方收到 `undefined` 且没有任何报错。详见[消息传递](/manual/computer-programming/chrome-extension/messaging)。

::: warning
**网上流传的「保活技巧」多数不该用。** 比如每 20 秒调一次 `chrome.runtime.getPlatformInfo()` 制造事件、或开一个永不关闭的长连接 port。

这些确实能续命，但它们**违背 MV3 的设计意图**，在商店审核时可能被质疑，而且未来 Chrome 收紧策略随时会失效。

正确思路是**把长任务拆成可恢复的小步**：状态存 `chrome.storage`，用 `chrome.alarms` 驱动下一步。真正需要长时间持续运行（比如音频处理），用 [Offscreen Document](/manual/computer-programming/chrome-extension/lesson-10-offscreen-document)。
:::

## 没有 DOM

SW 里没有 `window`、`document`、`localStorage`、`XMLHttpRequest`。

| 想做的事 | MV2 写法 | MV3 替代 |
| -------- | -------- | -------- |
| 存数据 | `localStorage` | `chrome.storage`（异步） |
| 发请求 | `XMLHttpRequest` | `fetch` |
| 解析 HTML | `document.createElement` | `DOMParser`（**SW 里也没有**，需 offscreen） |
| 播放音频 | `new Audio()` | [Offscreen Document](/manual/computer-programming/chrome-extension/lesson-10-offscreen-document) |
| 读剪贴板 | `document.execCommand` | offscreen 或在 popup/content script 里做 |

**需要 DOM 就开 offscreen document**——它是 MV3 专门为此提供的补丁。

## 调试

```text
chrome://extensions → 找到你的扩展 → 点「Service Worker」链接
```

打开的 DevTools 就是 SW 的。几个要点：

- **链接显示为灰色 / 「(已失效)」** = SW 当前已被回收，触发一次事件它就回来了。
- DevTools 打开时 SW **不会被回收**——所以「打开 DevTools 就好了，关掉就出问题」是典型的生命周期 bug。
- 想手动验证回收行为：在 `chrome://serviceworker-internals` 里 Stop，或者干脆等 30 秒。

更多手段见[调试](/manual/computer-programming/chrome-extension/debugging)。

## 一个完整的后台脚本

```javascript
// background.js —— manifest 里配 "type": "module"

// ① 顶层只做同步注册
chrome.runtime.onInstalled.addListener(handleInstalled);
chrome.runtime.onMessage.addListener(handleMessage);
chrome.alarms.onAlarm.addListener(handleAlarm);
chrome.action.onClicked.addListener(handleClick);

async function handleInstalled({ reason }) {
  if (reason === 'install') {
    await chrome.storage.local.set({ enabled: true, count: 0 });
  }
  chrome.alarms.create('cleanup', { periodInMinutes: 60 });
}

function handleMessage(msg, sender, sendResponse) {
  if (msg.type === 'FETCH') {
    // ② 异步回复必须 return true
    fetch(msg.url).then((r) => r.text()).then(sendResponse);
    return true;
  }
}

async function handleAlarm(alarm) {
  if (alarm.name === 'cleanup') {
    const { cache = {} } = await chrome.storage.local.get('cache');
    // ③ 状态一律走 storage，不用全局变量
    await chrome.storage.local.set({ cache: prune(cache) });
  }
}

async function handleClick(tab) {
  const { count = 0 } = await chrome.storage.local.get('count');
  await chrome.storage.local.set({ count: count + 1 });
}
```

## 小结

- **SW 空闲约 30 秒被回收**，这是理解一切 MV3 后台行为的起点。
- **状态放 `chrome.storage`，绝不放全局变量**——开发时看不出问题，上线才暴露。
- **事件监听必须在顶层同步注册**，异步逻辑放进 handler。
- 长定时用 **`chrome.alarms`**，不用 `setTimeout`。
- 异步回复消息**必须 `return true`**。
- 没有 DOM；需要 DOM 就开 **offscreen document**。
- DevTools 打开时 SW 不回收——别被这个假象骗了。

下一篇：[Content Scripts](/manual/computer-programming/chrome-extension/content-scripts)。
