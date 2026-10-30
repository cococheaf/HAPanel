import { randomBytes } from 'node:crypto';
import { UserError } from '../shared/i18n';
import type { EntityState } from '../shared/model';

/** Camera credentials and upstream stream URLs never leave the server. */
export function publicEntity(entity: EntityState): EntityState {
  if (!entity.entity_id.startsWith('camera.')) return entity;
  const attributes = Object.fromEntries(
    ['friendly_name', 'supported_features', 'frontend_stream_type']
      .filter((key) => key in entity.attributes)
      .map((key) => [key, entity.attributes[key]]),
  );
  return { ...entity, attributes };
}
type Resource = { url: URL; seen: number };
type Session = {
  master: URL;
  root: string;
  resources: Map<string, Resource>;
  reverse: Map<string, string>;
  expires: number;
};
type CameraResult = { buffer: Buffer; type: string; status?: number; contentRange?: string };
export class CameraProxy {
  private stills = new Map<string, { expires: number; promise: Promise<CameraResult> }>();
  private sessions = new Map<string, Promise<Session>>();
  constructor(
    private options: {
      apiUrl?: string;
      token?: string;
      stream: (id: string) => Promise<{ url: string }>;
    },
  ) {}
  private api() {
    if (!this.options.apiUrl || !this.options.token) throw new UserError('error.cameraUnavailable');
    return new URL(this.options.apiUrl);
  }
  private upstream(path: string) {
    if (
      !/^\/api\/hls\/[a-zA-Z0-9_-]+\//.test(path) ||
      path.includes('%') ||
      path.includes('\\') ||
      path.split(/[/?#]/).some((part) => part === '..' || part === '.')
    )
      throw new UserError('error.cameraSource');
    return new URL(path.slice(5), this.api());
  }
  private async fetch(url: URL, limit: number, range?: string): Promise<CameraResult> {
    const response = await fetch(url, {
      headers: {
        Authorization: 'Bearer ' + this.options.token,
        ...(range ? { Range: range } : {}),
      },
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok || !response.body) throw new UserError('error.cameraUnavailable');
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new UserError('error.cameraUnavailable');
      }
      chunks.push(chunk.value);
    }
    return {
      buffer: Buffer.concat(chunks),
      type:
        response.headers.get('content-type')?.split(';')[0].toLowerCase() ??
        'application/octet-stream',
      status: response.status,
      contentRange: response.headers.get('content-range') ?? undefined,
    };
  }
  async still(entityId: string, live = false) {
    const cacheKey = entityId + (live ? ':live' : '');
    const cached = this.stills.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.promise;
    const url = new URL('camera_proxy/' + encodeURIComponent(entityId), this.api());
    url.searchParams.set('width', '960');
    const promise = this.fetch(url, 5 * 1024 * 1024)
      .then((result) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(result.type))
          throw new UserError('error.cameraUnavailable');
        return result;
      })
      .catch(() => {
        this.stills.delete(cacheKey);
        throw new UserError('error.cameraUnavailable');
      });
    if (this.stills.size >= 16) this.stills.delete(this.stills.keys().next().value!);
    this.stills.set(cacheKey, { expires: Date.now() + (live ? 1000 : 15_000), promise });
    return promise;
  }
  private async session(entityId: string) {
    const cached = this.sessions.get(entityId);
    if (cached) {
      const value = await cached;
      if (value.expires > Date.now()) return value;
      this.sessions.delete(entityId);
    }
    const promise = this.options
      .stream(entityId)
      .then(({ url }) => {
        const master = this.upstream(url);
        return {
          master,
          root: master.pathname.slice(0, master.pathname.lastIndexOf('/') + 1),
          resources: new Map<string, Resource>(),
          reverse: new Map<string, string>(),
          expires: Date.now() + 300_000,
        };
      })
      .catch(() => {
        this.sessions.delete(entityId);
        throw new UserError('error.cameraUnavailable');
      });
    if (this.sessions.size >= 12) this.sessions.delete(this.sessions.keys().next().value!);
    this.sessions.set(entityId, promise);
    return promise;
  }
  async live(
    entityId: string,
    asset?: string,
    query: Record<string, unknown> = {},
    range?: string,
  ): Promise<CameraResult> {
    if (range && !/^bytes=\d+-\d*$/.test(range)) throw new UserError('error.cameraSource');
    const session = await this.session(entityId);
    const resource = asset ? session.resources.get(asset) : undefined;
    if (asset && !resource) throw new UserError('error.cameraSource');
    session.expires = Date.now() + 300_000;
    if (resource) resource.seen = Date.now();
    const url = new URL(resource?.url ?? session.master);
    for (const key of ['_HLS_msn', '_HLS_part', '_HLS_skip']) {
      const value = query[key];
      if (
        typeof value === 'string' &&
        (key === '_HLS_skip' ? ['YES', 'v2'].includes(value) : /^\d{1,12}$/.test(value))
      )
        url.searchParams.set(key, value);
    }
    const playlist = url.pathname.endsWith('.m3u8');
    let result: CameraResult;
    try {
      result = await this.fetch(url, playlist ? 256 * 1024 : 12 * 1024 * 1024, range);
    } catch {
      if (!asset) this.sessions.delete(entityId);
      throw new UserError('error.cameraUnavailable');
    }
    if (!playlist) {
      if (
        ![
          'video/mp4',
          'video/mp2t',
          'video/iso.segment',
          'audio/mp4',
          'audio/aac',
          'application/octet-stream',
          'application/binary',
          'text/vtt',
        ].includes(result.type)
      )
        throw new UserError('error.cameraSource');
      return result;
    }
    const source = result.buffer.toString('utf8');
    if (!source.startsWith('#EXTM3U')) throw new UserError('error.cameraSource');
    const rewrite = (uri: string) => {
      const target = uri.startsWith('/api/hls/') ? this.upstream(uri) : new URL(uri, url);
      if (
        target.origin !== url.origin ||
        !target.pathname.startsWith(session.root) ||
        target.pathname.includes('%') ||
        target.username ||
        target.password ||
        target.hash
      )
        throw new UserError('error.cameraSource');
      let id = session.reverse.get(target.href);
      if (!id) {
        if (session.resources.size >= 512) {
          const oldest = [...session.resources.entries()].sort((a, b) => a[1].seen - b[1].seen)[0];
          session.resources.delete(oldest[0]);
          session.reverse.delete(oldest[1].url.href);
        }
        const extension = /\.(m3u8|m4s|mp4|ts|aac|vtt|key)$/.exec(target.pathname)?.[1] ?? 'bin';
        id = randomBytes(16).toString('hex') + '.' + extension;
        session.reverse.set(target.href, id);
        session.resources.set(id, { url: target, seen: Date.now() });
      } else session.resources.get(id)!.seen = Date.now();
      return (asset ? '' : 'assets/') + id;
    };
    const buffer = Buffer.from(
      source
        .split('\n')
        .map((line) => {
          if (!line.trim()) return line;
          return line.startsWith('#')
            ? line.replace(/URI="([^"]+)"/g, (_, uri: string) => 'URI="' + rewrite(uri) + '"')
            : rewrite(line.trim());
        })
        .join('\n'),
    );
    return { buffer, type: 'application/vnd.apple.mpegurl' };
  }
}
