import type { StoredPhoto } from '../../core/types/domain';
import { createId } from '../../core/utils/ids';
import { nowIso } from '../../core/utils/dates';
import { DataError } from '../../core/utils/errors';
import { getDb, guard } from '../../data/db';

/** Max bytes sent to the AI / stored per photo after downscaling. */
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

export interface PreparedImage {
  data: ArrayBuffer;
  mimeType: string;
  width?: number;
  height?: number;
}

/**
 * Downscales a camera photo (longest side ≤ maxDimension) and re-encodes as JPEG, using
 * createImageBitmap + OffscreenCanvas/canvas (iOS Safari 16.4+). Outside browsers, or when those
 * APIs are missing, the original bytes are returned unchanged.
 */
export async function prepareImage(input: Blob | ArrayBuffer, opts: { maxDimension?: number; quality?: number; mimeType?: string } = {}): Promise<PreparedImage> {
  const maxDim = opts.maxDimension ?? 1024;
  const blob = input instanceof Blob ? input : new Blob([input], { type: opts.mimeType ?? 'image/jpeg' });
  const mimeType = blob.type || opts.mimeType || 'image/jpeg';
  const canDecode = typeof createImageBitmap === 'function' && (typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined');
  if (canDecode) {
    try {
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      let out: Blob;
      if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(w, h);
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
        out = await canvas.convertToBlob({ type: 'image/jpeg', quality: opts.quality ?? 0.8 });
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
        out = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', opts.quality ?? 0.8));
      }
      bitmap.close?.();
      return { data: await out.arrayBuffer(), mimeType: 'image/jpeg', width: w, height: h };
    } catch {
      /* fall through: send original */
    }
  }
  return { data: await blob.arrayBuffer(), mimeType };
}

export async function savePhoto(image: PreparedImage): Promise<StoredPhoto> {
  if (image.data.byteLength === 0) throw new DataError('VALIDATION', 'Empty image');
  if (image.data.byteLength > MAX_PHOTO_BYTES) throw new DataError('VALIDATION', 'Photo is too large');
  const photo: StoredPhoto = {
    id: createId('photo'),
    mimeType: image.mimeType,
    data: image.data,
    byteLength: image.data.byteLength,
    ...(image.width ? { width: image.width } : {}),
    ...(image.height ? { height: image.height } : {}),
    createdAt: nowIso(),
  };
  await guard('Save photo', () => getDb().photos.add(photo));
  return photo;
}

export async function getPhoto(id: string): Promise<StoredPhoto | null> {
  return guard('Get photo', async () => (await getDb().photos.get(id)) ?? null);
}

/** Blob for <img src={URL.createObjectURL(blob)}> (remember to revoke the URL). */
export async function getPhotoBlob(id: string): Promise<Blob | null> {
  const p = await getPhoto(id);
  return p ? new Blob([p.data], { type: p.mimeType }) : null;
}

export async function deletePhoto(id: string): Promise<void> {
  await guard('Delete photo', () => getDb().photos.delete(id));
}

/** Deletes photos no meal entry references (e.g. recognitions the user discarded), older than `minAgeHours`. */
export async function purgeOrphanPhotos(minAgeHours = 24): Promise<number> {
  return guard('Purge photos', async () => {
    const db = getDb();
    const cutoff = new Date(Date.now() - minAgeHours * 3_600_000).toISOString();
    return db.transaction('rw', db.photos, db.mealEntries, async () => {
      const old = await db.photos.where('createdAt').below(cutoff).primaryKeys();
      let n = 0;
      for (const id of old) {
        if ((await db.mealEntries.where('photoId').equals(id).count()) === 0) {
          await db.photos.delete(id);
          n++;
        }
      }
      return n;
    });
  });
}
