# Front2Full

一个从前端出发、沿技术栈走向全栈的开发手册与工程实践集合。项目采用「专题文章 + 配套工程实践」的形式，既可作为日常开发手册，也可作为完整工程实现的参考。

## 项目内容

- **专题手册**：按专栏组织 Agent、LLM、数学、计算机编程、工具、应用框架与工程实践等专题。
- **工程实践**：提供可运行、可构建、可测试的配套代码，目前包含 Vue 3 组件库实践。
- **统一文档站**：基于 VitePress，支持深浅色主题、响应式布局、Clean URL 与数学公式渲染；可安装为 PWA，以独立窗口运行，窗口标题栏颜色跟随站点主题。

## 技术栈

| 范围 | 技术 |
| --- | --- |
| Monorepo | pnpm Workspace、Turborepo |
| 文档站 | VitePress 1.6、Vue 3、TypeScript |
| 组件库实践 | Vue 3、Vite 8、TypeScript、Vitest、Storybook |
| 内容格式 | Markdown、Frontmatter、MathJax |

## 环境要求

- Node.js >= 20
- pnpm 10.34.9（已通过根目录 `packageManager` 声明）

## 快速开始

```bash
# 启用与项目版本一致的 pnpm
corepack enable

# 安装 workspace 依赖
pnpm install

# 启动 workspace 中的开发任务
pnpm dev
```

文档站默认使用 5173 端口，实际访问地址以终端输出为准。如果只需要启动文档站：

```bash
pnpm --filter @front2full/site dev
```

## 常用命令

在仓库根目录执行：

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动 workspace 中的开发任务 |
| `pnpm build` | 构建所有包含 `build` 脚本的包 |
| `pnpm preview` | 启动 workspace 中的预览任务 |
| `pnpm clean` | 清理文档站缓存、构建产物与 Turbo 缓存 |
| `pnpm --filter @front2full/site build` | 仅构建文档站 |
| `pnpm --filter @front2full/site preview` | 仅预览文档站构建结果 |

## 目录结构

```text
Front2Full/
├── apps/
│   └── site/                         # VitePress 文档站
│       ├── manual/                   # 专栏、专题与文章
│       └── .vitepress/
│           ├── config.mts            # 站点配置
│           ├── data/catalog.ts       # 专栏与专题元数据
│           └── theme/                # 主题组件与样式
├── practices/
│   └── vue-component-library/        # Vue 3 组件库工程实践
│       ├── packages/components/      # 组件源码、测试与 Storybook
│       └── apps/playground/          # 组件调试与演示应用
├── docs/                             # 项目维护与专项设定文档
├── package.json                      # 根目录脚本与包管理器声明
├── pnpm-workspace.yaml               # Workspace 范围
└── turbo.json                        # Turbo 任务编排
```

## 内容维护

### 文章目录约定

一个专题对应一个目录，并在 `apps/site/.vitepress/data/catalog.ts` 中登记：

```text
apps/site/manual/<column>/<topic>/
├── index.md
├── <article-a>.md
└── <article-b>.md
```

- 文件名使用小写英文短横线，路由由文件路径生成。
- `catalog.ts` 中的 `parts` 决定侧边栏结构与文章顺序。
- `status: 'planned'` 表示筹备中，`status: 'published'` 才会注册专题侧边栏。
- 每篇文章需要包含 Frontmatter，并在正文首行手写一级标题。
- 迁移外部内容时必须确认转载权限，并保留 `source` 来源信息。

新增或迁移专题前，请阅读 [专题导入规范](docs/专题导入规范.md)。

## Vue 组件库实践

```bash
# 启动 Playground
pnpm --dir practices/vue-component-library playground

# 启动 Storybook
pnpm --dir practices/vue-component-library storybook

# 运行组件测试
pnpm --dir practices/vue-component-library test

# 构建组件库
pnpm --dir practices/vue-component-library build:components

# 构建 Playground
pnpm --dir practices/vue-component-library build:playground
```

组件库源码位于 `practices/vue-component-library/packages/components/src`，目前包含 Button、Input、Select、Dialog 等组件。

## 构建与部署

构建文档站：

```bash
pnpm --filter @front2full/site build
```

静态产物输出到：

```text
apps/site/.vitepress/dist/
```

该目录可直接发布到任意静态托管服务。当前 `apps/site/.vitepress/config.mts` 中的 `base` 为 `/Front2Full/`，用于 GitHub Pages 项目页；如果部署到自定义域名或站点根路径，应将其改为 `/`。
