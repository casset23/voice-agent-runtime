use std::time::{SystemTime, UNIX_EPOCH};
use utoipa::ToSchema;

/// 请求元数据，包含上下文信息
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct Metadata {
    pub lang: String,
    pub timezone: String,
    pub timestamp: u128,
    pub model: String,
    #[serde(default)]
    pub env: String,
    pub location: Option<Location>,
    pub platform: Option<String>,
    pub device_version: Option<String>,
}

impl Metadata {
    /// 更新时间戳并设置环境信息
    pub fn refresh(&mut self) {
        self.timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();

        // TODO: 根据环境变量或配置来获取，目前先写死
        self.env = "dev".to_string();
    }
}

/// 地理位置信息
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct Location {
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub country: Option<String>,
    pub province: Option<String>,
    pub city: Option<String>,
    pub district: Option<String>,
}
