import asyncio
import httpx
import pytest

from runtime.api import create_app


class Model:
    def __init__(self, action=None, delay=0):
        self.action = action or {"tool": "get_time", "arguments": {"timezone": "Asia/Shanghai"}}
        self.delay = delay

    async def plan(self, text):
        await asyncio.sleep(self.delay)
        return self.action


def run(coro):
    return asyncio.run(coro)


async def request(app, data, token="test-token"):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        return await c.post("/v1/commands", json=data, headers={"Authorization": f"Bearer {token}"})


def test_time_tool_and_trace():
    app = create_app(token="test-token", model=Model())
    r = run(request(app, {"text": "现在几点"}))
    assert r.status_code == 200
    assert r.json()["result"]["timezone"] == "Asia/Shanghai"
    assert r.headers["x-request-id"] == r.json()["request_id"]


def test_auth_is_verified_and_input_is_bounded():
    app = create_app(token="test-token", model=Model())
    assert run(request(app, {"text": "time"}, "wrong")).status_code == 401
    assert run(request(app, {"text": " "})).status_code == 422
    assert run(request(app, {"text": "x" * 2001})).status_code == 422


@pytest.mark.parametrize("action", [
    {"tool": "shell", "arguments": {"command": "whoami"}},
    {"tool": "set_volume", "arguments": {"level": 101}},
    {"tool": "set_volume", "arguments": {"level": True}},
    {"tool": "get_time", "arguments": {"timezone": "bad-zone"}},
    {"tool": "get_time", "arguments": {"url": "http://localhost"}},
])
def test_untrusted_model_output_is_rejected(action):
    app = create_app(token="test-token", model=Model(action))
    assert run(request(app, {"text": "do it"})).status_code == 502


def test_timeout_releases_capacity():
    model = Model(delay=0.05)
    app = create_app(token="test-token", model=model, timeout=0.01, capacity=1)
    async def scenario():
        assert (await request(app, {"text": "time"})).status_code == 504
        model.delay = 0
        assert (await request(app, {"text": "time"})).status_code == 200
    run(scenario())


def test_saturation_rejects_and_then_recovers():
    app = create_app(token="test-token", model=Model(delay=0.06), capacity=1)
    async def scenario():
        first = asyncio.create_task(request(app, {"text": "time"}))
        await asyncio.sleep(0.02)
        second = await request(app, {"text": "time"})
        assert second.status_code == 429
        assert second.headers["retry-after"] == "1"
        assert (await first).status_code == 200
        assert (await request(app, {"text": "time"})).status_code == 200
    run(scenario())


def test_volume_is_explicitly_simulated():
    app = create_app(token="test-token", model=Model({"tool": "set_volume", "arguments": {"level": 30}}))
    r = run(request(app, {"text": "音量30"}))
    assert r.json()["result"] == {"level": 30, "simulated": True}


def test_missing_token_fails_startup(monkeypatch):
    monkeypatch.delenv("AGENT_API_TOKEN", raising=False)
    with pytest.raises(ValueError, match="AGENT_API_TOKEN"):
        create_app()
