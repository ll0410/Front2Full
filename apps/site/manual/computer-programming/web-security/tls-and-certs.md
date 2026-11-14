---
title: "TLS 与证书管理"
description: "证书过期是最常见的「安全事故」，错发是最危险的——协议与套件怎么收敛、HSTS 怎么上才不会把自己锁死、CT 日志监控怎么发现别人给你的域名签了证书。"
source: "https://daiw.org/manual/web-security/tls-and-certs"
---

# TLS 与证书管理

证书过期是最常见的「安全事故」，错发是最危险的——协议与套件怎么收敛、HSTS 怎么上才不会把自己锁死、CT 日志监控怎么发现别人给你的域名签了证书。

这一章分两半：**配置**（协议、套件、HSTS）和**运维**（过期、错发、监控）。经验上，后一半造成的真实事故远多于前一半。

## 一、协议与套件：该关的关掉

现代基线很简单——**只留 TLS 1.2 与 1.3**：

```nginx
ssl_protocols TLSv1.2 TLSv1.3;

# TLS 1.2 的套件白名单（1.3 的套件不可配置，且默认就是安全的）
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_prefer_server_ciphers off;

# 会话复用，降低握手开销
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;

# OCSP stapling：由服务器代取吊销状态，省一次客户端外呼
ssl_stapling on;
ssl_stapling_verify on;
resolver 1.1.1.1 8.8.8.8 valid=300s;
```

几点说明：

- **`ssl_prefer_server_ciphers off`** 是现代建议。客户端（尤其移动端）更清楚自己在什么硬件上跑得快，让它选。
- **`ssl_session_tickets off`**：session ticket 的密钥如果不轮换，会破坏前向保密。除非你有轮换机制，否则关掉。
- **禁用 TLS 1.0/1.1** 是合规硬要求（PCI DSS 等），且它们确实有已知弱点。
- **关于 OCSP Stapling**：Let's Encrypt 已于 2025 年全面停用 OCSP（转而依赖 CRL 与短期证书），其签发的证书不再包含 OCSP URL；若使用 Let's Encrypt 证书，Nginx 会忽略 `ssl_stapling`（或日志提示无 OCSP URL），无需担心。

**验证**：

```bash
# 确认 1.0/1.1 已被拒绝（应该失败）
openssl s_client -connect example.com:443 -tls1_1 </dev/null 2>&1 | grep -i "protocol\|alert"

# 确认 1.3 可用
openssl s_client -connect example.com:443 -tls1_3 </dev/null 2>&1 | grep -i "protocol"
```

## 二、HSTS：小心别把自己锁死

HSTS 告诉浏览器「以后只准用 HTTPS 访问我」，能防降级和 SSL 剥离：

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

::: warning
**`includeSubDomains` 和 `preload` 是两个能把你锁死的开关，上之前想清楚。**

- **`includeSubDomains`**：所有子域名都必须支持 HTTPS。如果你有某个内部子域还在跑 HTTP（很常见），它会立刻不可访问，而且**用户浏览器已经记住了，你改回来也没用，得等 `max-age` 过期**。
- **`preload`**：把域名提交进浏览器内置的预加载列表。这个列表**编译进浏览器**，移除申请要走流程、生效要等版本发布，周期以**月**计。

**稳妥的上线路径**：先 `max-age=300` 跑一周 → 确认所有子域名都是 HTTPS → 调到 `max-age=31536000` → 稳定运行一段时间 → 再考虑 `includeSubDomains` → 最后才是 `preload`。**不要一步到位。**
:::

注意末尾的 `always`——不加的话，Nginx 在返回 4xx/5xx 时**不会带上这个头**，而错误页恰恰是常被访问的路径。

## 三、过期：最常见的「安全事故」

说出来不好听，但真相是：**过去十年里，因证书过期造成的服务中断，远多于因证书被攻破造成的损失。**

自动化是唯一解，但自动化本身也会静默失效。尤其随着 CA/Browser Forum 推进证书有效期缩短时间表（最大有效期已从 398 天起自 2026 年 3 月缩短至 **200 天**，并将于 2027 年缩至 100 天、2029 年缩至 47 天；Let's Encrypt 等 CA 还推出了 6 天短期证书与 ARI 自动续期信息扩展），人工干预窗口正大幅收窄，因此必须做到**双保险：自动续期 + 独立监控**。

```bash
# 独立于续期工具的过期检查（关键是「独立」——续期工具挂了它还在）
DAYS=$(( ( $(date -d "$(echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null \
  | openssl x509 -noout -enddate | cut -d= -f2)" +%s) - $(date +%s) ) / 86400 ))
echo "证书还有 ${DAYS} 天过期"
[ "$DAYS" -lt 21 ] && echo "⚠️ 该续期了"
```

::: info
**为什么监控必须独立于续期工具？** 因为最常见的翻车不是「没配自动续期」，而是**配了但静默失败**：ACME 校验路径被新加的 Nginx 规则挡了、DNS 插件的 API token 过期了、磁盘满了写不进新证书……续期工具在角落里安静地失败了几十次，而你毫不知情，直到某天早上电话被打爆。

**续期工具的成功日志不算监控，从外部实际连一次 443 拿到的到期时间才算。**
:::

## 四、错发与 CT 日志监控

**错发**是指某个 CA 给你的域名签了一张证书，但申请人不是你。历史上因 CA 被攻破、验证流程被绕过而发生过多次。

防御分两层：

**第一层：CAA 记录**（[上一章](/manual/computer-programming/web-security/dns-hardening)讲过）——限定只有指定 CA 能签。

**第二层：CT 日志监控**——所有公开信任的证书都必须记入**证书透明日志**（Certificate Transparency），这是浏览器的硬要求。于是你可以反过来利用它：**盯着日志，一旦出现你没申请过的证书，立刻就知道有人在搞事。**

```bash
# 列出最近为你的域名签发的全部证书
curl -s "https://crt.sh/?q=%25.example.com&output=json" \
  | jq -r '.[] | "\(.not_before[0:10])  \(.issuer_name | split("O=")[1] | split(",")[0])  \(.name_value)"' \
  | sort -u | tail -20
```

把它做成定时任务，**和你自己的签发记录比对**，出现不认识的就告警。免费的商业服务（如各家的 CT 监控）也能做这件事，省得自己维护。

**发现错发之后**：联系签发的 CA 申请吊销，同时收紧 CAA。这类事件罕见，但一旦发生，中间人攻击对用户完全无感——**它是少数几个「用户什么都做不了、只能靠你发现」的风险**。

## 五、几个容易忽略的点

**证书链不完整。** 浏览器通常会自动补全中间证书，所以你本地测着没问题；但很多命令行工具、移动端 SDK、老设备不会补——它们那边直接握手失败。

```bash
# verify return code 应为 0；"unable to get local issuer certificate" 就是链不全
echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null \
  | grep -E "Verify return code|verify error"
```

**通配证书的爆炸半径。** 一张 `*.example.com` 的证书私钥泄露，**所有子域名同时沦陷**。子域名多且分布在不同信任级别时（比如既有生产又有测试），宁可签多张单域名证书。

**私钥权限。** 老生常谈但常年翻车：

```bash
chmod 600 /etc/ssl/private/example.com.key
chown root:root /etc/ssl/private/example.com.key
```

**私钥绝不进 git**。已经进了的话，光删文件没用——历史里还在，必须**吊销证书重签**。

## 一次性体检

```bash
D=example.com
echo "── 协议与套件 ──"
echo | openssl s_client -connect $D:443 -servername $D 2>/dev/null | grep -E "Protocol|Cipher"
echo "── 有效期 ──"
echo | openssl s_client -connect $D:443 -servername $D 2>/dev/null | openssl x509 -noout -dates
echo "── 证书链 ──"
echo | openssl s_client -connect $D:443 -servername $D 2>/dev/null | grep "Verify return code"
echo "── HSTS ──"
curl -sSI https://$D/ | grep -i strict-transport
echo "── CAA ──"
dig +short CAA $D
```

## 小结

- 协议收敛到 **TLS 1.2 + 1.3**，套件用现代 AEAD 白名单，`prefer_server_ciphers off`。
- **HSTS 的 `includeSubDomains` 与 `preload` 能把你锁死**，务必分阶段上线。
- **过期造成的事故远多于被攻破**；自动续期之外，必须有一个**从外部实测**的独立监控。
- **CAA 防错发、CT 日志监控发现错发**，两者配套使用。
- 通配证书方便，但爆炸半径是全部子域。

第一部分结束。下一部分往前走一站，到边缘层。👉 [源站暴露：CDN 最常见的失效方式](/manual/computer-programming/web-security/origin-exposure)
