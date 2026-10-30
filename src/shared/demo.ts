import { UserError, translate, type Language, type MessageKey } from './i18n';
import {
  dashboardSchema,
  type Dashboard,
  type EntityState,
  type Snapshot,
  type Action,
  resolveAction,
} from './model';

export const demoDocument: Dashboard = dashboardSchema.parse({
  schemaVersion: 1,
  id: 'home',
  name: 'Mein Zuhause',
  greeting: 'Schön, dass du da bist.',
  subtitle: 'Dein Zuhause. Auf einen Blick.',
  theme: 'dusk',
  profiles: [
    {
      id: 'ipad',
      name: 'iPad 8 · Querformat',
      physicalWidth: 2160,
      physicalHeight: 1620,
      diagonal: 10.2,
      dpr: 2,
      width: 1080,
      height: 810,
      columns: 12,
      rows: 6,
      gap: 16,
      margin: 32,
      headerHeight: 118,
      footerHeight: 70,
      mode: 'fit',
    },
    {
      id: 'compact',
      name: 'Kompakt · 800 × 480',
      physicalWidth: 800,
      physicalHeight: 480,
      diagonal: 7,
      dpr: 1,
      width: 800,
      height: 480,
      columns: 8,
      rows: 4,
      gap: 12,
      margin: 20,
      headerHeight: 68,
      footerHeight: 48,
      mode: 'fit',
    },
    {
      id: 'portrait',
      name: 'iPad 8 · Hochformat',
      physicalWidth: 1620,
      physicalHeight: 2160,
      diagonal: 10.2,
      dpr: 2,
      width: 810,
      height: 1080,
      columns: 8,
      rows: 8,
      gap: 14,
      margin: 32,
      headerHeight: 118,
      footerHeight: 70,
      mode: 'fit',
    },
  ],
  pages: [
    {
      id: 'overview',
      name: 'Zuhause',
      tiles: [
        {
          id: 'weather',
          kind: 'weather',
          title: 'Wien',
          entityId: 'weather.home',
          accent: 'blue',
          layouts: {
            ipad: { x: 0, y: 0, w: 4, h: 2 },
            compact: { x: 0, y: 0, w: 2, h: 2 },
            portrait: { x: 0, y: 0, w: 4, h: 2 },
          },
        },
        {
          id: 'light',
          kind: 'light',
          title: 'Deckenlicht',
          entityId: 'light.living_room',
          accent: 'amber',
          layouts: {
            ipad: { x: 4, y: 0, w: 4, h: 2 },
            compact: { x: 2, y: 0, w: 3, h: 2 },
            portrait: { x: 4, y: 0, w: 4, h: 2 },
          },
        },
        {
          id: 'climate',
          kind: 'climate',
          title: 'Wohnzimmer',
          entityId: 'climate.living_room',
          accent: 'rose',
          layouts: {
            ipad: { x: 8, y: 0, w: 4, h: 2 },
            compact: { x: 5, y: 0, w: 3, h: 2 },
            portrait: { x: 0, y: 2, w: 4, h: 2 },
          },
        },
        {
          id: 'media',
          kind: 'media',
          title: 'Wohnzimmer',
          entityId: 'media_player.living_room',
          accent: 'mint',
          layouts: {
            ipad: { x: 0, y: 2, w: 8, h: 4 },
            compact: { x: 0, y: 2, w: 5, h: 2 },
            portrait: { x: 0, y: 4, w: 8, h: 3 },
          },
        },
        {
          id: 'scene',
          kind: 'scene',
          title: 'Feierabend',
          entityId: 'scene.evening',
          accent: 'mint',
          layouts: {
            ipad: { x: 8, y: 2, w: 4, h: 2 },
            compact: { x: 5, y: 2, w: 3, h: 1 },
            portrait: { x: 4, y: 2, w: 4, h: 2 },
          },
        },
        {
          id: 'sensor',
          kind: 'sensor',
          title: 'Luftqualität',
          entityId: 'sensor.air_quality',
          accent: 'mint',
          layouts: {
            ipad: { x: 8, y: 4, w: 4, h: 2 },
            compact: { x: 5, y: 3, w: 3, h: 1 },
            portrait: { x: 0, y: 7, w: 8, h: 1 },
          },
        },
      ],
    },
    { id: 'favorites', name: 'Favoriten', tiles: [] },
  ],
});

const sampleTileKeys = {
  weather: 'sample.weather',
  light: 'sample.light',
  climate: 'sample.climate',
  media: 'sample.media',
  scene: 'sample.scene',
  sensor: 'sample.sensor',
} as const;
const showcaseCopy: Record<string, { title: string; key: MessageKey }> = {
  demo_general: { title: 'General Licht', key: 'sample.generalLight' },
  demo_summer: { title: 'Beschattung Sommer', key: 'sample.summer' },
  demo_alarm: { title: 'Alarmpanel', key: 'kind.alarm' },
  demo_contacts: { title: 'Türen & Fenster', key: 'kind.contacts' },
  demo_home_eg: { title: 'Erdgeschoss', key: 'sample.floorEG' },
  demo_home_og: { title: 'Obergeschoss', key: 'sample.floorOG' },
  demo_living: { title: 'Wohnzimmer', key: 'sample.media' },
  demo_kitchen: { title: 'Küche', key: 'sample.kitchenRoom' },
  demo_dining: { title: 'Essbereich', key: 'sample.dining' },
  demo_entry: { title: 'Eingang', key: 'sample.entrance' },
  demo_bedroom: { title: 'Schlafzimmer', key: 'sample.bedroom' },
  demo_study: { title: 'Arbeitszimmer', key: 'sample.study' },
  demo_bath: { title: 'Bad', key: 'sample.bath' },
  demo_guest: { title: 'Gästezimmer', key: 'sample.guest' },
  demo_energy: { title: 'Energie', key: 'sample.energy' },
  demo_energy_home: { title: 'Energie', key: 'sample.energy' },
};
const showcaseLabels: Record<string, MessageKey> = {
  Licht: 'sample.controlLight',
  Heizung: 'sample.controlHeat',
  Musik: 'sample.controlMusic',
  Beschattung: 'kind.cover',
  Küche: 'sample.kitchenRoom',
  Arbeitszimmer: 'sample.study',
  Medien: 'kind.media',
  'Solarertrag heute': 'sample.solarToday',
  'Netzbezug heute': 'sample.importToday',
  'Einspeisung heute': 'sample.exportToday',
};
/** Translate untouched sample labels only. Custom text and saved layouts are never rewritten. */
export function localizedSampleTile<T extends { id: string; title: string }>(
  tile: T,
  language: Language,
): T {
  const example = Object.hasOwn(showcaseCopy, tile.id) ? showcaseCopy[tile.id] : undefined;
  if (example && tile.title === example.title)
    return { ...tile, title: translate(language, example.key) };
  if (tile.id.startsWith('demo_') && Object.hasOwn(showcaseLabels, tile.title))
    return { ...tile, title: translate(language, showcaseLabels[tile.title]) };
  const key = sampleTileKeys[tile.id as keyof typeof sampleTileKeys];
  const original = demoDocument.pages[0].tiles.find((item) => item.id === tile.id);
  return key && original?.title === tile.title
    ? { ...tile, title: translate(language, key) }
    : tile;
}
export function localizeSampleDocument(document: Dashboard, language: Language): Dashboard {
  if (document.id !== demoDocument.id) return document;
  const sample = (value: string, original: string, key: MessageKey) =>
    value === original ? translate(language, key) : value;
  const profileKeys = {
    ipad: 'sample.profileIpad',
    portrait: 'sample.profilePortrait',
    compact: 'sample.profileCompact',
  } as const;
  return {
    ...document,
    name: sample(document.name, demoDocument.name, 'sample.name'),
    greeting: sample(document.greeting, demoDocument.greeting, 'sample.greeting'),
    subtitle: sample(document.subtitle, demoDocument.subtitle, 'sample.subtitle'),
    profiles: document.profiles.map((profile) => {
      const original = demoDocument.profiles.find((item) => item.id === profile.id);
      const key = profileKeys[profile.id as keyof typeof profileKeys];
      return key && original
        ? { ...profile, name: sample(profile.name, original.name, key) }
        : profile;
    }),
    pages: document.pages.map((page) => ({
      ...page,
      heading: !page.heading
        ? page.heading
        : page.id === 'eg'
          ? sample(page.heading ?? '', 'Zusammen zuhause.', 'sample.headingEG')
          : page.id === 'og'
            ? sample(page.heading ?? '', 'Deine Rückzugsorte.', 'sample.headingOG')
            : page.id === 'energy'
              ? sample(page.heading ?? '', 'Dein Energiecockpit.', 'sample.headingEnergy')
              : page.heading,
      subtitle:
        page.id === 'eg'
          ? sample(
              page.subtitle ?? '',
              'Erdgeschoss · Wohnen, kochen und ankommen.',
              'sample.subtitleEG',
            )
          : page.id === 'og'
            ? sample(
                page.subtitle ?? '',
                'Obergeschoss · Ruhe, Raum und Wohlbefinden.',
                'sample.subtitleOG',
              )
            : page.id === 'energy'
              ? sample(
                  page.subtitle ?? '',
                  'Erzeugung, Netz und Speicher auf einen Blick.',
                  'sample.subtitleEnergy',
                )
              : page.subtitle,
      name:
        page.id === 'eg'
          ? sample(page.name, 'EG', 'sample.navEG')
          : page.id === 'og'
            ? sample(page.name, 'OG', 'sample.navOG')
            : page.id === 'energy'
              ? sample(page.name, 'Energie', 'sample.energy')
              : page.id === 'overview'
                ? sample(page.name, 'Zuhause', 'sample.home')
                : page.id === 'favorites'
                  ? sample(page.name, 'Favoriten', 'sample.favourites')
                  : page.name,
      tiles: page.tiles.map((tile) => {
        let view = localizedSampleTile(tile, language);
        if (tile.id === 'demo_contacts' && tile.contacts) {
          const labels: Record<string, MessageKey> = {
            Terrassentür: 'sample.terraceDoor',
            Küchenfenster: 'sample.kitchenWindow',
            Schlafzimmerfenster: 'sample.bedroomWindow',
            Badfenster: 'sample.bathWindow',
          };
          view = {
            ...view,
            contacts: tile.contacts.map((item) => ({
              ...item,
              label: Object.hasOwn(labels, item.label)
                ? translate(language, labels[item.label])
                : item.label,
            })),
          };
        }
        if (!tile.energy || !tile.id.startsWith('demo_')) return view;
        const label = (value: string) =>
          Object.hasOwn(showcaseLabels, value) ? translate(language, showcaseLabels[value]) : value;
        return {
          ...view,
          energy: {
            ...tile.energy,
            consumers: tile.energy.consumers.map((item) => ({ ...item, label: label(item.label) })),
            metrics: tile.energy.metrics.map((item) => ({ ...item, label: label(item.label) })),
          },
        };
      }),
    })),
  };
}
export function sampleEntityName(entity: EntityState, language: Language) {
  const key: MessageKey | undefined = (
    {
      'weather.home': 'sample.weather',
      'light.living_room': 'sample.light',
      'light.kitchen': 'sample.kitchen',
      'climate.living_room': 'sample.climate',
      'media_player.living_room': 'sample.media',
      'scene.evening': 'sample.scene',
      'sensor.air_quality': 'sample.sensor',
      'sensor.temperature': 'sample.temperature',
    } as Record<string, MessageKey>
  )[entity.entity_id];
  const name = String(entity.attributes.friendly_name ?? entity.entity_id);
  return key && name === translate('de', key) ? translate(language, key) : name;
}

export function demoSnapshot(): Snapshot {
  const state = (
    entity_id: string,
    value: string,
    attributes: EntityState['attributes'],
  ): EntityState => ({
    entity_id,
    state: value,
    attributes,
    last_updated: new Date().toISOString(),
  });
  return {
    status: 'demo',
    entities: {
      'weather.home': state('weather.home', 'partlycloudy', {
        friendly_name: 'Wien',
        temperature: 12,
        temperature_unit: '°C',
        humidity: 68,
      }),
      'light.living_room': state('light.living_room', 'on', {
        friendly_name: 'Deckenlicht',
        brightness: 166,
        color_temp_kelvin: 2700,
        supported_color_modes: ['color_temp'],
      }),
      'light.kitchen': state('light.kitchen', 'off', {
        friendly_name: 'Küchenlicht',
        brightness: 210,
        supported_color_modes: ['brightness'],
      }),
      'climate.living_room': state('climate.living_room', 'heat', {
        friendly_name: 'Wohnzimmer',
        current_temperature: 22.1,
        temperature: 22,
        min_temp: 5,
        max_temp: 30,
        target_temp_step: 0.5,
        hvac_action: 'heating',
      }),
      'media_player.living_room': state('media_player.living_room', 'playing', {
        friendly_name: 'Wohnzimmer',
        media_title: 'Weightless',
        media_artist: 'HAPanel Sessions',
        media_album_name: 'Slow Sunday',
        volume_level: 0.42,
        media_position: 84,
        media_duration: 245,
        entity_picture: './album-art.svg',
      }),
      'scene.evening': state('scene.evening', 'unknown', { friendly_name: 'Feierabend' }),
      'sensor.air_quality': state('sensor.air_quality', '420', {
        friendly_name: 'Luftqualität',
        unit_of_measurement: 'ppm',
      }),
      'sensor.temperature': state('sensor.temperature', '22.1', {
        friendly_name: 'Raumtemperatur',
        unit_of_measurement: '°C',
      }),
    },
    forecasts: {
      'weather.home': Array.from({ length: 5 }, (_, i) => ({
        datetime: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
        temperature: 12 - i,
        condition: i > 2 ? 'cloudy' : 'partlycloudy',
      })),
    },
  };
}

export function applyDemoAction(snapshot: Snapshot, document: Dashboard, action: Action): Snapshot {
  const command = resolveAction(document, action);
  const id = command.target.entity_id;
  const next = structuredClone(snapshot);
  const entity = next.entities[id];
  if (!entity) throw new UserError('error.demoEntity');
  if (command.service === 'toggle') entity.state = entity.state === 'on' ? 'off' : 'on';
  if (command.service === 'turn_on') {
    entity.state = 'on';
    if ('brightness_pct' in command.service_data)
      entity.attributes.brightness = Math.round(Number(command.service_data.brightness_pct) * 2.55);
  }
  if (command.service === 'turn_off') entity.state = 'off';
  if (command.domain === 'automation' && command.service === 'trigger')
    entity.attributes.last_triggered = new Date().toISOString();
  if (command.service === 'set_temperature')
    entity.attributes.temperature = command.service_data.temperature;
  if (
    command.service === 'open_cover' ||
    command.service === 'close_cover' ||
    command.service === 'set_cover_position'
  ) {
    entity.attributes.current_position =
      command.service === 'open_cover'
        ? 100
        : command.service === 'close_cover'
          ? 0
          : command.service_data.position;
    entity.state = entity.attributes.current_position === 0 ? 'closed' : 'open';
  }
  if (command.service === 'media_play_pause')
    entity.state = entity.state === 'playing' ? 'paused' : 'playing';
  if (command.service === 'volume_set')
    entity.attributes.volume_level = command.service_data.volume_level;
  if (command.service === 'media_next_track' || command.service === 'media_previous_track') {
    entity.attributes.media_title =
      entity.attributes.media_title === 'Weightless' ? 'Golden Hour' : 'Weightless';
    entity.attributes.media_position = 0;
  }
  if (id === 'scene.evening') {
    next.entities['light.living_room'].state = 'on';
    next.entities['light.living_room'].attributes.brightness = 90;
  }
  entity.last_updated = new Date().toISOString();
  return next;
}
