---
title: "策略 · Strategy（行为型）"
description: "一件事有多种可互换的做法，别再用 if-else 把它们堆在一个函数里。策略模式把每种算法封成可替换的一块，运行时随意切换。Go 里一个函数类型就搞定，几乎看不见“模式”的影子。"
source: "https://daiw.org/manual/design-patterns/strategy"
---

# 策略 · Strategy（行为型）

一件事有多种可互换的做法，别再用 if-else 把它们堆在一个函数里。策略模式把每种算法封成可替换的一块，运行时随意切换。Go 里一个函数类型就搞定，几乎看不见“模式”的影子。

进入最大的一族——行为型，11 个，管的是“对象之间怎么分工、怎么协作”。打头阵的策略模式，是最实用、也最能体现“面向接口编程”的一个。

## 一、这是什么：导航 App 里的“路线偏好”

打开高德/Google Maps 导航，同样是从 A 到 B，它给你几个选项：**最快路线、最短路线、避开高速、少走收费**。目的地没变，变的是“怎么算这条路”的**算法**。你点一下，算法就换一套，重新给你规划。

策略模式就是这个“路线偏好”：**把“完成某件事的不同做法(算法)”各自封装成一块，让它们能互相替换，而使用者可以在运行时自由切换，用哪块就换哪块。**

配套代码是支付：同样是“付 299 元”，可以用信用卡、PayPal、加密货币——每种是一个策略，购物车运行时想换哪个换哪个。

## 二、解决什么痛：一个函数里塞满 if-else

不用策略，多种做法往往挤在一个函数里：

```go
// 痛点:每加一种支付方式,就得回来改这个函数,它只会越来越肥
func (c *Cart) Checkout(method string) string {
	if method == "creditcard" {
		// ...信用卡的一堆逻辑...
	} else if method == "paypal" {
		// ...PayPal 的一堆逻辑...
	} else if method == "crypto" {
		// ...加密货币的一堆逻辑...
	}
	// 再加一种?继续往下堆 else if......
}
```

这段代码的病：**它把“所有做法”焊死在一个函数里**。加一种支付方式要改它，改一种做法也要动它，几种算法的代码还搅在一起互相干扰。经典的开闭原则违反现场。

::: info
**策略隔离的“会变的东西”，就是“算法本身”。** 把每种算法拎成独立的一块，彼此隔离、可插拔。加算法 = 加一块新策略，老代码一行不动；用哪个 = 运行时把那块塞进去。`Checkout` 从此只负责“调用当前策略”，不再关心到底有几种支付方式。
:::

## 三、怎么实现：Go 用函数值，轻到看不见

经典 OOP(Java)里，策略是“一个策略接口 + 每种算法一个实现类”。但在 Go 里，**一个函数类型就是最好的策略载体**——算法本来就是“输入→输出”的函数，何必包成类？

**go/strategy/main.go（核心）**

```go
// 策略就是一个函数类型:收金额,返回结果。不需要接口 + 一堆类。
type PaymentStrategy func(amount float64) string

// 每种"具体策略"是一个返回该函数的构造(闭包绑定各自的数据)
func CreditCardPay(cardNumber string) PaymentStrategy {
	return func(amount float64) string {
		return fmt.Sprintf("信用卡尾号%s 支付 %.2f 元", cardNumber[len(cardNumber)-4:], amount)
	}
}

// 上下文:持有一个可随时替换的策略
type ShoppingCart struct {
	amount   float64
	strategy PaymentStrategy
}
func (c *ShoppingCart) SetPaymentStrategy(s PaymentStrategy) { c.strategy = s }
func (c *ShoppingCart) Checkout() string { return c.strategy(c.amount) }
```

运行时切换，行云流水：

```go
cart := NewShoppingCart(299.5)
cart.SetPaymentStrategy(CreditCardPay("4111111111111234"))
cart.Checkout()                                   // 走信用卡
cart.SetPaymentStrategy(PayPalPay("alice@x.com")) // 换 PayPal
cart.Checkout()
```

::: info
对比一下就懂 Go 的取舍了：Java 要为策略写 `interface PaymentStrategy` + `CreditCardStrategy`、`PayPalStrategy` 好几个类；Go 用 `type PaymentStrategy func(...)` 加闭包，把整个模式压成几行。**当算法是“无状态的一个动作”时，函数值几乎总比策略接口更地道。** 只有当策略需要携带较多状态/多个方法时，才值得上接口。
:::

## 四、有哪些坑

- **和状态模式长得一模一样，务必分清。** 两者都是“上下文持有一个可替换的接口对象”。区别在意图和驱动方：**策略的多个算法互不知情，由客户端从外部主动选**(“我要用信用卡”)；**状态的多个状态彼此知道、会自动流转**，由内部驱动(“播放中→按暂停→自动变成已暂停”)。结构双胞胎，灵魂两个人。第 18 篇[状态](/manual/computer-programming/design-patterns/state)会再对照一次。
- **策略太多也是负担。** 几十种策略散在几十个地方，“该用哪个”本身就成了问题。有时配一个“策略工厂/注册表”按 key 取策略，能收敛这种混乱。
- **客户端得知道策略的存在。** 选择的责任在调用方——它得知道有哪些策略、什么场景用哪个。策略模式把算法解耦了，但没消灭“选择”这件事。

## 五、开源里怎么用

- **Go `sort.Slice(s, less)`**：那个 `less func(i, j int) bool` 就是**比较策略**。同一份排序算法，你传不同的 `less`，就能按不同规则排——策略模式在标准库里一次格外优雅的现身，而且正是用函数值实现的。
- **Go `http.Client.Transport`**:`RoundTripper` 接口是可替换的“怎么发这个请求”策略——默认走网络，测试时换成 mock，加个带重试/日志的包装也行。
- **可插拔的算法族**：压缩(gzip/zstd/snappy)、哈希(md5/sha256)、负载均衡(轮询/随机/最少连接)、限流(令牌桶/漏桶)——凡是“同一件事有多种算法、想运行时切换”的地方，底层几乎都是策略。
- **Java `Comparator`**:`Collections.sort(list, comparator)` 和 Go 的 `sort.Slice` 是一回事，Java 世界里策略模式最常见的入口。

---

策略让“算法”可插拔。下一篇[观察者](/manual/computer-programming/design-patterns/observer)：当一个对象变了、一大群对象要跟着响应时，怎么让它们松耦合地联动——这是“事件驱动”整个世界的地基。
