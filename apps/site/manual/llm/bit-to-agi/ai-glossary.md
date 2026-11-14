---
title: "AI术语大全"
description: "从 Bit 到 AGI · 全书术语总索引——按章节归类，链到对应详解文章"
source: "https://daiw.org/manual/bit-to-agi/ai-glossary"
---

# AI术语大全

> 从 Bit 到 AGI · 全书术语总索引——按章节归类，链到对应详解文章

读完十二章仍记不住某个缩写？这篇是**全书术语总索引**：按章节归类，每条术语链到专栏内已有详解，不重复展开。适合复习、查词、写文档时快速定位。

::: info

本页是**导航索引**，不是新知识点。若某术语在正文中首次出现，仍以对应章节文章为准。

:::

## 如何使用

1. **按章节浏览**：你知道概念属于「训练」还是「推理」，直接跳到对应小节。
2. **按缩写查**：文末有 **A–Z 英文缩写表**，适合查 LoRA、KV Cache、RLHF 等。
3. **按链路追**：文末「全书叙事锚点」列出贯穿多章的核心概念，适合串读。

链接格式统一为 `/manual/bit-to-agi/<章>/<slug>`。

---

## 第一章：比特（Bit）

| 术语 | 一句话 | 详解 |
| ---- | ------ | ---- |
| 比特（Bit） | 0/1 是计算机与 AI 数据的最终形态 | [为什么 AI 最后只是比特](/manual/llm/bit-to-agi/01-bits/why-ai-is-bits) |
| 二进制 | $n$ 位可编码 $2^n$ 种状态 | [为什么世界只有 0 和 1](/manual/llm/bit-to-agi/01-bits/why-world-is-01) |
| 整数表示 | 补码表示有符号整数；Token ID 即整数 | [整数如何表示](/manual/llm/bit-to-agi/01-bits/integer-representation) |
| 浮点数（FP16/BF16/INT8） | 近似实数；精度与体积的权衡 | [浮点数为什么会有误差](/manual/llm/bit-to-agi/01-bits/floating-point-error) |
| UTF-8 | 变长字节编码；中文常 3 字节/字 | [文字为什么最后都是 UTF-8](/manual/llm/bit-to-agi/01-bits/why-text-is-utf8) |
| 内存（DRAM） | 主存，延迟约 100 ns；放权重与激活 | [内存是什么](/manual/llm/bit-to-agi/01-bits/what-is-memory) |
| Cache / 缓存行 | 64 字节行；行主序访问快数倍 | [Cache 是什么](/manual/llm/bit-to-agi/01-bits/what-is-cache) |
| SIMD | 单指令多数据；向量化浮点运算 | [SIMD 是什么](/manual/llm/bit-to-agi/01-bits/what-is-simd) |
| GPU | 大规模并行 GEMM；分支差、吞吐高 | [GPU 为什么快](/manual/llm/bit-to-agi/01-bits/why-gpu-is-fast) |
| GEMM / 矩阵乘法 | Attention 与 FFN 的核心算子 | [为什么 AI 喜欢矩阵](/manual/llm/bit-to-agi/01-bits/why-ai-likes-matrices) |
| 连续存储（Row-major） | 行主序 + stride；`contiguous()` 可能拷贝 | [矩阵为什么连续存储](/manual/llm/bit-to-agi/01-bits/why-matrices-are-contiguous) |
| 大端 / 小端 | 多字节整数的字节序 | [大端与小端](/manual/llm/bit-to-agi/01-bits/endianness) |

---

## 第二章：数学（Math）

| 术语 | 一句话 | 详解 |
| ---- | ------ | ---- |
| 向量 | $n$ 维数组；Embedding 与隐状态的基本单元 | [向量是什么](/manual/llm/bit-to-agi/02-math/what-is-a-vector) |
| 矩阵 | 二维数组；批次、权重、线性变换的容器 | [矩阵是什么](/manual/llm/bit-to-agi/02-math/what-is-a-matrix) |
| 矩阵乘法（GEMM） | 占 NN 算力 90% 以上；FLOPs $=2mnk$ | [为什么矩阵乘法这么重要](/manual/llm/bit-to-agi/02-math/why-matrix-multiply-matters) |
| 梯度 | 最陡上升方向；训练取负梯度 | [梯度是什么](/manual/llm/bit-to-agi/02-math/what-is-gradient) |
| 偏导数 | 对单个参数的导数 | [偏导数是什么](/manual/llm/bit-to-agi/02-math/what-is-partial-derivative) |
| 链式法则 | 复合函数求导；反向传播的理论基础 | [链式法则是什么](/manual/llm/bit-to-agi/02-math/chain-rule) |
| 梯度下降 | $\theta \leftarrow \theta - \eta \nabla \mathcal{L}$ | [为什么损失函数可以下降](/manual/llm/bit-to-agi/02-math/why-loss-can-descend) |
| 点积 | $\mathbf{a}^\top\mathbf{b}$；Attention 打分 | [点积是什么](/manual/llm/bit-to-agi/02-math/dot-product) |
| Softmax / Logits | Logits 经 Softmax 变为概率分布 | [Softmax 与 Logits](/manual/llm/bit-to-agi/02-math/softmax-and-logits) |
| 概率 | LLM 输出下一 Token 的概率分布 | [概率是什么](/manual/llm/bit-to-agi/02-math/what-is-probability) |
| 贝叶斯 | 先验 + 似然 → 后验；不确定性推理 | [贝叶斯是什么](/manual/llm/bit-to-agi/02-math/what-is-bayes) |
| 范数 / 距离 | L2 范数；梯度裁剪与检索相似度 | [范数与距离](/manual/llm/bit-to-agi/02-math/norms-and-distance) |
| 特征值 | 矩阵反复作用的放大/衰减因子 | [特征值的直觉](/manual/llm/bit-to-agi/02-math/eigenvalues-intuition) |

---

## 第三章：信息（Information）

| 术语 | 一句话 | 详解 |
| ---- | ------ | ---- |
| 自信息 | $I(x)=-\log_2 p(x)$ bit；越罕见信息量越大 | [什么是信息](/manual/llm/bit-to-agi/03-information/what-is-information) |
| 熵 | 自信息的期望；分布的不确定性 | [信息熵是什么](/manual/llm/bit-to-agi/03-information/what-is-entropy) |
| 交叉熵 | $H(p,q)=-\sum p\log q$；训练损失（bit/token） | [交叉熵是什么](/manual/llm/bit-to-agi/03-information/cross-entropy) |
| KL 散度 | $D_{KL}(p\|q)$；模型分布偏离真实分布的代价 | [KL 散度是什么](/manual/llm/bit-to-agi/03-information/kl-divergence) |
| 困惑度（PPL） | $2^{CE}$；平均分支因子 | [交叉熵是什么](/manual/llm/bit-to-agi/03-information/cross-entropy) |
| 互信息 | $X$ 与 $Y$ 共享多少不确定性 | [互信息是什么](/manual/llm/bit-to-agi/03-information/mutual-information) |
| 压缩 | 去除熵以上的冗余 | [为什么压缩就是去除信息冗余](/manual/llm/bit-to-agi/03-information/compression-removes-redundancy) |
| 下一 Token 预测 | CLM 目标；GPT 预训练核心 | [为什么 GPT 可以预测下一个 Token](/manual/llm/bit-to-agi/03-information/why-gpt-predicts-next-token) |
| 预测即压缩 | 好预测器 = 短描述；算术编码视角 | [预测即压缩](/manual/llm/bit-to-agi/03-information/prediction-is-compression) |

---

## 第四章：神经元（Neuron）

| 术语 | 一句话 | 详解 |
| ---- | ------ | ---- |
| 神经元 | 加权和 + 激活；基本计算单元 | [什么是神经元](/manual/llm/bit-to-agi/04-neural-networks/what-is-neuron) |
| 激活函数 | 非线性；无它深层退化为线性 | [为什么要激活函数](/manual/llm/bit-to-agi/04-neural-networks/why-activation-functions) |
| ReLU | $max(0,x)$；缓解饱和，深度网络主流 | [ReLU 为什么成功](/manual/llm/bit-to-agi/04-neural-networks/why-relu-wins) |
| Sigmoid | 易饱和；深层梯度消失 | [Sigmoid 为什么失败](/manual/llm/bit-to-agi/04-neural-networks/why-sigmoid-fails) |
| MLP | 全连接层；表格/向量基线 | [MLP 是什么](/manual/llm/bit-to-agi/04-neural-networks/what-is-mlp) |
| CNN | 局部连接；参数从 $HWC^2$ 降到 $k^2C$ | [CNN 为什么成功](/manual/llm/bit-to-agi/04-neural-networks/why-cnn-succeeds) |
| RNN | 序列递归；长程梯度衰减 | [RNN 为什么消失](/manual/llm/bit-to-agi/04-neural-networks/why-rnn-vanishes) |
| LSTM | 门控循环；缓解长程依赖 | [LSTM 解决了什么](/manual/llm/bit-to-agi/04-neural-networks/what-lstm-solves) |
| Attention | 动态加权混合；$O(n^2)$ 并行 | [Attention 为什么出现](/manual/llm/bit-to-agi/04-neural-networks/why-attention-emerged) |
| 前向传播 | 输入 → 输出 → 损失 | [前向传播是什么](/manual/llm/bit-to-agi/04-neural-networks/forward-pass) |
| 反向传播 | 链式法则自动求导 | [反向传播是什么](/manual/llm/bit-to-agi/04-neural-networks/backward-pass) |
| 优化器（SGD/Adam） | 用梯度更新权重；LLM 常用 AdamW | [优化器：SGD 与 Adam](/manual/llm/bit-to-agi/04-neural-networks/optimizer-sgd-adam) |
| Dropout | 随机失活；防过拟合 | [Dropout 是什么](/manual/llm/bit-to-agi/04-neural-networks/dropout) |
| 过拟合 / 正则化 | 训练好、验证差；L2、Dropout 等 | [过拟合与正则化](/manual/llm/bit-to-agi/04-neural-networks/overfitting-and-regularization) |

---

## 第五章：Transformer

| 术语 | 一句话 | 详解 |
| ---- | ------ | ---- |
| Embedding | Token ID → $d$ 维向量；查表 $V\times d$ | [什么是 Embedding](/manual/llm/bit-to-agi/05-transformer/what-is-embedding) |
| 位置编码 | 注入序列顺序；正弦/可学习/RoPE | [位置编码](/manual/llm/bit-to-agi/05-transformer/position-encoding) |
| Self-Attention | $\mathrm{softmax}(QK^\top/\sqrt{d_k})V$ | [Self-Attention](/manual/llm/bit-to-agi/05-transformer/self-attention) |
| Q / K / V | Query、Key、Value 投影 | [QKV](/manual/llm/bit-to-agi/05-transformer/qkv) |
| 多头注意力（MHA） | $h$ 路并行头；$d_k=d_{model}/h$ | [多头注意力](/manual/llm/bit-to-agi/05-transformer/multi-head-attention) |
| 残差连接 | $x+\mathrm{Sublayer}(x)$；支撑深层 | [残差连接](/manual/llm/bit-to-agi/05-transformer/residual-connection) |
| LayerNorm | 按 Token 归一化；稳定训练 | [LayerNorm](/manual/llm/bit-to-agi/05-transformer/layer-norm) |
| FFN | $\mathrm{GELU}(xW_1)W_2$；通常 $d\to4d\to d$ | [前馈网络](/manual/llm/bit-to-agi/05-transformer/feed-forward) |
| Encoder / Decoder | 双向（BERT）vs 因果（GPT）掩码 | [Encoder-Decoder](/manual/llm/bit-to-agi/05-transformer/encoder-decoder) |
| BERT vs GPT | MLM vs CLM；同架构不同掩码 | [BERT 与 GPT](/manual/llm/bit-to-agi/05-transformer/bert-vs-gpt) |
| Attention 复杂度 | $O(n^2 d)$ 算力与显存 | [Attention 复杂度](/manual/llm/bit-to-agi/05-transformer/attention-complexity) |
| 缩放定律（Scaling Laws） | Loss 随参数/数据/算力可预测下降 | [缩放定律入门](/manual/llm/bit-to-agi/05-transformer/scaling-laws-intro) |
| Transformer Block | MHA→残差+LN→FFN→残差+LN，重复 $L$ 层 | [Transformer Block 解剖](/manual/llm/bit-to-agi/05-transformer/transformer-block-anatomy) |
| Pre-Norm vs Post-Norm | LN 在子层前或后；影响深层稳定性 | [Pre-Norm 与 Post-Norm](/manual/llm/bit-to-agi/05-transformer/pre-norm-vs-post-norm) |

---

## 第六章：Token

| 术语 | 一句话 | 详解 |
| ---- | ------ | ---- |
| Token | 词表整数 ID；模型读写 ID 序列 | [Token 是什么](/manual/llm/bit-to-agi/06-tokenizer/what-is-token) |
| BPE | 迭代合并高频字节对；GPT/tiktoken 标准 | [BPE 是什么](/manual/llm/bit-to-agi/06-tokenizer/what-is-bpe) |
| SentencePiece | 语言无关子词；Llama 2/Gemma 常用 | [SentencePiece 是什么](/manual/llm/bit-to-agi/06-tokenizer/what-is-sentencepiece) |
| 词表大小 $V$ | Embedding 行数；大 $V$ 省 Token 数、增参数 | [词表大小如何选](/manual/llm/bit-to-agi/06-tokenizer/vocabulary-size) |
| 中文 Token 成本 | 同语义中文常多 1.5–2.5× Token | [为什么中文 Token 更贵](/manual/llm/bit-to-agi/06-tokenizer/why-chinese-tokens-cost-more) |
| bytes/token | 压缩效率；英文约 4、中文约 2–3 | [为什么中文 Token 更贵](/manual/llm/bit-to-agi/06-tokenizer/why-chinese-tokens-cost-more) |
| Tokenization 陷阱 | JSON 空格、Unicode、Chat 模板隐形 Token | [Tokenization 的坑](/manual/llm/bit-to-agi/06-tokenizer/tokenization-pitfalls) |

---

## 第七章：训练（Training）

| 术语 | 一句话 | 详解 |
| ---- | ------ | ---- |
| 预训练（Pretrain） | T 级 Token；占总算力 99%+ | [什么是预训练](/manual/llm/bit-to-agi/07-training/what-is-pretraining) |
| Chinchilla 最优 | Token 数 ≈ $20\times$ 参数量 | [什么是预训练](/manual/llm/bit-to-agi/07-training/what-is-pretraining) |
| SFT | 指令微调；只在 assistant 段算 loss | [什么是 SFT](/manual/llm/bit-to-agi/07-training/what-is-sft) |
| RLHF | 奖励模型 + PPO 对齐人类偏好 | [什么是 RLHF](/manual/llm/bit-to-agi/07-training/what-is-rlhf) |
| DPO | 无奖励模型、无 PPO 的偏好优化 | [什么是 DPO](/manual/llm/bit-to-agi/07-training/what-is-dpo) |
| GRPO | 组相对策略优化；DeepSeek-R1 路线 | [什么是 GRPO](/manual/llm/bit-to-agi/07-training/what-is-grpo) |
| LoRA | 低秩适配器；只训小矩阵 | [什么是 LoRA](/manual/llm/bit-to-agi/07-training/what-is-lora) |
| QLoRA | LoRA + 4-bit 基座；24 GB 可训 7B | [什么是 QLoRA](/manual/llm/bit-to-agi/07-training/what-is-qlora) |
| MoE | 稀疏专家；容量大、每 Token 激活少 | [什么是 MoE](/manual/llm/bit-to-agi/07-training/what-is-moe) |
| 蒸馏 | 大模型教小模型；银标数据 | [蒸馏](/manual/llm/bit-to-agi/07-training/distillation) |
| 混合精度训练 | FP16/BF16 前向 + FP32 主权重 | [混合精度训练](/manual/llm/bit-to-agi/07-training/mixed-precision-training) |
| 分布式训练 | ZeRO、TP、PP 跨卡训练 | [分布式训练概览](/manual/llm/bit-to-agi/07-training/distributed-training-overview) |
| Checkpoint | 权重 + 优化器状态快照 | [Checkpoint](/manual/llm/bit-to-agi/07-training/checkpoint) |
| 奖励模型（RM） | 给回复打分；RLHF 前置 | [奖励模型](/manual/llm/bit-to-agi/07-training/reward-model) |

---

## 第八章：推理（Inference）

| 术语 | 一句话 | 详解 |
| ---- | ------ | ---- |
| KV Cache | 缓存历史 K/V；避免重复计算 | [KV Cache 是什么](/manual/llm/bit-to-agi/08-inference/what-is-kv-cache) |
| PagedAttention | 分块 KV 池；显存利用率 90%+ | [PagedAttention](/manual/llm/bit-to-agi/08-inference/paged-attention) |
| Flash Attention | 分块 Attention；不写满 $N\times N$ 矩阵 | [Flash Attention](/manual/llm/bit-to-agi/08-inference/flash-attention) |
| Continuous Batching | 动态拼 batch；吞吐提升 10–40× | [Continuous Batching](/manual/llm/bit-to-agi/08-inference/continuous-batching) |
| 张量并行（TP） | 层内切分 + all-reduce | [张量并行](/manual/llm/bit-to-agi/08-inference/tensor-parallel) |
| 流水线并行（PP） | 按层流水线；有 bubble 开销 | [流水线并行](/manual/llm/bit-to-agi/08-inference/pipeline-parallel) |
| 投机解码 | 草稿模型提议、目标模型验证 | [投机解码](/manual/llm/bit-to-agi/08-inference/speculative-decoding) |
| 采样 | 从分布抽 Token（非贪心 argmax） | [采样](/manual/llm/bit-to-agi/08-inference/sampling) |
| Temperature | 缩放 logits；高=随机，低=确定 | [Temperature](/manual/llm/bit-to-agi/08-inference/temperature) |
| Top-K / Top-P | 截断候选集；Top-P 即 Nucleus | [Top-K](/manual/llm/bit-to-agi/08-inference/top-k) · [Top-P](/manual/llm/bit-to-agi/08-inference/top-p) |
| Prefix Caching | 复用共享前缀 KV；RAG 关键 | [Prefix Caching](/manual/llm/bit-to-agi/08-inference/prefix-caching) |
| 推理量化 | INT4/FP8 权重与 KV；省显存 | [推理量化](/manual/llm/bit-to-agi/08-inference/quantization-inference) |
| TTFT / ITL | 首 Token 延迟 / 逐 Token 间隔 | [延迟与吞吐](/manual/llm/bit-to-agi/08-inference/latency-vs-throughput) |

---

## 第九章：GPU

| 术语 | 一句话 | 详解 |
| ---- | ------ | ---- |
| CUDA | NVIDIA 并行编程平台 | [CUDA 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-cuda) |
| HBM | 高带宽显存；2–8 TB/s 级 | [HBM 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-hbm) |
| NVLink | GPU 间高速互联 | [NVLink 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-nvlink) |
| PCIe | 主机↔GPU 总线；约 32 GB/s | [PCIe 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-pcie) |
| Warp | 32 线程 SIMT 锁步执行 | [Warp 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-warp) |
| SM | 流式多处理器；GPU 计算分区 | [SM 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-sm) |
| Tensor Core | 专用矩阵乘硬件；峰值 TFLOPS | [Tensor Core](/manual/llm/bit-to-agi/09-gpu/tensor-core) |
| 显存（VRAM） | 容量硬约束；7B FP16 ≈ 14 GB | [为什么显存这么重要](/manual/llm/bit-to-agi/09-gpu/why-vram-matters) |
| Roofline / 带宽瓶颈 | 推理常 memory-bound 非 compute-bound | [为什么 GPU 这么快](/manual/llm/bit-to-agi/09-gpu/why-gpu-so-fast) |

---

## 第十章：自己训练一个模型

| 术语 | 一句话 | 详解 |
| ---- | ------ | ---- |
| 语料收集 | 原始文本获取；流水线起点 | [收集数据](/manual/llm/bit-to-agi/10-train-your-llm/collect-data) |
| 数据清洗 | 去重、过滤、规范化 | [清洗数据](/manual/llm/bit-to-agi/10-train-your-llm/clean-data) |
| 训练 Tokenizer | 在语料上训 BPE；扫 32K/64K | [训练 Tokenizer](/manual/llm/bit-to-agi/10-train-your-llm/build-tokenizer) |
| 预训练实战 | 125M GPT、500M Token 级实验 | [预训练模型](/manual/llm/bit-to-agi/10-train-your-llm/pretrain-model) |
| 模型验证 | Val PPL、生成质量、早停 | [验证模型](/manual/llm/bit-to-agi/10-train-your-llm/validate-model) |
| 部署 | Docker + vLLM 起服务 | [部署模型](/manual/llm/bit-to-agi/10-train-your-llm/deploy-model) |
| OpenAI API 兼容 | `/v1/completions` 标准端点 | [OpenAI API 兼容](/manual/llm/bit-to-agi/10-train-your-llm/openai-api-compat) |
| MCP 集成 | 模型经 MCP 接工具 | [MCP 集成](/manual/llm/bit-to-agi/10-train-your-llm/mcp-integration) |
| 硬件规划 | 按 Ch1+Ch9 公式估 VRAM | [硬件规划](/manual/llm/bit-to-agi/10-train-your-llm/hardware-planning) |
| 成本估算 | Token × GPU·小时 × 云单价 | [成本估算](/manual/llm/bit-to-agi/10-train-your-llm/cost-estimation) |

---

## 第十一章：工程化（Serving）

| 术语 | 一句话 | 详解 |
| ---- | ------ | ---- |
| vLLM | PagedAttention + 连续 batch；开源 Serving | [vLLM](/manual/llm/bit-to-agi/11-engineering/vllm) |
| SGLang | RadixAttention 前缀缓存 + 结构化生成 | [SGLang](/manual/llm/bit-to-agi/11-engineering/sglang) |
| TensorRT-LLM | NVIDIA 编译推理；FP8/INT4 | [TensorRT-LLM](/manual/llm/bit-to-agi/11-engineering/tensorrt-llm) |
| DeepSpeed | ZeRO 训练 + FastGen 推理 | [DeepSpeed](/manual/llm/bit-to-agi/11-engineering/deepspeed) |
| Megatron | 大规模预训练 TP/PP/EP | [Megatron](/manual/llm/bit-to-agi/11-engineering/megatron) |
| Ray Serve | 多副本、异构 pipeline、扩缩容 | [Ray](/manual/llm/bit-to-agi/11-engineering/ray) |
| Kubernetes | 集群级副本与调度 | [Kubernetes](/manual/llm/bit-to-agi/11-engineering/kubernetes) |
| LiteLLM | 百+ 模型统一 API 路由 | [LiteLLM](/manual/llm/bit-to-agi/11-engineering/litellm) |
| Gateway | 鉴权、限流、灰度路由 | [Gateway](/manual/llm/bit-to-agi/11-engineering/gateway) |
| 可观测性 | TTFT、TPOT、队列深度、GPU 利用率 | [可观测性](/manual/llm/bit-to-agi/11-engineering/observability) |
| 自动扩缩容 | KEDA 驱动 GPU 副本；冷启动 3–5 min | [自动扩缩容](/manual/llm/bit-to-agi/11-engineering/autoscaling) |
| 模型注册表 | 版本、stage、lineage、eval 门禁 | [模型注册表](/manual/llm/bit-to-agi/11-engineering/model-registry) |
| A/B 测试 | 线上对比新旧模型；显著性检验 | [A/B 测试](/manual/llm/bit-to-agi/11-engineering/ab-testing) |
| 成本治理 | Token 预算、FinOps；自托管 vs API | [成本治理](/manual/llm/bit-to-agi/11-engineering/cost-governance) |

---

## 第十二章：未来（AGI）

| 术语 | 一句话 | 详解 |
| ---- | ------ | ---- |
| Agent | LLM + 循环 + 工具；多步成功率 $\approx p^n$ | [Agent 是什么](/manual/llm/bit-to-agi/12-future/what-is-agent) |
| Memory（记忆） | 上下文 + RAG；窗口与检索权衡 | [Memory](/manual/llm/bit-to-agi/12-future/memory) |
| Tool / Function Calling | JSON Schema 调外部工具 | [Tool](/manual/llm/bit-to-agi/12-future/tool-use) |
| MCP | 工具 Server 标准 IO 协议 | [MCP](/manual/llm/bit-to-agi/12-future/mcp-future) |
| Computer Use | 截图→动作；WebArena 约 30–45% | [Computer Use](/manual/llm/bit-to-agi/12-future/computer-use) |
| Robotics | 分层控制；LLM 顶层、电机底层 1 kHz | [Robotics](/manual/llm/bit-to-agi/12-future/robotics) |
| World Model | 预测 $s_{t+1}$；长 rollout 易崩 | [World Model](/manual/llm/bit-to-agi/12-future/world-model) |
| AGI 路线图 | 五线并行；无 operational 验收 | [AGI 路线图](/manual/llm/bit-to-agi/12-future/agi-roadmap) |
| 安全与对齐 | RLHF + 护栏 + 权限；越狱仍活跃 | [安全与对齐](/manual/llm/bit-to-agi/12-future/safety-and-alignment) |

---

## 英文缩写速查（A–Z）

| 缩写 | 中文 | 章节 | 详解 |
| ---- | ---- | ---- | ---- |
| AGI | 通用人工智能 | 12 | [AGI 路线图](/manual/llm/bit-to-agi/12-future/agi-roadmap) |
| API | 应用程序接口 | 10–11 | [OpenAI API 兼容](/manual/llm/bit-to-agi/10-train-your-llm/openai-api-compat) |
| BPE | 字节对编码 | 6 | [BPE 是什么](/manual/llm/bit-to-agi/06-tokenizer/what-is-bpe) |
| CE | 交叉熵 | 3 | [交叉熵是什么](/manual/llm/bit-to-agi/03-information/cross-entropy) |
| CLM | 因果语言模型 | 5 | [BERT 与 GPT](/manual/llm/bit-to-agi/05-transformer/bert-vs-gpt) |
| CNN | 卷积神经网络 | 4 | [CNN 为什么成功](/manual/llm/bit-to-agi/04-neural-networks/why-cnn-succeeds) |
| CUDA | NVIDIA 并行平台 | 9 | [CUDA 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-cuda) |
| DPO | 直接偏好优化 | 7 | [什么是 DPO](/manual/llm/bit-to-agi/07-training/what-is-dpo) |
| FFN | 前馈网络 | 5 | [前馈网络](/manual/llm/bit-to-agi/05-transformer/feed-forward) |
| GEMM | 通用矩阵乘 | 1–2 | [为什么矩阵乘法这么重要](/manual/llm/bit-to-agi/02-math/why-matrix-multiply-matters) |
| GPU | 图形处理器 | 1, 9 | [GPU 为什么快](/manual/llm/bit-to-agi/01-bits/why-gpu-is-fast) |
| GRPO | 组相对策略优化 | 7 | [什么是 GRPO](/manual/llm/bit-to-agi/07-training/what-is-grpo) |
| HBM | 高带宽内存 | 9 | [HBM 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-hbm) |
| ITL | 逐 Token 间隔 | 8 | [延迟与吞吐](/manual/llm/bit-to-agi/08-inference/latency-vs-throughput) |
| KL | KL 散度 | 3 | [KL 散度是什么](/manual/llm/bit-to-agi/03-information/kl-divergence) |
| KV Cache | 键值缓存 | 8 | [KV Cache 是什么](/manual/llm/bit-to-agi/08-inference/what-is-kv-cache) |
| LLM | 大语言模型 | 全书 | [专栏首页](/manual/llm/bit-to-agi/) |
| LoRA | 低秩适配 | 7 | [什么是 LoRA](/manual/llm/bit-to-agi/07-training/what-is-lora) |
| MCP | 模型上下文协议 | 10, 12 | [MCP 集成](/manual/llm/bit-to-agi/10-train-your-llm/mcp-integration) |
| MHA | 多头注意力 | 5 | [多头注意力](/manual/llm/bit-to-agi/05-transformer/multi-head-attention) |
| MLM | 掩码语言模型 | 5 | [BERT 与 GPT](/manual/llm/bit-to-agi/05-transformer/bert-vs-gpt) |
| MoE | 混合专家 | 7 | [什么是 MoE](/manual/llm/bit-to-agi/07-training/what-is-moe) |
| NVLink | GPU 高速互联 | 9 | [NVLink 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-nvlink) |
| PPL | 困惑度 | 3 | [交叉熵是什么](/manual/llm/bit-to-agi/03-information/cross-entropy) |
| PP | 流水线并行 | 8 | [流水线并行](/manual/llm/bit-to-agi/08-inference/pipeline-parallel) |
| QLoRA | 量化 LoRA | 7 | [什么是 QLoRA](/manual/llm/bit-to-agi/07-training/what-is-qlora) |
| RAG | 检索增强生成 | 12 | [Memory](/manual/llm/bit-to-agi/12-future/memory) |
| ReLU | 修正线性单元 | 4 | [ReLU 为什么成功](/manual/llm/bit-to-agi/04-neural-networks/why-relu-wins) |
| RLHF | 人类反馈强化学习 | 7 | [什么是 RLHF](/manual/llm/bit-to-agi/07-training/what-is-rlhf) |
| RNN | 循环神经网络 | 4 | [RNN 为什么消失](/manual/llm/bit-to-agi/04-neural-networks/why-rnn-vanishes) |
| RoPE | 旋转位置编码 | 5 | [位置编码变体](/manual/llm/bit-to-agi/05-transformer/positional-encoding-variants) |
| SFT | 监督微调 | 7 | [什么是 SFT](/manual/llm/bit-to-agi/07-training/what-is-sft) |
| SIMD | 单指令多数据 | 1 | [SIMD 是什么](/manual/llm/bit-to-agi/01-bits/what-is-simd) |
| SM | 流式多处理器 | 9 | [SM 是什么](/manual/llm/bit-to-agi/09-gpu/what-is-sm) |
| TP | 张量并行 | 8 | [张量并行](/manual/llm/bit-to-agi/08-inference/tensor-parallel) |
| TTFT | 首 Token 时间 | 8 | [延迟与吞吐](/manual/llm/bit-to-agi/08-inference/latency-vs-throughput) |
| UTF-8 | 万国码字节编码 | 1 | [文字为什么最后都是 UTF-8](/manual/llm/bit-to-agi/01-bits/why-text-is-utf8) |
| VRAM | 显存 | 9 | [为什么显存这么重要](/manual/llm/bit-to-agi/09-gpu/why-vram-matters) |

---

## 全书叙事锚点（跨章高频）

这些概念在多个章节反复出现，串起来即「从 Bit 到 AGI」的主线：

| 概念 | 出现章节 | 建议起点 |
| ---- | -------- | -------- |
| 比特 → 浮点 → 矩阵 | 1 → 2 → 5 | [为什么 AI 最后只是比特](/manual/llm/bit-to-agi/01-bits/why-ai-is-bits) |
| 熵 → 交叉熵 → 预训练 | 3 → 7 | [交叉熵是什么](/manual/llm/bit-to-agi/03-information/cross-entropy) |
| 神经元 → Attention → Transformer | 4 → 5 | [Attention 为什么出现](/manual/llm/bit-to-agi/04-neural-networks/why-attention-emerged) |
| Token → Embedding → 计费 | 6 → 5 → 11 | [Token 是什么](/manual/llm/bit-to-agi/06-tokenizer/what-is-token) |
| 预训练 → SFT → 对齐 | 7 | [什么是预训练](/manual/llm/bit-to-agi/07-training/what-is-pretraining) |
| KV Cache → PagedAttention → Serving | 8 → 11 | [KV Cache 是什么](/manual/llm/bit-to-agi/08-inference/what-is-kv-cache) |
| 显存 → 带宽 → 成本 | 9 → 10 → 11 | [为什么显存这么重要](/manual/llm/bit-to-agi/09-gpu/why-vram-matters) |
| Agent → Tool → MCP | 10 → 12 | [Agent 是什么](/manual/llm/bit-to-agi/12-future/what-is-agent) |

---

## 小结

本页收录专栏 **约 120 条**核心术语，覆盖十二阶段从比特到 AGI 的完整词汇表。遇到陌生缩写，先查上文 **A–Z 表**；想系统复习，按章节表跳转原文。

全书在此收束。若你准备动手，回到 [第十章](/manual/llm/bit-to-agi/10-train-your-llm) 与 [第十一章](/manual/llm/bit-to-agi/11-engineering) 部署；若你关心能力边界，重读 [第十二章总结](/manual/llm/bit-to-agi/12-future/chapter-summary)。
