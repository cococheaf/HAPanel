import { useEffect, useState } from 'react';
import { Expand, Info, Settings2, X } from 'lucide-react';
import type { Action, Revision, Snapshot } from '../../shared/model';
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
  onAction: (action: Action) => void;
  demo?: boolean;
  onEdit?: () => void;
}) {
  const document = published.document;
  const [profileId, setProfileId] = useState(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('hapanel-display-profile');
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
  const page = document.pages.find((p) => p.id === pageId) ?? document.pages[0];
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 6000);
      return () => clearTimeout(t);
    }
  }, [message]);
  return (
    <div className={`player-shell ${demo ? 'demo-player' : ''}`}>
      <div className="player-toolbar">
        <a className="player-brand" href="./">
          <img src="./mark.svg" alt="" />
          HAPanel
        </a>
        {demo && <span className="player-demo-tag">INTERAKTIVE DEMO</span>}
        <div className="header-spacer" />
        <select
          aria-label="Displayprofil"
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
          aria-label="Displayinformationen"
          title="Displayinformationen"
          onClick={() => setInfo(!info)}
        >
          <Info size={18} />
        </button>
        <button
          className="player-icon"
          aria-label="Vollbild"
          title="Vollbild"
          onClick={async () => {
            try {
              if (window.document.fullscreenElement) await window.document.exitFullscreen();
              else if (window.document.documentElement.requestFullscreen)
                await window.document.documentElement.requestFullscreen();
              else
                setMessage(
                  'Auf dem iPad: Teilen → Zum Home-Bildschirm. Von dort öffnet HAPanel ohne Safari-Leisten.',
                );
            } catch {
              setMessage('Nutze auf dem iPad „Zum Home-Bildschirm“ für die eigenständige Ansicht.');
            }
          }}
        >
          <Expand size={18} />
        </button>
        {onEdit && (
          <button className="player-edit" onClick={onEdit}>
            <Settings2 size={15} />
            <span>Studio erkunden</span>
          </button>
        )}
      </div>
      {info && (
        <div className="display-info">
          <strong>{profile.name}</strong>
          <span>
            Browser: {viewport.width} × {viewport.height} CSS px · DPR {window.devicePixelRatio}
          </span>
          <span>
            Layout: {profile.width} × {profile.height} · {profile.columns} × {profile.rows} Raster
          </span>
          <span>
            {demo
              ? 'Beispieldaten · Änderungen bleiben in diesem Browser'
              : `Veröffentlichte Version ${published.revision}`}
          </span>
          {viewport.width < profile.width && profile.mode === 'exact' && (
            <span>Das exakte Layout ist größer als deine Browserfläche.</span>
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
            Alles ausprobieren. Dein echtes Zuhause bleibt unberührt.
          </span>
          <span>Licht dimmen · Temperatur ändern · Musik steuern</span>
        </div>
      )}
      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <button aria-label="Meldung schließen" onClick={() => setMessage('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
