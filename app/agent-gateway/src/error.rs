use serde::Serialize;

#[derive(Serialize)]
pub struct AppErrorResponse {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl AppErrorResponse {
    /// 请求队列已满
    pub fn request_queue_full() -> Self {
        Self {
            code: -1,
            message: "当前服务器请求过多，请稍后再试".to_string(),
            details: None,
        }
    }

    /// LLM Runner 调用失败
    pub fn llm_runner_failed(error: &str) -> Self {
        Self {
            code: 10000,
            message: format!("LLM Runner 意图识别失败: {error}"),
            details: None,
        }
    }

    /// 工具服务调用失败
    pub fn tool_service_failed(error: &str) -> Self {
        Self {
            code: 10010,
            message: format!("工具调用失败: {error}"),
            details: None,
        }
    }

    /// Utterance 服务未实现
    pub fn utterance_not_implemented(tool_name: &str) -> Self {
        Self {
            code: 12000,
            message: format!("工具 {tool_name} 需要 utterance 服务，但暂未实现"),
            details: None,
        }
    }
}
