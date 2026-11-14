---
title: "迭代器 · Iterator（行为型）"
description: "顺序访问一个集合的元素，却不用关心它内部是数组、链表还是树。讲清迭代器怎么把“遍历”从“集合结构”里解耦出来，以及 Go 从 for-range 到 1.23 range-over-func 把这个古老模式内建进语言的过程。"
source: "https://daiw.org/manual/design-patterns/iterator"
---

# 迭代器 · Iterator（行为型）

顺序访问一个集合的元素，却不用关心它内部是数组、链表还是树。讲清迭代器怎么把“遍历”从“集合结构”里解耦出来，以及 Go 从 for-range 到 1.23 range-over-func 把这个古老模式内建进语言的过程。

这个模式你**每天都在用**，只是语言帮你藏起来了。每次写 `for range`，背后就是迭代器。

## 一、这是什么：换台不用拆开电视

拿遥控器换台，你按“下一个频道”，电视就跳到下一台。你**根本不知道也不需要知道**电视内部这些频道是存在数组里、链表里还是哈希表里——你只用“下一个”这个统一动作，就能把所有频道挨个过一遍。

迭代器模式就是这个“下一个”按钮：**提供一种统一的方式，顺序访问一个集合里的元素，而不暴露集合的内部结构。** 不管集合底层是数组、链表、树，遍历它的姿势都一样。

配套代码是书籍集合：`BookCollection` 内部用切片存书，但对外给一个 `Iterator`(`HasNext`/`Next`)，你遍历时只管“还有吗？下一本”，完全不碰它内部的切片。

## 二、解决什么痛：遍历逻辑和集合结构绑死

如果没有迭代器，遍历就得依赖集合的内部实现：

- 集合底层是切片，你写 `for i := 0; i < len(c.books); i++`——**你被迫知道它是切片，还得碰它的内部字段 `books`**。
- 哪天它内部改成链表或树，你所有遍历它的代码全得重写。
- 想给同一个集合提供多种遍历方式(正序/倒序/层序)，或者同时开两个游标各遍历各的，朴素 `for` 索引就捉襟见肘了。

::: info
**迭代器隔离的“会变的东西”，是“集合的内部存储结构”。** 它在集合和“遍历它的代码”之间加一层：集合负责“怎么造一个能走遍自己的迭代器”，迭代器负责“记住走到哪了、怎么给下一个”。于是遍历代码只依赖 `HasNext/Next` 这个统一接口，集合内部换成什么数据结构，都伤不到它。
:::

## 三、怎么实现：集合造迭代器，迭代器记位置

集合提供 `CreateIterator()`，返回一个记录着“当前遍历位置”的迭代器对象。

**go/iterator/main.go（核心）**

```go
type Iterator interface {
	HasNext() bool
	Next() *Book
}

// 集合:内部用切片,但对外只暴露"造一个迭代器"
type BookCollection struct{ books []*Book }
func (c *BookCollection) CreateIterator() Iterator {
	return &bookIterator{collection: c, index: 0}
}

// 迭代器:维护当前位置 index,把"走到哪了"这个状态封在自己身上
type bookIterator struct {
	collection *BookCollection
	index      int
}
func (it *bookIterator) HasNext() bool { return it.index < len(it.collection.books) }
func (it *bookIterator) Next() *Book {
	book := it.collection.books[it.index]
	it.index++
	return book
}
```

遍历方只面对统一接口，不知道背后是切片：

```go
it := collection.CreateIterator()
for it.HasNext() {
	book := it.Next()
	fmt.Printf("《%s》—— %s\n", book.Title, book.Author)
}
```

## 四、有哪些坑

- **遍历中修改集合，后果自负。** 一边迭代一边往集合里加/删元素，是经典 bug 源(索引错位、跳过元素、甚至崩溃)。Java 的迭代器为此设计了 **fail-fast**——发现集合被并发改动就立刻抛异常；Go 里 `for range` 一个 map 时增删也是未定义行为。**迭代期间别动集合。**
- **外部迭代 vs 内部迭代。** 上面这种“你主动调 `Next()` 往前走”是**外部迭代**(控制权在你)；另一种是把回调传进去、集合自己遍历并对每个元素调你的回调(**内部迭代**，如 `collection.Each(func(b){...})`)。前者灵活(能随时停/跳)，后者简洁。
- **多个迭代器互不干扰。** 每个迭代器各存各的 `index`，所以能对同一集合同时开好几个游标各走各的。这是“把遍历状态放进独立迭代器对象”带来的好处——别把遍历位置存到集合自己身上，那就只能有一个游标了。

::: info
**Go 味：这个模式在 Go 里高度“语言内建”。** 绝大多数时候你根本不用手写迭代器——内置的 `for range` 已经能遍历 slice/map/channel。而 **Go 1.23 引入的 range-over-func(`iter.Seq`)** 更是把自定义迭代器正式变成了语言特性：你写一个 `func(yield func(V) bool)`，就能被 `for v := range seq` 直接遍历。这是迭代器模式在现代 Go 里的官方答案，比手写 `HasNext/Next` 优雅得多。
:::

## 五、开源里怎么用

- **Go `database/sql` 的 `Rows`**:`for rows.Next() { rows.Scan(&x) }`——查询结果集就是个迭代器，你一行行取，完全不用管底层游标怎么从数据库拉数据。教科书级实例。
- **Go `bufio.Scanner`**:`for scanner.Scan() { line := scanner.Text() }`——把一个流按行/按词迭代，`Scan()`/`Text()` 就是 `HasNext()`/`Next()` 的化身。
- **Go 1.23+ `iter.Seq` / `maps.Keys` / `slices.Values`**：标准库大量返回标准迭代器函数，配合 `for range` 使用——现代 Go 的迭代器生态。
- **Java `Iterator`/`Iterable`**:`for-each` 循环的底层就是它，`Collection` 全家都实现 `Iterable`。几乎所有语言的 `for-each`/`for-in` 语法糖，底下都是迭代器模式。

---

迭代器让“遍历”与“结构”解耦。下一篇[状态](/manual/computer-programming/design-patterns/state)：当一个对象的行为随它的内部状态而变(播放器在“播放中”和“已停止”时，同一个按钮干的事不一样)，怎么摆脱满屏的 `if (state == ...)`。
