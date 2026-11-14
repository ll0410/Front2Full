---
title: "OpenAI API 兼容"
description: "从 Bit 到 AGI · 第十章：自己训练一个模型 · OpenAI API 兼容"
source: "https://daiw.org/manual/bit-to-agi/10-train-your-llm/openai-api-compat"
---

# OpenAI API 兼容

> 从 Bit 到 AGI · 第十章：自己训练一个模型 · OpenAI API 兼容

vLLM 自带 OpenAI 兼容 HTTP API。本篇教你用**同一套 SDK 代码**切换 OpenAI 官方与你的自训模型，并配置 LiteLLM 做统一网关。

## 直觉：通用电源插座

OpenAI API 成了事实标准：URL + `Authorization: Bearer` + JSON body。兼容层像**万能转接头**——客户端不变，后端从 `api.openai.com` 换成本地 `localhost:8000`。

## 定义

核心端点（vLLM 实现）：

| 端点 | 用途 |
| ---- | ---- |
| `POST /v1/chat/completions` | 对话（需 chat template） |
| `POST /v1/completions` | 纯续写 |
| `GET /v1/models` | 列出模型 ID |

请求体字段：

```json
{
  "model": "checkpoints/best-hf",
  "messages": [{"role": "user", "content": "你好"}],
  "max_tokens": 128,
  "temperature": 0.7
}
```

## 例子

**例 1：curl 调用 completions**

```bash
curl http://localhost:8000/v1/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-local" \
  -d '{
    "model": "checkpoints/best-hf",
    "prompt": "比特是信息的最小单位，",
    "max_tokens": 100,
    "temperature": 0.7
  }'
```

**例 2：OpenAI Python SDK 指向本地**

```bash
pip install openai

python << 'EOF'
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="sk-local",  # vLLM 不校验，但 header 必填
)

resp = client.completions.create(
    model="checkpoints/best-hf",
    prompt="深度学习是",
    max_tokens=128,
    temperature=0.7,
)
print(resp.choices[0].text)
print(f"usage: {resp.usage}")
EOF
```

**例 3：LiteLLM 统一路由**

```bash
pip install litellm

cat > deploy/litellm_config.yaml << 'EOF'
model_list:
  - model_name: mini-gpt
    litellm_params:
      model: openai/checkpoints/best-hf
      api_base: http://localhost:8000/v1
      api_key: sk-local
  - model_name: gpt-4o
    litellm_params:
      model: gpt-4o
      api_key: os.environ/OPENAI_API_KEY
EOF

litellm --config deploy/litellm_config.yaml --port 4000
```

客户端改 `base_url=http://localhost:4000` 即可在 `mini-gpt` 与 `gpt-4o` 间切换。

**例 4：流式输出**

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="sk-local")
stream = client.completions.create(
    model="checkpoints/best-hf",
    prompt="Transformer 的核心是",
    max_tokens=200,
    stream=True,
)
for chunk in stream:
    print(chunk.choices[0].text or "", end="", flush=True)
print()
```

## 量化

| 场景 | 延迟 | 吞吐 |
| ---- | ---- | ---- |
| 非流式 128 tokens | 0.5–1.5 s | — |
| 流式首 token | 50–150 ms | — |
| 并发 4 路 | P99 ~2 s | ~400 tok/s 合计 |

Base 模型无 chat template 时，`/v1/chat/completions` 可能格式异常——**预训练模型优先用 `/v1/completions`**；SFT 后再配 chat template。

::: info

在 `tokenizer_config.json` 里添加 `chat_template`（Jinja2）后，chat 端点才能正确渲染 `<|user|>` 等标记。详见[微调 SFT](/manual/llm/bit-to-agi/10-train-your-llm/fine-tune-sft)。

:::

## 动手试一试

对比官方与本地（需 `OPENAI_API_KEY`）：

```bash
python << 'EOF'
import os, time
from openai import OpenAI

def bench(client, model, prompt):
    t0 = time.perf_counter()
    r = client.completions.create(model=model, prompt=prompt, max_tokens=64)
    return time.perf_counter() - t0, r.choices[0].text[:80]

local = OpenAI(base_url="http://localhost:8000/v1", api_key="sk-local")
dt, text = bench(local, "checkpoints/best-hf", "AI is")
print(f"local {dt:.2f}s: {text!r}")
EOF
```

## 与 OpenAI 官方差异

| 特性 | OpenAI 官方 | vLLM 自托管 |
| ---- | ----------- | ----------- |
| `logprobs` | 支持 | 部分版本支持 |
| Function calling | 完整 | 取决于模型 SFT |
| Vision | GPT-4o / GPT-5 等多模态模型 | 需多模态模型 |
| Rate limit | 有 | 自行限流 |
| 计费 | 按 token | 仅 GPU 成本 |

生产环境在 vLLM 前加 **nginx** 限流与 API key 校验（详见[《Nginx 完全手册》](https://daiw.org/manual/nginx)）：

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
location /v1/ {
    limit_req zone=api burst=20;
    proxy_pass http://127.0.0.1:8000;
}
```

## 多客户端接入示例

**Node.js**：

```javascript
import OpenAI from "openai";
const client = new OpenAI({ baseURL: "http://localhost:8000/v1", apiKey: "sk-local" });
const r = await client.completions.create({ model: "checkpoints/best-hf", prompt: "Hello", max_tokens: 32 });
console.log(r.choices[0].text);
```

**curl 流式**：

```bash
curl -N http://localhost:8000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"checkpoints/best-hf","prompt":"Hi","max_tokens":50,"stream":true}'
```

每条 SSE 以 `data: {...}` 开头，以 `data: [DONE]` 结束。

## 常见误区

1. **model 名不一致**：SDK 里的 `model` 必须与 vLLM 加载路径或 `--served-model-name` 一致。
2. **忘记 api_key header**：vLLM 仍要求 Bearer token 存在。
3. **Base 模型走 chat 端点**：应先用 completions 或 SFT 后加 template。
4. **HTTPS 未配置**：公网暴露应用 TLS 终止在 Caddy/nginx。
5. **timeout 过短**：长生成 512 token 可能超 60 s，调大 proxy_read_timeout。

## 端到端实践要点

OpenAI 兼容 API 是事实标准：改 `base_url` 即可让现有应用连自托管模型。vLLM 实现了 completions 与 chat 端点；Base 模型用 completions，Instruct 模型用 chat 并确保 chat template 一致。LiteLLM 在多个 backend 间路由，适合「开发用 mini-gpt、生产 fallback gpt-4o」的混合策略。

流式 SSE 改善用户体验：首 token 200 ms 内返回，用户感觉比等整段 JSON 快得多。注意 proxy timeout 与 client timeout 设到 120 s 以上，长生成 512 token 可能超 60 s。公网暴露务必 HTTPS + 鉴权；`sk-local` 只是占位，生产用随机 UUID key 存 Secrets Manager。

logprobs、function calling、vision 等高级特性取决于 vLLM 版本与模型 SFT 格式，不要假设与 OpenAI 100% 一致。对接前先读 vLLM release notes。最后，在 staging 用同一 SDK 代码连 staging URL 跑集成测试，再切 production DNS——避免直接在生产 debug。

## 命令流水线复盘

确认 vLLM 在 `:8000`；`pip install openai`；运行本篇 Python SDK 脚本；试 `stream=True` 流式；可选 `litellm --config deploy/litellm_config.yaml --port 4000` 起网关。Node 客户端改 `baseURL` 同样可用。Base 模型用 `completions` 端点；SFT 后用 `chat.completions`。下一篇[MCP 集成](/manual/llm/bit-to-agi/10-train-your-llm/mcp-integration)在 API 之上包 MCP tool。

## 排错速查

404 model：served-model-name 与请求不一致。401：缺 Authorization header。空 completion：prompt 为空或 max_tokens=0。流式断连：nginx proxy 未关 buffering。chat 乱码：Base 模型勿用 chat 端点。

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

遇阻可在本章总结页的命令速查中对照当前阶段。耐心排查，多数错误来自路径与环境。

## 小结

- vLLM 暴露 `/v1/completions` 与 `/v1/chat/completions`。
- OpenAI SDK 改 `base_url` 即可对接自训模型。
- LiteLLM 做多模型网关；流式用 `stream=True`。

→ 下一篇：[MCP 集成](/manual/llm/bit-to-agi/10-train-your-llm/mcp-integration)
