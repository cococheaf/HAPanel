import type { EntityState, Snapshot, Tile } from './model';
import type { MessageKey } from './i18n';

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
