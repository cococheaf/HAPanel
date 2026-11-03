import packageInfo from '../../../package.json';
import { I18nProvider, useI18n, LanguageSwitcher } from '../i18n';
import { StrictMode, useCallback, useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { X } from 'lucide-react';
import { api, liveStream } from '../service';
import type { Action, Revision, Snapshot } from '../../shared/model';
import Player from './Player';
import '../styles.css';

function Display() {
  const { t, describeError } = useI18n();

  const [data, setData] = useState<{
    published: Revision;
    snapshot: Snapshot;
    canEdit?: boolean;
    canControl?: boolean;
    settings?: import('../../server/store').DeviceSettings;
    identifyUntil?: number;
  }>();
  const [pairing, setPairing] = useState(false),
    [error, setError] = useState<unknown>();
  const [code, setCode] = useState(''),
    [name, setName] = useState<string>();
  const displayName = name ?? t('pairing.defaultName');
  const updateTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const acceptVersion = useCallback((version?: string) => {
    if (!version || version === packageInfo.version) return true;
    if (!updateTimer.current) {
      const update = () => {
        if (document.querySelector('dialog[open]')) updateTimer.current = setTimeout(update, 1000);
        else window.location.reload();
      };
      updateTimer.current = setTimeout(update, 100);
    }
    return false;
  }, []);
  useEffect(() => () => clearTimeout(updateTimer.current), []);

  const load = useCallback(() => {
    api<{
      appVersion?: string;
      published: Revision;
      snapshot: Snapshot;
      canEdit?: boolean;
      canControl?: boolean;
      settings?: import('../../server/store').DeviceSettings;
      identifyUntil?: number;
    }>('api/display/bootstrap')
      .then((result) => {
        if (!acceptVersion(result.appVersion)) return;
        setData(result);
        setPairing(false);
        setError(undefined);
      })
      .catch((e) => {
        if (e.status === 401) setPairing(true);
        else setError(e);
      });
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!data) return;
    return liveStream('api/display/stream', (message) => {
      if (!acceptVersion(message.appVersion)) return;
      if (message.alertId)
        window.dispatchEvent(new CustomEvent('hapanel:alert', { detail: message.alertId }));
      if (message.online === false)
        setData((d) => d && { ...d, snapshot: { ...d.snapshot, status: 'reconnecting' } });
      if (message.snapshot || message.published)
        setData(
          (d) =>
            d && {
              ...d,
              snapshot: message.snapshot ?? d.snapshot,
              published: message.published ?? d.published,
              settings: message.settings,
              identifyUntil: message.identifyUntil,
              canEdit: message.canEdit ?? d.canEdit,
              canControl: message.canControl ?? d.canControl,
            },
        );
    });
  }, [!!data]);
  useEffect(() => {
    if (!data) return;
    const observe = () => {
      if (!window.document.hidden)
        void api('api/display/observe', {
          width: window.innerWidth,
          height: window.innerHeight,
          dpr: window.devicePixelRatio,
        }).catch(() => undefined);
    };
    observe();
    const timer = setInterval(observe, 60000);
    window.addEventListener('resize', observe);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', observe);
    };
  }, [!!data]);
  const act = async (action: Action) => {
    await api('api/display/action', action);
  };
  if (!data)
    return (
      <div className="pairing-screen">
        <div className="pairing-card">
          <LanguageSwitcher />
          <img src="./mark.svg" width="54" alt="" />
          <span className="eyebrow">{t('pairing.welcome')}</span>
          <h1>{t('pairing.title')}</h1>
          {pairing ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api('api/pair', { code, name: displayName });
                  load();
                } catch (e) {
                  setError(e);
                }
              }}
            >
              <p>{t('pairing.instructions')}</p>
              <label>
                {t('pairing.thisDisplay')}
                <input
                  value={displayName}
                  maxLength={64}
                  required
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                {t('pairing.code')}
                <input
                  className="code-input"
                  value={code}
                  placeholder="ABCDE-12345"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={20}
                  required
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </label>
              <button className="button primary full-width" type="submit">
                {t('pairing.connect')}
              </button>
            </form>
          ) : (
            <p>{t('common.connecting')}</p>
          )}
          {Boolean(error) && (
            <p role="alert" className="error-text">
              {describeError(error)}
            </p>
          )}
        </div>
      </div>
    );
  return (
    <>
      <Player
        settings={data.settings}
        identifyUntil={data.identifyUntil}
        published={data.published}
        snapshot={data.snapshot}
        onAction={data.canControl === false && !data.snapshot.alarmControl ? undefined : act}
        onEdit={
          data.canEdit ? () => window.location.assign(new URL('./', document.baseURI)) : undefined
        }
      />
      {Boolean(error) && (
        <div className="toast" role="alert">
          <span>{describeError(error)}</span>
          <button aria-label={t('common.dismiss')} onClick={() => setError(undefined)}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider page="display">
      <Display />
    </I18nProvider>
  </StrictMode>,
);
