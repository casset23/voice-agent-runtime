use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use std::time::Duration;

/// 全局 HTTP 客户端实例
pub static HTTP_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .expect("Failed to create HTTP client")
});

/// 服务调用客户端
pub struct ServiceClient;

impl ServiceClient {
    /// 调用 LLM Runner 服务
    pub async fn call_llm_runner<T, R>(endpoint: &str, payload: &T) -> Result<R>
    where
        T: Serialize,
        R: for<'de> Deserialize<'de>,
    {
        let url = format!("{}{}", crate::services::SERVICES.llm_runner_api, endpoint);

        tracing::debug!(
            url = %url,
            "调用 LLM Runner 服务"
        );

        let response = HTTP_CLIENT
            .post(&url)
            .json(payload)
            .send()
            .await
            .context(format!("调用 LLM Runner 失败: {url}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "LLM Runner 调用失败，状态码: {}, 错误信息: {}",
                status,
                error_text
            );
        }

        let result = response
            .json::<R>()
            .await
            .context("解析 LLM Runner 响应失败")?;

        tracing::debug!("LLM Runner 调用成功");
        Ok(result)
    }

    /// 调用工具服务
    pub async fn call_tool_service<T, R>(tool_name: &str, category: &str, payload: &T) -> Result<R>
    where
        T: Serialize,
        R: for<'de> Deserialize<'de>,
    {
        // 根据工具名称获取对应的服务地址
        let base_url = match tool_name {
            "tool-weather" => crate::services::SERVICES.tool_weather_api,
            "tool-datetime" => crate::services::SERVICES.tool_datetime_api,
            "tool-music" => crate::services::SERVICES.tool_music_api,
            "tool-content" => crate::services::SERVICES.tool_content_api,
            _ => return Err(anyhow::anyhow!("未知的工具服务: {}", tool_name)),
        };
        
        let url = format!("{}/v1/invoke/{}", base_url, category);

        tracing::debug!(
            tool_name = %tool_name,
            category = %category,
            url = %url,
            "调用工具服务"
        );

        let response = HTTP_CLIENT
            .post(&url)
            .header("Content-Type", "application/json; charset=utf-8")
            .json(payload)
            .timeout(Duration::from_secs(30))
            .send()
            .await
            .context(format!("调用工具 {tool_name} 失败"))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!(
                "工具 {} 调用失败，状态码: {}, 错误信息: {}",
                tool_name,
                status,
                error_text
            );
        }

        // 确保正确处理UTF-8编码的响应
        let response_bytes = response
            .bytes()
            .await
            .context(format!("读取工具 {tool_name} 响应失败"))?;
        
        let response_text = String::from_utf8(response_bytes.to_vec())
            .context(format!("工具 {tool_name} 响应不是有效的UTF-8"))?;
        
        // 添加调试日志
        tracing::debug!(tool_name = %tool_name, response_text = %response_text, "工具响应原文");
        
        let result = serde_json::from_str::<R>(&response_text)
            .context(format!("解析工具 {tool_name} 响应失败"))?;

        tracing::debug!(tool_name = %tool_name, "工具调用成功");
        Ok(result)
    }
}
