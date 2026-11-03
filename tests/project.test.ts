import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { ImageStore } from '../src/server/assets';
import { showcaseDocument } from '../src/shared/showcase';
import { designPresets, designSchema } from '../src/shared/design';
import { imageReferences } from '../src/shared/assets';
import {
  exportProject,
  parseProject,
  importProject,
  PROJECT_MAX_BYTES,
} from '../src/client/project';
test('complete project files carry each referenced picture once, including dormant backgrounds, and preserve all layouts and bindings', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'hapanel-project-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = new ImageStore(join(root, 'source')),
    target = new ImageStore(join(root, 'target'));
  await source.init();
  await target.init();
  const photo = await source.upload({
    name: 'My mountain',
    data: (
      await sharp({ create: { width: 800, height: 500, channels: 3, background: '#335577' } })
        .jpeg()
        .toBuffer()
    ).toString('base64'),
  });
  const document = structuredClone(showcaseDocument);
  document.profiles[0].design = designSchema.parse({
    ...designPresets.glassDark,
    wallpaper: 'image',
    image: { assetId: photo.id },
  });
  document.pages[0].design = structuredClone(document.profiles[0].design);
  document.pages[0].design.wallpaper = 'gradient';
  const before = JSON.stringify(document);
  const raw = await exportProject(document, {
    portable: async (id) => ({
      id,
      name: 'My mountain',
      data: (await source.read(id)).toString('base64'),
    }),
  });
  const packageFile = parseProject(raw);
  assert.equal(packageFile.assets.length, 1);
  assert.equal(JSON.stringify(document), before);
  assert.equal(packageFile.document.pages.length, document.pages.length);
  const imported = await importProject(packageFile, {
    upload: async (blob, name) =>
      target.upload({ name, data: Buffer.from(await blob.arrayBuffer()).toString('base64') }),
  });
  assert.deepEqual(imported, JSON.parse(before));
  assert.equal(target.list().length, 1);
  assert.deepEqual(imageReferences(imported, true, true), [photo.id]);
});
test('incomplete, duplicate, excessive or cancelled project imports stage no images and leave their source unchanged', async () => {
  const document = structuredClone(showcaseDocument);
  document.profiles[0].design = designSchema.parse({
    ...designPresets.glassDark,
    wallpaper: 'image',
    image: { assetId: 'a'.repeat(64) },
  });
  assert.throws(() =>
    parseProject(JSON.stringify({ format: 'hapanel-project', version: 1, document, assets: [] })),
  );
  const asset = { id: 'a'.repeat(64), name: 'Test', data: 'YWJjZA==' };
  assert.throws(() =>
    parseProject(
      JSON.stringify({ format: 'hapanel-project', version: 1, document, assets: [asset, asset] }),
    ),
  );
  assert.throws(() => parseProject(' '.repeat(PROJECT_MAX_BYTES + 1)));
  const parsed = parseProject(
      JSON.stringify({ format: 'hapanel-project', version: 1, document, assets: [asset] }),
    ),
    original = JSON.stringify(parsed),
    cancel = new AbortController();
  cancel.abort();
  let calls = 0;
  await assert.rejects(
    importProject(
      parsed,
      {
        upload: async () => {
          calls++;
          throw Error('must not run');
        },
      },
      cancel.signal,
    ),
    { name: 'AbortError' },
  );
  assert.equal(calls, 0);
  assert.equal(JSON.stringify(parsed), original);
});
