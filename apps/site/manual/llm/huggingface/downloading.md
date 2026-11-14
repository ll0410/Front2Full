---
title: "下载"
description: "只下需要的文件、断点续传、并发与 hf_xet 调优，以及 local-dir 与缓存该选哪个。"
source: "https://daiw.org/manual/huggingface/downloading"
---

# 下载

> 只下需要的文件、断点续传、并发与 hf_xet 调优，以及 local-dir 与缓存该选哪个。

下载看起来最简单，实际最容易浪费时间——**下了一堆用不上的文件、断了从头再来、下完发现格式不对**。这一篇讲怎么下得准。

## 三种方式

```bash
# ① 命令行
hf download Qwen/Qwen3-8B
```

```python
# ② Python API
from huggingface_hub import snapshot_download
snapshot_download("Qwen/Qwen3-8B")
```

```python
# ③ 由 transformers 自动触发
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen3-8B")
```

第三种最方便，但**你不知道它会下多少东西**。首次接触一个陌生仓库时，建议先用前两种明确控制。

## 只下需要的文件

这是最能省时间的一招。[前面](/manual/llm/huggingface/repo-anatomy)说过，一个仓库常同时放 safetensors 和 `.bin` 两套等价权重——全下等于流量翻倍。

```bash
# 排除 pickle 权重与 TensorFlow 权重
hf download Qwen/Qwen3-8B \
  --exclude "*.bin" "*.h5" "*.msgpack" "*.onnx"
```

```python
from huggingface_hub import snapshot_download

snapshot_download(
    "Qwen/Qwen3-8B",
    allow_patterns=["*.safetensors", "*.json", "tokenizer*"],
    ignore_patterns=["*.bin", "original/*"],
)
```

::: info

**一个通用的安全 pattern**，适用于绝大多数 transformers 模型：

```python
allow_patterns=["*.safetensors", "*.json", "*.model", "*.txt", "*.jinja"]
```

这会拿到权重、所有配置、tokenizer（含 sentencepiece 的 `.model` 与独立的 `chat_template.jinja`），跳过 `.bin`、README 里的图片、TF/Flax 权重。

**注意别漏了 `*.json`**——`model.safetensors.index.json` 是分片索引，漏了会加载失败。

:::

### 只下一个量化版本

GGUF 仓库常有十几个量化档，每个几个 G：

```bash
# 只要 Q4_K_M 那一个文件
hf download Qwen/Qwen3-8B-GGUF \
  --include "*Q4_K_M*" \
  --local-dir ./models
```

**不加 `--include` 会把所有量化档全下**——可能是几十 GB。这是 GGUF 下载最常见的坑。

## local-dir 还是缓存

```bash
# 默认：进缓存，用符号链接
hf download Qwen/Qwen3-8B

# 指定目录：文件直接放这里
hf download Qwen/Qwen3-8B --local-dir ./models/qwen3-8b
```

| | 缓存（默认） | `--local-dir` |
| --- | --- | --- |
| 去重 | ✅ 多版本共享 blob | ❌ 各存各的 |
| 被 `from_pretrained("org/name")` 自动找到 | ✅ | ❌ 要给路径 |
| 方便拷贝 / 挂载进容器 | ❌ 符号链接易踩坑 | ✅ 就是普通文件 |
| 适合 | **日常开发** | **部署、给 llama.cpp 用、离线分发** |

::: warning

**`--local-dir` 拿到的是普通文件，但仍会在目录内 `.cache/huggingface/` 留一份下载元数据**（用于断点续传与增量更新）。

另外，**给 Docker 镜像准备模型时优先用 `--local-dir`**——符号链接跨容器层拷贝时经常断掉，出现“文件存在但是空的”这种诡异现象。

:::

## 断点续传

**默认就开着**（旧版 `resume_download=True` 参数在 `huggingface_hub` 1.x+ 中已废弃移除，因为始终默认开启）。下到一半断网，重跑同一条命令会接着下，不会从头开始。

```bash
hf download Qwen/Qwen3-8B     # 断了就再跑一遍，会续
```

原理是未完成文件先落到临时分片或 `.incomplete` 后缀，完成后才原子改名。所以：

- **别手动删 `.incomplete` 文件**，那正是续传的依据。
- 如果怀疑文件损坏，用 `--force-download` 强制重下。

```bash
hf download Qwen/Qwen3-8B --force-download
```

## 提速

### 并发数

```python
snapshot_download("Qwen/Qwen3-8B", max_workers=8)
```

默认 8。**分片多的大模型可以调高**（16），但要注意：

- 家宽上并发太高反而更慢（触发限速、丢包重传）。
- 走[镜像站](/manual/llm/huggingface/china-access)时，镜像的承受能力可能不如官方。

### `hf_xet`（默认内置）与旧版 `hf_transfer`

在 `huggingface_hub` 1.x / 2.x 中，安装时已默认包含 Rust 编写的 **`hf_xet`** 分块传输引擎；在高带宽服务器上可开启高性能模式：

```bash
export HF_XET_HIGH_PERFORMANCE=1
```

如果你维护的是仍在使用 `huggingface_hub < 1.0` 的老环境，则对应旧版的 `hf_transfer`（现已标记为 deprecated）：

```bash
# 仅限旧版环境（新版已由默认安装的 hf_xet 替代）
pip install "huggingface_hub[hf_transfer]"
export HF_HUB_ENABLE_HF_TRANSFER=1
```

::: warning

**下载卡住或报错信息过于简略时，先关掉高速引擎排查。** 无论走代理还是走第三方镜像，遇到连接异常时可以先回退到标准 HTTP 下载器看详细状态码（401、404、超时或磁盘满）：

```bash
HF_HUB_DISABLE_XET=1 HF_HUB_ENABLE_HF_TRANSFER=0 hf download org/model
```

:::

## 钉住版本

```bash
hf download Qwen/Qwen3-8B --revision a1b2c3d4
```

```python
snapshot_download("Qwen/Qwen3-8B", revision="a1b2c3d4")
```

`revision` 可以是 commit hash、分支名或 tag。**生产环境用 commit hash**——分支会移动，你今天下的和下个月下的可能不是一个东西。

查有哪些 revision：

```python
from huggingface_hub import list_repo_refs
refs = list_repo_refs("Qwen/Qwen3-8B")
print([b.name for b in refs.branches])
```

## 先看看有什么再下

下之前列文件，避免盲下：

```python
from huggingface_hub import HfApi

api = HfApi()
info = api.model_info("Qwen/Qwen3-8B", files_metadata=True)

for f in info.siblings:
    size = (f.size or 0) / 1e9
    if size > 0.01:
        print(f"{size:6.2f} GB  {f.rfilename}")
```

```text
  3.89 GB  model-00001-of-00005.safetensors
  3.86 GB  model-00002-of-00005.safetensors
  ...
```

**花两秒钟看一眼，能避免下错 20 GB。**

## 常见报错

| 报错 | 原因与解法 |
| --- | --- |
| `401 Unauthorized` | gated 模型：先网页同意条款，再 `hf auth login` |
| `403 Forbidden` | token 权限不足，或该仓库你没有访问权 |
| `404 Not Found` | 仓库名拼错；或下数据集忘了 `--repo-type dataset` |
| `Connection error / timeout` | 网络问题——见[国内访问](/manual/llm/huggingface/china-access) |
| `OSError: [Errno 28] No space left` | 磁盘满，或 `HF_HOME` 还指着小分区 |
| `Consistency check failed` | 下载的文件与预期 hash 不符 → `--force-download` 重下 |

::: info

**`Consistency check failed` 值得单独说。** 它意味着下下来的字节和服务器声明的不一致——通常是网络中间设备（某些代理、运营商缓存）改了内容，或者磁盘写入出错。

**不要忽略它继续用**——损坏的权重加载后可能不报错，只是输出乱七八糟。

:::

## 一个可复用的下载脚本

```python
import os
from huggingface_hub import snapshot_download

os.environ.setdefault("HF_XET_HIGH_PERFORMANCE", "1")

def fetch(repo_id: str, out: str | None = None, revision: str | None = None):
    return snapshot_download(
        repo_id,
        revision=revision,
        local_dir=out,
        allow_patterns=["*.safetensors", "*.json", "*.model", "*.txt", "*.jinja"],
        max_workers=8,
    )

if __name__ == "__main__":
    p = fetch("Qwen/Qwen3-8B", out="./models/qwen3-8b")
    print("已下载到", p)
```

## 小结

- **下之前先列文件看大小**，两秒钟能省 20 GB。
- 用 `allow_patterns` / `--exclude` **跳过 `.bin` 等重复权重**；通用安全组合是 `["*.safetensors", "*.json", "*.model", "*.txt", "*.jinja"]`。
- **GGUF 仓库必须 `--include` 指定量化档**，否则全下。
- 日常用**缓存**，部署/容器用 **`--local-dir`**（符号链接跨容器层易断）。
- **断点续传默认开着**（无需再传已废弃的 `resume_download=True`），别删 `.incomplete`。
- **下载卡住先设 `HF_HUB_DISABLE_XET=1`** 看标准 HTTP 报错。
- 生产环境**钉 commit hash**。
- `Consistency check failed` 说明文件损坏，**必须重下，别硬用**。

下一篇：[国内访问](/manual/llm/huggingface/china-access)。
