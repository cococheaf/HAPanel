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
  if (!entity) throw new Error('Demo-Entität nicht vorhanden.');
  if (command.service === 'toggle') entity.state = entity.state === 'on' ? 'off' : 'on';
  if (command.service === 'turn_on') {
    entity.state = 'on';
    if ('brightness_pct' in command.service_data)
      entity.attributes.brightness = Math.round(Number(command.service_data.brightness_pct) * 2.55);
  }
  if (command.service === 'turn_off') entity.state = 'off';
  if (command.service === 'set_temperature')
    entity.attributes.temperature = command.service_data.temperature;
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
