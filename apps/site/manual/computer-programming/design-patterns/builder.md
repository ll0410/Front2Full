---
title: "建造者 · Builder（创建型）"
description: "当一个对象零件又多又杂、还一堆可选项时，别再写那种参数排到天边的构造函数了。讲清“可伸缩构造函数”的痛、建造者的分步组装 + 最终校验，以及 Go 里更地道的 functional options 替代。"
source: "https://daiw.org/manual/design-patterns/builder"
---

# 建造者 · Builder（创建型）

当一个对象零件又多又杂、还一堆可选项时，别再写那种参数排到天边的构造函数了。讲清“可伸缩构造函数”的痛、建造者的分步组装 + 最终校验，以及 Go 里更地道的 functional options 替代。

前两篇解决“造哪个类”。这一篇的产品**只有一种**，但它复杂：零件多、可选项多、还得保证组装出来是个完整合法的东西。

## 一、这是什么：点一份 Subway 三明治

去 Subway 点餐是建造者模式最好的现实注解：你不是“买一个做好的三明治”，而是**一步步组装**——先选面包，再选肉，加不加芝士，要哪些蔬菜，最后淋什么酱。店员按你的指令**分步骤**搭，最后递给你一个成品。

关键在于：**同样的组装流程(选面包→加料→淋酱)，换一组选择，就产出完全不同的三明治。** 建造者模式就是把“分步骤构造”这件事，和“最终产品长什么样”解耦开。

配套代码用组装电脑演示：一步步 `SetCPU`、`SetMemory`、`SetGPU`，最后 `Build()` 出一台完整的机器。

## 二、解决什么痛：参数排到天边的构造函数

假设电脑有 4 个部件，其中显卡可选。不用建造者，你大概会走上这条不归路：

**Java —— 臭名昭著的“可伸缩构造函数”（telescoping constructor）**

```java
new Computer("i5", "16GB", "512GB SSD");                       // 没显卡
new Computer("i9", "32GB", "2TB SSD", "RTX 4090");             // 有显卡
new Computer("i9", "32GB", "2TB SSD", "RTX 4090", true, 750);  // ...还要加电源?
// 调用处:new Computer("i9", "32GB", "2TB", "RTX4090", true, 750, false, ...)
//         ↑ 第 6 个参数 true 是啥?第 7 个呢?鬼知道。
```

痛点清清楚楚：

- **参数一多，可读性归零。** 一排 `true, false, 750, null` 摆在那，谁看得懂哪个是哪个？
- **可选参数组合爆炸。** 有的要显卡有的不要，你得重载出一堆构造函数，或者传一堆 `null`。
- **对象可能中途“半成品”。** 要是改用一堆 setter 来配置，那么在“new 出来”到“setter 设完”之间，这个对象是不完整、不合法的——别人这时候拿去用就出事。

::: info
**建造者隔离的“会变的东西”，是“复杂对象的组装过程”。** 它把“怎么一步步搭”和“最终产品”拆开，让你能用可读的分步调用替代天书般的长构造函数，并且**把“完整性校验”推迟到最后一刻**统一做。
:::

## 三、怎么实现：分步 + 链式 + 最后 Build 校验

Go 的建造者：每个 `SetXxx` 配一个部件并返回自身(于是能链式调用)，最后 `Build()` 统一校验并交出成品。

**go/builder/main.go（核心）**

```go
type ComputerBuilder interface {
	SetCPU(cpu string) ComputerBuilder
	SetMemory(memory string) ComputerBuilder
	SetStorage(storage string) ComputerBuilder
	SetGPU(gpu string) ComputerBuilder
	Build() (*Computer, error)      // ← 校验在这一步集中发生
}

func (b *computerBuilder) Build() (*Computer, error) {
	if b.computer.CPU == "" {
		return nil, errors.New("缺少 CPU，无法组装电脑")   // 完整性校验
	}
	if b.computer.Memory == "" {
		return nil, errors.New("缺少内存，无法组装电脑")
	}
	// ...
	return b.computer, nil
}
```

调用处一下子就读得懂了，可选的显卡加不加随意：

```go
pc, err := NewComputerBuilder().
	SetCPU("AMD Ryzen 9").
	SetMemory("64GB").
	SetStorage("4TB NVMe").
	SetGPU("AMD RX 7900").      // 想加就加,不加就省略,不用传 nil
	Build()                     // 到这里才校验+交货,拿到的一定是完整合法的电脑
```

代码里还有个 **Director(指挥者)** 角色：它把“办公机 = i5 + 16G + 无显卡”“游戏机 = i9 + 32G + RTX4090”这些**常见配方**固化下来，让调用方一句 `BuildGamingPC()` 就拿到预设配置。Director 是可选的——它封装的是“常用组装顺序/配方”，没有常用配方时大可省略。

### Go 味插播：functional options

必须诚实地说：上面这种“链式 builder”虽然能用，但在 Go 社区里，**更地道的做法常常是 functional options(函数选项)**：

**Go 惯用法 —— functional options,可选项的另一种解法**

```go
type Option func(*Computer)

func WithGPU(gpu string) Option { return func(c *Computer) { c.GPU = gpu } }
func WithMemory(m string) Option { return func(c *Computer) { c.Memory = m } }

func NewComputer(cpu string, opts ...Option) *Computer {
	c := &Computer{CPU: cpu, Memory: "8GB"}   // CPU 必填,其余给默认值
	for _, opt := range opts { opt(c) }
	return c
}

pc := NewComputer("i9", WithMemory("32GB"), WithGPU("RTX 4090"))  // 想配啥配啥
```

两者解决的是同一个痛(可选参数太多)，取舍在于：**functional options** 胜在轻、天然支持默认值、加选项不破坏调用方；**经典 builder** 胜在“必须分多步才能拿到成品”和“Build 时集中校验、产出不可变对象”的场景。Go 里可选参数优先想想 options，真需要严格的分步校验流程时再上完整 builder。

## 四、有哪些坑

- **别用建造者造简单对象。** 就俩字段还搞 builder，纯属仪式感。字段少、没可选项，老老实实写构造函数。
- **Build 之前的中间态别泄露出去。** builder 内部那个半成品对象，只应在 `Build()` 成功后才交给外界。别提前把内部指针递出去，否则又回到“半成品被使用”的老问题。
- **校验放哪要想清楚。** 建造者的一大价值是“最后集中校验”。如果你把校验散在每个 `SetXxx` 里，就丢了这个好处——而且分步设置时，先设的字段没法校验和后设字段的关系。**让 `Build()` 做最终的、整体的校验。**
- **链式返回类型的小陷阱。** 链式调用要求每步返回 builder 本身。Go 里若用了内嵌/组合来复用，注意返回的是不是你想要的那个具体类型，别让链断在半路。

## 五、开源里怎么用

- **Go `strings.Builder`**：标准库里顶着 Builder 名字的家伙。严格说它更偏“高效拼接”(避免字符串反复分配)，但“分步 `WriteString` → 最后 `String()` 取成品”的骨架，正是建造者的味道。
- **Go gRPC / 各类客户端的 functional options**:`grpc.Dial(target, grpc.WithInsecure(), grpc.WithBlock())`——上面讲的 options 流派，是 Go 生态里“建造者痛点”的主流解法，`DialOption` 满天飞。
- **Java 生态的重灾区(褒义)**：`StringBuilder`、`Stream.Builder`、OkHttp 的 `Request.Builder`、Lombok 的 `@Builder` 注解、protobuf 生成代码里的 `XxxBuilder`——Java 因为没有具名/可选参数，建造者用得极其广泛，几乎是“多可选参数对象”的标配。
- **Kubernetes / Docker 客户端**：构造复杂的配置对象(Pod spec、容器配置)时，大量使用建造者或 options 风格，让层层嵌套的配置能一步步、可读地搭起来。

::: warning
一个横向观察：**“可选参数太多”这个痛，在有具名/默认参数的语言(Python、Kotlin、Swift)里，大半被语言特性直接消化了**(直接 `Computer(cpu="i9", gpu="RTX4090")`)。建造者在 Java 里如此流行，恰恰因为 Java 长期缺这个特性。又一次：**模式的流行度，反映的是语言的短板。**
:::

---

创建型还剩最后一位。下一篇[原型](/manual/computer-programming/design-patterns/prototype)：当“从头造一个”太贵时，我们换个思路——**照着现成的，拷一个**。
