---
title: "组合 · Composite（结构型）"
description: "对象能包含同类对象、层层嵌套成一棵树(文件夹装文件也装文件夹)，而你想“一视同仁”地对待单个和一组。讲清组合模式的递归结构、透明性与安全性的经典取舍，以及 go/ast 这样的真实树。"
source: "https://daiw.org/manual/design-patterns/composite"
---

# 组合 · Composite（结构型）

对象能包含同类对象、层层嵌套成一棵树(文件夹装文件也装文件夹)，而你想“一视同仁”地对待单个和一组。讲清组合模式的递归结构、透明性与安全性的经典取舍，以及 go/ast 这样的真实树。

结构型最后两位。这一篇讲**树**：当对象能装下同类对象、层层嵌套时，怎么让“一个”和“一堆”用起来毫无差别。

## 一、这是什么：文件夹里能装文件，也能装文件夹

看你电脑的文件系统：一个文件夹里，能放**文件**，也能放**子文件夹**；子文件夹里又能放文件和更深的文件夹……无限递归下去，长成一棵树。

现在你要算“这个文件夹总共多大”。你会怎么想？——“把里面每一项的大小加起来”。而“每一项”可能是文件(直接有大小)，也可能是子文件夹(它的大小又是它里面所有项之和)。**神奇的是：你处理它们的方式一模一样——都是问一句“你多大？”，不用管它到底是文件还是文件夹。**

组合模式就是干这个的：**把对象组织成树形结构，并让你用统一的方式对待“叶子”(单个对象)和“容器”(一组对象)。** 公司组织架构(部门里有员工也有子部门)、菜单(菜单项里有子菜单)、GUI 控件树，全是这个结构。

配套代码就是文件系统：`File`(叶子)和 `Directory`(容器)都实现同一个 `FileSystemNode` 接口，算总大小时对二者一视同仁。

## 二、解决什么痛：客户端被迫区分“单个”和“一组”

如果没有统一接口，处理树会痛成这样：

```go
// 痛点:每碰一个节点都要先问"你是文件还是文件夹?"
func totalSize(node any) int64 {
	switch n := node.(type) {
	case *File:
		return n.size
	case *Directory:
		var sum int64
		for _, child := range n.children {
			sum += totalSize(child)   // 还得手动递归,还得手动分类型
		}
		return sum
	}
	return 0
}
```

到处是 `if 是文件夹 { 递归 } else { 直接取 }`。这种类型判断散落在每个要遍历树的地方，加一种节点类型(比如“符号链接”)就得把所有这种 `switch` 找出来改一遍。

::: info
**组合隔离的“会变的东西”，是“某个节点到底是叶子还是容器”。** 它让叶子和容器实现同一个接口，把“我是谁、我要不要递归”的判断，从客户端**收进每个节点自己内部**。客户端只管对着统一接口喊 `Size()`，递归由容器节点自己负责——客户端代码里再也不会出现“如果是文件夹就……”。
:::

## 三、怎么实现：叶子与容器实现同一接口，容器负责递归

**go/composite/main.go（核心）**

```go
// 统一接口:文件和目录都是"文件系统节点"
type FileSystemNode interface {
	Name() string
	Size() int64
	Print(indent string)
}

// 叶子:文件,大小就是自己的大小
type File struct{ name string; size int64 }
func (f *File) Size() int64 { return f.size }

// 容器:目录,大小 = 递归累加所有孩子(孩子是文件还是目录?不关心!)
type Directory struct {
	name     string
	children []FileSystemNode      // ← 装的是接口,文件目录皆可
}
func (d *Directory) Size() int64 {
	var total int64
	for _, child := range d.children {
		total += child.Size()       // ← 统一调 Size(),递归自然发生
	}
	return total
}
```

于是搭一棵树、算总大小，干净利落，全程没有一次类型判断：

```go
root := NewDirectory("project")
root.Add(src).Add(docs).Add(NewFile("go.mod", 50))   // 目录里混装目录和文件
fmt.Println(root.Size())                              // 一句话递归算完
```

## 四、有哪些坑

- **透明性 vs 安全性：组合模式最经典的取舍。** `Add`/`Remove`(管理孩子)这类方法该放哪？两派：
  - **透明式**：放进**统一接口**，叶子和容器都有 `Add`。好处是客户端完全不用区分二者(最透明)；坏处是“给一个文件 `Add` 一个孩子”在语义上是错的，叶子只能给个空实现或报错(不安全)。
  - **安全式**：`Add`/`Remove` **只放在容器**(`Directory`)上。好处是叶子压根没有 `Add`，类型安全；坏处是客户端想加孩子时，得先确认“这是个容器”(牺牲一点透明)。

  配套代码选了**安全式**(只有 `Directory` 有 `Add`)，这也更符合 Go 的口味(小接口 + 需要时类型断言)。两条路没有绝对对错，看你更怕“叶子被误用”还是更怕“客户端要判断类型”。
- **递归深了会栈溢出。** 树特别深(比如几万层)时，朴素递归会爆栈。真遇到超深树，得改用显式栈的迭代遍历。
- **组合天生和迭代器、访问者是好搭档。** 遍历这棵树用[迭代器](/manual/computer-programming/design-patterns/iterator)，对树上每个节点执行不同操作用[访问者](/manual/computer-programming/design-patterns/visitor)——后面会讲到，它们常常一起出现。

## 五、开源里怎么用

- **Go `go/ast`(抽象语法树)**：Go 编译器/工具链把源码解析成一棵 AST，每个节点都实现 `ast.Node` 接口，`ast.Inspect` 递归遍历整棵树——你写 `gofmt`、`golint`、代码生成器时打交道的就是它。教科书级的组合。
- **Go `io/fs`**:`fs.FS` 抽象出的文件树，`fs.WalkDir` 统一遍历目录和文件，不用区分。
- **DOM 树 / 虚拟 DOM**：浏览器的 DOM(`Node` 有 `Element`、`Text` 等，元素能嵌套元素)、React/Vue 的虚拟 DOM，都是组合模式的巨型实例——整个前端建立在这棵树上。
- **GUI 控件树**：几乎所有 UI 框架(Swing 的 `Container`/`Component`、Qt、Flutter 的 Widget 树)都用组合：容器控件里放叶子控件或子容器，布局、绘制、事件分发全靠对这棵树的统一递归。

---

组合管“树形结构”。结构型最后一篇[享元](/manual/computer-programming/design-patterns/flyweight)：当树上/场景里的对象多到**成千上万**、内存扛不住时，怎么靠“共享”把它们塞进有限的内存里。
