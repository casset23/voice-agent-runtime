# 测试说明

## Python 服务

在仓库根目录运行：

```bash
python -m pip install -r requirements-public-check.txt
python -m unittest discover -s tests -v
python -m compileall -q app/llm-runner tools
```

10 个测试覆盖服务配置、工具调用映射、输入与失败响应、日期时间 API，以及模型客户端生命周期。

| 生命周期用例 | 检查内容 |
| --- | --- |
| 空闲回收 | 配置刷新后关闭空闲旧客户端 |
| 在途请求 | 旧请求完成前保持连接可用，结束后关闭 |
| 失败回滚 | 新表构建失败时保留旧表，清理部分创建的连接 |
| 客户端复用 | 已有包装对象在下一次调用中解析新注册表 |
| 服务关闭 | 释放当前空闲连接 |
| 关闭时在途请求 | 请求结束后释放对应连接 |

模型网络通过 Mock 隔离，日期时间测试调用服务接口逻辑。

## TypeScript 与 Rust

- `app/dashboard`：`pnpm run build`。
- `app/resource-registry`：`pnpm run build`、`pnpm exec jest --runInBand`。
- `app/agent-gateway`：`cargo check --locked`、`cargo test --locked`。

上述任务通过 GitHub Actions 执行，完整日志见 [CI](https://github.com/casset23/voice-agent-runtime/actions)。资源管理界面通过 Dashboard、NestJS 与 SQLite 联调检查配置读写。
