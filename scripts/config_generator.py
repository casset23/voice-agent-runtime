#!/usr/bin/env python3
"""
Co-Agent 配置文件生成器
根据环境自动生成和更新各个服务的配置文件
"""

import yaml
import json
import argparse
from pathlib import Path
from typing import Dict, Any

class ConfigGenerator:
    def __init__(self, config_path: str = "co-agent/config/services.yaml"):
        self.config_path = Path(config_path)
        self.config = self.load_config()
    
    def load_config(self) -> dict:
        """加载主配置文件"""
        with open(self.config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def generate_env_config(self, env: str = "development") -> Dict[str, str]:
        """生成环境配置"""
        host = self.config['env'][env]['host']
        
        env_config = {
            'HOST': host,
            'ENV': env,
        }
        
        # 添加各服务端口
        for service_name, service_info in self.config.get('services', {}).items():
            port_key = f"{service_name.upper().replace('-', '_')}_PORT"
            env_config[port_key] = str(service_info['port'])
        
        for tool_name, tool_info in self.config.get('tools', {}).items():
            port_key = f"{tool_name.upper().replace('-', '_')}_PORT"
            env_config[port_key] = str(tool_info['port'])
        
        return env_config
    
    def generate_agent_gateway_config(self, env: str = "development") -> str:
        """生成 Agent Gateway 的 Rust 配置文件"""
        host = self.config['env'][env]['host']
        gateway_config = self.config['services']['agent-gateway']
        connections = gateway_config['connections']
        
        # 替换 localhost 为实际host
        rust_config = f'''/// 微服务拓扑配置
pub struct Services {{
    pub llm_runner_api: &'static str,
    pub tool_weather_api: &'static str,
    pub tool_datetime_api: &'static str,
    pub tool_music_api: &'static str,
    pub tool_content_api: &'static str,
}}

/// 全局服务配置实例  
pub static SERVICES: Services = Services {{
    llm_runner_api: "{connections['llm_runner_api'].replace('localhost', host)}",
    tool_weather_api: "{connections['tool_weather_api'].replace('localhost', host)}",
    tool_datetime_api: "{connections['tool_datetime_api'].replace('localhost', host)}",
    tool_music_api: "{connections['tool_music_api'].replace('localhost', host)}",
    tool_content_api: "{connections['tool_content_api'].replace('localhost', host)}",
}};
'''
        return rust_config
    
    def generate_dashboard_api_config(self, env: str = "development") -> str:
        """生成 Dashboard 的 API 配置"""
        host = self.config['env'][env]['host']
        dashboard_config = self.config['services']['dashboard']
        api_base_url = dashboard_config['connections']['api_base_url'].replace('localhost', host)
        
        ts_config = f'''import wrench from "wretch";

/**
 * 统一的 API 客户端对象
 */
export const apiClient = wrench("{api_base_url}", {{
\theaders: {{
\t\t"Content-Type": "application/json",
\t}},
}});
'''
        return ts_config
    
    def generate_dashboard_vite_config(self, env: str = "development") -> str:
        """生成 Dashboard 的 Vite 配置"""
        host = self.config['env'][env]['host']
        dashboard_config = self.config['services']['dashboard']
        api_base_url = dashboard_config['connections']['api_base_url'].replace('localhost', host)
        
        vite_config = f'''import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {{ defineConfig }} from "vite";

// https://vite.dev/config/
export default defineConfig({{
\tplugins: [react(), tailwindcss()],
\tresolve: {{
\t\talias: {{
\t\t\t"@": "/src",
\t\t}},
\t}},
\tserver: {{
\t\tproxy: {{
\t\t\t"/api": {{
\t\t\t\ttarget: "{api_base_url}",
\t\t\t\tchangeOrigin: true,
\t\t\t\trewrite: (path) => path.replace(/^\\/api/, ""),
\t\t\t}},
\t\t}},
\t}},
}});
'''
        return vite_config
    
    def generate_llm_runner_env(self, env: str = "development") -> str:
        """生成 LLM Runner 的环境配置"""
        host = self.config['env'][env]['host']
        llm_runner_config = self.config['services']['llm-runner']
        
        env_vars = llm_runner_config.get('environment', {})
        resource_registry_url = env_vars['RESOURCE_REGISTRY_BASE_URL'].replace('localhost', host)
        
        env_content = f'''# LLM Runner 环境配置
RESOURCE_REGISTRY_BASE_URL={resource_registry_url}
ENV={env}
'''
        return env_content
    
    def generate_docker_compose(self, env: str = "development") -> str:
        """生成 Docker Compose 配置"""
        docker_config = self.config.get('deployment', {}).get('docker', {})
        
        compose_content = f'''version: '3.8'

services:
'''
        
        # 添加所有服务
        all_services = {}
        all_services.update(self.config.get('services', {}))
        all_services.update(self.config.get('tools', {}))
        
        for service_name, service_info in all_services.items():
            if service_name in docker_config:
                port_mapping = docker_config[service_name]
                compose_content += f'''  {service_name}:
    build: ./{service_info['path']}
    ports:
      - "{port_mapping}"
    environment:
      - ENV={env}
'''
                
                # 添加依赖关系
                if 'dependencies' in service_info and service_info['dependencies']:
                    compose_content += f'''    depends_on:
'''
                    for dep in service_info['dependencies']:
                        compose_content += f'''      - {dep}
'''
                
                compose_content += "\\n"
        
        return compose_content
    
    def generate_kubernetes_configs(self, env: str = "production") -> Dict[str, str]:
        """生成 Kubernetes 配置文件"""
        k8s_config = self.config.get('deployment', {}).get('kubernetes', {})
        namespace = k8s_config.get('namespace', 'co-agent')
        service_type = k8s_config.get('service_type', 'ClusterIP')
        
        configs = {}
        
        # 生成 namespace
        configs['namespace.yaml'] = f'''apiVersion: v1
kind: Namespace
metadata:
  name: {namespace}
'''
        
        # 为每个服务生成 deployment 和 service
        all_services = {}
        all_services.update(self.config.get('services', {}))
        all_services.update(self.config.get('tools', {}))
        
        for service_name, service_info in all_services.items():
            # Deployment
            configs[f'{service_name}-deployment.yaml'] = f'''apiVersion: apps/v1
kind: Deployment
metadata:
  name: {service_name}
  namespace: {namespace}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: {service_name}
  template:
    metadata:
      labels:
        app: {service_name}
    spec:
      containers:
      - name: {service_name}
        image: {service_name}:latest
        ports:
        - containerPort: {service_info['port']}
        env:
        - name: ENV
          value: "{env}"
'''
            
            # Service
            configs[f'{service_name}-service.yaml'] = f'''apiVersion: v1
kind: Service
metadata:
  name: {service_name}
  namespace: {namespace}
spec:
  selector:
    app: {service_name}
  ports:
  - port: {service_info['port']}
    targetPort: {service_info['port']}
  type: {service_type}
'''
        
        return configs
    
    def update_all_configs(self, env: str = "development"):
        """更新所有配置文件"""
        print(f"🔧 为 {env} 环境更新配置文件...")
        
        # 1. 更新 Agent Gateway 配置
        gateway_config = self.generate_agent_gateway_config(env)
        gateway_path = Path("co-agent/app/agent-gateway/src/services.rs")
        with open(gateway_path, 'w', encoding='utf-8') as f:
            f.write(gateway_config)
        print(f"✅ 更新了 {gateway_path}")
        
        # 2. 更新 Dashboard API 配置
        api_config = self.generate_dashboard_api_config(env)
        api_path = Path("co-agent/app/dashboard/src/utils/api.ts")
        with open(api_path, 'w', encoding='utf-8') as f:
            f.write(api_config)
        print(f"✅ 更新了 {api_path}")
        
        # 3. 更新 Dashboard Vite 配置
        vite_config = self.generate_dashboard_vite_config(env)
        vite_path = Path("co-agent/app/dashboard/vite.config.ts")
        with open(vite_path, 'w', encoding='utf-8') as f:
            f.write(vite_config)
        print(f"✅ 更新了 {vite_path}")
        
        # 4. 更新 LLM Runner 环境配置
        llm_env_config = self.generate_llm_runner_env(env)
        llm_env_path = Path("co-agent/app/llm-runner/.env")
        with open(llm_env_path, 'w', encoding='utf-8') as f:
            f.write(llm_env_config)
        print(f"✅ 更新了 {llm_env_path}")
        
        # 5. 生成环境变量文件
        env_config = self.generate_env_config(env)
        env_path = Path(f"co-agent/.env.{env}")
        with open(env_path, 'w', encoding='utf-8') as f:
            for key, value in env_config.items():
                f.write(f"{key}={value}\\n")
        print(f"✅ 生成了 {env_path}")
        
        # 6. 生成 Docker Compose (如果是production环境)
        if env == "production":
            docker_compose = self.generate_docker_compose(env)
            docker_path = Path("co-agent/docker-compose.yml")
            with open(docker_path, 'w', encoding='utf-8') as f:
                f.write(docker_compose)
            print(f"✅ 生成了 {docker_path}")
            
            # 7. 生成 Kubernetes 配置
            k8s_configs = self.generate_kubernetes_configs(env)
            k8s_dir = Path("co-agent/deploy/kubernetes/generated")
            k8s_dir.mkdir(parents=True, exist_ok=True)
            
            for filename, content in k8s_configs.items():
                k8s_file = k8s_dir / filename
                with open(k8s_file, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"✅ 生成了 {k8s_file}")
        
        print("✅ 所有配置文件更新完成!")

def main():
    parser = argparse.ArgumentParser(description="Co-Agent 配置文件生成器")
    parser.add_argument("--env", default="development", 
                       choices=["development", "production"],
                       help="目标环境")
    parser.add_argument("--config", default="co-agent/config/services.yaml",
                       help="主配置文件路径")
    
    args = parser.parse_args()
    
    try:
        generator = ConfigGenerator(args.config)
        generator.update_all_configs(args.env)
    except Exception as e:
        print(f"❌ 配置生成失败: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
