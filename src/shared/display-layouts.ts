import { dashboardSchema, pagesForProfile, type Dashboard, type Profile, type Tile } from './model';
import { UserError } from './i18n';

type Page = Dashboard['pages'][number];
export function layoutId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint32Array(3));
  return prefix + '_' + Array.from(bytes, (value) => value.toString(36)).join('');
}
function stableId(seed: string, used: Set<string>) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  const base = 'view_' + (hash >>> 0).toString(36);
  let result = base,
    n = 0;
  while (used.has(result)) result = base + '_' + ++n;
  used.add(result);
  return result;
}
const idsIn = (document: Dashboard) =>
  new Set(
    document.pages.flatMap((page) => [
      page.id,
      ...page.tiles.flatMap((tile) => [
        tile.id,
        ...(tile.room?.controls.map((control) => control.id) ?? []),
      ]),
    ]),
  );
function copyPage(
  page: Page,
  source: Profile,
  target: Profile,
  id: (seed: string) => string,
  retain = false,
): Page {
  const copy = structuredClone(page);
  copy.originId = page.originId ?? page.id;
  copy.profileIds = [target.id];
  if (!retain) copy.id = id(page.id);
  for (const tile of copy.tiles) {
    if (!retain) {
      tile.originId ??= tile.id;
      tile.id = id(tile.id);
      for (const control of tile.room?.controls ?? []) {
        control.originId ??= control.id;
        control.id = id(control.id);
      }
    }
    tile.layouts = { [target.id]: { ...tile.layouts[source.id] } };
  }
  fitPage(copy, source, target);
  return copy;
}
function fitPage(page: Page, source: Profile, target: Profile) {
  if (source.columns === target.columns && source.rows === target.rows) return;
  if (page.tiles.length > target.columns * target.rows) throw new UserError('error.copyNoSpace');
  const desired = page.tiles.map((tile) => {
    const rect = tile.layouts[target.id];
    const x = Math.floor((rect.x * target.columns) / source.columns),
      y = Math.floor((rect.y * target.rows) / source.rows);
    return {
      x,
      y,
      w: Math.max(
        1,
        Math.min(target.columns - x, Math.round((rect.w * target.columns) / source.columns)),
      ),
      h: Math.max(1, Math.min(target.rows - y, Math.round((rect.h * target.rows) / source.rows))),
    };
  });
  const overlap = (a: Tile['layouts'][string], b: Tile['layouts'][string]) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  if (desired.every((rect, i) => !desired.slice(0, i).some((other) => overlap(rect, other)))) {
    page.tiles.forEach((tile, i) => (tile.layouts[target.id] = desired[i]));
    return;
  }
  // A dense source can require repacking; preserve every tile instead of dropping content.
  let columns = Math.max(
    1,
    Math.min(
      Math.max(1, Math.floor(target.columns / 2)),
      Math.ceil(Math.sqrt((page.tiles.length * target.columns) / target.rows)),
    ),
  );
  while (Math.ceil(page.tiles.length / columns) > target.rows && columns < target.columns)
    columns++;
  const rows = Math.max(1, Math.ceil(page.tiles.length / columns));
  const width = Math.floor(target.columns / columns),
    height = Math.floor(target.rows / rows);
  page.tiles.forEach(
    (tile, i) =>
      (tile.layouts[target.id] = {
        x: (i % columns) * width,
        y: Math.floor(i / columns) * height,
        w: width,
        h: height,
      }),
  );
}
/** Additive migration: existing IDs are retained on their first display; copies get stable IDs. */
export function independentDisplayViews(input: Dashboard): Dashboard {
  if (
    input.pages.every(
      (page) =>
        page.profileIds?.length === 1 &&
        page.tiles.every((tile) =>
          Object.keys(tile.layouts).every((id) => id === page.profileIds![0]),
        ),
    )
  )
    return structuredClone(input);
  const result = structuredClone(input),
    used = idsIn(input),
    claimed = new Set<string>();
  result.pages = [];
  for (const profile of input.profiles) {
    const mapping = new Map<string, string>();
    const copies = pagesForProfile(input, profile.id).map((page) => {
      const retained = !claimed.has(page.id);
      claimed.add(page.id);
      const copy = copyPage(
        page,
        profile,
        profile,
        (seed) => stableId(profile.id + ':' + seed, used),
        retained,
      );
      mapping.set(page.id, copy.id);
      return copy;
    });
    for (const page of copies)
      for (const tile of page.tiles)
        if (tile.navigateTo) {
          const destination = mapping.get(tile.navigateTo);
          if (destination) tile.navigateTo = destination;
          else delete tile.navigateTo;
        }
    result.pages.push(...copies);
  }
  return dashboardSchema.parse(result);
}
export function createDisplay(
  input: Dashboard,
  name: string,
  sourceId: string,
  copyViews: boolean,
  homeName: string,
) {
  const document = independentDisplayViews(input);
  if (document.profiles.length >= 8) throw new UserError('error.displayLimit');
  const source = document.profiles.find((profile) => profile.id === sourceId)!;
  const profile = { ...source, id: layoutId('display'), name: name.trim() };
  document.profiles.push(profile);
  if (copyViews) {
    const mapping = new Map<string, string>();
    const copies = pagesForProfile(document, source.id).map((page) => {
      const copy = copyPage(page, source, profile, () => layoutId('view'));
      mapping.set(page.id, copy.id);
      return copy;
    });
    for (const page of copies)
      for (const tile of page.tiles)
        if (tile.navigateTo) {
          const destination = mapping.get(tile.navigateTo);
          if (destination) tile.navigateTo = destination;
          else delete tile.navigateTo;
        }
    document.pages.push(...copies);
  } else
    document.pages.push({
      id: layoutId('view'),
      name: homeName,
      profileIds: [profile.id],
      tiles: [],
    });
  return { document: dashboardSchema.parse(document), profileId: profile.id };
}
export function duplicateView(input: Dashboard, pageId: string, targetId: string, name: string) {
  const document = independentDisplayViews(input);
  const page = document.pages.find((page) => page.id === pageId)!;
  const source = document.profiles.find((profile) => profile.id === page.profileIds![0])!;
  const target = document.profiles.find((profile) => profile.id === targetId)!;
  const targetPages = pagesForProfile(document, targetId);
  if (targetPages.length >= 12) throw new UserError('error.displayPageCount');
  const copy = copyPage(page, source, target, () => layoutId('view'));
  copy.name = name.trim();
  for (const tile of copy.tiles)
    if (tile.navigateTo) {
      const original = document.pages.find((item) => item.id === tile.navigateTo);
      const match =
        tile.navigateTo === page.id
          ? copy
          : targetPages.find(
              (item) => (item.originId ?? item.id) === (original?.originId ?? original?.id),
            );
      if (match) tile.navigateTo = match.id;
      else delete tile.navigateTo;
    }
  document.pages.push(copy);
  return { document: dashboardSchema.parse(document), pageId: copy.id, profileId: targetId };
}
export function deleteView(input: Dashboard, pageId: string) {
  const document = independentDisplayViews(input);
  const page = document.pages.find((page) => page.id === pageId)!;
  if (pagesForProfile(document, page.profileIds![0]).length === 1)
    throw new UserError('error.lastView');
  document.pages = document.pages.filter((page) => page.id !== pageId);
  for (const tile of document.pages.flatMap((page) => page.tiles))
    if (tile.navigateTo === pageId) delete tile.navigateTo;
  return dashboardSchema.parse(document);
}
export function deleteDisplay(input: Dashboard, profileId: string) {
  const document = independentDisplayViews(input);
  if (document.profiles.length === 1) throw new UserError('error.lastDisplay');
  document.profiles = document.profiles.filter((profile) => profile.id !== profileId);
  const removed = new Set(
    document.pages.filter((page) => page.profileIds!.includes(profileId)).map((page) => page.id),
  );
  document.pages = document.pages.filter((page) => !removed.has(page.id));
  for (const tile of document.pages.flatMap((page) => page.tiles))
    if (tile.navigateTo && removed.has(tile.navigateTo)) delete tile.navigateTo;
  return dashboardSchema.parse(document);
}
export function moveView(input: Dashboard, pageId: string, direction: -1 | 1) {
  const document = independentDisplayViews(input),
    page = document.pages.find((page) => page.id === pageId)!;
  const pages = pagesForProfile(document, page.profileIds![0]);
  const index = pages.findIndex((page) => page.id === pageId),
    other = pages[index + direction];
  if (!other) return document;
  const a = document.pages.findIndex((page) => page.id === pageId),
    b = document.pages.findIndex((page) => page.id === other.id);
  [document.pages[a], document.pages[b]] = [document.pages[b], document.pages[a]];
  return document;
}
export function resizeDisplay(input: Dashboard, profileId: string, patch: Partial<Profile>) {
  const document = independentDisplayViews(input),
    source = structuredClone(document.profiles.find((profile) => profile.id === profileId)!);
  const target = document.profiles.find((profile) => profile.id === profileId)!;
  Object.assign(target, patch, { id: profileId });
  for (const page of pagesForProfile(document, profileId)) fitPage(page, source, target);
  return dashboardSchema.parse(document);
}
