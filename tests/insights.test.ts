import test from 'node:test';
import assert from 'node:assert/strict';
import { demoDocument, demoSnapshot, localizeSampleDocument } from '../src/shared/demo';
import { showcaseDocument, showcaseSnapshot } from '../src/shared/showcase';
import {
  allControls,
  dashboardSchema,
  energySchema,
  entityIds,
  resolveAction,
  roomSchema,
  type EntityState,
} from '../src/shared/model';
import { energyValues, measured, numericState, roomValues } from '../src/shared/insights';
import { HomeAssistantHub } from '../src/server/hub';

const sensor = (value: string, unit: string): EntityState => ({
  entity_id: 'sensor.test',
  state: value,
  attributes: { unit_of_measurement: unit },
});

test('room and energy templates fit every profile and keep unique action IDs', () => {
  assert.equal(dashboardSchema.safeParse(demoDocument).success, true);
  assert.equal(dashboardSchema.safeParse(showcaseDocument).success, true);
  assert.equal(showcaseDocument.pages.length, 4);
  const controls = allControls(showcaseDocument);
  assert.equal(new Set(controls.map((item) => item.id)).size, controls.length);
  assert.ok(entityIds(showcaseDocument).includes('cover.demo_bedroom'));
  assert.ok(entityIds(showcaseDocument).includes('sensor.demo_battery_level'));
  const view = localizeSampleDocument(showcaseDocument, 'en');
  assert.equal(view.pages.find((page) => page.id === 'energy')!.name, 'Energy');
  assert.equal(view.pages.find((page) => page.id === 'eg')!.name, 'GF');
  assert.equal(view.pages.find((page) => page.id === 'og')!.name, 'UF');
  assert.equal(view.pages.find((page) => page.id === 'eg')!.heading, 'Home, together.');
  assert.equal(dashboardSchema.safeParse(view).success, true);
});
test('nested devices retain typed action boundaries and cannot promote read-only energy sources', () => {
  const document = structuredClone(showcaseDocument);
  const bedroom = document.pages[2].tiles[0];
  const cover = bedroom.room!.controls.find((item) => item.kind === 'cover')!;
  const action = resolveAction(document, { tileId: cover.id, command: 'position', value: 35 });
  assert.deepEqual(action, {
    domain: 'cover',
    service: 'set_cover_position',
    target: { entity_id: 'cover.demo_bedroom' },
    service_data: { position: 35 },
  });
  assert.throws(() =>
    resolveAction(document, { tileId: cover.id, command: 'position', value: 101 }),
  );
  assert.throws(() => resolveAction(document, { tileId: cover.id, command: 'toggle' }));
  assert.throws(() =>
    resolveAction(document, { tileId: 'sensor.demo_battery_power', command: 'toggle' }),
  );
  bedroom.room!.controls[0].id = document.pages[0].tiles[0].id;
  assert.equal(dashboardSchema.safeParse(document).success, false);
  bedroom.room!.controls[0].id = 'unique_child';
  bedroom.room!.controls[0].kind = 'climate';
  assert.equal(dashboardSchema.safeParse(document).success, false);
});
test('invalid navigation and duplicate power sources are rejected', () => {
  const document = structuredClone(showcaseDocument);
  document.pages[0].tiles[1].navigateTo = 'missing_page';
  assert.equal(dashboardSchema.safeParse(document).success, false);
  assert.equal(
    energySchema.safeParse({ solarPower: ['sensor.solar', 'sensor.solar'] }).success,
    false,
  );
  assert.equal(
    energySchema.safeParse({
      solarPower: ['sensor.solar'],
      gridImport: 'sensor.grid',
      gridExport: 'sensor.grid',
    }).success,
    false,
  );
});
test('energy values normalise units and preserve unknown values instead of inventing zeroes', () => {
  assert.equal(measured(sensor('2.4', 'kW'), 'power'), 2400);
  assert.equal(measured(sensor('2500', 'Wh'), 'energy'), 2.5);
  assert.equal(measured(sensor('2500', 'W'), 'energy'), undefined);
  assert.equal(measured(sensor('101', '%'), 'percent'), undefined);
  assert.equal(numericState(sensor('', 'W')), undefined);
  assert.equal(numericState(sensor('unavailable', 'W')), undefined);
  assert.equal(numericState(sensor('0', 'W')), 0);
  const snapshot = showcaseSnapshot();
  const config = energySchema.parse({
    solarPower: ['sensor.demo_solar'],
    gridImport: 'sensor.demo_grid_import',
    gridExport: 'sensor.demo_grid_export',
    batteryPower: 'sensor.demo_battery_power',
    batteryPositive: 'discharge',
  });
  let values = energyValues(config, snapshot);
  assert.equal(values.net, -480);
  assert.equal(values.battery, -1200);
  assert.equal(values.monitored, undefined);
  snapshot.entities['sensor.demo_solar'].state = 'unavailable';
  values = energyValues(config, snapshot);
  assert.equal(values.solar, undefined);
});
test('room summaries count only available controls and keep missing temperatures unknown', () => {
  const snapshot = demoSnapshot();
  const room = roomSchema.parse({
    icon: 'sofa',
    temperature: 'climate.living_room',
    controls: [
      {
        id: 'known',
        kind: 'light',
        title: 'Known light',
        entityId: 'light.living_room',
        accent: 'amber',
      },
      {
        id: 'missing',
        kind: 'light',
        title: 'Missing light',
        entityId: 'light.missing',
        accent: 'amber',
      },
    ],
    windows: ['binary_sensor.window'],
  });
  const values = roomValues(room, snapshot);
  assert.equal(values.temperature, 22.1);
  assert.equal(values.lightsAvailable, 1);
  assert.equal(values.lights, 2);
  assert.equal(values.windowsAvailable, 0);
  delete snapshot.entities['climate.living_room'].attributes.current_temperature;
  assert.equal(roomValues(room, snapshot).temperature, undefined);
});
test('HA history is bounded, normalised and cached, including climate attributes', async (t) => {
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push(url);
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-secret');
    const climate = url.includes('climate.');
    return new Response(
      JSON.stringify([
        Array.from({ length: 1000 }, (_, index) => ({
          state: climate ? 'heat' : String(index),
          attributes: climate ? { current_temperature: 20 + index / 100 } : undefined,
          last_changed: new Date(Date.now() - (1000 - index) * 60_000).toISOString(),
        })),
      ]),
    );
  });
  const hub = new HomeAssistantHub({
    demo: false,
    apiUrl: 'http://ha.example/api/',
    token: 'test-secret',
  });
  const points = await hub.getHistory('sensor.power');
  assert.ok(points.length <= 161);
  assert.equal(points[0].value, 0);
  assert.equal(points.at(-1)!.value, 999);
  await hub.getHistory('sensor.power');
  assert.equal(requests.length, 1);
  const temperatures = await hub.getHistory('climate.room');
  assert.equal(temperatures[0].value, 20);
  assert.ok(requests[0].includes('filter_entity_id=sensor.power'));
  assert.ok(requests[0].includes('no_attributes'));
  assert.ok(!requests[1].includes('no_attributes'));
});
test('oversized HA history is cancelled rather than loading unbounded data', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array(4 * 1024 * 1024 + 1)));
  const hub = new HomeAssistantHub({
    demo: false,
    apiUrl: 'http://ha.example/api/',
    token: 'test-secret',
  });
  await assert.rejects(hub.getHistory('sensor.power'), /History is currently unavailable/);
});
