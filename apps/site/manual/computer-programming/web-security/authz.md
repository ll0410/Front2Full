---
title: "授权：越权与 IDOR"
description: "实战中命中率最高、WAF 完全无效、扫描器基本扫不出来的一类漏洞——水平越权与垂直越权的真实场景，以及为什么「默认拒绝 + 在数据层强制归属」才是可靠的架构。"
source: "https://daiw.org/manual/web-security/authz"
---

# 授权：越权与 IDOR

实战中命中率最高、WAF 完全无效、扫描器基本扫不出来的一类漏洞——水平越权与垂直越权的真实场景，以及为什么「默认拒绝 + 在数据层强制归属」才是可靠的架构。

如果只能读这个专栏的一章，我建议读这一章。

**理由**：越权漏洞（Broken Access Control）在 OWASP Top 10 中位居榜首（A01），在真实渗透与漏洞赏金中的命中率也常年居高不下，而它同时满足三个让人头疼的特征：

- **WAF 完全无效**——请求本身合法，没有任何攻击特征；
- **扫描器基本扫不出来**——它需要理解业务语义（「这条数据该属于谁」）；
- **代码 review 也容易漏**——因为漏的是「少写的那一行」，不是「写错的那一行」。

## 两种越权

**水平越权**：访问**同级别其他用户**的资源。

```
你是用户 A（订单 1001），把 URL 改成订单 1002 —— 看到了用户 B 的订单
```

**垂直越权**：访问**更高权限**的功能。

```
普通用户直接访问 /admin/users —— 进去了
```

其中水平越权就是常说的 **IDOR**（不安全的直接对象引用）。

## 一个典型的洞

```javascript
// ❌ 只验证了「你登录了」，没验证「这单是不是你的」
app.get('/api/orders/:id', requireAuth, async (req, res) => {
  const order = await db.orders.findById(req.params.id);
  res.json(order);
});
```

`requireAuth` 让人产生了安全感——**但它只回答了「你是谁」，没回答「你能不能看这个」**。

改成这样：

```javascript
// ✅ 查询条件里带上归属
app.get('/api/orders/:id', requireAuth, async (req, res) => {
  const order = await db.orders.findOne({
    id: req.params.id,
    userId: req.user.id,        // ← 关键的一行
  });
  if (!order) return res.status(404).json({ error: 'not found' });
  res.json(order);
});
```

::: info
**注意返回 404 而不是 403。**

返回 403「无权访问」等于告诉攻击者「这个 ID 存在，只是不属于你」——他可以据此枚举出系统里有多少订单、哪些 ID 有效。返回 404 则不泄露任何信息。

这个细节在赏金报告里经常被单独作为一个「信息泄露」问题提出。
:::

## 藏得更深的地方

上面那个例子太明显。真实系统里，越权往往藏在这些地方：

### 一、批量与嵌套接口

```javascript
// 单个查询做了归属校验，批量接口忘了
app.post('/api/orders/batch', requireAuth, async (req, res) => {
  const orders = await db.orders.findByIds(req.body.ids);   // ❌ 没过滤
  res.json(orders);
});
```

**攻击者传 `ids: [1,2,3,...,10000]` 就拖走了全表。**

### 二、更新接口的「隐藏字段」

```javascript
// ❌ 直接把 body 铺进更新
app.patch('/api/profile', requireAuth, async (req, res) => {
  await db.users.update(req.user.id, req.body);
});
```

用户提交 `{"nickname":"x", "role":"admin", "balance":999999}`——**如果这些列存在，就被一起改了**。这叫**批量赋值 / 参数污染**。

```javascript
// ✅ 白名单可更新字段
const ALLOWED = ['nickname', 'avatar', 'bio'];
const patch = Object.fromEntries(
  Object.entries(req.body).filter(([k]) => ALLOWED.includes(k))
);
await db.users.update(req.user.id, patch);
```

**用 zod 这类 schema 库更干净**——`z.object({...}).strict()` 会直接拒绝多余字段。

### 三、只在前端隐藏了入口

```jsx
// 前端根据角色隐藏按钮
{user.isAdmin && <button onClick={deleteUser}>删除用户</button>}
```

**按钮没了，接口还在。** 攻击者直接 `curl` 那个接口。

> **前端的任何隐藏、禁用、校验，都只是用户体验，不是安全边界。** 前端代码跑在攻击者的机器上，他想改就改。

### 四、GraphQL 的嵌套查询

```graphql
query {
  me {
    id
    orders {
      id
      user {            # ← 通过关联跳到别的对象
        email           # 这里校验了吗？
      }
    }
  }
}
```

GraphQL 的授权必须做在**每个字段的解析器**上，而不是只在入口做一次。这是 GraphQL 授权最常见的坑：**入口守得好好的，攻击者从关联关系绕进去了。**

### 五、状态机跳步

```
下单 → 支付 → 发货 → 完成
```

如果「发货」接口没校验当前状态，攻击者可以**跳过支付直接触发发货**。这类逻辑越权 WAF 更是完全无感。

**对策**：每个状态转移都显式校验前置状态。

```javascript
if (order.status !== 'paid') {
  return res.status(409).json({ error: 'invalid state transition' });
}
```

## 可靠的架构：把校验下沉

逐个接口手写校验，迟早会漏一个。**可靠的做法是把归属校验下沉到数据访问层**，让「忘记写」变得不可能。

### 方案一：强制作用域的查询封装

```javascript
// 所有查询必须经过这一层，拿不到「不带用户上下文」的查询能力
function scopedDb(userId) {
  return {
    orders: {
      findOne: (where) => db.orders.findOne({ ...where, userId }),
      findMany: (where) => db.orders.findMany({ ...where, userId }),
      update: (id, data) => db.orders.update({ id, userId }, data),
    },
  };
}

// 业务代码里根本拿不到全局查询对象
app.get('/api/orders/:id', requireAuth, async (req, res) => {
  const order = await scopedDb(req.user.id).orders.findOne({ id: req.params.id });
  res.json(order ?? {});
});
```

**关键在于「拿不到」**——业务代码里没有全局 `db` 可用，只有带作用域的版本。忘写归属条件这件事从「容易发生」变成「做不到」。

### 方案二：数据库行级安全（RLS）

Postgres 支持在数据库层强制：

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_owner ON orders
  USING (user_id = current_setting('app.current_user_id')::uuid);
```

应用每次连接时设置当前用户：

```javascript
await db.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
```

**之后即使写了 `SELECT * FROM orders`，数据库也只会返回属于这个用户的行。**

::: info
**RLS 是最强的一道防线**，因为它在数据库层强制执行——**即使应用层有 SQL 注入，攻击者也拖不走别人的数据**。

代价：增加了复杂度、调试变难（「为什么我查不到数据」）、需要小心连接池复用时的上下文泄露（务必用事务级 `set_config`，第三个参数 `true` 就是这个意思）。

对存储敏感数据的多租户系统，这个代价值得付。
:::

## 默认拒绝

权限模型的默认值决定了「漏写」的后果：

```javascript
// ❌ 默认允许：新加的路由如果忘了标记，就是公开的
const PUBLIC_ROUTES = ['/login', '/register'];
if (!PUBLIC_ROUTES.includes(path)) requireAuth();

// ✅ 默认拒绝：新加的路由如果忘了标记，是访问不了的 —— 会被立刻发现
const ROUTE_POLICY = {
  '/login':          'public',
  '/register':       'public',
  '/api/orders':     'user',
  '/admin/users':    'admin',
};
const policy = ROUTE_POLICY[path];
if (!policy) return res.status(403).end();     // 未登记 = 拒绝
```

**两者的区别在「忘记」的时候**：默认允许时，漏写会**静默地**产生一个公开接口，可能几个月都没人发现；默认拒绝时，漏写会**立刻表现为功能不可用**，开发阶段就修了。

**让错误的方向是「坏掉」而不是「敞开」**，这是安全设计里最有价值的一条通则。

## 怎么测

授权漏洞必须**手工测**，扫描器帮不上忙。方法很朴素：

```bash
# 准备两个账号：A 和 B
# 1. 用 A 登录，记下他的资源 ID
# 2. 用 B 的会话去访问 A 的资源

curl -s -o /dev/null -w "%{http_code}\n" \
  https://example.com/api/orders/A的订单ID \
  --cookie "session=B的会话"
# 期望 404（或 403），返回 200 就是水平越权

# 3. 用普通用户会话访问管理接口
curl -s -o /dev/null -w "%{http_code}\n" \
  https://example.com/admin/users \
  --cookie "session=普通用户会话"
# 期望 403/404
```

**把这个做成自动化测试**，每个涉及资源归属的接口都覆盖一条：

```javascript
test('用户 B 不能读取用户 A 的订单', async () => {
  const res = await fetch(`/api/orders/${orderOfA.id}`, { headers: cookieOf(userB) });
  expect(res.status).toBe(404);
});
```

**这类测试的价值极高**，因为它守住的正是「代码 review 最容易漏、扫描器完全测不出」的那一类问题。

## 小结

- 越权（OWASP Top 10 A01）是**实战中高发**的漏洞类型，**WAF 无效、扫描器无效**。
- `requireAuth` 只回答「你是谁」，**必须再回答「你能不能操作这个对象」**。
- 归属校验要写进**查询条件**，不是查出来再比对；**返回 404 而非 403** 以免泄露 ID 存在性。
- 易漏点：批量接口、更新接口的隐藏字段（批量赋值）、GraphQL 嵌套、状态机跳步。
- **前端隐藏不是安全边界。**
- 可靠架构是把校验下沉：**强制作用域的查询封装**，或数据库 **RLS**。
- 权限模型要**默认拒绝**——让漏写表现为「坏掉」而不是「敞开」。
- **两个账号互测，并把它固化成自动化测试。**

下一章讲另一类「服务器替攻击者干活」的漏洞。👉 [SSRF](/manual/computer-programming/web-security/ssrf)
