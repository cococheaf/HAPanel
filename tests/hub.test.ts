import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocketServer, type WebSocket } from 'ws';
import { HomeAssistantHub } from '../src/server/hub';
import { demoDocument } from '../src/shared/demo';

async function until(predicate: () => boolean, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
test('group dimming is derived from cached member metadata without subscribing or exposing extra entities', async (t) => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const calls: any[] = [];
  const metadata = [
    { entity_id: 'light.dim', state: 'off', attributes: { supported_color_modes: ['brightness'] } },
    {
      entity_id: 'light.normal',
      state: 'off',
      attributes: { supported_color_modes: ['onoff'], brightness: 255 },
    },
  ];
  server.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'auth_required' }));
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      calls.push(message);
      if (message.type === 'auth') {
        socket.send(JSON.stringify({ type: 'auth_ok' }));
        return;
      }
      socket.send(
        JSON.stringify({
          id: message.id,
          type: 'result',
          success: true,
          result: message.type === 'get_states' ? metadata : null,
        }),
      );
      if (message.type === 'subscribe_entities')
        socket.send(
          JSON.stringify({
            id: message.id,
            type: 'event',
            event: {
              a: {
                'light.living_room': {
                  s: 'on',
                  a: {
                    supported_color_modes: ['brightness'],
                    entity_id: ['light.dim', 'light.normal'],
                    brightness: 100,
                  },
                },
              },
            },
          }),
        );
    });
  });
  const hub = new HomeAssistantHub({
    demo: false,
    token: 'test-only',
    websocketUrl: `ws://127.0.0.1:${(server.address() as { port: number }).port}`,
  });
  t.after(async () => {
    await hub.stop();
    for (const client of server.clients) client.terminate();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  hub.setDocuments([demoDocument]);
  hub.start();
  await until(() => Boolean(hub.getSnapshot().entities['light.living_room']));
  const snapshot = hub.getSnapshot(['light.living_room']);
  assert.deepEqual(Object.keys(snapshot.entities), ['light.living_room']);
  assert.deepEqual(snapshot.entities['light.living_room'].lightCapabilities, {
    dimmable: false,
    reason: 'mixed',
  });
  assert.equal(
    calls.find((call) => call.type === 'subscribe_entities').entity_ids.includes('light.normal'),
    false,
  );
  await assert.rejects(
    hub.act(demoDocument, { tileId: 'light', command: 'brightness', value: 40 }),
  );
  assert.equal(
    calls.some((call) => call.type === 'call_service'),
    false,
  );
  await Promise.all([hub.getCatalog(), hub.getCatalog()]);
  assert.equal(calls.filter((call) => call.type === 'get_states').length, 1);
});
test('HA adapter authenticates, filters subscriptions, merges deltas, receives forecasts and sends typed actions', async (t) => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const address = server.address() as { port: number };
  let client: WebSocket | undefined,
    subscription = 0;
  const calls: Record<string, any>[] = [];
  server.on('connection', (socket) => {
    client = socket;
    socket.send(JSON.stringify({ type: 'auth_required' }));
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      calls.push(message);
      if (message.type === 'auth') {
        socket.send(
          JSON.stringify({
            type: message.access_token === 'test-only' ? 'auth_ok' : 'auth_invalid',
          }),
        );
        return;
      }
      socket.send(
        JSON.stringify({
          id: message.id,
          type: 'result',
          success: true,
          result:
            message.type === 'config/auth/list'
              ? [
                  { id: 'owner', is_active: true, is_owner: true, group_ids: [] },
                  {
                    id: 'viewer',
                    is_active: true,
                    is_owner: false,
                    group_ids: ['system-read-only'],
                  },
                  {
                    id: 'inactive',
                    is_active: false,
                    is_owner: false,
                    group_ids: ['system-admin'],
                  },
                ]
              : null,
        }),
      );
      if (message.type === 'subscribe_entities') {
        subscription = message.id;
        socket.send(
          JSON.stringify({
            id: subscription,
            type: 'event',
            event: {
              a: {
                'light.living_room': {
                  s: 'on',
                  a: { brightness: 100, supported_color_modes: ['brightness'], old_attribute: 1 },
                },
              },
            },
          }),
        );
      }
      if (message.type === 'weather/subscribe_forecast')
        socket.send(
          JSON.stringify({
            id: message.id,
            type: 'event',
            event: {
              forecast: [
                { datetime: '2026-10-30T18:00:00Z', temperature: 12, condition: 'cloudy' },
              ],
            },
          }),
        );
    });
  });
  const hub = new HomeAssistantHub({
    demo: false,
    token: 'test-only',
    websocketUrl: `ws://127.0.0.1:${address.port}`,
    apiUrl: 'http://127.0.0.1/api/',
  });
  t.after(async () => {
    await hub.stop();
    for (const client of server.clients) client.terminate();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  hub.setDocuments([demoDocument]);
  hub.start();
  await until(() => hub.getSnapshot().forecasts['weather.home']?.length === 1);
  assert.equal(
    calls.find((c) => c.type === 'subscribe_entities')!.entity_ids.includes('light.kitchen'),
    false,
  );
  client!.send(
    JSON.stringify({
      id: subscription,
      type: 'event',
      event: {
        c: {
          'light.living_room': {
            '+': { s: 'off', a: { brightness: 200 } },
            '-': { a: ['old_attribute'] },
          },
        },
      },
    }),
  );
  await until(() => hub.getSnapshot().entities['light.living_room'].state === 'off');
  assert.equal(hub.getSnapshot().entities['light.living_room'].attributes.brightness, 200);
  assert.equal(hub.getSnapshot().entities['light.living_room'].attributes.old_attribute, undefined);
  assert.equal(await hub.isAdmin('owner'), true);
  assert.equal(await hub.isAdmin('other'), false);
  assert.equal(await hub.isActiveUser('viewer'), true);
  assert.equal(await hub.isAdmin('viewer'), false);
  assert.equal(await hub.isActiveUser('inactive'), false);
  assert.equal(await hub.isAdmin('inactive'), false);
  assert.equal(await hub.isActiveUser('unknown'), false);
  assert.equal(calls.filter((call) => call.type === 'config/auth/list').length, 1);
  await hub.act(demoDocument, { tileId: 'light', command: 'brightness', value: 55 });
  assert.deepEqual(calls.find((c) => c.type === 'call_service')!.service_data, {
    brightness_pct: 55,
  });
  assert.deepEqual(Object.keys(hub.getSnapshot(['weather.home']).entities), []);
  client!.terminate();
  await until(() => hub.getSnapshot().status === 'reconnecting');
  await assert.rejects(hub.act(demoDocument, { tileId: 'light', command: 'toggle' }));
});

test('WebRTC signalling stays bound to a camera, hides session/config secrets and releases its HA subscription', async (t) => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const calls: any[] = [],
    events: any[] = [];
  let client!: WebSocket,
    offerId = 0;
  server.on('connection', (socket) => {
    client = socket;
    socket.send(JSON.stringify({ type: 'auth_required' }));
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      calls.push(message);
      if (message.type === 'auth') {
        socket.send(JSON.stringify({ type: 'auth_ok' }));
        return;
      }
      const result =
        message.type === 'camera/capabilities'
          ? { frontend_stream_types: ['hls', 'web_rtc'] }
          : message.type === 'camera/webrtc/get_client_config'
            ? {
                configuration: {
                  iceServers: [{ urls: 'turn:private.example', credential: 'private-secret' }],
                },
                dataChannel: 'events',
              }
            : null;
      socket.send(JSON.stringify({ id: message.id, type: 'result', success: true, result }));
      if (message.type === 'subscribe_entities')
        socket.send(
          JSON.stringify({
            id: message.id,
            type: 'event',
            event: { a: { 'camera.entrance': { s: 'idle', a: { supported_features: 2 } } } },
          }),
        );
      if (message.type === 'camera/webrtc/offer') {
        offerId = message.id;
        socket.send(
          JSON.stringify({
            id: message.id,
            type: 'event',
            event: { type: 'session', session_id: 'private-session' },
          }),
        );
        socket.send(
          JSON.stringify({
            id: message.id,
            type: 'event',
            event: { type: 'answer', answer: 'v=0\r\nanswer' },
          }),
        );
      }
    });
  });
  const hub = new HomeAssistantHub({
    demo: false,
    token: 'test-only',
    websocketUrl: `ws://127.0.0.1:${(server.address() as any).port}`,
    apiUrl: 'http://ha.example/api/',
  });
  t.after(async () => {
    await hub.stop();
    for (const socket of server.clients) socket.terminate();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const document = structuredClone(demoDocument);
  document.pages[0].tiles[0] = {
    ...document.pages[0].tiles[0],
    kind: 'camera',
    entityId: 'camera.entrance',
  };
  hub.setDocuments([document]);
  hub.start();
  await until(() => Boolean(hub.getSnapshot().entities['camera.entrance']));
  assert.deepEqual(await hub.cameraCapabilities('camera.entrance'), {
    webrtc: true,
    hls: true,
    dataChannel: 'events',
  });
  await hub.cameraCapabilities('camera.entrance');
  assert.equal(calls.filter((call) => call.type === 'camera/capabilities').length, 1);
  const control = hub.cameraWebRtc('camera.entrance', 'v=0\r\nclient offer', (event) =>
    events.push(event),
  );
  await control.candidate({ candidate: 'candidate:local', sdpMid: '0' });
  await control.ready;
  await until(() => calls.some((call) => call.type === 'camera/webrtc/candidate'));
  assert.equal(
    calls.find((call) => call.type === 'camera/webrtc/candidate').entity_id,
    'camera.entrance',
  );
  assert.equal(
    calls.find((call) => call.type === 'camera/webrtc/candidate').session_id,
    'private-session',
  );
  client.send(
    JSON.stringify({
      id: offerId,
      type: 'event',
      event: { type: 'candidate', candidate: { candidate: 'candidate:remote', sdpMid: '0' } },
    }),
  );
  await until(() => events.some((event) => event.type === 'candidate'));
  assert.doesNotMatch(JSON.stringify(events), /private-session|private-secret|turn:/);
  control.stop();
  await until(() =>
    calls.some((call) => call.type === 'unsubscribe_events' && call.subscription === offerId),
  );
  const count = events.length;
  client.send(
    JSON.stringify({ id: offerId, type: 'event', event: { type: 'answer', answer: 'late' } }),
  );
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(events.length, count);
});
