import { adaptiveDocument } from '../../shared/experience';
import { DisplayAlerts, useDisplayIdle } from './DisplayExperience';
import { localizeSampleDocument } from '../../shared/demo';
import { useI18n } from '../i18n';
import { useEffect, useState, useRef } from 'react';
import { Settings2, X } from 'lucide-react';
import { pagesForProfile, type Action, type Revision, type Snapshot } from '../../shared/model';
import { DashboardFrame, ScaledCanvas } from '../ui/Dashboard';

export default function Player({
  published,
  snapshot,
  onAction,
  demo = false,
  onEdit,
  settings,
  identifyUntil,
}: {
  settings?: import('../../server/store').DeviceSettings;
  identifyUntil?: number;
  published: Revision;
  snapshot: Snapshot;
  onAction?: (action: Action) => void | Promise<void>;
  demo?: boolean;
  onEdit?: () => void;
}) {
  const { t, language, setPreference } = useI18n();

  const document = localizeSampleDocument(published.document, language);
  const [, tickIdentification] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tickIdentification((v) => v + 1), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!identifyUntil) return;
    const timer = setTimeout(
      () => tickIdentification((value) => value + 1),
      Math.max(0, identifyUntil - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [identifyUntil]);
  const [profileId, setProfileId] = useState(() => {
    let saved: string | null = null;
    try {
      saved =
        new URL(window.location.href).searchParams.get('display') ??
        localStorage.getItem('hapanel-display-profile');
    } catch {
      /* storage may be disabled */
    }
    return saved && document.profiles.some((p) => p.id === saved)
      ? saved
      : window.innerHeight > window.innerWidth && document.profiles.some((p) => p.id === 'portrait')
        ? 'portrait'
        : document.profiles[0].id;
  });
  const [pageId, setPageId] = useState(document.pages[0].id),
    [message, setMessage] = useState('');
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (settings?.profileId && document.profiles.some((p) => p.id === settings.profileId))
      setProfileId(settings.profileId);
    if (settings?.pageId) setPageId(settings.pageId);
    if (settings?.language) setPreference(settings.language);
  }, [settings?.profileId, settings?.pageId, settings?.language]);
  const profile = document.profiles.find((p) => p.id === profileId) ?? document.profiles[0];
  const visiblePages = pagesForProfile(document, profile.id);
  const page = visiblePages.find((p) => p.id === pageId) ?? visiblePages[0];
  useEffect(() => {
    const home = profile.experience?.homePageId;
    if (home && document.pages.some((p) => p.id === home)) setPageId(home);
  }, [profile.id]);
  const { idle, wake } = useDisplayIdle(profile, () =>
    setPageId(profile.experience?.homePageId ?? visiblePages[0].id),
  );
  const canvasRef = useRef<HTMLElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: viewport.width, height: viewport.height });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);
  const runtime = adaptiveDocument(
    document,
    profile,
    canvasSize.width,
    Math.max(240, canvasSize.height),
  );
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 6000);
      return () => clearTimeout(t);
    }
  }, [message]);
  return (
    <div
      className={`player-shell ${demo ? 'demo-player' : ''} ${profile.experience?.adaptive ? 'adaptive-player' : ''}`}
      data-toolbar-hidden={!onEdit}
    >
      {snapshot.status === 'reconnecting' && (
        <div className="v2-connection-banner" role="status">
          {t('v2.reconnect')}
        </div>
      )}
      {onEdit && (
        <div className="player-toolbar">
          <div className="player-brand">
            <img src="./mark.svg" alt="" />
            <span>HAPanel</span>
          </div>
          <div className="header-spacer" />
          <button
            type="button"
            className="player-edit"
            onClick={() => {
              try {
                localStorage.setItem('hapanel-editor-display', profile.id);
              } catch {}
              onEdit();
            }}
            aria-label={t('player.exploreStudio')}
          >
            <Settings2 size={18} />
            <span>{t('player.exploreStudio')}</span>
          </button>
        </div>
      )}
      <main className="player-canvas" ref={canvasRef}>
        <ScaledCanvas
          profile={runtime.profile}
          exact={profile.experience?.adaptive || profile.mode === 'exact'}
        >
          <DashboardFrame
            document={runtime.document}
            profile={runtime.profile}
            pageId={page.id}
            setPageId={setPageId}
            snapshot={snapshot}
            onAction={onAction}
            mediaBase="api/display/media/"
          />
        </ScaledCanvas>
      </main>
      {profile.experience?.adaptive && (
        <nav className="v2-adaptive-nav" aria-label={t('dashboard.pages')}>
          {page.hidden && (
            <button onClick={() => setPageId(profile.experience?.homePageId ?? visiblePages[0].id)}>
              {t('v2.back')}
            </button>
          )}
          {visiblePages
            .filter((page) => !page.hidden)
            .map((item) => (
              <button
                key={item.id}
                className={item.id === page.id ? 'active' : ''}
                onClick={() => setPageId(item.id)}
              >
                {item.name}
              </button>
            ))}
        </nav>
      )}
      <DisplayAlerts document={document} profile={profile} snapshot={snapshot} onAlert={wake} />
      {idle && (
        <button className="v2-idle" onClick={wake}>
          <strong>
            {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </strong>
          <span>{t('v2.sleepHint')}</span>
        </button>
      )}
      {Boolean(identifyUntil && identifyUntil > Date.now()) && (
        <button className="v2-identify" onClick={() => setMessage(t('v2.identifyHint'))}>
          <strong>
            {settings?.profileId
              ? document.profiles.find((p) => p.id === settings.profileId)?.name
              : profile.name}
          </strong>
          <span>{t('v2.identifyHint')}</span>
        </button>
      )}
      {demo && (
        <div className="demo-footnote">
          <span>
            <i />
            {t('player.demoSafe')}
          </span>
          <span>{t('player.demoActions')}</span>
        </div>
      )}
      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <button aria-label={t('common.dismiss')} onClick={() => setMessage('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
