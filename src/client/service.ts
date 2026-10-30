import { independentDisplayViews } from '../shared/display-layouts';
import { UserError, isMessageKey } from '../shared/i18n';
import { requestLanguage } from './i18n';
import {
  dashboardSchema,
  type Action,
  type EntityState,
  type Snapshot,
  type Workspace,
  type Dashboard,
  type Revision,
} from '../shared/model';
import { demoDocument, applyDemoAction } from '../shared/demo';
import {
  legacyShowcaseDocument,
  legacyV1ShowcaseDocument,
  showcaseDocument,
  showcaseSnapshot,
} from '../shared/showcase';
import { parse, stringify } from 'yaml';

export type Bootstrap = {
  workspace: Workspace;
  snapshot: Snapshot;
  catalog: EntityState[];
  mode: 'demo' | 'live';
  displayEnabled: boolean;
};
export type LiveMessage = {
  snapshot?: Snapshot;
  published?: Revision;
  online?: boolean;
  canEdit?: boolean;
  canControl?: boolean;
};
export function serializeDashboard(document: Dashboard, format: 'json' | 'yaml') {
  return format === 'json' ? JSON.stringify(document, null, 2) : stringify(document);
}
export interface StudioService {
  local: boolean;
  load(): Promise<Bootstrap>;
  save(document: Dashboard, revision: number): Promise<Workspace>;
  publish(revision: number): Promise<Workspace>;
  restore(revision: number, expectedRevision: number): Promise<Workspace>;
  import(source: string, format: 'json' | 'yaml', revision: number): Promise<Workspace>;
  export(format: 'json' | 'yaml'): Promise<string>;
  act(action: Action, scope?: 'draft' | 'published'): Promise<void>;
  subscribe(listener: (message: LiveMessage) => void): () => void;
}

export async function api<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(
    new URL(path, document.baseURI),
    body === undefined
      ? {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Accept-Language': requestLanguage() },
        }
      : {
          method,
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'Accept-Language': requestLanguage() },
          body: JSON.stringify(body),
        },
  ).catch(() => {
    throw new UserError('error.serverUnreachable');
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ messageKey: 'error.requestFailed' }));
    const reason =
      data.messageKey && isMessageKey(data.messageKey)
        ? new UserError(data.messageKey)
        : data.error
          ? new Error(data.error)
          : new UserError('error.requestFailed');
    throw Object.assign(reason, { status: response.status });
  }
  return response.json() as Promise<T>;
}
export function liveStream(path: string, listener: (message: LiveMessage) => void) {
  let stopped = false,
    socket: WebSocket | undefined,
    timer: ReturnType<typeof setTimeout>;
  let delay = 1000;
  const connect = () => {
    const url = new URL(path, document.baseURI);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(url);
    socket.onopen = () => {
      delay = 1000;
      listener({ online: true });
    };
    socket.onmessage = (event) => {
      try {
        listener(JSON.parse(event.data));
      } catch {
        socket?.close();
      }
    };
    socket.onclose = () => {
      if (!stopped) {
        listener({ online: false });
        timer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 30_000);
      }
    };
  };
  connect();
  return () => {
    stopped = true;
    clearTimeout(timer);
    socket?.close();
  };
}
export const backendService: StudioService = {
  local: false,
  load: () => api('api/editor/bootstrap'),
  save: (document, expectedRevision) =>
    api('api/editor/draft', { document, expectedRevision }, 'PUT'),
  publish: (expectedRevision) => api('api/editor/publish', { expectedRevision }),
  restore: (revision, expectedRevision) =>
    api('api/editor/restore', { revision, expectedRevision }),
  import: (source, format, expectedRevision) =>
    api('api/editor/import', { source, format, expectedRevision }),
  export: async (format) => {
    const response = await fetch(new URL(`api/editor/export?format=${format}`, document.baseURI), {
      headers: { 'Accept-Language': requestLanguage() },
    });
    if (!response.ok) throw new UserError('error.exportFailed');
    return response.text();
  },
  act: async (action, scope) => {
    if (scope === 'published') await api('api/display/action', action);
    else await api('api/editor/action', { enabled: true, action });
  },
  subscribe: (listener) => liveStream('api/editor/stream', listener),
};

/** The hosted demo stores layouts only in this browser and never connects to HA. */
export class BrowserDemoService implements StudioService {
  readonly local = true;
  private workspace: Workspace;
  private snapshot = showcaseSnapshot();
  private listeners = new Set<(message: LiveMessage) => void>();
  constructor() {
    const revision = {
      revision: 1,
      savedAt: new Date().toISOString(),
      document: structuredClone(showcaseDocument),
    };
    this.workspace = structuredClone({ draft: revision, published: revision, history: [] });
    try {
      const raw = localStorage.getItem('hapanel-demo-v1');
      if (raw) {
        const data = JSON.parse(raw) as Workspace;
        dashboardSchema.parse(data.draft.document);
        dashboardSchema.parse(data.published.document);
        if (Number.isInteger(data.draft.revision) && Array.isArray(data.history))
          this.workspace =
            data.draft.revision === 1 &&
            data.history.length === 0 &&
            [demoDocument, legacyShowcaseDocument, legacyV1ShowcaseDocument].some(
              (document) =>
                JSON.stringify(data.draft.document) === JSON.stringify(document) &&
                JSON.stringify(data.published.document) === JSON.stringify(document),
            )
              ? this.workspace
              : data;
      }
    } catch {
      /* A browser-local demo can always start with the example. */
    }
    this.workspace.draft.document = independentDisplayViews(this.workspace.draft.document);
    this.workspace.published.document = independentDisplayViews(this.workspace.published.document);
  }
  private persist() {
    try {
      localStorage.setItem('hapanel-demo-v1', JSON.stringify(this.workspace));
    } catch {
      /* Private browsing: keep the current session in memory. */
    }
    for (const listener of this.listeners)
      listener({
        snapshot: structuredClone(this.snapshot),
        published: structuredClone(this.workspace.published),
        online: true,
      });
    return structuredClone(this.workspace);
  }
  async load(): Promise<Bootstrap> {
    return {
      workspace: structuredClone(this.workspace),
      snapshot: structuredClone(this.snapshot),
      catalog: Object.values(this.snapshot.entities),
      mode: 'demo',
      displayEnabled: false,
    };
  }
  async save(document: Dashboard, revision: number) {
    if (revision !== this.workspace.draft.revision) throw new UserError('error.conflict');
    const parsed = independentDisplayViews(dashboardSchema.parse(document));
    this.workspace.history = [
      structuredClone(this.workspace.draft),
      ...this.workspace.history,
    ].slice(0, 30);
    this.workspace.draft = {
      revision: revision + 1,
      savedAt: new Date().toISOString(),
      document: parsed,
    };
    return this.persist();
  }
  async publish(revision: number) {
    if (revision !== this.workspace.draft.revision) throw new UserError('error.saveFirst');
    this.workspace.published = structuredClone(this.workspace.draft);
    return this.persist();
  }
  async restore(revision: number, expected: number) {
    const target = [this.workspace.published, ...this.workspace.history].find(
      (r) => r.revision === revision,
    );
    if (!target) throw new UserError('error.revisionMissing');
    return this.save(target.document, expected);
  }
  import(source: string, format: 'json' | 'yaml', revision: number) {
    let value: unknown;
    try {
      value = format === 'json' ? JSON.parse(source) : parse(source, { maxAliasCount: 0 });
    } catch {
      throw new UserError('error.importParse');
    }
    return this.save(dashboardSchema.parse(value), revision);
  }
  async export(format: 'json' | 'yaml') {
    return format === 'json'
      ? JSON.stringify(this.workspace.draft.document, null, 2)
      : stringify(this.workspace.draft.document);
  }
  async act(action: Action, scope: 'draft' | 'published' = 'draft') {
    this.snapshot = applyDemoAction(this.snapshot, this.workspace[scope].document, action);
    this.persist();
  }
  subscribe(listener: (message: LiveMessage) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
