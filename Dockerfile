# Monolithic image for the entire project (gateway + llm-runner + dashboard + resource-registry + 4 tools)
# NOTE: For simplicity, we run all services via supervisord in one container.

FROM python:3.13-slim AS base

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    RESOURCE_REGISTRY_BASE_URL=http://localhost:30013 \
    PORT_GATEWAY=30010 \
    PORT_LLM=30011 \
    PORT_DASHBOARD=30012 \
    PORT_REGISTRY=30013 \
    PORT_WEATHER=30014 \
    PORT_DATETIME=30015 \
    PORT_MUSIC=30016 \
    PORT_CONTENT=30017

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl wget git build-essential pkg-config libssl-dev \
    bash supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x + pnpm
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get update && apt-get install -y nodejs \
    && npm i -g pnpm@8 \
    && rm -rf /var/lib/apt/lists/*

# Install Rust toolchain (for agent-gateway build)
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain stable \
    && /root/.cargo/bin/rustc --version
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

# Copy source
COPY . /app

# Build agent-gateway (release binary)
RUN cd app/agent-gateway && cargo build --release

# Install Python deps used by llm-runner and tools (coarse-grained for simplicity)
RUN pip install --no-cache-dir \
    uvicorn fastapi starlette httpx aiohttp pydantic typing-extensions \
    chinesecalendar pytz openai

# Install Node deps for dashboard and resource-registry
RUN cd app/dashboard \
 && rm -f pnpm-workspace.yaml \
 && pnpm install --frozen-lockfile=false \
 && cd /app/app/resource-registry \
 && rm -f pnpm-workspace.yaml \
 && pnpm install --frozen-lockfile=false

# Supervisor config (copy from local file)
COPY deploy/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 30010 30011 30012 30013 30014 30015 30016 30017

CMD ["/usr/bin/supervisord","-n","-c","/etc/supervisor/conf.d/supervisord.conf"]


