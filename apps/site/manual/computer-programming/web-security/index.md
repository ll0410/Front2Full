---
title: "序 · 安全不是一个功能，是一条链"
description: "沿着一次 HTTP 请求的完整旅程，逐层拆解网站安全——域名与 DNS、CDN 与负载均衡、Nginx、前端、后端、依赖组件、架构与运维，每一层讲清真实的攻击手法、可复制的配置与能立刻上手的验证命令。"
source: "https://daiw.org/manual/web-security"
---

# 序 · 安全不是一个功能，是一条链

> 内容来源：[daiw.org](https://daiw.org/manual/web-security) · 作者 David · 原文更新于 2026-08-11

沿着一次 HTTP 请求的完整旅程，逐层拆解网站安全——域名与 DNS、CDN 与负载均衡、Nginx、前端、后端、依赖组件、架构与运维，每一层讲清真实的攻击手法、可复制的配置与能立刻上手的验证命令。

大多数「网站安全」的资料有个共同毛病：**它们是按漏洞名称组织的**。XSS 一章、SQL 注入一章、CSRF 一章，读完你记住了一堆名词，但面对自己那套「域名 + CDN + Nginx + Next.js + Postgres + 一堆 npm 包」的真实系统，仍然不知道该从哪儿下手。

这个专栏换个组织方式：**按请求经过的层来走**。

因为攻击者就是这么找路的。他不会先想「我要打 XSS」，他会先看你的域名解析到哪、CDN 后面的源站 IP 露没露、Nginx 版本号在不在响应头里、有没有哪个子域名指向一个已经废弃的 S3 桶。**哪一层最松，他就从哪一层进。**

::: info
**本专栏面向的是防守方。** 每一篇的结构是固定的：先讲**这个位置为什么会出问题**（原理），再给**一个真实可复现的攻击场景**（知道长什么样才认得出来），最后是**可以直接抄走的配置与验证命令**（改完怎么确认真的生效）。

所有攻击示例都以「打你自己的系统、验证自己的防线」为目的。请只在你有权限测试的系统上执行。
:::

## 一条链，七个环节

| 层 | 典型问题 | 一句话概括 |
| --- | --- | --- |
| **域名与 DNS** | 注册商账号被撞、子域名接管、证书错发 | 打到这一层，后面所有防御全部作废 |
| **边缘（CDN / ALB）** | 源站 IP 裸奔、限流缺失、WAF 形同虚设 | 挡得住的和挡不住的，要分清楚 |
| **Nginx** | 一个少写的斜杠导致路径穿越、请求走私 | 配置文件里的坑比软件漏洞更常见 |
| **前端** | XSS、CSRF、第三方脚本失控 | 代码跑在攻击者的机器上，任何前端校验都只是体验 |
| **后端** | 注入、越权、SSRF、文件上传 | 越权（IDOR）是实战中命中率最高的一类 |
| **组件依赖** | 已知 CVE、供应链投毒 | 你的代码只占产物的很小一部分 |
| **架构与运维** | 权限过大、无日志、无预案 | 前六层都会被突破，这一层决定损失多大 |

## 三条贯穿全书的原则

**一、纵深防御：任何单点都会失守。**
不要问「这道防线够不够」，要问「这道破了还剩什么」。CSP 挡不住所有 XSS，但它能把一个「盗取 Cookie」降级成「什么也偷不走」。

**二、默认拒绝优于逐个封堵。**
黑名单永远漏。「只允许这几个字符」比「禁止这几个字符」强一个量级——[注入那一章](/manual/computer-programming/web-security/injection)会用具体例子说明为什么。

**三、改完必须验证。**
本专栏每一篇都给验证命令。**「我加了那个响应头」和「那个响应头确实出现在线上响应里」是两件事**，中间隔着 CDN 缓存、反代覆盖、配置未 reload 等一堆现实。

## 这个专栏怎么走

**第 0 部分 · 先建立框架** —— 威胁建模（你在防谁）、一次请求的完整旅程（攻击面在哪）。

**第 1 部分 · 域名与 DNS** —— 注册商账号、DNS 加固（DNSSEC / CAA）、子域名接管、证书与 CT 日志监控。

**第 2 部分 · 边缘** —— 源站暴露（CDN 最常见的失效方式）、DDoS 与限流、WAF 的能力边界。

**第 3 部分 · Nginx** —— 加固基线、配置陷阱（`alias` 路径穿越等）、HTTP 请求走私。

**第 4 部分 · 前端** —— XSS 三种形态、CSP 落地路径、CSRF 与 SameSite、安全响应头、第三方脚本与 SRI。

**第 5 部分 · 后端** —— 注入、认证、授权、SSRF、文件上传、密钥管理。

**第 6 部分 · 组件与依赖** —— 依赖审计与可达性分析、容器与镜像安全。

**第 7 部分 · 架构与运维** —— 纵深防御与最小权限、日志与检测、应急响应。

**收尾** —— 一份可以逐条打勾的上线安全检查清单。

## 读之前

不需要任何安全背景，但你最好**手上真有一个网站**——哪怕是个人博客。本专栏的验证命令都是拿来对着真实站点跑的，光看不练收获会少一大半。

涉及协议细节时会引用本站的 [《HTTP/1.1 详解》](/manual/computer-programming/http11/) 与 [《HTTP/2 与 HTTP/3》](/manual/computer-programming/http2-3/)，Nginx 配置部分与 [《Nginx 详解》](https://daiw.org/manual/nginx) 互补——那个专栏讲怎么用，这里讲怎么别用错。

从头开始：[威胁建模：你到底在防谁](/manual/computer-programming/web-security/threat-model)。

## 本专栏篇目

- [网站安全一本通](/manual/computer-programming/web-security/): 沿着一次 HTTP 请求的完整旅程，逐层拆解网站安全——域名与 DNS、CDN 与负载均衡、Nginx、前端、后端、依赖组件、架构与运维，每一层讲清真实的攻击手法、可复制的配置与能立刻上手的验证命令。

### 第 0 部分 · 先建立框架

- [威胁建模：你到底在防谁](/manual/computer-programming/web-security/threat-model): 不做威胁建模的安全工作是在拜神——四类攻击者的动机与手法截然不同，防住脚本小子的措施对定向攻击毫无意义。用一张表把「防谁、护什么、丢了多疼」问清楚。
- [一次请求的旅程](/manual/computer-programming/web-security/request-journey): 用户在地址栏敲下回车到页面渲染，中间经过 DNS、CDN、负载均衡、Nginx、应用、数据库六道关卡——每一道都能被做手脚。这一章画出完整攻击面地图，后面每一章各拆一段。

### 第 1 部分 · 域名与 DNS

- [注册商与域名账号安全](/manual/computer-programming/web-security/registrar-security): 域名被劫持是唯一能让你所有技术防线一次性归零的攻击——注册商账号怎么被打下来、域名锁是什么、转移锁与 DNSSEC 怎么配，以及一份 10 分钟能做完的加固清单。
- [DNS 加固：DNSSEC 与 CAA](/manual/computer-programming/web-security/dns-hardening): DNS 明文、无认证，天生可被投毒——DNSSEC 用签名链解决「这条应答是真的吗」，CAA 用一行记录限定谁能给你签证书。附完整验证命令与常见配错。
- [子域名接管](/manual/computer-programming/web-security/subdomain-takeover): 一条指向已删除云资源的 CNAME，攻击者花几分钟就能把子域名变成自己的——为什么它能绕过同源策略偷走主站 Cookie，怎么批量自查，以及正确的下线顺序。
- [TLS 与证书管理](/manual/computer-programming/web-security/tls-and-certs): 证书过期是最常见的「安全事故」，错发是最危险的——协议与套件怎么收敛、HSTS 怎么上才不会把自己锁死、CT 日志监控怎么发现别人给你的域名签了证书。

### 第 2 部分 · 边缘：CDN 与负载均衡

- [源站暴露：CDN 最常见的失效方式](/manual/computer-programming/web-security/origin-exposure): 你的 WAF、限流、DDoS 防护全在 CDN 上——而攻击者只要拿到源站 IP 就能全部绕过。源站 IP 从哪些地方泄露，以及唯一真正有效的对策：在源站上做回源鉴权。
- [DDoS 与限流](/manual/computer-programming/web-security/ddos-and-ratelimit): 网络层洪水和应用层慢刀是两回事，防法也完全不同。Nginx 限流的三个模块怎么配才不误伤、按什么维度限、以及为什么「按 IP 限流」在移动网络下会伤到真实用户。
- [WAF：能挡什么，挡不了什么](/manual/computer-programming/web-security/waf): WAF 是买来争取修补时间的，不是买来替代修补的。它对哪类漏洞有效、常见绕过手法长什么样、怎么从观察模式安全地上线，以及为什么虚拟补丁才是它最大的价值。

### 第 3 部分 · Nginx

- [Nginx 加固基线](/manual/computer-programming/web-security/nginx-baseline): 一份可以直接抄走的 Nginx 安全基线配置——隐藏版本、默认服务器块拒绝未知 Host、敏感路径封堵、上传与超时限制、代理头处理，每一条都说明为什么。
- [Nginx 配置陷阱](/manual/computer-programming/web-security/nginx-pitfalls): alias 少一个斜杠导致路径穿越、location 匹配优先级搞错让防护规则失效、merge_slashes 与 URL 解码差异绕过鉴权——五个真实的、每次出现都是高危的配置错误。
- [HTTP 请求走私](/manual/computer-programming/web-security/request-smuggling): 前端代理和后端服务器对「这个请求到哪结束」理解不一致，攻击者就能把一个请求藏进另一个里面——CL.TE 与 TE.CL 两种经典形态、它能造成什么后果，以及为什么 HTTP/2 端到端是最彻底的解法。

### 第 4 部分 · 前端

- [XSS：三种形态与真实防御](/manual/computer-programming/web-security/xss): 反射型、存储型、DOM 型各自怎么发生，为什么「过滤尖括号」是错的防御思路，以及按输出上下文选择转义方式——附一个富文本场景的完整处理方案。
- [CSP：从报告模式到严格模式](/manual/computer-programming/web-security/csp): 白名单式 CSP 早已被证明容易绕过——基于 nonce 与 strict-dynamic 的严格 CSP 才是现代答案。附完整的四阶段落地路径、Next.js 实现和常见踩坑。
- [CSRF 与 SameSite](/manual/computer-programming/web-security/csrf): 浏览器自动带 Cookie 是 CSRF 的根因——SameSite 默认值改变后哪些场景仍然有风险、双提交与同步器令牌怎么选、以及为什么「只用 JSON 就安全了」是个危险的误解。
- [安全响应头](/manual/computer-programming/web-security/security-headers): 一份逐条讲清「挡什么、怎么配、有什么代价」的响应头清单——点击劫持、MIME 嗅探、Referer 泄露、跨源隔离，以及那些已经过时不该再配的头。
- [前端供应链](/manual/computer-programming/web-security/frontend-supply-chain): 你页面上的第三方脚本拥有和你自己代码完全相同的权限——SRI 怎么用、为什么它对统计脚本不适用、以及用沙箱 iframe 和 CSP 把第三方关进笼子的实际做法。

### 第 5 部分 · 后端

- [注入：一个根因，多种形态](/manual/computer-programming/web-security/injection): SQL、NoSQL、命令、模板、LDAP 注入共享同一个根因——数据被当成了代码。为什么参数化优于转义、ORM 也能被注入、以及那些看起来不能参数化的地方（表名、排序）怎么办。
- [认证：密码、会话与多因素](/manual/computer-programming/web-security/authn): 密码怎么存、登录接口怎么防撞库而不误伤真人、会话 token 用 Cookie 还是 JWT、为什么「记住我」和密码重置是两个最常被打穿的地方。
- [授权：越权与 IDOR](/manual/computer-programming/web-security/authz): 实战中命中率最高、WAF 完全无效、扫描器基本扫不出来的一类漏洞——水平越权与垂直越权的真实场景，以及为什么「默认拒绝 + 在数据层强制归属」才是可靠的架构。
- [SSRF：让服务器替攻击者发请求](/manual/computer-programming/web-security/ssrf): 云环境里 SSRF 常常直接等于凭据泄露——元数据服务为什么是首要目标、为什么「黑名单过滤内网 IP」必然被绕过、以及唯一可靠的解法：出网代理 + 网络隔离。
- [文件上传](/manual/computer-programming/web-security/file-upload): 上传功能的防御是一条链，任何单点都会被绕过——扩展名、MIME、魔数各自能被怎么骗，以及真正可靠的四条：随机文件名、独立域名、禁止执行、内容重编码。
- [密钥与凭据管理](/manual/computer-programming/web-security/secrets): 密钥进了 git 就等于泄露，删文件没用——历史里还在。这一章讲泄露的常见路径、扫描与拦截、正确的存放方式、以及一份「泄露之后按什么顺序做」的处置流程。

### 第 6 部分 · 组件与依赖

- [依赖审计](/manual/computer-programming/web-security/dependency-audit): 你的代码只占产物的一小部分——audit 报告怎么从「28 条告警」读成「哪几条真能被打到」，可达性分析怎么做，以及被上游锁死版本时用 overrides 的正确姿势。
- [容器与镜像安全](/manual/computer-programming/web-security/container-security): 容器不是安全边界——非 root 运行、只读根文件系统、能力裁剪、镜像瘦身与扫描，以及那些会让容器逃逸变得轻而易举的配置（挂 docker.sock、privileged）。

### 第 7 部分 · 架构与运维

- [纵深防御与最小权限](/manual/computer-programming/web-security/defense-in-depth): 前面每一层都会被突破——这一章讲怎么让「被突破」不等于「全线崩溃」：爆炸半径怎么算、失败要往安全的方向倒、以及最小权限在数据库、云、网络三处的具体落法。
- [日志、监控与检测](/manual/computer-programming/web-security/logging-and-detection): 大多数入侵不是被技术手段发现的，是被用户投诉发现的——该记什么、绝不能记什么、几条能立刻上手的检测规则，以及日志本身怎么防篡改。
- [应急响应](/manual/computer-programming/web-security/incident-response): 出事时最贵的是犹豫——一份可以照着执行的六阶段流程、「先取证还是先断网」这个经典两难怎么判、以及个人站也能提前十分钟准备好的应急包。

### 收尾

- [上线安全检查清单](/manual/computer-programming/web-security/checklist): 把全专栏的结论压成一份可以逐条打勾的清单——按「今天就做」「这周做」「有余力再做」分三档，附一段可以直接跑的外部体检脚本。
