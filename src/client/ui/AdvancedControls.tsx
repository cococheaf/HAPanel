import { useState, useEffect } from 'react';
import type { Action, EntityState, Tile } from '../../shared/model';
import { useI18n } from '../i18n';
export function AdvancedControls({
  tile,
  entity,
  disabled,
  send,
  details = false,
}: {
  tile: Tile;
  entity: EntityState;
  disabled: boolean;
  send: (action: Omit<Action, 'tileId'>) => Promise<void>;
  details?: boolean;
}) {
  const { t } = useI18n();
  const a = entity.attributes;
  const features = Number(a.supported_features ?? 0);
  const [low, setLow] = useState<string | undefined>(),
    [high, setHigh] = useState<string | undefined>();
  const [number, setNumber] = useState<string | undefined>();
  const [now, setNow] = useState(Date.now());
  const finish = Date.parse(String(a.finishes_at ?? ''));
  useEffect(() => {
    if (tile.kind !== 'timer' || entity.state !== 'active' || !Number.isFinite(finish)) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [tile.kind, entity.state, finish]);
  const seconds = Math.max(0, Math.ceil((finish - now) / 1000));
  const remaining =
    Number.isFinite(finish) && entity.state === 'active'
      ? `${Math.floor(seconds / 3600) > 0 ? Math.floor(seconds / 3600) + ':' : ''}${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
      : String(a.remaining ?? a.duration ?? entity.state);
  const modes = [
    'heat',
    'cool',
    'heat_cool',
    'auto',
    'off',
    'fan_only',
    'dry',
    'low',
    'medium',
    'high',
    'vertical',
    'horizontal',
    'both',
    'on',
    'eco',
    'comfort',
    'away',
    'home',
    'sleep',
    'boost',
    'none',
  ];
  const mode = (value: string) =>
    modes.includes(value) ? t(`mode.${value}` as 'mode.heat') : value;
  const states = ['docked', 'cleaning', 'paused', 'returning', 'idle', 'active', 'error'];
  const stateLabel = states.includes(entity.state)
    ? t(`state.${entity.state}` as 'state.idle')
    : entity.state;
  const button = (command: Action['command'], allowed = true) => (
    <button
      className="v2-control-button"
      key={command}
      disabled={disabled || !allowed}
      onClick={() => void send({ command })}
    >
      {t(`v2.${command}` as 'v2.press')}
    </button>
  );
  const range = (command: Action['command'], value: number, min: number, max: number, step = 1) => (
    <label key={command}>
      {t(`v2.${command}` as 'v2.number')}
      <input
        type="range"
        defaultValue={value}
        key={String(value)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={t(`v2.${command}` as 'v2.number')}
        onPointerUp={(e) => void send({ command, value: Number(e.currentTarget.value) })}
        onKeyUp={(e) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key))
            void send({ command, value: Number(e.currentTarget.value) });
        }}
      />
    </label>
  );
  const choices = (command: Action['command'], key: string, current: string) =>
    Array.isArray(a[key]) && a[key].length > 0 ? (
      <label key={command}>
        {t(`v2.${command}` as 'v2.select')}
        <select
          disabled={disabled}
          aria-label={t(`v2.${command}` as 'v2.select')}
          value={current}
          onChange={(e) => void send({ command, option: e.target.value })}
        >
          {(a[key] as string[]).map((v) => (
            <option key={v} value={v}>
              {command === 'select' ? v : mode(v)}
            </option>
          ))}
        </select>
      </label>
    ) : null;
  let content;
  if (tile.kind === 'select') content = choices('select', 'options', entity.state);
  if (tile.kind === 'number')
    content = (
      <>
        <strong className="big-value">
          {entity.state} {String(a.unit_of_measurement ?? '')}
        </strong>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send({ command: 'number', value: Number(number ?? entity.state) }).then(() =>
              setNumber(undefined),
            );
          }}
        >
          <input
            type="number"
            aria-label={t('v2.number')}
            min={Number(a.min)}
            max={Number(a.max)}
            step={Number(a.step ?? 1)}
            required
            value={number ?? entity.state}
            onChange={(e) => setNumber(e.target.value)}
            disabled={disabled}
          />
          <button className="v2-control-button" disabled={disabled}>
            {t('v2.number')}
          </button>
        </form>
      </>
    );
  if (tile.kind === 'button') content = button('press');
  if (tile.kind === 'timer')
    content = (
      <>
        <strong>{remaining}</strong>
        <div className="v2-button-row">
          {button('timer_start')}
          {button('timer_pause', entity.state === 'active')}
          {button('timer_cancel', entity.state !== 'idle')}
        </div>
      </>
    );
  if (tile.kind === 'vacuum')
    content = (
      <>
        <strong>{stateLabel}</strong>
        <div className="v2-button-row">
          {button('vacuum_start', Boolean(features & 8192))}
          {button('vacuum_pause', Boolean(features & 4))}
          {button('vacuum_return', Boolean(features & 16))}
        </div>
        {a.battery_level !== undefined && <span>{String(a.battery_level)}%</span>}
      </>
    );
  if (tile.kind === 'fan')
    content = (
      <>
        <strong>{entity.state === 'on' ? t('common.on') : t('common.off')}</strong>
        <div className="v2-button-row">
          {button('turn_on', entity.state !== 'on')}
          {button('turn_off', entity.state === 'on')}
        </div>
        {Boolean(features & 1) &&
          range('fan_speed', Number(a.percentage ?? 0), 0, 100, Number(a.percentage_step ?? 1))}
        {choices('preset', 'preset_modes', String(a.preset_mode ?? ''))}
      </>
    );
  if (details && tile.kind === 'light')
    content = (
      <>
        {Array.isArray(a.supported_color_modes) &&
          a.supported_color_modes.includes('color_temp') &&
          range(
            'color_temp',
            Number(a.color_temp_kelvin ?? 3000),
            Number(a.min_color_temp_kelvin ?? 2000),
            Number(a.max_color_temp_kelvin ?? 6500),
            50,
          )}
        {Array.isArray(a.supported_color_modes) &&
          a.supported_color_modes.some((m) =>
            ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'].includes(String(m)),
          ) && (
            <label>
              {t('v2.color')}
              <input
                type="color"
                aria-label={t('v2.color')}
                disabled={
                  disabled ||
                  tile.light?.allowTurnOn === false ||
                  tile.light?.allowTurnOff === false
                }
                defaultValue="#ffb65a"
                onBlur={(e) => {
                  const hex = e.target.value;
                  void send({
                    command: 'color',
                    color: [
                      parseInt(hex.slice(1, 3), 16),
                      parseInt(hex.slice(3, 5), 16),
                      parseInt(hex.slice(5, 7), 16),
                    ],
                  });
                }}
              />
            </label>
          )}
      </>
    );
  if (details && tile.kind === 'climate')
    content = (
      <>
        {Boolean(features & 2) && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send({
                command: 'temperature_range',
                value: Number(low ?? a.target_temp_low),
                valueHigh: Number(high ?? a.target_temp_high),
              });
            }}
          >
            <label>
              {t('v2.low')}
              <input
                type="number"
                min={Number(a.min_temp ?? 5)}
                max={Number(a.max_temp ?? 35)}
                step={Number(a.target_temp_step ?? 0.5)}
                required
                value={low ?? String(a.target_temp_low ?? '')}
                disabled={disabled}
                onChange={(e) => setLow(e.target.value)}
              />
            </label>
            <label>
              {t('v2.high')}
              <input
                type="number"
                min={Number(a.min_temp ?? 5)}
                max={Number(a.max_temp ?? 35)}
                step={Number(a.target_temp_step ?? 0.5)}
                required
                value={high ?? String(a.target_temp_high ?? '')}
                disabled={disabled}
                onChange={(e) => setHigh(e.target.value)}
              />
            </label>
            <button className="v2-control-button" disabled={disabled}>
              {t('v2.temperature_range')}
            </button>
          </form>
        )}
        {Boolean(features & 4) &&
          range(
            'humidity',
            Number(a.humidity ?? 50),
            Number(a.min_humidity ?? 0),
            Number(a.max_humidity ?? 100),
          )}
        {choices('hvac', 'hvac_modes', entity.state)}
        {choices('climate_fan', 'fan_modes', String(a.fan_mode ?? ''))}
        {choices('swing', 'swing_modes', String(a.swing_mode ?? ''))}
        {choices('preset', 'preset_modes', String(a.preset_mode ?? ''))}
      </>
    );
  if (details && tile.kind === 'cover' && Boolean(features & 128))
    content = range('tilt', Number(a.current_tilt_position ?? 0), 0, 100);
  if (tile.kind === 'media' && tile.mediaFavorite)
    content = button('favorite', Boolean(features & 512));
  return content ? <div className="v2-advanced-controls">{content}</div> : null;
}
