---
title: "密钥与凭据管理"
description: "密钥进了 git 就等于泄露，删文件没用——历史里还在。这一章讲泄露的常见路径、扫描与拦截、正确的存放方式、以及一份「泄露之后按什么顺序做」的处置流程。"
source: "https://daiw.org/manual/web-security/secrets"
---

# 密钥与凭据管理

密钥进了 git 就等于泄露，删文件没用——历史里还在。这一章讲泄露的常见路径、扫描与拦截、正确的存放方式、以及一份「泄露之后按什么顺序做」的处置流程。

密钥泄露是**最廉价的攻击方式**：不需要任何漏洞利用，攻击者只要找到那串字符就赢了。而且有大量自动化程序在实时扫描全网的公开仓库、页面、日志。

::: warning
**公开仓库里的密钥，泄露到被利用的时间以「分钟」计。**

安全研究者做过多次实验：往公开 GitHub 仓库提交一个真实的云 AccessKey，**通常几分钟内就会被自动化程序拿去尝试调用 API**。你以为「就放几分钟，改完就删」——那几分钟足够了。

所以处置的第一原则是：**一旦确认泄露，立刻轮换，不要犹豫、不要先做影响评估。** 评估可以在轮换之后做。
:::

## 泄露的常见路径

| 路径 | 说明 |
| --- | --- |
| **提交进 git** | 头号来源。`.env`、配置文件、测试脚本里的硬编码 |
| **前端产物** | 把服务端密钥打进了浏览器 bundle——**只要是 `NEXT_PUBLIC_` / `VITE_` 前缀的都是公开的** |
| **日志** | 打印了完整请求头、请求体或异常对象 |
| **错误页** | 堆栈里带出配置 |
| **CI/CD 日志** | `set -x` 把带密钥的命令回显出来 |
| **Docker 镜像层** | `COPY .env` 后又 `RUN rm .env`——**文件还在前一层里** |
| **备份文件** | `config.php.bak`、`.env.save` 被 Web 服务器直接提供 |
| **公开的 Issue / 文档 / 截图** | 排查问题时随手贴了日志 |

::: warning
**Docker 镜像那条特别隐蔽。** 镜像是分层的，`RUN rm` 只是在新的一层里标记删除，**前一层里的文件原封不动**。任何人 `docker pull` 你的镜像后都能翻出来：

  ```bash
  # 把镜像导出来，逐层翻找
  docker save myimage:latest | tar -x -C /tmp/img
  grep -rl "SECRET\|PASSWORD\|-----BEGIN" /tmp/img
  ```

**正确做法是多阶段构建**（构建阶段的东西不进最终镜像）或 **BuildKit 的 secret mount**：

  ```dockerfile
  RUN --mount=type=secret,id=npmrc npm ci
  ```
:::

## 扫描：先看看已经漏了什么

### 扫历史（不只是当前文件）

```bash
# 用 gitleaks 扫全部历史
gitleaks detect --source . --verbose

# 或者用 trufflehog，它会验证密钥是否仍然有效
trufflehog git file://. --only-verified
```

**`--only-verified` 很有用**：它会实际调用对应服务的 API 验证密钥是否还活着，帮你区分「历史遗留的死密钥」和「正在泄露的活密钥」，避免被上百条误报淹没。

### 手工快速自查

```bash
# 当前工作区
grep -rnE "(api[_-]?key|secret|password|token|passwd)\s*[:=]\s*['\"][^'\"]{8,}" \
  --include="*.ts" --include="*.js" --include="*.py" --include="*.go" \
  --include="*.yml" --include="*.yaml" --include="*.json" . \
  | grep -vE "node_modules|\.lock|example|placeholder|xxx|your-"

# 私钥
grep -rl "BEGIN.*PRIVATE KEY" . --exclude-dir=node_modules

# 历史里是否提交过 .env
git log --all --full-history --oneline -- "*.env" ".env*"
```

### 检查前端产物

```bash
# 构建后在产物里搜敏感串——这一步经常有惊喜
pnpm build
grep -rE "sk-|AKIA|-----BEGIN|password" .next/static/ dist/ 2>/dev/null | head
```

## 拦截：不让它再进来

扫描是补救，**拦截才是治本**。

### pre-commit 钩子

```bash
# .git/hooks/pre-commit （或用 husky / lefthook 管理）
#!/usr/bin/env bash
if command -v gitleaks >/dev/null; then
  gitleaks protect --staged --redact --verbose || {
    echo "❌ 检测到疑似密钥，提交已阻止"
    exit 1
  }
fi
```

### CI 里再拦一道

```yaml
- name: Secret scan
  run: |
    docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest \
      detect --source /repo --no-git --redact
```

**两道都要**：本地钩子会被 `--no-verify` 绕过，也可能同事没装；CI 是最后一道闸。

### 开启平台侧的推送保护

GitHub 等平台提供 secret scanning 与 push protection——**在 push 的那一刻就拒绝**。这是最省事的一层，直接在仓库设置里开。

## 正确的存放方式

按可靠性从低到高：

| 方式 | 评价 |
| --- | --- |
| 硬编码在代码里 | ❌ 绝不 |
| `.env` 文件（在 `.gitignore` 里） | 🟡 本地开发可以；生产不推荐（明文落盘、容易被误提交） |
| CI/CD 的 Secrets | 🟢 部署期注入，够用 |
| 云厂商的密钥管理服务 | 🟢🟢 支持轮换、审计、细粒度授权 |
| 动态短期凭据（OIDC 联合身份） | 🟢🟢🟢 **最佳**——根本没有长期密钥可泄露 |

::: info
**最后一条值得展开。** 现代 CI/CD 可以用 **OIDC 联合身份**替代长期密钥：GitHub Actions 向云厂商出示一个由 GitHub 签发的短期身份令牌，云厂商验证后**换发一个几分钟有效期的临时凭据**。

  ```yaml
  permissions:
    id-token: write        # 允许申请 OIDC token
    contents: read
  steps:
    - uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: arn:aws:iam::123456789012:role/github-deploy
        aws-region: us-east-1
        # 注意：没有 AccessKey / SecretKey
  ```

**仓库里、Secrets 里都不存在任何长期凭据**——没有东西可以被泄露。这是目前最干净的方案，值得优先迁移。
:::

### 前端环境变量的红线

```bash
# ⚠️ 这些前缀的变量会被打进浏览器 bundle，等同于公开
NEXT_PUBLIC_*
VITE_*
REACT_APP_*
PUBLIC_*
```

**任何带这些前缀的变量都不能放密钥。** 常见误用：把「只读的」API key 放进去，觉得反正只读——但它可能带着配额，被人拿去刷爆；或者它能读到不该公开的数据。

判断标准很简单：**你愿意把它贴在网站首页上吗？** 不愿意，就不能用公开前缀。

## 分环境与最小权限

**开发、测试、生产的密钥必须完全隔离。** 开发环境的密钥流转范围大得多（本地机器、测试脚本、共享文档），如果它能访问生产数据，那生产的防线形同虚设。

**每个密钥只给它真正需要的权限**：

```
❌ 一个万能的数据库超级用户，所有服务共用
✅ 每个服务一个账号，只授予它用到的表和操作
```

这条在 SSRF 那章已经体现过价值：**攻破应用之后，攻击者能干什么，取决于那个凭据的权限。**

## 轮换

**定期轮换**（90 天之类）的实际价值有限——它主要用于满足合规，以及缩短「未被发现的泄露」的窗口期。

**真正必须轮换的时刻**：

- 确认或怀疑泄露
- 有权限接触密钥的人离职
- 依赖的第三方服务发生安全事件
- 密钥出现在任何日志、截图、工单里

**能自动轮换就自动轮换。** 手工轮换的流程如果很痛苦，实际结果就是「从来不轮换」——所以让它简单，比让它频繁更重要。

## 泄露之后：按这个顺序做

::: warning
**顺序很重要。很多人第一反应是「先把提交删掉」——那是错的，浪费的每一分钟都在扩大损失。**

**1. 立刻轮换/吊销那个凭据。** 这是唯一真正止血的动作。在这之前做任何别的事都是在拖延。

**2. 评估影响。** 查审计日志：这个凭据在泄露窗口内被用过吗？从哪些 IP？做了什么操作？

**3. 清理历史**（如果是公开仓库）。用 `git filter-repo` 重写历史并强推。但要清楚：**这不能撤销泄露**——仓库可能已被 fork、被缓存、被爬取。**清理是为了防止将来有人翻到，不是止血手段。**

  ```bash
  git filter-repo --path .env --invert-paths --force
  git push --force --all
  ```

**4. 复盘并加拦截。** 它是怎么进来的？pre-commit 钩子装了吗？CI 扫描有吗？push protection 开了吗？

**5. 如涉及用户数据，走合规流程。** 按法规要求通知。
:::

## 检查清单

- [ ] `.gitignore` 里有 `.env`、`*.key`、`*.pem`、`credentials*`
- [ ] 跑过一次全历史扫描（gitleaks / trufflehog），确认干净
- [ ] pre-commit 钩子 + CI 扫描 + 平台 push protection 三道都在
- [ ] 构建产物里搜过敏感串
- [ ] 生产密钥不在 `.env` 文件里，走 CI Secrets 或密钥管理服务
- [ ] 评估过能否改用 OIDC 短期凭据
- [ ] 开发/测试/生产密钥完全隔离
- [ ] 每个密钥都是最小权限
- [ ] Docker 镜像用多阶段构建或 secret mount，翻层检查过
- [ ] 日志脱敏（不打印完整请求头/body/异常对象）

## 小结

- **公开仓库里的密钥，几分钟内就会被自动化程序利用。**
- **删文件没用**——git 历史里还在；同理 Docker 的 `RUN rm` 也删不掉前一层。
- 扫描用 gitleaks / trufflehog（`--only-verified` 能过滤死密钥），**拦截靠 pre-commit + CI + 平台 push protection 三道**。
- 存放方式的终点是 **OIDC 短期凭据**——没有长期密钥可泄露。
- `NEXT_PUBLIC_*` 等前缀的变量等同公开，**判断标准：你愿意贴在首页上吗**。
- 泄露处置的第一步永远是**立刻轮换**，不是删提交。

第五部分结束。下一部分看你引入的那些代码。👉 [依赖审计](/manual/computer-programming/web-security/dependency-audit)
