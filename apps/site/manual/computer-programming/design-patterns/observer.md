---
title: "观察者 · Observer（行为型）"
description: "一个对象状态变了，一大群依赖它的对象要自动跟着更新——还不能让它俩硬耦合。观察者是“事件驱动”整个世界的地基。讲清一对多通知、推拉模型、忘记退订的内存泄漏，以及 Go channel 这个更 Go 的答案。"
source: "https://daiw.org/manual/design-patterns/observer"
---

# 观察者 · Observer（行为型）

一个对象状态变了，一大群依赖它的对象要自动跟着更新——还不能让它俩硬耦合。观察者是“事件驱动”整个世界的地基。讲清一对多通知、推拉模型、忘记退订的内存泄漏，以及 Go channel 这个更 Go 的答案。

如果说有哪个模式撑起了半个软件世界，那就是观察者：GUI 的事件、前端的响应式、消息队列的发布订阅、微服务的事件驱动……全是它的变体。

## 一、这是什么：关注了一个公众号

你关注了某个公众号。作者发新文章时，**主动推送**给每一个关注者；你不用天天去他主页刷“更新了没”。你随时能关注(订阅)，也随时能取关(退订)。作者不认识你是谁，他只管“群发给所有关注者”。

观察者模式就是这套订阅关系：**一个“主题”(被观察者)维护一份“观察者”名单，当自己状态变化时，自动通知名单上的每一个观察者。一对多，而且能动态增删订阅者。**

配套代码是气象站：`WeatherStation`(主题)温度一变，自动通知所有订阅的显示设备(手机、电子广告牌)，它们各自更新。

## 二、解决什么痛：主题不该硬编码知道所有观察者

假设气象站要在温度变化时更新手机和广告牌。最直接的写法：

```go
// 痛点:气象站被迫认识每一个具体的显示设备
func (w *WeatherStation) SetTemperature(t float64) {
	w.temperature = t
	w.phoneDisplay.Update(t)      // ← 硬编码依赖手机
	w.billboard.Update(t)         // ← 硬编码依赖广告牌
	// 新加一个网页显示?回来改这里。再加一个手表?再改......
}
```

病根：**主题和每个观察者死死耦合**。加一种显示设备就得改气象站；气象站还得持有所有设备的具体引用。主题这个“发布方”被拖进了“到底有哪些订阅方”的泥潭里，而这本不该是它操心的事。

::: info
**观察者隔离的“会变的东西”，是“到底有哪些对象关心这个变化、以及它们各自怎么响应”。** 主题只面对一个抽象的“观察者名单”，发通知时挨个 `Update` 一遍，根本不关心名单里具体是谁、它们收到后干什么。订阅方随时增删，主题岿然不动——发布方和订阅方彻底解耦。
:::

## 三、怎么实现：名单 + 通知

主题维护观察者切片，提供订阅(`Attach`)、退订(`Detach`)、通知(`Notify`)；状态变化时遍历名单挨个通知。

**go/observer/main.go（核心）**

```go
type Observer interface{ Update(temperature float64) }

type WeatherStation struct {
	observers   []Observer      // ← 订阅者名单,只认抽象接口
	temperature float64
}
func (w *WeatherStation) Attach(o Observer) { w.observers = append(w.observers, o) }
func (w *WeatherStation) Notify() {
	for _, o := range w.observers {
		o.Update(w.temperature)  // ← 挨个通知,不关心具体是谁
	}
}
func (w *WeatherStation) SetTemperature(t float64) {
	w.temperature = t
	w.Notify()                   // ← 状态一变,自动广播
}
```

订阅、退订都是运行时的事：

```go
station.Attach(phone); station.Attach(billboard)  // 两个都订阅
station.SetTemperature(26.5)                        // 俩都收到
station.Detach(phone)                               // 手机退订
station.SetTemperature(18.0)                         // 只剩广告牌收到
```

## 四、有哪些坑

- **忘记退订 = 内存泄漏。** 这是观察者头号事故。主题的名单一直引用着观察者，观察者就永远不会被回收——哪怕它早该销毁了。GUI 里“页面关了监听器还在”“对象没了事件还绑着”，十有八九是忘了 `Detach`。**订了就要记得退**。
- **别在 `Update` 里改主题状态。** 观察者收到通知后又去改主题，可能触发新一轮通知，轻则顺序混乱，重则无限循环。通知过程中，保持观察者“只读响应”。
- **同步通知会被慢观察者拖垮。** `Notify` 挨个同步调用，只要有一个观察者的 `Update` 很慢(比如发网络请求)，整条通知链就被它卡住。观察者多、响应重时，考虑异步通知(下面 channel 版天然适合)。
- **推模型 vs 拉模型。** `Update(temperature)` 直接把数据“推”给观察者(简单，但主题得预判观察者要什么)；另一种是只通知“我变了”，观察者自己回来“拉”需要的数据(灵活，但多一次交互)。按需求选。

::: info
**Go 味：很多时候 channel 才是更地道的“观察者”。** Go 的 `chan` + goroutine 天生就是发布-订阅：主题往 channel 发消息，多个订阅者从各自 channel 收。它天然异步、天然并发安全、天然解耦，连 `Attach/Detach` 的名单管理都能用 channel 的关闭来表达。写 Go 时，先想想“这个联动能不能用 channel”，往往比手搓观察者接口更清爽。
:::

## 五、开源里怎么用

- **前端事件系统**：`element.addEventListener('click', handler)` 就是观察者——DOM 元素是主题，你注册的回调是观察者。整个浏览器交互模型建立在此之上。
- **响应式编程(RxJS、Vue 的响应式、React 的状态订阅)**：数据变了，依赖它的视图自动重渲染——观察者的工业级放大版。
- **消息队列(Kafka / RabbitMQ 的 pub-sub)**：生产者发布到 topic，所有订阅该 topic 的消费者收到——**观察者模式在分布式系统里的形态**，主题和观察者甚至不在同一台机器上。
- **Java**:`java.util.Observer`(注意：已被官方废弃，因为设计过于简陋，是个反面教材)、`PropertyChangeListener`、Swing 的各种事件监听器。废弃 `Observer` 这件事本身也说明：**观察者的思想永恒，但具体 API 可以很烂，别照抄。**

---

观察者是“一个变、多个响应”的广播。下一篇[命令](/manual/computer-programming/design-patterns/command)：我们把“一个操作请求”本身打包成对象，于是它能被存储、排队、记录，甚至撤销和重做。
