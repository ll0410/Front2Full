---
title: "上线安全检查清单"
description: "把全专栏的结论压成一份可以逐条打勾的清单——按「今天就做」「这周做」「有余力再做」分三档，附一段可以直接跑的外部体检脚本。"
source: "https://daiw.org/manual/web-security/checklist"
---

# 上线安全检查清单

把全专栏的结论压成一份可以逐条打勾的清单——按「今天就做」「这周做」「有余力再做」分三档，附一段可以直接跑的外部体检脚本。

全专栏的结论压成一页。**按投入产出比分三档**，从上往下做。

## 第一档：今天就做（1~2 小时，挡住绝大多数自动化攻击）

### 域名与账号

- [ ] 域名注册商账号：独立随机密码 + 2FA（**优先硬件密钥/TOTP，别用纯短信**）
- [ ] **注册邮箱不在本域名下**（否则域名一丢，找回通道同时被切断）
- [ ] `whois` 确认 `clientTransferProhibited` 等状态已开
- [ ] 自动续费已开，**且付款方式未过期**
- [ ] DNS 托管商账号同样开 2FA

### 暴露面

- [ ] `curl -sI https://你的域名/.env` → **404**
- [ ] `curl -sI https://你的域名/.git/config` → **404**
- [ ] 数据库、Redis、Docker API **没有对公网开放**
- [ ] 应用端口只绑回环（`127.0.0.1:xxxx`），由本机反代访问
- [ ] Nginx 有 `default_server` 拒绝未知 Host（`return 444`）

### 响应头（几行配置，收益最大）

- [ ] `Strict-Transport-Security`（先 `max-age=300` 试跑，别一上来就 `preload`）
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `X-Frame-Options: DENY` 或 CSP 的 `frame-ancestors 'none'`
- [ ] **每条都带 `always`**，且用 404 页验证过

### 凭据

- [ ] 跑一次 `gitleaks detect --source .` 扫全历史
- [ ] 构建产物里搜过密钥：`grep -rE "sk-|AKIA|BEGIN.*PRIVATE" .next/static/ dist/`
- [ ] 确认没有密钥用 `NEXT_PUBLIC_*` / `VITE_*` 前缀

### 会话

- [ ] 会话 Cookie 有 `HttpOnly; Secure; SameSite=Lax`
- [ ] 不写 `Domain` 属性（除非确实要跨子域共享）

## 第二档：这周做

### 认证与授权

- [ ] 密码用 **Argon2id / bcrypt / scrypt**，不是 SHA
- [ ] 登录接口有限流（**按账号递增延迟 + 按 IP 硬限**）
- [ ] 登录响应**文案与耗时都统一**（不存在的用户也跑一次哈希）
- [ ] **登录后重新生成会话 ID**
- [ ] 改密码使其它所有会话失效
- [ ] 密码重置：token 随机、存哈希、15 分钟过期、一次性
- [ ] **重置链接的域名从配置读**，不用 `req.headers.host`
- [ ] **两个账号互测越权**，并固化成自动化测试

### 输入与输出

- [ ] 所有数据库查询用**参数化**；`grep` 过 `queryRawUnsafe` 之类
- [ ] 表名/列名/排序方向走**白名单映射**
- [ ] 入口用 zod/joi 做 **schema 校验**（顺带防住 NoSQL 注入与批量赋值）
- [ ] 命令执行用**参数数组**，不过 shell
- [ ] `grep` 过 `innerHTML` / `dangerouslySetInnerHTML` / `v-html`，逐个确认数据来源
- [ ] 拼进 `href`/`src` 的 URL 做了**协议白名单**

### 依赖与容器

- [ ] `pnpm audit --prod` 干净，或每条都做过可达性判断并记录
- [ ] CI 里接了依赖扫描（**带过期时间的显式豁免机制**）
- [ ] 容器 `USER` 非 root（`docker run --rm img id` 验证过）
- [ ] **没有** `privileged` / `docker.sock` / `net=host`
- [ ] 镜像用多阶段构建，翻层确认没夹带密钥

### 可观测

- [ ] Nginx 结构化日志（**`escape=json`**）
- [ ] 记录认证事件、**授权拒绝**、敏感操作
- [ ] 日志脱敏（不打印完整请求头/体/异常对象）
- [ ] 证书过期监控（**独立于续期工具，从外部实测**）

## 第三档：有余力再做

- [ ] CSP：先 report-only 跑两周，再逐步收紧到 nonce + `strict-dynamic`
- [ ] CAA 记录 + CT 日志监控
- [ ] DNSSEC（注意换 DNS 服务商时的 DS 同步顺序）
- [ ] 子域名接管扫描（定时任务）
- [ ] 源站只认 CDN（防火墙锁回源段 + 回源鉴权）
- [ ] SSRF 网络层隔离（出网代理或 NetworkPolicy）
- [ ] 数据库最小权限（**不给 DELETE/DROP**）、考虑 RLS
- [ ] 用户上传内容放**独立域名**
- [ ] 云凭据改用 **OIDC 短期凭据**
- [ ] 备份**离线/不可变**，且**演练过恢复**
- [ ] 应急信息卡写好，关键账号至少两人可访问

## 一段可以直接跑的外部体检

```bash
#!/usr/bin/env bash
D="${1:?用法: ./check.sh example.com}"
echo "════ 体检 $D ════"

echo "── 指纹泄露（应为空）──"
curl -sSI "https://$D/" | grep -iE "^server:|x-powered-by:" || echo "  ✓ 干净"

echo "── 安全响应头 ──"
for h in strict-transport-security x-content-type-options x-frame-options \
         referrer-policy content-security-policy; do
  v=$(curl -sSI "https://$D/" | grep -i "^$h:" | head -1)
  [ -n "$v" ] && echo "  ✓ $v" || echo "  ✗ 缺失: $h"
done

echo "── 404 页是否也带头（验证 always）──"
n=$(curl -sSI "https://$D/__nope__" | grep -icE "strict-transport|x-frame|nosniff")
[ "$n" -ge 2 ] && echo "  ✓ 带了 $n 个" || echo "  ✗ 只有 $n 个，检查 always 与 add_header 覆盖"

echo "── 敏感文件（应为 404）──"
for p in .env .git/config .git/HEAD config.json backup.sql; do
  c=$(curl -s -o /dev/null -w "%{http_code}" "https://$D/$p")
  [ "$c" = "200" ] && echo "  ✗✗ 严重: /$p 返回 200" || echo "  ✓ /$p → $c"
done

echo "── 未知 Host（应被拒）──"
curl -sI "https://$D/" -H "Host: invalid.test" 2>/dev/null | head -1 || echo "  ✓ 连接被拒"

echo "── TLS ──"
echo | openssl s_client -connect "$D:443" -servername "$D" 2>/dev/null \
  | grep -E "Protocol|Cipher|Verify return code"
echo | openssl s_client -connect "$D:443" -servername "$D" 2>/dev/null \
  | openssl x509 -noout -dates

echo "── DNS ──"
echo "  CAA:   $(dig +short CAA "$D" | tr '\n' ' ')"
echo "  DS:    $(dig +short DS "$D" | head -1)"
echo "  SPF:   $(dig +short TXT "$D" | grep -i spf)"
echo "  DMARC: $(dig +short TXT "_dmarc.$D")"
```

**只在你自己拥有的域名上运行。**

## 最后：三条比清单更重要的话

**一、清单会过期，思路不会。**
新的攻击手法会不断出现，但「数据不要变成代码」「默认拒绝」「假设这一层会失守」这些原则不变。**理解为什么，比记住做什么更耐用。**

**二、先做最薄的那一环。**
安全水平由最弱的一环决定。给一个域名没开 2FA 的站上顶配 WAF，是把钱花在了已经很厚的地方。**先按[威胁建模那章](/manual/computer-programming/web-security/threat-model)的方法找出最薄处。**

**三、改完一定要验证。**
「我配了那个头」和「那个头确实出现在线上响应里」之间，隔着 CDN 缓存、`add_header` 覆盖、配置没 reload 一堆现实。**本专栏每章都给了验证命令，请真的跑一遍。**

## 回到开头

专栏第一章说过：攻击者不会先想「我要打 XSS」，他会**沿着请求的路径，从最松的那一层进来**。

现在你手上有了这条路径的完整地图——域名、边缘、Nginx、前端、后端、依赖、架构。**每一层都知道会出什么问题、长什么样、怎么验证。**

剩下的就是动手了。

← 回到：[专栏首页](/manual/computer-programming/web-security/) · 相关：[Nginx 详解](https://daiw.org/manual/nginx) · [HTTP/1.1 详解](/manual/computer-programming/http11/)
