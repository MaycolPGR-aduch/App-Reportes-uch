import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('cambio de sesión en otra pestaña y retorno desde bfcache fuerzan actualización', () => {
  const handlers = {};
  let reloads = 0;
  const window = {
    location: { reload: () => { reloads++; } },
    addEventListener: (name, handler) => { handlers[name] = handler; },
    removeEventListener: (name) => { delete handlers[name]; },
  };
  let cleanup;
  const exports = {};
  const source = fs.readFileSync(new URL('../components/session-sync.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(compiled, { exports, window, require: () => ({ useEffect: (fn) => { cleanup = fn(); } }) });
  exports.SessionSync();
  handlers.storage({ key: 'otra-clave' });
  assert.equal(reloads, 0);
  handlers.storage({ key: 'campus-session-change' });
  handlers.pageshow({ persisted: true });
  assert.equal(reloads, 2);
  cleanup();
  assert.deepEqual(Object.keys(handlers), []);
});
