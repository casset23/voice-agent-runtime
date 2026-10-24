use super::common::Metadata;
use super::tool::ToolCallResult;
use utoipa::ToSchema;

/// 外部意图请求 - 系统入口点
#[derive(Debug, serde::Deserialize, ToSchema, Clone)]
pub struct IntentRequest {
    pub text: String,
    #[serde(default)]
    pub session_id: String,
    pub metadata: Metadata,
}

/// 外部响应 - 系统出口点
#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct IntentResponse {
    pub text: String,
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call: Option<ToolCallResult>,
    pub metadata: Metadata,
}
