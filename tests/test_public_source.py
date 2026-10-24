"""Exercise the original services without calling model or weather providers."""
import ast
import os
from pathlib import Path
import re
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]


class PublicSourceTests(unittest.TestCase):
    def run_service(self, directory, code):
        env = os.environ.copy()
        for key in list(env):
            if key.lower().endswith('_proxy'):
                env.pop(key)
        env.update(ARK_API_KEY='test-local-placeholder', DEEPSEEK_API_KEY='test-local-placeholder', PYTHONIOENCODING='utf-8')
        result = subprocess.run([sys.executable, '-c', code], cwd=ROOT / directory, env=env,
                                text=True, encoding='utf-8', capture_output=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_default_credentials_are_configurable(self):
        self.run_service('app/llm-runner', '''
from app.llm.client import Client
assert Client._CLIENTS['doubao-1-5-pro-32k-250115']['_client'].api_key == 'test-local-placeholder'
assert Client._CLIENTS['deepseek-chat']['_client'].api_key == 'test-local-placeholder'
assert Client._CLIENTS['Qwen/Qwen3-0.6B']['_client'].base_url.host == '127.0.0.1'
''')

    def test_original_runner_tool_call_mapping_and_provider_error(self):
        self.run_service('app/llm-runner', '''
from types import SimpleNamespace
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient
from app import main
main.load_runner_configs = AsyncMock()
tool = SimpleNamespace(function=SimpleNamespace(name='tool_datetime', arguments='{"time":{}}'))
main.Client.get_tools = AsyncMock(return_value={'choices': [SimpleNamespace(message=SimpleNamespace(tool_calls=[tool]))]})
with TestClient(main.app) as c:
    assert c.get('/health').json() == {'status': 'ok'}
    payload = {'text': '现在几点', 'session_id': 'public-test', 'metadata': {'time_zone': 'Asia/Shanghai'}}
    response = c.post('/v1/intent', json=payload)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['session_id'] == 'public-test'
    assert result['tools'][0] == {'name':'tool-datetime','category':'time','parameters':{}}
    assert isinstance(result['metadata']['timestamp'], int)
    assert c.post('/v1/intent', json={**payload, 'text':'x'}).status_code == 422
    main.Client.get_tools = AsyncMock(side_effect=RuntimeError('mock provider unavailable'))
    response = c.post('/v1/intent', json=payload)
    assert response.status_code == 500
    assert response.json()['tools'] == []
''')

    def test_original_datetime_service(self):
        self.run_service('tools/tool-datetime', r'''
from fastapi.testclient import TestClient
from app.main import app
import re
with TestClient(app) as c:
    assert c.get('/health').status_code == 200
    response = c.post('/v1/invoke/time', json={'parameters':{}, 'metadata':{'time_zone':'Asia/Shanghai'}, 'session_id':'public-test'})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['tool']['name'] == 'tool-datetime'
    assert re.fullmatch(r'\d{2}:\d{2}:\d{2}', result['result']['data']['time'])
''')

    def test_public_snapshot_contains_no_literal_keys_or_private_addresses(self):
        for directory in ('app', 'tools', 'config', 'deploy', 'shared'):
            paths = []
            for current, dirs, files in os.walk(ROOT / directory):
                dirs[:] = [d for d in dirs if d not in {'node_modules', 'dist', '__pycache__', 'target'}]
                paths.extend(Path(current) / name for name in files)
            for path in paths:
                if not path.is_file() or any(part in {'node_modules', 'dist', '__pycache__', 'target'} for part in path.parts):
                    continue
                if path.suffix not in {'.py', '.rs', '.ts', '.tsx', '.yaml', '.json', '.md'}:
                    continue
                text = path.read_text(encoding='utf-8')
                self.assertIsNone(re.search(r'sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}', text), str(path))
                self.assertIsNone(re.search(r'(?<!\d)(?:10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)', text), str(path))
        client = ast.parse((ROOT / 'app/llm-runner/app/llm/client.py').read_text(encoding='utf-8'))
        for node in ast.walk(client):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'AsyncOpenAI':
                for keyword in node.keywords:
                    if keyword.arg == 'api_key':
                        self.assertNotIsInstance(keyword.value, ast.Constant)


if __name__ == '__main__':
    unittest.main()
