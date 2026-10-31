import { dashboardSchema, findSpace, type Dashboard, type Tile, type EntityState } from './model';
import { layoutId } from './display-layouts';
import { domainKinds } from './widgets';
import { UserError } from './i18n';
export function transformSelection(
  input: Dashboard,
  pageId: string,
  profileId: string,
  ids: string[],
  operation: 'left' | 'top' | 'space' | 'size' | 'move',
  dx = 0,
  dy = 0,
) {
  const document = structuredClone(input),
    page = document.pages.find((p) => p.id === pageId)!;
  const tiles = page.tiles.filter((t) => ids.includes(t.id) && !t.experience?.locked);
  if (!tiles.length) return document;
  const first = tiles[0].layouts[profileId],
    rects = tiles.map((t) => t.layouts[profileId]);
  if (operation === 'space') {
    const sorted = [...tiles].sort((a, b) => a.layouts[profileId].x - b.layouts[profileId].x);
    if (sorted.length < 3) return document;
    const end = sorted.at(-1)!.layouts[profileId];
    const total =
        end.x + end.w - sorted[0].layouts[profileId].x - rects.reduce((n, r) => n + r.w, 0),
      gap = total / (sorted.length - 1);
    let x = sorted[0].layouts[profileId].x;
    for (const tile of sorted) {
      tile.layouts[profileId].x = Math.round(x);
      x += tile.layouts[profileId].w + gap;
    }
  } else
    for (const rect of rects) {
      if (operation === 'left') rect.x = Math.min(...rects.map((r) => r.x));
      if (operation === 'top') rect.y = Math.min(...rects.map((r) => r.y));
      if (operation === 'size') {
        rect.w = first.w;
        rect.h = first.h;
      }
      if (operation === 'move') {
        rect.x += dx;
        rect.y += dy;
      }
    }
  return dashboardSchema.parse(document);
}
export function pasteTiles(input: Dashboard, pageId: string, profileId: string, source: Tile[]) {
  const document = structuredClone(input),
    page = document.pages.find((p) => p.id === pageId)!,
    profile = document.profiles.find((p) => p.id === profileId)!;
  const ids: string[] = [];
  for (const tile of source) {
    const copy = structuredClone(tile),
      rect = Object.values(copy.layouts)[0];
    const spot = findSpace(profile, page.tiles, rect.w, rect.h);
    if (!spot) throw new UserError('error.copyNoSpace');
    copy.originId ??= copy.id;
    copy.id = layoutId('tile');
    copy.layouts = { [profileId]: spot };
    copy.experience = { ...copy.experience, locked: false };
    if (
      copy.navigateTo &&
      !document.pages.some(
        (p) => p.id === copy.navigateTo && (!p.profileIds || p.profileIds.includes(profileId)),
      )
    )
      delete copy.navigateTo;
    for (const key of ['tap', 'hold'] as const)
      if (
        copy.experience[key]?.type === 'navigate' &&
        !document.pages.some(
          (p) =>
            p.id === copy.experience![key]!.pageId &&
            (!p.profileIds || p.profileIds.includes(profileId)),
        )
      )
        copy.experience[key] = { type: 'details' };
    for (const control of copy.room?.controls ?? []) control.id = layoutId('control');
    page.tiles.push(copy);
    ids.push(copy.id);
  }
  return { document: dashboardSchema.parse(document), ids };
}
export function createTemplateView(
  input: Dashboard,
  profileId: string,
  name: string,
  entities: EntityState[],
  template: 'room' | 'camera' | 'energy' | 'blank',
) {
  const document = structuredClone(input),
    profile = document.profiles.find((p) => p.id === profileId)!;
  const page: Dashboard['pages'][number] = {
    id: layoutId('view'),
    name,
    profileIds: [profileId],
    tiles: [],
  };
  const add = (tile: Omit<Tile, 'layouts'>, w = 4, h = 2) => {
    const spot = findSpace(profile, page.tiles, w, h);
    if (!spot) throw new UserError('error.copyNoSpace');
    page.tiles.push({ ...tile, layouts: { [profileId]: spot } });
  };
  if (template === 'room') {
    const controls = entities
      .filter(
        (e) =>
          domainKinds[e.entity_id.split('.')[0]] &&
          !['camera', 'weather', 'sensor', 'alarm'].includes(
            domainKinds[e.entity_id.split('.')[0]],
          ),
      )
      .slice(0, 24)
      .map((e) => ({
        id: layoutId('control'),
        kind: domainKinds[e.entity_id.split('.')[0]],
        entityId: e.entity_id,
        title: String(e.attributes.friendly_name ?? e.entity_id).slice(0, 64),
        accent: 'mint' as const,
      }));
    const temperature = entities.find((e) => e.attributes.device_class === 'temperature'),
      humidity = entities.find((e) => e.attributes.device_class === 'humidity');
    const first = temperature ?? entities[0];
    if (first)
      add(
        {
          id: layoutId('room'),
          kind: 'sensor',
          entityId: temperature?.entity_id.startsWith('sensor.')
            ? temperature.entity_id
            : 'sensor.hapanel_room',
          title: name,
          accent: 'mint',
          room: {
            icon: 'home',
            temperature: temperature?.entity_id,
            humidity: humidity?.entity_id,
            presence: entities
              .filter((e) => ['presence', 'occupancy'].includes(String(e.attributes.device_class)))
              .map((e) => e.entity_id)
              .slice(0, 8),
            windows: entities
              .filter((e) =>
                ['window', 'door', 'opening'].includes(String(e.attributes.device_class)),
              )
              .map((e) => e.entity_id)
              .slice(0, 8),
            controls,
          },
        },
        Math.min(profile.columns, 4),
        3,
      );
  } else if (template === 'energy') {
    const power = entities.filter((e) =>
      ['W', 'kW'].includes(String(e.attributes.unit_of_measurement)),
    );
    if (!power.length) throw new UserError('error.entityUnavailable');
    add(
      {
        id: layoutId('energy'),
        kind: 'sensor',
        entityId: power[0].entity_id,
        title: name,
        accent: 'mint',
        energy: {
          solarPower: [power[0].entity_id],
          batteryPositive: 'charge',
          consumers: [],
          metrics: [],
        },
      },
      profile.columns,
      Math.min(4, profile.rows),
    );
  } else if (template === 'camera')
    for (const e of entities.filter((e) => e.entity_id.startsWith('camera.')))
      add(
        {
          id: layoutId('camera'),
          kind: 'camera',
          title: String(e.attributes.friendly_name ?? e.entity_id).slice(0, 64),
          entityId: e.entity_id,
          accent: 'blue',
          camera: { overview: 'snapshot', transport: 'auto', fit: 'cover', refreshSeconds: 30 },
        },
        Math.max(2, Math.floor(profile.columns / 2)),
        Math.max(2, Math.floor(profile.rows / 2)),
      );
  document.pages.push(page);
  return { document: dashboardSchema.parse(document), pageId: page.id };
}
