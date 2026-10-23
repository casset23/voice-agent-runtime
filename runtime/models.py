import os
import re

import httpx


class DemoModel:
    """Deterministic offline router. This mode does not call an LLM."""

    async def plan(self, text):
        if any(word in text.lower() for word in ("几点", "时间", "time")):
            return {"tool": "get_time", "arguments": {"timezone": "Asia/Shanghai"}}
        level = re.search(r"(?:音量|volume)\s*(\d{1,3})", text.lower())
        if level:
            return {"tool": "set_volume", "arguments": {"level": int(level.group(1))}}
        return {"tool": "unsupported", "arguments": {}}


class OpenAIModel:
    """OpenAI-compatible JSON planner; tool results are never executed as code."""

    async def plan(self, text):
        key = os.environ.get("LLM_API_KEY")
        if not key:
            raise ValueError("LLM_API_KEY is required")
        base = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
            r = await client.post(base + "/chat/completions", headers={"Authorization": f"Bearer {key}"}, json={
                "model": os.environ.get("LLM_MODEL", "gpt-4o-mini"),
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": 'Return only JSON: {"tool":"get_time","arguments":{"timezone":"Asia/Shanghai"}} or {"tool":"set_volume","arguments":{"level":0}} (integer 0..100). For unsupported commands return {"tool":"unsupported","arguments":{}}. Never invent tool names.'},
                    {"role": "user", "content": text},
                ],
            })
            r.raise_for_status()
            import json
            return json.loads(r.json()["choices"][0]["message"]["content"])
