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

const designPatterns: Topic = {
  slug: 'design-patterns',
  column: 'computer-programming',
  status: 'published',
  title: '经典设计模式浅析',
  description: '用白话把 GoF 23 种设计模式讲清楚。',
  parts: [
    {
      title: '第 1 部分 · 创建型 · 对象从哪来',
      articles: [
        { title: '单例模式 · Singleton（创建型）', slug: 'singleton' },
        { title: '工厂方法 · Factory Method（创建型）', slug: 'factory-method' },
        { title: '抽象工厂 · Abstract Factory（创建型）', slug: 'abstract-factory' },
        { title: '建造者 · Builder（创建型）', slug: 'builder' },
        { title: '原型 · Prototype（创建型）', slug: 'prototype' }
      ]
    },
    {
      title: '第 2 部分 · 结构型 · 对象怎么拼',
      articles: [
        { title: '适配器 · Adapter（结构型）', slug: 'adapter' },
        { title: '装饰器 · Decorator（结构型）', slug: 'decorator' },
        { title: '代理 · Proxy（结构型）', slug: 'proxy' },
        { title: '外观 · Facade（结构型）', slug: 'facade' },
        { title: '桥接 · Bridge（结构型）', slug: 'bridge' },
        { title: '组合 · Composite（结构型）', slug: 'composite' },
        { title: '享元 · Flyweight（结构型）', slug: 'flyweight' }
      ]
    },
    {
      title: '第 3 部分 · 行为型 · 对象怎么处',
      articles: [
        { title: '策略 · Strategy（行为型）', slug: 'strategy' },
        { title: '观察者 · Observer（行为型）', slug: 'observer' },
        { title: '命令 · Command（行为型）', slug: 'command' },
        { title: '模板方法 · Template Method（行为型）', slug: 'template-method' },
        { title: '迭代器 · Iterator（行为型）', slug: 'iterator' },
        { title: '状态 · State（行为型）', slug: 'state' },
        { title: '责任链 · Chain of Responsibility（行为型）', slug: 'chain-of-responsibility' },
        { title: '中介者 · Mediator（行为型）', slug: 'mediator' },
        { title: '备忘录 · Memento（行为型）', slug: 'memento' },
        { title: '访问者 · Visitor（行为型）', slug: 'visitor' },
        { title: '解释器 · Interpreter（行为型）', slug: 'interpreter' }
      ]
    }
  ]
}

const chromeExtension: Topic = {
  slug: 'chrome-extension',
  column: 'computer-programming',
  status: 'published',
  title: 'Chrome 插件开发指南',
  description:
    '基于 Manifest V3 的 Chrome 扩展开发中文指南——从 Hello World 到上架 Chrome Web Store。',
  parts: [
    {
      title: '第 1 部分 · 入门',
      articles: [
        { title: '扩展是什么', slug: 'what-is-extension' },
        { title: '开发环境准备', slug: 'environment-setup' },
        { title: 'Hello World', slug: 'hello-world' }
      ]
    },
    {
      title: '第 2 部分 · 实战课程',
      articles: [
        { title: '第 1 课：Hello Popup', slug: 'lesson-01-hello-popup' },
        { title: '第 2 课：Content Script', slug: 'lesson-02-content-script' },
        { title: '第 3 课：Service Worker', slug: 'lesson-03-service-worker' },
        { title: '第 4 课：消息传递', slug: 'lesson-04-message-passing' },
        { title: '第 5 课：Storage API', slug: 'lesson-05-storage-api' },
        { title: '第 6 课：Options Page', slug: 'lesson-06-options-page' },
        { title: '第 7 课：Context Menus', slug: 'lesson-07-context-menus' },
        { title: '第 8 课：Side Panel', slug: 'lesson-08-side-panel' },
        { title: '第 9 课：Declarative Net Request', slug: 'lesson-09-declarative-net-request' },
        { title: '第 10 课：Offscreen Document', slug: 'lesson-10-offscreen-document' }
      ]
    },
    {
      title: '第 3 部分 · Manifest V3',
      articles: [
        { title: 'manifest.json 概览', slug: 'manifest-overview' },
        { title: 'Service Worker', slug: 'service-worker' },
        { title: 'Content Scripts', slug: 'content-scripts' },
        { title: 'Popup 与选项页', slug: 'popup-and-ui' }
      ]
    },
    {
      title: '第 4 部分 · 通信与存储',
      articles: [
        { title: '消息传递', slug: 'messaging' },
        { title: '存储 API', slug: 'storage' },
        { title: '网络与 CORS', slug: 'network-and-cors' }
      ]
    },
    {
      title: '第 5 部分 · 权限与安全',
      articles: [
        { title: '权限模型', slug: 'permissions' },
        { title: '内容安全策略', slug: 'content-security' }
      ]
    },
    {
      title: '第 6 部分 · 进阶 API',
      articles: [
        { title: 'Side Panel', slug: 'side-panel' },
        { title: 'Scripting API', slug: 'scripting-api' },
        { title: 'declarativeNetRequest', slug: 'declarative-net-request' }
      ]
    },
    {
      title: '第 7 部分 · 工程化',
      articles: [
        { title: '调试', slug: 'debugging' },
        { title: '测试策略', slug: 'testing' },
        { title: '项目结构', slug: 'project-structure' },
        { title: '上架 Chrome Web Store', slug: 'publish-chrome-web-store' }
      ]
    },
    {
      title: '第 8 部分 · 附录',
      articles: [
        { title: 'PWA 开发指南', slug: 'appendix-pwa' },
        { title: '油猴脚本开发指南', slug: 'appendix-userscript' }
      ]
    }
  ]
}

const http2And3: Topic = {
  slug: 'http2-3',
  column: 'computer-programming',
  status: 'published',
  title: 'HTTP/2 与 HTTP/3 协议详解',
  description:
    '二进制分帧、HPACK/QPACK、多路复用与 QUIC——逐项拆解 HTTP/2 与 HTTP/3 相对 1.1 改了什么。',
  parts: [
    {
      title: '第 1 部分 · HTTP/2',
      articles: [
        { title: 'HTTP/2 总览', slug: 'h2-overview' },
        { title: '二进制分帧层', slug: 'h2-framing' },
        { title: '流与多路复用', slug: 'h2-streams' },
        { title: 'HPACK 头部压缩', slug: 'hpack' },
        { title: '伪头字段', slug: 'h2-pseudo-headers' },
        { title: '流量控制', slug: 'h2-flow-control' },
        { title: 'SETTINGS 与优先级', slug: 'h2-settings-priority' },
        { title: '连接管理与错误码', slug: 'h2-connection' },
        { title: '服务端推送', slug: 'h2-server-push' }
      ]
    },
    {
      title: '第 2 部分 · HTTP/3 与 QUIC',
      articles: [
        { title: 'HTTP/3 总览', slug: 'h3-overview' },
        { title: 'QUIC 传输层', slug: 'quic-transport' },
        { title: 'HTTP/3 帧格式', slug: 'h3-framing' },
        { title: 'QPACK 头部压缩', slug: 'qpack' },
        { title: '连接与服务发现', slug: 'h3-connection' }
      ]
    },
    {
      title: '第 3 部分 · 对照与迁移',
      articles: [
        { title: '三版全面对照', slug: 'version-comparison' },
        { title: '迁移注意事项', slug: 'migration-notes' }
      ]
    }
  ]
}

const webSecurity: Topic = {
  slug: 'web-security',
  column: 'computer-programming',
  status: 'published',
  title: '网站安全一本通',
  description:
    '沿着一次 HTTP 请求的完整旅程，逐层拆解网站安全——域名与 DNS、CDN 与负载均衡、Nginx、前端、后端、依赖组件、架构与运维。',
  parts: [
    {
      title: '第 0 部分 · 先建立框架',
      articles: [
        { title: '威胁建模：你到底在防谁', slug: 'threat-model' },
        { title: '一次请求的旅程', slug: 'request-journey' }
      ]
    },
    {
      title: '第 1 部分 · 域名与 DNS',
      articles: [
        { title: '注册商与域名账号安全', slug: 'registrar-security' },
        { title: 'DNS 加固：DNSSEC 与 CAA', slug: 'dns-hardening' },
        { title: '子域名接管', slug: 'subdomain-takeover' },
        { title: 'TLS 与证书管理', slug: 'tls-and-certs' }
      ]
    },
    {
      title: '第 2 部分 · 边缘：CDN 与负载均衡',
      articles: [
        { title: '源站暴露：CDN 最常见的失效方式', slug: 'origin-exposure' },
        { title: 'DDoS 与限流', slug: 'ddos-and-ratelimit' },
        { title: 'WAF：能挡什么，挡不了什么', slug: 'waf' }
      ]
    },
    {
      title: '第 3 部分 · Nginx',
      articles: [
        { title: 'Nginx 加固基线', slug: 'nginx-baseline' },
        { title: 'Nginx 配置陷阱', slug: 'nginx-pitfalls' },
        { title: 'HTTP 请求走私', slug: 'request-smuggling' }
      ]
    },
    {
      title: '第 4 部分 · 前端',
      articles: [
        { title: 'XSS：三种形态与真实防御', slug: 'xss' },
        { title: 'CSP：从报告模式到严格模式', slug: 'csp' },
        { title: 'CSRF 与 SameSite', slug: 'csrf' },
        { title: '安全响应头', slug: 'security-headers' },
        { title: '前端供应链', slug: 'frontend-supply-chain' }
      ]
    },
    {
      title: '第 5 部分 · 后端',
      articles: [
        { title: '注入：一个根因，多种形态', slug: 'injection' },
        { title: '认证：密码、会话与多因素', slug: 'authn' },
        { title: '授权：越权与 IDOR', slug: 'authz' },
        { title: 'SSRF：让服务器替攻击者发请求', slug: 'ssrf' },
        { title: '文件上传', slug: 'file-upload' },
        { title: '密钥与凭据管理', slug: 'secrets' }
      ]
    },
    {
      title: '第 6 部分 · 组件与依赖',
      articles: [
        { title: '依赖审计', slug: 'dependency-audit' },
        { title: '容器与镜像安全', slug: 'container-security' }
      ]
    },
    {
      title: '第 7 部分 · 架构与运维',
      articles: [
        { title: '纵深防御与最小权限', slug: 'defense-in-depth' },
        { title: '日志、监控与检测', slug: 'logging-and-detection' },
        { title: '应急响应', slug: 'incident-response' }
      ]
    },
    {
      title: '收尾',
      articles: [{ title: '上线安全检查清单', slug: 'checklist' }]
    }
  ]
}

const ssr: Topic = {
  slug: 'ssr',
  column: 'computer-programming',
  status: 'published',
  title: 'SSR 从入门到精通',
  description:
    '从 CSR 的痛点出发，把服务端渲染的原理、流式、服务端组件、边缘渲染一路讲透，并用近一半篇幅深挖 SSR 的成败命门——缓存。',
  parts: [
    {
      title: '第 1 部分 · 渲染：从客户端到服务端',
      articles: [
        { title: 'CSR 的痛点 · 为什么要把渲染搬回服务端', slug: 'csr-pain' },
        { title: 'SSR 是什么 · 一次请求的服务端旅程', slug: 'what-is-ssr' },
        { title: '水合 · 把死的 HTML 救活', slug: 'hydration' },
        { title: '渲染光谱 · CSR / SSR / SSG / ISR 一图看清', slug: 'rendering-spectrum' }
      ]
    },
    {
      title: '第 2 部分 · 更聪明地渲染',
      articles: [
        { title: '流式渲染 · 别等全部，边算边发', slug: 'streaming' },
        { title: '服务端组件 · 只在服务端跑的那部分', slug: 'server-components' },
        { title: '边缘渲染 · 把服务端搬到离用户最近的地方', slug: 'edge-rendering' }
      ]
    },
    {
      title: '第 3 部分 · 缓存',
      articles: [
        { title: '为什么 SSR 必须缓存 · 渲染一次，服务千次', slug: 'why-cache' },
        { title: 'HTTP 缓存基石 · Cache-Control 全家桶', slug: 'http-caching' },
        { title: 'CDN / 边缘缓存 · SSR 的 HTML 怎么被缓存', slug: 'cdn-caching' },
        { title: 'stale-while-revalidate · 又快，又不太旧', slug: 'swr' },
        { title: '增量静态再生 · SSG 与 SSR 的中间态', slug: 'isr' },
        { title: '数据层缓存 · 缓存数据，而不是 HTML', slug: 'data-cache' },
        { title: '缓存失效 · TTL、按路径、按标签、按需', slug: 'cache-invalidation' },
        { title: '个性化与缓存 · 每人不同的页面怎么缓存', slug: 'personalization' }
      ]
    },
    {
      title: '第 4 部分 · 上生产',
      articles: [
        { title: '量化与排查 · TTFB、LCP 与缓存命中率', slug: 'measuring' },
        { title: '收尾 · 决策树与常见坑', slug: 'recap' }
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
        status: 'published',
        title: '从 LLM 到 Coding Agent',
        description: '逐层拆解一个生产级 Coding Agent 在裸 LLM API 之上做的每一件事。',
        parts: [
          {
            title: '第 1 部分 · 起点 · 裸 LLM API',
            articles: [
              { title: '一次 LLM API 调用，到底给了你什么', slug: 'raw-llm-api' }
            ]
          },
          {
            title: '第 2 部分 · 让模型能做事',
            articles: [
              { title: '工具调用：让模型的“意图”变成真实的“动作”', slug: 'tool-use' },
              { title: 'Agent Loop：所谓智能体，内核是一个 while 循环', slug: 'agent-loop' },
              { title: '工具系统的抽象设计：一个工业级工具的解剖', slug: 'tool-abstraction' }
            ]
          },
          {
            title: '第 3 部分 · 流式与并发',
            articles: [
              { title: '流式处理：边生成边消费，以及工具参数的“逐字到达”', slug: 'streaming' },
              { title: '边流边执行 + 并发编排：把等待时间榨干', slug: 'streaming-tool-execution' }
            ]
          },
          {
            title: '第 4 部分 · 安全与控制',
            articles: [
              { title: '权限系统：在“放手让它干”和“别让它闯祸”之间划线', slug: 'permissions' },
              { title: '中断与转向：在流式、并发、欠着一堆 tool_result 时干净地叫停', slug: 'interrupt' },
              { title: 'Hooks：给 Agent 开一组可编程的插槽', slug: 'hooks' }
            ]
          },
          {
            title: '第 5 部分 · 上下文工程',
            articles: [
              { title: 'Token 预算：与有限上下文窗口的持久战', slug: 'token-budget' },
              { title: '系统提示与上下文注入：每轮喂给模型的那坨东西，到底是怎么拼的', slug: 'context-injection' },
              { title: 'Prompt 缓存：省钱省延迟最立竿见影的一招', slug: 'prompt-caching' },
              { title: '自动压缩：上下文快满了，把历史折叠成摘要', slug: 'auto-compaction' },
              { title: '精细化上下文管理：外科手术，而非大刀阔斧', slug: 'context-compaction' }
            ]
          },
          {
            title: '第 6 部分 · 健壮性',
            articles: [
              { title: '错误恢复与模型回退：把“出错”当成常态', slug: 'error-recovery' },
              { title: '成本与用量追踪：把 token 换算成钱，并实时盯住', slug: 'cost-tracking' },
              { title: '扩展思考的处理：签名、模型绑定，和那些能调一整天的坑', slug: 'thinking' }
            ]
          },
          {
            title: '第 7 部分 · 扩展与规模',
            articles: [
              { title: '子 Agent：用上下文隔离，把细节挡在主线程之外', slug: 'subagents' },
              { title: 'MCP 与工具懒加载：接入开放生态，并解决“几百个工具”的规模问题', slug: 'mcp' },
              { title: '会话历史与持久化：让 Agent 活过进程的生命周期', slug: 'session-history' }
            ]
          },
          {
            title: '第 8 部分 · 实战 · 综合运用',
            articles: [
              { title: '实战：LLM 是怎么总结一个代码仓库的', slug: 'repo-summarization' }
            ]
          }
        ]
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
        status: 'published',
        title: 'Codex 中文手册',
        description: '基于 Codex CLI v0.167.0 官方文档整理的 Codex 中文手册。',
        parts: [
          {
            title: '第 1 部分 · 入门',
            articles: [
              { title: '安装、登录与升级', slug: 'installation' },
              { title: '启动命令行选项', slug: 'cli-flags' },
              { title: '配置文件 config.toml', slug: 'configuration' },
              { title: '配置项速查', slug: 'config-reference' },
              { title: '环境变量', slug: 'environment-variables' },
              { title: '常见使用场景', slug: 'scenarios' }
            ]
          },
          {
            title: '第 2 部分 · 核心概念',
            articles: [
              { title: '沙箱、审批与安全', slug: 'sandbox-approvals' },
              { title: 'AGENTS.md 项目指令', slug: 'agents-md' },
              { title: '模型与推理', slug: 'models' }
            ]
          },
          {
            title: '第 3 部分 · 命令参考',
            articles: [
              { title: '斜杠命令', slug: 'slash-commands' },
              { title: '非交互模式 codex exec', slug: 'exec' },
              { title: '会话管理', slug: 'sessions' },
              { title: '代码审查', slug: 'review' }
            ]
          },
          {
            title: '第 4 部分 · 进阶',
            articles: [
              { title: '命令规则 Rules', slug: 'rules' },
              { title: 'MCP 集成', slug: 'mcp' },
              { title: 'Skills 技能', slug: 'skills' },
              { title: '插件', slug: 'plugins' },
              { title: 'Hooks', slug: 'hooks' },
              { title: '子代理', slug: 'subagents' },
              { title: 'SDK 与 App Server', slug: 'sdk-app-server' },
              { title: 'Codex Cloud、GitHub 与 IDE', slug: 'cloud-integrations' }
            ]
          },
          {
            title: '第 5 部分 · 其它',
            articles: [{ title: '更新日志', slug: 'changelog' }]
          }
        ]
      }
    ]
  },
  {
    slug: 'llm',
    title: 'LLM',
    tagline: '从 tokenizer 到推理引擎，拆开大模型这台机器。',
    topics: [
      {
        slug: 'bit-to-agi',
        column: 'llm',
        status: 'published',
        title: '从 Bit 到 AGI',
        description: '用程序员视角，从比特、数学、信息论一路讲到 Transformer、训练、推理与 AGI，共十二阶段 186 篇。',
        parts: [
          {
            title: '第 1 章 · 比特（Bit）',
            articles: [
              { title: '本章导读', slug: '01-bits' },
              { title: '为什么 AI 最后只是比特', slug: '01-bits/why-ai-is-bits' },
              { title: '为什么世界只有 0 和 1', slug: '01-bits/why-world-is-01' },
              { title: 'CPU 如何理解世界', slug: '01-bits/how-cpu-understands-world' },
              { title: '整数如何表示', slug: '01-bits/integer-representation' },
              { title: '浮点数为什么会有误差', slug: '01-bits/floating-point-error' },
              { title: '图片为什么可以压缩', slug: '01-bits/why-images-compress' },
              { title: '为什么视频可以压缩', slug: '01-bits/why-video-compresses' },
              { title: '声音为什么可以数字化', slug: '01-bits/why-audio-digitizes' },
              { title: '文字为什么最后都是 UTF-8', slug: '01-bits/why-text-is-utf8' },
              { title: '文件是什么', slug: '01-bits/what-is-a-file' },
              { title: '内存是什么', slug: '01-bits/what-is-memory' },
              { title: 'Cache 是什么', slug: '01-bits/what-is-cache' },
              { title: 'GPU 为什么快', slug: '01-bits/why-gpu-is-fast' },
              { title: 'SIMD 是什么', slug: '01-bits/what-is-simd' },
              { title: '矩阵为什么连续存储', slug: '01-bits/why-matrices-are-contiguous' },
              { title: '为什么 AI 喜欢矩阵', slug: '01-bits/why-ai-likes-matrices' },
              { title: '位、字节与寻址', slug: '01-bits/bits-and-bytes' },
              { title: '大端与小端', slug: '01-bits/endianness' },
              { title: '从比特到程序', slug: '01-bits/from-bits-to-programs' },
              { title: '第一章总结', slug: '01-bits/chapter-summary' }
            ]
          },
          {
            title: '第 2 章 · 数学（Math）',
            articles: [
              { title: '本章导读', slug: '02-math' },
              { title: '向量是什么', slug: '02-math/what-is-a-vector' },
              { title: '矩阵是什么', slug: '02-math/what-is-a-matrix' },
              { title: '为什么矩阵乘法这么重要', slug: '02-math/why-matrix-multiply-matters' },
              { title: '梯度是什么', slug: '02-math/what-is-gradient' },
              { title: '导数为什么可以学习', slug: '02-math/why-derivatives-enable-learning' },
              { title: '偏导数是什么', slug: '02-math/what-is-partial-derivative' },
              { title: '链式法则是什么', slug: '02-math/chain-rule' },
              { title: '为什么损失函数可以下降', slug: '02-math/why-loss-can-descend' },
              { title: '概率是什么', slug: '02-math/what-is-probability' },
              { title: '贝叶斯是什么', slug: '02-math/what-is-bayes' },
              { title: '点积是什么', slug: '02-math/dot-product' },
              { title: '范数与距离', slug: '02-math/norms-and-distance' },
              { title: '特征值的直觉', slug: '02-math/eigenvalues-intuition' },
              { title: 'Softmax 与 Logits', slug: '02-math/softmax-and-logits' },
              { title: '第二章总结', slug: '02-math/chapter-summary' }
            ]
          },
          {
            title: '第 3 章 · 信息（Information）',
            articles: [
              { title: '本章导读', slug: '03-information' },
              { title: '什么是信息', slug: '03-information/what-is-information' },
              { title: '信息熵是什么', slug: '03-information/what-is-entropy' },
              { title: '为什么压缩就是去除信息冗余', slug: '03-information/compression-removes-redundancy' },
              { title: '为什么语言具有统计规律', slug: '03-information/language-has-statistics' },
              { title: '为什么 GPT 可以预测下一个 Token', slug: '03-information/why-gpt-predicts-next-token' },
              { title: '互信息是什么', slug: '03-information/mutual-information' },
              { title: '交叉熵是什么', slug: '03-information/cross-entropy' },
              { title: 'KL 散度是什么', slug: '03-information/kl-divergence' },
              { title: '预测即压缩', slug: '03-information/prediction-is-compression' },
              { title: '第三章总结', slug: '03-information/chapter-summary' }
            ]
          },
          {
            title: '第 4 章 · 神经元（Neuron）',
            articles: [
              { title: '本章导读', slug: '04-neural-networks' },
              { title: '什么是神经元', slug: '04-neural-networks/what-is-neuron' },
              { title: '为什么要激活函数', slug: '04-neural-networks/why-activation-functions' },
              { title: 'ReLU 为什么成功', slug: '04-neural-networks/why-relu-wins' },
              { title: 'Sigmoid 为什么失败', slug: '04-neural-networks/why-sigmoid-fails' },
              { title: 'MLP 是什么', slug: '04-neural-networks/what-is-mlp' },
              { title: 'CNN 为什么成功', slug: '04-neural-networks/why-cnn-succeeds' },
              { title: 'RNN 为什么消失', slug: '04-neural-networks/why-rnn-vanishes' },
              { title: 'LSTM 解决了什么', slug: '04-neural-networks/what-lstm-solves' },
              { title: 'Attention 为什么出现', slug: '04-neural-networks/why-attention-emerged' },
              { title: '前向传播是什么', slug: '04-neural-networks/forward-pass' },
              { title: '反向传播是什么', slug: '04-neural-networks/backward-pass' },
              { title: '权重初始化', slug: '04-neural-networks/weight-initialization' },
              { title: '批归一化是什么', slug: '04-neural-networks/batch-normalization' },
              { title: 'Dropout 是什么', slug: '04-neural-networks/dropout' },
              { title: '过拟合与正则化', slug: '04-neural-networks/overfitting-and-regularization' },
              { title: '损失函数家族', slug: '04-neural-networks/loss-functions' },
              { title: '优化器：SGD 与 Adam', slug: '04-neural-networks/optimizer-sgd-adam' },
              { title: '从感知机到深度网络', slug: '04-neural-networks/from-perceptron-to-deep' },
              { title: '万能近似定理的直觉', slug: '04-neural-networks/universal-approximation' },
              { title: '第四章总结', slug: '04-neural-networks/chapter-summary' }
            ]
          },
          {
            title: '第 5 章 · Transformer',
            articles: [
              { title: '本章导读', slug: '05-transformer' },
              { title: 'Embedding 是什么', slug: '05-transformer/what-is-embedding' },
              { title: 'Position Encoding', slug: '05-transformer/position-encoding' },
              { title: 'Self Attention', slug: '05-transformer/self-attention' },
              { title: 'Q、K、V 是什么', slug: '05-transformer/qkv' },
              { title: 'Residual 连接', slug: '05-transformer/residual-connection' },
              { title: 'LayerNorm', slug: '05-transformer/layer-norm' },
              { title: 'Feed Forward 层', slug: '05-transformer/feed-forward' },
              { title: 'Multi Head Attention', slug: '05-transformer/multi-head-attention' },
              { title: 'Decoder 是什么', slug: '05-transformer/decoder' },
              { title: 'Encoder 是什么', slug: '05-transformer/encoder' },
              { title: 'Encoder-Decoder 架构', slug: '05-transformer/encoder-decoder' },
              { title: '为什么 Transformer 统一世界', slug: '05-transformer/why-transformer-unifies' },
              { title: 'Attention 的复杂度', slug: '05-transformer/attention-complexity' },
              { title: '位置编码的变体', slug: '05-transformer/positional-encoding-variants' },
              { title: 'Pre-Norm 与 Post-Norm', slug: '05-transformer/pre-norm-vs-post-norm' },
              { title: 'BERT 与 GPT 的区别', slug: '05-transformer/bert-vs-gpt' },
              { title: '缩放定律入门', slug: '05-transformer/scaling-laws-intro' },
              { title: '从 RNN 到 Transformer', slug: '05-transformer/from-rnn-to-transformer' },
              { title: 'Transformer 块的解剖', slug: '05-transformer/transformer-block-anatomy' },
              { title: '第五章总结', slug: '05-transformer/chapter-summary' }
            ]
          },
          {
            title: '第 6 章 · Token',
            articles: [
              { title: '本章导读', slug: '06-tokenizer' },
              { title: 'Token 是什么', slug: '06-tokenizer/what-is-token' },
              { title: '为什么不用汉字', slug: '06-tokenizer/why-not-chinese-char' },
              { title: '为什么不用单词', slug: '06-tokenizer/why-not-english-word' },
              { title: 'BPE 是什么', slug: '06-tokenizer/what-is-bpe' },
              { title: 'SentencePiece 是什么', slug: '06-tokenizer/what-is-sentencepiece' },
              { title: '为什么 Token 越来越多', slug: '06-tokenizer/why-tokens-grow' },
              { title: '为什么中文 Token 更贵', slug: '06-tokenizer/why-chinese-tokens-cost-more' },
              { title: '词表大小如何选', slug: '06-tokenizer/vocabulary-size' },
              { title: 'Tokenization 的坑', slug: '06-tokenizer/tokenization-pitfalls' },
              { title: '第六章总结', slug: '06-tokenizer/chapter-summary' }
            ]
          },
          {
            title: '第 7 章 · 训练（Training）',
            articles: [
              { title: '本章导读', slug: '07-training' },
              { title: '预训练是什么', slug: '07-training/what-is-pretraining' },
              { title: 'SFT 是什么', slug: '07-training/what-is-sft' },
              { title: 'RLHF 是什么', slug: '07-training/what-is-rlhf' },
              { title: 'DPO 是什么', slug: '07-training/what-is-dpo' },
              { title: 'GRPO 是什么', slug: '07-training/what-is-grpo' },
              { title: 'MoE 是什么', slug: '07-training/what-is-moe' },
              { title: 'LoRA 是什么', slug: '07-training/what-is-lora' },
              { title: 'QLoRA 是什么', slug: '07-training/what-is-qlora' },
              { title: '蒸馏是什么', slug: '07-training/distillation' },
              { title: 'Checkpoint 是什么', slug: '07-training/checkpoint' },
              { title: '数据配比', slug: '07-training/data-mixing' },
              { title: '学习率调度', slug: '07-training/learning-rate-schedule' },
              { title: '梯度累积', slug: '07-training/gradient-accumulation' },
              { title: '混合精度训练', slug: '07-training/mixed-precision-training' },
              { title: '分布式训练概览', slug: '07-training/distributed-training-overview' },
              { title: '评估指标', slug: '07-training/evaluation-metrics' },
              { title: '对齐概览', slug: '07-training/alignment-overview' },
              { title: '奖励模型', slug: '07-training/reward-model' },
              { title: '训练稳定性', slug: '07-training/training-stability' },
              { title: '第七章总结', slug: '07-training/chapter-summary' }
            ]
          },
          {
            title: '第 8 章 · 推理（Inference）',
            articles: [
              { title: '本章导读', slug: '08-inference' },
              { title: 'KV Cache 是什么', slug: '08-inference/what-is-kv-cache' },
              { title: 'Paged Attention', slug: '08-inference/paged-attention' },
              { title: 'Flash Attention', slug: '08-inference/flash-attention' },
              { title: 'Continuous Batching', slug: '08-inference/continuous-batching' },
              { title: 'Tensor Parallel', slug: '08-inference/tensor-parallel' },
              { title: 'Pipeline Parallel', slug: '08-inference/pipeline-parallel' },
              { title: 'Speculative Decoding', slug: '08-inference/speculative-decoding' },
              { title: 'Sampling 是什么', slug: '08-inference/sampling' },
              { title: 'Temperature', slug: '08-inference/temperature' },
              { title: 'TopK', slug: '08-inference/top-k' },
              { title: 'TopP', slug: '08-inference/top-p' },
              { title: 'Prefix Caching', slug: '08-inference/prefix-caching' },
              { title: '推理量化', slug: '08-inference/quantization-inference' },
              { title: '延迟与吞吐', slug: '08-inference/latency-vs-throughput' },
              { title: '第八章总结', slug: '08-inference/chapter-summary' }
            ]
          },
          {
            title: '第 9 章 · GPU',
            articles: [
              { title: '本章导读', slug: '09-gpu' },
              { title: 'CUDA 是什么', slug: '09-gpu/what-is-cuda' },
              { title: 'HBM 是什么', slug: '09-gpu/what-is-hbm' },
              { title: 'NVLink 是什么', slug: '09-gpu/what-is-nvlink' },
              { title: 'PCIe 是什么', slug: '09-gpu/what-is-pcie' },
              { title: 'Warp 是什么', slug: '09-gpu/what-is-warp' },
              { title: 'SM 是什么', slug: '09-gpu/what-is-sm' },
              { title: 'Tensor Core 与 TFLOPS', slug: '09-gpu/tensor-core' },
              { title: '为什么 GPU 这么快', slug: '09-gpu/why-gpu-so-fast' },
              { title: '为什么显存这么重要', slug: '09-gpu/why-vram-matters' },
              { title: '第九章总结', slug: '09-gpu/chapter-summary' }
            ]
          },
          {
            title: '第 10 章 · 自己训练一个模型',
            articles: [
              { title: '本章导读', slug: '10-train-your-llm' },
              { title: '收集数据', slug: '10-train-your-llm/collect-data' },
              { title: '清洗数据', slug: '10-train-your-llm/clean-data' },
              { title: '训练 Tokenizer', slug: '10-train-your-llm/build-tokenizer' },
              { title: '预训练模型', slug: '10-train-your-llm/pretrain-model' },
              { title: '验证模型', slug: '10-train-your-llm/validate-model' },
              { title: '保存 Checkpoint', slug: '10-train-your-llm/save-checkpoint' },
              { title: '跑推理', slug: '10-train-your-llm/run-inference' },
              { title: '部署模型', slug: '10-train-your-llm/deploy-model' },
              { title: 'OpenAI API 兼容', slug: '10-train-your-llm/openai-api-compat' },
              { title: 'MCP 集成', slug: '10-train-your-llm/mcp-integration' },
              { title: '选择基座模型', slug: '10-train-your-llm/pick-base-model' },
              { title: '微调 SFT', slug: '10-train-your-llm/fine-tune-sft' },
              { title: '跑 Benchmark', slug: '10-train-your-llm/evaluate-benchmarks' },
              { title: '监控训练', slug: '10-train-your-llm/monitor-training' },
              { title: '从失败中恢复', slug: '10-train-your-llm/recover-from-failure' },
              { title: '数据集格式', slug: '10-train-your-llm/dataset-format' },
              { title: '硬件规划', slug: '10-train-your-llm/hardware-planning' },
              { title: '成本估算', slug: '10-train-your-llm/cost-estimation' },
              { title: '发布你的模型', slug: '10-train-your-llm/publish-your-model' },
              { title: '第十章总结', slug: '10-train-your-llm/chapter-summary' }
            ]
          },
          {
            title: '第 11 章 · 工程化（Serving）',
            articles: [
              { title: '本章导读', slug: '11-engineering' },
              { title: 'vLLM', slug: '11-engineering/vllm' },
              { title: 'SGLang', slug: '11-engineering/sglang' },
              { title: 'TensorRT-LLM', slug: '11-engineering/tensorrt-llm' },
              { title: 'DeepSpeed', slug: '11-engineering/deepspeed' },
              { title: 'Megatron', slug: '11-engineering/megatron' },
              { title: 'Ray', slug: '11-engineering/ray' },
              { title: 'Kubernetes', slug: '11-engineering/kubernetes' },
              { title: 'LiteLLM', slug: '11-engineering/litellm' },
              { title: 'Gateway', slug: '11-engineering/gateway' },
              { title: '可观测性', slug: '11-engineering/observability' },
              { title: '自动扩缩容', slug: '11-engineering/autoscaling' },
              { title: '模型注册表', slug: '11-engineering/model-registry' },
              { title: 'A/B 测试', slug: '11-engineering/ab-testing' },
              { title: '成本治理', slug: '11-engineering/cost-governance' },
              { title: '第十一章总结', slug: '11-engineering/chapter-summary' }
            ]
          },
          {
            title: '第 12 章 · 未来（AGI）',
            articles: [
              { title: '本章导读', slug: '12-future' },
              { title: 'Agent 是什么', slug: '12-future/what-is-agent' },
              { title: 'Memory', slug: '12-future/memory' },
              { title: 'Tool', slug: '12-future/tool-use' },
              { title: 'MCP', slug: '12-future/mcp-future' },
              { title: 'Computer Use', slug: '12-future/computer-use' },
              { title: 'Robotics', slug: '12-future/robotics' },
              { title: 'World Model', slug: '12-future/world-model' },
              { title: 'AGI 路线图', slug: '12-future/agi-roadmap' },
              { title: '安全与对齐', slug: '12-future/safety-and-alignment' },
              { title: '第十二章总结', slug: '12-future/chapter-summary' }
            ]
          },
          {
            title: '附录 · AI 术语大全',
            articles: [{ title: 'AI术语大全', slug: 'ai-glossary' }]
          }
        ]
      },
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
        status: 'published',
        title: 'AI 大模型解构',
        description: '拆开 Qwen、Llama、DeepSeek、GLM、Kimi 等主流开源大模型的“发动机盖”。',
        parts: [
          {
            title: '先看它们有多像',
            articles: [{ title: '共同骨架 · 先看它们有多像', slug: 'common-skeleton' }]
          },
          {
            title: '主线一 · 省 KV 缓存',
            articles: [
              { title: '注意力 · 从 MHA 到 MQA、GQA、MLA', slug: 'attention-mha-gqa-mla' },
              { title: '滑动窗口 · Gemma 与 GPT-OSS 的局部注意力', slug: 'sliding-window' }
            ]
          },
          {
            title: '主线二 · 稀疏化 MoE',
            articles: [
              { title: '稠密 vs 稀疏 · MoE 为什么突然统治了大模型', slug: 'moe-dense-vs-sparse' },
              { title: 'MoE 的三个旋钮 · 专家数、激活数、共享专家', slug: 'moe-knobs' },
              { title: '让 MoE 训得稳、又均衡', slug: 'moe-stability' }
            ]
          },
          {
            title: '其余关键维度',
            articles: [
              { title: '归一化 · RMSNorm、Pre / Post / 三明治、QK-Norm', slug: 'normalization' },
              { title: '位置编码与长上下文 · RoPE、YaRN，与 NoPE 的挑衅', slug: 'positional-encoding' },
              { title: '训练侧的花样 · MTP、FP8、Muon', slug: 'training-tricks' },
              { title: '宽还是深，以及那些小执念', slug: 'width-depth-quirks' }
            ]
          },
          {
            title: '收尾',
            articles: [
              { title: '四张脸谱 · DeepSeek / Llama / Qwen / GLM 的组合拳', slug: 'model-profiles' },
              { title: '一张大表 + 趋势', slug: 'recap-and-trends' }
            ]
          }
        ]
      },
      {
        slug: 'huggingface',
        column: 'llm',
        status: 'published',
        title: 'HuggingFace 模型下载与部署',
        description:
          '从 Hub 上把模型拉下来、在自己的机器上跑起来，再用它的数据集与算力训出自己的模型——一份偏实操的 HuggingFace 生态指南。',
        parts: [
          {
            title: '第 1 部分 · 认识 Hub',
            articles: [
              { title: 'HuggingFace 到底是什么', slug: 'what-is-huggingface' },
              { title: '一个模型仓库里有什么', slug: 'repo-anatomy' },
              { title: '权重格式', slug: 'weight-formats' }
            ]
          },
          {
            title: '第 2 部分 · 下载',
            articles: [
              { title: '命令行与登录', slug: 'cli-and-auth' },
              { title: '下载', slug: 'downloading' },
              { title: '国内访问', slug: 'china-access' }
            ]
          },
          {
            title: '第 3 部分 · 单机部署',
            articles: [
              { title: '按显存选模型', slug: 'choose-by-vram' },
              { title: '用 transformers 跑起来', slug: 'transformers-serving' },
              { title: 'GGUF 路线：llama.cpp 与 Ollama', slug: 'gguf-llamacpp-ollama' },
              { title: 'vLLM 服务化', slug: 'vllm-serving' },
              { title: '经典模型清单', slug: 'classic-models' }
            ]
          },
          {
            title: '第 4 部分 · 数据集',
            articles: [
              { title: 'datasets 库基础', slug: 'datasets-basics' },
              { title: '做自己的数据集', slug: 'build-your-dataset' }
            ]
          },
          {
            title: '第 5 部分 · 自己训模型',
            articles: [
              { title: 'LoRA 与 QLoRA 微调', slug: 'finetune-lora' },
              { title: '训练实操', slug: 'training-practice' },
              { title: '推回 Hub', slug: 'push-to-hub' }
            ]
          },
          {
            title: '第 6 部分 · 算力与收费',
            articles: [
              { title: '算力选项', slug: 'compute-options' },
              { title: '收费版怎么用才值', slug: 'paid-tiers' }
            ]
          },
          {
            title: '收尾',
            articles: [{ title: '收尾复盘', slug: 'recap' }]
          }
        ]
      },
      {
        slug: 'rsi',
        column: 'llm',
        status: 'published',
        title: 'RSI 技术探究',
        description:
          '用大白话由浅入深地讲“递归自我改进”（RSI）：AI 怎样自己出题、自己打分、改自己的代码、发明算法、参与造下一代 AI，进展怎么量、卡在哪、实验室又为它设了哪些红线。',
        parts: [
          {
            title: '第 0 部分 · 先搞懂概念',
            articles: [
              { title: 'RSI 是什么：从“智能爆炸”说起', slug: 'what-is-rsi' },
              { title: '五级台阶：从自我修正到自主研究', slug: 'rsi-ladder' }
            ]
          },
          {
            title: '第 1 部分 · 自己教自己',
            articles: [
              { title: '自己出题自己练：自博弈与合成数据', slug: 'self-play-data' },
              { title: '自己当裁判：自我奖励与可验证奖励', slug: 'self-rewarding' }
            ]
          },
          {
            title: '第 2 部分 · 自己改自己',
            articles: [
              { title: '改自己的代码：从哥德尔机到达尔文哥德尔机', slug: 'self-modifying-agents' },
              { title: '让 AI 发明算法：AlphaEvolve 一族', slug: 'algorithm-discovery' },
              { title: '自动化 AI 研发：AI 科学家与“参与造自己”的模型', slug: 'automated-research' }
            ]
          },
          {
            title: '第 3 部分 · 量尺、瓶颈与护栏',
            articles: [
              { title: '怎么量进展：时间跨度与研发基准', slug: 'measuring-rsi' },
              { title: '为什么还没“爆炸”：算力、验证与数据', slug: 'bottlenecks' },
              { title: '风险与治理：实验室为自我改进设的红线', slug: 'safety-governance' }
            ]
          },
          {
            title: '收尾',
            articles: [{ title: '回顾与展望', slug: 'recap' }]
          }
        ]
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
        status: 'published',
        title: '数值计算的艺术',
        description:
          '计算机只有有限精度，把纸上的数学公式照搬进去，常常算出垃圾。这个专栏从「误差」这个主角讲起，一路到求根、线性方程、插值、积分、微分方程、FFT、蒙特卡洛与最优化——代码优先，用 NumPy 手写核心算法，把「怎么算得又快又对」这门手艺讲透。',
        parts: [
          {
            title: '有限精度的世界 · 地基',
            articles: [
              { title: '浮点数 · 0.1 + 0.2 为什么不等于 0.3', slug: 'floating-point' },
              { title: '机器精度 · 误差有多大，以及怎么压住它', slug: 'machine-epsilon' },
              { title: '灾难性抵消 · 两个相近的数相减', slug: 'cancellation' },
              { title: '条件数与稳定性 · 是问题病态，还是算法不稳', slug: 'conditioning' }
            ]
          },
          {
            title: '求根 · 解 f(x)=0',
            articles: [
              { title: '二分法 · 最笨，但绝不失手', slug: 'bisection' },
              { title: '牛顿法 · 切线的力量，与它翻车的时候', slug: 'newton' },
              { title: '不动点与割线法 · 收敛阶怎么量', slug: 'iteration-order' }
            ]
          },
          {
            title: '线性代数 · 解 Ax=b',
            articles: [
              { title: '高斯消元与 LU 分解 · 解方程组的主力', slug: 'gaussian-lu' },
              { title: '选主元与病态矩阵 · 方程为什么会算崩', slug: 'pivoting' },
              { title: '迭代法 · Jacobi、Gauss-Seidel 与共轭梯度', slug: 'iterative-linear' },
              { title: '特征值 · 幂迭代与 QR 算法', slug: 'eigenvalues' }
            ]
          },
          {
            title: '逼近 · 插值与拟合',
            articles: [
              { title: '多项式插值与 Runge 现象 · 高次不是越准', slug: 'interpolation' },
              { title: '样条与最小二乘 · 分段的智慧与超定拟合', slug: 'splines-lsq' }
            ]
          },
          {
            title: '微积分的数值版',
            articles: [
              { title: '数值微分 · 有限差分，以及它为什么不稳', slug: 'differentiation' },
              { title: '数值积分 · 梯形、Simpson 与自适应', slug: 'integration' },
              { title: '常微分方程 · 从 Euler 到 RK4', slug: 'ode-euler-rk' },
              { title: '刚性与隐式方法 · 显式为什么会爆炸', slug: 'stiffness' }
            ]
          },
          {
            title: '更多利器 · 变换、随机与最优化',
            articles: [
              { title: '快速傅里叶变换 · 从 O(n²) 到 O(n log n)', slug: 'fft' },
              { title: '蒙特卡洛 · 用随机性做计算', slug: 'monte-carlo' },
              { title: '最优化 · 梯度下降与找到最小值', slug: 'optimization' }
            ]
          },
          {
            title: '收尾',
            articles: [{ title: '收尾 · 一张图串起整条主线', slug: 'recap' }]
          }
        ]
      }
    ]
  },
  {
    slug: 'computer-programming',
    title: '计算机编程',
    tagline: '协议、运行时、编译与网络，讲清楚计算机到底怎么运转。',
    topics: [
      designPatterns,
      chromeExtension,
      http11,
      http2And3,
      webSecurity,
      ssr
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
        status: 'published',
        title: 'Nginx 配置详解',
        description: '逐指令讲清语法、取值、上下文、继承规则与常见误配。',
        parts: [
          {
            title: '第 0 部分 · 基础',
            articles: [
              { title: '配置文件语法', slug: 'config-syntax' },
              { title: '指令、上下文与继承', slug: 'contexts' },
              { title: 'nginx 如何处理请求', slug: 'request-processing' }
            ]
          },
          {
            title: '第 1 部分 · 核心指令',
            articles: [
              { title: '核心模块指令', slug: 'core-module' },
              { title: 'server 与 listen', slug: 'server-listen' },
              { title: 'location 匹配规则', slug: 'location' },
              { title: 'root、alias 与 try_files', slug: 'root-alias' },
              { title: '变量', slug: 'variables' }
            ]
          },
          {
            title: '第 2 部分 · 代理与上游',
            articles: [
              { title: 'proxy 反向代理', slug: 'proxy' },
              { title: 'upstream 负载均衡', slug: 'upstream' },
              { title: 'FastCGI、uWSGI 与 gRPC', slug: 'fastcgi-grpc' }
            ]
          },
          {
            title: '第 3 部分 · TLS 与协议',
            articles: [
              { title: 'SSL/TLS 配置', slug: 'ssl' },
              { title: 'HTTP/2 与 HTTP/3', slug: 'http2-http3' }
            ]
          },
          {
            title: '第 4 部分 · 性能',
            articles: [
              { title: '代理缓存', slug: 'caching' },
              { title: '压缩与静态文件', slug: 'static-perf' }
            ]
          },
          {
            title: '第 5 部分 · 访问控制',
            articles: [{ title: '访问控制与限流', slug: 'access-limits' }]
          },
          {
            title: '第 6 部分 · 日志与重写',
            articles: [
              { title: '日志', slug: 'logging' },
              { title: 'rewrite、return 与 if', slug: 'rewrite' },
              { title: 'map、geo 与 split_clients', slug: 'map-geo' }
            ]
          },
          {
            title: '第 7 部分 · stream 与收尾',
            articles: [
              { title: 'stream：TCP/UDP 代理', slug: 'stream' },
              { title: '常见误配速查', slug: 'recap' }
            ]
          }
        ]
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
