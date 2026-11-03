import test from 'node:test';
import assert from 'node:assert/strict';
import {
  designPresets,
  designSchema,
  designVariables,
  exportDesign,
  parseDesignFile,
} from '../src/shared/design';
import { createGlassOverview } from '../src/shared/glass-layout';
import {
  dashboardSchema,
  entityIds,
  resolveAction,
  pagesForProfile,
  tileSchema,
} from '../src/shared/model';
import { independentDisplayViews, resizeDisplay } from '../src/shared/display-layouts';
import { reviewDashboard } from '../src/shared/experience';
import { showcaseDocument, showcaseSnapshot } from '../src/shared/showcase';

test('designs accept bounded styling only and reject executable or remote content', () => {
  const good = structuredClone(designPresets.glassDark);
  for (const patch of [
    { tint: 'url(https://example.com)' },
    { background: '#fff' },
    { blur: 41 },
    { opacity: -1 },
    { radius: 100 },
    { textScale: 2 },
    { css: 'body{}' },
    { wallpaper: 'https://example.com/a.jpg' },
  ])
    assert.equal(designSchema.safeParse({ ...good, ...patch }).success, false);
  assert.equal(designVariables(good)['--design-tint'], '210, 228, 255');
  assert.equal(designVariables({ ...good, surface: 'solid' })['--design-blur'], '0px');
});
test('design transfer roundtrips appearance without importing entities, scripts or other settings', () => {
  const raw = exportDesign('Mein Glas Design', designPresets.glassLight);
  assert.deepEqual(parseDesignFile(raw), {
    format: 'hapanel-design',
    version: 1,
    name: 'Mein Glas Design',
    appearance: designPresets.glassLight,
  });
  assert.throws(() => parseDesignFile(raw.replace('"version": 1', '"version": 2')));
  assert.throws(() =>
    parseDesignFile(JSON.stringify({ ...JSON.parse(raw), entities: ['camera.private'] })),
  );
  assert.throws(() => parseDesignFile(' '.repeat(16385)));
});
test('old dashboards retain their appearance and saved designs stay independent between displays', () => {
  const base = independentDisplayViews(showcaseDocument);
  const legacy = dashboardSchema.parse(base);
  assert.equal(legacy.profiles[0].design, undefined);
  legacy.designs = [
    { id: 'personal', name: 'Private palette', appearance: structuredClone(designPresets.aurora) },
  ];
  const a = resizeDisplay(legacy, legacy.profiles[0].id, {
    design: structuredClone(legacy.designs[0].appearance),
  });
  a.profiles[0].design!.blur = 4;
  assert.equal(a.designs![0].appearance.blur, 24);
  assert.equal(a.profiles[1].design, undefined);
  assert.deepEqual(
    pagesForProfile(a, a.profiles[1].id),
    pagesForProfile(base, base.profiles[1].id),
  );
  assert.equal(
    dashboardSchema.safeParse({ ...a, designs: [...a.designs!, ...a.designs!] }).success,
    false,
  );
});
test('glass starter preserves existing views, commands, devices and other display layouts', () => {
  const before = independentDisplayViews(showcaseDocument),
    serialized = JSON.stringify(before);
  for (const profile of before.profiles) {
    const { document, pageId } = createGlassOverview(before, profile.id, 'de');
    assert.equal(JSON.stringify(before), serialized);
    assert.equal(dashboardSchema.safeParse(document).success, true);
    assert.deepEqual(entityIds(document).sort(), entityIds(before).sort());
    assert.equal(document.pages.length, before.pages.length + 1);
    assert.equal(
      document.profiles.find((p) => p.id === profile.id)!.experience!.homePageId,
      pageId,
    );
    for (const other of before.profiles.filter((p) => p.id !== profile.id))
      assert.deepEqual(pagesForProfile(document, other.id), pagesForProfile(before, other.id));
    for (const tile of before.pages.flatMap((p) => p.tiles))
      assert.ok(document.pages.flatMap((p) => p.tiles).some((t) => t.id === tile.id));
    if (profile.id === 'ipad')
      assert.equal(
        reviewDashboard(document, Object.values(showcaseSnapshot().entities)).filter(
          (issue) => issue.pageId === pageId,
        ).length,
        0,
      );
    const section = document.pages[0].tiles.find((t) => t.kind === 'section')!;
    assert.equal(section.entityId, '');
    assert.throws(() => resolveAction(document, { tileId: section.id, command: 'turn_on' }));
    assert.throws(() => resolveAction(document, { tileId: section.id, command: 'tap' }));
    assert.equal(tileSchema.safeParse({ ...section, kind: 'light' }).success, true); // Whole-dashboard domain checks reject invalid bindings.
    const broken = structuredClone(document);
    broken.pages[0].tiles.find((t) => t.id === section.id)!.kind = 'light';
    assert.equal(dashboardSchema.safeParse(broken).success, false);
  }
});
