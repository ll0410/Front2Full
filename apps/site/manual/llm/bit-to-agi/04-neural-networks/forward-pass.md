---
title: "前向传播是什么"
description: "从 Bit 到 AGI · 第四章：神经元（Neuron） · 前向传播是什么"
source: "https://daiw.org/manual/bit-to-agi/04-neural-networks/forward-pass"
---

# 前向传播是什么

> 从 Bit 到 AGI · 第四章：神经元（Neuron） · 前向传播是什么

前向传播（Forward Pass）是网络推理与训练的第一步：输入 $\mathbf{x}$ 从第一层流到最后一层，得到预测 $\hat{\mathbf{y}}$ 和损失 $L$。反向传播依赖前向时**缓存的中间值**（激活、预激活）。搞清前向，就搞清了「模型一次预测算了什么」。

## 直觉

工厂流水线只开正向传送带：原料进、各工序加工、成品出。每层把上一层的产物当输入；最后一层产出「与标准答案比一比」的分数（损失）。训练时这条带还要在每一站**复印一份质检单**（缓存），供反向传播查。

## 定义

对层 $l = 1,\ldots,L$：

$$
\mathbf{z}^{(l)} = \mathbf{W}^{(l)} \mathbf{h}^{(l-1)} + \mathbf{b}^{(l)}, \quad
\mathbf{h}^{(l)} = f^{(l)}(\mathbf{z}^{(l)}), \quad \mathbf{h}^{(0)}=\mathbf{x}
$$

输出 $\hat{\mathbf{y}} = \mathbf{h}^{(L)}$（或再经 softmax）。损失：

$$
L = \mathcal{L}(\hat{\mathbf{y}}, \mathbf{y})
$$

**批处理**：$X \in \mathbb{R}^{B \times d_0}$，一次算 $B$ 个样本；$\mathbf{W}^{(l)}$ 广播共享。

## 例子

**例 1：两层 MLP 手算**

```python
import numpy as np

def relu(z):
    return np.maximum(0, z)

x = np.array([1.0, 2.0])
W1 = np.array([[1.0, 0.0], [0.0, 1.0], [-1.0, 1.0]])
b1 = np.array([0.0, 0.0, 0.0])
W2 = np.array([[1.0, 1.0, -1.0]])
b2 = np.array([0.0])

z1 = W1 @ x + b1          # [1, 2, 1]
h1 = relu(z1)             # [1, 2, 1]
z2 = W2 @ h1 + b2         # [2]
y_hat = z2
print(f"z1={z1}, h1={h1}, ŷ={y_hat}")  # ŷ=[2]
```

**例 2：批前向**

```python
X = np.random.randn(32, 784)   # 32 张 MNIST 展平
W1 = np.random.randn(128, 784) * 0.01
# H1 = relu(X @ W1.T + b1)     # (32, 128)
```

**例 3：缓存结构（训练用）**

| 缓存名 | 内容 | 用途（反向） |
| ------ | ---- | ------------ |
| $z^{(l)}$ | 预激活 | 算 $f'(z)$ |
| $h^{(l)}$ | 激活值 | 算 $\partial L/\partial W$ |
| $h^{(l-1)}$ | 上一层输出 | 链式法则 |

## 量化

- **2 层 MLP** 784→128→10，单样本：MAC ≈ $784 \times 128 + 128 \times 10 \approx 101\text{K}$
- **批 32**：同一权重，MAC ×32；GPU 利用率高
- **ResNet-50 推理**：~4 GFLOPs/张 224×224 图（量级）
- **GPT-3 175B 生成 1 token**：~350 GFLOPs（全稠密估算，实际有 KV cache 优化）
- **内存**：推理 mainly 权重；训练还需存激活 → 约为推理激活内存的 **2～3×**（含梯度缓冲）

::: info

推理引擎（ONNX、TensorRT、vLLM）做算子融合：把「Linear + Bias + ReLU」合成一个 kernel，减少读写中间 $h$——前向逻辑不变，速度变快。

:::

## 常见误区

1. **「前向 = 推理，反向 = 训练」**——训练两次都要跑前向（算 $L$）；推理只跑前向。
2. **「softmax 在前向最后一步」**——数值稳定用 `log_softmax`；损失用 NLL 合并算。
3. **「Dropout 在前向随机丢神经元」**——仅训练时；推理时 scale 或关闭（见 [Dropout](/manual/llm/bit-to-agi/04-neural-networks/dropout)）。

## 动手试一试

完整前向 + MSE 损失：

```python
import numpy as np

def mlp_forward_with_cache(x, layers):
    cache = {'h': [x]}
    h = x
    for W, b in layers:
        z = W @ h + b
        h = np.maximum(0, z)
        cache['z'] = cache.get('z', []) + [z]
        cache['h'].append(h)
    return h, cache

W1 = np.array([[0.5], [-0.5]])
b1 = np.array([0.0, 0.0])
W2 = np.array([[1.0, -1.0]])
b2 = np.array([0.0])
y_true = np.array([1.0])

y_hat, _ = mlp_forward_with_cache(np.array([2.0]), [(W1, b1), (W2, b2)])
loss = 0.5 * (y_hat - y_true) ** 2
print(f"ŷ={y_hat}, loss={loss}")
```

## 计算图与自动微分

PyTorch 在前向时构建 **动态计算图**：每个 tensor 记录 `grad_fn`（谁生成了我）。`loss.backward()` 从 loss 节点沿图反向，对每个可微 op 应用链式法则——与你手写的 `dL_dW2 = dL_dy * h` 完全一致。

```python
# PyTorch 等价逻辑（示意）
# loss.backward()
# optimizer.step()
# optimizer.zero_grad()
```

`zero_grad()` 必须每步调用：梯度默认**累加**，不清零会污染下一步。

## 推理与 KV Cache（预告）

LLM **生成**时，每步只算新 token 的层输出；先前 token 的 $K,V$ 可缓存（KV cache），避免重复前向——这是推理加速的核心（第八章详述）。训练时整句并行前向，无此优化。

## 模块化前向：nn.Sequential 与 Hook

```python
# 逻辑结构
layers = [
    ("fc1", Linear(784, 256)), ("relu1", ReLU()),
    ("fc2", Linear(256, 10)),
]
# 前向: x -> fc1 -> relu1 -> fc2 -> logits
```

**Hook** 可在任意层插入探针，打印激活统计而不改代码——debug 死 ReLU、爆炸激活时有用。`register_forward_hook` 记录 $\min/\max/\mathrm{mean}(h)$ 每 epoch 变化。

**TorchScript / ONNX 导出** 要求前向图静态可追溯；动态控制流（Python if 依赖 tensor 值）会阻碍导出——LLM 推理服务需固定 shape 或 symbolic trace。

## 动手与阅读建议

建议对照 PyTorch 文档 `torch.nn` 模块，把本篇公式与 `Linear`、`ReLU`、`LSTM`、`MultiheadAttention` 的 `forward` 签名一一对应。读论文时先圈出 **张量 shape**（如 $(B, T, d)$）再读公式，比死记符号快得多。

若训练 loss 不降：先画 **train loss 曲线**（逐步、非 epoch 平均），看是震荡、plateau 还是 NaN。NaN 从 **lr 减半** 与 **gradient clip** 开始试；plateau 查 **wd 是否过大** 或 **数据是否标错**。验证集只用于 **选超参**，勿反复调 test。

本章内容在第五章 **Transformer** 会全部复现：QKV 是 Attention，FFN 是 MLP，Pre-LN 是 LayerNorm。掌握本章 = 读 GPT 论文的最低门槛。完成 MNIST 或 XOR 小实验（CPU 即可）再进入下一章，手感差异很大。

## 术语对照（中英）

Neuron/Unit 神经元；Activation 激活函数；Hidden layer 隐藏层；Logit 预激活 $z$；Embedding 把离散 id 映射为连续向量；Epoch 全数据扫一遍；Iteration/Step 一个 batch 更新一次；Learning rate 学习率 $\eta$；Weight decay 权重衰减（L2 或 AdamW）；Fine-tune 微调预训练权重。读英文文档时这些词与中文教材一一对应，避免混用「单元/神经元/节点」造成概念漂移。

## 算力与显存（复习）

参数量 $P$ 个 float32 权重约占 **$4P$ 字节**。训练显存粗估：**权重 + 梯度 + 优化器状态**（Adam 约 **$3\times$** 权重）+ **激活**（与 batch、序列长度、层数成正比）。推理 mainly **权重 + KV cache**（生成式 LLM）。先会估算 $P$ 和一次 forward 的 FLOPs，再读第九章 GPU 与第七章分布式，数字才能对齐。

下一篇链接在文末 **小结** 中；建议按 `meta.json` 顺序阅读，跳读易漏掉「RNN 消失 → LSTM → Attention」这条叙事链。遇到公式卡住，回第二章查 [链式法则](/manual/llm/bit-to-agi/02-math/chain-rule) 与 [softmax](/manual/llm/bit-to-agi/02-math/softmax-and-logits)。

**量化自检**：本篇至少包含两个带数字的例子（参数量、FLOPs、梯度量级或准确率）。复现时请用自己的随机种子跑代码，核对数量级一致即可，不必逐位相同——浮点顺序会导致末位差异。

写笔记时用一句话概括本篇核心定理或结论，便于复习。

推理时只做前向：ChatGPT 每生成一个 token，整网前向一次（有 KV cache 时部分层可复用）。

本章各篇互有引用，建议开侧边栏按顺序阅读，形成完整知识链。

前向输出的 logits 形状必须与标签 one-hot 或 class index 约定一致，否则 loss  silently 错。

## 小结

前向传播 = 逐层 **线性变换 + 激活**，得到 $\hat{\mathbf{y}}$ 与 $L$；训练时必须**缓存** $z,h$ 供反向使用。批处理、算子融合是工程加速手段，数学不变。

→ 下一篇：[反向传播是什么](/manual/llm/bit-to-agi/04-neural-networks/backward-pass)
