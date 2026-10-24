use crate::dto::*;
use crate::error::AppErrorResponse;
use axum::http::StatusCode;
use axum::{Json, response::IntoResponse, http::HeaderMap};
use serde::Serialize;
use std::borrow::Cow;
use std::sync::atomic::AtomicUsize;
use tracing::Instrument;

static QUEUE: AtomicUsize = AtomicUsize::new(0);

use crate::client::ServiceClient;

/// 处理意图请求
#[utoipa::path(
    post,
    path = "/v1/intent",
    request_body = IntentRequest,
    responses(
        (status = 200, description = "返回意图请求结果", body = IntentResponse),
        (status = TOO_MANY_REQUESTS, description = "当前服务器请求过多，请稍后再试"),
        (status = INTERNAL_SERVER_ERROR, description = "处理意图请求时发生错误"),
    ),
)]
pub async fn handle_intent(
    headers: axum::http::HeaderMap,
    Json(mut request): Json<IntentRequest>,
) -> impl IntoResponse {
    // 统一提取需要的信息
    let request_id = headers
        .get("X-Request-ID")
        .and_then(|v| v.to_str().ok())
        .expect("X-Request-ID header should exist after middleware");

    let mac_address = headers
        .get("X-Device-ID")
        .and_then(|v| v.to_str().ok())
        .expect("X-Device-ID header should exist after middleware");

    let session_id: Cow<str> = if request.session_id.is_empty() {
        let sid = uuid::Uuid::new_v4().to_string();
        request.session_id = sid.clone();

        Cow::Owned(sid.clone())
    } else {
        Cow::Borrowed(&request.session_id)
    };

    // 创建带默认字段的 span
    let span = tracing::info_span!(
        "[handle_intent]",
        session_id = %session_id,
        request_id = %request_id
    );

    async move {
        tracing::info!(mac_address = %mac_address, text = %request.text, "接收到意图请求");

        // 等待 LLM Runner 队列有空闲位置，最多等待 30 秒
        // todo 这里只是临时实现，后续会根据实际需要来调整，但是也无需配置化
        let max_wait_time = std::time::Duration::from_secs(30);
        let start_time = std::time::Instant::now();

        while QUEUE.load(std::sync::atomic::Ordering::SeqCst) >= 1000 {
            if start_time.elapsed() > max_wait_time {
                let error_response = AppErrorResponse::request_queue_full();
                return (StatusCode::TOO_MANY_REQUESTS, Json(error_response)).into_response();
            }
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }

        // 保护 llm runner 服务，避免大量请求涌入
        QUEUE.fetch_add(1, std::sync::atomic::Ordering::SeqCst);

        let llm_start = std::time::Instant::now();
        tracing::info!("开始调用 LLM Runner 服务");

        let request = LLMIntentRequest::from(request);
        let result = ServiceClient::call_llm_runner::<_, LLMRunnerResponse>("/v1/intent", &request).await;

        let llm_elapsed = llm_start.elapsed().as_millis();
        tracing::info!( elapsed_ms = format!("{llm_elapsed}ms"), "LLM Runner 调用结束");

        // LLM Runner 调用完成，立即释放队列位置
        QUEUE.fetch_sub(1, std::sync::atomic::Ordering::SeqCst);

        let (tools, response) = match result {
            Ok(response) => {
                let tools = response.tools.clone();
                (tools, response)
            }
            Err(err) => {
                tracing::error!(error = %err, "LLM Runner 调用失败");
                let error_response = AppErrorResponse::llm_runner_failed(&err.to_string());
                return (StatusCode::BAD_GATEWAY, Json(error_response)).into_response();
            }
        };

        // 如果没有识别到任何工具，本次请求当做默认意图。
        // 也就是 chat 的默认实现
        if tools.is_empty() {
            tracing::info!("未识别到任何工具，作为 chat intent 处理");
            let response = IntentResponse::from(response);
            
            let mut buf = Vec::new();
            let mut ser = serde_json::Serializer::with_formatter(&mut buf, serde_json::ser::PrettyFormatter::new());
            response.serialize(&mut ser).unwrap_or_default();
            let json_string = String::from_utf8(buf).unwrap_or_else(|_| "{}".to_string());
            
            let mut headers = HeaderMap::new();
            headers.insert("Content-Type", "application/json; charset=utf-8".parse().unwrap());
            
            return (StatusCode::OK, headers, json_string).into_response();
        }

        // 暂时只获取第一个结果，就目前看来，长期只会返回一个
        let tool = tools.into_iter().next().unwrap();

        // 记录 tools 调用耗时
        let tool_start = std::time::Instant::now();

        let request = ToolCallRequest::from((&response, &tool));
        let result = ServiceClient::call_tool_service::<_, ToolServiceResponse<serde_json::Value>>(
            &tool.name,
            &tool.category,
            &request,
        )
        .await;

        let tool_elapsed = tool_start.elapsed().as_millis();
        tracing::info!(tool_name = %tool.name, category = %tool.category, elapsed_ms = format!("{tool_elapsed}ms"), "调用工具服务");

        match result {
            Ok(response) => {
                // 检查是否需要 utterance 服务
                if response.result.needs_utterance {
                    tracing::error!(tool_name = %tool.name, category = %tool.category, "工具需要 utterance 服务，但暂未实现");
                    let error_response = AppErrorResponse::utterance_not_implemented(&tool.name);

                    // 目前出现 utterance 当做例外情况
                    return (StatusCode::NOT_IMPLEMENTED, Json(error_response)).into_response();
                }

                // 最终返回给调用者的响应转换
                let response = IntentResponse::from(response);

                // 创建自定义响应，确保UTF-8编码正确
                let mut buf = Vec::new();
                let mut ser = serde_json::Serializer::with_formatter(&mut buf, serde_json::ser::PrettyFormatter::new());
                response.serialize(&mut ser).unwrap_or_default();
                let json_string = String::from_utf8(buf).unwrap_or_else(|_| "{}".to_string());
                
                let mut headers = HeaderMap::new();
                headers.insert("Content-Type", "application/json; charset=utf-8".parse().unwrap());
                
                (StatusCode::OK, headers, json_string).into_response()
            }
            Err(err) => {
                tracing::error!(tool_name = %tool.name, category = %tool.category, error = %err, "工具调用失败");
                let error_response = AppErrorResponse::tool_service_failed(&err.to_string());

                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)).into_response()
            }
        }
    }
    .instrument(span)
    .await
}
