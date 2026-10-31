import { validateCapability } from '../shared/widgets';
import { UserError } from '../shared/i18n';
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { applyDemoAction, demoSnapshot } from '../shared/demo';
import { validateAlarmCommand } from '../shared/security';
import { lightDimming } from '../shared/lights';
import {
  rtcCandidateSchema,
  type CameraCandidate,
  type CameraSignalEvent,
  type CameraCapabilities,
} from '../shared/camera';
import { CameraProxy } from './cameras';
import {
  entityIds,
  resolveAction,
  materializeAction,
  type Action,
  type Dashboard,
  type EntityState,
  type Snapshot,
  type Forecast,
  type HistoryPoint,
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
  private users?: {
    until: number;
    roles: Map<string, boolean>;
    list: { id: string; name: string; admin: boolean }[];
  };
  private catalog?: { until: number; entities: EntityState[] };
  private catalogStates: Record<string, EntityState> = {};
  private catalogRequest?: Promise<EntityState[]>;
  private history = new Map<string, { until: number; data: Promise<HistoryPoint[]> }>();
  private structureCache?: {
    until: number;
    data: Promise<{
      areas: { id: string; name: string; floor?: string }[];
      entities: Record<string, { areaId?: string; deviceName?: string }>;
    }>;
  };
  private statisticsCache = new Map<
    string,
    { until: number; data: Promise<{ time: string; value: number }[]> }
  >();
  private alertSubscription?: number;
  private proxiedCameraBytes = 0;
  recordCameraTransfer(bytes: number) {
    this.proxiedCameraBytes += bytes;
  }
  diagnostics() {
    return {
      proxiedCameraBytes: this.proxiedCameraBytes,
      haConnection: this.snapshot.status,
      subscribedEntities: this.desired.length,
    };
  }
  private cameras: CameraProxy;
  private cameraCapabilitiesCache = new Map<
    string,
    { until: number; value: Promise<CameraCapabilities> }
  >();
  constructor(private options: HubOptions) {
    super();
    this.setMaxListeners(0); // Each connected display removes its listener on close.
    this.snapshot = options.demo
      ? demoSnapshot()
      : { status: 'reconnecting', entities: {}, forecasts: {} };
    this.cameras = new CameraProxy({
      apiUrl: options.apiUrl,
      token: options.token,
      stream: (entityId) => this.rpc({ type: 'camera/stream', entity_id: entityId, format: 'hls' }),
    });
  }
  start() {
    if (!this.options.demo) this.connect();
  }
  getSnapshot(ids?: string[]): Snapshot {
    const selected = ids ?? Object.keys(this.snapshot.entities);
    const lookup = (id: string) => this.snapshot.entities[id] ?? this.catalogStates[id];
    const snapshot = structuredClone({
      ...this.snapshot,
      entities: Object.fromEntries(
        selected
          .filter((id) => this.snapshot.entities[id])
          .map((id) => [
            id,
            {
              ...this.snapshot.entities[id],
              ...(id.startsWith('light.') ? { lightCapabilities: lightDimming(id, lookup) } : {}),
            },
          ]),
      ),
      forecasts: ids
        ? Object.fromEntries(
            ids
              .filter((id) => this.snapshot.forecasts[id])
              .map((id) => [id, this.snapshot.forecasts[id]]),
          )
        : this.snapshot.forecasts,
    });
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
          this.users = undefined;
          this.catalog = undefined;
          this.structureCache = undefined;
          this.catalogStates = {};
          this.subscriptions = [];
          this.refreshSubscriptions();
          const alertEvents = this.request(
            { type: 'subscribe_events', event_type: 'hapanel_alert' },
            (event) => {
              const id = event?.data?.rule_id;
              if (typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id))
                this.emit('notification', id);
            },
          );
          alertEvents.promise.catch(() => {
            this.events.delete(alertEvents.id);
          });
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
                msg.error?.message
                  ? new Error(msg.error.message)
                  : new UserError('error.haRejected'),
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
        pending.reject(new UserError('error.haDisconnected'));
      }
      this.pending.clear();
      this.events.clear();
      this.cameraCapabilitiesCache.clear();
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
      return { id: -1, promise: Promise.reject(new UserError('error.haDisconnected')) };
    const id = ++this.sequence;
    if (event) this.events.set(id, event);
    const promise = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.events.delete(id);
        reject(new UserError('error.haTimeout'));
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
        // One cached metadata read, not extra live subscriptions for every group member.
        await this.ensureCatalog().catch(() => undefined);
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
                .filter(
                  (f: Forecast) =>
                    typeof f.temperature === 'number' &&
                    Number.isFinite(f.temperature) &&
                    typeof f.datetime === 'string' &&
                    Number.isFinite(Date.parse(f.datetime)),
                )
                .slice(0, 48);
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
  private async ensureCatalog() {
    if (!this.catalog || this.catalog.until < Date.now()) {
      this.catalogRequest ??= this.rpc({ type: 'get_states' })
        .then((result) => {
          const entities: EntityState[] = Array.isArray(result) ? result : [];
          this.catalogStates = Object.fromEntries(
            entities.map((entity) => [entity.entity_id, entity]),
          );
          this.catalog = { until: Date.now() + 60_000, entities };
          return entities;
        })
        .finally(() => {
          this.catalogRequest = undefined;
        });
      await this.catalogRequest;
    }
  }
  async getCatalog(refresh = false): Promise<EntityState[]> {
    if (refresh) {
      this.catalog = undefined;
      this.structureCache = undefined;
    }
    if (this.options.demo) return structuredClone(Object.values(this.snapshot.entities));
    await this.ensureCatalog();
    const structure = await this.getStructure();
    return structuredClone(
      (this.catalog?.entities ?? []).map((entity) => {
        const item = structure.entities[entity.entity_id],
          area = structure.areas.find((area) => area.id === item?.areaId);
        return {
          ...entity,
          ...(entity.entity_id.startsWith('light.')
            ? {
                lightCapabilities: lightDimming(
                  entity.entity_id,
                  (id) => this.snapshot.entities[id] ?? this.catalogStates[id],
                ),
              }
            : {}),
          ...(area ? { area } : {}),
          ...(item?.deviceName ? { deviceName: item.deviceName } : {}),
        };
      }),
    );
  }
  async getStructure() {
    if (this.options.demo)
      return {
        areas: [
          { id: 'living', name: 'Wohnzimmer', floor: 'EG' },
          { id: 'bedroom', name: 'Schlafzimmer', floor: 'OG' },
        ],
        entities: Object.fromEntries(
          Object.keys(this.snapshot.entities).map((id) => [
            id,
            { areaId: id.includes('bed') ? 'bedroom' : 'living', deviceName: id.split('.')[1] },
          ]),
        ),
      };
    if (!this.structureCache || this.structureCache.until < Date.now()) {
      const data = (async () => {
        const results = await Promise.allSettled(
          [
            'config/area_registry/list',
            'config/floor_registry/list',
            'config/device_registry/list',
            'config/entity_registry/list',
          ].map((type) => this.rpc({ type })),
        );
        const list = (i: number): any[] =>
          results[i].status === 'fulfilled' && Array.isArray(results[i].value)
            ? results[i].value
            : [];
        const floors = new Map(list(1).map((x) => [x.floor_id, x.name]));
        const areas = list(0).map((x) => ({
          id: String(x.area_id),
          name: String(x.name),
          ...(floors.has(x.floor_id) ? { floor: String(floors.get(x.floor_id)) } : {}),
        }));
        const devices = new Map(list(2).map((x) => [x.id, x]));
        const entities = Object.fromEntries(
          list(3)
            .filter((x) => !x.disabled_by)
            .map((x) => {
              const device = devices.get(x.device_id);
              return [
                x.entity_id,
                {
                  areaId: x.area_id ?? device?.area_id,
                  deviceName: device?.name_by_user ?? device?.name,
                },
              ];
            }),
        );
        return { areas, entities };
      })();
      this.structureCache = { until: Date.now() + 300_000, data };
    }
    return this.structureCache.data;
  }
  async getStatistics(entityId: string, range: 'day' | 'week' | 'month') {
    const key = entityId + ':' + range,
      cached = this.statisticsCache.get(key);
    if (cached && cached.until > Date.now()) return cached.data;
    if (this.options.demo) return [];
    const data = (async () => {
      const days = range === 'day' ? 1 : range === 'week' ? 7 : 30;
      const end = new Date();
      end.setUTCMinutes(0, 0, 0);
      const start = new Date(end.getTime() - days * 86400000);
      if (!this.snapshot.entities[entityId] && !this.catalogStates[entityId])
        await this.ensureCatalog();
      const sourceUnit = String(
        (this.snapshot.entities[entityId] ?? this.catalogStates[entityId])?.attributes
          .unit_of_measurement ?? '',
      );
      const unitType = ['Wh', 'kWh', 'MWh'].includes(sourceUnit)
        ? 'energy'
        : ['W', 'kW'].includes(sourceUnit)
          ? 'power'
          : ['°C', '°F', 'K'].includes(sourceUnit)
            ? 'temperature'
            : undefined;
      const result = await this.rpc({
        type: 'recorder/statistics_during_period',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        statistic_ids: [entityId],
        period: 'hour',
        ...(unitType ? { units: { [unitType]: sourceUnit } } : {}),
        types: ['change', 'mean'],
      });
      return (Array.isArray(result?.[entityId]) ? result[entityId] : [])
        .slice(0, 800)
        .flatMap((row: any) => {
          const unit = (this.snapshot.entities[entityId] ?? this.catalogStates[entityId])
            ?.attributes.unit_of_measurement;
          const value = ['Wh', 'kWh', 'MWh'].includes(String(unit)) ? row.change : row.mean;
          const time =
            typeof row.start === 'number' ? new Date(row.start).toISOString() : row.start;
          return typeof value === 'number' &&
            Number.isFinite(value) &&
            Number.isFinite(Date.parse(time))
            ? [{ time, value }]
            : [];
        });
    })().catch(() => {
      this.statisticsCache.delete(key);
      throw new UserError('error.historyUnavailable');
    });
    if (this.statisticsCache.size >= 128)
      this.statisticsCache.delete(this.statisticsCache.keys().next().value!);
    this.statisticsCache.set(key, { until: Date.now() + 300_000, data });
    return data;
  }
  async getHistory(entityId: string): Promise<HistoryPoint[]> {
    if (this.options.demo) {
      const entity = this.snapshot.entities[entityId];
      const value = Number(
        entity?.attributes.current_temperature ?? entity?.attributes.temperature ?? entity?.state,
      );
      if (!entity || !Number.isFinite(value)) return [];
      return Array.from({ length: 25 }, (_, index) => ({
        time: new Date(Date.now() - (24 - index) * 3600_000).toISOString(),
        value: Math.max(0, value + Math.sin(index / 3) * Math.abs(value) * 0.05),
      }));
    }
    const cached = this.history.get(entityId);
    if (cached && cached.until > Date.now()) return cached.data;
    const data = (async () => {
      const url = new URL(
        'history/period/' + new Date(Date.now() - 24 * 3600_000).toISOString(),
        this.options.apiUrl,
      );
      url.searchParams.set('filter_entity_id', entityId);
      const attribute = entityId.startsWith('climate.')
        ? 'current_temperature'
        : entityId.startsWith('weather.')
          ? 'temperature'
          : undefined;
      if (!attribute) {
        url.searchParams.set('minimal_response', '1');
        url.searchParams.set('no_attributes', '1');
      }
      const response = await fetch(url, {
        headers: { Authorization: 'Bearer ' + this.options.token },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok || !response.body) throw new UserError('error.historyUnavailable');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 4 * 1024 * 1024) {
          await reader.cancel();
          throw new UserError('error.historyUnavailable');
        }
        chunks.push(chunk.value);
      }
      const rows = JSON.parse(Buffer.concat(chunks).toString('utf8'))?.[0] ?? [];
      const points: HistoryPoint[] = rows.flatMap((row: any) => {
        const raw = attribute ? row.attributes?.[attribute] : row.state;
        const time = row.last_changed ?? row.last_updated;
        const value = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
        return Number.isFinite(value) &&
          typeof time === 'string' &&
          Number.isFinite(Date.parse(time))
          ? [{ time, value }]
          : [];
      });
      return points.filter(
        (_, index) =>
          index === points.length - 1 || index % Math.max(1, Math.ceil(points.length / 160)) === 0,
      );
    })().catch((error) => {
      this.history.delete(entityId);
      throw error;
    });
    if (this.history.size >= 64) this.history.delete(this.history.keys().next().value!);
    this.history.set(entityId, { until: Date.now() + 240_000, data });
    return data;
  }
  private async userRoles() {
    if (this.options.demo) return new Map<string, boolean>();
    if (!this.users || this.users.until < Date.now()) {
      const users = (await this.rpc({ type: 'config/auth/list' })) as {
        id: string;
        name?: string;
        is_active: boolean;
        is_owner: boolean;
        group_ids: string[];
      }[];
      this.users = {
        until: Date.now() + 30_000,
        list: users
          .filter((u) => u.is_active)
          .map((u) => ({
            id: u.id,
            name: u.name ?? u.id,
            admin: u.is_owner || u.group_ids.includes('system-admin'),
          })),
        roles: new Map(
          users
            .filter((u) => u.is_active)
            .map((u) => [u.id, u.is_owner || u.group_ids.includes('system-admin')]),
        ),
      };
    }
    return this.users.roles;
  }
  async getUsers() {
    await this.userRoles();
    return this.users?.list ?? [];
  }
  async isAdmin(userId: string) {
    return (await this.userRoles()).get(userId) === true;
  }
  async isActiveUser(userId: string) {
    return (await this.userRoles()).has(userId);
  }
  async act(document: Dashboard, requested: Action) {
    const action = materializeAction(document, requested);
    const resolved = resolveAction(document, action);
    if (this.options.demo) {
      this.snapshot = applyDemoAction(this.snapshot, document, action);
      this.emitSnapshot();
      return;
    }
    const entity = this.snapshot.entities[resolved.target.entity_id];
    if (!entity || entity.state === 'unavailable') throw new UserError('error.entityUnavailable');
    validateCapability(entity, action);
    if (action.command === 'brightness') {
      await this.ensureCatalog();
      if (
        !lightDimming(
          entity.entity_id,
          (id) => this.snapshot.entities[id] ?? this.catalogStates[id],
        ).dimmable
      )
        throw new UserError('error.lightNotDimmable');
    }
    if (action.command === 'alarm') validateAlarmCommand(entity, action.mode!, action.code);
    if (action.command === 'temperature') {
      const min = Number(entity.attributes.min_temp ?? 5),
        max = Number(entity.attributes.max_temp ?? 35);
      if (action.value! < min || action.value! > max) throw new UserError('error.temperatureRange');
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
        throw new UserError('error.artTooLarge');
      }
      chunks.push(chunk);
    }
    return { buffer: Buffer.concat(chunks), type: contentType };
  }
  private requireCamera(entityId: string) {
    const entity = this.snapshot.entities[entityId];
    if (
      this.options.demo ||
      !entityId.startsWith('camera.') ||
      !entity ||
      ['off', 'unknown', 'unavailable'].includes(entity.state)
    )
      throw new UserError('error.cameraUnavailable');
  }
  cameraStill(entityId: string, live = false) {
    this.requireCamera(entityId);
    return this.cameras.still(entityId, live);
  }
  cameraLive(entityId: string, asset?: string, query?: Record<string, unknown>, range?: string) {
    this.requireCamera(entityId);
    return this.cameras.live(entityId, asset, query, range);
  }
  cameraCapabilities(entityId: string): Promise<CameraCapabilities> {
    this.requireCamera(entityId);
    const cached = this.cameraCapabilitiesCache.get(entityId);
    if (cached && cached.until > Date.now()) return cached.value;
    const value = this.rpc({ type: 'camera/capabilities', entity_id: entityId })
      .then(async (result) => {
        const types = Array.isArray(result?.frontend_stream_types)
          ? result.frontend_stream_types
          : [];
        let dataChannel: string | undefined;
        if (types.includes('web_rtc')) {
          const config = await this.rpc({
            type: 'camera/webrtc/get_client_config',
            entity_id: entityId,
          });
          if (typeof config?.dataChannel === 'string' && config.dataChannel.length <= 64)
            dataChannel = config.dataChannel;
        }
        return {
          webrtc: types.includes('web_rtc'),
          hls: types.includes('hls'),
          ...(dataChannel ? { dataChannel } : {}),
        };
      })
      .catch(() => {
        this.cameraCapabilitiesCache.delete(entityId);
        throw new UserError('error.cameraUnavailable');
      });
    if (this.cameraCapabilitiesCache.size >= 32)
      this.cameraCapabilitiesCache.delete(this.cameraCapabilitiesCache.keys().next().value!);
    this.cameraCapabilitiesCache.set(entityId, { until: Date.now() + 30_000, value });
    return value;
  }
  cameraWebRtc(entityId: string, offer: string, send: (event: CameraSignalEvent) => void) {
    this.requireCamera(entityId);
    let session: string | undefined,
      closed = false;
    const queued: CameraCandidate[] = [];
    const addCandidate = async (candidate: CameraCandidate) => {
      if (closed) return;
      if (!session) {
        if (queued.length < 64) queued.push(candidate);
        return;
      }
      await this.rpc({
        type: 'camera/webrtc/candidate',
        entity_id: entityId,
        session_id: session,
        candidate,
      });
    };
    const request = this.request(
      { type: 'camera/webrtc/offer', entity_id: entityId, offer },
      (event) => {
        if (closed) return;
        if (event.type === 'session' && typeof event.session_id === 'string') {
          session = event.session_id;
          for (const candidate of queued.splice(0))
            void addCandidate(candidate).catch(() => send({ type: 'error' }));
        } else if (
          event.type === 'answer' &&
          typeof event.answer === 'string' &&
          event.answer.length <= 131072
        )
          send({ type: 'answer', sdp: event.answer });
        else if (event.type === 'candidate') {
          const parsed = rtcCandidateSchema.safeParse(event.candidate);
          if (parsed.success) send({ type: 'candidate', candidate: parsed.data });
        } else if (event.type === 'error') send({ type: 'error' });
      },
    );
    const stop = () => {
      if (closed) return;
      closed = true;
      queued.length = 0;
      this.events.delete(request.id);
      void request.promise
        .then(() => this.rpc({ type: 'unsubscribe_events', subscription: request.id }))
        .catch(() => undefined);
    };
    void request.promise.catch(() => {
      if (!closed) send({ type: 'error' });
      stop();
    });
    return { ready: request.promise, candidate: addCandidate, stop };
  }
  async stop() {
    this.stopped = true;
    clearTimeout(this.reconnect);
    clearTimeout(this.watchdog);
    clearInterval(this.heartbeat);
    this.socket?.terminate();
  }
}
