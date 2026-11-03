import { useRef, useState } from 'react';
import { Download, Upload, Palette, Save, Trash2 } from 'lucide-react';
import { designPresets, exportDesign, parseDesignFile, type Design } from '../../shared/design';
import { layoutId } from '../../shared/display-layouts';
import { createGlassOverview } from '../../shared/glass-layout';
import { pagesForProfile, type Dashboard, type Profile } from '../../shared/model';
import { useI18n } from '../i18n';
import { TextInput } from './TextInput';

export function DesignSettings({
  profile,
  document,
  update,
  change,
  notify,
  onOverview,
}: {
  profile: Profile;
  document: Dashboard;
  update: (patch: Partial<Profile>) => void;
  change: (fn: (draft: Dashboard) => void) => boolean;
  notify: (message: string) => void;
  onOverview?: (document: Dashboard, pageId: string) => void;
}) {
  const { t, language, describeError } = useI18n();
  const [name, setName] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const d = profile.design ?? designPresets.glassDark;
  const patch = (value: Partial<Design>) => update({ design: { ...d, ...value } });
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([exportDesign(name.trim() || profile.name, d)], { type: 'application/json' }),
    );
    const a = window.document.createElement('a');
    a.href = url;
    a.download = 'hapanel-design.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <div className="inspector-tile-title">
        <span className="inspector-tile-icon">
          <Palette size={24} />
        </span>
        <div>
          <h2>{t('design.title')}</h2>
          <p>{profile.name}</p>
        </div>
      </div>
      <p className="field-hint">{t('design.hint')}</p>
      <div className="form-section">
        <h3>{t('design.presets')}</h3>
        <div className="design-presets">
          {Object.entries(designPresets).map(([id, value]) => (
            <button
              key={id}
              className={
                'design-preset ' +
                (JSON.stringify(d) === JSON.stringify(value) && profile.design ? 'active' : '')
              }
              onClick={() => update({ design: structuredClone(value) })}
            >
              <span
                style={{
                  background: `linear-gradient(140deg, ${value.background}, ${value.accent})`,
                  borderRadius: value.radius / 2,
                }}
              />
              <strong>{t(`design.${id}` as 'design.glassDark')}</strong>
            </button>
          ))}
        </div>
        <button
          className="button full-width"
          disabled={!profile.design}
          onClick={() => update({ design: undefined })}
        >
          {t('design.classic')}
        </button>
      </div>
      <div className="form-section">
        <h3>{t('design.customize')}</h3>
        <label>
          {t('design.surface')}
          <select
            value={d.surface}
            onChange={(e) => patch({ surface: e.target.value as Design['surface'] })}
          >
            {(['glass', 'solid'] as const).map((x) => (
              <option key={x} value={x}>
                {t(`design.${x}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('design.scheme')}
          <select
            value={d.scheme}
            onChange={(e) => patch({ scheme: e.target.value as Design['scheme'] })}
          >
            {(['dark', 'light', 'auto'] as const).map((x) => (
              <option key={x} value={x}>
                {t(`design.${x}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('design.wallpaper')}
          <select
            value={d.wallpaper}
            onChange={(e) => patch({ wallpaper: e.target.value as Design['wallpaper'] })}
          >
            {(['landscape', 'aurora', 'gradient', 'plain'] as const).map((x) => (
              <option key={x} value={x}>
                {t(`design.${x}`)}
              </option>
            ))}
          </select>
        </label>
        {(['background', 'tint', 'accent'] as const).map((key) => (
          <label className="design-color" key={key}>
            {t(`design.${key}`)}
            <input
              aria-label={t(`design.${key}`)}
              type="color"
              value={d[key]}
              onChange={(e) => patch({ [key]: e.target.value })}
            />
            <code>{d[key]}</code>
          </label>
        ))}
        {(
          [
            ['opacity', 4, 95, 1, '%'],
            ['blur', 0, 40, 1, 'px'],
            ['saturation', 70, 180, 1, '%'],
            ['border', 0, 70, 1, '%'],
            ['shadow', 0, 50, 1, '%'],
            ['radius', 6, 40, 1, 'px'],
            ['textScale', 0.8, 1.25, 0.05, '×'],
          ] as const
        ).map(([key, min, max, step, unit]) => (
          <label key={key} className="design-range">
            <span>
              {t(`design.${key}`)}
              <output>
                {Number(d[key].toFixed(2))}
                {unit}
              </output>
            </span>
            <input
              aria-label={t(`design.${key}`)}
              type="range"
              min={min}
              max={max}
              step={step}
              value={d[key]}
              onChange={(e) => patch({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
        <p className="field-hint">{t('design.performance')}</p>
      </div>
      <div className="form-section">
        <h3>{t('design.library')}</h3>
        <label>
          {t('design.name')}
          <TextInput value={name} onValue={setName} maxLength={64} />
        </label>
        <button
          className="button full-width"
          disabled={!name.trim() || (document.designs?.length ?? 0) >= 24}
          onClick={() => {
            if (
              change((doc) => {
                (doc.designs ??= []).push({
                  id: layoutId('design'),
                  name: name.trim(),
                  appearance: structuredClone(d),
                });
              })
            )
              notify(t('design.saved'));
          }}
        >
          <Save size={16} />
          {t('design.save')}
        </button>
        {(document.designs ?? []).map((saved) => (
          <div className="design-library-row" key={saved.id}>
            <button
              className="button"
              onClick={() => update({ design: structuredClone(saved.appearance) })}
            >
              {saved.name}
            </button>
            <button
              className="icon-button"
              aria-label={t('design.remove', { name: saved.name })}
              onClick={() =>
                change((doc) => {
                  doc.designs = doc.designs?.filter((x) => x.id !== saved.id);
                })
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="v2-button-row">
          <button className="button" onClick={download}>
            <Download size={16} />
            {t('design.export')}
          </button>
          <button className="button" onClick={() => file.current?.click()}>
            <Upload size={16} />
            {t('design.import')}
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const input = e.currentTarget,
              selected = input.files?.[0];
            try {
              if (!selected) return;
              if (selected.size > 16384) throw new Error();
              const imported = parseDesignFile(await selected.text());
              if ((document.designs?.length ?? 0) >= 24) throw new Error();
              if (
                change((doc) => {
                  doc.profiles.find((p) => p.id === profile.id)!.design = structuredClone(
                    imported.appearance,
                  );
                  (doc.designs ??= []).push({
                    id: layoutId('design'),
                    name: imported.name,
                    appearance: imported.appearance,
                  });
                })
              ) {
                setName(imported.name);
                notify(t('design.imported'));
              }
            } catch {
              notify(t('design.invalid'));
            } finally {
              input.value = '';
            }
          }}
        />
        <p className="field-hint">{t('design.transferHint')}</p>
      </div>
      <div className="form-section">
        <h3>{t('design.layout')}</h3>
        <p className="field-hint">{t('design.layoutHint')}</p>
        <button
          className="button full-width"
          disabled={pagesForProfile(document, profile.id).length >= 12}
          onClick={() => {
            try {
              const result = createGlassOverview(document, profile.id, language);
              onOverview?.(result.document, result.pageId);
            } catch (e) {
              notify(describeError(e));
            }
          }}
        >
          {t('design.createOverview')}
        </button>
      </div>
    </>
  );
}
