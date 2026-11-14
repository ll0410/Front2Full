export interface Article {
  title: string
  slug: string
  description?: string
}

export interface Part {
  title: string
  articles: Article[]
}

export type TopicStatus = 'published' | 'planned'

export interface Topic {
  slug: string
  title: string
  description: string
  status: TopicStatus
  column: string
  parts?: Part[]
}

export interface Column {
  slug: string
  title: string
  tagline: string
  topics: Topic[]
}

const http11: Topic = {
  slug: 'http11',
  column: 'computer-programming',
  status: 'published',
  title: 'HTTP/1.1 协议详解',
  description:
    '逐字段拆解 HTTP/1.1——报文语法、起始行、方法、状态码与每一个头字段的精确语义。',
  parts: [
    {
      title: '第 1 部分 · 报文与成帧',
      articles: [
        { title: '报文结构', slug: 'message-format' },
        { title: '请求行', slug: 'request-line' },
        { title: '状态行', slug: 'status-line' },
        { title: '字段行语法', slug: 'field-syntax' },
        { title: '消息体长度', slug: 'message-body-length' },
        { title: '连接管理', slug: 'connection-management' }
      ]
    },
    {
      title: '第 2 部分 · 方法与状态码',
      articles: [
        { title: '方法', slug: 'methods' },
        { title: '状态码：1xx 与 2xx', slug: 'status-codes' },
        { title: '状态码：3xx 重定向', slug: 'status-3xx' },
        { title: '状态码：4xx 客户端错误', slug: 'status-4xx' },
        { title: '状态码：5xx 服务端错误', slug: 'status-5xx' }
      ]
    },
    {
      title: '第 3 部分 · 字段详解',
      articles: [
        { title: '表示字段', slug: 'representation-fields' },
        { title: '内容协商', slug: 'content-negotiation' },
        { title: '日期与时间', slug: 'http-date' },
        { title: '条件请求', slug: 'conditional-requests' },
        { title: '范围请求', slug: 'range-requests' },
        { title: '缓存', slug: 'caching' },
        { title: '认证', slug: 'authentication' },
        { title: 'Cookie', slug: 'cookies' },
        { title: '上下文与控制字段', slug: 'context-fields' },
        { title: '代理与转发字段', slug: 'proxy-fields' },
        { title: '字段速查表', slug: 'field-index' }
      ]
    }
  ]
}

export const columns: Column[] = [
  {
    slug: 'agent',
    title: 'Agent',
    tagline: '在裸 LLM 之上，把工具、循环、权限与上下文搭成能干活的 Agent。',
    topics: [
      {
        slug: 'llm-to-agent',
        column: 'agent',
        status: 'planned',
        title: '从 LLM 到 Coding Agent',
        description: '逐层拆解一个生产级 Coding Agent 在裸 LLM API 之上做的每一件事。'
      },
      {
        slug: 'claude-code',
        column: 'agent',
        status: 'published',
        title: 'Claude Code 中文手册',
        description: '基于 Claude Code v2.1.318 官方文档整理的 Claude Code 中文手册。',
        parts: [
          {
            title: '第 1 部分 · 入门',
            articles: [
              { title: '安装与升级', slug: 'installation' },
              { title: '启动命令行选项', slug: 'cli-flags' },
              { title: '环境变量', slug: 'environment-variables' },
              { title: '配置文件', slug: 'configuration-files' },
              { title: '上手使用', slug: 'scenarios' }
            ]
          },
          {
            title: '第 2 部分 · 命令参考',
            articles: [
              { title: '会话与上下文管理', slug: 'commands-session' },
              { title: '模型、效率与权限', slug: 'commands-model-permissions' },
              { title: '并行与后台协作', slug: 'commands-collaboration' },
              { title: '代码评审与 Git 工作流', slug: 'commands-review' },
              { title: '自定义与扩展', slug: 'commands-customization' },
              { title: '账户、诊断与其它命令', slug: 'commands-misc' }
            ]
          },
          {
            title: '第 3 部分 · 进阶',
            articles: [
              { title: 'Commands', slug: 'custom-commands' },
              { title: 'Skills', slug: 'skills' },
              { title: 'Agents', slug: 'agents' },
              { title: 'Plugins', slug: 'plugins' }
            ]
          },
          {
            title: '第 4 部分 · 其它',
            articles: [{ title: '版本 Changelog', slug: 'changelog' }]
          }
        ]
      },
      {
        slug: 'codex',
        column: 'agent',
        status: 'planned',
        title: 'Codex 手册',
        description: '基于官方文档整理的 Codex CLI 使用参考。'
      }
    ]
  },
  {
    slug: 'llm',
    title: 'LLM',
    tagline: '从 tokenizer 到推理引擎，拆开大模型这台机器。',
    topics: [
      {
        slug: 'nanogpt',
        column: 'llm',
        status: 'planned',
        title: 'nanoGPT 源码解读',
        description: '逐行读懂 nanoGPT——约 300 行模型加 300 行训练。'
      },
      {
        slug: 'llm-anatomy',
        column: 'llm',
        status: 'planned',
        title: 'AI 大模型解构',
        description: '拆开主流开源大模型的“发动机盖”。'
      }
    ]
  },
  {
    slug: 'math',
    title: '数学',
    tagline: '程序员够用的数学：线性代数、概率、数值与优化。',
    topics: [
      {
        slug: 'linear-algebra',
        column: 'math',
        status: 'planned',
        title: '写给程序员的线性代数',
        description: '从向量与矩阵乘法的代码直觉出发，讲清几何含义。'
      },
      {
        slug: 'numerical',
        column: 'math',
        status: 'planned',
        title: '数值计算的艺术',
        description: '从误差讲起，一路到求根、插值、积分与最优化。'
      }
    ]
  },
  {
    slug: 'computer-programming',
    title: '计算机编程',
    tagline: '协议、运行时、编译与网络，讲清楚计算机到底怎么运转。',
    topics: [
      http11,
      {
        slug: 'http2-3',
        column: 'computer-programming',
        status: 'planned',
        title: 'HTTP/2 与 HTTP/3',
        description: '二进制分帧、HPACK/QPACK、多路复用与 QUIC。'
      },
      {
        slug: 'ssr',
        column: 'computer-programming',
        status: 'planned',
        title: 'SSR 从入门到精通',
        description: '从 CSR 的痛点讲到流式渲染、服务端组件与边缘渲染。'
      }
    ]
  },
  {
    slug: 'tools',
    title: '工具',
    tagline: '命令行、编辑器与自动化，把日常工具用到肌肉记忆。',
    topics: [
      {
        slug: 'git-internals',
        column: 'tools',
        status: 'planned',
        title: 'Git 内部原理',
        description: '从对象模型到引用与分支，理解 Git 真正在做什么。'
      },
      {
        slug: 'nginx',
        column: 'tools',
        status: 'planned',
        title: 'Nginx 配置详解',
        description: '逐指令讲清语法、取值、上下文、继承规则与常见误配。'
      }
    ]
  },
  {
    slug: 'frameworks',
    title: '应用框架',
    tagline: '框架不是黑盒：从路由到响应式，逐个拆解。',
    topics: [
      {
        slug: 'vue-runtime',
        column: 'frameworks',
        status: 'planned',
        title: 'Vue 3 运行时拆解',
        description: '响应式系统、调度器、渲染器与编译产物逐层拆读。'
      },
      {
        slug: 'vite-internals',
        column: 'frameworks',
        status: 'planned',
        title: 'Vite 构建原理',
        description: '从 ESM 原生加载到依赖预构建与产物打包。'
      }
    ]
  },
  {
    slug: 'engineering-practice',
    title: '工程实践',
    tagline: '可交付的工程：组件库、构建发布、测试与部署。',
    topics: [
      {
        slug: 'vue-component-library',
        column: 'engineering-practice',
        status: 'published',
        title: 'Vue 组件库开发指南',
        description:
          '从架构、开发、测试、文档到发布，完整走一遍 Vue 3 组件库的搭建过程。',
        parts: [
          {
            title: '第 1 部分 · 开发指南',
            articles: [
              { title: '架构设计与技术选型', slug: 'architecture' },
              { title: 'Monorepo 项目初始化', slug: 'monorepo-init' },
              { title: '组件开发规范与流程', slug: 'component-dev' },
              { title: 'Storybook 组件开发', slug: 'storybook' },
              { title: '单元测试策略', slug: 'testing' },
              { title: 'VitePress 文档站', slug: 'docs-site' },
              { title: '构建与 npm 发布', slug: 'build-publish' },
              { title: '实战：从零造一个 Button', slug: 'button-example' },
              { title: '企业内使用', slug: 'enterprise-usage' }
            ]
          },
          {
            title: '第 2 部分 · 组件实现',
            articles: [
              { title: 'Button 按钮', slug: 'button' },
              { title: 'Input 输入框', slug: 'input' },
              { title: 'Select 选择器', slug: 'select' },
              { title: 'Dialog 对话框', slug: 'dialog' }
            ]
          }
        ]
      },
      {
        slug: 'release-pipeline',
        column: 'engineering-practice',
        status: 'planned',
        title: '前端发布流水线',
        description: '构建、版本、制品与部署的一条龙工程化方案。'
      }
    ]
  }
]

export function getColumn(slug: string): Column | undefined {
  return columns.find(column => column.slug === slug)
}

export function getTopic(columnSlug: string, topicSlug: string): Topic | undefined {
  return getColumn(columnSlug)?.topics.find(topic => topic.slug === topicSlug)
}

export function publishedTopics(columnSlug: string): Topic[] {
  return getColumn(columnSlug)?.topics.filter(topic => topic.status === 'published') ?? []
}

export function plannedTopics(columnSlug: string): Topic[] {
  return getColumn(columnSlug)?.topics.filter(topic => topic.status === 'planned') ?? []
}

export function topicPath(columnSlug: string, topicSlug: string): string {
  return `/manual/${columnSlug}/${topicSlug}/`
}

export function articlePath(columnSlug: string, topicSlug: string, articleSlug: string): string {
  return `${topicPath(columnSlug, topicSlug)}${articleSlug}`
}

export function countArticles(topic: Topic): number {
  return topic.parts?.reduce((total, part) => total + part.articles.length, 0) ?? 0
}
