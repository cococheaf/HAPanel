import { z } from 'zod';
import type { Dashboard, EntityState, Profile, Snapshot, Tile } from './model';
export const commands = [
  'toggle',
  'turn_on',
  'turn_off',
  'brightness',
  'temperature',
  'temperature_range',
  'humidity',
  'play_pause',
  'next',
  'previous',
  'open',
  'close',
  'stop',
  'position',
  'volume',
  'activate',
  'color_temp',
  'color',
  'hvac',
  'climate_fan',
  'swing',
  'preset',
  'tilt',
  'select',
  'number',
  'fan_speed',
  'vacuum_start',
  'vacuum_pause',
  'vacuum_return',
  'timer_start',
  'timer_pause',
  'timer_cancel',
  'press',
  'favorite',
] as const;
export const gestureSchema = z
  .object({
    type: z.enum(['automatic', 'details', 'none', 'navigate', 'command']),
    pageId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,64}$/)
      .optional(),
    command: z.enum(commands).optional(),
    value: z.number().finite().optional(),
    valueHigh: z.number().finite().optional(),
    option: z.string().max(256).optional(),
    confirm: z.boolean().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.type === 'navigate' && !v.pageId) || (v.type === 'command' && !v.command))
      ctx.addIssue({ code: 'custom', message: 'error.actionNotAllowed' });
  });
export const conditionSchema = z
  .object({
    entityId: z.string().regex(/^[a-z_]+\.[a-z0-9_]+$/),
    operator: z.enum(['is', 'is_not', 'above', 'below']),
    value: z.string().max(256),
  })
  .strict();
export const tileExperienceSchema = z
  .object({
    icon: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,40}$/)
      .optional(),
    presentation: z.enum(['auto', 'value', 'graph']).optional(),
    secondary: z.enum(['auto', 'none', 'attribute', 'text']).optional(),
    secondaryText: z.string().max(180).optional(),
    locked: z.boolean().optional(),
    background: z.enum(['default', 'none', 'pastel']).optional(),
    tap: gestureSchema.optional(),
    hold: gestureSchema.optional(),
    visibleWhen: conditionSchema.optional(),
  })
  .strict();
export const profileExperienceSchema = z
  .object({
    density: z.enum(['comfortable', 'normal', 'compact']).optional(),
    colorMode: z.enum(['dark', 'light', 'auto']).optional(),
    background: z.enum(['gradient', 'plain']).optional(),
    adaptive: z.boolean().optional(),
    maxLiveStreams: z.number().int().min(1).max(8).optional(),
    hideToolbar: z.boolean().optional(),
    homePageId: z.string().max(64).optional(),
    autoHomeSeconds: z.number().int().min(0).max(86400).optional(),
    swipe: z.boolean().optional(),
    nightStart: z.number().int().min(0).max(23).optional(),
    nightEnd: z.number().int().min(0).max(23).optional(),
    idleSeconds: z.number().int().min(0).max(86400).optional(),
    safeTop: z.number().int().min(0).max(120).optional(),
    safeBottom: z.number().int().min(0).max(120).optional(),
  })
  .strict();
export const alertRuleSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    title: z.string().min(1).max(100),
    message: z.string().max(300),
    condition: conditionSchema,
    cameraTileId: z.string().max(64).optional(),
    profileIds: z.array(z.string().max(64)).max(8).optional(),
    timeout: z.number().int().min(5).max(600),
    priority: z.enum(['info', 'warning', 'critical']),
  })
  .strict();
export function conditionMatches(
  condition: z.infer<typeof conditionSchema> | undefined,
  snapshot: Snapshot,
) {
  if (!condition) return true;
  const entity = snapshot.entities[condition.entityId];
  if (!entity || ['unknown', 'unavailable'].includes(entity.state)) return false;
  if (condition.operator === 'is') return entity.state === condition.value;
  if (condition.operator === 'is_not') return entity.state !== condition.value;
  const a = Number(entity.state),
    b = Number(condition.value);
  return (
    Number.isFinite(a) && Number.isFinite(b) && (condition.operator === 'above' ? a > b : a < b)
  );
}
export function isNight(settings: Profile['experience'], hour: number) {
  const start = settings?.nightStart ?? 22,
    end = settings?.nightEnd ?? 7;
  return start === end
    ? false
    : start > end
      ? hour >= start || hour < end
      : hour >= start && hour < end;
}
export type LayoutIssue = {
  severity: 'warning' | 'error';
  key: 'missingEntity' | 'unavailableEntity' | 'smallTile' | 'smallText' | 'brokenNavigation';
  tileId: string;
  pageId: string;
  profileId: string;
  title: string;
};
export function reviewDashboard(document: Dashboard, catalog: EntityState[]): LayoutIssue[] {
  const known = new Map(catalog.map((e) => [e.entity_id, e]));
  const issues: LayoutIssue[] = [];
  for (const profile of document.profiles)
    for (const page of document.pages.filter(
      (p) => !p.profileIds || p.profileIds.includes(profile.id),
    ))
      for (const tile of page.tiles) {
        const add = (key: LayoutIssue['key'], severity: LayoutIssue['severity'] = 'warning') =>
          issues.push({
            key,
            severity,
            tileId: tile.id,
            pageId: page.id,
            profileId: profile.id,
            title: tile.title,
          });
        if (!tile.room && !tile.energy && !tile.contacts) {
          const entity = known.get(tile.entityId);
          if (!entity) add('missingEntity', 'error');
          else if (
            entity.state === 'unavailable' ||
            (entity.state === 'unknown' && !['button', 'scene'].includes(tile.kind))
          )
            add('unavailableEntity');
        }
        const r = tile.layouts[profile.id];
        if (r && !profile.experience?.adaptive) {
          const w =
            ((profile.width - profile.margin * 2 - profile.gap * (profile.columns - 1)) /
              profile.columns) *
              r.w +
            profile.gap * (r.w - 1);
          const h =
            ((profile.height -
              profile.margin * 2 -
              profile.headerHeight -
              profile.footerHeight -
              profile.gap * (profile.rows - 1)) /
              profile.rows) *
              r.h +
            profile.gap * (r.h - 1);
          if (w < 100 || h < 100) add('smallTile');
          else if (w < 160 || h < 135) add('smallText');
        }
        for (const gesture of [tile.experience?.tap, tile.experience?.hold])
          if (
            gesture?.type === 'navigate' &&
            !document.pages.some(
              (p) =>
                p.id === gesture.pageId && (!p.profileIds || p.profileIds.includes(profile.id)),
            )
          )
            add('brokenNavigation', 'error');
      }
  return issues;
}
/** Pure view transformation. Saved positions and the published document never change. */
export function adaptiveDocument(
  document: Dashboard,
  profile: Profile,
  width: number,
  height: number,
) {
  if (!profile.experience?.adaptive) return { document, profile };
  const p = {
    ...profile,
    width: Math.max(320, Math.round(width)),
    height: Math.max(240, Math.round(height)),
  };
  p.columns = p.width < 600 ? 4 : p.width < 950 ? 8 : 12;
  p.margin = p.width < 600 ? 16 : 24;
  p.gap = 12;
  p.headerHeight = 90;
  p.footerHeight = 64;
  const next = structuredClone(document);
  const pages = next.pages.filter((page) => !page.profileIds || page.profileIds.includes(p.id));
  let rows = 2;
  for (const page of pages) {
    let x = 0,
      y = 0,
      rowHeight = 0;
    for (const tile of page.tiles) {
      const old = tile.layouts[profile.id],
        w =
          (tile.energy && !tile.navigateTo) ||
          tile.kind === 'media' ||
          old.w / profile.columns >= 0.75
            ? p.columns
            : tile.kind === 'camera' && p.columns >= 8
              ? Math.floor(p.columns / 2)
              : Math.min(4, p.columns);
      const h = tile.energy && !tile.navigateTo ? 4 : tile.kind === 'camera' ? 3 : 2;
      if (x + w > p.columns) {
        x = 0;
        y += rowHeight;
        rowHeight = 0;
      }
      tile.layouts[p.id] = { x, y, w, h };
      x += w;
      rowHeight = Math.max(rowHeight, h);
    }
    rows = Math.max(rows, y + rowHeight);
  }
  p.rows = rows;
  const minRow = p.experience?.density === 'compact' ? 60 : 76;
  p.height = Math.max(
    p.height,
    p.margin * 2 +
      p.headerHeight +
      p.footerHeight +
      (p.experience?.safeTop ?? 0) +
      (p.experience?.safeBottom ?? 0) +
      rows * minRow +
      (rows - 1) * p.gap,
  );
  next.profiles = next.profiles.map((item) => (item.id === p.id ? p : item));
  return { document: next, profile: p };
}
export function replaceEntity(document: Dashboard, from: string, to: string): Dashboard {
  // Replace only exact strings. IDs, titles and navigation remain untouched.
  const visit = (value: unknown, key = ''): unknown =>
    Array.isArray(value)
      ? value.map((v) => visit(v, key))
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, visit(v, k)]))
        : value === from &&
            [
              'entityId',
              'temperature',
              'humidity',
              'gridImport',
              'gridExport',
              'batteryPower',
              'batteryLevel',
              'importEnergy',
              'exportEnergy',
              'solarEnergy',
              'solarAdditional',
              'houseEnergy',
              'solarPower',
              'presence',
              'windows',
            ].includes(key)
          ? to
          : value;
  return visit(document) as Dashboard;
}
