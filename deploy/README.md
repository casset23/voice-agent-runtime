# Co-Agent 部署说明

本目录包含 Co-Agent 平台的 Kubernetes 部署配置文件和说明。

## 🗂️ 目录结构

```
deploy/
└── kubernetes/
    └── services/
        ├── agent-gateway/          # API网关服务
        ├── llm-runner/            # LLM推理服务
        └── tools/
            ├── tool-weather/      # 天气工具服务
            └── tool-datetime/     # 时间工具服务
```

每个服务包含两个环境配置：
- **base/**: 生产环境配置（命名空间：`co-agent`）
- **dev/**: 开发环境配置（命名空间：`co-agent-dev`）

## 🚀 部署方式

**部署到开发环境：**

```bash
# 部署所有服务
kubectl apply -k deploy/kubernetes/services/agent-gateway/dev
kubectl apply -k deploy/kubernetes/services/llm-runner/dev
kubectl apply -k deploy/kubernetes/services/tools/tool-weather/dev
kubectl apply -k deploy/kubernetes/services/tools/tool-datetime/dev

# 查看部署状态
kubectl get pods -n co-agent-dev
```

**部署到生产环境：**
```bash
# 部署所有服务
kubectl apply -k deploy/kubernetes/services/agent-gateway/base
kubectl apply -k deploy/kubernetes/services/llm-runner/base
kubectl apply -k deploy/kubernetes/services/tools/tool-weather/base
kubectl apply -k deploy/kubernetes/services/tools/tool-datetime/base

# 查看部署状态
kubectl get pods -n co-agent
```

## 🔧 配置说明

### 环境差异

- **生产环境 (base/)**：
  - 命名空间：`co-agent`
  - 镜像标签：稳定版本（如 `0.1.0`）
  - 资源配置：较高的 CPU/内存限制
  - 副本数：2 个

- **开发环境 (dev/)**：
  - 命名空间：`co-agent-dev`
  - 镜像标签：开发版本（如 `0.1.0-dev-{git-hash}`）
  - 资源配置：较低的 CPU/内存限制
  - 副本数：1 个

### 镜像更新

在每个环境的 `kustomization.yaml` 文件中，可以更新镜像标签：

```yaml
images:
- name: ghcr.io/casset23/agent-gateway
  newTag: 0.1.0-dev-d9db231  # 更新为新的标签
```

## 🔍 运维命令

### 查看服务状态

```bash
# 开发环境
kubectl get all -n co-agent-dev

# 生产环境
kubectl get all -n co-agent
```

### 查看日志

```bash
# 查看特定服务日志
kubectl logs -n co-agent-dev deployment/agent-gateway -f

# 查看所有 agent-gateway 实例日志
kubectl logs -n co-agent-dev -l app.kubernetes.io/name=agent-gateway -f
```

### 重启服务

```bash
# 重启特定服务
kubectl rollout restart deployment/agent-gateway -n co-agent-dev

# 查看重启状态
kubectl rollout status deployment/agent-gateway -n co-agent-dev
```

### 删除部署

```bash
# 删除开发环境
kubectl delete -k deploy/kubernetes/services/agent-gateway/dev
kubectl delete -k deploy/kubernetes/services/llm-runner/dev
kubectl delete -k deploy/kubernetes/services/tools/tool-weather/dev
kubectl delete -k deploy/kubernetes/services/tools/tool-datetime/dev

# 删除命名空间（谨慎操作）
kubectl delete namespace co-agent-dev
```

## 📋 部署前检查清单

- [ ] 确认 Kubernetes 集群可用：`kubectl cluster-info`
- [ ] 确认命名空间存在或将被创建
- [ ] 确认镜像仓库访问权限（需要 `ghcr-secret`）
- [ ] 确认镜像标签在 `kustomization.yaml` 中已更新
- [ ] 生产环境部署前确认所有测试通过

## 🔐 安全配置

### 镜像拉取密钥

所有部署都需要 `ghcr-secret` 来从 GitHub Container Registry 拉取镜像：

```bash
# 创建密钥（需要 GitHub Personal Access Token）
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-token> \
  --namespace=co-agent-dev

# 生产环境也需要创建
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-token> \
  --namespace=co-agent
```

## 🚨 故障排查

### 常见问题

1. **镜像拉取失败**：
   - 检查 `ghcr-secret` 是否存在和正确
   - 确认镜像标签是否存在于仓库中

2. **服务无法启动**：
   - 检查容器日志：`kubectl logs <pod-name> -n <namespace>`
   - 检查资源限制是否合理

3. **服务间通信失败**：
   - 确认服务发现配置正确
   - 检查网络策略和防火墙规则

### 监控和告警

建议配置以下监控：
- Pod 健康状态监控
- 资源使用率监控
- 应用性能监控
- 日志聚合和分析

## 📚 相关文档

- [项目主文档](../README.md)
- [开发指南](../CLAUDE.md)
- [Kubernetes 官方文档](https://kubernetes.io/docs/)
- [Kustomize 官方文档](https://kustomize.io/)