---
title: "DNS 加固：DNSSEC 与 CAA"
description: "DNS 明文、无认证，天生可被投毒——DNSSEC 用签名链解决「这条应答是真的吗」，CAA 用一行记录限定谁能给你签证书。附完整验证命令与常见配错。"
source: "https://daiw.org/manual/web-security/dns-hardening"
---

# DNS 加固：DNSSEC 与 CAA

DNS 明文、无认证，天生可被投毒——DNSSEC 用签名链解决「这条应答是真的吗」，CAA 用一行记录限定谁能给你签证书。附完整验证命令与常见配错。

DNS 是互联网最老的协议之一，设计时**没考虑任何安全**：明文传输、无来源认证、谁抢先应答谁赢。这一章讲两个能直接配上的加固项。

## 问题：DNS 应答是可以伪造的

递归解析器问权威服务器「example.com 的 A 记录是什么」，权威回一个 UDP 包。**任何能抢在真应答之前伪造一个包的人，都能让解析器缓存一个假 IP**——这就是缓存投毒。

投毒成功后，用户输入正确的域名，连到攻击者的服务器，**浏览器地址栏完全正常**。唯一的破绽是 HTTPS：攻击者没有你的证书。所以现实中的投毒往往配合降级或钓鱼页使用。

## DNSSEC：给应答签名

DNSSEC 给每条记录加数字签名，形成一条从根域到你的域的**信任链**：

```
根（.） → 顶级域（.com） → 你的域（example.com）
每一层用自己的密钥签下一层的密钥指纹（DS 记录）
```

解析器逐级验签，任何一环对不上就拒绝这个应答。

**开启方式**（各家控制台位置不同，逻辑一致）：

1. 在 DNS 托管商处启用 DNSSEC，它会生成 DNSKEY 并给你一段 **DS 记录**。
2. 把这段 DS 记录填到**注册商**那边（注意：是注册商，不是 DNS 托管商）。
3. 等待 TTL 生效。

**验证**：

```bash
# 看 DS 记录是否已在父域发布
dig +short DS example.com

# 完整验签（ad 标志出现表示 Authenticated Data，验签通过）
dig +dnssec +multi example.com A | grep -E "flags:|RRSIG"
```

看到 `flags: qr rd ra ad` 里的 **`ad`**，说明验签成功。

::: warning
**DNSSEC 配错会让域名整个解析失败，比不配更危险。** 最典型的翻车：**换 DNS 服务商时忘了同步更新 DS 记录**——新服务商的密钥和注册商那边登记的 DS 对不上，所有开启验证的解析器会直接拒绝解析，你的域名对一部分用户彻底消失。

换 DNS 服务商的正确顺序：先在注册商处**移除 DS 记录**、等旧 TTL 过期、再切服务商、最后重新发布新的 DS。别图省事一步到位。
:::

**要清楚 DNSSEC 不解决什么**：

- 不加密（DNS 查询内容仍然明文可见，那是 DoH/DoT 的事）。
- 不防止「攻击者登录你的后台改了记录」——那种改动是**合法签名**的。
- 覆盖率有限：不是所有递归解析器都验签。

## CAA：限定谁能给你签证书

这是一条**性价比极高**的记录，一行就能挡掉一整类攻击。

**背景**：公共 CA 有几百家，理论上**任何一家**都能给 `example.com` 签发证书。历史上多次发生 CA 被攻破或误签，攻击者拿到一张合法证书，就能做中间人而浏览器不报警。

CAA 记录告诉所有 CA：**只有我列出的这几家可以给我签**。

```text
example.com.  IN  CAA  0 issue "letsencrypt.org"
example.com.  IN  CAA  0 issue "digicert.com"
example.com.  IN  CAA  0 issuewild ";"
example.com.  IN  CAA  0 iodef "mailto:security@example.com"
```

逐行解释：

| 行 | 含义 |
| --- | --- |
| `issue "letsencrypt.org"` | 允许 Let's Encrypt 签发普通证书 |
| `issue "digicert.com"` | 也允许 DigiCert（多写几家备用，避免换 CA 时被自己卡住） |
| `issuewild ";"` | **禁止任何人签发泛域名证书**（`;` 表示禁止）。如果你不用泛域名，这一行务必加上 |
| `iodef "mailto:..."` | 有 CA 收到不合规申请时，往这个地址报告 |

**验证**：

```bash
dig +short CAA example.com
```

**申请证书前先自查**，避免配了 CAA 反而把自己的续期卡死：

```bash
# 确认你正在用的 CA 在允许列表里
dig +short CAA example.com | grep -i "你的CA域名"
```

::: info
**CAA 是继承的。** 查 `blog.example.com` 时，如果它自己没有 CAA 记录，CA 会向上查 `example.com`。所以在**根域**配一次，通常就覆盖了全部子域——这也意味着，如果某个子域需要用别的 CA，得单独给它配一条更宽松的记录。
:::

## 其它几条值得顺手做的

**一、关掉区域传送（AXFR）。** 配错的权威服务器会把整个区域文件给任何人，等于把你的内网结构、测试环境域名全交出去：

```bash
# 自查:应该返回 "Transfer failed" 之类的拒绝
dig AXFR example.com @你的权威服务器
```

**二、SPF / DKIM / DMARC。** 即使你不发邮件，也要配——**防止别人冒用你的域名发钓鱼邮件**：

```text
; 明确声明「本域名不发邮件」
example.com.       IN  TXT  "v=spf1 -all"
_dmarc.example.com. IN TXT  "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"
```

这两行对纯网站域名尤其重要。不配的话，任何人都能伪造 `noreply@example.com` 发钓鱼信，收信方无从判断真伪，最后砸的是你的品牌。

**三、TTL 别设太长。** 应急切换时，TTL 就是你的最小恢复时间。核心记录建议 300~600 秒；准备做变更前提前调低。

**四、清理僵尸记录。** 指向已下线服务的 CNAME 是子域名接管的温床——[下一章](/manual/computer-programming/web-security/subdomain-takeover)专讲这个。

## 一次性自查

```bash
D=example.com
echo "── NS ──";        dig +short NS    $D
echo "── DS ──";        dig +short DS    $D
echo "── CAA ──";       dig +short CAA   $D
echo "── SPF ──";       dig +short TXT   $D | grep -i spf
echo "── DMARC ──";     dig +short TXT _dmarc.$D
echo "── DNSSEC ad ──"; dig +dnssec $D A | grep -o "flags:[^;]*"
```

## 小结

- DNS 天生无认证，**DNSSEC 用签名链解决来源可信**，但不加密、也管不住「后台被登录后的合法改动」。
- **换 DNS 服务商时 DS 记录不同步，会让域名整体解析失败**——比不开 DNSSEC 更危险，务必按顺序操作。
- **CAA 一行记录挡掉「任意 CA 误签」这一整类风险**，不用泛域名的话记得 `issuewild ";"`。
- 不发邮件的域名也要配 SPF/DMARC，否则会被拿去发钓鱼。

下一章讲一个几乎每个稍大点的组织都中过招的洞。👉 [子域名接管](/manual/computer-programming/web-security/subdomain-takeover)
