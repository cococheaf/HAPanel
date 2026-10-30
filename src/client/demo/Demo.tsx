import { useI18n } from '../i18n';
import { lazy, Suspense, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BrowserDemoService, type Bootstrap } from '../service';
import Player from '../display/Player';
import type { Action } from '../../shared/model';
const Editor = lazy(() => import('../editor/Editor'));
const service = new BrowserDemoService();
export default function Demo() {
  const { t, describeError } = useI18n();

  const [studio, setStudio] = useState(false),
    [data, setData] = useState<Bootstrap>(),
    [error, setError] = useState<unknown>();
  useEffect(() => {
    service.load().then(setData).catch(setError);
    return service.subscribe((message) =>
      setData(
        (d) =>
          d && {
            ...d,
            snapshot: message.snapshot ?? d.snapshot,
            workspace: { ...d.workspace, published: message.published ?? d.workspace.published },
          },
      ),
    );
  }, []);
  const act = async (action: Action) => {
    await service.act(action, 'published');
  };
  if (studio)
    return (
      <Suspense fallback={<div className="loading-screen">{t('demo.loadingStudio')}</div>}>
        <Editor service={service} onExit={() => setStudio(false)} />
      </Suspense>
    );
  if (!data) return <div className="loading-screen">{t('common.loading')}</div>;
  return (
    <>
      <Player
        published={data.workspace.published}
        snapshot={data.snapshot}
        onAction={act}
        demo
        onEdit={() => setStudio(true)}
      />
      {Boolean(error) && (
        <div className="toast" role="alert">
          <span>{describeError(error)}</span>
          <button aria-label={t('common.dismiss')} onClick={() => setError(undefined)}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
