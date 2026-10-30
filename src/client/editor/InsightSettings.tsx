import { useState } from 'react';
import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react';
import { alarmModes } from '../../shared/model';
import { alarmModeLabel, supportsAlarmMode } from '../../shared/security';
import type { Energy, EntityState, Room, Tile, TileKind } from '../../shared/model';
import { useI18n } from '../i18n';

const domains: Record<string, TileKind> = {
  light: 'light',
  switch: 'light',
  climate: 'climate',
  media_player: 'media',
  cover: 'cover',
  sensor: 'sensor',
  binary_sensor: 'sensor',
  scene: 'scene',
  script: 'scene',
  automation: 'automation',
  alarm_control_panel: 'alarm',
};
const freshControl = () => 'control_' + crypto.randomUUID().slice(0, 12);

export function InsightSettings({
  tile,
  catalog,
  pages,
  update,
}: {
  tile: Tile;
  catalog: EntityState[];
  pages: { id: string; name: string }[];
  update: (patch: Partial<Tile>) => void;
}) {
  const { t, intlLocale } = useI18n();
  const [newControl, setNewControl] = useState('');
  const [newConsumer, setNewConsumer] = useState('');
  const [newMetric, setNewMetric] = useState('');
  const name = (entity: EntityState) => String(entity.attributes.friendly_name ?? entity.entity_id);
  const sensors = catalog.filter((entity) => entity.entity_id.startsWith('sensor.'));
  const power = sensors.filter((entity) =>
    ['W', 'kW'].includes(String(entity.attributes.unit_of_measurement)),
  );
  const room = (patch: Partial<Room>) => tile.room && update({ room: { ...tile.room, ...patch } });
  const energy = (patch: Partial<Energy>) =>
    tile.energy && update({ energy: { ...tile.energy, ...patch } });
  const camera = (patch: Partial<NonNullable<Tile['camera']>>) =>
    update({
      camera: {
        refreshSeconds: 30,
        fit: 'cover',
        overview: 'snapshot',
        transport: 'auto',
        ...tile.camera,
        ...patch,
      },
    });
  const picker = (
    label: string,
    value: string | undefined,
    change: (id: string) => void,
    choices: EntityState[] = catalog,
  ) => (
    <label>
      {label}
      <select value={value ?? ''} onChange={(event) => change(event.target.value)}>
        <option value="">{t('editor.none')}</option>
        {value && !choices.some((entity) => entity.entity_id === value) && (
          <option value={value} disabled>
            {t('common.unavailable')} · {value}
          </option>
        )}
        {[...choices]
          .sort((a, b) => name(a).localeCompare(name(b), intlLocale))
          .map((entity) => (
            <option key={entity.entity_id} value={entity.entity_id}>
              {name(entity)}
            </option>
          ))}
      </select>
    </label>
  );
  const referenceList = (key: 'windows' | 'presence', label: string, candidates: EntityState[]) =>
    tile.room && (
      <div className="insight-reference-list">
        <label>{label}</label>
        {tile.room[key].map((id) => (
          <div className="inspector-reference" key={id}>
            <span>
              {(catalog.find((item) => item.entity_id === id)?.attributes
                .friendly_name as string) ?? id}
            </span>
            <button
              className="icon-button"
              aria-label={t('editor.remove')}
              onClick={() => room({ [key]: tile.room![key].filter((item) => item !== id) })}
            >
              <X size={13} />
            </button>
          </div>
        ))}
        {tile.room[key].length < 8 &&
          picker(
            label,
            '',
            (id) => id && room({ [key]: [...new Set([...tile.room![key], id])] }),
            candidates,
          )}
      </div>
    );
  return (
    <>
      {tile.kind === 'camera' && (
        <div className="form-section">
          <h3>{t('kind.camera')}</h3>
          <label>
            {t('camera.refresh')}
            <input
              type="number"
              min={15}
              max={120}
              value={tile.camera?.refreshSeconds ?? 30}
              onChange={(event) => camera({ refreshSeconds: Number(event.target.value) })}
            />
          </label>
          <label>
            {t('camera.fit')}
            <select
              value={tile.camera?.fit ?? 'cover'}
              onChange={(event) => camera({ fit: event.target.value as 'cover' | 'contain' })}
            >
              <option value="cover">{t('camera.fitCover')}</option>
              <option value="contain">{t('camera.fitContain')}</option>
            </select>
          </label>
          <label>
            {t('camera.overview')}
            <select
              value={tile.camera?.overview ?? 'snapshot'}
              onChange={(event) => camera({ overview: event.target.value as 'snapshot' | 'live' })}
            >
              <option value="snapshot">{t('camera.overviewSnapshot')}</option>
              <option value="live">{t('camera.overviewLive')}</option>
            </select>
          </label>
          <label>
            {t('camera.connection')}
            <select
              value={tile.camera?.transport ?? 'auto'}
              onChange={(event) =>
                camera({ transport: event.target.value as 'auto' | 'webrtc' | 'hls' })
              }
            >
              <option value="auto">{t('camera.connectionAuto')}</option>
              <option value="webrtc">WebRTC</option>
              <option value="hls">HLS</option>
            </select>
          </label>
          <p className="field-hint">{t('camera.liveOverviewHint')}</p>
        </div>
      )}
      {tile.kind === 'alarm' && (
        <div className="form-section">
          <h3>{t('kind.alarm')}</h3>
          <label className="alarm-setting-toggle">
            <input
              type="checkbox"
              checked={Boolean(tile.alarm)}
              onChange={(event) =>
                update({
                  alarm: event.target.checked
                    ? {
                        modes: alarmModes.filter((mode) =>
                          supportsAlarmMode(
                            catalog.find((entity) => entity.entity_id === tile.entityId),
                            mode,
                          ),
                        ).length
                          ? alarmModes.filter((mode) =>
                              supportsAlarmMode(
                                catalog.find((entity) => entity.entity_id === tile.entityId),
                                mode,
                              ),
                            )
                          : ['disarmed'],
                      }
                    : undefined,
                  homeAssistantUrl: undefined,
                })
              }
            />
            {t('alarm.enableControls')}
          </label>
          {tile.alarm && (
            <>
              <p className="field-hint">{t('alarm.modeConfiguration')}</p>
              <div className="alarm-mode-settings">
                {alarmModes.map((mode) => (
                  <label key={mode}>
                    <input
                      type="checkbox"
                      checked={tile.alarm!.modes.includes(mode)}
                      disabled={tile.alarm!.modes.length === 1 && tile.alarm!.modes.includes(mode)}
                      onChange={(event) =>
                        update({
                          alarm: {
                            modes: event.target.checked
                              ? [...tile.alarm!.modes, mode]
                              : tile.alarm!.modes.filter((item) => item !== mode),
                          },
                        })
                      }
                    />
                    <span>{t(alarmModeLabel(mode))}</span>
                  </label>
                ))}
              </div>
              <h3>{t('alarm.modeOrder')}</h3>
              {tile.alarm.modes.map((mode, index) => (
                <div key={mode} className="inspector-reference">
                  <span>{t(alarmModeLabel(mode))}</span>
                  {([-1, 1] as const).map((direction) => (
                    <button
                      key={direction}
                      type="button"
                      className="icon-button"
                      disabled={
                        index + direction < 0 || index + direction >= tile.alarm!.modes.length
                      }
                      aria-label={t(direction < 0 ? 'alarm.moveUp' : 'alarm.moveDown', {
                        mode: t(alarmModeLabel(mode)),
                      })}
                      onClick={() => {
                        const modes = [...tile.alarm!.modes];
                        [modes[index], modes[index + direction]] = [
                          modes[index + direction],
                          modes[index],
                        ];
                        update({ alarm: { modes } });
                      }}
                    >
                      {direction < 0 ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
          <p className="field-hint">{t('alarm.codePrivacy')}</p>
        </div>
      )}
      {tile.contacts && (
        <div className="form-section">
          <h3>{t('kind.contacts')}</h3>
          {tile.contacts.map((item) => (
            <div className="inspector-reference" key={item.entityId}>
              <input
                aria-label={item.label}
                value={item.label}
                onChange={(event) =>
                  event.target.value.trim() &&
                  update({
                    contacts: tile.contacts!.map((row) =>
                      row.entityId === item.entityId ? { ...row, label: event.target.value } : row,
                    ),
                  })
                }
              />
              <button
                className="icon-button"
                disabled={tile.contacts!.length === 1}
                aria-label={t('editor.remove')}
                onClick={() =>
                  update({
                    contacts: tile.contacts!.filter((row) => row.entityId !== item.entityId),
                  })
                }
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {tile.contacts.length < 32 &&
            picker(
              t('editor.addContact'),
              '',
              (id) => {
                const entity = catalog.find((item) => item.entity_id === id);
                if (entity && !tile.contacts!.some((item) => item.entityId === id))
                  update({
                    contacts: [
                      ...tile.contacts!,
                      { entityId: id, label: name(entity).slice(0, 64) },
                    ],
                  });
              },
              catalog.filter(
                (entity) =>
                  entity.entity_id.startsWith('binary_sensor.') &&
                  ['door', 'window', 'opening'].includes(String(entity.attributes.device_class)),
              ),
            )}
        </div>
      )}
      {!['contacts', 'alarm', 'automation', 'camera'].includes(tile.kind) && (
        <>
          <div className="form-section">
            <h3>{t('editor.cardView')}</h3>
            <label>
              {t('editor.cardView')}
              <select
                value={tile.room ? 'room' : tile.energy ? 'energy' : 'standard'}
                onChange={(event) => {
                  const view = event.target.value;
                  update({
                    room:
                      view === 'room'
                        ? {
                            icon: 'home',
                            controls: [
                              {
                                id: freshControl(),
                                kind: tile.kind,
                                title: tile.title,
                                entityId: tile.entityId,
                                accent: tile.accent,
                              },
                            ],
                            presence: [],
                            windows: [],
                          }
                        : undefined,
                    energy:
                      view === 'energy'
                        ? {
                            solarPower: [tile.entityId],
                            batteryPositive: 'charge',
                            consumers: [],
                            metrics: [],
                          }
                        : undefined,
                  });
                }}
              >
                <option value="standard">{t('editor.standardView')}</option>
                <option value="room">{t('editor.roomView')}</option>
                {tile.kind === 'sensor' && tile.entityId.startsWith('sensor.') && (
                  <option value="energy">{t('editor.energyView')}</option>
                )}
              </select>
            </label>
            <label>
              {t('editor.navigationTarget')}
              <select
                value={tile.navigateTo ?? ''}
                onChange={(event) => update({ navigateTo: event.target.value || undefined })}
              >
                <option value="">{t('detail.title')}</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
      {tile.room && (
        <div className="form-section">
          <h3>{t('editor.roomView')}</h3>
          <label>
            {t('editor.roomIcon')}
            <select
              value={tile.room.icon}
              onChange={(event) => room({ icon: event.target.value as Room['icon'] })}
            >
              {(['home', 'sofa', 'kitchen', 'bed', 'bath', 'door', 'hall'] as const).map((icon) => (
                <option key={icon} value={icon}>
                  {t(('roomIcon.' + icon) as 'roomIcon.home')}
                </option>
              ))}
            </select>
          </label>
          {picker(
            t('editor.temperatureSource'),
            tile.room.temperature,
            (id) => room({ temperature: id || undefined }),
            catalog.filter(
              (entity) =>
                entity.entity_id.startsWith('climate.') ||
                entity.attributes.device_class === 'temperature',
            ),
          )}
          {picker(
            t('editor.humiditySource'),
            tile.room.humidity,
            (id) => room({ humidity: id || undefined }),
            sensors.filter((entity) => entity.attributes.device_class === 'humidity'),
          )}
          {referenceList(
            'windows',
            t('room.windowSensors'),
            catalog.filter(
              (entity) =>
                entity.entity_id.startsWith('binary_sensor.') &&
                ['window', 'door', 'opening'].includes(String(entity.attributes.device_class)),
            ),
          )}
          {referenceList(
            'presence',
            t('room.presenceSensors'),
            catalog.filter(
              (entity) =>
                entity.entity_id.startsWith('binary_sensor.') &&
                ['motion', 'occupancy', 'presence'].includes(
                  String(entity.attributes.device_class),
                ),
            ),
          )}
          <h3>{t('editor.roomControls')}</h3>
          <div className="inspector-controls">
            {tile.room.controls.map((control) => (
              <div className="inspector-reference" key={control.id}>
                <input
                  aria-label={control.title}
                  value={control.title}
                  onChange={(event) =>
                    event.target.value.trim() &&
                    room({
                      controls: tile.room!.controls.map((item) =>
                        item.id === control.id ? { ...item, title: event.target.value } : item,
                      ),
                    })
                  }
                />
                <button
                  className="icon-button"
                  aria-label={t('editor.remove')}
                  onClick={() =>
                    room({ controls: tile.room!.controls.filter((item) => item.id !== control.id) })
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          {tile.room.controls.length < 24 && (
            <>
              {picker(
                t('editor.entity'),
                newControl,
                setNewControl,
                catalog.filter((entity) => domains[entity.entity_id.split('.')[0]]),
              )}
              <button
                className="button"
                disabled={!newControl}
                onClick={() => {
                  const entity = catalog.find((item) => item.entity_id === newControl);
                  if (entity)
                    room({
                      controls: [
                        ...tile.room!.controls,
                        {
                          id: freshControl(),
                          kind: domains[newControl.split('.')[0]],
                          title: name(entity).slice(0, 64),
                          entityId: newControl,
                          accent: tile.accent,
                        },
                      ],
                    });
                  setNewControl('');
                }}
              >
                <Plus size={14} />
                {t('editor.addControl')}
              </button>
            </>
          )}
        </div>
      )}
      {tile.energy && (
        <div className="form-section">
          <h3>{t('editor.energyBindings')}</h3>
          {picker(
            t('energy.solar'),
            tile.energy.solarPower[0],
            (id) => id && energy({ solarPower: [id, ...tile.energy!.solarPower.slice(1)] }),
            power,
          )}
          {picker(
            t('editor.solarExtra'),
            tile.energy.solarPower[1],
            (id) => energy({ solarPower: [tile.energy!.solarPower[0], ...(id ? [id] : [])] }),
            power,
          )}
          {picker(
            t('energy.import'),
            tile.energy.gridImport,
            (id) => energy({ gridImport: id || undefined }),
            power,
          )}
          {picker(
            t('energy.export'),
            tile.energy.gridExport,
            (id) => energy({ gridExport: id || undefined }),
            power,
          )}
          {picker(
            t('energy.battery'),
            tile.energy.batteryPower,
            (id) => energy({ batteryPower: id || undefined }),
            power,
          )}
          {picker(
            t('energy.batteryLevel'),
            tile.energy.batteryLevel,
            (id) => energy({ batteryLevel: id || undefined }),
            sensors.filter((entity) => entity.attributes.unit_of_measurement === '%'),
          )}
          <label>
            {t('editor.batteryDirection')}
            <select
              value={tile.energy.batteryPositive}
              onChange={(event) =>
                energy({ batteryPositive: event.target.value as Energy['batteryPositive'] })
              }
            >
              <option value="charge">{t('energy.charging')}</option>
              <option value="discharge">{t('energy.discharging')}</option>
            </select>
          </label>
          {(['consumers', 'metrics'] as const).map((key) => (
            <div key={key}>
              <h3>{t(key === 'consumers' ? 'energy.monitored' : 'energy.metrics')}</h3>
              {tile.energy![key].map((item, index) => (
                <div className="inspector-reference" key={item.entityId}>
                  <input
                    aria-label={item.label}
                    value={item.label}
                    onChange={(event) =>
                      event.target.value.trim() &&
                      energy({
                        [key]: tile.energy![key].map((row, number) =>
                          number === index ? { ...row, label: event.target.value } : row,
                        ),
                      })
                    }
                  />
                  <button
                    className="icon-button"
                    aria-label={t('editor.remove')}
                    onClick={() =>
                      energy({ [key]: tile.energy![key].filter((_, number) => number !== index) })
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {tile.energy![key].length < 12 && (
                <>
                  {picker(
                    t('editor.entity'),
                    key === 'consumers' ? newConsumer : newMetric,
                    key === 'consumers' ? setNewConsumer : setNewMetric,
                    key === 'consumers' ? power : sensors,
                  )}
                  <button
                    className="button"
                    disabled={!(key === 'consumers' ? newConsumer : newMetric)}
                    onClick={() => {
                      const id = key === 'consumers' ? newConsumer : newMetric;
                      const entity = catalog.find((item) => item.entity_id === id);
                      if (entity && !tile.energy![key].some((item) => item.entityId === id))
                        energy({
                          [key]: [
                            ...tile.energy![key],
                            { entityId: id, label: name(entity).slice(0, 64) },
                          ],
                        });
                      if (key === 'consumers') setNewConsumer('');
                      else setNewMetric('');
                    }}
                  >
                    <Plus size={14} />
                    {t('editor.addControl')}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
