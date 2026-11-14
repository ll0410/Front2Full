---
title: Vue 组件库开发指南
description: 从架构、开发、测试、文档到发布，完整走一遍 Vue 3 组件库的搭建过程。
outline: false
---

# Vue 组件库开发指南

从零搭建企业级 Vue 3 组件库——架构、开发、测试、文档、发布全流程。

::: info 配套工程实践
本专题的实践项目位于仓库 `practices/vue-component-library/`，包含 `packages/components`（组件库本体）与 `apps/playground`（演示应用）。

以下命令均在 `practices/vue-component-library/` 目录下执行：

- 安装依赖：`pnpm install`
- 构建组件库：`pnpm build:components`
- 运行测试：`pnpm test:components`
- 启动 Playground：`pnpm playground`
- 启动 Storybook：`pnpm storybook`
:::

## 本专题包含

**第 1 部分 · 开发指南**：架构选型 → 工程初始化 → 组件规范 → Storybook → 测试 → 文档站 → 构建发布 → Button 实战 → 企业内使用。

**第 2 部分 · 组件实现**：Button、Input、Select、Dialog 四个组件的 API、示例与实现要点。

文中出现的 `pnpm release`、`pnpm changeset`、`pnpm lint` 等命令属于教程内容，用于说明完整工程链路，本仓库未配置对应工具链。
