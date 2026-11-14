---
title: "跑推理"
description: "从 Bit 到 AGI · 第十章：自己训练一个模型 · 跑推理"
source: "https://daiw.org/manual/bit-to-agi/10-train-your-llm/run-inference"
---

# 跑推理

> 从 Bit 到 AGI · 第十章：自己训练一个模型 · 跑推理

Checkpoint 训练完，你要在本地**把 token 流式吐出来**。本篇对比 LitGPT CLI、Transformers 和 llama.cpp 三种推理路径，并测量首 token 延迟（TTFT）与吞吐（tokens/s）。

## 直觉：Autocomplete 超级版

推理 = 训练的反过程：不再更新权重，只反复 **forward + sample 下一个 token**。125M 模型在 GPU 上 forward 一次约 **1–2 ms**；生成 100 token 约 100 次 forward，加 sampling 开销，总计 **0.1–0.3 s**。

## 定义

| 指标 | 含义 | 125M 单卡目标 |
| ---- | ---- | ------------- |
| TTFT | 首 token 时间 | < 200 ms |
| TPOT | 每 token 时间 | 5–15 ms |
| 吞吐 | tokens/s | 50–200 |

自回归生成：

$$
x_{t+1} \sim \text{Sample}\big(\text{softmax}(f_\theta(x_{\le t}) / \tau)\big)
$$

## 例子

**例 1：LitGPT 交互生成**

```bash
cd ~/mini-gpt-lab && source .venv/bin/activate

litgpt generate checkpoints/best \
  --tokenizer_dir tokenizer \
  --prompt "深度学习是" \
  --max_new_tokens 256 \
  --temperature 0.7 \
  --top_p 0.9 \
  --repetition_penalty 1.1
```

**例 2：Transformers pipeline**

```bash
pip install transformers accelerate

python << 'EOF'
import time, torch
from transformers import AutoModelForCausalLM, AutoTokenizer

model_dir = "checkpoints/best-hf"
tok = AutoTokenizer.from_pretrained(model_dir)
model = AutoModelForCausalLM.from_pretrained(
    model_dir, dtype=torch.bfloat16, device_map="auto"
)
prompt = "比特与信息论的关系是"
inputs = tok(prompt, return_tensors="pt").to(model.device)

t0 = time.perf_counter()
with torch.no_grad():
    out = model.generate(
        **inputs,
        max_new_tokens=128,
        do_sample=True,
        temperature=0.7,
        top_p=0.9,
    )
dt = time.perf_counter() - t0
text = tok.decode(out[0], skip_special_tokens=True)
new_tokens = out.shape[1] - inputs["input_ids"].shape[1]
print(text)
print(f"tokens/s={new_tokens/dt:.1f}")
EOF
```

**例 3：llama.cpp（CPU / 边缘部署预演）**

```bash
# 先转 GGUF（需 llama.cpp 转换脚本）
pip install llama-cpp-python

python << 'EOF'
from llama_cpp import Llama
# llm = Llama(model_path="checkpoints/best.gguf", n_ctx=2048)
# print(llm("Hello", max_tokens=64))
print("Convert HF → GGUF with llama.cpp convert_hf_to_gguf.py")
EOF
```

## 量化

125M bf16 权重 **250 MB**，RTX 4090 24 GB 显存绰绰有余；batch=1 推理显存 **低于 1 GB**。

| 后端 | 设备 | ~tokens/s |
| ---- | ---- | --------- |
| LitGPT | GPU bf16 | 120–180 |
| Transformers | GPU bf16 | 80–150 |
| llama.cpp Q4 | CPU 8 核 | 15–30 |
| llama.cpp Q4 | GPU | 200+ |

::: info

预训练 Base 模型不会「聊天」——没有 SFT 的指令跟随。用 continuation 风格 prompt（半句话开头）评估，不要期待「你好」→ 礼貌回复。

:::

## 动手试一试

批量 benchmark：

```bash
cat > scripts/bench_inference.py << 'EOF'
import time, subprocess, statistics

prompts = ["比特是", "The capital of", "def forward(self"]
times = []
for p in prompts:
    t0 = time.perf_counter()
    subprocess.run([
        "litgpt", "generate", "checkpoints/best",
        "--tokenizer_dir", "tokenizer",
        "--prompt", p,
        "--max_new_tokens", "64",
        "--temperature", "0.7",
    ], capture_output=True, check=True)
    times.append(time.perf_counter() - t0)
print(f"runs={len(times)} mean={statistics.mean(times):.2f}s")
EOF
python scripts/bench_inference.py
```

## 深入：KV Cache 与显存

自回归生成第 $t$ 个 token 时，Transformer 需要所有过去 token 的 Key/Value。 naive 实现每步重算 $1..t$，复杂度 $O(T^2)$。**KV Cache** 把每层的 K/V 存下来，新 token 只算一次 attention，复杂度降为 $O(T)$。

125M 模型、12 层、12 头、$d_{\text{head}}=64$、序列长 2048 时，KV cache 大小约：

$$
2 \times L \times T \times H \times d_{\text{head}} \times \text{bytes} = 2 \times 12 \times 2048 \times 12 \times 64 \times 2 \approx 75\ \text{MB}
$$

batch=1 时可忽略；batch=32 约 2.4 GB——Serving 时要设 `max_num_seqs` 限制并发。

## 采样策略对比

| 策略 | 参数 | 效果 |
| ---- | ---- | ---- |
| Greedy | `do_sample=False` | 确定性、易重复 |
| Top-k | `top_k=50` | 砍掉低概率长尾 |
| Top-p (nucleus) | `top_p=0.9` | 动态截断 |
| Repetition penalty | `1.1–1.3` | 抑制「the the the」 |

预训练 Base 模型建议 **top_p=0.9 + repetition_penalty=1.15**；SFT 后可略降 temperature 到 0.5 提升事实性。

## 常见误区

1. **eval 模式忘记开**：`model.eval()` 否则 dropout 随机。
2. **KV cache 未启用**：长生成应 `use_cache=True`（Transformers 默认开）。
3. **temperature=0 仍采样**：greedy 需 `do_sample=False`。
4. **prompt 过长占满 context**：2048 上下文里 prompt 占 1900，生成只剩 148 token；Serving 时设 `max_model_len` 与业务匹配。
5. **bf16 在 CPU 上推理**：CPU 多只有 fp32/int8 优化路径，应转 GGUF 量化版。

## 端到端实践要点

推理是第八章内容的 hands-on：自回归生成、KV cache、采样策略。125M bf16 权重仅 250 MB，RTX 3060 也能跑；瓶颈常在 sampling 与 Python 开销而非 matmul。LitGPT CLI 适合快速试 prompt；Transformers 适合集成进应用；GGUF + llama.cpp 适合无 GPU 服务器或边缘设备。

预训练 Base 模型没有「助手人格」，评估 continuation 而非 chat。Prompt 设计应用半句话开头（「深度学习是」），不要用「请介绍一下」类指令。Repetition penalty 1.1–1.3 对 Base 模型几乎必需，否则易陷入「the the the」循环。生成 max_new_tokens 不要超过 context 剩余长度。

 benchmark 时固定 seed、记录 tokens/s 与 TTFT，便于对比量化（Q4）与 bf16 版本。推理环境与训练 precision 可以不同（训练 bf16、推理 int4），但 Tokenizer 必须一致。若生成乱码，先查 Tokenizer 路径是否配对，再查 checkpoint 是否 corrupt。

## 命令流水线复盘

`litgpt generate checkpoints/best --tokenizer_dir tokenizer --prompt "..."` 快速试；或 `python` Transformers 脚本测 tokens/s；可选转 GGUF 后 `llama-cpp-python` CPU 试跑。固定十条 prompt 存 `eval/prompts.txt`，每次改权重后批量生成对比。通过后进入[部署模型](/manual/llm/bit-to-agi/10-train-your-llm/deploy-model)把 `best-hf` 打进 Docker。

## 排错速查

generate 空：max_new_tokens=0 或 prompt 全 special token。极慢：未用 GPU 或 `device_map` 错。重复循环：加 repetition_penalty。乱码 token：tokenizer_dir 错。GGUF 转换失败：HF 缺 config。

## 验收标准

本篇完成后，你应能在终端用一条命令或脚本验证关键产出存在且非空：`test -s` 查文件、`curl` 查 HTTP、`python -c` 查 import 与 shape。把验收命令写进项目 `Makefile` 或 `scripts/verify.sh`，每次改数据或权重后跑一遍，避免带着 silent failure 进入下一篇。全章二十篇都通过验收，即表示你已具备从零训小模型到部署 API 的完整能力。

## 与前后章衔接

本章每篇都假设你已读完第一至九章：比特与文件格式（第一章）解释 `train.bin` 为何是字节流；信息论（第三章）解释为何 PPL 衡量压缩效率；Transformer（第五章）解释预训练在优化什么；Tokenizer（第六章）与本章 BPE 训练一一对应；Training（第七章）给出 loss、LoRA、Checkpoint 理论；Inference（第八章）对应推理与部署；GPU（第九章）对应硬件与显存估算。若某命令报错，先查依赖版本（Python 3.11+、CUDA 驱动、PyTorch 与 vLLM 匹配），再查路径是否与 `mini-gpt-lab` 目录约定一致。整条流水线可在单卡 4090 上于一个周末跑通；失败时回到[从失败中恢复](/manual/llm/bit-to-agi/10-train-your-llm/recover-from-failure)对照症状表，不要跳过日志与 checkpoint 排查。

完成本篇后建议把关键命令与输出路径记录到 `docs/run-log.md`，便于复现与团队协作。

## 练习扩展

若时间充裕，尝试修改一个超参或配置项，观察下游指标变化并记录到 `docs/run-log.md`：例如清洗 threshold、词表大小、学习率、save 间隔或 vLLM 的 `max-model-len`。单次只改一处，才能归因。对比实验最好开 W&B 同名 project 下不同 run，用 Notes 字段标注「baseline / variant B」。这些习惯与工业界 ML 实验管理一致，比单纯跑通命令更有长期价值。

建议每篇末尾自检：关键产出文件存在、体积合理、随机抽检内容可读，再点下一篇链接。

遇到问题先查日志与磁盘空间，再查本章排错速查表。

保持 `mini-gpt-lab` 目录结构与命名一致，可显著减少路径类错误。

全章命令均在 bash + Python venv 下验证；Windows 用户请用 WSL2 或调整路径分隔符。

建议 fork 本章 `mini-gpt-lab` 仓库模板，在 README 中勾选已完成篇目，便于跟踪进度。

## 小结

- GPU 推理常用 LitGPT / Transformers；边缘用 GGUF + llama.cpp。
- 125M 模型单卡 100+ tokens/s；测 TTFT 与吞吐。
- Base 模型用 continuation prompt 评估。

→ 下一篇：[部署模型](/manual/llm/bit-to-agi/10-train-your-llm/deploy-model)
