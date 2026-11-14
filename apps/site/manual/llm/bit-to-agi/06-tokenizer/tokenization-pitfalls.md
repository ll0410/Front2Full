---
title: "Tokenization 的坑"
description: "从 Bit 到 AGI · 第六章：Token · Tokenization 的坑"
source: "https://daiw.org/manual/bit-to-agi/06-tokenizer/tokenization-pitfalls"
---

# Tokenization 的坑

> 从 Bit 到 AGI · 第六章：Token · Tokenization 的坑

Tokenizer 看起来是「预处理小工具」，却是 **静默错误** 的重灾区：训练与推理词表不一致、特殊字符被拆碎、Chat 模板多插 Token、计数与账单对不上——症状往往表现为「模型变笨了」或「费用翻倍」。本篇列出工程上最常踩的坑及规避法。

## 直觉

Tokenizer 像 **摩尔斯电码本**：发送端和接收端必须用同一本码表。换了一个 merge 规则、多插一个 `<|im_start|>`、或在 JSON 里多了一个空格，码流（Token ID 序列）就全变——模型读到的是另一句话，而日志里可能只显示「原文一样」。

## 定义

**Train-Serve Skew**：训练时用 Tokenizer A，推理时用 B；ID 空间或切分边界不一致。

**边界 Token（Boundary Artifact）**：切分导致前缀/后缀与训练分布不同（如前导空格、大小写）。

**Prompt Template Overhead**：Chat 格式插入的特殊 Token，不计入用户可见字符。

**Denormalization 攻击**：利用 Unicode 等价字符、零宽符，使视觉相同字符串 Token 数不同。

## 例子

**例子 1：前导空格改变切分**

```python
import tiktoken
enc = tiktoken.get_encoding("cl100k_base")

a = enc.encode("Hello")
b = enc.encode(" Hello")  # 前导空格
print(a, b)  # 往往不同；GPT regex 把前导空格单独处理
print(len(a), len(b))
```

RAG 拼接文档时若 **有时有空格、有时没有**，同一实体名 Token 边界会变，检索命中率下降。

**例子 2：JSON 格式化偷偷烧钱**

```python
import json, tiktoken
enc = tiktoken.get_encoding("cl100k_base")

obj = {"user_id": 12345, "items": ["a", "b", "c"]}
compact = json.dumps(obj, separators=(",", ":"))
pretty = json.dumps(obj, indent=2)
print(len(enc.encode(compact)), len(enc.encode(pretty)))  # pretty 常多 30–50%
```

生产 API 传 JSON 用 **紧凑格式**；indent 只为人类可读，模型不需要。

**例子 3：Chat 模板隐形 Token**

OpenAI Chat Completions 会在消息外包裹角色标记；Llama 3 用：

```
<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n...<|eot_id|>
```

一段 10 字用户话，总输入可能比 `encode(用户话)` **多 20–40 Token**。用 `apply_chat_template` 计数，不要只 encode 裸字符串。

## 量化：各类坑的损失量级

| 坑 | 典型损失 | 检测方法 |
| --- | --- | --- |
| 词表版本不一致 | 模型输出乱码级 | 对比 merge 文件 hash |
| 中英混排未归一化 | Token +5–15% | NFC 规范化后 encode |
| Pretty JSON | Token +30–50% | compact vs pretty diff |
| 忽略 chat template | 预算偏差 10–25% | tokenizer.apply_chat_template |
| 重复 system prompt | 费用线性 × 请求数 | 缓存 system 前缀 |
| 零宽字符注入 | 计数绕过、安全 | `\u200b` 扫描 |

**Unicode 规范化**：`"café"`（NFC，1 个 é）vs `"café"`（NFD，e + 组合重音）字节不同、Token 可能不同：

```python
import unicodedata, tiktoken
enc = tiktoken.get_encoding("cl100k_base")
s1 = "café"
s2 = "caf\u0065\u0301"  # NFD
print(len(enc.encode(s1)), len(enc.encode(s2)))
s2_nfc = unicodedata.normalize("NFC", s2)
```

入库前对语料做 **NFC** 是 cheap 的保险。

## 常见误区

- **「len(string) 近似 Token 数」**：中文 `len` 是字；Token 可能是字的 1.5 倍。
- **「开源模型下载 weights 就够」**：缺 `tokenizer.model` / `tokenizer.json` 与 weights **同等致命**。
- **「微调可以换 Tokenizer」**：除非 **从头训练 Embedding** 并大规模继续预训练，否则不能换。
- **「emoji 是一个字符一个 Token」**：复杂 emoji（肤色、ZWJ 序列）常 **3–10+ Token**。

## 动手试一试：上线前 Token 审计脚本

```python
import tiktoken
import unicodedata
import json

enc = tiktoken.get_encoding("cl100k_base")

def audit(text: str) -> dict:
    nfc = unicodedata.normalize("NFC", text)
    ids = enc.encode(nfc)
    return {
        "chars": len(nfc),
        "bytes": len(nfc.encode("utf-8")),
        "tokens": len(ids),
        "zero_width": any(c in nfc for c in "\u200b\u200c\u200d\ufeff"),
        "leading_space": nfc != nfc.lstrip(),
    }

def audit_messages(messages: list[dict], tokenizer) -> int:
    """HuggingFace tokenizer with chat_template"""
    rendered = tokenizer.apply_chat_template(
        messages, tokenize=True, add_generation_prompt=True
    )
    return len(rendered)

# 示例
report = audit("  你好，世界！\u200b")
print(report)
```

把 `tokens` 写入日志，与 API 返回的 `usage.prompt_tokens` 对账；偏差 >1% 就应排查 template 与 encoding 版本。

::: warning

**安全**：用户输入中的 Token 膨胀（超长重复子串、巨型 Unicode 标量）可导致 DoS 级 context 占用。应对：max_tokens 上限、输入字节上限、重复 n-gram 过滤——在 Tokenizer **之前** 做 cheap 检查。

:::

## 工程检查清单

1. 训练、推理、评估 **同一 `model_file` / encoding 名**。
2. 语料 **UTF-8 NFC**；去掉 BOM、异常零宽符。
3. 计费与预算用 **`encode` + chat template**，不用字符估算。
4. API 传结构化数据用 **紧凑 JSON**；URL 不要多余 encode 层。
5. 版本发布：**tokenizer hash** 写入 model card 与 CI 断言。
6. RAG 分块时按 **Token 数** 切（如 512 Token/chunk），不是按汉字数。

## 真实事故简表

| 现象 | 可能 Tokenizer 原因 | 排查 |
| --- | --- | --- |
| 微调后生成重复 `<unk>` | 词表未含领域术语，训练时出现大量 UNK | 检查语料 encode 是否 OOV |
| 同一 prompt AB 测试结果方差大 | 温度以外：A/B 用了不同 `tokenizer.json` revision | 锁文件 hash |
| 中文用户费用预估系统性偏低 | 用英文样本估 Token/字 | 单独中文 encode 集 |
| 复制网页进 prompt 后模型「变傻」 | HTML 实体、`\u00a0` 不间断空格改变切分 | 清洗 + NFC |
| 代码补全丢失缩进语义 | Tab vs 空格导致不同 Token 序列 | 统一 `.editorconfig` |

**Streaming 拼接**：流式输出逐 Token `decode` 时，**不完整 UTF-8 尾字节** 应缓冲到下一 Token 再解码，否则前端偶发乱码——这是 **解码器实现坑**，不是模型逻辑错。

**多模态占位**：GPT-4V、Llama 3.2 Vision 等在文本 Token 流中插入 **图像 patch Token**（数量与分辨率相关）；纯文本 `encode` 无法预估这类请求的总 $N$，上线 vision 功能需 **单独 benchmark**。

**日志与监控**：生产环境应记录 `prompt_tokens`、`completion_tokens` 与 **Tokenizer 版本号**；当模型提供商 silent 升级 encoding 时，同样字符串 Token 数漂移 **1–3%** 即应告警——否则 FinOps 预算与容量规划会系统性偏差。

**Few-shot 示例顺序**：同一组示例换顺序，Token 数不变但 **attention 模式** 变；更隐蔽的是示例间 **多空一行** 导致 regex 预分词边界变化。复制 prompt 模板时，应 **固定空白字符**（空格 vs `\n`），写入单元测试 golden token count。

**Tokenizer 与 max_model_len**：Serving 框架的 `max_model_len` 以 Token 计；若客户端按字符截断到「安全长度」，中文仍可能 **OOM**——应在网关层用 **同一 encoding** 硬截断到 $L_{\max} - \text{预留}$，而不是按字符数一刀切。CI 里对 golden prompt 断言 `len(encode(prompt)) <= budget`，比集成测试端到端生成 **更稳、更快**。对外 API 宜在响应头或 body 中返回 **`x-tokenizer-hash`**，方便客户侧对账。内部 on-call 手册应记录 **各环境 encoding 版本**，升级时先做 shadow encode diff，再切流量。

## 小结

Tokenizer 坑的本质是 **离散化不可见**——字符串相同、字节相近，Token 序列可能完全不同。上线前做 encode 审计、template 计数、词表版本锁定；中文与 JSON 场景优先查 **Token 膨胀**。

下一篇：[第六章总结](/manual/llm/bit-to-agi/06-tokenizer/chapter-summary)
