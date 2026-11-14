---
title: "Nginx 配置陷阱"
description: "alias 少一个斜杠导致路径穿越、location 匹配优先级搞错让防护规则失效、merge_slashes 与 URL 解码差异绕过鉴权——五个真实的、每次出现都是高危的配置错误。"
source: "https://daiw.org/manual/web-security/nginx-pitfalls"
---

# Nginx 配置陷阱

alias 少一个斜杠导致路径穿越、location 匹配优先级搞错让防护规则失效、merge_slashes 与 URL 解码差异绕过鉴权——五个真实的、每次出现都是高危的配置错误。

Nginx 本身的安全记录相当好。**这一层出的事，绝大多数是配置写错**——而且都是那种「看起来完全正常、跑起来也完全正常、直到有人专门去试」的错误。

这一章挑五个最典型的。

## 陷阱一：alias 少一个斜杠 = 路径穿越

**这是 Nginx 配置里最经典的高危错误。**

```nginx
# ❌ 危险：location 没有尾斜杠
location /static {
    alias /var/www/static/;
}
```

`alias` 的行为是：把 `location` 匹配掉的那部分，替换成 `alias` 的值。

- 请求 `/static../etc/passwd`
- `location /static` 匹配掉前面的 `/static`
- 剩下 `../etc/passwd`
- 拼接结果：`/var/www/static/` + `../etc/passwd` = **`/var/www/etc/passwd`**

再多几个 `../` 就跳到系统根目录了。攻击者可以读 `/etc/passwd`、你的配置文件、`.env`、私钥。

**正确写法**——两边的斜杠必须配对：

```nginx
# ✅ location 与 alias 都带尾斜杠
location /static/ {
    alias /var/www/static/;
}

# ✅ 或者干脆用 root（root 不做替换，是拼接，天然没这个问题）
location /static/ {
    root /var/www;        # 实际路径 = /var/www/static/...
}
```

::: info
**能用 `root` 就别用 `alias`。** `root` 是「把 URI 整个拼到后面」，`alias` 是「把匹配部分替换掉」——后者才有这个坑。只有当 URL 路径和磁盘路径确实对不上时（比如 `/static/` 要映射到 `/opt/assets/`）才需要 `alias`，这时**务必检查两边斜杠都在**。
:::

**自查**：

```bash
grep -rn "alias" /etc/nginx/ | grep -v "#"
# 逐条检查：location 有尾斜杠吗？alias 有尾斜杠吗？
```

**验证**（在自己的服务器上）：

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://example.com/static../etc/passwd"
# 期望 404 或 403；返回 200 就是中招了
```

## 陷阱二：location 优先级搞错，防护规则被跳过

Nginx 的 `location` 匹配顺序**不是从上到下**，而是按类型定优先级：

| 顺序 | 类型 | 写法 |
| --- | --- | --- |
| 1 | 精确匹配 | `location = /path` |
| 2 | 前缀匹配（带 `^~`，命中后**不再看正则**） | `location ^~ /path` |
| 3 | 正则匹配（**按配置文件出现顺序，第一个命中即止**） | `location ~ 或 ~*` |
| 4 | 普通前缀匹配（记住最长的，最后兜底） | `location /path` |

**踩坑长这样**：

```nginx
# 想封堵 .php，但下面这条正则永远轮不到
location ^~ /uploads/ {
    root /var/www;
}

location ~* \.php$ {
    return 403;
}
```

`^~` 的含义是「前缀命中后**停止搜索正则**」。所以 `/uploads/shell.php` 被第一条接走了，**第二条的封堵完全没生效**——上传目录里的 PHP 文件会被当成静态文件返回，或者更糟，被 PHP-FPM 执行。

**正确做法**：把限制写进那个 location 内部。

```nginx
location ^~ /uploads/ {
    root /var/www;
    # 在块内部再加一层：这里的文件一律当附件下载，绝不执行
    location ~ \.(php|phtml|jsp|asp|aspx|cgi|pl|py|sh)$ {
        return 403;
    }
    add_header Content-Disposition "attachment" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

::: warning
**上传目录必须禁止执行，这是文件上传漏洞防御链上最硬的一环。** 即使攻击者绕过了所有前端校验和 MIME 检查，成功把一个 `shell.php` 传上来，只要 Web 服务器不执行它，危害就从「服务器沦陷」降级成「多了个垃圾文件」。

[文件上传那一章](/manual/computer-programming/web-security/file-upload)会展开完整的防御链。
:::

## 陷阱三：merge_slashes 与鉴权绕过

Nginx 默认 `merge_slashes on`，会把 `//` 合并成 `/`。听起来很贴心，但当 Nginx 和后端**对路径的理解不一致**时，就出问题了。

```nginx
# 想保护 /admin/
location /admin/ {
    allow 10.0.0.0/8;
    deny all;
}
```

攻击者请求 `//admin/`：

- 如果 `merge_slashes off`，Nginx 看到的路径是 `//admin/`，**不匹配 `/admin/`**，于是不走鉴权那条 location；
- 而后端框架（大多数）会把 `//admin/` 规范化成 `/admin/`，**正常处理这个管理接口**。

鉴权就这样被绕过了。同类的绕过还有：`/admin/./`、`/ADMIN/`（大小写）、`/%61dmin/`（URL 编码）。

**对策有三条，一起上**：

```nginx
# 1. 保持默认的斜杠合并
merge_slashes on;

# 2. 用正则做鉴权匹配，比前缀匹配更难绕
location ~ ^/+admin(/|$) {
    allow 10.0.0.0/8;
    deny all;
    proxy_pass http://backend;
}
```

**3. 最重要的一条：不要只在 Nginx 层做鉴权。** 后端必须自己校验一次身份和权限——Nginx 的 IP 白名单是纵深防御的一层，不是唯一一层。任何「只靠反向代理挡住管理接口」的架构，都只差一个路径规范化差异就被打穿。

## 陷阱四：proxy_pass 的斜杠语义

```nginx
# 有尾斜杠：替换掉 location 匹配的部分
location /api/ {
    proxy_pass http://backend/;      # /api/users → /users
}

# 无尾斜杠：把完整 URI 透传过去
location /api/ {
    proxy_pass http://backend;       # /api/users → /api/users
}
```

一字之差，路径完全不同。**安全影响**：如果你按第一种写法配了鉴权，后来有人改成第二种（或反过来），后端收到的路径变了，原本匹配到「需要鉴权的路由」可能变成匹配到别的路由。

**另一个相关的坑**：`proxy_pass` 里带变量时，Nginx 的行为会变（不再做 URI 规范化，且需要 `resolver`）：

```nginx
# ⚠️ 带变量：URI 不再被规范化，容易出穿越
location /proxy/ {
    proxy_pass http://$backend_host/;   # 如果 $backend_host 来自用户输入 → SSRF
}
```

**`proxy_pass` 的目标绝不能包含任何用户可控的部分**，否则就是一个现成的 [SSRF](/manual/computer-programming/web-security/ssrf)。

## 陷阱五：错误页泄露信息

```nginx
# ❌ 默认错误页会带上 nginx 版本；后端的 5xx 可能把堆栈直接吐出来
```

```nginx
# ✅ 统一接管错误页
error_page 400 401 402 403 404 /4xx.html;
error_page 500 502 503 504 /5xx.html;

location = /4xx.html { root /var/www/errors; internal; }
location = /5xx.html { root /var/www/errors; internal; }

# 拦住后端泄露的详细错误（生产环境后端本身也该关掉 debug）
proxy_intercept_errors on;
```

`internal` 关键字很重要：它让这些页面**只能被内部重定向访问**，用户直接请求 `/5xx.html` 会得到 404。

::: info
**`proxy_intercept_errors on` 是个双刃剑。** 它让 Nginx 接管后端返回的 4xx/5xx，用你自己的错误页替换——好处是不泄露后端细节，坏处是**你的 API 返回的 JSON 错误体也会被替换成 HTML**，前端会解析失败。

实践中通常只对页面路由开启，API 路由保持关闭：

  ```nginx
  location /api/ { proxy_intercept_errors off; proxy_pass http://backend; }
  location /     { proxy_intercept_errors on;  proxy_pass http://backend; }
  ```
:::

## 一次性排查

```bash
# alias 是否成对带斜杠
grep -rn "alias" /etc/nginx/ --include="*.conf" | grep -v "^\s*#"

# 是否存在可能屏蔽正则的 ^~
grep -rn "location \^~" /etc/nginx/ --include="*.conf"

# proxy_pass 是否带变量（潜在 SSRF）
grep -rn "proxy_pass.*\$" /etc/nginx/ --include="*.conf"

# 是否有 if（Nginx 的 if 在 location 里行为诡异，能少用就少用）
grep -rn "^\s*if " /etc/nginx/ --include="*.conf"
```

最后一条顺带一提：Nginx 社区有句名言叫 **「if is evil」**——`if` 在 `location` 上下文里的行为很反直觉（尤其和 `add_header`、`proxy_pass` 混用时）。能用 `map` 或 `try_files` 表达的，就别用 `if`。

## 小结

- **`alias` 少一个尾斜杠 = 路径穿越**，能用 `root` 就别用 `alias`。
- `location` 按类型定优先级，**`^~` 会屏蔽后面所有正则**——防护规则要写进块内部。
- **上传目录必须禁止脚本执行**，这是文件上传防御链最硬的一环。
- 路径规范化差异（`//`、`/./`、编码）能绕过前缀匹配的鉴权；**永远不要只靠 Nginx 鉴权**。
- `proxy_pass` 的目标绝不能含用户可控部分。

下一章讲一个更隐蔽的、由「两边理解不一致」引发的问题。👉 [HTTP 请求走私](/manual/computer-programming/web-security/request-smuggling)
