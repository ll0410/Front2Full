---
title: "消息传递"
description: "Chrome 插件开发指南 · sendMessage、长连接、与页面 postMessage"
source: "https://daiw.org/manual/chrome-extension/messaging"
---

# 消息传递

Chrome 插件开发指南 · sendMessage、长连接、与页面 postMessage

扩展的各个上下文跑在**不同进程**里，只能靠消息通信。这一章讲三种通道：一次性消息、长连接 port，以及与网页世界的 `postMessage`。

## 三种通道

| 通道 | API | 适合 |
| ---- | --- | ---- |
| 一次性消息 | `chrome.runtime.sendMessage` | 请求-响应，绝大多数场景 |
| 长连接 | `chrome.runtime.connect` | 高频、流式、需要知道对方断开 |
| 页面桥接 | `window.postMessage` | [Content Script](/manual/computer-programming/chrome-extension/content-scripts) ↔ 页面 JS |

## 一次性消息

```javascript
// 发送方（popup / content script / 任意扩展页）
const reply = await chrome.runtime.sendMessage({ type: 'GET_USER' });
```

```javascript
// 接收方（background.js）
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_USER') {
    fetchUser().then(sendResponse);
    return true;                 // ← 必须
  }
});
```

::: warning
**`return true` 是 MV3 消息传递里最容易漏、也最难查的一行。**

它的含义是「**我会异步调用 `sendResponse`，请保持通道打开**」。漏了它：

- 监听器同步返回 → Chrome 立刻关闭消息通道
- 你之后调 `sendResponse` 时通道已关，**静默失败**
- 发送方的 `await` 拿到 `undefined`，**没有任何报错**

症状是「消息发出去了，对面明明处理了，就是收不到回复」。看到这个症状，先查 `return true`。

另一个坑：**`async` 监听器不能替代它**。

  ```javascript
  // ✗ 不行：async 函数返回 Promise，Chrome 只认字面量 true
  chrome.runtime.onMessage.addListener(async (msg) => {
    return await handle(msg);
  });
  ```
:::

### 谁能收到

`chrome.runtime.sendMessage` 发出的消息，会送到**除发送者外所有**扩展上下文的 `onMessage`——background、所有打开的 popup、选项页、side panel 都能收到。

**它不会送到 content script。** 要发给 CS，得指定标签页：

```javascript
// background → content script
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
await chrome.tabs.sendMessage(tab.id, { type: 'HIGHLIGHT' });
```

```text
chrome.runtime.sendMessage  →  所有扩展页面 + background      （不含 CS）
chrome.tabs.sendMessage     →  指定标签页里的 content script
```

**这是新手最常见的方向性错误**：在 background 里用 `runtime.sendMessage` 想通知 CS，永远收不到。

### sender 里有什么

```javascript
chrome.runtime.onMessage.addListener((msg, sender) => {
  sender.tab;    // 来自 content script 时有，扩展页面时是 undefined
  sender.url;    // 发送方的 URL
  sender.id;     // 扩展 ID（跨扩展消息时用来校验）
  sender.frameId;
});
```

**用 `sender.tab` 区分「来自网页」还是「来自扩展页面」**，比在消息体里自己带标记可靠。

### 常见错误：Receiving end does not exist

```text
Unchecked runtime.lastError: Could not establish connection.
Receiving end does not exist.
```

三种原因：

| 原因 | 解法 |
| ---- | ---- |
| 目标标签页没有注入 CS | 检查 `matches`；或用 [Scripting API](/manual/computer-programming/chrome-extension/scripting-api) 动态注入后再发 |
| 页面是 `chrome://` 等禁止注入的页 | 发送前过滤掉 |
| 没有任何上下文监听该消息 | 正常现象（比如 popup 没开），用 `.catch()` 吞掉 |

```javascript
// popup 可能没开，这是正常的
chrome.runtime.sendMessage({ type: 'PING' }).catch(() => {});
```

## 长连接 port

```javascript
// content.js
const port = chrome.runtime.connect({ name: 'stream' });
port.postMessage({ type: 'START' });
port.onMessage.addListener((msg) => render(msg));
port.onDisconnect.addListener(() => console.log('对面断了'));
```

```javascript
// background.js
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'stream') return;

  const timer = setInterval(() => port.postMessage({ tick: Date.now() }), 1000);

  port.onDisconnect.addListener(() => clearInterval(timer));   // 清理！
  port.onMessage.addListener((msg) => { /* … */ });
});
```

### 什么时候用 port

| 场景 | 用哪个 |
| ---- | ------ |
| 一问一答 | `sendMessage` |
| 高频消息（每秒多次） | port（省去每次建连接的开销） |
| 服务端推流式结果 | port |
| 需要知道对方何时消失 | port（`onDisconnect`） |

::: warning
**port 会让 Service Worker 保持存活——这是双刃剑。**

只要 port 开着，[SW 就不会被回收](/manual/computer-programming/chrome-extension/service-worker)。有人拿这个当保活手段，但那违背 MV3 设计意图，也可能在审核时被质疑。

同时要注意：**Chrome 会在约 5 分钟后强制断开闲置的 port**。所以即使你想靠它保活，也得处理 `onDisconnect` 并重连——代码复杂度反而更高。

**默认用 `sendMessage`，只在真的需要流式或断开通知时才上 port。**
:::

## 与页面 JS 通信

[Content Script 和页面处在隔离世界](/manual/computer-programming/chrome-extension/content-scripts)，`chrome.runtime` 那套在页面世界里不存在。桥梁是 `window.postMessage`：

```text
页面 JS  ──postMessage──►  Content Script  ──runtime.sendMessage──►  Service Worker
        ◄─postMessage──                   ◄──sendResponse───────
```

```javascript
// content.js —— 中转站
window.addEventListener('message', async (e) => {
  // ① 必须校验来源
  if (e.source !== window) return;
  if (e.data?.channel !== 'my-ext-req') return;

  const result = await chrome.runtime.sendMessage(e.data.payload);
  window.postMessage({ channel: 'my-ext-res', id: e.data.id, result }, '*');
});
```

```javascript
// 页面世界的脚本
window.postMessage({ channel: 'my-ext-req', id: 1, payload: { type: 'GET_USER' } }, '*');
```

::: warning
**`window.postMessage` 是完全公开的。** 页面上任何脚本——包括第三方广告、注入的恶意代码——都能监听和伪造。

三条纪律：

1. **永远校验 `e.source === window`**，否则 iframe 里的消息也会进来。
2. **用独有的 channel 标识**，别用 `type` 这种通用字段名。
3. **绝不通过这个通道传敏感数据**（token、用户凭据）。真要传，说明架构有问题——该在 CS 或 SW 里完成的事，别交给页面。
:::

## 跨扩展 / 网页与扩展

```javascript
// 别的扩展发过来
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (sender.id !== '允许的扩展ID') return;      // 必须校验
  // …
});
```

网页要主动联系扩展，需要在 manifest 里显式放行：

```json
{ "externally_connectable": { "matches": ["https://myapp.example.com/*"] } }
```

配了之后，该站点的页面 JS 里就能直接用 `chrome.runtime.sendMessage('<扩展ID>', {...})`——不用 content script 中转。**这是「自家网站配自家扩展」的标准做法。**

## 消息设计的几条经验

**① 统一用 `type` 字段分发**，别用多个监听器各自判断：

```javascript
const handlers = {
  GET_USER: () => fetchUser(),
  SAVE: (msg) => save(msg.data),
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const h = handlers[msg.type];
  if (!h) return;
  Promise.resolve(h(msg, sender)).then(sendResponse);
  return true;
});
```

**② 消息必须可 JSON 序列化。** 函数、`Map`、`Set`、DOM 节点、`Error` 对象都传不过去——`Error` 会变成 `{}`，这个坑很隐蔽：

```javascript
// ✗ 对面收到 {}
sendResponse({ error: new Error('失败') });

// ✓
sendResponse({ error: { message: e.message, code: e.code } });
```

**③ 大数据别走消息。** 消息有大小限制且要序列化两次。传大对象改用 `chrome.storage` 中转，消息里只发一个 key。

## 小结

- `runtime.sendMessage` 送给**所有扩展页面**，**不含 content script**；发给 CS 用 `tabs.sendMessage`。
- **异步回复必须 `return true`**，`async` 监听器不管用。
- `Receiving end does not exist` 多数时候是正常的，`.catch()` 掉。
- port 适合高频/流式/需要断开通知；它会保活 SW，但**约 5 分钟被强制断开**。
- 与页面通信走 `window.postMessage`，**必须校验来源，绝不传敏感数据**。
- 自家网站可用 `externally_connectable` 直连，免去中转。
- 消息要**可 JSON 序列化**——`Error` 传过去会变成 `{}`。

实战见[第 4 课：消息传递](/manual/computer-programming/chrome-extension/lesson-04-message-passing)。下一篇：[存储 API](/manual/computer-programming/chrome-extension/storage)。
