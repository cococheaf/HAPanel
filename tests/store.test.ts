import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocumentStore, PairingStore } from '../src/server/store';

test('saving and restoring drafts never modifies the published dashboard', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'hapanel-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new DocumentStore(dir);
  await store.init();
  const document = store.get().draft.document;
  document.greeting = 'Ein neuer Entwurf';
  const saved = await store.save(document, 1);
  assert.equal(saved.draft.revision, 2);
  assert.notEqual(saved.published.document.greeting, document.greeting);
  await store.publish(2);
  const restored = await store.restore(1, 2);
  assert.equal(restored.draft.revision, 3);
  assert.equal(restored.published.document.greeting, 'Ein neuer Entwurf');
  const reopened = new DocumentStore(dir);
  await reopened.init();
  assert.deepEqual(reopened.get(), store.get());
});
test('concurrent stale writes produce a conflict and preserve the successful revision', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'hapanel-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new DocumentStore(dir);
  await store.init();
  const first = store.get().draft.document,
    second = structuredClone(first);
  first.greeting = 'Erster Entwurf';
  second.greeting = 'Zweiter Entwurf';
  const results = await Promise.allSettled([store.save(first, 1), store.save(second, 1)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(store.get().draft.document.greeting, 'Erster Entwurf');
  await assert.rejects(store.publish(1), { statusCode: 409 });
});
test('an invalid stored document is never overwritten on startup', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'hapanel-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'dashboard.json');
  await writeFile(path, 'corrupted original');
  await assert.rejects(new DocumentStore(dir).init());
  assert.equal(await readFile(path, 'utf8'), 'corrupted original');
});
test('pairing codes are one-use, sessions persist as hashes and revocation is immediate', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'hapanel-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const pairs = new PairingStore(dir);
  await pairs.init();
  const { code } = await pairs.createCode();
  const { token, device } = await pairs.pair(code, 'iPad');
  assert.equal(pairs.authenticate(token)?.name, 'iPad');
  await assert.rejects(pairs.pair(code, 'Replay'), { statusCode: 401 });
  const file = await readFile(join(dir, 'devices.json'), 'utf8');
  assert.equal(file.includes(token), false);
  assert.equal(file.includes(code), false);
  const reopened = new PairingStore(dir);
  await reopened.init();
  assert.equal(reopened.authenticate(token)?.id, device.id);
  await reopened.revoke(device.id);
  assert.equal(reopened.authenticate(token), undefined);
});
