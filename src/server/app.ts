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
  type Action,
  type Dashboard,
} from '../shared/model';
import { DocumentStore, HttpError, PairingStore } from './store';
import { HomeAssistantHub } from './hub';
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
}
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const isLoopback = (address: string) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
const revisionBody = z.object({ expectedRevision: z.number().int().positive() }).strict();

export async function createApp(options: AppOptions) {
  const { store, pairings, hub } = options;
  const performAction = async (document: Dashboard, action: Action) => {
    try {
      resolveAction(document, action);
    } catch (error) {
      throw new HttpError(400, error instanceof UserError ? error : (error as Error).message);
    }
    try {
      await hub.act(document, action);
    } catch (error) {
      throw new HttpError(
        hub.getSnapshot([]).status === 'reconnecting' ? 503 : 400,
        error instanceof UserError ? error : (error as Error).message,
      );
    }
  };
  const app = Fastify({ logger: false, bodyLimit: 1024 * 1024, trustProxy: false });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(websocket, { options: { maxPayload: 1024 } });

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
        options.mode === 'ingress' && request.ip === '172.30.32.2'
          ? String(request.headers['x-forwarded-host'] ?? request.headers.host)
          : request.headers.host;
      if (incoming.host === host) return;
    } catch {
      /* reject invalid origins */
    }
    throw new HttpError(403, 'error.crossOrigin');
  };
  const requireEditor = async (request: FastifyRequest) => {
    sameOrigin(request);
    if (options.surface !== 'editor') throw new HttpError(403, 'error.editorUnavailable');
    if (options.mode === 'ingress') {
      if (!['172.30.32.2', '::ffff:172.30.32.2'].includes(request.ip))
        throw new HttpError(403, 'error.ingressOnly');
      const user = request.headers['x-remote-user-id'];
      if (typeof user !== 'string' || !(await (options.isAdmin ?? ((id) => hub.isAdmin(id)))(user)))
        throw new HttpError(403, 'error.adminRequired');
    } else {
      const host = new URL(`http://${request.headers.host ?? ''}`).hostname;
      if (!isLoopback(request.ip) || !localHosts.has(host))
        throw new HttpError(403, 'error.localEditor');
    }
  };
  const requireDisplay = async (request: FastifyRequest) => {
    sameOrigin(request);
    if (!pairings.authenticate(request.cookies.hapanel_device))
      throw new HttpError(401, 'error.pairRequired');
  };

  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self'; base-uri 'self'; object-src 'none'",
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
    version: '0.1.0-alpha.3',
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
          snapshot: hub.getSnapshot(),
          catalog: await hub.getCatalog(),
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
            ? stringify(store.get().draft.document)
            : JSON.stringify(store.get().draft.document, null, 2);
        });
        admin.post(
          '/action',
          { config: { rateLimit: { max: 20, timeWindow: 1000 } } },
          async (request) => {
            const body = z
              .object({ enabled: z.literal(true), action: actionSchema })
              .strict()
              .parse(request.body);
            await performAction(store.get().draft.document, body.action);
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
          const tile = store
            .get()
            .draft.document.pages.flatMap((p) => p.tiles)
            .find((t) => t.id === request.params.id && t.kind === 'media');
          const result = tile && (await hub.media(tile.entityId));
          if (!result) throw new HttpError(404, 'error.noAlbumArt');
          return reply.type(result.type).send(result.buffer);
        });
        admin.get('/stream', { websocket: true }, (socket) => {
          const send = () => {
            if (socket.readyState === 1)
              socket.send(
                JSON.stringify({
                  type: 'snapshot',
                  snapshot: hub.getSnapshot(entityIds(store.get().draft.document)),
                }),
              );
          };
          hub.on('snapshot', send);
          send();
          socket.on('close', () => hub.off('snapshot', send));
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
      display.get('/bootstrap', async () => ({
        published: store.get().published,
        snapshot: hub.getSnapshot(entityIds(store.get().published.document)),
      }));
      display.post(
        '/action',
        { config: { rateLimit: { max: 20, timeWindow: 1000 } } },
        async (request) => {
          await performAction(store.get().published.document, actionSchema.parse(request.body));
          return { ok: true };
        },
      );
      display.get<{ Params: { id: string } }>('/media/:id', async (request, reply) => {
        const tile = store
          .get()
          .published.document.pages.flatMap((p) => p.tiles)
          .find((t) => t.id === request.params.id && t.kind === 'media');
        const result = tile && (await hub.media(tile.entityId));
        if (!result) throw new HttpError(404, 'error.noAlbumArt');
        return reply.type(result.type).send(result.buffer);
      });
      display.get('/stream', { websocket: true }, (socket, request) => {
        const token = request.cookies.hapanel_device;
        let revision = -1;
        const send = () => {
          if (!pairings.authenticate(token)) {
            socket.close(1008, 'Device access revoked');
            return;
          }
          if (socket.readyState !== 1) return;
          const published = store.get().published;
          const changed = published.revision !== revision;
          revision = published.revision;
          socket.send(
            JSON.stringify({
              type: 'snapshot',
              snapshot: hub.getSnapshot(entityIds(published.document)),
              ...(changed ? { published } : {}),
            }),
          );
        };
        hub.on('snapshot', send);
        store.on('change', send);
        pairings.on('change', send);
        send();
        socket.on('close', () => {
          hub.off('snapshot', send);
          store.off('change', send);
          pairings.off('change', send);
        });
      });
    },
    { prefix: '/api/display' },
  );

  if (options.staticDir && existsSync(options.staticDir)) {
    await app.register(staticFiles, { root: options.staticDir, index: false, wildcard: true });
    app.get('/', async (_request, reply) =>
      reply.sendFile(options.surface === 'editor' ? 'index.html' : 'display.html'),
    );
  }
  return app;
}
