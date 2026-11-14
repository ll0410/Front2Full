---
title: "Nginx 加固基线"
description: "一份可以直接抄走的 Nginx 安全基线配置——隐藏版本、默认服务器块拒绝未知 Host、敏感路径封堵、上传与超时限制、代理头处理，每一条都说明为什么。"
source: "https://daiw.org/manual/web-security/nginx-baseline"
---

# Nginx 加固基线

一份可以直接抄走的 Nginx 安全基线配置——隐藏版本、默认服务器块拒绝未知 Host、敏感路径封堵、上传与超时限制、代理头处理，每一条都说明为什么。

这一章给一份**可以直接抄进配置的基线**。每条都附上理由——照抄不理解，下次改动时就会把它删掉。

## 一、隐藏版本与指纹

```nginx
http {
    server_tokens off;          # 响应头与错误页里不再出现具体版本号
    more_clear_headers 'Server';   # 需要 headers-more 模块；能完全去掉 Server 头
}
```

`server_tokens off` 之后，`Server: nginx/1.24.0` 变成 `Server: nginx`。

::: info
**这不是真正的安全措施，是降噪。** 有经验的攻击者能通过行为特征指纹识别版本。但它确实能让你从「自动化扫描器按版本号匹配 exp」的名单里掉出来——而那类流量占实际攻击的绝大多数。

同理要清理掉后端泄露的指纹头：`X-Powered-By`、`X-AspNet-Version`、`X-Generator` 等。
:::

```nginx
# 把后端泄露的指纹头统统抹掉
proxy_hide_header X-Powered-By;
proxy_hide_header X-AspNet-Version;
proxy_hide_header X-Runtime;
```

## 二、默认服务器块：拒绝未知 Host

**这是最容易漏掉、也最有价值的一条。**

如果没有 `default_server`，Nginx 会把「Host 头对不上任何 server_name」的请求交给**第一个** server 块处理。后果是：攻击者直接用 IP 访问你的服务器，或者带一个伪造的 Host，照样能拿到你的站点内容——[源站暴露那一章](/manual/computer-programming/web-security/origin-exposure)讲的直连问题在这里被放大。

```nginx
# 放在所有 server 块之前:任何 Host 对不上的请求，直接断开
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name _;

    ssl_certificate     /etc/nginx/ssl/dummy.crt;   # 自签即可，反正要拒绝
    ssl_certificate_key /etc/nginx/ssl/dummy.key;

    return 444;    # Nginx 特有:直接关闭连接，不返回任何响应
}
```

`444` 比 `403` 更好：**不给扫描器任何反馈**，连「这里有个服务」都不告诉它。

**验证**：

```bash
# 用 IP 直连，Host 随便填 —— 应该连不上任何内容
curl -sI http://1.2.3.4/ -H "Host: whatever.invalid"
```

## 三、封堵敏感路径

```nginx
# 隐藏文件与版本控制目录 —— 这类请求 100% 是扫描
location ~ /\. {
    deny all;
    access_log off;
    log_not_found off;
    return 404;
}

# 备份与源码残留
location ~* \.(bak|backup|old|orig|save|swp|sql|tar|tar\.gz|zip|log|ini|conf)$ {
    return 404;
}

# 常见的探测路径（就算你不是 PHP 站也要挡，纯粹为了降噪）
location ~* /(wp-admin|wp-login\.php|xmlrpc\.php|phpmyadmin|adminer) {
    return 404;
}
```

::: warning
**`.git` 泄露是最经典也最致命的一种。** 如果 `/.git/` 可访问，攻击者能用现成工具把**整个仓库历史**拉下来——包括你以为「已经删掉」的配置文件、密钥、内网地址。

自查：

  ```bash
  curl -sI https://example.com/.git/config
  curl -sI https://example.com/.env
  ```

**返回 200 就是重大事故**，而且要假设已经泄露：立刻轮换所有出现在仓库历史里的凭据。
:::

注意上面第一条用了 `location ~ /\.`，它会连 `.well-known` 一起挡掉——而 ACME 证书申请需要它。所以要给个例外：

```nginx
# 必须放在 location ~ /\. 之前（前缀匹配 ^~ 优先级高于正则）
location ^~ /.well-known/acme-challenge/ {
    root /var/www/certbot;
}
```

**这是个真实的翻车点**：加了隐藏文件封堵之后，证书自动续期静默失败，三个月后证书过期。

## 四、限制请求

```nginx
client_max_body_size 10m;        # 按业务实际需要设，别用默认的 1m 也别无限
client_body_buffer_size 128k;
client_header_buffer_size 1k;
large_client_header_buffers 4 8k;

client_body_timeout 10s;
client_header_timeout 10s;
send_timeout 10s;
keepalive_timeout 30s;
reset_timedout_connection on;
```

`large_client_header_buffers` 值得说一句：设太小，带很多 Cookie 的正常用户会收到 400；设太大，给了攻击者内存放大的空间。`4 8k` 是个稳妥起点。

## 五、只开需要的方法

```nginx
# 静态站基本只需要这三个
if ($request_method !~ ^(GET|HEAD|POST)$) {
    return 405;
}
```

顺手挡掉 `TRACE`（跨站追踪）、`PUT`/`DELETE`（如果你没用到）。

## 六、代理头的正确处理

反向代理到后端时，这几个头决定了后端能不能拿到正确信息，**以及攻击者能不能伪造它们**：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;

    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host  $host;

    proxy_http_version 1.1;
    proxy_set_header Connection "";      # 保持后端长连接

    proxy_connect_timeout 5s;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
}
```

::: warning
**`proxy_set_header` 是覆盖，不是追加——这一点救过很多人。**

如果你**不写** `proxy_set_header X-Forwarded-For`，客户端发来的 `X-Forwarded-For` 会**原样透传**给后端。攻击者随手加一个 `X-Forwarded-For: 127.0.0.1`，后端如果据此判断「这是内网请求，放行管理接口」——就直接被打穿了。

用 `$proxy_add_x_forwarded_for` 是在客户端值后面追加真实 IP；如果你的后端只信任最后一个值，这是对的。**如果后端取第一个值，那必须改成 `proxy_set_header X-Forwarded-For $remote_addr;`（完全丢弃客户端传来的）。**

搞清楚你的后端框架取哪一个，这是个真实的、被反复利用的分歧点。
:::

## 七、TLS 与安全响应头

TLS 部分见[证书那一章](/manual/computer-programming/web-security/tls-and-certs)，响应头见[安全响应头那一章](/manual/computer-programming/web-security/security-headers)。这里只强调一个 Nginx 特有的坑：

```nginx
# 一定要加 always，否则 4xx/5xx 响应不会带上这些头
add_header Strict-Transport-Security "max-age=31536000" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
```

::: warning
**`add_header` 在子块里会覆盖父块的全部 `add_header`，而不是合并。**

  ```nginx
  server {
      add_header X-Frame-Options DENY always;

      location /api/ {
          add_header X-Custom "foo" always;   # ← server 块那条 X-Frame-Options 在这里失效了！
      }
  }
  ```

这是 Nginx 最反直觉的行为之一，也是「我明明配了安全头，为什么某些路径没有」的头号原因。解决办法：把公共头抽成一个文件，在每个需要的 location 里 `include` 一次。
:::

## 八、运行身份与文件权限

```nginx
user www-data;      # 不要用 root 跑 worker
```

```bash
# 配置文件不该被 worker 用户写
chown -R root:root /etc/nginx
chmod -R 644 /etc/nginx/*.conf
chmod 600 /etc/nginx/ssl/*.key

# 站点目录：worker 只读即可
chown -R root:www-data /var/www/html
chmod -R 750 /var/www/html
```

**为什么强调「只读」**：如果 worker 对站点目录有写权限，一个文件上传漏洞就能变成 webshell。剥掉写权限，很多漏洞的利用链会直接断掉。

## 改完之后

```bash
nginx -t              # 语法检查，务必先跑
nginx -s reload       # 平滑重载，不断连接
```

**验证清单**：

```bash
D=example.com
echo "── 版本泄露 ──";      curl -sI https://$D/ | grep -i "^server\|x-powered-by"
echo "── 未知 Host ──";     curl -sI https://$D/ -H "Host: invalid.test" | head -1
echo "── .env ──";          curl -s -o /dev/null -w "%{http_code}\n" https://$D/.env
echo "── .git ──";          curl -s -o /dev/null -w "%{http_code}\n" https://$D/.git/config
echo "── 方法限制 ──";      curl -s -o /dev/null -w "%{http_code}\n" -X TRACE https://$D/
echo "── 安全头(404 页) ──"; curl -sI https://$D/不存在的路径 | grep -icE "strict-transport|x-frame|nosniff"
```

最后一条特意打 404 页——**这是检验 `always` 有没有加对的最快方式**。

## 小结

- `server_tokens off` 是降噪不是安全，但值得做。
- **`default_server` 拒绝未知 Host** 是最容易漏、价值最高的一条，用 `444` 直接断连。
- 封堵 `.git`/`.env` 时**别忘了给 `.well-known/acme-challenge` 开例外**，否则证书续期会静默失败。
- **`proxy_set_header` 不写就是透传**——`X-Forwarded-For` 伪造是真实攻击面，要搞清楚后端取第几个值。
- **`add_header` 在子块里是覆盖不是合并**，这是安全头「时有时无」的头号原因。

下一章专讲那些「配置写错就出洞」的具体陷阱。👉 [Nginx 配置陷阱](/manual/computer-programming/web-security/nginx-pitfalls)
