import type { AlarmMode, Dashboard, EntityState, Snapshot, Tile } from './model';
import type { MessageKey } from './i18n';
import { UserError } from './i18n';

export const alarmFeatures: Record<AlarmMode, number> = {
  disarmed: 0,
  armed_home: 1,
  armed_away: 2,
  armed_night: 4,
  armed_vacation: 32,
  armed_custom_bypass: 16,
};
export function supportsAlarmMode(entity: EntityState | undefined, mode: AlarmMode) {
  return Boolean(
    entity &&
    !['unknown', 'unavailable'].includes(entity.state) &&
    (mode === 'disarmed' || Number(entity.attributes.supported_features) & alarmFeatures[mode]),
  );
}
export function alarmCodeRequired(entity: EntityState | undefined, mode: AlarmMode) {
  return (
    ['number', 'text'].includes(String(entity?.attributes.code_format)) &&
    (mode === 'disarmed' || entity?.attributes.code_arm_required !== false)
  );
}
export function validateAlarmCommand(
  entity: EntityState | undefined,
  mode: AlarmMode,
  code?: string,
) {
  if (!supportsAlarmMode(entity, mode)) throw new UserError('error.alarmUnsupported');
  if (alarmCodeRequired(entity, mode) && !code) throw new UserError('error.alarmCodeRequired');
  if (code && entity?.attributes.code_format === 'number' && !/^\d+$/.test(code))
    throw new UserError('error.alarmCodeFormat');
}

export function alarmModeLabel(mode: AlarmMode): MessageKey {
  return alarmKeys[mode];
}

export function configuredContacts(snapshot: Snapshot) {
  if (snapshot.contactSources) return snapshot.contactSources;
  return Object.values(snapshot.entities)
    .filter(
      (entity) =>
        entity.entity_id.startsWith('binary_sensor.') &&
        ['door', 'window', 'opening'].includes(String(entity.attributes.device_class)),
    )
    .map((entity) => ({
      entityId: entity.entity_id,
      label: String(entity.attributes.friendly_name ?? entity.entity_id),
    }));
}

export function documentContacts(document: Dashboard, snapshot: Snapshot) {
  const contacts = new Map<string, { entityId: string; label: string }>();
  for (const tile of document.pages.flatMap((page) => page.tiles)) {
    for (const contact of [
      ...(tile.contacts ?? []),
      ...(tile.room?.windows ?? []).map((entityId) => ({
        entityId,
        label: String(snapshot.entities[entityId]?.attributes.friendly_name ?? entityId),
      })),
    ])
      if (!contacts.has(contact.entityId)) contacts.set(contact.entityId, contact);
  }
  return [...contacts.values()];
}

export function contactValues(contacts: NonNullable<Tile['contacts']>, snapshot: Snapshot) {
  const items = contacts.map((contact) => {
    const value = snapshot.entities[contact.entityId]?.state;
    const state = value === 'on' ? 'open' : value === 'off' ? 'closed' : 'unknown';
    return { ...contact, state };
  });
  return {
    open: items.filter((item) => item.state === 'open'),
    closed: items.filter((item) => item.state === 'closed'),
    unknown: items.filter((item) => item.state === 'unknown'),
  };
}

const alarmKeys: Record<string, MessageKey> = {
  disarmed: 'alarm.disarmed',
  armed_home: 'alarm.armedHome',
  armed_away: 'alarm.armedAway',
  armed_night: 'alarm.armedNight',
  armed_vacation: 'alarm.armedVacation',
  armed_custom_bypass: 'alarm.armedBypass',
  arming: 'alarm.arming',
  disarming: 'alarm.disarming',
  pending: 'alarm.pending',
  triggered: 'alarm.triggered',
};
export function alarmStatus(entity?: EntityState) {
  const state = entity?.state ?? 'unknown';
  return {
    label: Object.hasOwn(alarmKeys, state)
      ? alarmKeys[state]
      : ('common.unavailable' as MessageKey),
    tone:
      state === 'triggered'
        ? 'alert'
        : ['pending', 'arming', 'disarming'].includes(state)
          ? 'pending'
          : state.startsWith('armed_')
            ? 'armed'
            : state === 'disarmed'
              ? 'off'
              : 'unknown',
  };
}
