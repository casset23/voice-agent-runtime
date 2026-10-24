use axum::{
    extract::Request,
    http::{HeaderValue, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use uuid::Uuid;

/// 验证必要的请求头中间件
/// 1. 验证 Authorization 请求头是否存在（占位实现）
/// 2. 如果 X-Request-ID 为空，则用 uuid 补一个
/// 3. 判断 X-Device-ID 必须存在，否则直接 403 拒绝
pub async fn validate_headers(
    mut request: Request,
    next: Next,
) -> Result<Response, impl IntoResponse> {
    let headers = request.headers();

    // 1. 验证 Authorization 头是否存在（占位实现）
    if headers.get(header::AUTHORIZATION).is_none() {
        tracing::warn!("缺少 Authorization 请求头");
        return Err((StatusCode::UNAUTHORIZED, "Missing Authorization header"));
    }

    // 3. 验证 X-Device-ID 必须存在
    if headers.get("X-Device-ID").is_none() {
        tracing::warn!("缺少 X-Device-ID 请求头");
        return Err((StatusCode::FORBIDDEN, "Missing X-Device-ID header"));
    }

    // 2. 如果 X-Request-ID 为空，则用 uuid 补一个
    if headers.get("X-Request-ID").is_none() {
        let request_id = Uuid::new_v4().to_string();
        let header_value = HeaderValue::from_str(&request_id).map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to generate request ID",
            )
        })?;

        request.headers_mut().insert("X-Request-ID", header_value);

        tracing::info!(request_id = %request_id, "自动生成 X-Request-ID");
    }

    tracing::debug!("请求头验证通过");
    Ok(next.run(request).await)
}
