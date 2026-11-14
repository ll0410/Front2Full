---
title: "模型与推理"
description: "可用模型与默认模型、切换方式、推理强度等参数、Fast 模式、自定义模型提供方、本地模型、Google Cloud Vertex AI、Amazon Bedrock，以及计费与额度"
source: "https://daiw.org/manual/codex/models"
---

# 模型与推理

> 可用模型与默认模型、切换方式、推理强度等参数、Fast 模式、自定义模型提供方、本地模型、Google Cloud Vertex AI、Amazon Bedrock，以及计费与额度

## 可用模型

用 ChatGPT 账号登录时，推荐使用下列模型（以 v0.167.0 随附模型目录与官方文档为准；服务端可能因套餐、地区或工作区策略调整可用列表）：

| 模型 | 定位 | 默认推理强度 | 可选推理强度 |
| --- | --- | --- | --- |
| `gpt-6.1-sol` | 当前默认主力模型，适合日常编码与复杂 agent 工作流 | `low` | `low` 至 `ultra` |
| `gpt-6-astra` | 前沿高阶智能，适合跨代码、应用与研究的高难度端到端任务 | `low` | `low` 至 `ultra` |
| `gpt-6.1-terra` | v0.165.0 新增的 GPT-6.1 Terra 模型（基础上下文窗口 500K，上限 872K） | `low` | `low` 至 `ultra` |
| `gpt-6-sol` | 日常主力，适合复杂编码与 agent 工作流；官方建议从 `medium` 起步 | `medium` | `low` 至 `ultra` |
| `gpt-6-luna` | 快且省，适合摘要、抽取、目标明确的编码等高频任务；官方建议从 `high` 起步 | `medium` | `low` 至 `max` |
| `gpt-5.6-sol` | 上一代 Sol，适合复杂、开放式问题 | `low` | `low` 至 `ultra` |
| `gpt-5.6-terra` | 上一代的均衡模型 | `medium` | `low` 至 `ultra` |
| `gpt-5.6-luna` | 上一代的快速模型 | `medium` | `low` 至 `max` |
| `gpt-5.5` | 早期编码模型，已于 2026 年 10 月 14 日从 ChatGPT 登录的 Codex 中下线（API Key 仍可用） | `medium` | `low` 至 `xhigh` |

档位从低到高依次为 `low`、`medium`、`high`、`xhigh`、`max`、`ultra`。

- 未设置 `model` 时，Codex 使用模型目录标记的默认模型；v0.159.1 / v0.161.0 起随附目录与 Amazon Bedrock Mantle / Runtime 目录的默认模型为 `gpt-6.1-sol`（v0.165.0 新增的内置 Google Cloud Vertex AI 提供方默认也是 `gpt-6.1-sol`）。v0.165.0–v0.166.0 起，各大目录新增 `gpt-6.1-terra`，其基础上下文窗口达 500K token（其余 GPT-6 与 GPT-5.6 模型基础上下文窗口为 272K token，扩展上限同为 872K token）。目录会按登录方式、套餐和提供方刷新，实际可用列表与默认值以 `/model` 为准。`codex debug models` 可以打印完整目录，加 `--bundled` 只看随附目录。
- GPT-6 Sol 与 GPT-6 Luna 自 2026 年 9 月 22 日起逐步推出，token 价格低于对应的 GPT-5.6 模型，面向 Plus、Pro、Business、Enterprise 与 Edu 开放（Free 与 Go 只能在桌面应用中使用 Luna），Enterprise 需要管理员先启用。CLI 从 v0.156.1 起收录这两个模型。推出期间 GPT-5.6 的三个模型仍然可用，但随附目录会在你选用 `gpt-5.6-sol`、`gpt-5.6-terra` 时提示迁移到 `gpt-6-sol`，选用 `gpt-5.6-luna` 时提示迁移到 `gpt-6-luna`。
- GPT-5.5 已于 2026 年 10 月 14 日从 ChatGPT、ChatGPT Work 与 Codex 的所有套餐中下线，OpenAI API 不受影响。用 ChatGPT 登录的，官方建议 Plus、Pro、Business、Enterprise 与 Edu 在可用时换成 `gpt-6.1-sol` 或 `gpt-6-sol`，Free 与 Go 在桌面应用中换成 `gpt-6-luna`；保存的模型设置、托管配置、自定义 agent、定时任务和脚本里的都要改。v0.167.0 随附的目录里 `gpt-5.5` 仍作为 API 兼容项保留（优先级排在末尾），选用时会提示迁移。
- 面向受授权网络安全研究与防御工作的 **Daybreak** 专项模型（`gpt-daybreak-blue-latest` 与 `gpt-daybreak-red-latest`）默认隐藏在常规列表中：v0.163.0 起符合条件的账号默认开启 `features.cli_daybreak = true`，可在 TUI 中用 `/daybreak` 开关，或在非交互模式中用 `codex exec --cyber-access-program <standard|daybreak_blue|daybreak_red>` 按轮次指定（见[斜杠命令](/manual/agent/codex/slash-commands)与[非交互执行](/manual/agent/codex/exec)）。
- GPT-5.4 与 GPT-5.4 mini 已于 2026 年 8 月 31 日从 ChatGPT 登录的 Codex 中下线，官方建议在套餐与客户端可用时分别换成 `gpt-6-sol` 与 `gpt-6-luna`（Enterprise 与 Edu 需要管理员先启用 Luna）；v0.156.1 起，设置里仍是 `gpt-5.4` 或 `gpt-5.4-mini` 时，CLI 也会按这个对应关系提示迁移。v0.158.0 起随附目录（包括 Amazon Bedrock 的目录）删去了 GPT-5.4，迁移提示照旧保留，Bedrock 上的 `openai.gpt-5.4` 会提示换成 `openai.gpt-6-sol`；当前目录里已经没有旧模型时，提示里没有“继续使用旧模型”这一项。这类兜底提示只对模型所属的内置提供方（`openai`、`amazon-bedrock`）生效，自定义提供方里的同名模型不受影响。`gpt-5.2`、`gpt-5.3-codex` 同样已经弃用。官方说明 OpenAI API 与使用自己 API Key 的 Codex 不受这次下线影响。
- 也可以接入任何支持 Responses API 的模型与提供方，见下文“自定义模型提供方”。

## 切换模型

| 方式 | 示例 | 作用范围 |
| --- | --- | --- |
| 启动参数 | `codex -m gpt-6-sol`，或 `codex exec -m gpt-6-luna "..."` | 本次运行 |
| 斜杠命令 | `/model` | 会话中选择模型与推理强度：按 `Enter` 同时保存为默认值，按 `s` 只用于当前会话；v0.164.0 起还支持直接在 `/model` 后传入模型、推理强度与速度参数 |
| 配置文件 | `model = "gpt-6-sol"` | 默认值 |
| profile | 在 `~/.codex/<name>.config.toml` 中写 `model` | 用 `--profile` 选中时 |

`/review` 使用的模型可以单独用 `review_model` 指定，默认与当前会话相同。

## 推理强度与相关参数

推理强度越高，复杂任务的效果通常越好，但更慢、消耗也更多。官方建议从默认强度起步，任务需要更深入的规划与分析时再调高。

```toml
model_reasoning_effort = "high"       # 可用档位取决于模型
plan_mode_reasoning_effort = "xhigh"  # 计划模式单独设置
model_reasoning_summary = "concise"   # auto / concise / detailed / none
model_verbosity = "low"               # low / medium / high
```

| 档位 | 适用场景 |
| --- | --- |
| `low`、`medium` | 范围明确的快速任务；需要一定规划的任务 |
| `high`、`xhigh` | 多步骤、多来源、需要权衡的困难任务 |
| `max` | 给单个任务更长的推理时间，用于高难度问题 |
| `ultra` | 深度推理并自动把任务拆给[子代理](/manual/agent/codex/subagents)并行处理 |

会话中除了 `/model`，还可以按 `Alt+.`、`Alt+,`（或 `Shift+Up`、`Shift+Down`）在当前模型支持的档位间逐级调高、调低，只对当前会话生效；v0.158.0 起可以一直调到 `max`，`ultra` 仍要在 `/model` 选中模型后的 More reasoning… 里选择（`/model` 选择器把 `max` 与 `ultra` 都收在这一项里）。v0.165.0 起，特性开关 `reasoning_effort_override` 默认开启，在受支持的模型上中途调整推理强度会向后续请求追加受信任的配置项并立即生效。

源码还接受 `none`、`minimal` 以及其他任意非空的自定义取值，但实际可选的档位以模型目录为准（见上表）；v0.158.0 起，纯数字的自定义取值（如 `model_reasoning_effort = "64"`）会以 JSON 数字而不是字符串发送给服务端。与推理输出相关的还有 `hide_agent_reasoning`（隐藏推理事件，适合 CI 日志）和 `show_raw_agent_reasoning`（显示模型输出的原始推理内容）。

沟通风格 `personality` 已在 v0.156.0 退役：`friendly`、`pragmatic` 不再改变回复风格，`/personality` 命令与同名功能开关也一并移除；只有 `personality = "none"` 仍有作用，它会去掉模型指令里的 Personality 小节。官方的 CLI 命令文档目前仍列着 `/personality`。

`model_reasoning_summary` 决定是否返回推理摘要。v0.155.0 起 TUI 会在状态行实时显示推理摘要，但随附模型目录的默认值都是 `none`，本地 TUI 新会话在没有设置时也按 `none` 请求，所以要看到它，需要把 `model_reasoning_summary` 设为 `auto`、`concise` 或 `detailed`。v0.155.0 曾让本地 TUI 新会话默认按 `detailed` 请求，不支持推理摘要的提供方因此报错，v0.155.1 改了回来。

## 速度：Fast 模式

Fast 模式以更高的额度消耗换取速度：GPT-5.6、GPT-5.5、GPT-5.4 提速 1.5 倍，其中 GPT-5.6 与 GPT-5.5 按标准费率的 2.5 倍消耗额度，GPT-5.4 为 2 倍；按官方 Speed 页，GPT-6 Astra、GPT-6.1 Sol、GPT-6 Sol 与 GPT-6 Luna 的 Fast 模式同样按 2.5 倍计（随附目录里 `gpt-6-astra` 与 `gpt-6.1-sol` 的 Fast 档位标注为“2x speed, increased usage”，`gpt-6.1-terra`、`gpt-6-sol` 与 `gpt-6-luna` 标注为“1.5x speed”）。它是 ChatGPT 额度功能，只在用 ChatGPT 登录时可用；用 API Key 时按 API 价格计费（API 的 Priority 处理对 GPT-5.6 是标准价的 2 倍）。

- 会话中输入 `/fast` 切换，或通过 `/model` 行内参数指定速度。这个命令根据当前模型在目录中声明的服务档位生成，模型不支持时不会出现。`/fast` 不接受参数，每次输入都在开、关之间切换；官方 Speed 页写的 `/fast on`、`/fast off`、`/fast status` 并不存在。随附 OpenAI 目录里的模型不提供 Ultrafast 档位，但 Amazon Bedrock 上的 `openai.gpt-6-astra`（v0.162.0 起）与 `openai.gpt-6.1-sol`（v0.163.0 起）支持 `Ultrafast`（`ultrafast`）服务档位。
- 设为默认：`service_tier = "fast"`，并保持 `[features]` 中的 `fast_mode = true`（默认即开启；Ultrafast 对应 `ultrafast_mode = true`，同样默认开启）。`service_tier` 也接受 `priority`、`ultrafast`、`flex` 与 `default`。v0.158.0 起，使用 `flex` 时如果服务端报告 Flex 容量不足，这一轮会直接以 “Flex capacity unavailable.” 结束，不再自动重试。
- v0.158.0 曾把 `gpt-6-sol` 与 `gpt-6-luna` 的目录默认档位标为 Fast，v0.161.0 起的随附目录已将各模型的 `default_service_tier` 恢复为空（默认按标准速度请求），需要加速时可显式开启 `/fast` 或设置 `service_tier = "fast"`。

此前官方文档还介绍过 GPT-5.3-Codex-Spark：一个面向近乎实时编码迭代、仅 ChatGPT Pro 可用的独立研究预览模型，而不是加速选项。官方更新日志显示它已于 2026 年 9 月 14 日弃用，桌面应用、CLI 与 IDE 扩展都不能再选用，配置、自定义 agent 与脚本里的 `gpt-5.3-codex-spark` 需要换掉；想要更快的响应，请用受支持模型的 Fast 模式。

## 自定义模型提供方

只想让内置的 OpenAI 提供方走代理、路由或数据驻留端点时，不必新建提供方，设 `openai_base_url` 即可：

```toml
openai_base_url = "https://us.api.openai.com/v1"
```

接入其他兼容 Responses API 的服务，则在 `model_providers` 中定义提供方，再用 `model_provider` 指向它：

```toml [~/.codex/config.toml]
model = "gpt-6-sol"
model_provider = "proxy"

[model_providers.proxy]
name = "OpenAI via LLM proxy"
base_url = "https://proxy.example.com/v1"
env_key = "OPENAI_API_KEY"          # 从该环境变量读取 API Key
http_headers = { "X-Team" = "infra" }
request_max_retries = 4             # 默认 4
stream_idle_timeout_ms = 300000     # 默认 300000

[model_providers.azure]
name = "Azure"
base_url = "https://YOUR_PROJECT_NAME.openai.azure.com/openai"
env_key = "AZURE_OPENAI_API_KEY"
query_params = { api-version = "2025-04-01-preview" }
```

- `wire_api` 只支持 `responses`（也是默认值）。v0.158.0 中写 `wire_api = "chat"` 会直接报错，Chat Completions 已不再支持；旧的 `ollama-chat` 提供方也已移除，请改用 `ollama`。
- `openai`、`ollama`、`lmstudio` 是保留 ID，不能拿来定义自定义提供方；要改 OpenAI 的推理地址请用 `openai_base_url`（v0.166.0 起允许在 `[model_providers.openai]` 下单独设置 `model_catalog_url`，但必须使用 HTTPS 与受信任的 ChatGPT 主机名）。`gcp`、`amazon-bedrock`、`amazon-bedrock-runtime` 也是内置 ID，只能改动下文对应小节列出的字段。
- v0.162.0 起，自定义提供方可在 `[model_providers.<id>.capabilities]` 下显式声明可选协议能力：`external_web_access = true`（托管网页搜索是否可访问实时网页）、`remote_compaction = "v2"`（或 `"unsupported"`，控制是否走 Responses 端点的远端上下文压缩协议）以及 `cyber_access_programs = true`（是否转发 `access_programs.cyber` 选择）。
- v0.158.0 起，请求或流式响应失败后重试时，如果服务端给出了 `Retry-After`（秒数或 HTTP 日期），Codex 会等到它指定的时间再重试（v0.162.0 起 WebSocket 握手与回退重试同样遵循服务端的 `Retry-After` 指示），没有时才用本地的指数退避；v0.165.0 起，若提供方明确返回“模型不存在”（model not found），会立即停止重试并原样保留报错信息；重试次数仍由 `request_max_retries`、`stream_max_retries` 决定。
- 需要从外部凭证助手获取 token 时，在 `[model_providers.<id>.auth]` 中配置 `command`、`args`、`timeout_ms`（默认 5000）、`refresh_interval_ms`（默认 300000）。它不能与 `env_key`、`experimental_bearer_token`、`requires_openai_auth` 同时使用。
- `model_provider`、`model_providers` 写在项目配置中会被忽略，请放在用户级或系统级配置里。v0.156.0 起，组织还可以在 `requirements.toml` 里用同名的两个键强制指定提供方：要求的选择优先于本地与会话设置，要求中的提供方定义会整体替换本地的同名条目，包括其中的认证与请求头。
- v0.156.0 起可以用 `model_catalog_url` 指定 Codex 格式模型目录的完整地址，与推理端点分开托管；Codex 获取目录时会带上该提供方的认证、请求头与查询参数，不跟随重定向。v0.161.0 起 `api_key_model_discovery` 已转为稳定并默认开启，API Key 认证下也会正常拉取目录；v0.166.0 起移除了显式模型目录响应的 1 MiB 体积限制。
- 提供方前面还有一层要求单独登录的网关时，v0.156.0 起可以配置 `gateway_oauth`：需要网关凭据而本地没有时，Codex 自动打开浏览器完成 OAuth（PKCE）登录，把 token 按 `delivery` 放进指定的请求头或 cookie，与主认证一起发送；凭据单独保存（v0.167.0 起支持设置 `credentials_store = "file" | "keyring" | "auto"` 选择文件或系统钥匙串存储），过期或被拒绝后自动刷新。

```toml
[model_providers.corp.gateway_oauth]
authorization_url = "https://sso.example.com/oauth2/authorize"
token_url = "https://sso.example.com/oauth2/token"
client_id = "codex-cli"
scopes = ["llm.invoke"]
delivery = { kind = "header", name = "X-Gateway-Authorization" }   # scheme 默认 Bearer；也可以写 kind = "cookie"
```

## 本地模型：`--oss`

`--oss` 让 Codex 使用本机运行的开源模型服务，内置 Ollama 与 LM Studio 两种：

```bash
codex --oss                                  # 未配置默认提供方时交互式选择
codex --oss --local-provider ollama
codex exec --oss --local-provider lmstudio "explain this repo"
```

```toml
oss_provider = "ollama"   # --oss 的默认本地提供方：ollama / lmstudio
```

| 提供方 | 默认地址 | 未指定 `-m` 时的默认模型 |
| --- | --- | --- |
| Ollama | `http://localhost:11434/v1` | `gpt-oss:20b` |
| LM Studio | `http://localhost:1234/v1` | `openai/gpt-oss-20b` |

- 既没有 `--local-provider` 也没有 `oss_provider` 时，交互模式会让你选择，`codex exec` 则直接报错退出。
- 使用 Ollama 时，所选模型（`-m` 指定的模型，未指定时为默认模型）若本地尚未下载，Codex 会自动拉取。
- 端口或地址不同时，可用实验性环境变量 `CODEX_OSS_PORT` 或 `CODEX_OSS_BASE_URL` 覆盖。

## Google Cloud Vertex AI

v0.165.0 起新增内置的 `gcp` 提供方，直接调用 Google Cloud Vertex AI 上的 OpenAI 兼容 Responses 端点（`https://aiplatform.googleapis.com/v1/projects/<project>/locations/<location>/publishers/openai/v1`），无需 ChatGPT 登录或 `OPENAI_API_KEY`：

```toml
model_provider = "gcp"
model = "gpt-6.1-sol"                      # 可省略，默认即 gpt-6.1-sol

[model_providers.gcp]
project_id = "my-gcp-project"              # 省略则读取环境变量 GOOGLE_CLOUD_PROJECT
location = "global"                        # 省略则读取 GOOGLE_CLOUD_LOCATION，默认 global
credential_file = "/abs/path/to/adc.json"  # 可选（v0.166.0 起），要求绝对路径
```

- **可用模型**：内置目录包含 `gpt-6.1-sol`（默认）、`gpt-6-astra`、`gpt-6.1-terra`（v0.166.0 加入）与 `gpt-6-luna`。
- **认证方式**：未显式配置 `[model_providers.gcp.auth]` 时，默认调用本机的 `gcloud auth application-default print-access-token`（Windows 上为 `gcloud.cmd`）获取 Application Default Credentials（ADC）访问令牌；若配置了 `credential_file`，会在执行认证命令时通过 `GOOGLE_APPLICATION_CREDENTIALS` 传入该凭据文件。v0.167.0 起，启用 `features.gcp_setup_wizard = true` 后，还可以在 TUI 登录界面的“Sign in another way”下通过交互式向导完成 Vertex AI 配置。

## Amazon Bedrock

内置的 `amazon-bedrock` 提供方通过 AWS 原生认证调用 Bedrock 上的 OpenAI 模型，不需要 ChatGPT 登录或 `OPENAI_API_KEY`（v0.164.0 起 TUI 登录向导 `bedrock_setup_wizard` 默认开启，可在登录界面的“Sign in another way”中交互式配置）：

```toml
model_provider = "amazon-bedrock"
model = "openai.gpt-6.1-sol"     # 可省略，v0.159.1 / v0.161.0 起默认就是它

[model_providers.amazon-bedrock.aws]
profile = "codex-bedrock"        # 省略则使用 AWS 标准凭证链
region = "us-east-2"
```

认证时先尝试 Bedrock API Key（环境变量 `AWS_BEARER_TOKEN_BEDROCK`，此时必须用 `AWS_REGION` 等指定区域），再尝试 AWS SDK 凭证链（`aws configure`、`AWS_PROFILE`、SSO 等）。`amazon-bedrock` 走区域内推理的 Bedrock Mantle 端点（`https://bedrock-mantle.<区域>.api.aws/openai/v1`），模型 ID 按优先级依次为 `openai.gpt-6.1-sol`（默认）、`openai.gpt-6-astra`、`openai.gpt-6.1-terra`（v0.166.0 加入）、`openai.gpt-6-sol`、`openai.gpt-6-luna`、`openai.gpt-5.6-sol`、`openai.gpt-5.6-terra`、`openai.gpt-5.6-luna`、`openai.gpt-5.5`。要跨区域推理，改用另一个内置提供方 `model_provider = "amazon-bedrock-runtime"`：它走 Bedrock Runtime 端点（`https://bedrock-runtime.<区域>.amazonaws.com/openai/v1`），模型 ID 带 `global.` 或 `us.` 前缀（如 `global.openai.gpt-6.1-sol`，没有 GPT-5.5），默认的 GPT-6.1 Sol 优先用 `global.` 路由。

v0.161.0 起，Amazon Bedrock 在兼容模型上支持多代理 V2（`multi_agent_v2`）与 `ultra` 推理强度，且 Bedrock Mantle 原生支持 AWS GovCloud 区域（如 `us-gov-west-1`、`us-gov-east-1`；GovCloud 端点的默认目录包含 `openai.gpt-5.6-terra` 与 `openai.gpt-5.6-luna`，默认模型为 `openai.gpt-5.6-terra`）。v0.162.0 与 v0.163.0 起，Bedrock 上的 `openai.gpt-6-astra` 与 `openai.gpt-6.1-sol`（含 Runtime 的 `global.` 与 `us.` 路由）开放了 `Ultrafast`（`ultrafast`）服务档位。这两个内置提供方都只允许修改 `base_url`、`auth`、`http_headers` 以及 `aws` 下的 `profile`、`region`、`credential_export`（v0.155.0 起）、`auth_refresh`。配置完成后，在 CLI 中用 `/status` 确认当前使用的提供方。

凭据由公司的凭据工具发放时，v0.155.0 起可以让 Codex 调用外部命令导出 AWS 凭据：

```toml
[model_providers.amazon-bedrock.aws]
region = "us-east-2"

[model_providers.amazon-bedrock.aws.credential_export]
command = "/usr/local/bin/export-bedrock-credentials"   # 绝对路径或 PATH 中的命令名，不经过 shell
args = ["--role", "codex"]
timeout_ms = 30000                                      # 默认 30000
```

- 命令要在 stdout 输出 JSON，字段为 `AccessKeyId`、`SecretAccessKey`，以及可选的 `SessionToken`、`Expiration`（RFC 3339 时间）；AWS `credential_process` 的扁平格式和 STS 返回的、包在 `Credentials` 里的格式都可以，输出不能超过 64 KiB。
- 凭据只缓存在内存里：有 `Expiration` 时提前 5 分钟重新导出，没有时每小时导出一次。遇到可恢复的认证失败时，先运行 `aws.auth_refresh`（如果配置了）再重新导出。
- 配置了 `credential_export` 后，它优先于 Bedrock API Key 环境变量、AWS 凭据环境变量与 SDK 凭证链，只有 `auth` 命令比它更优先；它不能与 `aws.profile` 同时配置。

## 计费与额度

用量从哪里扣，取决于登录方式：

| 登录方式 | 适用范围 | 计费 |
| --- | --- | --- |
| ChatGPT 账号 | Free、Go、Plus、Pro、Business、Enterprise / Edu 各套餐 | 使用套餐内额度，用完后可用 ChatGPT credits 继续 |
| API Key | CLI、SDK、IDE 扩展，没有 GitHub 代码审查、Slack 等云端功能 | 按 API 标准价格计费，可用模型取决于 Key |

- 价格参考（以官网为准）：Go 每月 8 美元，Plus 每月 20 美元，Pro 每月 100 美元起（额度为 Plus 的 5 倍或 20 倍），Business 年付每人每月 20 美元（月付 25 美元）。
- v0.158.0 起 CLI 识别 Pro Max 套餐，`/status` 与用量分析面板把三档 Pro 分别显示为 Pro（`prolite`）、Pro (More)（`pro`）与 Pro (Max)（`promax`）。
- 额度按 5 小时窗口计算，另可能有每周上限。消耗取决于模型、任务规模与上下文，而不只是提示长度。以 Plus 为例，每 5 小时本地消息的估算范围是：GPT-6 Astra 5～45 条，GPT-6 Sol 15～150 条，GPT-6 Luna 350～3,000 条，GPT-5.6 Sol 10～100 条，GPT-5.6 Terra 25～200 条，GPT-5.6 Luna 250～2,000 条。
- 本地会话与云端任务共享额度；Fast 模式、图片生成会更快消耗额度。
- 达到上限时，正在进行的回合仍可完成；Plus 与各档 Pro 可以购买额外 credits，也可以换用更小的模型，或改用 API Key 按量付费。
- 在 CLI 中用 `/status` 查看剩余额度；v0.156.0 起 `/usage` 的 View analytics 会打开全屏的用量分析面板，按天、按周查看 token 用量与常用的插件和技能。额度快用完时，提醒会固定显示在输入框上方。
