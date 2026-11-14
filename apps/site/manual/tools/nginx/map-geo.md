---
title: "map、geo 与 split_clients"
description: "map 的匹配优先级与惰性求值、geo 的 CIDR 查表、split_clients 做灰度发布。"
source: "https://daiw.org/manual/nginx/map-geo"
---

# map、geo 与 split_clients

这三个模块都在 `http` 上下文定义变量，是替代 [`if`](/manual/tools/nginx/rewrite) 的正确工具。

## map

```text
语法:    map string $variable { ... }
上下文:  http
```

```text
map $http_user_agent $is_bot {
    default            0;
    ~*(bot|spider)     1;
    "Googlebot/2.1"    1;
}
```

**根据一个变量的值，计算出另一个变量。**

### 匹配优先级

nginx 按这个顺序找：

```text
1. 精确字符串
2. 最长的【前缀】通配（"*.example.com" 形式，以 * 开头）
3. 最长的【后缀】通配（"www.*" 形式，以 * 结尾）
4. 第一个匹配的正则（按配置顺序）
5. default
```

与 [`server_name` 的规则](/manual/tools/nginx/request-processing)同构——**精确优先、通配比长度、正则比顺序**。

### 特殊参数

```text
map $uri $value {
    hostnames;              # 按主机名规则匹配（支持 *.example.com）
    volatile;               # 禁用缓存，每次重新求值
    default    "none";

    include    /etc/nginx/map-values.conf;   # 可以 include

    /foo       "A";
    ~^/bar/    "B";
}
```

| 参数 | 作用 |
| --- | --- |
| `default` | 无匹配时的值。**不写则为空串** |
| `hostnames` | 按主机名规则匹配（允许 `*.` 前缀通配） |
| `volatile` | **禁用结果缓存** |
| `include` | 从文件读映射表——大表必备 |

### 惰性求值与缓存

**`map` 定义的变量在首次被使用时才计算，且结果会缓存到请求结束。**

两个推论：

-   定义 100 个 map 但只用到 1 个，另外 99 个**完全不消耗**。可以放心大量定义。
-   若映射依赖的源变量在请求中途会变（比如 `$uri` 被 [rewrite 改写](/manual/tools/nginx/rewrite)），缓存的结果**不会更新**——此时需要 `volatile`。

### 值可以是变量

```text
map $http_x_env $backend {
    default  "prod_pool";
    "staging" "staging_pool";
    "canary"  "canary_pool";
}

location / {
    proxy_pass http://$backend;
}
```

**`proxy_pass` 里含变量时行为不同**（[见代理章节](/manual/tools/nginx/proxy)）：nginx 不会在启动时解析上游组，而是运行时解析——若值是域名则需要 `resolver`，若是 upstream 名则需确保该组已定义。

### 典型用途

**替代 if 做条件判断：**

```text
map $request_method $not_allowed {
    default 0;
    TRACE   1;
    TRACK   1;
}

server {
    if ($not_allowed) { return 405; }
}
```

**按类型设缓存时长**（官方示例）：

```text
map $sent_http_content_type $expires {
    default         off;
    application/pdf 42d;
    ~image/         max;
}
expires $expires;
```

**条件日志：**

```text
map $status $loggable {
    ~^[23]  0;
    default 1;
}
access_log /var/log/nginx/access.log main if=$loggable;
```

**WebSocket 升级**（最经典的 map 用法）：

```text
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

location /ws/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
}
```

这里必须用 map 而不是硬写 `Connection upgrade`——[非 WebSocket 请求也走这个 location 时](https://daiw.org/manual/http11/connection-management)，发 `Connection: upgrade` 会破坏普通请求。

## geo

```text
语法:    geo [$address] $variable { ... }
上下文:  http
```

```text
geo $country {
    default        unknown;
    127.0.0.1/32   local;
    10.0.0.0/8     internal;
    192.168.0.0/16 internal;
    203.0.113.0/24 partner;
}
```

**按 IP 地址（CIDR）查表**，默认用 `$remote_addr`，可以指定其他变量：

```text
geo $http_x_forwarded_for $from_trusted { ... }
```

### 参数

| 参数 | 作用 |
| --- | --- |
| `default` | 无匹配时的值 |
| `ranges` | 用**地址区间**而非 CIDR，且必须是第一条 |
| `delete` | 删除指定网络 |
| `proxy` | 指定可信代理，从 `X-Forwarded-For` 取地址 |
| `proxy_recursive` | 递归查找 |
| `include` | 从文件读——**IP 库必备** |

```text
geo $country {
    ranges;
    default            unknown;
    203.0.113.0-203.0.113.255  partner;
}
```

### 与 map 的分工

|  | `map` | `geo` |
| --- | --- | --- |
| 输入 | 任意变量 | **IP 地址** |
| 匹配 | 字符串/通配/正则 | **CIDR / 区间** |
| 数据结构 | 哈希表 | **基数树（radix tree）** |

`geo` 用基数树做最长前缀匹配，**几十万条 CIDR 也是 O(位数)**。用 `map` 硬匹配 IP 字符串既不正确（无法处理网段）也不高效。

典型用途：

```text
geo $limit_key {
    default        $binary_remote_addr;
    10.0.0.0/8     "";              # 内网不限流（key 为空则不计入）
    192.168.0.0/16 "";
}

limit_req_zone $limit_key zone=one:10m rate=10r/s;
```

[限流](/manual/tools/nginx/access-limits)时把内网排除——key 为空串的请求不参与限流。

## split\_clients

```text
语法:    split_clients string $variable { ... }
上下文:  http
```

```text
split_clients "${remote_addr}${http_user_agent}" $variant {
    5%      "canary";
    20%     "beta";
    *       "stable";
}
```

**按比例把请求分流**——A/B 测试与灰度发布的标准工具。

工作原理：对输入字符串算 MurmurHash2，把 32 位哈希空间按百分比切分。

要点：

-   **`*` 表示剩余全部**，必须有（否则未覆盖部分变量为空）。
-   **同一个输入永远落到同一个分组**——哈希是确定性的。所以用 `$remote_addr` 做 key 时，同一用户始终看到同一版本（会话一致性）。
-   想让每个请求随机分配，用 `$request_id`（1.11.0+）：

```text
split_clients $request_id $variant {
    50%  "a";
    *    "b";
}
```

### 灰度发布

```text
split_clients "${remote_addr}" $pool {
    10%  "backend_v2";
    *    "backend_v1";
}

upstream backend_v1 { server 10.0.1.10:8080; }
upstream backend_v2 { server 10.0.2.10:8080; }

server {
    location / {
        proxy_pass http://$pool;
        add_header X-Pool $pool always;   # 便于验证
    }
}
```

配合 map 做**手动覆盖**（让测试人员强制走新版）：

```text
map $cookie_force_pool $forced {
    default  "";
    "v2"     "backend_v2";
    "v1"     "backend_v1";
}

map $forced $final_pool {
    default  $forced;      # Cookie 指定了就用它
    ""       $pool;        # 否则用 split_clients 的结果
}
```

**map 可以链式引用另一个 map 的结果**——这是构建复杂路由逻辑的正确方式，比嵌套 `if` 清晰得多。

## 三者对照

|  | `map` | `geo` | `split_clients` |
| --- | --- | --- | --- |
| 输入 | 任意变量 | IP | 任意字符串 |
| 输出 | 查表结果 | 查表结果 | **按比例分组** |
| 匹配 | 精确/通配/正则 | CIDR | 哈希取模 |
| 上下文 | `http` | `http` | `http` |
| 典型用途 | 条件逻辑、替代 if | IP 白名单、地域 | 灰度、A/B |

三者都**只定义变量、不产生副作用**，且都是惰性求值——这正是它们优于 `if` 的根本原因。

下一篇：[stream：TCP/UDP 代理](/manual/tools/nginx/stream)。
