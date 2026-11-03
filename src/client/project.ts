import { z } from 'zod';
import { dashboardSchema, type Dashboard } from '../shared/model';
import { imageId, imageUploadSchema, imageReferences } from '../shared/assets';
import { UserError } from '../shared/i18n';
import { base64Blob, type ImageLibrary } from './images';
export const PROJECT_MAX_BYTES = 32 * 1024 * 1024;
const assetSchema = imageUploadSchema.extend({ id: imageId }).strict();
const projectSchema = z
  .object({
    format: z.literal('hapanel-project'),
    version: z.literal(1),
    document: dashboardSchema,
    assets: z.array(assetSchema).max(200),
  })
  .strict()
  .superRefine((project, ctx) => {
    const ids = new Set(project.assets.map((a) => a.id));
    if (
      ids.size !== project.assets.length ||
      imageReferences(project.document, true, true).some((id) => !ids.has(id))
    )
      ctx.addIssue({ code: 'custom', message: 'image.projectIncomplete' });
  });
export type ProjectBundle = z.infer<typeof projectSchema>;
export function parseProject(raw: string) {
  if (raw.length > PROJECT_MAX_BYTES) throw new UserError('image.projectTooLarge');
  return projectSchema.parse(JSON.parse(raw));
}
export async function exportProject(document: Dashboard, images: Pick<ImageLibrary, 'portable'>) {
  const copy = dashboardSchema.parse(document),
    assets: ProjectBundle['assets'] = [];
  let estimate = JSON.stringify(copy).length;
  for (const id of imageReferences(copy, true, true)) {
    const asset = await images.portable(id);
    estimate += asset.data.length + 1024;
    if (estimate > PROJECT_MAX_BYTES) throw new UserError('image.projectTooLarge');
    assets.push(asset);
  }
  const raw = JSON.stringify(
    projectSchema.parse({ format: 'hapanel-project', version: 1, document: copy, assets }),
  );
  if (raw.length > PROJECT_MAX_BYTES) throw new UserError('image.projectTooLarge');
  return raw;
}
export async function importProject(
  project: ProjectBundle,
  images: Pick<ImageLibrary, 'upload'>,
  signal?: AbortSignal,
) {
  const parsed = projectSchema.parse(project),
    document = structuredClone(parsed.document),
    mapping = new Map<string, string>();
  const check = () => {
    if (signal?.aborted) throw new DOMException('Import cancelled', 'AbortError');
  };
  for (const asset of parsed.assets) {
    check();
    const stored = await images.upload(base64Blob(asset.data), asset.name);
    mapping.set(asset.id, stored.id);
  }
  check();
  for (const appearance of [
    ...document.profiles.map((p) => p.design),
    ...document.pages.map((p) => p.design),
    ...(document.designs ?? []).map((d) => d.appearance),
  ])
    if (appearance?.image) {
      const id = mapping.get(appearance.image.assetId);
      if (id) appearance.image.assetId = id;
    }
  return dashboardSchema.parse(document);
}
