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
import { DocumentStore, HttpError, PairingStore } from './store';
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
}
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const isLoopback = (address: string) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
const revisionBody = z.object({ expectedRevision: z.number().int().positive() }).strict();

export async function createApp(options: AppOptions) {
  const { store, pairings, hub } = options;
  const alarmAttempts = new Map<string, number[]>();
  const sharedCameras = options.cameraAccess === 'authenticated';
  const displayRoles = new WeakMap<FastifyRequest, boolean>();
  const isAdmin = options.isAdmin ?? ((id: string) => hub.isAdmin(id));
  const isActiveUser = options.isActiveUser ?? ((id: string) => hub.isActiveUser(id));
  const isSupervisor = (request: FastifyRequest) =>
    ['172.30.32.2', '::ffff:172.30.32.2'].includes(request.ip);
  const snapshotFor = (document: Dashboard, alarmControl: boolean, cameraView = alarmControl) => {
    const snapshot = hub.getSnapshot(entityIds(document));
    snapshot.entities = Object.fromEntries(
      Object.entries(snapshot.entities).map(([id, entity]) => [id, publicEntity(entity)]),
    );
    return {
      ...snapshot,
      alarmControl,
      cameraView,
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
      if (!admin && (!sharedCameras || !(await isActiveUser(user))))
        throw new HttpError(403, 'error.displayAccessRequired');
      displayRoles.set(request, admin);
      return;
    }
    if (!pairings.authenticate(request.cookies.hapanel_device))
      throw new HttpError(401, 'error.pairRequired');
    displayRoles.set(request, false);
  };

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
      const status = error instanceof ZodError ? 400 : (error.statusCode ?? 500);
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
        published: store.getRevision('published'),
        snapshot: snapshotFor(
          store.getRevision('published').document,
          displayRoles.get(request) === true,
          ingressDisplay || sharedCameras,
        ),
        canEdit: displayRoles.get(request) === true,
        canControl: !ingressDisplay || displayRoles.get(request) === true,
      }));
      display.post(
        '/action',
        { config: { rateLimit: { max: 20, timeWindow: 1000 } } },
        async (request) => {
          if (ingressDisplay && displayRoles.get(request) !== true)
            throw new HttpError(403, 'error.viewerReadOnly');
          await performAction(
            store.getRevision('published').document,
            actionSchema.parse(request.body),
            displayRoles.get(request) === true,
            actor(request),
          );
          return { ok: true };
        },
      );
      display.get<{ Params: { id: string } }>('/media/:id', async (request, reply) => {
        const tile = allControls(store.getRevision('published').document).find(
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
          if (!entityIds(store.getRevision('published').document).includes(request.params.entityId))
            throw new HttpError(403, 'error.tileNotAllowed');
          return hub.getHistory(request.params.entityId);
        },
      );
      display.get('/stream', { websocket: true }, (socket, request) => {
        const token = request.cookies.hapanel_device;
        let revision = -1;
        const send = () => {
          if (!ingressDisplay && !pairings.authenticate(token)) {
            socket.close(1008, 'Device access revoked');
            return;
          }
          if (socket.readyState !== 1) return;
          const published = store.getRevision('published');
          const changed = published.revision !== revision;
          revision = published.revision;
          socket.send(
            JSON.stringify({
              type: 'snapshot',
              snapshot: snapshotFor(
                published.document,
                displayRoles.get(request) === true,
                ingressDisplay || sharedCameras,
              ),
              canEdit: displayRoles.get(request) === true,
              canControl: !ingressDisplay || displayRoles.get(request) === true,
              ...(changed ? { published } : {}),
            }),
          );
        };
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
      document: () => store.getRevision('published').document,
      authorize: requireDisplay,
      allowed: ingressDisplay || sharedCameras,
    },
    ...(options.surface === 'editor'
      ? [
          {
            prefix: '/api/editor/camera',
            document: () => store.getRevision('draft').document,
            authorize: requireEditor,
            allowed: true,
          },
        ]
      : []),
  ];
  const cameraPeers = new Map<object, string>();
  for (const context of cameraContexts) {
    const boundCamera = (id: string) =>
      allControls(context.document()).find((tile) => tile.id === id && tile.kind === 'camera');
    app.get<{ Params: { id: string } }>(
      context.prefix + '/:id/capabilities',
      { onRequest: context.authorize, config: { rateLimit: { max: 120, timeWindow: 60_000 } } },
      async (request, reply) => {
        if (!context.allowed) throw new HttpError(403, 'error.cameraAdminRequired');
        reply.header('Cache-Control', 'no-store');
        const tile = boundCamera(request.params.id);
        if (!tile) throw new HttpError(404, 'error.tileNotAllowed');
        try {
          return await hub.cameraCapabilities(tile.entityId);
        } catch {
          throw new HttpError(502, 'error.cameraUnavailable');
        }
      },
    );
    app.get<{ Params: { id: string } }>(
      context.prefix + '/:id/webrtc',
      { websocket: true, onRequest: context.authorize },
      (socket, request) => {
        const tile = boundCamera(request.params.id),
          identity = actor(request);
        if (
          !context.allowed ||
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
              boundCamera(request.params.id)?.entityId !== tile.entityId ||
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
        context.prefix + '/:id/' + suffix,
        {
          onRequest: context.authorize,
          config: {
            rateLimit: { max: suffix === 'assets/:asset' ? 3000 : 120, timeWindow: 60_000 },
          },
        },
        async (request, reply) => {
          if (!context.allowed) throw new HttpError(403, 'error.cameraAdminRequired');
          const tile = allControls(context.document()).find(
            (tile) => tile.id === request.params.id && tile.kind === 'camera',
          );
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
