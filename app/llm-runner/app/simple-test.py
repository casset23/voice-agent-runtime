#!/usr/bin/env python3
"""简化版测试脚本：快速测试 llm-runner 服务状态
"""

import asyncio
import sys
import uuid
from datetime import datetime

import httpx

# 设置输出编码
if sys.platform == 'win32':
    import os

    os.system('chcp 65001 > nul')
    sys.stdout.reconfigure(encoding='utf-8')


class SimpleLLMRunnerTester:
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    async def health_check(self) -> bool:
        """健康检查"""
        try:
            response = await self.client.get(f'{self.base_url}/health')
            return response.status_code == 200
        except Exception as e:
            print(f'健康检查失败: {e}')
            return False

    async def call_intent_api(self, text: str) -> dict:
        """调用意图识别API"""
        request_data = {
            'text': text,
            'session_id': str(uuid.uuid4()),
            'metadata': {
                'timestamp': int(datetime.now().timestamp() * 1000),
                'lang': 'zh-CN',
                'timezone': 'Asia/Shanghai',
                'location': {'lat': 39.9042, 'lng': 116.4074, 'city': '北京'},
            },
        }

        headers = {
            'Authorization': 'Bearer test-token',
            'X-Request-Id': str(uuid.uuid4()),
            'X-Device-ID': '00:11:22:33:44:55',
            'Content-Type': 'application/json',
        }

        try:
            response = await self.client.post(f'{self.base_url}/v1/intent', json=request_data, headers=headers)
            if response.status_code == 200:
                return {'success': True, 'data': response.json()}
            else:
                return {'success': False, 'status': response.status_code, 'error': response.text}
        except Exception as e:
            return {'success': False, 'error': str(e)}


async def main():
    """测试主函数"""
    print('正在测试 llm-runner 服务...')

    async with SimpleLLMRunnerTester() as tester:
        # 健康检查
        print('1. 健康检查...')
        if not await tester.health_check():
            print('[X] 服务不可用 - 健康检查失败')
            return

        print('[OK] 健康检查通过')

        # 测试正常情况 - 不会触发工具调用
        print('\n2. 测试普通对话...')
        result = await tester.call_intent_api('你好')
        if result.get('success'):
            print('[OK] API调用成功')
            print(f'响应: {result["data"]}')
        else:
            print(f'[X] API调用失败: {result.get("error", "未知错误")}')

        # 测试可能触发工具的情况
        print("\n3. 测试工具调用...")
        result = await tester.call_intent_api("上海今天天气怎么样?")
        if result.get("success"):
            tools = result['data'].get('tools', [])
            if tools:
                print(f'[OK] 工具调用成功，返回 {len(tools)} 个工具')
                for i, tool in enumerate(tools, 1):
                    print(f'  工具{i}: {tool.get("name")} - {tool.get("category")}')
            else:
                print('[OK] API调用成功，但未触发工具调用')
            print(f'完整响应: {result["data"]}')
        else:
            print(f'[X] API调用失败: {result.get("error", "未知错误")}')

        print('\n测试完成')


if __name__ == '__main__':
    asyncio.run(main())
