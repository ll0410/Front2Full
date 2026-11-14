---
title: "工厂方法 · Factory Method（创建型）"
description: "当“到底该 new 哪个具体类”本身就是会变的东西时，把这个决定从业务代码里赶出去，下放给专门的工厂。讲清工厂方法解决的耦合痛点、Go 的接口实现、以及它和“简单工厂”的区别。"
source: "https://daiw.org/manual/design-patterns/factory-method"
---

# 工厂方法 · Factory Method（创建型）

当“到底该 new 哪个具体类”本身就是会变的东西时，把这个决定从业务代码里赶出去，下放给专门的工厂。讲清工厂方法解决的耦合痛点、Go 的接口实现、以及它和“简单工厂”的区别。

上一篇的单例管的是“只造一个”。这一篇更进一步：**造哪个，我现在还不知道。**

## 一、这是什么：你点外卖，不关心是谁在颠勺

你在 App 上点了份宫保鸡丁。你关心的是“我要一份宫保鸡丁”，至于是张师傅还是李师傅炒的、用的是燃气灶还是电磁炉——**你不关心，也不应该关心。** App 只管把“做一份菜”的请求发出去，具体哪个厨房、哪口锅，由后厨自己决定。

工厂方法就是干这个的：**它定义一个“创建产品”的方法，但把“到底创建哪个具体产品”的决定权，交给子类(或具体实现)。** 调用方拿到的永远是一个抽象的“产品”，不碰具体类型。

配套代码用的是物流的例子：你要“运货”，至于用卡车还是轮船，交给具体的物流公司去定。

## 二、解决什么痛：满地都是 `new ConcreteClass()`

先看不用工厂方法有多难受。假设你的业务代码里直接这么写：

```go
// 痛点代码:业务逻辑和"具体用哪个运输工具"死死焊在一起
func planDelivery(mode string) string {
	var t Transport
	if mode == "road" {
		t = &Truck{}       // ← 硬编码具体类型
	} else if mode == "sea" {
		t = &Ship{}        // ← 硬编码具体类型
	}
	// ...一堆基于 t 的通用逻辑...
	return t.Deliver()
}
```

这段代码的病根在于：**它既负责“业务流程”，又负责“决定造哪个类”。** 于是——

- 哪天要加“空运”(`Plane`)，你得回来改这个 `if-else`。
- 类似的 `if mode == ...` 判断，往往在代码库里散落好几处，加一个类型要改一圈，漏一处就是 bug。
- 这直接违反了**开闭原则**(对扩展开放，对修改关闭)：加新类型本该“只增不改”，现在却要动老代码。

::: info
**一句话抓住本质：工厂方法隔离的“会变的东西”，就是“具体产品类”。** 业务流程是稳定的(总是“规划路线→运输”)，会变的是“用哪种运输工具”。把后者拎出去单独封装，业务流程就再也不用因为多了个运输方式而改动。
:::

## 三、怎么实现：抽象创建者 + 具体创建者

Go 的做法是把“创建”抽象成一个接口方法。业务逻辑只依赖这个接口，不认识任何具体产品：

**go/factory-method/main.go（核心）**

```go
// 抽象创建者:只声明工厂方法,造哪个 Transport 由实现者决定
type Logistics interface {
	CreateTransport() Transport
}

// 通用业务逻辑:完全不依赖具体产品,只通过工厂方法拿抽象产品
func PlanDelivery(l Logistics) string {
	transport := l.CreateTransport()      // ← 造谁?我不知道,也不想知道
	return "规划运输路线 -> " + transport.Deliver()
}

// 具体创建者:各自决定造什么
type RoadLogistics struct{}
func (r *RoadLogistics) CreateTransport() Transport { return &Truck{} }

type SeaLogistics struct{}
func (s *SeaLogistics) CreateTransport() Transport { return &Ship{} }
```

现在加“空运”是什么体验？**新增一个 `AirLogistics` + `Plane`，一行老代码都不用改。** `PlanDelivery` 岿然不动。这就是开闭原则落地的样子。

Java 里这个模式的形态更“标准”(因为 Java 靠继承)，抽象创建者是个抽象类：

**Java —— 工厂方法常以抽象类形式出现**

```java
abstract class Logistics {
    abstract Transport createTransport();       // 工厂方法,交给子类实现
    String planDelivery() {                      // 复用的业务骨架
        return "规划路线 -> " + createTransport().deliver();
    }
}
class RoadLogistics extends Logistics {
    Transport createTransport() { return new Truck(); }
}
```

注意这里的味道差异：Java 用“继承 + 覆写抽象方法”来下放决定权，而 Go 用“实现接口”。Go 没有继承，反而让这个模式显得更轻——**工厂方法的精髓从来不是“继承”，而是“把创建行为抽象成一个可替换的点”。**

## 四、有哪些坑

- **别和“简单工厂”搞混。** 你可能见过一个 `NewTransport(mode string) Transport` 函数，内部一个 `switch` 造不同对象——那叫**简单工厂**(Simple Factory)，**它不是 GoF 的工厂方法**，甚至不算正式模式。区别在于：简单工厂把 `switch` 收拢到一个函数里(治标，加类型还是要改那个 switch)；工厂方法则通过多态彻底消灭了 `switch`(治本，加类型只需新增类)。简单工厂胜在简单，小场景够用；别看见“工厂”俩字就以为是同一个东西。
- **别为了模式而模式。** 如果你就一种产品，而且看不到未来会有第二种，直接 `new` 它、或者写个朴素的 `NewXxx()` 构造函数就好。凭空引入抽象创建者接口，是拿真实的复杂度去换想象中的灵活性，**纯亏**。
- **Go 味提醒：** 大量场景下，Go 根本不需要“抽象创建者”这一层。一个返回接口的普通函数 `func NewTransport(kind Kind) Transport` 就解决了绝大多数需求。只有当“创建逻辑本身要随上下文多态变化”(比如不同物流公司有各自成套的创建策略)时，完整的工厂方法才真正值回票价。

::: warning
判断要不要上工厂方法，就问一句：**“未来会不会冒出新的产品类型，而我不想每次都改调用方？”** 答“会”，用；答“不确定”或“不会”，先别用，等痛了再重构进来也不迟。
:::

## 五、开源里怎么用

- **Go `database/sql`**：堪称工厂方法的活教材。驱动通过 `sql.Register("mysql", &MySQLDriver{})` 注册，你调 `sql.Open("mysql", dsn)` 时，标准库根据名字找到对应驱动，由**驱动自己**创建连接。你的业务代码只认 `*sql.DB` 和 `driver.Conn` 接口，换成 postgres 只改一个字符串——具体连接对象由谁造？驱动这个“具体创建者”造。
- **Go `image` 包**：`image.Decode` 依据注册的格式(png/jpeg/gif)把字节流解码成 `image.Image`，各格式包在 `init()` 里注册自己的解码器。同一个“注册 + 按需创建”的骨架。
- **Java JDK**:`Collection.iterator()` 是教科书级工厂方法——每种集合返回自己的 `Iterator` 实现；`Calendar.getInstance()` 依据地区/时区返回具体的 `Calendar` 子类。
- **日志门面(SLF4J / Go 的 `log/slog`)**：你面向抽象的 `Logger` 接口编程，具体产出哪个后端的 logger 实例，由工厂决定。

这些例子有个共同气质：**调用方永远只跟“抽象产品”打交道，“具体是谁”这件事被牢牢关在工厂里。** 记住这个气质，你在任何代码库里都能一眼认出工厂方法。

---

工厂方法一次造“一个”产品。下一篇[抽象工厂](/manual/computer-programming/design-patterns/abstract-factory)，我们要一次造“一整族”配套的产品——并保证它们不会串味。
