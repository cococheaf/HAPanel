import { localizeSampleDocument, localizedSampleTile } from '../../shared/demo';
import { useI18n } from '../i18n';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Home,
  Layers3,
  Minus,
  Music2,
  Pause,
  Play,
  Plus,
  Power,
  Sparkles,
  WifiOff,
  ChevronUp,
  ChevronDown,
  Square,
  Zap,
} from 'lucide-react';
import {
  geometry,
  numberAttr,
  stringAttr,
  type Action,
  type Dashboard,
  type Profile,
  type Snapshot,
  type Tile,
} from '../../shared/model';

import { kindIcons } from './kinds';
import { AlarmStatus, ContactsSummary } from './Security';
import {
  WeatherGlyph,
  EnergyPanel,
  RoomSummary,
  TileDetails,
  roomIcons,
  upcomingForecasts,
  weatherLabel,
} from './Insights';

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
  tile: configuredTile,
  snapshot,
  onAction,
  mediaBase = 'api/editor/media/',
  detailsEnabled = true,
  onNavigate,
}: {
  tile: Tile;
  snapshot: Snapshot;
  onAction?: (action: Action) => void | Promise<void>;
  mediaBase?: string;
  detailsEnabled?: boolean;
  onNavigate?: (pageId: string) => void;
}) {
  const { t, language, intlLocale, describeError } = useI18n();
  const [details, setDetails] = useState(false);
  const [actionError, setActionError] = useState('');
  const [metric, setMetric] = useState<{ entityId: string; label: string }>();

  const tile = localizedSampleTile(configuredTile, language);
  const entity = snapshot.entities[tile.entityId];
  const unavailable =
    !tile.room &&
    !tile.energy &&
    !tile.contacts &&
    (!entity ||
      entity.state === 'unavailable' ||
      (entity.state === 'unknown' && tile.kind !== 'scene'));
  const disabled = !onAction || unavailable || snapshot.status === 'reconnecting';
  const Icon = tile.room ? roomIcons[tile.room.icon] : tile.energy ? Zap : kindIcons[tile.kind];
  const act = async (command: Action['command'], value?: number) => {
    if (disabled) return;
    try {
      await onAction?.({ tileId: tile.id, command, ...(value !== undefined ? { value } : {}) });
      setActionError('');
      if (command === 'activate') setActivated(true);
    } catch (error) {
      setActionError(describeError(error));
    }
  };
  const open = () => {
    if (tile.navigateTo && onNavigate) {
      onNavigate(tile.navigateTo);
      return;
    }
    setMetric(undefined);
    setDetails(true);
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
    if (tile.contacts) return <ContactsSummary tile={tile} snapshot={snapshot} />;
    if (tile.kind === 'alarm')
      return (
        <AlarmStatus
          tile={tile}
          snapshot={snapshot}
          allowLink={detailsEnabled || Boolean(onAction)}
        />
      );
    if (tile.room) return <RoomSummary room={tile.room} snapshot={snapshot} />;
    if (tile.energy)
      return (
        <EnergyPanel
          config={tile.energy}
          snapshot={snapshot}
          compact={Boolean(tile.navigateTo)}
          onInspect={
            detailsEnabled
              ? (entityId, label) => {
                  setMetric({ entityId, label });
                  setDetails(true);
                }
              : undefined
          }
        />
      );
    if (unavailable)
      return (
        <div className="tile-unavailable">
          <WifiOff size={24} />
          <span>{t('common.unavailable')}</span>
        </div>
      );
    if (tile.kind === 'weather') {
      const forecasts = upcomingForecasts(snapshot, tile.entityId);
      return (
        <>
          <div className="weather-current">
            <span className="big-value">
              {typeof entity.attributes.temperature === 'number'
                ? Math.round(entity.attributes.temperature) + '°'
                : '—'}
            </span>
            <WeatherGlyph condition={entity.state} size={56} />
          </div>
          <div className="tile-caption">{weatherLabel(entity.state, t)}</div>
          <div className="weather-forecast">
            {forecasts.slice(0, 4).map((f) => (
              <div key={f.datetime}>
                <span>
                  {new Date(f.datetime).toLocaleTimeString(intlLocale, { hour: '2-digit' })}
                </span>
                <WeatherGlyph condition={f.condition} size={17} />
                <strong>{Math.round(f.temperature)}°</strong>
              </div>
            ))}
          </div>
        </>
      );
    }
    if (tile.kind === 'automation')
      return (
        <div className="automation-content">
          <div className="light-main">
            <button
              className="light-power"
              aria-label={t(entity.state === 'on' ? 'automation.disable' : 'automation.enable', {
                title: tile.title,
              })}
              disabled={disabled}
              onClick={() => act('toggle')}
            >
              <Power size={25} />
            </button>
            <strong>
              {t(entity.state === 'on' ? 'automation.enabled' : 'automation.disabled')}
            </strong>
          </div>
          <button className="automation-run" disabled={disabled} onClick={() => act('activate')}>
            {t(activated ? 'automation.requested' : 'automation.run')}
            <Play size={14} />
          </button>
          <span className="tile-caption">{t('automation.conditions')}</span>
        </div>
      );
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
              aria-label={t(active ? 'dashboard.turnOff' : 'dashboard.turnOn', {
                title: tile.title,
              })}
              disabled={disabled}
              onClick={() => act('toggle')}
            >
              <Power size={25} />
            </button>
            <span className="light-value">
              {active
                ? dimmable
                  ? (brightness / 100).toLocaleString(intlLocale, { style: 'percent' })
                  : t('common.on')
                : t('common.off')}
            </span>
          </div>
          {dimmable && (
            <Slider
              label={t('dashboard.brightness', { title: tile.title })}
              value={brightness}
              onCommit={(v) => act('brightness', v)}
              disabled={disabled}
            />
          )}
          <div className="tile-caption light-caption">
            {Array.isArray(entity.attributes.entity_id)
              ? t('dashboard.groupLightCaption')
              : active
                ? t('dashboard.lightOnCaption')
                : t('dashboard.lightOffCaption')}
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
              {typeof entity.attributes.current_temperature === 'number'
                ? entity.attributes.current_temperature.toLocaleString(intlLocale, {
                    maximumFractionDigits: 1,
                  }) + '°'
                : '—'}
            </span>
            <span className="climate-label">{t('dashboard.roomTemperature')}</span>
          </div>
          <div className="temperature-control">
            <button
              aria-label={t('dashboard.decreaseTemperature')}
              disabled={disabled || temperature <= min}
              onClick={() => act('temperature', Math.max(min, temperature - step))}
            >
              <Minus size={18} />
            </button>
            <span>{temperature.toLocaleString(intlLocale)}°</span>
            <button
              aria-label={t('dashboard.increaseTemperature')}
              disabled={disabled || temperature >= max}
              onClick={() => act('temperature', Math.min(max, temperature + step))}
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="tile-caption climate-caption">
            <i />{' '}
            {entity.attributes.hvac_action === 'heating'
              ? t('dashboard.heating')
              : t('dashboard.comfort')}
          </div>
        </>
      );
    }
    if (tile.kind === 'media') {
      const artworkVersion = [
        ...(stringAttr(entity, 'media_title') + stringAttr(entity, 'media_artist')),
      ].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
      const picture =
        snapshot.status === 'demo'
          ? './album-art.svg'
          : mediaBase + tile.id + '?v=' + artworkVersion;
      return (
        <div className="media-content">
          <img
            className="album-art"
            key={picture}
            src={picture}
            alt={t('dashboard.albumArt')}
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden';
            }}
          />
          <div className="media-info">
            <span className="eyebrow">{t('dashboard.soundtrack')}</span>
            <h2>{stringAttr(entity, 'media_title', t('dashboard.notPlaying'))}</h2>
            <p>{stringAttr(entity, 'media_artist')}</p>
            <div className="media-controls">
              <button
                aria-label={t('dashboard.previousTrack')}
                disabled={disabled}
                onClick={() => act('previous')}
              >
                <ChevronLeft size={28} />
              </button>
              <button
                className="play-button"
                aria-label={entity.state === 'playing' ? t('dashboard.pause') : t('dashboard.play')}
                disabled={disabled}
                onClick={() => act('play_pause')}
              >
                {entity.state === 'playing' ? (
                  <Pause size={22} fill="currentColor" />
                ) : (
                  <Play size={22} fill="currentColor" />
                )}
              </button>
              <button
                aria-label={t('dashboard.nextTrack')}
                disabled={disabled}
                onClick={() => act('next')}
              >
                <ChevronRight size={28} />
              </button>
            </div>
            <div className="media-volume">
              <Music2 size={15} />
              <Slider
                label={t('dashboard.volume')}
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
    if (tile.kind === 'cover') {
      const features = numberAttr(entity, 'supported_features');
      const position = numberAttr(entity, 'current_position', -1);
      return (
        <>
          <div className="cover-value">
            <strong>
              {position >= 0
                ? position.toLocaleString(intlLocale) + '%'
                : entity.state === 'closed'
                  ? t('cover.closed')
                  : t('cover.openState')}
            </strong>
          </div>
          <div className="cover-controls">
            <button
              aria-label={t('cover.openTarget', { title: tile.title })}
              disabled={disabled || !(features & 1)}
              onClick={() => act('open')}
            >
              <ChevronUp size={22} />
            </button>
            <button
              aria-label={t('cover.stopTarget', { title: tile.title })}
              disabled={disabled || !(features & 8)}
              onClick={() => act('stop')}
            >
              <Square size={16} />
            </button>
            <button
              aria-label={t('cover.closeTarget', { title: tile.title })}
              disabled={disabled || !(features & 2)}
              onClick={() => act('close')}
            >
              <ChevronDown size={22} />
            </button>
          </div>
          {position >= 0 && Boolean(features & 4) && (
            <Slider
              label={t('cover.positionTarget', { title: tile.title })}
              value={position}
              onCommit={(value) => act('position', value)}
              disabled={disabled}
            />
          )}
        </>
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
              <strong>
                {activated ? t('dashboard.sceneActivated') : t('dashboard.sceneCaption')}
              </strong>
              <span>{t('dashboard.sceneHint')}</span>
            </div>
            <button
              aria-label={t('dashboard.activateScene', { title: tile.title })}
              disabled={disabled}
              onClick={() => {
                act('activate');
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
          <span className="big-value">
            {/^-?\d+(\.\d+)?$/.test(entity.state)
              ? Number(entity.state).toLocaleString(intlLocale, { maximumFractionDigits: 3 })
              : tile.entityId.startsWith('binary_sensor.') &&
                  ['window', 'door', 'opening'].includes(stringAttr(entity, 'device_class'))
                ? t(entity.state === 'on' ? 'cover.openState' : 'cover.closed')
                : tile.entityId.startsWith('binary_sensor.') &&
                    ['motion', 'occupancy', 'presence'].includes(stringAttr(entity, 'device_class'))
                  ? t(entity.state === 'on' ? 'room.present' : 'room.quiet')
                  : entity.state === 'on'
                    ? t('common.on')
                    : entity.state === 'off'
                      ? t('common.off')
                      : entity.state}
          </span>
          <span>{stringAttr(entity, 'unit_of_measurement')}</span>
        </div>
        <div className="sensor-quality">
          <i />
          <span>
            {tile.entityId.includes('air_quality')
              ? t('dashboard.airQualityCaption')
              : t('dashboard.sensorCaption')}
          </span>
        </div>
      </>
    );
  };
  return (
    <>
      <article
        data-view={
          tile.room ? 'room' : tile.energy ? 'energy' : tile.contacts ? 'contacts' : 'device'
        }
        data-drillable={detailsEnabled}
        onClick={(event) => {
          if (
            detailsEnabled &&
            event.target instanceof Element &&
            !event.target.closest('button, input, select, a')
          )
            open();
        }}
        className={`tile tile-${tile.kind} accent-${tile.accent} ${active ? 'is-active' : ''} ${unavailable ? 'is-unavailable' : ''}`}
      >
        <div className="tile-heading">
          <span className="tile-icon">
            <Icon size={18} strokeWidth={1.8} />
          </span>
          {detailsEnabled ? (
            <button
              className="tile-detail-trigger"
              onClick={open}
              aria-label={t('detail.open', { title: tile.title })}
            >
              {tile.title}
              <ArrowUpRight size={13} />
            </button>
          ) : (
            <span>{tile.title}</span>
          )}
          {tile.kind === 'media' && (
            <span className="playing-dots">
              <i />
              <i />
              <i />
            </span>
          )}
        </div>
        {body()}
        {actionError && !details && (
          <p className="tile-action-error" role="alert">
            {actionError}
          </p>
        )}
      </article>
      {details && (
        <TileDetails
          tile={tile}
          snapshot={snapshot}
          mediaBase={mediaBase}
          initialMetric={metric}
          message={actionError}
          dismissMessage={() => setActionError('')}
          onClose={() => {
            setDetails(false);
            setActionError('');
          }}
          renderControl={(control) => (
            <TileView
              tile={{ ...control, layouts: {} }}
              snapshot={snapshot}
              onAction={onAction}
              mediaBase={mediaBase}
              detailsEnabled={false}
            />
          )}
        />
      )}
    </>
  );
}

export function StaticGrid({
  document,
  profile,
  pageId,
  snapshot,
  onAction,
  mediaBase,
  onNavigate,
}: {
  document: Dashboard;
  profile: Profile;
  pageId: string;
  snapshot: Snapshot;
  onAction?: (action: Action) => void | Promise<void>;
  mediaBase?: string;
  onNavigate?: (pageId: string) => void;
}) {
  const { t } = useI18n();

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
            <TileView
              tile={tile}
              snapshot={snapshot}
              onAction={onAction}
              mediaBase={mediaBase}
              onNavigate={onNavigate}
            />
          </div>
        );
      })}
      {page.tiles.length === 0 && (
        <div className="empty-dashboard">
          <Layers3 size={34} />
          <h2>{t('dashboard.emptyTitle')}</h2>
          <p>{t('dashboard.emptyHint')}</p>
        </div>
      )}
    </div>
  );
}

export function DashboardFrame({
  document: configuredDocument,
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
  onAction?: (action: Action) => void | Promise<void>;
  children?: ReactNode;
  mediaBase?: string;
}) {
  const { t, language, intlLocale } = useI18n();

  const document = localizeSampleDocument(configuredDocument, language);
  const activePage = document.pages.find((page) => page.id === pageId) ?? document.pages[0];
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <section
      data-small={profile.height < 600}
      className={`dashboard-frame theme-${document.theme} ${profile.width < 900 ? 'compact-dashboard' : ''}`}
      style={{ width: profile.width, height: profile.height, padding: profile.margin }}
    >
      <header className="dashboard-header" style={{ height: profile.headerHeight }}>
        <div>
          <div className="dashboard-home-label">
            <Home size={14} /> {document.name}
          </div>
          <h1>
            {activePage.heading ??
              (activePage.id === document.pages[0].id ? document.greeting : activePage.name)}
          </h1>
          <p>
            {snapshot.status === 'reconnecting'
              ? t('dashboard.disconnected')
              : (activePage.subtitle ?? document.subtitle)}
          </p>
        </div>
        <div className="dashboard-clock">
          <strong>
            {now.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit' })}
          </strong>
          <span>
            {now.toLocaleDateString(intlLocale, { weekday: 'long', day: 'numeric', month: 'long' })}
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
          onNavigate={setPageId}
        />
      )}
      <footer className="dashboard-footer" style={{ height: profile.footerHeight }}>
        <nav aria-label={t('dashboard.pages')}>
          {document.pages.map((page, index) => (
            <button
              key={page.id}
              className={pageId === page.id ? 'active' : ''}
              onClick={() => setPageId(page.id)}
            >
              {index === 0 ? (
                <Home size={17} />
              ) : page.id === 'energy' ? (
                <Zap size={17} />
              ) : (
                <Layers3 size={17} />
              )}
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
