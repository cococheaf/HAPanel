import { mkdir, readFile, writeFile, rename, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import {
  imageId,
  imageUploadSchema,
  imageMetadataSchema,
  imagePatchSchema,
  IMAGE_MAX_BYTES,
  IMAGE_LIBRARY_BYTES,
  type ImageMetadata,
  type ImageUpload,
  type ImagePatch,
} from '../shared/assets';
import { UserError } from '../shared/i18n';

// One image at a time and a small native cache keep uploads bounded on HA hosts.
sharp.concurrency(1);
sharp.cache({ memory: 16, files: 0, items: 16 });

/** Re-encode uploads without EXIF/GPS; never store supplied paths, SVG or remote URLs. */
export class ImageStore {
  private images = new Map<string, ImageMetadata>();
  private queue: Promise<unknown> = Promise.resolve();
  private pending = 0;
  constructor(private directory: string) {}
  async init() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const entries = await readdir(this.directory);
    for (const name of entries.filter((name) => /^[a-f0-9]{64}\.json$/.test(name))) {
      const meta = imageMetadataSchema.parse(
        JSON.parse(await readFile(join(this.directory, name), 'utf8')),
      );
      if (name !== meta.id + '.json') throw new Error('Image metadata does not match its file');
      for (const suffix of ['.webp', '.thumb.webp'])
        await stat(join(this.directory, meta.id + suffix));
      this.images.set(meta.id, meta);
    }
  }
  list() {
    return [...this.images.values()]
      .map((v) => ({ ...v }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  has(id: string) {
    return this.images.has(id);
  }
  private async atomic(name: string, data: Uint8Array | string) {
    const target = join(this.directory, name),
      temp = target + '.' + randomUUID() + '.tmp';
    await writeFile(temp, data, { mode: 0o600 });
    await rename(temp, target);
  }
  private transact<T>(job: () => Promise<T>): Promise<T> {
    if (this.pending >= 4) return Promise.reject(new UserError('image.busy'));
    this.pending++;
    const next = this.queue.then(job).finally(() => {
      this.pending--;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }
  async upload(value: ImageUpload) {
    const upload = imageUploadSchema.parse(value);
    return this.transact(async () => {
      const input = Buffer.from(upload.data, 'base64');
      if (input.length > IMAGE_MAX_BYTES) throw new UserError('image.tooLarge');
      const png = input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpeg = input[0] === 255 && input[1] === 216 && input[2] === 255;
      const webp =
        input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WEBP';
      if (!png && !jpeg && !webp) throw new UserError('image.invalid');
      let full: Buffer, thumb: Buffer, width: number, height: number, color: string;
      try {
        const options = { limitInputPixels: 36_000_000, failOn: 'warning' as const };
        const meta = await sharp(input, options).metadata();
        if (!['png', 'jpeg', 'webp'].includes(meta.format ?? '') || (meta.pages ?? 1) !== 1)
          throw Error('unsupported');
        const cleanWebp =
          webp &&
          !meta.exif &&
          !meta.xmp &&
          !meta.iptc &&
          !meta.icc &&
          meta.width! <= 2560 &&
          meta.height! <= 2560;
        // Decode even an already-normalized file before accepting it. Keeping its bytes
        // makes portable exports and duplicate uploads retain the same content ID.
        if (cleanWebp) {
          await sharp(input, options).stats();
          full = input;
        } else
          full = await sharp(input, options)
            .rotate()
            .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 86, effort: 3 })
            .toBuffer();
        if (full.length > IMAGE_MAX_BYTES)
          full = await sharp(full, options)
            .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 72, effort: 3 })
            .toBuffer();
        const info = await sharp(full, options).metadata();
        width = info.width!;
        height = info.height!;
        thumb = await sharp(full, options)
          .resize({ width: 360, height: 240, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 70 })
          .toBuffer();
        const { dominant } = await sharp(thumb, options).stats();
        color =
          '#' +
          [dominant.r, dominant.g, dominant.b]
            .map((v) => Math.round(v).toString(16).padStart(2, '0'))
            .join('');
      } catch {
        throw new UserError('image.invalid');
      }
      if (full.length > IMAGE_MAX_BYTES) throw new UserError('image.tooLarge');
      const id = createHash('sha256').update(full).digest('hex'),
        existing = this.images.get(id);
      if (existing) {
        if (existing.archived) {
          const restored = { ...existing, archived: false };
          await this.atomic(id + '.json', JSON.stringify(restored));
          this.images.set(id, restored);
          return { ...restored };
        }
        return { ...existing };
      }
      const used = this.list().reduce((n, image) => n + image.bytes + image.thumbnailBytes, 0);
      if (used + full.length + thumb.length > IMAGE_LIBRARY_BYTES || this.images.size >= 200)
        throw new UserError('image.storageFull');
      const record = imageMetadataSchema.parse({
        id,
        name: upload.name.trim(),
        width,
        height,
        bytes: full.length,
        thumbnailBytes: thumb.length,
        color,
        createdAt: new Date().toISOString(),
        archived: false,
      });
      await this.atomic(id + '.webp', full);
      await this.atomic(id + '.thumb.webp', thumb);
      await this.atomic(id + '.json', JSON.stringify(record));
      this.images.set(id, record);
      return { ...record };
    });
  }
  async update(id: string, value: ImagePatch) {
    imageId.parse(id);
    const patch = imagePatchSchema.parse(value);
    return this.transact(async () => {
      const old = this.images.get(id);
      if (!old) throw new UserError('image.missing');
      const next = imageMetadataSchema.parse({ ...old, ...patch });
      await this.atomic(id + '.json', JSON.stringify(next));
      this.images.set(id, next);
      return { ...next };
    });
  }
  async read(id: string, thumbnail = false) {
    imageId.parse(id);
    if (!this.images.has(id)) throw new UserError('image.missing');
    return readFile(join(this.directory, id + (thumbnail ? '.thumb.webp' : '.webp')));
  }
}
