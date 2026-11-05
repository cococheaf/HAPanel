import './editor.css';
import { ViewSettings } from './ViewSettings';
import { searchText, entityDetails } from './select-options';
import { EditorSection } from './EditorSection';
import { SearchSelect } from './SearchSelect';
import {
  exportProject,
  importProject,
  parseProject,
  PROJECT_MAX_BYTES,
  type ProjectBundle,
} from '../project';
import { ImageLibraryContext } from '../ui/ImageContext';
import { DesignSettings } from './DesignSettings';
import { TileExperienceSettings, ProfileExperienceSettings } from './ExperienceSettings';
import { ReviewDialog, TemplateDialog, AlertSettings } from './WorkspaceTools';
import { DeviceManager } from './DeviceManager';
import { reviewDashboard } from '../../shared/experience';
import { transformSelection, pasteTiles } from '../../shared/designer';
import { domainKinds } from '../../shared/widgets';
import { localizeSampleDocument, localizedSampleTile, sampleEntityName } from '../../shared/demo';
import { useI18n, LanguageSwitcher } from '../i18n';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
  Plus,
  Redo2,
  Search,
  Settings2,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  pagesForProfile,
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
import { kindIcons, kindLabelKeys } from '../ui/kinds';
import { Modal } from '../ui/Modal';
import { DisplayManager, type DisplayIntent } from './DisplayManager';
import { createDisplay, resizeDisplay, layoutId } from '../../shared/display-layouts';
import { InsightSettings, CardViewSettings } from './InsightSettings';
import { TextInput } from './TextInput';

const freshId = layoutId;
type Dialog =
  | 'preview'
  | 'devices'
  | 'displays'
  | 'history'
  | 'import'
  | 'export'
  | 'review'
  | 'template'
  | 'alerts'
  | 'diagnostics'
  | 'help'
  | null;

export default function Editor({
  service,
  onExit,
}: {
  service: StudioService;
  onExit?: () => void;
}) {
  const { t, describeError } = useI18n();

  const [bootstrap, setBootstrap] = useState<Bootstrap>();
  const [loadError, setLoadError] = useState<unknown>();
  const load = useCallback(() => {
    setLoadError(undefined);
    service
      .load()
      .then(setBootstrap)
      .catch((e) => setLoadError(e));
  }, [service]);
  useEffect(load, [load]);
  if (!bootstrap)
    return (
      <div className="loading-screen">
        <LanguageSwitcher />
        <img src="./mark.svg" alt="" width="50" />
        <h1>HAPanel Studio</h1>
        <p>{loadError ? describeError(loadError) : t('common.loading')}</p>
        {Boolean(loadError) && (
          <button className="button primary" onClick={load}>
            {t('common.retry')}
          </button>
        )}
        {onExit && (
          <button className="button" onClick={onExit}>
            {t('common.backDemo')}
          </button>
        )}
      </div>
    );
  return (
    <ImageLibraryContext.Provider value={service.images}>
      <Studio service={service} bootstrap={bootstrap} onExit={onExit} />
    </ImageLibraryContext.Provider>
  );
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
  const { t, language, intlLocale, describeError } = useI18n();

  const [catalog, setCatalog] = useState(bootstrap.catalog);
  const [workspace, setWorkspace] = useState(bootstrap.workspace);
  const [document, setDocument] = useState(bootstrap.workspace.draft.document);
  const documentRef = useRef(document),
    workspaceRef = useRef(workspace),
    saved = useRef(JSON.stringify(document));
  const saveQueue = useRef<Promise<Workspace>>(Promise.resolve(workspace));
  const [past, setPast] = useState<Dashboard[]>([]),
    [future, setFuture] = useState<Dashboard[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot>(bootstrap.snapshot);
  const [profileId, setProfileId] = useState(() => {
      try {
        const id =
          new URL(window.location.href).searchParams.get('display') ??
          localStorage.getItem('hapanel-editor-display');
        if (document.profiles.some((profile) => profile.id === id)) return id!;
      } catch {}
      return document.profiles[0].id;
    }),
    [pageId, setPageId] = useState(document.pages[0].id);
  const [selectedId, setSelectedId] = useState('light');
  const [inspector, setInspector] = useState<'tile' | 'view' | 'display' | 'design'>('tile');
  const [leftOpen, setLeftOpen] = useState(false),
    [rightOpen, setRightOpen] = useState(false);
  const libraryDrawer = useMediaQuery('(max-width: 1150px)');
  const inspectorDrawer = useMediaQuery('(max-width: 900px)');
  const [status, setStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [search, setSearch] = useState('');
  const [libraryTab, setLibraryTab] = useState<'blocks' | 'entities'>('blocks');
  const [entityLimit, setEntityLimit] = useState(100);
  const inspectorContent = useRef<HTMLDivElement>(null);
  useEffect(() => {
    inspectorContent.current?.scrollTo({ top: 0 });
  }, [inspector, selectedId, profileId]);
  const [areaFilter, setAreaFilter] = useState(''),
    [kindFilter, setKindFilter] = useState(''),
    [unplaced, setUnplaced] = useState(false);
  useEffect(() => setEntityLimit(100), [search, areaFilter, kindFilter, unplaced]);
  const [selection, setSelection] = useState<string[]>([]);
  const clipboard = useRef<Tile[]>([]);
  const [clipboardCount, setClipboardCount] = useState(0);
  const [simple, setSimple] = useState(false);
  useEffect(() => {
    setSelection([]);
  }, [profileId, pageId]);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown>>();
  const [recovery, setRecovery] = useState<Dashboard>();
  const recoveryKey = 'hapanel-recovery:' + window.location.pathname;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(recoveryKey);
      if (raw) {
        const stored = JSON.parse(raw);
        if (
          stored.revision === bootstrap.workspace.draft.revision &&
          JSON.stringify(stored.document) !== JSON.stringify(bootstrap.workspace.draft.document)
        )
          setRecovery(dashboardSchema.parse(stored.document));
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (status === 'dirty' || status === 'saving') {
      try {
        localStorage.setItem(
          recoveryKey,
          JSON.stringify({ document, revision: workspaceRef.current.draft.revision }),
        );
      } catch {}
    } else if (status === 'saved' && saved.current === JSON.stringify(document))
      try {
        localStorage.removeItem(recoveryKey);
      } catch {}
  }, [document, status]);

  const [toast, setToast] = useState(''),
    [dialog, setDialog] = useState<Dialog>(null);
  const [displayIntent, setDisplayIntent] = useState<DisplayIntent>();
  const manageDisplays = (intent?: DisplayIntent) => {
    setDisplayIntent(intent);
    setDialog('displays');
  };
  const [testMode, setTestMode] = useState(false),
    [grid, setGrid] = useState(true),
    [zoom, setZoom] = useState(1);
  const [importText, setImportText] = useState(''),
    [format, setFormat] = useState<'json' | 'yaml'>('json');
  const fileRef = useRef<HTMLInputElement>(null);
  const [exportText, setExportText] = useState('');
  const [importPackage, setImportPackage] = useState<ProjectBundle>();
  const [transferBusy, setTransferBusy] = useState(false);
  const importAbort = useRef<AbortController>(undefined);
  useEffect(() => () => importAbort.current?.abort(), []);
  documentRef.current = document;
  workspaceRef.current = workspace;
  const profile = document.profiles.find((p) => p.id === profileId) ?? document.profiles[0];
  const visiblePages = pagesForProfile(document, profile.id);
  const page = visiblePages.find((p) => p.id === pageId) ?? visiblePages[0];
  const selected = page.tiles.find((t) => t.id === selectedId);
  const viewDocument = localizeSampleDocument(document, language);
  useEffect(() => {
    try {
      localStorage.setItem('hapanel-editor-display', profile.id);
    } catch {}
  }, [profile.id]);
  const viewPage = viewDocument.pages.find((p) => p.id === page.id)!;
  const viewProfile = viewDocument.profiles.find((p) => p.id === profile.id)!;
  const viewSelected = selected && localizedSampleTile(selected, language);
  const entityName = (entity: Bootstrap['catalog'][number]) =>
    bootstrap.mode === 'demo'
      ? sampleEntityName(entity, language)
      : String(entity.attributes.friendly_name ?? entity.entity_id);
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
      notify(describeError(result.error));
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
        if (hash === saved.current) {
          setStatus('saved');
          return workspaceRef.current;
        }
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
      flush().catch((e) => notify(describeError(e)));
    }, 750);
    return () => clearTimeout(timer);
  }, [document, flush, notify, describeError]);
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
  const bulk = (operation: 'left' | 'top' | 'space' | 'size' | 'move', dx = 0, dy = 0) => {
    try {
      commit(
        transformSelection(
          documentRef.current,
          page.id,
          profile.id,
          selection.length ? selection : selectedId ? [selectedId] : [],
          operation,
          dx,
          dy,
        ),
      );
    } catch (e) {
      notify(describeError(e));
    }
  };
  const copySelection = () => {
    clipboard.current = structuredClone(
      page.tiles.filter((tile) => (selection.length ? selection : [selectedId]).includes(tile.id)),
    );
    setClipboardCount(clipboard.current.length);
  };
  const pasteSelection = () => {
    try {
      if (!clipboard.current.length) return;
      const result = pasteTiles(documentRef.current, page.id, profile.id, clipboard.current);
      if (commit(result.document)) {
        setSelection(result.ids);
        setSelectedId(result.ids[0]);
      }
    } catch (e) {
      notify(describeError(e));
    }
  };
  const updateTile = (patch: Partial<Tile>) =>
    change((d) => {
      const tile = d.pages.find((p) => p.id === page.id)!.tiles.find((t) => t.id === selectedId);
      if (tile) Object.assign(tile, patch);
    });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest(
          'input, textarea, select, dialog, [role=combobox], [contenteditable], button:not(.tile-select-area):not(.tile-drag)',
        )
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        copySelection();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteSelection();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setLeftOpen(true);
        setRightOpen(false);
        setLibraryTab('entities');
        requestAnimationFrame(() =>
          window.document
            .querySelector<HTMLInputElement>('.search-field input')
            ?.focus({ preventScroll: true }),
        );
      }
      if (selected && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        bulk(
          'move',
          event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0,
          event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0,
        );
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  const publish = async (reviewed = false) => {
    if (!reviewed && reviewDashboard(documentRef.current, catalog).length) {
      setDialog('review');
      return;
    }
    try {
      const latest = await flush();
      const result = await service.publish(latest.draft.revision);
      setWorkspace(result);
      workspaceRef.current = result;
      notify(t('editor.publishedNotice'));
    } catch (e) {
      notify(describeError(e));
    }
  };
  const addTile = (kind: TileKind, entityId?: string, drop?: { x: number; y: number }) => {
    const entity =
      catalog.find((e) => e.entity_id === entityId) ??
      catalog.find((e) =>
        kind === 'contacts'
          ? e.entity_id.startsWith('binary_sensor.') &&
            ['door', 'window', 'opening'].includes(String(e.attributes.device_class))
          : domainKinds[e.entity_id.split('.')[0]] === kind,
      );
    if (!entity && kind !== 'section') {
      notify(t('editor.noEntityKind'));
      return;
    }
    const layouts: Tile['layouts'] = {};
    for (const target of document.profiles.filter(
      (profile) => !page.profileIds || page.profileIds.includes(profile.id),
    )) {
      const spot = findSpace(
        target,
        page.tiles,
        kind === 'section' ? Math.min(8, target.columns) : 4,
        kind === 'section' ? 1 : 2,
      );
      if (!spot) {
        notify(t('editor.noSpace', { name: target.name }));
        return;
      }
      layouts[target.id] =
        target.id === profile.id && drop
          ? {
              ...spot,
              x: Math.max(0, Math.min(drop.x, target.columns - spot.w)),
              y: Math.max(0, Math.min(drop.y, target.rows - spot.h)),
            }
          : spot;
    }
    const id = freshId(kind);
    const tile: Tile = {
      id,
      kind,
      title: kind === 'section' ? t('kind.section') : entityName(entity!).slice(0, 64),
      entityId: kind === 'section' ? '' : entity!.entity_id,
      accent:
        kind === 'light'
          ? 'amber'
          : kind === 'climate'
            ? 'rose'
            : kind === 'weather'
              ? 'blue'
              : 'mint',
      layouts,
      ...(kind === 'contacts'
        ? {
            title: t('kind.contacts'),
            contacts: [{ entityId: entity!.entity_id, label: entityName(entity!).slice(0, 64) }],
          }
        : {}),
    };
    if (
      change((d) => {
        d.pages.find((p) => p.id === page.id)!.tiles.push(tile);
      })
    ) {
      setSelectedId(id);
      setInspector('tile');
      setLeftOpen(false);
      setRightOpen(true);
    }
  };
  const addPage = () => {
    const id = freshId('page');
    if (
      change((d) => {
        d.pages.push({
          id,
          name: t('editor.newPage', { number: visiblePages.length + 1 }),
          profileIds: [profile.id],
          tiles: [],
        });
      })
    ) {
      setPageId(id);
      setSelectedId('');
      setInspector('view');
      setRightOpen(true);
    }
  };
  const act = async (action: Action) => {
    try {
      actionSchema.parse(action);
      await service.act(action);
    } catch (e) {
      notify(describeError(e));
      throw e;
    }
  };
  const exportFile = async () => {
    try {
      // Export the visible document even if saving is blocked by a network error or conflict.
      setExportText(serializeDashboard(documentRef.current, format));
      setDialog('export');
    } catch (e) {
      notify(describeError(e));
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
  const loadDevices = () => {
    if (service.local) {
      notify(t('editor.displayPortDisabled'));
      return;
    }
    setDialog('devices');
  };

  const profileUpdate = (patch: Partial<Profile>) => {
    try {
      commit(resizeDisplay(documentRef.current, profile.id, patch));
    } catch (error) {
      notify(describeError(error));
    }
  };
  const layoutChanged = (layout: Layout) =>
    change((d) => {
      for (const tile of d.pages.find((p) => p.id === page.id)!.tiles) {
        const r = layout.find((item) => item.i === tile.id);
        if (r && !tile.experience?.locked)
          tile.layouts[profile.id] = { x: r.x, y: r.y, w: r.w, h: r.h };
      }
    });
  const searchableCatalog = useMemo(
    () =>
      catalog.map((entity) => ({
        entity,
        text: searchText(
          `${entity.entity_id} ${entity.attributes.friendly_name} ${entityName(entity)} ${entity.area?.name ?? ''} ${entity.area?.floor ?? ''} ${entity.deviceName ?? ''}`,
        ),
      })),
    [catalog, language, bootstrap.mode],
  );
  const matchingEntities = useMemo(() => {
    const terms = searchText(search).split(' ').filter(Boolean);
    const used = new Set(
      visiblePages.flatMap((page) =>
        page.tiles.flatMap((tile) => [
          tile.entityId,
          ...(tile.room?.controls.map((control) => control.entityId) ?? []),
        ]),
      ),
    );
    return searchableCatalog
      .filter(
        ({ entity: e, text }) =>
          domainKinds[e.entity_id.split('.')[0]] &&
          (!areaFilter || e.area?.id === areaFilter) &&
          (!kindFilter || domainKinds[e.entity_id.split('.')[0]] === kindFilter) &&
          (!unplaced || !used.has(e.entity_id)) &&
          terms.every((term) => text.includes(term)),
      )
      .map((row) => row.entity);
  }, [searchableCatalog, areaFilter, kindFilter, unplaced, search, document.pages, profile.id]);
  const layout = page.tiles.map((t) => ({
    i: t.id,
    ...t.layouts[profile.id],
    minW: 1,
    minH: 1,
    isDraggable: !t.experience?.locked,
    isResizable: !t.experience?.locked,
  }));
  const isPublished =
    saved.current === JSON.stringify(document) &&
    workspace.draft.revision === workspace.published.revision;
  const statusText =
    status === 'saving'
      ? t('editor.saving')
      : status === 'error'
        ? t('editor.saveFailed')
        : status === 'dirty'
          ? t('editor.unsaved')
          : t('editor.saved');

  return (
    <div className={`studio ${simple ? 'v2-simple-editor' : ''}`}>
      <header className="studio-header">
        <div className="brand">
          <img src="./mark.svg" alt="" />
          <span>HAPanel</span>
          <span className="studio-tag">STUDIO</span>
        </div>
        <span className="header-divider" />
        <div className="project-name">{viewDocument.name}</div>
        <div className="header-spacer" />
        <button className="button v2-simple-toggle" onClick={() => setSimple(!simple)}>
          {t(simple ? 'v2.fullEditor' : 'v2.simpleEditor')}
        </button>
        <LanguageSwitcher />
        {bootstrap.mode === 'demo' && (
          <span className="demo-badge">
            <i />
            {t('common.demo')}
          </span>
        )}
        <span className={`save-status ${status}`}>
          <Check size={14} />
          {statusText}
        </span>
        {!service.local && (
          <button
            className="button icon-button"
            aria-label={t('editor.openDashboard')}
            title={t('editor.openDashboard')}
            onClick={async () => {
              try {
                await flush();
                const url = new URL('./display.html', window.document.baseURI);
                url.searchParams.set('display', profile.id);
                window.location.assign(url);
              } catch (error) {
                notify(describeError(error));
              }
            }}
          >
            <House size={16} />
          </button>
        )}
        <button
          className="button preview-button"
          aria-label={t('editor.preview')}
          onClick={async () => {
            try {
              await flush();
              setDialog('preview');
              setTestMode(false);
            } catch (error) {
              notify(describeError(error));
            }
          }}
        >
          <Eye size={16} />
          {t('editor.preview')}
        </button>
        <button
          className="button primary publish-button"
          aria-label={t(isPublished ? 'editor.published' : 'editor.publish')}
          onClick={() => void publish()}
        >
          <CheckCheck size={17} />
          <span>{isPublished ? t('editor.published') : t('editor.publish')}</span>
        </button>
      </header>
      <div className="studio-body">
        {((libraryDrawer && leftOpen) || (inspectorDrawer && rightOpen)) && (
          <button
            className="studio-drawer-backdrop"
            aria-label={t('studio.closeSidebar')}
            onClick={() => {
              setLeftOpen(false);
              setRightOpen(false);
            }}
          />
        )}
        <aside
          inert={libraryDrawer && !leftOpen}
          aria-hidden={(libraryDrawer && !leftOpen) || undefined}
          className={`library-panel ${leftOpen ? 'mobile-open' : ''}`}
        >
          <div className="panel-heading">
            <span>{t('editor.buildingBlocks')}</span>
            <button
              className="icon-button mobile-only"
              onClick={() => setLeftOpen(false)}
              aria-label={t('editor.closeLibrary')}
            >
              <X size={18} />
            </button>
          </div>
          <p className="panel-subtitle">{t('editor.librarySubtitle')}</p>
          <div className="library-tabs" role="group" aria-label={t('studio.libraryTabs')}>
            {(['blocks', 'entities'] as const).map((tab) => (
              <button
                key={tab}
                aria-pressed={libraryTab === tab}
                onClick={() => {
                  setLibraryTab(tab);
                  setSearch('');
                }}
              >
                {t(tab === 'blocks' ? 'studio.blocks' : 'studio.entities')}
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label={t(
                libraryTab === 'blocks' ? 'studio.searchBlocks' : 'editor.searchEntities',
              )}
              placeholder={t(
                libraryTab === 'blocks' ? 'studio.searchBlocks' : 'editor.searchPlaceholder',
              )}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                className="icon-button"
                aria-label={t('studio.clearSearch')}
                onClick={() => setSearch('')}
              >
                <X size={15} />
              </button>
            )}
          </label>
          <div className="library-content">
            {libraryTab === 'blocks' ? (
              <>
                <button
                  className="button full-width library-template"
                  onClick={() => setDialog('template')}
                >
                  <Plus size={16} />
                  {t('v2.wizard')}
                </button>
                <div className="tile-library">
                  {tileKinds
                    .filter((kind) =>
                      searchText(t(kindLabelKeys[kind])).includes(searchText(search)),
                    )
                    .map((kind) => {
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
                          <strong>{t(kindLabelKeys[kind])}</strong>
                          <Plus size={15} />
                        </button>
                      );
                    })}
                </div>

                {!tileKinds.some((kind) =>
                  searchText(t(kindLabelKeys[kind])).includes(searchText(search)),
                ) && <p className="muted library-empty">{t('studio.noBlocks')}</p>}
              </>
            ) : (
              <>
                <div className="v2-library-filters">
                  <SearchSelect
                    aria-label={t('v2.allRooms')}
                    value={areaFilter}
                    onValueChange={(value) => setAreaFilter(value)}
                  >
                    <option value="">{t('v2.allRooms')}</option>
                    {[
                      ...new Map(
                        catalog.filter((e) => e.area).map((e) => [e.area!.id, e.area!]),
                      ).values(),
                    ].map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.floor ? a.floor + ' · ' : ''}
                        {a.name}
                      </option>
                    ))}
                  </SearchSelect>
                  <SearchSelect
                    aria-label={t('v2.allKinds')}
                    value={kindFilter}
                    onValueChange={(value) => setKindFilter(value)}
                  >
                    <option value="">{t('v2.allKinds')}</option>
                    {tileKinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {t(kindLabelKeys[kind])}
                      </option>
                    ))}
                  </SearchSelect>
                  <label className="v2-check">
                    <input
                      type="checkbox"
                      checked={unplaced}
                      onChange={(e) => setUnplaced(e.target.checked)}
                    />
                    {t('v2.unplaced')}
                  </label>
                </div>

                {(areaFilter || kindFilter || unplaced || search) && (
                  <button
                    className="library-reset"
                    onClick={() => {
                      setAreaFilter('');
                      setKindFilter('');
                      setUnplaced(false);
                      setSearch('');
                    }}
                  >
                    {t('studio.filterReset')}
                  </button>
                )}
                <button
                  className="button full-width library-refresh"
                  onClick={async () => {
                    try {
                      setCatalog(
                        service.local
                          ? (await service.load()).catalog
                          : await api('api/editor/catalog'),
                      );
                    } catch (error) {
                      notify(describeError(error));
                    }
                  }}
                >
                  {t('v2.refreshCatalog')}
                </button>
                <div className="library-label entity-heading">
                  {t('editor.entitiesHeading')}
                  <span>{matchingEntities.length}</span>
                </div>
                <div className="entity-list">
                  {matchingEntities.slice(0, entityLimit).map((entity) => {
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
                          <strong>{entityName(entity)}</strong>
                          <small>{entity.entity_id}</small>
                        </span>
                        <Plus size={14} />
                      </button>
                    );
                  })}
                  {matchingEntities.length > entityLimit && (
                    <button
                      className="button full-width"
                      onClick={() => setEntityLimit(entityLimit + 100)}
                    >
                      {t('studio.moreOptions', { count: matchingEntities.length - entityLimit })}
                    </button>
                  )}
                  {matchingEntities.length === 0 && <p className="muted">{t('editor.noEntity')}</p>}
                </div>
              </>
            )}
          </div>
          <div className="library-bottom">
            <span className="connection-dot" />
            {snapshot.status === 'demo'
              ? t('editor.demoConnected')
              : snapshot.status === 'connected'
                ? t('editor.haConnected')
                : t('common.connecting')}
            <small>{t('editor.dragHint')}</small>
          </div>
        </aside>
        <main className="workspace">
          <div className="workspace-toolbar">
            <div className="breadcrumb">
              <House size={16} />
              <span>{viewDocument.name}</span>
              <span>/</span>
              <strong>{viewPage.name}</strong>
            </div>
            <div className="toolbar-actions">
              <button
                className="icon-button"
                aria-label={t('editor.undo')}
                title={t('editor.undo')}
                disabled={!past.length}
                onClick={undo}
              >
                <Undo2 size={17} />
              </button>
              <button
                className="icon-button"
                aria-label={t('editor.redo')}
                title={t('editor.redo')}
                disabled={!future.length}
                onClick={redo}
              >
                <Redo2 size={17} />
              </button>
              <span className="toolbar-divider" />
              <button
                className="icon-button"
                aria-label={t('editor.history')}
                title={t('editor.history')}
                onClick={() => setDialog('history')}
              >
                <History size={17} />
              </button>
              <button
                className="icon-button"
                aria-label={t('editor.importConfiguration')}
                title={t('editor.import')}
                onClick={() => setDialog('import')}
              >
                <ArrowUpFromLine size={17} />
              </button>
              <button
                className="icon-button"
                aria-label={t('editor.exportConfiguration')}
                title={t('editor.export')}
                onClick={exportFile}
              >
                <ArrowDownToLine size={17} />
              </button>
            </div>
          </div>
          <div className="device-toolbar">
            <button className="button mobile-only" onClick={() => setLeftOpen(true)}>
              <Plus size={16} />
              {t('editor.tiles')}
            </button>
            <SearchSelect
              caption={t('common.display')}
              id="editor-display-choice"
              aria-label={t('editor.displayProfile')}
              value={profile.id}
              onValueChange={(value) => {
                setProfileId(value);
                setPageId(pagesForProfile(document, value)[0].id);
                setSelectedId('');
              }}
            >
              {viewDocument.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SearchSelect>
            <SearchSelect
              aria-label={t('studio.view')}
              caption={t('studio.view')}
              value={page.id}
              onValueChange={(value) => {
                setPageId(value);
                setSelectedId('');
                setInspector('view');
              }}
            >
              {visiblePages.map((item) => (
                <option key={item.id} value={item.id}>
                  {viewDocument.pages.find((p) => p.id === item.id)!.name}
                </option>
              ))}
            </SearchSelect>
            <span className="device-resolution">
              {profile.width} × {profile.height} CSS px
            </span>
            <button
              className="icon-button"
              title={t('editor.configureDisplay')}
              aria-label={t('editor.configureDisplay')}
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
              aria-label={t('editor.showGrid')}
              title={t('editor.showGrid')}
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
              {t('editor.properties')}
            </button>
          </div>
          <details className="layout-tools">
            <summary>
              <Settings2 size={16} />
              {t('studio.layoutTools')}
              <ChevronDown size={15} />
            </summary>
            <div className="v2-bulk-toolbar">
              <span>
                {t('v2.selection')}: {selection.length || Number(Boolean(selected))}
              </span>
              <button
                className="button"
                disabled={selection.length < 2}
                onClick={() => bulk('left')}
              >
                {t('v2.alignLeft')}
              </button>
              <button
                className="button"
                disabled={selection.length < 2}
                onClick={() => bulk('top')}
              >
                {t('v2.alignTop')}
              </button>
              <button
                className="button"
                disabled={selection.length < 2}
                onClick={() => bulk('space')}
              >
                {t('v2.spaceHorizontal')}
              </button>
              <button
                className="button"
                disabled={selection.length < 2}
                onClick={() => bulk('size')}
              >
                {t('v2.sameSize')}
              </button>
              <button
                className="button"
                disabled={!selected && !selection.length}
                onClick={copySelection}
              >
                {t('v2.copy')}
              </button>
              <button className="button" disabled={!clipboardCount} onClick={pasteSelection}>
                {t('v2.paste')}
              </button>
              <button className="button" onClick={() => setDialog('review')}>
                {t('v2.review')}
              </button>
            </div>
            <p className="field-hint">{t('studio.selectionHint')}</p>
          </details>
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
                        const old = page.tiles.find(
                          (t) =>
                            selection.includes(t.id) &&
                            next.some(
                              (n) =>
                                n.i === t.id &&
                                (n.x !== t.layouts[profile.id].x ||
                                  n.y !== t.layouts[profile.id].y),
                            ),
                        );
                        if (selection.length > 1 && old) {
                          const moved = next.find((n) => n.i === old.id)!;
                          bulk(
                            'move',
                            moved.x - old.layouts[profile.id].x,
                            moved.y - old.layouts[profile.id].y,
                          );
                        } else layoutChanged(next);
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
                          className={`editor-tile ${(selection.length ? selection : [selectedId]).includes(tile.id) ? 'is-selected' : ''}`}
                          onPointerDown={(event) => {
                            setSelection(
                              event.shiftKey
                                ? selection.includes(tile.id)
                                  ? selection.filter((id) => id !== tile.id)
                                  : [...selection, tile.id]
                                : selection.includes(tile.id)
                                  ? selection
                                  : [tile.id],
                            );
                            setSelectedId(tile.id);
                            setInspector('tile');
                          }}
                        >
                          <TileView tile={tile} snapshot={snapshot} detailsEnabled={false} />
                          <button
                            className="tile-select-area"
                            aria-label={t('editor.selectTile', {
                              title: localizedSampleTile(tile, language).title,
                            })}
                            onClick={() => {
                              setSelectedId(tile.id);
                              setInspector('tile');
                              setRightOpen(true);
                            }}
                          />
                          <button
                            className="tile-drag"
                            aria-label={t('editor.moveTile', {
                              title: localizedSampleTile(tile, language).title,
                            })}
                          >
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
                        <h2>{t('editor.emptyTitle')}</h2>
                        <p>{t('editor.emptyHint')}</p>
                      </div>
                    )}
                  </div>
                </DashboardFrame>
              )}
            </ScaledCanvas>
          </div>
          <footer className="workspace-footer">
            <button className="button" onClick={() => manageDisplays()}>
              <Layers3 size={16} />
              {t('studio.manageDisplays')}
            </button>
            <button className="button" disabled={visiblePages.length >= 12} onClick={addPage}>
              <Plus size={16} />
              {t('editor.addPage')}
            </button>
            <div className="footer-spacer" />
            <span className={`editor-save-summary ${status}`} role="status">
              {statusText}
            </span>
            <button
              className="zoom-reset"
              onClick={() => setZoom(1)}
              title={t('editor.fitWorkspace')}
            >
              <Maximize2 size={14} />
              {Math.round(zoom * 100)} %
            </button>
            <input
              className="zoom-slider"
              aria-label={t('editor.previewZoom')}
              type="range"
              min="0.6"
              max="1.5"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </footer>
        </main>
        <aside
          inert={inspectorDrawer && !rightOpen}
          aria-hidden={(inspectorDrawer && !rightOpen) || undefined}
          className={`inspector-panel ${rightOpen ? 'mobile-open' : ''}`}
        >
          <div className="inspector-tabs">
            <button
              className={inspector === 'tile' ? 'active' : ''}
              aria-pressed={inspector === 'tile'}
              onClick={() => setInspector('tile')}
            >
              {t('editor.tile')}
            </button>
            <button
              aria-pressed={inspector === 'view'}
              className={inspector === 'view' ? 'active' : ''}
              onClick={() => setInspector('view')}
            >
              {t('studio.view')}
            </button>
            <button
              className={inspector === 'display' ? 'active' : ''}
              aria-pressed={inspector === 'display'}
              onClick={() => setInspector('display')}
            >
              {t('common.display')}
            </button>
            <button
              className={inspector === 'design' ? 'active' : ''}
              aria-pressed={inspector === 'design'}
              onClick={() => setInspector('design')}
            >
              {t('design.title')}
            </button>
            <button
              className="icon-button mobile-only"
              onClick={() => setRightOpen(false)}
              aria-label={t('editor.closeProperties')}
            >
              <X size={18} />
            </button>
          </div>
          <div
            ref={inspectorContent}
            className="inspector-content"
            key={inspector === 'tile' ? selected?.id : inspector + profile.id}
          >
            {inspector === 'design' ? (
              <DesignSettings
                key={profile.id}
                profile={profile}
                page={page}
                document={document}
                change={change}
                notify={notify}
                onOverview={(next, id) => {
                  if (commit(next)) {
                    setPageId(id);
                    setSelectedId('');
                  }
                }}
              />
            ) : inspector === 'view' ? (
              <ViewSettings
                key={page.id}
                page={page}
                visiblePage={viewPage}
                pageCount={visiblePages.length}
                visibleCount={visiblePages.filter((p) => !p.hidden).length}
                change={change}
                manage={manageDisplays}
              />
            ) : inspector === 'tile' ? (
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
                      <h2>{viewSelected!.title}</h2>
                      <p>
                        {t(
                          selected.room
                            ? 'editor.roomView'
                            : selected.energy
                              ? 'editor.energyView'
                              : kindLabelKeys[selected.kind],
                        )}{' '}
                        · {selected.layouts[profile.id].w} × {selected.layouts[profile.id].h}
                      </p>
                    </div>
                  </div>
                  <EditorSection
                    title={t('editor.connectionHeading')}
                    defaultOpen
                    style={
                      selected.kind === 'section' ||
                      selected.room ||
                      selected.energy ||
                      selected.contacts
                        ? { display: 'none' }
                        : undefined
                    }
                  >
                    <label>
                      {t('editor.entity')}
                      <SearchSelect
                        aria-label={t('editor.entity')}
                        value={selected.entityId}
                        onValueChange={(value) => updateTile({ entityId: value })}
                      >
                        {!catalog.some(
                          (e) =>
                            e.entity_id === selected.entityId &&
                            domainKinds[e.entity_id.split('.')[0]] === selected.kind,
                        ) && (
                          <option value={selected.entityId} disabled>
                            {t('common.unavailable')} · {selected.entityId}
                          </option>
                        )}
                        {catalog
                          .filter((e) => domainKinds[e.entity_id.split('.')[0]] === selected.kind)
                          .sort((a, b) => entityName(a).localeCompare(entityName(b), intlLocale))
                          .map((e) => (
                            <option
                              data-description={entityDetails(e)}
                              key={e.entity_id}
                              value={e.entity_id}
                            >
                              {entityName(e)}
                            </option>
                          ))}
                      </SearchSelect>
                    </label>
                    <span className="field-hint">{selected.entityId}</span>
                  </EditorSection>
                  <EditorSection title={t('studio.basic')} defaultOpen>
                    <label>
                      {t('common.title')}
                      <TextInput
                        key={selected.id + '-title'}
                        value={viewSelected!.title}
                        maxLength={64}
                        required
                        onValue={(title) => updateTile({ title })}
                      />
                    </label>
                    <CardViewSettings tile={selected} update={updateTile} />
                    <label>{t('editor.accent')}</label>
                    <div className="color-options">
                      {(
                        [
                          'amber',
                          'mint',
                          'blue',
                          'rose',
                          'purple',
                          'orange',
                          'red',
                          'gray',
                        ] as const
                      ).map((color) => (
                        <button
                          key={color}
                          className={`swatch swatch-${color} ${selected.accent === color ? 'active' : ''}`}
                          aria-label={t('editor.color', { color: t(`color.${color}`) })}
                          aria-pressed={selected.accent === color}
                          onClick={() => updateTile({ accent: color })}
                        >
                          {selected.accent === color && <Check size={16} />}
                        </button>
                      ))}
                    </div>
                  </EditorSection>
                  <TileExperienceSettings
                    tile={selected}
                    catalog={catalog}
                    pages={visiblePages}
                    update={updateTile}
                  />
                  <InsightSettings
                    tile={selected}
                    catalog={catalog}
                    pages={pagesForProfile(viewDocument, profile.id)}
                    update={updateTile}
                  />

                  <EditorSection title={t('editor.positionHeading')}>
                    <div className="number-grid">
                      {(['x', 'y', 'w', 'h'] as const).map((key) => (
                        <NumberField
                          key={key}
                          label={
                            {
                              x: t('editor.column'),
                              y: t('editor.row'),
                              w: t('editor.width'),
                              h: t('editor.height'),
                            }[key]
                          }
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
                    <span className="field-hint">
                      {t('editor.profileHint', { name: viewProfile.name })}
                    </span>
                  </EditorSection>
                  <div className="tile-inspector-actions">
                    <button
                      className="button"
                      onClick={() => {
                        const copy = structuredClone(selected);
                        copy.id = freshId(copy.kind);
                        if (copy.room)
                          for (const control of copy.room.controls) control.id = freshId('control');
                        copy.title = t('editor.copyTitle', {
                          title: localizedSampleTile(selected, language).title,
                        });
                        for (const p of document.profiles.filter(
                          (target) => !page.profileIds || page.profileIds.includes(target.id),
                        )) {
                          const spot = findSpace(
                            p,
                            page.tiles,
                            copy.layouts[p.id].w,
                            copy.layouts[p.id].h,
                          );
                          if (!spot) {
                            notify(t('editor.copyNoSpace'));
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
                      {t('editor.duplicate')}
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
                      {t('editor.remove')}
                    </button>
                  </div>
                </>
              ) : (
                <div className="no-selection">
                  <Layers3 size={30} />
                  <h2>{t('editor.noSelectionTitle')}</h2>
                  <p>{t('editor.noSelectionHint')}</p>
                  <button className="button full-width" onClick={() => setInspector('view')}>
                    {t('studio.editView')}
                  </button>
                </div>
              )
            ) : (
              <>
                <div className="inspector-tile-title">
                  <span className="inspector-tile-icon">
                    <Tablet size={24} />
                  </span>
                  <div>
                    <h2>{t('editor.yourDisplay')}</h2>
                    <p>{t('editor.displaySubtitle')}</p>
                  </div>
                </div>
                <DisplayFields profile={viewProfile} onChange={profileUpdate} />
                <ProfileExperienceSettings
                  profile={profile}
                  pages={visiblePages}
                  update={profileUpdate}
                />
                <button
                  className="button full-width"
                  onClick={() => {
                    try {
                      const result = createDisplay(
                        documentRef.current,
                        t('editor.copyTitle', { title: profile.name }),
                        profile.id,
                        true,
                        t('sample.home'),
                      );
                      if (commit(result.document)) {
                        setProfileId(result.profileId);
                        setPageId(pagesForProfile(result.document, result.profileId)[0].id);
                        setSelectedId('');
                      }
                    } catch (error) {
                      notify(describeError(error));
                    }
                  }}
                >
                  <Plus size={15} />
                  {t('editor.duplicateProfile')}
                </button>
                <EditorSection title={t('editor.atmosphereHeading')}>
                  <p className="field-hint">{t('display.appearanceHint')}</p>
                  {!profile.design && (
                    <div className="theme-options">
                      {(['dusk', 'ocean', 'sand'] as const).map((theme) => (
                        <button
                          key={theme}
                          title={t(`theme.${theme}`)}
                          aria-label={t('editor.theme', { theme: t(`theme.${theme}`) })}
                          className={`theme-swatch theme-${theme} ${(profile.theme ?? document.theme) === theme ? 'active' : ''}`}
                          onClick={() => profileUpdate({ theme })}
                        >
                          {(profile.theme ?? document.theme) === theme && <Check size={17} />}
                        </button>
                      ))}
                    </div>
                  )}
                  <label>
                    {t('editor.greeting')}
                    <TextInput
                      key={profile.id + '-greeting'}
                      value={viewProfile.greeting ?? viewDocument.greeting}
                      maxLength={80}
                      required
                      onValue={(greeting) => profileUpdate({ greeting })}
                    />
                  </label>
                  <label>
                    {t('editor.subtitle')}
                    <input
                      value={viewProfile.subtitle ?? viewDocument.subtitle}
                      maxLength={100}
                      onChange={(e) => profileUpdate({ subtitle: e.target.value })}
                    />
                  </label>
                </EditorSection>
              </>
            )}
          </div>
          <div className="inspector-bottom">
            <details className="inspector-tools">
              <summary>{t('studio.tools')}</summary>
              <div>
                <button className="button" onClick={() => setDialog('help')}>
                  {t('studio.help')}
                </button>
                <button className="button full-width" onClick={() => setDialog('alerts')}>
                  {t('v2.alerts')}
                </button>
                <button
                  className="button full-width"
                  onClick={async () => {
                    try {
                      setDiagnostics(
                        service.local
                          ? {
                              mode: 'preview',
                              profiles: document.profiles.length,
                              publishedRevision: workspace.published.revision,
                            }
                          : await api('api/editor/diagnostics'),
                      );
                      setDialog('diagnostics');
                    } catch (e) {
                      notify(describeError(e));
                    }
                  }}
                >
                  {t('v2.diagnostics')}
                </button>
                <button className="button full-width" onClick={loadDevices}>
                  <Monitor size={16} />
                  {t('editor.connectDisplays')}
                </button>
                {onExit && (
                  <button
                    className="button full-width subtle"
                    onClick={async () => {
                      try {
                        await flush();
                        try {
                          localStorage.setItem('hapanel-display-profile', profile.id);
                        } catch {
                          /* Keep the current session usable when storage is unavailable. */
                        }
                        onExit();
                      } catch (e) {
                        notify(describeError(e));
                      }
                    }}
                  >
                    <ArrowLeft size={15} />
                    {t('editor.backDashboard')}
                  </button>
                )}
              </div>
            </details>
          </div>
        </aside>
      </div>
      {toast && !dialog && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button aria-label={t('common.dismiss')} onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {dialog === 'preview' && (
        <Modal
          message={toast}
          onDismissMessage={() => setToast('')}
          title={t('editor.previewTitle')}
          onClose={() => setDialog(null)}
          wide
        >
          <div className="preview-controls">
            <span>{testMode ? t('editor.testActive') : t('editor.testInactive')}</span>
            <label className="switch-label">
              <input
                type="checkbox"
                checked={testMode}
                onChange={(e) => setTestMode(e.target.checked)}
              />
              {t('editor.testMode')}
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
        <Modal
          message={toast}
          onDismissMessage={() => setToast('')}
          title={t('editor.history')}
          onClose={() => setDialog(null)}
        >
          <p className="muted">{t('editor.historyHint')}</p>
          <div className="revision-list">
            {[workspace.published, ...workspace.history]
              .filter((r, i, all) => all.findIndex((x) => x.revision === r.revision) === i)
              .sort((a, b) => b.revision - a.revision)
              .map((revision) => (
                <div key={revision.revision}>
                  <span>
                    <strong>{t('editor.version', { number: revision.revision })}</strong>
                    <small>
                      {new Date(revision.savedAt).toLocaleString(intlLocale)}
                      {revision.revision === workspace.published.revision
                        ? t('editor.publishedSuffix')
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
                        notify(t('editor.restored'));
                      } catch (e) {
                        notify(describeError(e));
                      }
                    }}
                  >
                    {t('editor.restore')}
                  </button>
                </div>
              ))}
          </div>
        </Modal>
      )}
      {dialog === 'displays' && (
        <DisplayManager
          document={document}
          profileId={profile.id}
          initial={displayIntent}
          onChange={commit}
          onSelect={(id, pageId, edit) => {
            setProfileId(id);
            setPageId(pageId ?? pagesForProfile(documentRef.current, id)[0]?.id ?? '');
            setSelectedId('');
            if (edit) {
              setDialog(null);
              setInspector(pageId ? 'tile' : 'display');
              setRightOpen(true);
            }
          }}
          onClose={() => setDialog(null)}
          local={service.local}
          onDevices={() => {
            setDialog(null);
            void loadDevices();
          }}
        />
      )}
      {dialog === 'devices' && (
        <DeviceManager
          document={document}
          enabled={bootstrap.displayEnabled}
          onClose={() => setDialog(null)}
          onCalibrate={(id, patch) => {
            if (!commit(resizeDisplay(documentRef.current, id, patch)))
              throw new Error(t('error.requestFailed'));
          }}
        />
      )}
      {dialog === 'review' && (
        <ReviewDialog
          focusProfileId={profile.id}
          document={document}
          catalog={catalog}
          onChange={commit}
          onClose={() => setDialog(null)}
          onLocate={(profile, page, tile) => {
            setProfileId(profile);
            setPageId(page);
            setSelectedId(tile);
            setSelection([tile]);
            setDialog(null);
          }}
          onPublish={() => {
            setDialog(null);
            void publish(true);
          }}
        />
      )}
      {dialog === 'template' && (
        <TemplateDialog
          document={document}
          profileId={profile.id}
          catalog={catalog}
          onClose={() => setDialog(null)}
          onChange={(next, page) => {
            if (commit(next)) {
              setPageId(page);
              setSelectedId('');
              setInspector('view');
              setLeftOpen(false);
              setRightOpen(true);
              setDialog(null);
            }
          }}
        />
      )}
      {dialog === 'alerts' && (
        <Modal title={t('v2.alerts')} wide onClose={() => setDialog(null)}>
          <AlertSettings document={document} catalog={catalog} update={commit} />
        </Modal>
      )}
      {dialog === 'diagnostics' && (
        <Modal title={t('v2.diagnostics')} onClose={() => setDialog(null)}>
          <dl className="v2-diagnostics">
            {Object.entries(diagnostics ?? {}).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
          <button
            className="button"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' }),
              );
              const a = window.document.createElement('a');
              a.href = url;
              a.download = 'hapanel-diagnostics.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            {t('v2.downloadDiagnostics')}
          </button>
        </Modal>
      )}
      {recovery && (
        <Modal title={t('v2.restoreHint')} onClose={() => setRecovery(undefined)}>
          <div className="v2-button-row">
            <button
              className="button primary"
              onClick={() => {
                commit(recovery);
                setRecovery(undefined);
              }}
            >
              {t('v2.restore')}
            </button>
            <button className="button" onClick={() => setRecovery(undefined)}>
              {t('v2.discard')}
            </button>
          </div>
        </Modal>
      )}
      {dialog === 'help' && (
        <Modal title={t('studio.helpTitle')} onClose={() => setDialog(null)}>
          <p className="studio-help-text">{t('studio.helpText')}</p>
          <p className="studio-help-text">{t('studio.helpKeys')}</p>
        </Modal>
      )}
      {dialog === 'import' && (
        <Modal
          message={toast}
          onDismissMessage={() => setToast('')}
          title={t('editor.importTitle')}
          onClose={() => {
            importAbort.current?.abort();
            setDialog(null);
          }}
        >
          <p className="muted">{t('editor.importHint')}</p>
          {!importPackage && (
            <SearchSelect
              aria-label={t('editor.importFormat')}
              disabled={transferBusy}
              value={format}
              onValueChange={(value) => setFormat(value as 'json' | 'yaml')}
            >
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
            </SearchSelect>
          )}
          {importPackage && (
            <div className="project-import-summary">
              <strong>{importPackage.document.name}</strong>
              <p>
                {t('image.projectSummary', {
                  displays: importPackage.document.profiles.length,
                  views: importPackage.document.pages.length,
                  images: importPackage.assets.length,
                })}
              </p>
            </div>
          )}
          <input
            ref={fileRef}
            disabled={transferBusy}
            hidden
            type="file"
            accept=".json,.yaml,.yml,.hapanel"
            onChange={async (e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              if (file) {
                try {
                  if (file.size > PROJECT_MAX_BYTES) throw new Error(t('image.projectTooLarge'));
                  const raw = await file.text();
                  let project = false;
                  try {
                    project = JSON.parse(raw)?.format === 'hapanel-project';
                  } catch {}
                  if (project) {
                    setImportPackage(parseProject(raw));
                    setImportText('');
                    setFormat('json');
                  } else {
                    if (file.size > 1024 * 1024) throw new Error(t('image.projectConfigTooLarge'));
                    setImportPackage(undefined);
                    setImportText(raw);
                    setFormat(file.name.endsWith('.json') ? 'json' : 'yaml');
                  }
                } catch (error) {
                  notify(describeError(error));
                }
              }
              input.value = '';
            }}
          />
          <button
            className="button"
            disabled={transferBusy}
            onClick={() => fileRef.current?.click()}
          >
            {t('editor.chooseFile')}
          </button>
          {!importPackage && (
            <textarea
              aria-label={t('editor.configuration')}
              disabled={transferBusy}
              className="config-text"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={t('editor.pasteConfiguration')}
            />
          )}
          <button
            className="button primary"
            disabled={transferBusy}
            onClick={async () => {
              try {
                setTransferBusy(true);
                const controller = new AbortController();
                importAbort.current = controller;
                const latest = await flush();
                const prepared = importPackage
                  ? await importProject(importPackage, service.images, controller.signal)
                  : undefined;
                if (controller.signal.aborted) return;
                const result = prepared
                  ? await service.save(prepared, latest.draft.revision)
                  : await service.import(importText, format, latest.draft.revision);
                setPast((p) => [...p, document]);
                setFuture([]);
                setDocument(result.draft.document);
                saved.current = JSON.stringify(result.draft.document);
                workspaceRef.current = result;
                setWorkspace(result);
                setStatus('saved');
                setSelectedId('');
                setDialog(null);
                setImportPackage(undefined);
                notify(t('editor.imported'));
              } catch (e) {
                if (!importAbort.current?.signal.aborted) notify(describeError(e));
              } finally {
                setTransferBusy(false);
              }
            }}
          >
            {t(transferBusy ? 'image.importWorking' : 'editor.importDraft')}
          </button>
        </Modal>
      )}
      {dialog === 'export' && (
        <Modal
          message={toast}
          onDismissMessage={() => setToast('')}
          title={t('editor.exportTitle')}
          onClose={() => setDialog(null)}
        >
          <p className="muted">{t('editor.exportHint')}</p>
          <button
            className="button full-width primary"
            disabled={transferBusy}
            onClick={async () => {
              setTransferBusy(true);
              try {
                const raw = await exportProject(documentRef.current, service.images);
                const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })),
                  a = window.document.createElement('a');
                a.href = url;
                a.download = 'hapanel-project.hapanel';
                a.click();
                URL.revokeObjectURL(url);
              } catch (error) {
                notify(describeError(error));
              } finally {
                setTransferBusy(false);
              }
            }}
          >
            {t(transferBusy ? 'image.projectWorking' : 'image.exportProject')}
          </button>
          <p className="field-hint">{t('image.projectHint')}</p>
          <SearchSelect
            aria-label={t('editor.exportFormat')}
            value={format}
            onValueChange={(value) => {
              const next = value as 'json' | 'yaml';
              setFormat(next);
              setExportText(serializeDashboard(documentRef.current, next));
            }}
          >
            <option value="json">JSON</option>
            <option value="yaml">YAML</option>
          </SearchSelect>
          <textarea
            className="config-text"
            aria-label={t('editor.exportedConfiguration')}
            readOnly
            value={exportText}
          />
          <button className="button primary" onClick={download}>
            <ArrowDownToLine size={16} />
            {t('common.download')}
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
  const { t } = useI18n();

  return (
    <>
      <EditorSection title={t('editor.profileHeading')} defaultOpen>
        <label>
          {t('common.name')}
          <TextInput
            key={p.id + '-name'}
            value={p.name}
            maxLength={64}
            required
            onValue={(name) => onChange({ name })}
          />
        </label>
        <div className="number-grid">
          <NumberField
            label={t('editor.diagonal')}
            value={p.diagonal}
            min={2}
            max={100}
            step={0.1}
            onChange={(v) => onChange({ diagonal: v })}
          />
          <NumberField
            label={t('editor.pixelRatio')}
            value={p.dpr}
            min={0.5}
            max={4}
            step={0.25}
            onChange={(v) => onChange({ dpr: v })}
          />
        </div>
        <div className="number-grid">
          <NumberField
            label={t('editor.hardwareWidth')}
            value={p.physicalWidth}
            min={240}
            max={16384}
            onChange={(v) => onChange({ physicalWidth: v })}
          />
          <NumberField
            label={t('editor.hardwareHeight')}
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
          {t('editor.deriveViewport')}
        </button>
      </EditorSection>
      <EditorSection title={t('editor.viewportHeading')} defaultOpen>
        <div className="number-grid">
          <NumberField
            label={t('editor.width')}
            value={p.width}
            min={320}
            onChange={(v) => onChange({ width: v })}
          />
          <NumberField
            label={t('editor.height')}
            value={p.height}
            min={240}
            onChange={(v) => onChange({ height: v })}
          />
        </div>
        <span className="field-hint">{t('editor.viewportHint')}</span>
        <label>
          {t('editor.renderMode')}
          <SearchSelect
            aria-label={t('editor.renderMode')}
            value={p.mode}
            onValueChange={(value) => onChange({ mode: value as Profile['mode'] })}
          >
            <option value="fit">{t('editor.fit')}</option>
            <option value="exact">{t('editor.exact')}</option>
          </SearchSelect>
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
          {t('editor.rotate')}
        </button>
      </EditorSection>
      <EditorSection title={t('editor.gridHeading')}>
        <div className="number-grid">
          <NumberField
            label={t('editor.columns')}
            value={p.columns}
            min={2}
            max={24}
            onChange={(v) => onChange({ columns: v })}
          />
          <NumberField
            label={t('editor.rows')}
            value={p.rows}
            min={2}
            max={20}
            onChange={(v) => onChange({ rows: v })}
          />
          <NumberField
            label={t('editor.gap')}
            value={p.gap}
            max={40}
            onChange={(v) => onChange({ gap: v })}
          />
          <NumberField
            label={t('editor.margin')}
            value={p.margin}
            max={96}
            onChange={(v) => onChange({ margin: v })}
          />
          <NumberField
            label={t('editor.header')}
            value={p.headerHeight}
            min={48}
            max={180}
            onChange={(v) => onChange({ headerHeight: v })}
          />
          <NumberField
            label={t('editor.navigation')}
            value={p.footerHeight}
            min={40}
            max={100}
            onChange={(v) => onChange({ footerHeight: v })}
          />
        </div>
        <span className="field-hint">{t('editor.gridHint')}</span>
      </EditorSection>
    </>
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}
