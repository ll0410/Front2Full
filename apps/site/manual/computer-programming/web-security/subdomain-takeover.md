---
title: "子域名接管"
description: "一条指向已删除云资源的 CNAME，攻击者花几分钟就能把子域名变成自己的——为什么它能绕过同源策略偷走主站 Cookie，怎么批量自查，以及正确的下线顺序。"
source: "https://daiw.org/manual/web-security/subdomain-takeover"
---

# 子域名接管

一条指向已删除云资源的 CNAME，攻击者花几分钟就能把子域名变成自己的——为什么它能绕过同源策略偷走主站 Cookie，怎么批量自查，以及正确的下线顺序。

这是个「听起来很小、后果很大」的洞，而且几乎每个存在超过两年的组织都中过招。

## 它是怎么发生的

三步，非常朴素：

1. 你为某个项目建了 `promo.example.com`，CNAME 指向一个云服务，比如 `promo-2023.某对象存储.com`。
2. 项目结束，**你删掉了云端资源，但忘了删 DNS 记录**。
3. 攻击者扫到这条悬空的 CNAME，去那个云服务上**把同名资源注册回来**——现在 `promo.example.com` 指向他的内容。

整个过程不需要碰你的服务器、不需要密码、不需要漏洞。**只需要你忘记删一条记录。**

::: warning
**易受影响的服务非常多**：对象存储（S3、OSS、COS）、静态托管（GitHub Pages、Netlify、Vercel）、CDN 回源配置、帮助中心/客服系统（Zendesk 之类）、状态页、邮件营销平台……**凡是「你在他们那儿声明一个名字、然后把 CNAME 指过去」的服务，都可能被接管。**

判定标准很简单：**那个名字被释放后，别人能不能重新注册？** 能，就有风险。
:::

## 为什么后果比想象的严重

很多人觉得「不就是一个废弃子域名被人挂了页面吗」。实际影响链条长得多：

### 一、偷走主站的 Cookie

如果你的 Cookie 设了 `Domain=.example.com`（很多站为了跨子域共享登录会这么做），那么**任何子域名都能读到它**。攻击者在 `promo.example.com` 上放一行 JS，用户一访问，会话 token 就到手了。

`HttpOnly` 能挡住 JS 读取，但挡不住**请求自动携带**——攻击者仍可在自己的子域上构造请求，让浏览器带着你的 Cookie 打你的 API。

### 二、绕过 CORS 与 CSP 白名单

很多配置会图省事写成通配：

```
Access-Control-Allow-Origin: https://*.example.com
Content-Security-Policy: script-src 'self' *.example.com
```

被接管的子域名**恰好落在白名单里**——攻击者的脚本成了「可信来源」，CSP 形同虚设。

### 三、高可信度钓鱼

钓鱼页挂在你的真实域名下，带着你的合法证书（攻击者能自己申请，除非你用 CAA + 严格的 `issuewild` 限制）。用户核对域名、看到小锁头，**一切正常**。

### 四、蹭走域名信誉

发垃圾邮件、挂黑帽 SEO、分发恶意软件——记在你的域名头上。搜索引擎标红的是 `example.com` 整个域。

## 怎么自查

### 手工：先把记录列全

```bash
# 从证书透明日志里挖子域名（比爆破全得多，因为申请过证书的都会留痕）
curl -s "https://crt.sh/?q=%25.example.com&output=json" \
  | jq -r '.[].name_value' | tr '\n' '\n' | sed 's/^\*\.//' | sort -u
```

CT 日志是找子域名最有效的来源之一——**你申请过的每一张证书都公开可查**。

### 逐条检查悬空 CNAME

```bash
#!/usr/bin/env bash
# 对子域名清单逐条查：CNAME 指向的目标是否还能解析
while read -r sub; do
  target=$(dig +short CNAME "$sub" | head -1)
  [ -z "$target" ] && continue
  if ! dig +short A "$target" | grep -q .; then
    echo "⚠️  悬空 CNAME: $sub -> $target"
  fi
done < subdomains.txt
```

**但要注意：CNAME 目标能解析，不等于安全。** 很多云服务的通配域名永远能解析（比如 `*.某托管.com` 都指向同一组 IP），资源被删后访问会返回一个特征页面：

```bash
curl -s https://promo.example.com | head -20
```

看到类似 `NoSuchBucket`、`There isn't a GitHub Pages site here`、`404 Not Found · 项目不存在` 这类**服务商的「此资源不存在」提示**，就是可接管的强信号。

::: info
**判断口诀**：DNS 解析成功 + 返回的是服务商的「资源不存在」页 = **高度可疑**。

真正确认需要去对应平台试着注册同名资源——**只在你自己的域名上做这个验证**。
:::

## 正确的下线顺序

接管漏洞的根源是「删资源」和「删 DNS」两步的顺序与遗漏。正确做法：

> **先删 DNS 记录 → 等 TTL 过期 → 再释放云端资源。**

反过来（先释放资源、后删 DNS）就会留出一个窗口期，而现实中「后删 DNS」这一步经常永远不会发生。

把它写进你的下线检查单：

- [ ] DNS 记录已删除（不是改，是删）
- [ ] 等待原 TTL 时长
- [ ] 云端资源已释放
- [ ] 从证书里移除该子域名（如果用的是 SAN 多域名证书）
- [ ] CDN / WAF 上对应的域名配置已清理

## 长期机制

一次性清理没有意义，因为新的悬空记录还会不断产生。要么建流程，要么建监控：

**定时扫描**。把上面的检查脚本挂成每周任务，输出接到告警：

```bash
# 简化版：每周跑一次，有悬空记录就通知
0 3 * * 1 /opt/scripts/check-dangling-cname.sh || notify "发现悬空 CNAME"
```

**收紧 Cookie 作用域**。这是**减轻后果**的关键一招：

```
# 不要这样（所有子域都能读）
Set-Cookie: session=...; Domain=.example.com

# 尽量这样（只有当前主机能读）
Set-Cookie: session=...; Secure; HttpOnly; SameSite=Lax
```

**不写 `Domain` 属性时，Cookie 默认只对当前主机生效**——子域名被接管也偷不到主站会话。只有在确实需要跨子域共享登录时才放宽，并且清楚自己在承担什么。

**别用通配白名单**。CORS 与 CSP 里少写 `*.example.com`，改成明确列出的几个主机名。

## 小结

- 成因极简单：**删了云资源、忘了删 DNS**。
- 后果不止「页面被挂」：可偷 Cookie、绕过 CORS/CSP 白名单、高可信钓鱼、拖垮域名信誉。
- 自查从 **CT 日志**挖子域名最有效；返回服务商的「资源不存在」页是强信号。
- 正确顺序是 **先删 DNS、后释放资源**；长期靠定时扫描 + 收紧 Cookie 作用域。

下一章讲证书本身。👉 [TLS 与证书管理](/manual/computer-programming/web-security/tls-and-certs)
