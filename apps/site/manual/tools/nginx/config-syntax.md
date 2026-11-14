---
title: "配置文件语法"
description: "简单指令与块指令、上下文的定义、注释、计量单位与 include 的展开时机。"
source: "https://daiw.org/manual/nginx/config-syntax"
---

# 配置文件语法

## 指令是唯一的配置单位

官方文档的定义：

> nginx consists of modules which are **controlled by directives** specified in the configuration file.

**nginx 由模块组成，模块由指令控制。** 配置文件里没有别的东西——每一行不是指令就是注释。

## 两类指令

### 简单指令

> A simple directive consists of the **name and parameters separated by spaces** and ends with a **semicolon** (`;`).

```text
worker_processes  auto;
error_log         /var/log/nginx/error.log warn;
```

名字 + 若干空格分隔的参数 + **分号**。分号不可省——漏写分号是最常见的语法错误。

### 块指令

> A block directive has the same structure as a simple directive, but instead of the semicolon it ends with a **set of additional instructions surrounded by braces** (`{` and `}`).

```text
events {
    worker_connections  1024;
}
```

结尾不是分号，而是一对花括号包住的一组指令。

**块指令的右花括号后面不加分号。** 写 `} ;` 会报 `unexpected ";"`。

## 上下文

> If a block directive can have other directives inside braces, it is called a **context** (examples: `events`, `http`, `server`, and `location`).

**能容纳其他指令的块指令叫「上下文」。** 层级关系官方给得很明确：

> Directives placed in the configuration file **outside of any contexts** are considered to be in the **main** context. The `events` and `http` directives reside in the `main` context, `server` in `http`, and `location` in `server`.

```text
main                    ← 文件顶层，不在任何括号里
├── events { }
├── http {
│   ├── server {
│   │   └── location { }
│   └── upstream { }
├── stream {
│   └── server { }
└── mail { }
```

**每条指令都有自己允许出现的上下文清单**，官方文档每条指令的第三行 `Context:` 就是它。写错位置的后果：

| 情况 | 后果 |
| --- | --- |
| 指令不允许出现在该上下文 | **启动失败**，报 `"X" directive is not allowed here` |
| 位置合法但不是你以为的那层 | **静默生效在错误范围**——最难查 |

第二种才是真麻烦，详见[上下文与继承](/manual/tools/nginx/contexts)。

## 注释

> The rest of a line after the `#` sign is considered a comment.

```text
# 整行注释
worker_processes auto;  # 行尾注释
```

只有 `#`，**没有块注释语法**。要注释掉一整段配置只能逐行加 `#`。

## 计量单位

官方 [Configuration file measurement units](https://nginx.org/en/docs/syntax.html) 定义了两套后缀。

### 大小

| 后缀 | 含义 |
| --- | --- |
| `k` / `K` | 千字节 |
| `m` / `M` | 兆字节 |
| `g` / `G` | 吉字节——**仅偏移量可用** |

```text
client_max_body_size  8m;
proxy_buffer_size     4k;
```

注意 `g`/`G` 的限制：官方原话是 sizes and offsets 支持 k/m，而 **offsets 才额外支持 g**。所以 `client_max_body_size 1g;` 这类「大小」参数能不能写 `g` 取决于该指令的具体定义，写不了时会报参数无效。

### 时间

| 后缀 | 含义 |
| --- | --- |
| `ms` | 毫秒 |
| `s` | 秒（**默认**） |
| `m` | 分 |
| `h` | 时 |
| `d` | 天 |
| `w` | 周 |
| `M` | **月 = 30 天** |
| `y` | **年 = 365 天** |

三条关键规则：

> A value without a suffix means **seconds**. It is recommended to **always specify a suffix**. Certain time intervals can be specified **only with a seconds resolution**.

**`m` 在大小里是「兆」，在时间里是「分」；`M` 在大小里是「兆」，在时间里是「月」。** 同一个字母在两套单位里含义完全不同，靠所在指令的参数类型区分。

这正是官方建议「永远写后缀」的原因——`keepalive_timeout 60;` 是 60 秒，但读的人第一眼未必确定。写成 `60s` 无歧义。

时间可以叠加：`1h 30m` 等价于 `90m`、`5400s`。

## include

```text
include /etc/nginx/conf.d/*.conf;
include /etc/nginx/mime.types;
```

`include` 是**文本级展开**，在解析时把目标文件内容原样插入当前位置。两个推论：

1.  **被包含文件的内容必须在该位置合法**。放在 `http` 里的 include 文件中不能写 `events`。
2.  **通配符按字母序展开**——`conf.d/*.conf` 的加载顺序是文件名排序。依赖顺序时用数字前缀（`00-`、`10-`）。

`include` 找不到文件时**启动失败**；但用通配符且**没有任何文件匹配**时不报错（这是有意设计，允许目录为空）。

## 语法检查

改完配置**永远先测**：

```text
nginx -t
```

输出 `syntax is ok` + `test is successful` 才算过。`-T` 额外把展开后的完整配置打印出来——排查 include 顺序与最终生效值时非常有用：

```text
nginx -T
```

下一篇：[指令、上下文与继承](/manual/tools/nginx/contexts)——nginx 配置里最容易出错的一环。
