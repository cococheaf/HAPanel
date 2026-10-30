import { lazy, Suspense, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BrowserDemoService, type Bootstrap } from '../service';
import Player from '../display/Player';
import type { Action } from '../../shared/model';
const Editor = lazy(() => import('../editor/Editor'));
const service = new BrowserDemoService();
export default function Demo() {
  const [studio, setStudio] = useState(false),
    [data, setData] = useState<Bootstrap>(),
    [error, setError] = useState('');
  useEffect(() => {
    service.load().then(setData);
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
    try {
      await service.act(action, 'published');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (studio)
    return (
      <Suspense fallback={<div className="loading-screen">Studio wird geöffnet …</div>}>
        <Editor service={service} onExit={() => setStudio(false)} />
      </Suspense>
    );
  if (!data) return <div className="loading-screen">Dein Zuhause wird vorbereitet …</div>;
  return (
    <>
      <Player
        published={data.workspace.published}
        snapshot={data.snapshot}
        onAction={act}
        demo
        onEdit={() => setStudio(true)}
      />
      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button aria-label="Meldung schließen" onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
