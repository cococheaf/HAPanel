import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardSchema, entityIds, resolveAction, type EntityState } from '../src/shared/model';
import { legacyShowcaseDocument, showcaseDocument, showcaseSnapshot } from '../src/shared/showcase';
import { BrowserDemoService } from '../src/client/service';
import { contactValues, alarmStatus } from '../src/shared/security';

test('contact summaries never report missing or unavailable sensors as closed', () => {
  const tile = showcaseDocument.pages[0].tiles.find((tile) => tile.kind === 'contacts')!;
  const snapshot = showcaseSnapshot();
  let values = contactValues(tile.contacts!, snapshot);
  assert.equal(values.open.length, 1);
  assert.equal(values.closed.length, 2);
  assert.equal(values.unknown.length, 1);
  delete snapshot.entities[tile.contacts![0].entityId];
  values = contactValues(tile.contacts!, snapshot);
  assert.equal(values.closed.length, 1);
  assert.equal(values.unknown.length, 2);
  assert.ok(entityIds(showcaseDocument).includes('binary_sensor.demo_kitchen_window'));
});
test('automation commands use their bound entity and retain HA conditions', () => {
  assert.deepEqual(
    resolveAction(showcaseDocument, { tileId: 'demo_summer', command: 'activate' }),
    {
      domain: 'automation',
      service: 'trigger',
      target: { entity_id: 'automation.demo_summer' },
      service_data: { skip_condition: false },
    },
  );
  assert.equal(
    resolveAction(showcaseDocument, { tileId: 'demo_summer', command: 'toggle' }).service,
    'toggle',
  );
  assert.throws(() => resolveAction(showcaseDocument, { tileId: 'demo_summer', command: 'open' }));
});
test('alarm and contact cards cannot issue alarm services or other device commands', () => {
  for (const tileId of ['demo_alarm', 'demo_contacts'])
    for (const command of ['activate', 'toggle', 'open'] as const)
      assert.throws(() => resolveAction(showcaseDocument, { tileId, command }));
  const state = (value: string) =>
    ({ entity_id: 'alarm_control_panel.test', state: value, attributes: {} }) as EntityState;
  assert.equal(alarmStatus(state('disarmed')).label, 'alarm.disarmed');
  assert.equal(alarmStatus(state('triggered')).tone, 'alert');
  assert.equal(alarmStatus(state('pending')).tone, 'pending');
  assert.equal(alarmStatus().label, 'common.unavailable');
  assert.equal(alarmStatus(state('constructor')).label, 'common.unavailable');
});
test('invalid contact bindings, duplicate sensors and executable alarm links are rejected', () => {
  const document = structuredClone(showcaseDocument);
  const contacts = document.pages[0].tiles.find((tile) => tile.contacts)!;
  contacts.contacts!.push(contacts.contacts![0]);
  assert.equal(dashboardSchema.safeParse(document).success, false);
  contacts.contacts!.pop();
  const alarm = document.pages[0].tiles.find((tile) => tile.kind === 'alarm')!;
  alarm.homeAssistantUrl = 'javascript:alert(1)';
  assert.equal(dashboardSchema.safeParse(document).success, false);
  alarm.homeAssistantUrl = 'https://user:secret@example.com/';
  assert.equal(dashboardSchema.safeParse(document).success, false);
  alarm.homeAssistantUrl =
    'https://ha.example/lovelace?more-info-entity-id=alarm_control_panel.test';
  assert.equal(dashboardSchema.safeParse(document).success, true);
});

test('only untouched legacy demo layouts upgrade; personalised layouts and publications survive', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const revision = {
    revision: 1,
    savedAt: new Date().toISOString(),
    document: structuredClone(legacyShowcaseDocument),
  };
  let data = {
    draft: structuredClone(revision),
    published: structuredClone(revision),
    history: [],
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => JSON.stringify(data) },
  });
  t.after(() =>
    previous
      ? Object.defineProperty(globalThis, 'localStorage', previous)
      : delete (globalThis as any).localStorage,
  );
  let service = new BrowserDemoService();
  assert.equal((await service.load()).workspace.draft.document.pages[0].tiles.length, 8);
  data.draft.document.greeting = 'A custom greeting';
  service = new BrowserDemoService();
  assert.equal((await service.load()).workspace.draft.document.greeting, 'A custom greeting');
  data.draft.document = structuredClone(legacyShowcaseDocument);
  data.published.document.greeting = 'A custom published greeting';
  service = new BrowserDemoService();
  assert.equal(
    (await service.load()).workspace.published.document.greeting,
    'A custom published greeting',
  );
});
