/// 微服务拓扑配置
pub struct Services {
    pub llm_runner_api: &'static str,
    pub tool_weather_api: &'static str,
    pub tool_datetime_api: &'static str,
    pub tool_music_api: &'static str,
    pub tool_content_api: &'static str,
}

/// 全局服务配置实例
pub static SERVICES: Services = Services {
    llm_runner_api: "http://localhost:30011",
    tool_weather_api: "http://localhost:30014",
    tool_datetime_api: "http://localhost:30015",
    tool_music_api: "http://localhost:30016",
    tool_content_api: "http://localhost:30017",
};
