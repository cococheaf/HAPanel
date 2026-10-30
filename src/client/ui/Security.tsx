import {
  ArrowUpRight,
  DoorOpen,
  ShieldCheck,
  ShieldOff,
  ShieldAlert,
  CircleHelp,
} from 'lucide-react';
import type { Snapshot, Tile } from '../../shared/model';
import { alarmStatus, contactValues } from '../../shared/security';
import { useI18n } from '../i18n';
import { useState } from 'react';

export function ContactsSummary({ tile, snapshot }: { tile: Tile; snapshot: Snapshot }) {
  const { t } = useI18n();
  const values = contactValues(tile.contacts ?? [], snapshot);
  return (
    <div className={'contacts-summary' + (values.open.length ? ' has-open' : '')}>
      <div className="contacts-number">
        <strong>{values.open.length}</strong>
        <DoorOpen size={36} strokeWidth={1.4} />
      </div>
      <span>
        {t(values.open.length ? 'contacts.openCount' : 'contacts.noneReported', {
          count: values.open.length,
        })}
      </span>
      {values.open.length > 0 && (
        <p className="contacts-names">
          {values.open
            .slice(0, 3)
            .map((item) => item.label)
            .join(' · ')}
          {values.open.length > 3 ? ' …' : ''}
        </p>
      )}
      <small>
        {t('contacts.closedCount', { count: values.closed.length })}
        {values.unknown.length > 0 && (
          <>
            {' '}
            ·{' '}
            <span className="contacts-unknown">
              {t('contacts.unknownCount', { count: values.unknown.length })}
            </span>
          </>
        )}
      </small>
    </div>
  );
}

export function ContactList({ tile, snapshot }: { tile: Tile; snapshot: Snapshot }) {
  const { t } = useI18n();
  const values = contactValues(tile.contacts ?? [], snapshot);
  const [filter, setFilter] = useState<'all' | 'open' | 'unknown'>('all');
  const items =
    filter === 'all' ? [...values.open, ...values.unknown, ...values.closed] : values[filter];
  return (
    <>
      <ContactsSummary tile={tile} snapshot={snapshot} />
      <div className="contact-filters" role="group" aria-label={t('contacts.filter')}>
        {(['all', 'open', 'unknown'] as const).map((key) => (
          <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {t(('contacts.filter.' + key) as 'contacts.filter.all')}{' '}
            <span>{key === 'all' ? tile.contacts?.length : values[key].length}</span>
          </button>
        ))}
      </div>
      <div className="contact-list">
        {items.length === 0 && <p className="insight-muted">{t('contacts.emptyFilter')}</p>}
        {items.map((item) => (
          <div className={'contact-row is-' + item.state} key={item.entityId}>
            {item.state === 'unknown' ? <CircleHelp size={19} /> : <DoorOpen size={19} />}
            <span>{item.label}</span>
            <strong>
              {t(
                item.state === 'open'
                  ? 'cover.openState'
                  : item.state === 'closed'
                    ? 'cover.closed'
                    : 'common.unavailable',
              )}
            </strong>
          </div>
        ))}
      </div>
    </>
  );
}

export function AlarmStatus({
  tile,
  snapshot,
  onChoose,
}: {
  tile: Tile;
  snapshot: Snapshot;
  onChoose?: () => void;
}) {
  const { t } = useI18n();
  const status = alarmStatus(snapshot.entities[tile.entityId]);
  const Icon =
    status.tone === 'alert' || status.tone === 'pending'
      ? ShieldAlert
      : status.tone === 'armed'
        ? ShieldCheck
        : ShieldOff;
  return (
    <div className={'alarm-status is-' + status.tone}>
      <Icon size={40} strokeWidth={1.4} />
      <strong>{t(status.label)}</strong>
      {onChoose ? (
        <button type="button" className="alarm-open" onClick={onChoose}>
          {t('alarm.selectMode')}
          <ArrowUpRight size={15} />
        </button>
      ) : (
        <span className="tile-caption">
          {t(tile.alarm?.modes.length ? 'alarm.configuredModes' : 'alarm.noModes', {
            count: tile.alarm?.modes.length ?? 0,
          })}
        </span>
      )}
    </div>
  );
}
