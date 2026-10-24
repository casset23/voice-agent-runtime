use axum::{Json, middleware::from_fn, response::IntoResponse, routing::*};
use utoipa::OpenApi;

mod client;
mod dto;
mod error;
mod intent;
mod middleware;
mod services;

/// 获取当前服务的健康工作状态
#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "服务正常"),
        (status = NOT_FOUND, description = "服务未找到")
    ),
)]
async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({"status": "ok"}))
}

#[derive(OpenApi)]
#[openapi(paths(health_check, intent::handle_intent))]
struct ApiDoc;

#[tokio::main]
async fn main() {
    // 强制输出到控制台，避免日志丢失
    tracing_subscriber::fmt()
        .with_ansi(true)
        .with_target(false)
        .with_thread_ids(false)
        .with_thread_names(false)
        .with_file(false)
        .with_line_number(false)
        .init();
    tracing::info!("🚀 正在启动 Agent Gateway...");

    let env = std::env::var("ENV").unwrap_or_else(|_| "local".to_string());
    tracing::info!("🔧 检测到环境: {}", env);

    tracing::info!("⚙️  加载服务配置...");
    tracing::info!(
        "🔗 LLM Runner API 端点地址: {}",
        services::SERVICES.llm_runner_api
    );

    // API 路由组（需要中间件保护）
    let protected_routes = Router::<()>::new()
        .route("/v1/intent", post(intent::handle_intent))
        .layer(from_fn(middleware::validate_headers));

    // 公开路由组（不需要中间件保护）
    let public_routes = Router::<()>::new()
        .route("/openapi.json", get(|| async { Json(ApiDoc::openapi()) }))
        .route("/health", get(health_check));

    let app = public_routes.merge(protected_routes);

    let listen_addr = "0.0.0.0:30010";

    match env.as_str() {
        "local" => {
            // 本地环境：普通 HTTP
            tracing::info!("🏠 本地环境 - HTTP 服务启动: {}", listen_addr);
            let listener = tokio::net::TcpListener::bind(listen_addr).await.unwrap();
            axum::serve(listener, app).await.unwrap();
        }

        // 部署在线上环境的情况
        _ => {
            // Kubernetes 环境：启用 HTTP/2 (无 TLS)
            tracing::info!(
                "🚀 Kubernetes 环境 ({}) - HTTP/2 服务启动: {}",
                env,
                listen_addr
            );

            // 使用 axum-server 启用 HTTP/2 支持
            tracing::info!("✅ HTTP/2 支持已启用 (无 TLS)");
            axum_server::bind(listen_addr.parse().unwrap())
                .serve(app.into_make_service())
                .await
                .unwrap();
        }
    }
}
