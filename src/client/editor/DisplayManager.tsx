import { useState } from 'react';
import {
  Copy,
  Plus,
  Trash2,
  Monitor,
  ArrowUp,
  ArrowDown,
  Pencil,
  Link as LinkIcon,
} from 'lucide-react';
import { pagesForProfile, type Dashboard } from '../../shared/model';
import {
  createDisplay,
  duplicateView,
  deleteDisplay,
  deleteView,
  moveView,
} from '../../shared/display-layouts';
import { localizeSampleDocument } from '../../shared/demo';
import { useI18n } from '../i18n';
import { Modal } from '../ui/Modal';
export type DisplayIntent = { type: 'copyView' | 'deleteView'; id: string };
type Task = DisplayIntent | { type: 'new'; source: string } | { type: 'deleteDisplay'; id: string };
export function DisplayManager({
  document,
  profileId,
  onChange,
  onSelect,
  onDevices,
  onClose,
  initial,
  local = false,
}: {
  document: Dashboard;
  profileId: string;
  onChange: (document: Dashboard) => boolean;
  onSelect: (profileId: string, pageId?: string, edit?: boolean) => void;
  onDevices: () => void;
  onClose: () => void;
  initial?: DisplayIntent;
  local?: boolean;
}) {
  const { t, describeError, language } = useI18n();
  const localized = localizeSampleDocument(document, language);
  const profileLabel = (id: string) =>
    localized.profiles.find((profile) => profile.id === id)?.name ?? '';
  const pageLabel = (id: string) => localized.pages.find((page) => page.id === id)?.name ?? '';
  const [focus, setFocus] = useState(profileId),
    [task, setTask] = useState<Task | undefined>(initial),
    [error, setError] = useState('');
  const [name, setName] = useState(
    initial?.type === 'copyView'
      ? t('editor.copyTitle', {
          title: pageLabel(initial.id),
        })
      : '',
  );
  const [target, setTarget] = useState(profileId),
    [displayName, setDisplayName] = useState(t('display.newName')),
    [copyViews, setCopyViews] = useState(true);
  const selected =
    document.profiles.find((profile) => profile.id === focus) ?? document.profiles[0];
  const pages = pagesForProfile(document, selected.id);
  const currentPage =
    task && 'id' in task ? document.pages.find((page) => page.id === task.id) : undefined;
  const currentDisplay =
    task?.type === 'deleteDisplay'
      ? document.profiles.find((profile) => profile.id === task.id)
      : undefined;
  const run = (operation: () => Dashboard, after?: () => void) => {
    try {
      if (onChange(operation())) {
        setTask(undefined);
        setError('');
        after?.();
      } else setError(t('error.requestFailed'));
    } catch (reason) {
      setError(describeError(reason));
    }
  };
  const cancel = () => {
    setTask(undefined);
    setError('');
  };
  const link = new URL(
    local ? window.location.pathname : './display.html',
    window.document.baseURI,
  );
  link.searchParams.set('display', selected.id);
  return (
    <Modal
      wide
      className="display-manager-modal"
      title={t('display.manage')}
      onClose={onClose}
      message={error}
      onDismissMessage={() => setError('')}
    >
      <p className="muted">{t('display.independentHint')}</p>
      {!task && (
        <>
          <div className="display-manager-heading">
            <h3>{t('display.layouts')}</h3>
            <button
              className="button primary"
              disabled={document.profiles.length >= 8}
              onClick={() => {
                setName(t('display.newName'));
                setCopyViews(true);
                setTask({ type: 'new', source: selected.id });
              }}
            >
              <Plus size={16} />
              {t('display.add')}
            </button>
          </div>
          <div className="display-manager-grid">
            {document.profiles.map((profile) => (
              <article key={profile.id} className={selected.id === profile.id ? 'is-selected' : ''}>
                <Monitor size={23} />
                <div>
                  <h3>{profileLabel(profile.id)}</h3>
                  <p>
                    {profile.width} × {profile.height} ·{' '}
                    {t(
                      pagesForProfile(document, profile.id).length === 1
                        ? 'display.viewCountOne'
                        : 'display.viewCount',
                      {
                        count: pagesForProfile(document, profile.id).length,
                      },
                    )}
                  </p>
                </div>
                <div className="display-manager-actions">
                  <button className="button" onClick={() => onSelect(profile.id, undefined, true)}>
                    <Pencil size={14} />
                    {t('display.edit')}
                  </button>
                  <button className="button" onClick={() => setFocus(profile.id)}>
                    {t('display.views')}
                  </button>
                  <button
                    className="icon-button"
                    aria-label={t('display.copyNamed', { name: profileLabel(profile.id) })}
                    onClick={() => {
                      setName(
                        t('editor.copyTitle', { title: profileLabel(profile.id) }).slice(0, 64),
                      );
                      setCopyViews(true);
                      setTask({ type: 'new', source: profile.id });
                    }}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    disabled={document.profiles.length === 1}
                    aria-label={t('display.removeNamed', { name: profileLabel(profile.id) })}
                    onClick={() => setTask({ type: 'deleteDisplay', id: profile.id })}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="display-manager-heading">
            <h3>{t('display.viewsFor', { name: profileLabel(selected.id) })}</h3>
            <button className="button" onClick={() => onSelect(selected.id, undefined, true)}>
              {t('display.configure')}
            </button>
          </div>
          <div className="display-view-list">
            {pages.map((page, index) => (
              <div key={page.id}>
                <button
                  className="display-view-name"
                  onClick={() => onSelect(selected.id, page.id, true)}
                >
                  <span>{index + 1}</span>
                  <strong>{pageLabel(page.id)}</strong>
                  <small>
                    {t(page.tiles.length === 1 ? 'display.tileCountOne' : 'display.tileCount', {
                      count: page.tiles.length,
                    })}
                  </small>
                </button>
                <div className="display-view-actions">
                  {([-1, 1] as const).map((direction) => (
                    <button
                      key={direction}
                      className="icon-button"
                      disabled={index + direction < 0 || index + direction >= pages.length}
                      aria-label={t(direction < 0 ? 'display.viewUp' : 'display.viewDown', {
                        name: pageLabel(page.id),
                      })}
                      onClick={() => run(() => moveView(document, page.id, direction))}
                    >
                      {direction < 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    </button>
                  ))}
                  <button
                    className="icon-button"
                    aria-label={t('display.copyViewNamed', { name: pageLabel(page.id) })}
                    onClick={() => {
                      setName(t('editor.copyTitle', { title: pageLabel(page.id) }).slice(0, 40));
                      setTarget(selected.id);
                      setTask({ type: 'copyView', id: page.id });
                    }}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={t('display.removeViewNamed', { name: pageLabel(page.id) })}
                    disabled={pages.length === 1}
                    onClick={() => setTask({ type: 'deleteView', id: page.id })}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <label className="display-link">
            <span>
              <LinkIcon size={15} />
              {t('display.link')}
            </span>
            <input readOnly value={link.href} onFocus={(event) => event.target.select()} />
          </label>
          <p className="field-hint">{t('display.linkHint')}</p>
          <div className="display-manager-devices">
            <div>
              <h3>{t('display.pairedDevices')}</h3>
              <p>{t(local ? 'display.devicesLiveOnly' : 'display.deviceHint')}</p>
            </div>
            <button className="button" disabled={local} onClick={onDevices}>
              {t('display.manageDevices')}
            </button>
          </div>
        </>
      )}
      {task?.type === 'new' && (
        <form
          className="display-manager-form"
          onSubmit={(event) => {
            event.preventDefault();
            let created: ReturnType<typeof createDisplay>;
            run(
              () => {
                created = createDisplay(document, name, task.source, copyViews, t('sample.home'));
                return created.document;
              },
              () => {
                setFocus(created.profileId);
                onSelect(created.profileId);
              },
            );
          }}
        >
          <h3>{t('display.add')}</h3>
          <label>
            {t('display.name')}
            <input
              autoFocus
              required
              maxLength={64}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            {t('display.useDimensions')}
            <select
              value={task.source}
              onChange={(event) => setTask({ ...task, source: event.target.value })}
            >
              {document.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profileLabel(profile.id)}
                </option>
              ))}
            </select>
          </label>
          <label className="display-checkbox">
            <input
              type="checkbox"
              checked={copyViews}
              onChange={(event) => setCopyViews(event.target.checked)}
            />
            {t('display.copyAllViews')}
          </label>
          <p className="field-hint">{t('display.dimensionsHint')}</p>
          <div className="display-manager-form-actions">
            <button type="button" className="button" onClick={cancel}>
              {t('common.cancel')}
            </button>
            <button className="button primary" disabled={!name.trim()}>
              {t('display.create')}
            </button>
          </div>
        </form>
      )}
      {task?.type === 'copyView' && currentPage && (
        <form
          className="display-manager-form"
          onSubmit={(event) => {
            event.preventDefault();
            let copied: ReturnType<typeof duplicateView>;
            run(
              () => {
                let next = document,
                  targetId = target;
                if (target === 'new') {
                  const created = createDisplay(
                    document,
                    displayName,
                    currentPage.profileIds![0],
                    false,
                    t('sample.home'),
                  );
                  next = created.document;
                  targetId = created.profileId;
                }
                copied = duplicateView(next, currentPage.id, targetId, name);
                if (target === 'new') {
                  const blank = pagesForProfile(copied.document, targetId).find(
                    (page) => page.id !== copied.pageId,
                  )!;
                  copied.document = deleteView(copied.document, blank.id);
                }
                return copied.document;
              },
              () => {
                setFocus(copied.profileId);
                onSelect(copied.profileId, copied.pageId);
              },
            );
          }}
        >
          <h3>{t('display.copyViewNamed', { name: pageLabel(currentPage.id) })}</h3>
          <label>
            {t('display.viewName')}
            <input
              autoFocus
              required
              maxLength={40}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            {t('display.target')}
            <select value={target} onChange={(event) => setTarget(event.target.value)}>
              {document.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profileLabel(profile.id)}
                </option>
              ))}
              <option value="new" disabled={document.profiles.length >= 8}>
                {t('display.newTarget')}
              </option>
            </select>
          </label>
          {target === 'new' && (
            <label>
              {t('display.name')}
              <input
                required
                maxLength={64}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
          )}
          <p className="field-hint">{t('display.copyHint')}</p>
          <div className="display-manager-form-actions">
            <button type="button" className="button" onClick={cancel}>
              {t('common.cancel')}
            </button>
            <button
              className="button primary"
              disabled={!name.trim() || (target === 'new' && !displayName.trim())}
            >
              {t('display.copy')}
            </button>
          </div>
        </form>
      )}
      {(task?.type === 'deleteView' || task?.type === 'deleteDisplay') && (
        <div className="display-manager-form">
          <h3>
            {t('display.removeTitle', {
              name: currentDisplay
                ? profileLabel(currentDisplay.id)
                : currentPage
                  ? pageLabel(currentPage.id)
                  : '',
            })}
          </h3>
          <p>
            {t(
              task.type === 'deleteDisplay'
                ? 'display.removeDisplayHint'
                : 'display.removeViewHint',
            )}
          </p>
          <p className="field-hint">{t('display.restoreHint')}</p>
          <div className="display-manager-form-actions">
            <button className="button" onClick={cancel}>
              {t('common.cancel')}
            </button>
            <button
              className="button danger"
              onClick={() =>
                run(
                  () =>
                    task.type === 'deleteView'
                      ? deleteView(document, task.id)
                      : deleteDisplay(document, task.id),
                  () => {
                    const fallback =
                      document.profiles.find((profile) => profile.id !== task.id) ??
                      document.profiles[0];
                    if (task.type === 'deleteDisplay' && task.id === selected.id) {
                      setFocus(fallback.id);
                      onSelect(fallback.id);
                    }
                  },
                )
              }
            >
              {t('editor.remove')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
