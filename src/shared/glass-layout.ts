import { dashboardSchema, pagesForProfile, type Dashboard, type Tile } from './model';
import { layoutId, resizeDisplay } from './display-layouts';
import { designPresets } from './design';
import { translate, type Language } from './i18n';

/** Add a freely editable overview; every existing view and control stays in place. */
export function createGlassOverview(input: Dashboard, profileId: string, language: Language) {
  const source = input.profiles.find((p) => p.id === profileId)!;
  const portrait = source.width < source.height;
  const document = resizeDisplay(input, profileId, {
    columns: 16,
    rows: portrait ? 16 : 12,
    gap: 10,
    margin: 24,
    headerHeight: 100,
    footerHeight: 64,
    design: structuredClone(source.design ?? designPresets.glassDark),
  });
  const profile = document.profiles.find((p) => p.id === profileId)!;
  const pages = pagesForProfile(document, profileId);
  const all = pages.flatMap((p) => p.tiles);
  const rooms = pages.filter((p) => p.tiles.some((t) => t.room && !t.navigateTo));
  const floors = rooms.slice(0, 2);
  const used = new Set<string>();
  const tiles: Tile[] = [];
  const copy = (source: Tile | undefined, rect: Tile['layouts'][string]) => {
    if (!source) return;
    const tile = structuredClone(source);
    tile.originId ??= tile.id;
    tile.id = layoutId('glass');
    for (const control of tile.room?.controls ?? []) {
      control.originId ??= control.id;
      control.id = layoutId('control');
    }
    tile.layouts = { [profileId]: rect };
    tiles.push(tile);
    used.add(source.id);
  };
  const quick = [
    all.find((t) => t.kind === 'light' && !t.room),
    all.find((t) => t.kind === 'automation'),
    all.find((t) => t.kind === 'alarm'),
    all.find((t) => t.kind === 'contacts'),
  ].filter((t): t is Tile => !!t);
  quick.forEach((tile, i) => {
    copy(
      tile,
      portrait
        ? { x: (i % 2) * 8, y: Math.floor(i / 2) * 2, w: 8, h: 2 }
        : { x: i * 4, y: 0, w: 4, h: 2 },
    );
    tiles[tiles.length - 1].experience = { ...tile.experience, presentation: 'compact' };
  });
  floors.forEach((floor, index) => {
    const y = portrait ? 4 + index * 4 : 2 + index * 5;
    tiles.push({
      id: layoutId('section'),
      originId:
        floor.originId === 'eg' || floor.id === 'eg'
          ? 'glass_section_eg'
          : floor.originId === 'og' || floor.id === 'og'
            ? 'glass_section_og'
            : undefined,
      kind: 'section',
      title:
        floor.name === 'EG'
          ? translate(language, 'sample.floorEG')
          : floor.name === 'OG'
            ? translate(language, 'sample.floorOG')
            : floor.name,
      entityId: '',
      accent: 'blue',
      navigateTo: floor.id,
      layouts: { [profileId]: { x: 0, y, w: portrait ? 16 : 12, h: 1 } },
    });
    floor.tiles
      .filter((t) => t.room && !t.navigateTo)
      .slice(0, 3)
      .forEach((tile, i) =>
        copy(tile, {
          x: portrait ? i * 5 : i * 4,
          y: y + 1,
          w: portrait ? (i === 2 ? 6 : 5) : 4,
          h: portrait ? 3 : 4,
        }),
      );
  });
  // With no room views yet, make a useful editable collection from configured devices.
  if (!floors.length)
    all
      .filter((t) => !used.has(t.id) && !t.energy && t.kind !== 'weather')
      .slice(0, 6)
      .forEach((tile, i) =>
        copy(tile, { x: (i % 3) * 4, y: 3 + Math.floor(i / 3) * 4, w: 4, h: 4 }),
      );
  copy(
    all.find((t) => t.energy && t.navigateTo),
    portrait ? { x: 0, y: 12, w: 8, h: 4 } : { x: 12, y: 2, w: 4, h: 5 },
  );
  copy(
    all.find((t) => t.kind === 'weather'),
    portrait ? { x: 8, y: 12, w: 8, h: 4 } : { x: 12, y: 7, w: 4, h: 5 },
  );
  const pageId = layoutId('glass_home');
  document.pages.unshift({
    id: pageId,
    originId: 'glass_overview',
    name: translate(language, 'design.overview'),
    heading: source.greeting ?? input.greeting,
    subtitle: source.subtitle ?? input.subtitle,
    profileIds: [profileId],
    tiles,
  });
  profile.experience = { ...profile.experience, homePageId: pageId };
  return { document: dashboardSchema.parse(document), pageId };
}
