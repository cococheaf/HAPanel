import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudSun,
  Home,
  Layers3,
  Lightbulb,
  Minus,
  Music2,
  Pause,
  Play,
  Plus,
  Power,
  Sparkles,
  Sun,
  Thermometer,
  Wind,
  WifiOff,
} from 'lucide-react';
import {
  geometry,
  numberAttr,
  stringAttr,
  type Action,
  type Dashboard,
  type EntityState,
  type Profile,
  type Snapshot,
  type Tile,
} from '../../shared/model';

import { kindIcons } from './kinds';
const conditions: Record<string, string> = {
  partlycloudy: 'Leicht bewölkt',
  cloudy: 'Bewölkt',
  sunny: 'Sonnig',
  rainy: 'Regen',
  'clear-night': 'Klare Nacht',
  snowy: 'Schnee',
};

function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onCommit,
  disabled,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (value: number) => void | Promise<void>;
  disabled: boolean;
}) {
  const [local, setLocal] = useState(value);
  const currentValue = useRef(value);
  currentValue.current = value;
  const interacting = useRef(false);
  useEffect(() => {
    if (!interacting.current) setLocal(value);
  }, [value]);
  return (
    <input
      className="tile-slider"
      aria-label={label}
      type="range"
      min={min}
      max={max}
      step={step}
      value={local}
      disabled={disabled}
      style={{ '--range-progress': `${((local - min) / (max - min)) * 100}%` } as CSSProperties}
      onPointerDown={() => {
        interacting.current = true;
      }}
      onChange={(e) => setLocal(Number(e.target.value))}
      onPointerUp={async (e) => {
        interacting.current = false;
        try {
          await onCommit(Number(e.currentTarget.value));
        } finally {
          setLocal(currentValue.current);
        }
      }}
      onPointerCancel={() => {
        interacting.current = false;
        setLocal(value);
      }}
      onKeyUp={(e) => {
        if (
          [
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'Home',
            'End',
            'PageUp',
            'PageDown',
          ].includes(e.key)
        )
          onCommit(local);
      }}
    />
  );
}

export function TileView({
  tile,
  snapshot,
  onAction,
  mediaBase = 'api/editor/media/',
}: {
  tile: Tile;
  snapshot: Snapshot;
  onAction?: (action: Action) => void;
  mediaBase?: string;
}) {
  const entity = snapshot.entities[tile.entityId];
  const unavailable =
    !entity ||
    entity.state === 'unavailable' ||
    (entity.state === 'unknown' && tile.kind !== 'scene');
  const disabled = !onAction || unavailable || snapshot.status === 'reconnecting';
  const Icon = kindIcons[tile.kind];
  const act = (command: Action['command'], value?: number) => {
    if (!disabled)
      return onAction?.({ tileId: tile.id, command, ...(value !== undefined ? { value } : {}) });
  };
  const active = tile.kind === 'light' && entity?.state === 'on';
  const [activated, setActivated] = useState(false);
  useEffect(() => {
    if (activated) {
      const t = setTimeout(() => setActivated(false), 2000);
      return () => clearTimeout(t);
    }
  }, [activated]);
  const body = () => {
    if (unavailable)
      return (
        <div className="tile-unavailable">
          <WifiOff size={24} />
          <span>Nicht verfügbar</span>
        </div>
      );
    if (tile.kind === 'weather') {
      const forecasts = snapshot.forecasts[tile.entityId] ?? [];
      return (
        <>
          <div className="weather-current">
            <span className="big-value">{Math.round(numberAttr(entity, 'temperature'))}°</span>
            <CloudSun size={56} strokeWidth={1.2} />
          </div>
          <div className="tile-caption">{conditions[entity.state] ?? entity.state}</div>
          <div className="weather-forecast">
            {forecasts.slice(0, 4).map((f) => (
              <div key={f.datetime}>
                <span>{new Date(f.datetime).getHours()} Uhr</span>
                <CloudSun size={17} />
                <strong>{Math.round(f.temperature)}°</strong>
              </div>
            ))}
          </div>
        </>
      );
    }
    if (tile.kind === 'light') {
      const brightness =
        entity.state === 'on' ? Math.round(numberAttr(entity, 'brightness', 255) / 2.55) : 0;
      const modes = entity.attributes.supported_color_modes as string[] | undefined;
      const dimmable =
        tile.entityId.startsWith('light.') &&
        (entity.attributes.brightness !== undefined ||
          modes?.some((mode) => !['onoff', 'unknown'].includes(mode)));
      return (
        <>
          <div className="light-main">
            <button
              className="light-power"
              aria-label={`${tile.title} ${active ? 'ausschalten' : 'einschalten'}`}
              disabled={disabled}
              onClick={() => act('toggle')}
            >
              <Power size={25} />
            </button>
            <span className="light-value">
              {active ? (dimmable ? `${brightness} %` : 'An') : 'Aus'}
            </span>
          </div>
          {dimmable && (
            <Slider
              label={`${tile.title} Helligkeit`}
              value={brightness}
              onCommit={(v) => act('brightness', v)}
              disabled={disabled}
            />
          )}
          <div className="tile-caption light-caption">
            {active ? 'Warm & gemütlich' : 'Ein Moment Ruhe'}
          </div>
        </>
      );
    }
    if (tile.kind === 'climate') {
      const temperature = numberAttr(entity, 'temperature', 22),
        step = numberAttr(entity, 'target_temp_step', 0.5);
      const min = numberAttr(entity, 'min_temp', 5),
        max = Math.min(35, numberAttr(entity, 'max_temp', 35));
      return (
        <>
          <div className="climate-main">
            <span className="big-value">
              {numberAttr(entity, 'current_temperature').toLocaleString('de-AT', {
                maximumFractionDigits: 1,
              })}
              °
            </span>
            <span className="climate-label">Raumtemperatur</span>
          </div>
          <div className="temperature-control">
            <button
              aria-label="Temperatur senken"
              disabled={disabled || temperature <= min}
              onClick={() => act('temperature', Math.max(min, temperature - step))}
            >
              <Minus size={18} />
            </button>
            <span>{temperature.toLocaleString('de-AT')}°</span>
            <button
              aria-label="Temperatur erhöhen"
              disabled={disabled || temperature >= max}
              onClick={() => act('temperature', Math.min(max, temperature + step))}
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="tile-caption climate-caption">
            <i />{' '}
            {entity.attributes.hvac_action === 'heating'
              ? 'Heizt auf deine Wohlfühltemperatur'
              : 'Wohlfühltemperatur'}
          </div>
        </>
      );
    }
    if (tile.kind === 'media') {
      const picture = snapshot.status === 'demo' ? './album-art.svg' : `${mediaBase}${tile.id}`;
      return (
        <div className="media-content">
          <img
            className="album-art"
            src={picture}
            alt="Albumcover"
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden';
            }}
          />
          <div className="media-info">
            <span className="eyebrow">DEIN SOUNDTRACK</span>
            <h2>{stringAttr(entity, 'media_title', 'Keine Wiedergabe')}</h2>
            <p>{stringAttr(entity, 'media_artist')}</p>
            <div className="media-controls">
              <button
                aria-label="Vorheriger Titel"
                disabled={disabled}
                onClick={() => act('previous')}
              >
                <ChevronLeft size={28} />
              </button>
              <button
                className="play-button"
                aria-label={entity.state === 'playing' ? 'Pausieren' : 'Abspielen'}
                disabled={disabled}
                onClick={() => act('play_pause')}
              >
                {entity.state === 'playing' ? (
                  <Pause size={22} fill="currentColor" />
                ) : (
                  <Play size={22} fill="currentColor" />
                )}
              </button>
              <button aria-label="Nächster Titel" disabled={disabled} onClick={() => act('next')}>
                <ChevronRight size={28} />
              </button>
            </div>
            <div className="media-volume">
              <Music2 size={15} />
              <Slider
                label="Lautstärke"
                value={numberAttr(entity, 'volume_level')}
                max={1}
                step={0.01}
                onCommit={(v) => act('volume', v)}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      );
    }
    if (tile.kind === 'scene')
      return (
        <>
          <div className="scene-orb">
            <Sparkles size={33} strokeWidth={1.3} />
          </div>
          <div className="scene-bottom">
            <div>
              <strong>{activated ? 'Schönen Feierabend.' : 'Zeit zum Durchatmen.'}</strong>
              <span>Deine Szene, ein Fingertipp.</span>
            </div>
            <button
              aria-label={`${tile.title} aktivieren`}
              disabled={disabled}
              onClick={() => {
                act('activate');
                setActivated(true);
              }}
            >
              <ArrowUpRight size={22} />
            </button>
          </div>
        </>
      );
    return (
      <>
        <div className="sensor-main">
          <span className="big-value">{entity.state}</span>
          <span>{stringAttr(entity, 'unit_of_measurement')}</span>
        </div>
        <div className="sensor-quality">
          <i />
          <span>
            {tile.entityId.includes('air_quality')
              ? 'Frische Luft. Gutes Gefühl.'
              : 'Aktueller Messwert'}
          </span>
        </div>
      </>
    );
  };
  return (
    <article
      className={`tile tile-${tile.kind} accent-${tile.accent} ${active ? 'is-active' : ''} ${unavailable ? 'is-unavailable' : ''}`}
    >
      <div className="tile-heading">
        <span className="tile-icon">
          <Icon size={18} strokeWidth={1.8} />
        </span>
        <span>{tile.title}</span>
        {tile.kind === 'media' && (
          <span className="playing-dots">
            <i />
            <i />
            <i />
          </span>
        )}
      </div>
      {body()}
    </article>
  );
}

export function StaticGrid({
  document,
  profile,
  pageId,
  snapshot,
  onAction,
  mediaBase,
}: {
  document: Dashboard;
  profile: Profile;
  pageId: string;
  snapshot: Snapshot;
  onAction?: (action: Action) => void;
  mediaBase?: string;
}) {
  const g = geometry(profile),
    page = document.pages.find((p) => p.id === pageId) ?? document.pages[0];
  return (
    <div className="static-grid" style={{ width: g.width, height: g.height }}>
      {page.tiles.map((tile) => {
        const r = tile.layouts[profile.id];
        return (
          <div
            key={tile.id}
            className="static-tile"
            style={{
              left: Math.round(r.x * (g.cellWidth + profile.gap)),
              top: Math.round(r.y * (g.rowHeight + profile.gap)),
              width: Math.round(r.w * g.cellWidth + (r.w - 1) * profile.gap),
              height: Math.round(r.h * g.rowHeight + (r.h - 1) * profile.gap),
            }}
          >
            <TileView tile={tile} snapshot={snapshot} onAction={onAction} mediaBase={mediaBase} />
          </div>
        );
      })}
      {page.tiles.length === 0 && (
        <div className="empty-dashboard">
          <Layers3 size={34} />
          <h2>Platz für dein Zuhause.</h2>
          <p>Füge dieser Seite im Studio deine ersten Kacheln hinzu.</p>
        </div>
      )}
    </div>
  );
}

export function DashboardFrame({
  document,
  profile,
  pageId,
  setPageId,
  snapshot,
  onAction,
  children,
  mediaBase,
}: {
  document: Dashboard;
  profile: Profile;
  pageId: string;
  setPageId: (id: string) => void;
  snapshot: Snapshot;
  onAction?: (action: Action) => void;
  children?: ReactNode;
  mediaBase?: string;
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <section
      className={`dashboard-frame theme-${document.theme} ${profile.width < 900 ? 'compact-dashboard' : ''}`}
      style={{ width: profile.width, height: profile.height, padding: profile.margin }}
    >
      <header className="dashboard-header" style={{ height: profile.headerHeight }}>
        <div>
          <div className="dashboard-home-label">
            <Home size={14} /> {document.name}
          </div>
          <h1>{document.greeting}</h1>
          <p>
            {snapshot.status === 'reconnecting'
              ? 'Verbindung unterbrochen · Werte können veraltet sein'
              : document.subtitle}
          </p>
        </div>
        <div className="dashboard-clock">
          <strong>{now.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}</strong>
          <span>
            {now.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </header>
      {children ?? (
        <StaticGrid
          document={document}
          profile={profile}
          pageId={pageId}
          snapshot={snapshot}
          onAction={onAction}
          mediaBase={mediaBase}
        />
      )}
      <footer className="dashboard-footer" style={{ height: profile.footerHeight }}>
        <nav aria-label="Dashboard-Seiten">
          {document.pages.map((page, index) => (
            <button
              key={page.id}
              className={pageId === page.id ? 'active' : ''}
              onClick={() => setPageId(page.id)}
            >
              {index === 0 ? <Home size={17} /> : <Layers3 size={17} />}
              {page.name}
            </button>
          ))}
        </nav>
      </footer>
    </section>
  );
}

export function ScaledCanvas({
  profile,
  children,
  zoom = 1,
  exact = false,
}: {
  profile: Profile;
  children: ReactNode | ((scale: number) => ReactNode);
  zoom?: number;
  exact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1080, height: 810 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const scale = exact
    ? 1
    : Math.min(size.width / profile.width, size.height / profile.height) * zoom;
  return (
    <div className={`scaled-canvas ${exact ? 'exact-canvas' : ''}`} ref={ref}>
      <div
        className="canvas-bounds"
        style={{ width: profile.width * scale, height: profile.height * scale }}
      >
        <div
          className="canvas-transform"
          style={{ width: profile.width, height: profile.height, transform: `scale(${scale})` }}
        >
          {typeof children === 'function' ? children(scale) : children}
        </div>
      </div>
    </div>
  );
}
