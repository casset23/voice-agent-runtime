![Co-Agent](docs/images/cover.svg)

# Co-Agent · 智能音箱 Agent 后端

围绕智能音箱文字指令构建的多服务后端：Rust Gateway 负责请求编排，Python LLM Runner 解析工具意图，NestJS/SQLite 资源中心管理模型与工具，React 控制台提供配置界面。

[![CI](https://github.com/casset23/voice-agent-runtime/actions/workflows/ci.yml/badge.svg)](https://github.com/casset23/voice-agent-runtime/actions/workflows/ci.yml)
![Rust](https://img.shields.io/badge/Rust-Axum_/_Tokio-7898ad?style=flat-square)
![Services](https://img.shields.io/badge/Python-NestJS_/_React-697c8e?style=flat-square)

[管理界面](#资源管理界面) · [服务架构](#服务架构) · [本地运行](#本地运行) · [配置热刷新](#模型配置与连接生命周期) · [验证](#测试与验证)

## 应用场景

用户说“现在几点”“明天天气怎么样”或提出播放请求。上游把识别后的文字、会话 ID 与设备上下文送入 Gateway；Runner 通过 OpenAI-compatible Function Calling 生成工具调用，Gateway 分发到对应工具服务，再聚合结构化结果与播报文本。

Co-Agent 以设备文字指令为入口，连接模型推理、工具执行与资源配置；语音采集、ASR/TTS 和硬件驱动通过上游设备侧衔接。

**技术栈：Rust、Axum、Tokio、Python、FastAPI、TypeScript、NestJS、SQLite、React。**

## 资源管理界面

![实际运行的模型资源配置界面](docs/images/model-registry.png)

React Dashboard 连接 NestJS/SQLite Registry，支持模型与工具管理。配置页面提供表单和高级编辑模式，集中管理模型标识、服务地址、启用状态与请求参数。

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

Gateway、Runner、资源中心与工具服务按责任拆分，设备协议、模型调用与业务工具分别演进；统一会话标识、HTTP 接口和结构化工具结果连接调用链。

## 模型配置与连接生命周期

资源中心区分面向管理台的 CRUD 接口和面向 Runner 的配置接口。Runner 在启动时读取配置，运行中通过 `POST /v1/reload` 显式刷新。管理台保存配置后，调用刷新接口即可加载新配置。

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

[client.py](app/llm-runner/app/llm/client.py) 管理 SDK 客户端生命周期：

- 先构建新模型表，再替换旧表；构建失败时保留原表，并关闭候选表中已创建的客户端。
- 旧客户端处于请求中时延迟关闭，避免配置刷新主动中断在途调用；空闲客户端及时释放。
- 每次执行调用时重新解析当前注册表，避免已有 `Client` 包装对象一直绑定旧连接。
- FastAPI lifespan 结束时释放当前空闲连接，在途调用结束后再释放对应退役连接。

模型注册表在单进程内整体替换，工具与模型配置分别拉取。空模型配置沿用默认模型，保持请求处理路径连续。

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

默认模型在 `client.py` 中配置，也可通过管理台添加 OpenAI-compatible 模型，启用后调用 Runner 刷新接口。运行意图请求前，确认模型服务地址和 Key 可用。

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

环境变量见 `.env.example`，按各服务启动终端注入。Docker/Kubernetes 配置位于 `deploy/`，部署时统一配置服务地址、端口和镜像路径。

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

请求依次经过 Runner、模型服务与日期时间工具。工具返回 `tool`、`result`、`metadata` 与 `session_id`；`result` 内含结构化 `data`、可播报 `text` 和 `needs_utterance`。工具接口的 Pydantic 模型提供字段约束。

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

| 检查 | 范围 | 结果 |
| --- | --- | --- |
| Python 测试 | 配置、工具调用、时间 API 与 SDK 生命周期 | 10 项通过 |
| Registry | NestJS 构建与 Jest 测试 | CI 通过 |
| Dashboard | TypeScript / Vite 构建 | CI 通过 |
| Gateway | Rust 编译与测试 | CI 通过 |
| 资源管理 | Dashboard → NestJS → SQLite 配置读写 | 交互通过 |

测试使用 Mock 隔离模型网络，覆盖工具调用映射、输入与失败响应、时间工具，以及空闲回收、在途请求、刷新失败回滚、客户端复用和关闭连接。具体用例见 [测试说明](docs/VERIFICATION.md) 与 [CI](https://github.com/casset23/voice-agent-runtime/actions)。

## 请求处理与资源管理

| 机制 | 实现 |
| --- | --- |
| 入口检查 | 检查 Authorization 与 X-Device-ID 请求头是否存在 |
| Request ID | 缺少标识时生成 UUID，关联请求日志 |
| 忙碌计数 | 单进程 `AtomicUsize` 记录请求占用，达到阈值后最多等待 30 秒并返回 429 |
| 配置分发 | 管理台 CRUD 与 Runner 配置接口分离，按启用状态返回模型与工具 |
| 持久化 | SQLite 保存模型参数、工具定义与模型健康记录 |
| HTTP 调用 | Gateway 集中设置下游超时，分发工具请求并聚合结构化结果 |

阅读顺序：`agent-gateway/src/intent.rs` → `llm-runner/app/main.py` → `llm/client.py` → `resource-registry/src/` → 单个工具服务。
