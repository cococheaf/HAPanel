import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { demoDocument, demoSnapshot } from '../src/shared/demo';
import { showcaseDocument } from '../src/shared/showcase';
import { independentDisplayViews } from '../src/shared/display-layouts';
import { dashboardSchema, entityIds, resolveAction, type Tile } from '../src/shared/model';
import {
  adaptiveDocument,
  conditionMatches,
  isNight,
  replaceEntity,
  reviewDashboard,
} from '../src/shared/experience';
import { pasteTiles, transformSelection, createTemplateView } from '../src/shared/designer';
import { validateCapability } from '../src/shared/widgets';
import { energyPeriod } from '../src/shared/energy-statistics';
import { DocumentStore, PairingStore } from '../src/server/store';

test('legacy layouts round trip unchanged and gesture actions cannot override their published command or target', () => {
  assert.deepEqual(dashboardSchema.parse(demoDocument), demoDocument);
  const doc = structuredClone(demoDocument),
    tile = doc.pages[0].tiles.find((t) => t.kind === 'light')!;
  tile.experience = { tap: { type: 'command', command: 'turn_off', confirm: true } };
  assert.equal(resolveAction(doc, { tileId: tile.id, command: 'tap' }).service, 'turn_off');
  tile.light = { allowTurnOn: false, allowTurnOff: true, showBrightness: false };
  tile.experience.tap = { type: 'command', command: 'turn_on' };
  assert.throws(() => resolveAction(doc, { tileId: tile.id, command: 'tap' }));
  assert.throws(() => resolveAction(doc, { tileId: 'weather', command: 'tap' }));
});
test('visibility preserves unknown states and condition entities are included in the filtered HA subscription', () => {
  const snapshot = demoSnapshot();
  const c = { entityId: 'binary_sensor.condition', operator: 'is_not' as const, value: 'off' };
  assert.equal(conditionMatches(c, snapshot), false);
  snapshot.entities[c.entityId] = { entity_id: c.entityId, state: 'unavailable', attributes: {} };
  assert.equal(conditionMatches(c, snapshot), false);
  snapshot.entities[c.entityId].state = 'on';
  assert.equal(conditionMatches(c, snapshot), true);
  const d = structuredClone(demoDocument);
  d.pages[0].tiles[0].experience = { visibleWhen: c };
  d.alerts = [
    {
      id: 'bell',
      title: 'Bell',
      message: '',
      condition: { entityId: 'binary_sensor.bell', operator: 'is', value: 'on' },
      timeout: 30,
      priority: 'info',
    },
  ];
  assert.ok(entityIds(d).includes(c.entityId));
  assert.ok(entityIds(d).includes('binary_sensor.bell'));
  assert.equal(isNight({ nightStart: 22, nightEnd: 7 }, 23), true);
  assert.equal(isNight({ nightStart: 22, nightEnd: 7 }, 12), false);
});
test('adaptive layout preserves original configurations, every tile and non-overlapping positions on narrow screens', () => {
  const document = independentDisplayViews(showcaseDocument),
    profile = document.profiles[0];
  profile.experience = { adaptive: true };
  const before = JSON.stringify(document);
  const result = adaptiveDocument(document, profile, 375, 700);
  assert.equal(JSON.stringify(document), before);
  assert.equal(result.profile.width, 375);
  assert.equal(
    result.document.pages.flatMap((p) => p.tiles).length,
    document.pages.flatMap((p) => p.tiles).length,
  );
  assert.ok(dashboardSchema.safeParse(result.document).success);
});
test('selection moves respect locked tiles and failed paste never mutates the source layout', () => {
  const d = independentDisplayViews(showcaseDocument),
    p = d.pages[0],
    profile = d.profiles[0];
  p.tiles[0].experience = { locked: true };
  assert.deepEqual(transformSelection(d, p.id, profile.id, [p.tiles[0].id], 'move', 1, 1), d);
  const before = JSON.stringify(d);
  assert.throws(() =>
    pasteTiles(
      d,
      p.id,
      profile.id,
      Array.from({ length: 64 }, () => p.tiles[0]),
    ),
  );
  assert.equal(JSON.stringify(d), before);
  const empty = createTemplateView(d, profile.id, 'New', [], 'blank');
  const pasted = pasteTiles(empty.document, empty.pageId, profile.id, [p.tiles[0]]);
  assert.notEqual(pasted.ids[0], p.tiles[0].id);
  assert.equal(pasted.document.pages.at(-1)!.tiles[0].experience?.locked, false);
});
test('room templates use actual selected entities and replacement updates references without rewriting names', () => {
  const d = independentDisplayViews(showcaseDocument),
    profile = d.profiles[0];
  const entities = [
    { entity_id: 'light.office', state: 'off', attributes: { friendly_name: 'Office' } },
    { entity_id: 'sensor.office_temp', state: '21', attributes: { device_class: 'temperature' } },
  ];
  const result = createTemplateView(d, profile.id, 'Office', entities, 'room');
  assert.equal(result.document.pages.at(-1)!.tiles[0].room?.controls[0].entityId, 'light.office');
  const changed = replaceEntity(result.document, 'light.office', 'light.replacement');
  assert.equal(changed.pages.at(-1)!.tiles[0].room?.controls[0].entityId, 'light.replacement');
  assert.equal(changed.pages.at(-1)!.name, 'Office');
  assert.ok(reviewDashboard(changed, entities).length > 0);
});
test('new controls reject unsupported capabilities, options and out-of-step number values', () => {
  const entity = {
    entity_id: 'number.test',
    state: '1',
    attributes: { min: 0, max: 10, step: 0.5 },
  };
  assert.doesNotThrow(() =>
    validateCapability(entity, { tileId: 'x', command: 'number', value: 2.5 }),
  );
  assert.throws(() => validateCapability(entity, { tileId: 'x', command: 'number', value: 2.3 }));
  const select = {
    entity_id: 'input_select.test',
    state: 'a',
    attributes: { options: ['a', 'b'] },
  };
  assert.throws(() =>
    validateCapability(select, { tileId: 'x', command: 'select', option: 'forged' }),
  );
  assert.throws(() =>
    validateCapability(
      { entity_id: 'cover.test', state: 'open', attributes: { supported_features: 3 } },
      { tileId: 'x', command: 'tilt', value: 50 },
    ),
  );
  assert.throws(() =>
    validateCapability(
      { entity_id: 'light.test', state: 'off', attributes: { supported_color_modes: ['onoff'] } },
      { tileId: 'x', command: 'color', color: [0, 0, 0] },
    ),
  );
});
test('energy ratios and cost require measured sources and do not fabricate missing values', () => {
  const result = energyPeriod(
    { solarEnergy: 10, exportEnergy: 4, houseEnergy: 12, importEnergy: 3 },
    0.3,
    0.1,
  );
  assert.equal(result.selfConsumption, 0.6);
  assert.equal(result.autarky, 0.75);
  assert.equal(energyPeriod({ importEnergy: 3 }, 0.3, 0.1).cost, undefined);
  assert.equal(energyPeriod({ importEnergy: 3 }, 0.3).cost, 0.8999999999999999);
  assert.ok(Math.abs(result.cost! - 0.5) < 1e-9);
  assert.deepEqual(energyPeriod({}), {
    selfConsumption: undefined,
    autarky: undefined,
    cost: undefined,
  });
  assert.equal(energyPeriod({ solarEnergy: 3, exportEnergy: 5 }).selfConsumption, undefined);
});
test('first v2 startup preserves an immutable backup and new device restrictions survive restart without leaking session digests', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'hapanel-v2-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new DocumentStore(dir);
  await store.init();
  const original = await readFile(join(dir, 'dashboard.json'), 'utf8');
  const reopened = new DocumentStore(dir);
  await reopened.init();
  assert.equal(await readFile(join(dir, 'dashboard-before-2.0.json'), 'utf8'), original);
  const pairings = new PairingStore(dir);
  await pairings.init();
  const code = await pairings.createCode();
  const { token, device } = await pairings.pair(code.code, 'Wall');
  await pairings.configure(device.id, {
    profileId: 'ipad',
    readOnly: true,
    cameraBlocked: true,
    allowedProfiles: ['ipad'],
  });
  const again = new PairingStore(dir);
  await again.init();
  assert.equal(again.authenticate(token)?.settings?.readOnly, true);
  assert.equal('digest' in again.list()[0], false);
  await again.configureViewer('viewer', { alarmBlocked: true });
  assert.equal(again.viewerSettings('viewer')?.alarmBlocked, true);
});

test('copied displays remap gesture navigation and home pages without altering the source', async () => {
  const { createDisplay } = await import('../src/shared/display-layouts');
  const d = independentDisplayViews(showcaseDocument),
    p = d.profiles[0],
    pages = d.pages.filter((page) => page.profileIds?.[0] === p.id);
  p.experience = { homePageId: pages[1].id };
  pages[0].tiles[0].experience = { tap: { type: 'navigate', pageId: pages[1].id } };
  const before = JSON.stringify(d);
  const copied = createDisplay(d, 'Copy', p.id, true, 'Home');
  assert.equal(JSON.stringify(d), before);
  const source = copied.document.profiles.find((profile) => profile.id === p.id)!;
  assert.equal(source.experience?.homePageId, pages[1].id);
  const copy = copied.document.profiles.find((profile) => profile.id === copied.profileId)!;
  assert.notEqual(copy.experience?.homePageId, pages[1].id);
  const first = copied.document.pages.find((page) => page.profileIds?.[0] === copy.id)!;
  assert.equal(first.tiles[0].experience?.tap?.pageId, copy.experience?.homePageId);
});

test('sample timers expose real deadlines for countdown and retain remaining time across pause and resume', async () => {
  const { showcaseSnapshot } = await import('../src/shared/showcase');
  const { applyDemoAction } = await import('../src/shared/demo');
  let snapshot = showcaseSnapshot();
  snapshot = applyDemoAction(snapshot, showcaseDocument, {
    tileId: 'feature_timer',
    command: 'timer_start',
  });
  const timer = snapshot.entities['timer.example'];
  assert.equal(timer.state, 'active');
  assert.ok(Date.parse(String(timer.attributes.finishes_at)) > Date.now() + 290000);
  snapshot = applyDemoAction(snapshot, showcaseDocument, {
    tileId: 'feature_timer',
    command: 'timer_pause',
  });
  assert.equal(snapshot.entities['timer.example'].state, 'paused');
  assert.equal(snapshot.entities['timer.example'].attributes.finishes_at, undefined);
  snapshot = applyDemoAction(snapshot, showcaseDocument, {
    tileId: 'feature_timer',
    command: 'timer_cancel',
  });
  assert.equal(snapshot.entities['timer.example'].attributes.remaining, '00:05:00');
});
