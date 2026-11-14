---
title: "依赖审计"
description: "你的代码只占产物的一小部分——audit 报告怎么从「28 条告警」读成「哪几条真能被打到」，可达性分析怎么做，以及被上游锁死版本时用 overrides 的正确姿势。"
source: "https://daiw.org/manual/web-security/dependency-audit"
---

# 依赖审计

你的代码只占产物的一小部分——audit 报告怎么从「28 条告警」读成「哪几条真能被打到」，可达性分析怎么做，以及被上游锁死版本时用 overrides 的正确姿势。

一个典型的现代 Web 项目，`node_modules` 里有上千个包，**你自己写的代码可能只占最终产物的百分之几**。安全边界早就不由你的代码质量单独决定了。

这一章讲怎么把依赖审计做成一件**有判断、不刷屏**的事。

## 先跑一遍

```bash
pnpm audit                # npm audit / yarn audit 同理
pnpm audit --json > audit.json   # 结构化输出，便于分析
```

典型输出是「N 条漏洞，X high、Y moderate」。**然后大多数人的反应是两种极端：要么全部忽略，要么盲目升级到 latest。两种都不对。**

## 关键一步：可达性分析

**「有漏洞」不等于「能被利用」。** 判断一条告警对你是否真实，问三个问题：

### 一、这个包在生产产物里吗

```bash
# 只看生产依赖，过滤掉开发工具链
pnpm audit --prod
```

`eslint`、`prettier`、`jest`、构建工具的漏洞**不进入生产产物**——它们攻击的是你的开发机和 CI。风险不为零（供应链投毒会走这条路），但优先级明显低于运行时依赖。

### 二、有漏洞的那段代码路径，你走到了吗

这是最关键的一问，也是最需要动脑的一问。举几个真实的判断例子：

| 告警 | 判断 |
| --- | --- |
| `sharp` 的 libvips CVE | 如果 `images.unoptimized: true`，图片优化器根本不启用，**sharp 可能连加载都没加载** → 低 |
| Next.js「Server Actions SSRF」 | 全站 SSG、代码里 `grep -r "use server"` 无结果 → **不适用** |
| Next.js「Image Optimization DoS」 | 同上，优化器关着 → **不适用** |
| `postcss` sourceMappingURL 路径穿越 | 只在构建期处理**你自己写的** CSS → 低 |
| `mermaid` 原型污染 | **客户端加载、进浏览器**，但图表源码来自你自己的 MDX，没有用户可控输入 → 低，但要注意「将来加了用户提交图表的功能」就变高 |
| `js-yaml` DoS | 解析的是自己的 frontmatter → 低 |

**核实前提要动手，不要凭印象**：

```bash
# 有没有 middleware
ls src/middleware.* 2>/dev/null || echo "无"
# 有没有 Server Actions
grep -rl "use server" src/ || echo "无"
# 图片优化开着吗
grep -n "unoptimized" next.config.*
```

::: warning
**「用不到」是当前架构的巧合，不是防御。**

今天你没有 Server Actions，所以那条 SSRF 不适用。但下个月某个同事加了一个——**那条漏洞就活了，而没有人会回头重新评估这份 audit 报告**。

所以可达性分析的正确用法是**排优先级**，不是**决定不修**。补丁在版本约束内、代价可控时，一律升。可达性分析用来决定「今天下午就修」还是「排进这个迭代」。
:::

### 三、有没有补丁，代价多大

```bash
# 看看有没有可用版本，以及跨度多大
pnpm outdated
npm view <包名> versions --json | jq '.[-10:]'
```

**关键是找到「在你的版本约束内」的补丁版本**。以本站为例：`next` 的安全补丁在 16.2.11+，而 `pnpm outdated` 会告诉你 latest 是 16.3.0——**但项目约定锁在 16.2.x LTS**。查一下就会发现 16.2.12 存在，既修了漏洞又不破约束。

**不要照着 `latest` 升**，那一列经常跨大版本。

## 传递依赖：被上游锁死时怎么办

最常见的困境：**漏洞在一个传递依赖里，而直接依赖把它的版本写死了。**

```
. > fumadocs-core > next@16.2.12 > postcss@8.4.31   ← next 把 postcss 钉死在 8.4.31
```

升 `next` 不一定带上新的 `postcss`。这时用 **overrides**：

```json
{
  "pnpm": {
    "overrides": {
      "postcss": "^8.5.23",
      "sharp": "^0.35.0",
      "dompurify": "^3.4.12",
      "js-yaml@4": "^4.3.1",
      "brace-expansion@1": "^1.1.18",
      "brace-expansion@5": "^5.0.9"
    }
  }
}
```

（npm 用顶层 `"overrides"`，yarn 用 `"resolutions"`，语义相同。）

::: info
**注意 `brace-expansion@1` 和 `@5` 这种写法。** 当一个包在依赖树里同时存在多个大版本时，用 `包名@主版本` 分别指定——写一个笼统的 `"brace-expansion": ">=1.1.18"` 可能把某处需要 v1 的地方强行提到 v5，直接跑不起来。

**先查清楚树里有哪些版本**：

  ```bash
  pnpm why brace-expansion | grep -oE "brace-expansion [0-9.]+" | sort -u
  ```
:::

**overrides 是有风险的**：你在强制上游用一个它没测试过的版本。所以用完必须**跑完整验证**——构建、测试、关键功能实测。补丁版本（8.4 → 8.5）通常安全，跨大版本要非常谨慎。

## 把它接进 CI

一次性清理没有意义，新漏洞每天都在披露。

```yaml
- name: Audit
  run: |
    pnpm audit --prod --audit-level=high
    # 退出码非 0 会让 CI 失败
```

::: warning
**直接用 `pnpm audit` 卡 CI，很快就会变成「所有人都在 `--no-verify` 绕过」。**

因为总会有一条你暂时无法修的漏洞（上游没发补丁、或者修复需要大版本升级），而它会让每一次提交都红。

**务实的做法**：
- 卡在 `--audit-level=high` 且只看 `--prod`，减少噪音；
- 提供一个**带过期时间的豁免机制**——`.audit-ignore` 里记录「这条已评估、暂不修、理由是什么、复查日期」；
- 到期自动重新报警，防止豁免变成永久遗忘。

**关键是让「豁免」是显式的、有记录的、会过期的**，而不是靠所有人心照不宣地忽略红灯。
:::

自动化升级也值得配（Dependabot / Renovate）：让补丁版本自动开 PR，CI 跑通就能合。**把「升级」的摩擦降到最低，是保持依赖新鲜最有效的办法。**

## 减少依赖本身

最好的依赖审计是**没那么多依赖可审**。

引入一个包之前问：

| 问题 | 为什么 |
| --- | --- |
| 它有多少传递依赖？ | 一个包可能拖来 50 个 |
| 最近一次更新是什么时候？ | 无人维护的包出了 CVE 也没人修 |
| 有几个维护者？ | 单人维护 = 账号被盗就是供应链事件 |
| 我需要的功能有多少行？ | 为 20 行代码引入一个包，不划算 |

```bash
# 看看某个包实际拖来多少东西
pnpm why <包名>
du -sh node_modules | tail -1
```

**现代运行时已经内置了很多曾经需要依赖的能力**：`fetch`、`crypto.randomUUID()`、`structuredClone`、`Object.groupBy`、`Array.prototype.at`……很多老项目里的小工具包现在都可以删掉。

## 不只是 npm

别忘了其它层的依赖：

```bash
# 容器基础镜像（下一章展开）
trivy image myapp:latest --severity HIGH,CRITICAL

# 系统包
apt list --upgradable

# 你自己写的 GitHub Actions 引用的第三方 action —— 建议锁到 commit SHA
# uses: actions/checkout@v7          ← tag 可以被移动
# uses: actions/checkout@<40位sha>   ← 不可变
```

::: info
**第三方 GitHub Action 锁 SHA 这条经常被忽略。** tag 是可变的——攻击者拿到 action 仓库的写权限后，可以把 `v3` 这个 tag 指向一个带后门的提交，**而你的 workflow 什么都不用改就会执行它**，还带着你所有的 Secrets。

锁到 commit SHA 就没这个问题。可读性差一些，但 Dependabot 能帮你自动更新。
:::

## 小结

- **有漏洞 ≠ 能被利用**，用可达性分析排优先级：在生产产物里吗？漏洞路径你走到吗？补丁代价多大？
- **但「用不到」是架构巧合不是防御**——可达性用来排序，不是用来决定不修。
- 找补丁版本时**别照着 `latest` 升**，要找版本约束内的那一个。
- 传递依赖被上游锁死时用 **overrides**，注意按大版本分别指定，用后必须完整验证。
- CI 卡 audit 要配**带过期时间的显式豁免**，否则会退化成全员绕过。
- **最好的审计是减少依赖**；第三方 GitHub Action 建议锁 commit SHA。

下一章看承载这一切的容器。👉 [容器与镜像安全](/manual/computer-programming/web-security/container-security)
