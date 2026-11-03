import { useContext, useEffect, useState } from 'react';
import { ImagePlus, RotateCcw, WandSparkles, X } from 'lucide-react';
import type { Design } from '../../shared/design';
import type { Dashboard } from '../../shared/model';
import type { ImageMetadata } from '../../shared/assets';
import { ImageLibraryContext } from '../ui/ImageContext';
import { ImageLibraryDialog, LibraryPicture } from './ImageLibrary';
import { useI18n } from '../i18n';
export function WallpaperSettings({
  design,
  document,
  update,
}: {
  design: Design;
  document: Dashboard;
  update: (patch: Partial<Design>) => void;
}) {
  const { t } = useI18n(),
    library = useContext(ImageLibraryContext),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<ImageMetadata>();
  useEffect(() => {
    let active = true;
    library
      .list()
      .then((images) => {
        if (active) setSelected(images.find((i) => i.id === design.image?.assetId));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [library, design.image?.assetId, open]);
  const image = design.image;
  const patch = (value: Partial<NonNullable<Design['image']>>) => {
    if (image) update({ image: { ...image, ...value } });
  };
  return (
    <div className="form-section wallpaper-settings">
      <h3>{t('image.background')}</h3>
      <button
        className="wallpaper-preview"
        aria-label={t('image.choose')}
        onClick={() => setOpen(true)}
      >
        {image && design.wallpaper === 'image' ? (
          <LibraryPicture id={image.assetId} />
        ) : (
          <ImagePlus size={28} />
        )}
        <span>
          {image && design.wallpaper === 'image'
            ? (selected?.name ?? t('image.current'))
            : t('image.choose')}
        </span>
      </button>
      <button className="button full-width" onClick={() => setOpen(true)}>
        <ImagePlus size={16} />
        {t('image.library')}
      </button>
      {image && design.wallpaper === 'image' && (
        <>
          <label>
            {t('image.fit')}
            <select value={image.fit} onChange={(e) => patch({ fit: e.target.value as 'cover' })}>
              <option value="cover">{t('image.cover')}</option>
              <option value="contain">{t('image.contain')}</option>
            </select>
          </label>
          {(
            [
              ['x', 0, 100, 1, '%'],
              ['y', 0, 100, 1, '%'],
              ['zoom', 1, 2, 0.05, '×'],
              ['overlay', 0, 80, 1, '%'],
              ['brightness', 40, 140, 1, '%'],
              ['blur', 0, 20, 1, 'px'],
            ] as const
          ).map(([key, min, max, step, unit]) => (
            <label key={key} className="design-range">
              <span>
                {t(`image.${key}`)}
                <output>
                  {Number(image[key].toFixed(2))}
                  {unit}
                </output>
              </span>
              <input
                aria-label={t(`image.${key}`)}
                type="range"
                min={min}
                max={max}
                step={step}
                value={image[key]}
                onChange={(e) => patch({ [key]: Number(e.target.value) })}
              />
            </label>
          ))}
          <p className="field-hint">{t('image.overlayHint')}</p>
          <button
            className="button full-width"
            onClick={() => update({ wallpaper: 'gradient', image: undefined })}
          >
            <X size={15} />
            {t('image.removeBackground')}
          </button>
          <div className="v2-button-row">
            <button
              className="button"
              onClick={() => patch({ x: 50, y: 50, zoom: 1, blur: 0, brightness: 100 })}
            >
              <RotateCcw size={15} />
              {t('image.reset')}
            </button>
            <button
              className="button"
              disabled={!selected}
              onClick={() => {
                if (!selected) return;
                const mix = (amount: number) =>
                  '#' +
                  [1, 3, 5]
                    .map((i) =>
                      Math.round(
                        parseInt(selected.color.slice(i, i + 2), 16) * (1 - amount) + 255 * amount,
                      )
                        .toString(16)
                        .padStart(2, '0'),
                    )
                    .join('');
                update({
                  background: selected.color,
                  tint: mix(0.8),
                  accent: design.scheme === 'light' ? selected.color : mix(0.55),
                });
              }}
            >
              <WandSparkles size={15} />
              {t('image.palette')}
            </button>
          </div>
        </>
      )}
      {open && (
        <ImageLibraryDialog
          document={document}
          onClose={() => setOpen(false)}
          onSelect={(meta) => {
            setSelected(meta);
            update({
              wallpaper: 'image',
              image: {
                assetId: meta.id,
                fit: 'cover',
                x: 50,
                y: 50,
                zoom: 1,
                overlay: 25,
                brightness: 100,
                blur: 0,
              },
            });
          }}
        />
      )}
    </div>
  );
}
