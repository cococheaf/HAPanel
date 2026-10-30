import type { Action, Control, EntityState } from './model';

const brightnessModes = new Set([
  'brightness',
  'color_temp',
  'hs',
  'xy',
  'rgb',
  'rgbw',
  'rgbww',
  'white',
]);
type Capability = NonNullable<EntityState['lightCapabilities']>;

/** Group capabilities are a union in HA. HAPanel requires every member to support dimming. */
export function lightDimming(
  entityId: string,
  entities: Record<string, EntityState> | ((id: string) => EntityState | undefined),
): Capability {
  const lookup = typeof entities === 'function' ? entities : (id: string) => entities[id];
  const visit = (id: string, path: Set<string>): Capability => {
    if (path.has(id) || path.size >= 16) return { dimmable: false, reason: 'unknown' };
    const entity = lookup(id);
    if (!id.startsWith('light.')) return { dimmable: false, reason: 'onoff' };
    if (!entity) return { dimmable: false, reason: 'unknown' };
    if (entity.lightCapabilities) return entity.lightCapabilities;
    const members = entity.attributes.entity_id;
    if (members !== undefined) {
      if (!Array.isArray(members) || !members.length || members.length > 256)
        return { dimmable: false, reason: 'unknown' };
      const next = new Set([...path, id]);
      const capabilities = members.map((member) =>
        typeof member === 'string'
          ? visit(member, next)
          : { dimmable: false, reason: 'unknown' as const },
      );
      if (capabilities.some((item) => !item.dimmable))
        return {
          dimmable: false,
          reason: capabilities.some((item) => item.reason === 'unknown') ? 'unknown' : 'mixed',
        };
    }
    const modes = entity.attributes.supported_color_modes;
    if (!Array.isArray(modes) || !modes.length) return { dimmable: false, reason: 'unknown' };
    return modes.every((mode) => brightnessModes.has(mode))
      ? { dimmable: true, reason: 'dimmable' }
      : { dimmable: false, reason: 'onoff' };
  };
  return visit(entityId, new Set());
}

export function lightTapCommand(control: Pick<Control, 'light'>): Action['command'] | undefined {
  const on = control.light?.allowTurnOn ?? true;
  const off = control.light?.allowTurnOff ?? true;
  return on && off ? 'toggle' : on ? 'turn_on' : off ? 'turn_off' : undefined;
}
