import os
import logging
from typing import Any, Dict, List

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

tool_system_prompt = """
(/no_think)你是智能音箱意图助手，专为用户挑选合适工具。
"""


class Client:
    """LLM 客户端

    负责管理和调用不同的 LLM 模型服务
    """

    # 默认模型配置（可在运行时通过 configure_from_runner 覆盖）
    DEFAULT_MODEL: str = 'doubao-1-5-pro-32k-250115'

    # 模型配置注册表（可在运行时通过 configure_from_runner 覆盖）
    _CLIENTS: Dict[str, Dict[str, Any]] = {
        'Qwen/Qwen3-0.6B': {
            '_client': AsyncOpenAI(
                api_key=os.getenv('LOCAL_LLM_API_KEY', 'not-required'),
                base_url=os.getenv('LOCAL_LLM_BASE_URL', 'http://127.0.0.1:8000/v1'),
            ),
            'is_location': False,
        },
        'doubao-1-5-pro-32k-250115': {
            '_client': AsyncOpenAI(
                api_key=os.getenv('ARK_API_KEY', 'not-configured'),
                base_url='https://ark.cn-beijing.volces.com/api/v3',
            ),
            'is_location': True,
        },
        'deepseek-chat': {
            '_client': AsyncOpenAI(
                api_key=os.getenv('DEEPSEEK_API_KEY', 'not-configured'),
                base_url='https://api.deepseek.com/v1',
            ),
            'is_location': False,
        },
    }

    _active: Dict[int, int] = {}
    _retired: Dict[int, Any] = {}

    @classmethod
    async def configure_from_runner(cls, items: List[Dict[str, Any]]) -> None:
        """替换模型注册表，在途调用结束后回收旧连接。"""
        registry: Dict[str, Dict[str, Any]] = {}
        try:
            for item in items or []:
                model_key = item.get('model') or item.get('id')
                base_url = item.get('baseUrl')
                api_key = item.get('apiKey')
                if not model_key or not base_url:
                    continue
                if model_key in registry:
                    raise ValueError('Duplicate model key in runner configuration')
                registry[model_key] = {
                    '_client': AsyncOpenAI(api_key=api_key or 'not-required', base_url=base_url),
                    'is_location': bool(item.get('isLocal')),
                }
        except Exception:
            for config in registry.values():
                await config['_client'].close()
            raise

        if registry:
            previous = cls._CLIENTS
            cls._CLIENTS = registry
            # 默认模型优先使用第一个 enabled 项的 model
            cls.DEFAULT_MODEL = next(iter(registry.keys()))
            for config in previous.values():
                client = config['_client']
                cls._retired[id(client)] = client
            for key in list(cls._retired):
                await cls._close_if_idle(key)
            logger.info("LLM 客户端已从 runner 配置加载：%s", list(registry.keys()))
        else:
            logger.warning("Runner 未返回可用 LLM 配置，继续使用内置默认配置。")

    @classmethod
    async def _close_if_idle(cls, key: int) -> None:
        if cls._active.get(key, 0) or key not in cls._retired:
            return
        client = cls._retired.pop(key)
        try:
            await client.close()
        except Exception:
            cls._retired[key] = client
            logger.warning('Failed to close a retired model client')

    @classmethod
    async def close_all(cls) -> None:
        for config in cls._CLIENTS.values():
            client = config['_client']
            cls._retired[id(client)] = client
        for key in list(cls._retired):
            await cls._close_if_idle(key)



    def __init__(self, model_key: str | None = None):
        """初始化 LLM 客户端

        Args:
            model_key: 模型标识符，为空时使用默认模型
        """
        self.model = self._resolve_model(model_key)
        self.current_clients = self._CLIENTS[self.model]['_client']

    def _resolve_model(self, model_key: str | None) -> str:
        """解析模型键，处理默认值和回退逻辑

        Args:
            model_key: 待解析的模型键

        Returns:
            str: 有效的模型键
        """
        if not model_key:
            return self.DEFAULT_MODEL

        if self.is_model_available(model_key):
            return model_key

        logger.warning(
            "模型 '%s' 不存在，可用模型: %s，回退到默认模型 '%s'",
            model_key,
            self.get_available_models(),
            self.DEFAULT_MODEL,
        )
        return self.DEFAULT_MODEL

    @classmethod
    def is_model_available(cls, model_key: str) -> bool:
        return model_key in cls._CLIENTS

    @classmethod
    def get_available_models(cls) -> list[str]:
        return list(cls._CLIENTS.keys())

    @classmethod
    def get_default_model(cls) -> str:
        return cls.DEFAULT_MODEL

    async def get_tools(
        self,
        text: str,
        tools: list[dict[str, Any]] | None,
    ) -> dict[str, Any]:
        messages: list[dict[str, str]] = [
            {'role': 'system', 'content': tool_system_prompt},
            {'role': 'user', 'content': text},
        ]

        payload = {
            'model': self.model,
            'messages': messages,
            'temperature': 0.2,
            'tools': tools,
            'tool_choice': 'auto',
        }

        self.model = self._resolve_model(self.model)
        payload['model'] = self.model
        client = self._CLIENTS[self.model]['_client']
        key = id(client)
        self._active[key] = self._active.get(key, 0) + 1
        try:
            response = await client.chat.completions.create(**payload)
        finally:
            self._active[key] -= 1
            if not self._active[key]:
                del self._active[key]
            await self._close_if_idle(key)
        return {
            'choices': response.choices,
            'model': response.model,
            'usage': response.usage,
        }
