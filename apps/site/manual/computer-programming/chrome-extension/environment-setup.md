---
title: "开发环境准备"
description: "Chrome 插件开发指南 · Chrome 版本、加载未打包扩展、推荐目录结构与工具链"
source: "https://daiw.org/manual/chrome-extension/environment-setup"
---

# 开发环境准备

Chrome 插件开发指南 · Chrome 版本、加载未打包扩展、推荐目录结构与工具链

写扩展不需要特殊 SDK：一个文本编辑器 + Chrome 即可。本篇说明**最低环境**、如何**加载未打包扩展**做热调试，以及团队项目常用的目录与构建工具选型。

::: info
**10 课实战完整源码**已开源：[github.com/davidapp/chrome-extension-demos](https://github.com/davidapp/chrome-extension-demos)。clone 后每个课次目录均可直接在 `chrome://extensions` 加载验证。
:::

## 直觉：像本地跑静态站，但入口是 manifest

网页开发用 `npm run dev` 起服务器；扩展开发是告诉 Chrome：**这个文件夹是一个扩展**，Chrome 按 `manifest.json` 注册 Service Worker 和注入规则。改代码后大多数情况下只需**在 `chrome://extensions` 点刷新**。

## 环境要求

| 项 | 建议 |
| -- | ---- |
| 浏览器 | **Chrome 128+**（建议使用最新稳定版，如 Chrome 140+ / Edge 140+）；开发时打开 `chrome://version` 确认 |
| 编辑器 | VS Code / Cursor；推荐扩展 [Chrome Extension Manifest File](https://marketplace.visualstudio.com/items?itemName=JuanFranBlanco.chrome-extension-manifest-file) 做 JSON 校验 |
| Node.js | 可选；用 TypeScript、打包、ESLint 时需要 **Node 22+**（与本站一致） |
| 账号 | 仅上架商店需要 **\$5 一次性** Chrome Web Store 开发者注册费 |

## 获取开源 Demo 仓库

```bash
git clone https://github.com/davidapp/chrome-extension-demos.git
cd chrome-extension-demos
```

也可 [Download ZIP](https://github.com/davidapp/chrome-extension-demos/archive/refs/heads/main.zip) 解压。仓库内 `01-hello-popup` … `10-offscreen-document` 十个目录与 [实战课程](/manual/computer-programming/chrome-extension/lesson-01-hello-popup) 一一对应，每目录 README 含逐步操作说明。

## 加载未打包扩展

1. 打开 `chrome://extensions`
2. 右上角开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择含 `manifest.json` 的目录
4. 修改文件后，在该扩展卡片上点击 **刷新**（或勾选「重新加载扩展」相关选项）

```text
my-extension/
├── manifest.json      # 必需
├── service-worker.js  # 示例：后台
├── popup.html
├── popup.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

::: warning
加载目录后，**不要删除或移动**该文件夹；Chrome 记录的是路径。换机器请复制整个目录或改用 zip 打包加载。
:::

## 推荐目录结构（中小型项目）

```text
chrome-extension/
├── manifest.json
├── src/
│   ├── background/        # Service Worker
│   ├── content/           # Content Scripts
│   ├── popup/             # Popup React/Vanilla
│   └── lib/               # 共享工具
├── public/
│   └── icons/
├── package.json           # 若用构建工具
└── dist/                  # 构建产物（加载此目录）
```

原则：**开发时加载 `dist/` 或根目录二选一**，manifest 里引用的路径与加载目录一致。

## 工具链选型（可选）

| 工具 | 适合 | 说明 |
| ---- | ---- | ---- |
| 纯手写 | 教程、极小扩展 | 零依赖，本章 [Hello World](/manual/computer-programming/chrome-extension/hello-world) 即此路线 |
| [WXT](https://wxt.dev/) | 现代 TS 项目 | 类 Vite 体验，热重载、多浏览器目标 |
| [Plasmo](https://www.plasmo.com/) | React 优先 | 框架感强，上手快 |
| `esbuild` / `rollup` 自配 | 已有 monorepo | 扩展作为子包，完全自控 |

本专栏示例以**手写 MV3** 为主，避免框架掩盖 manifest 细节；工程化篇再展开 [项目结构](/manual/computer-programming/chrome-extension/project-structure)。

## 调试入口速查

| 要调试的对象 | 入口 |
| ------------ | ---- |
| Service Worker | `chrome://extensions` → 扩展卡片 → **Service Worker** 链接 |
| Popup | 右键扩展图标 → **检查弹出内容** |
| Content Script | 普通网页 DevTools → Sources → Content scripts |
| 扩展页（options 等） | 右键页面 → 检查 |

## 常见误区

1. **改 manifest 却不点刷新**——多数 manifest 变更必须重载扩展；仅改 Content Script 有时刷新页面即可。
2. **路径写错**——`"service_worker": "src/bg.js"` 但加载的是 `dist/`，会报 **Could not load background script**。
3. **用 file:// 测 Content Script**——部分匹配规则不对本地文件生效；用 `https://example.com` 或本地静态服务器。

## 动手试一试

1. Clone 开源 Demo 仓库（若仅跟 [Hello World](/manual/computer-programming/chrome-extension/hello-world) 手写，可跳过此步自建空目录）：

```bash
git clone https://github.com/davidapp/chrome-extension-demos.git
cd chrome-extension-demos
```

2. 打开 `chrome://extensions`，开启**开发者模式**，确认能看到 **加载已解压的扩展程序**
3. 加载 `01-hello-popup` 体验第一课，或下一篇在空目录手写最小 manifest

## 小结

Chrome 128+、开发者模式、加载含 `manifest.json` 的目录，即构成最小开发环境。建议 clone [开源 Demo 仓库](https://github.com/davidapp/chrome-extension-demos) 按课次实战。记住 **改代码 → 刷新扩展/页面** 的循环。下一篇写出第一个可点击的 Hello World。

→ 下一篇：[Hello World](/manual/computer-programming/chrome-extension/hello-world)
