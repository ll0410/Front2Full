---
title: "国内访问"
description: "镜像站配置、ModelScope 替代方案、离线搬运，以及各方式的取舍。"
source: "https://daiw.org/manual/huggingface/china-access"
---

# 国内访问

> 镜像站配置、ModelScope 替代方案、离线搬运，以及各方式的取舍。

国内直连 huggingface.co 通常不稳定。这一篇给三条可用路线，按推荐顺序排。

## 路线一：镜像站（最省事）

设一个环境变量即可，**所有官方工具都会自动改走镜像**：

```bash
export HF_ENDPOINT=https://hf-mirror.com
```

Windows PowerShell：

```powershell
$env:HF_ENDPOINT = "https://hf-mirror.com"
```

Python 里设（**必须在 import 之前**）：

```python
import os
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

from huggingface_hub import snapshot_download   # 顺序不能反
snapshot_download("Qwen/Qwen3-8B")
```

::: warning

**`os.environ` 一定要写在 `import huggingface_hub` 之前。**

这个库在导入时就读取 endpoint 并固化成模块级常量，之后再改环境变量不生效。“我明明设了镜像，怎么还在连官方”十有八九就是这个顺序问题。

Jupyter 里尤其容易踩——之前的 cell 已经 import 过了。改完要**重启内核**。

:::

### 验证真的走了镜像

```bash
HF_ENDPOINT=https://hf-mirror.com hf download gpt2 config.json -q && echo OK
```

或者看下载日志里的域名。

### 镜像的局限

| 能 | 不能 |
| --- | --- |
| 下载公开模型与数据集 | 可靠地下 gated 模型 |
| 匿名访问 | 用你的 token 访问私有仓库 |
| 大部分仓库 | 保证与官方完全实时同步 |

::: warning

**不要把自己的 HF token 配到第三方镜像上。** token 是你账号的凭据，发给第三方等于把账号交出去。

需要 gated / 私有模型时，用下面的路线二或三。

:::

## 路线二：ModelScope（阿里的模型社区）

国内直连，速度稳定。主流开源模型（Qwen、DeepSeek、GLM、Kimi、Llama 等）基本都有。

```bash
pip install modelscope
```

```python
from modelscope import snapshot_download

path = snapshot_download("Qwen/Qwen3-8B")
print(path)
```

下载下来的目录结构与 HF 一致，**可以直接喂给 transformers**：

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from modelscope import snapshot_download

path = snapshot_download("Qwen/Qwen3-8B")
tok = AutoTokenizer.from_pretrained(path)
model = AutoModelForCausalLM.from_pretrained(path, dtype="auto", device_map="auto")
```

**注意仓库 ID 未必与 HF 完全相同**，去 [modelscope.cn](https://modelscope.cn) 搜一下确认。

| | HF 镜像 | ModelScope |
| --- | --- | --- |
| 覆盖面 | **全（是 HF 的镜像）** | 主流模型，长尾少 |
| 速度 | 一般较好 | **稳定** |
| 数据集 | ✅ | 部分 |
| 与 HF 生态兼容 | 完全一致 | 需换下载 API |

**判据：主流模型走 ModelScope，冷门模型走镜像站。**

## 路线三：有网机器下好再搬

内网、气隙环境，或者前两条都不通时。

**第一步**：在能联网的机器上下到独立目录（不要用缓存，符号链接搬起来麻烦）：

```bash
hf download Qwen/Qwen3-8B \
  --local-dir ./qwen3-8b \
  --exclude "*.bin" "*.h5" "*.msgpack"
```

**第二步**：打包搬运。

```bash
tar -czf qwen3-8b.tar.gz qwen3-8b/
```

**第三步**：目标机器上解压，用**本地路径**加载：

```python
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained("/data/models/qwen3-8b", dtype="auto")
```

并设离线模式，防止任何库偷偷联网：

```bash
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
```

::: info

**搬缓存目录也可以，但要保留符号链接：**

```bash
rsync -a ~/.cache/huggingface/ user@target:/home/user/.cache/huggingface/
```

**`-a` 必须有**（等价于 `-rlptgoD`，其中 `l` 保留符号链接）。用 `cp -r` 或不带 `-a` 的 rsync 会把链接展开成实体文件，体积可能翻好几倍。

搬完在目标机器上 `hf cache scan` 确认结构完整。

:::

## Git clone 的坑

有人习惯直接 clone：

```bash
git clone https://huggingface.co/Qwen/Qwen3-8B
```

**能用，但通常不该用**：

- 会拉**全部历史版本的大文件**，可能是实际需要的好几倍。
- 需要装 `git-lfs`，没装的话拿到的是几百字节的指针文件（然后加载时报奇怪的错）。
- 没有 `allow_patterns` 那样的过滤能力。

要用的话至少跳过 LFS 再选择性拉取：

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone https://hf-mirror.com/Qwen/Qwen3-8B
cd Qwen3-8B
git lfs pull --include="*.safetensors"
```

**但更简单的还是 `hf download`。**

## 常见现象与对策

| 现象 | 对策 |
| --- | --- |
| 卡在 0%，很久没反应 | 没配 `HF_ENDPOINT`；或代理没生效 |
| 设了镜像仍连官方 | `os.environ` 写在 import 之后了 → 调顺序 + 重启内核 |
| 下到一半反复断 | 设 `HF_HUB_DISABLE_XET=1`（或旧版关掉 `hf_transfer`）；调低 `max_workers` |
| 速度极慢但不断 | 换 ModelScope；或换时段 |
| gated 模型在镜像上 401 | 镜像不支持 → 用 ModelScope，或想办法直连官方 |
| 拿到的文件只有几百字节 | git clone 没装 `git-lfs` |

## Docker 里怎么配

```dockerfile
ENV HF_ENDPOINT=https://hf-mirror.com \
    HF_HOME=/models
```

**更推荐的做法是构建时就把模型烤进镜像**，运行时完全不联网：

```dockerfile
RUN --mount=type=secret,id=hf_token \
    HF_TOKEN=$(cat /run/secrets/hf_token) \
    hf download Qwen/Qwen3-8B --local-dir /models/qwen3-8b \
      --exclude "*.bin"
```

```dockerfile
ENV HF_HUB_OFFLINE=1
```

好处是**部署时不依赖网络、启动快、版本确定**。代价是镜像很大——权衡看部署频率。

注意 token 用 BuildKit secret 挂载，**别用 `ARG`**（会留在镜像层历史里）。

## 小结

- 首选**镜像站**：`export HF_ENDPOINT=https://hf-mirror.com`，一行搞定。
- Python 里设 endpoint **必须在 import 之前**，Jupyter 要重启内核。
- **绝不把 token 配给第三方镜像。**
- 主流模型可走 **ModelScope**，目录结构与 HF 一致，能直接喂 transformers。
- 内网靠**搬运**：`--local-dir` 下载 + `rsync -a` 传输 + `HF_HUB_OFFLINE=1`。
- **少用 `git clone`**——会拉全历史，还依赖 git-lfs。
- 生产容器建议**把模型烤进镜像 + 离线模式**。

下一篇：[按显存选模型](/manual/llm/huggingface/choose-by-vram)。
