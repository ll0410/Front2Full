---
title: "调试"
description: "Chrome 插件开发指南 · SW 调试、Content Script 断点、日志"
source: "https://daiw.org/manual/chrome-extension/debugging"
---

# 调试

Chrome 插件开发指南 · SW 调试、Content Script 断点、日志

扩展调试最大的障碍不是工具不够，而是**上下文太多**——同一个扩展的代码分散在 Service Worker、content script、popup、选项页里，**每个有自己的 DevTools**。「日志怎么不见了」十有八九是打开了错误的那个。

## 每个上下文的入口

| 上下文 | 怎么打开 DevTools |
| ------ | ----------------- |
| **Service Worker** | `chrome://extensions` → 你的扩展 → 点「Service Worker」链接 |
| **Popup** | 右键工具栏图标 →「审查弹出内容」，或打开 popup 后右键 → 检查 |
| **选项页** | 打开选项页 → F12（就是普通页面） |
| **Side Panel** | 右键侧边栏 → 检查 |
| **Content Script** | **所在网页的 F12** → Console 顶部下拉切到你的扩展 |
| **Offscreen** | `chrome://extensions` 页面上会出现对应链接 |

::: warning
**Content Script 的日志出现在网页的 Console 里，但默认可能被过滤掉。**

网页 DevTools → Console → 顶部的上下文下拉框（默认是 `top`），切到你的扩展名。不切的话，只能看到页面自己的日志。

同理，在网页 Console 里输入 `chrome.runtime` 得到 `undefined` 是正常的——你在页面世界，不在[隔离世界](/manual/computer-programming/chrome-extension/content-scripts)。切好上下文再试。
:::

## Service Worker 的两个陷阱

### ① DevTools 打开时 SW 不会被回收

这是 MV3 调试最误导人的一点：**打开 SW 的 DevTools，它就一直活着**。

结果是：

```text
开发时（DevTools 开着）→ 一切正常
用户那边（无 DevTools）→ SW 30 秒后被回收 → 全局变量清零 → bug
```

「我这边好好的，用户说不行」的经典成因。

**验证方法**：关掉 DevTools，等半分钟，再触发功能。或者主动杀掉它：

```text
chrome://extensions → 点「Service Worker」旁边的… 或
chrome://serviceworker-internals → 找到你的 → Stop
```

复习：[状态必须放 `chrome.storage`](/manual/computer-programming/chrome-extension/service-worker)。

### ② 链接变灰 = SW 已休眠

`chrome://extensions` 上「Service Worker」链接是灰的，说明它当前不在运行。**这不是错误**——触发任意事件它就会回来。

想让它立刻醒：点一下扩展图标，或在 Console 里发个消息。

## 改了代码要重载什么

| 改动 | 需要 |
| ---- | ---- |
| Service Worker / manifest | `chrome://extensions` 点**刷新按钮** |
| Content Script | 点刷新按钮 **+ 刷新目标网页** |
| Popup / 选项页 / Side Panel | 直接重开即可（会重新读文件） |
| 静态资源（图片、CSS） | 通常直接生效 |

::: info
**「改了 content script 没生效」几乎总是忘了刷新网页。** 扩展重载只是让 Chrome 重读文件，已经注入到页面里的旧脚本还在原地跑着。

一个省事的开发技巧——在 SW 里加自动重载：

  ```javascript
  // 仅开发时用
  chrome.runtime.onInstalled.addListener(async () => {
    const tabs = await chrome.tabs.query({ url: ['https://*.example.com/*'] });
    for (const t of tabs) chrome.tabs.reload(t.id);
  });
  ```
:::

## 断点

各上下文都能正常打断点，位置在对应 DevTools 的 Sources 面板：

```text
Sources → Page 侧栏
├── top（网页自己的脚本）
└── <你的扩展名>  ← content script 在这里
```

SW 的 Sources 里直接就是你的后台脚本。

**Source map** 要配好，否则打包后的代码没法看。注意 [CSP 禁止 `eval`](/manual/computer-programming/chrome-extension/content-security)，所以 devtool 不能用 `eval-*` 系：

```javascript
// webpack.config.js
module.exports = { devtool: 'source-map' };
```

## 日志技巧

### 给日志加上下文标记

各上下文的日志分散在不同窗口，加前缀能大幅降低混乱：

```javascript
// utils/log.js
const CTX =
  typeof window === 'undefined' ? 'SW'
  : location.protocol === 'chrome-extension:' ? 'EXT'
  : 'CS';

export const log = (...a) => console.log(`[${CTX}]`, ...a);
```

### 把关键日志集中到 SW

排查跨上下文的时序问题时，让所有上下文把日志发给 SW 统一打印：

```javascript
// content.js
const remoteLog = (...args) =>
  chrome.runtime.sendMessage({ type: '__LOG', args }).catch(() => {});
```

```javascript
// background.js
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === '__LOG') {
    console.log(`[CS ${sender.tab?.id}]`, ...msg.args);
  }
});
```

**这是排查「消息顺序不对」类问题最有效的手段**——一个时间线上看得清清楚楚。

::: warning
**发布前删掉调试日志。** 用户的网页 Console 里出现你的日志很不专业，而且可能泄露内部信息。

用构建时的 `define` 替换掉：

  ```javascript
  // vite.config.js
  define: { __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production') }
  ```

  ```javascript
  if (__DEV__) log('…');
  ```
:::

## 查错误：三个地方

### ① chrome://extensions 的「错误」按钮

扩展加载失败、manifest 有问题、SW 启动时抛异常，都在这里。**这是第一个该看的地方**——很多「扩展没反应」的问题在这就有答案。

### ② runtime.lastError

回调式 API 的错误不会 throw，只挂在 `chrome.runtime.lastError` 上：

```javascript
chrome.tabs.sendMessage(tabId, msg, (resp) => {
  if (chrome.runtime.lastError) {
    console.warn('发送失败：', chrome.runtime.lastError.message);
    return;
  }
  use(resp);
});
```

**不读它，Chrome 会在 Console 里报 `Unchecked runtime.lastError`。** 用 Promise 形式（不传回调）则会正常 reject，配 `try/catch` 更省事。

### ③ 未捕获的 Promise 拒绝

```javascript
// background.js
self.addEventListener('unhandledrejection', (e) => {
  console.error('未处理的 Promise 拒绝：', e.reason);
});
```

SW 里没有 `window`，用 `self`。

## 常见症状速查

| 症状 | 先查 |
| ---- | ---- |
| 日志完全看不到 | DevTools 开错了；Console 上下文没切 |
| 改了没生效 | content script 忘了刷新网页 |
| 开发时正常、用户报错 | SW 被回收，[状态用了全局变量](/manual/computer-programming/chrome-extension/service-worker) |
| `Receiving end does not exist` | 目标页没注入 CS，或[方向搞反了](/manual/computer-programming/chrome-extension/messaging) |
| `sendResponse` 收不到 | 漏了 `return true` |
| CORS 报错 | 在 CS 里发的请求，[MV3 已无特权](/manual/computer-programming/chrome-extension/network-and-cors) |
| `Refused to ... CSP` | [扩展 CSP](/manual/computer-programming/chrome-extension/content-security)，多半是 eval 或外部脚本 |
| 拦截规则不生效 | [`resourceTypes` 没写 `main_frame`](/manual/computer-programming/chrome-extension/declarative-net-request) |
| `executeScript` 报未定义 | [注入函数没有闭包](/manual/computer-programming/chrome-extension/scripting-api)，要用 `args` |

## 检查存储与权限

在**任意扩展页面**的 Console 里（popup / 选项页 / SW）：

```javascript
// 看所有数据
await chrome.storage.local.get(null);
await chrome.storage.sync.get(null);

// 看当前权限
await chrome.permissions.getAll();

// 看已注册的动态脚本
await chrome.scripting.getRegisteredContentScripts();

// 看拦截规则
await chrome.declarativeNetRequest.getDynamicRules();
```

**这些一行命令能省掉大量猜测**，排查时优先用它们确认「实际状态」，而不是假设代码按预期跑了。

## 小结

- **每个上下文有独立的 DevTools**——找不到日志先确认打开的是哪个。
- Content Script 的日志在网页 Console，但**要切上下文下拉框**。
- **DevTools 打开时 SW 不被回收**，这是「我这好好的」类 bug 的根源。
- 改 content script **必须刷新网页**，只重载扩展没用。
- devtool 不能用 `eval-*`（[CSP 禁止](/manual/computer-programming/chrome-extension/content-security)）。
- 排查跨上下文时序，**把日志集中发给 SW** 统一打印。
- 回调式 API 的错误在 **`chrome.runtime.lastError`**，不读会报 `Unchecked`。
- 排查前先用一行命令**确认实际状态**（storage / permissions / rules），别靠猜。

下一篇：[测试策略](/manual/computer-programming/chrome-extension/testing)。
