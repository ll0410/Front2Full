---
title: "WAF：能挡什么，挡不了什么"
description: "WAF 是买来争取修补时间的，不是买来替代修补的。它对哪类漏洞有效、常见绕过手法长什么样、怎么从观察模式安全地上线，以及为什么虚拟补丁才是它最大的价值。"
source: "https://daiw.org/manual/web-security/waf"
---

# WAF：能挡什么，挡不了什么

WAF 是买来争取修补时间的，不是买来替代修补的。它对哪类漏洞有效、常见绕过手法长什么样、怎么从观察模式安全地上线，以及为什么虚拟补丁才是它最大的价值。

WAF（Web 应用防火墙）是安全产品里最容易被误解的一个。销售话术是「一键防御 OWASP Top 10」，而真实定位是：

> **WAF 是一层基于模式匹配的过滤器。它能大幅提高攻击成本，但对抗一个了解你系统的人时，它会被绕过。**

摆正预期，它就很有用；把它当银弹，它就是安慰剂。

## 它擅长什么

| 场景 | 效果 | 为什么 |
| --- | --- | --- |
| **挡自动化扫描** | ⭐⭐⭐⭐⭐ | 扫描器用的是通用 payload，特征明显。**这是 WAF 最大的实战价值** |
| **虚拟补丁** | ⭐⭐⭐⭐⭐ | 某个组件爆 0day，你还没法立刻升级——先用 WAF 规则挡住利用路径 |
| **已知 CVE 利用** | ⭐⭐⭐⭐ | 公开 exp 的特征稳定 |
| **限流 / 地域封禁 / Bot 管理** | ⭐⭐⭐⭐ | 这些本来就是边缘层该做的 |
| **通用 SQL 注入 / XSS** | ⭐⭐⭐ | 拦得住教科书 payload，拦不住有心人 |
| **业务逻辑漏洞** | ⭐ | **完全无效** |

::: info
**虚拟补丁是 WAF 最被低估的用途。** 假设某天你依赖的框架爆出 RCE，官方补丁还要三天，而升级本身还要回归测试一周。这一周你怎么办？

在 WAF 上加一条针对该漏洞利用特征的规则，把窗口期堵上。**它买的不是「永久安全」，是「几天时间」**——而在应急场景里，几天时间非常值钱。
:::

## 它挡不了什么

这一节比上一节重要。

### 一、业务逻辑漏洞

```
GET /api/orders/10086   ← 这是别人的订单，但你没做归属校验
```

这个请求**完全合法**：没有特殊字符、没有畸形语法、来自已登录的正常用户。WAF 凭什么拦？它不知道 10086 号订单该属于谁。

**越权（IDOR）是实战中命中率最高的一类漏洞，而 WAF 对它零作用。**同理：优惠券叠加、负数金额、并发下单超卖、修改价格参数——全部是「合法请求 + 错误逻辑」。

### 二、加密/编码后的载荷

请求体是加密的、或者用了 protobuf、或者是你自定义的二进制格式——WAF 看不懂，只能放行。

### 三、绕过

WAF 靠模式匹配，而 HTTP 和 SQL 的表达方式极其丰富。常见绕过思路：

| 手法 | 例子 |
| --- | --- |
| 大小写混合 | `SeLeCt` |
| 注释分割 | `SEL/**/ECT`、`UNI/**/ON` |
| 编码 | URL 双重编码、Unicode、HTML 实体 |
| 等价替换 | `OR 1=1` → `OR 'a'='a'` → `||1` |
| 参数污染 | `?id=1&id=2`，WAF 看第一个、后端取最后一个 |
| 超长请求 | 很多 WAF 只检查前 N KB，把 payload 塞到后面 |
| 分块传输 | `Transfer-Encoding: chunked` 打散关键字 |

::: warning
**不要把绕过难度当成安全边界。** 上面这些手法在公开工具里都是内置选项，不需要任何创造力。WAF 挡住的是「不针对你的自动化流量」，一旦有人专门研究你的站，绕过只是时间问题。

**正确的心态：WAF 后面那行代码，必须假设 WAF 不存在。**
:::

## 怎么安全地上线

WAF 最现实的风险不是被绕过，而是**误杀正常业务**。一条过于激进的 SQL 注入规则，可能把用户发的一条包含 `' or '` 的评论拦下来，或者把富文本编辑器的内容判成 XSS。

**分三阶段，别跳步**：

### 阶段一：观察模式（至少一到两周）

只记录不拦截。用 ModSecurity 的话：

```apache
# 先只检测，把命中都写进日志
SecRuleEngine DetectionOnly
SecAuditEngine RelevantOnly
SecAuditLog /var/log/modsec_audit.log
```

这段时间的任务是**收集误报**。重点看：富文本提交、搜索框、代码片段分享、含特殊字符的用户名——这几类最容易触发规则。

### 阶段二：调规则

针对误报做精确豁免，**而不是整条规则关掉**：

```apache
# 只在这个 URI 的这个参数上关掉某条规则，其它地方仍然生效
SecRule REQUEST_URI "@beginsWith /api/article/content" \
    "id:1001,phase:1,pass,nolog,ctl:ruleRemoveTargetById=942100;ARGS:body"
```

**关键是「最小豁免」**：关掉的范围越小越好。见过太多人图省事，一遇误报就把整个规则集降级，最后 WAF 只剩装饰作用。

### 阶段三：逐步开启拦截

```apache
SecRuleEngine On
```

先从高置信度的规则开始（已知 CVE 利用、明显的命令注入），通用规则放到最后。开启后继续盯误报率。

## 一个实用的自建方案

不想上商业 WAF 的话，Nginx + ModSecurity + OWASP CRS 是成熟组合：

```nginx
load_module modules/ngx_http_modsecurity_module.so;

server {
    modsecurity on;
    modsecurity_rules_file /etc/nginx/modsec/main.conf;
}
```

```apache
# /etc/nginx/modsec/main.conf
Include /etc/nginx/modsec/modsecurity.conf
Include /etc/nginx/modsec/owasp-crs/crs-setup.conf
Include /etc/nginx/modsec/owasp-crs/rules/*.conf

# 异常评分阈值:数字越小越严格。5 起步偏严，10 较宽松
SecAction "id:900110,phase:1,pass,nolog,\
  setvar:tx.inbound_anomaly_score_threshold=10,\
  setvar:tx.outbound_anomaly_score_threshold=8"

# 请求体检查上限——超过这个大小的部分不检查，注意这本身就是个绕过点
SecRequestBodyLimit 13107200
SecRequestBodyNoFilesLimit 131072
```

**CRS 的异常评分机制**值得理解：每条规则命中会加分，累计超过阈值才拦截。这比「命中一条就拦」误报低得多——单个可疑特征可能是正常内容，但同时命中五条就很可疑了。

即使不上 ModSecurity，**几条 Nginx 原生规则也能挡掉大量扫描流量**：

```nginx
# 挡掉对敏感路径的探测（这些请求 100% 是扫描器）
location ~* /\.(git|env|svn|hg)(/|$) { return 404; }
location ~* /(wp-admin|wp-login|xmlrpc)\.php { return 404; }
location ~* \.(bak|old|sql|zip|tar\.gz|log)$ { return 404; }

# 挡掉空 UA 与已知扫描器（注意:UA 可伪造，这只是降噪）
if ($http_user_agent ~* (sqlmap|nikto|nmap|masscan|acunetix|nessus)) { return 403; }
if ($http_user_agent = "") { return 403; }
```

::: info
**最后这几条的价值主要是「降噪」**，不是安全边界——UA 随便改。但它能让你的日志干净很多，真正的异常才看得出来。这和[日志与检测那一章](/manual/computer-programming/web-security/logging-and-detection)是配套的：**噪音降下去，信号才浮得上来。**
:::

## 验证 WAF 在工作

```bash
# 一个人畜无害的测试 payload，应该被拦（返回 403）
curl -s -o /dev/null -w "%{http_code}\n" "https://example.com/?test=<script>alert(1)</script>"

# 敏感路径探测，应该 404
curl -s -o /dev/null -w "%{http_code}\n" "https://example.com/.env"
curl -s -o /dev/null -w "%{http_code}\n" "https://example.com/.git/config"
```

**只在自己的站点上执行这类测试。**

## 小结

- WAF 的真实价值是**挡自动化扫描**和**虚拟补丁争取时间**，不是替代修漏洞。
- 它对**业务逻辑漏洞（尤其越权）完全无效**，而那恰恰是实战命中率最高的一类。
- 绕过手法是公开工具的内置选项，**WAF 后面的代码必须假设 WAF 不存在**。
- 上线走「观察 → 调规则 → 拦截」三阶段，误报要**最小范围豁免**，别整条关掉。
- 几条 Nginx 原生规则挡敏感路径探测，性价比极高。

第二部分结束。下一部分进到 Nginx 本身。👉 [Nginx 加固基线](/manual/computer-programming/web-security/nginx-baseline)
