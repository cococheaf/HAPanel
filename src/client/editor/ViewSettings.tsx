import { Copy, Layers3, Trash2 } from 'lucide-react';
import type { Dashboard } from '../../shared/model';
import { useI18n } from '../i18n';
import type { DisplayIntent } from './DisplayManager';
import { EditorSection } from './EditorSection';
import { TextInput } from './TextInput';

export function ViewSettings({
  page,
  visiblePage,
  pageCount,
  visibleCount,
  change,
  manage,
}: {
  page: Dashboard['pages'][number];
  visiblePage: Dashboard['pages'][number];
  pageCount: number;
  visibleCount: number;
  change: (mutate: (document: Dashboard) => void) => boolean;
  manage: (intent?: DisplayIntent) => void;
}) {
  const { t } = useI18n();
  const patch = (value: Partial<Dashboard['pages'][number]>) =>
    change((document) => {
      Object.assign(
        document.pages.find((item) => item.id === page.id)!,
        value,
      );
    });
  return (
    <>
      <div className="inspector-tile-title">
        <span className="inspector-tile-icon">
          <Layers3 size={24} />
        </span>
        <div>
          <h2>{visiblePage.name}</h2>
          <p>{t('studio.viewHint')}</p>
        </div>
      </div>
      <EditorSection title={t('studio.basic')} defaultOpen>
        <label>
          {t('editor.pageName')}
          <TextInput
            value={visiblePage.name}
            maxLength={40}
            required
            onValue={(name) => patch({ name })}
          />
        </label>
        <label>
          {t('editor.pageHeading')}
          <TextInput
            value={page.heading ?? ''}
            maxLength={80}
            onValue={(heading) => patch({ heading: heading.trim() ? heading : undefined })}
          />
        </label>
        <label>
          {t('editor.pageSubtitle')}
          <TextInput
            value={page.subtitle ?? ''}
            maxLength={100}
            onValue={(subtitle) => patch({ subtitle: subtitle || undefined })}
          />
        </label>
      </EditorSection>
      <EditorSection title={t('editor.navigation')} defaultOpen>
        <label className="v2-check">
          <input
            type="checkbox"
            disabled={!page.hidden && visibleCount === 1}
            checked={page.hidden ?? false}
            onChange={(event) => patch({ hidden: event.target.checked })}
          />
          {t('v2.hidden')}
        </label>
        <div className="view-management-actions">
          <button className="button" onClick={() => manage({ type: 'copyView', id: page.id })}>
            <Copy size={15} />
            {t('display.copyViewNamed', { name: visiblePage.name })}
          </button>
          <button
            className="button danger"
            disabled={pageCount === 1}
            onClick={() => manage({ type: 'deleteView', id: page.id })}
          >
            <Trash2 size={15} />
            {t('display.removeViewNamed', { name: visiblePage.name })}
          </button>
        </div>
      </EditorSection>
    </>
  );
}
