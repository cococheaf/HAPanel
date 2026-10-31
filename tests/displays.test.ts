import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  independentDisplayViews,
  createDisplay,
  duplicateView,
  deleteView,
  deleteDisplay,
  resizeDisplay,
  moveView,
} from '../src/shared/display-layouts';
import { showcaseDocument } from '../src/shared/showcase';
import {
  dashboardSchema,
  entityIds,
  allControls,
  pagesForProfile,
  resolveAction,
} from '../src/shared/model';
import { DocumentStore } from '../src/server/store';

test('legacy display migration keeps first-display IDs, isolates other views and preserves devices and navigation', () => {
  const before = JSON.stringify(showcaseDocument),
    document = independentDisplayViews(showcaseDocument);
  assert.equal(JSON.stringify(showcaseDocument), before);
  assert.deepEqual(entityIds(document).sort(), entityIds(showcaseDocument).sort());
  assert.deepEqual(independentDisplayViews(showcaseDocument), document);
  assert.deepEqual(independentDisplayViews(document), document);
  for (const profile of document.profiles) {
    const pages = pagesForProfile(document, profile.id);
    assert.equal(pages.length, showcaseDocument.pages.length);
    for (const page of pages)
      for (const tile of page.tiles) {
        assert.deepEqual(Object.keys(tile.layouts), [profile.id]);
        if (tile.navigateTo) assert.ok(pages.some((page) => page.id === tile.navigateTo));
      }
  }
  assert.equal(pagesForProfile(document, 'ipad')[0].id, 'overview');
  assert.equal(
    new Set(allControls(document).map((control) => control.id)).size,
    allControls(document).length,
  );
  const other = pagesForProfile(document, 'portrait')[0];
  other.tiles[0].title = 'Only portrait';
  assert.notEqual(pagesForProfile(document, 'ipad')[0].tiles[0].title, other.tiles[0].title);
  const alarm = other.tiles.find((tile) => tile.kind === 'alarm')!;
  assert.equal(
    resolveAction(document, { tileId: alarm.id, command: 'alarm', mode: 'armed_away' }).target
      .entity_id,
    'alarm_control_panel.demo_home',
  );
});
test('new displays can start empty or copy complete independent navigation and controls', () => {
  const base = independentDisplayViews(showcaseDocument);
  const copied = createDisplay(base, 'Kitchen iPad', 'ipad', true, 'Home');
  const pages = pagesForProfile(copied.document, copied.profileId);
  assert.equal(pages.length, showcaseDocument.pages.length);
  assert.ok(pages[0].tiles.find((tile) => tile.navigateTo)?.navigateTo);
  for (const tile of pages.flatMap((page) => page.tiles))
    if (tile.navigateTo) assert.ok(pages.some((page) => page.id === tile.navigateTo));
  const empty = createDisplay(base, 'Entry display', 'compact', false, 'Home');
  assert.equal(pagesForProfile(empty.document, empty.profileId).length, 1);
  assert.equal(pagesForProfile(empty.document, empty.profileId)[0].tiles.length, 0);
  assert.equal(base.profiles.length, 3);
});
test('copying to a different grid retains every tile, fits it and resolves only reachable navigation', () => {
  const base = independentDisplayViews(showcaseDocument);
  const target = createDisplay(base, 'Small', 'compact', false, 'Home');
  const resized = resizeDisplay(target.document, target.profileId, { columns: 6, rows: 4 });
  const result = duplicateView(resized, 'overview', target.profileId, 'Overview copy');
  assert.equal(dashboardSchema.safeParse(result.document).success, true);
  const copy = result.document.pages.find((page) => page.id === result.pageId)!;
  assert.equal(copy.tiles.length, 8);
  assert.ok(copy.tiles.every((tile) => !tile.navigateTo));
  assert.ok(
    copy.tiles.every(
      (tile) => tile.layouts[target.profileId].x + tile.layouts[target.profileId].w <= 6,
    ),
  );
  assert.equal(pagesForProfile(result.document, 'ipad')[0].tiles[0].id, 'weather');
  const tooSmall = resizeDisplay(target.document, target.profileId, { columns: 2, rows: 2 });
  assert.throws(() => duplicateView(tooSmall, 'overview', target.profileId, 'Too many tiles'));
});
test('deletion and ordering respect display boundaries, remove dangling links and retain at least one display and view', () => {
  const base = independentDisplayViews(showcaseDocument),
    other = JSON.stringify(pagesForProfile(base, 'portrait'));
  const moved = moveView(base, 'eg', -1);
  assert.equal(pagesForProfile(moved, 'ipad')[0].id, 'eg');
  assert.equal(JSON.stringify(pagesForProfile(moved, 'portrait')), other);
  const removed = deleteView(base, 'eg');
  assert.ok(!removed.pages.some((page) => page.id === 'eg'));
  assert.ok(!removed.pages.flatMap((page) => page.tiles).some((tile) => tile.navigateTo === 'eg'));
  const noCompact = deleteDisplay(base, 'compact');
  assert.equal(noCompact.profiles.length, 2);
  assert.equal(pagesForProfile(noCompact, 'compact').length, 0);
  const one = deleteDisplay(deleteDisplay(base, 'compact'), 'portrait');
  assert.throws(() => deleteDisplay(one, 'ipad'));
  let single = one;
  for (const page of pagesForProfile(one, 'ipad').slice(1)) single = deleteView(single, page.id);
  assert.throws(() => deleteView(single, single.pages[0].id));
});
test('display changes resize only their own views and reject cross-display navigation', () => {
  const base = independentDisplayViews(showcaseDocument),
    other = JSON.stringify(pagesForProfile(base, 'portrait'));
  const resized = resizeDisplay(base, 'ipad', { columns: 8, rows: 8 });
  assert.equal(dashboardSchema.safeParse(resized).success, true);
  assert.equal(JSON.stringify(pagesForProfile(resized, 'portrait')), other);
  const invalid = structuredClone(base);
  invalid.pages[0].tiles[0].navigateTo = pagesForProfile(invalid, 'portrait')[0].id;
  assert.equal(dashboardSchema.safeParse(invalid).success, false);
});
test('server migration makes a one-time recoverable backup and preserves draft publication separation and revisions', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'hapanel-displays-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const draft = structuredClone(showcaseDocument);
  draft.greeting = 'Unpublished';
  const original = {
    draft: { revision: 7, savedAt: new Date().toISOString(), document: draft },
    published: { revision: 6, savedAt: new Date().toISOString(), document: showcaseDocument },
    history: [],
  };
  await writeFile(join(dir, 'dashboard.json'), JSON.stringify(original));
  const store = new DocumentStore(dir);
  await store.init();
  const backup = await readFile(join(dir, 'dashboard-before-display-views.json'), 'utf8');
  assert.equal(backup, JSON.stringify(original));
  assert.equal(store.get().draft.revision, 7);
  assert.equal(store.get().published.revision, 6);
  assert.equal(store.get().draft.document.greeting, 'Unpublished');
  assert.notEqual(store.get().published.document.greeting, 'Unpublished');
  assert.equal(
    store.get().published.document.pages.length,
    showcaseDocument.pages.length * showcaseDocument.profiles.length,
  );
  const reopened = new DocumentStore(dir);
  await reopened.init();
  assert.equal(await readFile(join(dir, 'dashboard-before-display-views.json'), 'utf8'), backup);
  assert.deepEqual(reopened.get(), store.get());
});

test('copied sample displays preserve English localisation and custom edits remain untouched', async () => {
  const { localizeSampleDocument } = await import('../src/shared/demo');
  const document = independentDisplayViews(showcaseDocument);
  const english = localizeSampleDocument(document, 'en');
  const pages = pagesForProfile(english, 'portrait');
  assert.equal(pages[0].name, 'Home');
  assert.equal(pages[0].tiles[0].title, 'Vienna');
  assert.equal(pages.find((page) => page.originId === 'surveillance')!.name, 'Surveillance');
  pagesForProfile(document, 'portrait')[0].tiles[0].title = 'My weather';
  assert.equal(
    pagesForProfile(localizeSampleDocument(document, 'en'), 'portrait')[0].tiles[0].title,
    'My weather',
  );
});

test('theme and greeting are independent display settings and travel with copies', () => {
  const base = independentDisplayViews(showcaseDocument);
  const changed = resizeDisplay(base, 'ipad', {
    theme: 'sand',
    greeting: 'Kitchen welcome',
    subtitle: 'Only this display',
  });
  assert.equal(changed.theme, base.theme);
  assert.equal(changed.profiles.find((profile) => profile.id === 'portrait')!.greeting, undefined);
  const copy = createDisplay(changed, 'Kitchen copy', 'ipad', true, 'Home');
  const profile = copy.document.profiles.find((profile) => profile.id === copy.profileId)!;
  assert.equal(profile.theme, 'sand');
  assert.equal(profile.greeting, 'Kitchen welcome');
});
