import asyncio
import json

import httpx
import pytest

from runtime.models import DemoModel, OpenAIModel


def test_offline_router():
    model = DemoModel()
    assert asyncio.run(model.plan('音量30')) == {'tool': 'set_volume', 'arguments': {'level': 30}}
    assert asyncio.run(model.plan('现在几点'))['tool'] == 'get_time'
    assert asyncio.run(model.plan('删除文件'))['tool'] == 'unsupported'


def test_provider_contract_without_network(monkeypatch):
    monkeypatch.setenv('LLM_API_KEY', 'local-test-placeholder')
    monkeypatch.setenv('LLM_BASE_URL', 'https://model.example/v1')
    monkeypatch.setenv('LLM_MODEL', 'contract-test')
    original = httpx.AsyncClient
    def handle(request):
        assert str(request.url) == 'https://model.example/v1/chat/completions'
        assert request.headers['Authorization'] == 'Bearer local-test-placeholder'
        body = json.loads(request.content)
        assert body['model'] == 'contract-test'
        assert body['response_format'] == {'type': 'json_object'}
        assert body['messages'][-1] == {'role': 'user', 'content': '现在几点'}
        return httpx.Response(200, json={'choices': [{'message': {'content': '{"tool":"get_time","arguments":{}}'}}]})
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(handle), **kwargs))
    assert asyncio.run(OpenAIModel().plan('现在几点'))['tool'] == 'get_time'


def test_provider_requires_credential(monkeypatch):
    monkeypatch.delenv('LLM_API_KEY', raising=False)
    with pytest.raises(ValueError, match='LLM_API_KEY'):
        asyncio.run(OpenAIModel().plan('time'))


@pytest.mark.parametrize('text', ['volume1000', 'volume30.5', '音量-30'])
def test_invalid_volume_is_not_truncated(text):
    assert asyncio.run(DemoModel().plan(text))['tool'] == 'unsupported'
