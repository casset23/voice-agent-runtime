import datetime
import logging
from datetime import timedelta
from enum import Enum
from typing import Any

import chinese_calendar as calendar
import pytz
from fastapi import FastAPI
from pydantic import BaseModel, Field

__version__ = '0.1.0'
__vendor__ = 'internal'
logger = logging.getLogger(__name__)

app = FastAPI()


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
    TIME = 'time'
    DATE = 'date'


class ToolDateParameters(BaseModel):
    day_offset: int | None = Field(0, title='偏移天数', description='表示距离当前有多少天，正数表示未来，负数表示过去')


class ToolTimeParameters(BaseModel):
    pass


class ToolRequest[T](BaseModel):
    parameters: T = Field(..., title='工具参数', description='工具自定义参数')
    metadata: dict[str, Any] = Field(..., title='上下文信息', description='上下文信息，结构不固定')
    session_id: str = Field(..., title='会话ID', description='用于追踪整个调用链的唯一标识')


class ToolInfo(BaseModel):
    name: str
    category: str
    version: str | None = __version__
    vendor: str | None = __vendor__


class DateData(BaseModel):
    date: str  # ISO 格式，如 "2025-07-21"
    weekday: str
    holiday: str | None = None


class TimeData(BaseModel):
    time: str  # ISO 格式，如 "14:35:00"


# Data =  Union[DateData, TimeData]


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
    """Get tool information."""
    return ToolInfo(name='tool-datetime', category=category, version=__version__, vendor=__vendor__)


@app.post('/v1/invoke/date', response_model=ToolResponse[DateData])
async def invoke_date(rpc_body: ToolRequest[ToolDateParameters]) -> ToolResponse[DateData]:
    """Handle date query requests."""
    session_id = rpc_body.session_id
    metadata = rpc_body.metadata

    time_zone_str = metadata.get('time_zone', 'Asia/Shanghai')
    try:
        time_zone = pytz.timezone(time_zone_str)
        now = datetime.datetime.now(tz=time_zone)
    except pytz.UnknownTimeZoneError:
        time_zone = pytz.timezone('Asia/Shanghai')
        now = datetime.datetime.now(tz=time_zone)

    logger.info(f'识别时区成功：{time_zone_str}, session: {session_id}')

    day_offset = rpc_body.parameters.day_offset or 0
    target_date = now + timedelta(days=day_offset)

    # 日期偏移到中文映射表
    day_offset_map = {-3: '大前天', -2: '前天', -1: '昨天', 0: '今天', 1: '明天', 2: '后天', 3: '大后天'}

    target_date_text = day_offset_map.get(
        day_offset, f'{day_offset}天后' if day_offset > 0 else f'{abs(day_offset)}天前'
    )

    weekday = '星期' + '一二三四五六日'[target_date.weekday()]
    on_holiday, holiday_name = calendar.get_holiday_detail(target_date)

    text = f'{target_date_text}是{target_date.year}年{target_date.month}月{target_date.day}日，{weekday}。'
    if on_holiday:
        text = f'{target_date_text}是{target_date.year}年{target_date.month}月{target_date.day}日，{weekday}，{holiday_name}。'

    date_str = target_date.strftime('%Y-%m-%d')
    result = ToolResult(
        data=DateData(date=date_str, weekday=weekday, holiday=holiday_name if on_holiday else None),
        text=text,
        needs_utterance=False,
    )

    # 处理元数据
    metadata['timestamp'] = int(now.timestamp() * 1000)

    return ToolResponse(
        tool=get_self_info(TypeEnum.DATE),
        result=result,
        metadata=metadata,
        session_id=session_id,
    )


@app.post('/v1/invoke/time', response_model=ToolResponse[TimeData])
async def invoke_time(rpc_body: ToolRequest[ToolTimeParameters]) -> ToolResponse[TimeData]:
    """Handle time query requests."""
    session_id = rpc_body.session_id
    metadata = rpc_body.metadata

    time_zone_str = metadata.get('time_zone', 'Asia/Shanghai')
    try:
        time_zone = pytz.timezone(time_zone_str)
        now = datetime.datetime.now(tz=time_zone)
    except pytz.UnknownTimeZoneError:
        time_zone = pytz.timezone('Asia/Shanghai')
        now = datetime.datetime.now(tz=time_zone)

    time_str = now.strftime('%H:%M:%S')
    result = ToolResult(
        data=TimeData(time=time_str),
        text=f'现在是{time_str}。',
        needs_utterance=False,
    )

    # 处理元数据
    metadata['timestamp'] = int(now.timestamp() * 1000)

    return ToolResponse(
        tool=get_self_info(TypeEnum.TIME),
        result=result,
        metadata=metadata,
        session_id=session_id,
    )


if __name__ == '__main__':
    import uvicorn

    uvicorn.run('main:app', host='0.0.0.0', port=30015, reload=True)
