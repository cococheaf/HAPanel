import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardSchema, findSpace, geometry, resolveAction } from '../src/shared/model';
import { demoDocument } from '../src/shared/demo';

test('all example profiles are valid and geometry fits the exact browser area', () => {
  assert.equal(dashboardSchema.safeParse(demoDocument).success, true);
  for (const p of demoDocument.profiles) {
    const g = geometry(p);
    assert.equal(
      Math.round(g.cellWidth * p.columns + p.gap * (p.columns - 1)),
      p.width - 2 * p.margin,
    );
    assert.equal(
      Math.round(
        g.rowHeight * p.rows +
          p.gap * (p.rows - 1) +
          p.headerHeight +
          p.footerHeight +
          2 * p.margin,
      ),
      p.height,
    );
  }
});
test('overlap, off-grid tiles, duplicate IDs and missing profile layouts are rejected', () => {
  const overlap = structuredClone(demoDocument);
  overlap.pages[0].tiles[1].layouts.ipad.x = 0;
  assert.equal(dashboardSchema.safeParse(overlap).success, false);
  const outside = structuredClone(demoDocument);
  outside.pages[0].tiles[0].layouts.ipad.x = 11;
  assert.equal(dashboardSchema.safeParse(outside).success, false);
  const duplicate = structuredClone(demoDocument);
  duplicate.pages[1].id = duplicate.pages[0].id;
  assert.equal(dashboardSchema.safeParse(duplicate).success, false);
  const missing = structuredClone(demoDocument);
  delete missing.pages[0].tiles[0].layouts.compact;
  assert.equal(dashboardSchema.safeParse(missing).success, false);
});
test('findSpace respects occupancy and never moves existing tiles', () => {
  assert.equal(findSpace(demoDocument.profiles[0], demoDocument.pages[0].tiles), undefined);
  assert.deepEqual(findSpace(demoDocument.profiles[0], demoDocument.pages[0].tiles.slice(1)), {
    x: 0,
    y: 0,
    w: 4,
    h: 2,
  });
});
test('actions derive the HA target on the server and reject cross-type commands', () => {
  assert.deepEqual(
    resolveAction(demoDocument, { tileId: 'light', command: 'brightness', value: 35 }),
    {
      domain: 'light',
      service: 'turn_on',
      target: { entity_id: 'light.living_room' },
      service_data: { brightness_pct: 35 },
    },
  );
  assert.throws(() => resolveAction(demoDocument, { tileId: 'weather', command: 'toggle' }));
  assert.throws(() =>
    resolveAction(demoDocument, { tileId: 'light', command: 'brightness', value: 101 }),
  );
  assert.throws(() => resolveAction(demoDocument, { tileId: 'unpublished', command: 'activate' }));
});
test('an entity cannot silently change a tile into another action domain', () => {
  const document = structuredClone(demoDocument);
  document.pages[0].tiles[0].entityId = 'script.dangerous';
  assert.equal(dashboardSchema.safeParse(document).success, false);
});
