import asyncio
import logging
import os
import secrets
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from .models import DemoModel, OpenAIModel

logger = logging.getLogger(__name__)


class Command(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    text: str = Field(min_length=1, max_length=2000)


class TimeArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    timezone: str = "Asia/Shanghai"

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ValueError, ZoneInfoNotFoundError) as e:
            raise ValueError("Unknown timezone") from e
        return value


class VolumeArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    level: int = Field(strict=True, ge=0, le=100)


TOOLS = {"get_time": TimeArgs, "set_volume": VolumeArgs}


def execute(action):
    if not isinstance(action, dict) or set(action) != {"tool", "arguments"}:
        raise ValueError("Malformed action")
    name = action["tool"]
    if not isinstance(name, str) or name not in TOOLS:
        raise ValueError("Tool is not allowed")
    args = TOOLS[name].model_validate(action["arguments"])
    if name == "get_time":
        return {"time": datetime.now(ZoneInfo(args.timezone)).isoformat(), "timezone": args.timezone}
    return {"level": args.level, "simulated": True}


def create_app(*, token=None, model=None, capacity=8, timeout=20):
    token = token or os.environ.get("AGENT_API_TOKEN")
    if not token or not token.strip():
        raise ValueError("AGENT_API_TOKEN is required")
    if capacity < 1 or timeout <= 0:
        raise ValueError("capacity and timeout must be positive")
    mode = os.environ.get("AGENT_MODEL_MODE", "demo")
    if mode not in {"demo", "openai"}:
        raise ValueError("AGENT_MODEL_MODE must be demo or openai")
    model = model or (OpenAIModel() if mode == "openai" else DemoModel())
    slots = asyncio.Semaphore(capacity)
    app = FastAPI(title="Voice Agent Runtime", version="0.1.0")
    bearer = HTTPBearer(auto_error=False)

    async def authenticate(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        if credentials is None or not secrets.compare_digest(credentials.credentials.encode(), token.encode()):
            raise HTTPException(401, "Invalid bearer token", headers={"WWW-Authenticate": "Bearer"})

    @app.middleware("http")
    async def trace(request, call_next):
        request.state.request_id = str(uuid.uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    @app.get("/health")
    async def health():
        return {"status": "ok", "model_mode": mode}

    @app.get("/v1/resources", dependencies=[Depends(authenticate)])
    async def resources():
        return {"tools": [{"name": name, "arguments": schema.model_json_schema()} for name, schema in TOOLS.items()]}

    @app.post("/v1/commands", dependencies=[Depends(authenticate)])
    async def command(body: Command, request: Request):
        try:
            await asyncio.wait_for(slots.acquire(), timeout=0.005)
        except TimeoutError:
            raise HTTPException(429, "Runtime busy", headers={"Retry-After": "1"})
        try:
            action = await asyncio.wait_for(model.plan(body.text), timeout=timeout)
            result = execute(action)
            return {"request_id": request.state.request_id, "tool": action["tool"], "result": result}
        except TimeoutError:
            raise HTTPException(504, "Model deadline exceeded")
        except (ValueError, ValidationError, KeyError, TypeError):
            raise HTTPException(502, "Model returned an invalid or unsupported action")
        except Exception:
            logger.exception("Model request failed; request_id=%s", request.state.request_id)
            raise HTTPException(502, "Model provider unavailable")
        finally:
            slots.release()

    return app
