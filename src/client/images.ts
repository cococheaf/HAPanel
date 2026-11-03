import {
  IMAGE_MAX_BYTES,
  rasterType,
  IMAGE_LIBRARY_BYTES,
  type ImageMetadata,
  type ImageUpload,
  type ImagePatch,
} from '../shared/assets';
import { UserError, isMessageKey } from '../shared/i18n';

export interface ImageLibrary {
  list(): Promise<ImageMetadata[]>;
  upload(file: Blob, name: string): Promise<ImageMetadata>;
  update(id: string, patch: ImagePatch): Promise<ImageMetadata>;
  source(id: string, thumbnail?: boolean): Promise<{ url: string; release: () => void }>;
  portable(id: string): Promise<ImageUpload & { id: string }>;
}
export async function blobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new UserError('image.invalid'));
    r.readAsDataURL(blob);
  });
}
export function base64Blob(data: string, type = 'image/webp') {
  const decoded = atob(data),
    bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return new Blob([bytes], { type });
}
/** Downscale on the tablet before upload; canvas also removes camera metadata. */
export async function prepareImage(file: File) {
  if (file.size > 20 * 1024 * 1024) throw new UserError('image.sourceTooLarge');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new UserError('image.invalid');
  if (!rasterType(new Uint8Array(await file.slice(0, 12).arrayBuffer())))
    throw new UserError('image.invalid');
  const url = URL.createObjectURL(file),
    image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new UserError('image.invalid'));
      image.src = url;
    });
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 36_000_000)
      throw new UserError('image.invalid');
    const canvas = document.createElement('canvas'),
      factor = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * factor));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * factor));
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encode = (quality: number) =>
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new UserError('image.invalid'))),
          'image/webp',
          quality,
        ),
      );
    let blob = await encode(0.86);
    if (blob.size > IMAGE_MAX_BYTES) blob = await encode(0.65);
    if (blob.size > IMAGE_MAX_BYTES) throw new UserError('image.tooLarge');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export class ApiImageLibrary implements ImageLibrary {
  constructor(private base: string) {}
  private async request<T>(path = '', body?: unknown, method = 'GET'): Promise<T> {
    const response = await fetch(
      new URL(path ? this.base + path : this.base.replace(/\/$/, ''), document.baseURI),
      {
        credentials: 'same-origin',
        cache: 'no-store',
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ messageKey: 'image.failed' }));
      throw new UserError(isMessageKey(error.messageKey) ? error.messageKey : 'image.failed');
    }
    return response.json();
  }
  async list() {
    return (await this.request<{ images: ImageMetadata[] }>()).images;
  }
  async upload(file: Blob, name: string) {
    return this.request<ImageMetadata>('', { name, data: await blobBase64(file) }, 'POST');
  }
  update(id: string, patch: ImagePatch) {
    return this.request<ImageMetadata>(id, patch, 'PATCH');
  }
  async source(id: string, thumbnail = false) {
    return { url: this.base + id + (thumbnail ? '?thumbnail=1' : ''), release: () => {} };
  }
  async portable(id: string) {
    const images = await this.list(),
      meta = images.find((i) => i.id === id);
    if (!meta) throw new UserError('image.missing');
    const response = await fetch(new URL(this.base + id, document.baseURI), {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) throw new UserError('image.missing');
    return { id, name: meta.name, data: await blobBase64(await response.blob()) };
  }
}

type BrowserImage = { meta: ImageMetadata; blob: Blob; thumbnail: Blob };
/** The public preview keeps private images in IndexedDB, never in the GitHub site. */
export class BrowserImageLibrary implements ImageLibrary {
  private db?: Promise<IDBDatabase>;
  private memory = new Map<string, BrowserImage>();
  private open() {
    if (!this.db)
      this.db = new Promise((resolve, reject) => {
        const request = indexedDB.open('hapanel-images-v1', 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore('images', { keyPath: 'meta.id' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    return this.db;
  }
  private async records() {
    if (typeof indexedDB === 'undefined') return [...this.memory.values()];
    const db = await this.open();
    return new Promise<BrowserImage[]>((resolve, reject) => {
      const req = db.transaction('images').objectStore('images').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new UserError('image.failed'));
    });
  }
  private async put(record: BrowserImage) {
    if (typeof indexedDB === 'undefined') {
      this.memory.set(record.meta.id, record);
      return;
    }
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      transaction.objectStore('images').put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new UserError('image.storageFull'));
    });
  }
  async list() {
    return (await this.records())
      .map((r) => r.meta)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async upload(blob: Blob, name: string) {
    if (blob.size > IMAGE_MAX_BYTES) throw new UserError('image.tooLarge');
    const bytes = await blob.arrayBuffer();
    if (!rasterType(new Uint8Array(bytes))) throw new UserError('image.invalid');
    const digest = await crypto.subtle.digest('SHA-256', bytes),
      id = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const records = await this.records(),
      old = records.find((r) => r.meta.id === id);
    if (old) {
      if (old.meta.archived) await this.update(id, { archived: false });
      return { ...old.meta, archived: false };
    }
    const url = URL.createObjectURL(blob),
      img = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new UserError('image.invalid'));
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 360 / img.naturalWidth, 240 / img.naturalHeight);
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const context = canvas.getContext('2d')!;
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      const thumbnail = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new UserError('image.invalid'))),
          'image/webp',
          0.7,
        ),
      );
      const pixel = context.getImageData(
          Math.floor(canvas.width / 2),
          Math.floor(canvas.height / 2),
          1,
          1,
        ).data,
        color =
          '#' + [pixel[0], pixel[1], pixel[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
      const used = records.reduce((n, r) => n + r.blob.size + r.thumbnail.size, 0);
      if (used + blob.size + thumbnail.size > IMAGE_LIBRARY_BYTES || records.length >= 200)
        throw new UserError('image.storageFull');
      const meta: ImageMetadata = {
        id,
        name: name.slice(0, 80),
        width: img.naturalWidth,
        height: img.naturalHeight,
        bytes: blob.size,
        thumbnailBytes: thumbnail.size,
        color,
        createdAt: new Date().toISOString(),
        archived: false,
      };
      await this.put({ meta, blob, thumbnail });
      return meta;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async update(id: string, patch: ImagePatch) {
    const record = (await this.records()).find((r) => r.meta.id === id);
    if (!record) throw new UserError('image.missing');
    record.meta = { ...record.meta, ...patch };
    await this.put(record);
    return { ...record.meta };
  }
  async source(id: string, thumbnail = false) {
    const record = (await this.records()).find((r) => r.meta.id === id);
    if (!record) throw new UserError('image.missing');
    const url = URL.createObjectURL(thumbnail ? record.thumbnail : record.blob);
    return { url, release: () => URL.revokeObjectURL(url) };
  }
  async portable(id: string) {
    const record = (await this.records()).find((r) => r.meta.id === id);
    if (!record) throw new UserError('image.missing');
    return { id, name: record.meta.name, data: await blobBase64(record.blob) };
  }
}
