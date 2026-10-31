import { useState } from 'react';
import { useI18n } from '../i18n';
import type { Dashboard, EntityState } from '../../shared/model';
import { reviewDashboard, replaceEntity } from '../../shared/experience';
import { createTemplateView } from '../../shared/designer';
import { layoutId } from '../../shared/display-layouts';
import { Modal } from '../ui/Modal';
import { TextInput } from './TextInput';
export function ReviewDialog({
  document,
  catalog,
  onChange,
  onLocate,
  onPublish,
  onClose,
  focusProfileId,
}: {
  document: Dashboard;
  focusProfileId?: string;
  catalog: EntityState[];
  onChange: (document: Dashboard) => boolean;
  onLocate: (profile: string, page: string, tile: string) => void;
  onPublish: () => void;
  onClose: () => void;
}) {
  const { t, describeError } = useI18n();
  const issues = reviewDashboard(document, catalog);
  const [filter, setFilter] = useState(focusProfileId ?? document.profiles[0].id);
  const [replacement, setReplacement] = useState<Record<string, string>>({}),
    [error, setError] = useState('');
  return (
    <Modal title={t('v2.reviewTitle')} wide onClose={onClose} message={error}>
      <label>
        {t('v2.allowedProfiles')}
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">
            {t('v2.allProfiles')} · {issues.length}
          </option>
          {document.profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name} · {issues.filter((issue) => issue.profileId === profile.id).length}
            </option>
          ))}
        </select>
      </label>
      {!issues.length && <p>{t('v2.reviewClean')}</p>}
      <div className="v2-review-list">
        {issues
          .filter((issue) => !filter || issue.profileId === filter)
          .map((issue, i) => {
            const tile = document.pages
              .find((p) => p.id === issue.pageId)!
              .tiles.find((t) => t.id === issue.tileId)!;
            return (
              <article key={i} data-severity={issue.severity}>
                <div>
                  <strong>{issue.title}</strong>
                  <p>{t(`v2.${issue.key}`)}</p>
                  <small>
                    {document.profiles.find((p) => p.id === issue.profileId)?.name} ·{' '}
                    {document.pages.find((p) => p.id === issue.pageId)?.name}
                  </small>
                </div>
                <button
                  className="button"
                  onClick={() => onLocate(issue.profileId, issue.pageId, issue.tileId)}
                >
                  {t('v2.locate')}
                </button>
                {issue.key === 'missingEntity' && (
                  <div>
                    <select
                      aria-label={t('v2.replaceWith')}
                      value={replacement[issue.tileId] ?? ''}
                      onChange={(e) =>
                        setReplacement({ ...replacement, [issue.tileId]: e.target.value })
                      }
                    >
                      <option value="">{t('v2.replaceWith')}</option>
                      {catalog
                        .filter((e) => e.entity_id.split('.')[0] === tile.entityId.split('.')[0])
                        .map((e) => (
                          <option key={e.entity_id} value={e.entity_id}>
                            {String(e.attributes.friendly_name ?? e.entity_id)}
                          </option>
                        ))}
                    </select>
                    <button
                      className="button"
                      disabled={!replacement[issue.tileId]}
                      onClick={() => {
                        try {
                          onChange(
                            replaceEntity(document, tile.entityId, replacement[issue.tileId]),
                          );
                        } catch (e) {
                          setError(describeError(e));
                        }
                      }}
                    >
                      {t('v2.replace')}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
      </div>
      <button
        className="button primary"
        disabled={issues.some((i) => i.key === 'brokenNavigation')}
        onClick={onPublish}
      >
        {t(issues.length ? 'v2.publishAnyway' : 'editor.publish')}
      </button>
    </Modal>
  );
}
export function TemplateDialog({
  document,
  profileId,
  catalog,
  onChange,
  onClose,
}: {
  document: Dashboard;
  profileId: string;
  catalog: EntityState[];
  onChange: (document: Dashboard, pageId: string) => void;
  onClose: () => void;
}) {
  const { t, describeError } = useI18n();
  const [template, setTemplate] = useState<'room' | 'camera' | 'energy' | 'blank'>('room'),
    [area, setArea] = useState(''),
    [name, setName] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState('');
  const areas = [
    ...new Map(catalog.filter((e) => e.area).map((e) => [e.area!.id, e.area!])).values(),
  ];
  const choices = catalog.filter(
    (e) =>
      (!area || e.area?.id === area) &&
      (template !== 'camera' || e.entity_id.startsWith('camera.')) &&
      (template !== 'energy' || ['W', 'kW'].includes(String(e.attributes.unit_of_measurement))),
  );
  return (
    <Modal title={t('v2.wizard')} wide onClose={onClose} message={error}>
      <p>{t('v2.templateHint')}</p>
      {template === 'energy' && (
        <p className="notice">
          {t('energy.solar')}: {t('v2.source')}
        </p>
      )}
      <div className="v2-form-grid">
        <label>
          {t('v2.wizard')}
          <select
            value={template}
            onChange={(e) => {
              setTemplate(e.target.value as typeof template);
              setSelected([]);
            }}
          >
            {(['room', 'camera', 'energy', 'blank'] as const).map((v) => (
              <option key={v} value={v}>
                {t(`v2.${v}Template`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('v2.viewName')}
          <TextInput value={name} onValue={setName} />
        </label>
        <label>
          {t('v2.allRooms')}
          <select
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setSelected([]);
            }}
          >
            <option value="">{t('v2.allRooms')}</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.floor ? a.floor + ' · ' : ''}
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {template !== 'blank' && (
        <div className="v2-entity-choices">
          {choices.map((e) => (
            <label className="v2-check" key={e.entity_id}>
              <input
                type={template === 'energy' ? 'radio' : 'checkbox'}
                name={template === 'energy' ? 'solar-source' : undefined}
                checked={selected.includes(e.entity_id)}
                onChange={(event) =>
                  setSelected(
                    template === 'energy'
                      ? [e.entity_id]
                      : event.target.checked
                        ? [...selected, e.entity_id]
                        : selected.filter((id) => id !== e.entity_id),
                  )
                }
              />
              <span>
                {String(e.attributes.friendly_name ?? e.entity_id)}
                <small>{e.area?.name ?? e.entity_id}</small>
              </span>
            </label>
          ))}
        </div>
      )}
      <button
        className="button primary"
        disabled={!name.trim() || (template !== 'blank' && !selected.length)}
        onClick={() => {
          try {
            const result = createTemplateView(
              document,
              profileId,
              name.trim(),
              catalog.filter((e) => selected.includes(e.entity_id)),
              template,
            );
            onChange(result.document, result.pageId);
          } catch (e) {
            setError(describeError(e));
          }
        }}
      >
        {t('v2.create')}
      </button>
    </Modal>
  );
}
export function AlertSettings({
  document,
  catalog,
  update,
}: {
  document: Dashboard;
  catalog: EntityState[];
  update: (document: Dashboard) => void;
}) {
  const { t } = useI18n();
  const rules = document.alerts ?? [];
  const patch = (id: string, values: Partial<(typeof rules)[number]>) =>
    update({
      ...document,
      alerts: rules.map((rule) => (rule.id === id ? { ...rule, ...values } : rule)),
    });
  return (
    <div className="v2-settings">
      <p className="muted">{t('v2.alertHint')}</p>
      {rules.map((rule) => (
        <fieldset key={rule.id}>
          <legend>{rule.title}</legend>
          <p className="field-hint">
            Home Assistant: <code>event: hapanel_alert</code> ·{' '}
            <code>
              event_data: {'{'}rule_id: {rule.id}
              {'}'}
            </code>
          </p>
          <div className="v2-form-grid">
            <label>
              {t('v2.alertTitle')}
              <TextInput
                value={rule.title}
                required
                maxLength={100}
                onValue={(title) => patch(rule.id, { title })}
              />
            </label>
            <label>
              {t('v2.alertMessage')}
              <TextInput
                value={rule.message}
                maxLength={300}
                onValue={(message) => patch(rule.id, { message })}
              />
            </label>
            <label>
              {t('v2.conditionEntity')}
              <select
                value={rule.condition.entityId}
                onChange={(e) =>
                  patch(rule.id, { condition: { ...rule.condition, entityId: e.target.value } })
                }
              >
                {catalog.map((e) => (
                  <option key={e.entity_id} value={e.entity_id}>
                    {String(e.attributes.friendly_name ?? e.entity_id)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('v2.visibleWhen')}
              <select
                value={rule.condition.operator}
                onChange={(e) =>
                  patch(rule.id, {
                    condition: { ...rule.condition, operator: e.target.value as 'is' },
                  })
                }
              >
                {['is', 'is_not', 'above', 'below'].map((v) => (
                  <option key={v} value={v}>
                    {t(`v2.${v}` as 'v2.is')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('v2.conditionValue')}
              <TextInput
                value={rule.condition.value}
                onValue={(value) => patch(rule.id, { condition: { ...rule.condition, value } })}
              />
            </label>
            <label>
              {t('v2.alertTimeout')}
              <input
                type="number"
                min={5}
                max={600}
                value={rule.timeout}
                onChange={(e) => patch(rule.id, { timeout: Number(e.target.value) })}
              />
            </label>
            <label>
              {t('v2.priority')}
              <select
                value={rule.priority}
                onChange={(e) => patch(rule.id, { priority: e.target.value as 'info' })}
              >
                {['info', 'warning', 'critical'].map((v) => (
                  <option key={v} value={v}>
                    {t(`v2.${v}` as 'v2.info')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('v2.alertCamera')}
              <select
                value={rule.cameraTileId ?? ''}
                onChange={(e) => patch(rule.id, { cameraTileId: e.target.value || undefined })}
              >
                <option value="">{t('v2.none')}</option>
                {document.pages
                  .flatMap((p) => p.tiles)
                  .filter((t) => t.kind === 'camera')
                  .map((tile) => (
                    <option key={tile.id} value={tile.id}>
                      {tile.title}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="v2-button-row">
            {document.profiles.map((profile) => (
              <label className="v2-check" key={profile.id}>
                <input
                  type="checkbox"
                  checked={!rule.profileIds || rule.profileIds.includes(profile.id)}
                  onChange={(e) =>
                    patch(rule.id, {
                      profileIds: e.target.checked
                        ? [
                            ...new Set([
                              ...(rule.profileIds ?? document.profiles.map((p) => p.id)),
                              profile.id,
                            ]),
                          ]
                        : (rule.profileIds ?? document.profiles.map((p) => p.id)).filter(
                            (id) => id !== profile.id,
                          ),
                    })
                  }
                />
                {profile.name}
              </label>
            ))}
          </div>
          <button
            className="button danger"
            onClick={() => update({ ...document, alerts: rules.filter((r) => r.id !== rule.id) })}
          >
            {t('editor.remove')}
          </button>
        </fieldset>
      ))}
      <button
        className="button"
        disabled={rules.length >= 24 || !catalog.length}
        onClick={() =>
          update({
            ...document,
            alerts: [
              ...rules,
              {
                id: layoutId('alert'),
                title: t('v2.alerts'),
                message: '',
                condition: {
                  entityId:
                    catalog.find((e) => e.entity_id.startsWith('binary_sensor.'))?.entity_id ??
                    catalog[0].entity_id,
                  operator: 'is',
                  value: 'on',
                },
                timeout: 30,
                priority: 'info',
              },
            ],
          })
        }
      >
        {t('v2.addAlert')}
      </button>
    </div>
  );
}
