import { useI18n } from '../i18n';
import type { Dashboard, EntityState, Profile, Tile } from '../../shared/model';
import { availableCommands } from '../../shared/widgets';
import { iconChoices } from '../ui/widget-icons';
import { TextInput as RawTextInput } from './TextInput';
function TextInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <RawTextInput value={value} onValue={onCommit} />
    </label>
  );
}
export function TileExperienceSettings({
  tile,
  catalog,
  pages,
  update,
}: {
  tile: Tile;
  catalog: EntityState[];
  pages: Dashboard['pages'];
  update: (patch: Partial<Tile>) => void;
}) {
  const { t } = useI18n();
  const x = tile.experience ?? {};
  const patch = (p: Partial<NonNullable<Tile['experience']>>) =>
    update({ experience: { ...x, ...p }, ...('tap' in p ? { navigateTo: undefined } : {}) });
  const entity = catalog.find((e) => e.entity_id === tile.entityId);
  const actions = availableCommands(tile.kind, entity, catalog);
  const gesture = (key: 'tap' | 'hold') => {
    const v =
      x[key] ??
      (key === 'tap' && tile.navigateTo
        ? { type: 'navigate' as const, pageId: tile.navigateTo }
        : { type: key === 'tap' ? ('automatic' as const) : ('details' as const) });
    return (
      <fieldset>
        <legend>{t(`v2.${key}`)}</legend>
        <select
          aria-label={t(`v2.${key}`)}
          value={v.type}
          onChange={(e) =>
            patch({
              [key]: {
                type: e.target.value as typeof v.type,
                ...(e.target.value === 'command' ? { command: actions[0] ?? 'activate' } : {}),
                ...(e.target.value === 'navigate' ? { pageId: pages[0]?.id } : {}),
              },
            })
          }
        >
          {(
            [
              'automatic',
              'details',
              'none',
              'navigate',
              ...(actions.length ? ['command'] : []),
            ] as const
          ).map((type) => (
            <option key={type} value={type}>
              {t(`v2.${type}` as 'v2.automatic')}
            </option>
          ))}
        </select>
        {v.type === 'navigate' && (
          <select
            aria-label={t('v2.home')}
            value={v.pageId}
            onChange={(e) => patch({ [key]: { ...v, pageId: e.target.value } })}
          >
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        {v.type === 'command' && (
          <>
            <select
              aria-label={t('v2.command')}
              value={v.command}
              onChange={(e) =>
                patch({
                  [key]: {
                    ...v,
                    command: e.target.value as typeof v.command,
                    value: undefined,
                    option: undefined,
                  },
                })
              }
            >
              {actions
                .filter((c) => c !== 'color' && c !== 'temperature_range')
                .map((command) => (
                  <option key={command} value={command}>
                    {t(`v2.${command}` as 'v2.activate')}
                  </option>
                ))}
            </select>
            {[
              'brightness',
              'temperature',
              'position',
              'volume',
              'number',
              'fan_speed',
              'tilt',
              'color_temp',
            ].includes(v.command ?? '') && (
              <label>
                {t('v2.value')}
                <input
                  type="number"
                  value={v.value ?? 0}
                  onChange={(e) => patch({ [key]: { ...v, value: Number(e.target.value) } })}
                />
              </label>
            )}
            {['select', 'preset', 'hvac', 'climate_fan', 'swing'].includes(v.command ?? '') && (
              <TextInput
                label={t('v2.select')}
                value={v.option ?? ''}
                onCommit={(option) => patch({ [key]: { ...v, option } })}
              />
            )}
            <label className="v2-check">
              <input
                type="checkbox"
                checked={v.confirm ?? false}
                onChange={(e) => patch({ [key]: { ...v, confirm: e.target.checked } })}
              />
              {t('v2.confirm')}
            </label>
          </>
        )}
      </fieldset>
    );
  };
  return (
    <details className="form-section v2-settings">
      <summary>{t('v2.experience')}</summary>
      <label>
        {t('v2.icon')}
        <select value={x.icon ?? ''} onChange={(e) => patch({ icon: e.target.value || undefined })}>
          <option value="">{t('v2.default')}</option>
          {Object.keys(iconChoices).map((key) => (
            <option key={key} value={key}>
              {t(`icon.${key}` as 'icon.House')}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('v2.background')}
        <select
          value={x.background ?? 'default'}
          onChange={(e) => patch({ background: e.target.value as typeof x.background })}
        >
          {['default', 'none', 'pastel'].map((value) => (
            <option key={value} value={value}>
              {t(`v2.${value}` as 'v2.default')}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('v2.presentation')}
        <select
          value={x.presentation ?? 'auto'}
          onChange={(e) => patch({ presentation: e.target.value as typeof x.presentation })}
        >
          {[
            'auto',
            'value',
            ...(['light', 'automation', 'alarm', 'contacts'].includes(tile.kind) && !tile.room
              ? ['compact']
              : []),
            ...(['sensor', 'number'].includes(tile.kind) ? ['graph'] : []),
          ].map((v) => (
            <option key={v} value={v}>
              {t(v === 'compact' ? 'v2.compactQuick' : (`v2.${v}` as 'v2.auto'))}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('v2.secondary')}
        <select
          value={x.secondary ?? 'auto'}
          onChange={(e) => patch({ secondary: e.target.value as typeof x.secondary })}
        >
          {['auto', 'none', 'attribute', 'text'].map((v) => (
            <option key={v} value={v}>
              {t(`v2.${v}` as 'v2.auto')}
            </option>
          ))}
        </select>
      </label>
      {['attribute', 'text'].includes(x.secondary ?? '') && (
        <TextInput
          label={t('v2.secondaryText')}
          value={x.secondaryText ?? ''}
          onCommit={(secondaryText) => patch({ secondaryText })}
        />
      )}
      <label className="v2-check">
        <input
          type="checkbox"
          checked={x.locked ?? false}
          onChange={(e) => patch({ locked: e.target.checked })}
        />
        {t('v2.locked')}
      </label>
      {gesture('tap')}
      {gesture('hold')}
      <label className="v2-check">
        <input
          type="checkbox"
          checked={Boolean(x.visibleWhen)}
          onChange={(e) =>
            patch({
              visibleWhen: e.target.checked
                ? {
                    entityId: tile.entityId || catalog[0]?.entity_id || 'sensor.example',
                    operator: 'is',
                    value: 'on',
                  }
                : undefined,
            })
          }
        />
        {t('v2.visibleWhen')}
      </label>
      {x.visibleWhen && (
        <>
          <select
            aria-label={t('v2.conditionEntity')}
            value={x.visibleWhen.entityId}
            onChange={(e) =>
              patch({ visibleWhen: { ...x.visibleWhen!, entityId: e.target.value } })
            }
          >
            {catalog.map((e) => (
              <option key={e.entity_id} value={e.entity_id}>
                {String(e.attributes.friendly_name ?? e.entity_id)}
              </option>
            ))}
          </select>
          <select
            aria-label={t('v2.visibleWhen')}
            value={x.visibleWhen.operator}
            onChange={(e) =>
              patch({ visibleWhen: { ...x.visibleWhen!, operator: e.target.value as 'is' } })
            }
          >
            {['is', 'is_not', 'above', 'below'].map((v) => (
              <option key={v} value={v}>
                {t(`v2.${v}` as 'v2.is')}
              </option>
            ))}
          </select>
          <TextInput
            label={t('v2.conditionValue')}
            value={x.visibleWhen.value}
            onCommit={(value) => patch({ visibleWhen: { ...x.visibleWhen!, value } })}
          />
        </>
      )}
      {tile.kind === 'media' && (
        <fieldset>
          <legend>{t('v2.favorite')}</legend>
          <TextInput
            label={t('v2.favoriteId')}
            value={tile.mediaFavorite?.id ?? ''}
            onCommit={(id) =>
              update({
                mediaFavorite: id ? { id, type: tile.mediaFavorite?.type ?? 'music' } : undefined,
              })
            }
          />
          {tile.mediaFavorite && (
            <TextInput
              label={t('v2.favoriteType')}
              value={tile.mediaFavorite.type}
              onCommit={(type) => update({ mediaFavorite: { ...tile.mediaFavorite!, type } })}
            />
          )}
          <p className="field-hint">{t('v2.favoriteHint')}</p>
        </fieldset>
      )}
    </details>
  );
}
export function ProfileExperienceSettings({
  profile,
  pages,
  update,
}: {
  profile: Profile;
  pages: Dashboard['pages'];
  update: (patch: Partial<Profile>) => void;
}) {
  const { t } = useI18n();
  const x = profile.experience ?? {};
  const patch = (p: Partial<NonNullable<Profile['experience']>>) =>
    update({ experience: { ...x, ...p } });
  return (
    <div className="form-section v2-settings">
      <h3>{t('v2.experience')}</h3>
      {(['density', 'colorMode', 'background'] as const)
        .filter((key) => !profile.design || key === 'density')
        .map((key) => (
          <label key={key}>
            {t(`v2.${key}`)}
            <select
              value={
                x[key] ?? (key === 'density' ? 'normal' : key === 'colorMode' ? 'dark' : 'gradient')
              }
              onChange={(e) => patch({ [key]: e.target.value })}
            >
              {(key === 'density'
                ? ['comfortable', 'normal', 'compact']
                : key === 'colorMode'
                  ? ['dark', 'light', 'auto']
                  : ['gradient', 'plain']
              ).map((v) => (
                <option key={v} value={v}>
                  {t(`v2.${v}` as 'v2.normal')}
                </option>
              ))}
            </select>
          </label>
        ))}
      {(['adaptive', 'swipe'] as const).map((key) => (
        <label className="v2-check" key={key}>
          <input
            type="checkbox"
            checked={x[key] ?? false}
            onChange={(e) => patch({ [key]: e.target.checked })}
          />
          {t(`v2.${key}`)}
        </label>
      ))}
      <label>
        {t('v2.home')}
        <select
          value={x.homePageId ?? pages[0]?.id}
          onChange={(e) => patch({ homePageId: e.target.value })}
        >
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {(
        [
          'maxLiveStreams',
          'autoHomeSeconds',
          'idleSeconds',
          'nightStart',
          'nightEnd',
          'safeTop',
          'safeBottom',
        ] as const
      ).map((key) => (
        <label key={key}>
          {t(
            (
              {
                maxLiveStreams: 'v2.maxLiveStreams',
                autoHomeSeconds: 'v2.autoHome',
                idleSeconds: 'v2.idle',
                nightStart: 'v2.nightStart',
                nightEnd: 'v2.nightEnd',
                safeTop: 'v2.safeTop',
                safeBottom: 'v2.safeBottom',
              } as const
            )[key],
          )}
          <input
            type="number"
            min={key === 'maxLiveStreams' ? 1 : 0}
            max={
              key === 'maxLiveStreams'
                ? 8
                : key.startsWith('night')
                  ? 23
                  : key.startsWith('safe')
                    ? 120
                    : 86400
            }
            value={
              x[key] ??
              (key === 'maxLiveStreams'
                ? 2
                : key === 'nightStart'
                  ? 22
                  : key === 'nightEnd'
                    ? 7
                    : 0)
            }
            onChange={(e) => patch({ [key]: Number(e.target.value) })}
          />
        </label>
      ))}
    </div>
  );
}
