---
title: "源站暴露：CDN 最常见的失效方式"
description: "你的 WAF、限流、DDoS 防护全在 CDN 上——而攻击者只要拿到源站 IP 就能全部绕过。源站 IP 从哪些地方泄露，以及唯一真正有效的对策：在源站上做回源鉴权。"
source: "https://daiw.org/manual/web-security/origin-exposure"
---

# 源站暴露：CDN 最常见的失效方式

你的 WAF、限流、DDoS 防护全在 CDN 上——而攻击者只要拿到源站 IP 就能全部绕过。源站 IP 从哪些地方泄露，以及唯一真正有效的对策：在源站上做回源鉴权。

上了 CDN 之后，人们默认「流量都从 CDN 走」。**这个假设是错的**：CDN 只是 DNS 层面的引导，它拦不住任何一个直接连你源站 IP 的人。

```
理想：用户 → CDN（WAF/限流/缓存） → 源站
现实：攻击者 ─────────────────────→ 源站   ← 你的所有边缘防护归零
```

只要源站 IP 泄露，你在 CDN 上买的一切防护，对这个攻击者而言等于不存在。

## 源站 IP 从哪泄露

比大多数人以为的多得多：

| 泄露渠道 | 说明 |
| --- | --- |
| **历史 DNS 记录** | 上 CDN 之前的 A 记录被各类 DNS 历史库永久收录。**这是头号来源** |
| **子域名** | 主站上了 CDN，但 `mail.`、`ftp.`、`test.`、`dev.` 直连源站 |
| **邮件头** | 从服务器直接发的邮件，`Received` 头里带着源站 IP |
| **CT 日志** | 给源站 IP 或内部域名签过证书 |
| **全网扫描** | Shodan / Censys 按证书指纹、响应特征反查——**你的源站直接返回带域名证书的 443，就会被匹配到** |
| **应用自身泄露** | 报错页、`phpinfo`、`/debug`、探针脚本回显服务器 IP |
| **SSRF** | 通过一个 SSRF 让服务器请求外部地址，从对端日志读到出口 IP |

::: warning
**换 CDN、上 CDN 都不会抹掉历史记录。** 你今天把 A 记录改成 CDN 的 CNAME，昨天那条指向 `1.2.3.4` 的记录已经被多家 DNS 历史数据库抓走，永久留存、公开可查。

这意味着：**如果你的源站曾经裸奔过，那个 IP 就应当被视为已经泄露。** 最彻底的做法是**换一个新 IP**，然后从第一天起就不让它裸露。
:::

## 自查：你的源站藏住了吗

```bash
# 1. 当前解析（应该是 CDN 的地址）
dig +short A example.com

# 2. 常见的直连子域名——挨个看有没有绕过 CDN
for s in mail ftp cpanel webmail direct origin test dev staging admin api old; do
  ip=$(dig +short A $s.example.com | tail -1)
  [ -n "$ip" ] && echo "$s.example.com -> $ip"
done

# 3. 从 CT 日志找出所有申请过证书的名字
curl -s "https://crt.sh/?q=%25.example.com&output=json" | jq -r '.[].name_value' | sort -u
```

拿到可疑 IP 后，验证它是不是你的源站：

```bash
# 直接对 IP 请求，但带上你的域名 Host 头
curl -sSI --resolve example.com:443:1.2.3.4 https://example.com/ | head -5
```

**如果返回了正常的站点响应，说明源站可以被直连——你的 CDN 防护形同虚设。**

## 唯一真正有效的对策：源站只认 CDN

「藏好 IP」是权宜之计，因为 IP 迟早会泄露。**可靠的做法是：即使 IP 泄露了，直连也进不来。**

### 方案 A：防火墙只放行 CDN 回源段（最硬）

各家 CDN 都公布回源 IP 段。只允许这些段访问 80/443：

```bash
# 以 ufw 为例（回源段要从 CDN 厂商的官方接口拉取，并定期更新）
ufw default deny incoming
ufw allow from 198.51.100.0/24 to any port 443 proto tcp
ufw allow from 203.0.113.0/24  to any port 443 proto tcp
ufw allow 22/tcp    # SSH 另外限制来源
ufw enable
```

**关键是「定期更新」**：CDN 的回源段会变，写死一次不管，某天回源段扩容你就 502 了。正确做法是定时从厂商接口拉最新列表并同步防火墙规则。

### 方案 B：回源鉴权（最灵活）

让 CDN 在回源时带一个只有你们俩知道的密钥，源站校验：

```nginx
# CDN 侧配置：回源时添加自定义头 X-Origin-Auth: <随机长字符串>
server {
    listen 443 ssl;
    server_name example.com;

    # 没带正确密钥的一律 403，连日志都不用记正常业务
    if ($http_x_origin_auth != "把这里换成一个长随机串") {
        return 403;
    }
    # ... 正常的 location 配置
}
```

这个头必须是**高熵随机串**，并且**定期轮换**。注意它只在 CDN → 源站这一跳存在，用户永远看不到。

### 方案 C：mTLS（最严格）

源站要求客户端证书，只有持有 CDN 证书的连接才能建立。各大 CDN 都支持（Cloudflare 叫 Authenticated Origin Pulls）。配置略复杂，但**攻击者即使知道 IP 和 Host，也连不上 TLS**。

::: info
**推荐组合：A + B。** 防火墙挡住绝大多数扫描（连端口都摸不到），回源鉴权兜住「回源段内的其它租户」这个盲区——注意方案 A 单独用有个洞：**同一个 CDN 的其它客户也在那些回源段里**，理论上可以借道。加上 B 就补上了。
:::

## 别忘了这些也在裸奔

只堵 443 是不够的，源站上常常还开着：

```bash
# 从外网扫一下自己的源站，看看开了什么不该开的
nmap -Pn -p- --min-rate 1000 1.2.3.4
```

常见的意外暴露：

| 端口 | 服务 | 风险 |
| --- | --- | --- |
| 22 | SSH | 爆破；应限制来源 IP 或改用跳板机 |
| 3306 / 5432 | MySQL / Postgres | **数据库绝不应该对公网开放** |
| 6379 | Redis | 未授权 Redis 是经典的服务器沦陷入口 |
| 2375 | Docker API | 未授权等于直接给 root |
| 9090 / 3000 | Prometheus / Grafana | 泄露内部拓扑与指标 |
| 8080 | 应用直连端口 | 绕过 Nginx 的所有规则 |

**最后一行特别值得注意**：很多人在 Nginx 上配好了一整套安全规则，结果应用自己还在 `0.0.0.0:8080` 上听着。绑定回环即可：

```yaml
# docker-compose：只在回环暴露，由本机的反代访问
ports:
  - '127.0.0.1:3001:3000'
```

## 缓存投毒：边缘层的另一类风险

顺带说一个和 CDN 强相关的问题。如果缓存键（cache key）没算对，攻击者可以让 CDN **缓存一个被污染的响应，然后分发给所有用户**。

典型场景：应用把 `X-Forwarded-Host` 之类的头反射进响应（比如用它拼绝对 URL），而 CDN 的缓存键里不包含这个头：

```
攻击者请求：GET /  加上  X-Forwarded-Host: evil.com
应用响应里：<script src="https://evil.com/app.js">
CDN 缓存了这个响应，之后所有访问 / 的用户都加载了攻击者的脚本
```

**对策**：

- 应用不要信任任何 `X-Forwarded-*` / `X-Host` 类的头去构造 URL，用配置里写死的域名。
- 缓存键要包含所有会影响响应内容的输入；或者反过来，**在边缘剥掉这些不参与缓存键的头**。
- 用 `Vary` 头声明真正影响响应的维度。

## 小结

- **CDN 拦不住直连源站的人**，源站 IP 泄露 = 边缘防护归零。
- 泄露渠道以**历史 DNS 记录**和**未上 CDN 的子域名**为首，且历史记录抹不掉。
- 藏 IP 靠不住，**要让直连本身失败**：防火墙锁回源段（A）+ 回源鉴权（B），推荐组合使用。
- 别只堵 443——数据库、Redis、Docker API、应用直连端口的裸奔更致命。
- 缓存投毒源于「响应内容受某个头影响，但缓存键里没有它」。

下一章讲边缘层真正擅长的事。👉 [DDoS 与限流](/manual/computer-programming/web-security/ddos-and-ratelimit)
