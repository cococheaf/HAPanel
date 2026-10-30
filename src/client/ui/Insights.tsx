import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  Bath,
  BatteryCharging,
  BedDouble,
  CookingPot,
  DoorOpen,
  Droplets,
  Footprints,
  Home,
  PlugZap,
  Sofa,
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Zap,
} from 'lucide-react';
import type { Control, Energy, HistoryPoint, Room, Snapshot, Tile } from '../../shared/model';
import { energyValues, measured, numericState, roomValues } from '../../shared/insights';
import { isMessageKey } from '../../shared/i18n';
import { useI18n } from '../i18n';
import { api } from '../service';
import { Modal } from './Modal';

export const roomIcons = {
  home: Home,
  sofa: Sofa,
  kitchen: CookingPot,
  bed: BedDouble,
  bath: Bath,
  door: DoorOpen,
  hall: Footprints,
};
export function weatherLabel(condition: string, t: ReturnType<typeof useI18n>['t']) {
  if (!condition || ['unknown', 'unavailable'].includes(condition)) return t('common.unavailable');
  const key = 'weather.' + condition;
  return isMessageKey(key) ? t(key) : condition;
}
export function WeatherGlyph({ condition, size = 22 }: { condition: string; size?: number }) {
  const icons: Record<string, typeof Sun> = {
    sunny: Sun,
    'clear-night': Moon,
    partlycloudy: CloudSun,
    cloudy: Cloud,
    rainy: CloudRain,
    pouring: CloudRain,
    snowy: CloudSnow,
    'snowy-rainy': CloudSnow,
    lightning: CloudLightning,
    'lightning-rainy': CloudLightning,
    windy: Wind,
    'windy-variant': Wind,
    fog: Cloud,
  };
  const Icon = Object.hasOwn(icons, condition) ? icons[condition] : CloudSun;
  return <Icon size={size} strokeWidth={1.4} />;
}
export function upcomingForecasts(snapshot: Snapshot, entityId: string) {
  const hour = Math.floor(Date.now() / 3600_000) * 3600_000;
  return (snapshot.forecasts[entityId] ?? []).filter((point) => Date.parse(point.datetime) >= hour);
}
export function RoomSummary({ room, snapshot }: { room: Room; snapshot: Snapshot }) {
  const { t, intlLocale } = useI18n();
  const values = roomValues(room, snapshot);
  return (
    <div className="room-summary">
      <div className="room-temperature">
        <strong>
          {values.temperature === undefined
            ? values.lightsAvailable
              ? t(values.lightsOn ? 'common.on' : 'common.off')
              : '—'
            : values.temperature.toLocaleString(intlLocale, { maximumFractionDigits: 1 }) + '°'}
        </strong>
        {values.humidity !== undefined && (
          <span>
            <Droplets size={13} />
            {values.humidity.toLocaleString(intlLocale, { maximumFractionDigits: 0 })}%
          </span>
        )}
      </div>
      <div className="room-meta">
        <span className={values.lightsOn ? 'room-lit' : ''}>
          {values.lights
            ? values.lightsAvailable < values.lights
              ? t('room.partial', {
                  on: values.lightsOn,
                  missing: values.lights - values.lightsAvailable,
                })
              : t('room.lights', { on: values.lightsOn, total: values.lights })
            : t('room.noTemperature')}
        </span>
        <span>
          {values.windowsOpen
            ? t('room.windows', { count: values.windowsOpen })
            : room.windows.length > values.windowsAvailable
              ? t('room.unknownContacts')
              : values.windowsAvailable
                ? t('room.closed')
                : values.present
                  ? t('room.present')
                  : t('room.quiet')}
        </span>
      </div>
      <ArrowUpRight className="room-explore" size={20} />
    </div>
  );
}

export function EnergyPanel({
  config,
  snapshot,
  onInspect,
  compact = false,
}: {
  config: Energy;
  snapshot: Snapshot;
  onInspect?: (entityId: string, label: string) => void;
  compact?: boolean;
}) {
  const { t, intlLocale } = useI18n();
  const values = energyValues(config, snapshot);
  const power = (value?: number) =>
    value === undefined
      ? '—'
      : Math.abs(value) >= 1000
        ? (value / 1000).toLocaleString(intlLocale, { maximumFractionDigits: 2 }) + ' kW'
        : value.toLocaleString(intlLocale, { maximumFractionDigits: 0 }) + ' W';
  const inspect = (id: string | undefined, label: string) => id && onInspect?.(id, label);
  const node = (label: string, value: string, icon: ReactNode, id?: string, hint?: string) => (
    <button
      className="energy-node"
      onClick={() =>
        inspect(id, String(snapshot.entities[id ?? '']?.attributes.friendly_name ?? label))
      }
      disabled={!id || !onInspect}
    >
      <span className="energy-node-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </button>
  );
  return (
    <div className={'energy-panel' + (compact ? ' is-compact' : '')}>
      <div className="energy-balance">
        <div>
          <span className="eyebrow">
            <i />
            {t('energy.live')}
          </span>
          <strong>{power(values.net === undefined ? undefined : Math.abs(values.net))}</strong>
          <span>
            {values.net === undefined
              ? t('energy.noValue')
              : values.net < 0
                ? t('energy.export')
                : t('energy.import')}
          </span>
        </div>
        <div className="energy-orbit" aria-hidden="true">
          <Zap size={35} />
        </div>
      </div>
      <div className="energy-nodes">
        {node(t('energy.solar'), power(values.solar), <Sun size={20} />, config.solarPower[0])}
        {node(
          t('energy.grid'),
          power(values.net === undefined ? values.incoming : Math.abs(values.net)),
          <PlugZap size={20} />,
          values.net !== undefined && values.net < 0 ? config.gridExport : config.gridImport,
          t(values.net !== undefined && values.net < 0 ? 'energy.export' : 'energy.import'),
        )}
        {node(
          t('energy.battery'),
          values.level === undefined
            ? '—'
            : values.level.toLocaleString(intlLocale, { maximumFractionDigits: 0 }) + '%',
          <BatteryCharging size={20} />,
          config.batteryLevel ?? config.batteryPower,
          values.battery === undefined
            ? t('energy.noValue')
            : power(Math.abs(values.battery)) +
                ' · ' +
                t(
                  values.battery > 0
                    ? 'energy.charging'
                    : values.battery < 0
                      ? 'energy.discharging'
                      : 'energy.idle',
                ),
        )}
      </div>
      <div className="energy-lower">
        <section className="energy-consumers">
          <div className="energy-section-heading">
            <h3>{t('energy.monitored')}</h3>
            <strong>{power(values.monitored)}</strong>
          </div>
          <p>{t('energy.partial')}</p>
          {values.consumers.length === 0 && <p>{t('energy.noSources')}</p>}
          {[...values.consumers]
            .sort((a, b) => (b.power ?? -1) - (a.power ?? -1))
            .map((consumer) => (
              <button
                className="energy-meter"
                key={consumer.entityId}
                onClick={() => inspect(consumer.entityId, consumer.label)}
                disabled={!onInspect}
              >
                <span>{consumer.label}</span>
                <strong>{power(consumer.power)}</strong>
                <i
                  style={{
                    width:
                      (consumer.power === undefined || !values.monitored
                        ? 0
                        : Math.max(0, Math.min(100, (consumer.power / values.monitored) * 100))) +
                      '%',
                  }}
                />
              </button>
            ))}
        </section>
        {config.metrics.length > 0 && (
          <section className="energy-readings">
            <h3>{t('energy.metrics')}</h3>
            {config.metrics.map((metric) => {
              const entity = snapshot.entities[metric.entityId];
              const value = numericState(entity);
              const unit = entity?.attributes.unit_of_measurement;
              const kwh = measured(entity, 'energy');
              return (
                <button
                  className="energy-reading"
                  key={metric.entityId}
                  onClick={() => inspect(metric.entityId, metric.label)}
                  disabled={!onInspect}
                >
                  <span>{metric.label}</span>
                  <strong>
                    {value === undefined
                      ? '—'
                      : (kwh ?? value).toLocaleString(intlLocale, { maximumFractionDigits: 2 }) +
                        ' ' +
                        (kwh === undefined ? String(unit ?? '') : 'kWh')}
                  </strong>
                </button>
              );
            })}
          </section>
        )}
      </div>
      {compact && (
        <span className="energy-cockpit-hint">
          {t('energy.cockpit')}
          <ArrowUpRight size={17} />
        </span>
      )}
    </div>
  );
}

function HistoryChart({
  entityId,
  snapshot,
  historyBase,
}: {
  entityId: string;
  snapshot: Snapshot;
  historyBase: string;
}) {
  const { t, intlLocale, describeError } = useI18n();
  const [points, setPoints] = useState<HistoryPoint[]>();
  const [error, setError] = useState<unknown>();
  const gradient = 'history' + useId().replace(/:/g, '');
  const entity = snapshot.entities[entityId];
  useEffect(() => {
    let current = true;
    setPoints(undefined);
    setError(undefined);
    if (snapshot.status === 'demo') {
      const raw =
        entity?.attributes.current_temperature ?? entity?.attributes.temperature ?? entity?.state;
      const value = Number(raw);
      setPoints(
        Number.isFinite(value)
          ? Array.from({ length: 25 }, (_, index) => ({
              time: new Date(Date.now() - (24 - index) * 3600_000).toISOString(),
              value: Math.max(0, value + Math.sin(index / 3) * Math.abs(value) * 0.05),
            }))
          : [],
      );
    } else {
      api<HistoryPoint[]>(historyBase + encodeURIComponent(entityId))
        .then((data) => {
          if (current) setPoints(data);
        })
        .catch((reason) => {
          if (current) setError(reason);
        });
    }
    return () => {
      current = false;
    };
  }, [entityId, historyBase, snapshot.status]);
  const rawUnit =
    entityId.startsWith('climate.') || entityId.startsWith('weather.')
      ? String(entity?.attributes.temperature_unit ?? entity?.attributes.unit_of_measurement ?? '°')
      : String(entity?.attributes.unit_of_measurement ?? '');
  if (error)
    return (
      <p className="insight-muted" role="status">
        {describeError(error)}
      </p>
    );
  if (!points)
    return (
      <p className="insight-muted" role="status">
        {t('detail.loading')}
      </p>
    );
  if (points.length < 2) return <p className="insight-muted">{t('detail.noHistory')}</p>;
  const factor =
    rawUnit === 'Wh' ||
    (rawUnit === 'W' && Math.max(...points.map((point) => Math.abs(point.value))) >= 1000)
      ? 0.001
      : 1;
  const unit = rawUnit === 'Wh' ? 'kWh' : rawUnit === 'W' && factor === 0.001 ? 'kW' : rawUnit;
  const values = points.map((point) => point.value * factor),
    min = Math.min(...values),
    max = Math.max(...values);
  const first = Date.parse(points[0].time),
    last = Date.parse(points.at(-1)!.time);
  const xy = points.map((point) => [
    12 + ((Date.parse(point.time) - first) / Math.max(1, last - first)) * 696,
    150 - ((point.value * factor - min) / Math.max(0.001, max - min)) * 128,
  ]);
  const path = xy.map((point) => point.join(',')).join(' ');
  const number = (value: number) =>
    value.toLocaleString(intlLocale, { maximumFractionDigits: 2 }) + ' ' + unit;
  return (
    <div className="history-chart">
      <div className="history-range">
        <span>{number(min)}</span>
        <span>{number(max)}</span>
      </div>
      <svg
        viewBox="0 0 720 175"
        role="img"
        aria-label={t('detail.history') + ': ' + number(min) + ' – ' + number(max)}
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b7dfbb" stopOpacity=".3" />
            <stop offset="100%" stopColor="#b7dfbb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={
            'M' +
            xy[0].join(',') +
            ' L' +
            xy
              .slice(1)
              .map((point) => point.join(','))
              .join(' L') +
            ' L708,175 L12,175 Z'
          }
          fill={'url(#' + gradient + ')'}
        />
        <polyline
          points={path}
          fill="none"
          stroke="#c5e3c8"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
      <div className="history-range">
        <span>
          {new Date(first).toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span>
          {new Date(last).toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

export function TileDetails({
  tile,
  snapshot,
  mediaBase,
  initialMetric,
  renderControl,
  onClose,
  message,
  dismissMessage,
}: {
  tile: Tile;
  snapshot: Snapshot;
  mediaBase: string;
  initialMetric?: { entityId: string; label: string };
  renderControl: (control: Control) => ReactNode;
  onClose: () => void;
  message?: string;
  dismissMessage: () => void;
}) {
  const { t, intlLocale } = useI18n();
  const [metric, setMetric] = useState(initialMetric);
  const entity = snapshot.entities[metric?.entityId ?? tile.entityId];
  const historyBase = mediaBase.replace(/media\/$/, 'history/');
  const forecasts = upcomingForecasts(snapshot, tile.entityId).slice(0, 24);
  const numeric =
    metric || numericState(entity) !== undefined || ['climate', 'weather'].includes(tile.kind);
  const info = (key: string, label: string, unit = '') => {
    const value = entity?.attributes[key];
    return typeof value === 'number' ? (
      <div>
        <span>{label}</span>
        <strong>
          {value.toLocaleString(intlLocale, { maximumFractionDigits: 1 })}
          {unit}
        </strong>
      </div>
    ) : null;
  };
  return (
    <Modal
      title={metric?.label ?? tile.title}
      wide
      className="insight-dialog"
      onClose={onClose}
      message={message}
      onDismissMessage={dismissMessage}
    >
      {snapshot.status === 'reconnecting' && (
        <p className="insight-muted">{t('dashboard.disconnected')}</p>
      )}
      {metric ? (
        <button className="insight-back" onClick={() => setMetric(undefined)}>
          ← {tile.title}
        </button>
      ) : null}
      {tile.room && !metric ? (
        <>
          <RoomSummary room={tile.room} snapshot={snapshot} />
          <h3 className="insight-section-title">{t('detail.controls')}</h3>
          <div className="room-controls">
            {tile.room.controls.map((control) => (
              <div key={control.id}>{renderControl(control)}</div>
            ))}
          </div>
        </>
      ) : tile.energy && !metric ? (
        <>
          <EnergyPanel
            config={tile.energy}
            snapshot={snapshot}
            onInspect={(entityId, label) => setMetric({ entityId, label })}
          />
          <h3 className="insight-section-title">{t('energy.sources')}</h3>
          <div className="energy-sources">
            {[
              ...new Set(
                [
                  ...tile.energy.solarPower,
                  tile.energy.gridImport,
                  tile.energy.gridExport,
                  tile.energy.batteryPower,
                  tile.energy.batteryLevel,
                ].filter((id): id is string => Boolean(id)),
              ),
            ].map((id) => {
              const source = snapshot.entities[id],
                label = String(source?.attributes.friendly_name ?? id);
              return (
                <button
                  key={id}
                  className="energy-reading"
                  onClick={() => setMetric({ entityId: id, label })}
                >
                  <span>{label}</span>
                  <strong>
                    {numericState(source) === undefined
                      ? t('common.unavailable')
                      : Number(source.state).toLocaleString(intlLocale, {
                          maximumFractionDigits: 2,
                        }) +
                        ' ' +
                        String(source.attributes.unit_of_measurement ?? '')}
                  </strong>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {!metric && tile.kind !== 'weather' && (
            <div className="detail-primary-control">{renderControl(tile)}</div>
          )}
          {tile.kind === 'weather' && !metric && (
            <>
              <div className="weather-detail-now">
                <WeatherGlyph condition={entity?.state ?? ''} size={42} />
                <strong>
                  {typeof entity?.attributes.temperature === 'number'
                    ? entity.attributes.temperature.toLocaleString(intlLocale) + '°'
                    : '—'}
                </strong>
                <span>{weatherLabel(entity?.state ?? '', t)}</span>
              </div>
              <div className="detail-facts">
                {info('humidity', t('detail.humidity'), '%')}
                {info(
                  'wind_speed',
                  t('detail.wind'),
                  ' ' + String(entity?.attributes.wind_speed_unit ?? ''),
                )}
                {info(
                  'pressure',
                  t('detail.pressure'),
                  ' ' + String(entity?.attributes.pressure_unit ?? ''),
                )}
              </div>
              <h3 className="insight-section-title">{t('detail.forecast')}</h3>
              <div className="forecast-detail">
                {forecasts.length ? (
                  forecasts.map((point) => (
                    <div key={point.datetime}>
                      <span>
                        {new Date(point.datetime).toLocaleTimeString(intlLocale, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <WeatherGlyph condition={point.condition} />
                      <strong>
                        {point.temperature.toLocaleString(intlLocale, { maximumFractionDigits: 0 })}
                        °
                      </strong>
                      <small>{weatherLabel(point.condition, t)}</small>
                    </div>
                  ))
                ) : (
                  <p className="insight-muted">{t('common.unavailable')}</p>
                )}
              </div>
            </>
          )}
          {numeric && (
            <>
              <h3 className="insight-section-title">{t('detail.history')}</h3>
              <HistoryChart
                key={metric?.entityId ?? tile.entityId}
                entityId={metric?.entityId ?? tile.entityId}
                snapshot={snapshot}
                historyBase={historyBase}
              />
            </>
          )}
          {entity?.last_updated && (
            <p className="insight-updated">
              {t('detail.updated')}: {new Date(entity.last_updated).toLocaleString(intlLocale)}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
