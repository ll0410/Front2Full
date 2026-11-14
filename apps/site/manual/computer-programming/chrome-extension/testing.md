---
title: "测试策略"
description: "Chrome 插件开发指南 · 单元测试、Puppeteer、CI"
source: "https://daiw.org/manual/chrome-extension/testing"
---

# 测试策略

Chrome 插件开发指南 · 单元测试、Puppeteer、CI

扩展测试的难点是**没有浏览器就没有 `chrome.*`**。所以策略的核心是：**把纯逻辑和 `chrome.*` 调用分开**——前者用普通单测覆盖，后者交给端到端测试。

## 分层

```text
┌─────────────────────────────────────────┐
│ E2E（Puppeteer / Playwright）            │  少而关键：真装进 Chrome 跑
│ 覆盖：跨上下文流程、真实注入、权限          │
├─────────────────────────────────────────┤
│ 集成（mock chrome.*）                    │  中等：验证 API 调用参数正确
├─────────────────────────────────────────┤
│ 单元（vitest / jest）                     │  大量：纯函数、数据处理、解析
└─────────────────────────────────────────┘
```

**投入产出比最高的是最下面一层**——前提是你的代码结构允许。

## 让代码可测：把 chrome.* 挤到边缘

```javascript
// ✗ 难测：逻辑和 API 揉在一起
export async function addTodo(text) {
  const { todos = [] } = await chrome.storage.local.get('todos');
  if (!text.trim()) throw new Error('空');
  todos.push({ id: Date.now(), text: text.trim(), done: false });
  await chrome.storage.local.set({ todos });
}
```

```javascript
// ✓ 好测：纯函数 + 薄壳
export function makeTodo(text, now) {
  if (!text.trim()) throw new Error('空');
  return { id: now, text: text.trim(), done: false };
}

export function addTodoTo(todos, todo) {
  return [...todos, todo];
}

// 薄壳只做读写，几乎没有逻辑
export async function addTodo(text) {
  const { todos = [] } = await chrome.storage.local.get('todos');
  await chrome.storage.local.set({ todos: addTodoTo(todos, makeTodo(text, Date.now())) });
}
```

`makeTodo` / `addTodoTo` 用普通 vitest 就能测，不需要任何浏览器环境。**扩展里绝大多数 bug 在这一层，而这一层根本不需要 `chrome.*`。**

## 单元测试

```bash
pnpm add -D vitest
```

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',      // 需要 DOM 时
    setupFiles: ['./test/setup.js'],
  },
});
```

```javascript
// todo.test.js
import { describe, it, expect } from 'vitest';
import { makeTodo, addTodoTo } from '../src/todo.js';

describe('makeTodo', () => {
  it('去掉首尾空格', () => {
    expect(makeTodo('  买菜  ', 1).text).toBe('买菜');
  });

  it('拒绝空文本', () => {
    expect(() => makeTodo('   ', 1)).toThrow();
  });
});
```

## Mock chrome.*

需要测薄壳层时，两个选择。

### 手写 mock（够用且透明）

```javascript
// test/setup.js
import { vi, beforeEach } from 'vitest';

const store = new Map();

globalThis.chrome = {
  storage: {
    local: {
      get: vi.fn(async (keys) => {
        if (keys === null) return Object.fromEntries(store);
        const list = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(list.filter((k) => store.has(k)).map((k) => [k, store.get(k)]));
      }),
      set: vi.fn(async (obj) => {
        for (const [k, v] of Object.entries(obj)) store.set(k, v);
      }),
      clear: vi.fn(async () => store.clear()),
    },
  },
  runtime: {
    sendMessage: vi.fn(async () => ({})),
    onMessage: { addListener: vi.fn() },
    lastError: undefined,
  },
  tabs: { query: vi.fn(async () => [{ id: 1, url: 'https://example.com/' }]) },
};

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});
```

**手写 mock 的好处是你知道它在干什么**——现成库经常在你需要某个行为时恰好没实现。

### 现成方案

- **`sinon-chrome`** —— 老牌，API 齐全，但基于 sinon。
- **`@types/chrome`** —— 类型定义，配 TypeScript 用。
- **`vitest-chrome`** —— 较新，vitest 友好。

::: info
**别过度投入 mock 测试。** mock 只能验证「你按预期调用了 API」，不能验证「Chrome 真的会那样响应」。

比如 mock 里 `sendMessage` 立刻 resolve，但真实环境中它可能因为[没有接收方](/manual/computer-programming/chrome-extension/messaging)而 reject——mock 测试全绿，线上照样炸。

**把 mock 测试留给数据变换逻辑，把行为正确性交给 E2E。**
:::

## E2E：真的把扩展装进 Chrome

Puppeteer 和 Playwright 都支持加载扩展，**但必须用有头模式或新版 headless**。

### Puppeteer

```javascript
import puppeteer from 'puppeteer';
import path from 'node:path';

const EXT = path.resolve('./dist');

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
  ],
});
```

拿到扩展 ID（后续访问 popup 等页面要用）：

```javascript
const worker = await browser.waitForTarget((t) => t.type() === 'service_worker');
const extensionId = new URL(worker.url()).host;
```

::: warning
**`--load-extension` 在旧的 headless 模式下不工作**（`headless: true` / `headless: 'old'`）。必须用 `headless: 'new'` 或 `headless: false`。

CI 上跑有头模式需要虚拟显示：

  ```yaml
  - run: xvfb-run --auto-servernum pnpm test:e2e
  ```
:::

### 测 popup

```javascript
const page = await browser.newPage();
await page.goto(`chrome-extension://${extensionId}/popup.html`);

await page.type('#input', '买菜');
await page.click('#add');

const items = await page.$$eval('.todo', (els) => els.map((e) => e.textContent));
expect(items).toContain('买菜');
```

**注意**：以标签页方式打开的 popup **不会被「关闭即销毁」**，所以依赖那个行为的 bug 在这里测不出来。

### 测 content script

```javascript
const page = await browser.newPage();
await page.goto('https://example.com/');
await page.waitForSelector('.myext-injected');       // 等注入生效

const text = await page.$eval('.myext-injected', (e) => e.textContent);
expect(text).toBe('已处理');
```

E2E 里**一定要 `waitForSelector` 而不是 `waitForTimeout`**——注入时机受 [`run_at`](/manual/computer-programming/chrome-extension/content-scripts) 和页面加载速度影响，固定等待必然出现偶发失败。

### 测 Service Worker

```javascript
const workerTarget = await browser.waitForTarget((t) => t.type() === 'service_worker');
const sw = await workerTarget.worker();

// 在 SW 上下文里执行代码
const result = await sw.evaluate(async () => {
  await chrome.storage.local.set({ test: 1 });
  return (await chrome.storage.local.get('test')).test;
});
expect(result).toBe(1);
```

`worker.evaluate` 能直接在 SW 里跑代码，**这是验证后台逻辑最直接的手段**。

### Playwright

Playwright 的写法类似，但只支持 **persistent context**：

```javascript
import { chromium } from '@playwright/test';

const context = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

const [worker] = context.serviceWorkers();
const extensionId = new URL(worker.url()).host;
```

## CI

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test              # 单元测试
      - run: pnpm build             # 产出 dist/

      - name: E2E
        run: xvfb-run --auto-servernum pnpm test:e2e

      - uses: actions/upload-artifact@v4
        with:
          name: extension
          path: dist/
```

**顺序很重要**：E2E 依赖 `dist/`，必须在 `build` 之后。

### 顺手加一个 manifest 校验

```javascript
// test/manifest.test.js
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const m = JSON.parse(readFileSync('dist/manifest.json', 'utf-8'));

describe('manifest', () => {
  it('是 MV3', () => expect(m.manifest_version).toBe(3));

  it('版本号合法', () => expect(m.version).toMatch(/^\d+(\.\d+){0,3}$/));

  it('没有开发期权限残留', () => {
    expect(m.permissions ?? []).not.toContain('declarativeNetRequestFeedback');
  });

  it('有上架必需的 128 图标', () => expect(m.icons?.['128']).toBeTruthy());
});
```

**这类校验的性价比极高**——它拦住的正是「上传到商店才发现」的低级错误，见[上架](/manual/computer-programming/chrome-extension/publish-chrome-web-store)。

## 该测什么、不该测什么

| 测 | 不测 |
| -- | ---- |
| 数据变换、解析、校验逻辑 | Chrome API 本身的行为 |
| 关键用户流程的 E2E（1~3 条） | 每个按钮的 E2E（慢且脆） |
| manifest 的结构约束 | UI 像素级外观 |
| 消息协议的序列化边界 | mock 里的调用次数 |

::: info
**扩展的 E2E 天生慢且不稳**（要起真浏览器、等注入、等网络）。**少而关键**是正确策略——覆盖「装上能用」和「核心流程走得通」两件事就够，其余靠单测。
:::

## 小结

- 核心策略：**把纯逻辑和 `chrome.*` 分开**，逻辑用普通单测覆盖。
- mock 只验证「你调了什么」，**不验证 Chrome 会怎么响应**——别过度投入。
- E2E 用 Puppeteer/Playwright + `--load-extension`；**旧 headless 模式不支持**，CI 上配 `xvfb-run`。
- `worker.evaluate` 能直接在 SW 里跑代码，是测后台逻辑最直接的办法。
- E2E 里**永远 `waitForSelector`，不要固定等待**。
- **加一组 manifest 结构校验**——性价比最高的测试。
- E2E 少而关键，别追求覆盖率。

下一篇：[项目结构](/manual/computer-programming/chrome-extension/project-structure)。
