import { z } from 'zod';

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
export const tileKinds = ['light', 'climate', 'media', 'weather', 'scene', 'sensor'] as const;
export type TileKind = (typeof tileKinds)[number];
export const rectSchema = z
  .object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(24),
    h: z.number().int().min(1).max(20),
  })
  .strict();
export const profileSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(64),
    physicalWidth: z.number().int().min(240).max(16384),
    physicalHeight: z.number().int().min(240).max(16384),
    diagonal: z.number().min(2).max(100),
    dpr: z.number().min(0.5).max(4),
    width: z.number().int().min(320).max(8192),
    height: z.number().int().min(240).max(8192),
    columns: z.number().int().min(2).max(24),
    rows: z.number().int().min(2).max(20),
    gap: z.number().int().min(0).max(40),
    margin: z.number().int().min(0).max(96),
    headerHeight: z.number().int().min(48).max(180),
    footerHeight: z.number().int().min(40).max(100),
    mode: z.enum(['exact', 'fit']),
  })
  .strict();
export const tileSchema = z
  .object({
    id,
    kind: z.enum(tileKinds),
    title: z.string().trim().min(1).max(64),
    entityId: z.string().regex(/^[a-z_]+\.[a-z0-9_]+$/),
    accent: z.enum(['amber', 'mint', 'blue', 'rose']),
    layouts: z.record(id, rectSchema),
  })
  .strict();
export const dashboardSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    name: z.string().trim().min(1).max(64),
    greeting: z.string().trim().min(1).max(80),
    subtitle: z.string().max(100),
    theme: z.enum(['dusk', 'ocean', 'sand']),
    profiles: z.array(profileSchema).min(1).max(8),
    pages: z
      .array(
        z
          .object({
            id,
            name: z.string().trim().min(1).max(40),
            tiles: z.array(tileSchema).max(64),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const unique = (values: string[], path: (string | number)[]) => {
      if (new Set(values).size !== values.length)
        ctx.addIssue({ code: 'custom', message: 'IDs müssen eindeutig sein.', path });
    };
    unique(
      doc.profiles.map((p) => p.id),
      ['profiles'],
    );
    unique(
      doc.pages.map((p) => p.id),
      ['pages'],
    );
    unique(
      doc.pages.flatMap((p) => p.tiles.map((t) => t.id)),
      ['pages'],
    );
    for (const [pi, p] of doc.profiles.entries()) {
      if (geometry(p).cellWidth < 12 || geometry(p).rowHeight < 12) {
        ctx.addIssue({
          code: 'custom',
          message: 'Für dieses Raster ist die nutzbare Displayfläche zu klein.',
          path: ['profiles', pi],
        });
      }
      for (const [pageIndex, page] of doc.pages.entries()) {
        for (const [ti, tile] of page.tiles.entries()) {
          const r = tile.layouts[p.id];
          const path = ['pages', pageIndex, 'tiles', ti, 'layouts', p.id];
          if (!r) {
            ctx.addIssue({ code: 'custom', message: 'Layout für Displayprofil fehlt.', path });
            continue;
          }
          if (r.x + r.w > p.columns || r.y + r.h > p.rows) {
            ctx.addIssue({ code: 'custom', message: 'Kachel liegt außerhalb des Rasters.', path });
          }
          if (
            page.tiles
              .slice(0, ti)
              .some((other) => other.layouts[p.id] && overlaps(r, other.layouts[p.id]))
          ) {
            ctx.addIssue({
              code: 'custom',
              message: 'Kacheln dürfen sich nicht überlagern.',
              path,
            });
          }
        }
      }
    }
    const domains: Record<TileKind, string[]> = {
      light: ['light', 'switch'],
      climate: ['climate'],
      media: ['media_player'],
      weather: ['weather'],
      scene: ['scene', 'script'],
      sensor: ['sensor', 'binary_sensor'],
    };
    for (const [pageIndex, page] of doc.pages.entries())
      for (const [ti, tile] of page.tiles.entries()) {
        if (!domains[tile.kind].includes(tile.entityId.split('.')[0])) {
          ctx.addIssue({
            code: 'custom',
            message: 'Entität passt nicht zum Kacheltyp.',
            path: ['pages', pageIndex, 'tiles', ti, 'entityId'],
          });
        }
      }
  });

export type Rect = z.infer<typeof rectSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Tile = z.infer<typeof tileSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type Revision = { revision: number; savedAt: string; document: Dashboard };
export type Workspace = { draft: Revision; published: Revision; history: Revision[] };
export type EntityState = {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_updated?: string;
};
export type Forecast = { datetime: string; temperature: number; condition: string };
export type Snapshot = {
  status: 'demo' | 'connected' | 'reconnecting';
  entities: Record<string, EntityState>;
  forecasts: Record<string, Forecast[]>;
};
export type Action = {
  tileId: string;
  command:
    | 'toggle'
    | 'brightness'
    | 'temperature'
    | 'play_pause'
    | 'next'
    | 'previous'
    | 'volume'
    | 'activate';
  value?: number;
};
export const actionSchema = z
  .object({
    tileId: id,
    command: z.enum([
      'toggle',
      'brightness',
      'temperature',
      'play_pause',
      'next',
      'previous',
      'volume',
      'activate',
    ]),
    value: z.number().finite().optional(),
  })
  .strict();

export function geometry(p: Profile) {
  const width = p.width - p.margin * 2;
  const height = p.height - p.margin * 2 - p.headerHeight - p.footerHeight;
  return {
    width,
    height,
    cellWidth: (width - p.gap * (p.columns - 1)) / p.columns,
    rowHeight: (height - p.gap * (p.rows - 1)) / p.rows,
  };
}
export function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function findSpace(profile: Profile, tiles: Tile[], w = 4, h = 2): Rect | undefined {
  w = Math.min(w, profile.columns);
  h = Math.min(h, profile.rows);
  for (let y = 0; y <= profile.rows - h; y++)
    for (let x = 0; x <= profile.columns - w; x++) {
      const rect = { x, y, w, h };
      if (tiles.every((t) => !t.layouts[profile.id] || !overlaps(rect, t.layouts[profile.id])))
        return rect;
    }
}
export function entityIds(document: Dashboard) {
  return [...new Set(document.pages.flatMap((p) => p.tiles.map((t) => t.entityId)))];
}
export function numberAttr(entity: EntityState | undefined, key: string, fallback = 0) {
  const value = entity?.attributes[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
export function stringAttr(entity: EntityState | undefined, key: string, fallback = '') {
  return typeof entity?.attributes[key] === 'string'
    ? (entity.attributes[key] as string)
    : fallback;
}

/** Resolve only typed, tile-bound actions. Clients cannot supply HA services or targets. */
export function resolveAction(document: Dashboard, action: Action) {
  const tile = document.pages.flatMap((p) => p.tiles).find((t) => t.id === action.tileId);
  if (!tile) throw new Error('Kachel nicht freigegeben.');
  const domain = tile.entityId.split('.')[0];
  const result = (service: string, service_data: Record<string, unknown> = {}) => ({
    domain,
    service,
    target: { entity_id: tile.entityId },
    service_data,
  });
  const value = (min: number, max: number) => {
    if (action.value === undefined || action.value < min || action.value > max)
      throw new Error('Wert außerhalb des zulässigen Bereichs.');
    return action.value;
  };
  if (tile.kind === 'light') {
    if (action.command === 'toggle') return result('toggle');
    if (action.command === 'brightness' && domain === 'light') {
      const brightness = value(0, 100);
      return brightness === 0
        ? result('turn_off')
        : result('turn_on', { brightness_pct: Math.round(brightness) });
    }
  }
  if (tile.kind === 'climate' && action.command === 'temperature')
    return result('set_temperature', { temperature: value(5, 35) });
  if (tile.kind === 'media') {
    const services = {
      play_pause: 'media_play_pause',
      next: 'media_next_track',
      previous: 'media_previous_track',
    };
    if (action.command in services)
      return result(services[action.command as keyof typeof services]);
    if (action.command === 'volume') return result('volume_set', { volume_level: value(0, 1) });
  }
  if (tile.kind === 'scene' && action.command === 'activate') return result('turn_on');
  throw new Error('Aktion für diese Kachel nicht freigegeben.');
}
