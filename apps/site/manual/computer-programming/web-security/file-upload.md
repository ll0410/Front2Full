---
title: "文件上传"
description: "上传功能的防御是一条链，任何单点都会被绕过——扩展名、MIME、魔数各自能被怎么骗，以及真正可靠的四条：随机文件名、独立域名、禁止执行、内容重编码。"
source: "https://daiw.org/manual/web-security/file-upload"
---

# 文件上传

上传功能的防御是一条链，任何单点都会被绕过——扩展名、MIME、魔数各自能被怎么骗，以及真正可靠的四条：随机文件名、独立域名、禁止执行、内容重编码。

文件上传把「攻击者提供的字节」直接写进你的服务器。它的危害上限是**远程代码执行**——传一个 webshell 上去并让它被执行，服务器就是攻击者的了。

这一章的核心观点：**任何单一校验都能被绕过，必须靠一条链。**

## 单点校验为什么都不够

### 扩展名黑名单：必然漏

```javascript
// ❌ 黑名单
const BAD = ['.php', '.jsp', '.asp', '.exe'];
if (BAD.some(e => filename.endsWith(e))) reject();
```

绕过手法：

| 手法 | 例子 |
| --- | --- |
| 大小写 | `shell.PHP`、`shell.PhP` |
| 变体扩展名 | `.php5`、`.phtml`、`.phar`、`.pht` |
| 双扩展名 | `shell.php.jpg`（某些服务器配置下按第一个可识别扩展名解析） |
| 尾部字符 | `shell.php.`、`shell.php ` （空格）、`shell.php%00.jpg` |
| 路径穿越 | `../../var/www/html/shell.php` |
| 特殊文件 | `.htaccess`（改变目录解析规则）、`web.config` |

::: warning
**`.htaccess` 上传是个经典的间接攻击**：攻击者不传脚本，而是传一个 `.htaccess`，内容是「把 `.jpg` 当 PHP 解析」。然后再传一个内容是 PHP 代码的 `.jpg`——**你的扩展名校验全程都通过了**。

所以白名单必须**同时限制文件名本身**，不只是扩展名。
:::

**正确做法是白名单**：

```javascript
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']);
const ext = path.extname(filename).toLowerCase();
if (!ALLOWED_EXT.has(ext)) reject();
```

### Content-Type：客户端说了算

```javascript
// ❌ 这个头是攻击者填的
if (file.mimetype !== 'image/jpeg') reject();
```

`Content-Type` 来自请求，改一下就是了。**它只能用来做「友好提示」，不能作为安全校验。**

### 魔数检测：能骗

检查文件头几个字节确实比看扩展名可靠：

```javascript
const SIGNATURES = {
  'ffd8ff':     'jpg',
  '89504e47':   'png',
  '47494638':   'gif',
  '25504446':   'pdf',
};
```

但**攻击者可以造一个「既是合法图片、又含恶意代码」的文件**：

```
FFD8FF... （合法的 JPEG 头）
...图片数据...
<?php system($_GET['c']); ?>     ← 追加在文件尾部
```

魔数检查通过，图片能正常显示，**但如果这个文件被当作 PHP 执行，尾部的代码就跑了**。这叫图片马。

同类的还有 **polyglot 文件**：一个文件同时是合法的 GIF 和合法的 JavaScript/HTML，用于绕过更复杂的校验。

## 真正管用的四条

单点校验都能绕，但下面这四条**改变的是「即使绕过了也做不了什么」**。

### 一、随机文件名 + 不保留用户路径

```javascript
import crypto from 'node:crypto';
import path from 'node:path';

const ext = path.extname(originalName).toLowerCase();
if (!ALLOWED_EXT.has(ext)) reject();

// 完全丢弃用户提供的文件名
const safeName = crypto.randomBytes(16).toString('hex') + ext;
const dest = path.join(UPLOAD_DIR, safeName);

// 双保险：确认最终路径确实在上传目录内（防路径穿越）
if (!path.resolve(dest).startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
  reject();
}
```

**为什么有效**：路径穿越、`.htaccess`、双扩展名、空字节截断——**这些手法全都依赖攻击者能控制文件名**。丢弃它，一整批攻击面消失。

原始文件名想保留就存进数据库，下载时通过 `Content-Disposition` 给回去，**不要用它做磁盘路径**。

### 二、上传目录禁止执行

[Nginx 陷阱那一章](/manual/computer-programming/web-security/nginx-pitfalls)讲过，这里再强调一次，因为它是这条链上最硬的一环：

```nginx
location ^~ /uploads/ {
    root /var/www;

    # 任何脚本扩展名一律拒绝
    location ~ \.(php|phtml|php\d|jsp|asp|aspx|cgi|pl|py|sh|htaccess)$ {
        deny all;
        return 403;
    }

    # 强制当作附件下载，且禁止 MIME 嗅探
    add_header Content-Disposition "attachment" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Content-Security-Policy "default-src 'none'; sandbox" always;
}
```

**更彻底的做法是文件系统层面剥夺执行权**：

```bash
chmod -R 644 /var/www/uploads       # 文件不可执行
chmod 755 /var/www/uploads          # 目录可进入
# 或者挂载时就带 noexec
mount -o remount,noexec /var/www/uploads
```

### 三、独立域名托管用户内容

这是**防御存储型 XSS 的关键一招**。

假设用户传了一个 HTML 文件（或者一个能被嗅探成 HTML 的文件），而它托管在 `example.com/uploads/x.html`——**访问它时，脚本运行在你的主域下**，能读 Cookie、能调你的 API。

```
❌ https://example.com/uploads/evil.html      ← 与主站同源
✅ https://usercontent-example.net/evil.html  ← 完全不同的站点
```

::: info
**必须是不同的「可注册域名」，不能只是子域名。**

`uploads.example.com` 和 `example.com` 是**同站**（same-site）。这意味着：`SameSite=Lax` 的 Cookie 会在它们之间携带，[子域名接管](/manual/computer-programming/web-security/subdomain-takeover)那章讲的问题也同样适用。

大厂都是这么做的——用户内容一律放在一个完全独立的域名下。这也是为什么各家的 CDN 内容域名看起来和主站毫无关系。
:::

配套的响应头：

```nginx
add_header Content-Security-Policy "default-src 'none'; sandbox" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Content-Disposition "attachment" always;   # 除非确实要内联展示
```

### 四、重新编码内容

对图片来说，这是最彻底的一招：**不保存用户上传的原始字节，而是解码后重新编码输出。**

```javascript
import sharp from 'sharp';

await sharp(uploadedBuffer)
  .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: 85 })          // 统一重编码为 JPEG
  .toFile(dest);
```

**为什么彻底**：追加在文件尾部的 PHP 代码、EXIF 里藏的脚本、polyglot 结构——**重编码之后全都不存在了**，输出的是一个干净的、由你的库生成的新文件。

同样的思路适用于 PDF（重新生成）、Office 文档（转换格式）。

::: warning
**但图像处理库本身就是攻击面。** ImageMagick 历史上出过 ImageTragick 这类严重漏洞（构造的图片文件触发命令执行），libvips、libpng 等也持续有 CVE——[本站上一轮依赖审计](/manual/computer-programming/web-security/dependency-audit)里 sharp 那条高危就是继承自 libvips。

所以重编码要配套：**保持库更新、限制处理超时与内存、最好放进独立的沙箱进程或容器里跑**。让「处理不可信文件」的那部分代码，拥有尽可能少的权限。
:::

## 别忘了资源限制

```javascript
// 应用层
const MAX_SIZE = 5 * 1024 * 1024;
if (file.size > MAX_SIZE) reject();
```

```nginx
# Nginx 层（要比应用层的限制略大一点，让应用能给出友好错误）
client_max_body_size 6m;
```

**还要防「解压炸弹」**：一个 42 KB 的 zip 解压出 4 GB。如果你的功能涉及解压，必须限制**解压后**的总大小和文件数，边解压边检查，而不是解完再看。

图片同理——**「像素炸弹」**：一张 100 KB 的 PNG 声明尺寸为 50000×50000，解码时需要几个 GB 内存。

```javascript
// 处理前先读元数据，尺寸不合理直接拒绝
const meta = await sharp(buffer).metadata();
if (meta.width * meta.height > 50_000_000) reject();    // 5000 万像素上限
```

## 完整流程

```javascript
async function handleUpload(file) {
  // 1. 大小
  if (file.size > MAX_SIZE) throw new Error('too large');

  // 2. 扩展名白名单
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) throw new Error('bad extension');

  // 3. 魔数校验（防止扩展名与内容不符）
  if (!matchesSignature(file.buffer, ext)) throw new Error('content mismatch');

  // 4. 像素炸弹检查
  const meta = await sharp(file.buffer).metadata();
  if (meta.width * meta.height > 50_000_000) throw new Error('too many pixels');

  // 5. 重编码（去掉一切夹带）
  const clean = await sharp(file.buffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  // 6. 随机文件名，丢弃用户提供的名字
  const safeName = crypto.randomBytes(16).toString('hex') + '.jpg';

  // 7. 存到独立域名托管的存储，目录禁止执行
  await storage.put(safeName, clean, { contentType: 'image/jpeg' });

  // 8. 原始文件名只存数据库，供下载时展示
  await db.files.insert({ id, storedName: safeName, displayName: file.originalname });

  return `https://usercontent-example.net/${safeName}`;
}
```

## 小结

- **任何单一校验都能被绕过**：扩展名黑名单、Content-Type、魔数各有对应手法。
- 真正管用的是四条：**随机文件名**（消灭一整批依赖文件名的攻击）、**上传目录禁止执行**、**独立域名托管**（必须是不同的可注册域名，不是子域名）、**内容重编码**。
- **`.htaccess` 上传**是绕过扩展名校验的经典间接手法。
- 重编码最彻底，但**图像处理库本身是攻击面**，要更新 + 限制资源 + 隔离运行。
- 别忘了**解压炸弹与像素炸弹**——处理前先看元数据。

下一章讲把这些系统串起来的那些秘密。👉 [密钥与凭据管理](/manual/computer-programming/web-security/secrets)
