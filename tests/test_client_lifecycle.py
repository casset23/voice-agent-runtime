import asyncio
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch


class FakeSDK:
    instances = []

    def __init__(self, api_key='', base_url=''):
        if base_url == 'invalid-url':
            raise ValueError('invalid provider URL')
        self.closed = False
        self.started = asyncio.Event()
        self.release = None
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))
        self.instances.append(self)

    async def create(self, **payload):
        self.started.set()
        if self.release:
            await self.release.wait()
        return SimpleNamespace(choices=[], model=payload['model'], usage=None)

    async def close(self):
        self.closed = True


class ClientLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        path = Path(__file__).resolve().parents[1] / 'app/llm-runner/app/llm/client.py'
        spec = importlib.util.spec_from_file_location('client_under_test', path)
        module = importlib.util.module_from_spec(spec)
        self.patch = patch('openai.AsyncOpenAI', FakeSDK)
        self.patch.start()
        spec.loader.exec_module(module)
        self.Client = module.Client

    async def asyncTearDown(self):
        self.patch.stop()

    def config(self, model='replacement', base='https://model.example/v1'):
        return {'model': model, 'baseUrl': base, 'apiKey': 'test-placeholder'}

    async def test_idle_old_clients_close_on_reload(self):
        old = [v['_client'] for v in self.Client._CLIENTS.values()]
        await self.Client.configure_from_runner([self.config()])
        self.assertTrue(all(c.closed for c in old))
        self.assertEqual(self.Client.get_default_model(), 'replacement')

    async def test_reload_waits_for_active_request_before_closing_old_client(self):
        old = self.Client._CLIENTS[self.Client.DEFAULT_MODEL]['_client']
        old.release = asyncio.Event()
        task = asyncio.create_task(self.Client().get_tools('现在几点', []))
        await old.started.wait()
        await self.Client.configure_from_runner([self.config()])
        self.assertFalse(old.closed)
        old.release.set()
        await task
        self.assertTrue(old.closed)

    async def test_failed_reload_preserves_registry_and_cleans_partial_clients(self):
        old = self.Client._CLIENTS
        with self.assertRaises(ValueError):
            await self.Client.configure_from_runner([self.config(), self.config('bad', 'invalid-url')])
        self.assertIs(self.Client._CLIENTS, old)
        self.assertFalse(any(c['_client'].closed for c in old.values()))
        self.assertTrue(FakeSDK.instances[-1].closed)

    async def test_shutdown_closes_current_clients(self):
        clients = [v['_client'] for v in self.Client._CLIENTS.values()]
        await self.Client.close_all()
        self.assertTrue(all(c.closed for c in clients))

    async def test_existing_wrapper_resolves_new_client_after_reload(self):
        wrapper = self.Client()
        old = self.Client._CLIENTS[self.Client.DEFAULT_MODEL]['_client']
        await self.Client.configure_from_runner([self.config()])
        result = await wrapper.get_tools('现在几点', [])
        current = self.Client._CLIENTS['replacement']['_client']
        self.assertTrue(current.started.is_set())
        self.assertFalse(old.started.is_set())
        self.assertEqual(result['model'], 'replacement')

    async def test_shutdown_defers_close_until_inflight_call_finishes(self):
        old = self.Client._CLIENTS[self.Client.DEFAULT_MODEL]['_client']
        old.release = asyncio.Event()
        task = asyncio.create_task(self.Client().get_tools('现在几点', []))
        await old.started.wait()
        await self.Client.close_all()
        self.assertFalse(old.closed)
        old.release.set()
        await task
        self.assertTrue(old.closed)
