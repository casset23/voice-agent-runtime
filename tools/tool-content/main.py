import logging
from enum import Enum
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

__version__ = '0.1.0'
__vendor__ = 'internal'
logger = logging.getLogger(__name__)

app = FastAPI()

# 确保正确处理UTF-8编码
import sys
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')


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


class CategoryEnum(str, Enum):
    MORAL_STORIES = 'Moral-stories'
    ANCIENT_POETRY = 'Ancient-poetry'
    CLASSICAL_CHINESE_ENLIGHTENMENT = 'Classical-Chinese-Enlightenment'
    CHILDREN_STORY = 'children-story'


# 主参数模型 - 直接接受name和type字段
class SearchParameters(BaseModel):
    type: str | None = Field(None, description="四个类型:Moral-stories(道德故事),Ancient-poetry(古诗),Classical-Chinese-Enlightenment(国学启蒙),children-story(儿童故事)")
    name: str | None = Field(None, description="内容的具体名字,如:论语")


class ToolRequest[T](BaseModel):
    parameters: T = Field(..., title='工具参数', description='工具自定义参数')
    metadata: dict[str, Any] = Field(..., title='上下文信息', description='上下文信息，结构不固定')
    session_id: str = Field(..., title='会话ID', description='用于追踪整个调用链的唯一标识')


class ToolInfo(BaseModel):
    name: str
    category: str
    version: str | None = __version__
    vendor: str | None = __vendor__


class ContentData(BaseModel):
    command: str = Field(..., description="发送给内容播放系统的播放命令")
    category: str = Field(..., description="内容类别")


class ToolResult(BaseModel):
    data: ContentData = Field(..., title='结构化数据', description='工具直接生成的结构化结果')
    text: str = Field(..., title='播报文本', description='最终可以播报的话术')
    needs_utterance: bool = Field(..., title='是否需要播报', description='是否需要进行话术生成')


class ToolResponse(BaseModel):
    tool: ToolInfo
    result: ToolResult
    metadata: dict[str, Any]
    session_id: str


def get_self_info(category: str) -> ToolInfo:
    """Get tool information."""
    return ToolInfo(name='tool-content', category=category, version=__version__, vendor=__vendor__)


@app.post('/v1/invoke/search', response_model=ToolResponse)
async def invoke_search(rpc_body: ToolRequest[SearchParameters]) -> ToolResponse:
    """
    处理故事内容播放请求
    
    输出命令格式：
    - 有具体名称时: 直接输出具体名称 (如: "论语", "三字经")
    - 只有类型描述时，根据类型输出：
      - Moral-stories: "道德故事"
      - Ancient-poetry: "古诗"
      - Classical-Chinese-Enlightenment: "国学启蒙"
      - children-story: "儿童故事"
    - 无参数时: "儿童故事"
    
    示例：
    - "有教育意义的故事" → "道德故事"
    - "论语" → "论语"
    - "国学故事" → "国学启蒙"
    """
    session_id = rpc_body.session_id
    metadata = rpc_body.metadata
    params = rpc_body.parameters
    
    # 根据参数生成搜索命令
    if params.name:
        # 有具体名称时，直接输出名称
        command = params.name
    elif params.type:
        # 只有类型时，根据类型输出
        if params.type == "Moral-stories":
            command = "道德故事"
        elif params.type == "Ancient-poetry":
            command = "古诗"
        elif params.type == "Classical-Chinese-Enlightenment":
            command = "国学启蒙"
        elif params.type == "children-story":
            command = "儿童故事"
        else:
            command = "儿童故事"  # 未知类型时的默认值
    else:
        command = "儿童故事"  # 无参数时的默认值
    
    result = ToolResult(
        data=ContentData(command=command, category="search"),
        text=f"正在为您播放内容: {command}",
        needs_utterance=False
    )
    
    print(f"内容播放命令: {command}")
    
    return ToolResponse(
        tool=get_self_info("search"),
        result=result,
        metadata=metadata,
        session_id=session_id
    )


@app.post('/v1/invoke/{category}', response_model=ToolResponse)
async def invoke_by_category(category: str, rpc_body: ToolRequest[SearchParameters]) -> ToolResponse:
    """
    处理按类别调用的故事内容播放请求
    
    这个端点用于兼容 Agent Gateway 的动态调用方式
    """
    session_id = rpc_body.session_id
    metadata = rpc_body.metadata
    params = rpc_body.parameters
    
    # 根据参数生成搜索命令
    if params.name:
        # 有具体名称时，直接输出名称
        command = params.name
    elif params.type:
        # 只有类型时，根据类型输出
        if params.type == "Moral-stories":
            command = "道德故事"
        elif params.type == "Ancient-poetry":
            command = "古诗"
        elif params.type == "Classical-Chinese-Enlightenment":
            command = "国学启蒙"
        elif params.type == "children-story":
            command = "儿童故事"
        else:
            command = "儿童故事"  # 未知类型时的默认值
    else:
        # 如果没有参数，根据category推断
        if category == "Moral-stories":
            command = "道德故事"
        elif category == "Ancient-poetry":
            command = "古诗"
        elif category == "Classical-Chinese-Enlightenment":
            command = "国学启蒙"
        elif category == "children-story":
            command = "儿童故事"
        else:
            command = "儿童故事"  # 未知类型时的默认值
    
    result = ToolResult(
        data=ContentData(command=command, category=category),
        text=f"正在为您播放内容: {command}",
        needs_utterance=False
    )
    
    print(f"内容播放命令: {command} (category: {category})")
    
    return ToolResponse(
        tool=get_self_info(category),
        result=result,
        metadata=metadata,
        session_id=session_id
    )




if __name__ == '__main__':
    import uvicorn
    
    uvicorn.run('main:app', host='0.0.0.0', port=30017, reload=True)