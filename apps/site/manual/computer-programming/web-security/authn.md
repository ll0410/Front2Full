---
title: "认证：密码、会话与多因素"
description: "密码怎么存、登录接口怎么防撞库而不误伤真人、会话 token 用 Cookie 还是 JWT、为什么「记住我」和密码重置是两个最常被打穿的地方。"
source: "https://daiw.org/manual/web-security/authn"
---

# 认证：密码、会话与多因素

密码怎么存、登录接口怎么防撞库而不误伤真人、会话 token 用 Cookie 还是 JWT、为什么「记住我」和密码重置是两个最常被打穿的地方。

认证要回答的是「你是谁」。这一章按真实系统的顺序走：**存密码 → 验密码 → 发会话 → 管会话 → 找回密码**。每一环都有经典的翻车方式。

## 一、密码怎么存

**唯一正确的答案：用专为密码设计的慢哈希。**

| 算法 | 评价 |
| --- | --- |
| **Argon2id** | **首选**。内存硬，抗 GPU/ASIC |
| **scrypt** | 好，内存硬 |
| **bcrypt** | 可用，成熟稳妥；注意 72 字节截断 |
| PBKDF2 | 只在合规要求时用（FIPS），抗 GPU 能力弱 |
| ~~SHA-256 / MD5~~ | **错误**。设计目标是快，而快正是密码哈希的死敌 |

```javascript
import argon2 from 'argon2';

// 存
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19456,   // 19 MiB
  timeCost: 2,
  parallelism: 1,
});

// 验
const ok = await argon2.verify(hash, password);
```

::: info
**不需要自己加盐。** bcrypt/argon2/scrypt 都会自动生成随机盐并**编码进哈希字符串里**。你看到的那串 `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>` 已经包含了算法、参数和盐——所以将来调参数时，旧密码依然能验证。

**也不要自己「加胡椒」再套一层 SHA**。自创的组合往往引入新问题（比如先 SHA 再 bcrypt 会绕过 bcrypt 的 72 字节截断，但也可能引入其它性质变化）。用库的默认用法。
:::

**密码策略**：现代建议（NIST SP 800-63B）与很多人的直觉相反：

- ✅ **只要求最小长度**（8 起，推荐 12+），最大长度别设太小（至少允许 64）
- ✅ **检查是否在已泄露密码库里**（用 k-匿名 API，只发哈希前 5 位）
- ❌ **不要**强制「大小写+数字+符号」——它逼出 `Password1!` 这类可预测密码
- ❌ **不要**定期强制改密码——它逼出 `Password1` → `Password2`
- ❌ **不要**禁止粘贴——那是在阻止用户用密码管理器

## 二、验密码：登录接口的三个防护

### 防撞库：分层限流

```
按账号：同一账号 5 次失败 → 锁定/延迟递增
按 IP：  同一 IP 20 次失败/小时 → 挑战或封禁
全局：   失败率突然飙升 → 告警（撞库攻击的特征）
```

::: warning
**只按账号锁定会带来「账号锁定 DoS」**：攻击者故意用错误密码打某个用户的账号，把他锁在门外。

**只按 IP 又拦不住分布式撞库**（代理池轮换）。

实践中的平衡：**按账号做递增延迟而不是硬锁定**（1s → 2s → 4s → 8s…），配合按 IP 的硬限制，再加上失败次数超阈值后强制验证码。递增延迟既阻断了自动化，又不会把真实用户永久挡在外面。
:::

### 防用户名枚举

```javascript
// ❌ 泄露了「这个邮箱是否注册过」
if (!user) return res.status(404).json({ error: '用户不存在' });
if (!valid) return res.status(401).json({ error: '密码错误' });

// ✅ 统一响应
return res.status(401).json({ error: '邮箱或密码不正确' });
```

**但响应文案统一还不够——时间也会泄露。** 用户不存在时你直接返回，耗时 5ms；用户存在时要跑 argon2，耗时 200ms。**攻击者用时间差就能枚举出哪些邮箱注册过。**

```javascript
// ✅ 用户不存在时，也跑一次哈希验证（对一个固定的假哈希）
const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$...';   // 启动时生成一次
const user = await findUser(email);
const ok = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, password);
if (!user || !ok) return unauthorized();
```

**注册和找回密码接口同样要注意**——「该邮箱已被注册」是最常见的枚举点。正确做法是：无论邮箱是否存在，都回复「如果该邮箱已注册，我们已发送邮件」。

### 防时序攻击

比较 token、验证码这类**秘密值**时，用恒定时间比较：

```javascript
import { timingSafeEqual } from 'node:crypto';

function safeCompare(a, b) {
  const bufA = Buffer.from(a), bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;   // 长度本身会泄露，但通常可接受
  return timingSafeEqual(bufA, bufB);
}
```

普通的 `===` 在第一个不同字节处就返回，**逐字节的耗时差异可被测量出来**。密码哈希的 `verify` 函数内部已经处理了这一点，但你自己比较 API key、CSRF token 时要注意。

## 三、发会话：Cookie 还是 JWT

这是个被过度讨论的问题。给个明确的建议：

::: info
**对绝大多数 Web 应用，用「服务端会话 + HttpOnly Cookie」，不要用 JWT。**

JWT 的卖点是「无状态、可水平扩展」，但代价是**无法即时撤销**——用户改密码、管理员封号、检测到异常，签发出去的 token 在过期前一直有效。为了解决这个问题，你会加一个「吊销列表」——**然后你就又有状态了，而且比直接存会话更复杂**。

JWT 适合的是：**跨服务的短时授权**（微服务之间）、**第三方 API 访问令牌**。不适合作为浏览器会话。
:::

服务端会话的正确姿势：

```javascript
// 会话 ID：密码学随机，足够长
const sessionId = crypto.randomBytes(32).toString('base64url');

// 存服务端（Redis / 数据库），带过期
await redis.setex(`sess:${sessionId}`, 3600, JSON.stringify({ userId, createdAt }));

// 下发
res.headers.set('Set-Cookie',
  `__Host-session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`);
```

**必须做的两件事**：

**一、登录后重新生成会话 ID。** 否则存在**会话固定攻击**：攻击者先拿到一个未登录的会话 ID，想办法让受害者用这个 ID 登录，登录后这个 ID 就成了已认证会话——而攻击者一直握着它。

```javascript
// 登录成功后
await redis.del(`sess:${oldSessionId}`);
const newSessionId = crypto.randomBytes(32).toString('base64url');
```

**二、登出要真的销毁服务端会话**，不能只删 Cookie。只删 Cookie 的话，攻击者若已复制走那个 ID，登出后照样能用。

## 四、管会话

| 项 | 建议 |
| --- | --- |
| 空闲超时 | 30 分钟 ~ 数小时（按敏感度） |
| 绝对超时 | 无论活跃与否，**最长 7~30 天**必须重新登录 |
| 并发会话 | 敏感系统限制数量；普通应用提供「查看并登出其它设备」 |
| 改密码 | **必须使其它所有会话失效** |
| 敏感操作 | 改邮箱、改密码、支付 → **重新输入密码或二次验证** |

**最后一条是 XSS 的重要兜底**：即使攻击者偷到了会话，他也改不了密码、转不了账——因为那些操作需要重新认证。

### 「记住我」的正确实现

这是个经典的翻车点。**不要**把用户名密码或长期有效的会话 ID 存进 Cookie。

正确做法是 **selector + validator 模式**：

```javascript
// 生成两段
const selector  = crypto.randomBytes(12).toString('base64url');   // 用于查找，明文存库
const validator = crypto.randomBytes(32).toString('base64url');   // 用于验证，只存哈希

await db.rememberTokens.insert({
  selector,
  validatorHash: sha256(validator),      // 这里可以用快哈希，因为 validator 是高熵随机值
  userId,
  expiresAt: Date.now() + 30 * 86400_000,
});

setCookie('remember', `${selector}:${validator}`, { httpOnly: true, secure: true, sameSite: 'Lax' });
```

**校验时**：用 `selector` 查出记录，再用恒定时间比较 `validator` 的哈希。

**关键的加固**：每次使用后**轮换 validator**。如果某次发现 `selector` 存在但 `validator` 对不上——**说明 token 被盗用了**，立刻使该用户的所有 remember token 失效并告警。这叫 **token 盗用检测**，是这个模式最大的价值。

## 五、密码重置：最常被打穿的地方

密码重置流程是整个认证体系里**最容易出洞**的部分，因为它天然是「绕过密码」的通道。

**必须做到**：

```javascript
// 1. token 必须是密码学随机、足够长
const token = crypto.randomBytes(32).toString('base64url');

// 2. 数据库里只存哈希（防止数据库泄露后被直接用来重置所有人的密码）
await db.resetTokens.insert({ userIdHash, tokenHash: sha256(token), expiresAt: Date.now() + 900_000 });

// 3. 有效期要短 —— 15 分钟到 1 小时
// 4. 一次性 —— 用过立刻删除
// 5. 使用后使该用户所有现存会话失效
```

**常见漏洞**：

| 漏洞 | 说明 |
| --- | --- |
| token 可预测 | 用时间戳、自增 ID、`Math.random()` 生成 |
| 不过期 / 不失效 | 一年前的重置链接还能用 |
| **Host 头投毒** | 用 `req.headers.host` 拼重置链接 → 攻击者改 Host，链接指向他的域名，**受害者一点击 token 就到手了** |
| 响应泄露枚举 | 「该邮箱未注册」 |
| 无速率限制 | 邮件轰炸 |

::: warning
**Host 头投毒是密码重置里最隐蔽也最致命的一个。**

  ```javascript
  // ❌ 攻击者可控
  const link = `https://${req.headers.host}/reset?token=${token}`;
  ```

攻击者对你的接口发起重置请求（目标是受害者的邮箱），同时把 `Host` 头改成 `evil.com`。**受害者收到的是一封来自你的域名的、真实的重置邮件，但链接指向 `evil.com`**。他一点击，token 就进了攻击者的日志。

**对策：域名从配置读，绝不从请求头取。**

  ```javascript
  const link = `${process.env.PUBLIC_BASE_URL}/reset?token=${token}`;
  ```

同样的原则适用于所有「服务端生成的绝对 URL」——邮件、Webhook 回调、分享链接。
:::

## 六、多因素

优先级排序（安全性从高到低）：

1. **通行密钥 / FIDO2**——抗钓鱼（因为绑定了域名，钓鱼站拿不到），未来方向
2. **TOTP**（认证器 App）——性价比最高，实现简单
3. **推送确认**——注意「MFA 疲劳攻击」：反复推送直到用户不耐烦点了同意
4. **短信**——**可被 SIM 卡劫持**，聊胜于无

实现 TOTP 时的两个细节：

- **备份码**：生成一次性备份码，只存哈希。用户丢手机时唯一的出路。
- **绑定时要验证一次**：让用户输入一次当前验证码再启用，否则时钟不同步会把用户锁死。

## 小结

- 密码用 **Argon2id**（或 bcrypt/scrypt），**不要自己加盐或组合算法**。
- 密码策略：**只管长度 + 查泄露库**，别要求复杂字符、别强制定期改。
- 防枚举要**同时统一响应文案和响应时间**（不存在的用户也跑一次哈希）。
- **锁定策略用递增延迟而非硬锁**，避免账号锁定 DoS。
- **浏览器会话用服务端会话 + HttpOnly Cookie，不要用 JWT**。
- **登录后必须重新生成会话 ID**（防会话固定）；改密码要失效其它所有会话。
- 「记住我」用 **selector + validator**，每次轮换，对不上就是被盗用信号。
- **密码重置的链接域名必须从配置读**，`req.headers.host` 是可控的。

下一章讲实战中命中率最高的一类漏洞。👉 [授权：越权与 IDOR](/manual/computer-programming/web-security/authz)
