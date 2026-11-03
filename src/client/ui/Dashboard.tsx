import { WallpaperPhoto } from './WallpaperPhoto';
import { designVariables } from '../../shared/design';
import { DesignContext } from './DesignContext';
import { StreamBudgetContext } from './stream-budget';
import { FittedTile } from './FittedTile';
import { EnergyStatistics } from './EnergyStatistics';
import { conditionMatches, isNight } from '../../shared/experience';
import { iconChoices } from './widget-icons';
import { AdvancedControls } from './AdvancedControls';
import { Modal } from './Modal';
import { HistoryChart } from './Insights';
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
  Camera as CameraIcon,
} from 'lucide-react';
import {
  pagesForProfile,
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
import { AlarmControls } from './AlarmControls';
import { alarmStatus, contactValues, documentContacts } from '../../shared/security';
import { CameraThumbnail, CameraStream } from './CameraView';
import { lightDimming, lightTapCommand } from '../../shared/lights';
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
  alarmExpanded = false,
  cameraExpanded = false,
}: {
  tile: Tile;
  snapshot: Snapshot;
  onAction?: (action: Action) => void | Promise<void>;
  mediaBase?: string;
  detailsEnabled?: boolean;
  onNavigate?: (pageId: string) => void;
  alarmExpanded?: boolean;
  cameraExpanded?: boolean;
}) {
  const { t, language, intlLocale, describeError } = useI18n();
  const [details, setDetails] = useState(false);
  const [actionError, setActionError] = useState('');
  const [metric, setMetric] = useState<{ entityId: string; label: string }>();
  const [feedback, setFeedback] = useState('');
  const [confirmation, setConfirmation] = useState<'tap' | 'hold'>();
  const entityRef = useRef(snapshot.entities[configuredTile.entityId]);
  entityRef.current = snapshot.entities[configuredTile.entityId];
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const held = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | undefined>(undefined);
  useEffect(() => () => clearTimeout(holdTimer.current), []);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    if (pending || !feedback) return;
    const timer = setTimeout(() => setFeedback(''), 5000);
    return () => clearTimeout(timer);
  }, [pending, feedback]);

  const tile = localizedSampleTile(configuredTile, language);
  const entity = snapshot.entities[tile.entityId];
  const unavailable =
    tile.kind !== 'section' &&
    !tile.room &&
    !tile.energy &&
    !tile.contacts &&
    (!entity ||
      entity.state === 'unavailable' ||
      (entity.state === 'unknown' && !['scene', 'button'].includes(tile.kind)));
  const disabled =
    !onAction ||
    snapshot.deviceControl === false ||
    unavailable ||
    snapshot.status === 'reconnecting' ||
    pending;
  const Icon =
    (tile.experience?.icon && iconChoices[tile.experience.icon]) ||
    (tile.room ? roomIcons[tile.room.icon] : tile.energy ? Zap : kindIcons[tile.kind]);
  const send = async (action: Omit<Action, 'tileId'>) => {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFeedback(t('v2.waiting'));
    const before = JSON.stringify(entityRef.current);
    try {
      await onAction?.({ tileId: tile.id, ...action });
      setActionError('');
      if (action.command === 'activate') setActivated(true);
      const deadline = Date.now() + 4000;
      while (JSON.stringify(entityRef.current) === before && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 100));
      setFeedback(t(JSON.stringify(entityRef.current) === before ? 'v2.received' : 'v2.confirmed'));
    } catch (error) {
      setActionError(describeError(error));
      setFeedback('');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  const act = (command: Action['command'], value?: number) =>
    send({ command, ...(value !== undefined ? { value } : {}) });
  const open = (navigate = true) => {
    if (navigate && tile.navigateTo && onNavigate) {
      onNavigate(tile.navigateTo);
      return;
    }
    setMetric(undefined);
    setDetails(true);
  };
  const gesture = (key: 'tap' | 'hold', confirmed = false) => {
    const binding = tile.experience?.[key];
    if (binding?.type === 'none') return;
    if (binding?.type === 'navigate') {
      if (binding.pageId) onNavigate?.(binding.pageId);
      return;
    }
    if (binding?.type === 'command') {
      if (binding.confirm && !confirmed) {
        setConfirmation(key);
        return;
      }
      void act(key);
      return;
    }
    open(binding?.type !== 'details' && key !== 'hold');
  };
  const compact =
    !alarmExpanded &&
    !cameraExpanded &&
    !tile.room &&
    ['light', 'automation', 'alarm', 'contacts'].includes(tile.kind) &&
    tile.experience?.presentation === 'compact';
  const active = tile.kind === 'light' && entity?.state === 'on';
  const [activated, setActivated] = useState(false);
  useEffect(() => {
    if (activated) {
      const t = setTimeout(() => setActivated(false), 2000);
      return () => clearTimeout(t);
    }
  }, [activated]);
  const body = () => {
    if (tile.kind === 'section') return null;
    if (compact) {
      const contacts = tile.contacts ? contactValues(tile.contacts, snapshot) : undefined;
      const command =
        tile.kind === 'light'
          ? lightTapCommand(tile)
          : tile.kind === 'automation'
            ? ('toggle' as const)
            : undefined;
      const tapDisabled =
        !command || (command === 'turn_off' && !active) || (command === 'turn_on' && active);
      const status = contacts
        ? t(contacts.open.length ? 'contacts.openCount' : 'contacts.noneReported', {
            count: contacts.open.length,
          }) +
          (contacts.unknown.length
            ? ' · ' + t('contacts.unknownCount', { count: contacts.unknown.length })
            : '')
        : tile.kind === 'alarm'
          ? t(alarmStatus(entity).label)
          : unavailable
            ? t('common.unavailable')
            : t(entity?.state === 'on' ? 'common.on' : 'common.off');
      return (
        <div className="quick-tile-body">
          <span>{status}</span>
          {command ? (
            <button
              className="quick-tile-action"
              aria-label={
                tile.kind === 'light'
                  ? t(
                      command === 'turn_off' || (command === 'toggle' && active)
                        ? 'dashboard.turnOff'
                        : 'dashboard.turnOn',
                      { title: tile.title },
                    )
                  : t(entity?.state === 'on' ? 'automation.disable' : 'automation.enable', {
                      title: tile.title,
                    })
              }
              disabled={disabled || tapDisabled}
              onClick={() => act(command)}
            >
              <Power size={19} />
            </button>
          ) : (
            <button
              className="quick-tile-action"
              disabled={!detailsEnabled}
              aria-label={t('detail.open', { title: tile.title })}
              onClick={() => open()}
            >
              <ChevronRight size={19} />
            </button>
          )}
        </div>
      );
    }
    if (tile.kind === 'camera')
      return cameraExpanded ? (
        <CameraStream
          tile={tile}
          snapshot={snapshot}
          base={mediaBase.replace(/media\/$/, 'camera/')}
        />
      ) : (
        <CameraThumbnail
          tile={tile}
          snapshot={snapshot}
          base={mediaBase.replace(/media\/$/, 'camera/')}
          onOpen={detailsEnabled ? () => open() : undefined}
        />
      );
    if (tile.contacts) return <ContactsSummary tile={tile} snapshot={snapshot} />;
    if (tile.kind === 'alarm')
      return alarmExpanded ? (
        <AlarmControls tile={tile} snapshot={snapshot} onAction={onAction} />
      ) : (
        <AlarmStatus
          tile={tile}
          snapshot={snapshot}
          onChoose={detailsEnabled ? () => open() : undefined}
        />
      );
    if (tile.room) return <RoomSummary room={tile.room} snapshot={snapshot} />;
    if (tile.energy)
      return (
        <>
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
          {detailsEnabled && !tile.navigateTo && (
            <EnergyStatistics
              config={tile.energy}
              snapshot={snapshot}
              base={mediaBase.replace(/media\/$/, 'statistics/')}
            />
          )}
        </>
      );
    if (unavailable)
      return (
        <div className="tile-unavailable">
          <WifiOff size={24} />
          <span>{t('common.unavailable')}</span>
        </div>
      );
    if (['timer', 'select', 'number', 'fan', 'vacuum', 'button'].includes(tile.kind))
      return <AdvancedControls tile={tile} entity={entity} disabled={disabled} send={send} />;
    if (tile.experience?.presentation === 'graph')
      return (
        <HistoryChart
          entityId={tile.entityId}
          snapshot={snapshot}
          historyBase={mediaBase.replace(/media\/$/, 'history/')}
        />
      );
    if (tile.experience?.presentation === 'value')
      return (
        <div className="sensor-main">
          <span className="big-value">{entity.state}</span>
          <span>{String(entity.attributes.unit_of_measurement ?? '')}</span>
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
      const reportedBrightness = numberAttr(entity, 'brightness', NaN);
      const brightness =
        entity.state === 'on'
          ? Number.isFinite(reportedBrightness)
            ? Math.round(Math.min(255, Math.max(0, reportedBrightness)) / 2.55)
            : undefined
          : 0;
      const dimmable =
        lightDimming(tile.entityId, snapshot.entities).dimmable &&
        tile.light?.showBrightness !== false &&
        tile.light?.allowTurnOn !== false &&
        tile.light?.allowTurnOff !== false;
      const tapCommand = lightTapCommand(tile);
      const tapDisabled =
        !tapCommand ||
        (tapCommand === 'turn_on' && active) ||
        (tapCommand === 'turn_off' && !active);
      const actionLabel =
        tapCommand === 'turn_off'
          ? 'dashboard.turnOff'
          : tapCommand === 'turn_on'
            ? 'dashboard.turnOn'
            : !tapCommand
              ? 'light.readOnlyNamed'
              : active
                ? 'dashboard.turnOff'
                : 'dashboard.turnOn';
      return (
        <>
          <div className="light-main">
            <button
              className="light-power"
              aria-label={t(actionLabel, {
                title: tile.title,
              })}
              disabled={disabled || tapDisabled}
              onClick={() => tapCommand && act(tapCommand)}
            >
              <Power size={25} />
            </button>
            <span className="light-value">
              {active
                ? dimmable
                  ? brightness === undefined
                    ? '—'
                    : (brightness / 100).toLocaleString(intlLocale, { style: 'percent' })
                  : t('common.on')
                : t('common.off')}
            </span>
          </div>
          {dimmable && brightness !== undefined && (
            <Slider
              label={t('dashboard.brightness', { title: tile.title })}
              value={brightness}
              onCommit={(v) => act('brightness', v)}
              disabled={disabled}
            />
          )}
          <div className="tile-caption light-caption">
            {tapCommand !== 'toggle'
              ? t(
                  !tapCommand
                    ? 'light.readOnly'
                    : tapCommand === 'turn_on'
                      ? 'light.onlyOn'
                      : 'light.onlyOff',
                )
              : Array.isArray(entity.attributes.entity_id)
                ? t('dashboard.groupLightCaption')
                : active
                  ? t('dashboard.lightOnCaption')
                  : t('dashboard.lightOffCaption')}
          </div>
        </>
      );
    }
    if (tile.kind === 'climate') {
      const temperature = numberAttr(entity, 'temperature', NaN),
        step = numberAttr(entity, 'target_temp_step', 0.5);
      const min = numberAttr(entity, 'min_temp', 5),
        max = numberAttr(entity, 'max_temp', 35);
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
          {Number.isFinite(temperature) &&
          Boolean(Number(entity.attributes.supported_features) & 1) ? (
            <div className="temperature-control">
              <button
                aria-label={t('dashboard.decreaseTemperature')}
                disabled={
                  disabled ||
                  !(Number(entity.attributes.supported_features) & 1) ||
                  temperature <= min
                }
                onClick={() => act('temperature', Math.max(min, temperature - step))}
              >
                <Minus size={18} />
              </button>
              <span>{temperature.toLocaleString(intlLocale)}°</span>
              <button
                aria-label={t('dashboard.increaseTemperature')}
                disabled={
                  disabled ||
                  !(Number(entity.attributes.supported_features) & 1) ||
                  temperature >= max
                }
                onClick={() => act('temperature', Math.min(max, temperature + step))}
              >
                <Plus size={18} />
              </button>
            </div>
          ) : (
            <div className="temperature-control">
              <span>
                {typeof entity.attributes.target_temp_low === 'number' &&
                typeof entity.attributes.target_temp_high === 'number'
                  ? entity.attributes.target_temp_low.toLocaleString(intlLocale) +
                    '–' +
                    entity.attributes.target_temp_high.toLocaleString(intlLocale) +
                    '°'
                  : entity.state}
              </span>
            </div>
          )}
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
                disabled={disabled || !(Number(entity.attributes.supported_features) & 16)}
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
                disabled={disabled || !(Number(entity.attributes.supported_features) & 32)}
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
                disabled={disabled || !(Number(entity.attributes.supported_features) & 4)}
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
      <FittedTile
        enabled={!alarmExpanded && !cameraExpanded}
        minWidth={
          compact
            ? 220
            : tile.kind === 'section'
              ? 160
              : tile.energy
                ? 340
                : tile.kind === 'media'
                  ? 400
                  : 240
        }
        minHeight={
          compact
            ? 88
            : tile.energy
              ? 280
              : tile.room
                ? 200
                : {
                    weather: 280,
                    media: 320,
                    sensor: 180,
                    light: 220,
                    climate: 240,
                    cover: 240,
                    automation: 210,
                    alarm: 200,
                    contacts: 220,
                    camera: 200,
                    timer: 180,
                    select: 160,
                    number: 180,
                    fan: 240,
                    vacuum: 220,
                    button: 140,
                    scene: 220,
                    section: 48,
                  }[tile.kind]
        }
        scrollable={Boolean(tile.energy && !tile.navigateTo)}
      >
        <article
          aria-busy={pending || undefined}
          data-view={
            tile.room ? 'room' : tile.energy ? 'energy' : tile.contacts ? 'contacts' : 'device'
          }
          data-drillable={detailsEnabled}
          onClick={(event) => {
            if (
              detailsEnabled &&
              tile.kind !== 'section' &&
              event.target instanceof Element &&
              !event.target.closest('button, input, select, a')
            ) {
              if (held.current) {
                held.current = false;
                return;
              }
              gesture('tap');
            }
          }}
          onPointerDown={(event) => {
            if (
              !detailsEnabled ||
              tile.kind === 'section' ||
              !(event.target instanceof Element) ||
              event.target.closest('button,input,select,a')
            )
              return;
            held.current = false;
            holdTimer.current = setTimeout(() => {
              held.current = true;
              gesture('hold');
            }, 600);
          }}
          onPointerUp={() => clearTimeout(holdTimer.current)}
          onPointerCancel={() => clearTimeout(holdTimer.current)}
          onPointerMove={(event) => {
            if (
              pointerStart.current &&
              Math.hypot(
                event.clientX - pointerStart.current.x,
                event.clientY - pointerStart.current.y,
              ) > 12
            )
              clearTimeout(holdTimer.current);
          }}
          onContextMenu={(event) => {
            if (detailsEnabled) event.preventDefault();
          }}
          data-background={tile.experience?.background ?? 'default'}
          data-presentation={tile.experience?.presentation ?? 'auto'}
          data-secondary={tile.experience?.secondary ?? 'auto'}
          className={`tile ${compact ? 'is-quick' : ''} tile-${tile.kind} accent-${tile.accent} ${active ? 'is-active' : ''} ${unavailable ? 'is-unavailable' : ''}`}
        >
          <div className="tile-heading">
            <span className="tile-icon">
              <Icon size={18} strokeWidth={1.8} />
            </span>
            {tile.kind === 'section' ? (
              (tile.navigateTo || tile.experience?.tap?.type === 'navigate') && onNavigate ? (
                <button className="section-link" onClick={() => gesture('tap')}>
                  {tile.title}
                  <ChevronRight size={16} />
                </button>
              ) : (
                <span>{tile.title}</span>
              )
            ) : detailsEnabled ? (
              <button
                className="tile-detail-trigger"
                onClick={() => open()}
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
          {!detailsEnabled &&
            alarmExpanded &&
            entity &&
            !['timer', 'select', 'number', 'fan', 'vacuum', 'button'].includes(tile.kind) && (
              <AdvancedControls
                tile={tile}
                entity={entity}
                disabled={
                  disabled ||
                  (tile.kind === 'light' &&
                    (tile.light?.allowTurnOn === false || tile.light?.allowTurnOff === false))
                }
                send={send}
                details
              />
            )}
          {['text', 'attribute'].includes(tile.experience?.secondary ?? '') && (
            <div className="tile-caption v2-secondary">
              {tile.experience?.secondary === 'text'
                ? tile.experience.secondaryText
                : String(entity?.attributes[tile.experience?.secondaryText ?? ''] ?? '—')}
            </div>
          )}
          {feedback && (
            <span className="v2-action-feedback" role="status">
              {feedback}
            </span>
          )}
          {actionError && !details && (
            <p className="tile-action-error" role="alert">
              {actionError}
            </p>
          )}
        </article>
      </FittedTile>
      {confirmation && (
        <Modal title={t('v2.confirmAction')} onClose={() => setConfirmation(undefined)}>
          <p>{tile.title}</p>
          <div className="v2-button-row">
            <button className="button" onClick={() => setConfirmation(undefined)}>
              {t('common.cancel')}
            </button>
            <button
              className="button primary"
              onClick={() => {
                const key = confirmation;
                setConfirmation(undefined);
                gesture(key, true);
              }}
            >
              {t('v2.run')}
            </button>
          </div>
        </Modal>
      )}
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
              alarmExpanded
              cameraExpanded={control.id === tile.id}
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
    page =
      pagesForProfile(document, profile.id).find((p) => p.id === pageId) ??
      pagesForProfile(document, profile.id)[0];
  return (
    <div className="static-grid" style={{ width: g.width, height: g.height }}>
      {page.tiles
        .filter((tile) => conditionMatches(tile.experience?.visibleWhen, snapshot))
        .map((tile) => {
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
  const visiblePages = pagesForProfile(document, profile.id);
  const navigationPages = visiblePages.filter((page) => !page.hidden);
  const previousPage = useRef<string | undefined>(undefined);
  const lastPage = useRef(pageId);
  if (lastPage.current !== pageId) {
    previousPage.current = lastPage.current;
    lastPage.current = pageId;
  }
  const touch = useRef<{ x: number; y: number } | undefined>(undefined);
  const activePage = visiblePages.find((page) => page.id === pageId) ?? visiblePages[0];
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const design = activePage.design ?? profile.design;
  const scheme =
    (design?.scheme ?? profile.experience?.colorMode) === 'auto'
      ? isNight(profile.experience, now.getHours())
        ? 'dark'
        : 'light'
      : (design?.scheme ?? profile.experience?.colorMode ?? 'dark');
  const designStyle = design ? (designVariables(design) as CSSProperties) : {};
  return (
    <DesignContext.Provider value={design ? { style: designStyle, scheme } : undefined}>
      <StreamBudgetContext.Provider value={profile.experience?.maxLiveStreams ?? 2}>
        <section
          data-small={profile.height < 600}
          data-density={profile.experience?.density ?? 'normal'}
          data-color-mode={scheme}
          data-design={design?.surface}
          data-wallpaper={design?.wallpaper}
          data-transition={design?.transition ?? 'none'}
          data-background={profile.experience?.background ?? 'gradient'}
          onTouchStart={(event) => {
            touch.current = undefined;
            if (
              !profile.experience?.swipe ||
              event.touches.length !== 1 ||
              window.document.querySelector('dialog[open]') ||
              (event.target instanceof Element && event.target.closest('input,button,select,video'))
            )
              return;
            touch.current = {
              x: event.changedTouches[0].clientX,
              y: event.changedTouches[0].clientY,
            };
          }}
          onTouchEnd={(event) => {
            if (!touch.current) return;
            if (window.document.querySelector('dialog[open]')) {
              touch.current = undefined;
              return;
            }
            const dx = event.changedTouches[0].clientX - touch.current.x,
              dy = event.changedTouches[0].clientY - touch.current.y;
            touch.current = undefined;
            if (Math.abs(dx) > 80 && Math.abs(dy) < 50) {
              const i = navigationPages.findIndex((p) => p.id === activePage.id);
              const target = navigationPages[i + (dx < 0 ? 1 : -1)];
              if (target) setPageId(target.id);
            }
          }}
          onTouchCancel={() => {
            touch.current = undefined;
          }}
          className={`dashboard-frame ${design ? 'design-frame' : ''} theme-${profile.theme ?? document.theme} ${profile.width < 900 ? 'compact-dashboard' : ''}`}
          style={{
            ...designStyle,
            width: profile.width,
            height: profile.height,
            padding: profile.margin,
            paddingTop: profile.margin + (profile.experience?.safeTop ?? 0),
            paddingBottom: profile.margin + (profile.experience?.safeBottom ?? 0),
          }}
        >
          {design?.wallpaper === 'image' && design.image && (
            <WallpaperPhoto image={design.image} scheme={scheme} />
          )}
          <header className="dashboard-header" style={{ height: profile.headerHeight }}>
            <div>
              <div className="dashboard-home-label">
                <Home size={14} /> {document.name}
              </div>
              <h1>
                {activePage.heading ??
                  (activePage.id === visiblePages[0].id
                    ? (profile.greeting ?? document.greeting)
                    : activePage.name)}
              </h1>
              <p>
                {snapshot.status === 'reconnecting'
                  ? t('dashboard.disconnected')
                  : (activePage.subtitle ?? profile.subtitle ?? document.subtitle)}
              </p>
            </div>
            <div className="dashboard-clock">
              <strong>
                {now.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit' })}
              </strong>
              <span>
                {now.toLocaleDateString(intlLocale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
            </div>
          </header>
          {children ?? (
            <StaticGrid
              key={activePage.id}
              document={document}
              profile={profile}
              pageId={pageId}
              snapshot={{ ...snapshot, contactSources: documentContacts(document, snapshot) }}
              onAction={onAction}
              mediaBase={mediaBase}
              onNavigate={setPageId}
            />
          )}
          <footer className="dashboard-footer" style={{ height: profile.footerHeight }}>
            <nav aria-label={t('dashboard.pages')}>
              {activePage.hidden && (
                <button
                  onClick={() =>
                    setPageId(previousPage.current ?? navigationPages[0]?.id ?? visiblePages[0].id)
                  }
                >
                  <ChevronLeft size={18} />
                  {t('v2.back')}
                </button>
              )}
              {navigationPages.map((page, index) => (
                <button
                  key={page.id}
                  className={pageId === page.id ? 'active' : ''}
                  onClick={() => setPageId(page.id)}
                >
                  {index === 0 ? (
                    <Home size={17} />
                  ) : (page.originId ?? page.id) === 'energy' ? (
                    <Zap size={17} />
                  ) : (page.originId ?? page.id) === 'surveillance' ? (
                    <CameraIcon size={17} />
                  ) : (
                    <Layers3 size={17} />
                  )}
                  {page.name}
                </button>
              ))}
            </nav>
          </footer>
        </section>
      </StreamBudgetContext.Provider>
    </DesignContext.Provider>
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
