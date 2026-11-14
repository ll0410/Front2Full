---
title: "Popup 与选项页"
description: "Chrome 插件开发指南 · action popup、options_page、React 集成"
source: "https://daiw.org/manual/chrome-extension/popup-and-ui"
---

# Popup 与选项页

Chrome 插件开发指南 · action popup、options_page、React 集成

Popup、选项页、[Side Panel](/manual/computer-programming/chrome-extension/side-panel) 都属于**扩展页面**——跑在 `chrome-extension://` 源下的普通 HTML，能用全部 `chrome.*` API，但受[扩展 CSP](/manual/computer-programming/chrome-extension/content-security) 约束。

## Popup

```json
{ "action": { "default_popup": "popup.html" } }
```

```html
<!-- popup.html -->
<!doctype html>
<html>
  <head><link rel="stylesheet" href="popup.css" /></head>
  <body>
    <div id="app"></div>
    <script src="popup.js" type="module"></script>
  </body>
</html>
```

### 三条必须记住的特性

::: warning
**① Popup 一关就彻底销毁。** 不是隐藏——是整个文档被销毁，JS 状态、定时器、未完成的请求全没了。

所以：**任何要保留的状态必须立刻写进 [`chrome.storage`](/manual/computer-programming/chrome-extension/storage)**，别指望「用户再打开时还在」。

这也意味着**别在 popup 里发起长任务**。用户点完就关，请求还没回来 popup 就死了。长任务交给 [Service Worker](/manual/computer-programming/chrome-extension/service-worker)。
:::

**② 尺寸由内容撑开**，不能用 JS 设置窗口大小。

```css
body {
  width: 360px;      /* 上限 800px */
  min-height: 200px; /* 上限 600px */
}
```

不写宽度的话，Popup 会按内容自适应——异步加载数据时会出现「先窄后宽」的跳动。**固定宽度是标准做法。**

**③ 没有 `alert` / `confirm` / `prompt`。** 扩展页面里这些被禁用，要自己画对话框。

### Popup 与后台通信

```javascript
// popup.js
const data = await chrome.runtime.sendMessage({ type: 'GET_DATA' });
render(data);

// 也可以直接读 storage，往往更简单
const { config } = await chrome.storage.local.get('config');
```

::: info
**优先用 `chrome.storage` 而不是消息。** popup 打开时读一次 storage，比来回发消息简单，还天然避开了「SW 正好被回收、消息发不出去」的时序问题。

只有需要**触发动作**（而非读数据）时才发消息。
:::

## 选项页

两种写法：

```json
{ "options_page": "options.html" }
```

```json
{
  "options_ui": {
    "page": "options.html",
    "open_in_tab": false
  }
}
```

| | `options_page` | `options_ui` |
| --- | --- | --- |
| 打开方式 | 新标签页 | 嵌入 `chrome://extensions` 的对话框（`open_in_tab: false`） |
| 适合 | 设置项多、需要完整版面 | 设置项少 |

**推荐用 `options_ui`**——它更现代，且能通过 `open_in_tab: true` 退化成新标签页行为。

从代码打开选项页：

```javascript
chrome.runtime.openOptionsPage();
```

在 popup 里放一个「设置」入口指向它，是常见做法。

### 选项页的配置该存哪

```javascript
// 用 sync：跨设备同步，但配额小（约 100 KB，单项 8 KB）
await chrome.storage.sync.set({ theme: 'dark', apiKey: '' });
```

用户配置几乎总该进 `sync`——换台电脑设置还在，体验好很多。**但别把 API key 之类的东西放 sync**（它会同步到 Google 账号）。配额与选型见[存储 API](/manual/computer-programming/chrome-extension/storage)。

完整实战见[第 6 课：Options Page](/manual/computer-programming/chrome-extension/lesson-06-options-page)。

## 三种 UI 怎么选

| | Popup | 选项页 | [Side Panel](/manual/computer-programming/chrome-extension/side-panel) |
| --- | --- | --- | --- |
| 触发 | 点工具栏图标 | 主动打开 | 点图标 / API 打开 |
| 生命周期 | **关闭即销毁** | 标签页级 | **可长期停留** |
| 与页面并存 | 否（点页面就关） | 否 | **是** |
| 适合 | 快速操作、状态一览 | 配置 | 需要边看页面边操作 |

**判据：** 用户要不要「一边看网页一边用你的 UI」？要——Side Panel；不要——Popup。

## React / Vue 集成

扩展页面就是普通网页，框架照常用。唯一的额外约束是 **CSP 禁止 `eval` 和内联脚本**。

### Vite 配置

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: 'popup.html',
        options: 'options.html',
      },
    },
  },
});
```

多入口分别打包，manifest 里指向 `dist/` 下的产物。

::: warning
**开发模式的 HMR 在扩展里跑不通。** Vite dev server 靠注入内联脚本和 `eval` 工作，两者都被扩展 CSP 挡住。

三条出路：

1. **`build --watch`** —— 改完自动重建，去 `chrome://extensions` 点刷新。最朴素，但可靠。
2. **用 [WXT 或 Plasmo](/manual/computer-programming/chrome-extension/project-structure)** —— 它们专门解决了扩展的 HMR 问题。
3. 先在普通网页环境里开发 UI（`chrome.*` 打桩），成型后再接进扩展。

别试图放宽 CSP 来适配 dev server——`unsafe-eval` 在扩展里不被允许，上架也会被拒。
:::

### 一个小陷阱：popup 的挂载时机

```javascript
// popup 太小、渲染太快时，可能出现闪烁
const root = createRoot(document.getElementById('app'));

// 先取数据再渲染，避免「空白 → 有内容」的跳动
const { config } = await chrome.storage.local.get('config');
root.render(<App config={config} />);
```

Popup 的生命周期只有几秒，**先取数据后渲染**比先渲染骨架屏体验更好——这和普通 Web 应用的直觉相反。

## 扩展页面的 URL

所有扩展页面都能直接访问：

```text
chrome-extension://<扩展ID>/popup.html
```

在新标签页打开它调试很方便——**但要注意行为不完全一样**：以标签页方式打开的 popup 不会被关闭销毁，某些依赖「关闭即销毁」的 bug 在这里复现不出来。

## 小结

- Popup **关闭即销毁**，状态立刻进 storage，长任务交给 SW。
- 宽度固定（上限 800×600），没有 `alert` / `confirm`。
- 选项页优先用 **`options_ui`**；用户配置存 `chrome.storage.sync`，但**别放密钥**。
- 三种 UI 的判据：**要不要边看网页边操作**。
- React/Vue 正常可用，但 **dev server 的 HMR 用不了**——`build --watch` 或换 WXT/Plasmo。

下一篇：[消息传递](/manual/computer-programming/chrome-extension/messaging)。
