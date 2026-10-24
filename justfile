# 可用服务列表
SERVICES := "agent-gateway llm-runner tool-weather tool-datetime tool-music resource-registry auth"

# Kubernetes 命名空间
NAMESPACE_DEV := "co-agent-dev"
NAMESPACE_PROD := "co-agent"

COMMIT_HASH := `git rev-parse --short HEAD`

# 获取各项目版本号
AGENT_GATEWAY_VERSION := `grep '^version' app/agent-gateway/Cargo.toml | head -1 | cut -d '"' -f2`
LLM_RUNNER_VERSION := `grep '^version' app/llm-runner/pyproject.toml | head -1 | cut -d '"' -f2`
TOOL_WEATHER_VERSION := `grep '^version' tools/tool-weather/pyproject.toml | head -1 | cut -d '"' -f2`
TOOL_DATETIME_VERSION := `grep '^version' tools/tool-datetime/pyproject.toml | head -1 | cut -d '"' -f2`
TOOL_MUSIC_VERSION := `grep '^version' tools/tool-music/pyproject.toml | head -1 | cut -d '"' -f2`
RESOURCE_REGISTRY_VERSION := `grep '"version"' app/resource-registry/package.json | head -1 | cut -d '"' -f4`
AUTH_VERSION := `grep '"version"' app/auth/package.json | head -1 | cut -d '"' -f4`

# 镜像仓库前缀
REGISTRY := "ghcr.io/casset23"

version:
    @echo "agent-gateway={{AGENT_GATEWAY_VERSION}}"
    @echo "llm-runner={{LLM_RUNNER_VERSION}}"
    @echo "tool-weather={{TOOL_WEATHER_VERSION}}"
    @echo "tool-datetime={{TOOL_DATETIME_VERSION}}"
    @echo "tool-music={{TOOL_MUSIC_VERSION}}"
    @echo "resource-registry={{RESOURCE_REGISTRY_VERSION}}"
    @echo "auth={{AUTH_VERSION}}"

# 显示可用服务列表
services:
    @echo "可用服务:"
    @for service in {{SERVICES}}; do echo "  - $service"; done

# 构建并推送单个服务 (dev)
dev service:
    #!/usr/bin/env bash
    set -euo pipefail
    
    case "{{service}}" in
        "agent-gateway")
            VERSION="{{AGENT_GATEWAY_VERSION}}"
            CONTEXT="app/agent-gateway"
            ;;
        "llm-runner")
            VERSION="{{LLM_RUNNER_VERSION}}"
            CONTEXT="app/llm-runner"
            ;;
        "tool-weather")
            VERSION="{{TOOL_WEATHER_VERSION}}"
            CONTEXT="tools/tool-weather"
            ;;
        "tool-datetime")
            VERSION="{{TOOL_DATETIME_VERSION}}"
            CONTEXT="tools/tool-datetime"
            ;;
        "tool-music")
            VERSION="{{TOOL_MUSIC_VERSION}}"
            CONTEXT="tools/tool-music"
            ;;
        "resource-registry")
            VERSION="{{RESOURCE_REGISTRY_VERSION}}"
            CONTEXT="app/resource-registry"
            ;;
        "auth")
            VERSION="{{AUTH_VERSION}}"
            CONTEXT="app/auth"
            ;;
        *)
            echo "Unknown service: {{service}}"
            echo "Available services: {{SERVICES}}"
            exit 1
            ;;
    esac
    
    TAG="{{REGISTRY}}/{{service}}:${VERSION}-dev-{{COMMIT_HASH}}"
    
    echo "Building {{service}} with tag: ${TAG}"
    docker build --platform linux/amd64 -t "${TAG}" "${CONTEXT}"
    echo "Built: ${TAG}"
    
    echo "Pushing {{service}} with tag: ${TAG}"
    docker push "${TAG}"
    echo "Pushed: ${TAG}"

# 构建并推送所有服务 (dev)
dev-all:
    #!/usr/bin/env bash
    for service in {{SERVICES}}; do
        just dev $service
    done

# 构建并推送单个服务 (prod)
prod service:
    #!/usr/bin/env bash
    set -euo pipefail
    
    case "{{service}}" in
        "agent-gateway")
            VERSION="{{AGENT_GATEWAY_VERSION}}"
            CONTEXT="app/agent-gateway"
            ;;
        "llm-runner")
            VERSION="{{LLM_RUNNER_VERSION}}"
            CONTEXT="app/llm-runner"
            ;;
        "tool-weather")
            VERSION="{{TOOL_WEATHER_VERSION}}"
            CONTEXT="tools/tool-weather"
            ;;
        "tool-datetime")
            VERSION="{{TOOL_DATETIME_VERSION}}"
            CONTEXT="tools/tool-datetime"
            ;;
        "tool-music")
            VERSION="{{TOOL_MUSIC_VERSION}}"
            CONTEXT="tools/tool-music"
            ;;
        "resource-registry")
            VERSION="{{RESOURCE_REGISTRY_VERSION}}"
            CONTEXT="app/resource-registry"
            ;;
        "auth")
            VERSION="{{AUTH_VERSION}}"
            CONTEXT="app/auth"
            ;;
        *)
            echo "Unknown service: {{service}}"
            echo "Available services: {{SERVICES}}"
            exit 1
            ;;
    esac
    
    TAG="{{REGISTRY}}/{{service}}:${VERSION}"
    
    echo "Building {{service}} with tag: ${TAG}"
    docker build --platform linux/amd64 -t "${TAG}" "${CONTEXT}"
    echo "Built: ${TAG}"
    
    echo "Pushing {{service}} with tag: ${TAG}"
    docker push "${TAG}"
    echo "Pushed: ${TAG}"

# 构建并推送所有服务 (prod)
prod-all:
    #!/usr/bin/env bash
    for service in {{SERVICES}}; do
        just prod $service
    done

# 代码风格与静态检查

# 检查单个Python服务的代码质量
check service:
    #!/usr/bin/env bash
    set -euo pipefail
    
    case "{{service}}" in
        "llm-runner")
            SERVICE_PATH="app/llm-runner"
            ;;
        "tool-weather")
            SERVICE_PATH="tools/tool-weather"
            ;;
        "tool-datetime")
            SERVICE_PATH="tools/tool-datetime"
            ;;
        "tool-music")
            SERVICE_PATH="tools/tool-music"
            ;;
        "resource-registry")
            echo "{{service}} is a Node.js service, skipping Python checks"
            exit 0
            ;;
        "auth")
            echo "{{service}} is a Node.js service, skipping Python checks"
            exit 0
            ;;
        *)
            echo "Unknown service: {{service}}"
            echo "Available Python services: llm-runner, tool-weather, tool-datetime, tool-music"
            echo "Available Node.js services: resource-registry, auth"
            exit 1
            ;;
    esac
    
    echo "🔍 Running ruff check for {{service}}..."
    ruff check "${SERVICE_PATH}" --fix

# 格式化单个Python服务的代码
format service:
    #!/usr/bin/env bash
    set -euo pipefail
    
    case "{{service}}" in
        "llm-runner")
            SERVICE_PATH="app/llm-runner"
            ;;
        "tool-weather")
            SERVICE_PATH="tools/tool-weather"
            ;;
        "tool-datetime")
            SERVICE_PATH="tools/tool-datetime"
            ;;
        "tool-music")
            SERVICE_PATH="tools/tool-music"
            ;;
        "resource-registry")
            echo "{{service}} is a Node.js service, skipping Python checks"
            exit 0
            ;;
        "auth")
            echo "{{service}} is a Node.js service, skipping Python checks"
            exit 0
            ;;
        *)
            echo "Unknown service: {{service}}"
            echo "Available Python services: llm-runner, tool-weather, tool-datetime, tool-music"
            echo "Available Node.js services: resource-registry, auth"
            exit 1
            ;;
    esac
    
    echo "🎨 Running ruff format for {{service}}..."
    ruff format "${SERVICE_PATH}"

# 检查所有Python服务
check-all:
    @echo "🔍 Running ruff check for all Python services..."
    ruff check . --fix

# 格式化所有Python服务
format-all:
    @echo "🎨 Running ruff format for all Python services..."
    ruff format .

# CI专用：检查所有Python服务（不修改文件）
check-ci:
    @echo "🔍 Running ruff check for CI..."
    ruff check . --output-format=github

# CI专用：检查指定数量的提交（用于PR检查）
commit-check-ci count="5":
    @echo "📋 Checking last {{count}} commit messages for CI..."
    npx commitlint --from HEAD~{{count}} --to HEAD --verbose

# 检查所有提交
commit-check:
    @echo "📋 Checking ALL commits in current branch..."
    npx commitlint --from $(git rev-list --max-parents=0 HEAD) --to HEAD --verbose