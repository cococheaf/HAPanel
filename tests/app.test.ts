import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createApp, type AppOptions } from '../src/server/app';
import { DocumentStore, PairingStore } from '../src/server/store';
import { HomeAssistantHub } from '../src/server/hub';

async function fixture(t: { after: (fn: () => unknown) => void }, extra: Partial<AppOptions> = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'hapanel-'));
  const store = new DocumentStore(dir),
    pairings = new PairingStore(dir),
    hub = new HomeAssistantHub({ demo: true });
  await store.init();
  await pairings.init();
  const app = await createApp({ mode: 'demo', surface: 'editor', store, pairings, hub, ...extra });
  await app.ready();
  t.after(async () => {
    await app.close();
    await hub.stop();
    await rm(dir, { recursive: true, force: true });
  });
  return { app, store, pairings, hub };
}
test('local editor rejects non-loopback clients, hostile hosts and cross-site writes', async (t) => {
  const { app } = await fixture(t);
  assert.equal(
    (await app.inject({ url: '/api/editor/bootstrap', remoteAddress: '192.168.1.12' })).statusCode,
    403,
  );
  assert.equal(
    (await app.inject({ url: '/api/editor/bootstrap', headers: { host: 'rebinding.example' } }))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/editor/publish',
        payload: { expectedRevision: 1 },
        headers: { origin: 'https://evil.example' },
      })
    ).statusCode,
    403,
  );
  assert.equal((await app.inject('/api/editor/bootstrap')).statusCode, 200);
});
test('Ingress identity is trusted only from the Supervisor and must belong to an admin', async (t) => {
  const { app } = await fixture(t, { mode: 'ingress', isAdmin: async (id) => id === 'admin-user' });
  assert.equal(
    (
      await app.inject({
        url: '/api/editor/bootstrap',
        headers: { 'x-remote-user-id': 'admin-user' },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await app.inject({ url: '/api/editor/bootstrap', remoteAddress: '172.30.32.2' })).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        url: '/api/editor/bootstrap',
        remoteAddress: '172.30.32.2',
        headers: { 'x-remote-user-id': 'normal-user' },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        url: '/api/editor/bootstrap',
        remoteAddress: '172.30.32.2',
        headers: { 'x-remote-user-id': 'admin-user' },
      })
    ).statusCode,
    200,
  );
});
test('display port exposes no editor API, requires pairing and cannot target arbitrary entities', async (t) => {
  const { app, pairings } = await fixture(t, { surface: 'display' });
  assert.equal((await app.inject('/api/editor/bootstrap')).statusCode, 404);
  assert.equal((await app.inject('/api/display/bootstrap')).statusCode, 401);
  const { code } = await pairings.createCode();
  const paired = await app.inject({
    method: 'POST',
    url: '/api/pair',
    payload: { code, name: 'iPad' },
  });
  assert.equal(paired.statusCode, 200);
  const cookie = paired.cookies[0];
  assert.equal(cookie.httpOnly, true);
  const headers = { cookie: `${cookie.name}=${cookie.value}` };
  const display = await app.inject({ url: '/api/display/bootstrap', headers });
  assert.equal(display.statusCode, 200);
  assert.equal(display.json().snapshot.entities['light.kitchen'], undefined);
  const rejected = await app.inject({
    method: 'POST',
    url: '/api/display/action',
    headers,
    payload: { tileId: 'light', command: 'toggle', entityId: 'light.kitchen' },
  });
  assert.equal(rejected.statusCode, 400);
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/display/action',
        headers,
        payload: { tileId: 'light', command: 'toggle' },
      })
    ).statusCode,
    200,
  );
  await pairings.revoke(pairings.list()[0].id);
  assert.equal((await app.inject({ url: '/api/display/bootstrap', headers })).statusCode, 401);
});
test('display reads the published version while draft updates use optimistic revision checks', async (t) => {
  const { app, pairings, store } = await fixture(t);
  const { token } = await pairings.pair((await pairings.createCode()).code, 'Display');
  const document = store.get().draft.document;
  document.greeting = 'Nur im Editor';
  const save = await app.inject({
    method: 'PUT',
    url: '/api/editor/draft',
    payload: { document, expectedRevision: 1 },
  });
  assert.equal(save.statusCode, 200);
  const headers = { cookie: `hapanel_device=${token}` };
  assert.notEqual(
    (await app.inject({ url: '/api/display/bootstrap', headers })).json().published.document
      .greeting,
    document.greeting,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/editor/publish',
        payload: { expectedRevision: 1 },
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/editor/publish',
        payload: { expectedRevision: 2 },
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url: '/api/display/bootstrap', headers })).json().published.document
      .greeting,
    document.greeting,
  );
});
test('YAML import is validated and remains an unpublished draft', async (t) => {
  const { app, store } = await fixture(t);
  const result = await app.inject({ url: '/api/editor/export?format=yaml' });
  const imported = await app.inject({
    method: 'POST',
    url: '/api/editor/import',
    payload: {
      source: result.body.replace('Schön, dass du da bist.', 'Aus YAML importiert'),
      format: 'yaml',
      expectedRevision: 1,
    },
  });
  assert.equal(imported.statusCode, 200);
  assert.equal(store.get().draft.document.greeting, 'Aus YAML importiert');
  assert.notEqual(store.get().published.document.greeting, 'Aus YAML importiert');
  const invalid = await app.inject({
    method: 'POST',
    url: '/api/editor/import',
    payload: { source: 'schemaVersion: 99', format: 'yaml', expectedRevision: 2 },
  });
  assert.equal(invalid.statusCode, 400);
});

test('revoking a device closes its active WebSocket immediately', async (t) => {
  const { app, pairings } = await fixture(t, { surface: 'display' });
  const { token, device } = await pairings.pair((await pairings.createCode()).code, 'iPad');
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const client = new WebSocket(`${address.replace('http:', 'ws:')}/api/display/stream`, {
    headers: { Cookie: `hapanel_device=${token}` },
  });
  const initial = once(client, 'message');
  await once(client, 'open');
  const [raw] = await initial;
  const message = JSON.parse(raw.toString());
  assert.equal(message.published.revision, 1);
  assert.equal(message.snapshot.entities['light.kitchen'], undefined);
  const closed = once(client, 'close');
  await pairings.revoke(device.id);
  assert.equal((await closed)[0], 1008);
});
