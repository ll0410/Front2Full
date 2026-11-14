---
title: "日志、监控与检测"
description: "大多数入侵不是被技术手段发现的，是被用户投诉发现的——该记什么、绝不能记什么、几条能立刻上手的检测规则，以及日志本身怎么防篡改。"
source: "https://daiw.org/manual/web-security/logging-and-detection"
---

# 日志、监控与检测

大多数入侵不是被技术手段发现的，是被用户投诉发现的——该记什么、绝不能记什么、几条能立刻上手的检测规则，以及日志本身怎么防篡改。

一个行业里反复被验证的事实：

> **入侵从发生到被发现，中位数以「周」甚至「月」计。** 而且相当大比例不是自己发现的，是外部通知的——用户投诉、安全研究者报告、或者数据出现在了公开的泄露库里。

这一章的目标是把这个时间压到「小时」。

## 一、该记什么

### 认证与授权事件（最高优先级）

```javascript
logger.info('auth.login.success', {
  userId, ip, userAgent, sessionId, timestamp: Date.now(),
});
logger.warn('auth.login.failure', {
  emailHash: sha256(email),      // ⚠️ 不记明文邮箱
  ip, userAgent, reason: 'bad_password',
});
logger.warn('authz.denied', {
  userId, resource: '/api/orders/1002', action: 'read', ip,
});
```

**`authz.denied` 特别重要**：一个正常用户几乎不会触发越权拒绝。**短时间内大量 `authz.denied` = 有人在枚举资源 ID**，这是[越权攻击](/manual/computer-programming/web-security/authz)最明显的信号。

### 敏感操作

改密码、改邮箱、改支付信息、导出数据、删除资源、权限变更、API key 生成——**每一条都要记「谁、什么时候、从哪、改了什么（旧值→新值）」**。

这类日志的价值在事后：出事时它是唯一能回答「攻击者做了什么」的东西。

### 请求级日志

```nginx
log_format security escape=json
  '{"time":"$time_iso8601","ip":"$remote_addr","method":"$request_method",'
  '"uri":"$uri","status":$status,"bytes":$body_bytes_sent,'
  '"rt":$request_time,"ua":"$http_user_agent","ref":"$http_referer",'
  '"xff":"$http_x_forwarded_for"}';

access_log /var/log/nginx/access.json security;
```

::: info
**`escape=json` 不能省。** 不加的话，用户可以在 User-Agent 里塞引号和换行，**把你的 JSON 日志格式撑破**——这就是[注入那章](/manual/computer-programming/web-security/injection)提过的日志注入。后果是日志解析器崩溃、或者攻击者伪造出假的日志行掩盖痕迹。

同样注意 `$uri` 与 `$request_uri` 的区别：前者是规范化后的路径，后者是原始的。**做安全分析时你往往需要原始值**，因为攻击特征常常就在编码里。
:::

## 二、绝不能记什么

::: warning
**日志是最常见的「二次泄露」渠道**——它被复制到分析平台、被开发下载排查、被长期归档、权限往往比数据库宽松得多。

**绝对不能进日志：**

- 密码（哪怕是错误的密码尝试——**用户经常把正确密码打错在别的字段里**）
- 完整的会话 token、API key、JWT
- 完整的身份证、银行卡、CVV
- 完整的请求头（`Cookie` 和 `Authorization` 在里面）
- 完整的请求体（可能包含以上任何一项）

**最危险的是「打印整个异常对象」**：

  ```javascript
  // ❌ 很多 HTTP 客户端的异常对象里带着完整的 request，包括 Authorization 头
  logger.error('request failed', err);
  ```

这一行会把你的所有对外 API 密钥定期写进日志。
:::

**脱敏要在写入前做**：

```javascript
const REDACT = ['password', 'token', 'authorization', 'cookie', 'secret',
                'apiKey', 'idCard', 'cardNumber', 'cvv'];

function redact(obj, depth = 0) {
  if (depth > 5 || obj === null || typeof obj !== 'object') return obj;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [
    k,
    REDACT.some(r => k.toLowerCase().includes(r.toLowerCase()))
      ? '[REDACTED]'
      : redact(v, depth + 1),
  ]));
}

logger.info('request', redact(payload));
```

**部分保留是有用的**：手机号存 `138****5678`、邮箱存 `a***@example.com`——既能人工核对，又不构成完整泄露。

## 三、检测规则：从几条高价值的开始

不要一上来就建大而全的规则库。**下面几条覆盖了最常见的攻击模式，而且误报率低。**

### 撞库

```
条件：同一 IP，5 分钟内登录失败 > 20 次，涉及 > 10 个不同账号
含义：几乎必然是撞库
动作：封禁该 IP + 告警
```

关键是「涉及多个不同账号」——一个用户反复输错自己的密码是正常的，**挨个试不同账号就不正常了**。

### 资源枚举（越权探测）

```
条件：同一用户，10 分钟内 authz.denied > 50 次
含义：在遍历不属于自己的资源 ID
动作：告警 + 考虑临时限制该账号
```

**这条价值极高**，因为它检测的正是 WAF 和扫描器都发现不了的越权攻击。

### 异地登录 / 不可能旅行

```
条件：同一账号，两次登录的地理位置相距 > 1000 km，间隔 < 1 小时
含义：账号被共享或被盗
动作：告警 + 要求二次验证
```

注意 VPN 会造成误报，作为「提高验证强度」的触发条件比直接封禁更合适。

### 敏感操作激增

```
条件：单账号 1 小时内导出数据 > 10 次，或读取记录数 > 平时 10 倍
含义：可能正在批量拖数据
动作：告警 + 限流
```

**内部威胁和账号被盗都会命中这条。**

### 出网异常

```
条件：应用服务器向从未访问过的外部 IP 发起连接
含义：可能是数据外带或 C2 通信
动作：告警
```

配合[纵深防御那章](/manual/computer-programming/web-security/defense-in-depth)的出网白名单，这条会更干净。

### 文件变更

```bash
# 用 AIDE / Tripwire 之类做文件完整性监控
aide --check

# 或者简易版:关键目录的哈希基线
find /var/www -type f -exec sha256sum {} \; | sort > /var/lib/baseline.txt
# 定时比对
diff <(find /var/www -type f -exec sha256sum {} \; | sort) /var/lib/baseline.txt
```

**Web 目录里突然多了一个文件**，是 webshell 最直接的信号。容器化 + 只读根文件系统之后这条基本不需要了——**因为攻击者根本写不进去**。

## 四、日志本身要防篡改

攻击者拿到服务器权限后的标准动作之一是**清日志**。

```
本机日志 ──实时转发──> 独立的日志系统（不同凭据、不同网络）
```

**要点**：

- 日志**实时外发**，不要只存本机；
- 日志系统的写入凭据**只有 append 权限，没有删改权限**；
- 保留期按需求定（安全事件调查通常需要 6~12 个月）；
- 时间统一用 **UTC + NTP 同步**——多台机器时间不一致，事件时间线就拼不起来。

## 五、告警要能被响应

::: warning
**告警疲劳是安全监控最常见的死法。**

一个每天响 200 次、95% 是误报的告警系统，实际效果**等同于没有监控**——因为没有人会认真看它，真的那一次也会被划掉。

**原则**：
- **宁可少而准，不要多而杂。** 先上 3 条高置信度规则，跑稳了再加。
- **每条告警必须有明确的处置动作。** 「登录失败率升高了」不是告警，「IP x.x.x.x 正在撞库，建议封禁」才是。
- **定期复盘误报**，及时调阈值或下线规则。一条持续误报的规则，害处大于好处。
- **分级**：P0 电话叫醒，P1 即时消息，P2 每日汇总。**不分级等于全是 P2。**
:::

## 六、最低配置：一个人也能做的版本

如果你就是一个人维护一个站，不要被上面的内容吓到。**做到这几条，你已经比大多数站点强了**：

```bash
# 1. Nginx 结构化日志（上面给过配置）

# 2. 每天扫一遍异常状态码分布
awk -F'"' '{print $(NF-1)}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head

# 3. 找出请求量异常的 IP
jq -r .ip /var/log/nginx/access.json | sort | uniq -c | sort -rn | head -20

# 4. 找出 4xx/5xx 最多的路径（既是安全信号也是质量信号）
jq -r 'select(.status >= 400) | .uri' /var/log/nginx/access.json | sort | uniq -c | sort -rn | head

# 5. 装 fail2ban，自动封禁反复失败的 IP
apt install fail2ban
```

再加上**证书过期监控**和 **CT 日志监控**（[证书那章](/manual/computer-programming/web-security/tls-and-certs)讲过），基本盘就有了。

## 小结

- 入侵的发现时间中位数以周计，且常由外部通知——**目标是压到小时级**。
- 必记：**认证事件、授权拒绝、敏感操作**。`authz.denied` 激增是越权攻击最明显的信号，而那正是 WAF 测不出的。
- **绝不记**：密码、完整 token、完整请求头/体；**「打印整个异常对象」会定期泄露你的 API 密钥**。
- Nginx 日志务必 `escape=json`，否则会被日志注入撑破格式。
- 检测规则**从 3 条高置信度的开始**，每条都要有明确处置动作。
- **日志要实时外发，写入凭据只给 append 权限**——否则攻击者会清掉。
- **告警疲劳等同于没有监控**，宁可少而准。

最后一章讲出事之后怎么办。👉 [应急响应](/manual/computer-programming/web-security/incident-response)
