---
title: "部署模型"
description: "从 Bit 到 AGI · 第十章：自己训练一个模型 · 部署模型"
source: "https://daiw.org/manual/bit-to-agi/10-train-your-llm/deploy-model"
---

# 部署模型

> 从 Bit 到 AGI · 第十章：自己训练一个模型 · 部署模型

本地 `generate` 只能一个人用。部署是把模型包进**长期运行的服务**：Docker 容器、健康检查、GPU 绑定与日志。本篇用 vLLM + Docker 在单卡服务器上暴露 HTTP 推理端点，为下一篇 OpenAI 兼容 API 打基础。

## 直觉：从厨房到餐厅

训练是在自家厨房试菜；部署是开餐厅——同样的菜（模型），但要**稳定出餐**（低延迟）、**同时服务多桌**（batching）、**打烊也能重启**（容器化）。125M 模型小，一张 GPU 能跑多个副本或与其它服务共存。

```mermaid
flowchart LR
    A[HF Checkpoint] --> B[Docker 镜像]
    B --> C[vLLM Server :8000]
    C --> D[负载均衡 / 客户端]
```

## 定义

**模型服务**核心组件：

| 组件 | 作用 |
| ---- | ---- |
| 推理引擎 | vLLM / TGI / llama.cpp server |
| 容器 | 隔离 CUDA、依赖版本 |
| 健康检查 | `/health` 200 = 就绪 |
| 资源 limit | `--gpus 1`, memory limit |

SLA 指标（实验级）：

- 可用性：> 99%（单机）
- P99 延迟：< 2 s（128 output tokens）
- 并发：4–8 路 batch=1

## 例子

**例 1：Dockerfile**

```bash
cd ~/mini-gpt-lab
mkdir -p deploy

cat > deploy/Dockerfile << 'EOF'
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y python3-pip && rm -rf /var/lib/apt/lists/*
RUN pip3 install "vllm>=0.8" --no-cache-dir

COPY checkpoints/best-hf /model
ENV MODEL_PATH=/model

EXPOSE 8000
HEALTHCHECK CMD curl -f http://localhost:8000/health || exit 1

CMD python3 -m vllm.entrypoints.openai.api_server \
    --model ${MODEL_PATH} \
    --host 0.0.0.0 \
    --port 8000 \
    --dtype bfloat16 \
    --max-model-len 2048
EOF
```

**例 2：构建与运行**

```bash
docker build -t mini-gpt-server:latest -f deploy/Dockerfile .

docker run -d \
  --name mini-gpt \
  --gpus '"device=0"' \
  -p 8000:8000 \
  --restart unless-stopped \
  mini-gpt-server:latest

# 查看日志
docker logs -f mini-gpt
```

**例 3：裸机 vLLM（无 Docker）**

```bash
source .venv/bin/activate
pip install vllm

python -m vllm.entrypoints.openai.api_server \
  --model checkpoints/best-hf \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype bfloat16 \
  --max-model-len 2048 \
  --gpu-memory-utilization 0.5
```

`gpu-memory-utilization 0.5` 125M 模型只占 ~1 GB，留显存给其它进程。

**例 4：docker-compose**

```bash
cat > deploy/docker-compose.yml << 'EOF'
services:
  mini-gpt:
    build:
      context: ..
      dockerfile: deploy/Dockerfile
    ports:
      - "8000:8000"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: unless-stopped
EOF

cd deploy && docker compose up -d
```

## 量化

| 资源 | 125M bf16 部署 |
| ---- | -------------- |
| GPU 显存 | ~1–2 GB |
| 系统内存 | ~4 GB |
| 磁盘 | ~500 MB（模型+镜像层） |
| 冷启动 | 10–30 s |

单卡 QPS（128 token 输出，batch=1）：约 **3–8 req/s**。

::: warning

生产环境不要把 Docker 镜像里的模型权重与密钥一起提交 Git。镜像构建时 `COPY` 本地 Checkpoint，或启动时从对象存储挂载。

:::

## 动手试一试

部署后冒烟测试：

```bash
curl -s http://localhost:8000/health
curl -s http://localhost:8000/v1/models | python3 -m json.tool
```

## 生产部署清单

上线前逐项确认：

| 检查项 | 命令 / 方法 |
| ------ | ----------- |
| 模型文件完整 | `ls checkpoints/best-hf/*.safetensors` |
| 健康检查 | `curl -f localhost:8000/health` |
| 负载冒烟 | `ab -n 100 -c 4 -p payload.json -T application/json localhost:8000/v1/completions` |
| 日志轮转 | `docker logs --tail 100 mini-gpt` |
| GPU 持久模式 | `nvidia-smi -pm 1` |

**Kubernetes** 部署时，资源 request/limit 示例：

```yaml
resources:
  limits:
    nvidia.com/gpu: 1
    memory: 8Gi
  requests:
    nvidia.com/gpu: 1
    memory: 4Gi
```

125M 模型 request 4Gi 足够；7B 需 16–24Gi。

## 反向代理与 TLS

公网服务用 Caddy 自动 HTTPS：

```bash
caddy reverse-proxy --from mini-gpt.example.com --to localhost:8000
```

客户端 `base_url` 改为 `https://mini-gpt.example.com/v1`。

## 常见误区

1. **CUDA 版本不匹配**：宿主机驱动 ≥ 镜像 CUDA runtime 要求。
2. **max-model-len 大于训练长度**：超过 2048 位置外推质量差。
3. **无 healthcheck**：K8s / compose 不知道服务是否真就绪。
4. **容器内无 curl**：healthcheck 失败；Dockerfile 装 curl 或换 wget。
5. **单副本无备份**：Spot 实例被杀后冷启动 30 s；至少 2 副本 + LB。

## 端到端实践要点

部署把「本地脚本」变成「网络服务」。Docker 保证 CUDA、Python、vLLM 版本一致，避免「我机器上能跑」问题。125M 模型 `gpu-memory-utilization=0.5` 即可与同机其他实验共存；7B 可能要 0.9。健康检查与 restart policy 让 compose/K8s 能在进程崩溃后自动拉起。

生产还需 TLS、限流、日志与监控——本章 Docker 是 MVP。Caddy/nginx 反代解决 HTTPS；API key 校验可在反代或 LiteLLM 层做，vLLM 本身不认证。多副本部署 125M 模型可行（每副本 ~1 GB 显存），用 round-robin LB；7B 通常单副本 + 大 batch。

冷启动 10–30 s 来自模型加载；Serverless GPU 场景要考虑 keep-warm 或 min instances。最后，部署的 `max-model-len` 不要超过训练 seq_len，否则 RoPE 外推质量差；要长上下文需继续预训练或选长 ctx 基座。

## 命令流水线复盘

`docker build -t mini-gpt-server:latest -f deploy/Dockerfile .`；`docker run --gpus device=0 -p 8000:8000 mini-gpt-server:latest`；`curl localhost:8000/health`；`curl localhost:8000/v1/models`。或使用 `deploy/docker-compose.yml` 一键起。日志：`docker logs -f mini-gpt`。确认显存占用低于 2 GB 后进入[OpenAI API 兼容](/manual/llm/bit-to-agi/10-train-your-llm/openai-api-compat)用 SDK 调 `/v1/completions`。

## 排错速查

Docker GPU 不可用：装 nvidia-container-toolkit。healthcheck 失败：镜像内缺 curl。端口占用：`lsof -i :8000`。CUDA OOM 启动：降低 `gpu-memory-utilization`。模型路径错：确认 COPY 进镜像的目录含 config.json。

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

## 小结

- HF Checkpoint → Docker + vLLM → `:8000`。
- 125M 模型占 ~1 GB 显存；`gpu-memory-utilization` 可调。
- compose 管理重启与 GPU 绑定。

→ 下一篇：[OpenAI API 兼容](/manual/llm/bit-to-agi/10-train-your-llm/openai-api-compat)
