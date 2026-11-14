---
title: "推回 Hub"
description: "上传模型与适配器、写 model card、私有与许可设置，以及大文件上传的注意事项。"
source: "https://daiw.org/manual/huggingface/push-to-hub"
---

# 推回 Hub

> 上传模型与适配器、写 model card、私有与许可设置，以及大文件上传的注意事项。

训完的模型放在本地硬盘上意义有限。传到 Hub 之后：有版本管理、能被别人（和未来的你）直接 `from_pretrained` 拉走、还能挂个 [Space](/manual/llm/huggingface/compute-options) 做演示。

## 最简单的方式

```python
model.push_to_hub("your-name/my-model", private=True)
tok.push_to_hub("your-name/my-model", private=True)
```

**tokenizer 一定要一起传。** 只传模型的话，别人下下来没法用——这是新手最常犯的疏漏。

LoRA 适配器同理：

```python
# PeftModel 的 push_to_hub 只传适配器，几十 MB
model.push_to_hub("your-name/my-lora")
```

## 命令行方式

```bash
hf upload your-name/my-model ./out/final
```

```bash
# 只传某些文件
hf upload your-name/my-model ./out/final --include "*.safetensors" "*.json"

# 传数据集
hf upload --repo-type dataset your-name/my-data ./data
```

::: warning

**先传 `private=True`，确认无误再公开。**

```python
from huggingface_hub import HfApi
HfApi().update_repo_visibility("your-name/my-model", private=False)
```

公开仓库的 Git 历史**删不干净**——传上去的密钥、内部数据、测试用的真实客户信息，即使后来删文件也还在历史里。真出了事只能删整个仓库。

:::

## 需要 Write 权限

普通的 Read token 传不了：

```text
403 Forbidden: You don't have the rights to create a model under this namespace
```

去 [settings/tokens](https://huggingface.co/settings/tokens) 建一个 **fine-grained token**，只勾选目标仓库的写权限（理由见[登录那一章](/manual/llm/huggingface/cli-and-auth)）。

## 写 model card

仓库根目录的 `README.md`。**YAML 头很重要**——它决定别人能不能搜到你的模型。

````markdown
---
license: apache-2.0
base_model: Qwen/Qwen3-8B
tags:
  - lora
  - customer-service
  - chinese
language:
  - zh
library_name: peft
pipeline_tag: text-generation
---

# 客服助手 LoRA

在 Qwen3-8B 上用 3200 条客服问答微调的 LoRA 适配器，专注退换货与物流咨询。

## 用法

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

base = AutoModelForCausalLM.from_pretrained("Qwen/Qwen3-8B", dtype="auto", device_map="auto")
model = PeftModel.from_pretrained(base, "your-name/my-lora")
tok = AutoTokenizer.from_pretrained("Qwen/Qwen3-8B")
```

## 训练配置

| 项 | 值 |
| --- | --- |
| 方法 | QLoRA（4bit NF4） |
| r / alpha | 16 / 32 |
| 学习率 | 2e-4，cosine |
| epoch | 2 |
| 数据量 | 3200 条 |
| 硬件 | RTX 4090，约 1.5 小时 |

## 效果

在 200 条留出测试集上，格式正确率从基座的 71% 提升到 96%。

## 已知局限

- 只覆盖退换货与物流，支付、账号问题会答得很泛。
- 通用能力有轻微下降（数学题表现不如基座）。
- 未做安全对齐评估，不建议直接面向终端用户。
````

::: info

**`base_model` 这个字段务必写对。** 它让 Hub 自动在基座模型页面上建立反向链接，也让别人一眼知道该配哪个基座。

对 LoRA 适配器来说这尤其关键——**没有它，别人拿到适配器不知道配什么用**。

:::

**“已知局限”是最有价值也最常被省略的一节。** 半年后你自己回来看，最需要知道的就是“这东西不适合干什么”。

## 大文件上传

```python
from huggingface_hub import upload_folder

upload_folder(
    repo_id="your-name/my-model",
    folder_path="./merged",
    commit_message="Upload merged 8B model",
    ignore_patterns=["*.pt", "checkpoint-*", "runs/*"],
)
```

`ignore_patterns` 很重要——`./out` 目录里常有几十 GB 的中间 checkpoint 和 tensorboard 日志，**没必要传**。

### 断点续传与增量去重

`huggingface_hub` 默认使用 **Xet 分块存储后端（`hf_xet`）**：上传大文件断了直接重跑同一条命令，已完成的分块会自动跳过；如果只改了模型的一部分权重，Xet 还会自动做块级去重，只上传变化的数据块。

### 传得慢

在高带宽机器上可开启 Xet 高性能模式：

```bash
export HF_XET_HIGH_PERFORMANCE=1
```

同[下载](/manual/llm/huggingface/downloading)时一样有效。

::: warning

**别 `git add` 大文件后再 push。** 直接把几个 GB 的 safetensors `git add` 进本地仓库会：

- 在本地 `.git` 里再存一份（硬盘翻倍）
- push 极慢，且绕过了 `hf_xet` 的并发分块通道
- 可能触发大小限制被拒

**一律用 `huggingface_hub` 的 API 或 `hf upload`**，它们走的是专门的 Xet 上传通道。

:::

## 版本与分支

```python
model.push_to_hub("your-name/my-model", revision="v2-experiment")
```

推到一个新分支，不影响 `main`。**做对比实验时很有用**——几个版本并存，谁好用谁上 main。

打 tag：

```python
from huggingface_hub import HfApi
HfApi().create_tag("your-name/my-model", tag="v1.0")
```

**发布给别人用的模型建议打 tag**，让使用者能钉住版本（[前面](/manual/llm/huggingface/what-is-huggingface)说过 `main` 是会动的）。

## 上传前检查

```text
□ tokenizer 一起传了
□ README.md 的 YAML 头有 license 与 base_model
□ 没有 checkpoint-* / runs/ 等中间产物
□ 没有 .env、密钥、真实用户数据
□ 训练数据里的敏感信息没混进 model card 的示例
□ 先 private，确认后再公开
```

倒数第二条容易被忽略：**model card 里的示例输出经常是直接从训练日志复制的**，可能带着真实的客户问题或内部信息。

## 验证一下

传完从零加载一遍，确认别人能用：

```python
# 换个干净目录或清掉缓存
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

base = AutoModelForCausalLM.from_pretrained("Qwen/Qwen3-8B", dtype="auto", device_map="auto")
m = PeftModel.from_pretrained(base, "your-name/my-lora")
t = AutoTokenizer.from_pretrained("your-name/my-lora")   # ← tokenizer 传对了吗
print("加载成功")
```

**这一步能抓住 90% 的“传漏了文件”问题。**

## 小结

- **tokenizer 必须一起传**，这是常见的疏漏。
- **先 `private=True`**——公开仓库的 Git 历史删不干净。
- 上传需要 **Write 或 fine-grained token**。
- model card 的 YAML 头写 **`license` 与 `base_model`**，后者对 LoRA 尤其关键。
- **“已知局限”是极有价值的一节。**
- 传大文件用 **`hf upload` / `upload_folder`，别走 `git add`**；记得 `ignore_patterns` 排掉 checkpoint。
- 发布给别人用的**打 tag**。
- **传完从零加载验证一遍。**

下一篇：[算力选项](/manual/llm/huggingface/compute-options)。
