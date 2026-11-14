---
title: "适配器 · Adapter（结构型）"
description: "手头有个现成的类/SDK，接口却和你系统期望的对不上，又不能改它——加个转换层。讲清适配器的“接口转换”本质、Go 里的对象适配、以及 http.HandlerFunc 这个把函数适配成接口的神来之笔。"
source: "https://daiw.org/manual/design-patterns/adapter"
---

# 适配器 · Adapter（结构型）

手头有个现成的类/SDK，接口却和你系统期望的对不上，又不能改它——加个转换层。讲清适配器的“接口转换”本质、Go 里的对象适配、以及 http.HandlerFunc 这个把函数适配成接口的神来之笔。

进入结构型。这一章研究“怎么把对象拼装成更大的结构”，而开门第一位是最接地气的老黄牛——**适配器**。你几乎每天都在用它，只是没意识到。

## 一、这是什么：出国带的那个电源转换头

你去欧洲旅行，带了国标插头的充电器，墙上却是欧标插孔。插不进去。你不会去砸墙改插座，也不会拆了充电器——你买个**电源转换头**，一头接你的国标插头，一头插欧标插座，中间转换一下。

适配器模式就是这个转换头：**你有一个现成的东西(充电器)，接口却和目标环境(欧标插座)不匹配，又都不能改。于是加一个中间层，把一方的接口“翻译”成另一方期望的样子。**

配套代码接第三方支付：你的系统统一用 `Pay(元)` 接口，但第三方 Stripe SDK 只有 `ChargeInCents(分)`——方法名不同、单位不同。你不能改 Stripe 的源码，于是写个适配器夹在中间翻译。

## 二、解决什么痛：接口对不上，双方还都改不了

痛点非常具体：

- **一方是你控制不了的。** Stripe SDK 是人家的，你无权改。你的系统接口也已经被一堆代码依赖了，不好动。
- **强行让业务代码去迁就第三方，会污染整个代码库。** 如果每处调用都写 `stripe.ChargeInCents(int(yuan*100))`，那么“元转分”“方法名不同”这些脏活就散得到处都是。哪天换个支付商，又要满地改。

::: info
**适配器隔离的“会变的东西”，是“第三方/遗留代码那套不兼容的接口”。** 它把“接口不匹配”这个脏活收进一个专门的类里，让业务代码永远只面对干净统一的目标接口。第三方怎么变、换成谁，只影响适配器一个文件。
:::

## 三、怎么实现：包一层，翻译过去

Go 用**对象适配器**(组合)：适配器持有被适配对象，实现目标接口，在方法里做翻译后转调。

**go/adapter/main.go（核心）**

```go
// 目标接口:系统统一期望的样子(以"元"为单位)
type PaymentProcessor interface {
	Pay(yuan float64) (string, error)
}

// 被适配者:第三方 SDK,接口不兼容(以"分"为单位,方法名也不同)
type StripePayment struct{}
func (s *StripePayment) ChargeInCents(cents int) string { /* ... */ }

// 适配器:实现目标接口,内部把"元"翻译成"分"再转调被适配者
type StripeAdapter struct {
	stripe *StripePayment
}
func (a *StripeAdapter) Pay(yuan float64) (string, error) {
	if yuan <= 0 {
		return "", fmt.Errorf("金额必须为正")
	}
	cents := int(yuan * 100)                  // ← 翻译:元 → 分
	return a.stripe.ChargeInCents(cents), nil // ← 转调被适配者
}
```

于是客户端 `checkout()` 只认 `PaymentProcessor` 接口，原生的支付宝、包装过的 Stripe，在它眼里长得一模一样：

```go
checkout(&NativeAlipay{}, 99.9)                        // 原生实现
checkout(NewStripeAdapter(&StripePayment{}), 199.5)    // 适配后的第三方
```

::: info
经典 GoF 还分**类适配器**(靠多重继承同时继承目标和被适配者)和**对象适配器**(靠组合持有被适配者)。Go 没有继承，天然只走对象适配器这条路——而这恰恰是 GoF 更推荐的一种(组合优于继承)。
:::

## 四、有哪些坑

- **它是“事后补救”，不是“事前设计”。** 适配器的存在，往往意味着两套代码当初没约定好接口。它是很好的“止损”工具，但如果你在**新设计**里就到处需要适配器，说明接口规划出了问题——那该统一接口，而不是狂加适配层。
- **和几个“长得像”的模式分清楚**，这是结构型最容易混的地方，一张表记牢：

| 模式 | 它对接口做什么 | 一句话意图 |
| --- | --- | --- |
| **适配器** | **改**接口(A 变 B) | 让不兼容的能一起用 |
| **装饰器** | **不改**接口，加功能 | 动态增强 |
| **代理** | **不改**接口，控访问 | 挡在前面管访问 |
| **外观** | **简化**一组接口 | 给复杂子系统一个简单入口 |

四个都是“包一层”，区别全在**意图**。适配器的意图独一份：**转换接口**。

- **别让适配器承担过多逻辑。** 适配器该薄——只做接口翻译。如果你发现它里面塞了业务规则、状态管理，那它已经不是适配器了，该拆。

## 五、开源里怎么用

- **Go `http.HandlerFunc`——神来之笔，必看。** `http.Handler` 是个接口(要求有 `ServeHTTP` 方法)，但你写 handler 时明明只想写个普通函数。标准库定义了：
  ```go
  type HandlerFunc func(ResponseWriter, *Request)
  func (f HandlerFunc) ServeHTTP(w ResponseWriter, r *Request) { f(w, r) }
  ```
  这就是**把“函数”适配成“接口”**！`http.HandlerFunc(myFunc)` 一转，你的普通函数就满足了 `Handler` 接口。同款手法还有 `sort.Reverse`(把一个 `Interface` 适配成“反着比”的 `Interface`)。
- **Go `io` 包**：`io.NopCloser(r)` 把一个只有 `Read` 的 `Reader` 适配成带空 `Close` 的 `ReadCloser`——很多 API 要求 `ReadCloser`，而你手头只有 `Reader`，一个适配器搞定。
- **Java I/O**:`InputStreamReader` 把字节流(`InputStream`)适配成字符流(`Reader`)，是 JDK 里教科书级的适配器；`Arrays.asList()` 把数组适配成 `List`。
- **各类 SDK 的“兼容层”**：接入多家云厂商/多个支付渠道/多个短信服务商时，几乎必然为每一家写一个适配器，对上暴露统一接口。这是适配器在真实业务里最高频的用法。

---

适配器**转换**接口。下一篇[装饰器](/manual/computer-programming/design-patterns/decorator)：同样是“包一层”，但它不改接口，而是**层层叠加功能**——顺便你会见到 Go 的 `io` 包这个装饰器天堂。
