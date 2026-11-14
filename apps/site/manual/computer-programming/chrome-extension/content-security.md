---
title: "内容安全策略"
description: "Chrome 插件开发指南 · extension_pages CSP、禁止 eval"
source: "https://daiw.org/manual/chrome-extension/content-security"
---

# 内容安全策略

Chrome 插件开发指南 · extension_pages CSP、禁止 eval

MV3 给扩展页面强制了一套 CSP，**其中几条不可放宽**。这是从 MV2 迁移时踩坑的第二大来源（第一是 [Service Worker 生命周期](/manual/computer-programming/chrome-extension/service-worker)），因为它会让一批常用的库和构建配置直接跑不起来。

## 默认策略

不写任何配置时，扩展页面（popup、options、side panel 等 `chrome-extension://` 页面）适用：

```text
script-src 'self'; object-src 'self';
```

含义：

| 规则 | 后果 |
| ---- | ---- |
| `script-src 'self'` | **只能加载扩展包内的 JS** |
| 无 `'unsafe-inline'` | **禁止内联 `<script>` 和 `onclick=""`** |
| 无 `'unsafe-eval'` | **禁止 `eval` / `new Function` / 字符串形式的 `setTimeout`** |

## 三条硬红线

### ① 不能从 CDN 加载脚本

```html
<!-- ✗ 直接被拒 -->
<script src="https://cdn.jsdelivr.net/npm/vue@3"></script>
```

```text
Refused to load the script 'https://cdn.jsdelivr.net/...' because it violates
the following Content Security Policy directive: "script-src 'self'".
```

**所有依赖必须打包进扩展。** 这不是「建议」——`script-src` 不允许加 https 源，MV3 明确禁止远程代码。

顺带一提，这也是商店政策：**远程托管代码在 MV3 是被禁止的**，即使技术上绕过了 CSP，上架也会被拒。

### ② 不能用内联脚本

```html
<!-- ✗ -->
<button onclick="doSomething()">点我</button>
<script>console.log('hi')</script>
```

```html
<!-- ✓ -->
<button id="btn">点我</button>
<script src="popup.js" type="module"></script>
```

```javascript
// popup.js
document.getElementById('btn').addEventListener('click', doSomething);
```

::: info
**这条约束意外地是好事。** 强制「行为与结构分离」，让扩展页面的代码天然比典型网页干净。

迁移老代码时，把所有 `onclick=""` 改成 `addEventListener` 是最常见的一批改动。
:::

### ③ 不能用 eval

```javascript
eval('1 + 1');                          // ✗
new Function('return 1')();             // ✗
setTimeout('doSomething()', 100);       // ✗ 字符串形式
setTimeout(() => doSomething(), 100);   // ✓ 函数形式
```

::: warning
**`'unsafe-eval'` 在 MV3 里不能被放宽。** MV2 时代可以在 CSP 里加它，MV3 直接拒绝这个值——写了会导致扩展加载失败。

受影响的常见场景：

| 东西 | 为什么炸 | 出路 |
| ---- | -------- | ---- |
| 模板引擎（Handlebars 完整版、旧版 Vue 运行时编译） | 用 `new Function` 编译模板 | 换**预编译**版本（Vue runtime-only、Handlebars precompiled） |
| Vite / Webpack **dev server** | HMR 注入内联脚本 + eval | 用 `build --watch`，或 [WXT / Plasmo](/manual/computer-programming/chrome-extension/project-structure) |
| source map 的 `eval` 模式 | devtool 默认可能是 `eval-*` | 改成 `devtool: 'source-map'` |
| 某些 polyfill / 老库 | 内部用 eval | 换库，或找 CSP-safe 构建 |
:::

**Webpack 配置要点：**

```javascript
module.exports = {
  devtool: 'source-map',      // 不能是 eval-source-map / cheap-eval-*
  mode: 'production',
};
```

`mode: 'development'` 的默认 devtool 就是 `eval` 系的——这是「开发能跑、打包就炸」或反过来的常见原因。

## 能改什么

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; img-src 'self' https: data:; connect-src 'self' https://api.example.com;"
  }
}
```

| 指令 | 能否放宽 | 说明 |
| ---- | -------- | ---- |
| `script-src` | **否**（只能是 `'self'` 及 wasm 相关） | 硬约束 |
| `object-src` | 否 | 硬约束 |
| `img-src` | ✅ | 默认已允许 https 与 data: |
| `style-src` | ✅ | 需要内联样式时加 `'unsafe-inline'` |
| `connect-src` | ✅ | 限制 `fetch` / WebSocket 目标 |
| `frame-src` | ✅ | 允许嵌入哪些 iframe |
| `font-src` / `media-src` | ✅ | 按需 |

**只有 `script-src` 和 `object-src` 是不可协商的**，其余按需收放。

### WebAssembly

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
  }
}
```

`'wasm-unsafe-eval'` 是**唯一被允许加进 `script-src` 的额外值**——它只放开 wasm 编译，不放开 JS eval。跑本地模型推理、图像处理这类场景会用到。

## sandbox：需要 eval 时的正规出路

真的必须执行动态代码（比如让用户写自定义脚本），用 **sandbox 页面**：

```json
{
  "sandbox": {
    "pages": ["sandbox.html"]
  },
  "content_security_policy": {
    "sandbox": "sandbox allow-scripts; script-src 'self' 'unsafe-eval'; object-src 'self';"
  }
}
```

sandbox 页面的特点：

- ✅ **可以用 `eval`**
- ❌ **没有任何 `chrome.*` API 权限**
- ❌ 处于**独立的 opaque origin**，访问不了扩展的存储

用法是把它当 iframe 嵌进普通扩展页，靠 `postMessage` 通信：

```javascript
// popup.js
const frame = document.getElementById('sandbox');
frame.contentWindow.postMessage({ code: userScript, data }, '*');

window.addEventListener('message', (e) => {
  if (e.source !== frame.contentWindow) return;
  render(e.data.result);
});
```

```html
<!-- sandbox.html -->
<script src="sandbox.js"></script>
```

```javascript
// sandbox.js —— 这里可以 eval
window.addEventListener('message', (e) => {
  const result = new Function('data', e.data.code)(e.data.data);
  e.source.postMessage({ result }, '*');
});
```

::: warning
**sandbox 是隔离手段，不是安全保证。** 它只保证「沙箱里的代码碰不到 `chrome.*` 和你的数据」，不保证代码本身无害——它照样能死循环、耗内存。

执行用户提供的代码前想清楚：这个功能真的必要吗？大多数「让用户写脚本」的需求，用配置项 + 预定义规则就能满足，风险小得多。
:::

## content script 不受扩展 CSP 约束

[Content Script](/manual/computer-programming/chrome-extension/content-scripts) 跑在网页里，**适用的是那个网页的 CSP，不是扩展的**。

这带来两个实际影响：

1. **CS 里可以 `eval`**（只要页面 CSP 允许）——但别依赖这点，很多站点的 CSP 也禁了。
2. **CS 向页面注入 `<script>` 可能被页面 CSP 挡住**：

```text
Refused to load the script because it violates the following Content Security
Policy directive: "script-src 'self' 'nonce-xxx'"
```

严格 CSP 的站点（GitHub、Google 系）会拒绝你注入的脚本。绕法是用 [Scripting API 的 `world: 'MAIN'`](/manual/computer-programming/chrome-extension/scripting-api)——它由浏览器注入，**不受页面 CSP 限制**。

## 排查

CSP 违规一律在 **Console** 报错，且信息很明确：

```text
Refused to <动作> because it violates the following Content Security Policy
directive: "<被违反的指令>".
```

看两个信息：**被拒的是什么动作**（load script / eval / connect），**违反了哪条指令**。对照上面的表就知道该改配置还是改代码。

注意去**对应上下文的 DevTools** 看——popup 的错误不会出现在网页的 Console 里，见[调试](/manual/computer-programming/chrome-extension/debugging)。

## 小结

- 扩展页面默认 CSP 是 **`script-src 'self'; object-src 'self'`**。
- 三条红线：**不能从 CDN 加载脚本、不能内联脚本、不能 eval**，且 **`'unsafe-eval'` 在 MV3 无法放宽**。
- 受害最多的是**模板引擎运行时编译**和**dev server 的 HMR**——换预编译版本 / `build --watch`。
- Webpack 的 `devtool` 不能用 `eval-*` 系。
- `img-src` / `style-src` / `connect-src` 等**可以放宽**，只有 `script-src` / `object-src` 不行。
- wasm 用 **`'wasm-unsafe-eval'`**，这是唯一允许的额外值。
- 真要动态执行代码，用 **sandbox 页面**（有 eval，但没有 `chrome.*`）。
- **content script 适用网页的 CSP**；被站点 CSP 挡住时改用 `world: 'MAIN'`。

下一篇：[Side Panel](/manual/computer-programming/chrome-extension/side-panel)。
