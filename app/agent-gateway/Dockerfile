FROM rust:1.87-bullseye AS builder

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main(){}" > src/main.rs
RUN cargo build --release --locked

COPY src ./src
RUN cargo build --release --locked

# 使用谷歌提供的轻量级镜像
FROM gcr.io/distroless/cc-debian12:nonroot
ARG APP_NAME=agent-gateway

WORKDIR /app

# 复制 OpenSSL 依赖库
COPY --from=builder /usr/lib/x86_64-linux-gnu/libssl.so.1.1 /usr/lib/x86_64-linux-gnu/
COPY --from=builder /usr/lib/x86_64-linux-gnu/libcrypto.so.1.1 /usr/lib/x86_64-linux-gnu/

COPY --from=builder /app/target/release/${APP_NAME} .

EXPOSE 3456

ENTRYPOINT [ "/app/agent-gateway" ]