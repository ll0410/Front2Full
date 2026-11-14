---
title: "HTTP 缓存基石 · Cache-Control 全家桶"
description: "浏览器和 CDN 到底怎么缓存，全由服务器的一个响应头说了算——Cache-Control。这一章把 max-age、s-maxage、public/private、no-cache/no-store、以及 ETag 条件请求讲透，它们是后面一切缓存策略的字母表。"
source: "https://daiw.org/manual/ssr/http-caching"
---

# HTTP 缓存基石 · Cache-Control 全家桶

浏览器和 CDN 到底怎么缓存，全由服务器的一个响应头说了算——Cache-Control。这一章把 max-age、s-maxage、public/private、no-cache/no-store、以及 ETag 条件请求讲透，它们是后面一切缓存策略的字母表。

缓存分层的第一层是浏览器，第二层是 CDN。这两层怎么缓存你的页面，**不是它们自己决定的，而是你的服务器用一个响应头告诉它们的**——这个头叫 **`Cache-Control`**。理解它，是理解后面一切缓存策略的前提；它是缓存世界的**字母表**。

## 两个问题模型

`Cache-Control` 看着指令一堆，但只要用两个问题去套，立刻就清晰了：

1. **这份响应，能新鲜多久？**（在多久之内可以直接拿缓存、不用问服务器）
2. **过了保鲜期，该怎么办？**（直接扔掉重取？还是问一句「变了没」？还是先用着旧的？）

几乎所有指令，都是在回答这两个问题之一。

## 问题一：能新鲜多久

| 指令 | 含义 |
| --- | --- |
| `max-age=60` | 这份响应 60 秒内算「新鲜」，期间直接用缓存，不问服务器 |
| `s-maxage=60` | **同上，但只对「共享缓存」(CDN)生效**，且优先级高于 `max-age` |
| `immutable` | 永不变，保鲜期内**连「变了没」都不必问**（用于带哈希的静态资源） |

`max-age` 是「保鲜秒数」。关键区分在 `s-maxage`：

::: info
**`max-age` 管浏览器，`s-maxage` 管 CDN。** 「共享缓存(shared cache)」指 CDN 这种**多人共用**的缓存；「私有缓存(private cache)」指用户自己浏览器里那份。你常常想让**浏览器只缓存很短、而 CDN 缓存很久**——比如 `Cache-Control: s-maxage=3600, max-age=0`：浏览器每次都来问，但 CDN 替你把源站保护得死死的（一小时内源站最多渲染一次）。这个组合在 SSR 里极其常用。
:::

## 问题二：过期了怎么办

保鲜期一过，缓存里的东西就「陈旧(stale)」了。怎么处理，由这几个指令决定：

| 指令 | 过期后的行为 |
| --- | --- |
| （默认） | 陈旧后，通常会**带验证器去问一句**「变了没」（见下文 ETag） |
| `no-cache` | **每次使用前都要问**服务器「变了没」——不是不缓存，是「缓存了也要先验证」 |
| `must-revalidate` | 一旦陈旧，**必须**成功验证才能用，不许「先用着旧的」 |
| `stale-while-revalidate=N` | **先把旧的给用户（快），同时后台悄悄更新**——下一章的主角 |
| `stale-if-error` | 源站挂了时，**拿旧的顶上**，别给用户报错 |

## 谁能缓存：public 与 private

还有一对指令决定「**谁**有资格缓存这份响应」——这在 SSR 里性命攸关：

| 指令 | 含义 |
| --- | --- |
| `public` | 任何缓存都可以存（包括 CDN 这种共享缓存） |
| `private` | **只有用户自己的浏览器**能存，**CDN 不许存** |
| `no-store` | **谁都不许存**，每次都必须回源 |

::: warning
**`private` 和 `public` 用错，是 SSR 最危险的缓存 bug 来源。** 一个带用户个人信息的页面（比如「你好，张三」），如果错标成 `public`，CDN 就会把「张三的页面」缓存下来，然后**发给下一个访问的李四**——李四看到了张三的名字。这是严重的信息泄露。**含个性化 / 隐私内容的响应，必须 `private`（只存浏览器）或 `no-store`（干脆不存）。** 「个性化内容怎么在 CDN 层安全地缓存」是个大难题，[后面专门一章](/manual/computer-programming/ssr/personalization)攻它。
:::

`no-store` 和 `no-cache` 是另一对经典混淆：

- **`no-store`** = **绝不缓存**，连存都不存（用于极敏感数据，如支付页）。
- **`no-cache`** = **可以缓存，但每次用之前都要向服务器确认「变了没」**。名字有误导性——它不是「不缓存」。

## 验证器：ETag 与 304

上面反复出现「问一句变了没」，这背后是 HTTP 的**条件请求**机制，靠**验证器(validator)** 实现，能在「内容没变」时省下重传整个 body 的开销：

- 服务器首次响应时附上一个**指纹**：`ETag: "abc123"`（内容哈希）或 `Last-Modified: <时间>`。
- 缓存过期后要验证时，浏览器/CDN 带着这个指纹回来问：`If-None-Match: "abc123"`。
- 服务器一比：**没变** → 回一个 `304 Not Modified`（**空 body**，极小），缓存续命；**变了** → 回 `200` + 新内容。

```text
首次:  GET /article/42          → 200 + body + ETag: "abc123"
再次:  GET /article/42
       If-None-Match: "abc123"   → 304 Not Modified(没 body,几十字节)
```

::: info
条件请求的价值：即便缓存过期了，**验证一次也远比重新下载 / 重新渲染便宜**——没变就是一个几十字节的 `304`。所以「过期」不等于「白缓存了」；带上 ETag，过期缓存还能靠 `304` 高效续命。SSR 框架通常会自动为你算 ETag。
:::

## Vary：缓存键还看哪些请求头

默认情况下，缓存用 **URL** 当键(key)。但有时**同一个 URL，响应会因某个请求头不同而不同**——比如按 `Accept-Encoding` 返回 gzip 或 br 压缩版。`Vary` 头就是告诉缓存：「**这个 URL 的缓存，还要按这些请求头分开存**」。

```text
Vary: Accept-Encoding        # 不同压缩方式各存一份,合理
Vary: Cookie                 # ⚠️ 危险!见下
```

::: warning
**`Vary: Cookie` 几乎等于关掉 CDN 缓存。** 因为每个用户的 Cookie 都不同，`Vary: Cookie` 会让 CDN 为**每个用户**都存一份独立缓存——缓存键炸裂，命中率趋近于零。这又是「个性化 vs 缓存」矛盾的一个化身。记住：**`Vary` 的维度越多，缓存被切得越碎，命中率越低。** 能不 `Vary` 就不 `Vary`。
:::

## 几个即取即用的配方

把上面拼起来，不同内容的典型 `Cache-Control`：

| 内容类型 | Cache-Control | 意思 |
| --- | --- | --- |
| 带哈希的静态资源(`app.abc123.js`) | `public, max-age=31536000, immutable` | 缓存一年、永不重验（文件名变了就是新文件） |
| 可共享的 SSR 页（文章、商品） | `public, s-maxage=60, stale-while-revalidate=300` | CDN 缓存 60 秒，之后 5 分钟内先旧后新 |
| 个性化页（个人中心） | `private, no-cache` | 只存浏览器，每次用前验证 |
| 敏感页（支付、密钥） | `no-store` | 谁都别缓存 |

## 小结与下一章

`Cache-Control` 是缓存的字母表，用「能新鲜多久 / 过期怎么办 / 谁能缓存」三组指令，就能精确指挥浏览器和 CDN。`max-age` vs `s-maxage`、`public` vs `private`、`no-cache` vs `no-store`、以及 ETag 条件请求和 `Vary`——这些是后面每一章都会用到的词汇。

字母表有了，该看这些指令在**最关键的那一层**——CDN / 边缘——上是怎么发挥威力、又怎么把源站保护起来的。下一章深入 CDN 缓存。👉 [CDN / 边缘缓存：SSR 的 HTML 怎么被缓存](/manual/computer-programming/ssr/cdn-caching)。

## 参考文献

- [1] MDN.「Cache-Control.」https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control —— 全部指令的权威定义。
- [2] MDN.「HTTP conditional requests / ETag.」https://developer.mozilla.org/en-US/docs/Web/HTTP/Conditional_requests —— 验证器与 304。
- [3] Google.「HTTP caching — web.dev.」https://web.dev/articles/http-cache —— 实战配方与 `Vary` 陷阱。
