import test from 'node:test';
import assert from 'node:assert/strict';
import { demoDocument, demoSnapshot, applyDemoAction } from '../src/shared/demo';
import { dashboardSchema, resolveAction, type EntityState } from '../src/shared/model';
import { lightDimming, lightTapCommand } from '../src/shared/lights';

const light = (id: string, modes: string[], extra: Record<string, unknown> = {}): EntityState => ({
  entity_id: id,
  state: 'off',
  attributes: { supported_color_modes: modes, ...extra },
});
test('dimming uses advertised capabilities, including off lights, and never a brightness attribute alone', () => {
  for (const mode of ['brightness', 'hs', 'rgbw', 'rgbww', 'color_temp', 'xy', 'rgb', 'white']) {
    const entity = light('light.dimmer', [mode]);
    assert.equal(lightDimming(entity.entity_id, { [entity.entity_id]: entity }).dimmable, true);
  }
  for (const entity of [
    light('light.normal', ['onoff'], { brightness: 255 }),
    light('light.future', ['future_mode']),
    light('light.unknown', [], { brightness: 50 }),
    light('switch.dimmer', ['brightness']),
  ])
    assert.equal(lightDimming(entity.entity_id, { [entity.entity_id]: entity }).dimmable, false);
});
test('mixed, incomplete and recursive groups cannot acquire dimmers through an HA capability union', () => {
  const entities = Object.fromEntries(
    [
      light('light.a', ['rgbw']),
      light('light.b', ['brightness']),
      light('light.normal', ['onoff']),
      light('light.all', ['rgbw'], { entity_id: ['light.a', 'light.b'] }),
      light('light.mixed', ['rgbw'], { entity_id: ['light.a', 'light.normal'] }),
      light('light.nested', ['brightness'], { entity_id: ['light.all'] }),
      light('light.unknown', ['brightness'], { entity_id: ['light.missing'] }),
      light('light.cycle', ['brightness'], { entity_id: ['light.cycle'] }),
      light('light.empty', ['brightness'], { entity_id: [] }),
    ].map((item) => [item.entity_id, item]),
  );
  assert.equal(lightDimming('light.all', entities).dimmable, true);
  assert.equal(lightDimming('light.nested', entities).dimmable, true);
  assert.deepEqual(lightDimming('light.mixed', entities), { dimmable: false, reason: 'mixed' });
  for (const id of ['light.unknown', 'light.cycle', 'light.empty'])
    assert.equal(lightDimming(id, entities).dimmable, false);
  // Filtered browser snapshots carry only the server's capability result, not hidden members.
  entities['light.all'].lightCapabilities = { dimmable: true, reason: 'dimmable' };
  assert.equal(lightDimming('light.all', { 'light.all': entities['light.all'] }).dimmable, true);
});
test('on-only, off-only and display-only policies resolve deterministically and reject bypass commands', () => {
  const document = structuredClone(demoDocument);
  const tile = document.pages[0].tiles.find((tile) => tile.id === 'light')!;
  assert.equal(lightTapCommand(tile), 'toggle');
  for (const [allowTurnOn, allowTurnOff, command] of [
    [true, false, 'turn_on'],
    [false, true, 'turn_off'],
    [false, false, undefined],
  ] as const) {
    tile.light = { allowTurnOn, allowTurnOff, showBrightness: true };
    assert.equal(lightTapCommand(tile), command);
    assert.throws(() => resolveAction(document, { tileId: tile.id, command: 'toggle' }));
    assert.throws(() =>
      resolveAction(document, { tileId: tile.id, command: 'brightness', value: 50 }),
    );
    assert.throws(() =>
      resolveAction(document, { tileId: tile.id, command: 'brightness', value: 0 }),
    );
    for (const candidate of ['turn_on', 'turn_off'] as const) {
      const action = { tileId: tile.id, command: candidate };
      if (candidate === command) assert.equal(resolveAction(document, action).service, command);
      else assert.throws(() => resolveAction(document, action));
    }
  }
  tile.light = { allowTurnOn: true, allowTurnOff: true, showBrightness: false };
  assert.throws(() =>
    resolveAction(document, { tileId: tile.id, command: 'brightness', value: 50 }),
  );
  assert.equal(resolveAction(document, { tileId: tile.id, command: 'toggle' }).service, 'toggle');
});
test('one-way operations remain idempotent in sample data and mixed groups reject dimming', () => {
  const document = structuredClone(demoDocument),
    snapshot = demoSnapshot();
  const tile = document.pages[0].tiles.find((tile) => tile.id === 'light')!;
  tile.light = { allowTurnOn: false, allowTurnOff: true, showBrightness: true };
  const off = applyDemoAction(snapshot, document, { tileId: tile.id, command: 'turn_off' });
  assert.equal(
    applyDemoAction(off, document, { tileId: tile.id, command: 'turn_off' }).entities[tile.entityId]
      .state,
    'off',
  );
  delete tile.light;
  snapshot.entities[tile.entityId].attributes.entity_id = ['light.kitchen', 'light.normal'];
  snapshot.entities['light.normal'] = light('light.normal', ['onoff']);
  assert.throws(() =>
    applyDemoAction(snapshot, document, { tileId: tile.id, command: 'brightness', value: 20 }),
  );
});
test('text round trips preserve spaces while typing, import and saving, but reject empty required names', () => {
  const document = structuredClone(demoDocument);
  for (const heading of ['Guten ', 'Guten Morgen ', 'Guten  Morgen zuhause']) {
    document.pages[0].heading = heading;
    document.pages[0].name = 'Mein Zuhause ';
    document.pages[0].tiles[1].title = 'General Licht ';
    const parsed = dashboardSchema.parse(JSON.parse(JSON.stringify(document)));
    assert.equal(parsed.pages[0].heading, heading);
    assert.equal(parsed.pages[0].name, 'Mein Zuhause ');
    assert.equal(parsed.pages[0].tiles[1].title, 'General Licht ');
  }
  document.pages[0].name = '   ';
  assert.equal(dashboardSchema.safeParse(document).success, false);
});
test('light options apply to nested room controls and cannot be attached to unrelated tile types', () => {
  const document = structuredClone(demoDocument);
  document.pages[0].tiles[0].light = {
    allowTurnOn: false,
    allowTurnOff: true,
    showBrightness: false,
  };
  assert.equal(dashboardSchema.safeParse(document).success, false);
  delete document.pages[0].tiles[0].light;
  const tile = document.pages[0].tiles[1];
  tile.room = {
    icon: 'home',
    presence: [],
    windows: [],
    controls: [
      {
        id: 'child',
        title: 'Raumlicht',
        entityId: 'switch.room',
        kind: 'light',
        accent: 'amber',
        light: { allowTurnOn: false, allowTurnOff: true, showBrightness: false },
      },
    ],
  };
  assert.equal(
    resolveAction(document, { tileId: 'child', command: 'turn_off' }).service,
    'turn_off',
  );
  assert.throws(() => resolveAction(document, { tileId: 'child', command: 'turn_on' }));
});
