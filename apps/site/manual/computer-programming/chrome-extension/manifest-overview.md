---
title: "manifest.json 概览"
description: "Chrome 插件开发指南 · manifest 字段、version、action、icons、content_scripts 声明"
source: "https://daiw.org/manual/chrome-extension/manifest-overview"
---

# manifest.json 概览

Chrome 插件开发指南 · manifest 字段、version、action、icons、content_scripts 声明

`manifest.json` 是扩展的**唯一入口**。Chrome 不扫描目录、不猜测约定——它只读这个文件，你没声明的东西就不存在。理解它的字段划分，等于理解了扩展能力的边界。

## 三类字段

```text
manifest.json
├── 身份     name / version / description / icons        ← 商店与工具栏展示
├── 入口     background / action / content_scripts / …   ← 代码从哪里跑
└── 能力     permissions / host_permissions / CSP        ← 允许干什么
```

**没有第四类。** 任何「扩展能做 X 吗」的问题，最终都落到「manifest 里有没有对应的入口 + 权限」。

## 最小可用的 manifest

```json
{
  "manifest_version": 3,
  "name": "我的扩展",
  "version": "1.0.0"
}
```

只有这三个字段是**必填**的。装得上，但什么也不做——没有入口，就没有代码运行。

## 必填字段

| 字段 | 约束 |
| ---- | ---- |
| `manifest_version` | 必须是数字 `3`。写 `2` 已无法上架，`"3"`（字符串）会直接报错 |
| `name` | 最长 75 字符；商店列表里超长会被截断 |
| `version` | 1~4 段数字，点分隔，每段 0~65535，**不能有前导零** |

::: warning
**`version` 的规则比想象中严格。** `1.0.0-beta`、`v1.0`、`1.0.01` 全都非法——Chrome 只接受纯数字段。

想标注预发布，用 **`version_name`**（可选字段，纯展示）：

  ```json
  { "version": "1.2.3", "version_name": "1.2.3 beta" }
  ```

另外：上架时**新版本号必须严格大于线上版本**，且发布后无法回退到更小的号。给自己留余地——别一上来就用 `1.0.0`，很多人从 `0.1.0` 起步。
:::

## icons

```json
{
  "icons": {
    "16": "icons/16.png",
    "32": "icons/32.png",
    "48": "icons/48.png",
    "128": "icons/128.png"
  }
}
```

| 尺寸 | 用在哪 |
| ---- | ------ |
| 16 | favicon、右键菜单 |
| 32 | Windows 高 DPI |
| 48 | `chrome://extensions` 管理页 |
| **128** | **安装对话框与 Chrome Web Store（上架必需）** |

只提供一个尺寸 Chrome 也会缩放，但缩放结果在小尺寸下往往糊。**至少备 48 和 128。**

## action：工具栏按钮

`action` 取代了 MV2 的 `browser_action` 与 `page_action`——MV3 把两者合并成一个。

```json
{
  "action": {
    "default_icon": { "16": "icons/16.png", "32": "icons/32.png" },
    "default_title": "点我",
    "default_popup": "popup.html"
  }
}
```

三个字段都可选，而且**省略 `default_popup` 是有意义的**：

| 配置 | 点击图标的行为 |
| ---- | -------------- |
| 有 `default_popup` | 打开该 HTML，**不触发** `chrome.action.onClicked` |
| 无 `default_popup` | 触发 `chrome.action.onClicked`，由 [Service Worker](/manual/computer-programming/chrome-extension/service-worker) 处理 |

::: info
**这是个高频困惑：「我的 `onClicked` 为什么不触发？」** 答案几乎总是——你配了 `default_popup`。两者互斥，popup 存在时点击被 popup 吃掉。

想要「有时弹窗、有时执行动作」，用 `chrome.action.setPopup({ popup: '' })` 在运行时动态清空。
:::

角标、标题、图标都能在运行时改（见[第 3 课](/manual/computer-programming/chrome-extension/lesson-03-service-worker)）：

```javascript
chrome.action.setBadgeText({ text: '3' });
chrome.action.setBadgeBackgroundColor({ color: '#d00' });
chrome.action.setTitle({ title: '有 3 条未读' });
```

## background：Service Worker

MV3 只有一种后台形态：

```json
{
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

`"type": "module"` 让你能在后台脚本里用 `import`——**建议默认加上**，否则只能用 `importScripts()`。

生命周期与事件注册的坑很多，单独一章讲：[Service Worker](/manual/computer-programming/chrome-extension/service-worker)。

## content_scripts：声明式注入

```json
{
  "content_scripts": [
    {
      "matches": ["https://*.example.com/*"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ]
}
```

注意它是**数组**——可以为不同站点配不同脚本：

```json
{
  "content_scripts": [
    { "matches": ["https://github.com/*"], "js": ["github.js"] },
    { "matches": ["https://gitlab.com/*"], "js": ["gitlab.js"] }
  ]
}
```

匹配语法、`run_at` 时机、隔离世界详见 [Content Scripts](/manual/computer-programming/chrome-extension/content-scripts)。需要**运行时**决定注入什么，则用 [Scripting API](/manual/computer-programming/chrome-extension/scripting-api)。

## 权限的两个池子

```json
{
  "permissions": ["storage", "tabs", "scripting"],
  "host_permissions": ["https://api.example.com/*"],
  "optional_permissions": ["bookmarks"],
  "optional_host_permissions": ["https://*/*"]
}
```

**MV3 把「API 权限」和「站点权限」拆成了两个字段**——这是相对 MV2 最重要的变化之一：`permissions` 里不能再写 URL 模式，站点访问一律进 `host_permissions`。

拆开的原因是**安装提示的措辞**：`host_permissions` 会让 Chrome 显示「读取和更改你在 xxx 上的数据」这类高警示文案，而多数 API 权限不会。详见[权限模型](/manual/computer-programming/chrome-extension/permissions)。

## 其他常用入口

| 字段 | 作用 |
| ---- | ---- |
| `options_page` / `options_ui` | 选项页，见 [Popup 与选项页](/manual/computer-programming/chrome-extension/popup-and-ui) |
| `side_panel` | 侧边栏，见 [Side Panel](/manual/computer-programming/chrome-extension/side-panel) |
| `web_accessible_resources` | 允许网页访问扩展内的文件（图片、注入脚本） |
| `declarative_net_request` | 静态拦截规则，见 [declarativeNetRequest](/manual/computer-programming/chrome-extension/declarative-net-request) |
| `content_security_policy` | 扩展页 CSP，见[内容安全策略](/manual/computer-programming/chrome-extension/content-security) |
| `commands` | 键盘快捷键 |
| `minimum_chrome_version` | 低于此版本的 Chrome 拒绝安装 |

### web_accessible_resources 的写法变了

MV2 是一个扁平数组，MV3 变成了**带匹配范围的对象数组**：

```json
{
  "web_accessible_resources": [
    {
      "resources": ["injected.js", "icons/*.png"],
      "matches": ["https://*.example.com/*"]
    }
  ]
}
```

必须写 `matches`，把资源只暴露给需要的站点。**这是为了防指纹**——MV2 里任何网页都能探测你装了什么扩展（试着加载它的已知资源即可）。

## 校验与常见报错

加载时 Chrome 会校验 manifest，报错都显示在 `chrome://extensions` 页面上：

| 报错 | 原因 |
| ---- | ---- |
| `Manifest is not valid JSON` | 多半是**尾逗号**或注释——JSON 不支持两者 |
| `Invalid value for 'version'` | 版本号带了非数字，或有前导零 |
| `Permission 'xxx' is unknown` | 权限名拼错，或该权限已在 MV3 移除 |
| `Could not load icon` | 路径不对，或 PNG 实际不存在 |
| `'browser_action' requires manifest version of 2` | 还在用 MV2 字段名 |

::: warning
**manifest.json 里不能写注释。** 很多人习惯在配置文件里加注释，但 Chrome 用严格 JSON 解析器。要注释就用构建工具从 `manifest.config.ts` 生成——见[项目结构](/manual/computer-programming/chrome-extension/project-structure)。
:::

## 一份实战 manifest

把上面串起来，一个「读取页面、调 API、有弹窗和设置页」的扩展：

```json
{
  "manifest_version": 3,
  "name": "示例扩展",
  "version": "0.1.0",
  "description": "一句话说明，商店列表里会显示",
  "icons": { "48": "icons/48.png", "128": "icons/128.png" },

  "action": {
    "default_popup": "popup.html",
    "default_icon": { "32": "icons/32.png" }
  },
  "background": { "service_worker": "background.js", "type": "module" },
  "options_ui": { "page": "options.html", "open_in_tab": false },
  "content_scripts": [
    { "matches": ["https://*.example.com/*"], "js": ["content.js"], "run_at": "document_idle" }
  ],

  "permissions": ["storage", "scripting", "activeTab"],
  "host_permissions": ["https://api.example.com/*"]
}
```

## 小结

- manifest 分**身份 / 入口 / 能力**三类，没声明的能力就不存在。
- `version` 只能是数字段，展示用 `version_name`。
- `action` 合并了 MV2 的两种按钮；**配了 `default_popup` 就不会触发 `onClicked`**。
- MV3 把站点权限从 `permissions` 拆到 **`host_permissions`**。
- `web_accessible_resources` 现在必须限定 `matches`。

下一篇：[Service Worker](/manual/computer-programming/chrome-extension/service-worker) —— MV3 最大的行为变化就在这里。
