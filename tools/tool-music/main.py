import logging
from enum import Enum
from typing import Any, Union

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
    PLAY_MUSIC = 'play_music'
    CHILDREN = 'children'
    STORY = 'story'
    DANCE = 'dance'
    WHITENOISE = 'whitenoise'
    OPERA = 'opera'
    BUDDHIST = 'buddhist'
    CANTONESE = 'cantonese'


# 参数模型
class PlayMusicParameters(BaseModel):
    a: str | None = Field(None, description="歌手名字")
    s: str | None = Field(None, description="歌曲名称或具体音频内容名称，如'青花瓷'、'大悲咒'、'海浪'、'下雨'、'森林'、'爵士舞音乐'等。当用户提到具体的音频内容时，需要提取这个参数")
    s_t: str | None = Field(None, description="歌曲的类型，可以与s参数同时使用。当识别出特定类型的内容时，应该同时填写此参数。歌曲类型包括：children(儿歌等儿童音乐),dance(舞蹈音乐),whitenoise(白噪音、自然声音，如海浪声、下雨声、森林声等),opera(戏曲音乐),buddhist(佛经音频),cantonese(粤语歌曲)。例如：'海浪声'应该填写s='海浪',s_t='whitenoise'")


class ToolRequest[T](BaseModel):
    parameters: T = Field(..., title='工具参数', description='工具自定义参数')
    metadata: dict[str, Any] = Field(..., title='上下文信息', description='上下文信息，结构不固定')
    session_id: str = Field(..., title='会话ID', description='用于追踪整个调用链的唯一标识')


class ToolInfo(BaseModel):
    name: str
    category: str
    version: str | None = __version__
    vendor: str | None = __vendor__


class MusicData(BaseModel):
    command: str = Field(..., description="发送给酷狗音乐的搜索命令")
    category: str = Field(..., description="音乐类别")


class ToolResult(BaseModel):
    data: MusicData = Field(..., title='结构化数据', description='工具直接生成的结构化结果')
    text: str = Field(..., title='播报文本', description='最终可以播报的话术')
    needs_utterance: bool = Field(..., title='是否需要播报', description='是否需要进行话术生成')


class ToolResponse(BaseModel):
    tool: ToolInfo
    result: ToolResult
    metadata: dict[str, Any]
    session_id: str


def get_self_info(category: CategoryEnum) -> ToolInfo:
    """Get tool information."""
    return ToolInfo(name='tool-music', category=category, version=__version__, vendor=__vendor__)



@app.post('/v1/invoke/play_music', response_model=ToolResponse)
async def invoke_play_music(rpc_body: ToolRequest[PlayMusicParameters]) -> ToolResponse:
    """
    处理音乐播放请求
    
    输出命令格式：
    - 有a和s参数时: "{a} {s}" (如: "周杰伦 青花瓷")  
    - 有s和s_t参数时: "{类型}: {s}" (如: "白噪音: 海浪"、"佛经: 大悲咒")
    - 只有s参数时: "{s}" (如: "青花瓷"、"爵士舞音乐")
    - 只有a参数时: "{a}的歌" (如: "周杰伦的歌")
    - 只有s_t参数时根据类型输出：
      - children: "儿歌"
      - dance: "舞蹈音乐"
      - whitenoise: "白噪音"
      - opera: "戏曲"
      - buddhist: "佛经"
      - cantonese: "粤语歌曲"
    - 无参数时: "热门音乐"
    """
    session_id = rpc_body.session_id
    metadata = rpc_body.metadata
    params = rpc_body.parameters
    
    # 根据参数生成搜索命令  
    if params.s and params.a:
        # 有歌手和歌曲名时，直接输出"歌手名 歌曲名"
        command = f"{params.a} {params.s}"
    elif params.s and params.s_t:
        # 有具体名称和类型时，输出"类型: 具体名称"
        if params.s_t == "children":
            command = f"儿歌: {params.s}"
        elif params.s_t == "dance":
            command = f"舞蹈音乐: {params.s}"
        elif params.s_t == "whitenoise":
            command = f"白噪音: {params.s}"
        elif params.s_t == "opera":
            command = f"戏曲: {params.s}"
        elif params.s_t == "buddhist":
            command = f"佛经: {params.s}"
        elif params.s_t == "cantonese":
            command = f"粤语歌曲: {params.s}"
        else:
            command = f"音乐: {params.s}"
    elif params.s:
        # 只有歌曲名时，直接输出歌曲名
        command = params.s
    elif params.a:
        # 只有歌手名时
        command = f"{params.a}的歌"
    elif params.s_t:
        # 只有类型时，根据歌曲类型生成搜索命令
        if params.s_t == "children":
            command = "儿歌"
        elif params.s_t == "dance":
            command = "舞蹈音乐"
        elif params.s_t == "whitenoise":
            command = "白噪音"
        elif params.s_t == "opera":
            command = "戏曲"
        elif params.s_t == "buddhist":
            command = "佛经"
        elif params.s_t == "cantonese":
            command = "粤语歌曲"
        else:
            command = "热门音乐"  # 未知类型时的默认值
    else:
        command = "热门音乐"  # 无参数时的默认值
      
    
    result = ToolResult(
        data=MusicData(command=command, category="play_music"),
        text=f"正在为您播放音乐: {command}",
        needs_utterance=False
    )
    
    print(f"音乐搜索命令: {command}")
    
    response_data = ToolResponse(
        tool=get_self_info(CategoryEnum.PLAY_MUSIC),
        result=result,
        metadata=metadata,
        session_id=session_id
    )
    
    return response_data





if __name__ == '__main__':
    import uvicorn
    
    uvicorn.run('main:app', host='0.0.0.0', port=30016, reload=True)