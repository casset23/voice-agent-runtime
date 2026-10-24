# 阶段 1：构建阶段 (Builder)
FROM python:3.13-slim AS builder

# 由于 uvicorn 依赖 libz.so.1，所以需要安装 zlib1g
RUN apt update && apt install -y --no-install-recommends \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

# 从官方 uv 镜像中复制 uv 和 uvx 二进制文件
COPY --from=docker.io/astral/uv:latest /uv /uvx /usr/local/bin/

# 设置工作目录
WORKDIR /app

# 复制依赖文件 (pyproject.toml 和 uv.lock)
COPY pyproject.toml uv.lock ./

# 设置 uv 相关的环境变量
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# 创建一个 Python 虚拟环境，并使用 uv 安装所有依赖
RUN uv venv && uv sync --no-dev --frozen --no-install-project

# 阶段 2：运行阶段 (Runner)
# 使用 Distroless 的基础镜像，它只包含最基本的系统库 (如 glibc)
# 不包含任何 Python 运行时，我们将从构建阶段复制过来
FROM gcr.io/distroless/base-debian12:nonroot

# 设置工作目录
WORKDIR /app

# /usr/local 是 Python 在官方镜像中默认的安装路径
# 这会包含 python3.13 可执行文件、libpython3.13.so.1.0 以及其他必要的共享库
COPY --from=builder /usr/local /usr/local
COPY --from=builder /usr/lib/*-linux-gnu/libz.so* /usr/lib/
COPY --from=builder /usr/lib/*-linux-gnu/libgcc_s.so* /usr/lib/

# 从构建阶段复制整个虚拟环境
# 这个虚拟环境包含了所有第三方依赖
COPY --from=builder /app/.venv /app/.venv

# 直接从源代码复制应用程序代码
COPY . /app/

EXPOSE 30011

# 容器启动命令
# Distroless 镜像没有 shell，所以必须使用 exec 形式 (JSON 数组格式)
ENTRYPOINT ["/app/.venv/bin/python3", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "30011"]
