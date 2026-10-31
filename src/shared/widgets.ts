import { lightDimming } from './lights';
import type { Action, EntityState, TileKind } from './model';
import { UserError } from './i18n';
export const domainKinds: Record<string, TileKind> = {
  light: 'light',
  switch: 'light',
  climate: 'climate',
  media_player: 'media',
  weather: 'weather',
  scene: 'scene',
  script: 'scene',
  sensor: 'sensor',
  binary_sensor: 'sensor',
  cover: 'cover',
  automation: 'automation',
  alarm_control_panel: 'alarm',
  camera: 'camera',
  timer: 'timer',
  select: 'select',
  input_select: 'select',
  number: 'number',
  input_number: 'number',
  fan: 'fan',
  vacuum: 'vacuum',
  button: 'button',
  input_button: 'button',
};
export const widgetCommands: Partial<Record<TileKind, Action['command'][]>> = {
  light: ['toggle', 'turn_on', 'turn_off', 'brightness', 'color_temp', 'color'],
  climate: [
    'temperature',
    'temperature_range',
    'humidity',
    'hvac',
    'climate_fan',
    'swing',
    'preset',
  ],
  media: ['play_pause', 'previous', 'next', 'volume', 'favorite'],
  cover: ['open', 'stop', 'close', 'position', 'tilt'],
  automation: ['toggle', 'activate'],
  scene: ['activate'],
  timer: ['timer_start', 'timer_pause', 'timer_cancel'],
  select: ['select'],
  number: ['number'],
  fan: ['turn_on', 'turn_off', 'fan_speed', 'preset'],
  vacuum: ['vacuum_start', 'vacuum_pause', 'vacuum_return'],
  button: ['press'],
};
/** Match HA capability lists and feature flags before forwarding a command. */
export function validateCapability(entity: EntityState, action: Action) {
  const a = entity.attributes;
  const features = Number(a.supported_features ?? 0);
  const bit = (mask: number) => {
    if (!(features & mask)) throw new UserError('error.actionNotAllowed');
  };
  const choices: Partial<Record<Action['command'], string>> = {
    hvac: 'hvac_modes',
    climate_fan: 'fan_modes',
    swing: 'swing_modes',
    preset: 'preset_modes',
    select: 'options',
  };
  const list = choices[action.command];
  if (list && (!Array.isArray(a[list]) || !(a[list] as unknown[]).includes(action.option)))
    throw new UserError('error.actionNotAllowed');
  if (entity.entity_id.startsWith('climate.')) {
    if (action.command === 'temperature_range') {
      bit(2);
      if (
        action.value === undefined ||
        action.valueHigh === undefined ||
        action.value < Number(a.min_temp ?? 5) ||
        action.valueHigh > Number(a.max_temp ?? 35) ||
        action.value > action.valueHigh
      )
        throw new UserError('error.temperatureRange');
    }
    if (action.command === 'temperature') bit(1);
    if (action.command === 'humidity') bit(4);
  }
  if (action.command === 'number') {
    const min = Number(a.min),
      max = Number(a.max),
      step = Number(a.step ?? 1);
    if (
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      action.value === undefined ||
      action.value < min ||
      action.value > max ||
      !Number.isFinite(step) ||
      step <= 0 ||
      Math.abs((action.value - min) / step - Math.round((action.value - min) / step)) > 1e-5
    )
      throw new UserError('error.valueRange');
  }
  if (action.command === 'color_temp') {
    const modes = a.supported_color_modes;
    if (
      !Array.isArray(modes) ||
      !modes.includes('color_temp') ||
      action.value! < Number(a.min_color_temp_kelvin ?? 2000) ||
      action.value! > Number(a.max_color_temp_kelvin ?? 6500)
    )
      throw new UserError('error.actionNotAllowed');
  }
  if (
    action.command === 'color' &&
    (!Array.isArray(a.supported_color_modes) ||
      !a.supported_color_modes.some((mode) =>
        ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'].includes(String(mode)),
      ))
  )
    throw new UserError('error.actionNotAllowed');
  if (entity.entity_id.startsWith('cover.')) {
    const mask: Partial<Record<Action['command'], number>> = {
      open: 1,
      close: 2,
      position: 4,
      stop: 8,
      tilt: 128,
    };
    if (mask[action.command]) bit(mask[action.command]!);
  }
  if (action.command === 'fan_speed') bit(1);
  if (entity.entity_id.startsWith('vacuum.')) {
    const mask: Partial<Record<Action['command'], number>> = {
      vacuum_start: 8192,
      vacuum_pause: 4,
      vacuum_return: 16,
    };
    if (mask[action.command]) bit(mask[action.command]!);
  }
  if (entity.entity_id.startsWith('media_player.')) {
    const mask: Partial<Record<Action['command'], number>> = {
      volume: 4,
      previous: 16,
      next: 32,
      favorite: 512,
    };
    if (mask[action.command]) bit(mask[action.command]!);
  }
}

export function availableCommands(
  kind: TileKind,
  entity: EntityState | undefined,
  catalog: EntityState[] = [],
) {
  if (!entity) return [];
  const features = Number(entity.attributes.supported_features ?? 0),
    a = entity.attributes;
  return (widgetCommands[kind] ?? []).filter((command) => {
    const bit: Partial<Record<Action['command'], number>> =
      kind === 'cover'
        ? { open: 1, close: 2, position: 4, stop: 8, tilt: 128 }
        : kind === 'vacuum'
          ? { vacuum_start: 8192, vacuum_pause: 4, vacuum_return: 16 }
          : kind === 'media'
            ? { previous: 16, next: 32, volume: 4, favorite: 512 }
            : kind === 'climate'
              ? { temperature: 1, temperature_range: 2, humidity: 4 }
              : kind === 'fan'
                ? { fan_speed: 1 }
                : {};
    if (bit[command] && !(features & bit[command]!)) return false;
    if (command === 'brightness')
      return (
        entity.lightCapabilities?.dimmable ??
        lightDimming(entity.entity_id, (id) => catalog.find((e) => e.entity_id === id)).dimmable
      );
    if (command === 'color_temp')
      return (
        Array.isArray(a.supported_color_modes) && a.supported_color_modes.includes('color_temp')
      );
    const lists: Partial<Record<Action['command'], string>> = {
      hvac: 'hvac_modes',
      climate_fan: 'fan_modes',
      swing: 'swing_modes',
      preset: 'preset_modes',
      select: 'options',
    };
    const list = lists[command];
    return !list || (Array.isArray(a[list]) && a[list].length > 0);
  });
}
