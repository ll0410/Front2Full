---
title: "流式渲染 · 别等全部，边算边发"
description: "传统 SSR 必须等整页渲染完才能发出第一个字节——一个慢查询拖垮整页。流式渲染让服务器先发出外壳，再把慢的区块「边算边发」流式补上，TTFB 大降、首屏更快。这一章讲清它的原理与 Suspense。"
source: "https://daiw.org/manual/ssr/streaming"
---

# 流式渲染 · 别等全部，边算边发

传统 SSR 必须等整页渲染完才能发出第一个字节——一个慢查询拖垮整页。流式渲染让服务器先发出外壳，再把慢的区块「边算边发」流式补上，TTFB 大降、首屏更快。这一章讲清它的原理与 Suspense。

传统 SSR 有个致命节奏问题：**必须等整个页面渲染完，才能发出第一个字节。**

想象一个页面：顶部导航、中间是要查数据库的商品列表、底部是要调第三方 API 的推荐位。传统 SSR 会**傻等**——等最慢的那个（比如卡了 800ms 的推荐 API）也返回、整页 HTML 全部拼好，才把第一个字节发给浏览器。于是**一个慢区块，拖垮了整页的 TTFB**。导航明明瞬间就能给，却要陪着推荐位一起等。

**流式渲染(streaming SSR)** 解决的正是这个：**先发能发的，慢的随后补。**

## 边算边发

流式的思路是把 HTML 拆成一块块，**谁先就绪就先发谁**：

```mermaid
flowchart LR
  A["请求到达"] --> B["立即发出 HTML 外壳<br/>导航 · 布局 · 骨架"]
  B --> C["慢区块先发一个占位<br/>(loading 骨架)"]
  C --> D["数据就绪后<br/>把真实内容流式补进去"]
```

浏览器一拿到外壳就能**立刻画出导航和骨架**（TTFB 极短），用户马上看到「页面在动」；那些慢的区块先显示 loading 占位，等服务端数据就绪，再通过**同一条 HTTP 响应流**把真实内容推过去，自动替换掉占位。**一个慢查询，不再拖累其余部分。**

## Suspense：声明「这块可以晚点来」

在 React 里，流式的开关是 **`<Suspense>`**。你用它把「可能会慢」的区块包起来，并给个 `fallback`（占位）：

```jsx
<Layout>
  <Nav />                          {/* 立刻就绪,先发 */}
  <Suspense fallback={<Skeleton />}>
    <SlowProductList />            {/* 慢,先发 Skeleton,就绪后流式补上 */}
  </Suspense>
</Layout>
```

服务端用 `renderToPipeableStream`（而非老的 `renderToString`）渲染：遇到 `<Suspense>`，它**不阻塞**——先把 `fallback` 连同外壳发出去，等 `<SlowProductList>` 的数据好了，再把真实 HTML 作为后续 chunk 流式发送，并附一小段脚本把占位替换掉。**`<Suspense>` 就是你对框架说的那句「这块可以晚点来，别等它」。**

::: info
各框架都有自己的「Suspense 式」出口：Next.js App Router 用 `<Suspense>` 和 `loading.js`（整个路由段的流式占位）；React Router v7（原 Remix，早期用 `defer()`）的 `loader` 与 SvelteKit 的 `load` 都支持直接返回未 `await` 的 Promise，配合 `<Await>` / `{#await}` 让页面先渲染。名字不同，做的是同一件事：**声明哪些区块允许「先占位、后补上」。**
:::

## 流式还顺带改善了水合

流式不只让**首屏**更快，还让[水合](/manual/computer-programming/ssr/hydration)更聪明——这叫**选择性水合(selective hydration)**:

- 流式发来的区块，可以**各自独立地水合**，不必等整页 HTML 全到齐。
- React 会**优先水合用户正在交互的区块**——你点了哪儿，它就先「激活」哪儿，而不是死板地从上到下。

于是[上一章那个「看得见点不动」的空档](/manual/computer-programming/ssr/hydration)，被大大压缩了：内容一块块地到达、一块块地变得可交互，而不是「整页一起卡着等水合」。

## 代价与注意点

流式不是纯赚，有几处要留心：

::: warning
① **状态码和响应头必须先发。** HTTP 响应的头部（状态码、`Content-Type`、以及后面要讲的**缓存头**）在流开始时就得定下来——因为第一个字节已经发出去了，你没法「发到一半改成 500」。这对错误处理和缓存策略有实际影响。
② **一旦开始流，就难以整体缓存。** 一个流式响应是「边生成边发」的，想把它当成一个完整对象缓存起来，比缓存一份定死的 HTML 要复杂——这是流式和 [CDN 缓存](/manual/computer-programming/ssr/cdn-caching) 之间的一处张力，后面会再提。
③ **SEO 要确认爬虫等得到。** 流式补上的内容是后到的，得确认目标爬虫会等完整个流（主流搜索引擎会，但一些简单爬虫可能只取先到的外壳）。
:::

## 小结与下一章

流式渲染把「等整页渲染完才发」改成「先发外壳、慢区块随后流式补上」，TTFB 大降、首屏更快，还借选择性水合缓解了「看得见点不动」。代价是响应头要提前定、整体缓存变复杂。它解决的是「**什么时候发**」。

但还有个更根本的开销没动：[水合](/manual/computer-programming/ssr/hydration)要把**所有**组件在客户端再跑一遍、把**所有**组件 JS 都发给浏览器。有没有办法让**一部分组件根本不发到客户端、根本不水合**？这就是服务端组件与岛屿架构的思路。👉 [服务端组件：只在服务端跑的那部分](/manual/computer-programming/ssr/server-components)。

## 参考文献

- [1] React 官方文档.「renderToPipeableStream / Suspense.」https://react.dev/reference/react-dom/server/renderToPipeableStream —— 流式 API 与选择性水合。
- [2] Next.js 文档.「Loading UI and Streaming.」https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming —— 框架层的流式。
- [3] web.dev.「Streaming server-side rendering.」https://web.dev/articles/rendering-on-the-web —— 流式 SSR 的动机与收益。
