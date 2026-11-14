---
title: "备忘录 · Memento（行为型）"
description: "保存一个对象某时刻的完整状态，以便之后一键恢复(撤销/读档)，还不破坏它的封装。讲清备忘录的三个角色、“管理者只保管不偷看”的封装保护，以及它和命令模式在实现 undo 时的分工。"
source: "https://daiw.org/manual/design-patterns/memento"
---

# 备忘录 · Memento（行为型）

保存一个对象某时刻的完整状态，以便之后一键恢复(撤销/读档)，还不破坏它的封装。讲清备忘录的三个角色、“管理者只保管不偷看”的封装保护，以及它和命令模式在实现 undo 时的分工。

所有的“Ctrl+Z”、所有的“游戏存档读档”，底层都是这个模式。

## 一、这是什么：游戏存档点

打游戏，到一个存档点存个档。之后你浪一波，不小心团灭了——没关系，读档，一切回到存档那一刻。**存档这个动作，把你当时的完整状态(等级、装备、位置、血量)拍了个快照封存起来；读档就是拿这个快照把状态整个还原。**

备忘录模式就是这套存档/读档机制：**在不破坏封装的前提下，捕获一个对象的内部状态并保存在外部，以便之后把对象恢复到这个状态。**

配套代码是文本编辑器：`Save()` 把当前内容拍成一个 `EditorMemento`(快照)存进历史，`Restore()` 从某个快照恢复内容——这正是 Ctrl+Z 的原理。

## 二、解决什么痛：想存档，又不想扒光对象

你想实现撤销，于是需要“保存对象之前的状态”。最粗暴的做法：把对象的内部字段全掏出来，存到外面某个地方。

```go
// 痛点:为了存档,把编辑器的内部实现细节全暴露给了外部
type History struct {
	savedContent  string   // 直接存内部字段
	savedCursor   int      // 编辑器内部还有光标...
	savedSelection []int   // ...还有选区...
	// 编辑器一改内部结构,History 跟着改;而且谁都能读写这些字段
}
```

病根：**为了存档，破坏了对象的封装**。History 现在知道了编辑器的所有内部细节，两者紧耦合；编辑器内部一重构，History 就崩；而且这些本该私有的状态，现在裸露在外，谁都能乱改。

::: info
**备忘录隔离(保护)的，是“对象的内部状态封装”。** 它让对象**自己**把状态打包成一个“备忘录”对象(只有它自己看得懂里面是啥)，外部只负责**保管**这个不透明的包，却看不透、也改不了里面的内容。这样既实现了“存档/恢复”，又没让内部细节泄露出去——鱼和熊掌兼得。
:::

## 三、怎么实现：三个角色各司其职

备忘录模式有三个角色，分工是理解它的关键：

- **发起人(Originator)**：被存档的对象(`TextEditor`)。只有它能创建备忘录(`Save`)和从备忘录恢复(`Restore`)。
- **备忘录(Memento)**：状态快照(`EditorMemento`)。对发起人透明，对外界是个黑盒。
- **管理者(Caretaker)**：保管快照的人(`History`)。**只负责存取，绝不窥探备忘录内部。**

**go/memento/main.go（核心）**

```go
// 备忘录:状态快照,对外只读
type EditorMemento struct{ content string }
func (m *EditorMemento) Content() string { return m.content }

// 发起人:只有它会造快照、用快照恢复
type TextEditor struct{ content string }
func (e *TextEditor) Save() *EditorMemento    { return &EditorMemento{content: e.content} }
func (e *TextEditor) Restore(m *EditorMemento) { e.content = m.Content() }

// 管理者:只保管快照栈,不关心快照里装的是什么
type History struct{ snapshots []*EditorMemento }
func (h *History) Push(m *EditorMemento) { h.snapshots = append(h.snapshots, m) }
func (h *History) Pop() (*EditorMemento, error) { /* 弹出最近一个 */ }
```

于是撤销就是“取出上一个快照，让编辑器恢复它”：

```go
editor.Type("第一段"); history.Push(editor.Save())   // 存档
editor.Type("误操作的第二段")                          // 浪一波
m, _ := history.Pop(); editor.Restore(m)              // 读档,回到第一段
```

::: info
**关键在“管理者不偷看备忘录”。** `History` 只把 `EditorMemento` 当成一个不透明的东西存进栈、取出来，从不读它的 `content`(在严格实现里，`content` 对 History 甚至是不可见的)。这正是备忘录保护封装的精髓：**保管的人不需要、也不应该知道自己保管的是什么。** 这也是它和“把字段掏出来存”的本质区别。
:::

## 四、有哪些坑

- **内存是最大的敌人。** 每存一次档就是一份状态拷贝。状态大(比如整个文档、整张游戏地图)、存得勤(每敲一个字存一次)，内存很快撑爆。对策：**限制历史长度**(只留最近 N 步)、**增量快照**(只存“变化的部分”而非全量)、或用命令模式的逆操作代替全量快照(见下)。
- **深拷贝陷阱，和[原型](/manual/computer-programming/design-patterns/prototype)一模一样。** 如果状态里有引用类型(slice、map、指针)，快照必须**深拷贝**，否则“快照”和“当前状态”共享底层数据，你改当前状态，快照也跟着变，存了个寂寞。这是备忘录第二高频的坑。
- **和命令模式实现 undo 的分工。** 两条路：**命令模式**靠记录“逆操作”来撤销(开灯↔关灯，省内存，但要求操作可逆)；**备忘录**靠存“整个状态快照”来恢复(操作不可逆时的唯一选择，但费内存)。实战中常**二者配合**：命令负责“记录做了哪些操作”，在操作难以逆转时，命令内部用备忘录存一份操作前的快照。
- **多态状态的恢复。** 若发起人状态复杂(不止一个字符串字段)，备忘录要完整捕获，恢复时也要完整还原，别漏字段。

## 五、开源里怎么用

- **编辑器/IDE 的 undo/redo 栈**：VS Code、IntelliJ、Word 的撤销历史，每一步都是一个备忘录压栈。这是它最直接的应用。
- **游戏存档**：存档文件就是游戏世界状态的备忘录，读档即 `Restore`。
- **Redux DevTools 的“时间旅行调试”**：把每一次 state 变化都存成快照，可以在历史状态间来回跳——备忘录模式的现代明星应用。
- **数据库/虚拟机快照**：数据库的一致性快照、VM/容器的 snapshot、文件系统的快照(如 ZFS)，都是“存下某时刻完整状态以便回滚”的备忘录思想在系统层面的体现。**Git 的每次 commit** 某种意义上也是一份可 `checkout` 回去的状态快照。

---

备忘录管“状态存档”。行为型只剩最后两位，也是出了名烧脑的两个。下一篇[访问者](/manual/computer-programming/design-patterns/visitor)：当元素类型稳定、却要频繁给它们新增各种操作时，怎么把“操作”从元素类里彻底抽出去——代价是理解那个绕人的“双重分派”。
