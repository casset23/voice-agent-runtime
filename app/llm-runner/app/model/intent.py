from typing import Any

from pydantic import BaseModel, Field


class IntentRequest(BaseModel):
    text: str = Field(
        ..., title='用户输入', description='用户上传的音频，经过语音识别转换为的文本', max_length=1000, min_length=2
    )
    session_id: str = Field(
        ..., title='代表每次会话的唯一标识', min_length=1, max_length=128
    )
    metadata: dict[str, Any]


class ToolInfo(BaseModel):
    name: str = Field(
        ...,
        title='工具名称',
        description='让大模型选择的工具名称，也作为工具的服务名',
    )
    category: str
    parameters: dict[str, Any]


class IntentResponse(BaseModel):
    tools: list[ToolInfo]
    session_id: str = Field(
        ..., title='代表每次会话的唯一标识', min_length=1, max_length=128
    )
    metadata: dict[str, Any]
