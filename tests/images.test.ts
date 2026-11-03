import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { ImageStore } from '../src/server/assets';
import { DocumentStore, PairingStore } from '../src/server/store';
import { createApp } from '../src/server/app';
import { HomeAssistantHub } from '../src/server/hub';
import { designPresets, designSchema, exportDesign, parseDesignFile } from '../src/shared/design';
import { createDisplay, duplicateView } from '../src/shared/display-layouts';
import { imageReferences } from '../src/shared/assets';
import packageInfo from '../package.json';
const raster = async () =>
  sharp({ create: { width: 1200, height: 700, channels: 3, background: '#4569a2' } })
    .withExif({ IFD0: { Artist: 'PRIVATE-EXIF-TEST' } })
    .jpeg()
    .toBuffer();
async function fixture(t: { after: (fn: () => unknown) => void }) {
  const dir = await mkdtemp(join(tmpdir(), 'hapanel-images-')),
    store = new DocumentStore(dir),
    pairings = new PairingStore(dir),
    hub = new HomeAssistantHub({ demo: true });
  await store.init();
  await pairings.init();
  const app = await createApp({
    mode: 'ingress',
    surface: 'editor',
    store,
    pairings,
    hub,
    displayEnabled: true,
    isAdmin: async (id) => id === 'admin',
    isActiveUser: async (id) => ['admin', 'viewer'].includes(id),
    cameraAccess: 'authenticated',
    alarmAccess: 'authenticated',
  });
  await app.ready();
  const display = await createApp({
    mode: 'standalone',
    surface: 'display',
    store,
    pairings,
    hub,
    displayEnabled: true,
    cameraAccess: 'authenticated',
    alarmAccess: 'authenticated',
  });
  await display.ready();
  t.after(async () => {
    for (const client of app.websocketServer.clients) client.terminate();
    await app.close();
    await display.close();
    await hub.stop();
    await rm(dir, { recursive: true, force: true });
  });
  const request = (
    id: string,
    url: string,
    method: 'GET' | 'POST' | 'PATCH' = 'GET',
    payload?: Record<string, unknown>,
  ) =>
    app.inject({
      remoteAddress: '172.30.32.2',
      headers: { 'x-remote-user-id': id },
      url,
      method,
      payload,
    });
  return { dir, store, pairings, hub, app, display, request };
}
const photo = (assetId: string) =>
  designSchema.parse({ ...designPresets.glassDark, wallpaper: 'image', image: { assetId } });
test('photo ingestion strips EXIF, uses bounded WebP previews and preserves identity across portable copies', async (t) => {
  const { dir, store } = await fixture(t),
    input = await raster();
  assert.ok((await sharp(input).metadata()).exif);
  const meta = await store.images.upload({ name: 'Mein Foto', data: input.toString('base64') });
  const full = await store.images.read(meta.id),
    thumb = await store.images.read(meta.id, true);
  const info = await sharp(full).metadata();
  assert.equal(info.format, 'webp');
  assert.equal(info.exif, undefined);
  assert.equal(info.xmp, undefined);
  assert.equal(info.width, 1200);
  assert.ok((await sharp(thumb).metadata()).width! <= 360);
  assert.equal(
    (await store.images.upload({ name: 'Duplicate', data: input.toString('base64') })).id,
    meta.id,
  );
  const copyDir = join(dir, 'portable-copy'),
    copy = new ImageStore(copyDir);
  await copy.init();
  assert.equal((await copy.upload({ name: meta.name, data: full.toString('base64') })).id, meta.id);
  const file = exportDesign('Photo Design', photo(meta.id), {
    id: meta.id,
    name: meta.name,
    data: full.toString('base64'),
  });
  const parsed = parseDesignFile(file);
  assert.equal(parsed.version, 2);
  assert.equal(parsed.appearance.image?.assetId, meta.id);
  assert.throws(() => exportDesign('Missing', photo(meta.id)));
  assert.throws(() => parseDesignFile(file.replace(meta.id, 'a'.repeat(64))));
  const reopened = new ImageStore(join(dir, 'images'));
  await reopened.init();
  assert.deepEqual(reopened.list(), store.images.list());
  assert.equal(
    (await readdir(join(dir, 'images'))).some((name) => name.includes('Mein Foto')),
    false,
  );
});
test('archiving is reversible and retains pixels used by current designs and old revisions', async (t) => {
  const { store } = await fixture(t);
  const meta = await store.images.upload({
    name: 'Original',
    data: (await raster()).toString('base64'),
  });
  const original = await store.images.read(meta.id);
  const draft = store.getRevision('draft');
  draft.document.profiles[0].design = photo(meta.id);
  let state = await store.save(draft.document, draft.revision);
  await store.publish(state.draft.revision);
  await store.images.update(meta.id, { archived: true, name: 'Archivbild' });
  assert.equal(store.images.list()[0].archived, true);
  assert.deepEqual(await store.images.read(meta.id), original);
  await store.images.update(meta.id, { archived: false });
  assert.equal(store.images.list()[0].archived, false);
  state = await store.save({ ...state.draft.document, greeting: 'Changed' }, state.draft.revision);
  const restored = await store.restore(draft.revision + 1, state.draft.revision);
  assert.equal(restored.draft.document.profiles[0].design?.image?.assetId, meta.id);
});
test('invalid, executable or oversized raster uploads are rejected without creating gallery entries', async (t) => {
  const { store, request } = await fixture(t);
  for (const bytes of [
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>bad()</script></svg>'),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]),
    Buffer.from('RIFF1234WEBPgarbage'),
  ])
    await assert.rejects(store.images.upload({ name: 'Invalid', data: bytes.toString('base64') }));
  assert.equal(store.images.list().length, 0);
  assert.equal(
    (
      await request('admin', '/api/editor/assets', 'POST', {
        name: 'Broken',
        data: Buffer.from('not an image').toString('base64'),
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await request('admin', '/api/editor/assets', 'POST', {
        name: 'Large',
        data: 'a'.repeat(3 * 1024 * 1024),
      })
    ).statusCode,
    413,
  );
  assert.equal((await request('admin', '/api/editor/assets/not-an-id')).statusCode, 400);
  assert.equal((await request('viewer', '/api/editor/assets')).statusCode, 403);
  assert.equal(
    (
      await request('viewer', '/api/editor/assets', 'POST', {
        name: 'Denied',
        data: (await raster()).toString('base64'),
      })
    ).statusCode,
    403,
  );
});
test('display photos require publication, an allowed display and an active wallpaper binding; gallery-only images stay private', async (t) => {
  const { store, pairings, display, request } = await fixture(t);
  const first = await store.images.upload({
    name: 'Visible',
    data: (await raster()).toString('base64'),
  });
  const otherBytes = await sharp({
    create: { width: 300, height: 200, channels: 3, background: '#996644' },
  })
    .png()
    .toBuffer();
  const other = await store.images.upload({ name: 'Private', data: otherBytes.toString('base64') });
  let document = store.getRevision('draft').document;
  const a = document.profiles[0].id;
  const created = createDisplay(document, 'Second', a, true, 'Home');
  document = created.document;
  const b = created.profileId;
  document.profiles.find((p) => p.id === a)!.design = photo(first.id);
  document.profiles.find((p) => p.id === b)!.design = photo(other.id);
  document.designs = [{ id: 'private_palette', name: 'Private', appearance: photo(other.id) }];
  const saved = await store.save(document, 1);
  assert.equal((await request('viewer', '/api/display/assets/' + first.id)).statusCode, 403);
  await store.publish(saved.draft.revision);
  assert.equal((await request('viewer', '/api/display/assets/' + first.id)).statusCode, 200);
  const { code } = await pairings.createCode(),
    paired = await pairings.pair(code, 'Tablet');
  await pairings.configure(paired.device.id, { profileId: a, allowedProfiles: [a] });
  const get = (id: string) =>
    display.inject({
      url: '/api/display/assets/' + id,
      headers: { cookie: 'hapanel_device=' + paired.token },
    });
  assert.equal((await get(first.id)).statusCode, 200);
  assert.equal((await get(other.id)).statusCode, 403);
  await store.images.update(first.id, { archived: true });
  assert.equal((await get(first.id)).statusCode, 200);
  const hidden = store.getRevision('draft');
  hidden.document.profiles.find((p) => p.id === a)!.design!.wallpaper = 'gradient';
  const next = await store.save(hidden.document, hidden.revision);
  await store.publish(next.draft.revision);
  assert.equal((await get(first.id)).statusCode, 403);
  await pairings.revoke(paired.device.id);
  assert.equal((await get(first.id)).statusCode, 401);
  assert.equal(
    (await request('admin', '/api/display/bootstrap')).json().appVersion,
    packageInfo.version,
  );
});
test('view-specific appearance copies independently and missing image imports never overwrite the draft', async (t) => {
  const { store } = await fixture(t);
  let document = store.getRevision('draft').document;
  document.pages[0].design = {
    ...structuredClone(designPresets.aurora),
    gradient: { from: '#112233', to: '#ddeeff', angle: 45, kind: 'linear' },
  };
  const copied = duplicateView(document, document.pages[0].id, document.profiles[0].id, 'Copy');
  const page = copied.document.pages.find((p) => p.id === copied.pageId)!;
  assert.deepEqual(page.design, document.pages[0].design);
  page.design!.blur = 3;
  assert.notEqual(document.pages[0].design.blur, 3);
  const broken = structuredClone(document);
  broken.profiles[0].design = photo('a'.repeat(64));
  await assert.rejects(async () => store.save(broken, 1), { statusCode: 400 });
  assert.equal(store.getRevision('draft').revision, 1);
  assert.deepEqual(
    imageReferences({
      ...broken,
      profiles: broken.profiles.map((p) => ({
        ...p,
        design: p.design ? { ...p.design, wallpaper: 'plain' } : p.design,
      })),
    }),
    [],
  );
});
