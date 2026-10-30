import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { X } from 'lucide-react';
import { api, liveStream } from '../service';
import type { Action, Revision, Snapshot } from '../../shared/model';
import Player from './Player';
import '../styles.css';

function Display() {
  const [data, setData] = useState<{ published: Revision; snapshot: Snapshot }>();
  const [pairing, setPairing] = useState(false),
    [error, setError] = useState('');
  const [code, setCode] = useState(''),
    [name, setName] = useState('Wandtablet');
  const load = useCallback(() => {
    api<{ published: Revision; snapshot: Snapshot }>('api/display/bootstrap')
      .then((result) => {
        setData(result);
        setPairing(false);
        setError('');
      })
      .catch((e) => {
        if (e.status === 401) setPairing(true);
        else setError(e.message);
      });
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!data) return;
    return liveStream('api/display/stream', (message) => {
      if (message.online === false)
        setData((d) => d && { ...d, snapshot: { ...d.snapshot, status: 'reconnecting' } });
      if (message.snapshot || message.published)
        setData(
          (d) =>
            d && {
              snapshot: message.snapshot ?? d.snapshot,
              published: message.published ?? d.published,
            },
        );
    });
  }, [!!data]);
  const act = async (action: Action) => {
    try {
      await api('api/display/action', action);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (!data)
    return (
      <div className="pairing-screen">
        <div className="pairing-card">
          <img src="./mark.svg" width="54" alt="" />
          <span className="eyebrow">WILLKOMMEN ZU HAPanel</span>
          <h1>
            Ein Platz für
            <br />
            dein Zuhause.
          </h1>
          {pairing ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api('api/pair', { code, name });
                  load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <p>Erstelle im HAPanel Studio unter „Displays verbinden“ einen Kopplungscode.</p>
              <label>
                Dieses Display
                <input
                  value={name}
                  maxLength={64}
                  required
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Kopplungscode
                <input
                  className="code-input"
                  value={code}
                  placeholder="ABCDE-12345"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={20}
                  required
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </label>
              <button className="button primary full-width" type="submit">
                Mit Zuhause verbinden
              </button>
            </form>
          ) : (
            <p>Verbindung wird hergestellt …</p>
          )}
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  return (
    <>
      <Player published={data.published} snapshot={data.snapshot} onAction={act} />
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
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Display />
  </StrictMode>,
);
