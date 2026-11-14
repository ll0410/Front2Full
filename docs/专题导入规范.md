# 专题导入规范

从第三方站点或本地文档迁移专题文章到本站时，按本文执行。规范由 HTTP/1.1 专题（daiw.org，23 个文件）的实战流程提炼而来，目标是：**正文完整、链接不死、可自动校验**。

## 1. 适用范围

| 来源 | 抓取 | 转换 | 校验 |
| --- | --- | --- | --- |
| 第三方文档站（daiw.org、官方手册等） | 抓 HTML | turndown → Markdown | 全部 |
| 本地 Markdown | 跳过 | 只需规范化 frontmatter 与链接 | 全部 |
| 本地 Word / EPUB | 跳过 | pandoc → Markdown，再人工校对 | 全部 |
| PDF | 跳过 | 先抽文本（`pdftotext -layout`），逐段校对 | 全部 + 重点抽查 |

无论来源，**产物的目录结构、frontmatter、登记方式、验收标准都一样**，见第 3–7 节。

## 2. 产出物形态

一个专题 = 站点里一个目录 + `catalog.ts` 里一条记录：

```text
apps/site/manual/<column>/<topic>/
├── index.md          # 专题首页（规范基准、阅读顺序等）
├── <article-a>.md    # 第 1 部分第 1 篇
├── <article-b>.md    # 第 1 部分第 2 篇
└── ...
```

- 路由即文件路径（`cleanUrls: true`）：`/manual/<column>/<topic>/<article>`。
- **文件名 = slug，一律小写英文短横线**，不用中文、不用序号前缀（排序由 `catalog.ts` 的 `parts` 决定）。
- `index.md` 是专题首页，不对应任何文章，不写进 `parts`。
- 目录内**不允许**出现多余文件：多出的 md 不会进侧边栏，却会生成孤立路由；缺失的 md 会在构建期报死链。

## 3. 五步流程

```text
0 合规确认 → 1 登记 catalog → 2 抓取正文 → 3 转换 → 4 保真校验 → 5 接入验收
```

任一步不通过就停在该步修复，不带着问题进入下一步。转换脚本与 HTML 快照只放 `/tmp`，**不进仓库**（仓库只保留迁移结果与本文）。

## 4. 第 0–1 步：合规与登记

### 4.1 合规

- 确认有权转载（自有内容 / 已获授权 / 开源许可允许）。规范默认**不改写、不删减、不摘要**。
- 必须保留溯源：`source` frontmatter + 专题首页首行署名。缺来源的专题不予合并。

### 4.2 登记 `catalog.ts`

先登记、后转换：`parts` 就是后续转换的清单，也是侧边栏与编号的唯一来源。

```ts
const http11: Topic = {
  slug: 'http11',
  column: 'computer-programming',
  status: 'planned',        // 转换完成并通过验收后再改 published
  title: 'HTTP/1.1 协议详解',
  description: '逐字段拆解 HTTP/1.1——报文语法、起始行、方法、状态码与每一个头字段的精确语义。',
  parts: [
    {
      title: '第 1 部分 · 报文与成帧',   // 标题与编号严格对齐源站
      articles: [
        { title: '报文结构', slug: 'message-format' }
      ]
    }
  ]
}
```

规则：

- `slug` 全局唯一、小写短横线；`column` 必须是已有专栏（工程实践也是普通专栏，实践项目不参与专题登记）。
- `status: 'planned'` 时只出现在专栏页「筹备中」，**不进侧边栏**；`published` 才注册 `sidebar[topicPath]`。
- `parts` 的顺序 = 侧边栏顺序，编号跨部分连续（1..N），不要自己写序号进 `title`。
- `title` 是对外展示名，可与源站不同；`description` 用于专栏页卡片与专题首页。

## 5. 第 2 步：抓取正文

1. 缓存原始 HTML 到 `/tmp/<source>-<topic>/*.html`（含 `index.html`），文件名用 slug。抓取失败先补缓存再重跑，**转换脚本不允许联网**。
2. 找正文容器：从 `<article>` 开始，取正文所在的 `div`（daiw 站为 `div.prose`）。用标签配平截取，不靠正则闭合，避免嵌套 `div` 被截断：

   ```js
   function extractBalancedDiv(html, startIndex) {
     const tagRe = /<div\b|<\/div>/g
     tagRe.lastIndex = startIndex
     let depth = 0, match
     while ((match = tagRe.exec(html))) {
       if (match[0] === '</div>') {
         if (--depth === 0) return { inner: html.slice(startIndex, tagRe.lastIndex) }
       } else depth += 1
     }
     throw new Error('unbalanced div')
   }
   ```

3. 抽取 `title`（`<h1>`）与 `description`（标题下第一段导语），二者直接进 frontmatter。
4. 丢弃正文容器之外的：面包屑、作者/日期/篇号、收藏与分享按钮、页脚、上下篇导航。

## 6. 第 3 步：转换管线

### 6.1 关键顺序

```text
取正文 → 删按钮/交互残留 → 标题去链接 + 重算锚点 → 链接改写
       → 抽出所有 <pre> 存占位符 → turndown → 回填代码块 → 加 H1 与 frontmatter
```

### 6.2 代码块必须先抽出（最重要的一条）

turndown 会把 `<pre>` 里的高亮 `<span>` 结构压平，丢失缩进与空行。做法：

1. 正则取出每个 `<pre>` 的 `textContent`，反转义、去掉行尾空白，存入数组；
2. 正文里替换为 `@@PRE0@@` 占位；
3. turndown 完成后再回填为 ```` ```text ```` 代码块。

对协议、命令行类内容默认用语言 `text`，不猜语言，避免高亮报错。

### 6.3 turndown 配置

```js
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_'
})
turndown.use(gfm)   // 表格、删除线、任务列表
turndown.addRule('hardBreak', { filter: 'br', replacement: () => '<br>' })
```

表格单元格内的换行用 `<br>` 保留，不要转成空格。

### 6.4 标题锚点重算

源站标题自带 `id`，本站由 VitePress 依标题文本生成，两者对中文标题经常不一致（如「健壮性要求（MUST 级）」）。必须：

1. 用 `github-slugger` 按**清洗后**的标题文本（去掉 `data-card` 包裹与「复制本节链接」按钮）重新计算 id；
2. 建立 `源 id → 本站 id` 映射；
3. 改写所有 `](#id)`；映射不到时**丢弃 fragment、保留链接文字**，绝不留死锚点。

### 6.5 链接改写三分支

| 原链接 | 处理 |
| --- | --- |
| 指向同一专题的其他文章（`/manual/http11/<slug>`） | 改写到本站路径 `/manual/<column>/<topic>/<slug>` |
| 指向源站其他页面（`/about`、其他专题、站内根路径） | 改为源站绝对地址 `https://<source-host>/...` |
| 外链（`http(s)://`、`mailto:`） | 原样保留 |

改写后再做一次全量自检：产物中不得残留 `](/manual/http11` 这类旧前缀。

### 6.6 frontmatter 与正文头

每篇文章：

```markdown
---
title: "报文结构"
description: "start-line、字段行、空行、消息体——HTTP/1.1 报文的四段式语法与解析规则。"
source: "https://daiw.org/manual/http11/message-format"
---

# 报文结构
```

- `title` 不会自动渲染成 H1，**正文首行必须手写 `# 标题`**。
- 专题首页 `index.md` 在 H1 之后插入来源行：

  ```markdown
  > 内容来源：[daiw.org](https://daiw.org/manual/http11) · 作者 David · 原文更新于 2026-08-03
  ```

  作者与原文日期以源站为准，源站没有就省略该段，不要编造。

### 6.7 残留清理清单

转换后全文搜索这些字符串，命中即修：`<button`、`data-card`、`fd-`、`复制本节链接`、`收藏本文`、`跳到主要内容`。

## 7. 第 4 步：保真校验（门禁）

转换脚本必须自带报告，逐篇对比源 HTML 与产物：

| 指标 | 通过条件 |
| --- | --- |
| `h2` 数量 | 源 = 产物 |
| 代码块数量 | 源 `<pre>` 数 = 产物 ```` ```text ```` 数 |
| 表格 | 表数量与**每张表的列数**逐一相等 |
| 纯文本字数比 | 产物 / 源 ≥ 0.98（去代码块与 Markdown 标记后比较） |
| 残留字符串 | 无 |
| 代码块内出现 ```` ``` ```` | 无（出现说明回填把围栏撑破了） |

任一项不通过 → 列入「待人工修复」清单，逐条修完再进第 5 步。报告模板：

```markdown
| slug | 标题 | h2 源/产物 | 代码块 源/产物 | 表格 源/产物 | 字数比 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| message-format | 报文结构 | 6/6 | 2/2 | 2/2 | 0.995 | OK |
```

数量全对仍要**人工抽查 3 篇**（首篇、含表格最多的一篇、末篇），逐段对照源站：表格内容、代码块换行、加粗与行内代码。

## 8. 第 5 步：接入与验收

1. `parts` 里的 slug 与目录内文件**一一对应**，无多余、无缺失。
2. `status` 改为 `published`，确认侧边栏出现「专题入口 + 各分组 + 连续编号」。
3. 构建即死链校验：

   ```bash
   pnpm build
   ```

4. 路由探测（全部 200）：

   ```bash
   pnpm --filter @front2full/site preview &
   for p in /manual/<column>/ /manual/<column>/<topic>/ /manual/<column>/<topic>/<article>; do
     printf '%s ' "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:4173$p)"; echo $p
   done
   ```

5. 视觉验收（1440 / 390 两档，light + dark）：专题首页、侧边栏三组折叠、面包屑、上一篇/下一篇、站内搜索能命中正文关键词。
6. 本地搜索索引需重建：`pnpm build` 会重新生成，不要直接改 `dist`。

## 9. 常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 代码块缩进/空行丢失 | turndown 压平 `<pre>` 内 `<span>` | `<pre>` 先占位后回填（6.2） |
| 标题下多出「复制本节链接」 | 标题内嵌 `<a>`/`<button>` | 转换前剥掉，只留文本 |
| 页内锚点点击无反应 | 源 id 与 VitePress slug 不一致 | `github-slugger` 重算并映射（6.4） |
| 构建报死链 | 站内链接未改写 / slug 拼错 | 按 6.5 改写，再用 `pnpm build` 兜底 |
| 表格列错位 | 空单元格被吞 / 合并单元格 | 补空单元格；源站有 `colspan` 则手工重排 |
| 文章页没有大标题 | 只写了 frontmatter `title` | 正文首行补 `# 标题`（6.6） |
| 预览看不到新样式/新内容 | `preview` 仍服务旧的 `dist` | `lsof -ti tcp:4173 \| xargs kill -9` 后重启 |
| 卡片文字变蓝带下划线 | `.vp-doc a` 默认样式命中卡片 | 组件样式需显式重置颜色与下划线 |

## 10. 一页版 Checklist

- [ ] 合规确认，来源与作者信息已记录
- [ ] `catalog.ts` 登记专题（`status: planned`，`parts` 与源站目录一致）
- [ ] 原始 HTML / 文档已缓存到 `/tmp`，脚本不联网
- [ ] 正文容器用标签配平截取，交互残留已删
- [ ] `<pre>` 占位 → turndown → 回填
- [ ] 锚点重算、链接三分支改写、旧前缀清零
- [ ] 每篇有 frontmatter（`title`/`description`/`source`）+ 正文 H1
- [ ] 专题首页有来源署名行
- [ ] 保真报告全部 OK，人工抽查 3 篇
- [ ] `status: published`，`pnpm build` 通过
- [ ] 全部路由 200，light/dark 视觉验收通过

## 附：脚本骨架

一次性使用，放在 `/tmp/<source>-migrate/` 下，依赖单独安装（不进仓库）：

```bash
npm i turndown turndown-plugin-gfm github-slugger
```

```js
import fs from 'node:fs'
import path from 'node:path'
import TurndownService from 'turndown'
import * as gfmPkg from 'turndown-plugin-gfm'
import GithubSlugger from 'github-slugger'

// 只改这一段
const CONFIG = {
  srcDir: '/tmp/daiw-http11',                  // 缓存的 HTML 目录
  outDir: 'apps/site/manual/computer-programming/http11',
  sourceBase: 'https://daiw.org/manual/http11', // 源站专题地址
  columnPath: '/manual/computer-programming/http11/', // 本站专题路由
  sourcePrefix: '/manual/http11',               // 源站站内链接前缀
  slugs: ['index', 'message-format' /* ... */]
}

const gfm = gfmPkg.gfm ?? gfmPkg.default?.gfm

const decode = html => html
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

const stripTags = html => html.replace(/<[^>]+>/g, '')
const textOf = html => decode(stripTags(html)).replace(/\s+/g, ' ').trim()

function extractBalancedDiv(html, start) {
  const re = /<div\b|<\/div>/g
  re.lastIndex = start
  let depth = 0, m
  while ((m = re.exec(html))) {
    if (m[0] === '</div>') { if (--depth === 0) return html.slice(start, re.lastIndex) }
    else depth += 1
  }
  throw new Error('unbalanced div')
}

function convert(slug) {
  const html = fs.readFileSync(path.join(CONFIG.srcDir, `${slug}.html`), 'utf8')
  const article = html.slice(html.indexOf('<article'), html.indexOf('</article>'))
  const title = textOf(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(article)[1])

  // 1. 取正文（选择器按源站调整）
  const start = article.indexOf('<div class="prose')
  const div = extractBalancedDiv(article, start)
  let body = div.slice(div.indexOf('>') + 1, div.lastIndexOf('</div>'))
  body = body.replace(/<button[\s\S]*?<\/button>/g, '')

  // 2. 先验证数量，再转换
  const srcH2 = (body.match(/<h2\b/g) || []).length
  const srcPre = (body.match(/<pre\b/g) || []).length

  // 3. 标题去链接 + 重算锚点
  const slugger = new GithubSlugger()
  const anchorMap = new Map()
  body = body.replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/g, (_, lv, attrs, inner) => {
    const oldId = /\bid="([^"]*)"/.exec(attrs)?.[1]
    const text = inner.replace(/<a\b[^>]*>/g, '').replace(/<\/a>/g, '')
    const newId = slugger.slug(textOf(text))
    if (oldId) anchorMap.set(decode(oldId), newId)
    return `<h${lv}>${text}</h${lv}>`
  })

  // 4. 链接改写
  const resolveHref = href => {
    if (href.startsWith('#')) {
      const mapped = anchorMap.get(decodeURIComponent(href.slice(1)))
      return mapped ? `#${mapped}` : null
    }
    if (href === CONFIG.sourcePrefix || href === CONFIG.sourcePrefix + '/') {
      return CONFIG.columnPath
    }
    if (href.startsWith(CONFIG.sourcePrefix + '/')) {
      return CONFIG.columnPath + href.slice(CONFIG.sourcePrefix.length + 1)
    }
    if (/^(https?:|mailto:)/.test(href)) return href
    if (href.startsWith('/')) return new URL(href, CONFIG.sourceBase).href
    return href
  }
  body = body.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/g, (_, attrs, inner) => {
    const href = /\bhref="([^"]*)"/.exec(attrs)?.[1]
    if (!href) return inner
    const target = resolveHref(decode(href))
    return target === null ? inner : `<a href="${target}">${inner}</a>`
  })

  // 5. <pre> 占位
  const blocks = []
  body = body.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/g, (_, inner) => {
    blocks.push(decode(stripTags(inner)).replace(/\s+$/, ''))
    return `\n\n@@PRE${blocks.length - 1}@@\n\n`
  })

  // 6. turndown + 回填
  const turndown = new TurndownService({
    headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '_'
  })
  turndown.use(gfm)
  turndown.addRule('hardBreak', { filter: 'br', replacement: () => '<br>' })

  let markdown = turndown.turndown(body)
    .replace(/@@PRE(\d+)@@/g, (_, i) => '```text\n' + blocks[Number(i)] + '\n```')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const isIndex = slug === 'index'
  if (isIndex) {
    markdown = `> 内容来源：[${new URL(CONFIG.sourceBase).host}](${CONFIG.sourceBase})\n\n${markdown}`
  }
  markdown = `# ${title}\n\n${markdown}`

  // 7. frontmatter + 保真指标
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify('')}`,
    `source: ${JSON.stringify(isIndex ? CONFIG.sourceBase : `${CONFIG.sourceBase}/${slug}`)}`,
    '---', '', ''
  ].join('\n')

  const metrics = {
    h2: [srcH2, (markdown.match(/^## /gm) || []).length],
    pre: [srcPre, (markdown.match(/^```text$/gm) || []).length],
    residue: /<button|data-card|fd-|复制本节链接|收藏本文/.test(markdown),
    fenceBroken: blocks.some(b => b.includes('```'))
  }
  return { slug, title, content: frontmatter + markdown + '\n', metrics }
}

// 8. 写文件 + 报告
for (const slug of CONFIG.slugs) {
  const { slug: s, content, metrics } = convert(slug)
  const file = s === 'index' ? 'index.md' : `${s}.md`
  fs.mkdirSync(CONFIG.outDir, { recursive: true })
  fs.writeFileSync(path.join(CONFIG.outDir, file), content)
  console.log(s, JSON.stringify(metrics))
}
```

骨架只覆盖实测有效的核心步骤；`description` 抽取、字数比与大表格列数比对按源站结构调整（参见第 7 节指标）。修改 `CONFIG` 即可用于下一个 daiw 专题；换源站时替换正文选择器、`sourcePrefix` 与 `columnPath`。
