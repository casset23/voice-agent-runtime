# Agent Gateway

Co-Agent 智能音箱后端的核心网关服务，负责处理用户意图识别请求，调用 LLM Runner 进行语义解析，并协调各类工具服务的执行。

## 业务简介

Agent Gateway 是一个基于 Rust + Axum 的高性能微服务网关，主要功能：

- **意图识别**: 接收用户自然语言输入，通过 LLM Runner 进行语义解析
- **工具编排**: 根据识别结果调用相应的工具服务（如搜索、计算、文件操作等）
- **统一响应**: 将工具执行结果整合后返回给客户端

## 开发环境

### 前置要求

- Rust 1.70+
- 依赖的微服务: LLM Runner, 各类工具服务

### 启动服务

```bash
# 开发模式运行
cargo run

# 生产模式运行
cargo run --release
```

服务将在 `http://0.0.0.0:3456` 启动。

### 编译

```bash
# 开发构建
cargo build

# 生产构建
cargo build --release
```

## API 接口

### 意图处理 `/v1/intent`

**POST** 请求，需要以下请求头：
- `Authorization`: 认证令牌
- `X-Device-ID`: 设备 MAC 地址

**请求体**:
```json
{
  "text": "今天天气怎么样？",
  "session_id": "optional-session-id",
  "metadata": {
    "lang": "zh-CN",
    "timezone": "Asia/Shanghai",
    "timestamp": 1627834261,
    "model": "gpt-4"
  }
}
```

**响应**:
```json
{
  "text": "已处理您的请求: 今天天气怎么样？",
  "session_id": "generated-uuid",
  "tool_calls": [...],
  "metadata": {...}
}
```

### 健康检查 `/health`

**GET** 请求，返回服务状态。

## 架构说明

- `main.rs`: 服务入口，路由配置
- `intent.rs`: 意图处理核心逻辑
- `dto.rs`: 数据传输对象定义
- `mw.rs`: 中间件（请求头验证）
- `client.rs`: 统一 HTTP 客户端
- `services.rs`: 微服务拓扑配置