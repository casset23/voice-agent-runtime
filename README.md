# Co-Agent · 智能音箱 Agent 后端

面向智能音箱文字指令的多语言服务项目：**Rust Gateway → Python LLM Runner → 工具服务**，配套 NestJS/SQLite 资源中心与 React 管理台。

**Rust · Axum · Tokio · Python · FastAPI · TypeScript · NestJS · SQLite · React**

[![CI](https://github.com/casset23/voice-agent-runtime/actions/workflows/ci.yml/badge.svg)](https://github.com/casset23/voice-agent-runtime/actions/workflows/ci.yml)

> 本仓库基于已有智能音箱项目源码整理，保留原服务结构与核心业务实现。公开版将硬编码凭据改为环境变量，替换内网地址和公司品牌、镜像路径，并排除内部数据与非项目材料。具体范围见 [公开版说明](docs/PUBLIC_RELEASE.md)。

## 业务场景

用户说“现在几点”“明天天气怎么样”或提出播放请求，上游完成语音识别后，把文字、会话 ID 和上下文提交给 Gateway。LLM Runner 根据工具定义识别意图，Gateway 调用对应微服务，返回结构化结果和可播报文本。

本仓库覆盖音箱的 Agent 后端；唤醒词、麦克风采集、ASR/TTS 和硬件播放驱动位于上游或设备侧。音乐和内容服务返回播放命令，不直接播放真实音频。

```mermaid
sequenceDiagram
  participant D as 设备 / 文本客户端
  participant G as Rust Gateway
  participant L as Python LLM Runner
  participant R as 资源中心
  participant T as 工具服务
  L->>R: 拉取模型和工具配置
  D->>G: text + session_id + metadata
  G->>L: POST /v1/intent
  L-->>G: 工具名称、类别和参数
  G->>T: POST /v1/invoke/{category}
  T-->>G: 结构化结果 + 播报文本 / 命令
  G-->>D: 聚合响应
```

## 代码看点

| 模块 | 实现内容 | 阅读入口 |
| --- | --- | --- |
| Agent Gateway | 请求头检查、Request ID、LLM 调度、工具结果聚合、下游 HTTP 超时 | `app/agent-gateway/src/intent.rs`、`client.rs`、`middleware.rs` |
| LLM Runner | OpenAI-compatible 模型接入、Function Calling 解析、模型与工具配置热刷新 | `app/llm-runner/app/main.py`、`app/llm-runner/app/llm/client.py` |
| Resource Registry | 模型/工具 CRUD、启用状态、模型健康与延迟记录、Runner 配置分发 | `app/resource-registry/src/LLM/`、`src/tools/`、`src/db/` |
| Dashboard | 模型与工具管理、JSON Schema 编辑、健康状态展示 | `app/dashboard/src/pages/` |
| 天气 / 日期时间 | 实时、预报、逐小时天气；时区、日期与节假日查询 | `tools/tool-weather/`、`tools/tool-datetime/` |
| 音乐 / 内容 | 将播放意图转换为结构化设备命令 | `tools/tool-music/`、`tools/tool-content/` |
| Auth | 认证服务入口和接口骨架 | `app/auth/`，当前尚未完成令牌签发与校验 |

Gateway 当前只检查 Authorization 和设备标识请求头是否存在，不验证 Token 的真实性。`AtomicUsize` 用于忙碌计数；达到 1000 后最多等待 30 秒再返回 429，它不是严格的分布式限流器或完成压测的吞吐保证。管理首页部分图表采用演示数据，不能当作真实监控结果。

## 运行环境与端口

- Python **3.12+**：原工具模型采用泛型类新语法。
- Rust stable，支持 **Edition 2024**。
- Node.js 22+、pnpm 10，SQLite 为本地文件。

| 服务 | 端口 | 入口 |
| --- | ---: | --- |
| Gateway | 30010 | `/health`、`/v1/intent`、`/openapi.json` |
| LLM Runner | 30011 | `/health`、`/v1/intent`、`/v1/reload` |
| Dashboard | 30012 | 浏览器页面 |
| Registry | 30013（通过 PORT 设置） | `/health`、`/admin/api/tools`、`/admin/api/llms` |
| Weather / DateTime / Music / Content | 30014 / 30015 / 30016 / 30017 | `/health`、`/v1/invoke/{category}` |

## 本地启动

建议先运行 Registry、时间工具和 Runner，再启动 Gateway 和 Dashboard。每个 Python 服务使用独立环境，可在对应目录运行 `uv sync` 后执行 `uv run python -m uvicorn ...`。下面以已安装依赖的终端为例。

Registry：

```powershell
cd app/resource-registry
pnpm install --frozen-lockfile
$env:PORT = "30013"
pnpm start:dev
```

LLM Runner（另开终端）：

```powershell
cd app/llm-runner
uv sync
$env:RESOURCE_REGISTRY_BASE_URL = "http://127.0.0.1:30013"
$env:ARK_API_KEY = "你的本地模型密钥"
uv run python -m uvicorn app.main:app --host 127.0.0.1 --port 30011
```

默认模型名称沿用源码配置。也可以在管理台添加可用模型，再通过 `POST /v1/reload` 刷新 Runner 配置。没有可用密钥时，健康接口可用，真实意图请求会失败；公开版不提供可工作的共享密钥。

日期时间工具：

```powershell
cd tools/tool-datetime
uv sync
uv run python -m uvicorn app.main:app --host 127.0.0.1 --port 30015
```

Gateway：

```powershell
cd app/agent-gateway
cargo run
```

Dashboard：

```powershell
cd app/dashboard
pnpm install --frozen-lockfile
pnpm dev
```

其他工具按上表端口启动：天气使用 `app.main:app`，音乐和内容使用 `main:app`。天气服务需在本地设置 `SENIVERSE_API_KEY`。

`.env.example` 是配置变量清单，默认不会被所有服务自动加载。使用环境变量，或由自己的启动脚本加载配置。历史 `Makefile`、统一 YAML、Docker/Kubernetes 文件仍需按实际环境核对，本 README 的直接启动步骤优先。

## 请求示例

```http
POST http://127.0.0.1:30010/v1/intent
Authorization: Bearer local-development-placeholder
X-Device-ID: demo-device
Content-Type: application/json
```

```json
{
  "text": "现在几点",
  "session_id": "demo-session",
  "metadata": {
    "time_zone": "Asia/Shanghai",
    "language": "zh-CN",
    "platform": "demo-speaker-v1"
  }
}
```

公司品牌设备请求头在公开版统一改为 `X-Device-ID`，客户端需要使用该名称。服务结构和业务逻辑保持原实现，没有换成单进程规则演示。

## 检查与已知边界

```bash
python -m pip install -r requirements-public-check.txt
python -m unittest discover -s tests -v
python -m compileall -q app/llm-runner tools
# app/dashboard: pnpm run build
# app/resource-registry: pnpm run build && pnpm exec jest --runInBand
# app/agent-gateway: cargo check --locked
```

新增检查针对原服务：环境变量配置、Runner 的工具名与参数映射、输入校验、模型失败响应、时间工具接口，以及公开文件扫描。测试中的模型调用使用替身，不消耗真实模型服务。

真实模型效果、天气 API、音箱设备以及全链路部署尚未完成本次运行验证。管理和 Runner 配置接口没有完整鉴权，模型 Key 会持久化在本地 SQLite 中并提供给 Runner；当前仅在可信本地环境运行。公开源码脱敏不等同于生产安全加固。

不提供未经测量的 QPS、P95、准确率或线上收益数据。
