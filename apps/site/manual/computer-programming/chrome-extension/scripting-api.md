---
title: "Scripting API"
description: "Chrome 插件开发指南 · executeScript、registerContentScripts"
source: "https://daiw.org/manual/chrome-extension/scripting-api"
---

# Scripting API

Chrome 插件开发指南 · executeScript、registerContentScripts

`chrome.scripting` 是 MV3 用来取代 `chrome.tabs.executeScript` 的新 API。它比旧接口强得多——**能注入函数（而不只是代码字符串）、能选择注入到哪个世界、能动态注册持久规则**。

## 三组能力

```text
chrome.scripting
├── executeScript / insertCSS / removeCSS      一次性注入
├── registerContentScripts / update / unregister  动态注册（持久）
└── getRegisteredContentScripts               查询
```

配置：

```json
{
  "permissions": ["scripting", "activeTab"],
  "host_permissions": ["https://*.example.com/*"]
}
```

**`scripting` 权限本身不显示安装提示**，真正的门槛是站点权限——能用 [`activeTab`](/manual/computer-programming/chrome-extension/permissions) 就别要 `host_permissions`。

## executeScript：注入函数

```javascript
const [{ result }] = await chrome.scripting.executeScript({
  target: { tabId },
  func: () => document.title,
});
console.log(result);
```

**注入的是函数，不是字符串**——这是相对 MV2 最大的改进，因为字符串形式的代码注入是 XSS 的常见入口，MV3 直接不支持了。

### 传参必须用 args

```javascript
const color = '#f00';

// ✗ 拿不到外部变量：函数被序列化后在另一个上下文执行
await chrome.scripting.executeScript({
  target: { tabId },
  func: () => { document.body.style.background = color; },   // ReferenceError
});

// ✓
await chrome.scripting.executeScript({
  target: { tabId },
  func: (c) => { document.body.style.background = c; },
  args: [color],
});
```

::: warning
**注入函数没有闭包。** 它会被 `toString()` 序列化、传到目标页面重新解析执行——外部作用域的一切都不存在。

这个坑很隐蔽，因为语法上完全合法，只在运行时报 `ReferenceError`。

同样地：**函数里也不能调用你模块里的其他函数**。要复用逻辑，要么把辅助函数定义在注入函数内部，要么改用 `files` 注入一个完整脚本文件。

`args` 里的值必须**可 JSON 序列化**——函数、DOM 节点、`Map` 都传不进去。
:::

### 注入文件

```javascript
await chrome.scripting.executeScript({
  target: { tabId },
  files: ['content.js'],
});
```

逻辑复杂时用 `files`——它能 `import`（如果配了 `type: module` 的构建）、能被 TypeScript 正常检查，比塞进一个大函数好维护。

`func` 和 `files` **二选一**，不能同时给。

### target 的写法

```javascript
target: { tabId }                                   // 主框架
target: { tabId, allFrames: true }                  // 所有框架
target: { tabId, frameIds: [0, 123] }               // 指定框架
target: { tabId, documentIds: ['...'] }             // 指定文档
```

`allFrames: true` 时返回值是**数组**，每个框架一项：

```javascript
const results = await chrome.scripting.executeScript({
  target: { tabId, allFrames: true },
  func: () => location.href,
});
results.forEach((r) => console.log(r.frameId, r.result));
```

### 返回值

```javascript
// 支持返回 Promise，会自动等待
const [{ result }] = await chrome.scripting.executeScript({
  target: { tabId },
  func: async () => {
    const r = await fetch('/api/data');
    return r.json();
  },
});
```

**返回值必须可 JSON 序列化**——返回 DOM 节点会得到 `{}`，这是新手常见困惑。要传 DOM 信息，自己抽成普通对象。

## world：注入到哪个世界

```javascript
await chrome.scripting.executeScript({
  target: { tabId },
  world: 'MAIN',                  // 页面世界
  func: () => window.__INITIAL_STATE__,
});
```

| world | 能看到 | 用途 |
| ----- | ------ | ---- |
| `'ISOLATED'`（默认） | 扩展的隔离环境 + DOM | 常规操作，能用部分 `chrome.*` |
| `'MAIN'` | **页面的 `window` 与全局变量** | 读页面状态、hook 页面函数 |

::: info
**`world: 'MAIN'` 是 [content script 隔离世界](/manual/computer-programming/chrome-extension/content-scripts)那套 `postMessage` 桥接的现代替代。**

以前要读 `window.__INITIAL_STATE__`，得注入一个 `<script>` 文件、再用 `postMessage` 传回来，还得配 `web_accessible_resources`。现在一行搞定。

额外好处：**它不受页面 CSP 限制**——由浏览器直接注入，GitHub 这类严格 CSP 站点上照样能用，而手动插 `<script>` 会被拒。
:::

**但 `MAIN` 世界里没有 `chrome.runtime`**——拿到的数据只能靠返回值带出来：

```javascript
const [{ result }] = await chrome.scripting.executeScript({
  target: { tabId },
  world: 'MAIN',
  func: () => ({ state: window.__INITIAL_STATE__, ver: window.APP_VERSION }),
});
// result 回到扩展这边，再爱怎么处理怎么处理
```

::: warning
**`MAIN` 世界的代码和页面共享环境——页面能看到、也能篡改你注入的东西。** 别在这里放任何敏感逻辑或凭据，只用它取数据。
:::

## insertCSS / removeCSS

```javascript
await chrome.scripting.insertCSS({
  target: { tabId },
  css: 'body { filter: grayscale(1); }',
});

await chrome.scripting.removeCSS({
  target: { tabId },
  css: 'body { filter: grayscale(1); }',      // 必须字符串完全一致
});
```

**`removeCSS` 要求传入完全相同的 CSS 字符串**才能移除——所以把样式表存成常量，别在调用处内联拼接。

也可以用 `files: ['inject.css']`，移除时同样传相同的 `files`。

## 动态注册 content script

`executeScript` 是一次性的。要「以后所有匹配的页面都自动注入」，用 `registerContentScripts`：

```javascript
await chrome.scripting.registerContentScripts([{
  id: 'my-script',                     // 必填，唯一
  matches: ['https://*.example.com/*'],
  js: ['content.js'],
  runAt: 'document_idle',
  persistAcrossSessions: true,         // 默认 true，浏览器重启后仍在
  world: 'ISOLATED',
}]);
```

和 manifest 里的 `content_scripts` 效果一样，区别是**运行时可增删改**：

```javascript
await chrome.scripting.updateContentScripts([
  { id: 'my-script', matches: ['https://*.other.com/*'] },
]);

await chrome.scripting.unregisterContentScripts({ ids: ['my-script'] });

const all = await chrome.scripting.getRegisteredContentScripts();
```

::: warning
**`id` 重复会直接抛错**：`Duplicate script ID 'my-script'`。

由于 `persistAcrossSessions: true`（默认），注册的脚本会跨浏览器重启存活——所以 [SW 顶层](/manual/computer-programming/chrome-extension/service-worker)每次唤醒都注册一遍就会炸。

正确写法是**先清后注册**：

  ```javascript
  async function ensureRegistered(scripts) {
    const existing = await chrome.scripting.getRegisteredContentScripts();
    const ids = existing.map((s) => s.id);
    if (ids.length) await chrome.scripting.unregisterContentScripts({ ids });
    await chrome.scripting.registerContentScripts(scripts);
  }
  ```

或者放在 `chrome.runtime.onInstalled` 里注册一次。
:::

### 什么时候用动态注册

| 场景 | 方案 |
| ---- | ---- |
| 固定站点，装上就生效 | manifest 的 `content_scripts` |
| **用户可配置生效站点** | `registerContentScripts` |
| 按功能开关启用/停用 | `registerContentScripts` + `unregister` |
| 点击后一次性操作 | `executeScript` + `activeTab` |

「用户在选项页自己填要生效的网址」是最典型的动态注册场景——manifest 是静态的，做不到。

## 注入失败的常见原因

| 报错 | 原因 |
| ---- | ---- |
| `Cannot access contents of the page` | 没有该站点权限；或没在用户手势后用 `activeTab` |
| `Cannot access a chrome:// URL` | 目标是 `chrome://`、`chrome-extension://`、商店页——**永远不可注入** |
| `No tab with id` | 标签页已关闭 |
| `Frame with ID x was removed` | iframe 在注入过程中被移除，属正常竞态，忽略即可 |
| `ReferenceError: xxx is not defined` | 注入函数里用了外部变量（见上文 `args`） |

**注入前过滤掉不可注入的页面**：

```javascript
function injectable(url) {
  return /^https?:\/\//.test(url) && !url.startsWith('https://chromewebstore.google.com') && !url.startsWith('https://chrome.google.com/webstore');
}
```

## 小结

- `executeScript` **注入函数不是字符串**，且**没有闭包**——外部变量必须走 `args`。
- 返回值和 `args` 都要**可 JSON 序列化**。
- **`world: 'MAIN'`** 是读页面变量的现代方案，还**不受页面 CSP 限制**；但那里没有 `chrome.*`，数据靠返回值带出。
- `removeCSS` 要求 CSS 字符串**完全一致**。
- `registerContentScripts` 用于运行时可变的注入规则；**`id` 重复会抛错，且默认跨会话存活**——先清后注册。
- `chrome://` 与商店页**永远不可注入**，注入前先过滤。

下一篇：[declarativeNetRequest](/manual/computer-programming/chrome-extension/declarative-net-request)。
