import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

test('service worker nunca intercepta API ni navegación y elimina cachés antiguas propias', async () => {
  const handlers = {};
  const deleted = [];
  const self = { location: { origin: 'https://campus.example' }, clients: { claim: async () => {} },
    skipWaiting: async () => {}, addEventListener: (name, handler) => { handlers[name] = handler; } };
  const caches = { keys: async () => ['campus-alertas-v3', 'otra-app'], delete: async (key) => deleted.push(key) };
  vm.runInNewContext(fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, caches, URL });
  let activated;
  handlers.activate({ waitUntil: (promise) => { activated = promise; } });
  await activated;
  assert.deepEqual(deleted, ['campus-alertas-v3']);
  for (const pathname of ['/api/v1/auth/me', '/api/v1/auth/profile', '/dashboard']) {
    let intercepted = false;
    handlers.fetch({ request: { method: 'GET', url: `https://campus.example${pathname}` },
      respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, pathname);
  }
});
