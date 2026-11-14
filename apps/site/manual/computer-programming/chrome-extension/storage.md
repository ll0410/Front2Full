---
title: "存储 API"
description: "Chrome 插件开发指南 · local、sync、session 与配额"
source: "https://daiw.org/manual/chrome-extension/storage"
---

# 存储 API

Chrome 插件开发指南 · local、sync、session 与配额

`chrome.storage` 是扩展唯一靠谱的持久化手段。它异步、跨上下文、直接存对象——**并且是 [Service Worker](/manual/computer-programming/chrome-extension/service-worker) 里唯一可用的存储**。

## 为什么不能用 localStorage

| 问题 | 说明 |
| ---- | ---- |
| **Service Worker 里根本没有** | `localStorage` 是同步 API，Worker 环境不提供 |
| 每个上下文一份 | [Content Script](/manual/computer-programming/chrome-extension/content-scripts) 的 `localStorage` 属于**所在网页**，不是你的扩展 |
| 只能存字符串 | 每次都要 `JSON.parse` / `stringify` |
| 用户清缓存会清掉 | 「清除浏览数据」会连带删除 |

**结论：扩展里不要用 `localStorage`。** 唯一的例外是纯前端的临时 UI 状态（比如选项页记住当前 tab），且你不在乎它丢。

## 四个存储区

```javascript
chrome.storage.local     // ~10 MB，本机持久
chrome.storage.sync      // ~100 KB，跨设备同步
chrome.storage.session   // 内存，浏览器关闭即失效
chrome.storage.managed   // 只读，企业策略下发
```

| 区 | 容量 | 生命周期 | 用途 |
| -- | ---- | -------- | ---- |
| `local` | 约 10 MB（可申请无限） | 卸载才清 | 缓存、大列表、本机数据 |
| `sync` | **约 100 KB / 单项 8 KB** | 卸载才清，跨设备 | 用户配置 |
| `session` | 约 10 MB | **浏览器关闭清空** | 临时态、敏感数据 |
| `managed` | — | 只读 | 企业部署的策略 |

### 基本用法

```javascript
// 写
await chrome.storage.local.set({ todos: [...], lastSync: Date.now() });

// 读（带默认值）
const { todos = [] } = await chrome.storage.local.get('todos');

// 读多个
const { a, b } = await chrome.storage.local.get(['a', 'b']);

// 读全部
const all = await chrome.storage.local.get(null);

// 删
await chrome.storage.local.remove('todos');
await chrome.storage.local.clear();
```

::: info
**`get` 的默认值写在解构里，是最简洁的惯用法。**

  ```javascript
  const { count = 0 } = await chrome.storage.local.get('count');
  ```

也可以传对象形式：`get({ count: 0 })`——效果相同，但解构写法更少一层嵌套。
:::

## sync 的配额是真的会撞上

```text
QUOTA_BYTES              102400   总共约 100 KB
QUOTA_BYTES_PER_ITEM       8192   单项 8 KB
MAX_ITEMS                   512   最多 512 个键
MAX_WRITE_OPERATIONS_PER_HOUR      1800
MAX_WRITE_OPERATIONS_PER_MINUTE     120
```

::: warning
**写入频率限制比容量限制更容易撞上。** 每分钟 120 次听着很多，但如果你在输入框的 `oninput` 里直接写 `sync`，用户打一段字就超了。

超限时 `set` 会 reject，错误信息是 `MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded`。

解法是**防抖**：

  ```javascript
  let timer;
  function saveDebounced(data) {
    clearTimeout(timer);
    timer = setTimeout(() => chrome.storage.sync.set(data), 500);
  }
  ```

注意在 [popup](/manual/computer-programming/chrome-extension/popup-and-ui) 里做防抖有风险——popup 关闭时定时器一起没了。popup 里改成「失焦即存 + 关闭前存」更稳妥。
:::

检查用量：

```javascript
const used = await chrome.storage.sync.getBytesInUse(null);
console.log(`${used} / ${chrome.storage.sync.QUOTA_BYTES}`);
```

### local 要更多空间

```json
{ "permissions": ["storage", "unlimitedStorage"] }
```

加上 `unlimitedStorage` 后 `local` 不再受 10 MB 限制。**但要克制**——这个权限会出现在安装提示里，而且真存几百 MB 会拖慢用户的浏览器配置文件。

## session：放敏感数据的地方

```javascript
await chrome.storage.session.set({ accessToken: token });
```

三个特点：

1. **存内存，浏览器一关就没**——适合 token、临时解密的数据。
2. **默认不暴露给 content script**，比 `local` 安全一层：

```javascript
// 需要让 CS 也能读时才开
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
```

3. 它**能跨 SW 回收存活**——这点很关键：[SW 被回收后全局变量清零](/manual/computer-programming/chrome-extension/service-worker)，但 `session` 还在。

::: info
**`chrome.storage.session` 是 SW 全局变量的正确替代品。**

需要在 SW 里缓存一点运行时状态（比如「当前是否正在同步中」），既不想写磁盘、又要扛住 SW 回收——`session` 正是为此设计的。
:::

## onChanged：跨上下文同步

```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
    console.log(key, oldValue, '→', newValue);
  }
});
```

**这是扩展里最好用的状态同步机制**——比[发消息](/manual/computer-programming/chrome-extension/messaging)简单得多：

```text
popup 改配置  →  storage.set  →  onChanged 广播
                                    ├──► background 更新角标
                                    ├──► content script 重新渲染
                                    └──► options 页同步 UI
```

不需要知道有谁在听，也不用担心对方是否在线。实战见[第 5 课](/manual/computer-programming/chrome-extension/lesson-05-storage-api)。

**注意 `onChanged` 不会在自己 `set` 的那个上下文里被跳过**——你写入后自己也会收到通知。要避免循环，比较新旧值：

```javascript
chrome.storage.onChanged.addListener((changes) => {
  if (!changes.config) return;
  const { oldValue, newValue } = changes.config;
  if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return;
  applyConfig(newValue);
});
```

## 并发写的坑

```javascript
// ✗ 有竞态：两个上下文同时执行，会丢一次
const { count = 0 } = await chrome.storage.local.get('count');
await chrome.storage.local.set({ count: count + 1 });
```

`chrome.storage` **没有事务、没有原子自增**。读-改-写之间，别的上下文可能插进来。

三种缓解：

| 做法 | 适用 |
| ---- | ---- |
| 把计数逻辑**集中到 SW**，其他上下文发消息请求 | 最可靠 |
| 用队列串行化本上下文的写入 | 单上下文内的并发 |
| 拆键，避免多方写同一个键 | 结构允许时最简单 |

::: warning
**别把所有数据塞进一个键。** 很多人写 `chrome.storage.local.set({ appState: {...整个应用状态} })`——这会让任何一处改动都要读写整个对象，既慢又极易丢更新。

**按更新频率拆键**：配置一个键、缓存一个键、计数一个键。
:::

## 数据迁移

版本升级时改了数据结构，要在 [`onInstalled`](/manual/computer-programming/chrome-extension/service-worker) 里迁移：

```javascript
chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  if (reason !== 'update') return;

  const { schemaVersion = 0 } = await chrome.storage.local.get('schemaVersion');

  if (schemaVersion < 1) {
    const { todos = [] } = await chrome.storage.local.get('todos');
    await chrome.storage.local.set({
      todos: todos.map((t) => ({ ...t, createdAt: t.createdAt ?? Date.now() })),
      schemaVersion: 1,
    });
  }
});
```

**用独立的 `schemaVersion` 而不是扩展版本号**——扩展版本会因为无关改动频繁变，数据结构版本才是你真正要判断的东西。

## 选型速查

```text
用户配置、要跨设备         → sync（小心 8 KB 单项限制）
缓存、大列表、本机数据      → local
token、临时态、SW 全局变量  → session
企业策略                   → managed（只读）
```

## 小结

- **扩展里不用 `localStorage`**——SW 里根本没有。
- `sync` 的**写入频率限制（120 次/分钟）比容量更容易撞**，输入类操作务必防抖。
- `session` 存内存、浏览器关闭即清，是**放 token 和替代 SW 全局变量**的正确位置。
- `onChanged` 是最省事的跨上下文同步机制，但**自己写入也会收到通知**。
- 没有事务，**读-改-写有竞态**；按更新频率拆键，计数逻辑集中到 SW。
- 用独立的 `schemaVersion` 做数据迁移。

下一篇：[网络与 CORS](/manual/computer-programming/chrome-extension/network-and-cors)。
