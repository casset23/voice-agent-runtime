use utoipa::ToSchema;

/// 工具调用信息 (来自 LLM)
#[derive(Debug, Clone, serde::Deserialize)]
pub struct ToolCall {
    pub name: String,
    pub category: String,
    pub parameters: serde_json::Value,
}

/// 工具基本信息
#[derive(Debug, serde::Deserialize, ToSchema)]
pub struct ToolInfo {
    pub name: String,
    #[allow(dead_code)]
    pub category: String,
    #[allow(dead_code)]
    pub version: Option<String>,
    #[allow(dead_code)]
    pub vendor: Option<String>,
}

/// 工具执行结果 (来自工具服务)
#[derive(Debug, serde::Deserialize, ToSchema)]
pub struct ToolResult<T> {
    pub data: T,
    pub text: String,
    pub needs_utterance: bool,
}

/// 工具调用结果 (返回给外部的精简版本)
#[derive(Debug, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct ToolCallResult {
    pub name: String,
    pub result: serde_json::Value,
}

impl ToolCallResult {
    /// 从工具服务响应创建调用结果
    pub fn from_tool_response<T>(tool_info: &ToolInfo, tool_result: &ToolResult<T>) -> Self
    where
        T: serde::Serialize,
    {
        Self {
            name: tool_info.name.clone(),
            result: serde_json::to_value(&tool_result.data).unwrap_or(serde_json::Value::Null),
        }
    }
}
