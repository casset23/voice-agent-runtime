use super::common::Metadata;
use super::external::{IntentRequest, IntentResponse};
use super::tool::{ToolCall, ToolCallResult, ToolInfo, ToolResult};

// === LLM Runner 通信 ===

/// 发送给 LLM Runner 的请求
#[derive(serde::Serialize, Clone)]
pub struct LLMIntentRequest {
    pub text: String,
    pub session_id: String,
    pub metadata: Metadata,
}

/// 来自 LLM Runner 的响应
#[derive(Debug, serde::Deserialize)]
pub struct LLMRunnerResponse {
    #[serde(default)]
    pub tools: Vec<ToolCall>,
    pub session_id: String,
    pub metadata: Metadata,
}

// === Tool Service 通信 ===

/// 发送给工具服务的请求
#[derive(Debug, Default, serde::Serialize, Clone)]
pub struct ToolCallRequest {
    pub session_id: String,
    pub parameters: serde_json::Value,
    pub metadata: Metadata,
}

/// 来自工具服务的响应
#[derive(Debug, serde::Deserialize)]
pub struct ToolServiceResponse<T> {
    pub tool: ToolInfo,
    pub result: ToolResult<T>,
    pub metadata: Metadata,
    pub session_id: String,
}

// === 请求转换实现 ===

impl From<IntentRequest> for LLMIntentRequest {
    fn from(request: IntentRequest) -> Self {
        let mut metadata = request.metadata;
        metadata.refresh();

        Self {
            text: request.text,
            session_id: request.session_id,
            metadata,
        }
    }
}

impl From<(&IntentRequest, &ToolCall)> for ToolCallRequest {
    fn from((request, tool_call): (&IntentRequest, &ToolCall)) -> Self {
        let mut metadata = request.metadata.clone();
        metadata.refresh();

        Self {
            session_id: request.session_id.clone(),
            parameters: tool_call.parameters.clone(),
            metadata,
        }
    }
}

/// LLM Runner 响应 + 工具调用 -> 工具请求
impl From<(&LLMRunnerResponse, &ToolCall)> for ToolCallRequest {
    fn from((llm_response, tool_call): (&LLMRunnerResponse, &ToolCall)) -> Self {
        let mut metadata = llm_response.metadata.clone();
        metadata.refresh();

        Self {
            session_id: llm_response.session_id.clone(),
            parameters: tool_call.parameters.clone(),
            metadata,
        }
    }
}

// === 响应转换实现 ===

/// 聊天响应：LLM Runner 响应 -> 外部响应 (空工具情况)
impl From<LLMRunnerResponse> for IntentResponse {
    fn from(mut llm_response: LLMRunnerResponse) -> Self {
        llm_response.metadata.refresh();

        Self {
            text: "".to_string(), // 按约定：空文本表示对话逻辑
            session_id: llm_response.session_id,
            tool_call: None,
            metadata: llm_response.metadata,
        }
    }
}

/// 工具响应：工具服务响应 -> 外部响应
impl From<ToolServiceResponse<serde_json::Value>> for IntentResponse {
    fn from(mut tool_response: ToolServiceResponse<serde_json::Value>) -> Self {
        tool_response.metadata.refresh();

        let tool_call =
            ToolCallResult::from_tool_response(&tool_response.tool, &tool_response.result);

        Self {
            text: tool_response.result.text,
            session_id: tool_response.session_id,
            tool_call: Some(tool_call),
            metadata: tool_response.metadata,
        }
    }
}
