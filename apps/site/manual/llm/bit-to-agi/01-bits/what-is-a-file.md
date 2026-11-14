---
title: "文件是什么"
description: "inode、路径与字节流——model.safetensors 在磁盘上究竟是什么。"
source: "https://daiw.org/manual/bit-to-agi/01-bits/what-is-a-file"
---

# 文件是什么

> inode、路径与字节流——model.safetensors 在磁盘上究竟是什么。

「保存模型」「读 dataset」——开发者每天在说文件，但**文件不是物理物体**，是操作系统用 **inode + 目录项 + 字节块** 组织出来的一种抽象：一串有名字、有长度的 bit 序列。搞清这一点，就明白为什么 `.safetensors` 可以 mmap、为什么 Git LFS 要单独存大文件。

## 直觉：图书馆索书号 + 书架格子

**路径**像索书号（`/models/llama-8b/model.safetensors`），**inode** 像图书卡片（大小、权限、数据块指针），真正内容在磁盘块里——可能不连续，像书页散在不同架位，OS 帮你拼成连续字节流读出来。

## 定义

| 概念 | 含义 |
| ---- | ---- |
| 文件 | 有序字节序列 + 元数据（大小、mtime、权限） |
| 目录 | 文件名 → inode 的映射表，不是「文件夹实体」 |
| 硬链接 | 多个文件名指向同一 inode（同一数据） |
| 符号链接 | 存路径字符串，可跨文件系统 |

Unix 哲学：**everything is a file**（socket、pipe、设备也可当字节流）。

## 例子一：Safetensors 权重文件

Llama 3 8B 的 `model.safetensors` 约 **16 GB**（FP16）。磁盘上：

- inode 记录 size ≈ $16 \times 2^{30}$ 字节
- 数据由 ext4/xfs 等以 **4 KB block** 分配（常见 block size）
- 读取时 `read()` 或 **mmap** 映射到虚拟地址空间，页 fault 时载入物理页

```python
import os
st = os.stat("model.safetensors")
print(st.st_size / 1e9, "GB", "blocks 粗算", st.st_size // 4096 + 1)
```

## 例子二：文本 vs 二进制

| 类型 | 解释方式 | 例子 |
| ---- | -------- | ---- |
| 文本 | UTF-8 等编码 | `.md`、`.json`、`.py` |
| 二进制 | 按格式 schema 解析 | `.safetensors`、`.png`、`.mp4` |

**同一扩展名不保证格式**——`.bin` 可能是 HuggingFace 旧权重或任意 blob。Magic number（如 PNG `89 50 4E 47`）才可靠。

```bash
# 看文件头几个字节
xxd -l 16 model.safetensors
# safetensors 以 JSON header 长度开头
```

## 量化：AI 工程里的文件规模

| 对象 | 典型大小 |
| ---- | -------- |
| tokenizer.json | 1–10 MB |
| 7B FP16 单文件 | ~14 GB |
| 70B 分片 8× | 每片 ~17 GB |
| 1M 条 JSONL 微调集 | 1–50 GB |
| checkpoint（含 optimizer） | 2–3× 模型权重 |

Hugging Face Hub 用 **Git + LFS**：小文件进 Git，大 blob 存 LFS 指针文件——仓库里 `.gitattributes` 指定 `*.safetensors filter=lfs`。

## mmap 与 IO

大模型加载常用 **memory-mapped file**：虚拟内存直接映射文件，按需 page in，**多个进程可共享只读页**——比 `read()` 全进 heap 省物理 RAM。PyTorch `torch.load(..., mmap=True)` 利用此机制。

顺序读 16 GB，NVMe ~3 GB/s → **~5 秒**；HDD ~150 MB/s → **~100 秒**——部署时磁盘类型影响冷启动。

## 目录树与路径解析

`/models/llama/` 不是嵌套文件夹实体，是**命名空间**：每个路径分量查一次目录 inode。`..` 回父目录，`/` 根。**硬链接** `link old new` 两文件名同 inode、同 `st_nlink` 计数；删一个文件名，数据块直到 `nlink=0` 且无 fd 打开才释放。

**Copy-on-Write**（Docker overlayfs）：镜像层只读，容器写时复制 block 到新层——AI 训练 checkpoint 频繁写大文件时 overlay 可能 **2× 空间** 峰值，生产常 bind mount 裸盘。

## 分片（Sharding）与 tensor 存储

70B 模型常拆 **8× ~17 GB** shard：`model-00001-of-00008.safetensors`。每 shard 是独立文件；加载时 parallel read 可 saturate NVMe。**index.json** 映射 tensor 名 → `(file, offset, shape, dtype)`——仍是字节偏移 + 解释规则。

Zarr、HDF5 支持 chunk + 压缩；PyTorch 生态 safetensors 因 **无 pickle 安全风险** 与 mmap 友好成为主流（2023 起）。

## 权限 bit 与模型文件安全

`chmod 600 model.safetensors`：owner read/write 共 **6** = `rw-`；others 无权限——**权重即知识产权**，泄露文件等于泄露 bit 级模型。`.gitignore` 排除 `*.bin`；CI 用 secret 拉 HF token 下载，不把 **GB 级 bit** 进 git history。

Pickle `.pth` 可 **反序列化执行任意代码**——safetensors 只存 tensor 裸数据 + JSON header，**无 arbitrary code execution**，生产应用 safetensors 为主因之一（不仅是 mmap）。

## 场景实战：`huggingface-cli download` 发生了什么

先把 CLI 装上。它现在叫 `hf`（2025 年 7 月由 `huggingface-cli` 改名，旧命令名仍作别名保留，所以本节标题里的 `huggingface-cli download` 依旧能用）：

```bash
# 随 Python 包安装(最常见;同时提供 hf 与旧的 huggingface-cli 别名)
pip install -U "huggingface_hub"

# 或用官方独立安装器
curl -LsSf https://hf.co/cli/install.sh | bash          # macOS / Linux
# Windows PowerShell: powershell -ExecutionPolicy ByPass -c "irm https://hf.co/cli/install.ps1 | iex"

hf version                     # 验证安装
hf auth login                  # 登录(下载私有/门控模型才需要)
hf download Qwen/Qwen3-0.6B    # 下载,等价于旧的 huggingface-cli download
```

CLI 从 CDN **HTTP range** 拉 `.safetensors` 分片，写入 `~/.cache/huggingface/hub/`——**bit 从网络到本地文件**。`from_pretrained` 再 **mmap** 到进程；首次 forward 可能 **page fault** 逐页载入 RAM。删 cache 再跑，冷启动延迟 **秒级** 重现——**文件即持久化 bit 仓库**。

`config.json`、`tokenizer.json` 是 **KB 级** UTF-8 JSON；与 **GB 级** 权重同目录，compose 成完整 runnable 模型包——**小文件定 schema，大文件填参数 bit**。

## 常见误区

1. **「删除文件 = 立刻释放空间」**——若仍有进程 open，inode 数据块直到 fd 关闭才回收。
2. **「文件名决定类型」**——只是约定；OS 不看扩展名，只看你 `write()` 的字节。
3. **「云存储没有文件」**——S3 object 同样是 key + byte stream + metadata，语义同构。

## 动手试一试

用 `hexdump` 思维读小文件：

```python
from pathlib import Path
p = Path("hello.txt")
p.write_text("模型\n", encoding="utf-8")
raw = p.read_bytes()
print(raw, raw.hex())
# b'\xe6\xa8\xa1\xe5\x9e\x8b\n' — 6 字节 UTF-8 + 换行 0x0a
```

## 延伸思考

**Content-addressable storage**（IPFS、OCI layer）用 **hash 指代文件 bit 内容**——相同权重文件 hash 相同，不同 **1 bit** hash 雪崩。Model hub **revision tag** 背后是 **commit hash 对应的 bit 快照**。Legal 审计「用的是哪个模型」应回答 **hash + 文件大小 + dtype**，而非 marketing 名。**Symlink** 让多个部署路径共享同一 inode 权重，省磁盘 bit 不省 VRAM——加载几次仍占几份显存，除非 **进程间共享 mmap 只读**。

## 补充：`du` 与 `ls -lh`

```bash
du -sh ~/.cache/huggingface/hub/models--*
ls -lh model*.safetensors
```

**du** 看目录实际占用（含 sparse）；**ls** 看文件 logical size。删 cache 前用 **du** 确认释放量——**HF cache 常占数十 GB 磁盘 bit**，与 VRAM 无关但影响 CI 磁盘。

## 温故：文件是 AI 资产的容器

Model Card、License、eval 结果写在 **Markdown/JSON 小文件**；能力在 **GB 级 tensor 文件**。备份策略：**3-2-1 法则** 同样适用于权重——丢失 bit 等于丢失模型。合规删除 = **secure erase 字节**，不是删目录项就完事（SSD TRIM 另论）。

## 小结

文件 = 命名字节流 + inode 元数据。模型权重、语料、代码都是文件；路径是人类索引，块是物理存储。理解文件，才能理解 mmap、分片、LFS 与加载延迟。**生产环境** 应用 **content hash** 指代模型版本，而不是仅依赖 `latest` 标签。**Reproducibility** 从 bit-identical 权重文件开始，而非仅靠 random seed。**Model card** 应写清 **文件 hash 与 dtype**。

**Git LFS** 指针文件本身只是 **百字节 text**。

## 第一章衔接

本章用 **bit 语言** 描述 AI 底座；第二章 **[数学](/manual/llm/bit-to-agi/02-math)** 用 **向量与矩阵** 重述同一物理过程。两章对照读：**bytes 是存储，FLOPs 是计算，带宽是瓶颈**——三个量构成工程三角。

下一篇：[内存是什么](/manual/llm/bit-to-agi/01-bits/what-is-memory)——文件读入内存后发生了什么。发布模型前除 LICENSE 外，建议附带 **SHA256 清单**——下游用同一 hash 校验，避免 **CDN 损坏或中间人替换 bit** 导致 silent 行为漂移。
