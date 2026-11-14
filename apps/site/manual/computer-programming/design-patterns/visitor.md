---
title: "访问者 · Visitor（行为型）"
description: "元素类型稳定，却要频繁给它们新增各种操作(算面积、渲染、导出...)——把“操作”从元素类里抽出去，新增操作只需加一个访问者。讲清双重分派这个绕人的核心机制，以及访问者“加操作易、加类型难”的著名短板。"
source: "https://daiw.org/manual/design-patterns/visitor"
---

# 访问者 · Visitor（行为型）

元素类型稳定，却要频繁给它们新增各种操作(算面积、渲染、导出...)——把“操作”从元素类里抽出去，新增操作只需加一个访问者。讲清双重分派这个绕人的核心机制，以及访问者“加操作易、加类型难”的著名短板。

出了名的烧脑模式。它的机制(双重分派)绕，适用场景也窄。但理解了它，你对“面向对象的边界在哪”会有全新的认识。

## 一、这是什么：给一批货物做各种检查

海关有一批货物，类型是固定的：液体、固体、危险品。但要对它们做的**操作**层出不穷：今天称重，明天估税，后天做安检，大后天出口报关……

注意这里的不对称：**货物类型很稳定(就那几种)，但要施加的操作源源不断地新增。** 如果每来一种新操作，就往每个货物类里加一个方法(液体加个 `估税()`、固体加个 `估税()`……)，货物类会越来越臃肿，而且每加一种操作要改所有货物类。

访问者模式反其道而行：**把“操作”抽出来，做成一个个独立的“访问者”。货物类只提供一个“接受访问者”的入口，具体做什么由访问者决定。新增操作 = 新增一个访问者，货物类一行不改。**

配套代码是图形：`Circle`/`Rectangle` 是稳定的元素，`AreaVisitor`(算面积)、`DrawVisitor`(渲染)是操作。加“导出 SVG”？写个 `SVGVisitor`，图形类不动。

## 二、解决什么痛：操作频繁新增，元素类不堪重负

把操作直接塞进元素类，痛在“加操作要改所有元素”：

```go
// 痛点:每加一个操作,Circle 和 Rectangle 都得加一个方法
type Circle struct{ /*...*/ }
func (c *Circle) Area() float64 { /*...*/ }
func (c *Circle) Draw()         { /*...*/ }
func (c *Circle) ExportSVG()    { /*...*/ }   // 新操作:两个类都得加
// Rectangle 同理,每个操作都要在每个图形类里重复实现一遍
```

更糟的是，这些操作可能职责各异(渲染是 UI 的事、估税是财务的事、报关是物流的事)，全塞进图形类，让图形类变成一个什么都懂的“万金油”，严重违反单一职责。

::: info
**访问者隔离的“会变的东西”，是“施加在一组稳定元素上的操作”。** 它把“操作”从元素类里彻底搬出去，让每个操作成为一个独立的访问者类。元素只保留一个“接受访问”的钩子，把“具体做什么”完全委托出去。于是加操作 = 加一个访问者(集中在一个类里，还能把同类操作的逻辑聚在一处)，元素类保持稳定和干净。
:::

## 三、怎么实现：双重分派

访问者的核心机制叫**双重分派(double dispatch)**，这是它最绕、也最精髓的地方。慢慢看：

**go/visitor/main.go（核心）**

```go
// 元素:提供"接受访问者"的入口
type Shape interface{ Accept(visitor ShapeVisitor) }

// 访问者:为每种具体元素声明一个 Visit 方法
type ShapeVisitor interface {
	VisitCircle(c *Circle)
	VisitRectangle(r *Rectangle)
}

// 具体元素:Accept 里回调访问者中"对应自己类型"的那个方法
func (c *Circle) Accept(v ShapeVisitor)    { v.VisitCircle(c) }     // ← 我是圆,调 VisitCircle
func (r *Rectangle) Accept(v ShapeVisitor) { v.VisitRectangle(r) }  // ← 我是矩形,调 VisitRectangle

// 具体访问者:实现对每种元素的操作
type AreaVisitor struct{ TotalArea float64 }
func (v *AreaVisitor) VisitCircle(c *Circle)       { v.TotalArea += math.Pi*c.Radius*c.Radius }
func (v *AreaVisitor) VisitRectangle(r *Rectangle) { v.TotalArea += r.Width*r.Height }
```

**最终调用哪个方法，由两个类型共同决定**——这就是“双重”分派：

1. **第一次分派**：`shape.Accept(v)` —— 由 `shape` 的**具体类型**(圆？矩形？)决定进哪个 `Accept`。
2. **第二次分派**：`Accept` 内部 `v.VisitCircle(c)` —— 由 `v` 的**具体类型**(算面积？渲染？)决定进哪个 `Visit`。

两次一叠加，`(圆, 算面积)`、`(矩形, 渲染)`……每个组合精确命中对应的方法。用起来：

```go
for _, s := range shapes { s.Accept(&AreaVisitor{}) }   // 对所有图形算面积
for _, s := range shapes { s.Accept(&DrawVisitor{}) }   // 换个访问者,全体渲染
```

::: warning
为什么要这么绕？因为 Go/Java 这类语言只有**单分派**(方法调用只根据接收者一个类型动态决定)，没有原生的“根据两个对象的类型选方法”。`Accept` 回调这一手，正是用两次单分派**手工模拟出双重分派**。理解这一点，你就理解了访问者存在的根本理由——它是在给语言“打补丁”。
:::

## 四、有哪些坑

- **著名短板：加“操作”易如反掌，加“元素类型”是灾难。** 这是访问者最该记住的取舍，和[抽象工厂](/manual/computer-programming/design-patterns/abstract-factory)的维度问题异曲同工：
  - 加一个**操作**(新访问者)：写个新类实现 `ShapeVisitor` 即可，元素类不动。**爽。**
  - 加一个**元素类型**(比如新增 `Triangle`)：你得给 `ShapeVisitor` 接口加一个 `VisitTriangle`，然后**每一个**已有访问者都得实现它。**噩梦。**

  所以判据很硬：**只有当元素类型高度稳定、而操作频繁增删时，才用访问者。** 反过来(类型常变、操作稳定)，用访问者就是自找苦吃——那种情况下，把方法放进元素类反而对。
- **破坏元素封装。** 访问者要干活，往往需要访问元素的内部数据，这就迫使元素把内部状态暴露给访问者(上面 `c.Radius` 得是可读的)。封装性和“操作外置”在这里有天然的张力。
- **Go 的小别扭：没有方法重载。** Java 里可以都叫 `visit(Circle)`、`visit(Rectangle)` 靠重载区分，Go 不行，只能起不同名字 `VisitCircle`/`VisitRectangle`。元素类型一多，访问者接口会很长。
- **它很重，别轻易用。** 访问者引入的间接和样板不少。除非你确实撞上了“稳定类型 + 爆炸式增长的操作”，否则优先考虑更简单的手段(比如给类型加方法、或用类型 switch)。

## 五、开源里怎么用

- **编译器 / AST 遍历 —— 访问者的典型主场。** Go 的 `go/ast` 提供 `ast.Walk(visitor, node)` 和 `ast.Visitor` 接口，让你对语法树的各类节点施加操作：类型检查、代码生成、格式化、静态分析……每种操作是一个访问者，而 AST 节点类型高度稳定——**恰好契合访问者的适用条件**。你用过的 `gofmt`、`go vet`、各种 linter，底层都在用它。
- **Java 注解处理 / `javax.lang.model.element.ElementVisitor`**：编译期处理注解、遍历程序元素，标准库直接给了访问者接口。
- **Protobuf / Thrift 编译器**：遍历 IDL 定义的 AST，为不同目标语言生成代码——每个语言的生成器就是一个访问者。
- **静态分析 / 代码检查工具**：ESLint、各类 linter 遍历 AST 施加检查规则，规则即访问者。**凡是“稳定的树结构 + 花样繁多的处理操作”，十有八九能看到访问者。**

---

访问者把“操作”从“元素”里剥离。行为型最后一位，也是 GoF 里最冷门的一个。下一篇[解释器](/manual/computer-programming/design-patterns/interpreter)：怎么给一个简单的小语法(算术表达式、查询条件)定义规则并求值——以及为什么现实中你几乎永远不该手写它。
