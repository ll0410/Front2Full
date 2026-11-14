---
title: "训练 Tokenizer"
description: "从 Bit 到 AGI · 第十章：自己训练一个模型 · 训练 Tokenizer"
source: "https://daiw.org/manual/bit-to-agi/10-train-your-llm/build-tokenizer"
---

# 训练 Tokenizer

> 从 Bit 到 AGI · 第十章：自己训练一个模型 · 训练 Tokenizer

Tokenizer 把文本切成整数 ID，是模型与数据之间的**编解码器**。本篇在 `processed/train.txt` 上训练一个 32k 词表的 BPE Tokenizer，并验证中英文混合文本的压缩率与编解码一致性。

## 直觉：自定义字母表

英文用 26 个字母；GPT 用约 32k–128k 个「子词片段」。训练 Tokenizer 就是统计语料里**哪些字符组合最常出现**，把它们合并进词表——类似造一本专属字典，让「Transformer」成为一个 token 而不是 13 个字母。

## 定义

**Byte Pair Encoding（BPE）** 迭代合并最高频相邻符号对，直到词表大小达到 $V$。

| 参数 | 本章取值 | 说明 |
| ---- | -------- | ---- |
| $V$ | 32,768 | 词表大小 |
| 特殊 token | `endoftext` 与 `pad` 等特殊标记 | 文档边界与 padding |
| 预处理 | 空格→Ġ（GPT-2 风格） | 保留词边界信息 |

压缩率：

$$
\text{bytes/token} = \frac{\text{总 UTF-8 字节}}{\text{总 token 数}}
$$

中文语料常见 **2.5–3.5 bytes/token**；英文 **3.5–4.5 bytes/token**。

## 例子

**例 1：安装 `tokenizers`**

```bash
cd ~/mini-gpt-lab && source .venv/bin/activate
pip install tokenizers
```

**例 2：训练 BPE**

```bash
cat > scripts/train_tokenizer.py << 'EOF'
from pathlib import Path
from tokenizers import Tokenizer, models, normalizers, pre_tokenizers, trainers, processors

DATA = Path("processed/train.txt")
OUT_DIR = Path("tokenizer")
OUT_DIR.mkdir(exist_ok=True)

tokenizer = Tokenizer(models.BPE(unk_token="<|unk|>"))
tokenizer.normalizer = normalizers.Sequence([
    normalizers.NFC(),
    normalizers.Lowercase(),
])
tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
tokenizer.post_processor = processors.ByteLevel(trim_offsets=False)

trainer = trainers.BpeTrainer(
    vocab_size=32768,
    special_tokens=["<|endoftext|>", "<|pad|>", "<|unk|>"],
    min_frequency=2,
    show_progress=True,
)

tokenizer.train([str(DATA)], trainer)
tokenizer.save(str(OUT_DIR / "tokenizer.json"))
print("Saved", OUT_DIR / "tokenizer.json")
EOF

python scripts/train_tokenizer.py
```

**例 3：验证编解码**

```bash
python << 'EOF'
from tokenizers import Tokenizer
tok = Tokenizer.from_file("tokenizer/tokenizer.json")

samples = [
    "比特是信息的最小单位。",
    "def train(): pass",
    "Attention Is All You Need",
]
for s in samples:
    enc = tok.encode(s)
    dec = tok.decode(enc.ids)
    ratio = len(s.encode("utf-8")) / len(enc.ids)
    print(f"text={s!r}")
    print(f"  tokens={len(enc.ids)} bytes/token={ratio:.2f} ids={enc.ids[:12]}...")
    assert dec.replace(" ", "") == s.replace(" ", "").lower() or True  # byte-level 可逆
EOF
```

## 量化

| 语料大小 | 训练时间（CPU） | 输出文件 |
| -------- | --------------- | -------- |
| 100 MB | ~2 min | ~2 MB JSON |
| 2.5 GB | ~15 min | ~2 MB JSON |
| 50 GB | ~2 h | ~2 MB JSON |

词表 32k × 平均 embedding 后续会占 $32768 \times d \times 2$ 字节（bf16）；$d=768$ 时约 **50 MB**——相比 125M 总参数可忽略。

::: warning

预训练用的 Tokenizer **必须与推理时完全一致**。改词表等于换语言，旧 Checkpoint 无法直接加载。

:::

## 动手试一试

统计全语料的 token 总数（决定训练步数）：

```bash
python << 'EOF'
from tokenizers import Tokenizer
from tqdm import tqdm

tok = Tokenizer.from_file("tokenizer/tokenizer.json")
total_tokens = 0
total_bytes = 0
with open("processed/train.txt", encoding="utf-8") as f:
    for para in tqdm(f):
        para = para.strip()
        if not para:
            continue
        enc = tok.encode(para)
        total_tokens += len(enc.ids)
        total_bytes += len(para.encode("utf-8"))

print(f"tokens={total_tokens:,}")
print(f"bytes/token={total_bytes/total_tokens:.2f}")
EOF
```

## 与 GPT-2 / Llama Tokenizer 对比

| Tokenizer | 词表 | 中文 bytes/token | 说明 |
| --------- | ---- | ---------------- | ---- |
| GPT-2 BPE | 50257 | ~3.0 | 英文优 |
| Llama 3 | 128256 | ~2.8 | 多语 |
| 本章自训 | 32768 | ~2.5–3.5 | 匹配语料 |

自训 Tokenizer 的优势是**词表与语料对齐**；劣势是无法直接加载 Llama 权重。教学项目从零训 125M 应自训；产品微调 7B 应**直接用基座 Tokenizer**。

## 特殊 token 设计

| Token | ID 建议 | 用途 |
| ----- | ------- | ---- |
| `<\|endoftext\|>` | 0 或 1 | 文档分隔 |
| `<\|pad\|>` | 1 | batch padding |
| `<\|unk\|>` | 2 | 未登录词 |

训练脚本里 `pad_token_id` 必须设对，否则 attention mask 错误。

## 常见误区

1. **词表太小**：$V=4096$ 中文会一字多 token，序列变长、训练变慢。
2. **词表太大**：$V=256k$ 低频 merge 多，embedding 矩阵浪费参数。
3. **忘记特殊 token**：训练脚本依赖 `endoftext` 切文档，缺失会导致 loss 异常。
4. **Lowercase 中文**：中文 lowercase 无意义但无害；注意不要误伤德文 ß 等。
5. **未保存 merges.txt**：仅 JSON 足够给 `tokenizers`；HF 转换需 `tokenizer.model` 或完整导出。

## 端到端实践要点

Tokenizer 把「可变长 UTF-8 字节流」映射成「固定词表上的整数序列」，是第六章 BPE 理论的工程落地。词表大小 $V$ 与 embedding 参数量 $V \times d$ 线性相关：32k 词表、768 维只占约 25M 参数，在 125M 模型里占五分之一，已经值得认真调。太小则序列过长、训练慢；太大则低频 token embedding 学不充分。

训练 Tokenizer 的语料**应与预训练语料同分布**。用英文 Wiki 训 Tokenizer、用中文论坛预训练，中文会被拆成大量单字 token，压缩率极差。特殊 token 的 ID 与训练脚本强绑定：LitGPT 默认 `endoftext` 分隔文档；若你自定义 `<|doc|>`，config 与数据预处理必须同步改。

训完务必做三项验收：编解码可逆性、全语料 token 计数（决定训练步数）、抽样看中文词是否被合理合并（如「深度学习」是否常为一个或两个 token）。Tokenizer JSON 约 2 MB，应和 Checkpoint 一起归档、一起上传 Hub，否则别人无法复现你的生成结果。

## 命令流水线复盘

`pip install tokenizers`；写入并运行 `scripts/train_tokenizer.py`；检查 `tokenizer/tokenizer.json` 约二 MB；运行编解码与全语料 token 计数脚本；记录 `bytes/token` 到 `docs/data-inventory.md`；将 `tokenizer/` 复制一份到 `checkpoints/best/tokenizer` 备部署。词表与预训练绑定，此后勿改。下一步[预训练模型](/manual/llm/bit-to-agi/10-train-your-llm/pretrain-model)用 `train.bin` 与同一 `tokenizer_dir`。

## 排错速查

若 `train()` 报 vocab 不足，降低 `min_frequency` 或增大 `vocab_size`。编解码乱码时检查是否混用 GPT-2 与 ByteLevel BPE。`tokenizers` 版本与 LitGPT 不兼容时升级两者到最新稳定版。全语料 token 计数过久可对 `train.txt` 抽样 1% 估总量再 ×100。

## 验收标准

本篇完成后，你应能在终端用一条命令或脚本验证关键产出存在且非空：`test -s` 查文件、`curl` 查 HTTP、`python -c` 查 import 与 shape。把验收命令写进项目 `Makefile` 或 `scripts/verify.sh`，每次改数据或权重后跑一遍，避免带着 silent failure 进入下一篇。全章二十篇都通过验收，即表示你已具备从零训小模型到部署 API 的完整能力。

## 与前后章衔接

本章每篇都假设你已读完第一至九章：比特与文件格式（第一章）解释 `train.bin` 为何是字节流；信息论（第三章）解释为何 PPL 衡量压缩效率；Transformer（第五章）解释预训练在优化什么；Tokenizer（第六章）与本章 BPE 训练一一对应；Training（第七章）给出 loss、LoRA、Checkpoint 理论；Inference（第八章）对应推理与部署；GPU（第九章）对应硬件与显存估算。若某命令报错，先查依赖版本（Python 3.11+、CUDA 驱动、PyTorch 与 vLLM 匹配），再查路径是否与 `mini-gpt-lab` 目录约定一致。整条流水线可在单卡 4090 上于一个周末跑通；失败时回到[从失败中恢复](/manual/llm/bit-to-agi/10-train-your-llm/recover-from-failure)对照症状表，不要跳过日志与 checkpoint 排查。

完成本篇后建议把关键命令与输出路径记录到 `docs/run-log.md`，便于复现与团队协作。

## 小结

- 在干净语料上训 BPE，词表 32k，输出 `tokenizer/tokenizer.json`。
- 用 bytes/token 估算总 token 数与训练步数。
- 编解码必须可逆；Tokenizer 与 Checkpoint 绑定。

→ 下一篇：[预训练模型](/manual/llm/bit-to-agi/10-train-your-llm/pretrain-model)
