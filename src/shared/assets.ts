import { z } from 'zod';
import type { Dashboard } from './model';
export const imageId = z.string().regex(/^[a-f0-9]{64}$/);
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_LIBRARY_BYTES = 100 * 1024 * 1024;
export const imageUploadSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(80)
      .refine((v) => !!v.trim()),
    data: z
      .string()
      .min(4)
      .max(Math.ceil(IMAGE_MAX_BYTES / 3) * 4)
      .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  })
  .strict();
export const imageMetadataSchema = z
  .object({
    id: imageId,
    name: imageUploadSchema.shape.name,
    width: z.number().int().positive().max(2560),
    height: z.number().int().positive().max(2560),
    bytes: z.number().int().positive().max(IMAGE_MAX_BYTES),
    thumbnailBytes: z.number().int().positive().max(IMAGE_MAX_BYTES),
    color: z.string().regex(/^#[0-9a-f]{6}$/),
    createdAt: z.iso.datetime(),
    archived: z.boolean(),
  })
  .strict();
export const imagePatchSchema = z
  .object({ name: imageUploadSchema.shape.name.optional(), archived: z.boolean().optional() })
  .strict();
export type ImageMetadata = z.infer<typeof imageMetadataSchema>;
export type ImageUpload = z.infer<typeof imageUploadSchema>;
export type ImagePatch = z.infer<typeof imagePatchSchema>;
export function imageReferences(
  document: Dashboard,
  includeLibrary = false,
  includeInactive = false,
) {
  return [
    ...new Set(
      [
        ...document.profiles.map((p) =>
          includeInactive || p.design?.wallpaper === 'image' ? p.design?.image?.assetId : undefined,
        ),
        ...document.pages.map((p) =>
          includeInactive || p.design?.wallpaper === 'image' ? p.design?.image?.assetId : undefined,
        ),
        ...(includeLibrary
          ? (document.designs ?? []).map((d) =>
              includeInactive || d.appearance.wallpaper === 'image'
                ? d.appearance.image?.assetId
                : undefined,
            )
          : []),
      ].filter((id): id is string => !!id),
    ),
  ];
}

/** MIME labels alone do not identify image contents. SVG and other formats are excluded. */
export function rasterType(bytes: Uint8Array): 'png' | 'jpeg' | 'webp' | undefined {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg';
  if (
    [82, 73, 70, 70].every((v, i) => bytes[i] === v) &&
    [87, 69, 66, 80].every((v, i) => bytes[i + 8] === v)
  )
    return 'webp';
}
