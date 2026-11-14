---
title: "Side Panel"
description: "Chrome 插件开发指南 · sidePanel API、与当前 Tab 联动"
source: "https://daiw.org/manual/chrome-extension/side-panel"
---

# Side Panel

Chrome 插件开发指南 · sidePanel API、与当前 Tab 联动

Side Panel 是 Chrome 114 引入的侧边栏 UI。它填补了一个长期空白：**一个能和网页并存、不会点一下就消失的扩展界面**。

## 它解决了什么

```text
Popup                          Side Panel
┌──────────┐                   ┌────────┬──────────┐
│  网页     │                   │  网页   │  面板     │
│    ┌────┐│  ← 点页面就关       │        │  一直在   │
│    │弹窗││                    │        │  可交互   │
│    └────┘│                    │        │          │
└──────────┘                   └────────┴──────────┘
```

[Popup 关闭即销毁](/manual/computer-programming/chrome-extension/popup-and-ui)，所以「一边看网页一边操作」这类需求以前只能靠**注入浮层**（DOM 冲突、样式打架、被页面 CSP 挡）或**开新标签页**（离开了原页面）。Side Panel 是官方答案。

典型场景：AI 助手、翻译对照、笔记摘录、页面数据分析。

## 最小配置

```json
{
  "manifest_version": 3,
  "name": "侧边栏示例",
  "version": "0.1.0",
  "minimum_chrome_version": "114",
  "permissions": ["sidePanel"],
  "side_panel": { "default_path": "sidepanel.html" }
}
```

```html
<!-- sidepanel.html —— 就是普通扩展页面 -->
<!doctype html>
<html>
  <body>
    <div id="app"></div>
    <script src="sidepanel.js" type="module"></script>
  </body>
</html>
```

::: info
**记得写 `minimum_chrome_version`。** Side Panel 需要 Chrome 114+，不声明的话老版本用户装上会得到一个「点了没反应」的扩展，比装不上更糟。
:::

## 点图标就打开

默认点击工具栏图标**不会**打开侧边栏（除非你没配 `default_popup`，也没监听 `onClicked`）。最省事的做法：

```javascript
// background.js
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);
```

一行搞定「点图标 → 开侧边栏」。

::: warning
**`setPanelBehavior` 要在顶层调用，不要放在 `onInstalled` 里。**

它设置的是运行时行为，而 [SW 每次被唤醒都会重跑顶层代码](/manual/computer-programming/chrome-extension/service-worker)——放顶层能保证每次唤醒后行为都正确。放 `onInstalled` 里则只在安装/更新时执行一次，SW 重启后可能失效。
:::

## 手动打开：必须在用户手势里

```javascript
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});
```

```javascript
// 右键菜单里打开
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});
```

**`chrome.sidePanel.open()` 必须在用户手势的调用栈里**，否则报错：

```text
`sidePanel.open()` may only be called in response to a user gesture.
```

这条限制经常被误触发——**一旦中间有 `await`，手势上下文就断了**：

```javascript
// ✗ await 之后手势上下文已丢失
chrome.action.onClicked.addListener(async (tab) => {
  const { config } = await chrome.storage.local.get('config');
  await chrome.sidePanel.open({ tabId: tab.id });     // 报错
});
```

```javascript
// ✓ 先开面板，再取数据
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });     // 第一件事
  const { config } = await chrome.storage.local.get('config');
});
```

**规则：`open()` 放在 handler 的第一行。**

## 按标签页切换内容

Side Panel 可以做到「不同网站显示不同面板」：

```javascript
const SITE_PANELS = {
  'github.com': 'panels/github.html',
  'stackoverflow.com': 'panels/so.html',
};

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!info.status || !tab.url) return;

  const host = new URL(tab.url).hostname;
  const path = SITE_PANELS[host];

  if (path) {
    await chrome.sidePanel.setOptions({ tabId, path, enabled: true });
  } else {
    // 该站点不启用侧边栏
    await chrome.sidePanel.setOptions({ tabId, enabled: false });
  }
});
```

| 作用域 | 写法 |
| ------ | ---- |
| 全局默认 | `setOptions({ path, enabled })`（不传 `tabId`） |
| 单个标签页 | `setOptions({ tabId, path, enabled })` |

**标签页级设置会覆盖全局设置**，且随标签页关闭而消失。

::: warning
**`enabled: false` 只是禁用，不会关闭已打开的面板。** 用户已经开着的侧边栏不会因为你设了 `enabled: false` 就消失——它会保持显示上一次的内容。

早期版本没有程序化关闭接口；从 **Chrome 141+** 起，可调用 `await chrome.sidePanel.close({ windowId })`（或 `{ tabId }`）主动关闭侧边栏，面板内部也可调用 `window.close()` 自关。此外 **Chrome 140+** 新增了 `await chrome.sidePanel.getLayout()` 用于读取侧边栏停靠在左侧（`'left'`）还是右侧（`'right'`）。
:::

## 与当前 Tab 联动

Side Panel 是[扩展页面](/manual/computer-programming/chrome-extension/popup-and-ui)，能用全部 `chrome.*` API，但它**不随标签页切换而重新加载**——用户切到别的标签页，你的面板还是原来那个文档。

所以要自己监听切换：

```javascript
// sidepanel.js
async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  render(tab);
}

// 初次加载
refresh();

// 用户切标签页
chrome.tabs.onActivated.addListener(refresh);

// 当前标签页导航到新 URL
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (tab.active && info.status === 'complete') refresh();
});
```

**这两个监听器都要有**——只监听 `onActivated` 会漏掉「在同一标签页里跳转」的情况。

### 拿页面内容

面板本身碰不到网页 DOM，要通过 [content script](/manual/computer-programming/chrome-extension/content-scripts) 或 [Scripting API](/manual/computer-programming/chrome-extension/scripting-api)：

```javascript
// sidepanel.js
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

const [{ result }] = await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: () => ({
    title: document.title,
    text: document.body.innerText.slice(0, 5000),
  }),
});

render(result);
```

需要 `scripting` 权限 + 站点权限（或 [`activeTab`](/manual/computer-programming/chrome-extension/permissions)）。

## 生命周期

| | Popup | Side Panel |
| --- | --- | --- |
| 关闭时 | **销毁** | **销毁**（但用户很少关） |
| 切标签页 | 已经关了 | **保持**，文档不重载 |
| 切窗口 | — | 每个窗口一个独立实例 |

::: info
**每个浏览器窗口有自己的侧边栏实例。** 开两个窗口，就有两份 `sidepanel.html` 在跑，它们的 JS 状态互不相通。

要让它们保持一致，走 [`chrome.storage` + `onChanged`](/manual/computer-programming/chrome-extension/storage)——这是跨实例同步最省事的办法。
:::

侧边栏可能长时间开着，所以**内存泄漏在这里比 popup 严重得多**。定时器、监听器、大数组要注意回收。

## 调试

```text
右键侧边栏 → 检查
```

打开的就是它的 DevTools。注意侧边栏窄，DevTools 建议改成独立窗口（DevTools 右上角菜单 → Dock side → 独立窗口）。

## 该用 Popup 还是 Side Panel

```text
用户需要「边看网页边操作」吗？
  ├── 是  →  Side Panel
  └── 否  →  Popup（更轻，用户预期也更明确）

内容多、需要滚动、会停留几分钟？  →  Side Panel
点一下就完事（开关、快捷操作）？   →  Popup
```

**两者可以共存**：popup 放快捷开关，里面放一个「打开面板」按钮。

## 小结

- Side Panel 填补了「**与网页并存、不会一点就消失**」的空白。
- 需要 **Chrome 114+**，记得写 `minimum_chrome_version`。
- `setPanelBehavior({ openPanelOnActionClick: true })` 放 **SW 顶层**，一行实现点图标打开。
- **`open()` 必须在用户手势里，且要放 handler 第一行**——中间有 `await` 就会失效。
- `setOptions({ tabId })` 可按站点切换面板；**`enabled: false` 不会关闭已打开的面板**。
- 面板**不随标签页切换重载**，要同时监听 `onActivated` 和 `onUpdated`。
- **每个窗口一个独立实例**，跨实例同步走 storage。

下一篇：[Scripting API](/manual/computer-programming/chrome-extension/scripting-api)。
