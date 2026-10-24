import os
import collections
import logging
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from enum import Enum
from typing import Any

import aiohttp
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Application lifespan manager."""
    app.state.aiohttp_session = aiohttp.ClientSession()
    yield
    await app.state.aiohttp_session.close()


app = FastAPI(lifespan=lifespan)

__version__ = '0.1.0'
__vendor__ = 'internal'
logger = logging.getLogger(__name__)


class HealthCheckFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return '/health' not in record.getMessage()


# 应用过滤器到 uvicorn.access
uvicorn_access_logger = logging.getLogger('uvicorn.access')
uvicorn_access_logger.addFilter(HealthCheckFilter())


@app.get('/health')
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {'status': 'ok'}


class TypeEnum(str, Enum):
    NOW = 'now'
    FORECAST = 'forecast'
    HOURLY = 'hourly'


class ToolNowParameters(BaseModel):
    city: str | None = Field(None, title='城市', description='城市名称')


class ToolForecastParameters(BaseModel):
    days: int = Field(..., title='天数', description='未来多少天')
    city: str | None = Field(None, title='城市', description='城市名称')


class ToolHourlyParameters(BaseModel):
    hours: int = Field(default=24, title='小时数', description='未来多少小时, 最多24小时')
    city: str | None = Field(None, title='城市', description='城市名称')


class ToolRequest[T](BaseModel):
    parameters: T = Field(..., title='工具参数', description='工具自定义参数')
    metadata: dict[str, Any] = Field(..., title='上下文信息', description='上下文信息，结构不固定')
    session_id: str = Field(..., title='会话ID', description='用于追踪整个调用链的唯一标识')


class ToolInfo(BaseModel):
    name: str
    category: str
    version: str | None = __version__
    vendor: str | None = __vendor__


class ToolResult[T](BaseModel):
    data: T = Field(..., title='结构化数据', description='工具直接生成的结构化结果')
    text: str = Field(..., title='播报文本', description='最终可以播报的话术')
    needs_utterance: bool = Field(..., title='是否需要播报', description='是否需要进行话术生成')


class ToolResponse[T](BaseModel):
    tool: ToolInfo
    result: ToolResult[T]
    metadata: dict[str, Any]
    session_id: str


def get_self_info(category: TypeEnum) -> ToolInfo:
    """获取工具信息."""
    return ToolInfo(name='tool-weather', category=category, version=__version__, vendor=__vendor__)


class ToolError(Exception):
    def __init__(self, code: int, message: str, details: dict[str, Any] = None) -> None:
        """自定义错误包装tools的异常情况."""
        self.code = code
        self.message = message
        self.details = details


@app.exception_handler(ToolError)
async def tool_error_handler(_: Request, exc: ToolError) -> JSONResponse:
    """全局 ToolError 异常处理器."""
    return JSONResponse(status_code=400, content={'code': exc.code, 'message': exc.message, 'details': exc.details})


def resolve_location(
    parameters: ToolNowParameters | ToolForecastParameters | ToolHourlyParameters | None,
    metadata: dict[str, Any] | None,
) -> str:
    """解析位置信息."""
    # 优先从参数取
    if parameters and parameters.city:
        return parameters.city

    # 再从 metadata 取
    location = metadata.get('location') if metadata else None
    if location and location.get('city'):
        return location.get('city')

    # 如果都没有，使用默认城市
    logger.warning("未找到位置信息，使用默认城市: 深圳")
    return "深圳"


@app.post('/v1/invoke/now')
async def invoke_now(request: Request, rpc_body: ToolRequest[ToolNowParameters]) -> ToolResponse:
    """获取当前天气.

    使用的是心知天气的

    Args:
        request: 请求对象
        rpc_body: 工具参数
    Returns:
        ToolResponse: 工具响应
    """
    url = 'https://api.seniverse.com/v3/weather/now.json'
    lang = rpc_body.metadata.get('language', 'zh-Hans')
    unit = 'c'
    metadata = rpc_body.metadata

    logger.info(f'session: {rpc_body.session_id}')

    # 直接调用，异常会被全局处理器捕获
    location = resolve_location(rpc_body.parameters, metadata)
    params = {'key': os.getenv('SENIVERSE_API_KEY', ''), 'location': location, 'language': lang, 'unit': unit}

    async with request.app.state.aiohttp_session.get(url, params=params) as resp:
        data = await resp.json()
        logger.info(f'weather data: {data}')

    # 处理元数据
    metadata['timestamp'] = int(time.time() * 1000)

    text = ''
    if data.get('results') and len(data['results']) > 0:
        text = f'当前{location}的天气是{data["results"][0]["now"]["text"]}，温度是{data["results"][0]["now"]["temperature"]}℃'
    else:
        text = f'抱歉，无法获取{location}的天气信息'

    return ToolResponse(
        tool=get_self_info(TypeEnum.NOW),
        session_id=rpc_body.session_id,
        result=ToolResult(
            data=data,
            text=f'当前{location}的天气是{data["results"][0]["now"]["text"]}，温度是{data["results"][0]["now"]["temperature"]}℃',
            needs_utterance=False,
        ),
        metadata=metadata,
    )


@app.post('/v1/invoke/forecast')
async def invoke_forecast(request: Request, rpc_body: ToolRequest[ToolForecastParameters]) -> ToolResponse:
    """获取指定日期的天气预报.

    Args:
        request: 请求对象
        rpc_body: 工具参数 (days: 1=今天, 2=明天, 3=后天, 4=大后天)
        response: 响应对象
    Returns:
        ToolResponse: 工具响应
    """
    url = 'https://api.seniverse.com/v3/weather/daily.json'
    lang = rpc_body.metadata.get('language', 'zh-Hans')
    unit = 'c'
    days = rpc_body.parameters.days
    metadata = rpc_body.metadata

    if not 1 <= days <= 4:
        raise ToolError(code=400, message='仅支持查询今天(1)到未来3天(4)的天气')

    location = resolve_location(rpc_body.parameters, metadata)
    params = {'key': os.getenv('SENIVERSE_API_KEY', ''), 'location': location, 'language': lang, 'unit': unit, 'days': days}

    async with request.app.state.aiohttp_session.get(url, params=params) as resp:
        data = await resp.json()
        logger.info(f'weather data: {data}')

    try:
        results = data['results'][0]
        daily_forecasts = results.get('daily', [])
        location_name = results.get('location', {}).get('name', location)

        if not daily_forecasts or len(daily_forecasts) < days:
            text = f'抱歉，未能查询到{location_name}指定日期的天气信息。'
        else:
            # 只返回指定天数的天气 (days=1对应索引0，days=2对应索引1等)
            target_forecast = daily_forecasts[days - 1]
            _ = target_forecast.get('date')
            text_day = target_forecast.get('text_day')
            text_night = target_forecast.get('text_night')
            high = target_forecast.get('high')
            low = target_forecast.get('low')
            wind_direction = target_forecast.get('wind_direction', '')
            wind_scale = target_forecast.get('wind_scale', '')
            humidity = target_forecast.get('humidity', '')
            rainfall = target_forecast.get('rainfall', '0')

            if days == 1:
                day_name = '今天'
            elif days == 2:
                day_name = '明天'
            elif days == 3:
                day_name = '后天'
            else:
                day_name = '大后天'

            # 生成拟人化的天气描述
            text_parts = [f'{location_name}{day_name}']

            # 天气状况
            if text_day == text_night:
                text_parts.append(f'全天{text_day}')
            else:
                text_parts.append(f'白天{text_day}，夜间{text_night}')

            # 温度
            text_parts.append(f'气温{low}-{high}℃')

            # 风力信息
            if wind_direction and wind_scale:
                text_parts.append(f'{wind_direction}{wind_scale}级风')

            # 湿度
            if humidity:
                text_parts.append(f'湿度{humidity}%')

            # 降雨量
            if rainfall and float(rainfall) > 0:
                text_parts.append(f'降雨量{rainfall}mm')

            text = '，'.join(text_parts) + '。'

    except (KeyError, IndexError, TypeError):
        text = f'抱歉，解析{location}的天气数据时出错，请稍后再试。'
        logger.error(f'Error parsing weather data for {location}: {data}')

    return ToolResponse(
        tool=get_self_info(TypeEnum.FORECAST),
        session_id=rpc_body.session_id,
        result=ToolResult(data=data, text=text, needs_utterance=False),
        metadata=metadata,
    )


@app.post('/v1/invoke/hourly')
async def invoke_hourly(request: Request, rpc_body: ToolRequest[ToolHourlyParameters]) -> ToolResponse:
    """获取逐小时天气.

    使用的是心知天气的

    Args:
        request: 请求对象
        rpc_body: 工具参数
        response: 响应对象
    Returns:
        ToolResponse: 工具响应
    """
    url = 'https://api.seniverse.com/v3/weather/hourly.json'
    lang = rpc_body.metadata.get('language', 'zh-Hans')
    unit = 'c'
    hours = rpc_body.parameters.hours
    metadata = rpc_body.metadata

    if not 0 < hours <= 24:
        raise ToolError(code=400, message='仅支持查询未来1-24小时的天气')

    # 直接调用，异常会被全局处理器捕获
    location_result = resolve_location(rpc_body.parameters, metadata)

    params = {'key': os.getenv('SENIVERSE_API_KEY', ''), 'location': location_result, 'language': lang, 'unit': unit, 'hours': hours}

    async with request.app.state.aiohttp_session.get(url, params=params) as resp:
        data = await resp.json()
        logger.info(f'weather data: {data}')

    try:
        results = data['results'][0]
        hourly_forecasts = results.get('hourly', [])
        location_name = results.get('location', {}).get('name', location_result)

        if not hourly_forecasts:
            text = f'抱歉，未能查询到{location_name}的逐小时天气信息。'
        else:
            text_parts = [f'{location_name}未来{len(hourly_forecasts)}小时的天气预报如下：']
            for forecast in hourly_forecasts:
                time_str = forecast.get('time', '')  # "2016-02-19T14:00:00+08:00"
                hour = time_str[11:13]
                text_hour = forecast.get('text')
                temperature = forecast.get('temperature')
                text_parts.append(f'{hour}点{text_hour}，气温{temperature}℃；')
            text = ' '.join(text_parts)
    except (KeyError, IndexError, TypeError):
        text = f'抱歉，解析{location_result}的天气数据时出错，请稍后再试。'
        logger.error(f'Error parsing weather data for {location_result}: {data}')

    return ToolResponse(
        tool=get_self_info(TypeEnum.HOURLY),
        session_id=rpc_body.session_id,
        result=ToolResult(data=data, text=text, needs_utterance=False),
        metadata=metadata,
    )


if __name__ == '__main__':
    import uvicorn

    uvicorn.run('main:app', host='0.0.0.0', port=30014, reload=True)
