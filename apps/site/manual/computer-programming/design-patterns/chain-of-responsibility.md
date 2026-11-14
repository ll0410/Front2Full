---
title: "责任链 · Chain of Responsibility（行为型）"
description: "一个请求可能由多个处理者之一负责，而发送者不该知道到底该谁处理。把处理者串成一条链，请求顺着链走直到被处理。讲清这个模式，以及为什么所有 Web 中间件本质上都是它。"
source: "https://daiw.org/manual/design-patterns/chain-of-responsibility"
---

# 责任链 · Chain of Responsibility（行为型）

一个请求可能由多个处理者之一负责，而发送者不该知道到底该谁处理。把处理者串成一条链，请求顺着链走直到被处理。讲清这个模式，以及为什么所有 Web 中间件本质上都是它。

这个模式你只要写过 Web 后端就一定见过——所有 Web 框架的“中间件”骨架，就是责任链。

## 一、这是什么：公司的报销审批

你交一张报销单。800 块，经理直接批了；要是 1 万 5，经理权限不够，转给总监；要是 8 万，总监也批不了，再转给 CEO。**你只管把单子交给第一个人(经理)，它会自动沿着“经理→总监→CEO”这条链往上走，直到遇到有权批的人。** 你不需要知道“这个金额到底该找谁签”，链条自己会把它送到位。

责任链模式就是这条审批链：**把多个处理者串成一条链，请求沿着链传递，每个处理者要么处理它、要么甩给下一个，直到有人处理(或走到链尾)。** 发送者不需要知道最终是谁处理的。

配套代码正是采购审批：`Manager`(限额 5000)→`Director`(2 万)→`CEO`(10 万)，金额超了就 `passToNext` 往上转。

## 二、解决什么痛：发送者被迫知道“该谁处理”

不用责任链，“根据条件找处理者”通常又是一坨 `if-else`:

```go
// 痛点:发送方被迫掌握全部的分派规则
func handle(req *PurchaseRequest) {
	if req.Amount <= 5000 {
		manager.Approve(req)
	} else if req.Amount <= 20000 {
		director.Approve(req)
	} else if req.Amount <= 100000 {
		ceo.Approve(req)
	}
	// 加一级审批?加一档金额?回来改这里。
}
```

病根：**发送方被迫知道整条分派规则**——每个处理者的能力边界、谁在谁前面。审批层级一变(加个“VP”档)，这里就得改；而且这套规则和“发起请求”的代码耦合死了。

::: info
**责任链隔离的“会变的东西”，是“一个请求到底该由谁处理、以及处理者的排列顺序”。** 它把“分派决策”从发送方剥离，分散到链上每个处理者身上——每个处理者只需回答一个简单问题：“这个我能处理吗？不能就往下传。” 发送方只管把请求丢给链头，彻底不关心它最终花落谁家。增删处理者、调整顺序，只是重新接一下链。
:::

## 三、怎么实现：每个处理者持有“下一个”

每个处理者持有指向“下一个处理者”的引用；处理不了就转交。Go 用组合复用“转交”这段公共逻辑。

**go/chain-of-responsibility/main.go（核心）**

```go
// 基础处理者:封装"转交下一个"的公共逻辑,供各级组合复用
type baseApprover struct{ next Approver }
func (b *baseApprover) SetNext(next Approver) Approver { b.next = next; return next }
func (b *baseApprover) passToNext(req *PurchaseRequest) {
	if b.next != nil {
		b.next.Approve(req)          // ← 有下一个,甩给它
		return
	}
	fmt.Println("无人可审批,已拒绝")  // ← 走到链尾的兜底
}

// 具体处理者:能处理就处理,不能就 passToNext
type Manager struct {
	baseApprover
	limit float64
}
func (m *Manager) Approve(req *PurchaseRequest) {
	if req.Amount <= m.limit {
		fmt.Println("经理批准了")     // 我的权限够,处理掉,链终止
		return
	}
	m.passToNext(req)                // 超我权限,往上转
}
```

组装链就是把它们串起来，发起时只找链头：

```go
manager.SetNext(director).SetNext(ceo)   // 串成 经理→总监→CEO
manager.Approve(req)                       // 只管交给链头,自动流转到合适的人
```

## 四、有哪些坑

- **请求可能走到链尾也没人处理。** 必须有兜底(像配套代码那样，到尾了打印“已拒绝”)，否则请求“石沉大海”是很隐蔽的 bug。**永远为“没人处理”留个结局。**
- **链的顺序即行为。** 处理者的排列顺序直接决定结果(先经理还是先总监，天差地别)。责任链很灵活，但这份灵活也意味着“接错链”是一类新 bug。
- **和装饰器“都是链”，区别在意图。** 装饰器链上**每一环都会执行**，层层叠加增强(咖啡每种料都加上)；责任链上通常**只有一环真正处理**(或部分处理后传递)，重点是“找到那个该处理的人然后停下”。一个“人人有份”，一个“能者上”。
- **别为俩处理者就上责任链。** 就两个固定分支，一个 `if-else` 更直白。责任链的价值在“处理者多、顺序可能变、还想动态增删”时才显现。

## 五、开源里怎么用

- **Web 中间件 —— 责任链最闪耀的舞台。** Go 的 `net/http` 中间件、Gin/Echo 的 handler chain、Java 的 Servlet `Filter` chain、Node.js Express 的 `app.use()`——每个中间件拿到请求，处理自己那部分(鉴权、日志、限流、CORS)，然后 `next()` 传给下一个，或者直接拦截返回(如鉴权失败)。**你写的每一个 Web 服务，都跑在一条责任链上。**
- **Netty 的 `ChannelPipeline`**：网络数据在一条 handler 链上流动，每个 handler 处理或传递——高性能网络框架的核心结构。
- **日志框架的 Handler/Appender 链**：一条日志记录依次流过多个处理器(格式化、过滤、写文件、发网络)。
- **异常处理**：`try-catch` 一层层往上抛，直到某层捕获——语言层面内建的一种“责任链”思想。

---

责任链让请求“顺着链找到归宿”。下一篇[中介者](/manual/computer-programming/design-patterns/mediator)：当一堆对象两两之间互相引用、乱成一张网时，引入一个“中间人”把网状关系收拢成星状——从此大家只跟中间人打交道。
