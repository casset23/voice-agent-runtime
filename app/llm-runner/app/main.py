import json
import logging
import os
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from starlette.responses import Response

from app.llm.client import Client
from app.model.intent import IntentRequest, IntentResponse, ToolInfo

logger = logging.getLogger(__name__)


tools_file = os.path.join(os.path.dirname(__file__), 'tool-ris.json')
with open(tools_file, encoding='utf-8') as f:
    tools = json.load(f)  # 本地回退用

# 全局降噪：屏蔽三方库的调试/信息日志
logging.getLogger('openai').setLevel(logging.WARNING)
logging.getLogger('openai._base_client').setLevel(logging.WARNING)
logging.getLogger('httpx').setLevel(logging.WARNING)

# 支持从 resource-registry 动态拉取 runner 配置（失败时回退到本地配置）
RESOURCE_REGISTRY_BASE_URL = os.getenv('RESOURCE_REGISTRY_BASE_URL') or 'http://localhost:3001'




class HealthCheckFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return '/health' not in record.getMessage()


uvicorn_access_logger = logging.getLogger('uvicorn.access')
uvicorn_access_logger.addFilter(HealthCheckFilter())


async def load_runner_configs() -> None:
    """从资源中心拉取工具与 LLM 配置，失败则保留现有配置。"""
    global tools
    async with httpx.AsyncClient(timeout=5.0) as client:
        # 工具
        tr = await client.get(f"{RESOURCE_REGISTRY_BASE_URL}/runner/api/tools/config")
        if tr.status_code == 200:
            data = tr.json() or {}
            items = data.get('items') or []
            if isinstance(items, list) and items:
                tools = items
                logger.info("已从 resource-registry 加载 %d 个工具定义", len(items))

        # LLM 配置
        lr = await client.get(f"{RESOURCE_REGISTRY_BASE_URL}/runner/api/llms/config")
        if lr.status_code == 200:
            data = lr.json() or {}
            items = data.get('items') or []
            await Client.configure_from_runner(items)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    """Application lifespan manager: 在启动时拉取 tools 与 LLM 配置。"""
    global tools
    try:
        await load_runner_configs()
    except Exception as e:
        logger.warning("启动时加载 runner 配置失败，使用本地回退: %s", e)

    logger.info("可用模型: %s; 默认模型: %s", Client.get_available_models(), Client.get_default_model())
    # 服务就绪提示（简洁且稳定）
    try:
        port = os.getenv('PORT') or '30011'
        print(f"LLM Runner ready: port={port} tools={len(tools)} default_model={Client.get_default_model()}")
    except Exception:
        pass
    try:
        yield
    finally:
        await Client.close_all()


app = FastAPI(
    title='LLM Runner',
    description='封装 LLM 的项目，以及做了很多关于 ai agent 的扩展',
    version='0.1.0',
    lifespan=lifespan,
)


@app.get('/health')
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {'status': 'ok'}


@app.post('/v1/intent', response_model=IntentResponse)
async def intent(request_body: IntentRequest, response: Response) -> IntentResponse:
    """Process intent request and return tool calls."""
    session_id = request_body.session_id

    if not session_id:
        raise HTTPException(status_code=400, detail={'code': 10000, 'messages': 'session_id is required.'})

    logger.info(f'收到会话 {session_id} 的新请求...')

    tool_calls = []
    t0 = time.perf_counter()

    try:
        # 直接用构造函数创建 LLM 客户端（已支持从 resource-registry 动态配置）
        model = request_body.metadata.get('model') if request_body.metadata else None
        llm_client = Client(model)
        llm_result = await llm_client.get_tools(request_body.text, tools)
    except Exception as e:
        logger.error(f'LLM服务调用异常: {e}')
        import traceback

        logger.error(f'异常详情: {traceback.format_exc()}')

        # 还原：发生异常时返回 500，保持原有响应体格式
        response.status_code = 500
        return IntentResponse(tools=[], session_id=session_id, metadata=request_body.metadata)

    # LLM调用成功，处理响应结果
    choices = llm_result.get('choices', [])
    if choices and hasattr(choices[0], 'message'):
        message = choices[0].message
        if hasattr(message, 'tool_calls') and message.tool_calls:
            for tool_call in message.tool_calls:
                try:
                    function_name = tool_call.function.name
                    parameters = json.loads(tool_call.function.arguments) if tool_call.function.arguments else {}
                    
                    # 添加调试信息
                    logger.info(f'工具调用: {function_name}, 原始参数: {parameters}')

                    # 动态解析工具名称和类别
                    parts = function_name.split('_')
                    if len(parts) >= 2 and parts[0] == 'tool':
                        tool_name = f'tool-{parts[1]}'  # tool-weather
                        
                        # 从参数中提取category和实际参数
                        category = "default"
                        actual_parameters = parameters
                        
                        # 检查参数中是否包含嵌套结构
                        if parameters:
                            # 查找第一个非空的值作为category
                            for key, value in parameters.items():
                                if value is not None and value != {}:
                                    category = key  # now, forecast, time, date, kugou等
                                    actual_parameters = value  # 实际的参数
                                    break
                            else:
                                # 如果parameters中只有一个空的key，可能LLM直接把category作为key传递
                                if len(parameters) == 1:
                                    category_key = list(parameters.keys())[0]
                                    if category_key and parameters[category_key] == {}:
                                        category = category_key
                                        actual_parameters = {}
                        tool_calls.append(ToolInfo(name=tool_name, category=category, parameters=actual_parameters))
                except (json.JSONDecodeError, AttributeError, IndexError) as e:
                    logger.warning(f'解析工具调用失败，跳过该工具: {function_name}, 错误: {e}')
                    continue

    metadata = request_body.metadata
    metadata['timestamp'] = int(time.time() * 1000)

    # 打印：选择的工具与参数 + 从请求到选出工具的总耗时
    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    if tool_calls:
        first = tool_calls[0]
        try:
            params_str = json.dumps(first.parameters, ensure_ascii=False)
        except Exception:
            params_str = str(first.parameters)
        print(f"intent elapsed_ms={elapsed_ms} tool={first.name} category={first.category} params={params_str}")
    else:
        print(f"intent elapsed_ms={elapsed_ms} tool=none")

    # 构建响应
    response_data = IntentResponse(tools=tool_calls, session_id=session_id, metadata=metadata)
    
    # 打印完整的响应JSON
    response_json = response_data.model_dump()
    print(json.dumps(response_json, ensure_ascii=False, indent=2), flush=True)
    
    return response_data


@app.post('/v1/reload')
async def reload_runner_config() -> dict[str, object]:
    try:
        await load_runner_configs()
        return {
            'ok': True,
            'models': Client.get_available_models(),
            'defaultModel': Client.get_default_model(),
            'toolsCount': len(tools),
        }
    except Exception as e:
        logger.error('热刷新失败: %s', e)
        raise HTTPException(status_code=500, detail='reload failed')


        

if __name__ == '__main__':
    import uvicorn

    uvicorn.run('app.main:app', host='0.0.0.0', port=30011, reload=True)
