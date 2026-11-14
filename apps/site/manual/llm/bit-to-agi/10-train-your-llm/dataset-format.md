---
title: "数据集格式"
description: "从 Bit 到 AGI · 第十章：自己训练一个模型 · 数据集格式"
source: "https://daiw.org/manual/bit-to-agi/10-train-your-llm/dataset-format"
---

# 数据集格式

> 从 Bit 到 AGI · 第十章：自己训练一个模型 · 数据集格式

不同训练阶段吃不同「容器格式」：预训练要 token bin，SFT 要 JSONL 对话，RLHF 要 preference pair。本篇统一说明各格式的字段 schema、文件大小与转换命令。

## 直觉：生鲜 vs 罐头

 raw 文本是生鲜；`train.bin` 是**预切好、贴好标签的罐头**，训练脚本直接加热（forward）即可。格式错了，就像把整颗西瓜塞进微波炉——机器读不懂。

## 定义

本章涉及的格式：

| 阶段 | 格式 | 扩展名 |
| ---- | ---- | ------ |
| 预训练 | uint16 token 序列 | `.bin` |
| SFT | instruction JSON / JSONL | `.json`, `.jsonl` |
| DPO | chosen/rejected pair | `.jsonl` |
| 评估 | HuggingFace Dataset | Arrow / parquet |

**JSONL** = 每行一个 JSON 对象，便于流式读取 TB 级数据。

## 例子

**例 1：预训练 `.bin` 格式**

```python
# uint16 little-endian，vocab < 65536
# [tok1, tok2, ..., EOT, tok1, ...]
import numpy as np
arr = np.fromfile("data/litgpt/train.bin", dtype=np.uint16)
print(arr.shape, arr[:20])
```

**例 2：SFT JSONL schema**

```bash
cat > data/sft/schema_example.jsonl << 'EOF'
{"messages":[{"role":"user","content":"什么是梯度？"},{"role":"assistant","content":"梯度是损失对参数的偏导数，指向上升最快方向；训练时沿负梯度更新。"}]}
{"messages":[{"role":"system","content":"你是编程助手。"},{"role":"user","content":"写 hello world"},{"role":"assistant","content":"print('hello world')"}]}
EOF
```

字段规范：

| 字段 | 类型 | 必需 |
| ---- | ---- | ---- |
| `messages` | array | 是 |
| `messages[].role` | system/user/assistant | 是 |
| `messages[].content` | string | 是 |

**例 3：Alpaca 三字段转 messages**

```bash
python << 'EOF'
import json

def alpaca_to_messages(row):
    user = row["instruction"]
    if row.get("input"):
        user += "\n" + row["input"]
    return {"messages": [
        {"role": "user", "content": user},
        {"role": "assistant", "content": row["output"]},
    ]}

with open("data/sft/alpaca_5k.json", encoding="utf-8") as f:
    data = json.load(f)

with open("data/sft/alpaca_5k.jsonl", "w", encoding="utf-8") as f:
    for row in data:
        f.write(json.dumps(alpaca_to_messages(row), ensure_ascii=False) + "\n")
print("converted", len(data), "rows")
EOF
```

**例 4：DPO preference 格式**

```jsonl
{"prompt": "解释比特", "chosen": "比特是信息最小单位，取 0 或 1。", "rejected": "比特是一种水果。"}
```

**例 5：ShareGPT 多轮转标准 messages**

```bash
python << 'EOF'
import json

def sharegpt_to_messages(conversations):
    role_map = {"human": "user", "gpt": "assistant"}
    msgs = []
    for turn in conversations:
        msgs.append({
            "role": role_map.get(turn["from"], "user"),
            "content": turn["value"],
        })
    return {"messages": msgs}

# row = json.loads(line); sharegpt_to_messages(row["conversations"])
EOF
```

## 量化

| 格式 | 5k 条 SFT | 1B tokens 预训练 |
| ---- | --------- | ---------------- |
| JSON | ~8 MB | 不适用 |
| JSONL | ~7 MB（压缩友好） | 不适用 |
| `.bin` uint16 | — | ~2 GB |

JSONL 比 JSON 数组省内存：训练脚本 `for line in f` 逐行读，不必一次 `json.load` 全文件。

::: info

HuggingFace `datasets` 可 `load_dataset("json", data_files="*.jsonl")` 自动推断 schema；上传 Hub 时优先 **parquet**（列存、压缩更好）。

:::

## 动手试一试

校验 JSONL 每行可解析：

```bash
python << 'EOF'
import json, sys
path = "data/sft/alpaca_5k.jsonl"
for i, line in enumerate(open(path, encoding="utf-8"), 1):
    try:
        obj = json.loads(line)
        assert "messages" in obj
        for m in obj["messages"]:
            assert m["role"] in ("system", "user", "assistant")
            assert isinstance(m["content"], str)
    except Exception as e:
        print(f"line {i} BAD:", e)
        sys.exit(1)
print("all lines OK")
EOF
```

## 存储与 I/O 格式细节

**预训练 bin 文件布局**（LitGPT / NanoGPT 惯例）：

```
data/litgpt/
├── train.bin    # uint16 连续 token
└── val.bin      # 可选验证集
```

若语料 > RAM，用 **memory map** 读取：

```python
import numpy as np
mm = np.memmap("data/litgpt/train.bin", dtype=np.uint16, mode="r")
print(len(mm), "tokens")  # 不一次性载入内存
```

**SFT JSONL** 每行独立 JSON，方便 `datasets` 流式：

```bash
wc -l data/sft/*.jsonl
gzip -k data/sft/alpaca_5k.jsonl   # 压缩后约 30% 体积，Hub 上传更快
```

## RLHF / DPO 格式预览

偏好对齐数据（第七章 DPO）：

```jsonl
{"prompt": "用户问题", "chosen": "优质回答", "rejected": "劣质回答"}
```

`chosen` 与 `rejected` 必须**同一 prompt** 下的两个 completion；长度差过大时 DPO loss 不稳定，建议截断到相同 max_length。

## 常见误区

1. **UTF-8 BOM**：Windows 编辑器写 `\ufeff` 导致首行 parse 失败；用 `utf-8-sig` 读。
2. **assistant 为空字符串**：训练 loss NaN；过滤空 output。
3. **预训练用 JSON 存全文**：应 tokenize 成 bin，否则每 epoch 重复 tokenize。
4. **JSONL 末行缺换行**：最后一行可能被某些 parser 忽略。
5. **messages 顺序错乱**：必须先 system（可选）→ user → assistant 交替。

## 端到端实践要点

格式是数据与训练脚本之间的**契约**。预训练 `.bin`  uint16 连续流，SFT JSONL 每行独立对话；混用会导致 silent bug（例如 JSON 全文 load 进内存 OOM）。`messages` schema 已成为 HuggingFace 生态事实标准，trl、Axolotl、LLaMA-Factory 均支持。

Alpaca 三字段与 ShareGPT 多轮都要转成 `messages`；转换脚本进 Git，输入输出路径命令行参数化。DPO 要 prompt/chosen/rejected 三元组且长度相近。JSONL 末行要有换行；UTF-8 BOM 用 `utf-8-sig` 读。校验脚本 `for line in f: json.loads(line)` 应在训练前必跑。

大语料用 memmap 读 bin，不占 RAM。上传 Hub 优先 parquet 列存。格式文档写进 README：每个字段含义、样例行、禁止空 assistant。格式错了比模型错了更难 debug——loss NaN 时先查数据 schema，再查 lr。

## 命令流水线复盘

预训练：bin 转换脚本 → `np.fromfile(..., dtype=np.uint16)` 验证；SFT：`alpaca_to_messages` → `alpaca_5k.jsonl` → 校验脚本 `all lines OK`；DPO 行检查 chosen/rejected 非空。格式定稿后再跑训练；改格式需重训或至少重跑 Tokenizer 与 bin。下一篇[硬件规划](/manual/llm/bit-to-agi/10-train-your-llm/hardware-planning)据 token 总量估 GPU 小时。

## 排错速查

JSONL parse 失败：查 BOM 与末行换行。SFT loss 不降：assistant 为空或 template 不匹配。bin 文件过大：应用 uint16 而非 int32。DPO chosen/rejected 相同：过滤无效行。memmap 报错：路径含中文时用绝对路径。

## 验收标准

本篇完成后，你应能在终端用一条命令或脚本验证关键产出存在且非空：`test -s` 查文件、`curl` 查 HTTP、`python -c` 查 import 与 shape。把验收命令写进项目 `Makefile` 或 `scripts/verify.sh`，每次改数据或权重后跑一遍，避免带着 silent failure 进入下一篇。全章二十篇都通过验收，即表示你已具备从零训小模型到部署 API 的完整能力。

## 与前后章衔接

本章每篇都假设你已读完第一至九章：比特与文件格式（第一章）解释 `train.bin` 为何是字节流；信息论（第三章）解释为何 PPL 衡量压缩效率；Transformer（第五章）解释预训练在优化什么；Tokenizer（第六章）与本章 BPE 训练一一对应；Training（第七章）给出 loss、LoRA、Checkpoint 理论；Inference（第八章）对应推理与部署；GPU（第九章）对应硬件与显存估算。若某命令报错，先查依赖版本（Python 3.11+、CUDA 驱动、PyTorch 与 vLLM 匹配），再查路径是否与 `mini-gpt-lab` 目录约定一致。整条流水线可在单卡 4090 上于一个周末跑通；失败时回到[从失败中恢复](/manual/llm/bit-to-agi/10-train-your-llm/recover-from-failure)对照症状表，不要跳过日志与 checkpoint 排查。

完成本篇后建议把关键命令与输出路径记录到 `docs/run-log.md`，便于复现与团队协作。

## 练习扩展

若时间充裕，尝试修改一个超参或配置项，观察下游指标变化并记录到 `docs/run-log.md`：例如清洗 threshold、词表大小、学习率、save 间隔或 vLLM 的 `max-model-len`。单次只改一处，才能归因。对比实验最好开 W&B 同名 project 下不同 run，用 Notes 字段标注「baseline / variant B」。这些习惯与工业界 ML 实验管理一致，比单纯跑通命令更有长期价值。

建议每篇末尾自检：关键产出文件存在、体积合理、随机抽检内容可读，再点下一篇链接。

## 小结

- 预训练：`uint16` `.bin` token 流。
- SFT：`messages` JSONL；Alpaca/ShareGPT 需转换。
- DPO：`prompt/chosen/rejected`；用脚本校验再训。

→ 下一篇：[硬件规划](/manual/llm/bit-to-agi/10-train-your-llm/hardware-planning)
