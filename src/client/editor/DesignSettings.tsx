import { EditorSection } from './EditorSection';
import { SearchSelect } from './SearchSelect';
import { UserError } from '../../shared/i18n';
import { useContext, useRef, useState } from 'react';
import { Download, Upload, Palette, Save, Trash2 } from 'lucide-react';
import {
  designPresets,
  exportDesign,
  parseDesignFile,
  DESIGN_FILE_MAX_BYTES,
  type Design,
} from '../../shared/design';
import { layoutId } from '../../shared/display-layouts';
import { createGlassOverview } from '../../shared/glass-layout';
import { pagesForProfile, type Dashboard, type Profile } from '../../shared/model';
import { useI18n } from '../i18n';
import { TextInput } from './TextInput';
import { WallpaperSettings } from './WallpaperSettings';
import { ImageLibraryContext } from '../ui/ImageContext';
import { base64Blob } from '../images';

export function DesignSettings({
  profile,
  page,
  document,
  change,
  notify,
  onOverview,
}: {
  profile: Profile;
  page?: Dashboard['pages'][number];
  document: Dashboard;
  change: (fn: (draft: Dashboard) => void) => boolean;
  notify: (message: string) => void;
  onOverview?: (document: Dashboard, pageId: string) => void;
}) {
  const { t, language, describeError } = useI18n(),
    images = useContext(ImageLibraryContext);
  const [scope, setScope] = useState<'display' | 'page'>('display'),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [keepImage, setKeepImage] = useState(true);
  const file = useRef<HTMLInputElement>(null),
    target = useRef('');
  target.current = profile.id + '/' + (scope === 'page' ? page?.id : 'display');
  const d =
    (scope === 'page' ? (page?.design ?? profile.design) : profile.design) ??
    designPresets.glassDark;
  const gradientDefault = {
    from: d.background,
    to:
      '#' +
      [1, 3, 5]
        .map((i) =>
          Math.round(
            parseInt(d.background.slice(i, i + 2), 16) * 0.75 +
              parseInt(d.tint.slice(i, i + 2), 16) * 0.25,
          )
            .toString(16)
            .padStart(2, '0'),
        )
        .join(''),
    angle: 140,
    kind: 'linear' as const,
  };
  const assigned = scope === 'page' ? page?.design : profile.design;
  const write = (appearance?: Design) =>
    change((doc) => {
      if (scope === 'page' && page) doc.pages.find((p) => p.id === page.id)!.design = appearance;
      else doc.profiles.find((p) => p.id === profile.id)!.design = appearance;
    });
  const patch = (value: Partial<Design>) => write({ ...d, ...value });
  const download = async () => {
    setBusy(true);
    try {
      const asset =
        d.wallpaper === 'image' && d.image ? await images.portable(d.image.assetId) : undefined;
      const raw = exportDesign(
        name.trim() || (scope === 'page' ? page?.name : profile.name) || profile.name,
        d,
        asset,
      );
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })),
        a = window.document.createElement('a');
      a.href = url;
      a.download = 'hapanel-design.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      notify(describeError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="inspector-tile-title">
        <span className="inspector-tile-icon">
          <Palette size={24} />
        </span>
        <div>
          <h2>{t('design.title')}</h2>
          <p>
            {profile.name}
            {scope === 'page' ? ' · ' + page?.name : ''}
          </p>
        </div>
      </div>
      {page && (
        <fieldset className="design-scope">
          <legend>{t('design.scope')}</legend>
          <div>
            <button
              disabled={busy}
              aria-pressed={scope === 'display'}
              onClick={() => setScope('display')}
            >
              {t('design.displayScope')}
            </button>
            <button
              disabled={busy}
              aria-pressed={scope === 'page'}
              onClick={() => setScope('page')}
            >
              {t('design.pageScope')}
            </button>
          </div>
          <p className="field-hint">
            {t(
              scope === 'page'
                ? page.design
                  ? 'design.pageOwn'
                  : 'design.pageInherited'
                : 'design.hint',
            )}
          </p>
        </fieldset>
      )}
      <WallpaperSettings key={target.current} design={d} document={document} update={patch} />
      <EditorSection title={t('design.presets')} defaultOpen>
        <div className="design-presets">
          {Object.entries(designPresets).map(([id, value]) => (
            <button
              key={id}
              className={
                'design-preset ' +
                (JSON.stringify(d) === JSON.stringify(value) && assigned ? 'active' : '')
              }
              onClick={() =>
                write({
                  ...structuredClone(value),
                  ...(keepImage && d.wallpaper === 'image' && d.image
                    ? { wallpaper: 'image' as const, image: structuredClone(d.image) }
                    : {}),
                })
              }
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
        {d.wallpaper === 'image' && (
          <label className="v2-check">
            <input
              type="checkbox"
              checked={keepImage}
              onChange={(e) => setKeepImage(e.target.checked)}
            />
            {t('design.keepImage')}
          </label>
        )}
        <button className="button full-width" disabled={!assigned} onClick={() => write(undefined)}>
          {t(scope === 'page' ? 'design.inherit' : 'design.classic')}
        </button>
      </EditorSection>
      <EditorSection title={t('design.customize')}>
        <label>
          {t('design.surface')}
          <SearchSelect
            aria-label={t('design.surface')}
            value={d.surface}
            onValueChange={(value) => patch({ surface: value as Design['surface'] })}
          >
            {(['glass', 'solid'] as const).map((x) => (
              <option key={x} value={x}>
                {t(`design.${x}`)}
              </option>
            ))}
          </SearchSelect>
        </label>
        <label>
          {t('design.scheme')}
          <SearchSelect
            aria-label={t('design.scheme')}
            value={d.scheme}
            onValueChange={(value) => patch({ scheme: value as Design['scheme'] })}
          >
            {(['dark', 'light', 'auto'] as const).map((x) => (
              <option key={x} value={x}>
                {t(`design.${x}`)}
              </option>
            ))}
          </SearchSelect>
        </label>
        <label>
          {t('design.wallpaper')}
          <SearchSelect
            aria-label={t('design.wallpaper')}
            value={d.wallpaper}
            onValueChange={(value) =>
              patch({
                wallpaper: value as Design['wallpaper'],
                ...(value === 'gradient' && !d.gradient ? { gradient: gradientDefault } : {}),
              })
            }
          >
            {(['landscape', 'aurora', 'gradient', 'plain', 'image'] as const).map((x) => (
              <option key={x} value={x}>
                {t(`design.${x}`)}
              </option>
            ))}
          </SearchSelect>
        </label>
        {d.wallpaper === 'gradient' && (
          <fieldset className="gradient-controls">
            <legend>{t('design.gradientBuilder')}</legend>
            {(['from', 'to'] as const).map((key) => (
              <label className="design-color" key={key}>
                {t(`design.gradient.${key}`)}
                <input
                  type="color"
                  aria-label={t(`design.gradient.${key}`)}
                  value={d.gradient?.[key] ?? (key === 'from' ? d.background : d.tint)}
                  onChange={(e) =>
                    patch({
                      gradient: {
                        from: d.background,
                        to: d.tint,
                        angle: 140,
                        kind: 'linear',
                        ...d.gradient,
                        [key]: e.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
            <label>
              {t('design.gradient.kind')}
              <SearchSelect
                aria-label={t('design.gradient.kind')}
                value={d.gradient?.kind ?? 'linear'}
                onValueChange={(value) =>
                  patch({
                    gradient: {
                      from: d.background,
                      to: d.tint,
                      angle: 140,
                      ...d.gradient,
                      kind: value as 'linear',
                    },
                  })
                }
              >
                <option value="linear">{t('design.gradient.linear')}</option>
                <option value="radial">{t('design.gradient.radial')}</option>
              </SearchSelect>
            </label>
            {(d.gradient?.kind ?? 'linear') === 'linear' && (
              <label className="design-range">
                <span>
                  {t('design.gradient.angle')}
                  <output>{d.gradient?.angle ?? 140}°</output>
                </span>
                <input
                  type="range"
                  aria-label={t('design.gradient.angle')}
                  min="0"
                  max="360"
                  value={d.gradient?.angle ?? 140}
                  onChange={(e) =>
                    patch({
                      gradient: {
                        from: d.background,
                        to: d.tint,
                        kind: 'linear',
                        ...d.gradient,
                        angle: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            )}
          </fieldset>
        )}
        {(['background', 'tint', 'accent'] as const).map((key) => (
          <label className="design-color" key={key}>
            {t(`design.${key}`)}
            <input
              type="color"
              aria-label={t(`design.${key}`)}
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
          <label className="design-range" key={key}>
            <span>
              {t(`design.${key}`)}
              <output>
                {Number(d[key].toFixed(2))}
                {unit}
              </output>
            </span>
            <input
              type="range"
              aria-label={t(`design.${key}`)}
              min={min}
              max={max}
              step={step}
              value={d[key]}
              onChange={(e) => patch({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
        <label>
          {t('design.transition')}
          <SearchSelect
            aria-label={t('design.transition')}
            value={d.transition ?? 'none'}
            onValueChange={(value) => patch({ transition: value as 'none' })}
          >
            <option value="none">{t('design.noTransition')}</option>
            <option value="fade">{t('design.fade')}</option>
          </SearchSelect>
        </label>
        <p className="field-hint">{t('design.performance')}</p>
      </EditorSection>
      <EditorSection title={t('design.library')}>
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
            <button className="button" onClick={() => write(structuredClone(saved.appearance))}>
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
          <button disabled={busy} className="button" onClick={() => void download()}>
            <Download size={16} />
            {t('design.export')}
          </button>
          <button disabled={busy} className="button" onClick={() => file.current?.click()}>
            <Upload size={16} />
            {t('design.import')}
          </button>
        </div>
        <input
          hidden
          ref={file}
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            const input = e.currentTarget,
              selected = input.files?.[0],
              destination = target.current;
            if (!selected) return;
            setBusy(true);
            try {
              if (selected.size > DESIGN_FILE_MAX_BYTES) throw Error();
              const imported = parseDesignFile(await selected.text());
              if ((document.designs?.length ?? 0) >= 24) throw Error();
              if (imported.version === 2) {
                const meta = await images.upload(
                  base64Blob(imported.asset.data),
                  imported.asset.name,
                );
                imported.appearance.image!.assetId = meta.id;
              }
              if (destination !== target.current) {
                notify(t('image.targetChanged'));
                return;
              }
              if (
                change((doc) => {
                  if (scope === 'page' && page)
                    doc.pages.find((p) => p.id === page.id)!.design = structuredClone(
                      imported.appearance,
                    );
                  else
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
            } catch (error) {
              notify(error instanceof UserError ? describeError(error) : t('design.invalid'));
            } finally {
              setBusy(false);
              input.value = '';
            }
          }}
        />
        <p className="field-hint">{t('design.transferHint')}</p>
      </EditorSection>
      {scope === 'display' && (
        <EditorSection title={t('design.layout')}>
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
        </EditorSection>
      )}
    </>
  );
}
