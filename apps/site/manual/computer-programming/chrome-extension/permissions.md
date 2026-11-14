---
title: "权限模型"
description: "Chrome 插件开发指南 · permissions、optional_permissions、最小权限"
source: "https://daiw.org/manual/chrome-extension/permissions"
---

# 权限模型

Chrome 插件开发指南 · permissions、optional_permissions、最小权限

权限决定两件事：**扩展能干什么**，以及**用户在安装页看到多吓人的提示**。后者常被忽略，但它直接决定装机转化率——一个「读取和更改你在所有网站上的数据」的提示，能劝退大半用户。

## 四个字段

```json
{
  "permissions": ["storage", "tabs"],
  "optional_permissions": ["bookmarks", "history"],
  "host_permissions": ["https://api.example.com/*"],
  "optional_host_permissions": ["https://*/*"]
}
```

```text
              安装时授予          运行时申请
API 能力    permissions        optional_permissions
站点访问    host_permissions   optional_host_permissions
```

**MV3 把「API 权限」和「站点权限」拆开了**——`permissions` 里不能再写 URL 模式。这个拆分正是为了让安装提示更精确：多数 API 权限不触发警示文案，站点权限才是重头。

## 权限的警示等级

用户看到的提示，大致分三档：

| 等级 | 例子 | 安装提示 |
| ---- | ---- | -------- |
| **无提示** | `storage`、`alarms`、`activeTab`、`scripting`、`contextMenus`、`declarativeNetRequest`、`sidePanel`、`offscreen` | 不显示任何权限 |
| **中等** | `tabs`、`bookmarks`、`downloads`、`notifications`、`clipboardRead` | 「读取你的浏览记录」等具体描述 |
| **高危** | `host_permissions` 含 `<all_urls>` / `*://*/*`、`debugger`、`proxy`、`nativeMessaging` | 「读取和更改你在所有网站上的数据」 |

::: info
**一个扩展如果完全用「无提示」档的权限，安装对话框里会不显示权限清单**——转化率显著更高。

这是可以设计的：很多需要 `tabs` 的场景其实用 `activeTab` 就够，很多需要 `<all_urls>` 的场景可以改成运行时申请。下面逐个讲。
:::

## activeTab：最被低估的权限

```json
{ "permissions": ["activeTab"] }
```

它给你**当前标签页的临时完全访问权**——但**不显示任何安装提示**。

触发条件（必须是用户主动的）：

- 点击扩展图标
- 点击你注册的右键菜单项
- 触发你注册的键盘快捷键

授权在用户**离开或刷新该页**时自动失效。

```javascript
// 有 activeTab，点击图标后就能注入，不需要 host_permissions
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => { document.body.style.filter = 'invert(1)'; },
  });
});
```

::: warning
**能用 `activeTab` 就别用 `<all_urls>`。**

典型误用：做一个「点击后翻译当前页」的扩展，声明了 `host_permissions: ["<all_urls>"]`。但它只在用户点击后才工作——这正是 `activeTab` 的设计场景。

换成 `activeTab` 后，安装提示从「读取和更改你在所有网站上的数据」变成**什么都不显示**。功能完全一样。

**只有需要「用户没交互时也要在后台跑」（如广告拦截、自动改写）才真的需要宽 host 权限。**
:::

## tabs vs activeTab

一个常见误解：「我要拿标签页的 URL，所以需要 `tabs` 权限」。

```javascript
const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
```

**`chrome.tabs.*` 的绝大多数方法不需要 `tabs` 权限就能调用**。`tabs` 权限只控制一件事：**能否读到 `url` / `title` / `favIconUrl` 这几个敏感字段**。

| 你要的 | 需要 |
| ------ | ---- |
| 查询标签页、拿到 `tabId` | 不需要权限 |
| 读当前页 URL（用户点击后） | `activeTab` |
| 读**所有**标签页的 URL、监听全部导航 | `tabs` |

所以：**只在用户交互后需要 URL → `activeTab` 足够**。

## 运行时申请

```json
{
  "permissions": ["storage"],
  "optional_permissions": ["bookmarks"],
  "optional_host_permissions": ["https://*/*"]
}
```

```javascript
// 必须在用户手势里调用
document.querySelector('#enable').addEventListener('click', async () => {
  const granted = await chrome.permissions.request({
    permissions: ['bookmarks'],
    origins: ['https://example.com/*'],
  });
  if (!granted) {
    showHint('需要授权才能使用此功能');
    return;
  }
  enableFeature();
});
```

配套 API：

```javascript
// 查
const has = await chrome.permissions.contains({ permissions: ['bookmarks'] });

// 撤销（做个良好公民：功能关掉就还回去）
await chrome.permissions.remove({ permissions: ['bookmarks'] });

// 列出当前所有
const all = await chrome.permissions.getAll();

// 监听变化（用户可能在 chrome://extensions 里手动撤销）
chrome.permissions.onRemoved.addListener((p) => disableFeature(p));
chrome.permissions.onAdded.addListener((p) => enableFeature(p));
```

::: warning
**必须处理「用户在设置里手动撤销权限」的情况。** 用户能随时去 `chrome://extensions` 把站点访问改成「点击时」或「仅特定网站」。

你的代码不能假设「申请成功过一次就永远有」——每次用之前 `contains` 一下，或者监听 `onRemoved`。
:::

## 用户可以缩小你的站点权限

Chrome 允许用户在扩展详情页把站点访问改成三档：

```text
○ 点击扩展程序时          ← 等效 activeTab
○ 在特定网站上
● 在所有网站上
```

**即使你声明了 `<all_urls>`，用户也能降到「点击时」。** 所以宽权限不是保险——它只是提高了安装门槛，却不保证你真能拿到。

反过来说，**主动设计成 `activeTab` 模式，既不吓人、行为又和用户降权后一致**，是更稳的选择。

## 常见 API 与对应权限

| 想做的事 | 需要 |
| -------- | ---- |
| 读写扩展数据 | `storage` |
| 定时任务 | `alarms` |
| 注入脚本 | `scripting` + 站点权限（或 `activeTab`） |
| 右键菜单 | `contextMenus` |
| 桌面通知 | `notifications` |
| 侧边栏 | `sidePanel` |
| 拦截 / 改写请求 | `declarativeNetRequest`（+ 站点权限） |
| 看到请求详情 | `webRequest` + 站点权限 |
| 读写 cookie | `cookies` + 站点权限 |
| 下载文件 | `downloads` |
| 无 DOM 环境用 DOM | `offscreen` |
| 读所有标签页 URL | `tabs` |

## 最小权限的实践清单

1. **先不写权限，跑起来报错了再加**——比照着文档预先声明一堆靠谱。
2. **能 `activeTab` 就不要 host 权限。**
3. **能 `optional_*` 就不要装机时要。**
4. **`host_permissions` 精确到域**，别用通配。
5. **上架前重读一遍权限列表**，删掉开发时试验剩下的。
6. **在商店描述里解释每个高危权限为什么需要**——审核和用户都会看。

::: info
**审核视角：权限与功能不匹配是最常见的拒审原因之一。** Chrome Web Store 要求「权限必须与已声明的功能直接相关」。

一个「网页截图」扩展要 `history` 权限，会被要求解释；解释不清就下架。见[上架 Chrome Web Store](/manual/computer-programming/chrome-extension/publish-chrome-web-store)。
:::

## 小结

- MV3 把权限拆成 **API 权限（`permissions`）** 与 **站点权限（`host_permissions`）**。
- **`activeTab` 是最被低估的权限**——用户点击后拿到当前页完全访问权，且**零安装提示**。
- **`chrome.tabs.*` 多数方法不需要 `tabs` 权限**，它只管 `url`/`title` 这几个字段。
- 能延后就用 `optional_*` + **用户手势**申请；用完可以 `remove` 还回去。
- **用户能随时手动降权**，代码不能假设权限永远在——`contains` 或监听 `onRemoved`。
- 宽权限的代价是**装机转化率**和**审核风险**，且并不保险。

下一篇：[内容安全策略](/manual/computer-programming/chrome-extension/content-security)。
