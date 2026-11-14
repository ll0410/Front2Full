---
title: "代码评审与 Git 工作流"
description: "查看变更、代码评审、安全评审与 PR 相关命令"
source: "https://daiw.org/manual/claude-code/commands-review"
---

# 代码评审与 Git 工作流

> 查看变更、代码评审、安全评审与 PR 相关命令

## 查看变更

| 命令 | 作用 |
| --- | --- |
| `/diff` | 打开交互式 diff 查看器，展示未提交的改动以及每一轮对话产生的 diff；左右方向键切换“当前 git diff”与“某一轮的改动”，上下方向键切换文件。v2.1.198 起，仓库状态在会话外变化（比如切分支、别的终端提交）时视图会自动刷新。🆕 v2.1.260 起全屏模式下 `/diff` 会在对话旁边打开实时 diff 面板，随 Claude 的改动刷新 |

## 代码评审

| 命令 | 作用 |
| --- | --- |
| `/code-review [low\|medium\|high\|xhigh\|max\|ultra] [--fix] [--comment] [--max-findings <n>\|all] [target] [pr#]` | 技能。评审当前 diff 或某个 PR 的正确性 bug，以及可复用性、简化、效率方面的清理建议。`--fix` 直接应用到工作区，`--comment` 以行内评论发到 GitHub PR（v2.1.257 起也支持 GitLab MR，经 `glab mr note` 发布），`ultra` 触发云端深度多 agent 评审。⚠️ v2.1.274 起对没有专属调优设置的模型改用更精简的内联评审提示词，不再派生大量评审 subagent。🆕 v2.1.288 起 `--max-findings <n>\|all` 调整结果条数，`--max-findings default` 恢复默认 |
| `/simplify [target]` | 技能。只做清理不找 bug：四个评审 agent 并行分析代码复用、简化、效率、抽象层级是否合适，并直接应用修复（v2.1.154+；更早版本等价于 `/code-review --fix`) |
| `/review [PR]` | ⚠️ **v2.1.223 起是 `/code-review` 的别名**（更早版本是独立的只读 PR 评审命令）。两者行为完全一致 |
| `/security-review` | 分析当前分支的 pending 改动，识别注入、鉴权问题、数据泄露等安全风险 |
| `/ultrareview [PR]` | 在云端沙箱里跑一次深度多 agent 评审。**推荐改用 `/code-review ultra`**，`/ultrareview` 作为弃用别名保留。v2.1.218 起也接受「review my auth changes」这类描述性参数——按当前分支评审，并把那句话作为对结论的附注。v2.1.260 起最长等待 45 分钟（原 30 分钟）；v2.1.269 起 `--post` 在结论出来时直接发 PR 评论并打印链接；v2.1.277 起没有可评审的内容时会说明是哪种情况、提供一条评审最近一次提交的命令，新仓库的首个提交整体评审，⚠️ 非交互会话里仓库没有基础分支或共同历史时直接拒绝；v2.1.280 起重命名过的关键文件副本（如 `id_rsa copy`、`kubeconfig (1).yaml`）也留在本机不上传；v2.1.283 起启动对话框会说明，评审本地分支可能上传已跟踪文件里未提交的改动；⚠️ v2.1.309 起 `claude ultrareview`（及 v2.1.314 起的 `/ultrareview`）在运行 git 前要求先通过工作区信任确认（脚本可传无值标志 `--trust-workspace` 或设 `CLAUDE_CODE_DISABLE_ULTRAREVIEW_TRUST_CHECK=1`） |

::: warning

**这三条行为变更会直接影响你的旧习惯：**

- **v2.1.215 起，Claude 不再自行调用 `/code-review` 与 `/verify`**——它们只在你手动敲的时候才跑。但 v2.1.246 的变更说明又写道 Claude 在 Bedrock、Vertex AI、Foundry 等环境下「也能自行发起」`/code-review`，自动发起的范围在这几个版本间有反复；想让评审稳定进流程，还是自己触发或写进技能/hook。
- **v2.1.218 起 `/code-review` 在后台 subagent 里运行**，评审过程不再灌满你的对话；堆叠的斜杠命令会被保留为它的评审目标（v2.1.232 起 high、xhigh、max 档也一样）。
- **v2.1.223 起 `/code-review` 不带强度参数时沿用你上次用过的强度**。第一次记得显式写一个（如 `/code-review high`），否则你以为的「默认」可能是上周随手敲的 `max`。

:::

## PR 与协作流程

| 命令 | 作用 |
| --- | --- |
| `/install-github-app` | 为仓库安装 Claude GitHub App，可选顺带配置 GitHub Actions workflow 与 secrets |
| `/autofix-pr [prompt]` | 派生一个 Claude Code on the web 会话，持续盯着当前分支的 PR：CI 失败或有人留评论时自动推送修复。默认修复全部 CI 失败与评论，可传自定义指令覆盖默认行为 |

::: info

**`/ultraplan` 已在 v2.1.222 移除。** 它原本用于「在 ultraplan 会话里起草计划 → 浏览器评审 → 选择远程执行或发回本地」。如果你的笔记或团队文档里还留着这条，可以删掉了；类似需求现在用计划模式（`/plan`）配合 `/teleport`、`claude agents` 这套远程会话流转来做。

:::

## 典型流程

```text
# 改完代码后
/diff                       # 先自己看一眼改了什么
/code-review --fix          # 让 Claude 找 bug 并直接修
/security-review            # 过一遍安全检查
# 满意后直接让 Claude 创建 PR
"create a pr"
```

用 `gh pr create` 创建 PR 后，该会话会自动与这个 PR 关联，之后可以用 `claude --from-pr 123` 或在 `/resume` 选择器里搜索 PR URL 找回这个会话。
