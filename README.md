![Co-Agent](docs/images/cover.svg)

# Co-Agent · 智能音箱 Agent 后端

围绕智能音箱文字指令构建的多服务后端：Rust Gateway 负责请求编排，Python LLM Runner 解析工具意图，NestJS/SQLite 资源中心管理模型与工具，React 控制台提供配置界面。

[![CI](https://github.com/casset23/voice-agent-runtime/actions/workflows/ci.yml/badge.svg)](https://github.com/casset23/voice-agent-runtime/actions/workflows/ci.yml)
![Rust](https://img.shields.io/badge/Rust-Axum_/_Tokio-7898ad?style=flat-square)
![Services](https://img.shields.io/badge/Python-NestJS_/_React-697c8e?style=flat-square)

[管理界面](#资源管理界面) · [服务架构](#服务架构) · [本地运行](#本地运行) · [配置热刷新](#模型配置与连接生命周期) · [验证](#测试与验证)

## 场景与实现范围

用户说“现在几点”“明天天气怎么样”或提出播放请求。上游把识别后的文字、会话 ID 与设备上下文送入 Gateway；Runner 通过 OpenAI-compatible Function Calling 生成工具调用，Gateway 分发到对应工具服务，再聚合结构化结果与播报文本。

本仓库保留已有 Co-Agent 项目的原服务结构与核心业务源码，公开整理中替换了公司品牌、内部地址和凭据，并补充回归修复。它覆盖音箱的 Agent 后端；唤醒词、麦克风、ASR/TTS 和硬件播放驱动位于上游或设备侧。

**Rust、Axum、Tokio、Python、FastAPI、TypeScript、NestJS、SQLite、React。** 公开范围与具体改动见 [公开版说明](docs/PUBLIC_RELEASE.md)。

## 资源管理界面

![实际运行的模型资源配置界面](docs/images/model-registry.png)

截图由实际 React Dashboard 连接实际 NestJS/SQLite Registry 获取。记录是本地添加的“示例配置”，处于停用状态、没有真实 Key，也没有启动截图中的模型。界面支持表单与高级配置模式，展示模型名称、服务地址、启用状态和参数。

管理首页部分统计图表采用演示数据；此处选择展示实际配置页面，不将图表作为线上监控证据。

## 服务架构

```mermaid
sequenceDiagram
  participant D as 上游设备 / 文本客户端
  participant G as Rust Gateway
  participant L as Python LLM Runner
  participant R as Resource Registry
  participant T as 工具服务
  participant A as React Dashboard
  A->>R: 模型 / 工具 CRUD
  L->>R: 启动或显式刷新时拉取配置
  D->>G: text + session_id + metadata
  G->>L: POST /v1/intent
  L-->>G: 工具名称 / 类别 / 参数
  G->>T: POST /v1/invoke/{category}
  T-->>G: 结构化结果 + 文本 / 命令
  G-->>D: 聚合响应
```

| 模块 | 责任 | 主要入口 |
| --- | --- | --- |
| Gateway | 请求头检查、Request ID、LLM 调度、工具 HTTP 调用、超时及响应聚合 | `app/agent-gateway/src/` |
| LLM Runner | 模型注册、Function Calling 解析、工具参数映射、显式配置刷新 | `app/llm-runner/app/` |
| Resource Registry | 模型/工具 CRUD、启用状态、健康与延迟记录、Runner 配置 | `app/resource-registry/src/` |
| Dashboard | 资源表单、JSON Schema 编辑、模型状态展示 | `app/dashboard/src/pages/` |
| DateTime | 时区、日期、时间与节假日查询 | `tools/tool-datetime/` |
| Weather | 实时、预报和逐小时天气 | `tools/tool-weather/` |
| Music / Content | 播放意图转换为结构化设备命令 | `tools/tool-music/`、`tools/tool-content/` |
| Auth | 认证服务接口骨架 | `app/auth/`，令牌签发与校验未完成 |

拆分的主要目的，是让设备协议、模型调用、配置管理和工具逻辑分别演进。代价是本地启动与跨服务排障更复杂，单个 `/health` 正常也不能证明全链路可用。

## 模型配置与连接生命周期

资源中心区分面向管理台的 CRUD 接口和面向 Runner 的配置接口。Runner 在启动时读取配置，运行中通过 `POST /v1/reload` 显式刷新。管理台保存后仍需调用刷新；当前没有自动配置推送。

```mermaid
flowchart LR
  A[拉取模型配置] --> B[构建候选客户端注册表]
  B -->|构建失败| C[关闭新建连接 / 保留旧表]
  B -->|构建成功| D[替换模型注册表]
  D --> E[新请求使用新客户端]
  D --> F[旧客户端标记退役]
  F --> G{仍有进行中的调用?}
  G -->|是| H[等待该调用结束]
  H --> I[关闭旧客户端]
  G -->|否| I
```

本次完善 [client.py](app/llm-runner/app/llm/client.py) 的 SDK 生命周期：

- 先构建新模型表，再替换旧表；构建失败时保留原表，并关闭本次已创建的客户端。
- 旧客户端处于请求中时延迟关闭，避免配置刷新主动中断在途调用；空闲客户端及时释放。
- 每次执行调用时重新解析当前注册表，避免已有 `Client` 包装对象一直绑定旧连接。
- FastAPI lifespan 结束时释放当前空闲连接，在途调用结束后再释放对应退役连接。

该保证针对**单进程模型客户端注册表**。工具定义与模型配置的两次拉取不是一个事务，也没有跨进程一致性协议。空配置沿用原回退行为，不会清空默认模型。

## 本地运行

| 环境 | 要求 |
| --- | --- |
| Python | 3.12+，工具请求模型使用泛型类语法 |
| Rust | stable，支持 Edition 2024 |
| Node.js | 推荐 22 / 24 LTS，安装与运行保持同一主版本 |
| 包管理 | pnpm 10；Python 各服务使用 uv |
| 存储 | SQLite 本地文件；无需另起数据库服务 |

```bash
git clone https://github.com/casset23/voice-agent-runtime.git
cd voice-agent-runtime
```

### 1. 资源中心与管理台

在资源中心目录执行：

```powershell
cd app/resource-registry
pnpm install --frozen-lockfile
$env:PORT = "30013"
# 可选：$env:DB_PATH = "你指定的本地SQLite路径"
pnpm start:dev
```

另开终端，在仓库根目录启动管理台：

```bash
cd app/dashboard
pnpm install --frozen-lockfile
pnpm dev
```

访问 `http://127.0.0.1:30012/llm-resources`。Registry 的开发 CORS 白名单包含默认管理台端口；变更端口时需同步配置。`better-sqlite3` 是原生模块，切换 Node 主版本后应重新安装或重建依赖。

### 2. 运行不依赖模型的时间工具

```bash
cd tools/tool-datetime
uv sync
uv run python -m uvicorn app.main:app --host 127.0.0.1 --port 30015
```

### 3. Runner 与 Gateway

另开终端，从仓库根目录运行：

```powershell
cd app/llm-runner
uv sync
$env:RESOURCE_REGISTRY_BASE_URL = "http://127.0.0.1:30013"
$env:ARK_API_KEY = "填写自己的本地模型密钥"
uv run python -m uvicorn app.main:app --host 127.0.0.1 --port 30011
```

默认模型沿用源码配置。也可在管理台添加自己的 OpenAI-compatible 模型，启用后调用 Runner 刷新接口。没有可用模型服务时，健康检查可返回正常，真实意图调用仍会失败。

Gateway 在另一个终端启动：

```bash
cd app/agent-gateway
cargo run
```

其他工具分别启动：天气入口 `app.main:app`，音乐/内容入口 `main:app`。天气需要本地设置 `SENIVERSE_API_KEY`；音乐和内容返回设备命令，不直接播放音频。

| 服务 | 端口 | 常用路径 |
| --- | ---: | --- |
| Gateway | 30010 | `/health`、`/v1/intent`、`/openapi.json` |
| Runner | 30011 | `/health`、`/v1/intent`、`/v1/reload` |
| Dashboard | 30012 | `/tools`、`/llm-resources` |
| Registry | 30013（设置 `PORT`） | `/health`、`/admin/api/tools`、`/admin/api/llms` |
| Weather / DateTime / Music / Content | 30014 / 30015 / 30016 / 30017 | `/health`、`/v1/invoke/{category}` |

`.env.example` 是变量清单，不会被每个服务自动加载。历史 Makefile、统一 YAML、Docker/Kubernetes 模板仍需按实际环境校准，直接启动步骤优先。完整联调前先逐个检查服务地址。

## 请求示例与接口契约

Gateway 请求需要以下请求头：

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

这条请求需要可用 Runner、模型和日期时间工具，不是无 Key 离线演示。工具返回 `tool`、`result`、`metadata` 与 `session_id`；`result` 内含结构化 `data`、可播报 `text` 和 `needs_utterance`。工具接口的 Pydantic 模型提供字段约束。

| 配置接口 | 用途 |
| --- | --- |
| `/admin/api/llms`、`/admin/api/tools` | 管理配置 |
| `/runner/api/llms/config`、`/runner/api/tools/config` | Runner 拉取启用配置 |
| `POST http://127.0.0.1:30011/v1/reload` | 显式加载新配置 |

## 测试与验证

仓库根目录可先运行无需真实模型的服务测试：

```bash
python -m pip install -r requirements-public-check.txt
python -m unittest discover -s tests -v
python -m compileall -q app/llm-runner tools
```

各模块检查：

```bash
# app/dashboard
pnpm run build
# app/resource-registry
pnpm run build
pnpm exec jest --runInBand
# app/agent-gateway
cargo check --locked
cargo test --locked
```

| 检查 | 范围 | 本次记录 |
| --- | --- | --- |
| Python 测试 | 4 项原服务检查 + 6 项 SDK 生命周期回归 | 10 项通过 |
| Registry | NestJS 构建与现有 Jest 测试 | CI 执行 |
| Dashboard | TypeScript / Vite 构建 | CI 执行 |
| Gateway | Rust 编译与现有测试 | CI 执行 |
| 实际界面 | Dashboard → NestJS → 临时 SQLite 的资源配置 | 本地已复现 |

测试模型使用替身，覆盖工具调用映射、输入/失败响应、时间工具，以及空闲回收、在途请求、刷新失败回滚、已有包装对象复用与关闭连接。替身仅在测试内生效，运行服务保持原模型调用链路。详细记录见 [验证说明](docs/VERIFICATION.md) 与 [CI](https://github.com/casset23/voice-agent-runtime/actions)。

真实意图效果、天气 API、设备播放和全链路部署尚未完成本轮验证，没有未经测量的 QPS、P95、准确率或线上收益数据。

## 工程边界与后续工作

| 当前实现 | 实际含义 / 下一步 |
| --- | --- |
| Authorization 与设备头检查 | 只检查头是否存在；仍需实现令牌真实性验证 |
| Request ID | 缺少时生成标识；端到端传播仍应专项验证 |
| `AtomicUsize` 忙碌计数 | 达到阈值后有限等待再 429；不是严格并发信号量或分布式限流 |
| 配置与管理接口 | 没有完整鉴权，只应在可信本地环境使用 |
| 模型 Key | SQLite 保存并提供给 Runner；需要后续凭据加密与访问控制 |
| 工具分发 | 仍需完整验证错误隔离、超时与设备侧行为 |

优先补齐认证、配置校验与错误路径，再实现严格容量控制和真实依赖的集成回归。公开源码脱敏不等同于生产安全加固。

阅读顺序：`agent-gateway/src/intent.rs` → `llm-runner/app/main.py` → `llm/client.py` → `resource-registry/src/` → 单个工具服务。仓库未授予额外开源许可，第三方组件遵循各自许可证。
