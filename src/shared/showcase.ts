import { createGlassOverview } from './glass-layout';
import { demoDocument, demoSnapshot } from './demo';
import {
  dashboardSchema,
  roomSchema,
  energySchema,
  type Control,
  type Dashboard,
  type Snapshot,
  type Tile,
  type TileKind,
} from './model';

const grid = (index: number): Tile['layouts'] => ({
  ipad: { x: (index % 3) * 4, y: Math.floor(index / 3) * 2, w: 4, h: 2 },
  compact: { x: (index % 3) * 4, y: Math.floor(index / 3) * 2, w: 4, h: 2 },
  portrait: { x: (index % 2) * 4, y: Math.floor(index / 2) * 2, w: 4, h: 2 },
});
const control = (
  prefix: string,
  index: number,
  kind: TileKind,
  title: string,
  entityId: string,
): Control => ({
  id: prefix + '_c' + index,
  kind,
  title,
  entityId,
  accent: kind === 'light' ? 'amber' : kind === 'climate' ? 'rose' : 'mint',
});
const room = (
  id: string,
  title: string,
  index: number,
  icon: 'sofa' | 'kitchen' | 'bed' | 'bath' | 'door' | 'hall',
  light: string,
  extra: Control[] = [],
): Tile => ({
  id,
  kind: 'sensor',
  title,
  entityId: 'sensor.' + id + '_temperature',
  accent: 'mint',
  layouts: grid(index),
  room: roomSchema.parse({
    icon,
    temperature: 'sensor.' + id + '_temperature',
    humidity: 'sensor.' + id + '_humidity',
    controls: [control(id, 0, 'light', 'Licht', light), ...extra],
  }),
});
const eg: Tile[] = [
  room('demo_living', 'Wohnzimmer', 0, 'sofa', 'light.living_room', [
    control('demo_living', 1, 'climate', 'Heizung', 'climate.living_room'),
    control('demo_living', 2, 'media', 'Musik', 'media_player.living_room'),
  ]),
  room('demo_kitchen', 'Küche', 1, 'kitchen', 'light.kitchen'),
  room('demo_dining', 'Essbereich', 2, 'sofa', 'light.demo_dining'),
  room('demo_entry', 'Eingang', 3, 'door', 'light.demo_entry'),
];
const og: Tile[] = [
  room('demo_bedroom', 'Schlafzimmer', 0, 'bed', 'light.demo_bedroom', [
    control('demo_bedroom', 1, 'cover', 'Beschattung', 'cover.demo_bedroom'),
  ]),
  room('demo_study', 'Arbeitszimmer', 1, 'sofa', 'light.demo_study'),
  room('demo_bath', 'Bad', 2, 'bath', 'light.demo_bath'),
  room('demo_guest', 'Gästezimmer', 3, 'bed', 'light.demo_guest'),
];
const energy = energySchema.parse({
  solarPower: ['sensor.demo_solar'],
  gridImport: 'sensor.demo_grid_import',
  gridExport: 'sensor.demo_grid_export',
  batteryPower: 'sensor.demo_battery_power',
  batteryLevel: 'sensor.demo_battery_level',
  consumers: [
    { label: 'Küche', entityId: 'sensor.demo_kitchen_power' },
    { label: 'Arbeitszimmer', entityId: 'sensor.demo_study_power' },
    { label: 'Medien', entityId: 'sensor.demo_media_power' },
  ],
  metrics: [
    { label: 'Solarertrag heute', entityId: 'sensor.demo_solar_today' },
    { label: 'Netzbezug heute', entityId: 'sensor.demo_grid_today' },
    { label: 'Einspeisung heute', entityId: 'sensor.demo_export_today' },
  ],
});
const homeEnergy: Tile = {
  id: 'demo_energy_home',
  kind: 'sensor',
  title: 'Energie',
  entityId: 'sensor.demo_solar',
  accent: 'mint',
  energy,
  navigateTo: 'energy',
  layouts: {
    ipad: { x: 8, y: 2, w: 4, h: 4 },
    compact: { x: 8, y: 2, w: 4, h: 4 },
    portrait: { x: 0, y: 8, w: 8, h: 2 },
  },
};
const floor = (id: string, title: string, pageId: string, index: number, tiles: Tile[]): Tile => ({
  id,
  kind: 'sensor',
  title,
  entityId: pageId === 'eg' ? 'sensor.demo_ground_temperature' : 'sensor.demo_upper_temperature',
  accent: 'mint',
  navigateTo: pageId,
  layouts: {
    ...grid(index),
    portrait: { x: (index - 1) * 4, y: 2, w: 4, h: 2 },
  },
  room: roomSchema.parse({
    icon: 'home',
    temperature:
      pageId === 'eg' ? 'sensor.demo_ground_temperature' : 'sensor.demo_upper_temperature',
    controls: tiles
      .flatMap((tile) => tile.room!.controls.filter((item) => item.kind === 'light'))
      .map((item, n) => ({ ...item, id: id + '_c' + n })),
  }),
});
const base = structuredClone(demoDocument);
const weather = {
  ...base.pages[0].tiles[0],
  layouts: { ...grid(0), portrait: { x: 0, y: 0, w: 8, h: 2 } },
};
const homeControls: Tile[] = [
  {
    id: 'demo_general',
    kind: 'light',
    title: 'General Licht',
    entityId: 'light.demo_general',
    accent: 'amber',
    layouts: {
      ipad: { x: 0, y: 2, w: 4, h: 2 },
      compact: { x: 0, y: 2, w: 4, h: 2 },
      portrait: { x: 0, y: 4, w: 4, h: 2 },
    },
  },
  {
    id: 'demo_summer',
    kind: 'automation',
    title: 'Beschattung Sommer',
    entityId: 'automation.demo_summer',
    accent: 'mint',
    layouts: {
      ipad: { x: 4, y: 2, w: 4, h: 2 },
      compact: { x: 4, y: 2, w: 4, h: 2 },
      portrait: { x: 4, y: 4, w: 4, h: 2 },
    },
  },
  {
    id: 'demo_alarm',
    kind: 'alarm',
    title: 'Alarmpanel',
    entityId: 'alarm_control_panel.demo_home',
    alarm: {
      modes: [
        'disarmed',
        'armed_home',
        'armed_away',
        'armed_night',
        'armed_vacation',
        'armed_custom_bypass',
      ],
    },
    accent: 'mint',
    layouts: {
      ipad: { x: 0, y: 4, w: 4, h: 2 },
      compact: { x: 0, y: 4, w: 4, h: 2 },
      portrait: { x: 0, y: 6, w: 4, h: 2 },
    },
  },
  {
    id: 'demo_contacts',
    kind: 'contacts',
    title: 'Türen & Fenster',
    entityId: 'binary_sensor.demo_terrace',
    accent: 'amber',
    layouts: {
      ipad: { x: 4, y: 4, w: 4, h: 2 },
      compact: { x: 4, y: 4, w: 4, h: 2 },
      portrait: { x: 4, y: 6, w: 4, h: 2 },
    },
    contacts: [
      { entityId: 'binary_sensor.demo_terrace', label: 'Terrassentür' },
      { entityId: 'binary_sensor.demo_kitchen_window', label: 'Küchenfenster' },
      { entityId: 'binary_sensor.demo_bedroom_window', label: 'Schlafzimmerfenster' },
      { entityId: 'binary_sensor.demo_bath_window', label: 'Badfenster' },
    ],
  },
];
export const showcaseDocument: Dashboard = dashboardSchema.parse({
  ...base,
  profiles: base.profiles.map((profile) => ({
    ...profile,
    columns: profile.id === 'portrait' ? 8 : 12,
    rows: profile.id === 'portrait' ? 10 : 6,
  })),
  pages: [
    {
      id: 'overview',
      name: 'Zuhause',
      tiles: [
        weather,
        floor('demo_home_eg', 'Erdgeschoss', 'eg', 1, eg),
        floor('demo_home_og', 'Obergeschoss', 'og', 2, og),
        ...homeControls,
        homeEnergy,
      ],
    },
    {
      id: 'eg',
      name: 'EG',
      heading: 'Zusammen zuhause.',
      subtitle: 'Erdgeschoss · Wohnen, kochen und ankommen.',
      tiles: eg,
    },
    {
      id: 'og',
      name: 'OG',
      heading: 'Deine Rückzugsorte.',
      subtitle: 'Obergeschoss · Ruhe, Raum und Wohlbefinden.',
      tiles: og,
    },
    {
      id: 'surveillance',
      name: 'Überwachung',
      heading: 'Zuhause im Blick.',
      subtitle: 'Kameras · Live-Ansichten bei Bedarf.',
      tiles: ['entrance', 'garden'].map((name, index) => ({
        id: 'sample_camera_' + name,
        kind: 'camera',
        title: index === 0 ? 'Eingang' : 'Garten',
        entityId: 'camera.sample_' + name,
        accent: 'mint',
        camera: { refreshSeconds: 30, fit: 'cover' },
        layouts: {
          ipad: { x: index * 6, y: 0, w: 6, h: 4 },
          compact: { x: index * 6, y: 0, w: 6, h: 4 },
          portrait: { x: 0, y: index * 4, w: 8, h: 4 },
        },
      })),
    },
    {
      id: 'energy',
      name: 'Energie',
      heading: 'Dein Energiecockpit.',
      subtitle: 'Erzeugung, Netz und Speicher auf einen Blick.',
      tiles: [
        {
          ...homeEnergy,
          id: 'demo_energy',
          navigateTo: undefined,
          layouts: {
            ipad: { x: 0, y: 0, w: 12, h: 6 },
            compact: { x: 0, y: 0, w: 12, h: 6 },
            portrait: { x: 0, y: 0, w: 8, h: 10 },
          },
        },
      ],
    },
  ],
});

// Upgrade only untouched 0.2 sample layouts; personalised browser layouts stay intact.
export const legacyShowcaseDocument: Dashboard = dashboardSchema.parse({
  ...showcaseDocument,
  pages: showcaseDocument.pages
    .filter((page) => page.id !== 'surveillance')
    .map((page, index) =>
      index !== 0
        ? page
        : {
            ...page,
            tiles: [
              weather,
              ...page.tiles.filter((tile) => ['demo_home_eg', 'demo_home_og'].includes(tile.id)),
              {
                ...base.pages[0].tiles[3],
                layouts: {
                  ipad: { x: 0, y: 2, w: 8, h: 4 },
                  compact: { x: 0, y: 2, w: 8, h: 4 },
                  portrait: { x: 0, y: 4, w: 8, h: 3 },
                },
              },
              {
                ...homeEnergy,
                layouts: { ...homeEnergy.layouts, portrait: { x: 0, y: 7, w: 8, h: 3 } },
              },
            ],
          },
    ),
});

export const legacyV1ShowcaseDocument: Dashboard = dashboardSchema.parse({
  ...showcaseDocument,
  pages: showcaseDocument.pages
    .filter((page) => page.id !== 'surveillance')
    .map((page) => ({
      ...page,
      tiles: page.tiles.map((tile) =>
        tile.id === 'demo_alarm' ? { ...tile, alarm: undefined } : tile,
      ),
    })),
});

// Additional browser widgets, kept out of the immutable legacy fixtures above.
showcaseDocument.pages.push({
  id: 'features',
  name: 'Geräte',
  tiles: (['timer', 'select', 'number', 'fan', 'vacuum', 'button'] as const).map((kind, index) => ({
    id: 'feature_' + kind,
    kind,
    entityId:
      (kind === 'select' ? 'input_select' : kind === 'number' ? 'input_number' : kind) + '.example',
    title: ['Timer', 'Auswahl', 'Zahlenregler', 'Ventilator', 'Staubsauger', 'Taste'][index],
    accent: kind === 'fan' ? 'blue' : 'mint',
    layouts: grid(index),
  })),
});
for (const profile of showcaseDocument.profiles)
  profile.experience = {
    density: 'normal',
    colorMode: 'dark',
    background: 'gradient',
    swipe: true,
  };
dashboardSchema.parse(showcaseDocument);

export function showcaseSnapshot(): Snapshot {
  const snapshot = demoSnapshot();
  const add = (
    id: string,
    value: number | string,
    unit?: string,
    extra: Record<string, unknown> = {},
  ) => {
    snapshot.entities[id] = {
      entity_id: id,
      state: String(value),
      attributes: {
        friendly_name: id.split('.')[1].replaceAll('_', ' '),
        ...(unit ? { unit_of_measurement: unit } : {}),
        ...extra,
      },
      last_updated: new Date().toISOString(),
    };
  };
  for (const name of ['entrance', 'garden'])
    add('camera.sample_' + name, 'idle', undefined, { supported_features: 2 });
  add('light.demo_general', 'on', undefined, {
    friendly_name: 'General Licht',
    entity_id: ['light.living_room', 'light.kitchen'],
    supported_color_modes: ['onoff'],
  });
  add('automation.demo_summer', 'on', undefined, { friendly_name: 'Beschattung Sommer' });
  add('alarm_control_panel.demo_home', 'disarmed', undefined, {
    friendly_name: 'Alarmpanel',
    supported_features: 63,
    code_format: null,
    code_arm_required: false,
  });
  for (const [id, state] of [
    ['demo_terrace', 'off'],
    ['demo_kitchen_window', 'on'],
    ['demo_bedroom_window', 'off'],
    ['demo_bath_window', 'unavailable'],
  ])
    add('binary_sensor.' + id, state, undefined, {
      device_class: id === 'demo_terrace' ? 'door' : 'window',
    });
  for (const [index, tile] of [...eg, ...og].entries()) {
    add(tile.entityId, tile.id === 'demo_living' ? 22.1 : 20.5 + index * 0.3, '°C', {
      device_class: 'temperature',
    });
    add(tile.room!.humidity!, 44 + index * 2, '%', { device_class: 'humidity' });
    for (const item of tile.room!.controls) {
      if (snapshot.entities[item.entityId]) continue;
      if (item.kind === 'light')
        add(item.entityId, index % 3 === 0 ? 'on' : 'off', undefined, {
          friendly_name: item.title,
          brightness: 175,
          supported_color_modes: ['brightness'],
        });
      if (item.kind === 'cover')
        add(item.entityId, 'open', undefined, {
          friendly_name: item.title,
          current_position: 55,
          supported_features: 15,
        });
    }
  }
  add('sensor.demo_ground_temperature', 21.4, '°C');
  add('sensor.demo_upper_temperature', 22.1, '°C');
  add('sensor.demo_solar', 3400, 'W', { friendly_name: 'Solar' });
  add('sensor.demo_grid_import', 0, 'W', { friendly_name: 'Netzbezug' });
  add('sensor.demo_grid_export', 480, 'W', { friendly_name: 'Einspeisung' });
  add('sensor.demo_battery_power', 1200, 'W', { friendly_name: 'Batterieleistung' });
  add('sensor.demo_battery_level', 72, '%', { friendly_name: 'Batteriestand' });
  add('sensor.demo_kitchen_power', 760, 'W');
  add('sensor.demo_study_power', 135, 'W');
  add('sensor.demo_media_power', 70, 'W');
  add('sensor.demo_solar_today', 12.6, 'kWh');
  add('sensor.demo_grid_today', 3.1, 'kWh');
  add('sensor.demo_export_today', 4.8, 'kWh');
  snapshot.entities['weather.home'].attributes = {
    ...snapshot.entities['weather.home'].attributes,
    humidity: 68,
    pressure: 1018,
    pressure_unit: 'hPa',
    wind_speed: 11,
    wind_speed_unit: 'km/h',
  };
  snapshot.forecasts['weather.home'] = Array.from({ length: 24 }, (_, index) => ({
    datetime: new Date(Date.now() + (index + 1) * 3600_000).toISOString(),
    temperature: Math.round(11 + 3 * Math.sin(index / 4)),
    condition: index < 3 ? 'partlycloudy' : 'cloudy',
  }));
  add('timer.example', 'idle', undefined, {
    friendly_name: 'Timer',
    duration: '00:05:00',
    remaining: '00:05:00',
  });
  add('input_select.example', 'Eco', undefined, {
    friendly_name: 'Auswahl',
    options: ['Eco', 'Comfort'],
  });
  add('input_number.example', 50, '%', {
    friendly_name: 'Zahlenregler',
    min: 0,
    max: 100,
    step: 5,
  });
  add('fan.example', 'on', undefined, {
    friendly_name: 'Ventilator',
    supported_features: 1,
    percentage: 50,
    percentage_step: 10,
  });
  add('vacuum.example', 'docked', undefined, {
    friendly_name: 'Staubsauger',
    supported_features: 8212,
    battery_level: 85,
  });
  add('button.example', 'unknown', undefined, { friendly_name: 'Taste' });
  for (const entity of Object.values(snapshot.entities))
    entity.area = {
      id: entity.entity_id.includes('bedroom') ? 'bedroom' : 'living',
      name: entity.entity_id.includes('bedroom') ? 'Schlafzimmer' : 'Wohnzimmer',
      floor: entity.entity_id.includes('bedroom') ? 'OG' : 'EG',
    };
  return snapshot;
}

/** Fresh browser previews use the same editable Glass templates as real installations. */
export const glassShowcaseDocument: Dashboard = (() => {
  let document = structuredClone(showcaseDocument);
  for (const profile of document.profiles)
    document = createGlassOverview(document, profile.id, 'de').document;
  return document;
})();
