---
title: "上架 Chrome Web Store"
description: "Chrome 插件开发指南 · zip 打包、开发者账号、审核"
source: "https://daiw.org/manual/chrome-extension/publish-chrome-web-store"
---

# 上架 Chrome Web Store

Chrome 插件开发指南 · zip 打包、开发者账号、审核

上架流程本身不复杂，真正耗时间的是**审核**——而绝大多数被拒的原因，在你写第一行代码时就已经埋下了。这一章按「先讲会被拒的坑，再讲流程」来组织。

## 会被拒的六件事

按实际出现频率排：

### ① 权限与功能不匹配

商店政策要求「**请求的权限必须与已声明的功能直接相关**」。

| 情况 | 结果 |
| ---- | ---- |
| 截图扩展要 `history` | 要求解释，说不清就拒 |
| 简单工具要 `<all_urls>` | 要求解释 |
| 声明了但代码里没用的权限 | **直接拒** |

**上传前把 manifest 的权限列表逐条过一遍**，问自己「哪个功能用到它？」。答不上来就删掉。参考[权限模型](/manual/computer-programming/chrome-extension/permissions)——很多场景用 `activeTab` 就够。

### ② 远程代码

MV3 **禁止远程托管代码**。以下都算：

```javascript
// ✗ 全部违规
<script src="https://cdn.example.com/lib.js"></script>
eval(await (await fetch('/rules.js')).text());
new Function(remoteCode)();
```

技术上 [CSP 也挡住了大部分](/manual/computer-programming/chrome-extension/content-security)，但审核会额外人工看。

**允许的**：从服务器拉**数据**（JSON、配置、规则），只要不是可执行代码。界限是「拉回来的东西会不会被当代码执行」。

### ③ 描述与实际功能不符

商店描述里写了但没做的功能、截图展示了但实际没有的界面——都会被拒。**宁可少写。**

### ④ 隐私政策缺失

**只要处理任何用户数据**（包括存储浏览记录、账号信息、甚至用户自己填的配置），就必须：

- 在开发者面板填写**隐私实践**声明
- 提供**隐私政策 URL**（一个能公开访问的页面）

「我只存在本地」也要声明——面板里有对应的选项。**这一项漏填是首次上架被拒的常见原因**。

### ⑤ 代码混淆

**允许压缩（minify），禁止混淆（obfuscate）。** 审核需要能读懂你的代码。

用了打包工具的话，确保：

```javascript
// terser / esbuild 配置
{ minify: true, mangle: true }        // ✅ 正常压缩
{ obfuscate: true }                   // ❌ 会被拒
```

### ⑥ 单一用途原则

一个扩展应当**只做一件事**。「广告拦截 + 密码管理 + 天气预报」三合一会被要求拆分。

::: warning
**先读政策，再写代码。** 上面这些不是「提交时改一下」就能过的——比如你的核心功能就是执行用户提供的脚本，那从架构上就要用 [sandbox 页面](/manual/computer-programming/chrome-extension/content-security) 而不是想办法绕 CSP。

发现得越晚，返工越大。
:::

## 开发者账号

1. 访问 [Chrome Web Store 开发者面板](https://chrome.google.com/webstore/devconsole)
2. 用 Google 账号登录
3. 支付**一次性 5 美元**注册费（终身有效，可发布多个扩展）
4. 完成账号验证（邮箱、联系方式）

::: info
**用一个专门的账号，别用个人主号。**

开发者账号的邮箱会以「联系开发者」的形式暴露给用户，而且账号一旦因政策问题被封，是**连带**的——同一账号下的所有扩展一起下架。隔离开更稳妥。
:::

## 打包

```bash
pnpm build
cd dist && zip -r ../extension.zip . -x '*.map' -x '.DS_Store'
```

要点：

- **压缩的是目录内容，不是目录本身**——`manifest.json` 必须在 zip 根目录。
- **排除 source map**（体积翻倍，且暴露源码结构）。
- 排除 `.DS_Store`、`Thumbs.db` 等系统文件。
- 别把 `node_modules/`、`src/` 打进去。

验证一下 zip 结构：

```bash
unzip -l extension.zip | head
```

第一行应该直接是 `manifest.json`，而不是 `dist/manifest.json`。

### 上传前的自检清单

```text
□ manifest_version 是 3
□ version 比线上版本大
□ 有 128×128 图标
□ 权限列表里没有开发期残留（declarativeNetRequestFeedback 等）
□ 没有 console.log 泄露内部信息
□ 没有硬编码的 API key
□ zip 根目录就是 manifest.json
□ 装一遍解压后的 dist/ 确认功能正常
```

**最后一条最重要**：把 `dist/` 用「加载已解压的扩展程序」装一遍完整走一遍流程。很多问题（路径写错、资源没打包进去）只有在构建产物上才暴露。

这份清单里的前四条可以自动化，见[测试策略](/manual/computer-programming/chrome-extension/testing)里的 manifest 校验。

## 商店素材

| 项目 | 要求 |
| ---- | ---- |
| 名称 | ≤ 75 字符 |
| 简短描述 | ≤ 132 字符，**列表页显示的就是它** |
| 详细描述 | ≤ 16000 字符，支持换行 |
| 图标 | 128×128 PNG |
| **截图** | **至少 1 张**，1280×800 或 640×400 |
| 小型宣传图块 | 440×280（可选，但影响推荐位） |

::: info
**简短描述是转化率的关键**——用户在搜索结果里只看得到它。

写「用 AI 总结当前网页，一键生成要点」比写「一个基于人工智能技术的浏览器辅助工具」有效得多。**说清楚它做什么，别说它是什么。**
:::

截图要展示**真实界面**，不要放纯文字的宣传海报——审核会看，用户也会因为货不对板给差评。

## 发布流程

```text
上传 zip
  ↓
填写商店列表（描述、截图、分类、语言）
  ↓
填写隐私实践（数据用途 + 隐私政策 URL）
  ↓
选择发布范围（公开 / 不公开 / 指定测试者）
  ↓
提交审核  →  数分钟到数天不等
  ↓
通过 → 上线
```

### 发布范围

| 范围 | 说明 |
| ---- | ---- |
| **公开** | 所有人可搜到 |
| **不公开（Unlisted）** | 有链接才能装，搜不到——**适合内测** |
| **私有** | 仅指定的测试者账号 |

**首次上架建议先发 Unlisted 跑一段时间**，确认没问题再转公开。转换不需要重新审核。

### 分阶段发布

更新时可以只推给一部分用户：

```text
部署百分比：10% → 观察崩溃与差评 → 50% → 100%
```

**用户量大的扩展一定要用这个**。扩展的更新是**自动推送**的，一个坏版本几小时内就能装到所有人机器上，且没有回滚按钮——只能再发一个更高版本号的修复版。

## 更新

```bash
# 1. 改版本号（manifest.version 必须严格递增）
# 2. 重新构建打包
# 3. 面板里上传新 zip → 提交审核
```

::: warning
**版本号不能回退。** 发了 `1.2.0` 之后，再也不能提交 `1.1.x`。发现新版有问题，只能**往上**发修复版（`1.2.1`）。

这也是[前面](/manual/computer-programming/chrome-extension/manifest-overview)建议从 `0.1.0` 起步的原因——给自己留足空间。
:::

**更新审核通常比首次快**，但如果改动涉及新增权限，会走完整流程，且用户端会**暂停自动更新直到手动确认新权限**——所以加权限这件事要慎重。

## 用 API 自动发布

CI 里自动发版（使用 **Chrome Web Store API v2**，旧版 v1.1 接口已停用）：

```bash
# 1. 拿 refresh token（一次性，OAuth 流程，或在开发者后台配置 Service Account）
# 2. CI 里用它换 access token
# 3. 上传 + 发布（需替换 $PUBLISHER_ID 与 $EXTENSION_ID）
curl -H "Authorization: Bearer $TOKEN" \
     -X POST -T extension.zip \
     "https://chromewebstore.googleapis.com/upload/v2/publishers/$PUBLISHER_ID/items/$EXTENSION_ID:upload"
# 4. 提交发布审核

curl -H "Authorization: Bearer $TOKEN" \
     -H "Content-Length: 0" \
     -X POST \
     "https://chromewebstore.googleapis.com/v2/publishers/$PUBLISHER_ID/items/$EXTENSION_ID:publish"
```

现成 action：`mnao305/chrome-extension-upload`。

**凭据（client id / secret / refresh token）走 CI Secrets，绝不进仓库。**

## 被拒了怎么办

拒信里会给**具体的政策条款编号**。处理顺序：

1. **读那条政策原文**，不要只看拒信摘要。
2. 改代码或改描述。
3. 在重新提交时的备注里**说明改了什么**。
4. 如果确信是误判，用面板里的申诉入口——但**先假设自己错了**，误判比例很低。

最常见的拒信是权限相关，而它往往不需要改代码——**在商店描述里把每个权限为什么必要讲清楚**就能过。

## 小结

- **被拒的原因大多在写代码时就埋下了**——先读政策再动手。
- 六大高频问题：**权限不匹配、远程代码、描述不符、缺隐私政策、代码混淆、多用途**。
- 用**专门的开发者账号**，5 美元一次性。
- zip 里 **`manifest.json` 必须在根目录**，排除 source map。
- **简短描述决定转化率**——说清楚做什么。
- 首发走 **Unlisted**，更新用**分阶段发布**。
- **版本号只能升不能降**，坏版本只能往上修。
- 新增权限会暂停用户端自动更新——慎重。

---

到这里，Manifest V3 的核心概念、通信存储、权限安全、进阶 API 与工程化就都讲完了。想动手，回到 [10 课实战](/manual/computer-programming/chrome-extension/lesson-01-hello-popup)；想查具体字段，回[专栏首页](/manual/computer-programming/chrome-extension/)按目录跳转。
