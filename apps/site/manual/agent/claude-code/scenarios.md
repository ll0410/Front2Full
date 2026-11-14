---
title: "上手使用"
description: "从熟悉新代码库到修 bug、重构、写测试、开 PR、并行开发的实操步骤"
source: "https://daiw.org/manual/claude-code/scenarios"
---

# 上手使用

> 从熟悉新代码库到修 bug、重构、写测试、开 PR、并行开发的实操步骤

这一页是日常开发中最常用的一批操作套路（prompt recipes），照搬即可，按项目实际情况替换措辞。它们都不依赖任何特殊配置，在任何 Claude Code 界面（终端、IDE 插件、Web）都适用。

## 快速摸清一个新代码库

刚接手一个新项目，想尽快搞清楚它的结构：

```bash
cd /path/to/project
claude
```

```text
给我讲讲这个代码库的整体情况
```

```text
这里主要用了哪些架构模式?
核心的数据模型是什么样的?
认证是怎么做的?
```

**技巧**：先问宽泛问题再逐步收窄；顺便让 Claude 讲讲项目里的编码约定，以及列一份项目特有术语表。如果仓库很大，给对应语言装一个代码智能插件，能让 Claude 拿到精确的“跳转到定义/查找引用”能力。

## 定位相关代码

需要找到和某个功能相关的代码：

```text
找到处理用户认证的文件
这些认证相关文件是怎么协作的?
把登录流程从前端到数据库完整梳理一遍
```

**技巧**：描述要尽量具体，多用项目里实际使用的术语，而不是泛泛的说法。

## 高效修 bug

遇到报错，需要定位并修复：

```text
运行 npm test 时报了这个错
```

```text
针对 user.ts 里的 @ts-ignore 建议几种修法
```

```text
按你建议的方案，给 user.ts 加上 null 检查
```

**技巧**：告诉 Claude 复现问题的命令，让它自己拿到堆栈信息；说明复现步骤；告诉它这个错误是偶发还是必现。

## 重构代码

需要把老代码换成更现代的写法：

```text
找一下代码库里用了已废弃 API 的地方
针对 utils.js，给出用现代 JavaScript 特性重构的建议
在保持行为不变的前提下，把 utils.js 重构成 ES2024 写法
跑一下重构后代码对应的测试
```

**技巧**：让 Claude 解释新写法比旧写法好在哪；需要时明确要求保持向后兼容；重构分成小步骤、每步都可测试。

## 补测试

给没有测试覆盖的代码补测试：

```text
找一下 NotificationsService.swift 里没有测试覆盖的函数
给通知服务补上测试
针对通知服务的边界条件补充测试用例
跑一下新测试，修复失败的部分
```

Claude 会参考项目已有测试文件的风格、框架和断言方式来生成新测试。描述清楚要验证的具体行为，效果会更好；也可以直接让 Claude 帮忙找容易漏掉的边界情况、错误路径、非预期输入。

## 创建 Pull Request

可以直接让 Claude 代劳（“帮我创建一个 PR”），也可以分步引导：

```text
总结一下我在认证模块做的改动
create a pr
针对安全性改进，把 PR 描述写得再详细一些
```

用 `gh pr create` 创建 PR 后，当前会话会自动与该 PR 关联，之后可以用 `claude --from-pr 123` 或在 `/resume` 选择器里粘贴 PR URL 找回这个会话。提交前记得看一眼 Claude 生成的 PR 内容，让它顺便指出潜在风险。

## 补文档

给代码补充或更新文档：

```text
找一下 auth 模块里没写 JSDoc 的函数
给 auth.js 里没文档的函数补上 JSDoc
结合更多上下文和示例，完善生成的文档
检查一下这些文档是否符合我们的项目规范
```

**技巧**：明确想要的文档风格（JSDoc、docstring 等）；要求带示例；优先覆盖公共 API、接口和复杂逻辑。

## 在非代码目录里使用

Claude Code 在任何目录都能工作，不只是代码仓库。在笔记库、文档目录、任意一堆 markdown 文件所在的目录里运行 `claude`，同样可以搜索、编辑、重新组织内容。`.claude/` 目录和 `CLAUDE.md` 可以和其它工具的配置目录并存不冲突。

## 处理图片

分析截图、设计稿、图表：

```text
把截图拖进 Claude Code 窗口
或者复制图片后用 Ctrl+V 粘贴进 CLI(注意不是 Cmd+V)
或者直接告诉 Claude 图片路径:“分析这张图片:/path/to/image.png”
```

```text
这张图展示的是什么?
描述一下这个截图里的 UI 元素
根据这个设计稿生成对应的 CSS
```

## 用 @ 引用文件与目录

```text
解释一下 @src/utils/auth.js 里的逻辑     # 引用单个文件，带上完整内容
@src/components 的结构是怎样的?          # 引用目录，给出文件列表（不含内容）
```

`@` 文件引用会把该文件所在目录及其父目录的 `CLAUDE.md` 一并带入上下文；可以在一条消息里引用多个文件。超过 256 KB 的文本文件被 `@` 引用时，Claude 会收到文件大小提示并分段读取（v2.1.292+）；若设了 `CLAUDE_CODE_DISABLE_FILE_MENTIONS=1`（v2.1.299+），则只把文件路径传给 Claude 由文件工具按需读取，不再直接内联内容。MCP 资源同样支持，格式为 `@server:resource`。

## 恢复之前的会话

任务跨越多次操作时，不用每次重新讲一遍背景：

```bash
claude --continue
```

这会恢复当前目录下最近一次会话；如果没有历史会话，会提示 `No conversation found to continue` 并退出。想从列表里挑选，用 `claude --resume`，或者在会话内用 `/resume`。

## 并行开发用 Worktree

在一个终端里做一个功能，另一个终端里让 Claude 修 bug，互不干扰。每个 worktree 是同一仓库下独立分支的独立检出：

```bash
claude --worktree feature-auth
```

在第二个终端换个名字重复上面的命令，即可开启一个隔离的并行会话。要在一个界面里统一监控多个并行会话，用 `claude agents`（见[并行与后台协作](/manual/agent/claude-code/commands-collaboration)）。

## 先计划、再落地

想在改动落盘前先审查方案，切到计划模式。Claude 只读文件、给出计划，在你确认前不做任何修改：

```bash
claude --permission-mode plan
```

会话中途也可以按 `Shift+Tab` 切入计划模式。

## 把探索工作甩给 subagent

探索一个大代码库会把很多文件内容塞进上下文。把探索工作委托出去，只让结论回到主对话：

```text
用一个 subagent 调查一下我们的认证系统是怎么处理 token 刷新的
```

subagent 会在自己独立的上下文窗口里读文件，只把总结报告返回主会话。更多定义与配置见 [Agents](/manual/agent/claude-code/agents)。

## 把 Claude 接入脚本管道

在 CI、pre-commit hook、批处理场景下非交互地运行 Claude。stdin/stdout 和普通 Unix 工具一样使用：

```bash
git log --oneline -20 | claude -p "总结这些最近的提交"
```

更多输出格式、权限参数、扇出模式见[启动命令行选项](/manual/agent/claude-code/cli-flags)中的非交互模式部分。
