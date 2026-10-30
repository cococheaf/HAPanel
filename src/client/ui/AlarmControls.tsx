import { useEffect, useRef, useState } from 'react';
import {
  Home,
  Plane,
  Moon,
  Palmtree,
  ShieldCheck,
  ShieldOff,
  LoaderCircle,
  Check,
} from 'lucide-react';
import type { Action, AlarmMode, Snapshot, Tile } from '../../shared/model';
import {
  alarmCodeRequired,
  alarmModeLabel,
  alarmStatus,
  configuredContacts,
  contactValues,
  supportsAlarmMode,
} from '../../shared/security';
import { useI18n } from '../i18n';

const icons = {
  disarmed: ShieldOff,
  armed_home: Home,
  armed_away: Plane,
  armed_night: Moon,
  armed_vacation: Palmtree,
  armed_custom_bypass: ShieldCheck,
};
export function AlarmControls({
  tile,
  snapshot,
  onAction,
}: {
  tile: Tile;
  snapshot: Snapshot;
  onAction?: (action: Action) => void | Promise<void>;
}) {
  const { t, describeError } = useI18n();
  const entity = snapshot.entities[tile.entityId];
  const modes = tile.alarm?.modes ?? [];
  const [selected, setSelected] = useState<AlarmMode>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false),
    [sent, setSent] = useState<AlarmMode>();
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const canControl = snapshot.alarmControl ?? snapshot.status === 'demo';
  const connected = snapshot.status !== 'reconnecting';
  const contacts = contactValues(configuredContacts(snapshot), snapshot);
  const status = alarmStatus(entity);
  const required = selected ? alarmCodeRequired(entity, selected) : false;
  useEffect(() => {
    setSelected(undefined);
    setCode('');
    setError('');
    setSent(undefined);
  }, [tile.entityId]);
  useEffect(() => {
    if (sent && entity?.state === sent) setSent(undefined);
  }, [sent, entity?.state]);
  useEffect(() => {
    if (selected && !modes.includes(selected)) {
      setSelected(undefined);
      setCode('');
    }
  }, [selected, modes]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !selected ||
      !onAction ||
      !canControl ||
      !connected ||
      inFlight.current ||
      !supportsAlarmMode(entity, selected) ||
      (required && !code)
    )
      return;
    const mode = selected;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setCode('');
    try {
      await onAction({ tileId: tile.id, command: 'alarm', mode, ...(code ? { code } : {}) });
      setSent(mode);
      setSelected(undefined);
    } catch (reason) {
      setError(describeError(reason));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <div className={'alarm-controls is-' + status.tone}>
      <div className="alarm-current">
        {entity?.state === 'disarmed' ? <ShieldOff size={30} /> : <ShieldCheck size={30} />}
        <div>
          <span>{t('alarm.currentState')}</span>
          <strong aria-live="polite">{t(status.label)}</strong>
        </div>
      </div>
      {!canControl && (
        <p className="insight-muted" role="status">
          {t('error.alarmAdminRequired')}
        </p>
      )}
      {!onAction && <p className="insight-muted">{t('alarm.previewOnly')}</p>}
      {!modes.length && <p className="insight-muted">{t('alarm.noModes')}</p>}
      <div className="alarm-mode-grid" role="group" aria-label={t('alarm.selectMode')}>
        {modes.map((mode) => {
          const Icon = icons[mode],
            supported = supportsAlarmMode(entity, mode);
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={entity?.state === mode}
              disabled={
                !onAction ||
                !canControl ||
                !connected ||
                !supported ||
                busy ||
                entity?.state === mode
              }
              onClick={() => {
                setSelected(mode);
                setCode('');
                setError('');
                setSent(undefined);
              }}
            >
              <Icon size={23} />
              <span>{t(alarmModeLabel(mode))}</span>
              {entity?.state === mode && <Check size={16} />}{' '}
              {!supported && <small>{t('alarm.unsupported')}</small>}
            </button>
          );
        })}
      </div>
      {sent && (
        <p className="alarm-feedback" role="status">
          {t('alarm.requestSent', { mode: t(alarmModeLabel(sent)) })}
        </p>
      )}
      {selected && (
        <form className="alarm-confirm" onSubmit={submit}>
          <h3>{t('alarm.confirmTitle', { mode: t(alarmModeLabel(selected)) })}</h3>
          {selected !== 'disarmed' && (contacts.open.length > 0 || contacts.unknown.length > 0) && (
            <div className="alarm-contact-warning" role="status">
              <strong>
                {t('alarm.contactHint', {
                  open: contacts.open.length,
                  unknown: contacts.unknown.length,
                })}
              </strong>
              {contacts.open.length > 0 && (
                <span>{contacts.open.map((item) => item.label).join(' · ')}</span>
              )}
            </div>
          )}
          {required && (
            <label>
              {t('alarm.code')}
              <input
                aria-label={t('alarm.code')}
                type="password"
                inputMode={entity?.attributes.code_format === 'number' ? 'numeric' : 'text'}
                autoComplete="off"
                maxLength={64}
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={busy}
              />
            </label>
          )}
          <p className="insight-muted">{t('alarm.confirmHint')}</p>
          <div className="alarm-confirm-actions">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => {
                setSelected(undefined);
                setCode('');
                setError('');
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={!onAction || !canControl || !connected || busy || (required && !code)}
            >
              {busy ? <LoaderCircle className="spin" size={17} /> : null}
              {t('alarm.confirmAction')}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="alarm-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
