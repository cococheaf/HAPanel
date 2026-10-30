import { localizeSampleDocument } from '../../shared/demo';
import { useI18n, LanguageSwitcher } from '../i18n';
import { useEffect, useState } from 'react';
import { Expand, Info, Settings2, X } from 'lucide-react';
import { pagesForProfile, type Action, type Revision, type Snapshot } from '../../shared/model';
import { DashboardFrame, ScaledCanvas } from '../ui/Dashboard';

export default function Player({
  published,
  snapshot,
  onAction,
  demo = false,
  onEdit,
}: {
  published: Revision;
  snapshot: Snapshot;
  onAction?: (action: Action) => void | Promise<void>;
  demo?: boolean;
  onEdit?: () => void;
}) {
  const { t, language } = useI18n();

  const document = localizeSampleDocument(published.document, language);
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
    [info, setInfo] = useState(false),
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
  const profile = document.profiles.find((p) => p.id === profileId) ?? document.profiles[0];
  const visiblePages = pagesForProfile(document, profile.id);
  const page = visiblePages.find((p) => p.id === pageId) ?? visiblePages[0];
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 6000);
      return () => clearTimeout(t);
    }
  }, [message]);
  return (
    <div className={`player-shell ${demo ? 'demo-player' : ''}`}>
      <div className="player-toolbar">
        <a className="player-brand" href={onEdit ? './' : './display.html'} aria-label="HAPanel">
          <img src="./mark.svg" alt="" />
          <span>HAPanel</span>
        </a>
        {demo && <span className="player-demo-tag">{t('player.interactiveDemo')}</span>}
        {!onAction && <span className="player-demo-tag">{t('player.readOnlyAccess')}</span>}
        <div className="header-spacer" />
        <LanguageSwitcher />
        <select
          aria-label={t('editor.displayProfile')}
          value={profile.id}
          onChange={(e) => {
            setProfileId(e.target.value);
            try {
              localStorage.setItem('hapanel-display-profile', e.target.value);
            } catch {
              /* session-only selection */
            }
          }}
        >
          {document.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          className="player-icon"
          aria-label={t('player.information')}
          title={t('player.information')}
          onClick={() => setInfo(!info)}
        >
          <Info size={18} />
        </button>
        <button
          className="player-icon"
          aria-label={t('player.fullscreen')}
          title={t('player.fullscreen')}
          onClick={async () => {
            try {
              if (window.document.fullscreenElement) await window.document.exitFullscreen();
              else if (window.document.documentElement.requestFullscreen)
                await window.document.documentElement.requestFullscreen();
              else setMessage(t('player.homeScreenHint'));
            } catch {
              setMessage(t('player.homeScreenFallback'));
            }
          }}
        >
          <Expand size={18} />
        </button>
        {onEdit && (
          <button
            className="player-edit"
            onClick={() => {
              try {
                localStorage.setItem('hapanel-editor-display', profile.id);
              } catch {}
              onEdit();
            }}
            aria-label={t('player.exploreStudio')}
          >
            <Settings2 size={15} />
            <span>{t('player.exploreStudio')}</span>
          </button>
        )}
      </div>
      {info && (
        <div className="display-info">
          <strong>{profile.name}</strong>
          <span>
            {t('player.browserInfo', {
              width: viewport.width,
              height: viewport.height,
              dpr: window.devicePixelRatio,
            })}
          </span>
          <span>
            {t('player.layoutInfo', {
              width: profile.width,
              height: profile.height,
              columns: profile.columns,
              rows: profile.rows,
            })}
          </span>
          <span>
            {demo
              ? t('player.sampleData')
              : t('player.publishedVersion', { number: published.revision })}
          </span>
          {viewport.width < profile.width && profile.mode === 'exact' && (
            <span>{t('player.layoutTooLarge')}</span>
          )}
        </div>
      )}
      <main className="player-canvas">
        <ScaledCanvas profile={profile} exact={profile.mode === 'exact'}>
          <DashboardFrame
            document={document}
            profile={profile}
            pageId={page.id}
            setPageId={setPageId}
            snapshot={snapshot}
            onAction={onAction}
            mediaBase="api/display/media/"
          />
        </ScaledCanvas>
      </main>
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
