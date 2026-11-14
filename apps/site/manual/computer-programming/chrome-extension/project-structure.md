---
title: "项目结构"
description: "Chrome 插件开发指南 · TypeScript、WXT/Plasmo、monorepo"
source: "https://daiw.org/manual/chrome-extension/project-structure"
---

# 项目结构

Chrome 插件开发指南 · TypeScript、WXT/Plasmo、monorepo

一个扩展从「几个文件」长到「需要构建」的转折点，通常是这三件事之一：**想用 TypeScript**、**想用 npm 包**、**想用框架写 UI**。这一章讲怎么组织，以及要不要上框架。

## 什么时候还不需要构建

[配套的 10 课 Demo](https://github.com/davidapp/chrome-extension-demos) 全是纯手写 MV3、零构建——这是有意的：**学阶段的构建工具是噪音**。

```text
my-extension/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
└── icons/
```

改完直接在 `chrome://extensions` 刷新，所见即所得。**在你确实被 TypeScript / npm 包 / 框架卡住之前，别加构建。**

## 加构建之后的结构

```text
my-extension/
├── src/
│   ├── background/index.ts      Service Worker
│   ├── content/index.ts         Content Script
│   ├── popup/{index.html,App.tsx}
│   ├── options/{index.html,App.tsx}
│   ├── lib/                     纯逻辑（可单测，不碰 chrome.*）
│   └── shared/types.ts          消息协议等共享类型
├── public/
│   ├── icons/
│   └── _locales/                i18n
├── manifest.config.ts           生成 manifest（可以写注释和条件）
├── vite.config.ts
├── dist/                        构建产物，加载这个目录
└── package.json
```

::: info
**`lib/` 与其余目录的分界很重要。** 把不依赖 `chrome.*` 的纯逻辑集中放在 `lib/`，好处是：

- 能用普通单测覆盖（见[测试策略](/manual/computer-programming/chrome-extension/testing)）
- 换 UI 框架、甚至移植到 Firefox 时不用动
- 复杂逻辑不会淹没在 API 调用里

**这条边界是扩展项目里最值得一开始就守住的纪律。**
:::

## manifest 用代码生成

manifest.json [不能写注释](/manual/computer-programming/chrome-extension/manifest-overview)，也没法按环境区分。生成它：

```typescript
// manifest.config.ts
import pkg from './package.json';

const isDev = process.env.NODE_ENV !== 'production';

export default {
  manifest_version: 3,
  name: isDev ? '[DEV] 我的扩展' : '我的扩展',
  version: pkg.version,                    // 与 package.json 单一来源
  icons: { 48: 'icons/48.png', 128: 'icons/128.png' },

  action: { default_popup: 'src/popup/index.html' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },

  permissions: [
    'storage',
    'activeTab',
    // 只在开发时需要：看 DNR 命中了哪条规则
    ...(isDev ? ['declarativeNetRequestFeedback'] : []),
  ],
} satisfies chrome.runtime.ManifestV3;
```

三个直接收益：**版本号与 `package.json` 同源**、**开发版换个名字避免和线上版混淆**、**调试权限不会漏进正式包**。

## TypeScript

```bash
pnpm add -D typescript @types/chrome
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "types": ["chrome"],
    "lib": ["ES2022", "DOM", "WebWorker"]
  }
}
```

`"types": ["chrome"]` 让 `chrome.*` 有完整补全。

给消息定义类型，是投入产出比最高的一处：

```typescript
// shared/types.ts
export type Message =
  | { type: 'GET_USER' }
  | { type: 'SAVE'; data: Todo[] }
  | { type: 'FETCH'; url: string };

export type Response<M extends Message> =
  M extends { type: 'GET_USER' } ? User :
  M extends { type: 'FETCH' } ? string :
  void;
```

```typescript
export async function send<M extends Message>(msg: M): Promise<Response<M>> {
  return chrome.runtime.sendMessage(msg);
}
```

**[消息传递](/manual/computer-programming/chrome-extension/messaging)是扩展里最容易出错的地方**（字段拼错、忘了某个 case），类型能在编译期挡掉一大批。

## 构建工具三选一

### ① Vite（手动配）

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: { outDir: 'dist' },
});
```

`@crxjs/vite-plugin` 处理了扩展特有的麻烦事：多入口、content script 的 CSS 注入、开发时的热更新。

**没有插件的话**，多入口要自己配 `rollupOptions.input`，并且 [HMR 用不了](/manual/computer-programming/chrome-extension/content-security)。

### ② WXT

```bash
pnpm dlx wxt@latest init my-extension
```

```typescript
// entrypoints/background.ts
export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => { /* … */ });
});
```

```typescript
// entrypoints/content.ts
export default defineContentScript({
  matches: ['https://*.example.com/*'],
  main() { /* … */ },
});
```

**约定式入口**——文件放在 `entrypoints/` 下，manifest 自动生成。支持 Chrome / Firefox 双端产物，HMR 能用。

### ③ Plasmo

```bash
pnpm create plasmo
```

风格更「Next.js」：`popup.tsx` 直接就是 popup，`contents/` 下的文件自动成为 content script，内置 storage / messaging 的封装。

### 怎么选

| | 手配 Vite | WXT | Plasmo |
| --- | --- | --- | --- |
| 控制力 | **最高** | 中 | 较低 |
| 上手 | 慢 | 快 | 最快 |
| HMR | 需插件 | ✅ | ✅ |
| 跨浏览器 | 自己搞 | **✅ 内置** | ✅ |
| 抽象层 | 无 | 薄 | **厚**（自带 API 封装） |
| 适合 | 已有构建体系、要精确控制 | **多数项目** | 快速起项目、不介意框架约定 |

::: info
**默认推荐 WXT。** 它解决了扩展开发最痛的两件事（HMR、跨浏览器），同时抽象层足够薄——你写的还是 `chrome.*`，遇到问题能直接对照官方文档排查。

Plasmo 的封装更厚，出问题时得先搞清楚是你的代码、还是它的封装。**框架抽象越厚，调试时的隔阂越大**——扩展这种本来就难调的东西，我倾向少一层。
:::

## 跨浏览器

Firefox / Edge 也支持 MV3，但有差异：

| | Chrome | Firefox |
| --- | --- | --- |
| 命名空间 | `chrome.*` | `browser.*`（也兼容 `chrome.*`） |
| API 风格 | Promise（新版） | Promise |
| 后台 | Service Worker | **Event Page**（MV3 下仍支持） |
| `host_permissions` | 安装时授予 | **默认不授予**，用户手动开 |

统一写法用 `webextension-polyfill`：

```javascript
import browser from 'webextension-polyfill';
await browser.storage.local.get('key');
```

**但如果只做 Chrome，别引它**——多一层封装、多一份体积，收益为零。WXT 内置了跨浏览器构建，需要时再开。

## i18n

```text
public/_locales/
├── en/messages.json
└── zh_CN/messages.json
```

```json
// zh_CN/messages.json
{
  "extName": { "message": "我的扩展" },
  "addTodo": { "message": "添加待办" }
}
```

```json
// manifest
{ "name": "__MSG_extName__", "default_locale": "en" }
```

```javascript
chrome.i18n.getMessage('addTodo');
```

**`default_locale` 一旦声明，manifest 里所有面向用户的字符串都建议走 `__MSG_*__`**，否则商店列表里会中英混杂。

## Monorepo

一个扩展 + 一个配套网站 + 共享逻辑时才值得：

```text
repo/
├── packages/
│   ├── core/          纯逻辑，两端共用
│   ├── extension/
│   └── web/
├── pnpm-workspace.yaml
└── package.json
```

::: warning
**别为了一个扩展上 monorepo。** 它带来的构建复杂度（workspace 依赖解析、产物路径、CI 缓存）在单扩展场景下纯属负担。

判据很简单：**有没有第二个消费者要用同一份逻辑？** 没有就别拆。
:::

## .gitignore 与打包

```text
# .gitignore
node_modules/
dist/
*.zip
.env
```

打包脚本：

```json
{
  "scripts": {
    "build": "vite build",
    "zip": "cd dist && zip -r ../extension.zip . -x '*.map'"
  }
}
```

**排除 source map**——它会让包体积翻倍，且暴露原始代码结构。详见[上架](/manual/computer-programming/chrome-extension/publish-chrome-web-store)。

## 小结

- **被 TypeScript / npm 包 / 框架卡住之前，别加构建**。
- 守住 **`lib/` 只放纯逻辑**这条边界——可测、可移植、可读。
- **用代码生成 manifest**：版本同源、开发版改名、调试权限不漏进正式包。
- 给**消息协议定类型**，是 TS 在扩展项目里回报最大的一处。
- 构建工具**默认选 WXT**（HMR + 跨浏览器，抽象够薄）；要精确控制用 Vite + `@crxjs`。
- 只做 Chrome 就**别引 polyfill**。
- **单扩展不要上 monorepo**——除非真有第二个消费者。
- 打包**排除 source map**。

下一篇：[上架 Chrome Web Store](/manual/computer-programming/chrome-extension/publish-chrome-web-store)。
