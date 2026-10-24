// 公共基础结构
pub mod common;

// 外部 API 接口
pub mod external;
pub use external::{IntentRequest, IntentResponse};

// 工具相关结构
pub mod tool;

// 内部服务通信
pub mod internal;
pub use internal::{LLMIntentRequest, LLMRunnerResponse, ToolCallRequest, ToolServiceResponse};
