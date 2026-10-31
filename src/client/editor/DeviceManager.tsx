import { localizeSampleDocument } from '../../shared/demo';
import { useEffect, useState } from 'react';
import type { Dashboard, Profile } from '../../shared/model';
import type { DeviceSettings } from '../../server/store';
import { api } from '../service';
import { useI18n } from '../i18n';
import { Modal } from '../ui/Modal';
import { TextInput } from './TextInput';
type Device = {
  id: string;
  name: string;
  expires?: number;
  settings?: DeviceSettings;
  observation?: { width: number; height: number; dpr: number; lastSeen: number };
};
export function DeviceManager({
  document: sourceDocument,
  enabled,
  onClose,
  onCalibrate,
}: {
  document: Dashboard;
  enabled: boolean;
  onClose: () => void;
  onCalibrate: (id: string, patch: Partial<Profile>) => void;
}) {
  const { t, intlLocale, describeError, language } = useI18n();
  const document = localizeSampleDocument(sourceDocument, language);
  const [devices, setDevices] = useState<Device[]>([]),
    [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [revoke, setRevoke] = useState<string>(),
    [viewer, setViewer] = useState(''),
    [viewerSettings, setViewerSettings] = useState<DeviceSettings>({}),
    [viewers, setViewers] = useState<Record<string, DeviceSettings>>({});
  const [users, setUsers] = useState<{ id: string; name: string; admin: boolean }[]>([]);
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setError('');
    } catch (e) {
      setError(describeError(e));
    }
  };
  const load = (preserveEdits = false) =>
    api<Device[]>('api/editor/devices').then((next) =>
      setDevices((current) =>
        preserveEdits
          ? next.map((device) => ({
              ...device,
              settings: current.find((item) => item.id === device.id)?.settings ?? device.settings,
            }))
          : next,
      ),
    );
  useEffect(() => {
    void run(async () => {
      await load();
      setViewers(await api('api/editor/viewers'));
      setUsers(await api('api/editor/users'));
    });
    const timer = setInterval(() => void load(true).catch(() => undefined), 30000);
    return () => clearInterval(timer);
  }, []);
  const settings = (value: DeviceSettings, patch: (value: DeviceSettings) => void) => (
    <div className="v2-form-grid">
      <label>
        {t('v2.assignment')}
        <select
          value={value.profileId ?? ''}
          onChange={(e) =>
            patch({ ...value, profileId: e.target.value || undefined, pageId: undefined })
          }
        >
          <option value="">{t('v2.noAssignment')}</option>
          {document.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('v2.home')}
        <select
          value={value.pageId ?? ''}
          onChange={(e) => patch({ ...value, pageId: e.target.value || undefined })}
        >
          <option value="">{t('v2.default')}</option>
          {document.pages
            .filter(
              (p) => !value.profileId || !p.profileIds || p.profileIds.includes(value.profileId),
            )
            .map((p) => (
              <option key={p.id} value={p.id}>
                {!value.profileId
                  ? (document.profiles.find((profile) => p.profileIds?.includes(profile.id))
                      ?.name ?? '') + ' · '
                  : ''}
                {p.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        {t('language.label')}
        <select
          value={value.language ?? 'auto'}
          onChange={(e) =>
            patch({ ...value, language: e.target.value as DeviceSettings['language'] })
          }
        >
          <option value="auto">{t('v2.auto')}</option>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
      </label>
      {(['readOnly', 'cameraBlocked', 'alarmBlocked'] as const).map((key) => (
        <label key={key} className="v2-check">
          <input
            type="checkbox"
            checked={value[key] ?? false}
            onChange={(e) => patch({ ...value, [key]: e.target.checked })}
          />
          {t(`v2.${key}`)}
        </label>
      ))}
      <fieldset className="v2-profile-access">
        <legend>{t('v2.allowedProfiles')}</legend>
        <label className="v2-check">
          <input
            type="checkbox"
            checked={!value.allowedProfiles}
            onChange={(e) =>
              patch({
                ...value,
                allowedProfiles: e.target.checked
                  ? undefined
                  : [value.profileId ?? document.profiles[0].id],
              })
            }
          />
          {t('v2.allProfiles')}
        </label>
        {value.allowedProfiles &&
          document.profiles.map((p) => (
            <label key={p.id} className="v2-check">
              <input
                type="checkbox"
                checked={value.allowedProfiles?.includes(p.id) ?? false}
                disabled={
                  value.allowedProfiles?.length === 1 && value.allowedProfiles.includes(p.id)
                }
                onChange={(e) =>
                  patch({
                    ...value,
                    allowedProfiles: e.target.checked
                      ? [...value.allowedProfiles!, p.id]
                      : value.allowedProfiles!.filter((id) => id !== p.id),
                  })
                }
              />
              {p.name}
            </label>
          ))}
      </fieldset>
    </div>
  );
  return (
    <Modal
      title={t('v2.devices')}
      wide
      onClose={onClose}
      message={error}
      onDismissMessage={() => setError('')}
    >
      <p className="muted">{t('editor.pairingHint')}</p>
      {!enabled && <p className="notice">{t('editor.displayPortDisabled')}</p>}
      <button
        className="button primary"
        onClick={() =>
          void run(async () =>
            setCode((await api<{ code: string }>('api/editor/pair-code', {})).code),
          )
        }
      >
        {t('editor.createCode')}
      </button>
      {code && (
        <div className="pair-code">
          {code.slice(0, 5)}-{code.slice(5)}
        </div>
      )}
      <div className="v2-device-list">
        {devices.map((device) => (
          <article key={device.id}>
            <h3>{device.name}</h3>
            <p>
              {device.observation
                ? `${device.observation.width} × ${device.observation.height} CSS px · DPR ${device.observation.dpr} · ${t('v2.lastSeen')}: ${new Date(device.observation.lastSeen).toLocaleString(intlLocale)}`
                : t('v2.neverSeen')}
            </p>
            {settings(device.settings ?? {}, (value) =>
              setDevices(devices.map((d) => (d.id === device.id ? { ...d, settings: value } : d))),
            )}
            <div className="v2-button-row">
              <button
                className="button primary"
                onClick={() =>
                  void run(async () => {
                    await api(`api/editor/devices/${device.id}`, device.settings ?? {}, 'PUT');
                    await load();
                  })
                }
              >
                {t('v2.saveDevice')}
              </button>
              <button
                className="button"
                onClick={() => void run(() => api(`api/editor/devices/${device.id}/identify`, {}))}
              >
                {t('v2.identify')}
              </button>
              <button
                className="button"
                disabled={!device.observation || !device.settings?.profileId}
                onClick={() => {
                  const v = device.observation!;
                  try {
                    onCalibrate(device.settings!.profileId!, {
                      width: Math.max(320, v.width),
                      height: Math.max(240, v.height),
                      dpr: Math.max(0.5, Math.min(4, v.dpr)),
                      experience: {
                        ...document.profiles.find((p) => p.id === device.settings!.profileId)
                          ?.experience,
                        hideToolbar: true,
                      },
                    });
                    setError(t('v2.calibrated'));
                  } catch (e) {
                    setError(describeError(e));
                  }
                }}
              >
                {t('v2.calibrate')}
              </button>
              <button className="button danger" onClick={() => setRevoke(device.id)}>
                {t('editor.revoke')}
              </button>
            </div>
            {revoke === device.id && (
              <div className="notice">
                <p>{t('display.revokeHint')}</p>
                <button className="button" onClick={() => setRevoke(undefined)}>
                  {t('common.cancel')}
                </button>
                <button
                  className="button danger"
                  onClick={() =>
                    void run(async () => {
                      await api(`api/editor/devices/${device.id}`, {}, 'DELETE');
                      setRevoke(undefined);
                      await load();
                    })
                  }
                >
                  {t('editor.revoke')}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      <fieldset className="v2-viewer-settings">
        <legend>{t('v2.viewerId')}</legend>
        <p>{t('v2.viewerHint')}</p>
        {users.length > 0 && (
          <label>
            {t('v2.viewerUser')}
            <select
              value={viewer}
              onChange={(e) => {
                setViewer(e.target.value);
                setViewerSettings(viewers[e.target.value] ?? {});
              }}
            >
              <option value="">{t('v2.default')}</option>
              {users
                .filter((user) => !user.admin)
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <details>
          <summary>{t('v2.manualUserId')}</summary>
          <label>
            {t('v2.viewerId')}
            <TextInput
              value={viewer}
              onValue={(id) => {
                setViewer(id);
                setViewerSettings(viewers[id] ?? {});
              }}
              list="known-viewers"
            />
          </label>
        </details>
        <datalist id="known-viewers">
          {Object.keys(viewers).map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
        {settings(viewerSettings, setViewerSettings)}
        <button
          className="button"
          disabled={!/^[a-zA-Z0-9_-]{1,100}$/.test(viewer)}
          onClick={() =>
            void run(async () => {
              await api(`api/editor/viewers/${viewer}`, viewerSettings, 'PUT');
              setViewers({ ...viewers, [viewer]: viewerSettings });
            })
          }
        >
          {t('v2.saveViewer')}
        </button>
      </fieldset>
    </Modal>
  );
}
