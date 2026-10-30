import type { Control, EntityState } from '../../shared/model';
import { lightDimming } from '../../shared/lights';
import { useI18n } from '../i18n';

export function LightSettings({
  control,
  catalog,
  update,
}: {
  control: Pick<Control, 'entityId' | 'light'>;
  catalog: EntityState[];
  update: (light: NonNullable<Control['light']>) => void;
}) {
  const { t } = useI18n();
  const options = { allowTurnOn: true, allowTurnOff: true, showBrightness: true, ...control.light };
  const capability = lightDimming(
    control.entityId,
    Object.fromEntries(catalog.map((entity) => [entity.entity_id, entity])),
  );
  return (
    <fieldset className="light-settings">
      <legend>{t('light.settings')}</legend>
      {(['allowTurnOn', 'allowTurnOff'] as const).map((key) => (
        <label className="alarm-setting-toggle" key={key}>
          <input
            type="checkbox"
            checked={options[key]}
            onChange={(event) => update({ ...options, [key]: event.target.checked })}
          />
          <span>{t(key === 'allowTurnOn' ? 'light.allowOn' : 'light.allowOff')}</span>
        </label>
      ))}
      <p className="field-hint">
        {t(
          options.allowTurnOn && options.allowTurnOff
            ? 'light.toggleHint'
            : options.allowTurnOn
              ? 'light.onlyOnHint'
              : options.allowTurnOff
                ? 'light.onlyOffHint'
                : 'light.readOnlyHint',
        )}
      </p>
      {capability.dimmable && options.allowTurnOn && options.allowTurnOff ? (
        <label className="alarm-setting-toggle">
          <input
            type="checkbox"
            checked={options.showBrightness}
            onChange={(event) => update({ ...options, showBrightness: event.target.checked })}
          />
          <span>{t('light.showBrightness')}</span>
        </label>
      ) : (
        <p className="field-hint">
          {t(
            !options.allowTurnOn || !options.allowTurnOff
              ? 'light.dimmingRestricted'
              : capability.reason === 'mixed'
                ? 'light.mixedHint'
                : capability.reason === 'unknown'
                  ? 'light.unknownHint'
                  : 'light.onOffHint',
          )}
        </p>
      )}
    </fieldset>
  );
}
