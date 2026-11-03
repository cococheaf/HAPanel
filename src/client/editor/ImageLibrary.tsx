import { useContext, useEffect, useRef, useState } from 'react';
import { Upload, Archive, ArchiveRestore, Pencil, Search, ImagePlus } from 'lucide-react';
import { ImageLibraryContext, useImageSource } from '../ui/ImageContext';
import { prepareImage } from '../images';
import { imageReferences, IMAGE_LIBRARY_BYTES, type ImageMetadata } from '../../shared/assets';
import type { Dashboard } from '../../shared/model';
import { Modal } from '../ui/Modal';
import { TextInput } from './TextInput';
import { useI18n } from '../i18n';
export function LibraryPicture({ id, thumbnail = true }: { id: string; thumbnail?: boolean }) {
  const source = useImageSource(id, thumbnail);
  return source.url && !source.failed ? (
    <img src={source.url} alt="" onError={source.onError} />
  ) : (
    <span className="image-placeholder">
      <ImagePlus size={26} />
    </span>
  );
}
export function ImageLibraryDialog({
  document,
  onSelect,
  onClose,
}: {
  document: Dashboard;
  onSelect: (image: ImageMetadata) => void;
  onClose: () => void;
}) {
  const library = useContext(ImageLibraryContext),
    { t, describeError, intlLocale } = useI18n();
  const [images, setImages] = useState<ImageMetadata[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(''),
    [archived, setArchived] = useState(false),
    [rename, setRename] = useState<ImageMetadata>(),
    [name, setName] = useState('');
  const file = useRef<HTMLInputElement>(null),
    alive = useRef(true);
  const load = () =>
    library
      .list()
      .then((v) => {
        if (alive.current) setImages(v);
      })
      .catch((e) => {
        if (alive.current) setError(describeError(e));
      });
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [library]);
  const upload = async (selected?: File) => {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const blob = await prepareImage(selected);
      if (!alive.current) return;
      const result = await library.upload(
        blob,
        (selected.name.replace(/\.[^.]+$/, '').trim() || t('image.untitled')).slice(0, 80),
      );
      if (alive.current) {
        onSelect(result);
        onClose();
      }
    } catch (e) {
      if (alive.current) setError(describeError(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const update = async (image: ImageMetadata, isArchived: boolean) => {
    try {
      await library.update(image.id, { archived: isArchived });
      await load();
    } catch (e) {
      setError(describeError(e));
    }
  };
  const used = new Set(imageReferences(document, true)),
    bytes = images.reduce((n, i) => n + i.bytes + i.thumbnailBytes, 0);
  return (
    <Modal
      title={t('image.library')}
      wide
      onClose={onClose}
      message={error}
      onDismissMessage={() => setError('')}
      className="image-library-dialog"
    >
      <div
        className={'image-dropzone ' + (busy ? 'is-busy' : '')}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(e.dataTransfer.files[0]);
        }}
      >
        <ImagePlus size={28} />
        <div>
          <strong>{t(busy ? 'image.processing' : 'image.drop')}</strong>
          <p>{t('image.uploadHint')}</p>
        </div>
        <button className="button primary" disabled={busy} onClick={() => file.current?.click()}>
          <Upload size={16} />
          {t('image.upload')}
        </button>
        <input
          hidden
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            void upload(e.currentTarget.files?.[0]);
            e.currentTarget.value = '';
          }}
        />
      </div>
      <div className="image-library-tools">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label={t('image.search')}
            placeholder={t('image.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="v2-check">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          {t('image.showArchive')}
        </label>
      </div>
      <p className="field-hint">
        {t('image.storage', {
          used: (bytes / 1048576).toLocaleString(intlLocale, { maximumFractionDigits: 2 }),
          max: IMAGE_LIBRARY_BYTES / 1048576,
        })}
      </p>
      <div className="image-library-grid">
        {images
          .filter(
            (i) =>
              (!i.archived || archived) &&
              i.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
          )
          .map((image) => (
            <article
              className={'library-image ' + (image.archived ? 'is-archived' : '')}
              key={image.id}
            >
              <button
                className="library-image-select"
                disabled={image.archived}
                aria-label={t('image.use', { name: image.name })}
                onClick={() => {
                  onSelect(image);
                  onClose();
                }}
              >
                <LibraryPicture id={image.id} />
                <strong>{image.name}</strong>
                <span>
                  {image.width} × {image.height} · {Math.round(image.bytes / 1024)} KB
                </span>
              </button>
              <div className="library-image-actions">
                <small>
                  {t(
                    image.archived
                      ? 'image.archived'
                      : used.has(image.id)
                        ? 'image.inUse'
                        : 'image.available',
                  )}
                </small>
                <button
                  className="icon-button"
                  aria-label={t('image.rename', { name: image.name })}
                  onClick={() => {
                    setRename(image);
                    setName(image.name);
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={t(image.archived ? 'image.restore' : 'image.archive', {
                    name: image.name,
                  })}
                  onClick={() => void update(image, !image.archived)}
                >
                  {image.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                </button>
              </div>
            </article>
          ))}
      </div>
      {!images.length && !busy && <p className="image-library-empty">{t('image.empty')}</p>}
      <p className="field-hint">{t('image.archiveHint')}</p>
      {rename && (
        <Modal title={t('image.renameTitle')} onClose={() => setRename(undefined)}>
          <label>
            {t('image.name')}
            <TextInput autoFocus value={name} onValue={setName} maxLength={80} />
          </label>
          <div className="v2-button-row">
            <button className="button" onClick={() => setRename(undefined)}>
              {t('common.cancel')}
            </button>
            <button
              className="button primary"
              disabled={!name.trim()}
              onClick={async () => {
                try {
                  await library.update(rename.id, { name: name.trim() });
                  await load();
                  setRename(undefined);
                } catch (e) {
                  setError(describeError(e));
                }
              }}
            >
              {t('image.saveName')}
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
