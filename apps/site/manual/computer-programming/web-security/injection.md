---
title: "注入：一个根因，多种形态"
description: "SQL、NoSQL、命令、模板、LDAP 注入共享同一个根因——数据被当成了代码。为什么参数化优于转义、ORM 也能被注入、以及那些看起来不能参数化的地方（表名、排序）怎么办。"
source: "https://daiw.org/manual/web-security/injection"
---

# 注入：一个根因，多种形态

SQL、NoSQL、命令、模板、LDAP 注入共享同一个根因——数据被当成了代码。为什么参数化优于转义、ORM 也能被注入、以及那些看起来不能参数化的地方（表名、排序）怎么办。

所有注入漏洞的根因是同一句话：

> **你把不可信数据拼进了一段有语法的字符串，解析器把它当成了语法结构的一部分。**

送到 SQL 解析器叫 SQL 注入，送到 shell 叫命令注入，送到模板引擎叫 SSTI，送到浏览器叫 XSS。**根因相同，防法也相同：让数据永远待在「数据」的位置上，不参与语法解析。**

## SQL 注入

### 经典形态

```javascript
// ❌ 字符串拼接
const sql = `SELECT * FROM users WHERE email = '${email}'`;
```

输入 `' OR '1'='1` 时：

```sql
SELECT * FROM users WHERE email = '' OR '1'='1'
```

条件恒真，返回全表。输入 `'; DROP TABLE users; --` 则更直接。

### 正确做法：参数化查询

```javascript
// ✅ 参数化 —— 值永远不参与 SQL 语法解析
const rows = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);
```

::: info
**为什么参数化比转义可靠？**

转义是「把危险字符改写成安全形式」——你要正确处理单引号、双引号、反斜杠、Unicode 变体、数据库特有的转义规则、字符集差异……**任何一处考虑不周就是洞**。历史上有过因为字符集设置（GBK 等宽字节编码）导致转义失效的经典案例。

参数化是**结构性**的：SQL 语句先被解析成执行计划，参数在之后单独传输。**数据根本没有机会变成语法**。这不是「更严格的过滤」，而是「从机制上不可能」。
:::

### ORM 不等于免疫

很多人以为用了 ORM 就安全了。**ORM 的原始查询和某些方法照样能注入**：

```javascript
// ❌ Sequelize 原始查询拼接
await sequelize.query(`SELECT * FROM users WHERE name = '${name}'`);

// ✅ 用 replacements
await sequelize.query('SELECT * FROM users WHERE name = :name', {
  replacements: { name },
});

// ❌ Prisma 的 $queryRawUnsafe
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE id = ${id}`);

// ✅ Prisma 的模板字面量版本会自动参数化
await prisma.$queryRaw`SELECT * FROM users WHERE id = ${id}`;
```

**注意最后两行的区别非常微妙**：`$queryRaw` 用的是标签模板字面量，Prisma 会把 `${id}` 转成参数；`$queryRawUnsafe` 接收的是已拼好的字符串，什么保护都没有。名字里的 `Unsafe` 是认真的。

```bash
# 排查你的代码库
grep -rnE "queryRawUnsafe|\\\$executeRawUnsafe|sequelize\.query\(\`|\.raw\(\`" src/
```

### 不能参数化的位置怎么办

参数化只能用于**值**，不能用于**标识符**（表名、列名）和**关键字**（`ASC`/`DESC`）：

```javascript
// ❌ 这样是不行的，参数化不支持列名
db.query('SELECT * FROM users ORDER BY $1', [sortColumn]);
```

**唯一正确的做法是白名单映射**：

```javascript
// ✅ 用户输入只用来「查表」，永远不进入 SQL 字符串
const SORT_COLUMNS = {
  name:    'name',
  created: 'created_at',
  updated: 'updated_at',
};
const ORDER = { asc: 'ASC', desc: 'DESC' };

const col = SORT_COLUMNS[req.query.sort] ?? 'created_at';
const dir = ORDER[req.query.order] ?? 'DESC';

const sql = `SELECT * FROM users ORDER BY ${col} ${dir} LIMIT $1`;
```

**关键在于**：拼进 SQL 的 `col` 和 `dir` 来自你写死的常量，用户输入只是**查表的键**。即使用户传 `'; DROP TABLE--`，查表查不到，走默认值。

### 盲注与延时注入

即使页面不回显数据，注入依然可利用：

```sql
-- 布尔盲注：通过页面是否正常来逐位猜测
' AND SUBSTRING((SELECT password FROM users LIMIT 1),1,1)='a
-- 时间盲注：通过响应时间判断
' AND (SELECT CASE WHEN (1=1) THEN pg_sleep(5) ELSE pg_sleep(0) END)--
```

::: warning
**「我的接口不返回查询结果，所以注入没危害」是错的。** 盲注只是慢一点——自动化工具能以每秒几十位的速度把整个数据库拖出来。

同理，「报错信息我关掉了」也不构成防御。**唯一的防御是从根上不让注入成立。**
:::

## NoSQL 注入

MongoDB 这类数据库同样会中招，而且形态更隐蔽——**因为它接受对象作为查询条件**：

```javascript
// ❌ 直接把请求 body 塞进查询
db.users.findOne({ email: req.body.email, password: req.body.password });
```

攻击者发送 JSON：

```json
{ "email": "admin@example.com", "password": { "$ne": null } }
```

查询变成「密码不等于 null」——**恒真，直接登录成功**。

**防御**：

```javascript
// ✅ 强制类型：确保它是字符串，不是对象
if (typeof req.body.email !== 'string' || typeof req.body.password !== 'string') {
  return res.status(400).json({ error: 'invalid input' });
}
```

更好的做法是用 schema 校验库（zod、joi）在入口统一做：

```javascript
import { z } from 'zod';
const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});
const parsed = LoginSchema.safeParse(await req.json());
if (!parsed.success) return badRequest();
```

**这条同时防住了很多其它问题**——类型混淆、超长输入、原型污染。**入口处做严格 schema 校验，是性价比最高的后端防御。**

## 命令注入

```javascript
// ❌ 拼接进 shell
exec(`convert ${filename} -resize 100x100 out.jpg`);
```

`filename` 传 `a.jpg; rm -rf /` 就完了。分号、反引号、`$()`、`&&`、`|` 都是注入点。

**正确做法：不经过 shell，用参数数组**：

```javascript
import { execFile } from 'node:child_process';

// ✅ execFile 不启动 shell，参数原样传给程序，元字符没有特殊含义
execFile('convert', [filename, '-resize', '100x100', 'out.jpg'], cb);
```

::: warning
**`exec` 和 `execFile` 的区别是关键**：

- `exec(cmd)` → 启动一个 shell 来解释这个字符串 → **所有 shell 元字符生效**
- `execFile(file, [args])` → 直接 `fork/exec` 那个程序 → **参数就是参数，不会被解释**

Python 里对应的是 `subprocess.run(cmd, shell=True)` vs `subprocess.run([prog, arg1, arg2])`。**看到 `shell=True` 就要警觉。**

即使用了参数数组，如果参数本身可能以 `-` 开头，仍要小心**参数注入**（用户传 `--output=/etc/passwd` 之类）。稳妥做法是加 `--` 分隔符，或校验参数格式。
:::

## 模板注入（SSTI）

```javascript
// ❌ 用户输入进了模板本身，而不是模板的数据
const template = `<h1>你好，${userName}</h1>`;
res.send(ejs.render(template));
```

用户传 `<%= process.env %>` 就能读到所有环境变量；某些模板引擎还能直接执行代码，等于 RCE。

**正确做法**：模板是**代码**，必须写死；用户输入只能作为**数据**传入。

```javascript
// ✅ 模板固定，数据分离
res.render('greeting', { userName });
```

## 其它形态

| 类型 | 场景 | 防御 |
| --- | --- | --- |
| **LDAP 注入** | 用输入拼 LDAP filter | 用库提供的转义/参数化 API |
| **XPath 注入** | 拼 XPath 查询 | 参数化 |
| **日志注入** | 输入含换行，伪造日志行 | 写日志前把 `\r\n` 转义；用结构化日志（JSON） |
| **HTTP 头注入** | 输入含 `\r\n` 写进响应头 | 现代框架大多已拦截，但别自己拼头 |
| **ReDoS** | 用户可控的正则或超长输入 | 限制输入长度；避免嵌套量词；用有超时的正则引擎 |

**日志注入值得多说一句**：它看起来无害，但攻击者可以伪造日志行掩盖真实攻击痕迹，或者注入内容攻击你的日志分析系统（很多 SIEM 会渲染日志内容，那就是 XSS）。[日志那一章](/manual/computer-programming/web-security/logging-and-detection)会再提。

## 一份排查清单

```bash
# SQL 拼接
grep -rnE "query\(.*\\\$\{|query\(.*\+ |queryRawUnsafe|executeRawUnsafe" src/

# 命令执行
grep -rnE "\bexec\(|execSync\(|shell=True|os\.system|subprocess\.call" src/

# 模板渲染用户输入
grep -rnE "render\(.*\\\$\{|compile\(.*req\." src/

# 直接把 req.body 传给数据库
grep -rnE "findOne\(req\.|find\(req\.|insert\(req\.body" src/
```

## 小结

- 注入的根因是**数据被当成了代码**，各种形态共享同一套防御思路。
- **参数化优于转义**——前者是结构性保证，后者要穷举所有危险字符。
- **ORM 不免疫**：`$queryRawUnsafe`、`sequelize.query()` 拼接照样出事。
- 表名、列名、排序方向**不能参数化，必须白名单映射**。
- **NoSQL 注入靠类型混淆**（`{"$ne": null}`），入口做严格 schema 校验能一并防住多类问题。
- 命令执行**永远用参数数组，不要过 shell**；看到 `shell=True` 就警觉。
- **盲注同样能拖库**，「不回显」不是防御。

下一章讲身份。👉 [认证：密码、会话与多因素](/manual/computer-programming/web-security/authn)
