---
title: "模板方法 · Template Method（行为型）"
description: "一堆流程骨架相同、只有个别步骤不同——把骨架写一次，把变化的步骤留给各自填。讲清“好莱坞原则”(别调用我，我会调用你)、模板方法与策略的区别，以及 Go 用组合+接口如何表达这个本靠继承的模式。"
source: "https://daiw.org/manual/design-patterns/template-method"
---

# 模板方法 · Template Method（行为型）

一堆流程骨架相同、只有个别步骤不同——把骨架写一次，把变化的步骤留给各自填。讲清“好莱坞原则”(别调用我，我会调用你)、模板方法与策略的区别，以及 Go 用组合+接口如何表达这个本靠继承的模式。

这是 23 个模式里**最朴素**的一个，朴素到你八成早就在无意识中用过。它的核心就一句话：**把不变的流程骨架固定下来，把会变的步骤挖空留给别人填。**

## 一、这是什么：泡茶和泡咖啡，流程八成一样

泡一杯茶：烧开水 → 泡茶叶 → 倒进杯子 → 加柠檬。
冲一杯咖啡：烧开水 → 冲咖啡粉 → 倒进杯子 → 加奶和糖。

看出来了吗？**流程骨架一模一样**(烧水→冲泡→倒杯→加料)，只有第 2 步和第 4 步的**具体做法**不同。你不会为茶和咖啡各写一套完全独立的流程——那“烧水”“倒杯”的逻辑就重复了。

模板方法就是：**在一个方法里定义好流程的骨架(步骤顺序固定)，把其中会变的步骤声明成“待填的空”，由具体的子类型去填。** 骨架只写一次，变化的步骤各填各的。

配套代码就是这杯饮料：`Prepare()` 是固定骨架，`Brew()`(怎么冲泡)和 `AddCondiments()`(加什么料)是挖空的步骤，`Tea` 和 `Coffee` 各自填。

## 二、解决什么痛：流程重复，却又不完全一样

如果茶和咖啡各写各的：

```go
func (t *Tea) Prepare() {
	boilWater()           // ← 重复
	steepTea()            // 不同
	pourInCup()           // ← 重复
	addLemon()            // 不同
}
func (c *Coffee) Prepare() {
	boilWater()           // ← 和上面一样,重复了
	brewCoffee()          // 不同
	pourInCup()           // ← 又重复
	addMilkSugar()        // 不同
}
```

“烧水”“倒杯”这些公共步骤被抄了两遍。加个“泡奶茶”，再抄一遍。**共同的流程骨架散落在每个变体里，改一处骨架(比如“倒杯前先温杯”)要改所有变体。**

::: info
**模板方法隔离的“会变的东西”，是“流程中那几个具体步骤”，同时锁死“流程的骨架与顺序”。** 它把“稳定的编排”和“变化的步骤”分开：骨架收拢到一个模板方法里写一次，变化点挖成“空”交给具体类型填。这样公共流程再不重复，而各变体只需关心“我这几步怎么做”。
:::

## 三、怎么实现：Go 用组合 + 接口，而非继承

经典模板方法靠**继承**：父类写模板方法(骨架)和抽象步骤方法，子类覆写抽象步骤。但 Go 没有继承，它用**接口委托 + 组合**表达同一意图：

**go/template-method/main.go（核心）**

```go
// 会变的步骤,声明成接口(相当于"挖的空")
type BeverageSteps interface {
	Name() string
	Brew() string
	AddCondiments() string
}

// 模板:持有 steps,Prepare 就是那个"模板方法"——骨架固定,空由 steps 填
type Beverage struct{ steps BeverageSteps }
func (b *Beverage) Prepare() {
	fmt.Println("1. 烧开水")              // 固定
	fmt.Println("2.", b.steps.Brew())     // ← 空:交给具体类型
	fmt.Println("3. 倒入杯中")            // 固定
	fmt.Println("4.", b.steps.AddCondiments()) // ← 空:交给具体类型
}

// 具体步骤:茶,只需填自己那几步
type Tea struct{}
func (t *Tea) Brew() string          { return "用沸水浸泡茶叶" }
func (t *Tea) AddCondiments() string { return "加入柠檬片" }
```

用起来，骨架被复用，步骤各填各的：

```go
NewBeverage(&Tea{}).Prepare()      // 按骨架泡茶
NewBeverage(&Coffee{}).Prepare()   // 同一套骨架冲咖啡
```

::: warning
注意 Go 版的微妙之处：它其实介于“模板方法”和“[策略](/manual/computer-programming/design-patterns/strategy)”之间——`Beverage` **组合**了一个 `BeverageSteps`(像策略)，但 `Prepare` 固定编排这些步骤(像模板方法)。经典 Java 模板方法是“子类继承父类、覆写钩子”，编译期绑定；Go 用组合把“变化的步骤”作为一个对象注入，更灵活。**这再次印证：没有继承的语言，模板方法会自然长成组合的样子。**
:::

## 四、有哪些坑

- **它是“好莱坞原则”的化身：“别调用我，我会调用你”(Don't call us, we'll call you)。** 控制权在骨架(高层)手里，它在需要时回调你填的步骤(低层)，而不是你去调它。这正是框架和库的根本区别——**框架用模板方法调用你的代码**(你填 `doGet`，框架的 `service()` 骨架来调你)，库是你调它的代码。
- **别把太多步骤开放为可覆写。** 挖的“空”越多，骨架就越不稳定，复用价值越低，甚至退化成“什么都能改”。只挖真正该变的那几步，其余焊死。
- **钩子(hook)方法。** 除了必填的步骤，还可以留“可选钩子”(默认空实现，子类想插手才覆写)，比如“要不要加料”由钩子 `wantsCondiments()` 决定。这是模板方法的常见增强。
- **和策略的分野：** 模板方法固定**整个流程骨架**、只让你换其中几步(粒度细，骨架是老大)；策略是把**整个算法**换掉(粒度粗，一次换一坨)。一个是“填空”，一个是“整段替换”。

## 五、开源里怎么用

- **Go `sort.Sort(data)`**：标准库定义了排序的骨架，要求你的类型实现 `Len()`/`Less()`/`Swap()` 三个步骤。排序算法(骨架)标准库写好，“怎么比、怎么换”由你填——浓浓的模板方法味(虽然它也常被归为策略，两者本就相邻)。
- **Java `AbstractQueuedSynchronizer`(AQS)**:JUC 并发包的基石，`ReentrantLock`、`Semaphore`、`CountDownLatch` 全建在它之上。AQS 用模板方法固定了“排队/阻塞/唤醒”的骨架，只让子类填 `tryAcquire`/`tryRelease` 这几步——模板方法的巅峰之作。
- **Java `HttpServlet`**:`service()` 是骨架，根据请求方法回调 `doGet()`/`doPost()`——你只填后者。所有 Servlet 框架的核心套路。
- **测试框架**：`setUp() → test() → tearDown()` 的固定生命周期骨架，你只填中间的测试逻辑——JUnit、Go `testing`、pytest 全是这个结构。

---

模板方法固定“流程骨架”。下一篇[迭代器](/manual/computer-programming/design-patterns/iterator)：怎么顺序访问一个集合的元素，却不用关心它内部到底是数组、链表还是树——顺便看看 Go 1.23 给这个古老模式带来的现代答案。
