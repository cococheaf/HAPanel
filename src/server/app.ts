import { imageId, imageReferences, imageUploadSchema, imagePatchSchema } from '../shared/assets';
import Fastify, { type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { existsSync } from 'node:fs';
import { z, ZodError } from 'zod';
import { parse, stringify } from 'yaml';
import {
  actionSchema,
  dashboardSchema,
  entityIds,
  resolveAction,
  allControls,
  type Action,
  type Dashboard,
} from '../shared/model';
import { DocumentStore, HttpError, PairingStore, deviceSettingsSchema } from './store';
import { HomeAssistantHub } from './hub';
import { documentContacts } from '../shared/security';
import { cameraSignalSchema } from '../shared/camera';
import { publicEntity } from './cameras';
import packageInfo from '../../package.json';
import { errorMessage, isMessageKey, resolveLanguage, translate, UserError } from '../shared/i18n';

export interface AppOptions {
  mode: 'demo' | 'standalone' | 'ingress';
  surface: 'editor' | 'display';
  store: DocumentStore;
  pairings: PairingStore;
  hub: HomeAssistantHub;
  staticDir?: string;
  publicOrigin?: string;
  displayEnabled?: boolean;
  isAdmin?: (id: string) => Promise<boolean>;
  isActiveUser?: (id: string) => Promise<boolean>;
  cameraAccess?: 'admin' | 'authenticated';
  alarmAccess?: 'admin' | 'authenticated';
}
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const isLoopback = (address: string) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
const revisionBody = z.object({ expectedRevision: z.number().int().positive() }).strict();

export async function createApp(options: AppOptions) {
  const { store, pairings, hub } = options;
  const alarmAttempts = new Map<string, number[]>();
  const sharedCameras = options.cameraAccess === 'authenticated';
  const sharedAlarms = options.alarmAccess === 'authenticated';
  const displayRoles = new WeakMap<FastifyRequest, boolean>();
  const isAdmin = options.isAdmin ?? ((id: string) => hub.isAdmin(id));
  const isActiveUser = options.isActiveUser ?? ((id: string) => hub.isActiveUser(id));
  const isSupervisor = (request: FastifyRequest) =>
    ['172.30.32.2', '::ffff:172.30.32.2'].includes(request.ip);
  const snapshotFor = (
    document: Dashboard,
    alarmControl: boolean,
    cameraView = alarmControl,
    deviceControl = true,
  ) => {
    const snapshot = hub.getSnapshot(entityIds(document));
    snapshot.entities = Object.fromEntries(
      Object.entries(snapshot.entities).map(([id, entity]) => [id, publicEntity(entity)]),
    );
    return {
      ...snapshot,
      alarmControl,
      cameraView,
      deviceControl,
      contactSources: documentContacts(document, snapshot),
    };
  };
  const actor = (request: FastifyRequest) => {
    if (options.mode === 'ingress' && options.surface === 'editor' && isSupervisor(request))
      return 'ha:' + String(request.headers['x-remote-user-id']);
    const device = pairings.authenticate(request.cookies.hapanel_device);
    return device ? 'device:' + device.id : request.ip;
  };
  const performAction = async (
    document: Dashboard,
    action: Action,
    alarmControl = false,
    identity = '',
  ) => {
    if (action.command === 'alarm' && !alarmControl)
      throw new HttpError(403, 'error.alarmAdminRequired');
    try {
      resolveAction(document, action);
    } catch (error) {
      throw new HttpError(400, error instanceof UserError ? error : (error as Error).message);
    }
    if (action.command === 'alarm') {
      const now = Date.now();
      const attempts = (alarmAttempts.get(identity) ?? []).filter((time) => time > now - 60_000);
      if (attempts.length >= 5) throw new HttpError(429, 'error.alarmRateLimit');
      if (!alarmAttempts.has(identity) && alarmAttempts.size >= 128)
        alarmAttempts.delete(alarmAttempts.keys().next().value!);
      alarmAttempts.set(identity, [...attempts, now]);
    }
    try {
      await hub.act(document, action);
    } catch (error) {
      if (action.command === 'alarm') {
        const safeKeys = [
          'error.alarmUnsupported',
          'error.alarmCodeRequired',
          'error.alarmCodeFormat',
          'error.entityUnavailable',
          'error.haDisconnected',
        ];
        throw new HttpError(
          hub.getSnapshot([]).status === 'reconnecting' ? 503 : 400,
          error instanceof UserError && safeKeys.includes(error.messageKey)
            ? new UserError(error.messageKey)
            : 'error.alarmRejected',
        );
      }
      throw new HttpError(
        hub.getSnapshot([]).status === 'reconnecting' ? 503 : 400,
        error instanceof UserError ? error : (error as Error).message,
      );
    }
  };
  const app = Fastify({ logger: false, bodyLimit: 1024 * 1024, trustProxy: false });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(websocket, { options: { maxPayload: 128 * 1024 } });

  const sameOrigin = (request: FastifyRequest) => {
    const origin = request.headers.origin;
    if (!origin) return; // Non-browser clients still need the same authentication.
    try {
      const incoming = new URL(origin);
      if (options.publicOrigin && incoming.origin === new URL(options.publicOrigin).origin) return;
      if (
        options.surface === 'editor' &&
        options.mode !== 'ingress' &&
        localHosts.has(incoming.hostname) &&
        isLoopback(request.ip)
      )
        return;
      const host =
        options.mode === 'ingress' && isSupervisor(request)
          ? String(request.headers['x-forwarded-host'] ?? request.headers.host)
          : request.headers.host;
      if (incoming.host === host) return;
    } catch {
      /* reject invalid origins */
    }
    throw new HttpError(403, 'error.crossOrigin');
  };
  const ingressUser = (request: FastifyRequest) => {
    if (!isSupervisor(request)) throw new HttpError(403, 'error.ingressOnly');
    const user = request.headers['x-remote-user-id'];
    if (typeof user !== 'string' || !user) throw new HttpError(403, 'error.adminRequired');
    return user;
  };
  const requireEditor = async (request: FastifyRequest) => {
    sameOrigin(request);
    if (options.surface !== 'editor') throw new HttpError(403, 'error.editorUnavailable');
    if (options.mode === 'ingress') {
      if (!(await isAdmin(ingressUser(request)))) throw new HttpError(403, 'error.adminRequired');
    } else {
      const host = new URL(`http://${request.headers.host ?? ''}`).hostname;
      if (!isLoopback(request.ip) || !localHosts.has(host))
        throw new HttpError(403, 'error.localEditor');
    }
  };
  const ingressDisplay = options.mode === 'ingress' && options.surface === 'editor';
  const requireDisplay = async (request: FastifyRequest) => {
    sameOrigin(request);
    if (ingressDisplay) {
      const user = ingressUser(request);
      const admin = await isAdmin(user);
      if (!admin && (!(sharedCameras || sharedAlarms) || !(await isActiveUser(user))))
        throw new HttpError(403, 'error.displayAccessRequired');
      displayRoles.set(request, admin);
      return;
    }
    if (!pairings.authenticate(request.cookies.hapanel_device))
      throw new HttpError(401, 'error.pairRequired');
    displayRoles.set(request, false);
  };
  const settingsFor = (request: FastifyRequest) =>
    displayRoles.get(request) === true
      ? undefined
      : ingressDisplay
        ? pairings.viewerSettings(ingressUser(request))
        : pairings.authenticate(request.cookies.hapanel_device)?.settings;
  const publishedFor = (request: FastifyRequest) => {
    const revision = store.getRevision('published');
    // Saved templates belong to the administrator, not to paired display payloads.
    delete revision.document.designs;
    const allowed = settingsFor(request)?.allowedProfiles;
    if (allowed) {
      const originalCameras = revision.document.pages
        .flatMap((page) => page.tiles)
        .filter((tile) => tile.kind === 'camera');
      revision.document.profiles = revision.document.profiles.filter((p) => allowed.includes(p.id));
      revision.document.pages = revision.document.pages.filter(
        (p) => !p.profileIds || p.profileIds.some((id) => allowed.includes(id)),
      );
      revision.document.alerts = revision.document.alerts?.filter(
        (rule) => !rule.profileIds || rule.profileIds.some((id) => allowed.includes(id)),
      );
      const permittedCameras = revision.document.pages
        .flatMap((page) => page.tiles)
        .filter((tile) => tile.kind === 'camera');
      for (const rule of revision.document.alerts ?? [])
        if (rule.cameraTileId && !permittedCameras.some((tile) => tile.id === rule.cameraTileId)) {
          const original = originalCameras.find((tile) => tile.id === rule.cameraTileId);
          rule.cameraTileId = permittedCameras.find(
            (tile) => tile.entityId === original?.entityId,
          )?.id;
        }
      if (!revision.document.profiles.length)
        throw new HttpError(403, 'error.displayAccessRequired');
    }
    return revision;
  };
  const canControlDevices = (request: FastifyRequest) =>
    (!ingressDisplay || displayRoles.get(request) === true) && !settingsFor(request)?.readOnly;
  const canControlAlarm = (request: FastifyRequest) =>
    displayRoles.get(request) === true ||
    (sharedAlarms && !settingsFor(request)?.alarmBlocked && !settingsFor(request)?.readOnly);
  const canViewCameras = (request: FastifyRequest) =>
    displayRoles.get(request) === true || (sharedCameras && !settingsFor(request)?.cameraBlocked);

  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' ws: wss:; font-src 'self'; base-uri 'self'; object-src 'none'",
    );
  });
  app.setErrorHandler(
    (error: Error & { statusCode?: number; messageKey?: string }, request, reply) => {
      const status =
        error instanceof ZodError
          ? 400
          : error instanceof UserError
            ? error.messageKey === 'image.busy'
              ? 429
              : error.messageKey === 'image.storageFull'
                ? 507
                : 400
            : (error.statusCode ?? 500);
      const language = resolveLanguage(request.headers['accept-language']);
      const messageKey =
        error.messageKey && isMessageKey(error.messageKey)
          ? error.messageKey
          : status === 429
            ? 'error.rateLimit'
            : undefined;
      const message =
        error instanceof ZodError || messageKey
          ? errorMessage(
              messageKey && !error.messageKey ? new UserError(messageKey) : error,
              language,
            )
          : status < 500
            ? error.message
            : translate(language, 'error.requestFailed');
      reply
        .code(status)
        .header('Content-Language', language)
        .send({ error: message, ...(messageKey ? { messageKey } : {}) });
    },
  );
  app.get('/api/health', async () => ({
    ok: true,
    version: packageInfo.version,
    source: hub.getSnapshot([]).status,
  }));

  if (options.surface === 'editor') {
    app.register(
      async (admin) => {
        admin.addHook('onRequest', requireEditor);
        admin.addHook('onSend', async (_request, reply) => {
          reply.header('Cache-Control', 'no-store');
        });
        admin.get('/bootstrap', async () => ({
          workspace: store.get(),
          snapshot: snapshotFor(store.getRevision('draft').document, true),
          catalog: (await hub.getCatalog()).map(publicEntity),
          mode: hub.getSnapshot([]).status === 'demo' ? 'demo' : 'live',
          displayEnabled: options.displayEnabled ?? false,
          access: {
            camera: sharedCameras ? 'authenticated' : 'admin',
            alarm: sharedAlarms ? 'authenticated' : 'admin',
          },
        }));
        admin.put('/draft', async (request) => {
          const body = z
            .object({ document: dashboardSchema, expectedRevision: z.number().int().positive() })
            .strict()
            .parse(request.body);
          return store.save(body.document, body.expectedRevision);
        });
        admin.post('/publish', async (request) =>
          store.publish(revisionBody.parse(request.body).expectedRevision),
        );
        admin.post('/restore', async (request) => {
          const body = revisionBody
            .extend({ revision: z.number().int().positive() })
            .parse(request.body);
          return store.restore(body.revision, body.expectedRevision);
        });
        admin.post('/import', async (request) => {
          const body = z
            .object({
              source: z.string().max(1024 * 1024),
              format: z.enum(['json', 'yaml']),
              expectedRevision: z.number().int().positive(),
            })
            .strict()
            .parse(request.body);
          let document: unknown;
          try {
            document =
              body.format === 'yaml'
                ? parse(body.source, { maxAliasCount: 0 })
                : JSON.parse(body.source);
          } catch {
            throw new HttpError(400, 'error.importParse');
          }
          return store.save(dashboardSchema.parse(document), body.expectedRevision);
        });
        admin.get('/export', async (request, reply) => {
          const query = z
            .object({ format: z.enum(['json', 'yaml']).default('json') })
            .parse(request.query);
          reply.type(query.format === 'yaml' ? 'application/yaml' : 'application/json');
          reply.header('Content-Disposition', `attachment; filename="hapanel.${query.format}"`);
          return query.format === 'yaml'
            ? stringify(store.getRevision('draft').document)
            : JSON.stringify(store.getRevision('draft').document, null, 2);
        });
        admin.post(
          '/action',
          { config: { rateLimit: { max: 20, timeWindow: 1000 } } },
          async (request) => {
            const body = z
              .object({ enabled: z.literal(true), action: actionSchema })
              .strict()
              .parse(request.body);
            await performAction(
              store.getRevision('draft').document,
              body.action,
              true,
              actor(request),
            );
            return { ok: true };
          },
        );
        admin.get('/devices', async () => pairings.list());
        admin.put<{ Params: { id: string } }>('/devices/:id', async (request) => {
          await pairings.configure(request.params.id, deviceSettingsSchema.parse(request.body));
          return { ok: true };
        });
        admin.get('/catalog', async () => (await hub.getCatalog(true)).map(publicEntity));
        admin.get('/users', async () => hub.getUsers());
        admin.get('/viewers', async () => pairings.viewers());
        admin.put<{ Params: { id: string } }>('/viewers/:id', async (request) => {
          if (!/^[a-zA-Z0-9_-]{1,100}$/.test(request.params.id))
            throw new HttpError(400, 'error.valueRange');
          await pairings.configureViewer(
            request.params.id,
            deviceSettingsSchema.parse(request.body),
          );
          return { ok: true };
        });
        admin.post<{ Params: { id: string } }>('/devices/:id/identify', async (request) => {
          if (!pairings.list().some((d) => d.id === request.params.id))
            throw new HttpError(404, 'error.pairRequired');
          pairings.identify(request.params.id);
          return { ok: true };
        });
        admin.get('/structure', async () => hub.getStructure());
        admin.get('/diagnostics', async () => ({
          version: packageInfo.version,
          ...hub.diagnostics(),
          connection: hub.getSnapshot([]).status,
          draftRevision: store.get().draft.revision,
          publishedRevision: store.get().published.revision,
          profiles: store.get().draft.document.profiles.length,
          pairedDisplays: pairings.list().length,
          cameraAccess: sharedCameras ? 'authenticated' : 'admin',
          alarmAccess: sharedAlarms ? 'authenticated' : 'admin',
          uptimeSeconds: Math.floor(process.uptime()),
        }));
        admin.get<{ Params: { entityId: string }; Querystring: { range?: string } }>(
          '/statistics/:entityId',
          async (request) => {
            if (!entityIds(store.getRevision('draft').document).includes(request.params.entityId))
              throw new HttpError(403, 'error.tileNotAllowed');
            return hub.getStatistics(
              request.params.entityId,
              z.enum(['day', 'week', 'month']).parse(request.query.range ?? 'day'),
            );
          },
        );

        admin.get('/assets', async () => ({ images: store.images.list() }));
        admin.post(
          '/assets',
          { bodyLimit: 3 * 1024 * 1024, config: { rateLimit: { max: 240, timeWindow: 60_000 } } },
          async (request) => store.images.upload(imageUploadSchema.parse(request.body)),
        );
        admin.patch<{ Params: { id: string } }>('/assets/:id', async (request) =>
          store.images.update(
            imageId.parse(request.params.id),
            imagePatchSchema.parse(request.body),
          ),
        );
        admin.get<{ Params: { id: string }; Querystring: { thumbnail?: string } }>(
          '/assets/:id',
          async (request, reply) => {
            const id = imageId.parse(request.params.id);
            if (!store.images.has(id)) throw new HttpError(404, 'image.missing');
            return reply
              .header('Cache-Control', 'no-store')
              .type('image/webp')
              .send(await store.images.read(id, request.query.thumbnail === '1'));
          },
        );

        admin.post('/pair-code', async () => pairings.createCode());
        admin.delete<{ Params: { id: string } }>('/devices/:id', async (request) => {
          await pairings.revoke(request.params.id);
          return { ok: true };
        });
        admin.get<{ Params: { id: string } }>('/media/:id', async (request, reply) => {
          const tile = allControls(store.getRevision('draft').document).find(
            (t) => t.id === request.params.id && t.kind === 'media',
          );
          const result = tile && (await hub.media(tile.entityId));
          if (!result) throw new HttpError(404, 'error.noAlbumArt');
          return reply.type(result.type).send(result.buffer);
        });
        admin.get<{ Params: { entityId: string } }>(
          '/history/:entityId',
          { config: { rateLimit: { max: 60, timeWindow: 60_000 } } },
          async (request) => {
            if (!entityIds(store.getRevision('draft').document).includes(request.params.entityId))
              throw new HttpError(403, 'error.tileNotAllowed');
            return hub.getHistory(request.params.entityId);
          },
        );
        admin.get('/stream', { websocket: true }, (socket, request) => {
          const send = () => {
            if (socket.readyState === 1)
              socket.send(
                JSON.stringify({
                  type: 'snapshot',
                  snapshot: snapshotFor(store.getRevision('draft').document, true),
                }),
              );
          };
          hub.on('snapshot', send);
          const interval = setInterval(
            () => void requireEditor(request).catch(() => socket.close(1008)),
            20_000,
          );
          send();
          socket.on('close', () => {
            clearInterval(interval);
            hub.off('snapshot', send);
          });
        });
      },
      { prefix: '/api/editor' },
    );
  }

  app.post(
    '/api/pair',
    { config: { rateLimit: { max: 5, timeWindow: 60_000 } } },
    async (request, reply) => {
      sameOrigin(request);
      const body = z
        .object({ code: z.string().min(1).max(30), name: z.string().trim().min(1).max(64) })
        .strict()
        .parse(request.body);
      const { token, device } = await pairings.pair(body.code, body.name);
      reply.setCookie('hapanel_device', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: options.publicOrigin?.startsWith('https:') ?? false,
        path: '/',
        maxAge: 90 * 86400,
      });
      reply.header('Cache-Control', 'no-store');
      return device;
    },
  );
  app.register(
    async (display) => {
      display.addHook('onRequest', requireDisplay);
      display.addHook('onSend', async (_request, reply) => {
        reply.header('Cache-Control', 'no-store');
      });
      display.get('/bootstrap', async (request) => ({
        appVersion: packageInfo.version,
        settings: settingsFor(request),
        identifyUntil: pairings.identification(
          pairings.authenticate(request.cookies.hapanel_device)?.id ?? '',
        ),
        published: publishedFor(request),
        snapshot: snapshotFor(
          publishedFor(request).document,
          canControlAlarm(request),
          canViewCameras(request),
          canControlDevices(request),
        ),
        canEdit: displayRoles.get(request) === true,
        canControl: canControlDevices(request),
      }));
      display.get<{ Params: { id: string }; Querystring: { thumbnail?: string } }>(
        '/assets/:id',
        async (request, reply) => {
          const id = imageId.parse(request.params.id);
          if (!imageReferences(publishedFor(request).document).includes(id))
            throw new HttpError(403, 'image.notAllowed');
          if (!store.images.has(id)) throw new HttpError(404, 'image.missing');
          return reply
            .type('image/webp')
            .send(await store.images.read(id, request.query.thumbnail === '1'));
        },
      );
      display.get<{ Params: { entityId: string }; Querystring: { range?: string } }>(
        '/statistics/:entityId',
        { config: { rateLimit: { max: 30, timeWindow: 60000 } } },
        async (request) => {
          if (!entityIds(publishedFor(request).document).includes(request.params.entityId))
            throw new HttpError(403, 'error.tileNotAllowed');
          return hub.getStatistics(
            request.params.entityId,
            z.enum(['day', 'week', 'month']).parse(request.query.range ?? 'day'),
          );
        },
      );
      display.post(
        '/observe',
        { config: { rateLimit: { max: 10, timeWindow: 60000 } } },
        async (request) => {
          const size = z
            .object({
              width: z.number().int().min(200).max(16384),
              height: z.number().int().min(200).max(16384),
              dpr: z.number().min(0.5).max(8),
            })
            .strict()
            .parse(request.body);
          const device = pairings.authenticate(request.cookies.hapanel_device);
          if (device) pairings.observe(device.id, size);
          return { ok: true };
        },
      );
      display.post(
        '/action',
        { config: { rateLimit: { max: 20, timeWindow: 1000 } } },
        async (request) => {
          const action = actionSchema.parse(request.body);
          if (
            !canControlDevices(request) &&
            (action.command !== 'alarm' || !canControlAlarm(request))
          )
            throw new HttpError(403, 'error.viewerReadOnly');
          await performAction(
            publishedFor(request).document,
            action,
            canControlAlarm(request),
            actor(request),
          );
          return { ok: true };
        },
      );
      display.get<{ Params: { id: string } }>('/media/:id', async (request, reply) => {
        const tile = allControls(publishedFor(request).document).find(
          (t) => t.id === request.params.id && t.kind === 'media',
        );
        const result = tile && (await hub.media(tile.entityId));
        if (!result) throw new HttpError(404, 'error.noAlbumArt');
        return reply.type(result.type).send(result.buffer);
      });
      display.get<{ Params: { entityId: string } }>(
        '/history/:entityId',
        { config: { rateLimit: { max: 60, timeWindow: 60_000 } } },
        async (request) => {
          if (!entityIds(publishedFor(request).document).includes(request.params.entityId))
            throw new HttpError(403, 'error.tileNotAllowed');
          return hub.getHistory(request.params.entityId);
        },
      );
      display.get('/stream', { websocket: true }, (socket, request) => {
        const token = request.cookies.hapanel_device;
        let revision = -1;
        let signature = '';
        const send = () => {
          if (!ingressDisplay && !pairings.authenticate(token)) {
            socket.close(1008, 'Device access revoked');
            return;
          }
          if (socket.readyState !== 1) return;
          if (socket.bufferedAmount > 1024 * 1024) {
            socket.close(1013, 'Slow connection');
            return;
          }
          let published: ReturnType<typeof publishedFor>;
          try {
            published = publishedFor(request);
          } catch {
            socket.close(1008);
            return;
          }
          const nextSignature = JSON.stringify(published.document.profiles.map((p) => p.id));
          const changed = published.revision !== revision || signature !== nextSignature;
          signature = nextSignature;
          revision = published.revision;
          socket.send(
            JSON.stringify({
              type: 'snapshot',
              appVersion: packageInfo.version,
              snapshot: snapshotFor(
                published.document,
                canControlAlarm(request),
                canViewCameras(request),
                canControlDevices(request),
              ),
              identifyUntil: pairings.identification(
                pairings.authenticate(request.cookies.hapanel_device)?.id ?? '',
              ),
              settings: settingsFor(request),
              canEdit: displayRoles.get(request) === true,
              canControl: canControlDevices(request),
              ...(changed ? { published } : {}),
            }),
          );
        };
        const notify = (alertId: string) => {
          try {
            if (
              socket.readyState === 1 &&
              publishedFor(request).document.alerts?.some((rule) => rule.id === alertId)
            )
              socket.send(JSON.stringify({ alertId }));
          } catch {
            socket.close(1008);
          }
        };
        hub.on('notification', notify);
        hub.on('snapshot', send);
        store.on('change', send);
        pairings.on('change', send);
        const interval = setInterval(
          () =>
            void requireDisplay(request)
              .then(send)
              .catch(() => socket.close(1008)),
          20_000,
        );
        send();
        socket.on('close', () => {
          hub.off('snapshot', send);
          hub.off('notification', notify);
          store.off('change', send);
          pairings.off('change', send);
          clearInterval(interval);
        });
      });
    },
    { prefix: '/api/display' },
  );

  const cameraContexts = [
    {
      prefix: '/api/display/camera',
      document: (request: FastifyRequest) => publishedFor(request).document,
      authorize: requireDisplay,
      allowed: canViewCameras,
    },
    ...(options.surface === 'editor'
      ? [
          {
            prefix: '/api/editor/camera',
            document: () => store.getRevision('draft').document,
            authorize: requireEditor,
            allowed: (_request: FastifyRequest) => true,
          },
        ]
      : []),
  ];
  const cameraPeers = new Map<object, string>();
  for (const context of cameraContexts.flatMap((context) => [
    { ...context, overview: false },
    { ...context, overview: true },
  ])) {
    const routeBase = context.prefix + '/:id' + (context.overview ? '/overview' : '');
    const boundCamera = (id: string, request: FastifyRequest) => {
      const tile = context
        .document(request)
        .pages.flatMap((page) => page.tiles)
        .find((tile) => tile.id === id && tile.kind === 'camera');
      if (!tile) return;
      const overview = context.overview ? tile.camera?.overviewEntityId : undefined;
      return { ...tile, entityId: overview ?? tile.entityId };
    };
    app.get<{ Params: { id: string } }>(
      routeBase + '/capabilities',
      { onRequest: context.authorize, config: { rateLimit: { max: 120, timeWindow: 60_000 } } },
      async (request, reply) => {
        if (!context.allowed(request)) throw new HttpError(403, 'error.cameraAdminRequired');
        reply.header('Cache-Control', 'no-store');
        const tile = boundCamera(request.params.id, request);
        if (!tile) throw new HttpError(404, 'error.tileNotAllowed');
        try {
          return await hub.cameraCapabilities(tile.entityId);
        } catch {
          throw new HttpError(502, 'error.cameraUnavailable');
        }
      },
    );
    app.get<{ Params: { id: string } }>(
      routeBase + '/webrtc',
      { websocket: true, onRequest: context.authorize },
      (socket, request) => {
        const tile = boundCamera(request.params.id, request),
          identity = actor(request);
        if (
          !context.allowed(request) ||
          !tile ||
          cameraPeers.size >= 32 ||
          [...cameraPeers.values()].filter((value) => value === identity).length >= 16
        ) {
          socket.close(1008);
          return;
        }
        cameraPeers.set(socket, identity);
        let control: ReturnType<HomeAssistantHub['cameraWebRtc']> | undefined,
          closed = false,
          offered = false,
          messages = 0;
        const send = (event: unknown) => {
          if (socket.readyState === 1) socket.send(JSON.stringify(event));
        };
        const releaseControl = () => {
          control?.stop();
          control = undefined;
        };
        let closing: ReturnType<typeof setTimeout> | undefined;
        const deny = () => {
          releaseControl();
          socket.close(1008);
          closing ??= setTimeout(() => socket.terminate(), 1000);
          closing.unref();
        };
        const timer = setTimeout(deny, 10_000);
        const check = async () => {
          try {
            await context.authorize(request);
            if (
              !context.allowed(request) ||
              boundCamera(request.params.id, request)?.entityId !== tile.entityId ||
              hub.getSnapshot([]).status === 'reconnecting'
            ) {
              deny();
            }
          } catch {
            deny();
          }
        };
        const interval = setInterval(() => void check(), 20_000);
        store.on('change', check);
        pairings.on('change', check);
        socket.on('message', (raw) => {
          try {
            if (++messages > 128) throw new Error();
            const message = cameraSignalSchema.parse(JSON.parse(raw.toString()));
            if (message.type === 'offer') {
              if (offered) throw new Error();
              offered = true;
              clearTimeout(timer);
              control = hub.cameraWebRtc(tile.entityId, message.sdp, send);
              if (closed) control.stop();
            } else {
              if (!control) throw new Error();
              void control.candidate(message.candidate).catch(() => send({ type: 'error' }));
            }
          } catch {
            send({ type: 'error' });
            deny();
          }
        });
        socket.once('close', () => {
          closed = true;
          clearTimeout(timer);
          clearTimeout(closing);
          clearInterval(interval);
          store.off('change', check);
          pairings.off('change', check);
          releaseControl();
          cameraPeers.delete(socket);
        });
        socket.on('error', () => socket.close());
      },
    );
    for (const suffix of ['still', 'stream.m3u8', 'assets/:asset']) {
      app.get<{ Params: { id: string; asset?: string }; Querystring: Record<string, unknown> }>(
        routeBase + '/' + suffix,
        {
          onRequest: context.authorize,
          config: {
            rateLimit: { max: suffix === 'assets/:asset' ? 3000 : 120, timeWindow: 60_000 },
          },
        },
        async (request, reply) => {
          if (!context.allowed(request)) throw new HttpError(403, 'error.cameraAdminRequired');
          const tile = boundCamera(request.params.id, request);
          if (!tile) throw new HttpError(404, 'error.tileNotAllowed');
          if (request.params.asset && !/^[a-f0-9]{32}\.[a-z0-9]+$/.test(request.params.asset))
            throw new HttpError(400, 'error.cameraSource');
          try {
            const result =
              suffix === 'still'
                ? await hub.cameraStill(tile.entityId, request.query.live === '1')
                : await hub.cameraLive(
                    tile.entityId,
                    request.params.asset,
                    request.query,
                    request.headers.range,
                  );
            reply
              .header('Cache-Control', 'no-store')
              .type(result.type)
              .code(result.status ?? 200);
            if (result.contentRange) reply.header('Content-Range', result.contentRange);
            hub.recordCameraTransfer(result.buffer.length);
            return reply.send(result.buffer);
          } catch {
            throw new HttpError(502, 'error.cameraUnavailable');
          }
        },
      );
    }
  }

  if (options.staticDir && existsSync(options.staticDir)) {
    await app.register(staticFiles, { root: options.staticDir, index: false, wildcard: true });
    app.get('/', async (_request, reply) =>
      reply.sendFile(options.surface === 'editor' ? 'index.html' : 'display.html'),
    );
  }
  return app;
}
