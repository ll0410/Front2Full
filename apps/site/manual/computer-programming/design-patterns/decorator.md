---
title: "装饰器 · Decorator（结构型）"
description: "想给对象动态叠功能，又不想被继承的组合爆炸淹死。讲清装饰器“同接口层层包裹”的思路、Go 的组合实现，以及为什么 Go 的 io 包是学装饰器的绝佳教材。"
source: "https://daiw.org/manual/design-patterns/decorator"
---

# 装饰器 · Decorator（结构型）

想给对象动态叠功能，又不想被继承的组合爆炸淹死。讲清装饰器“同接口层层包裹”的思路、Go 的组合实现，以及为什么 Go 的 io 包是学装饰器的绝佳教材。

上一篇适配器“包一层”是为了**改接口**。这一篇同样“包一层”，目的却是**在不改接口的前提下，给对象层层叠加新功能**。

## 一、这是什么：咖啡加料，加一样算一样钱

星巴克点单：一杯 Espresso 15 块。加份牛奶，+3；再加份糖，+1.5；再加一份糖，又 +1.5。每加一“层”料，描述变长一点，价钱涨一点，但它**始终还是一杯“饮品”**——你还是能对它问“你叫啥”“多少钱”。

装饰器模式就是这个“加料”过程：**用一个装饰对象把原对象包起来，包一层加一点功能，而包出来的东西和原对象长得一样(实现同一个接口)，于是可以继续往外包。** 俄罗斯套娃、穿衣服一层层加，都是一个道理。

配套代码就是这杯咖啡：`Espresso` 外面包 `MilkDecorator`，再包 `SugarDecorator`，每层的 `Cost()` 都是“被包对象的价 + 自己这层的价”。

## 二、解决什么痛：继承会把你淹死

“给对象加功能”，第一反应往往是继承。但继承在这里会引发**组合爆炸**：

```
要"加牛奶的咖啡"→ 写个 MilkCoffee 子类
要"加糖的咖啡"→ 写个 SugarCoffee 子类
要"加牛奶又加糖的"→ 写个 MilkSugarCoffee 子类
要"加两份糖的"→ ......
```

三种料的自由组合就是 2³ 种子类，再来一种料直接翻倍。而且继承是**编译期就定死的**——你没法在运行时，根据用户临时的选择动态组装。这是继承的死穴：**它是静态的、组合会爆炸的。**

::: info
**装饰器隔离的“会变的东西”，是“对象要叠加哪些额外职责，以及叠加的顺序”。** 它用**组合 + 运行时包裹**代替**继承 + 编译期固定**，把 2ⁿ 的子类爆炸，压成 n 个可自由拼接的装饰器。要什么料，运行时现包。
:::

这正是 GoF 那条著名原则的活例：**优先使用对象组合，而非类继承**(Favor composition over inheritance)。

## 三、怎么实现：持有同接口对象，转调 + 增强

关键就一条：**装饰器自己也实现被装饰的那个接口**，并持有一个该接口的对象。方法里先转调内部对象，再叠加自己的增强。

**go/decorator/main.go（核心）**

```go
type Beverage interface {
	Description() string
	Cost() float64
}

type Espresso struct{}   // 具体组件:最里层的"本体"
func (e *Espresso) Description() string { return "Espresso 意式浓缩" }
func (e *Espresso) Cost() float64       { return 15.0 }

// 装饰器持有一个 Beverage(组合),自己也是 Beverage
type MilkDecorator struct {
	beverageDecorator          // 内嵌:复用"持有 wrapped"的能力
}
func (m *MilkDecorator) Description() string {
	return m.wrapped.Description() + " + 牛奶"   // 转调 + 增强
}
func (m *MilkDecorator) Cost() float64 {
	return m.wrapped.Cost() + 3.0                // 转调 + 增强
}
```

因为包出来的还是 `Beverage`，所以能一层层套下去，顺序随便你：

```go
var b Beverage = &Espresso{}
b = NewMilkDecorator(b)     // 加奶
b = NewSugarDecorator(b)    // 加糖
b = NewSugarDecorator(b)    // 再加一份糖
// b.Description() => "Espresso 意式浓缩 + 牛奶 + 糖 + 糖"
// b.Cost()        => 15 + 3 + 1.5 + 1.5 = 21
```

## 四、有哪些坑

- **装饰器必须和本体“接口透明”。** 包一层之后，外界不该看出它被包过——还是同一个接口。一旦装饰器加了本体没有的新方法，而调用方需要那个方法，透明性就破了(多层包裹后，里层的新方法会被“埋”住)。
- **顺序有时有意义。** “先加密再压缩”和“先压缩再加密”结果天差地别。装饰器允许自由组合，但不代表顺序无所谓——这是灵活性的代价。
- **多层包裹，调试栈很深。** 一个请求穿过十层装饰器，报错时调用栈能拉很长。灵活是有代价的，层数别为炫技而堆。
- **和代理长得几乎一样，靠意图区分。** 两者都“持有同接口对象再转调”。装饰器的意图是**加功能**(Cost 变了、Description 变了)；代理的意图是**控制访问**(功能不变，管的是能不能访问、何时访问)。下一篇细说。

## 五、开源里怎么用

- **Go `io` 包 —— 学装饰器的绝佳教材。** `io.Reader` 是那个统一接口，然后你可以疯狂套娃：
  ```go
  r := os.Open("data.gz")           // 原始文件流(Reader)
  r = bufio.NewReader(r)            // 装饰:加缓冲
  gz, _ := gzip.NewReader(r)        // 装饰:加 gzip 解压
  r = io.LimitReader(gz, 1<<20)     // 装饰:限制最多读 1MB
  ```
  每一层都接收一个 `Reader`、返回一个 `Reader`，和咖啡加料一模一样。读这段代码，你就彻底懂装饰器了。
- **Go HTTP 中间件**：`func(http.Handler) http.Handler` 这个签名就是装饰器——日志中间件、鉴权中间件、限流中间件，一层层把 handler 包起来，每层加一点横切功能。整个 Go Web 生态的中间件都建立在装饰器之上。
- **Java `java.io`**:`new BufferedInputStream(new FileInputStream(f))` 是 JDK 里最经典的装饰器嵌套，和 Go 的 `io` 同源同宗(装饰器模式当年很大程度就是为 I/O 流设计的)。
- **Python `@decorator` 语法**：虽然实现机制不同，但“用一个函数包住另一个函数、加点前后处理”的思想一脉相承，`@lru_cache`、`@log` 都是这个味。

---

装饰器**加功能**，代理**控访问**。它俩结构像双胞胎，意图却南辕北辙。下一篇[代理](/manual/computer-programming/design-patterns/proxy)，我们把这对双胞胎彻底分清。
