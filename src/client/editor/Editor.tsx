import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import GridLayout, { type Layout } from 'react-grid-layout';
import { transformStrategy, getCompactor } from 'react-grid-layout/core';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  Eye,
  Grip,
  History,
  House,
  Layers3,
  LayoutGrid,
  Maximize2,
  Monitor,
  MoreHorizontal,
  Plus,
  Redo2,
  Search,
  Settings2,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  actionSchema,
  dashboardSchema,
  findSpace,
  geometry,
  tileKinds,
  type Action,
  type Dashboard,
  type Profile,
  type Snapshot,
  type Tile,
  type TileKind,
  type Workspace,
} from '../../shared/model';
import { api, serializeDashboard, type Bootstrap, type StudioService } from '../service';
import { DashboardFrame, ScaledCanvas, TileView } from '../ui/Dashboard';
import { kindIcons, kindLabels } from '../ui/kinds';
import { Modal } from '../ui/Modal';

const freshId = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
type Dialog = 'preview' | 'devices' | 'history' | 'import' | 'export' | null;
const domainKinds: Record<string, TileKind> = {
  light: 'light',
  switch: 'light',
  climate: 'climate',
  media_player: 'media',
  weather: 'weather',
  scene: 'scene',
  script: 'scene',
  sensor: 'sensor',
  binary_sensor: 'sensor',
};

export default function Editor({
  service,
  onExit,
}: {
  service: StudioService;
  onExit?: () => void;
}) {
  const [bootstrap, setBootstrap] = useState<Bootstrap>();
  const [loadError, setLoadError] = useState('');
  const load = useCallback(() => {
    setLoadError('');
    service
      .load()
      .then(setBootstrap)
      .catch((e) => setLoadError(e.message));
  }, [service]);
  useEffect(load, [load]);
  if (!bootstrap)
    return (
      <div className="loading-screen">
        <img src="./mark.svg" alt="" width="50" />
        <h1>HAPanel Studio</h1>
        <p>{loadError || 'Dein Zuhause wird vorbereitet …'}</p>
        {loadError && (
          <button className="button primary" onClick={load}>
            Erneut versuchen
          </button>
        )}
        {onExit && (
          <button className="button" onClick={onExit}>
            Zur Demo
          </button>
        )}
      </div>
    );
  return <Studio service={service} bootstrap={bootstrap} onExit={onExit} />;
}

function Studio({
  service,
  bootstrap,
  onExit,
}: {
  service: StudioService;
  bootstrap: Bootstrap;
  onExit?: () => void;
}) {
  const [workspace, setWorkspace] = useState(bootstrap.workspace);
  const [document, setDocument] = useState(bootstrap.workspace.draft.document);
  const documentRef = useRef(document),
    workspaceRef = useRef(workspace),
    saved = useRef(JSON.stringify(document));
  const saveQueue = useRef<Promise<Workspace>>(Promise.resolve(workspace));
  const [past, setPast] = useState<Dashboard[]>([]),
    [future, setFuture] = useState<Dashboard[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot>(bootstrap.snapshot);
  const [profileId, setProfileId] = useState(document.profiles[0].id),
    [pageId, setPageId] = useState(document.pages[0].id);
  const [selectedId, setSelectedId] = useState('light');
  const [inspector, setInspector] = useState<'tile' | 'display'>('tile');
  const [leftOpen, setLeftOpen] = useState(false),
    [rightOpen, setRightOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [toast, setToast] = useState(''),
    [dialog, setDialog] = useState<Dialog>(null);
  const [testMode, setTestMode] = useState(false),
    [grid, setGrid] = useState(true),
    [zoom, setZoom] = useState(1);
  const [code, setCode] = useState(''),
    [devices, setDevices] = useState<{ id: string; name: string }[]>([]);
  const [importText, setImportText] = useState(''),
    [format, setFormat] = useState<'json' | 'yaml'>('json');
  const fileRef = useRef<HTMLInputElement>(null);
  const [exportText, setExportText] = useState('');
  documentRef.current = document;
  workspaceRef.current = workspace;
  const profile = document.profiles.find((p) => p.id === profileId) ?? document.profiles[0];
  const page = document.pages.find((p) => p.id === pageId) ?? document.pages[0];
  const selected = page.tiles.find((t) => t.id === selectedId);
  const g = geometry(profile);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 6000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(
    () =>
      service.subscribe((message) => {
        if (message.snapshot) setSnapshot(message.snapshot);
        if (message.online === false)
          setSnapshot((current) => ({ ...current, status: 'reconnecting' }));
      }),
    [service],
  );

  const commit = (next: Dashboard) => {
    const result = dashboardSchema.safeParse(next);
    if (!result.success) {
      notify(result.error.issues[0]?.message ?? 'Ungültiges Layout.');
      return false;
    }
    if (JSON.stringify(next) === JSON.stringify(documentRef.current)) return true;
    setPast((current) => [...current.slice(-49), structuredClone(documentRef.current)]);
    setFuture([]);
    setDocument(result.data);
    setStatus('dirty');
    return true;
  };
  const change = (mutate: (draft: Dashboard) => void) => {
    const next = structuredClone(documentRef.current);
    mutate(next);
    return commit(next);
  };
  const flush = useCallback(() => {
    const task = saveQueue.current
      .catch(() => workspaceRef.current)
      .then(async () => {
        const candidate = documentRef.current,
          hash = JSON.stringify(candidate);
        if (hash === saved.current) return workspaceRef.current;
        setStatus('saving');
        const result = await service.save(candidate, workspaceRef.current.draft.revision);
        workspaceRef.current = result;
        saved.current = hash;
        setWorkspace(result);
        setStatus(JSON.stringify(documentRef.current) === hash ? 'saved' : 'dirty');
        return result;
      })
      .catch((error) => {
        setStatus('error');
        throw error;
      });
    saveQueue.current = task;
    return task;
  }, [service]);
  useEffect(() => {
    const timer = setTimeout(() => {
      flush().catch((e) => notify(e.message));
    }, 750);
    return () => clearTimeout(timer);
  }, [document, flush, notify]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(documentRef.current) !== saved.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [document, ...f]);
    setDocument(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setStatus('dirty');
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, document]);
    setDocument(future[0]);
    setFuture((f) => f.slice(1));
    setStatus('dirty');
  };
  const updateTile = (patch: Partial<Tile>) =>
    change((d) => {
      const tile = d.pages.find((p) => p.id === page.id)!.tiles.find((t) => t.id === selectedId);
      if (tile) Object.assign(tile, patch);
    });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches('input, textarea, select, [contenteditable]'))
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
      if (
        selected &&
        event.altKey &&
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
      ) {
        event.preventDefault();
        const r = selected.layouts[profile.id];
        updateTile({
          layouts: {
            ...selected.layouts,
            [profile.id]: {
              ...r,
              x: r.x + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0),
              y: r.y + (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0),
            },
          },
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  const publish = async () => {
    try {
      const latest = await flush();
      const result = await service.publish(latest.draft.revision);
      setWorkspace(result);
      workspaceRef.current = result;
      notify('Veröffentlicht. Deine Displays zeigen jetzt diese Version.');
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const addTile = (kind: TileKind, entityId?: string, drop?: { x: number; y: number }) => {
    const entity =
      bootstrap.catalog.find((e) => e.entity_id === entityId) ??
      bootstrap.catalog.find((e) => domainKinds[e.entity_id.split('.')[0]] === kind);
    if (!entity) {
      notify('Für diesen Kacheltyp wurde keine passende Entität gefunden.');
      return;
    }
    const layouts: Tile['layouts'] = {};
    for (const target of document.profiles) {
      const spot = findSpace(target, page.tiles, 4, 2);
      if (!spot) {
        notify(
          `Kein Platz auf „${target.name}“. Entferne eine Kachel oder erstelle eine neue Seite.`,
        );
        return;
      }
      layouts[target.id] = target.id === profile.id && drop ? { ...spot, ...drop } : spot;
    }
    const id = freshId(kind);
    const tile: Tile = {
      id,
      kind,
      title: String(entity.attributes.friendly_name ?? kindLabels[kind]),
      entityId: entity.entity_id,
      accent:
        kind === 'light'
          ? 'amber'
          : kind === 'climate'
            ? 'rose'
            : kind === 'weather'
              ? 'blue'
              : 'mint',
      layouts,
    };
    if (
      change((d) => {
        d.pages.find((p) => p.id === page.id)!.tiles.push(tile);
      })
    ) {
      setSelectedId(id);
      setInspector('tile');
    }
  };
  const addPage = () => {
    const id = freshId('page');
    if (
      change((d) => {
        d.pages.push({ id, name: `Seite ${d.pages.length + 1}`, tiles: [] });
      })
    ) {
      setPageId(id);
      setSelectedId('');
    }
  };
  const act = async (action: Action) => {
    try {
      actionSchema.parse(action);
      await service.act(action);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const exportFile = async () => {
    try {
      // Export the visible document even if saving is blocked by a network error or conflict.
      setExportText(serializeDashboard(documentRef.current, format));
      setDialog('export');
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportText], { type: 'text/plain' }));
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `hapanel.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const loadDevices = async () => {
    if (service.local) {
      notify(
        'Die gehostete Demo ist direkt auf jedem Gerät aufrufbar. Kopplung ist für dein eigenes Add-on vorgesehen.',
      );
      return;
    }
    try {
      setDevices(await api('api/editor/devices'));
      setDialog('devices');
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const profileUpdate = (patch: Partial<Profile>) =>
    change((d) => {
      Object.assign(
        d.profiles.find((p) => p.id === profile.id)!,
        patch,
      );
    });
  const layoutChanged = (layout: Layout) =>
    change((d) => {
      for (const tile of d.pages.find((p) => p.id === page.id)!.tiles) {
        const r = layout.find((item) => item.i === tile.id);
        if (r) tile.layouts[profile.id] = { x: r.x, y: r.y, w: r.w, h: r.h };
      }
    });
  const matchingEntities = bootstrap.catalog.filter(
    (e) =>
      domainKinds[e.entity_id.split('.')[0]] &&
      `${e.entity_id} ${e.attributes.friendly_name}`.toLowerCase().includes(search.toLowerCase()),
  );
  const layout = page.tiles.map((t) => ({ i: t.id, ...t.layouts[profile.id], minW: 2, minH: 1 }));
  const isPublished =
    saved.current === JSON.stringify(document) &&
    workspace.draft.revision === workspace.published.revision;
  const statusText =
    status === 'saving'
      ? 'Wird gespeichert …'
      : status === 'error'
        ? 'Speichern fehlgeschlagen'
        : status === 'dirty'
          ? 'Ungespeicherte Änderungen'
          : 'Entwurf gespeichert';

  return (
    <div className="studio">
      <header className="studio-header">
        <div className="brand">
          <img src="./mark.svg" alt="" />
          <span>HAPanel</span>
          <span className="studio-tag">STUDIO</span>
        </div>
        <span className="header-divider" />
        <div className="project-name">
          {document.name}
          <ChevronDown size={14} />
        </div>
        <div className="header-spacer" />
        {bootstrap.mode === 'demo' && (
          <span className="demo-badge">
            <i /> Demo
          </span>
        )}
        <span className={`save-status ${status}`}>
          <Check size={14} />
          {statusText}
        </span>
        <button
          className="button preview-button"
          onClick={async () => {
            try {
              await flush();
              setDialog('preview');
              setTestMode(false);
            } catch (error) {
              notify((error as Error).message);
            }
          }}
        >
          <Eye size={16} />
          Vorschau
        </button>
        <button className="button primary publish-button" onClick={publish}>
          <CheckCheck size={17} />
          <span>{isPublished ? 'Veröffentlicht' : 'Veröffentlichen'}</span>
        </button>
      </header>
      <div className="studio-body">
        <aside className={`library-panel ${leftOpen ? 'mobile-open' : ''}`}>
          <div className="panel-heading">
            <span>Deine Bausteine</span>
            <button
              className="icon-button mobile-only"
              onClick={() => setLeftOpen(false)}
              aria-label="Bibliothek schließen"
            >
              <X size={18} />
            </button>
          </div>
          <p className="panel-subtitle">Ein Zuhause, ganz nach deinem Gefühl.</p>
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Entitäten suchen"
              placeholder="Entitäten suchen …"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>⌕</kbd>
          </label>
          <div className="library-label">KACHELN</div>
          <div className="tile-library">
            {tileKinds.map((kind) => {
              const Icon = kindIcons[kind];
              return (
                <button
                  key={kind}
                  className={`library-tile kind-${kind}`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/hapanel', kind);
                    event.dataTransfer.setData('text/plain', kind);
                  }}
                  onClick={() => addTile(kind)}
                >
                  <span>
                    <Icon size={21} />
                  </span>
                  <strong>{kindLabels[kind]}</strong>
                  <Plus size={15} />
                </button>
              );
            })}
          </div>
          <div className="library-label entity-heading">
            ENTITÄTEN <span>{matchingEntities.length}</span>
          </div>
          <div className="entity-list">
            {matchingEntities.map((entity) => {
              const kind = domainKinds[entity.entity_id.split('.')[0]],
                Icon = kindIcons[kind];
              return (
                <button
                  key={entity.entity_id}
                  onClick={() => addTile(kind, entity.entity_id)}
                  title={entity.entity_id}
                >
                  <Icon size={17} />
                  <span>
                    <strong>{String(entity.attributes.friendly_name ?? entity.entity_id)}</strong>
                    <small>{entity.entity_id}</small>
                  </span>
                  <Plus size={14} />
                </button>
              );
            })}
            {matchingEntities.length === 0 && (
              <p className="muted">Keine passende Entität gefunden.</p>
            )}
          </div>
          <div className="library-bottom">
            <span className="connection-dot" />
            {snapshot.status === 'demo'
              ? 'Beispieldaten · lokal bedienbar'
              : snapshot.status === 'connected'
                ? 'Home Assistant verbunden'
                : 'Verbindung wird hergestellt …'}
            <small>Verschieben am Griff · Alt + Pfeiltasten</small>
          </div>
        </aside>
        <main className="workspace">
          <div className="workspace-toolbar">
            <div className="breadcrumb">
              <House size={16} />
              <span>{document.name}</span>
              <span>/</span>
              <strong>{page.name}</strong>
            </div>
            <div className="toolbar-actions">
              <button
                className="icon-button"
                aria-label="Rückgängig"
                title="Rückgängig"
                disabled={!past.length}
                onClick={undo}
              >
                <Undo2 size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Wiederholen"
                title="Wiederholen"
                disabled={!future.length}
                onClick={redo}
              >
                <Redo2 size={17} />
              </button>
              <span className="toolbar-divider" />
              <button
                className="icon-button"
                aria-label="Versionsverlauf"
                title="Versionsverlauf"
                onClick={() => setDialog('history')}
              >
                <History size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Konfiguration importieren"
                title="Importieren"
                onClick={() => setDialog('import')}
              >
                <ArrowUpFromLine size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Konfiguration exportieren"
                title="Exportieren"
                onClick={exportFile}
              >
                <ArrowDownToLine size={17} />
              </button>
            </div>
          </div>
          <div className="device-toolbar">
            <button className="button mobile-only" onClick={() => setLeftOpen(true)}>
              <Plus size={16} />
              Kacheln
            </button>
            <Tablet size={17} />
            <select
              aria-label="Displayprofil"
              value={profile.id}
              onChange={(e) => setProfileId(e.target.value)}
            >
              {document.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="device-resolution">
              {profile.width} × {profile.height} CSS px
            </span>
            <button
              className="icon-button"
              title="Display konfigurieren"
              aria-label="Display konfigurieren"
              onClick={() => {
                setInspector('display');
                setRightOpen(true);
              }}
            >
              <Settings2 size={17} />
            </button>
            <span className="toolbar-divider" />
            <button
              className={`icon-button ${grid ? 'selected' : ''}`}
              aria-label="Raster anzeigen"
              title="Raster anzeigen"
              aria-pressed={grid}
              onClick={() => setGrid(!grid)}
            >
              <LayoutGrid size={17} />
            </button>
            <button
              className="button mobile-only"
              onClick={() => {
                setInspector('tile');
                setRightOpen(true);
              }}
            >
              Eigenschaften
            </button>
          </div>
          <div className="canvas-workspace">
            <ScaledCanvas profile={profile} zoom={zoom}>
              {(scale) => (
                <DashboardFrame
                  document={document}
                  profile={profile}
                  pageId={page.id}
                  setPageId={setPageId}
                  snapshot={snapshot}
                >
                  <div
                    className={`editor-grid ${grid ? 'show-grid' : ''}`}
                    style={
                      {
                        width: g.width,
                        height: g.height,
                        '--cell-width': `${g.cellWidth + profile.gap}px`,
                        '--cell-height': `${g.rowHeight + profile.gap}px`,
                        '--grid-gap': `${profile.gap}px`,
                      } as CSSProperties
                    }
                  >
                    <GridLayout
                      key={`${page.id}-${profile.id}`}
                      width={g.width}
                      layout={layout}
                      autoSize={false}
                      style={{ height: g.height }}
                      gridConfig={{
                        cols: profile.columns,
                        rowHeight: g.rowHeight,
                        margin: [profile.gap, profile.gap],
                        containerPadding: [0, 0],
                        maxRows: profile.rows,
                      }}
                      dragConfig={{ enabled: true, handle: '.tile-drag', bounded: true }}
                      resizeConfig={{ enabled: true, handles: ['se'] }}
                      // Keep RGL's parent-relative drag origin; createScaledStrategy in
                      // 2.3.0 treats viewport coordinates as the grid origin.
                      positionStrategy={{ ...transformStrategy, scale }}
                      compactor={getCompactor(null, false, true)}
                      onDragStop={(next) => {
                        layoutChanged(next);
                      }}
                      onResizeStop={(next) => {
                        layoutChanged(next);
                      }}
                      dropConfig={{ enabled: true, defaultItem: { w: 4, h: 2 } }}
                      onDrop={(_layout, item, event) => {
                        const kind = (event as DragEvent).dataTransfer?.getData(
                          'application/hapanel',
                        ) as TileKind;
                        if (item && tileKinds.includes(kind))
                          addTile(kind, undefined, { x: item.x, y: item.y });
                      }}
                    >
                      {page.tiles.map((tile) => (
                        <div
                          key={tile.id}
                          className={`editor-tile ${selectedId === tile.id ? 'is-selected' : ''}`}
                          onPointerDown={() => {
                            setSelectedId(tile.id);
                            setInspector('tile');
                          }}
                        >
                          <TileView tile={tile} snapshot={snapshot} />
                          <button
                            className="tile-select-area"
                            aria-label={`${tile.title} auswählen`}
                            onClick={() => {
                              setSelectedId(tile.id);
                              setInspector('tile');
                            }}
                          />
                          <button className="tile-drag" aria-label={`${tile.title} verschieben`}>
                            <Grip size={18} />
                          </button>
                          {selectedId === tile.id && (
                            <span className="tile-size-tag">
                              {tile.layouts[profile.id].w} × {tile.layouts[profile.id].h}
                            </span>
                          )}
                        </div>
                      ))}
                    </GridLayout>
                    {page.tiles.length === 0 && (
                      <div className="empty-dashboard">
                        <Plus size={32} />
                        <h2>Was macht dein Zuhause aus?</h2>
                        <p>Füge links deine erste Kachel hinzu.</p>
                      </div>
                    )}
                  </div>
                </DashboardFrame>
              )}
            </ScaledCanvas>
          </div>
          <footer className="workspace-footer">
            <span className="pages-label">SEITEN</span>
            <div className="page-tabs">
              {document.pages.map((p, index) => (
                <button
                  key={p.id}
                  className={page.id === p.id ? 'active' : ''}
                  onClick={() => {
                    setPageId(p.id);
                    setSelectedId('');
                  }}
                >
                  <span>{index + 1}</span>
                  {p.name}
                </button>
              ))}
              <button
                className="add-page"
                aria-label="Seite hinzufügen"
                title="Seite hinzufügen"
                onClick={addPage}
              >
                <Plus size={17} />
              </button>
            </div>
            <div className="footer-spacer" />
            <button
              className="zoom-reset"
              onClick={() => setZoom(1)}
              title="An Arbeitsfläche anpassen"
            >
              <Maximize2 size={14} />
              {Math.round(zoom * 100)} %
            </button>
            <input
              className="zoom-slider"
              aria-label="Vorschau-Zoom"
              type="range"
              min="0.6"
              max="1.5"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </footer>
        </main>
        <aside className={`inspector-panel ${rightOpen ? 'mobile-open' : ''}`}>
          <div className="inspector-tabs">
            <button
              className={inspector === 'tile' ? 'active' : ''}
              onClick={() => setInspector('tile')}
            >
              Kachel
            </button>
            <button
              className={inspector === 'display' ? 'active' : ''}
              onClick={() => setInspector('display')}
            >
              Display
            </button>
            <button
              className="icon-button mobile-only"
              onClick={() => setRightOpen(false)}
              aria-label="Eigenschaften schließen"
            >
              <X size={18} />
            </button>
          </div>
          <div className="inspector-content">
            {inspector === 'tile' ? (
              selected ? (
                <>
                  <div className="inspector-tile-title">
                    <span className={`inspector-tile-icon kind-${selected.kind}`}>
                      {(() => {
                        const Icon = kindIcons[selected.kind];
                        return <Icon size={23} />;
                      })()}
                    </span>
                    <div>
                      <h2>{selected.title}</h2>
                      <p>
                        {kindLabels[selected.kind]} · {selected.layouts[profile.id].w} ×{' '}
                        {selected.layouts[profile.id].h}
                      </p>
                    </div>
                  </div>
                  <div className="form-section">
                    <h3>VERBINDUNG</h3>
                    <label>
                      Entität
                      <select
                        value={selected.entityId}
                        onChange={(e) => updateTile({ entityId: e.target.value })}
                      >
                        {bootstrap.catalog
                          .filter((e) => domainKinds[e.entity_id.split('.')[0]] === selected.kind)
                          .map((e) => (
                            <option key={e.entity_id} value={e.entity_id}>
                              {String(e.attributes.friendly_name ?? e.entity_id)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <span className="field-hint">{selected.entityId}</span>
                  </div>
                  <div className="form-section">
                    <h3>DARSTELLUNG</h3>
                    <label>
                      Titel
                      <input
                        value={selected.title}
                        maxLength={64}
                        onChange={(e) => {
                          if (e.target.value.trim()) updateTile({ title: e.target.value });
                        }}
                      />
                    </label>
                    <label>Akzentfarbe</label>
                    <div className="color-options">
                      {(['amber', 'mint', 'blue', 'rose'] as const).map((color) => (
                        <button
                          key={color}
                          className={`swatch swatch-${color} ${selected.accent === color ? 'active' : ''}`}
                          aria-label={`Farbe ${color}`}
                          aria-pressed={selected.accent === color}
                          onClick={() => updateTile({ accent: color })}
                        >
                          {selected.accent === color && <Check size={16} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-section">
                    <h3>POSITION IM RASTER</h3>
                    <div className="number-grid">
                      {(['x', 'y', 'w', 'h'] as const).map((key) => (
                        <NumberField
                          key={key}
                          label={{ x: 'Spalte', y: 'Zeile', w: 'Breite', h: 'Höhe' }[key]}
                          value={selected.layouts[profile.id][key]}
                          min={key === 'x' || key === 'y' ? 0 : 1}
                          max={key === 'x' || key === 'w' ? profile.columns : profile.rows}
                          onChange={(value) =>
                            updateTile({
                              layouts: {
                                ...selected.layouts,
                                [profile.id]: { ...selected.layouts[profile.id], [key]: value },
                              },
                            })
                          }
                        />
                      ))}
                    </div>
                    <span className="field-hint">Gilt für „{profile.name}“.</span>
                  </div>
                  <div className="tile-inspector-actions">
                    <button
                      className="button"
                      onClick={() => {
                        const copy = structuredClone(selected);
                        copy.id = freshId(copy.kind);
                        copy.title += ' Kopie';
                        for (const p of document.profiles) {
                          const spot = findSpace(
                            p,
                            page.tiles,
                            copy.layouts[p.id].w,
                            copy.layouts[p.id].h,
                          );
                          if (!spot) {
                            notify('Für die Kopie ist auf mindestens einem Display kein Platz.');
                            return;
                          }
                          copy.layouts[p.id] = spot;
                        }
                        if (
                          change((d) => {
                            d.pages.find((p) => p.id === page.id)!.tiles.push(copy);
                          })
                        )
                          setSelectedId(copy.id);
                      }}
                    >
                      <Copy size={15} />
                      Duplizieren
                    </button>
                    <button
                      className="button danger"
                      onClick={() => {
                        change((d) => {
                          d.pages.find((p) => p.id === page.id)!.tiles = page.tiles.filter(
                            (t) => t.id !== selectedId,
                          );
                        });
                        setSelectedId('');
                      }}
                    >
                      <Trash2 size={15} />
                      Entfernen
                    </button>
                  </div>
                </>
              ) : (
                <div className="no-selection">
                  <Layers3 size={30} />
                  <h2>Dein Layout, dein Gefühl.</h2>
                  <p>Wähle eine Kachel aus, um sie anzupassen.</p>
                  <label>
                    Seitenname
                    <input
                      value={page.name}
                      onChange={(e) => {
                        if (e.target.value.trim())
                          change((d) => {
                            d.pages.find((p) => p.id === page.id)!.name = e.target.value;
                          });
                      }}
                    />
                  </label>
                  {document.pages.length > 1 && (
                    <button
                      className="button danger"
                      onClick={() => {
                        if (page.tiles.length) {
                          notify('Entferne zuerst die Kacheln dieser Seite.');
                          return;
                        }
                        change((d) => {
                          d.pages = d.pages.filter((p) => p.id !== page.id);
                        });
                        setPageId(document.pages.find((p) => p.id !== page.id)!.id);
                      }}
                    >
                      <Trash2 size={15} />
                      Leere Seite entfernen
                    </button>
                  )}
                </div>
              )
            ) : (
              <>
                <div className="inspector-tile-title">
                  <span className="inspector-tile-icon">
                    <Tablet size={24} />
                  </span>
                  <div>
                    <h2>Dein Display</h2>
                    <p>Präzise bis ins Detail.</p>
                  </div>
                </div>
                <DisplayFields profile={profile} onChange={profileUpdate} />
                <button
                  className="button full-width"
                  onClick={() => {
                    const copy = structuredClone(profile);
                    copy.id = freshId('display');
                    copy.name = `${profile.name} Kopie`;
                    if (
                      change((d) => {
                        d.profiles.push(copy);
                        for (const p of d.pages)
                          for (const t of p.tiles)
                            t.layouts[copy.id] = { ...t.layouts[profile.id] };
                      })
                    )
                      setProfileId(copy.id);
                  }}
                >
                  <Plus size={15} />
                  Displayprofil duplizieren
                </button>
                <div className="form-section">
                  <h3>ATMOSPHÄRE</h3>
                  <div className="theme-options">
                    {(['dusk', 'ocean', 'sand'] as const).map((theme) => (
                      <button
                        key={theme}
                        title={theme}
                        aria-label={`Theme ${theme}`}
                        className={`theme-swatch theme-${theme} ${document.theme === theme ? 'active' : ''}`}
                        onClick={() =>
                          change((d) => {
                            d.theme = theme;
                          })
                        }
                      >
                        {document.theme === theme && <Check size={17} />}
                      </button>
                    ))}
                  </div>
                  <label>
                    Begrüßung
                    <input
                      value={document.greeting}
                      maxLength={80}
                      onChange={(e) => {
                        if (e.target.value.trim())
                          change((d) => {
                            d.greeting = e.target.value;
                          });
                      }}
                    />
                  </label>
                  <label>
                    Unterzeile
                    <input
                      value={document.subtitle}
                      maxLength={100}
                      onChange={(e) =>
                        change((d) => {
                          d.subtitle = e.target.value;
                        })
                      }
                    />
                  </label>
                </div>
              </>
            )}
          </div>
          <div className="inspector-bottom">
            <button className="button full-width" onClick={loadDevices}>
              <Monitor size={16} />
              Displays verbinden
            </button>
            {onExit && (
              <button
                className="button full-width subtle"
                onClick={async () => {
                  try {
                    await flush();
                    onExit();
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                <ArrowLeft size={15} />
                Zur Dashboard-Demo
              </button>
            )}
          </div>
        </aside>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button aria-label="Meldung schließen" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {dialog === 'preview' && (
        <Modal title="So fühlt sich dein Zuhause an." onClose={() => setDialog(null)} wide>
          <div className="preview-controls">
            <span>
              {testMode
                ? 'Bedienung aktiv – Aktionen werden ausgeführt.'
                : 'Vorschau · Gerätebedienung gesperrt'}
            </span>
            <label className="switch-label">
              <input
                type="checkbox"
                checked={testMode}
                onChange={(e) => setTestMode(e.target.checked)}
              />
              Testmodus
            </label>
          </div>
          <div className="preview-canvas">
            <ScaledCanvas profile={profile}>
              <DashboardFrame
                document={document}
                profile={profile}
                pageId={page.id}
                setPageId={setPageId}
                snapshot={snapshot}
                onAction={testMode ? act : undefined}
              />
            </ScaledCanvas>
          </div>
        </Modal>
      )}
      {dialog === 'history' && (
        <Modal title="Versionsverlauf" onClose={() => setDialog(null)}>
          <p className="muted">
            Eine Wiederherstellung erzeugt einen neuen Entwurf. Deine Displays behalten ihre
            veröffentlichte Version.
          </p>
          <div className="revision-list">
            {[workspace.published, ...workspace.history]
              .filter((r, i, all) => all.findIndex((x) => x.revision === r.revision) === i)
              .sort((a, b) => b.revision - a.revision)
              .map((revision) => (
                <div key={revision.revision}>
                  <span>
                    <strong>Version {revision.revision}</strong>
                    <small>
                      {new Date(revision.savedAt).toLocaleString('de-AT')}
                      {revision.revision === workspace.published.revision
                        ? ' · Veröffentlicht'
                        : ''}
                    </small>
                  </span>
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        const latest = await flush();
                        const result = await service.restore(
                          revision.revision,
                          latest.draft.revision,
                        );
                        setPast((p) => [...p, document]);
                        setFuture([]);
                        setDocument(result.draft.document);
                        saved.current = JSON.stringify(result.draft.document);
                        workspaceRef.current = result;
                        setWorkspace(result);
                        setStatus('saved');
                        setDialog(null);
                        notify('Version als Entwurf wiederhergestellt.');
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    }}
                  >
                    Wiederherstellen
                  </button>
                </div>
              ))}
          </div>
        </Modal>
      )}
      {dialog === 'devices' && (
        <Modal title="Ein Display für dein Zuhause." onClose={() => setDialog(null)}>
          <p className="muted">
            Öffne die Display-Adresse deines Add-ons auf dem Tablet und gib den Kopplungscode ein.
            Codes sind fünf Minuten gültig.
          </p>
          {!bootstrap.displayEnabled && (
            <p className="notice">
              Der separate Display-Port ist noch deaktiviert. Lokal lässt er sich mit
              HAPANEL_DISPLAY_PORT aktivieren; im Add-on über die Option display_enabled.
            </p>
          )}
          <button
            className="button primary"
            onClick={async () => {
              try {
                const result = await api<{ code: string }>('api/editor/pair-code', {});
                setCode(result.code);
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            Kopplungscode erstellen
          </button>
          {code && (
            <div className="pair-code">
              {code.slice(0, 5)}-{code.slice(5)}
            </div>
          )}
          <div className="revision-list">
            {devices.map((device) => (
              <div key={device.id}>
                <strong>{device.name}</strong>
                <button
                  className="button danger"
                  onClick={async () => {
                    try {
                      await api(`api/editor/devices/${device.id}`, {}, 'DELETE');
                      setDevices(devices.filter((d) => d.id !== device.id));
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  Freigabe widerrufen
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {dialog === 'import' && (
        <Modal title="Dein Layout mitbringen." onClose={() => setDialog(null)}>
          <p className="muted">
            Importiert eine HAPanel-Konfiguration als Entwurf. Der aktuelle Stand bleibt im
            Versionsverlauf.
          </p>
          <select
            aria-label="Importformat"
            value={format}
            onChange={(e) => setFormat(e.target.value as 'json' | 'yaml')}
          >
            <option value="json">JSON</option>
            <option value="yaml">YAML</option>
          </select>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".json,.yaml,.yml"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                setImportText(await file.text());
                setFormat(file.name.endsWith('.json') ? 'json' : 'yaml');
              }
            }}
          />
          <button className="button" onClick={() => fileRef.current?.click()}>
            Datei auswählen
          </button>
          <textarea
            aria-label="Konfiguration"
            className="config-text"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Konfiguration hier einfügen …"
          />
          <button
            className="button primary"
            onClick={async () => {
              try {
                const latest = await flush();
                const result = await service.import(importText, format, latest.draft.revision);
                setPast((p) => [...p, document]);
                setFuture([]);
                setDocument(result.draft.document);
                saved.current = JSON.stringify(result.draft.document);
                workspaceRef.current = result;
                setWorkspace(result);
                setStatus('saved');
                setSelectedId('');
                setDialog(null);
                notify('Konfiguration als Entwurf importiert.');
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            Als Entwurf importieren
          </button>
        </Modal>
      )}
      {dialog === 'export' && (
        <Modal title="Dein Zuhause zum Mitnehmen." onClose={() => setDialog(null)}>
          <p className="muted">
            Enthält Layouts und Entitätsnamen. Zugangsdaten und Gerätesitzungen sind separat
            gespeichert.
          </p>
          <select
            aria-label="Exportformat"
            value={format}
            onChange={(e) => {
              const next = e.target.value as 'json' | 'yaml';
              setFormat(next);
              setExportText(serializeDashboard(documentRef.current, next));
            }}
          >
            <option value="json">JSON</option>
            <option value="yaml">YAML</option>
          </select>
          <textarea
            className="config-text"
            aria-label="Exportierte Konfiguration"
            readOnly
            value={exportText}
          />
          <button className="button primary" onClick={download}>
            <ArrowDownToLine size={16} />
            Herunterladen
          </button>
        </Modal>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  min = 0,
  max = 8192,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const next = Number(text);
          if (text && Number.isFinite(next) && next >= min && next <= max) onChange(next);
          setText(String(value));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}
function DisplayFields({
  profile: p,
  onChange,
}: {
  profile: Profile;
  onChange: (patch: Partial<Profile>) => void;
}) {
  return (
    <>
      <div className="form-section">
        <h3>DISPLAYPROFIL</h3>
        <label>
          Name
          <input
            value={p.name}
            onChange={(e) => {
              if (e.target.value.trim()) onChange({ name: e.target.value });
            }}
          />
        </label>
        <div className="number-grid">
          <NumberField
            label="Diagonale (Zoll)"
            value={p.diagonal}
            min={2}
            max={100}
            step={0.1}
            onChange={(v) => onChange({ diagonal: v })}
          />
          <NumberField
            label="Pixelverhältnis"
            value={p.dpr}
            min={0.5}
            max={4}
            step={0.25}
            onChange={(v) => onChange({ dpr: v })}
          />
        </div>
        <div className="number-grid">
          <NumberField
            label="Hardwarebreite"
            value={p.physicalWidth}
            min={240}
            max={16384}
            onChange={(v) => onChange({ physicalWidth: v })}
          />
          <NumberField
            label="Hardwarehöhe"
            value={p.physicalHeight}
            min={240}
            max={16384}
            onChange={(v) => onChange({ physicalHeight: v })}
          />
        </div>
        <button
          className="button full-width"
          style={{ marginTop: 14 }}
          onClick={() =>
            onChange({
              width: Math.round(p.physicalWidth / p.dpr),
              height: Math.round(p.physicalHeight / p.dpr),
            })
          }
        >
          Auflösung und Pixelverhältnis übernehmen
        </button>
      </div>
      <div className="form-section">
        <h3>BROWSERFLÄCHE · CSS-PIXEL</h3>
        <div className="number-grid">
          <NumberField
            label="Breite"
            value={p.width}
            min={320}
            onChange={(v) => onChange({ width: v })}
          />
          <NumberField
            label="Höhe"
            value={p.height}
            min={240}
            onChange={(v) => onChange({ height: v })}
          />
        </div>
        <span className="field-hint">
          Browserleisten verkleinern die nutzbare Fläche. Hardware-Pixel und CSS-Pixel werden
          getrennt gespeichert.
        </span>
        <label>
          Darstellung
          <select
            value={p.mode}
            onChange={(e) => onChange({ mode: e.target.value as Profile['mode'] })}
          >
            <option value="fit">Proportional einpassen</option>
            <option value="exact">Exakte CSS-Pixel</option>
          </select>
        </label>
        <button
          className="button full-width"
          onClick={() =>
            onChange({
              width: p.height,
              height: p.width,
              physicalWidth: p.physicalHeight,
              physicalHeight: p.physicalWidth,
            })
          }
        >
          <Smartphone size={15} />
          Ausrichtung wechseln
        </button>
      </div>
      <div className="form-section">
        <h3>RASTER & ABSTÄNDE</h3>
        <div className="number-grid">
          <NumberField
            label="Spalten"
            value={p.columns}
            min={2}
            max={24}
            onChange={(v) => onChange({ columns: v })}
          />
          <NumberField
            label="Zeilen"
            value={p.rows}
            min={2}
            max={20}
            onChange={(v) => onChange({ rows: v })}
          />
          <NumberField
            label="Abstand"
            value={p.gap}
            max={40}
            onChange={(v) => onChange({ gap: v })}
          />
          <NumberField
            label="Außenrand"
            value={p.margin}
            max={96}
            onChange={(v) => onChange({ margin: v })}
          />
          <NumberField
            label="Kopfbereich"
            value={p.headerHeight}
            min={48}
            max={180}
            onChange={(v) => onChange({ headerHeight: v })}
          />
          <NumberField
            label="Navigation"
            value={p.footerHeight}
            min={40}
            max={100}
            onChange={(v) => onChange({ footerHeight: v })}
          />
        </div>
        <span className="field-hint">
          Rasteränderungen werden nur übernommen, wenn alle Kacheln weiterhin Platz haben.
        </span>
      </div>
    </>
  );
}
