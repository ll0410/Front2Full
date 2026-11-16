import { defineConfig } from 'vitepress'
import mathjax3 from 'markdown-it-mathjax3'
import { fileURLToPath, URL } from 'node:url'
import { columns } from './data/catalog'
import { buildSidebar } from './utils/sidebar'

// 部署到 GitHub Pages 项目页等子路径时，把 base 改成 '/<repo>/'。
const base = '/Front2Full/'

// 组件库实践项目的源码入口，供 Markdown 中的 <Button /> 等示例直接渲染。
const componentsEntry = fileURLToPath(
  new URL('../../../practices/vue-component-library/packages/components/src/index.ts', import.meta.url)
)

export default defineConfig({
  lang: 'zh-CN',
  title: 'Front2Full',
  description: 'The Full-stack Development Manual',
  base,
  vite: {
    resolve: {
      alias: {
        '@vcl/components': componentsEntry
      }
    }
  },
  cleanUrls: true,
  // 新仓库暂无提交历史，git 时间戳不可用；原文更新日期在专题首页标注。
  lastUpdated: false,
  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    config(md) {
      md.use(mathjax3)
    }
  },
  head: [
    // 首屏（JS 未执行前）按系统偏好给一版正确颜色，避免独立窗口标题栏闪一下
    ['meta', { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#ffffff' }],
    ['meta', { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#111827' }],
    ['link', { rel: 'manifest', href: `${base}manifest.webmanifest` }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}logo.svg` }]
  ],
  themeConfig: {
    logo: '/logo.svg',
    outline: {
      level: [2, 3],
      label: '本页目录'
    },
    // 各专栏平铺在顶部导航，不做下拉折叠。
    nav: columns.map(column => ({
      text: column.title,
      link: `/manual/${column.slug}/`,
      activeMatch: `/manual/${column.slug}/`
    })),
    sidebar: buildSidebar(columns),
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清空',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },
    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },
    lastUpdatedText: '更新于',
    darkModeSwitchLabel: '主题',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    outlineTitle: '本页目录'
  }
})
