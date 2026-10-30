import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import type { Socket } from 'node:net';
import WebSocket from 'ws';
import { createApp, type AppOptions } from '../src/server/app';
import { DocumentStore, PairingStore } from '../src/server/store';
import { HomeAssistantHub } from '../src/server/hub';
import { roomSchema } from '../src/shared/model';

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
test('published light policies reject forged toggles and dimming while accepting the configured one-way command', async (t) => {
  const { app, store, hub } = await fixture(t, { mode: 'ingress', isAdmin: async () => true });
  const draft = store.getRevision('draft');
  draft.document.pages[0].tiles.find((tile) => tile.id === 'light')!.light = {
    allowTurnOn: false,
    allowTurnOff: true,
    showBrightness: true,
  };
  const saved = await store.save(draft.document, draft.revision);
  await store.publish(saved.draft.revision);
  const invoke = (command: string, value?: number) =>
    app.inject({
      method: 'POST',
      url: '/api/display/action',
      remoteAddress: '172.30.32.2',
      headers: { 'x-remote-user-id': 'admin-user' },
      payload: { tileId: 'light', command, ...(value !== undefined ? { value } : {}) },
    });
  for (const [command, value] of [
    ['toggle', undefined],
    ['turn_on', undefined],
    ['brightness', 0],
    ['brightness', 50],
  ] as const)
    assert.equal((await invoke(command, value)).statusCode, 400);
  assert.equal(hub.getSnapshot().entities['light.living_room'].state, 'on');
  assert.equal((await invoke('turn_off')).statusCode, 200);
  assert.equal(hub.getSnapshot().entities['light.living_room'].state, 'off');
});
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
test('Ingress player shares the administrator gate and controls only published entities', async (t) => {
  const { app, store, hub, pairings } = await fixture(t, {
    mode: 'ingress',
    isAdmin: async (id) => id === 'admin-user',
  });
  const headers = { 'x-remote-user-id': 'admin-user' };
  const remoteAddress = '172.30.32.2';
  const document = store.get().draft.document;
  document.pages[0].tiles.find((tile) => tile.id === 'light')!.entityId = 'light.kitchen';
  await store.save(document, 1);
  assert.equal((await app.inject({ url: '/api/display/bootstrap', headers })).statusCode, 403);
  assert.equal(
    (await app.inject({ url: '/api/display/bootstrap', remoteAddress })).statusCode,
    403,
  );
  const response = await app.inject({ url: '/api/display/bootstrap', headers, remoteAddress });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().canEdit, true);
  assert.equal(response.json().published.revision, 1);
  assert.equal(response.json().snapshot.entities['light.kitchen'], undefined);
  assert.equal(pairings.list().length, 0);
  const action = await app.inject({
    method: 'POST',
    url: '/api/display/action',
    headers,
    remoteAddress,
    payload: { tileId: 'light', command: 'toggle' },
  });
  assert.equal(action.statusCode, 200);
  assert.equal(hub.getSnapshot().entities['light.living_room'].state, 'off');
  assert.equal(hub.getSnapshot().entities['light.kitchen'].state, 'off');
});
test(
  'Ingress player streams published updates without creating a device session',
  { timeout: 5000 },
  async (t) => {
    const { app, store, pairings } = await fixture(t, {
      mode: 'ingress',
      isAdmin: async (id) => id === 'admin-user',
    });
    const context = {
      headers: { 'x-remote-user-id': 'admin-user' },
      socket: { remoteAddress: '172.30.32.2' } as Socket,
    };
    await assert.rejects(app.injectWS('/api/display/stream'), /403/);
    let initial!: Promise<any[]>;
    const client = await app.injectWS('/api/display/stream', context, {
      onInit: (ws) => {
        initial = once(ws, 'message');
      },
    });
    t.after(() => client.terminate());
    assert.equal(JSON.parse((await initial)[0].toString()).published.revision, 1);
    const document = store.get().draft.document;
    document.greeting = 'An unpublished greeting';
    const draftMessage = once(client, 'message');
    await store.save(document, 1);
    assert.equal(JSON.parse((await draftMessage)[0].toString()).published, undefined);
    const publishedMessage = once(client, 'message');
    await store.publish(2);
    assert.equal(
      JSON.parse((await publishedMessage)[0].toString()).published.document.greeting,
      document.greeting,
    );
    assert.equal(pairings.list().length, 0);
    const closed = once(client, 'close');
    client.terminate();
    await closed;
  },
);
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

test('API errors follow Accept-Language and expose stable error keys', async (t) => {
  const { app } = await fixture(t);
  for (const [language, expected] of [
    ['de-AT', 'koppeln'],
    ['en-US', 'Pair this display'],
    ['fr-FR', 'Pair this display'],
  ]) {
    const response = await app.inject({
      url: '/api/display/bootstrap',
      headers: { 'accept-language': language },
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().messageKey, 'error.pairRequired');
    assert.ok(response.json().error.includes(expected));
    assert.equal(response.headers['content-language'], language === 'de-AT' ? 'de' : 'en');
  }
  const document = structuredClone(
    (await app.inject('/api/editor/bootstrap')).json().workspace.draft.document,
  );
  document.pages[0].tiles[1].layouts.ipad.x = 0;
  const invalid = await app.inject({
    method: 'PUT',
    url: '/api/editor/draft',
    headers: { 'accept-language': 'en' },
    payload: { document, expectedRevision: 1 },
  });
  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.json().error, /Tiles must not overlap/);
});
test('display history exposes only published sources, including declared room devices', async (t) => {
  const { app, store, pairings } = await fixture(t);
  const { token } = await pairings.pair((await pairings.createCode()).code, 'History display');
  const headers = { cookie: 'hapanel_device=' + token };
  assert.equal((await app.inject('/api/display/history/light.kitchen')).statusCode, 401);
  const document = store.get().draft.document;
  document.pages[0].tiles[1].room = roomSchema.parse({
    icon: 'kitchen',
    controls: [
      {
        id: 'kitchen_control',
        title: 'Kitchen',
        kind: 'light',
        entityId: 'light.kitchen',
        accent: 'amber',
      },
    ],
  });
  await store.save(document, 1);
  assert.equal(
    (await app.inject({ url: '/api/display/history/light.kitchen', headers })).statusCode,
    403,
  );
  assert.equal((await app.inject('/api/editor/history/light.kitchen')).statusCode, 200);
  await store.publish(2);
  assert.equal(
    (await app.inject({ url: '/api/display/history/light.kitchen', headers })).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url: '/api/display/history/sensor.private_unpublished', headers }))
      .statusCode,
    403,
  );
});

test('paired displays retain their existing access and gain no alarm or camera privileges', async (t) => {
  const { showcaseDocument } = await import('../src/shared/showcase');
  const { app, store, pairings, hub } = await fixture(t, { surface: 'display' });
  await store.save(showcaseDocument, 1);
  await store.publish(2);
  const { token } = await pairings.pair((await pairings.createCode()).code, 'Wall display');
  const headers = { cookie: 'hapanel_device=' + token };
  const act = t.mock.method(hub, 'act', async () => {});
  const still = t.mock.method(hub, 'cameraStill', async () => ({
    buffer: Buffer.from('image'),
    type: 'image/jpeg',
  }));
  const data = (await app.inject({ url: '/api/display/bootstrap', headers })).json();
  assert.equal(data.snapshot.alarmControl, false);
  assert.equal(data.snapshot.cameraView, false);
  const alarm = await app.inject({
    method: 'POST',
    url: '/api/display/action',
    headers,
    payload: { tileId: 'demo_alarm', command: 'alarm', mode: 'armed_away' },
  });
  assert.equal(alarm.statusCode, 403);
  assert.equal(
    (await app.inject({ url: '/api/display/camera/sample_camera_entrance/still', headers }))
      .statusCode,
    403,
  );
  assert.equal(act.mock.callCount(), 0);
  assert.equal(still.mock.callCount(), 0);
});
test('authenticated alarm actions sanitise HA errors and throttle repeated attempts without logging PINs', async (t) => {
  const { showcaseDocument } = await import('../src/shared/showcase');
  const { app, store, hub } = await fixture(t, {
    mode: 'ingress',
    isAdmin: async (id) => id === 'admin-user',
  });
  await store.save(showcaseDocument, 1);
  await store.publish(2);
  const headers = { 'x-remote-user-id': 'admin-user' };
  const remoteAddress = '172.30.32.2';
  t.mock.method(hub, 'act', async () => {
    throw new Error('HA rejected PIN 0012 and private details');
  });
  const request = {
    method: 'POST' as const,
    url: '/api/display/action',
    headers,
    remoteAddress,
    payload: { tileId: 'demo_alarm', command: 'alarm', mode: 'armed_away', code: '0012' },
  };
  assert.equal(
    (await app.inject({ ...request, headers: { 'x-remote-user-id': 'normal-user' } })).statusCode,
    403,
  );
  for (let i = 0; i < 5; i++) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().messageKey, 'error.alarmRejected');
    assert.doesNotMatch(response.body, /0012|private details/);
  }
  assert.equal((await app.inject(request)).statusCode, 429);
  const data = (await app.inject({ url: '/api/display/bootstrap', headers, remoteAddress })).json();
  assert.equal(data.snapshot.alarmControl, true);
  assert.equal(data.snapshot.cameraView, true);
});
test('camera routes enforce draft versus publication bindings and strip private camera attributes', async (t) => {
  const { showcaseDocument, showcaseSnapshot } = await import('../src/shared/showcase');
  const { app, store, hub } = await fixture(t, {
    mode: 'ingress',
    isAdmin: async (id) => id === 'admin-user',
  });
  const snapshot = showcaseSnapshot();
  Object.assign(snapshot.entities['camera.sample_entrance'].attributes, {
    access_token: 'private',
    entity_picture: 'secret-url',
  });
  t.mock.method(hub, 'getSnapshot', (ids?: string[]) => ({
    ...snapshot,
    entities: Object.fromEntries(
      Object.entries(snapshot.entities).filter(([id]) => !ids || ids.includes(id)),
    ),
  }));
  const still = t.mock.method(hub, 'cameraStill', async () => ({
    buffer: Buffer.from('jpeg'),
    type: 'image/jpeg',
  }));
  const headers = { 'x-remote-user-id': 'admin-user' },
    remoteAddress = '172.30.32.2';
  await store.save(showcaseDocument, 1);
  const url = '/api/display/camera/sample_camera_entrance/still';
  assert.equal((await app.inject({ url, headers, remoteAddress })).statusCode, 404);
  const editor = await app.inject({
    url: '/api/editor/camera/sample_camera_entrance/still',
    headers,
    remoteAddress,
  });
  assert.equal(editor.statusCode, 200);
  assert.equal(editor.headers['cache-control'], 'no-store');
  await store.publish(2);
  assert.equal((await app.inject({ url, headers, remoteAddress })).statusCode, 200);
  assert.equal(still.mock.calls[1].arguments[0], 'camera.sample_entrance');
  assert.equal(
    (
      await app.inject({
        url: '/api/display/camera/arbitrary_camera/still',
        headers,
        remoteAddress,
      })
    ).statusCode,
    404,
  );
  assert.equal((await app.inject({ url, headers })).statusCode, 403);
  const data = (await app.inject({ url: '/api/display/bootstrap', headers, remoteAddress })).json();
  assert.doesNotMatch(
    JSON.stringify(data.snapshot.entities['camera.sample_entrance']),
    /access_token|secret-url/,
  );
});

test('WebRTC sockets inherit Ingress auth, use only their configured camera and release sessions on publication changes', async (t) => {
  const { showcaseDocument } = await import('../src/shared/showcase');
  const { app, store, hub } = await fixture(t, {
    mode: 'ingress',
    isAdmin: async (id) => id === 'admin-user',
  });
  await store.save(showcaseDocument, 1);
  await store.publish(2);
  const calls: string[] = [];
  let stops = 0;
  t.mock.method(
    hub,
    'cameraWebRtc',
    (
      entity: string,
      offer: string,
      send: (event: import('../src/shared/camera').CameraSignalEvent) => void,
    ) => {
      calls.push(entity);
      send({ type: 'answer', sdp: 'v=0\r\ntest-answer' });
      return {
        ready: Promise.resolve(),
        candidate: async () => {},
        stop: () => {
          stops++;
        },
      };
    },
  );
  t.mock.method(hub, 'cameraCapabilities', async () => ({ webrtc: true, hls: true }));
  const context = {
    headers: { 'x-remote-user-id': 'admin-user' },
    socket: { remoteAddress: '172.30.32.2' } as Socket,
  };
  await assert.rejects(app.injectWS('/api/display/camera/sample_camera_entrance/webrtc'), /403/);
  const client = await app.injectWS('/api/display/camera/sample_camera_entrance/webrtc', context);
  t.after(() => client.terminate());
  const answer = once(client, 'message');
  client.send(JSON.stringify({ type: 'offer', sdp: 'v=0\r\ntest-offer-long-enough' }));
  assert.equal(JSON.parse((await answer)[0].toString()).type, 'answer');
  assert.deepEqual(calls, ['camera.sample_entrance']);
  const document = store.get().draft.document;
  document.pages = document.pages.filter((page) => page.id !== 'surveillance');
  await store.save(document, 2);
  const closed = once(client, 'close');
  await store.publish(3);
  assert.equal((await closed)[0], 1008);
  assert.equal(stops, 1);
});
