import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { applyDemoAction, demoSnapshot } from '../shared/demo';
import {
  entityIds,
  resolveAction,
  type Action,
  type Dashboard,
  type EntityState,
  type Snapshot,
  type Forecast,
} from '../shared/model';

type Pending = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
export interface HubOptions {
  demo: boolean;
  websocketUrl?: string;
  apiUrl?: string;
  token?: string;
}

export class HomeAssistantHub extends EventEmitter {
  private snapshot: Snapshot;
  private socket?: WebSocket;
  private pending = new Map<number, Pending>();
  private events = new Map<number, (event: any) => void>();
  private sequence = 0;
  private reconnect?: ReturnType<typeof setTimeout>;
  private watchdog?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private stopped = false;
  private retry = 0;
  private desired: string[] = [];
  private subscriptions: number[] = [];
  private subscriptionQueue: Promise<unknown> = Promise.resolve();
  private admins?: { until: number; ids: Set<string> };
  private catalog?: { until: number; entities: EntityState[] };
  constructor(private options: HubOptions) {
    super();
    this.setMaxListeners(0); // Each connected display removes its listener on close.
    this.snapshot = options.demo
      ? demoSnapshot()
      : { status: 'reconnecting', entities: {}, forecasts: {} };
  }
  start() {
    if (!this.options.demo) this.connect();
  }
  getSnapshot(ids?: string[]): Snapshot {
    const snapshot = structuredClone(this.snapshot);
    if (ids) {
      snapshot.entities = Object.fromEntries(
        ids.filter((id) => snapshot.entities[id]).map((id) => [id, snapshot.entities[id]]),
      );
      snapshot.forecasts = Object.fromEntries(
        ids.filter((id) => snapshot.forecasts[id]).map((id) => [id, snapshot.forecasts[id]]),
      );
    }
    return snapshot;
  }
  private emitSnapshot() {
    this.emit('snapshot');
  }
  private connect() {
    if (this.stopped) return;
    const socket = new WebSocket(this.options.websocketUrl!, {
      handshakeTimeout: 10_000,
      maxPayload: 16 * 1024 * 1024,
    });
    this.socket = socket;
    this.watchdog = setTimeout(() => socket.terminate(), 12_000);
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'auth_required')
          socket.send(JSON.stringify({ type: 'auth', access_token: this.options.token }));
        else if (msg.type === 'auth_ok') {
          clearTimeout(this.watchdog);
          this.retry = 0;
          this.snapshot.status = 'connected';
          this.snapshot.entities = {};
          this.snapshot.forecasts = {};
          this.admins = undefined;
          this.catalog = undefined;
          this.subscriptions = [];
          this.refreshSubscriptions();
          this.heartbeat = setInterval(() => {
            this.rpc({ type: 'ping' }).catch(() => socket.terminate());
          }, 30_000);
          this.emitSnapshot();
        } else if (msg.type === 'auth_invalid') socket.close();
        else if (msg.type === 'result' || msg.type === 'pong') {
          const pending = this.pending.get(msg.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(msg.id);
            if (msg.success === false)
              pending.reject(
                new Error(msg.error?.message || 'Home Assistant hat die Anfrage abgelehnt.'),
              );
            else pending.resolve(msg.result);
          }
        } else if (msg.type === 'event') this.events.get(msg.id)?.(msg.event);
      } catch {
        socket.terminate();
      }
    });
    socket.on('error', () => {
      /* close performs retry; credentials are never logged */
    });
    socket.on('close', () => {
      clearTimeout(this.watchdog);
      clearInterval(this.heartbeat);
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Home Assistant ist nicht verbunden.'));
      }
      this.pending.clear();
      this.events.clear();
      this.snapshot.status = 'reconnecting';
      this.emitSnapshot();
      if (!this.stopped)
        this.reconnect = setTimeout(
          () => this.connect(),
          Math.min(30_000, 1000 * 2 ** this.retry++) + Math.random() * 300,
        );
    });
  }
  private request(message: Record<string, unknown>, event?: (event: any) => void) {
    if (this.snapshot.status !== 'connected' || this.socket?.readyState !== WebSocket.OPEN)
      return { id: -1, promise: Promise.reject(new Error('Home Assistant ist nicht verbunden.')) };
    const id = ++this.sequence;
    if (event) this.events.set(id, event);
    const promise = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.events.delete(id);
        reject(new Error('Home Assistant antwortet nicht.'));
      }, 10_000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket!.send(JSON.stringify({ ...message, id }));
    });
    return { id, promise };
  }
  rpc(message: Record<string, unknown>) {
    return this.request(message).promise;
  }
  setDocuments(documents: Dashboard[]) {
    const ids = [...new Set(documents.flatMap(entityIds))].sort();
    if (JSON.stringify(ids) === JSON.stringify(this.desired)) return;
    this.desired = ids;
    this.refreshSubscriptions();
  }
  private refreshSubscriptions() {
    this.subscriptionQueue = this.subscriptionQueue
      .catch(() => undefined)
      .then(async () => {
        if (this.snapshot.status !== 'connected') return;
        for (const id of this.subscriptions) {
          this.events.delete(id);
          await this.rpc({ type: 'unsubscribe_events', subscription: id }).catch(() => undefined);
        }
        this.subscriptions = [];
        const ids = [...this.desired];
        if (!ids.length) return;
        const subscription = this.request(
          { type: 'subscribe_entities', entity_ids: ids },
          (event) => {
            for (const [id, compressed] of Object.entries(event.a ?? {}) as [string, any][]) {
              this.snapshot.entities[id] = {
                entity_id: id,
                state: compressed.s,
                attributes: compressed.a ?? {},
                last_updated: compressed.lu
                  ? new Date(compressed.lu * 1000).toISOString()
                  : undefined,
              };
            }
            for (const [id, change] of Object.entries(event.c ?? {}) as [string, any][]) {
              const entity = this.snapshot.entities[id];
              if (!entity) continue;
              const added = change['+'] ?? {};
              if (added.s !== undefined) entity.state = added.s;
              Object.assign(entity.attributes, added.a ?? {});
              for (const attr of change['-']?.a ?? []) delete entity.attributes[attr];
              if (added.lu) entity.last_updated = new Date(added.lu * 1000).toISOString();
            }
            for (const id of event.r ?? []) delete this.snapshot.entities[id];
            this.emitSnapshot();
          },
        );
        await subscription.promise;
        this.subscriptions.push(subscription.id);
        for (const id of ids.filter((id) => id.startsWith('weather.'))) {
          const weather = this.request(
            { type: 'weather/subscribe_forecast', entity_id: id, forecast_type: 'hourly' },
            (event) => {
              this.snapshot.forecasts[id] = (event.forecast ?? [])
                .filter((f: Forecast) => typeof f.temperature === 'number')
                .slice(0, 5);
              this.emitSnapshot();
            },
          );
          try {
            await weather.promise;
            this.subscriptions.push(weather.id);
          } catch {
            this.events.delete(weather.id);
          }
        }
      })
      .catch(() => {
        /* reconnect starts a fresh subscription */
      });
  }
  async getCatalog(): Promise<EntityState[]> {
    if (this.options.demo) return Object.values(this.snapshot.entities);
    if (!this.catalog || this.catalog.until < Date.now())
      this.catalog = {
        until: Date.now() + 60_000,
        entities: await this.rpc({ type: 'get_states' }),
      };
    return structuredClone(this.catalog.entities);
  }
  async isAdmin(userId: string) {
    if (this.options.demo) return false;
    if (!this.admins || this.admins.until < Date.now()) {
      const users = (await this.rpc({ type: 'config/auth/list' })) as {
        id: string;
        is_active: boolean;
        is_owner: boolean;
        group_ids: string[];
      }[];
      this.admins = {
        until: Date.now() + 30_000,
        ids: new Set(
          users
            .filter((u) => u.is_active && (u.is_owner || u.group_ids.includes('system-admin')))
            .map((u) => u.id),
        ),
      };
    }
    return this.admins.ids.has(userId);
  }
  async act(document: Dashboard, action: Action) {
    const resolved = resolveAction(document, action);
    if (this.options.demo) {
      this.snapshot = applyDemoAction(this.snapshot, document, action);
      this.emitSnapshot();
      return;
    }
    const entity = this.snapshot.entities[resolved.target.entity_id];
    if (!entity || entity.state === 'unavailable') throw new Error('Entität ist nicht verfügbar.');
    if (action.command === 'temperature') {
      const min = Number(entity.attributes.min_temp ?? 5),
        max = Number(entity.attributes.max_temp ?? 35);
      if (action.value! < min || action.value! > max)
        throw new Error('Temperatur außerhalb des Gerätebereichs.');
    }
    await this.rpc({ type: 'call_service', ...resolved });
  }
  async media(entityId: string) {
    const path = this.snapshot.entities[entityId]?.attributes.entity_picture;
    if (
      this.options.demo ||
      typeof path !== 'string' ||
      !path.startsWith('/api/') ||
      path.includes('..')
    )
      return undefined;
    const target = new URL(path.slice(5), this.options.apiUrl);
    const base = new URL(this.options.apiUrl!);
    if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname))
      return undefined;
    const response = await fetch(target, {
      headers: { Authorization: `Bearer ${this.options.token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    const contentType = response.headers.get('content-type')?.split(';')[0] ?? '';
    if (
      !response.ok ||
      !['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(contentType)
    ) {
      await response.body?.cancel();
      return undefined;
    }
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    const reader = response.body!.getReader();
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      bytes += chunk.length;
      if (bytes > 5 * 1024 * 1024) {
        await reader.cancel();
        throw new Error('Album-Art ist zu groß.');
      }
      chunks.push(chunk);
    }
    return { buffer: Buffer.concat(chunks), type: contentType };
  }
  async stop() {
    this.stopped = true;
    clearTimeout(this.reconnect);
    clearTimeout(this.watchdog);
    clearInterval(this.heartbeat);
    this.socket?.terminate();
  }
}
