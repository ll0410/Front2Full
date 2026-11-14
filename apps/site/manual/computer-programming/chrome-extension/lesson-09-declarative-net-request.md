---
title: "第 9 课：Declarative Net Request"
description: "Chrome 插件开发指南 · 实战课程 · 声明式网络拦截与动态规则"
source: "https://daiw.org/manual/chrome-extension/lesson-09-declarative-net-request"
---

# 第 9 课：Declarative Net Request

Chrome 插件开发指南 · 实战课程 · 声明式网络拦截与动态规则

本课配套开源 Demo [**09-declarative-net-request**](https://github.com/davidapp/chrome-extension-demos/tree/main/09-declarative-net-request)：「简易广告资源拦截器」——MV3 用 **DNR** 替代阻塞式 `webRequest`，规则在浏览器网络层执行，扩展 JS 不接触请求正文。

![第 9 课成品：广告拦截器 Popup](https://daiw.org/screenshots/chrome-extension/lesson-09-declarative-net-request.webp)

_▲ DNR 预置静态规则 + 自定义拦截域名列表_

::: info
本文讲解原理与关键片段；**完整 HTML/CSS/JS 及逐步操作**见仓库 [`09-declarative-net-request`](https://github.com/davidapp/chrome-extension-demos/tree/main/09-declarative-net-request) 目录内的 README。
:::

## 为什么不用 webRequest

MV2 的 `webRequest` 可阻塞并窥视全部请求（含 Cookie），性能与隐私风险大。DNR 改为**声明规则**，Chrome 内核匹配 URL 后执行 `block` / `redirect` 等，扩展看不到响应体。

## 规则结构

```json
{
  "id": 1,
  "priority": 1,
  "condition": {
    "urlFilter": "||doubleclick.net^",
    "resourceTypes": ["image", "script", "xmlhttprequest"]
  },
  "action": { "type": "block" }
}
```

- `urlFilter`：见 [urlFilter 语法](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#filter-syntax)
- `resourceTypes`：`image`、`script`、`stylesheet`、`sub_frame` 等
- `action.type`：`block`、`redirect`、`modifyHeaders`、`allow`

## 静态规则 vs 动态规则

| 类型 | 来源 | 说明 |
| ---- | ---- | ---- |
| 静态 | `rules.json` + `declarative_net_request.rule_resources` | 随包发布 |
| 动态 | `chrome.declarativeNetRequest.updateDynamicRules()` | 运行时增删，适合用户黑名单 |

## manifest.json

```json
{
  "permissions": ["declarativeNetRequest", "storage"],
  "declarative_net_request": {
    "rule_resources": [{
      "id": "ruleset_1",
      "enabled": true,
      "path": "rules.json"
    }]
  },
  "background": { "service_worker": "background.js" },
  "action": { "default_popup": "popup.html" }
}
```

Demo 的 `rules.json` 预置 doubleclick、googlesyndication、Facebook 像素等 5 条静态规则。

## 动态规则（background.js）

```javascript
await chrome.declarativeNetRequest.updateDynamicRules({
  addRules: [{
    id: 1001,
    priority: 2,
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: ['image', 'script', 'xmlhttprequest'],
    },
    action: { type: 'block' },
  }],
});
```

动态规则 ID 建议从 **1000+** 起，避免与静态规则冲突。列表同步到 `chrome.storage.local` 以便重装恢复。

## 获取源码

```bash
git clone https://github.com/davidapp/chrome-extension-demos.git
cd chrome-extension-demos/09-declarative-net-request
```

也可 [Download ZIP](https://github.com/davidapp/chrome-extension-demos/archive/refs/heads/main.zip) 解压后进入 `09-declarative-net-request` 目录。

## 加载与体验

1. 打开 `chrome://extensions` → 开发者模式 → **加载已解压的扩展程序** → 选择 `09-declarative-net-request` 目录
2. 访问含广告资源的 https 页面，观察 Network 面板中被拦截的请求

## 验证拦截

DevTools → **Network**：被拦请求显示红色，状态 **blocked:extension**。Popup 可展示累计拦截次数（`onRuleMatchedDebug`，开发调试用）。

## 课后练习

1. Popup 管理用户黑名单（增删动态规则 + storage 持久化）
2. `redirect` 到 1×1 透明 GIF 替换广告图

## 延伸阅读

- [完整源码：`09-declarative-net-request`](https://github.com/davidapp/chrome-extension-demos/tree/main/09-declarative-net-request) — 可运行项目与 README 逐步说明
- [declarativeNetRequest](/manual/computer-programming/chrome-extension/declarative-net-request)

## 小结

DNR = 声明规则 + 网络层执行；静态打底、动态可配置。下一课在后台使用 **Offscreen Document** 调用 TTS 等 DOM API。

→ 下一课：[第 10 课：Offscreen Document](/manual/computer-programming/chrome-extension/lesson-10-offscreen-document)
