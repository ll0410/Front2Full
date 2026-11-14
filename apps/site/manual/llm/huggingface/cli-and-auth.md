---
title: "命令行与登录"
description: "hf CLI 安装、hf_xet 高速存储后端、token 权限分级、缓存目录，以及 CI 里怎么安全地用 token。"
source: "https://daiw.org/manual/huggingface/cli-and-auth"
---

# 命令行与登录

> hf CLI 安装、hf_xet 高速存储后端、token 权限分级、缓存目录，以及 CI 里怎么安全地用 token。

`hf` 是官方命令行工具。**注意它改过名**——旧文章里的 `huggingface-cli` 是同一个东西，现在推荐用 `hf`。

## 安装

```bash
pip install -U huggingface_hub
```

```bash
hf version
```

自 `huggingface_hub` 1.x / 2.x 起，Hugging Face Hub 已从传统的 Git LFS 全面迁移到基于分块去重的 **Xet 存储后端（`hf_xet`）**，`pip install -U huggingface_hub` 会**默认自动安装 `hf_xet`**（Rust 实现的并发分块传输引擎）。如果想在万兆带宽或服务器环境下进一步榨干下载/上传速度，可以开启 Xet 高性能模式：

```bash
export HF_XET_HIGH_PERFORMANCE=1
```

::: info

**关于旧教程里的 `hf_transfer`**：早期版本常用 `pip install "huggingface_hub[hf_transfer]"` 配合 `HF_HUB_ENABLE_HF_TRANSFER=1` 提速。如今官方已将 **`hf_transfer` 标记为弃用（deprecated）**，由默认内置的 **`hf_xet`** 接替。

如果遇到极少数网络环境与 Xet 分块传输不兼容、需要排查底层 HTTP 报错，可以临时设 `HF_HUB_DISABLE_XET=1` 回退到普通 HTTP 下载。

:::

## 登录

```bash
hf auth login
```

粘贴 token 后会存到 `~/.cache/huggingface/token`。

验证：

```bash
hf auth whoami
```

### 什么时候必须登录

| 场景 | 要登录吗 |
| --- | --- |
| 下载公开模型 | 否 |
| 下载 **gated 模型**（Llama 等） | **是**，且要先在网页同意条款 |
| 下载私有仓库 | 是 |
| 上传任何东西 | 是 |
| 高频下载 | 建议——匿名请求的限流更严 |

## Token 权限分级

在 [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) 创建。有三类：

| 类型 | 能干什么 | 用在哪 |
| --- | --- | --- |
| **Read** | 下载（含 gated / 私有） | **日常首选** |
| **Write** | 读 + 上传 + 改仓库 | 需要 push 时 |
| **Fine-grained** | 精确到具体仓库与操作 | **CI / 自动化首选** |

::: warning

**别在 CI 里用 Write token。**

Write token 对你账号下**所有**仓库都有写权限——CI 日志一旦泄露，攻击者能改你全部模型和数据集。

正确做法是 **Fine-grained token**：创建时只勾选目标仓库 + 需要的动作（比如“只允许写 `me/my-model`”）。爆了也只影响那一个仓库。

另外：**token 绝不进仓库**。走 CI Secrets、或本地 `hf auth login` 存到 `~/.cache`。

:::

### 在环境变量里给 token

```bash
export HF_TOKEN=hf_xxxxx
```

`huggingface_hub` 会自动读 `HF_TOKEN`，**不需要额外调用登录**。这是 Docker / CI 里最常用的方式。

```yaml
# GitHub Actions
- run: hf download org/model
  env:
    HF_TOKEN: ${{ secrets.HF_TOKEN }}
```

## 常用命令

```bash
# 下载整个仓库
hf download Qwen/Qwen3-8B

# 只下某个文件
hf download Qwen/Qwen3-8B config.json

# 下数据集（注意 --repo-type）
hf download --repo-type dataset squad

# 下到指定目录（而不是缓存）
hf download Qwen/Qwen3-8B --local-dir ./models/qwen3-8b

# 上传
hf upload me/my-model ./local-folder

# 看缓存占用
hf cache scan

# 清理缓存（交互式选择）
hf cache delete
```

## 缓存目录

默认位置：

```text
~/.cache/huggingface/
├── hub/                          模型与数据集
│   ├── models--Qwen--Qwen3-8B/
│   │   ├── blobs/                真实文件（按 hash 命名）
│   │   ├── snapshots/
│   │   │   └── <commit>/         指向 blobs 的符号链接
│   │   └── refs/main             当前 commit
│   └── datasets--squad/
├── xet/                          Xet 分块缓存
└── token                         登录凭据
```

::: info

**这个 blobs + 符号链接的结构不是多此一举。**

它让**多个 revision 共享未改动的文件**：模型更新时只改了 config，权重文件不会重复下载和存储。同理，两个模型如果有完全相同的 tokenizer 文件，只存一份。

副作用是：**直接 `cp -r` 拷贝缓存目录会把符号链接展开**，体积暴增。要迁移缓存用 `cp -a` 或 `rsync -a` 保留链接。

:::

### 换个位置

```bash
export HF_HOME=/data/hf
```

**这是最该先设的一个变量。** 默认缓存在系统盘的用户目录下，几个大模型就能把 C 盘 / 根分区撑满。

Windows PowerShell：

```powershell
$env:HF_HOME = "D:\hf"
```

要永久生效，写进系统环境变量或 shell 配置文件。

### 缓存管理

```bash
hf cache scan
```

```text
REPO ID              SIZE ON DISK  NB FILES  LAST_ACCESSED
Qwen/Qwen3-8B        16.4G         12        2 days ago
meta-llama/Llama-3.. 15.2G         14        3 months ago
```

**`LAST_ACCESSED` 是清理的依据**——三个月没碰过的多半可以删。

```bash
hf cache delete
```

交互式界面里勾选要删的 revision。比手动 `rm -rf` 安全，它知道哪些 blob 还被别的 revision 引用。

## 环境变量速查

| 变量 | 作用 |
| --- | --- |
| `HF_HOME` | 缓存根目录（**优先设这个**） |
| `HF_TOKEN` | 认证 token |
| `HF_ENDPOINT` | 换镜像站，见[国内访问](/manual/llm/huggingface/china-access) |
| `HF_XET_HIGH_PERFORMANCE=1` | 开启默认 `hf_xet` 引擎的高性能并发模式（旧版 `HF_HUB_ENABLE_HF_TRANSFER=1` 已弃用） |
| `HF_HUB_DISABLE_XET=1` | 排查网络问题时临时禁用 Xet 分块传输 |
| `HF_HUB_OFFLINE=1` | **离线模式**：只用缓存，不发任何请求 |
| `HF_HUB_DISABLE_SYMLINKS_WARNING` | 关掉 Windows 上的符号链接警告 |

::: info

**`HF_HUB_OFFLINE=1` 在两个场景下很有用：**

1. **内网 / 无外网环境**——先在有网的机器上下好，拷贝缓存目录过去，设这个变量就能正常跑。
2. **确保不会偷偷联网**——有些库会在加载时检查更新，设了它就完全走本地。

设了之后如果缓存里没有，会明确报错，而不是卡在网络超时。

:::

## Windows 的符号链接问题

Windows 上创建符号链接需要开发者模式或管理员权限。没开的话会看到：

```text
`huggingface_hub` cache-system uses symlinks by default ...
Your machine does not support them.
```

**不影响使用**，只是缓存会退化成复制文件（占更多空间）。想要正常行为：

```text
设置 → 隐私和安全性 → 开发者选项 → 打开“开发人员模式”
```

## Python API 里的对应写法

```python
from huggingface_hub import login, snapshot_download, hf_hub_download

login(token="hf_xxx")                      # 或依赖 HF_TOKEN 环境变量

# 整个仓库
path = snapshot_download("Qwen/Qwen3-8B")

# 单个文件
cfg = hf_hub_download("Qwen/Qwen3-8B", filename="config.json")
```

细节（只下部分文件、断点续传、并发）见[下一篇](/manual/llm/huggingface/downloading)。

## 小结

- 命令是 **`hf`**（旧名 `huggingface-cli`）。
- **先设 `HF_HOME`**，别让模型撑满系统盘。
- 新版 `huggingface_hub` 默认内置 **`hf_xet`** 分块传输引擎（大带宽可开 **`HF_XET_HIGH_PERFORMANCE=1`**；旧版 `hf_transfer` 已弃用）。
- **CI 用 fine-grained token，绝不用 Write token**；token 走环境变量或 Secrets，不进仓库。
- 缓存是 **blobs + 符号链接**结构，迁移要用 `cp -a` / `rsync -a`。
- **`hf cache scan` 看占用、`hf cache delete` 安全清理**。
- 离线环境设 **`HF_HUB_OFFLINE=1`**。

下一篇：[下载](/manual/llm/huggingface/downloading)。
