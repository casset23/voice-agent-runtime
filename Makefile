# Co-Agent 项目管理 Makefile

.PHONY: help install dev prod stop clean config

# 默认目标
help:
	@echo "Co-Agent 项目管理命令："
	@echo ""
	@echo "开发环境："
	@echo "  make install    - 安装所有依赖"
	@echo "  make dev        - 启动开发环境"
	@echo "  make dev-fast   - 快速启动开发环境（简化版）"
	@echo ""
	@echo "生产环境："
	@echo "  make prod       - 启动生产环境"
	@echo "  make docker     - 使用 Docker 启动"
	@echo ""
	@echo "配置管理："
	@echo "  make config-dev - 生成开发环境配置"
	@echo "  make config-prod- 生成生产环境配置"
	@echo ""
	@echo "其他："
	@echo "  make stop       - 停止所有服务"
	@echo "  make clean      - 清理构建文件"
	@echo "  make status     - 查看服务状态"

# 安装依赖
install:
	@echo "🔧 安装项目依赖..."
	@echo "安装 Rust 依赖..."
	cd app/agent-gateway && cargo build
	@echo "安装 Node.js 依赖..."
	cd app/resource-registry && pnpm install
	cd app/dashboard && pnpm install
	@echo "安装 Python 依赖..."
	cd app/llm-runner && pip install -r requirements.txt || pip install -e .
	cd tools/tool-weather && pip install -r requirements.txt || pip install -e .
	cd tools/tool-datetime && pip install -r requirements.txt || pip install -e .
	cd tools/tool-music && pip install -r requirements.txt || pip install -e .
	cd tools/tool-content && pip install -r requirements.txt || pip install -e .
	@echo "✅ 依赖安装完成"

# 生成开发环境配置
config-dev:
	@echo "🔧 生成开发环境配置..."
	python scripts/config_generator.py --env development
	@echo "✅ 开发环境配置生成完成"

# 生成生产环境配置
config-prod:
	@echo "🔧 生成生产环境配置..."
	python scripts/config_generator.py --env production
	@echo "✅ 生产环境配置生成完成"

# 启动开发环境
dev: config-dev
	@echo "🚀 启动开发环境..."
	python scripts/service_manager.py start --env development


# 启动生产环境
prod: config-prod
	@echo "🚀 启动生产环境..."
	python scripts/service_manager.py start --env production

# Docker 启动
docker: config-prod
	@echo "🐳 使用 Docker 启动..."
	docker-compose up -d

# 停止所有服务
stop:
	@echo "🛑 停止所有服务..."
	python scripts/service_manager.py stop || true
	docker-compose down || true

# 查看服务状态
status:
	@echo "📋 查看服务状态..."
	python scripts/service_manager.py list

# 重启服务
restart: stop
	@sleep 3
	@make dev

# 清理构建文件
clean:
	@echo "🧹 清理构建文件..."
	cd app/agent-gateway && cargo clean
	cd app/dashboard && rm -rf dist/ node_modules/.vite/
	find . -name "__pycache__" -type d -exec rm -rf {} + || true
	find . -name "*.pyc" -delete || true
	@echo "✅ 清理完成"

# 构建所有项目
build:
	@echo "🔨 构建所有项目..."
	cd app/agent-gateway && cargo build --release
	cd app/dashboard && pnpm run build
	@echo "✅ 构建完成"

# 运行测试
test:
	@echo "🧪 运行测试..."
	cd app/agent-gateway && cargo test
	cd app/resource-registry && pnpm run test || true
	@echo "✅ 测试完成"

# 检查代码质量
lint:
	@echo "🔍 检查代码质量..."
	cd app/dashboard && pnpm run lint || true
	@echo "✅ 代码检查完成"


