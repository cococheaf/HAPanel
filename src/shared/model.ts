import { UserError } from './i18n';
import { z } from 'zod';
import { designSchema, savedDesignSchema } from './design';
import {
  commands,
  gestureSchema,
  tileExperienceSchema,
  profileExperienceSchema,
  alertRuleSchema,
} from './experience';

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
// Keep spaces while typing: transforming on every keystroke joins words in controlled inputs.
const text = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => value.trim().length > 0, 'error.requiredText');
export const lightOptionsSchema = z
  .object({
    allowTurnOn: z.boolean().default(true),
    allowTurnOff: z.boolean().default(true),
    showBrightness: z.boolean().default(true),
  })
  .strict();
export const tileKinds = [
  'light',
  'climate',
  'media',
  'weather',
  'scene',
  'sensor',
  'cover',
  'automation',
  'alarm',
  'contacts',
  'camera',
  'timer',
  'select',
  'number',
  'fan',
  'vacuum',
  'button',
  'section',
] as const;
export type TileKind = (typeof tileKinds)[number];
const entityId = z.string().regex(/^[a-z_]+\.[a-z0-9_]+$/);
const sensorId = z.string().regex(/^sensor\.[a-z0-9_]+$/);
export const alarmModes = [
  'disarmed',
  'armed_home',
  'armed_away',
  'armed_night',
  'armed_vacation',
  'armed_custom_bypass',
] as const;
export type AlarmMode = (typeof alarmModes)[number];
export const alarmOptionsSchema = z
  .object({
    modes: z
      .array(z.enum(alarmModes))
      .min(1)
      .max(6)
      .refine((modes) => new Set(modes).size === modes.length, 'error.uniqueIds'),
  })
  .strict();
export const contactsSchema = z
  .array(
    z
      .object({
        entityId: z.string().regex(/^binary_sensor\.[a-z0-9_]+$/),
        label: text(64),
      })
      .strict(),
  )
  .min(1)
  .max(32)
  .superRefine((items, ctx) => {
    if (new Set(items.map((item) => item.entityId)).size !== items.length)
      ctx.addIssue({ code: 'custom', message: 'error.uniqueIds' });
  });
const alarmLink = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  });
export const controlSchema = z
  .object({
    id,
    originId: id.optional(),
    kind: z.enum(tileKinds),
    title: text(64),
    entityId,
    accent: z.enum(['amber', 'mint', 'blue', 'rose', 'purple', 'orange', 'red', 'gray']),
    alarm: alarmOptionsSchema.optional(),
    light: lightOptionsSchema.optional(),
    experience: tileExperienceSchema.optional(),
  })
  .strict();
export const roomSchema = z
  .object({
    icon: z.enum(['home', 'sofa', 'kitchen', 'bed', 'bath', 'door', 'hall']).default('home'),
    temperature: entityId.optional(),
    humidity: sensorId.optional(),
    presence: z.array(entityId).max(8).default([]),
    windows: z.array(entityId).max(8).default([]),
    controls: z.array(controlSchema).max(24),
  })
  .strict();
export const energySchema = z
  .object({
    solarPower: z.array(sensorId).min(1).max(4),
    gridImport: sensorId.optional(),
    gridExport: sensorId.optional(),
    batteryPower: sensorId.optional(),
    batteryLevel: sensorId.optional(),
    batteryPositive: z.enum(['charge', 'discharge']).default('charge'),
    meters: z
      .object({
        importEnergy: sensorId.optional(),
        exportEnergy: sensorId.optional(),
        solarEnergy: sensorId.optional(),
        solarAdditional: z.array(sensorId).max(3).optional(),
        houseEnergy: sensorId.optional(),
        tariff: z.number().min(0).max(100).optional(),
        exportTariff: z.number().min(0).max(100).optional(),
        currency: z.enum(['EUR', 'USD', 'GBP', 'CHF']).optional(),
      })
      .strict()
      .optional(),
    consumers: z
      .array(z.object({ label: z.string().min(1).max(64), entityId: sensorId }).strict())
      .max(12)
      .default([]),
    metrics: z
      .array(z.object({ label: z.string().min(1).max(64), entityId: sensorId }).strict())
      .max(12)
      .default([]),
  })
  .strict()
  .superRefine((energy, ctx) => {
    for (const [path, values] of [
      ['solarPower', energy.solarPower],
      ['consumers', energy.consumers.map((item) => item.entityId)],
      ['metrics', energy.metrics.map((item) => item.entityId)],
    ] as const) {
      if (new Set(values).size !== values.length)
        ctx.addIssue({ code: 'custom', message: 'error.uniqueIds', path: [path] });
    }
    const solarMeters = [
      energy.meters?.solarEnergy,
      ...(energy.meters?.solarAdditional ?? []),
    ].filter(Boolean);
    if (new Set(solarMeters).size !== solarMeters.length)
      ctx.addIssue({ code: 'custom', message: 'error.uniqueIds', path: ['meters'] });
    if (energy.gridImport && energy.gridImport === energy.gridExport)
      ctx.addIssue({ code: 'custom', message: 'error.uniqueIds', path: ['gridExport'] });
  });
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
    name: text(64),
    theme: z.enum(['dusk', 'ocean', 'sand']).optional(),
    design: designSchema.optional(),
    experience: profileExperienceSchema.optional(),
    greeting: text(80).optional(),
    subtitle: z.string().max(100).optional(),
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
    originId: id.optional(),
    kind: z.enum(tileKinds),
    title: text(64),
    entityId: z.union([entityId, z.literal('')]),
    accent: z.enum(['amber', 'mint', 'blue', 'rose', 'purple', 'orange', 'red', 'gray']),
    layouts: z.record(id, rectSchema),
    room: roomSchema.optional(),
    energy: energySchema.optional(),
    navigateTo: id.optional(),
    contacts: contactsSchema.optional(),
    homeAssistantUrl: alarmLink.optional(),
    alarm: alarmOptionsSchema.optional(),
    light: lightOptionsSchema.optional(),
    experience: tileExperienceSchema.optional(),
    mediaFavorite: z
      .object({ id: z.string().min(1).max(2048), type: z.string().min(1).max(80) })
      .strict()
      .optional(),
    camera: z
      .object({
        overviewEntityId: z
          .string()
          .regex(/^camera\.[a-z0-9_]+$/)
          .optional(),
        refreshSeconds: z.number().int().min(15).max(120).default(30),
        fit: z.enum(['cover', 'contain']).default('cover'),
        overview: z.enum(['snapshot', 'live']).default('snapshot'),
        transport: z.enum(['auto', 'webrtc', 'hls']).default('auto'),
      })
      .strict()
      .optional(),
  })
  .strict();
export const dashboardSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    name: text(64),
    greeting: text(80),
    subtitle: z.string().max(100),
    theme: z.enum(['dusk', 'ocean', 'sand']),
    profiles: z.array(profileSchema).min(1).max(8),
    designs: z
      .array(savedDesignSchema)
      .max(24)
      .refine(
        (items) => new Set(items.map((item) => item.id)).size === items.length,
        'error.uniqueIds',
      )
      .optional(),
    alerts: z.array(alertRuleSchema).max(24).optional(),
    pages: z
      .array(
        z
          .object({
            id,
            name: text(40),
            profileIds: z.array(id).min(1).max(8).optional(),
            originId: id.optional(),
            hidden: z.boolean().optional(),
            design: designSchema.optional(),
            heading: text(80).optional(),
            subtitle: z.string().max(100).optional(),
            tiles: z.array(tileSchema).max(64),
          })
          .strict(),
      )
      .min(1)
      .max(96),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const unique = (values: string[], path: (string | number)[]) => {
      if (new Set(values).size !== values.length)
        ctx.addIssue({ code: 'custom', message: 'error.uniqueIds', path });
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
      allControls(doc).map((t) => t.id),
      ['pages'],
    );
    for (const [index, page] of doc.pages.entries()) {
      if (page.profileIds) {
        unique(page.profileIds, ['pages', index, 'profileIds']);
        if (page.profileIds.some((id) => !doc.profiles.some((profile) => profile.id === id)))
          ctx.addIssue({
            code: 'custom',
            message: 'error.invalidDisplay',
            path: ['pages', index, 'profileIds'],
          });
      }
    }
    for (const [pi, p] of doc.profiles.entries()) {
      const visible = doc.pages.filter(
        (page) => !page.profileIds || page.profileIds.includes(p.id),
      );
      if (!visible.some((page) => !page.hidden))
        ctx.addIssue({ code: 'custom', message: 'error.invalidPage', path: ['profiles', pi] });
      if (visible.length < 1 || visible.length > 12)
        ctx.addIssue({ code: 'custom', message: 'error.displayPageCount', path: ['profiles', pi] });
      if (geometry(p).cellWidth < 12 || geometry(p).rowHeight < 12) {
        ctx.addIssue({
          code: 'custom',
          message: 'error.gridTooSmall',
          path: ['profiles', pi],
        });
      }
      for (const [pageIndex, page] of doc.pages.entries()) {
        if (page.profileIds && !page.profileIds.includes(p.id)) continue;
        for (const [ti, tile] of page.tiles.entries()) {
          const r = tile.layouts[p.id];
          const path = ['pages', pageIndex, 'tiles', ti, 'layouts', p.id];
          if (!r) {
            ctx.addIssue({ code: 'custom', message: 'error.missingLayout', path });
            continue;
          }
          if (r.x + r.w > p.columns || r.y + r.h > p.rows) {
            ctx.addIssue({ code: 'custom', message: 'error.outsideGrid', path });
          }
          if (
            page.tiles
              .slice(0, ti)
              .some((other) => other.layouts[p.id] && overlaps(r, other.layouts[p.id]))
          ) {
            ctx.addIssue({
              code: 'custom',
              message: 'error.overlap',
              path,
            });
          }
        }
      }
    }
    const domains: Record<TileKind, string[]> = {
      section: [''],
      light: ['light', 'switch'],
      climate: ['climate'],
      media: ['media_player'],
      weather: ['weather'],
      scene: ['scene', 'script'],
      sensor: ['sensor', 'binary_sensor'],
      cover: ['cover'],
      automation: ['automation'],
      alarm: ['alarm_control_panel'],
      contacts: ['binary_sensor'],
      camera: ['camera'],
      timer: ['timer'],
      select: ['select', 'input_select'],
      number: ['number', 'input_number'],
      fan: ['fan'],
      vacuum: ['vacuum'],
      button: ['button', 'input_button'],
    };
    for (const [pageIndex, page] of doc.pages.entries())
      for (const [ti, tile] of page.tiles.entries()) {
        if (
          (tile.kind === 'contacts') !== Boolean(tile.contacts) ||
          ((tile.homeAssistantUrl || tile.alarm) && tile.kind !== 'alarm') ||
          (tile.camera && tile.kind !== 'camera') ||
          (tile.light && (tile.kind !== 'light' || Boolean(tile.room)))
        )
          ctx.addIssue({
            code: 'custom',
            message: 'error.entityKind',
            path: ['pages', pageIndex, 'tiles', ti],
          });
        if (
          tile.kind === 'section' &&
          (tile.entityId !== '' ||
            tile.room ||
            tile.energy ||
            tile.contacts ||
            tile.camera ||
            tile.alarm ||
            tile.light)
        )
          ctx.addIssue({
            code: 'custom',
            message: 'error.entityKind',
            path: ['pages', pageIndex, 'tiles', ti],
          });
        if ((tile.room && tile.energy) || (tile.energy && tile.kind !== 'sensor')) {
          ctx.addIssue({
            code: 'custom',
            message: 'error.entityKind',
            path: ['pages', pageIndex, 'tiles', ti],
          });
        }
        if (
          tile.navigateTo &&
          !doc.pages.some(
            (target) =>
              target.id === tile.navigateTo &&
              doc.profiles
                .filter((profile) => !page.profileIds || page.profileIds.includes(profile.id))
                .every((profile) => !target.profileIds || target.profileIds.includes(profile.id)),
          )
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'error.invalidPage',
            path: ['pages', pageIndex, 'tiles', ti, 'navigateTo'],
          });
        }
        for (const control of tile.room?.controls ?? []) {
          if (
            control.kind === 'section' ||
            control.kind === 'contacts' ||
            control.kind === 'camera' ||
            (control.alarm && control.kind !== 'alarm') ||
            (control.light && control.kind !== 'light') ||
            !domains[control.kind].includes(control.entityId.split('.')[0])
          )
            ctx.addIssue({
              code: 'custom',
              message: 'error.entityKind',
              path: ['pages', pageIndex, 'tiles', ti, 'room'],
            });
        }
        if (!domains[tile.kind].includes(tile.entityId.split('.')[0])) {
          ctx.addIssue({
            code: 'custom',
            message: 'error.entityKind',
            path: ['pages', pageIndex, 'tiles', ti, 'entityId'],
          });
        }
      }
  });

export type Rect = z.infer<typeof rectSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Tile = z.infer<typeof tileSchema>;
export type Control = z.infer<typeof controlSchema>;
export type Room = z.infer<typeof roomSchema>;
export type Energy = z.infer<typeof energySchema>;
export type HistoryPoint = { time: string; value: number };
export type Dashboard = z.infer<typeof dashboardSchema>;
export type Revision = { revision: number; savedAt: string; document: Dashboard };
export type Workspace = { draft: Revision; published: Revision; history: Revision[] };
export type EntityState = {
  area?: { id: string; name: string; floor?: string };
  deviceName?: string;
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_updated?: string;
  lightCapabilities?: { dimmable: boolean; reason: 'dimmable' | 'onoff' | 'mixed' | 'unknown' };
};
export type Forecast = { datetime: string; temperature: number; condition: string };
export type Snapshot = {
  status: 'demo' | 'connected' | 'reconnecting';
  entities: Record<string, EntityState>;
  forecasts: Record<string, Forecast[]>;
  alarmControl?: boolean;
  contactSources?: { entityId: string; label: string }[];
  cameraView?: boolean;
  deviceControl?: boolean;
};
export const actionSchema = z
  .object({
    tileId: id,
    command: z.enum([...commands, 'alarm', 'tap', 'hold']),
    value: z.number().finite().optional(),
    valueHigh: z.number().finite().optional(),
    option: z.string().max(256).optional(),
    color: z
      .tuple([z.number().min(0).max(255), z.number().min(0).max(255), z.number().min(0).max(255)])
      .optional(),
    mode: z.enum(alarmModes).optional(),
    code: z.string().min(1).max(64).optional(),
  })
  .strict()
  .superRefine((a, ctx) => {
    if (
      a.command === 'alarm'
        ? !a.mode || a.value !== undefined || a.option !== undefined || a.color !== undefined
        : a.mode !== undefined || a.code !== undefined
    )
      ctx.addIssue({ code: 'custom', message: 'error.actionNotAllowed' });
    if (a.valueHigh !== undefined && a.command !== 'temperature_range')
      ctx.addIssue({ code: 'custom', message: 'error.actionNotAllowed' });
    if (
      ['tap', 'hold'].includes(a.command) &&
      (a.value !== undefined ||
        a.option !== undefined ||
        a.color !== undefined ||
        a.valueHigh !== undefined)
    )
      ctx.addIssue({ code: 'custom', message: 'error.actionNotAllowed' });
  });
export type Action = z.infer<typeof actionSchema>;
export function materializeAction(document: Dashboard, action: Action): Action {
  if (action.command !== 'tap' && action.command !== 'hold') return action;
  const tile = allControls(document).find((t) => t.id === action.tileId);
  const gesture = tile?.experience?.[action.command];
  if (gesture?.type !== 'command' || !gesture.command)
    throw new UserError('error.actionNotAllowed');
  return {
    tileId: action.tileId,
    command: gesture.command,
    ...(gesture.value !== undefined ? { value: gesture.value } : {}),
    ...(gesture.valueHigh !== undefined ? { valueHigh: gesture.valueHigh } : {}),
    ...(gesture.option !== undefined ? { option: gesture.option } : {}),
  };
}

export function geometry(p: Profile) {
  const width = p.width - p.margin * 2;
  const height =
    p.height -
    p.margin * 2 -
    p.headerHeight -
    p.footerHeight -
    (p.experience?.safeTop ?? 0) -
    (p.experience?.safeBottom ?? 0);
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
export function allControls(document: {
  pages: {
    tiles: {
      id: string;
      kind: TileKind;
      entityId: string;
      alarm?: z.infer<typeof alarmOptionsSchema>;
      light?: z.infer<typeof lightOptionsSchema>;
      experience?: z.infer<typeof tileExperienceSchema>;
      mediaFavorite?: { id: string; type: string };
      room?: { controls: Control[] };
    }[];
  }[];
}) {
  return document.pages.flatMap((page) =>
    page.tiles.flatMap((tile) => [tile, ...(tile.room?.controls ?? [])]),
  );
}
export function entityIds(document: Dashboard) {
  return [
    ...new Set([
      ...(document.alerts?.map((rule) => rule.condition.entityId) ?? []),
      ...document.pages.flatMap((page) =>
        page.tiles
          .flatMap((tile) => [
            ...(tile.room || tile.energy || tile.contacts ? [] : [tile.entityId]),
            tile.camera?.overviewEntityId,
            tile.experience?.visibleWhen?.entityId,
            ...(tile.contacts?.map((contact) => contact.entityId) ?? []),
            ...(tile.room
              ? [
                  tile.room.temperature,
                  tile.room.humidity,
                  ...tile.room.presence,
                  ...tile.room.windows,
                  ...tile.room.controls.map((control) => control.entityId),
                ]
              : []),
            ...(tile.energy
              ? [
                  ...tile.energy.solarPower,
                  ...(tile.energy.meters?.solarAdditional ?? []),
                  tile.energy.meters?.importEnergy,
                  tile.energy.meters?.exportEnergy,
                  tile.energy.meters?.solarEnergy,
                  tile.energy.meters?.houseEnergy,
                  tile.energy.gridImport,
                  tile.energy.gridExport,
                  tile.energy.batteryPower,
                  tile.energy.batteryLevel,
                  ...tile.energy.consumers.map((item) => item.entityId),
                  ...tile.energy.metrics.map((item) => item.entityId),
                ]
              : []),
          ])
          .filter((value): value is string => Boolean(value)),
      ),
    ]),
  ];
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
export function resolveAction(document: Dashboard, requested: Action) {
  const action = materializeAction(document, requested);
  const tile = allControls(document).find((t) => t.id === action.tileId);
  if (!tile) throw new UserError('error.tileNotAllowed');
  const domain = tile.entityId.split('.')[0];
  if (action.command !== 'alarm' && (action.mode !== undefined || action.code !== undefined))
    throw new UserError('error.actionNotAllowed');
  const result = (service: string, service_data: Record<string, unknown> = {}) => ({
    domain,
    service,
    target: { entity_id: tile.entityId },
    service_data,
  });
  const value = (min: number, max: number) => {
    if (action.value === undefined || action.value < min || action.value > max)
      throw new UserError('error.valueRange');
    return action.value;
  };
  if (tile.kind === 'alarm' && action.command === 'alarm') {
    const services: Record<AlarmMode, string> = {
      disarmed: 'alarm_disarm',
      armed_home: 'alarm_arm_home',
      armed_away: 'alarm_arm_away',
      armed_night: 'alarm_arm_night',
      armed_vacation: 'alarm_arm_vacation',
      armed_custom_bypass: 'alarm_arm_custom_bypass',
    };
    if (!action.mode || !tile.alarm?.modes.includes(action.mode))
      throw new UserError('error.actionNotAllowed');
    return result(services[action.mode], action.code ? { code: action.code } : {});
  }
  if (tile.kind === 'light' && ['color_temp', 'color'].includes(action.command)) {
    if (tile.light?.allowTurnOn === false || tile.light?.allowTurnOff === false)
      throw new UserError('error.actionNotAllowed');
    if (action.command === 'color_temp')
      return result('turn_on', { color_temp_kelvin: value(1000, 12000) });
    if (!action.color) throw new UserError('error.valueRange');
    return result('turn_on', { rgb_color: action.color });
  }
  if (tile.kind === 'light') {
    const allowOn = tile.light?.allowTurnOn ?? true;
    const allowOff = tile.light?.allowTurnOff ?? true;
    if (action.command === 'toggle' && allowOn && allowOff) return result('toggle');
    if (action.command === 'turn_on' && allowOn) return result('turn_on');
    if (action.command === 'turn_off' && allowOff) return result('turn_off');
    if (action.command === 'brightness' && domain === 'light') {
      if (!allowOn || !allowOff || tile.light?.showBrightness === false)
        throw new UserError('error.actionNotAllowed');
      const brightness = value(0, 100);
      return brightness === 0
        ? result('turn_off')
        : result('turn_on', { brightness_pct: Math.round(brightness) });
    }
  }
  if (tile.kind === 'climate' && action.command === 'temperature_range') {
    if (
      action.valueHigh === undefined ||
      action.valueHigh < value(-50, 100) ||
      action.valueHigh > 100
    )
      throw new UserError('error.valueRange');
    return result('set_temperature', {
      target_temp_low: action.value,
      target_temp_high: action.valueHigh,
    });
  }
  if (tile.kind === 'climate' && action.command === 'humidity')
    return result('set_humidity', { humidity: value(0, 100) });
  if (tile.kind === 'climate' && action.command === 'temperature')
    return result('set_temperature', { temperature: value(-50, 100) });
  const option = () => {
    if (!action.option) throw new UserError('error.actionNotAllowed');
    return action.option;
  };
  if (tile.kind === 'climate') {
    if (action.command === 'hvac') return result('set_hvac_mode', { hvac_mode: option() });
    if (action.command === 'climate_fan') return result('set_fan_mode', { fan_mode: option() });
    if (action.command === 'swing') return result('set_swing_mode', { swing_mode: option() });
    if (action.command === 'preset') return result('set_preset_mode', { preset_mode: option() });
  }
  if (tile.kind === 'select' && action.command === 'select')
    return result('select_option', { option: option() });
  if (tile.kind === 'number' && action.command === 'number')
    return result('set_value', { value: value(-1e12, 1e12) });
  if (tile.kind === 'button' && action.command === 'press') return result('press');
  if (tile.kind === 'fan') {
    if (['turn_on', 'turn_off', 'toggle'].includes(action.command)) return result(action.command);
    if (action.command === 'fan_speed')
      return result('set_percentage', { percentage: value(0, 100) });
    if (action.command === 'preset') return result('set_preset_mode', { preset_mode: option() });
  }
  if (tile.kind === 'vacuum') {
    const service = {
      vacuum_start: 'start',
      vacuum_pause: 'pause',
      vacuum_return: 'return_to_base',
    }[action.command as string];
    if (service) return result(service);
  }
  if (tile.kind === 'timer') {
    const service = { timer_start: 'start', timer_pause: 'pause', timer_cancel: 'cancel' }[
      action.command as string
    ];
    if (service) return result(service);
  }
  if (
    tile.kind === 'media' &&
    action.command === 'favorite' &&
    'mediaFavorite' in tile &&
    tile.mediaFavorite
  )
    return result('play_media', {
      media_content_id: tile.mediaFavorite.id,
      media_content_type: tile.mediaFavorite.type,
    });
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
  if (tile.kind === 'automation') {
    if (action.command === 'toggle') return result('toggle');
    if (action.command === 'activate') return result('trigger', { skip_condition: false });
  }
  if (tile.kind === 'cover') {
    if (action.command === 'open') return result('open_cover');
    if (action.command === 'close') return result('close_cover');
    if (action.command === 'stop') return result('stop_cover');
    if (action.command === 'tilt')
      return result('set_cover_tilt_position', { tilt_position: Math.round(value(0, 100)) });
    if (action.command === 'position')
      return result('set_cover_position', { position: Math.round(value(0, 100)) });
  }
  throw new UserError('error.actionNotAllowed');
}

export function pagesForProfile(document: Pick<Dashboard, 'pages'>, profileId: string) {
  return document.pages.filter((page) => !page.profileIds || page.profileIds.includes(profileId));
}
