import{_ as n,o as a,c as e,a6 as p}from"./chunks/framework.BrkgobfX.js";const m=JSON.parse('{"title":"stream：TCP/UDP 代理","description":"与 http 平行的另一套世界、UDP 的会话语义、SNI 分流与 PROXY 协议。","frontmatter":{"title":"stream：TCP/UDP 代理","description":"与 http 平行的另一套世界、UDP 的会话语义、SNI 分流与 PROXY 协议。","source":"https://daiw.org/manual/nginx/stream"},"headers":[],"relativePath":"manual/tools/nginx/stream.md","filePath":"manual/tools/nginx/stream.md"}'),l={name:"manual/tools/nginx/stream.md"};function r(t,s,i,c,o,d){return a(),e("div",null,[...s[0]||(s[0]=[p(`<h1 id="stream-tcp-udp-代理" tabindex="-1">stream：TCP/UDP 代理 <a class="header-anchor" href="#stream-tcp-udp-代理" aria-label="Permalink to &quot;stream：TCP/UDP 代理&quot;">​</a></h1><p><code>stream</code> 块提供<strong>四层（TCP/UDP）代理</strong>，与 <code>http</code> 块<strong>平级且完全独立</strong>。</p><h2 id="与-http-的边界" tabindex="-1">与 http 的边界 <a class="header-anchor" href="#与-http-的边界" aria-label="Permalink to &quot;与 http 的边界&quot;">​</a></h2><div class="language-text vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">text</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span># nginx.conf 顶层</span></span>
<span class="line"><span>events { }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>http {</span></span>
<span class="line"><span>    server { listen 80; }</span></span>
<span class="line"><span>}</span></span>
<span class="line"><span></span></span>
<span class="line"><span>stream {              # ← 与 http 平级</span></span>
<span class="line"><span>    server { listen 3306; }</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br></div></div><p><strong><code>stream</code> 与 <code>http</code> 是两套互不相通的世界：</strong></p><table tabindex="0"><thead><tr><th></th><th><code>http</code></th><th><code>stream</code></th></tr></thead><tbody><tr><td>模块</td><td><code>ngx_http_*</code></td><td><code>ngx_stream_*</code></td></tr><tr><td>代理指令</td><td><code>proxy_pass http://x</code></td><td><code>proxy_pass x</code>（<strong>无协议前缀</strong>）</td></tr><tr><td>location</td><td><strong>有</strong></td><td><strong>没有</strong></td></tr><tr><td>变量</td><td><code>$uri</code>、<code>$host</code>、<code>$request</code></td><td>大部分<strong>不存在</strong></td></tr><tr><td>日志</td><td><code>access_log</code> + <code>log_format</code></td><td>各自独立的同名指令</td></tr></tbody></table><p><strong><code>stream</code> 里没有 <code>location</code></strong>——四层代理看不到 HTTP 路径，无从匹配。整个 <code>server</code> 块就是一个整体。</p><p>两边的同名指令（如 <code>proxy_pass</code>、<code>access_log</code>）分属不同模块，<strong>参数与行为都不同</strong>，不能照搬 http 的写法。</p><p>编译时需要 <code>--with-stream</code>（多数发行版包已带）。</p><h2 id="基本-tcp-代理" tabindex="-1">基本 TCP 代理 <a class="header-anchor" href="#基本-tcp-代理" aria-label="Permalink to &quot;基本 TCP 代理&quot;">​</a></h2><div class="language-text vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">text</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>stream {</span></span>
<span class="line"><span>    upstream mysql_backend {</span></span>
<span class="line"><span>        server 10.0.0.1:3306;</span></span>
<span class="line"><span>        server 10.0.0.2:3306;</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    server {</span></span>
<span class="line"><span>        listen     3306;</span></span>
<span class="line"><span>        proxy_pass mysql_backend;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        proxy_connect_timeout 5s;</span></span>
<span class="line"><span>        proxy_timeout         10m;</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br><span class="line-number">14</span><br></div></div><p>注意 <code>proxy_pass</code> <strong>不带 <code>http://</code></strong>——四层代理不关心应用协议，直接写上游组名或 <code>host:port</code>。</p><h2 id="proxy-timeout" tabindex="-1">proxy_timeout <a class="header-anchor" href="#proxy-timeout" aria-label="Permalink to &quot;proxy\\_timeout&quot;">​</a></h2><div class="language-text vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">text</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>语法:    proxy_timeout timeout;</span></span>
<span class="line"><span>默认:    proxy_timeout 10m;</span></span>
<span class="line"><span>上下文:  stream, server</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br></div></div><p><strong>两个方向都无数据传输的超时</strong>。默认 10 分钟。</p><p>与 <a href="/Front2Full/manual/tools/nginx/proxy">http 的 <code>proxy_read_timeout</code></a> 语义不同：这里是「双向都静默」才算超时。长连接协议（数据库、MQTT）要按实际心跳间隔调整。</p><h2 id="udp-代理" tabindex="-1">UDP 代理 <a class="header-anchor" href="#udp-代理" aria-label="Permalink to &quot;UDP 代理&quot;">​</a></h2><div class="language-text vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">text</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>server {</span></span>
<span class="line"><span>    listen     53 udp;</span></span>
<span class="line"><span>    proxy_pass dns_backend;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    proxy_responses      1;</span></span>
<span class="line"><span>    proxy_timeout        1s;</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br></div></div><p><code>listen ... udp</code> 开启 UDP 模式。两个 UDP 专用指令：</p><p><strong><code>proxy_responses</code></strong>——期望从上游收到几个响应包。</p><div class="language-text vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">text</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>proxy_responses 1;    # 收到 1 个响应就结束会话（DNS 典型）</span></span>
<span class="line"><span>proxy_responses 0;    # 不期望响应（syslog 单向）</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br></div></div><p><strong>不设置时</strong>，nginx 会一直等到 <code>proxy_timeout</code> 才释放会话——对 DNS 这类一问一答的协议，会白白占用会话槽位。</p><p><strong>UDP 的「会话」是 nginx 虚构的</strong>：UDP 本身无连接，nginx 按「客户端地址+端口」维护一个虚拟会话，把后续包发往同一上游。</p><h2 id="sni-分流" tabindex="-1">SNI 分流 <a class="header-anchor" href="#sni-分流" aria-label="Permalink to &quot;SNI 分流&quot;">​</a></h2><p><code>stream</code> 最有价值的用法之一：<strong>在不解密的情况下按 TLS SNI 分流</strong>。</p><div class="language-text vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">text</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>stream {</span></span>
<span class="line"><span>    map $ssl_preread_server_name $upstream {</span></span>
<span class="line"><span>        example.com      web_backend;</span></span>
<span class="line"><span>        api.example.com  api_backend;</span></span>
<span class="line"><span>        default          web_backend;</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    upstream web_backend { server 10.0.1.10:443; }</span></span>
<span class="line"><span>    upstream api_backend { server 10.0.2.10:443; }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    server {</span></span>
<span class="line"><span>        listen      443;</span></span>
<span class="line"><span>        ssl_preread on;              # ← 关键</span></span>
<span class="line"><span>        proxy_pass  $upstream;</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br><span class="line-number">14</span><br><span class="line-number">15</span><br><span class="line-number">16</span><br></div></div><p><code>ssl_preread on</code>（<code>ngx_stream_ssl_preread_module</code>）让 nginx <strong>窥探 TLS ClientHello 里的 SNI 而不做 TLS 终止</strong>——证书与解密都留给后端。</p><p>可用变量：</p><table tabindex="0"><thead><tr><th>变量</th><th>内容</th></tr></thead><tbody><tr><td><code>$ssl_preread_server_name</code></td><td>SNI 主机名</td></tr><tr><td><code>$ssl_preread_alpn_protocols</code></td><td>ALPN 列表</td></tr><tr><td><code>$ssl_preread_protocol</code></td><td>TLS 版本</td></tr></tbody></table><p>按 ALPN 分流也很有用（把 gRPC 与普通 HTTPS 分开）：</p><div class="language-text vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">text</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>map $ssl_preread_alpn_protocols $backend {</span></span>
<span class="line"><span>    ~\\bh2\\b      grpc_backend;</span></span>
<span class="line"><span>    default      https_backend;</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br></div></div><p>这是「一个 443 端口同时服务多种后端」的标准方案：TLS 不在 nginx 终止，各后端自己管证书。代价是 nginx 看不到 HTTP 层信息，无法做路径路由、缓存、压缩。</p><h2 id="proxy-协议" tabindex="-1">PROXY 协议 <a class="header-anchor" href="#proxy-协议" aria-label="Permalink to &quot;PROXY 协议&quot;">​</a></h2><p>四层代理会丢失客户端真实 IP——后端只看到 nginx 的地址。解法是 PROXY 协议：</p><div class="language-text vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">text</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span># nginx 作为四层代理，向后端发 PROXY 头</span></span>
<span class="line"><span>server {</span></span>
<span class="line"><span>    listen     443;</span></span>
<span class="line"><span>    proxy_pass backend;</span></span>
<span class="line"><span>    proxy_protocol on;   # 默认发 v1 文本头；1.31.4 起可写 proxy_protocol v2; 发二进制 v2 头（含 TLS ALPN/SNI 等 TLV）</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br></div></div><p>后端（若也是 nginx）接收：</p><div class="language-text vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">text</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>http {</span></span>
<span class="line"><span>    server {</span></span>
<span class="line"><span>        listen 8443 ssl proxy_protocol;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        set_real_ip_from 10.0.0.0/8;</span></span>
<span class="line"><span>        real_ip_header   proxy_protocol;</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br></div></div><p><strong><code>listen ... proxy_protocol</code> 一旦开启，该端口的所有连接都必须带 PROXY 头</strong>——直连（不带头）会被当作协议错误拒绝。</p><p>所以这个端口不能同时服务普通客户端。混用场景需要开两个端口。</p><h2 id="访问控制与限流" tabindex="-1">访问控制与限流 <a class="header-anchor" href="#访问控制与限流" aria-label="Permalink to &quot;访问控制与限流&quot;">​</a></h2><p><code>stream</code> 有自己的一套同名模块：</p><div class="language-text vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">text</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>stream {</span></span>
<span class="line"><span>    limit_conn_zone $binary_remote_addr zone=perip:10m;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    server {</span></span>
<span class="line"><span>        listen 3306;</span></span>
<span class="line"><span>        proxy_pass mysql_backend;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        allow 10.0.0.0/8;</span></span>
<span class="line"><span>        deny  all;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        limit_conn perip 5;</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br></div></div><p><code>ngx_stream_access_module</code>、<code>ngx_stream_limit_conn_module</code> 与 http 版同名同参，但<strong>是不同的模块</strong>——写在各自的上下文里。</p><p>注意 <strong>stream 没有 <code>limit_req</code></strong>（四层没有「请求」的概念，只有连接）。</p><h2 id="日志" tabindex="-1">日志 <a class="header-anchor" href="#日志" aria-label="Permalink to &quot;日志&quot;">​</a></h2><div class="language-text vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">text</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>stream {</span></span>
<span class="line"><span>    log_format basic &#39;$remote_addr [$time_local] &#39;</span></span>
<span class="line"><span>                     &#39;$protocol $status $bytes_sent $bytes_received &#39;</span></span>
<span class="line"><span>                     &#39;$session_time &quot;$upstream_addr&quot;&#39;;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    access_log /var/log/nginx/stream.log basic;</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br></div></div><p>stream 专有变量：</p><table tabindex="0"><thead><tr><th>变量</th><th>含义</th></tr></thead><tbody><tr><td><code>$protocol</code></td><td><code>TCP</code> 或 <code>UDP</code></td></tr><tr><td><code>$status</code></td><td><strong>会话状态</strong>（200 成功、400 客户端错、500 内部错、502 上游不可达、503 受限）</td></tr><tr><td><code>$bytes_sent</code> / <code>$bytes_received</code></td><td>双向字节数</td></tr><tr><td><code>$session_time</code></td><td>会话时长</td></tr><tr><td><code>$upstream_bytes_sent</code> / <code>$upstream_bytes_received</code></td><td>上游侧字节数</td></tr></tbody></table><p><code>$status</code> 借用了 HTTP 的数字但<strong>语义是 nginx 自定义的会话结果</strong>，与 <a href="https://daiw.org/manual/http11/status-codes" target="_blank" rel="noreferrer">HTTP 状态码</a>无关。</p><h2 id="tls-终止" tabindex="-1">TLS 终止 <a class="header-anchor" href="#tls-终止" aria-label="Permalink to &quot;TLS 终止&quot;">​</a></h2><p><code>stream</code> 也可以自己终止 TLS：</p><div class="language-text vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">text</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>server {</span></span>
<span class="line"><span>    listen              8443 ssl;</span></span>
<span class="line"><span>    ssl_certificate     /etc/ssl/cert.pem;</span></span>
<span class="line"><span>    ssl_certificate_key /etc/ssl/key.pem;</span></span>
<span class="line"><span>    proxy_pass          plain_backend;   # 明文转发给后端</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br></div></div><p>反过来向上游发起 TLS：</p><div class="language-text vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">text</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>server {</span></span>
<span class="line"><span>    listen        3306;</span></span>
<span class="line"><span>    proxy_pass    remote_db;</span></span>
<span class="line"><span>    proxy_ssl     on;</span></span>
<span class="line"><span>    proxy_ssl_verify on;</span></span>
<span class="line"><span>    proxy_ssl_trusted_certificate /etc/ssl/ca.pem;</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br></div></div><h2 id="完整示例" tabindex="-1">完整示例 <a class="header-anchor" href="#完整示例" aria-label="Permalink to &quot;完整示例&quot;">​</a></h2><div class="language-text vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang">text</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>stream {</span></span>
<span class="line"><span>    log_format basic &#39;$remote_addr [$time_local] $protocol &#39;</span></span>
<span class="line"><span>                     &#39;$status $bytes_sent/$bytes_received &#39;</span></span>
<span class="line"><span>                     &#39;$session_time $upstream_addr&#39;;</span></span>
<span class="line"><span>    access_log /var/log/nginx/stream.log basic;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    limit_conn_zone $binary_remote_addr zone=sperip:10m;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    # 按 SNI 分流的 443</span></span>
<span class="line"><span>    map $ssl_preread_server_name $https_pool {</span></span>
<span class="line"><span>        api.example.com  api_tls;</span></span>
<span class="line"><span>        default          web_tls;</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span>    upstream api_tls { server 10.0.2.10:443; }</span></span>
<span class="line"><span>    upstream web_tls { server 10.0.1.10:443; }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    server {</span></span>
<span class="line"><span>        listen      443 reuseport;</span></span>
<span class="line"><span>        ssl_preread on;</span></span>
<span class="line"><span>        proxy_pass  $https_pool;</span></span>
<span class="line"><span>        proxy_timeout 10m;</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    # 内网数据库代理</span></span>
<span class="line"><span>    upstream pg { server 10.0.3.10:5432; }</span></span>
<span class="line"><span>    server {</span></span>
<span class="line"><span>        listen     5432;</span></span>
<span class="line"><span>        proxy_pass pg;</span></span>
<span class="line"><span>        allow      10.0.0.0/8;</span></span>
<span class="line"><span>        deny       all;</span></span>
<span class="line"><span>        limit_conn sperip 10;</span></span>
<span class="line"><span>        proxy_timeout 1h;</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    # DNS</span></span>
<span class="line"><span>    upstream dns { server 10.0.4.1:53; }</span></span>
<span class="line"><span>    server {</span></span>
<span class="line"><span>        listen          53 udp;</span></span>
<span class="line"><span>        proxy_pass      dns;</span></span>
<span class="line"><span>        proxy_responses 1;</span></span>
<span class="line"><span>        proxy_timeout   1s;</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span>}</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br><span class="line-number">14</span><br><span class="line-number">15</span><br><span class="line-number">16</span><br><span class="line-number">17</span><br><span class="line-number">18</span><br><span class="line-number">19</span><br><span class="line-number">20</span><br><span class="line-number">21</span><br><span class="line-number">22</span><br><span class="line-number">23</span><br><span class="line-number">24</span><br><span class="line-number">25</span><br><span class="line-number">26</span><br><span class="line-number">27</span><br><span class="line-number">28</span><br><span class="line-number">29</span><br><span class="line-number">30</span><br><span class="line-number">31</span><br><span class="line-number">32</span><br><span class="line-number">33</span><br><span class="line-number">34</span><br><span class="line-number">35</span><br><span class="line-number">36</span><br><span class="line-number">37</span><br><span class="line-number">38</span><br><span class="line-number">39</span><br><span class="line-number">40</span><br><span class="line-number">41</span><br><span class="line-number">42</span><br><span class="line-number">43</span><br></div></div><p>下一篇：<a href="/Front2Full/manual/tools/nginx/recap">常见误配速查</a>。</p>`,57)])])}const u=n(l,[["render",r]]);export{m as __pageData,u as default};
