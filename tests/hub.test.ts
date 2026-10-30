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
              ? [{ id: 'owner', is_active: true, is_owner: true, group_ids: [] }]
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
              a: { 'light.living_room': { s: 'on', a: { brightness: 100, old_attribute: 1 } } },
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
  await hub.act(demoDocument, { tileId: 'light', command: 'brightness', value: 55 });
  assert.deepEqual(calls.find((c) => c.type === 'call_service')!.service_data, {
    brightness_pct: 55,
  });
  assert.deepEqual(Object.keys(hub.getSnapshot(['weather.home']).entities), []);
  client!.terminate();
  await until(() => hub.getSnapshot().status === 'reconnecting');
  await assert.rejects(hub.act(demoDocument, { tileId: 'light', command: 'toggle' }));
});
