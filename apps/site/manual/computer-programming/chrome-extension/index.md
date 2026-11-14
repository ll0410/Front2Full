---
title: "Chrome 插件开发指南"
description: "基于 Manifest V3 的 Chrome 扩展开发中文指南——从 Hello World 到上架 Chrome Web Store。"
source: "https://daiw.org/manual/chrome-extension"
---

# Chrome 插件开发指南

> 内容来源：[daiw.org](https://daiw.org/manual/chrome-extension) · 作者 David · 原文更新于 2026-11-06

基于 Manifest V3 的 Chrome 扩展开发中文指南——从 Hello World 到上架 Chrome Web Store。

Chrome 扩展（Extension）是在浏览器里运行的**小型程序**：可以改网页、拦请求、加侧边栏、接快捷键，而不必 fork Chromium。本专栏面向**有前端/JS 基础、没写过插件**的开发者，全程使用 **Manifest V3**（MV3）——当前 Chrome 扩展的标准规范（Chrome 已于 2025 年停用 MV2 扩展支持）。

::: info
本指南以现代 **Chrome（128+，当前稳定版已演进至 140+）**、**Chromium 系浏览器**（Edge、Brave 等）为准。API 名称与官方 [Chrome Extensions 文档](https://developer.chrome.com/docs/extensions) 对齐。**10 课实战完整源码**已开源：[github.com/davidapp/chrome-extension-demos](https://github.com/davidapp/chrome-extension-demos)，每个 Demo 目录均可直接在 `chrome://extensions` 加载验证。
:::

## 学习路径

```
入门（扩展是什么、环境、第一个插件）
    ↓
Manifest V3（清单、Service Worker、Content Script、Popup）
    ↓
通信与存储（消息、chrome.storage、网络与 CORS）
    ↓
权限与安全（最小权限、CSP、host_permissions）
    ↓
进阶 API（Side Panel、Scripting、declarativeNetRequest）
    ↓
工程化（调试、测试、项目结构、上架商店）
```

## 章节目录

### 入门

1. [扩展是什么](/manual/computer-programming/chrome-extension/what-is-extension) — 与网页、PWA、用户脚本的边界
2. [开发环境准备](/manual/computer-programming/chrome-extension/environment-setup) — Chrome、加载方式、目录结构
3. [Hello World](/manual/computer-programming/chrome-extension/hello-world) — 最小可运行 MV3 扩展

### Manifest V3

4. [manifest.json 概览](/manual/computer-programming/chrome-extension/manifest-overview) — 字段、版本、action、icons
5. [Service Worker](/manual/computer-programming/chrome-extension/service-worker) — 后台脚本、生命周期、事件
6. [Content Scripts](/manual/computer-programming/chrome-extension/content-scripts) — 注入页面、隔离世界、run_at
7. [Popup 与选项页](/manual/computer-programming/chrome-extension/popup-and-ui) — action popup、options_page、React 集成

### 通信与存储

8. [消息传递](/manual/computer-programming/chrome-extension/messaging) — runtime.sendMessage、长连接、与页面通信
9. [存储 API](/manual/computer-programming/chrome-extension/storage) — local / sync / session，配额与迁移
10. [网络与 CORS](/manual/computer-programming/chrome-extension/network-and-cors) — fetch、host_permissions、跨域限制

### 权限与安全

11. [权限模型](/manual/computer-programming/chrome-extension/permissions) — permissions、optional_permissions、最小权限
12. [内容安全策略](/manual/computer-programming/chrome-extension/content-security) — extension_pages CSP、eval 禁令

### 进阶 API

13. [Side Panel](/manual/computer-programming/chrome-extension/side-panel) — 侧边栏 UI、与 Tab 联动
14. [Scripting API](/manual/computer-programming/chrome-extension/scripting-api) — 动态注入、executeScript、registerContentScripts
15. [declarativeNetRequest](/manual/computer-programming/chrome-extension/declarative-net-request) — 规则化拦截/重定向（替代 webRequest 阻塞）

### 工程化

16. [调试](/manual/computer-programming/chrome-extension/debugging) — Service Worker 调试、Content Script 断点
17. [测试策略](/manual/computer-programming/chrome-extension/testing) — 单元测试、Puppeteer、CI
18. [项目结构](/manual/computer-programming/chrome-extension/project-structure) — 构建、TypeScript、WXT/Plasmo 选型
19. [上架 Chrome Web Store](/manual/computer-programming/chrome-extension/publish-chrome-web-store) — 打包、开发者账号、审核要点

### 附录

20. [PWA 开发指南](/manual/computer-programming/chrome-extension/appendix-pwa) — Web Manifest、离线缓存、与扩展的选型边界
21. [油猴脚本开发指南](/manual/computer-programming/chrome-extension/appendix-userscript) — Tampermonkey 元数据、GM API、迁移到扩展

## 适合谁

- 会写 HTML/CSS/JS 或 TypeScript，想给浏览器加能力的开发者
- 需要把现有 Web 能力「钉」在特定站点上的产品/工具作者
- 想理解 MV3 与 MV2 差异、避免审核踩坑的维护者

## 写作原则

1. **可运行优先**——[开源 Demo 仓库](https://github.com/davidapp/chrome-extension-demos) 提供 10 个完整可加载项目；专栏文章讲解原理与关键片段，完整 HTML/CSS/JS 以仓库为准。
2. **MV3 唯一**——不教已废弃的持久 background page、`webRequest` 阻塞模式。
3. **权限即设计**——先问「最少需要哪些 host_permissions」，再写功能。

从 [扩展是什么](/manual/computer-programming/chrome-extension/what-is-extension) 开始，或已有基础直接上 [实战第 1 课](/manual/computer-programming/chrome-extension/lesson-01-hello-popup)。

## 实战课程（配套开源仓库）

完整源码：[**davidapp/chrome-extension-demos**](https://github.com/davidapp/chrome-extension-demos)（Chrome 116+，纯 HTML/CSS/JS，无需构建）。建议 clone 后按编号顺序学习：

```bash
git clone https://github.com/davidapp/chrome-extension-demos.git
cd chrome-extension-demos
```

在 `chrome://extensions` 开启开发者模式 → **加载已解压的扩展程序** → 选择对应课次文件夹（如 `01-hello-popup`）。每课目录内的 **README.md** 含逐步操作与课后练习。

| 课 | 文章 | 源码目录 | 主题 |
| -- | ---- | -------- | ---- |
| 01 | [Hello Popup](/manual/computer-programming/chrome-extension/lesson-01-hello-popup) | [01-hello-popup](https://github.com/davidapp/chrome-extension-demos/tree/main/01-hello-popup) | MV3、Popup、CSP |
| 02 | [Content Script](/manual/computer-programming/chrome-extension/lesson-02-content-script) | [02-content-script](https://github.com/davidapp/chrome-extension-demos/tree/main/02-content-script) | 隔离世界、`scripting` |
| 03 | [Service Worker](/manual/computer-programming/chrome-extension/lesson-03-service-worker) | [03-service-worker](https://github.com/davidapp/chrome-extension-demos/tree/main/03-service-worker) | 后台事件、Badge |
| 04 | [消息传递](/manual/computer-programming/chrome-extension/lesson-04-message-passing) | [04-message-passing](https://github.com/davidapp/chrome-extension-demos/tree/main/04-message-passing) | 划词翻译 |
| 05 | [Storage API](/manual/computer-programming/chrome-extension/lesson-05-storage-api) | [05-storage-api](https://github.com/davidapp/chrome-extension-demos/tree/main/05-storage-api) | Todo、`onChanged` |
| 06 | [Options Page](/manual/computer-programming/chrome-extension/lesson-06-options-page) | [06-options-page](https://github.com/davidapp/chrome-extension-demos/tree/main/06-options-page) | 选项页、sync |
| 07 | [Context Menus](/manual/computer-programming/chrome-extension/lesson-07-context-menus) | [07-context-menus](https://github.com/davidapp/chrome-extension-demos/tree/main/07-context-menus) | 右键菜单、Toast |
| 08 | [Side Panel](/manual/computer-programming/chrome-extension/lesson-08-side-panel) | [08-side-panel](https://github.com/davidapp/chrome-extension-demos/tree/main/08-side-panel) | 侧边栏笔记本 |
| 09 | [DNR](/manual/computer-programming/chrome-extension/lesson-09-declarative-net-request) | [09-declarative-net-request](https://github.com/davidapp/chrome-extension-demos/tree/main/09-declarative-net-request) | 广告拦截规则 |
| 10 | [Offscreen](/manual/computer-programming/chrome-extension/lesson-10-offscreen-document) | [10-offscreen-document](https://github.com/davidapp/chrome-extension-demos/tree/main/10-offscreen-document) | 后台 TTS |

也可在 GitHub 上 [Download ZIP](https://github.com/davidapp/chrome-extension-demos/archive/refs/heads/main.zip) 后解压使用。专栏文章与仓库 README 互补：文章讲「为什么」与架构，仓库给「完整能跑」的实现。

## 本专栏篇目

- [Chrome 插件开发指南](/manual/computer-programming/chrome-extension/): 基于 Manifest V3 的 Chrome 扩展开发中文指南——从 Hello World 到上架 Chrome Web Store。

### 入门

- [扩展是什么](/manual/computer-programming/chrome-extension/what-is-extension): Chrome 插件开发指南 · Chrome 扩展与网页、PWA、用户脚本的区别，以及 MV3 下的运行上下文
- [开发环境准备](/manual/computer-programming/chrome-extension/environment-setup): Chrome 插件开发指南 · Chrome 版本、加载未打包扩展、推荐目录结构与工具链
- [Hello World](/manual/computer-programming/chrome-extension/hello-world): Chrome 插件开发指南 · 最小 Manifest V3 扩展：工具栏图标、Popup、Service Worker 日志

### 实战课程（10 课）

- [第 1 课：Hello Popup](/manual/computer-programming/chrome-extension/lesson-01-hello-popup): Chrome 插件开发指南 · 实战课程 · Manifest V3 基础与弹出窗口
- [第 2 课：Content Script](/manual/computer-programming/chrome-extension/lesson-02-content-script): Chrome 插件开发指南 · 实战课程 · 内容脚本、隔离世界与编程式注入
- [第 3 课：Service Worker](/manual/computer-programming/chrome-extension/lesson-03-service-worker): Chrome 插件开发指南 · 实战课程 · 后台 Service Worker、事件监听与 Badge
- [第 4 课：消息传递](/manual/computer-programming/chrome-extension/lesson-04-message-passing): Chrome 插件开发指南 · 实战课程 · runtime.sendMessage 与异步 sendResponse
- [第 5 课：Storage API](/manual/computer-programming/chrome-extension/lesson-05-storage-api): Chrome 插件开发指南 · 实战课程 · chrome.storage.local 与 onChanged 联动 Badge
- [第 6 课：Options Page](/manual/computer-programming/chrome-extension/lesson-06-options-page): Chrome 插件开发指南 · 实战课程 · options_ui 与 chrome.storage.sync 配置联动
- [第 7 课：Context Menus](/manual/computer-programming/chrome-extension/lesson-07-context-menus): Chrome 插件开发指南 · 实战课程 · 右键上下文菜单与网页 Toast 反馈
- [第 8 课：Side Panel](/manual/computer-programming/chrome-extension/lesson-08-side-panel): Chrome 插件开发指南 · 实战课程 · 侧边栏面板与 Popup 生命周期差异
- [第 9 课：Declarative Net Request](/manual/computer-programming/chrome-extension/lesson-09-declarative-net-request): Chrome 插件开发指南 · 实战课程 · 声明式网络拦截与动态规则
- [第 10 课：Offscreen Document](/manual/computer-programming/chrome-extension/lesson-10-offscreen-document): Chrome 插件开发指南 · 实战课程 · 离屏文档与后台 TTS

### Manifest V3

- [manifest.json 概览](/manual/computer-programming/chrome-extension/manifest-overview): Chrome 插件开发指南 · manifest 字段、version、action、icons、content_scripts 声明
- [Service Worker](/manual/computer-programming/chrome-extension/service-worker): Chrome 插件开发指南 · MV3 后台、生命周期、事件、持久状态
- [Content Scripts](/manual/computer-programming/chrome-extension/content-scripts): Chrome 插件开发指南 · 匹配规则、run_at、隔离世界、CSS 注入
- [Popup 与选项页](/manual/computer-programming/chrome-extension/popup-and-ui): Chrome 插件开发指南 · action popup、options_page、React 集成

### 通信与存储

- [消息传递](/manual/computer-programming/chrome-extension/messaging): Chrome 插件开发指南 · sendMessage、长连接、与页面 postMessage
- [存储 API](/manual/computer-programming/chrome-extension/storage): Chrome 插件开发指南 · local、sync、session 与配额
- [网络与 CORS](/manual/computer-programming/chrome-extension/network-and-cors): Chrome 插件开发指南 · fetch、host_permissions、扩展页跨域

### 权限与安全

- [权限模型](/manual/computer-programming/chrome-extension/permissions): Chrome 插件开发指南 · permissions、optional_permissions、最小权限
- [内容安全策略](/manual/computer-programming/chrome-extension/content-security): Chrome 插件开发指南 · extension_pages CSP、禁止 eval

### 进阶 API

- [Side Panel](/manual/computer-programming/chrome-extension/side-panel): Chrome 插件开发指南 · sidePanel API、与当前 Tab 联动
- [Scripting API](/manual/computer-programming/chrome-extension/scripting-api): Chrome 插件开发指南 · executeScript、registerContentScripts
- [declarativeNetRequest](/manual/computer-programming/chrome-extension/declarative-net-request): Chrome 插件开发指南 · 静态/动态规则、替代 webRequest

### 工程化

- [调试](/manual/computer-programming/chrome-extension/debugging): Chrome 插件开发指南 · SW 调试、Content Script 断点、日志
- [测试策略](/manual/computer-programming/chrome-extension/testing): Chrome 插件开发指南 · 单元测试、Puppeteer、CI
- [项目结构](/manual/computer-programming/chrome-extension/project-structure): Chrome 插件开发指南 · TypeScript、WXT/Plasmo、monorepo
- [上架 Chrome Web Store](/manual/computer-programming/chrome-extension/publish-chrome-web-store): Chrome 插件开发指南 · zip 打包、开发者账号、审核

### 附录

- [PWA 开发指南](/manual/computer-programming/chrome-extension/appendix-pwa): Chrome 插件开发指南 · 附录：渐进式 Web 应用（PWA）的核心概念、manifest、Service Worker 与扩展的选型边界
- [油猴脚本开发指南](/manual/computer-programming/chrome-extension/appendix-userscript): Chrome 插件开发指南 · 附录：Tampermonkey / Violentmonkey 用户脚本的元数据、GM API 与扩展的选型边界
