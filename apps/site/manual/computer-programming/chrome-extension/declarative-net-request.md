---
title: "declarativeNetRequest"
description: "Chrome 插件开发指南 · 静态/动态规则、替代 webRequest"
source: "https://daiw.org/manual/chrome-extension/declarative-net-request"
---

# declarativeNetRequest

Chrome 插件开发指南 · 静态/动态规则、替代 webRequest

MV3 移除了 `webRequest` 的**阻塞式**能力——扩展不能再拦下每个请求、跑一段 JS 决定放不放行。取而代之的是 declarativeNetRequest（DNR）：**你把规则声明给浏览器，浏览器自己执行**。

## 为什么要换

```text
MV2 webRequest（阻塞式）          MV3 declarativeNetRequest
每个请求 → 唤醒扩展 → 跑 JS       每个请求 → 浏览器匹配规则表
        → 等待返回 → 放行/拦截             → 直接执行动作
        ↑ 慢、且扩展看得到全部流量        ↑ 快、扩展看不到请求内容
```

两个动机：**性能**（不必为每个请求唤醒扩展并等它返回）和**隐私**（扩展不再能看到你访问的每一个 URL）。

代价是**表达力下降**——规则是声明式的，做不了「根据响应内容决定」这类事。这也是当年 MV3 争议最大的一点。

::: info
**`webRequest` 并没有被完全删除。** 它的**观察式**用法仍然可用（`onBeforeRequest` 等监听器可以看请求、做统计），只是不能再通过返回值阻塞或改写。

所以「统计流量、做诊断」照旧；「拦截、改写、重定向」必须转 DNR。
:::

## 两种规则

| | 静态规则 | 动态规则 |
| --- | --- | --- |
| 定义在 | manifest 指向的 JSON 文件 | 运行时 API |
| 修改 | 需发版 | 随时 |
| 数量上限 | 约 30000 条（启用的规则集） | **动态 + 会话共约 5000 条** |
| 适合 | 内置规则集 | 用户自定义、订阅列表 |

### 静态规则

```json
{
  "permissions": ["declarativeNetRequest"],
  "declarative_net_request": {
    "rule_resources": [{
      "id": "ruleset_1",
      "enabled": true,
      "path": "rules.json"
    }]
  }
}
```

```json
// rules.json
[
  {
    "id": 1,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "||ads.example.com",
      "resourceTypes": ["script", "image", "xmlhttprequest"]
    }
  }
]
```

### 动态规则

```javascript
await chrome.declarativeNetRequest.updateDynamicRules({
  removeRuleIds: [1001],              // 先删（避免 id 冲突）
  addRules: [{
    id: 1001,
    priority: 1,
    action: { type: 'block' },
    condition: { urlFilter: '||tracker.example.com', resourceTypes: ['script'] },
  }],
});
```

::: warning
**`id` 冲突会让整个调用失败**，报 `Rule with id 1001 does not have a unique ID`。

由于动态规则**持久化**（跨浏览器重启存在），[SW 顶层](/manual/computer-programming/chrome-extension/service-worker)每次唤醒都添加一遍必炸。标准写法是**在同一次调用里先 remove 再 add**——如上例所示，这是原子的。

要全量重建：

  ```javascript
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: old.map((r) => r.id),
    addRules: newRules,
  });
  ```
:::

会话规则（`updateSessionRules`）用法相同，但**浏览器关闭即失效**，且不写磁盘——适合临时拦截。

## 五种动作

| type | 作用 |
| ---- | ---- |
| `block` | 拦截 |
| `allow` | 放行（用高 `priority` 覆盖 block 规则） |
| `redirect` | 重定向 |
| `upgradeScheme` | http → https |
| `modifyHeaders` | 增删改请求 / 响应头 |

### redirect

```json
{
  "id": 2,
  "priority": 1,
  "action": {
    "type": "redirect",
    "redirect": { "url": "https://example.com/replacement.js" }
  },
  "condition": { "urlFilter": "||cdn.example.com/old.js", "resourceTypes": ["script"] }
}
```

也支持正则替换与扩展内资源：

```json
{
  "action": {
    "type": "redirect",
    "redirect": { "regexSubstitution": "https://new.example.com\\1" }
  },
  "condition": { "regexFilter": "^https://old\\.example\\.com(/.*)$", "resourceTypes": ["main_frame"] }
}
```

```json
{
  "action": {
    "type": "redirect",
    "redirect": { "extensionPath": "/replacement.js" }
  }
}
```

用 `extensionPath` 时，目标文件必须在 [`web_accessible_resources`](/manual/computer-programming/chrome-extension/manifest-overview) 里声明。

### modifyHeaders

```json
{
  "id": 3,
  "priority": 1,
  "action": {
    "type": "modifyHeaders",
    "requestHeaders": [
      { "header": "referer", "operation": "remove" },
      { "header": "x-custom", "operation": "set", "value": "1" }
    ],
    "responseHeaders": [
      { "header": "x-frame-options", "operation": "remove" }
    ]
  },
  "condition": { "urlFilter": "||example.com", "resourceTypes": ["main_frame", "xmlhttprequest"] }
}
```

`operation` 有 `set` / `append` / `remove` 三种。

**这是改 `Referer`、`Origin` 等[禁止头](/manual/computer-programming/chrome-extension/network-and-cors)的唯一途径**——`fetch` 里改不了它们。

## urlFilter 语法

不是正则，是一套简化的匹配语法：

| 符号 | 含义 | 例子 |
| ---- | ---- | ---- |
| `\|\|` | 域名锚点（含子域） | `\|\|example.com` 匹配 `a.example.com` |
| `\|` | 开头 / 结尾锚点 | `\|https://` / `.js\|` |
| `*` | 通配 | `*/ads/*` |
| `^` | 分隔符（`/`、`?`、`&` 等） | `example.com^` |

```json
{ "urlFilter": "||example.com/ads/*" }
```

需要真正的正则用 `regexFilter`——但它**更慢**，且有长度和复杂度限制，能用 `urlFilter` 就别用它。

### condition 的其他字段

```json
{
  "condition": {
    "urlFilter": "||ads.example.com",
    "resourceTypes": ["script", "image"],
    "excludedResourceTypes": [],
    "initiatorDomains": ["news.example.com"],
    "excludedInitiatorDomains": ["trusted.example.com"],
    "requestDomains": ["ads.example.com"],
    "requestMethods": ["get"],
    "isUrlFilterCaseSensitive": false
  }
}
```

::: warning
**不写 `resourceTypes` 时，规则默认不匹配 `main_frame`。**

这是一个反直觉的默认值：想拦截**整个页面导航**，必须显式写上：

  ```json
  { "resourceTypes": ["main_frame"] }
  ```

「我的拦截规则对某些请求不生效」的头号原因就是这个。
:::

常用 `resourceTypes`：`main_frame`、`sub_frame`、`script`、`image`、`stylesheet`、`xmlhttprequest`、`media`、`font`、`websocket`、`ping`、`other`。

## 优先级

规则冲突时的裁决顺序：

```text
1. priority 高的赢
2. priority 相同时，动作类型按固定顺序：
   allow / allowAllRequests  >  block  >  redirect / upgradeScheme  >  modifyHeaders
```

所以**白名单要给更高的 `priority`**：

```json
[
  { "id": 1, "priority": 1, "action": { "type": "block" },
    "condition": { "urlFilter": "||example.com", "resourceTypes": ["script"] } },

  { "id": 2, "priority": 2, "action": { "type": "allow" },
    "condition": { "urlFilter": "||example.com/needed.js", "resourceTypes": ["script"] } }
]
```

`modifyHeaders` 特殊：它**不是排他的**，多条规则会依次应用（按 priority 顺序）。

## 需要什么权限

| 动作 | 权限 |
| ---- | ---- |
| `block` / `upgradeScheme` | `declarativeNetRequest`（**无安装提示**） |
| `redirect` / `modifyHeaders` | 还需**对应站点的 `host_permissions`** |
| 想知道哪条规则命中了 | `declarativeNetRequestFeedback`（有提示，慎用） |

::: info
**`declarativeNetRequest` 本身不显示安装提示**，这是它相比 `webRequest` 的一个隐性优势——做纯拦截类扩展，权限提示可以非常干净。

但一旦要 `redirect` 或改头，就得声明站点权限，提示又回来了。
:::

## 调试

规则不生效时，最有效的手段是 `testMatchOutcome`：

```javascript
const r = await chrome.declarativeNetRequest.testMatchOutcome({
  url: 'https://ads.example.com/a.js',
  type: 'script',
  initiator: 'https://news.example.com',
});
console.log(r.matchedRules);       // 空数组 = 没规则命中
```

**这个 API 不需要额外权限**，是排查的第一选择。

配了 `declarativeNetRequestFeedback` 权限后还能看实时命中：

```javascript
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  console.log(info.rule, info.request.url);
});
```

**但这个权限有安装提示，只在开发时加，发布前删掉。**

查看已生效的规则：

```javascript
await chrome.declarativeNetRequest.getDynamicRules();
await chrome.declarativeNetRequest.getSessionRules();
await chrome.declarativeNetRequest.getEnabledRulesets();
```

## 规则数量限制

```text
静态规则集   启用的规则总数约 30000 条，未启用的可更多
动态 + 会话  合计约 5000 条（其中 unsafe 规则更少）
正则规则     全局约 1000 条
```

做广告拦截这类需要几万条规则的扩展，**必须靠静态规则集**，并用 `updateEnabledRulesets` 按需开关整个规则集：

```javascript
await chrome.declarativeNetRequest.updateEnabledRulesets({
  enableRulesetIds: ['easylist'],
  disableRulesetIds: ['fanboy'],
});
```

## 小结

- MV3 用 DNR **取代 `webRequest` 的阻塞能力**；`webRequest` 的**观察式**用法仍在。
- 静态规则**改要发版但量大**，动态规则**随时可改但约 5000 条**。
- **不写 `resourceTypes` 就不匹配 `main_frame`**——拦截失效的头号原因。
- 动态规则**持久化**，SW 每次唤醒重复添加会因 id 冲突失败——**同一次调用里先 remove 再 add**。
- 白名单要给**更高的 `priority`**。
- `redirect` / `modifyHeaders` 需要站点权限，纯 `block` **不需要、且无安装提示**。
- 排查首选 **`testMatchOutcome`**（无需额外权限）；`declarativeNetRequestFeedback` 只在开发时加。

下一篇：[调试](/manual/computer-programming/chrome-extension/debugging)。
