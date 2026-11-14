---
title: "日期与时间"
description: "IMF-fixdate 与两种废弃格式、Date 字段的生成规则与时钟偏差处理。"
source: "https://daiw.org/manual/http11/http-date"
---

# 日期与时间

## HTTP-date 的三种格式

```text
HTTP-date = IMF-fixdate / obs-date
```

接收方 **MUST** 接受全部三种；发送方 **MUST** 只生成 IMF-fixdate。

### IMF-fixdate（唯一可生成的格式）

```text
IMF-fixdate = day-name "," SP date1 SP time-of-day SP GMT
date1       = day SP month SP year        ; 例 02 Jun 1982
day         = 2DIGIT
year        = 4DIGIT
time-of-day = hour ":" minute ":" second  ; 均 2DIGIT
```

```text
Date: Sun, 06 Nov 1994 08:49:37 GMT
```

固定长度 **29 字节**，逐字节要求：

-   日、时、分、秒均为**两位**，不足补零（`06` 而非 `6`）。
-   年为**四位**。
-   `day-name` 与 `month` 是**大小写敏感**的固定缩写：`Mon`/`Tue`/`Wed`/`Thu`/`Fri`/`Sat`/`Sun`；`Jan`/`Feb`/`Mar`/`Apr`/`May`/`Jun`/`Jul`/`Aug`/`Sep`/`Oct`/`Nov`/`Dec`。
-   时区**必须**是字面量 `GMT`，不接受 `UTC`、`+0000` 或任何偏移。
-   分隔符必须是单个 SP，逗号后必须有 SP。

### obs-date：RFC 850 格式

```text
Date: Sunday, 06-Nov-94 08:49:37 GMT
```

**两位年份**——存在世纪歧义。接收方遇到看起来比当前时间晚 50 年以上的日期，**MUST** 按上个世纪解释。

### obs-date：asctime 格式

```text
Date: Sun Nov  6 08:49:37 1994
```

C 语言 `asctime()` 输出。特征：**无时区**（隐含 GMT）、日期为个位时用**空格填充**（`Nov 6` 中有两个空格）。解析器若按单空格分割会出错。

## 解析要求

-   无效或无法解析的日期值 **MUST** 被当作**无效**处理，而非当前时间或 epoch。
-   缓存收到无效 `Expires` 时，**MUST** 视为已过期（保守策略）。
-   秒值允许 `60`（闰秒）。
-   所有 HTTP 时间戳**恒为 GMT**，不带本地时区概念。

## Date

```text
Date = HTTP-date
```

报文**生成时刻**（不是资源修改时刻）。

生成规则：

-   有时钟的源服务器 **MUST** 在 `2xx`/`3xx`/`4xx` 响应中发送 `Date`。
-   `1xx` 与 `5xx` 响应中**可选**。
-   无可靠时钟的服务器 **MUST NOT** 发送。
-   请求中的 `Date` 是可选的，客户端通常不发（`POST`/`PUT` 时可发）。
-   缓存收到无 `Date` 的响应时 **MUST** 自行补上接收时刻。

`Date` 是缓存年龄计算的基准，见[缓存](/manual/computer-programming/http11/caching)。

## 时钟偏差

HTTP 的缓存新鲜度计算**依赖双方时钟**，偏差直接导致缓存行为错误。规范的应对：

-   优先使用**相对时间**（`Cache-Control: max-age`）而非绝对时间（`Expires`）——`max-age` 不受时钟偏差影响，这是它优先级更高的原因之一。
-   `Age` 字段以秒计，同样是相对量。
-   缓存计算 `current_age` 时会取 `apparent_age`（本地接收时刻 − 响应 `Date`）与 `corrected_age`（`Age` + 传输耗时）中的**较大值**，以此抵消时钟慢的一侧。

## Last-Modified 与 Expires 的日期约束

-   `Last-Modified` **MUST NOT** 晚于响应的 `Date`。若存储的修改时间更晚，服务端 **SHOULD** 用 `Date` 值替代。
-   `Expires` 若早于 `Date`，表示响应**已经过期**。
-   表示「永不过期」时，`Expires` 的推荐上限是**不超过一年后**——超过一年的值应改用 `Cache-Control: max-age`。
-   表示「立即过期」的规范写法是 `Expires: 0` 或任何无效日期——两者都会被解析为「已过期」。

下一篇：[条件请求](/manual/computer-programming/http11/conditional-requests)——ETag、验证器与 If-\* 系列字段。
