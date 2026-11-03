import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import {
  isMessageKey,
  translate,
  UserError,
  type MessageKey,
  type MessageParams,
} from '../shared/i18n';
import { z } from 'zod';
import { dashboardSchema, type Dashboard, type Workspace } from '../shared/model';
import { independentDisplayViews } from '../shared/display-layouts';
import { ImageStore } from './assets';
import { imageReferences } from '../shared/assets';
import { demoDocument } from '../shared/demo';

export class HttpError extends Error {
  public messageKey?: MessageKey;
  public params?: MessageParams;
  constructor(
    public statusCode: number,
    reason: string | UserError,
  ) {
    const key =
      typeof reason === 'string' ? (isMessageKey(reason) ? reason : undefined) : reason.messageKey;
    super(
      key ? translate('en', key, typeof reason === 'string' ? {} : reason.params) : String(reason),
    );
    this.messageKey = key;
    this.params = typeof reason === 'string' ? undefined : reason.params;
  }
}
export async function atomicJson(path: string, value: unknown) {
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temp, path);
}
const revisionSchema = z
  .object({
    revision: z.number().int().positive(),
    savedAt: z.iso.datetime(),
    document: dashboardSchema,
  })
  .strict();
const workspaceSchema = z
  .object({
    draft: revisionSchema,
    published: revisionSchema,
    history: z.array(revisionSchema).max(30),
  })
  .strict();

export class DocumentStore extends EventEmitter {
  readonly images: ImageStore;
  private state!: Workspace;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private directory: string) {
    super();
    this.setMaxListeners(0);
    this.images = new ImageStore(join(directory, 'images'));
  }
  async init() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    let originalSource: string | undefined;
    try {
      originalSource = await readFile(join(this.directory, 'dashboard.json'), 'utf8');
      this.state = workspaceSchema.parse(JSON.parse(originalSource));
      await writeFile(join(this.directory, 'dashboard-before-2.0.json'), originalSource, {
        mode: 0o600,
        flag: 'wx',
      }).catch((error) => {
        if (error.code !== 'EEXIST') throw error;
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error(
          'Gespeichertes Dashboard ist ungültig. Originaldatei wurde nicht verändert.',
          { cause: error },
        );
      const revision = { revision: 1, savedAt: new Date().toISOString(), document: demoDocument };
      this.state = structuredClone({ draft: revision, published: revision, history: [] });
      await atomicJson(join(this.directory, 'dashboard.json'), this.state);
    }
    await this.images.init();
    const before = this.get(),
      next = this.get();
    next.draft.document = independentDisplayViews(next.draft.document);
    next.published.document = independentDisplayViews(next.published.document);
    if (JSON.stringify(before) !== JSON.stringify(next)) {
      await writeFile(
        join(this.directory, 'dashboard-before-display-views.json'),
        originalSource ?? JSON.stringify(before, null, 2),
        { mode: 0o600, flag: 'wx' },
      ).catch((error) => {
        if (error.code !== 'EEXIST') throw error;
      });
      await atomicJson(join(this.directory, 'dashboard.json'), next);
      this.state = next;
    }
  }
  get() {
    return structuredClone(this.state);
  }
  getRevision(scope: 'draft' | 'published') {
    return structuredClone(this.state[scope]);
  }
  private transact(change: (state: Workspace) => void) {
    const operation = this.queue.then(async () => {
      const next = this.get();
      change(next);
      await atomicJson(join(this.directory, 'dashboard.json'), next);
      this.state = next;
      this.emit('change');
      return this.get();
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
  save(document: Dashboard, expectedRevision: number) {
    const parsed = independentDisplayViews(dashboardSchema.parse(document));
    for (const id of imageReferences(parsed, true))
      if (!this.images.has(id)) throw new HttpError(400, 'image.missing');
    return this.transact((state) => {
      if (state.draft.revision !== expectedRevision) throw new HttpError(409, 'error.conflict');
      state.history = [state.draft, ...state.history].slice(0, 30);
      state.draft = {
        revision: state.draft.revision + 1,
        savedAt: new Date().toISOString(),
        document: parsed,
      };
    });
  }
  publish(expectedRevision: number) {
    return this.transact((state) => {
      if (state.draft.revision !== expectedRevision) throw new HttpError(409, 'error.saveFirst');
      state.published = structuredClone(state.draft);
    });
  }
  restore(revision: number, expectedRevision: number) {
    return this.transact((state) => {
      if (state.draft.revision !== expectedRevision) throw new HttpError(409, 'error.conflict');
      const target = [state.published, ...state.history].find((r) => r.revision === revision);
      if (!target) throw new HttpError(404, 'error.revisionMissing');
      state.history = [state.draft, ...state.history].slice(0, 30);
      state.draft = {
        revision: state.draft.revision + 1,
        savedAt: new Date().toISOString(),
        document: independentDisplayViews(target.document),
      };
    });
  }
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const deviceSettingsSchema = z
  .object({
    profileId: z.string().max(64).optional(),
    pageId: z.string().max(64).optional(),
    language: z.enum(['auto', 'de', 'en']).optional(),
    readOnly: z.boolean().optional(),
    cameraBlocked: z.boolean().optional(),
    alarmBlocked: z.boolean().optional(),
    allowedProfiles: z.array(z.string().max(64)).min(1).max(8).optional(),
  })
  .strict();
export type DeviceSettings = z.infer<typeof deviceSettingsSchema>;
const pairingFile = z.object({
  viewers: z
    .record(
      z
        .string()
        .max(100)
        .refine((id) => !['__proto__', 'constructor', 'prototype'].includes(id)),
      deviceSettingsSchema,
    )
    .optional(),
  codes: z.array(z.object({ digest: z.string(), expires: z.number() })),
  devices: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      digest: z.string(),
      createdAt: z.string(),
      expires: z.number(),
      settings: deviceSettingsSchema.optional(),
    }),
  ),
});
type Pairings = z.infer<typeof pairingFile>;
export class PairingStore extends EventEmitter {
  private observations = new Map<
    string,
    { width: number; height: number; dpr: number; lastSeen: number }
  >();
  private identifications = new Map<string, number>();
  observe(id: string, size: { width: number; height: number; dpr: number }) {
    this.observations.set(id, { ...size, lastSeen: Date.now() });
  }
  identify(id: string) {
    this.identifications.set(id, Date.now() + 15000);
    this.emit('change');
  }
  identification(id: string) {
    return this.identifications.get(id) ?? 0;
  }
  private state: Pairings = { codes: [], devices: [] };
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private directory: string) {
    super();
    this.setMaxListeners(0);
  }
  async init() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    try {
      const original = await readFile(join(this.directory, 'devices.json'), 'utf8');
      this.state = pairingFile.parse(JSON.parse(original));
      await writeFile(join(this.directory, 'devices-before-2.0.json'), original, {
        mode: 0o600,
        flag: 'wx',
      }).catch((error) => {
        if (error.code !== 'EEXIST') throw error;
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  private update<T>(change: (state: Pairings) => T): Promise<T> {
    const operation = this.queue.then(async () => {
      const next = structuredClone(this.state);
      next.codes = next.codes.filter((c) => c.expires > Date.now());
      next.devices = next.devices.filter((d) => d.expires > Date.now());
      const result = change(next);
      await atomicJson(join(this.directory, 'devices.json'), next);
      this.state = next;
      this.emit('change');
      return result;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
  createCode() {
    return this.update((state) => {
      const code = randomBytes(5).toString('hex').toUpperCase();
      const expires = Date.now() + 5 * 60_000;
      state.codes = [...state.codes.slice(-9), { digest: hash(code), expires }];
      return { code, expires };
    });
  }
  pair(code: string, name: string) {
    return this.update((state) => {
      const digest = hash(code.toUpperCase().replace(/[\s-]/g, ''));
      const index = state.codes.findIndex((c) => c.digest === digest);
      if (index < 0) throw new HttpError(401, 'error.pairCode');
      state.codes.splice(index, 1);
      const token = randomBytes(32).toString('base64url');
      const device = {
        id: randomUUID(),
        name,
        digest: hash(token),
        createdAt: new Date().toISOString(),
        expires: Date.now() + 90 * 86400_000,
      };
      state.devices.push(device);
      return { token, device: { id: device.id, name: device.name } };
    });
  }
  authenticate(token: string | undefined) {
    if (!token) return undefined;
    return this.state.devices.find((d) => d.digest === hash(token) && d.expires > Date.now());
  }
  list() {
    return this.state.devices
      .filter((d) => d.expires > Date.now())
      .map(({ digest: _, ...d }) => ({ ...d, observation: this.observations.get(d.id) }));
  }
  configure(id: string, settings: DeviceSettings) {
    return this.update((state) => {
      const device = state.devices.find((d) => d.id === id);
      if (!device) throw new HttpError(404, 'error.pairRequired');
      device.settings = deviceSettingsSchema.parse(settings);
    });
  }
  viewerSettings(id: string) {
    return this.state.viewers && Object.hasOwn(this.state.viewers, id)
      ? this.state.viewers[id]
      : undefined;
  }
  viewers() {
    return structuredClone(this.state.viewers ?? {});
  }
  configureViewer(id: string, settings: DeviceSettings) {
    if (
      !/^[a-zA-Z0-9_-]{1,100}$/.test(id) ||
      ['__proto__', 'constructor', 'prototype'].includes(id)
    )
      throw new HttpError(400, 'error.valueRange');
    return this.update((state) => {
      state.viewers ??= {};
      if (!Object.hasOwn(state.viewers, id) && Object.keys(state.viewers).length >= 128)
        throw new HttpError(400, 'error.valueRange');
      state.viewers[id] = deviceSettingsSchema.parse(settings);
    });
  }
  revoke(id: string) {
    return this.update((state) => {
      state.devices = state.devices.filter((d) => d.id !== id);
    });
  }
}
