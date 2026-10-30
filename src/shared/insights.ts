import type { Energy, EntityState, Room, Snapshot } from './model';

export function numericState(entity?: EntityState): number | undefined {
  if (!entity || !entity.state.trim() || ['unknown', 'unavailable'].includes(entity.state)) return;
  const value = Number(entity.state);
  return Number.isFinite(value) ? value : undefined;
}

export function measured(
  entity: EntityState | undefined,
  dimension: 'power' | 'energy' | 'percent',
) {
  const value = numericState(entity);
  if (value === undefined) return;
  const unit = entity?.attributes.unit_of_measurement;
  if (dimension === 'power') return unit === 'kW' ? value * 1000 : unit === 'W' ? value : undefined;
  if (dimension === 'energy')
    return unit === 'Wh' ? value / 1000 : unit === 'kWh' ? value : undefined;
  return unit === '%' && value >= 0 && value <= 100 ? value : undefined;
}

export function energyValues(config: Energy, snapshot: Snapshot) {
  const power = (id?: string) => (id ? measured(snapshot.entities[id], 'power') : undefined);
  const sum = (ids: string[]) => {
    const values = ids.map(power);
    return values.length > 0 && values.every((value) => value !== undefined)
      ? values.reduce<number>((total, value) => total + value!, 0)
      : undefined;
  };
  const incoming = power(config.gridImport);
  const outgoing = power(config.gridExport);
  const battery = power(config.batteryPower);
  return {
    solar: sum(config.solarPower),
    incoming,
    outgoing,
    net: incoming !== undefined && outgoing !== undefined ? incoming - outgoing : undefined,
    battery:
      battery === undefined ? undefined : battery * (config.batteryPositive === 'charge' ? 1 : -1),
    level: config.batteryLevel
      ? measured(snapshot.entities[config.batteryLevel], 'percent')
      : undefined,
    consumers: config.consumers.map((item) => ({ ...item, power: power(item.entityId) })),
    monitored: sum(config.consumers.map((item) => item.entityId)),
  };
}

export function roomValues(room: Room, snapshot: Snapshot) {
  const temperatureEntity = room.temperature ? snapshot.entities[room.temperature] : undefined;
  const current = temperatureEntity?.attributes.current_temperature;
  const temperature =
    typeof current === 'number' && Number.isFinite(current)
      ? current
      : temperatureEntity?.attributes.unit_of_measurement === '°C'
        ? numericState(temperatureEntity)
        : undefined;
  const humidity = room.humidity
    ? measured(snapshot.entities[room.humidity], 'percent')
    : undefined;
  const lights = room.controls.filter((control) => control.kind === 'light');
  const usableLights = lights.filter((control) => {
    const entity = snapshot.entities[control.entityId];
    return entity && !['unavailable', 'unknown'].includes(entity.state);
  });
  return {
    temperature,
    humidity,
    lights: lights.length,
    lightsAvailable: usableLights.length,
    lightsOn: usableLights.filter((control) => snapshot.entities[control.entityId].state === 'on')
      .length,
    present: room.presence.some((id) => snapshot.entities[id]?.state === 'on'),
    windowsOpen: room.windows.filter((id) => snapshot.entities[id]?.state === 'on').length,
    windowsAvailable: room.windows.filter((id) =>
      ['on', 'off'].includes(snapshot.entities[id]?.state),
    ).length,
  };
}
